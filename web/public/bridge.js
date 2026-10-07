// Bridge: replaces the browser File System Access API layer of core.js with a
// WebSocket connection to the Node.js server. Loaded AFTER core.js so its
// overrides win over the definitions in core.js.
//
// The server (server.js) walks the project's aidlc/ folder and pushes fresh
// dashboard + token data over the socket, driven by a recursive fs.watch — so
// there is NO client-side polling here (the auto-refresh timers are no-ops).

let ws = null;
let wsReconnectTimer = null;
let currentProjectPath = null;

function connectWebSocket() {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  ws = new WebSocket(`${proto}://${location.host}`);

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'getProject' }));
  };

  ws.onmessage = (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }

    if (msg.type === 'project') {
      currentProjectPath = msg.path;
      if (currentProjectPath) {
        const projectName = currentProjectPath.split('/').filter(Boolean).pop() || currentProjectPath;
        document.title = `AIDLC Dashboard - ${projectName}`;
        // Project already set (via CLI or a previous session) — request data.
        ws.send(JSON.stringify({ type: 'ready' }));
      } else {
        // No project yet — show the project-path selector screen.
        showProjectSelector();
      }
    } else if (msg.type === 'data') {
      dashboardData = msg.dashboard;
      document.getElementById('app').innerHTML = renderDashboard(dashboardData);
      switchTab(activeTab);
      const ind = document.getElementById('refresh-indicator');
      if (ind) ind.textContent = t('updatedAt') + ' ' + new Date().toLocaleTimeString(LOCALES[lang] || 'en-US');
    } else if (msg.type === 'tokens') {
      tokenData = msg.tokens;
      const el = document.getElementById('tab-tokens');
      if (el) el.innerHTML = safeRender(renderTokensTab);
    } else if (msg.type === 'tree') {
      fbLoading = false;
      fbTree = msg.tree || [];
      const el = document.getElementById('tab-files');
      if (el) { el.innerHTML = safeRender(renderFilesTab); if (activeTab === 'files') requestAnimationFrame(runMermaid); }
    } else if (msg.type === 'file') {
      fbContentCache[msg.path] = msg.content != null ? msg.content : ('(could not read ' + msg.path + ')');
      fbSelectedPath = msg.path;
      const el = document.getElementById('tab-files');
      if (el) { el.innerHTML = safeRender(renderFilesTab); requestAnimationFrame(runMermaid); }
    } else if (msg.type === 'refresh') {
      // Server signalled a file change — ask for fresh data.
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'refresh' }));
    }
  };

  ws.onclose = () => {
    ws = null;
    // Reconnect after 3s.
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    wsReconnectTimer = setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = () => { ws?.close(); };
}

// ─── Project-path selector screen ───────────────────────────────────────────

// Render the selector into #app AND wire up its event listeners. Recent-path
// rows use data attributes + addEventListener rather than string-interpolated
// inline onclick handlers, so a stored path containing quotes or backslashes
// cannot break out of the handler (the value only ever lives in the DOM as
// escaped text / a data attribute, never as executable JS source).
function showProjectSelector() {
  const app = document.getElementById('app');
  app.innerHTML = renderProjectSelector();

  const input = document.getElementById('project-path-input');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') selectProjectFromInput();
    });
  }
  const goBtn = app.querySelector('[data-action="go"]');
  if (goBtn) goBtn.addEventListener('click', selectProjectFromInput);

  app.querySelectorAll('[data-recent-path]').forEach((row) => {
    const p = row.getAttribute('data-recent-path');
    row.addEventListener('click', () => selectProject(p));
    const del = row.querySelector('[data-action="remove"]');
    if (del) {
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        removeRecentPath(p);
      });
    }
  });
}

function renderProjectSelector() {
  const savedPaths = loadRecentPaths();
  let recentsHtml = '';
  if (savedPaths.length) {
    recentsHtml = `
      <div style="margin-top:16px;text-align:left;width:100%;max-width:500px">
        <h3 style="margin-bottom:8px">${t('recentProjects')}</h3>
        ${savedPaths.map(p => `
          <div class="knowledge-item" style="cursor:pointer;display:flex;align-items:center;gap:8px" data-recent-path="${esc(p)}">
            <span style="flex:1;font-size:0.82rem;word-break:break-all">${esc(p)}</span>
            <button class="info-btn" data-action="remove" title="✕">✕</button>
          </div>
        `).join('')}
      </div>`;
  }

  return `
    <div class="load-area">
      ${renderLangSelector()}
      <div class="header-logo">🔬</div>
      <h1>AI-DLC v2 Dashboard</h1>
      <p class="load-desc">${t('webLoadDesc')}</p>
      <div style="display:flex;gap:8px;width:100%;max-width:500px">
        <input id="project-path-input" type="text" placeholder="/path/to/your/project"
          style="flex:1;padding:12px 16px;border-radius:var(--radius);border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:0.9rem"
          value="${esc(currentProjectPath || '')}">
        <button class="load-btn" data-action="go" style="padding:12px 20px">→</button>
      </div>
      ${recentsHtml}
      <p style="color:var(--text-muted);font-size:0.75rem;margin-top:12px">
        ${t('webCliHint')}
      </p>
    </div>
  `;
}

function selectProjectFromInput() {
  const input = document.getElementById('project-path-input');
  const p = input?.value?.trim();
  if (!p) return;
  selectProject(p);
}

function selectProject(p) {
  currentProjectPath = p;
  saveRecentPath(p);
  const projectName = p.split('/').filter(Boolean).pop() || p;
  document.title = `AIDLC Dashboard - ${projectName}`;
  document.getElementById('app').innerHTML =
    `<div class="load-area"><div class="header-logo">🔬</div><h1>AI-DLC v2 Dashboard</h1><p class="load-desc">${t('loading')}</p></div>`;
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'setProject', path: p }));
  }
}

// ─── Recent-paths persistence (localStorage) ────────────────────────────────

function loadRecentPaths() {
  try {
    return JSON.parse(localStorage.getItem('aidlc-recent-paths') || '[]');
  } catch { return []; }
}

function saveRecentPath(p) {
  const paths = loadRecentPaths().filter(x => x !== p);
  paths.unshift(p);
  try { localStorage.setItem('aidlc-recent-paths', JSON.stringify(paths.slice(0, 10))); } catch {}
}

function removeRecentPath(p) {
  const paths = loadRecentPaths().filter(x => x !== p);
  try { localStorage.setItem('aidlc-recent-paths', JSON.stringify(paths)); } catch {}
  showProjectSelector();
}

// ─── Overrides of core.js environment functions ─────────────────────────────

// openFolder: in the web context, show the project selector instead of the
// File System Access directory picker.
function openFolder() {
  showProjectSelector();
}

// openTokensFolder / loadTokenData: ask the server to (re)read the transcripts.
function openTokensFolder() {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'refreshTokens' }));
}

async function loadTokenData() {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'refreshTokens' }));
}

// refreshData: ask the server for fresh dashboard + token data.
async function refreshData() {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'refresh' }));
    ws.send(JSON.stringify({ type: 'refreshTokens' }));
  }
}

async function refreshTokens() {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'refreshTokens' }));
}

// File browser (Files tab): ask the server for the tree and file contents —
// the page has no filesystem access of its own.
async function loadFileTree() {
  if (fbLoading) return;
  if (!ws || ws.readyState !== 1) return;
  fbLoading = true;
  ws.send(JSON.stringify({ type: 'listTree' }));
}

async function openAidlcFile(path) {
  fbSelectedPath = path;
  if (fbContentCache[path] != null) {
    const el = document.getElementById('tab-files');
    if (el) { el.innerHTML = safeRender(renderFilesTab); requestAnimationFrame(runMermaid); }
  } else if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'readFile', path }));
  }
}

// Auto-refresh is handled server-side by the file watcher (WebSocket push).
// The toggles in core.js stay functional for UX, but these start/stop hooks are
// no-ops so no client-side polling ever runs.
function startAutoRefresh() {}
function stopAutoRefresh() {}
function startTokenRefresh() {}
function stopTokenRefresh() {}

// ─── Web-only I18N keys ─────────────────────────────────────────────────────

Object.assign(I18N.pt = I18N.pt || {}, {
  webLoadDesc: 'Informe o caminho do projeto que contém a pasta <code>aidlc/</code>.',
  webCliHint: 'Dica: você também pode passar o caminho ao iniciar o servidor:<br><code>npm run server -- /caminho/do/projeto</code>',
  recentProjects: 'Projetos recentes',
});
Object.assign(I18N.en = I18N.en || {}, {
  webLoadDesc: 'Enter the project path that contains the <code>aidlc/</code> folder.',
  webCliHint: 'Tip: you can also pass the path when starting the server:<br><code>npm run server -- /path/to/project</code>',
  recentProjects: 'Recent projects',
});
Object.assign(I18N.es = I18N.es || {}, {
  webLoadDesc: 'Ingresa la ruta del proyecto que contiene la carpeta <code>aidlc/</code>.',
  webCliHint: 'Consejo: también puedes pasar la ruta al iniciar el servidor:<br><code>npm run server -- /ruta/del/proyecto</code>',
  recentProjects: 'Proyectos recientes',
});

// ─── Initialization ─────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('app').innerHTML =
    `<div class="load-area"><div class="header-logo">🔬</div><h1>AI-DLC v2 Dashboard</h1><p class="load-desc">${t('loading')}</p></div>`;
  connectWebSocket();
});
