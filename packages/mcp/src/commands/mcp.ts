import {Args, Command, Flags} from '@oclif/core'
import McpClient, { NpmServerOptions } from '../client.js';
import { splitServerArgsAndTool, parseCliArgsForTool } from '../lib/mcp-utils.js';
import * as readline from 'readline';
import { createHash } from 'crypto';

// Re-export the server functionality for the daemon
export { startNpmServerAndConnect } from '../lib/mcp-server.js';

export default class Mcp extends Command {
  static override args = {
    package: Args.string({description: 'MCP server package name (e.g., @modelcontextprotocol/server-filesystem)', required: true}),
    tool: Args.string({description: 'Tool name to call (optional)'}),
    toolArgs: Args.string({description: 'Tool arguments (optional)', multiple: true}),
  }

  static override description = 'Connect to MCP daemon and run tools'

  static override examples = [
    '<%= config.bin %> <%= command.id %> @modelcontextprotocol/server-filesystem',
    '<%= config.bin %> <%= command.id %> @modelcontextprotocol/server-filesystem --version latest --args /path/to/allowed/dir',
    '<%= config.bin %> <%= command.id %> @modelcontextprotocol/server-filesystem --interactive',
    '<%= config.bin %> <%= command.id %> @modelcontextprotocol/server-filesystem -a C:/ list_directory C:\\Program Files',
  ]

  static override flags = {
    version: Flags.string({char: 'v', description: 'exact version or "latest"'}),
    args: Flags.string({char: 'a', description: 'args passed to the server binary', multiple: true}),
    env: Flags.string({char: 'e', description: 'extra env vars (KEY=VALUE)', multiple: true}),
    clientName: Flags.string({description: 'identify your app'}),
    clientVersion: Flags.string({description: 'client version'}),
    interactive: Flags.boolean({char: 'i', description: 'start interactive tool runner'}),
    verbose: Flags.boolean({char: 'V', description: 'show detailed output including tool schema and arguments'}),
    daemonUrl: Flags.string({description: 'daemon URL', default: 'http://localhost:3001'}),
    serverId: Flags.string({description: 'server ID to use (auto-generated if not provided)'}),
  }

  private client!: McpClient;

  private async ensureDaemonRunning(): Promise<void> {
    const { flags } = await this.parse(Mcp);

    this.client = new McpClient(flags.daemonUrl);

    try {
      await this.client.isDaemonRunning();
    } catch (error) {
      this.error(`MCP daemon not running at ${flags.daemonUrl}. Please start it with 'mcp daemon'`);
    }
  }

  private generateServerId(packageName: string): string {
    // Generate a consistent server ID based on package name and args
    const argsStr = (this.argv ?? []).join('-');
    const hash = createHash('md5').update(`${packageName}-${argsStr}`).digest('hex').substring(0, 8);
    return `${packageName.split('/').pop()}-${hash}`;
  }

  private async ensureServerRunning(): Promise<string> {
    const { args, flags } = await this.parse(Mcp);

    // Parse environment variables
    const env: Record<string, string> = {};
    if (flags.env) {
      for (const envVar of flags.env) {
        const [key, ...valueParts] = envVar.split('=');
        if (key && valueParts.length > 0) env[key] = valueParts.join('=');
      }
    }

    // Heuristically split server args (-a ...) from any accidentally appended tool tokens
    const rawFlagArgs = flags.args ?? [];
    let inferredTool = args.tool as string | undefined;
    let inferredToolArgs = (Array.isArray(args.toolArgs) ? args.toolArgs : (args.toolArgs ? [args.toolArgs] : [])) as string[];

    const split = splitServerArgsAndTool(rawFlagArgs, inferredTool, inferredToolArgs);
    const serverArgs = split.serverArgs;
    if (!inferredTool && split.tool) {
      inferredTool = split.tool;
      inferredToolArgs = split.toolArgs;
    }

    const serverId = flags.serverId || this.generateServerId(args.package);

    const options: NpmServerOptions = {
      pkg: args.package,
      version: flags.version,
      args: serverArgs,
      env: Object.keys(env).length ? env : undefined,
      clientName: flags.clientName,
      clientVersion: flags.clientVersion,
    };

    try {
      // Try to start the server (will fail if already exists, which is fine)
      await this.client.startServer(serverId, options);
      if (flags.verbose) {
        this.log(`Started MCP server: ${args.package} as ${serverId}`);
      }
    } catch (error: any) {
      // If error is about server already existing (400 status), that's fine
      const isServerExistsError = error.response?.status === 400 &&
                                 error.response?.data?.error?.includes('already exists');
      if (!isServerExistsError) {
        throw error;
      }
      if (flags.verbose) {
        this.log(`Using existing MCP server: ${serverId}`);
      }
    }

    return serverId;
  }

  private async callToolByName(serverId: string, toolName: string, toolArgs: string[], verbose: boolean = false) {
    try {
      const toolsResponse = await this.client.listTools(serverId);
      const tool = toolsResponse.tools.find(t => t.name === toolName);

      if (!tool) {
        this.error(`Tool '${toolName}' not found. Available tools: ${toolsResponse.tools.map(t => t.name).join(', ')}`);
        return;
      }

      // Parse tool arguments
      let parsedArgs: any = {};
      if (verbose) {
        this.log("tool", tool);
      }
      if (tool.inputSchema?.properties) {
        parsedArgs = parseCliArgsForTool(tool, toolArgs);
        if (verbose) {
          this.log("parsedArgs", parsedArgs);
        }
      } else if (toolArgs.length > 0) {
        // convention for schema-less tools
        parsedArgs = { path: toolArgs[0] };
      }

      if (verbose) {
        this.log(`Calling tool: ${toolName}`);
        this.log(`Arguments: ${JSON.stringify(parsedArgs, null, 2)}`);
      }

      const result = await this.client.callTool(serverId, toolName, parsedArgs);

      if (verbose) {
        this.log('\nTool Result:');
        this.log(JSON.stringify(result, null, 2));
      } else {
        // Clean output format for non-verbose mode
        this.log(JSON.stringify(result.result, null, 2));
      }

    } catch (error) {
      this.error(`Error calling tool: ${error}`);
    }
  }

  private async runInteractiveToolRunner(serverId: string, verbose: boolean = false) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (query: string): Promise<string> => {
      return new Promise(resolve => rl.question(query, resolve));
    };

    this.log(`\n=== Interactive MCP Tool Runner (${serverId}) ===`);
    this.log('Commands:');
    this.log('  list     - List available tools');
    this.log('  call     - Call a tool by name');
    this.log('  help     - Show this help');
    this.log('  exit     - Exit interactive mode');
    this.log('');

    while (true) {
      try {
        const input = await question('mcp> ');

        if (!input.trim()) continue;

        const [command, ...args] = input.trim().split(/\s+/);

        switch (command.toLowerCase()) {
          case 'list': {
            const toolsResponse = await this.client.listTools(serverId);
            if (toolsResponse.tools.length === 0) {
              this.log('No tools available');
            } else {
              this.log('\nAvailable tools:');
              toolsResponse.tools.forEach((tool, index) => {
                this.log(`${index + 1}. ${tool.name}`);
                if (tool.description) {
                  this.log(`   ${tool.description}`);
                }
                if (tool.inputSchema) {
                  this.log(`   Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`);
                }
                this.log('');
              });
            }
            break;
          }

          case 'call': {
            if (args.length === 0) {
              this.log('Usage: call <tool_name>');
              break;
            }

            const toolName = args[0];
            const toolsResponse = await this.client.listTools(serverId);
            const tool = toolsResponse.tools.find(t => t.name === toolName);

            if (!tool) {
              this.log(`Tool '${toolName}' not found. Use 'list' to see available tools.`);
              break;
            }

            let toolArgs: any = {};

            // If tool has input schema, ask for parameters
            if (tool.inputSchema?.properties) {
              const properties = tool.inputSchema.properties as Record<string, any>;

              for (const [paramName, paramSchema] of Object.entries(properties)) {
                const required = tool.inputSchema.required?.includes(paramName) || false;
                const paramType = paramSchema.type || 'string';
                const description = paramSchema.description || '';

                let prompt = `Enter ${paramName} (${paramType})`;
                if (description) prompt += ` - ${description}`;
                if (required) prompt += ' [required]';
                prompt += ': ';

                const value = await question(prompt);

                if (required && !value.trim()) {
                  this.log(`Parameter '${paramName}' is required.`);
                  toolArgs = null;
                  break;
                }

                // Parse value based on type
                if (value.trim()) {
                  switch (paramType) {
                    case 'number':
                      toolArgs[paramName] = parseFloat(value);
                      break;
                    case 'boolean':
                      toolArgs[paramName] = value.toLowerCase() === 'true';
                      break;
                    case 'array':
                      toolArgs[paramName] = value.split(',').map((v: string) => v.trim());
                      break;
                    default:
                      toolArgs[paramName] = value;
                  }
                }
              }

              if (toolArgs === null) continue; // Skip execution if required param missing
            }

            try {
              if (verbose) {
                this.log(`\nCalling tool: ${toolName}`);
                this.log(`Arguments: ${JSON.stringify(toolArgs, null, 2)}`);
              }

              const result = await this.client.callTool(serverId, toolName, toolArgs);

              if (verbose) {
                this.log('\nTool Result:');
                this.log(JSON.stringify(result, null, 2));
              } else {
                this.log(JSON.stringify(result.result, null, 2));
              }
            } catch (error) {
              this.error(`Error calling tool: ${error}`);
            }
            break;
          }

          case 'help':
            this.log('\nCommands:');
            this.log('  list     - List available tools');
            this.log('  call     - Call a tool by name');
            this.log('  help     - Show this help');
            this.log('  exit     - Exit interactive mode');
            break;

          case 'exit':
          case 'quit':
            this.log('Exiting interactive mode...');
            rl.close();
            return;

          default:
            this.log(`Unknown command: ${command}. Type 'help' for available commands.`);
        }
      } catch (error) {
        this.error(`Error: ${error}`);
      }
    }
  }

  public async run(): Promise<void> {
    const { args, flags } = await this.parse(Mcp);

    // Heuristically split server args (-a ...) from any accidentally appended tool tokens
    const rawFlagArgs = flags.args ?? [];
    let inferredTool = args.tool as string | undefined;
    let inferredToolArgs = (Array.isArray(args.toolArgs) ? args.toolArgs : (args.toolArgs ? [args.toolArgs] : [])) as string[];

    const split = splitServerArgsAndTool(rawFlagArgs, inferredTool, inferredToolArgs);
    if (!inferredTool && split.tool) {
      inferredTool = split.tool;
      inferredToolArgs = split.toolArgs;
    }

    try {
      // Ensure daemon is running
      await this.ensureDaemonRunning();

      // Ensure server is running
      const serverId = await this.ensureServerRunning();

      if (inferredTool) {
        // Call specific tool
        await this.callToolByName(serverId, inferredTool, inferredToolArgs, flags.verbose);
      } else if (flags.interactive) {
        // Start interactive mode
        await this.runInteractiveToolRunner(serverId, flags.verbose);
      } else {
        // Default: list tools
        const toolsResponse = await this.client.listTools(serverId);
        if (toolsResponse.tools.length > 0) {
          if (flags.verbose) {
            this.log('\nAvailable tools:');
            toolsResponse.tools.forEach((tool, i) => {
              this.log(`${i + 1}. ${tool.name}${tool.description ? ` – ${tool.description}` : ''}`);
            });
            this.log('\nTip: you can now run without `--` e.g.:');
            this.log(`${this.config.bin} ${this.id} ${args.package} -a C:\\ list_directory "C:\\Program Files"`);
          } else {
            // In non-verbose mode, just show the tool names
            this.log(toolsResponse.tools.map(t => t.name).join(', '));
          }
        } else {
          this.log('No tools available');
        }
      }

    } catch (error) {
      this.error(`Failed to connect to MCP daemon: ${error}`);
    }
  }
}


