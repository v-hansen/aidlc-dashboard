#!/usr/bin/env node
'use strict';

// AIDLC Dashboard — web server variant.
// Serves the same v0.2.3 UI as dashboard.html to any browser (no File System
// Access API needed) via Express static + a WebSocket that pushes fresh data
// whenever the project's aidlc/ folder changes (recursive fs.watch).
//
// Usage:
//   npm run server -- /path/to/your/project
//   npm run server            (prompts interactively for the project path)
// The server picks a free port starting at 3939 (override with PORT), so
// multiple projects can run at once.

const express = require('express');
const http = require('http');
const net = require('net');
const readline = require('readline');
const { WebSocketServer } = require('ws');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const os = require('os');

const BASE_PORT = parseInt(process.env.PORT || '3939', 10);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Global state
let projectPath = process.argv[2] || null; // may be provided via CLI
let watcher = null;
let debounceTimer = null;
// Last successfully-loaded dashboard snapshot. The watcher fires reads *during*
// writes, so a file can be momentarily unreadable/half-written; we carry the
// previous good data forward instead of blanking the UI (matches dashboard.html).
let lastDashboard = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function readText(p) {
  try { return await fs.readFile(p, 'utf8'); }
  catch { return null; }
}

async function readJson(p) {
  const text = await readText(p);
  if (text === null) return null;
  try { return JSON.parse(text); }
  catch { return null; }
}

function aidlcRoot() {
  if (!projectPath) return null;
  return path.join(projectPath, 'aidlc');
}

// ─── Load Dashboard Data ────────────────────────────────────────────────────
// Mirrors dashboard.html's loadDashboardData: active-space, clone-id, the
// active space's intents.json, each intent's state/graph/recovery/audit, the
// project memory, and (extended here) the compiled scope-grid.json.

async function loadDashboard() {
  const root = aidlcRoot();
  if (!root) return { intents: [], error: 'No project selected' };

  const data = { intents: [], activeSpace: 'default', cloneId: '', projectMemory: null };

  const activeSpace = await readText(path.join(root, 'active-space'));
  if (activeSpace) data.activeSpace = activeSpace.trim();

  const cloneId = await readText(path.join(root, '.aidlc-clone-id'));
  if (cloneId) data.cloneId = cloneId.trim();

  const spaceDir = path.join(root, 'spaces', data.activeSpace);
  const intentsJson = await readJson(path.join(spaceDir, 'intents', 'intents.json'));
  if (!intentsJson) {
    // intents.json unreadable this instant (missing or half-written during a
    // write): carry forward the previous good snapshot rather than blanking to
    // notAidlc. Matches dashboard.html's mid-write tolerance.
    if (lastDashboard && lastDashboard.intents && lastDashboard.intents.length) return lastDashboard;
    data.errorKey = 'notAidlc';
    return data;
  }

  for (const intent of intentsJson) {
    const intentDir = path.join(spaceDir, 'intents', intent.dirName);
    const intentData = { ...intent, state: null, graph: null, recovery: null, audit: [] };

    intentData.state = await readText(path.join(intentDir, 'aidlc-state.md'));
    intentData.graph = await readJson(path.join(intentDir, 'runtime-graph.json'));
    intentData.recovery = await readText(path.join(intentDir, '.aidlc-recovery.md'));

    // Graph unreadable this cycle? Reuse the previous cycle's graph (better than
    // nulling it while a runtime-graph.json is being rewritten).
    if (!intentData.graph && lastDashboard) {
      const prev = (lastDashboard.intents || []).find(i => i.dirName === intent.dirName);
      if (prev && prev.graph) intentData.graph = prev.graph;
    }

    try {
      const auditDir = path.join(intentDir, 'audit');
      const files = await fs.readdir(auditDir);
      for (const f of files) {
        if (f.endsWith('.md')) {
          const content = await readText(path.join(auditDir, f));
          if (content) intentData.audit.push({ name: f, content });
        }
      }
    } catch { /* no audit dir */ }

    data.intents.push(intentData);
  }

  data.projectMemory = await readText(path.join(spaceDir, 'memory', 'project.md'));

  // Compiled scope grid (optional): AI-DLC v2 writes composed/custom scopes to
  // scope-grid.json. The Workflow tab merges it over the hardcoded grid, so
  // composed scopes show up without re-syncing code. Candidate paths are
  // relative to the PROJECT ROOT (not the aidlc/ folder), matching dashboard.html.
  const gridCandidates = [
    'scope-grid.json',
    '.claude/tools/data/scope-grid.json',
    '.kiro/tools/data/scope-grid.json',
    '.aidlc/tools/data/scope-grid.json',
    '.codex/tools/data/scope-grid.json',
    '.cursor/tools/data/scope-grid.json',
    '.github/aidlc/tools/data/scope-grid.json',
  ];
  for (const cand of gridCandidates) {
    const parsed = await readJson(path.join(projectPath, cand));
    if (parsed && typeof parsed === 'object') {
      data.scopeGrid = parsed;
      data.scopeGridSource = cand;
      break;
    }
  }
  // Preserve the previous cycle's grid if this cycle found none (file in write).
  if (!data.scopeGrid && lastDashboard && lastDashboard.scopeGrid) {
    data.scopeGrid = lastDashboard.scopeGrid;
    data.scopeGridSource = lastDashboard.scopeGridSource;
  }

  // Remember this good snapshot so the next mid-write read can carry it forward.
  lastDashboard = data;
  return data;
}

// ─── Load Tokens (Claude + Kiro) ───────────────────────────────────────────
// Produces the exact aggregate shape renderTokensTab consumes.

async function loadTokens() {
  const agg = {
    input: 0, output: 0, cacheRead: 0, cacheWrite: 0, messages: 0,
    sessions: [], byModel: {}, kiroSessions: [], events: [], kiroEvents: [], kiroCredits: 0,
  };
  await loadClaudeTokens(agg);
  await loadKiroSessions(agg);
  agg.sessions.sort((a, b) => (b.lastTs || '').localeCompare(a.lastTs || ''));
  agg.kiroSessions.sort((a, b) => (b.lastModifiedAt || 0) - (a.lastModifiedAt || 0));
  return agg;
}

// Claude Code stores per-project transcripts under ~/.claude/projects/<slug>,
// where <slug> is the absolute project path with every non-alphanumeric run
// replaced by '-' (e.g. /Users/me/app -> -Users-me-app). The exact scheme is
// version-dependent, so rather than trust one guess we try the common
// encodings first, then fall back to scanning the projects dir and matching by
// normalized slug. If nothing matches, Claude tokens are simply absent (no
// error), which is the correct behavior when the project was never used with
// Claude Code.
function claudeSlug(p) {
  return p.replace(/[^a-zA-Z0-9]/g, '-');
}

async function findClaudeDir(projectsDir, targetPath) {
  const candidates = [
    targetPath.replace(/\//g, '-'),
    claudeSlug(targetPath),
  ];
  for (const c of candidates) {
    const candidate = path.join(projectsDir, c);
    try { await fs.access(candidate); return candidate; } catch { }
  }
  // Fallback: scan and match on the normalized slug so we tolerate differences
  // in how leading/trailing separators or dots were encoded.
  const wanted = claudeSlug(targetPath).replace(/^-+|-+$/g, '');
  let entries = [];
  try {
    entries = await fs.readdir(projectsDir, { withFileTypes: true });
  } catch { return null; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const norm = e.name.replace(/[^a-zA-Z0-9]/g, '-').replace(/^-+|-+$/g, '');
    if (norm === wanted) return path.join(projectsDir, e.name);
  }
  return null;
}

async function loadClaudeTokens(agg) {
  if (!projectPath) return;
  const projectsDir = path.join(os.homedir(), '.claude', 'projects');

  const dir = await findClaudeDir(projectsDir, projectPath);
  if (!dir) return;

  let files = [];
  try {
    files = (await fs.readdir(dir)).filter(f => f.endsWith('.jsonl'));
  } catch { return; }

  for (const f of files) {
    const text = await readText(path.join(dir, f));
    if (!text) continue;
    parseClaudeJsonl(text, f.replace('.jsonl', ''), agg);
  }
}

function parseClaudeJsonl(text, name, agg) {
  const sess = { name, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, messages: 0, firstTs: null, lastTs: null };
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let d;
    try { d = JSON.parse(line); } catch { continue; }
    const usage = d.message?.usage;
    if (!usage) continue;
    const model = d.message?.model || 'unknown';
    sess.messages++; agg.messages++;
    sess.input += usage.input_tokens || 0; agg.input += usage.input_tokens || 0;
    sess.output += usage.output_tokens || 0; agg.output += usage.output_tokens || 0;
    sess.cacheRead += usage.cache_read_input_tokens || 0; agg.cacheRead += usage.cache_read_input_tokens || 0;
    sess.cacheWrite += usage.cache_creation_input_tokens || 0; agg.cacheWrite += usage.cache_creation_input_tokens || 0;
    if (!agg.byModel[model]) agg.byModel[model] = { input: 0, output: 0, messages: 0 };
    agg.byModel[model].input += usage.input_tokens || 0;
    agg.byModel[model].output += usage.output_tokens || 0;
    agg.byModel[model].messages++;
    agg.events.push({
      ts: d.timestamp || null, model,
      i: usage.input_tokens || 0, o: usage.output_tokens || 0,
      cr: usage.cache_read_input_tokens || 0, cw: usage.cache_creation_input_tokens || 0,
    });
    if (d.timestamp) {
      if (!sess.firstTs || d.timestamp < sess.firstTs) sess.firstTs = d.timestamp;
      if (!sess.lastTs || d.timestamp > sess.lastTs) sess.lastTs = d.timestamp;
    }
  }
  if (sess.messages > 0) agg.sessions.push(sess);
}

async function loadKiroSessions(agg) {
  const sessionsDir = path.join(os.homedir(), '.kiro', 'sessions');
  const all = [];
  const matched = [];

  let hashes = [];
  try { hashes = await fs.readdir(sessionsDir); } catch { return; }

  for (const h of hashes) {
    const hashDir = path.join(sessionsDir, h);
    let sessDirs = [];
    try {
      sessDirs = (await fs.readdir(hashDir)).filter(d => d.startsWith('sess_'));
    } catch { continue; }

    for (const sd of sessDirs) {
      const dir = path.join(hashDir, sd);
      const sj = await readJson(path.join(dir, 'session.json'));
      const text = await readText(path.join(dir, 'messages.jsonl'));
      if (!text) continue;

      const kiroSess = {
        title: sj?.title || sd, modelId: sj?.modelId || '',
        lastModifiedAt: sj?.lastModifiedAt || null, lines: 0, contextPct: 0,
        credits: 0, turns: 0, _events: [],
      };

      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        kiroSess.lines++;
        const m = line.match(/"usagePercentage":\s*([\d.]+)/);
        if (m) kiroSess.contextPct = Math.max(kiroSess.contextPct, parseFloat(m[1]));
        if (line.includes('"promptTurnSummaries"')) {
          try {
            const d = JSON.parse(line);
            const arr = d.payload?.promptTurnSummaries || [];
            const credits = arr.reduce((a, x) => a + (x.usage || 0), 0);
            if (credits > 0) {
              kiroSess.credits += credits;
              kiroSess.turns++;
              kiroSess._events.push({ ts: d.timestamp || null, credits });
            }
          } catch { }
        }
      }
      all.push(kiroSess);
      const paths = sj?.workspacePaths || [];
      if (projectPath && paths.some(p => p === projectPath || projectPath.startsWith(p) || p.startsWith(projectPath))) {
        matched.push(kiroSess);
      }
    }
  }

  const selected = matched.length ? matched : all;
  for (const s of selected) {
    agg.kiroCredits += s.credits;
    agg.kiroEvents.push(...s._events);
    delete s._events;
  }
  agg.kiroSessions.push(...selected);
}

// ─── File Watcher ───────────────────────────────────────────────────────────

function startWatcher() {
  stopWatcher();
  const root = aidlcRoot();
  if (!root || !fsSync.existsSync(root)) return;

  try {
    watcher = fsSync.watch(root, { recursive: true }, () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => broadcast('refresh'), 600);
    });
  } catch (err) {
    // Recursive watch is unsupported on some platforms/older Node — fall back
    // to a non-recursive watch on the aidlc/ root so at least top-level changes
    // are picked up.
    try {
      watcher = fsSync.watch(root, () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => broadcast('refresh'), 600);
      });
    } catch { /* watching unavailable */ }
  }
}

function stopWatcher() {
  if (watcher) { watcher.close(); watcher = null; }
}

// ─── WebSocket ──────────────────────────────────────────────────────────────

function broadcast(type) {
  const msg = JSON.stringify({ type });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

wss.on('connection', (ws) => {
  ws.on('message', async (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'setProject') {
      projectPath = msg.path;
      lastDashboard = null; // new project — don't carry the old project's data
      startWatcher();
      const dashboard = await loadDashboard();
      const tokens = await loadTokens();
      ws.send(JSON.stringify({ type: 'data', dashboard }));
      ws.send(JSON.stringify({ type: 'tokens', tokens }));
    } else if (msg.type === 'ready' || msg.type === 'refresh') {
      // Push dashboard AND tokens on every refresh (and initial ready). A watch
      // event on aidlc/ signals a workflow step, which typically also produced
      // new Claude/Kiro transcript usage; refreshing tokens here keeps the
      // Tokens/credits panels live instead of frozen at first load.
      const dashboard = await loadDashboard();
      ws.send(JSON.stringify({ type: 'data', dashboard }));
      const tokens = await loadTokens();
      ws.send(JSON.stringify({ type: 'tokens', tokens }));
    } else if (msg.type === 'refreshTokens') {
      const tokens = await loadTokens();
      ws.send(JSON.stringify({ type: 'tokens', tokens }));
    } else if (msg.type === 'getProject') {
      ws.send(JSON.stringify({ type: 'project', path: projectPath }));
    }
  });

  // Send current state on connect.
  ws.send(JSON.stringify({ type: 'project', path: projectPath }));
});

// ─── REST API (fallback for curl/browser) ───────────────────────────────────

app.post('/api/project', async (req, res) => {
  const { path: p } = req.body;
  if (!p) return res.status(400).json({ error: 'path is required' });
  projectPath = p;
  lastDashboard = null; // new project — don't carry the old project's data
  startWatcher();
  broadcast('refresh');
  res.json({ ok: true, path: projectPath });
});

app.get('/api/project', (req, res) => {
  res.json({ path: projectPath });
});

app.get('/api/dashboard', async (req, res) => {
  res.json(await loadDashboard());
});

app.get('/api/tokens', async (req, res) => {
  res.json(await loadTokens());
});

// ─── Port Discovery ─────────────────────────────────────────────────────────

function isPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => { srv.close(); resolve(true); });
    srv.listen(port, '127.0.0.1');
  });
}

async function findFreePort(start) {
  for (let port = start; port < start + 100; port++) {
    if (await isPortFree(port)) return port;
  }
  throw new Error(`No free port found between ${start} and ${start + 99}`);
}

// ─── Interactive Prompt ─────────────────────────────────────────────────────

function askProjectPath() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\n  📂 Paste the full path of the project: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ─── Start ──────────────────────────────────────────────────────────────────

async function main() {
  let inputPath = process.argv[2] || null;

  if (!inputPath) {
    inputPath = await askProjectPath();
  }

  if (!inputPath) {
    console.error('  ❌ No path provided. Exiting.');
    process.exit(1);
  }

  // Normalize and validate.
  projectPath = path.resolve(inputPath);
  if (!fsSync.existsSync(projectPath)) {
    console.error(`  ❌ Path not found: ${projectPath}`);
    process.exit(1);
  }

  // Find a free port (allows multiple instances).
  const port = await findFreePort(BASE_PORT);

  // Bind to loopback only. This tool has no authentication and reads arbitrary
  // local paths (including ~/.claude and ~/.kiro transcripts) for whatever
  // project path a client sets, so it must stay local-only — the project's
  // stated invariant. Binding to 127.0.0.1 keeps it unreachable from other
  // hosts on the network.
  server.listen(port, '127.0.0.1', () => {
    console.log(`\n  🔬 AIDLC Dashboard Web`);
    console.log(`  ─────────────────────────────────`);
    console.log(`  Project: ${projectPath}`);
    console.log(`  Open in your browser: http://localhost:${port}`);
    console.log(`  ─────────────────────────────────\n`);
    startWatcher();
  });
}

main().catch((err) => {
  console.error('  ❌ Failed to start:', err.message);
  process.exit(1);
});
