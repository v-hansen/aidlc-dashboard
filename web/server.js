#!/usr/bin/env node
'use strict';

// AIDLC Dashboard — web server variant.
// Serves the same v0.2.5 UI as dashboard.html to any browser (no File System
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

// Only loopback host names are accepted. Binding to 127.0.0.1 is not enough on
// its own: with DNS rebinding a hostile site can resolve its own name to
// 127.0.0.1, and its pages would then be same-origin with this server. Checking
// the Host header (and the Origin, when a browser sends one) closes that path.
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
function isLoopbackHost(hostHeader) {
  if (!hostHeader) return false;
  try { return LOOPBACK_HOSTS.has(new URL(`http://${hostHeader}`).hostname); }
  catch { return false; }
}

const app = express();
app.use((req, res, next) => {
  if (!isLoopbackHost(req.headers.host)) return res.status(403).send('Forbidden: non-loopback Host header');
  const origin = req.headers.origin;
  if (origin) {
    let ok = false;
    try { ok = new URL(origin).host === req.headers.host; } catch { ok = false; }
    if (!ok) return res.status(403).send('Forbidden: cross-origin request');
  }
  next();
});
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
    // Units & Bolts artifacts (only exist from stages 2.7 / 2.9 on) — same paths
    // as UNITS_ARTIFACTS in the dashboard's 03-data-layer.js.
    intentData.unitsDag = await readText(path.join(intentDir, 'inception', 'units-generation', 'unit-of-work-dependency.md'));
    intentData.unitsDoc = await readText(path.join(intentDir, 'inception', 'units-generation', 'unit-of-work.md'));
    intentData.boltPlan = await readText(path.join(intentDir, 'inception', 'delivery-planning', 'bolt-plan.md'));

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
  // Compiled stage graph (stage-graph.json, next to scope-grid.json): names, lead and
  // support agents, ALWAYS/CONDITIONAL, conditions and dependencies of the installed
  // engine version. The Workflow tab prefers it over the built-in values.
  for (const cand of gridCandidates.map(c => c.replace('scope-grid.json', 'stage-graph.json'))) {
    const parsed = await readJson(path.join(projectPath, cand));
    if (parsed && typeof parsed === 'object') {
      data.stageGraph = parsed;
      data.stageGraphSource = cand;
      break;
    }
  }
  if (!data.stageGraph && lastDashboard && lastDashboard.stageGraph) {
    data.stageGraph = lastDashboard.stageGraph;
    data.stageGraphSource = lastDashboard.stageGraphSource;
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

// ─── File browser (Files tab): tree + read, rooted at aidlc/ ─────────────────
// Same contract as the IDE extension host (listTree → tree, readFile → file).

const FB_EXTS = ['.md', '.json', '.txt', '.yaml', '.yml'];
const FB_SKIP_DIRS = new Set(['.aidlc-hooks-health', '.aidlc-stop-hook', '.aidlc-sessions', 'node_modules', '.git', 'templates']);
function fbInteresting(name) {
  if (name.startsWith('.') && !name.endsWith('.md')) return false;
  return FB_EXTS.some(e => name.toLowerCase().endsWith(e));
}

async function walkTree(absDir, relBase, depth) {
  if (depth > 6) return [];
  let entries = [];
  try { entries = await fs.readdir(absDir, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of entries) {
    const rel = relBase ? relBase + '/' + e.name : e.name;
    if (e.isDirectory()) {
      if (FB_SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
      const children = await walkTree(path.join(absDir, e.name), rel, depth + 1);
      if (children.length) out.push({ name: e.name, path: rel, kind: 'dir', children });
    } else if (e.isFile() && fbInteresting(e.name)) {
      out.push({ name: e.name, path: rel, kind: 'file' });
    }
  }
  out.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1));
  return out;
}

async function loadTree() {
  const root = aidlcRoot();
  if (!root) return [];
  const activeSpaceRaw = await readText(path.join(root, 'active-space'));
  const space = (activeSpaceRaw ? activeSpaceRaw.trim() : 'default') || 'default';
  const spaceDir = path.join(root, 'spaces', space);
  const roots = [];
  const intentsBase = path.join(spaceDir, 'intents');
  try {
    for (const e of await fs.readdir(intentsBase, { withFileTypes: true })) {
      if (e.isDirectory() && !e.name.startsWith('.')) {
        const relBase = `spaces/${space}/intents/${e.name}`;
        const children = await walkTree(path.join(intentsBase, e.name), relBase, 0);
        if (children.length) roots.push({ name: e.name, path: relBase, kind: 'dir', children });
      }
    }
  } catch { /* no intents */ }
  for (const sub of ['memory', 'codekb']) {
    const relBase = `spaces/${space}/${sub}`;
    const children = await walkTree(path.join(spaceDir, sub), relBase, 0);
    if (children.length) roots.push({ name: sub, path: relBase, kind: 'dir', children });
  }
  return roots;
}

// Read one file by its path relative to aidlc/. Path-traversal guard: the
// resolved path must stay under the aidlc/ root, and only browsable extensions.
async function readAidlcFile(relPath) {
  const root = aidlcRoot();
  if (!root || typeof relPath !== 'string') return null;
  const rootResolved = path.resolve(root);
  const abs = path.resolve(rootResolved, relPath);
  if (!abs.startsWith(rootResolved + path.sep)) return null;
  if (!fbInteresting(path.basename(abs))) return null;
  return readText(abs);
}

// ─── Team Knowledge store (Tier 2): manage aidlc/spaces/<space>/knowledge/ ────
// WRITE surface. AI-DLC's Tier 2 "team knowledge" is the ONLY user-owned
// knowledge layer: free-form .md files under aidlc/spaces/<space>/knowledge/,
// in an `aidlc-shared/` dir (loaded by every agent) or a per-agent dir whose
// name must match the agent slug EXACTLY (a typo'd dir is silently ignored by
// the engine). We never touch Tier 1 (.claude/), the rules layer (memory/),
// codekb/, documentkb/ (AI-DLC-derived) or intents/ through this surface.
//
// Every mutation passes sandboxKnowledge(): destination must be an allowed slug
// (closed list below), the filename must be a safe lowercase `*.md`, and the
// resolved absolute path must stay under the space's knowledge/ root. This is a
// loopback-only server, but the sandbox is what keeps "manage knowledge" from
// becoming "write anywhere under the project".

// The 14 shipped agents + the special shared bucket. Closed allow-list: a
// destination outside this set is rejected, which also prevents creating a
// typo'd directory the engine would ignore.
const AIDLC_AGENT_SLUGS = [
  'aidlc-product-agent', 'aidlc-design-agent', 'aidlc-delivery-agent',
  'aidlc-architect-agent', 'aidlc-aws-platform-agent', 'aidlc-compliance-agent',
  'aidlc-devsecops-agent', 'aidlc-developer-agent', 'aidlc-quality-agent',
  'aidlc-pipeline-deploy-agent', 'aidlc-operations-agent',
  'aidlc-product-lead-agent', 'aidlc-architecture-reviewer-agent',
  'aidlc-composer-agent',
];
const KNOWLEDGE_ALLOWED_DIRS = new Set(['aidlc-shared', ...AIDLC_AGENT_SLUGS]);
// Lowercase, hyphen/dot-separated, must end in .md. Mirrors AI-DLC's filename
// guidance and blocks path separators, leading dots, and non-.md files.
const KNOWLEDGE_NAME_RE = /^[a-z0-9][a-z0-9._-]*\.md$/;
const MAX_KNOWLEDGE_BYTES = 512 * 1024;

async function getActiveSpace() {
  const root = aidlcRoot();
  if (!root) return 'default';
  const raw = await readText(path.join(root, 'active-space'));
  return (raw ? raw.trim() : '') || 'default';
}

async function listSpaces() {
  const root = aidlcRoot();
  if (!root) return ['default'];
  try {
    const entries = await fs.readdir(path.join(root, 'spaces'), { withFileTypes: true });
    const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name);
    return dirs.length ? dirs.sort() : ['default'];
  } catch { return ['default']; }
}

function knowledgeRootFor(space) {
  const root = aidlcRoot();
  if (!root) return null;
  // space is validated by the caller against listSpaces(); still strip any
  // separators defensively so it can never climb out of spaces/.
  const safeSpace = String(space || 'default').replace(/[\/\\]/g, '');
  return path.join(root, 'spaces', safeSpace, 'knowledge');
}

// Resolve + validate a single knowledge file location. Throws on any violation.
function sandboxKnowledge(space, slug, name) {
  if (!KNOWLEDGE_ALLOWED_DIRS.has(slug)) {
    const err = new Error('invalid knowledge directory: ' + slug);
    err.code = 'BAD_SLUG';
    throw err;
  }
  if (typeof name !== 'string' || !KNOWLEDGE_NAME_RE.test(name)) {
    const err = new Error('invalid filename (use lowercase kebab-case ending in .md)');
    err.code = 'BAD_NAME';
    throw err;
  }
  const kroot = knowledgeRootFor(space);
  if (!kroot) {
    const err = new Error('no project selected');
    err.code = 'NO_PROJECT';
    throw err;
  }
  const dir = path.resolve(kroot, slug);
  const abs = path.resolve(dir, name);
  const krootResolved = path.resolve(kroot);
  // abs must be exactly <kroot>/<slug>/<name>; guard against traversal.
  if (abs !== path.join(krootResolved, slug, name) || !abs.startsWith(krootResolved + path.sep)) {
    const err = new Error('path escapes knowledge root');
    err.code = 'ESCAPE';
    throw err;
  }
  return { abs, dir, kroot: krootResolved };
}

// Listing: for the active (or requested) space, every allowed dir that exists
// with its .md files. The client holds the human labels/roles; the server only
// reports what is on disk + whether the knowledge/ root exists yet (bootstrap).
async function listKnowledge(requestedSpace) {
  const root = aidlcRoot();
  if (!root) return { error: 'No project selected' };
  const spaces = await listSpaces();
  const space = spaces.includes(requestedSpace) ? requestedSpace : await getActiveSpace();
  const kroot = knowledgeRootFor(space);
  let knowledgeExists = false;
  try { await fs.access(kroot); knowledgeExists = true; } catch { }

  const dirs = {};
  for (const slug of KNOWLEDGE_ALLOWED_DIRS) {
    const d = path.join(kroot, slug);
    let files = [];
    try {
      const entries = await fs.readdir(d, { withFileTypes: true });
      for (const e of entries) {
        if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
          let bytes = 0, mtime = null;
          try { const st = await fs.stat(path.join(d, e.name)); bytes = st.size; mtime = st.mtimeMs; } catch { }
          files.push({ name: e.name, bytes, mtime });
        }
      }
      files.sort((a, b) => a.name.localeCompare(b.name));
    } catch { /* dir absent — reported as empty */ }
    dirs[slug] = files;
  }
  return { space, spaces, knowledgeExists, dirs };
}

async function readKnowledge(space, slug, name) {
  const { abs } = sandboxKnowledge(space, slug, name);
  return readText(abs);
}

async function writeKnowledge(space, slug, name, content) {
  const { abs, dir } = sandboxKnowledge(space, slug, name);
  const body = String(content == null ? '' : content);
  if (Buffer.byteLength(body, 'utf8') > MAX_KNOWLEDGE_BYTES) {
    const err = new Error('file too large'); err.code = 'TOO_LARGE'; throw err;
  }
  await fs.mkdir(dir, { recursive: true });
  // Atomic write: temp + rename, so the dashboard's own fs.watch never reads a
  // half-written file.
  const tmp = path.join(dir, '.' + name + '.tmp-' + process.pid + '-' + Date.now());
  await fs.writeFile(tmp, body, 'utf8');
  await fs.rename(tmp, abs);
  return true;
}

async function deleteKnowledge(space, slug, name) {
  const { abs } = sandboxKnowledge(space, slug, name);
  try { await fs.unlink(abs); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  return true;
}

async function renameKnowledge(space, slug, name, newSlug, newName) {
  const src = sandboxKnowledge(space, slug, name);
  const dstSlug = newSlug || slug;
  const dstName = newName || name;
  const dst = sandboxKnowledge(space, dstSlug, dstName);
  await fs.mkdir(dst.dir, { recursive: true });
  await fs.rename(src.abs, dst.abs);
  return true;
}

// ─── WebSocket ──────────────────────────────────────────────────────────────

// Only accept sockets opened by this server's own page. Browsers always send
// Origin on WebSocket handshakes, so this stops another site open in the same
// browser from connecting to ws://127.0.0.1:<port> (cross-site WS hijacking).
function isAllowedOrigin(req) {
  if (!isLoopbackHost(req.headers.host)) return false; // DNS rebinding guard
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients (curl, scripts) on loopback
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

function broadcast(type) {
  const msg = JSON.stringify({ type });
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

wss.on('connection', (ws, req) => {
  if (!isAllowedOrigin(req)) { ws.close(1008, 'origin not allowed'); return; }
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
    } else if (msg.type === 'listTree') {
      ws.send(JSON.stringify({ type: 'tree', tree: await loadTree() }));
    } else if (msg.type === 'readFile') {
      ws.send(JSON.stringify({ type: 'file', path: msg.path, content: await readAidlcFile(msg.path) }));
    } else if (msg.type === 'getProject') {
      ws.send(JSON.stringify({ type: 'project', path: projectPath }));
    } else if (msg.type === 'listKnowledge') {
      ws.send(JSON.stringify({ type: 'knowledge', knowledge: await listKnowledge(msg.space) }));
    } else if (msg.type === 'readKnowledge') {
      try {
        const content = await readKnowledge(msg.space, msg.slug, msg.name);
        ws.send(JSON.stringify({ type: 'knowledgeFile', space: msg.space, slug: msg.slug, name: msg.name, content }));
      } catch (e) {
        ws.send(JSON.stringify({ type: 'knowledgeError', op: 'read', slug: msg.slug, name: msg.name, error: e.message }));
      }
    } else if (msg.type === 'writeKnowledge') {
      try {
        await writeKnowledge(msg.space, msg.slug, msg.name, msg.content);
        ws.send(JSON.stringify({ type: 'knowledgeSaved', op: 'write', slug: msg.slug, name: msg.name }));
        ws.send(JSON.stringify({ type: 'knowledge', knowledge: await listKnowledge(msg.space) }));
      } catch (e) {
        ws.send(JSON.stringify({ type: 'knowledgeError', op: 'write', slug: msg.slug, name: msg.name, error: e.message }));
      }
    } else if (msg.type === 'deleteKnowledge') {
      try {
        await deleteKnowledge(msg.space, msg.slug, msg.name);
        ws.send(JSON.stringify({ type: 'knowledgeSaved', op: 'delete', slug: msg.slug, name: msg.name }));
        ws.send(JSON.stringify({ type: 'knowledge', knowledge: await listKnowledge(msg.space) }));
      } catch (e) {
        ws.send(JSON.stringify({ type: 'knowledgeError', op: 'delete', slug: msg.slug, name: msg.name, error: e.message }));
      }
    } else if (msg.type === 'renameKnowledge') {
      try {
        await renameKnowledge(msg.space, msg.slug, msg.name, msg.newSlug, msg.newName);
        ws.send(JSON.stringify({ type: 'knowledgeSaved', op: 'rename', slug: msg.newSlug || msg.slug, name: msg.newName || msg.name }));
        ws.send(JSON.stringify({ type: 'knowledge', knowledge: await listKnowledge(msg.space) }));
      } catch (e) {
        ws.send(JSON.stringify({ type: 'knowledgeError', op: 'rename', slug: msg.slug, name: msg.name, error: e.message }));
      }
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

// ─── REST: Team Knowledge (Tier 2) ───────────────────────────────────────────
// Mirrors the WebSocket surface for curl/scripts. All writes go through the same
// sandboxKnowledge() guard as the socket handlers.

app.get('/api/knowledge', async (req, res) => {
  res.json(await listKnowledge(req.query.space));
});

app.get('/api/knowledge/file', async (req, res) => {
  try {
    const content = await readKnowledge(req.query.space, req.query.slug, req.query.name);
    res.json({ slug: req.query.slug, name: req.query.name, content });
  } catch (e) {
    res.status(400).json({ error: e.message, code: e.code });
  }
});

app.post('/api/knowledge', async (req, res) => {
  const { space, slug, name, content } = req.body || {};
  try {
    await writeKnowledge(space, slug, name, content);
    res.json({ ok: true, slug, name });
  } catch (e) {
    res.status(400).json({ error: e.message, code: e.code });
  }
});

app.delete('/api/knowledge', async (req, res) => {
  const { space, slug, name } = req.body || {};
  try {
    await deleteKnowledge(space, slug, name);
    res.json({ ok: true, slug, name });
  } catch (e) {
    res.status(400).json({ error: e.message, code: e.code });
  }
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
