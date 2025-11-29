import {Args, Command, Flags} from '@oclif/core'
import McpDaemon from '../daemon.js'

export default class Daemon extends Command {
  static override args = {}

  static override description = 'Start the MCP daemon server'

  static override examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --port 3001',
  ]

  static override flags = {
    port: Flags.integer({char: 'p', description: 'Port to run the daemon on', default: 3001}),
    'log-level': Flags.string({description: 'Log level', default: 'info', options: ['error', 'warn', 'info', 'debug']}),
  }

  public async run(): Promise<void> {
    const { flags } = await this.parse(Daemon)

    const daemon = new McpDaemon(flags.port)

    this.log(`Starting MCP daemon on port ${flags.port}...`)

    try {
      await daemon.start()

      // Handle graceful shutdown
      process.on('SIGINT', async () => {
        this.log('Shutting down MCP daemon...')
        await daemon.stop()
        process.exit(0)
      })

      process.on('SIGTERM', async () => {
        this.log('Shutting down MCP daemon...')
        await daemon.stop()
        process.exit(0)
      })

      // Keep the process running
      await new Promise(() => {}) // This will run indefinitely until interrupted

    } catch (error) {
      this.error(`Failed to start daemon: ${error}`)
    }
  }
}
