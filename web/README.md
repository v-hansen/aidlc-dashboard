# AIDLC Dashboard — Web server

The **web-server** variant of the [AIDLC Dashboard](../README.md). It runs anywhere — any browser, any OS — powered by a lightweight Node.js backend (Express + WebSocket). Unlike the standalone `dashboard.html` (which needs Chrome's File System Access API) or the VS Code / Kiro extension, this version works in any modern browser.

It renders the same UI (phases, stages, workflow, knowledge, audit, tokens) as the other two options and stays fully local — no data leaves your machine.

## Quick start

```bash
cd web
npm install

# Start with your project path (npm needs the `--` to forward the path)
npm run server -- /path/to/your/project

# Or start without a path — it prompts you to paste the project path
npm run server
```

Then open the URL printed in your terminal (e.g. `http://localhost:3939`).

## Running multiple projects

Each instance automatically picks the next free port starting from the base `3939`:

```bash
# Terminal 1
npm run server -- /path/to/project-a   # → http://localhost:3939

# Terminal 2
npm run server -- /path/to/project-b   # → http://localhost:3940
```

## Configuration

| Env variable | Default | Description |
|---|---|---|
| `PORT` | `3939` | Base port (auto-increments if busy) |

## REST API

| Endpoint | Method | Description |
|---|---|---|
| `/api/project` | GET | Returns the current project path |
| `/api/project` | POST | Sets the project path `{ "path": "/..." }` |
| `/api/dashboard` | GET | Returns full dashboard data (JSON) |
| `/api/tokens` | GET | Returns token/credit consumption data |

## How it works

`server.js` reads the `aidlc/` folder and serves the static UI from `public/` (`index.html` loads `core.js`, the shared rendering engine, then `bridge.js`, the WebSocket layer). A recursive `fs.watch` on the `aidlc/` folder detects any change and broadcasts it to all connected browsers over WebSocket, so the dashboard updates instantly with no polling.

## Requirements

- **Node.js ≥ 18**
- An AI-DLC v2 workflow (the dashboard reads its `aidlc/` folder) — any harness: Kiro IDE, Kiro CLI or Claude Code
- Any modern browser (no File System Access API needed)

## License

MIT
