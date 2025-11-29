# GenieOS - Comprehensive Codebase Documentation

> A macOS-like desktop interface running in the browser, powered by AI assistants and extensible tool systems.

---

## Project Identity

### What GenieOS Is
- **Browser-based desktop environment** simulating macOS with windows, dock, menu bar
- **AI-powered assistant** using Claude Code SDK for intelligent conversations
- **MCP (Model Context Protocol) integration** for extensible tool execution
- **Multi-backend AI architecture** supporting Claude Code, Dedalus Labs, and browser automation

### What GenieOS Is NOT
- **NOT true generative UI** - Despite videos showing "AI generating UI components", the current implementation streams text content that pre-built React components render. True generative UI (like Vercel's `streamUI()`) would have AI generate React components on-the-fly.

### Origin
Originally named "claude-os", rebranded to "GenieOS" in the latest commits. The project was abandoned but contains a solid foundation for AI-powered desktop experiences.

---

## Architecture Overview

### Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Framework** | Next.js (App Router) | 15.5.0 |
| **Runtime** | React | 19.1.0 |
| **Language** | TypeScript | 5.x |
| **Styling** | Tailwind CSS | 4.x |
| **Animations** | Framer Motion | 12.23.12 |
| **AI SDK** | Vercel AI SDK | 5.0.22 |
| **AI Backend** | Claude Code SDK | 1.0.86 |
| **RPC** | tRPC | 11.5.0 |
| **State** | TanStack Query | 5.85.5 |
| **UI Components** | Radix UI | Various |
| **Container** | Docker + Bun | 1.x |

### Directory Structure

```
genieos/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── page.tsx              # Main desktop UI (506 lines)
│   │   ├── layout.tsx            # Root layout with providers
│   │   ├── api/
│   │   │   ├── chat/route.ts     # AI streaming endpoint
│   │   │   └── trpc/[trpc]/      # tRPC API handler
│   │   ├── neo/                  # Alternative layout
│   │   └── ipad/                 # iPad-optimized view
│   │
│   ├── components/               # React components
│   │   ├── claude-chat.tsx       # Main AI chat (useChat hook)
│   │   ├── dedalus-chat.tsx      # Alternative AI backend
│   │   ├── browser.tsx           # Web browser component
│   │   ├── terminal.tsx          # Terminal emulator
│   │   ├── NativeTerminal.tsx    # Native terminal
│   │   ├── file-browser.tsx      # File explorer
│   │   ├── gcp-vm-list.tsx       # GCP VM management
│   │   ├── macos-dock.tsx        # macOS-style dock
│   │   ├── notes-app.tsx         # Notes application
│   │   └── ui/                   # Reusable components
│   │       ├── glass-effect.tsx  # Glassmorphism effects
│   │       └── ...
│   │
│   ├── server/
│   │   └── api/
│   │       ├── root.ts           # tRPC router aggregator
│   │       ├── trpc.ts           # tRPC configuration
│   │       └── routers/          # Feature routers
│   │           ├── terminal.ts   # Shell execution
│   │           ├── files.ts      # File operations
│   │           ├── gcp.ts        # GCP VM management
│   │           ├── dedalus.ts    # AI streaming
│   │           ├── kernel.ts     # Browser kernel
│   │           ├── crypto.ts     # Crypto tracking
│   │           └── browser-use.ts# Browser automation
│   │
│   └── lib/                      # Utilities
│
├── packages/
│   └── mcp/                      # MCP daemon package
│       ├── src/
│       │   ├── daemon.ts         # Express server (port 3001)
│       │   ├── client.ts         # REST client
│       │   └── lib/
│       │       └── mcp-server.ts # Server connection
│       └── bin/                  # CLI entry points
│
├── public/assets/                # Static assets
├── experiments/                  # Experimental features
└── Configuration files...
```

---

## Core Systems Deep Dive

### 1. AI Integration Architecture

#### Current Implementation: Text Streaming (NOT Generative UI)

The AI chat uses `createUIMessageStream` to stream text content:

```
User Input → POST /api/chat → Claude Code SDK → Stream text chunks →
Pre-built React components render the text
```

**NOT:**
```
User Input → AI generates JSX → Stream components → Dynamic rendering
```

#### API Endpoint: `src/app/api/chat/route.ts`

```typescript
import { query } from "@anthropic-ai/claude-code";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const claudeOptions = {
        appendSystemPrompt: `You are GenieOS...`,
        permissionMode: "bypassPermissions",  // ⚠️ SECURITY: Review this
      };

      for await (const message of query({ prompt, options: claudeOptions })) {
        if (message.type === "assistant") {
          writer.write({ type: "text-start", id: "0" });
          for (const part of message.message.content) {
            if (part.type === "text") {
              writer.write({ type: "text-delta", delta: part.text, id: "0" });
            }
          }
          writer.write({ type: "text-end", id: "0" });
        }
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
```

#### Client Component: `src/components/claude-chat.tsx`

```typescript
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const { messages, sendMessage, status, stop } = useChat({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
});

// Send multimodal messages (text + images)
sendMessage({
  role: "user",
  parts: [
    { type: "file", url: base64Image, mediaType: "image/png" },
    { type: "text", text: "Describe this image" },
  ],
});
```

#### Message Part Types

| Type | Description |
|------|-------------|
| `text` | Text content |
| `file` | File attachment (images as base64) |
| `image` | Rendered image |
| `reasoning` | AI reasoning/thinking |
| `dynamic-tool` | Tool invocation display |
| `source-url` | Source reference |
| `source-document` | Document reference |
| `step-start` | Processing step marker |

---

### 2. MCP (Model Context Protocol) System

The MCP daemon manages multiple tool servers via a REST API.

#### Daemon Architecture: `packages/mcp/src/daemon.ts`

```typescript
class McpDaemon {
  private servers: Map<string, ManagedServer> = new Map();
  private port: number = 3001;

  // REST endpoints:
  // GET  /health                           - Health check
  // POST /servers                          - Start server
  // GET  /servers                          - List servers
  // GET  /servers/:id/tools                - List tools
  // POST /servers/:id/tools/:name/call     - Execute tool
  // DELETE /servers/:id                    - Stop server
  // DELETE /servers                        - Stop all
}
```

#### CLI Usage

```bash
# Execute tool directly
bunx @genieos/mcp @modelcontextprotocol/server-puppeteer -- puppeteer_screenshot shot.png

# With arguments
bunx @genieos/mcp @modelcontextprotocol/server-filesystem -a '~/Desktop' -- list_directory '~/Desktop'

# Interactive mode
bunx @genieos/mcp @modelcontextprotocol/server-puppeteer -i

# List available tools
bunx @genieos/mcp @modelcontextprotocol/server-puppeteer help
```

#### Adding New MCP Servers

1. The AI can invoke any NPM MCP server via the CLI
2. Claude's system prompt includes MCP usage examples
3. Servers are started on-demand and cached by the daemon

---

### 3. tRPC Backend System

Type-safe RPC between frontend and backend.

#### Router Organization: `src/server/api/root.ts`

```typescript
export const appRouter = router({
  crypto: cryptoRouter,      // Cryptocurrency tracking
  files: filesRouter,        // File operations
  gcp: gcpRouter,           // GCP VM management
  terminal: terminalRouter,  // Shell command execution
  kernel: kernelRouter,      // Browser kernel (OnKernel SDK)
  dedalus: dedalusRouter,    // Dedalus AI integration
  browserUse: browserUseRouter, // Browser automation
});
```

#### Example: Terminal Router

```typescript
// src/server/api/routers/terminal.ts
execute: procedure
  .input(z.object({
    command: z.string(),
    cwd: z.string().optional(),
    timeout: z.number().default(30000),
  }))
  .mutation(async ({ input }) => {
    // Executes shell command and returns result
  });
```

#### Client Usage

```typescript
import { api } from "@/utils/api";

// Execute terminal command
const { mutateAsync: execute } = api.terminal.execute.useMutation();
const result = await execute({ command: "ls -la", cwd: "/home" });
```

---

### 4. UI System

#### Desktop Modes

The main page (`src/app/page.tsx`) supports four modes:

| Mode | Description |
|------|-------------|
| `default` | Clean desktop, apps open individually |
| `cluttered` | 12+ random windows for chaos demo |
| `focused` | Single browser window centered |
| `welcome` | Welcome screen with logo |

#### Component Hierarchy

```
<main> (Desktop background)
├── <GlassEffect> (Menu bar)
├── <GlassWindow> (Floating windows)
│   ├── <FileBrowser> / <FileBrowserEnhanced>
│   ├── <DownloadTinder>
│   ├── <GCPVMList>
│   ├── <DedalusChat>
│   └── <NotesApp>
├── <MacOSDock> (Bottom dock)
├── <ClaudeChat> (Floating chat)
├── <Terminal> (Command palette)
├── <NativeTerminal> (System terminal)
├── <Browser> (Web browser)
└── <Toaster> (Notifications)
```

#### Glassmorphism Effects

```typescript
// src/components/ui/glass-effect.tsx
<GlassEffect className="...">
  {/* Backdrop blur + transparency */}
</GlassEffect>

<GlassWindow title="Window Title" onClose={() => {}}>
  {/* Window with traffic light buttons */}
</GlassWindow>
```

---

## Development Workflow

### Running Locally

**With Docker (recommended):**
```bash
docker compose up --build
# Access at http://localhost:3000
```

**Without Docker:**
```bash
bun install
bun run dev
# In another terminal: start MCP daemon
cd packages/mcp && bun run daemon
```

### Environment Variables

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...  # Required for Claude Code
```

### Docker Configuration

The `Dockerfile` sets up:
1. Bun runtime with Claude Code globally installed
2. Python 3 + uv for Python tooling
3. Puppeteer/Chrome for browser automation
4. MCP daemon auto-start with dev server
5. Non-root user for security

---

## Extension Points

### Adding a New Desktop App

1. Create component in `src/components/`
2. Add icon in `src/components/macos-icons.tsx`
3. Register in dock apps array in `src/app/page.tsx`:

```typescript
const dockApps = [
  // ... existing apps
  { id: 'myapp', name: 'My App', icon: <MyAppIcon /> },
];
```

4. Handle click in `onItemClick`:

```typescript
if (item.id === 'myapp') {
  setActiveApp('myapp');
}
```

5. Render in default mode:

```typescript
{activeApp === 'myapp' && (
  <GlassWindow title="My App" onClose={() => setActiveApp(null)}>
    <MyAppComponent />
  </GlassWindow>
)}
```

### Adding a New tRPC Router

1. Create router in `src/server/api/routers/myrouter.ts`:

```typescript
import { router, publicProcedure } from '../trpc';
import { z } from 'zod';

export const myRouter = router({
  myAction: publicProcedure
    .input(z.object({ param: z.string() }))
    .mutation(async ({ input }) => {
      // Implementation
      return { result: 'success' };
    }),
});
```

2. Register in `src/server/api/root.ts`:

```typescript
import { myRouter } from './routers/myrouter';

export const appRouter = router({
  // ... existing routers
  my: myRouter,
});
```

3. Use in components:

```typescript
const { mutateAsync } = api.my.myAction.useMutation();
```

### Adding New AI Backends

The architecture supports multiple AI backends:

1. **Claude Code** (primary): `src/app/api/chat/route.ts`
2. **Dedalus Labs**: `src/server/api/routers/dedalus.ts` + `src/components/dedalus-chat.tsx`

To add another:
1. Create tRPC router with streaming support (use `observable`)
2. Create chat component using the router
3. Add to dock apps

---

## Future Development Roadmap

### True Generative UI Implementation

**Current Gap:** AI generates text → pre-built components render it.

**Target:** AI generates React components → streamed to client → dynamic rendering.

**Required Changes:**

1. Migrate to React Server Components (RSC)
2. Use Vercel AI SDK's `streamUI()` instead of `createUIMessageStream()`
3. Create tool → component mappings:

```typescript
// Future implementation pattern
import { streamUI } from 'ai/rsc';

async function submitUserMessage(content: string) {
  const result = await streamUI({
    model: anthropic('claude-3-5-sonnet'),
    messages: [{ role: 'user', content }],
    tools: {
      showChart: {
        description: 'Show a chart',
        parameters: z.object({ data: z.array(z.number()) }),
        generate: async function* ({ data }) {
          yield <LoadingSpinner />;
          return <Chart data={data} />;  // AI generates actual component
        },
      },
    },
  });
  return result;
}
```

4. Architecture changes:
   - Move to RSC for streaming components
   - Create component registry for AI to select from
   - Implement secure sandboxing for dynamic components

### Desktop Integration (Electron/Tauri)

**Current:** Browser-only web application.

**Target:** Native desktop app with system integration.

**Options:**

| Framework | Pros | Cons |
|-----------|------|------|
| **Electron** | Mature, full Node.js access, large ecosystem | Heavy (~150MB), memory intensive |
| **Tauri** | Lightweight (~10MB), Rust backend, secure | Smaller ecosystem, Rust learning curve |

**Features to implement:**
- System tray with quick actions
- Global keyboard shortcuts
- Native notifications
- Local file system access (improved)
- Auto-update mechanism

---

## Genie Framework Integration

This codebase integrates with the Genie agent framework patterns from `/home/namastex/AGENTS.md`.

### Key Patterns to Preserve

1. **Orchestration Boundary**: Base Genie orchestrates, never implements directly
2. **MCP-First**: Use MCP tools for dynamic discovery over static files
3. **Token Efficiency**: Keep consciousness lean, use `/tmp/genie/` for scratch
4. **No Wish Without Issue**: Link all work to GitHub issues

### Spell Integration

GenieOS can leverage Genie spells for:
- Context gathering (`know-yourself`)
- Protocol enforcement (`ace-protocol`)
- Discovery workflows

```bash
mcp__genie__read_spell("know-yourself")
mcp__genie__list_agents()
mcp__genie__task(agent="code", prompt="Fix bug in chat component")
```

---

## Critical Files Reference

### When You Need To...

| Task | File(s) |
|------|---------|
| Modify AI chat behavior | `src/app/api/chat/route.ts` |
| Change chat UI | `src/components/claude-chat.tsx` |
| Add desktop features | `src/app/page.tsx` |
| Add backend capabilities | `src/server/api/routers/*.ts` |
| Modify MCP daemon | `packages/mcp/src/daemon.ts` |
| Change Docker setup | `Dockerfile`, `docker-compose.yml` |
| Add UI components | `src/components/ui/*.tsx` |
| Modify tRPC config | `src/server/api/trpc.ts` |

### Import Patterns

```typescript
// Components
import { ClaudeChat } from "@/components/claude-chat";
import { GlassWindow } from "@/components/ui/glass-effect";

// tRPC
import { api } from "@/utils/api";

// AI SDK
import { useChat } from "@ai-sdk/react";
import { createUIMessageStream } from "ai";

// Claude Code
import { query } from "@anthropic-ai/claude-code";
```

---

## Known Issues & Technical Debt

### Security Concerns

1. **`permissionMode: "bypassPermissions"`** in chat route - needs review for production
2. No input sanitization on terminal commands
3. CORS enabled globally on MCP daemon

### Missing Features

1. **Error boundaries** - App crashes propagate to full page
2. **Loading states** - Inconsistent loading indicators
3. **Test coverage** - No tests currently
4. **Authentication** - No user auth system

### Performance

1. Large message histories not virtualized
2. No pagination on file browser
3. Browser component always initializes even when hidden

---

## Quick Commands

```bash
# Development
bun run dev                    # Start dev server
bun run build                  # Production build
bun run lint                   # Run linter

# Docker
docker compose up --build      # Full stack with hot reload
docker compose down            # Stop all containers

# MCP
cd packages/mcp
bun run daemon                 # Start MCP daemon
bun run cli                    # Interactive CLI
```

---

## Contributing

1. Read this document fully
2. Check existing GitHub issues
3. Create feature branch from `main`
4. Follow existing code patterns
5. Test with Docker setup
6. Create PR with description

---

*This documentation was generated to provide comprehensive self-knowledge for AI-assisted development of GenieOS.*
