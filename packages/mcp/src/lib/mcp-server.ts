import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { NpmServerOptions } from '../client.js';

export async function startNpmServerAndConnect(opts: NpmServerOptions) {
  const npx = process.platform === "win32" ? "npx.cmd" : "npx";
  const pkgSpec = opts.version ? `${opts.pkg}@${opts.version}` : opts.pkg;

  // Launch the server via NPX; this downloads the package if missing.
  const transport = new StdioClientTransport({
    command: npx,
    args: ["-y", pkgSpec, ...(opts.args ?? [])],
    env: opts.env
  });

  // Create and connect the MCP client
  const client = new Client({
    name: opts.clientName ?? "ts-bootstrap",
    version: opts.clientVersion ?? "1.0.0",
  });

  await client.connect(transport);

  return {
    client,
    /** Gracefully close transport + child process */
    close: () => transport.close(),
  };
}
