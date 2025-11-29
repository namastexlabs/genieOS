# mcp

A CLI tool for interacting with any [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server

## Installation

```bash
npm install -g mcpcli
```

## Usage

The `mcp` command allows you to start any MCP server and interact with its tools.

### Basic Syntax

```bash
mcp <package-name> [tool-name] [tool-args...]
```

### Examples

**List available tools from a server:**
```bash
mcp @modelcontextprotocol/server-filesystem
```

**Call a specific tool (non-verbose - shows only JSON result):**
```bash
mcp @modelcontextprotocol/server-filesystem -a 'C:\' -- list_directory 'C:\Program Files'
```

**Call a specific tool (verbose - shows detailed info):**
```bash
mcp @modelcontextprotocol/server-filesystem -V -a 'C:\' -- list_directory 'C:\Program Files'
```

**Start interactive mode:**
```bash
mcp @modelcontextprotocol/server-filesystem --interactive
```

## Command Options

### Flags

- `-v, --version=<value>` - Exact version or "latest" for the MCP server package
- `-a, --args=<value>` - Arguments to pass to the server binary (multiple allowed)
- `-e, --env=<value>` - Extra environment variables (KEY=VALUE format, multiple allowed)
- `--client-name=<value>` - Identify your app to the server
- `--client-version=<value>` - Client version to report to the server
- `-i, --interactive` - Start interactive tool runner mode
- `-V, --verbose` - Show detailed output including tool schema and arguments

### Arguments

- `package` - **Required.** MCP server package name (e.g., `@modelcontextprotocol/server-filesystem`)
- `tool` - **Optional.** Tool name to call immediately
- `toolArgs` - **Optional.** Arguments to pass to the specified tool

## Verbose vs Non-Verbose Output

### Non-Verbose Mode (Default)
Shows only the JSON tool result:
```bash
mcp @modelcontextprotocol/server-filesystem -a 'C:\' -- list_directory 'C:\Program Files'
# Output: {"content": [{"type": "text", "text": "[DIR] 7-Zip\n[DIR] Adobe\n..."}]}
```

### Verbose Mode
Shows detailed information including tool schema, arguments, and full JSON response:
```bash
mcp @modelcontextprotocol/server-filesystem -V -a 'C:\' -- list_directory 'C:\Program Files'
# Output: tool { name: 'list_directory', description: '...', inputSchema: {...} }
#         parsedArgs { path: 'C:\\Program Files' }
#         Calling tool: list_directory
#         Arguments: { "path": "C:\\Program Files" }
#         Tool Result: { "content": [...] }
```

## Interactive Mode

When using `--interactive` flag, you'll enter an interactive session where you can:

- `list` - Show all available tools from the server
- `call <tool_name>` - Call a specific tool
- `help` - Show available commands
- `exit` - Exit interactive mode

## Examples

### File System Server

```bash
# List directory contents (non-verbose - shows only JSON result)
mcpcli @modelcontextprotocol/server-filesystem -a 'C:\' -- list_directory 'C:\Program Files'

# List directory contents (verbose - shows detailed info)
mcpcli @modelcontextprotocol/server-filesystem -V -a 'C:\' -- list_directory 'C:\Program Files'

# Read a file
mcpcli @modelcontextprotocol/server-filesystem -a 'C:\' -- read_file 'C:\Program Files\example.txt'

# Interactive mode
mcpcli @modelcontextprotocol/server-filesystem -a 'C:\' --interactive
```

### With Environment Variables

```bash
# Pass environment variables to the server
mcpcli @modelcontextprotocol/server-filesystem -e DEBUG=1 -a 'C:\' -- list_directory 'C:\Program Files'
```

### With Specific Version

```bash
# Use a specific version of the server
mcpcli @modelcontextprotocol/server-filesystem --version 0.1.0 -a 'C:\' -- list_directory 'C:\Program Files'
```