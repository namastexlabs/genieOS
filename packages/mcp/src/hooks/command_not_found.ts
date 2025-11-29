import {Hook} from '@oclif/core'

const hook: Hook.CommandNotFound = async function (opts) {
  // When no command is found, assume it's an MCP server call
  // We need to reconstruct the full command from the original input
  const argv = opts.argv || []

  // The original command was: npx mcpcli @modelcontextprotocol/server-filesystem -a 'C:\' -- list_directory 'C:\Program Files'
  // But oclif's command_not_found hook doesn't include the package name in argv
  // We need to get it from the original id or reconstruct it

  // For now, let's try to extract the package name from the command line
  // This is a bit of a hack, but it should work for this use case
  const fullCommand = process.argv.slice(2) // Remove 'node' and script path
  const packageName = fullCommand[0] // First argument should be the package name

  if (packageName && packageName.startsWith('@')) {
    await opts.config.runCommand('mcp', [packageName, ...argv])
  } else {
    // Fallback: try to run with just the argv
    await opts.config.runCommand('mcp', argv)
  }
}

export default hook;