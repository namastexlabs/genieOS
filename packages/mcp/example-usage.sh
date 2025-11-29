#!/bin/bash

echo "=== MCP Daemon Architecture Example ==="
echo ""

echo "1. Start the MCP daemon in the background:"
echo "   mcp daemon"
echo ""

echo "2. In a separate terminal, use the MCP command (it will connect to the daemon):"
echo "   mcp @modelcontextprotocol/server-filesystem --args /path/to/directory"
echo ""

echo "3. List available tools:"
echo "   mcp @modelcontextprotocol/server-filesystem"
echo ""

echo "4. Call a specific tool:"
echo "   mcp @modelcontextprotocol/server-filesystem list_directory"
echo ""

echo "5. Use interactive mode:"
echo "   mcp @modelcontextprotocol/server-filesystem --interactive"
echo ""

echo "6. Multiple commands will reuse the same server connection!"
echo "   mcp @modelcontextprotocol/server-filesystem list_directory"
echo "   mcp @modelcontextprotocol/server-filesystem read_file path/to/file.txt"
echo ""

echo "7. Stop the daemon when done:"
echo "   Press Ctrl+C in the daemon terminal"
echo ""

echo "Benefits of this architecture:"
echo "- Servers stay running between commands"
echo "- Faster subsequent calls (no startup time)"
echo "- Multiple MCP servers can be managed by one daemon"
echo "- Persistent connections reduce overhead"
echo ""
