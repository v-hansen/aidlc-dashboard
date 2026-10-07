
// PART 0: i18n - detecção de idioma, helpers e seletor
const LOCALES = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' };
const I18N = {}; // preenchido nos blocos I18N.pt / I18N.en / I18N.es
function detectLang() {
  try {
    const saved = localStorage.getItem('aidlc-dash-lang');
    if (saved && LOCALES[saved]) return saved;
  } catch {}
  const nl = (navigator.language || 'en').toLowerCase();
  if (nl.startsWith('pt')) return 'pt';
  if (nl.startsWith('es')) return 'es';
  return 'en';
}
let lang = detectLang();
// t: busca no idioma atual, fallback para inglês, depois a própria chave
function t(key) {
  return (I18N[lang] && I18N[lang][key]) ?? (I18N.en && I18N.en[key]) ?? key;
}
// tf: t com placeholders {x}
function tf(key, vars) {
  let s = t(key);
  for (const [k, v] of Object.entries(vars || {})) s = s.replaceAll('{' + k + '}', v);
  return s;
}
// esc: escapa HTML em qualquer dado vindo de arquivos (XSS)
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
}
// safeRender: isola erro de uma aba para não derrubar o dashboard inteiro
function safeRender(fn, ...args) {
  try { return fn(...args); }
  catch (e) { return `<div class="empty-state">⚠️ ${t('tabError')}<br><small>${esc(e.message)}</small></div>`; }
}
function phaseLabel(id) {
  const e = PHASE_LABELS[id] || {};
  return e[lang] ?? e.en ?? id;
}
function phaseDetail(id) {
  const e = PHASE_DETAILS[id] || {};
  return e[lang] ?? e.en ?? '';
}
function stageDesc(slug) {
  if (lang === 'pt') return STAGE_INFO[slug]?.desc || '';
  const d = lang === 'es' ? STAGE_DESC_ES[slug] : STAGE_DESC_EN[slug];
  return d ?? STAGE_DESC_EN[slug] ?? STAGE_INFO[slug]?.desc ?? '';
}
function setLang(l) {
  lang = l;
  try { localStorage.setItem('aidlc-dash-lang', l); } catch {}
  if (dashboardData) {
    document.getElementById('app').innerHTML = renderDashboard(dashboardData);
    switchTab(activeTab);
  } else {
    document.getElementById('app').innerHTML = renderLoadScreen();
  }
}
function renderLangSelector() {
  return '<div class="lang-bar">' + [['pt','PT'],['en','EN'],['es','ES']].map(([l,label]) =>
    `<button class="lang-btn ${l===lang?'selected':''}" onclick="setLang('${l}')">${label}</button>`
  ).join('') + '</div>';
}

;

// PART 1: Data structures and constants
// Substituído pelo build.js com a versão do aidlc-dashboard-extension/package.json
const APP_VERSION = '0.2.5';

const PHASES = [
  { id:'initialization', stages:['workspace-scaffold','workspace-detection','state-init'] },
  { id:'ideation', stages:['intent-capture','market-research','feasibility','scope-definition','team-formation','rough-mockups','approval-handoff'] },
  { id:'inception', stages:['reverse-engineering','practices-discovery','requirements-analysis','user-stories','refined-mockups','domain-design','units-generation','contract-design','delivery-planning'] },
  { id:'construction', stages:['functional-design','nfr-requirements','nfr-design','infrastructure-design','code-generation','build-and-test','ci-pipeline'] },
  { id:'operation', stages:['deployment-pipeline','environment-provisioning','deployment-execution','observability-setup','incident-response','performance-validation','feedback-optimization'] }
];
const PHASE_LABELS = {
  initialization: { pt:'Inicialização (Initialization)', en:'Initialization', es:'Inicialización (Initialization)' },
  ideation: { pt:'Ideação (Ideation)', en:'Ideation', es:'Ideación (Ideation)' },
  inception: { pt:'Concepção (Inception)', en:'Inception', es:'Concepción (Inception)' },
  construction: { pt:'Construção (Construction)', en:'Construction', es:'Construcción (Construction)' },
  operation: { pt:'Operação (Operation)', en:'Operation', es:'Operación (Operation)' }
};

;

// PART 2: Stage descriptions (what each stage does)
const STAGE_INFO = {
  'workspace-scaffold': { desc:'Cria a estrutura de pastas do AIDLC no workspace', agent:'orchestrator' },
  'workspace-detection': { desc:'Detecta linguagens, frameworks e build system do projeto', agent:'orchestrator' },
  'state-init': { desc:'Inicializa o arquivo de estado e configura o escopo', agent:'orchestrator' },
  'intent-capture': { desc:'Captura a intenção do usuário e define o objetivo', agent:'aidlc-product-agent' },
  'market-research': { desc:'Pesquisa mercado e soluções similares', agent:'aidlc-product-agent' },
  'feasibility': { desc:'Avalia viabilidade técnica e de negócio', agent:'aidlc-architect-agent' },
  'scope-definition': { desc:'Define escopo, limites e exclusões', agent:'aidlc-product-agent' },
  'team-formation': { desc:'Define composição e papéis do time', agent:'aidlc-delivery-agent' },
  'rough-mockups': { desc:'Cria mockups iniciais de baixa fidelidade', agent:'aidlc-design-agent' },
  'approval-handoff': { desc:'Gate de aprovação para seguir para Concepção', agent:'aidlc-delivery-agent' },
  'reverse-engineering': { desc:'Analisa código existente e documenta arquitetura atual', agent:'aidlc-developer-agent' },
  'practices-discovery': { desc:'Descobre práticas do time e afirma regras de trabalho', agent:'aidlc-pipeline-deploy-agent' },
  'requirements-analysis': { desc:'Analisa requisitos funcionais e não-funcionais', agent:'aidlc-product-agent' },
  'user-stories': { desc:'Cria user stories com critérios de aceitação BDD', agent:'aidlc-product-agent' },
  'refined-mockups': { desc:'Refina mockups com base nos requisitos', agent:'aidlc-design-agent' },
  'domain-design': { desc:'Design de domínio, componentes e ADRs', agent:'aidlc-architect-agent' },
  'units-generation': { desc:'Gera unidades de trabalho (Bolts) para construção', agent:'aidlc-architect-agent' },
  'contract-design': { desc:'Define contratos/interfaces entre unidades', agent:'aidlc-architect-agent' },
  'delivery-planning': { desc:'Planeja sequência de entrega dos Bolts', agent:'aidlc-delivery-agent' },
  'functional-design': { desc:'Design funcional detalhado por unidade', agent:'aidlc-architect-agent' },
  'nfr-requirements': { desc:'Requisitos não-funcionais detalhados', agent:'aidlc-architect-agent' },
  'nfr-design': { desc:'Design para atender requisitos não-funcionais', agent:'aidlc-architect-agent' },
  'infrastructure-design': { desc:'Design de infraestrutura (IaC)', agent:'aidlc-aws-platform-agent' },
  'code-generation': { desc:'Geração de código da unidade', agent:'aidlc-developer-agent' },
  'build-and-test': { desc:'Build, testes e validação', agent:'aidlc-quality-agent' },
  'ci-pipeline': { desc:'Configura pipeline de integração contínua', agent:'aidlc-pipeline-deploy-agent' },
  'deployment-pipeline': { desc:'Configura pipeline de deployment', agent:'aidlc-pipeline-deploy-agent' },
  'environment-provisioning': { desc:'Provisiona ambientes (staging/prod)', agent:'aidlc-aws-platform-agent' },
  'deployment-execution': { desc:'Executa deploy nos ambientes', agent:'aidlc-pipeline-deploy-agent' },
  'observability-setup': { desc:'Configura monitoramento e alertas', agent:'aidlc-operations-agent' },
  'incident-response': { desc:'Define runbooks e plano de incidentes', agent:'aidlc-operations-agent' },
  'performance-validation': { desc:'Valida performance em produção', agent:'aidlc-quality-agent' },
  'feedback-optimization': { desc:'Coleta feedback e otimiza', agent:'aidlc-operations-agent' }
};

;

// PART 3: File reading and parsing utilities
let dashboardData = null;

async function readFileFromHandle(fileHandle) {
  const file = await fileHandle.getFile();
  return await file.text();
}

// Parse tolerante: o engine reescreve os JSONs durante o workflow e uma leitura
// pode pegar o arquivo no meio da escrita — nunca deixe isso derrubar o refresh.
function safeJsonParse(text) {
  try { return JSON.parse(text); } catch { return null; }
}

async function findFile(dirHandle, path) {
  const parts = path.split('/').filter(Boolean);
  let current = dirHandle;
  for (let i = 0; i < parts.length - 1; i++) {
    try { current = await current.getDirectoryHandle(parts[i]); }
    catch { return null; }
  }
  try { return await current.getFileHandle(parts[parts.length - 1]); }
  catch { return null; }
}

async function findDir(dirHandle, path) {
  const parts = path.split('/').filter(Boolean);
  let current = dirHandle;
  for (const part of parts) {
    try { current = await current.getDirectoryHandle(part); }
    catch { return null; }
  }
  return current;
}

async function listFiles(dirHandle) {
  const files = [];
  for await (const entry of dirHandle.values()) {
    files.push({ name: entry.name, kind: entry.kind, handle: entry });
  }
  return files;
}

// --- File browser (aba Arquivos) ---
// Extensões legíveis e ruído a esconder na árvore.
const FILE_BROWSER_EXTS = ['.md', '.json', '.txt', '.yaml', '.yml'];
const FILE_BROWSER_SKIP_DIRS = new Set(['.aidlc-hooks-health', '.aidlc-stop-hook', '.aidlc-sessions', 'node_modules', '.git', 'templates']);
function fbInteresting(name) {
  if (name.startsWith('.') && !name.endsWith('.md')) return false; // .DS_Store, .last, dotfiles
  return FILE_BROWSER_EXTS.some(e => name.toLowerCase().endsWith(e));
}

// Lista recursivamente uma pasta (FS Access API) em nós {name,path,kind,children}.
// path é relativo ao rootHandle. Profundidade limitada; pastas de ruído ignoradas.
async function listTree(dirHandle, basePath, depth) {
  if (depth > 6) return [];
  const out = [];
  for await (const entry of dirHandle.values()) {
    const rel = basePath ? basePath + '/' + entry.name : entry.name;
    if (entry.kind === 'directory') {
      if (FILE_BROWSER_SKIP_DIRS.has(entry.name) || (entry.name.startsWith('.') && entry.name !== '.')) continue;
      const children = await listTree(entry, rel, depth + 1);
      if (children.length) out.push({ name: entry.name, path: rel, kind: 'dir', children });
    } else if (entry.kind === 'file' && fbInteresting(entry.name)) {
      out.push({ name: entry.name, path: rel, kind: 'file' });
    }
  }
  // pastas antes de arquivos, cada grupo alfabético
  out.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1));
  return out;
}

// Constrói a árvore de arquivos do intent atual (+ memory/codekb do space).
// Chamada sob demanda ao abrir a aba (não no refresh de 5s).
async function buildFileTree(rootHandle, activeSpace, intentDirName) {
  const roots = [];
  const intentDir = await findDir(rootHandle, `spaces/${activeSpace}/intents/${intentDirName}`);
  if (intentDir) roots.push({ name: intentDirName, path: `spaces/${activeSpace}/intents/${intentDirName}`, kind: 'dir', children: await listTree(intentDir, `spaces/${activeSpace}/intents/${intentDirName}`, 0) });
  const memDir = await findDir(rootHandle, `spaces/${activeSpace}/memory`);
  if (memDir) roots.push({ name: 'memory', path: `spaces/${activeSpace}/memory`, kind: 'dir', children: await listTree(memDir, `spaces/${activeSpace}/memory`, 0) });
  const kbDir = await findDir(rootHandle, `spaces/${activeSpace}/codekb`);
  if (kbDir) roots.push({ name: 'codekb', path: `spaces/${activeSpace}/codekb`, kind: 'dir', children: await listTree(kbDir, `spaces/${activeSpace}/codekb`, 0) });
  return roots;
}

// Lê um arquivo pelo caminho relativo ao root (só-leitura, on-demand).
async function readAidlcFile(rootHandle, relPath) {
  const f = await findFile(rootHandle, relPath);
  if (!f) return null;
  return await readFileFromHandle(f);
}

// Artefatos de units/bolts, relativos ao diretório do intent (<record>).
// Mantenha em sincronia com aidlc-dashboard-extension/src/extension.ts.
const UNITS_ARTIFACTS = [
  ['unitsDag', 'inception/units-generation/unit-of-work-dependency.md'],
  ['unitsDoc', 'inception/units-generation/unit-of-work.md'],
  ['boltPlan', 'inception/delivery-planning/bolt-plan.md'],
];

async function loadDashboardData(rootHandle) {
  const data = { intents: [], activeSpace: 'default', cloneId: '' };

  // Read active-space
  const asFile = await findFile(rootHandle, 'active-space');
  if (asFile) data.activeSpace = (await readFileFromHandle(asFile)).trim();

  // Read clone-id
  const cidFile = await findFile(rootHandle, '.aidlc-clone-id');
  if (cidFile) data.cloneId = (await readFileFromHandle(cidFile)).trim();

  // Read intents.json
  const intentsFile = await findFile(rootHandle, `spaces/${data.activeSpace}/intents/intents.json`);
  if (!intentsFile) { data.errorKey = 'notAidlc'; return data; }
  const intentsJson = safeJsonParse(await readFileFromHandle(intentsFile));
  if (!intentsJson) {
    // intents.json ilegível neste instante: preserva os dados do refresh anterior
    if (dashboardData && dashboardData.intents && dashboardData.intents.length) return dashboardData;
    data.errorKey = 'notAidlc';
    return data;
  }

  // For each intent, load state and runtime-graph
  // Cada intent é isolado: um arquivo quebrado não derruba os demais nem o refresh
  for (const intent of intentsJson) {
    try {
      const intentDir = await findDir(rootHandle, `spaces/${data.activeSpace}/intents/${intent.dirName}`);
      if (!intentDir) continue;

      const stateFile = await findFile(intentDir, 'aidlc-state.md');
      const graphFile = await findFile(intentDir, 'runtime-graph.json');
      const recoveryFile = await findFile(intentDir, '.aidlc-recovery.md');

      const intentData = { ...intent, state: null, graph: null, recovery: null, audit: [] };

      if (stateFile) intentData.state = await readFileFromHandle(stateFile);
      if (graphFile) intentData.graph = safeJsonParse(await readFileFromHandle(graphFile));
      if (recoveryFile) intentData.recovery = await readFileFromHandle(recoveryFile);

      // Units & Bolts (opcionais — só existem a partir das stages 2.7 / 2.9)
      for (const [key, rel] of UNITS_ARTIFACTS) {
        const f = await findFile(intentDir, rel);
        intentData[key] = f ? await readFileFromHandle(f) : null;
      }

      // Graph ilegível neste ciclo? Reaproveita o do refresh anterior (melhor que zerar)
      if (!intentData.graph && dashboardData) {
        const prev = (dashboardData.intents || []).find(i => i.dirName === intent.dirName);
        if (prev && prev.graph) intentData.graph = prev.graph;
      }

      // Load audit files
      const auditDir = await findDir(intentDir, 'audit');
      if (auditDir) {
        const auditFiles = await listFiles(auditDir);
        for (const af of auditFiles) {
          if (af.kind === 'file' && af.name.endsWith('.md')) {
            try {
              intentData.audit.push({ name: af.name, content: await readFileFromHandle(af.handle) });
            } catch { /* arquivo de audit em escrita — ignora neste ciclo */ }
          }
        }
      }
      data.intents.push(intentData);
    } catch (e) {
      console.warn('intent ilegível neste ciclo:', intent.dirName, e);
    }
  }

  // Load memory (project rules)
  const projectFile = await findFile(rootHandle, `spaces/${data.activeSpace}/memory/project.md`);
  if (projectFile) data.projectMemory = await readFileFromHandle(projectFile);

  // Grid de scopes compilado (opcional): a v2 escreve scopes compostos/custom em
  // scope-grid.json. Se existir no projeto, a aba Workflow o mescla sobre o grid
  // hardcoded — assim scopes compostos aparecem sem re-sincronizar o código.
  // Tenta caminhos comuns por harness (o dashboard aponta pra pasta do projeto).
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
    const f = await findFile(rootHandle, cand);
    if (f) {
      const parsed = safeJsonParse(await readFileFromHandle(f));
      if (parsed && typeof parsed === 'object') { data.scopeGrid = parsed; data.scopeGridSource = cand; break; }
    }
  }
  // Preserva o grid do ciclo anterior se este ciclo não achou (arquivo em escrita)
  if (!data.scopeGrid && dashboardData && dashboardData.scopeGrid) {
    data.scopeGrid = dashboardData.scopeGrid;
    data.scopeGridSource = dashboardData.scopeGridSource;
  }

  return data;
}

;

// PART 4: State parsing helpers
function parseState(stateMarkdown) {
  if (!stateMarkdown) return {};
  const s = {};
  const getVal = (key) => {
    const rx = new RegExp(`\\*\\*${key}\\*\\*:\\s*(.+)`);
    const m = stateMarkdown.match(rx);
    return m ? m[1].trim() : '';
  };
  s.project = getVal('Project');
  s.projectType = getVal('Project Type');
  s.scope = getVal('Scope');
  s.startDate = getVal('Start Date');
  s.activeAgent = getVal('Active Agent');
  s.depth = getVal('Depth');
  s.testStrategy = getVal('Test Strategy');
  s.totalStages = getVal('Total Stages');
  s.completed = getVal('Completed');
  s.inProgress = getVal('In Progress');
  s.currentPhase = getVal('Lifecycle Phase');
  s.currentStage = getVal('Current Stage');
  s.nextStage = getVal('Next Stage');
  s.status = getVal('Status');
  s.lastUpdated = getVal('Last Updated');
  s.lastCompletedStage = getVal('Last Completed Stage');
  s.nextAction = getVal('Next Action');

  // Parse phase progress
  s.phases = {};
  const phaseRx = /- \*\*(\w+)\*\*: (\w+)/g;
  let pm;
  const phaseSection = stateMarkdown.match(/## Phase Progress[\s\S]*?(?=##|$)/);
  if (phaseSection) {
    while ((pm = phaseRx.exec(phaseSection[0]))) {
      s.phases[pm[1].toLowerCase()] = pm[2];
    }
  }

  // Parse stage progress (checkboxes) — aceita —, – ou - como separador
  s.stages = {};
  const stageRx = /- \[(.)\] (\S+) [—–-] (\w+)/g;
  let sm;
  while ((sm = stageRx.exec(stateMarkdown))) {
    const status = sm[1] === 'x' ? 'done' : sm[1] === '-' ? 'active' : sm[1] === '?' ? 'awaiting' : sm[1] === 'R' ? 'revising' : sm[1] === 'S' ? 'skipped' : 'pending';
    const action = sm[3]; // EXECUTE or SKIP
    s.stages[sm[2]] = { status, action };
  }
  return s;
}

function formatDuration(startISO, endISO) {
  if (!startISO || !endISO) return '—';
  const ms = new Date(endISO) - new Date(startISO);
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  if (mins > 60) return `${Math.floor(mins/60)}h ${mins%60}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString(LOCALES[lang] || 'en-US', { hour:'2-digit', minute:'2-digit' });
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(LOCALES[lang] || 'en-US', { day:'2-digit', month:'2-digit', year:'numeric' });
}

;

// PART 5: Render functions
function renderLoadScreen() {
  return `
    <div class="load-area">
      ${renderLangSelector()}
      <div class="header-logo">🔬</div>
      <h1>AI-DLC Dashboard</h1>
      <p class="load-desc">${t('loadDesc')}</p>
      <button class="load-btn" onclick="openFolder()">${t('openBtn')}</button>
      <p style="color:var(--text-muted);font-size:0.75rem;margin-top:8px;">${t('compatNote')}</p>
    </div>
  `;
}

function renderDashboard(data) {
  if (data.errorKey === 'notAidlc') {
    return `
      <div class="load-area">
        ${renderLangSelector()}
        <div class="header-logo">🔎</div>
        <h1>${t('naTitle')}</h1>
        <p class="load-desc">${t('naDesc')}</p>
        <button class="load-btn" onclick="openFolder()">${t('openBtn')}</button>
      </div>`;
  }
  if (data.error) return `<div class="empty-state"><h2>${t('errTitle')}</h2><p>${data.error}</p></div>`;
  if (!data.intents.length) return `<div class="empty-state"><h2>${t('noWf')}</h2><p>${t('noWfDesc')}</p></div>`;

  const intent = currentIntent();
  const state = parseState(intent.state);
  const graph = intent.graph;

  // Seletor de intent (aparece quando há mais de uma execução)
  let intentSelector = '';
  if (data.intents.length > 1) {
    intentSelector = '<div class="intent-bar">';
    for (const it of data.intents) {
      const isSel = it.dirName === intent.dirName;
      const stBadge = it.status === 'in-flight' ? '●' : it.status === 'completed' ? '✓' : '○';
      intentSelector += `<button class="intent-chip ${isSel ? 'selected' : ''}" onclick="selectIntent('${esc(it.dirName)}')">${stBadge} ${esc(it.slug)}<small>${esc(it.dirName.split('-')[0])} · ${esc(it.scope)}</small></button>`;
    }
    intentSelector += '</div>';
  }

  // Progresso ciente do escopo: conta apenas stages com ação EXECUTE no plano
  // (os SKIP do escopo saem do denominador). Fonte: checkboxes do aidlc-state.md,
  // que o engine atualiza em tempo real — o runtime-graph fica como fallback.
  const stageEntries = Object.values(state.stages || {});
  const planned = stageEntries.filter(s => s.action === 'EXECUTE');
  let completedStages, totalStages;
  if (planned.length) {
    completedStages = planned.filter(s => s.status === 'done').length;
    totalStages = planned.length;
  } else {
    completedStages = graph ? graph.stages.filter(s => s.outcome === 'approved').length : 0;
    totalStages = parseInt(state.totalStages) || 25;
  }
  const progress = totalStages ? Math.round((completedStages / totalStages) * 100) : 0;

  return `
    <div class="header">
      <span class="header-logo">🔬</span>
      <div>
        <h1>AI-DLC Dashboard</h1>
        <span class="header-subtitle">${esc(intent.slug || 'Workflow')} · ${esc(state.scope || '')} · ${t('clone')}: ${esc(data.cloneId || '—')}</span>
      </div>
      <div style="margin-left:auto;display:flex;align-items:center;gap:10px;">
        ${renderLangSelector()}
        ${renderStatusBadge(state.status || intent.status)}
      </div>
    </div>

    ${intentSelector}

    <div class="stat-grid" style="margin-bottom:16px;">
      <div class="stat-box">
        <div class="stat-value">${completedStages}/${totalStages}</div>
        <div class="stat-label">${t('stStagesDone')}</div>
      </div>
      <div class="stat-box">
        <div class="stat-value" style="color:var(--yellow)">${esc(state.currentStage || '—')}</div>
        <div class="stat-label">${t('stCurrentStage')}</div>
      </div>
      <div class="stat-box">
        <div class="stat-value" style="color:var(--purple);font-size:1rem;">${state.activeAgent ? esc(state.activeAgent.replace('aidlc-','').replace('-agent','')) : '—'}</div>
        <div class="stat-label">${t('stActiveAgent')}</div>
      </div>
      <div class="stat-box">
        <div class="stat-value" style="color:var(--green)">${esc(state.depth || '—')}</div>
        <div class="stat-label">${t('stDepth')}</div>
      </div>
      <div class="stat-box">
        <div class="stat-value" style="color:var(--blue);font-size:1rem;">${esc(state.testStrategy || '—')}</div>
        <div class="stat-label">${t('kTestStrategy')}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>${t('overallProgress')}</h2>
        <span style="font-size:0.85rem;color:var(--accent)">${progress}%</span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width:${progress}%"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:var(--text-muted)">
        <span>${t('lblStart')}: ${formatDate(state.startDate)}</span>
        <span>${t('lblUpdated')}: ${formatTime(state.lastUpdated)}</span>
      </div>
    </div>

    <div class="refresh-bar">
      <span id="refresh-indicator" class="refresh-indicator">${t('updatedAt')} ${new Date().toLocaleTimeString(LOCALES[lang] || 'en-US')}</span>
      <button id="auto-refresh-btn" class="refresh-btn ${autoRefreshEnabled ? '' : 'paused'}" onclick="toggleAutoRefresh()">${autoRefreshEnabled ? t('btnPause') : t('btnResume')}</button>
      <button class="refresh-btn" onclick="refreshData()">${t('btnRefresh')}</button>
    </div>

    <div class="tab-bar" role="tablist">
      <button class="tab-btn active" data-tab="workflow" role="tab" aria-selected="true" onclick="switchTab('workflow')">${t('tabWorkflow')}</button>
      <button class="tab-btn" data-tab="phases" role="tab" aria-selected="false" onclick="switchTab('phases')">${t('tabPhases')}</button>
      <button class="tab-btn" data-tab="stages" role="tab" aria-selected="false" onclick="switchTab('stages')">${t('tabStages')}</button>
      <button class="tab-btn" data-tab="files" role="tab" aria-selected="false" onclick="switchTab('files')">${t('tabFiles')}</button>
      <button class="tab-btn" data-tab="sensors" role="tab" aria-selected="false" onclick="switchTab('sensors')" hidden>${t('tabSensors')}</button>
      <button class="tab-btn" data-tab="knowledge" role="tab" aria-selected="false" onclick="switchTab('knowledge')">${t('tabKnowledge')}</button>
      <button class="tab-btn" data-tab="audit" role="tab" aria-selected="false" onclick="switchTab('audit')">${t('tabAudit')}</button>
      <button class="tab-btn" data-tab="tokens" role="tab" aria-selected="false" onclick="switchTab('tokens')">${t('tabTokens')}</button>
      <button class="tab-btn" data-tab="help" role="tab" aria-selected="false" onclick="switchTab('help')">${t('tabHelp')}</button>
    </div>

    <div id="tab-workflow" class="tab-content active" role="tabpanel">${safeRender(renderWorkflowTab, state)}</div>
    <div id="tab-phases" class="tab-content" role="tabpanel">${safeRender(renderPhasesTab, state, graph)}</div>
    <div id="tab-stages" class="tab-content" role="tabpanel">${safeRender(renderStagesTab, state, graph)}</div>
    <div id="tab-files" class="tab-content" role="tabpanel">${safeRender(renderFilesTab)}</div>
    <div id="tab-sensors" class="tab-content" role="tabpanel">${safeRender(renderSensorsTab, graph)}</div>
    <div id="tab-knowledge" class="tab-content" role="tabpanel">${safeRender(renderKnowledgeTab, data, state)}</div>
    <div id="tab-audit" class="tab-content" role="tabpanel">${safeRender(renderAuditTab, intent)}</div>
    <div id="tab-tokens" class="tab-content" role="tabpanel">${safeRender(renderTokensTab)}</div>
    <div id="tab-help" class="tab-content" role="tabpanel">${safeRender(renderHelpTab)}</div>

    <footer class="app-footer">AIDLC Dashboard v${APP_VERSION}</footer>
  `;
}

function renderStatusBadge(status) {
  const map = {
    'in-flight': [t('badgeRunning'),'badge-yellow'],
    'Running': [t('badgeRunning'),'badge-yellow'],
    'completed': [t('badgeCompleted'),'badge-green'],
    'paused': [t('badgePaused'),'badge-blue'],
    'failed': [t('badgeFailed'),'badge-red']
  };
  const [label, cls] = map[status] || [t('badgeUnknown'),'badge-purple'];
  return `<span class="badge ${cls}">● ${label}</span>`;
}

;

// PART 6: Tab renderers - Phases & Stages
function renderPhasesTab(state, graph) {
  let html = '<ul class="phase-list">';
  for (const phase of PHASES) {
    const phaseStatus = state.phases?.[phase.id] || 'Pending';
    let iconClass = 'pending', icon = '○';
    if (phaseStatus === 'Verified') { iconClass = 'done'; icon = '✓'; }
    else if (phaseStatus === 'Active') { iconClass = 'active'; icon = '▶'; }
    else if (phaseStatus === 'Skipped') { iconClass = 'skipped'; icon = '⊘'; }

    const statusLabel = { Verified:t('phDone'), Active:t('phActive'), Pending:t('phPending'), Skipped:t('phSkipped') }[phaseStatus] || phaseStatus;
    const stageCount = phase.stages.length;
    const doneCount = phase.stages.filter(s => state.stages?.[s]?.status === 'done').length;

    html += `
      <li class="phase-item" onclick="showPhaseInfo(null,'${phase.id}')">
        <div class="phase-icon ${iconClass}">${icon}</div>
        <div class="phase-name">${phaseLabel(phase.id)}<br><small style="color:var(--text-muted)">${doneCount}/${stageCount} stages</small></div>
        <div class="phase-status">${statusLabel}</div>
        <button class="info-btn" onclick="showPhaseInfo(event,'${phase.id}')" title="${t('phaseDetailsBtn')}">?</button>
      </li>`;
  }
  html += '</ul>';
  return html;
}

function renderStagesTab(state, graph) {
  let html = '';
  for (const phase of PHASES) {
    html += `<h3>${phaseLabel(phase.id)}</h3><ul class="stage-list">`;
    for (const slug of phase.stages) {
      const stageState = state.stages?.[slug];
      const status = stageState?.status || 'pending';
      const action = stageState?.action || 'EXECUTE';
      const info = STAGE_INFO[slug] || {};

      // Find in graph for timing
      const graphEntry = graph?.stages?.find(s => s.stage_slug === slug);
      const duration = graphEntry ? formatDuration(graphEntry.started_at, graphEntry.completed_at) : '';
      const agent = graphEntry?.agent || info.agent || '';

      let statusClass = status;
      if (action === 'SKIP' && status === 'pending') statusClass = 'skipped';

      html += `
        <li class="stage-item ${statusClass}" onclick="showStageInfo(null,'${slug}')" style="cursor:pointer">
          <span class="stage-dot ${statusClass}"></span>
          <span class="stage-slug">
            <strong>${slug}</strong><br>
            <small style="color:var(--text-muted)">${stageDesc(slug)}</small>
          </span>
          <span class="stage-agent">${esc(agent.replace('aidlc-','').replace('-agent',''))}</span>
          <span class="stage-time">${duration}</span>
          <button class="info-btn" onclick="showStageInfo(event,'${slug}')" title="${t('stageDetailsBtn')}" aria-label="${t('stageDetailsBtn')}: ${slug}">?</button>
        </li>`;
    }
    html += '</ul>';
  }
  return html;
}

;

// PART 7: Tab renderers - Sensors & Knowledge
function renderSensorsTab(graph) {
  if (!graph || !graph.stages) return `<div class="empty-state">${t('sNone')}</div>`;
  let html = '';
  for (const stage of graph.stages) {
    if (!stage.sensor_firings || stage.sensor_firings.length === 0) continue;
    const passed = stage.sensor_firings.filter(s => s.result === 'passed').length;
    const failed = stage.sensor_firings.filter(s => s.result === 'failed').length;
    html += `<div class="card"><div class="card-header"><h3 style="margin:0">${esc(WF_STAGE_LABEL[stage.stage_slug] || stage.stage_slug)}</h3><span class="badge badge-green">${passed}✓</span>&nbsp;<span class="badge badge-red">${failed}✗</span></div>`;
    for (const sensor of stage.sensor_firings) {
      html += `
        <div class="sensor-row ${sensor.result === 'passed' ? 'passed' : 'failed'}">
          <span class="sensor-dot ${sensor.result === 'passed' ? 'passed' : 'failed'}"></span>
          <span>${esc(sensor.id)}</span>
          <span style="margin-left:auto;font-size:0.7rem;color:var(--text-muted)">${formatTime(sensor.ts)}</span>
        </div>`;
    }
    html += '</div>';
  }
  return html || `<div class="empty-state">${t('sNoneFired')}</div>`;
}

function renderKnowledgeTab(data, state) {
  let html = `<div class="card"><h2>${t('kProject')}</h2>`;
  html += `<div class="knowledge-item"><strong>${t('kType')}:</strong> ${esc(state.projectType || '—')}</div>`;
  html += `<div class="knowledge-item"><strong>${t('kScope')}:</strong> ${esc(state.scope || '—')}</div>`;
  html += `<div class="knowledge-item"><strong>${t('stDepth')}:</strong> ${esc(state.depth || '—')}</div>`;
  html += `<div class="knowledge-item"><strong>${t('kTestStrategy')}:</strong> ${esc(state.testStrategy || '—')}</div>`;
  html += '</div>';

  // Parse project memory for learnings
  if (data.projectMemory) {
    html += `<div class="card"><h2>${t('kDecRules')}</h2>`;
    // Extract DECIDED items
    const decided = data.projectMemory.match(/- .+\(learned .+?\)/g) || [];
    const forbidden = data.projectMemory.match(/- NEVER .+/g) || [];
    const mandated = data.projectMemory.match(/- ALWAYS .+/g) || [];

    if (decided.length) {
      html += `<h3 style="margin-top:12px">${t('kDecisions')}</h3>`;
      for (const d of decided.slice(0, 8)) {
        html += `<div class="knowledge-item">${esc(d.replace(/^- /,'').replace(/<!-- .+? -->/g,''))}</div>`;
      }
    }
    if (forbidden.length) {
      html += `<h3 style="margin-top:12px;color:var(--red)">${t('kForbidden')}</h3>`;
      for (const f of forbidden.slice(0, 5)) {
        const text = f.replace(/^- NEVER /,'').split(' (affirmed')[0].split(' (learned')[0];
        html += `<div class="knowledge-item" style="border-left:3px solid var(--red);padding-left:10px"><strong>${t('kNever')}:</strong> ${esc(text)}</div>`;
      }
    }
    if (mandated.length) {
      html += `<h3 style="margin-top:12px;color:var(--green)">${t('kMandated')}</h3>`;
      for (const m of mandated.slice(0, 5)) {
        const text = m.replace(/^- ALWAYS /,'').split(' (affirmed')[0].split(' (learned')[0];
        html += `<div class="knowledge-item" style="border-left:3px solid var(--green);padding-left:10px"><strong>${t('kAlways')}:</strong> ${esc(text)}</div>`;
      }
    }
    html += '</div>';
  }

  // Learnings from runtime graph
  const intent = currentIntent();
  if (intent?.graph?.stages) {
    const withLearnings = intent.graph.stages.filter(s => s.learnings_captured && (s.learnings_captured.from_orchestrator > 0 || s.learnings_captured.from_user_addition > 0));
    if (withLearnings.length) {
      html += `<div class="card"><h2>${t('kLearnCaptured')}</h2>`;
      for (const s of withLearnings) {
        const total = s.learnings_captured.from_orchestrator + s.learnings_captured.from_user_addition;
        html += `<div class="knowledge-item"><strong>${esc(WF_STAGE_LABEL[s.stage_slug] || s.stage_slug)}:</strong> ${tf('kLearnLine',{total, o:s.learnings_captured.from_orchestrator, u:s.learnings_captured.from_user_addition})}</div>`;
      }
      html += '</div>';
    }
  }

  return html;
}

;

// PART 8: Tab renderers - Audit & Help
function renderAuditTab(intent) {
  if (!intent.audit || !intent.audit.length) return `<div class="empty-state">${t('aNone')}</div>`;

  // Parse audit events: captura TODOS os pares "**Campo**: valor" de cada seção,
  // não só o Event/Timestamp — é onde vivem as decisões, rationale e mensagens.
  const events = [];
  for (const auditFile of intent.audit) {
    const sections = auditFile.content.split('---').filter(s => s.trim());
    for (const section of sections) {
      const fields = {};
      const fieldRx = /\*\*([\w ]+)\*\*:\s*(.+)/g;
      let fm;
      while ((fm = fieldRx.exec(section))) fields[fm[1].trim().toLowerCase()] = fm[2].trim();
      if (fields.timestamp && fields.event) {
        events.push({ ts: fields.timestamp, event: fields.event, fields });
      }
    }
  }
  if (!events.length) return `<div class="empty-state">${t('aNone')}</div>`;
  events.sort((a, b) => (a.ts || '').localeCompare(b.ts || ''));

  // Card de destaque: só as decisões (o que o usuário quer ler primeiro)
  const decisions = events.filter(e => e.event === 'DECISION_RECORDED' && e.fields.decision);
  let html = '';
  if (decisions.length) {
    html += `<div class="card"><h2>📝 ${t('aDecisions')}</h2>`;
    for (const d of decisions) {
      const stage = d.fields.stage ? WF_STAGE_LABEL[d.fields.stage] || d.fields.stage : '';
      html += `
        <div class="audit-decision">
          <div class="audit-decision-head">
            ${stage ? `<span class="badge badge-purple">${esc(stage)}</span>` : ''}
            <span class="audit-decision-ts">${formatTime(d.ts)} · ${formatDate(d.ts)}</span>
          </div>
          <div class="audit-decision-body">${esc(d.fields.decision)}</div>
        </div>`;
    }
    html += '</div>';
  }

  // Timeline completa com o detalhe relevante por tipo de evento
  html += `<div class="card"><h2>${t('aTitle')}</h2><div class="timeline">`;
  const detailFor = (f) => f.decision || f.message || f.details || f.rule || f.request
    || (f.stage ? (WF_STAGE_LABEL[f.stage] || f.stage) : '') || '';
  const recent = events.slice(-40);
  for (const ev of recent) {
    const key = 'ev' + ev.event;
    const label = (I18N[lang]?.[key] ?? I18N.en?.[key]) || `📋 ${esc(ev.event)}`;
    const detail = detailFor(ev.fields);
    html += `
      <div class="timeline-event">
        <div><strong>${label}</strong></div>
        ${detail ? `<div class="timeline-detail">${esc(detail)}</div>` : ''}
        <div class="timeline-ts">${formatTime(ev.ts)} — ${formatDate(ev.ts)}</div>
      </div>`;
  }
  html += '</div></div>';
  return html;
}

function renderHelpTab() {
  const cards = [1,2,3,4,5,6,7,8].map(i =>
    `<div class="help-card"><h4>${t('hC'+i+'t')}</h4><p>${t('hC'+i)}</p></div>`
  ).join('');
  return `
    <div class="card"><h2>${t('hTitle')}</h2>
      <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:12px">${t('hIntro')}</p>
    </div>

    <div class="help-grid">${cards}</div>

    <div class="card" style="margin-top:12px">
      <h2>${t('hScopes')}</h2>
      <p style="color:var(--text-muted);font-size:0.8rem;margin:4px 0 8px">${t('hScopesNote')}</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin-top:8px">
        ${(() => {
          const grid = typeof buildScopeGrid === 'function' ? buildScopeGrid() : SCOPE_GRID;
          return Object.keys(grid)
            .sort((a, b) => scopeExecCount(a, grid) - scopeExecCount(b, grid))
            .map(s => {
              const n = scopeExecCount(s, grid);
              const g = scopeGateCount(s, grid);
              return `<div class="knowledge-item" style="text-align:center" title="${esc((SCOPE_META[s]||{}).desc || '')}"><strong>${esc(s)}</strong><br><small style="color:var(--text-muted)">${n} ${t('wfStagesRun')} · ${g} ${t('wfGates')}</small></div>`;
            }).join('');
        })()}
      </div>
    </div>

    <div class="card" style="margin-top:12px">
      <h2>${t('hCommands')}</h2>
      <div class="knowledge-item"><code>/aidlc --doctor</code> — ${t('hCmd1')}</div>
      <div class="knowledge-item"><code>/aidlc &lt;desc&gt;</code> — ${t('hCmd2')}</div>
      <div class="knowledge-item"><code>/aidlc --status</code> — ${t('hCmd3')}</div>
      <div class="knowledge-item"><code>/aidlc --stage &lt;slug&gt;</code> — ${t('hCmd4')}</div>
      <div class="knowledge-item"><code>/aidlc compose</code> — ${t('hCmd5')}</div>
    </div>

    <p class="app-footer">AIDLC Dashboard v${APP_VERSION}</p>
  `;
}

;

// PART 8.4: Tokens - lê transcripts do harness (~/.claude/projects/<projeto>/*.jsonl)
let tokenData = null;
let tokenDirHandle = null;

async function openTokensFolder() {
  try {
    tokenDirHandle = await window.showDirectoryPicker({ mode: 'read' });
    await loadTokenData();
    lastTokenRefresh = new Date();
    const el = document.getElementById('tab-tokens');
    if (el) el.innerHTML = renderTokensTab();
    if (typeof startTokenRefresh === 'function') startTokenRefresh();
  } catch (err) {
    if (err.name !== 'AbortError') alert(t('errRead') + err.message);
  }
}

// Coleta *.jsonl recursivamente (Claude: plano; Kiro: <hash>/sess_<id>/messages.jsonl)
async function collectJsonlFiles(dirHandle, depth, out) {
  if (depth > 3) return;
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && entry.name.endsWith('.jsonl')) {
      out.push({ handle: entry, parentDir: dirHandle });
    } else if (entry.kind === 'directory') {
      await collectJsonlFiles(entry, depth + 1, out);
    }
  }
}

async function loadTokenData() {
  if (!tokenDirHandle) return;
  const agg = { input:0, output:0, cacheRead:0, cacheWrite:0, messages:0, sessions:[], byModel:{}, kiroSessions:[], events:[], kiroEvents:[], kiroCredits:0 };
  const files = [];
  await collectJsonlFiles(tokenDirHandle, 0, files);
  for (const { handle: entry, parentDir } of files) {
    const file = await entry.getFile();
    const text = await file.text();
    // Detecção de formato Kiro: session_metadata/contextUsage ou resumos de turno com créditos
    if (text.includes('"contextUsage"') || text.includes('session_metadata') || text.includes('"promptTurnSummaries"')) {
      const kiroSess = { title: entry.name, modelId: '', lastModifiedAt: null, lines: 0, contextPct: 0, credits: 0, turns: 0 };
      try {
        const sjHandle = await parentDir.getFileHandle('session.json');
        const sj = JSON.parse(await (await sjHandle.getFile()).text());
        kiroSess.title = sj.title || kiroSess.title;
        kiroSess.modelId = sj.modelId || '';
        kiroSess.lastModifiedAt = sj.lastModifiedAt || null;
      } catch {}
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        kiroSess.lines++;
        const m = line.match(/"usagePercentage":\s*([\d.]+)/);
        if (m) kiroSess.contextPct = Math.max(kiroSess.contextPct, parseFloat(m[1]));
        // Créditos por turno: payload.promptTurnSummaries[].usage
        if (line.includes('"promptTurnSummaries"')) {
          try {
            const d = JSON.parse(line);
            const arr = (d.payload && d.payload.promptTurnSummaries) || [];
            const credits = arr.reduce((a, x) => a + (x.usage || 0), 0);
            if (credits > 0) {
              kiroSess.credits += credits;
              kiroSess.turns++;
              agg.kiroCredits += credits;
              agg.kiroEvents.push({ ts: d.timestamp || null, credits });
            }
          } catch {}
        }
      }
      agg.kiroSessions.push(kiroSess);
      continue;
    }
    const sess = { name: entry.name.replace('.jsonl',''), input:0, output:0, cacheRead:0, cacheWrite:0, messages:0, firstTs:null, lastTs:null };
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let d; try { d = JSON.parse(line); } catch { continue; }
      const usage = d.message?.usage;
      if (!usage) continue;
      const model = d.message?.model || 'desconhecido';
      sess.messages++; agg.messages++;
      sess.input += usage.input_tokens||0; agg.input += usage.input_tokens||0;
      sess.output += usage.output_tokens||0; agg.output += usage.output_tokens||0;
      sess.cacheRead += usage.cache_read_input_tokens||0; agg.cacheRead += usage.cache_read_input_tokens||0;
      sess.cacheWrite += usage.cache_creation_input_tokens||0; agg.cacheWrite += usage.cache_creation_input_tokens||0;
      if (!agg.byModel[model]) agg.byModel[model] = { input:0, output:0, messages:0 };
      agg.byModel[model].input += usage.input_tokens||0;
      agg.byModel[model].output += usage.output_tokens||0;
      agg.byModel[model].messages++;
      agg.events.push({ ts: d.timestamp || null, model,
        i: usage.input_tokens||0, o: usage.output_tokens||0,
        cr: usage.cache_read_input_tokens||0, cw: usage.cache_creation_input_tokens||0 });
      if (d.timestamp) {
        if (!sess.firstTs || d.timestamp < sess.firstTs) sess.firstTs = d.timestamp;
        if (!sess.lastTs || d.timestamp > sess.lastTs) sess.lastTs = d.timestamp;
      }
    }
    if (sess.messages > 0) agg.sessions.push(sess);
  }
  agg.sessions.sort((a,b) => (b.lastTs||'').localeCompare(a.lastTs||''));
  agg.kiroSessions.sort((a,b) => (b.lastModifiedAt||0) - (a.lastModifiedAt||0));
  tokenData = agg;
}

function fmtTokens(n) {
  if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n/1000).toFixed(1) + 'k';
  return String(n);
}

// Preços de referência em USD por 1M de tokens [regex do modelo, input, output].
// Cache read = 0.1x input; cache write = 1.25x input. Ajuste conforme contrato/região.
const PRICING = [
  [/opus/i, 15, 75],
  [/sonnet/i, 3, 15],
  [/haiku/i, 0.8, 4],
];
const PRICING_DEFAULT = [3, 15];

function priceFor(model) {
  for (const [rx, i, o] of PRICING) if (rx.test(model || '')) return [i, o];
  return PRICING_DEFAULT;
}

function eventCost(ev) {
  const [pi, po] = priceFor(ev.model);
  return (ev.i * pi + ev.o * po + ev.cr * pi * 0.1 + ev.cw * pi * 1.25) / 1e6;
}

// Atribui cada mensagem ao stage cujo intervalo [started_at, completed_at] contém o timestamp
function computeStageCosts(graph, events) {
  if (!graph || !graph.stages || !graph.stages.length || !events || !events.length) return null;
  const rows = new Map();
  const add = (key, ev) => {
    const r = rows.get(key) || { input: 0, output: 0, cost: 0, messages: 0 };
    r.input += ev.i; r.output += ev.o; r.cost += eventCost(ev); r.messages++;
    rows.set(key, r);
  };
  for (const ev of events) {
    const stage = ev.ts
      ? graph.stages.find(s => s.started_at && ev.ts >= s.started_at && ev.ts <= (s.completed_at || '9999'))
      : null;
    add(stage ? stage.stage_slug : '__outside', ev);
  }
  let total = 0;
  for (const r of rows.values()) total += r.cost;
  // Ordena na sequência do graph; __outside por último
  const ordered = [];
  for (const s of graph.stages) if (rows.has(s.stage_slug)) ordered.push([s.stage_slug, rows.get(s.stage_slug)]);
  if (rows.has('__outside')) ordered.push(['__outside', rows.get('__outside')]);
  return { rows: ordered, total };
}

function fmtMoney(v) {
  return '$' + (v >= 100 ? v.toFixed(0) : v.toFixed(2));
}

// Créditos do Kiro por stage: mesma atribuição por timestamp dos turnos
function computeStageCredits(graph, kiroEvents) {
  if (!graph || !graph.stages || !graph.stages.length || !kiroEvents || !kiroEvents.length) return null;
  const rows = new Map();
  for (const ev of kiroEvents) {
    const stage = ev.ts
      ? graph.stages.find(s => s.started_at && ev.ts >= s.started_at && ev.ts <= (s.completed_at || '9999'))
      : null;
    const key = stage ? stage.stage_slug : '__outside';
    const r = rows.get(key) || { credits: 0, turns: 0 };
    r.credits += ev.credits; r.turns++;
    rows.set(key, r);
  }
  let total = 0;
  for (const r of rows.values()) total += r.credits;
  const ordered = [];
  for (const s of graph.stages) if (rows.has(s.stage_slug)) ordered.push([s.stage_slug, rows.get(s.stage_slug)]);
  if (rows.has('__outside')) ordered.push(['__outside', rows.get('__outside')]);
  return { rows: ordered, total };
}

;

// PART 8.45: Render da aba Tokens
function renderTokensTab() {
  if (!tokenData) {
    return `
      <div class="card" style="text-align:center;padding:32px">
        <h2>${t('tkTitle')}</h2>
        <p style="color:var(--text-muted);font-size:0.85rem;max-width:460px;margin:8px auto 16px">
          ${t('tkDesc')}
        </p>
        <button class="load-btn" onclick="openTokensFolder()">${t('tkOpenBtn')}</button>
        <div style="text-align:left;max-width:520px;margin:16px auto 0">
          <div class="help-card" style="margin-bottom:8px">
            <h4>${t('tkClaudeHintTitle')}</h4>
            <p>macOS/Linux: <code>~/.claude/projects/&lt;project&gt;/</code><br>
            Windows: <code>C:\Users\&lt;user&gt;\.claude\projects\&lt;project&gt;\</code><br>
            WSL: <code>\\wsl$\&lt;distro&gt;\home\&lt;user&gt;\.claude\projects\</code></p>
          </div>
          <div class="help-card">
            <h4>${t('tkKiroHintTitle')}</h4>
            <p>macOS/Linux: <code>~/.kiro/sessions/</code><br>
            Windows: <code>C:\Users\&lt;user&gt;\.kiro\sessions\</code><br>
            ${t('tkKiroHintNote')}</p>
          </div>
          <p style="color:var(--text-muted);font-size:0.7rem;margin-top:8px">
            ${t('tkMacHint')}
          </p>
        </div>
      </div>`;
  }
  const tk = tokenData;
  let html = '';
  const hasClaude = tk.messages > 0;
  const hasKiro = tk.kiroSessions.length > 0;
  if (!hasClaude && !hasKiro) {
    html += `<div class="empty-state">${t('tkNoneFound')}</div>
      <div style="text-align:center"><button class="refresh-btn" onclick="openTokensFolder()">${t('tkChangeFolder')}</button></div>`;
    return html;
  }
  if (hasClaude) {
    html += `
    <div class="card"><h2>${t('tkClaudeCard')}</h2>
    <div class="stat-grid" style="margin-bottom:12px">
      <div class="stat-box"><div class="stat-value">${fmtTokens(tk.input)}</div><div class="stat-label">Input</div></div>
      <div class="stat-box"><div class="stat-value" style="color:var(--green)">${fmtTokens(tk.output)}</div><div class="stat-label">Output</div></div>
      <div class="stat-box"><div class="stat-value" style="color:var(--blue)">${fmtTokens(tk.cacheRead)}</div><div class="stat-label">Cache Read</div></div>
      <div class="stat-box"><div class="stat-value" style="color:var(--yellow)">${fmtTokens(tk.cacheWrite)}</div><div class="stat-label">Cache Write</div></div>
    </div>
    <h3>${t('tkByModel')}</h3>`;
    for (const [model, m] of Object.entries(tk.byModel)) {
      html += `<div class="knowledge-item"><strong>${esc(model)}</strong><br>
        <small>${m.messages} ${t('tkMsgs')} · ${fmtTokens(m.input)} in · ${fmtTokens(m.output)} out</small></div>`;
    }
    html += `<h3 style="margin-top:12px">${t('tkBySession')} (${tk.sessions.length})</h3>`;
    for (const s of tk.sessions.slice(0, 20)) {
      html += `<div class="knowledge-item">
        <strong>${esc(s.name.substring(0,8))}…</strong> — ${s.lastTs ? formatDate(s.lastTs) + ' ' + formatTime(s.lastTs) : ''}<br>
        <small>${s.messages} msgs · ${fmtTokens(s.input)} in · ${fmtTokens(s.output)} out · ${fmtTokens(s.cacheRead)} cache read</small></div>`;
    }
    html += '</div>';

    // Custo estimado por stage (cruza timestamps dos transcripts com o runtime-graph)
    const graphForCost = (typeof currentIntent === 'function' && currentIntent()) ? currentIntent().graph : null;
    const costs = computeStageCosts(graphForCost, tk.events);
    if (costs) {
      html += `<div class="card"><h2>${t('tkCostCard')}</h2>
        <p style="color:var(--text-muted);font-size:0.78rem;margin-bottom:10px">${t('tkCostNote')}</p>
        <table class="cost-table"><thead><tr>
          <th>${t('tkStage')}</th><th>msgs</th><th>in</th><th>out</th><th style="text-align:right">USD</th>
        </tr></thead><tbody>`;
      for (const [slug, r] of costs.rows) {
        const name = slug === '__outside' ? `<em>${t('tkOutside')}</em>` : esc(slug);
        html += `<tr><td>${name}</td><td>${r.messages}</td><td>${fmtTokens(r.input)}</td><td>${fmtTokens(r.output)}</td><td style="text-align:right">${fmtMoney(r.cost)}</td></tr>`;
      }
      html += `</tbody><tfoot><tr><td colspan="4"><strong>${t('tkTotal')}</strong></td><td style="text-align:right"><strong>${fmtMoney(costs.total)}</strong></td></tr></tfoot></table></div>`;
    }
  }
  if (hasKiro) {
    html += `
    <div class="card"><h2>${t('tkKiroCard')}</h2>
    <p style="color:var(--text-muted);font-size:0.78rem;margin-bottom:10px">
      ${t('tkKiroNote')}
    </p>`;
    if (tk.kiroCredits > 0) {
      html += `<div class="stat-grid" style="margin-bottom:12px">
        <div class="stat-box"><div class="stat-value" style="color:var(--purple)">${tk.kiroCredits.toFixed(1)}</div><div class="stat-label">${t('tkCreditsTotal')}</div></div>
        <div class="stat-box"><div class="stat-value">${tk.kiroEvents.length}</div><div class="stat-label">${t('tkTurns')}</div></div>
      </div>`;
    }
    for (const s of tk.kiroSessions.slice(0, 25)) {
      const pct = Math.round(s.contextPct);
      const barColor = pct > 75 ? 'var(--red)' : pct > 50 ? 'var(--yellow)' : 'var(--green)';
      html += `<div class="knowledge-item">
        <strong>${esc(s.title)}</strong>${s.modelId ? ` <small style="color:var(--purple)">${esc(s.modelId)}</small>` : ''}
        ${s.lastModifiedAt ? `<small> — ${formatDate(new Date(s.lastModifiedAt).toISOString())}</small>` : ''}<br>
        <small>${s.lines} ${t('tkRecords')} · ${t('tkContext')}: ${pct}%${s.credits > 0 ? ` · <strong>${s.credits.toFixed(1)} ${t('tkCredits')}</strong>` : ''}</small>
        <div class="progress-bar-container" style="margin:6px 0 0">
          <div class="progress-bar" style="width:${Math.min(pct,100)}%;background:${barColor}"></div>
        </div></div>`;
    }
    html += '</div>';

    // Créditos por stage (Kiro): mesma atribuição por timestamp usada no custo Claude
    const graphForCredits = (typeof currentIntent === 'function' && currentIntent()) ? currentIntent().graph : null;
    const stageCredits = computeStageCredits(graphForCredits, tk.kiroEvents);
    if (stageCredits) {
      html += `<div class="card"><h2>${t('tkKiroCreditCard')}</h2>
        <p style="color:var(--text-muted);font-size:0.78rem;margin-bottom:10px">${t('tkKiroCreditNote')}</p>
        <table class="cost-table"><thead><tr>
          <th>${t('tkStage')}</th><th>${t('tkTurns')}</th><th style="text-align:right">${t('tkCredits')}</th>
        </tr></thead><tbody>`;
      for (const [slug, r] of stageCredits.rows) {
        const name = slug === '__outside' ? `<em>${t('tkOutside')}</em>` : esc(slug);
        html += `<tr><td>${name}</td><td>${r.turns}</td><td style="text-align:right">${r.credits.toFixed(1)}</td></tr>`;
      }
      html += `</tbody><tfoot><tr><td colspan="2"><strong>${t('tkTotal')}</strong></td><td style="text-align:right"><strong>${stageCredits.total.toFixed(1)}</strong></td></tr></tfoot></table></div>`;
    }
  }
  html += `
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <button class="refresh-btn" onclick="loadTokenData().then(()=>{document.getElementById('tab-tokens').innerHTML=renderTokensTab();switchTab('tokens')})">${t('tkRefresh')}</button>
      <button id="token-auto-btn" class="refresh-btn ${typeof tokenAutoRefresh !== 'undefined' && tokenAutoRefresh ? '' : 'paused'}" onclick="toggleTokenAutoRefresh()">${typeof tokenAutoRefresh !== 'undefined' && tokenAutoRefresh ? t('tkAutoOn') : t('tkAutoOff')}</button>
      <button class="refresh-btn" onclick="openTokensFolder()">${t('tkChangeFolder')}</button>
      <span class="refresh-indicator" style="margin-left:auto">${typeof lastTokenRefresh !== 'undefined' && lastTokenRefresh ? t('updatedAt') + ' ' + lastTokenRefresh.toLocaleTimeString(LOCALES[lang] || 'en-US') : ''}</span>
    </div>`;
  return html;
}

;

// PART 8.5: Modals - detalhes de fases e stages
const PHASE_DETAILS = {
  initialization: {
    pt: 'Prepara o terreno: cria a estrutura de pastas do AIDLC no workspace, detecta linguagens/frameworks/build system do projeto e inicializa o arquivo de estado com o escopo escolhido. Roda automaticamente em segundos, sem gates de aprovação.',
    en: 'Lays the groundwork: creates the AIDLC folder structure in the workspace, detects the project\'s languages/frameworks/build system and initializes the state file with the chosen scope. Runs automatically in seconds, no approval gates.',
    es: 'Prepara el terreno: crea la estructura de carpetas de AIDLC en el workspace, detecta lenguajes/frameworks/build system del proyecto e inicializa el archivo de estado con el scope elegido. Corre automáticamente en segundos, sin gates de aprobación.'
  },
  ideation: {
    pt: 'Responde "o que vamos construir e por quê?": captura a intenção, pesquisa mercado, avalia viabilidade técnica e de negócio, define escopo e time, e cria mockups iniciais. É pulada em escopos enxutos (workshop, bugfix) onde a intenção já chega pronta — por exemplo, um ticket de Jira detalhado.',
    en: 'Answers "what are we building and why?": captures intent, researches the market, assesses technical and business feasibility, defines scope and team, and creates initial mockups. Skipped in lean scopes (workshop, bugfix) where the intent arrives pre-defined — e.g. a detailed Jira ticket.',
    es: 'Responde "¿qué vamos a construir y por qué?": captura la intención, investiga el mercado, evalúa viabilidad técnica y de negocio, define scope y equipo, y crea mockups iniciales. Se omite en scopes ligeros (workshop, bugfix) donde la intención ya llega lista — por ejemplo, un ticket de Jira detallado.'
  },
  inception: {
    pt: 'Transforma a intenção em plano executável: engenharia reversa do código existente (brownfield), descobre e afirma as práticas do time, analisa requisitos, escreve user stories com critérios BDD, faz o design de domínio (Domain Design), gera unidades (Bolts), define contratos entre elas (Contract Design) e planeja a entrega. 9 stages, cada uma com gate de aprovação.',
    en: 'Turns intent into an executable plan: reverse-engineers existing code (brownfield), discovers and affirms team practices, analyzes requirements, writes user stories with BDD criteria, does domain design, generates units (Bolts), defines contracts between them (Contract Design) and plans delivery. 9 stages, each with an approval gate.',
    es: 'Transforma la intención en un plan ejecutable: ingeniería inversa del código existente (brownfield), descubre y afirma las prácticas del equipo, analiza requisitos, escribe user stories con criterios BDD, hace el diseño de dominio (Domain Design), genera unidades (Bolts), define contratos entre ellas (Contract Design) y planifica la entrega. 9 stages, cada una con gate de aprobación.'
  },
  construction: {
    pt: 'Onde o código nasce: design funcional, requisitos não-funcionais, design de infra, geração de código, build e testes, e pipeline de CI. O walk padrão é stage-major — cada stage roda para todas as unidades antes da próxima; build/test e CI rodam uma vez ao final. O modo swarm (opt-in) roda unidades em paralelo com um referee coordenando.',
    en: 'Where the code is born: functional design, non-functional requirements, infrastructure design, code generation, build and tests, and CI pipeline. The default walk is stage-major — each stage runs for every unit before the next; build/test and CI run once at the end. Swarm mode (opt-in) runs units in parallel with a referee coordinating.',
    es: 'Donde nace el código: diseño funcional, requisitos no funcionales, diseño de infra, generación de código, build y pruebas, y pipeline de CI. El walk por defecto es stage-major — cada stage corre para todas las unidades antes de la siguiente; build/test y CI corren una vez al final. El modo swarm (opt-in) corre unidades en paralelo con un referee coordinando.'
  },
  operation: {
    pt: 'Leva para produção e mantém: pipeline de deployment, provisionamento de ambientes, execução do deploy, observabilidade (monitoramento e alertas), runbooks de incidentes, validação de performance e loop de feedback para otimização.',
    en: 'Ships to production and keeps it running: deployment pipeline, environment provisioning, deploy execution, observability (monitoring and alerts), incident runbooks, performance validation and a feedback loop for optimization.',
    es: 'Lleva a producción y mantiene: pipeline de deployment, aprovisionamiento de ambientes, ejecución del deploy, observabilidad (monitoreo y alertas), runbooks de incidentes, validación de performance y loop de feedback para optimización.'
  }
};

function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

function openModal(innerHtml) {
  document.getElementById('modal-root').innerHTML = `
    <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
      <div class="modal-box" role="dialog" aria-modal="true" tabindex="-1">${innerHtml}</div>
    </div>`;
  const box = document.querySelector('.modal-box');
  if (box && box.focus) box.focus();
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function showPhaseInfo(ev, phaseId) {
  if (ev) ev.stopPropagation();
  const phase = PHASES.find(p => p.id === phaseId);
  if (!phase) return;
  const intent = currentIntent();
  const state = parseState(intent?.state);
  const graph = intent?.graph;
  const phaseStatus = state.phases?.[phaseId] || 'Pending';
  const statusLabel = { Verified:t('phDone'), Active:t('phActive'), Pending:t('phPending'), Skipped:t('phSkipped') }[phaseStatus] || phaseStatus;

  let stagesHtml = '<ul class="stage-list">';
  for (const slug of phase.stages) {
    const st = state.stages?.[slug];
    const status = st?.status || 'pending';
    const action = st?.action || 'EXECUTE';
    let statusClass = status;
    if (action === 'SKIP' && status === 'pending') statusClass = 'skipped';
    const g = graph?.stages?.find(s => s.stage_slug === slug);
    const duration = g ? formatDuration(g.started_at, g.completed_at) : '';
    const agent = esc((g?.agent || STAGE_INFO[slug]?.agent || '').replace('aidlc-','').replace('-agent',''));
    const executedInfo = g
      ? `${agent} · ${duration}${g.outcome === 'approved' ? ' · ' + t('mApprovedShort') : g.outcome === 'pending' ? ' · ' + t('mInProgress') : ''}`
      : (action === 'SKIP' ? t('mSkippedScope') : t('mNotStarted'));
    stagesHtml += `
      <li class="stage-item ${statusClass}" onclick="showStageInfo(null,'${slug}')" style="cursor:pointer">
        <span class="stage-dot ${statusClass}"></span>
        <span class="stage-slug"><strong>${slug}</strong><br>
          <small style="color:var(--text-muted)">${executedInfo}</small></span>
        <button class="info-btn" onclick="showStageInfo(event,'${slug}')">?</button>
      </li>`;
  }
  stagesHtml += '</ul>';

  openModal(`
    <div class="modal-header">
      <h2 style="margin:0">${phaseLabel(phaseId)}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-section"><span class="badge badge-blue">${statusLabel}</span></div>
    <div class="modal-section"><h4>${t('mWhatPhase')}</h4><p>${phaseDetail(phaseId)}</p></div>
    <div class="modal-section"><h4>${t('mStagesClick')}</h4>${stagesHtml}</div>
  `);
}

function showStageInfo(ev, slug) {
  if (ev) ev.stopPropagation();
  const info = STAGE_INFO[slug] || {};
  const intent = currentIntent();
  const state = parseState(intent?.state);
  const graph = intent?.graph;
  const st = state.stages?.[slug];
  const g = graph?.stages?.find(s => s.stage_slug === slug);

  const statusMap = { done:[t('stDone'),'badge-green'], active:[t('stActive'),'badge-yellow'], awaiting:[t('stAwaiting'),'badge-blue'], revising:[t('stRevising'),'badge-red'], skipped:[t('stSkipped'),'badge-purple'], pending:[t('stPending'),'badge-purple'] };
  let status = st?.status || 'pending';
  if (st?.action === 'SKIP' && status === 'pending') status = 'skipped';
  const [statusLabel, statusCls] = statusMap[status] || statusMap.pending;

  let execHtml = '';
  if (g) {
    const passed = (g.sensor_firings||[]).filter(s=>s.result==='passed').length;
    const failed = (g.sensor_firings||[]).filter(s=>s.result==='failed').length;
    execHtml += `<div class="modal-section"><h4>${t('mExec')}</h4><ul>
      <li><strong>${t('mAgent')}:</strong> ${esc(g.agent || '—')}</li>
      <li><strong>${t('mStart')}:</strong> ${formatTime(g.started_at)} — ${formatDate(g.started_at)}</li>
      <li><strong>${t('mDuration')}:</strong> ${g.completed_at ? formatDuration(g.started_at, g.completed_at) : t('mInProgress')}</li>
      <li><strong>${t('mResult')}:</strong> ${g.outcome === 'approved' ? t('mApproved') : esc(g.outcome)}</li>
      ${(passed+failed) ? `<li><strong>${t('mSensors')}:</strong> ${tf('mSensorsLine',{p:passed,f:failed})}</li>` : ''}
    </ul></div>`;
    if (g.memory_breakdown) {
      const mb = g.memory_breakdown;
      execHtml += `<div class="modal-section"><h4>${t('mMemory')}</h4><ul>
        <li>${mb.interpretations} ${t('mInterp')}</li>
        <li>${mb.deviations} ${t('mDeviations')}</li>
        <li>${mb.tradeoffs} ${t('mTradeoffs')}</li>
        <li>${mb.open_questions} ${t('mOpenQ')}</li>
      </ul></div>`;
    }
    if (g.learnings_captured && (g.learnings_captured.from_orchestrator + g.learnings_captured.from_user_addition) > 0) {
      execHtml += `<div class="modal-section"><h4>${t('mLearnings')}</h4><p>${tf('mLearningsLine',{o:g.learnings_captured.from_orchestrator, u:g.learnings_captured.from_user_addition})}</p></div>`;
    }
  } else if (status === 'skipped') {
    execHtml = `<div class="modal-section"><h4>${t('mExec')}</h4><p>${tf('mSkippedLong',{scope: esc(state.scope || '')})}</p></div>`;
  } else {
    execHtml = `<div class="modal-section"><h4>${t('mExec')}</h4><p>${t('mNotStartedLong')}</p></div>`;
  }

  openModal(`
    <div class="modal-header">
      <h2 style="margin:0">${slug}</h2>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="modal-section"><span class="badge ${statusCls}">${statusLabel}</span></div>
    <div class="modal-section"><h4>${t('mWhatStage')}</h4><p>${stageDesc(slug) || t('noDesc')}</p></div>
    <div class="modal-section"><h4>${t('mAgentResp')}</h4><p>${info.agent || '—'}</p></div>
    ${execHtml}
  `);
}

;

// PART 9: Main app logic & event handlers
let rootDirHandle = null;
let activeTab = 'workflow';
let selectedIntentDir = null; // dirName do intent selecionado (persiste entre refreshes)

function currentIntent() {
  const intents = dashboardData?.intents || [];
  return intents.find(i => i.dirName === selectedIntentDir) || intents[0] || null;
}

function selectIntent(dirName) {
  selectedIntentDir = dirName;
  document.getElementById('app').innerHTML = renderDashboard(dashboardData);
  switchTab(activeTab);
}
let autoRefreshEnabled = true;
let refreshTimer = null;
const REFRESH_INTERVAL_MS = 5000;

function switchTab(tabId) {
  activeTab = tabId;
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
  document.getElementById('tab-' + tabId).classList.add('active');
  const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (btn) { btn.classList.add('active'); btn.setAttribute('aria-selected', 'true'); }
  // O grafo de workflow desenha as arestas SVG só quando visível (precisa de layout)
  if (tabId === 'workflow' && typeof drawWfEdges === 'function') requestAnimationFrame(drawWfEdges);
  // A aba Arquivos renderiza mermaid depois que o leitor está no DOM
  if (tabId === 'files' && typeof runMermaid === 'function') requestAnimationFrame(runMermaid);
}

// --- File browser (aba Arquivos) ---
// Carrega a árvore sob demanda (FS Access API). A extensão sobrescreve estas
// funções em bridge.js (pede ao host via postMessage).
async function loadFileTree() {
  if (fbLoading || !rootDirHandle) return;
  fbLoading = true;
  try {
    const space = (dashboardData && dashboardData.activeSpace) || 'default';
    const intent = currentIntent();
    fbTree = await buildFileTree(rootDirHandle, space, intent ? intent.dirName : '');
  } catch (e) {
    console.warn('Falha ao listar árvore de arquivos:', e);
    fbTree = [];
  } finally {
    fbLoading = false;
    const el = document.getElementById('tab-files');
    if (el) { el.innerHTML = safeRender(renderFilesTab); if (activeTab === 'files') requestAnimationFrame(runMermaid); }
  }
}

async function openAidlcFile(path) {
  try {
    if (fbContentCache[path] == null && rootDirHandle) {
      fbContentCache[path] = await readAidlcFile(rootDirHandle, path);
    }
  } catch (e) {
    fbContentCache[path] = 'Erro ao ler: ' + (e && e.message || e);
  }
  fbSelectedPath = path;
  const el = document.getElementById('tab-files');
  if (el) { el.innerHTML = safeRender(renderFilesTab); requestAnimationFrame(runMermaid); }
}

async function refreshData() {
  if (!rootDirHandle) return;
  try {
    dashboardData = await loadDashboardData(rootDirHandle);
    document.getElementById('app').innerHTML = renderDashboard(dashboardData);
    switchTab(activeTab); // restore active tab after re-render
    const indicator = document.getElementById('refresh-indicator');
    if (indicator) indicator.textContent = t('updatedAt') + ' ' + new Date().toLocaleTimeString(LOCALES[lang] || 'en-US');
  } catch (err) {
    console.warn('Falha ao atualizar:', err);
    // Nunca falhe em silêncio: mostra o aviso no indicador (o timer segue tentando)
    const indicator = document.getElementById('refresh-indicator');
    if (indicator) {
      indicator.textContent = t('updWarn');
      indicator.title = String(err && err.message || err);
    }
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  refreshTimer = setInterval(refreshData, REFRESH_INTERVAL_MS);
}

function stopAutoRefresh() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

function toggleAutoRefresh() {
  autoRefreshEnabled = !autoRefreshEnabled;
  if (autoRefreshEnabled) startAutoRefresh(); else stopAutoRefresh();
  const btn = document.getElementById('auto-refresh-btn');
  if (btn) {
    btn.textContent = autoRefreshEnabled ? t('btnPause') : t('btnResume');
    btn.classList.toggle('paused', !autoRefreshEnabled);
  }
}

// --- Auto-refresh de tokens/créditos (independente, mais lento) ---
// Reparsear os .jsonl é caro, então roda num intervalo próprio (não no loop de 5s
// da pasta aidlc). Só re-renderiza a aba de tokens; funciona mesmo sem a pasta aidlc.
let tokenAutoRefresh = true;
let tokenRefreshTimer = null;
let lastTokenRefresh = null;
const TOKEN_REFRESH_INTERVAL_MS = 30000;

async function refreshTokens() {
  if (!tokenDirHandle) return;
  try {
    await loadTokenData();
    lastTokenRefresh = new Date();
    // Só re-renderiza se a aba de tokens estiver visível (evita trabalho invisível)
    if (activeTab === 'tokens') {
      const el = document.getElementById('tab-tokens');
      if (el) el.innerHTML = safeRender(renderTokensTab);
    }
  } catch (err) {
    console.warn('Falha ao atualizar tokens:', err);
  }
}

function startTokenRefresh() {
  stopTokenRefresh();
  if (tokenAutoRefresh) tokenRefreshTimer = setInterval(refreshTokens, TOKEN_REFRESH_INTERVAL_MS);
}

function stopTokenRefresh() {
  if (tokenRefreshTimer) { clearInterval(tokenRefreshTimer); tokenRefreshTimer = null; }
}

function toggleTokenAutoRefresh() {
  tokenAutoRefresh = !tokenAutoRefresh;
  if (tokenAutoRefresh && tokenDirHandle) startTokenRefresh(); else stopTokenRefresh();
  const btn = document.getElementById('token-auto-btn');
  if (btn) {
    btn.textContent = tokenAutoRefresh ? t('tkAutoOn') : t('tkAutoOff');
    btn.classList.toggle('paused', !tokenAutoRefresh);
  }
}

async function openFolder() {
  try {
    rootDirHandle = await window.showDirectoryPicker({ mode: 'read' });
    document.getElementById('app').innerHTML = `<div class="empty-state"><p>${t('loading')}</p></div>`;
    dashboardData = await loadDashboardData(rootDirHandle);
    document.getElementById('app').innerHTML = renderDashboard(dashboardData);
    switchTab(activeTab);
    if (autoRefreshEnabled) startAutoRefresh();
  } catch (err) {
    if (err.name !== 'AbortError') {
      alert(t('errRead') + err.message);
    }
  }
}

// Pausa o polling quando a aba do navegador está em background
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { stopAutoRefresh(); stopTokenRefresh(); }
  else {
    if (autoRefreshEnabled && rootDirHandle) { refreshData(); startAutoRefresh(); }
    if (tokenAutoRefresh && tokenDirHandle) { refreshTokens(); startTokenRefresh(); }
  }
});

// Render inicial adiado para depois de todos os scripts (dicionários I18N incluídos)
window.addEventListener('DOMContentLoaded', () => {
  if (!window.showDirectoryPicker) {
    document.getElementById('app').innerHTML = `
      <div class="load-area">
        <div class="header-logo">⚠️</div>
        <h1>${t('unsupportedTitle')}</h1>
        <p class="load-desc">${t('unsupportedDesc')}</p>
      </div>
    `;
    return;
  }
  document.getElementById('app').innerHTML = renderLoadScreen();
});

;

// PART 10: I18N - Português
Object.assign(I18N.pt = I18N.pt || {}, {
  loadDesc:'Selecione a pasta <code>aidlc/</code> do seu projeto para visualizar o estado do workflow, progresso das fases e decisões.',
  openBtn:'📂 Abrir Pasta aidlc', compatNote:'Compatível com Chrome, Edge e Opera (File System Access API)',
  unsupportedTitle:'Navegador Não Suportado', unsupportedDesc:'Este dashboard requer a File System Access API, disponível no Chrome, Edge e Opera.',
  loading:'Carregando dados...', errTitle:'Erro', errRead:'Erro ao ler pasta: ',
  noWf:'Nenhum workflow encontrado', noWfDesc:'A pasta aidlc não contém intents ativos.', intentsNotFound:'intents.json não encontrado',
  naTitle:'Projeto sem AI-DLC',
  naDesc:'A estrutura <code>aidlc/spaces/…/intents</code> não foi encontrada. Aparentemente este projeto ainda não rodou um workflow AI-DLC — rode <code>/aidlc &lt;descrição&gt;</code> para iniciar um, ou selecione outra pasta.',
  clone:'Clone', stStagesDone:'Stages Concluídos', stCurrentStage:'Stage Atual', stActiveAgent:'Agente Ativo', stDepth:'Profundidade',
  overallProgress:'Progresso Geral', lblStart:'Início', lblUpdated:'Atualizado', updatedAt:'Atualizado às',
  btnPause:'⏸ Pausar', btnResume:'▶ Retomar', btnRefresh:'🔄 Atualizar',
  updWarn:'⚠️ Falha ao atualizar — tentando de novo em 5s',
  tabPhases:'Fases', tabStages:'Stages', tabSensors:'Sensores', tabKnowledge:'Conhecimento', tabAudit:'Auditoria', tabTokens:'Tokens', tabHelp:'Ajuda',
  tabWorkflow:'Workflow',
  tabFiles:'Arquivos', fbEmpty:'Nenhum arquivo legível nesta pasta.', fbPick:'Selecione um arquivo à esquerda para ler.',
  wfTitle:'🗺️ Formato do workflow por scope',
  wfSub:'Mostra quais das 33 stages rodam de acordo com o scope. As esmaecidas são puladas (o doctor ainda as valida, só não executam).',
  wfRealScope:'Scope real deste workflow', wfIsReal:'Este é o scope em execução:', wfNotReal:'Prévia — o scope real é "{real}".',
  wfOf:'de', wfStagesRun:'stages rodam',
  wfGates:'gates', wfComposed:'composto', wfGridSrc:'Grid de scopes: {src}',
  wfComposedDesc:'Scope composto/custom — grade derivada do estado do workflow',
  wfVGate:'Verification Gate {n}', wfVGateTip:'Gate de verificação de fronteira de fase', wfVGateLeg:'gate de verificação entre fases',
  wfLegExec:'EXECUTE neste scope', wfLegSkip:'SKIP, fora do scope', wfLegDone:'concluída (estado real)', wfLegCurrent:'stage atual (estado real)',
  badgeRunning:'Em Execução', badgeCompleted:'Concluído', badgePaused:'Pausado', badgeFailed:'Falhou', badgeUnknown:'Desconhecido',
  phDone:'Concluída', phActive:'Ativa', phPending:'Pendente', phSkipped:'Pulada',
  stDone:'Concluído', stActive:'Em andamento', stAwaiting:'Aguardando aprovação', stRevising:'Em revisão', stSkipped:'Pulado', stPending:'Não iniciado',
  mWhatPhase:'O que essa fase faz', mStagesClick:'Stages (clique para detalhes)', mWhatStage:'O que esse stage faz',
  mAgentResp:'Agente responsável', mExec:'Execução', mAgent:'Agente', mStart:'Início', mDuration:'Duração', mResult:'Resultado',
  mSensors:'Sensores', mApproved:'aprovado no gate ✓', mApprovedShort:'aprovado ✓', mInProgress:'em andamento',
  mNotStarted:'não iniciado', mNotStartedLong:'Ainda não iniciado.', mSkippedScope:'pulado neste escopo',
  mSkippedLong:'Este stage foi pulado pelo escopo <strong>{scope}</strong> — o trabalho que ele faria já chegou pronto ou não se aplica.',
  mMemory:'Memória do stage', mInterp:'interpretações', mDeviations:'desvios', mTradeoffs:'trade-offs', mOpenQ:'questões em aberto',
  mLearnings:'Aprendizados', mLearningsLine:'{o} do orquestrador, {u} adicionados pelo usuário',
  mSensorsLine:'{p} passaram, {f} falharam', noDesc:'Sem descrição.', phaseDetailsBtn:'Detalhes da fase', stageDetailsBtn:'Detalhes do stage',
  kProject:'Projeto', kType:'Tipo', kScope:'Escopo', kTestStrategy:'Estratégia de Testes',
  kDecRules:'Decisões e Regras Aprendidas', kDecisions:'Decisões', kForbidden:'Proibições (NEVER)', kNever:'NUNCA',
  kMandated:'Obrigatórios (ALWAYS)', kAlways:'SEMPRE', kLearnCaptured:'Aprendizados Capturados',
  kLearnLine:'{total} aprendizado(s) — {o} do orquestrador, {u} do usuário',
  aTitle:'Trail de Auditoria', aNone:'Sem logs de auditoria', aDecisions:'Decisões Registradas',
  evSESSION_STARTED:'🚀 Sessão Iniciada', evHUMAN_TURN:'👤 Turno Humano', evDECISION_RECORDED:'📝 Decisão Registrada',
  evSUBAGENT_COMPLETED:'🤖 Subagente Concluiu', evHEALTH_CHECKED:'🩺 Health Check', evERROR_LOGGED:'⚠️ Erro',
  evGUARDRAIL_LOADED:'🛡️ Guardrail Carregado', evSTAGE_STARTED:'▶️ Stage Iniciou', evSTAGE_COMPLETED:'✅ Stage Concluiu',
  evGATE_OPENED:'🚪 Gate Aberto', evGATE_APPROVED:'✓ Gate Aprovado', evSENSOR_FIRED:'📡 Sensor Disparou', evLEARNING_CAPTURED:'💡 Aprendizado',
  sNone:'Sem dados de sensores', sNoneFired:'Nenhum sensor disparado ainda',
  tkTitle:'Consumo de Tokens',
  tkDesc:'Os dados de token não ficam na pasta <code>aidlc/</code> — ficam nos transcripts do harness. Selecione a pasta abaixo conforme o seu harness; o formato é detectado automaticamente.',
  tkOpenBtn:'📂 Abrir Pasta de Transcripts', tkClaudeHintTitle:'Claude Code (tokens completos)', tkKiroHintTitle:'Kiro IDE (uso de contexto por sessão)',
  tkKiroHintNote:'O Kiro não grava tokens, mas grava <strong>créditos por turno</strong> — o dashboard mostra sessões, % da janela de contexto e créditos consumidos (total, por sessão e por stage).',
  tkMacHint:'Dica macOS: pastas ocultas — use Cmd+Shift+. no seletor para exibi-las.',
  tkNoneFound:'Nenhum transcript reconhecido nessa pasta. Verifique os caminhos de exemplo.', tkChangeFolder:'📂 Trocar pasta',
  tkClaudeCard:'Claude Code — Tokens', tkKiroCard:'Kiro — Sessões',
  tkKiroNote:'O Kiro não grava tokens, mas grava créditos consumidos por turno. Abaixo: sessões com pico de contexto e créditos.',
  tkByModel:'Por Modelo', tkBySession:'Por Sessão', tkMsgs:'mensagens', tkRecords:'registros', tkContext:'contexto', tkRefresh:'🔄 Atualizar tokens',
  tkAutoOn:'⏸ Auto (30s)', tkAutoOff:'▶ Auto off',
  tabError:'Erro ao renderizar esta aba',
  tkCostCard:'Custo por Stage (estimado)',
  tkCostNote:'Estimativa local: cruza os timestamps dos transcripts com o intervalo de execução de cada stage. Preços de referência por 1M tokens (tabela PRICING no código) — ajuste conforme seu contrato/região.',
  tkStage:'Stage', tkTotal:'Total', tkOutside:'fora de stages',
  tkCredits:'créditos', tkCreditsTotal:'Créditos', tkTurns:'Turnos',
  tkKiroCreditCard:'Créditos por Stage (Kiro)',
  tkKiroCreditNote:'Créditos consumidos por turno, atribuídos ao stage cuja janela de execução contém o timestamp do turno. Mesma unidade de cobrança da sua assinatura Kiro.'
});

// Units & Bolts (23-units-bolts.js)
Object.assign(I18N.pt, {
  ubFullTitle:'Construction — Units & Bolts', ubPlanTitle:'Plano de Construction', ubHistTitle:'Construction concluída',
  ubPlanSum:'{u} units geradas · {b} bolts planejados', ubHistSum:'{d}/{u} units concluídas · {b} bolts',
  ubPreviewNote:'Plano gerado na Inception — a execução por unit começa na fase Construction.',
  ubUnits:'Units', ubBoltsPlanned:'Bolts planejados', ubBoltsNoPlan:'Bolts (sem bolt-plan)',
  ubDone:'Executados', ubRunning:'Em execução', ubQueued:'Na fila', ubFailed:'Falharam',
  ubSt_done:'concluído', ubSt_running:'em execução', ubSt_queued:'na fila', ubSt_failed:'falhou', ubSt_pending:'pendente',
  ubSt_skipped:'pulado', ubSt_active:'em execução', ubSt_awaiting:'aguardando aprovação', ubSt_revising:'em revisão',
  ubDependsOn:'depende de', ubNoDeps:'sem dependências', ubWalking:'Walking skeleton',
  ubBoltTrack:'Trilha de Bolts', ubUnitsGrid:'Units — progresso por stage (3.1 → 3.5)',
  ubShowGrid:'Mostrar grade de stages', ubShowUnits:'Ver units e bolts', ubSource:'Lido de'
});

;

// PART 10b: I18N - Português (Ajuda)
Object.assign(I18N.pt = I18N.pt || {}, {
  hTitle:'O que é o AI-DLC?',
  hIntro:'O AI-DLC (AI-Driven Development Life Cycle) é uma metodologia estruturada para desenvolvimento de software com IA. Ele organiza o trabalho em <strong>5 fases</strong>, <strong>33 stages</strong>, com <strong>14 agentes especializados</strong> e gates de aprovação em cada etapa.',
  hC1t:'🏗️ Inicialização (Initialization)', hC1:'Configura o workspace, detecta stack tecnológica e inicializa o estado do workflow. Automática e rápida.',
  hC2t:'💡 Ideação (Ideation)', hC2:'Captura intenção, pesquisa mercado, avalia viabilidade e define escopo. Pulada em escopos workshop/bugfix.',
  hC3t:'📐 Concepção (Inception)', hC3:'Engenharia reversa, descoberta de práticas, análise de requisitos, user stories, mockups refinados, <strong>Domain Design</strong>, geração de unidades, <strong>Contract Design</strong> e planejamento de entrega. 9 stages.',
  hC4t:'🔨 Construção (Construction)', hC4:'Design funcional, NFRs, design de infra, geração de código, build/test e pipeline CI. Caminho padrão é <em>stage-major</em>: cada stage roda por unidade; build/test e CI rodam uma vez ao final.',
  hC5t:'🚀 Operação (Operation)', hC5:'Deploy, provisionamento, observabilidade, resposta a incidentes e validação de performance em produção.',
  hC6t:'🤖 Agentes', hC6:'14 agentes: 11 de domínio (developer, architect, product, delivery, design, quality, aws-platform, operations, devsecops, compliance, pipeline-deploy), 2 revisores e o compositor adaptativo.',
  hC7t:'📡 Sensores', hC7:'Validam automaticamente seções obrigatórias e cobertura upstream. Podem passar ou falhar — o agente corrige antes de seguir.',
  hC8t:'🗺️ Aba Workflow', hC8:'A aba <strong>Workflow</strong> mostra quais das 33 stages rodam para o scope em execução (EXECUTE destacadas, SKIP esmaecidas), com as stages já concluídas marcadas do estado real.',
  hScopes:'Escopos Disponíveis', hScopesNote:'Contagem de stages (EXECUTE) e gates de aprovação por scope. Scopes compostos aparecem aqui quando existe um scope-grid.json no projeto.', hCommands:'Comandos Úteis',
  hCmd1:'Verifica saúde do setup', hCmd2:'Inicia um workflow', hCmd3:'Mostra status atual', hCmd4:'Pula para um stage', hCmd5:'Compõe plano adaptativo'
});

;

// PART 11: I18N - English (fallback base)
Object.assign(I18N.en = I18N.en || {}, {
  loadDesc:'Select your project\'s <code>aidlc/</code> folder to view workflow state, phase progress and decisions.',
  openBtn:'📂 Open aidlc Folder', compatNote:'Compatible with Chrome, Edge and Opera (File System Access API)',
  unsupportedTitle:'Browser Not Supported', unsupportedDesc:'This dashboard requires the File System Access API, available in Chrome, Edge and Opera.',
  loading:'Loading data...', errTitle:'Error', errRead:'Error reading folder: ',
  noWf:'No workflow found', noWfDesc:'The aidlc folder has no active intents.', intentsNotFound:'intents.json not found',
  naTitle:'Not an AI-DLC project',
  naDesc:'The <code>aidlc/spaces/…/intents</code> structure was not found. This project apparently has not run an AI-DLC workflow yet — run <code>/aidlc &lt;description&gt;</code> to start one, or select a different folder.',
  clone:'Clone', stStagesDone:'Stages Completed', stCurrentStage:'Current Stage', stActiveAgent:'Active Agent', stDepth:'Depth',
  overallProgress:'Overall Progress', lblStart:'Started', lblUpdated:'Updated', updatedAt:'Updated at',
  btnPause:'⏸ Pause', btnResume:'▶ Resume', btnRefresh:'🔄 Refresh',
  updWarn:'⚠️ Refresh failed — retrying in 5s',
  tabPhases:'Phases', tabStages:'Stages', tabSensors:'Sensors', tabKnowledge:'Knowledge', tabAudit:'Audit', tabTokens:'Tokens', tabHelp:'Help',
  tabWorkflow:'Workflow',
  tabFiles:'Files', fbEmpty:'No readable files in this folder.', fbPick:'Select a file on the left to read it.',
  wfTitle:'🗺️ Workflow shape per scope',
  wfSub:'Shows which of the 33 stages run for each scope. Dimmed ones are skipped (the doctor still validates them, they just do not execute).',
  wfRealScope:'This workflow\'s actual scope', wfIsReal:'This is the running scope:', wfNotReal:'Preview — the actual scope is "{real}".',
  wfOf:'of', wfStagesRun:'stages run',
  wfGates:'gates', wfComposed:'composed', wfGridSrc:'Scope grid: {src}',
  wfComposedDesc:'Composed/custom scope — grid derived from the workflow state',
  wfVGate:'Verification Gate {n}', wfVGateTip:'Phase-boundary verification gate', wfVGateLeg:'phase verification gate',
  wfLegExec:'EXECUTE in this scope', wfLegSkip:'SKIP, out of scope', wfLegDone:'done (live state)', wfLegCurrent:'current stage (live state)',
  badgeRunning:'Running', badgeCompleted:'Completed', badgePaused:'Paused', badgeFailed:'Failed', badgeUnknown:'Unknown',
  phDone:'Completed', phActive:'Active', phPending:'Pending', phSkipped:'Skipped',
  stDone:'Completed', stActive:'In progress', stAwaiting:'Awaiting approval', stRevising:'Revising', stSkipped:'Skipped', stPending:'Not started',
  mWhatPhase:'What this phase does', mStagesClick:'Stages (click for details)', mWhatStage:'What this stage does',
  mAgentResp:'Responsible agent', mExec:'Execution', mAgent:'Agent', mStart:'Started', mDuration:'Duration', mResult:'Result',
  mSensors:'Sensors', mApproved:'approved at gate ✓', mApprovedShort:'approved ✓', mInProgress:'in progress',
  mNotStarted:'not started', mNotStartedLong:'Not started yet.', mSkippedScope:'skipped in this scope',
  mSkippedLong:'This stage was skipped by the <strong>{scope}</strong> scope — its work either arrived pre-done or does not apply.',
  mMemory:'Stage memory', mInterp:'interpretations', mDeviations:'deviations', mTradeoffs:'trade-offs', mOpenQ:'open questions',
  mLearnings:'Learnings', mLearningsLine:'{o} from orchestrator, {u} added by user',
  mSensorsLine:'{p} passed, {f} failed', noDesc:'No description.', phaseDetailsBtn:'Phase details', stageDetailsBtn:'Stage details',
  kProject:'Project', kType:'Type', kScope:'Scope', kTestStrategy:'Test Strategy',
  kDecRules:'Learned Decisions and Rules', kDecisions:'Decisions', kForbidden:'Forbidden (NEVER)', kNever:'NEVER',
  kMandated:'Mandated (ALWAYS)', kAlways:'ALWAYS', kLearnCaptured:'Captured Learnings',
  kLearnLine:'{total} learning(s) — {o} from orchestrator, {u} from user',
  aTitle:'Audit Trail', aNone:'No audit logs', aDecisions:'Recorded Decisions',
  evSESSION_STARTED:'🚀 Session Started', evHUMAN_TURN:'👤 Human Turn', evDECISION_RECORDED:'📝 Decision Recorded',
  evSUBAGENT_COMPLETED:'🤖 Subagent Completed', evHEALTH_CHECKED:'🩺 Health Check', evERROR_LOGGED:'⚠️ Error',
  evGUARDRAIL_LOADED:'🛡️ Guardrail Loaded', evSTAGE_STARTED:'▶️ Stage Started', evSTAGE_COMPLETED:'✅ Stage Completed',
  evGATE_OPENED:'🚪 Gate Opened', evGATE_APPROVED:'✓ Gate Approved', evSENSOR_FIRED:'📡 Sensor Fired', evLEARNING_CAPTURED:'💡 Learning',
  sNone:'No sensor data', sNoneFired:'No sensors fired yet',
  tkTitle:'Token Usage',
  tkDesc:'Token data does not live in the <code>aidlc/</code> folder — it lives in the harness transcripts. Pick the folder below for your harness; the format is auto-detected.',
  tkOpenBtn:'📂 Open Transcripts Folder', tkClaudeHintTitle:'Claude Code (full token counts)', tkKiroHintTitle:'Kiro IDE (context usage per session)',
  tkKiroHintNote:'Kiro does not store tokens, but it does store <strong>credits per turn</strong> — the dashboard shows sessions, context-window % and consumed credits (total, per session and per stage).',
  tkMacHint:'macOS tip: hidden folders — press Cmd+Shift+. in the picker to show them.',
  tkNoneFound:'No recognized transcripts in that folder. Check the example paths.', tkChangeFolder:'📂 Change folder',
  tkClaudeCard:'Claude Code — Tokens', tkKiroCard:'Kiro — Sessions',
  tkKiroNote:'Kiro does not store tokens, but it stores credits consumed per turn. Below: sessions with peak context usage and credits.',
  tkByModel:'By Model', tkBySession:'By Session', tkMsgs:'messages', tkRecords:'records', tkContext:'context', tkRefresh:'🔄 Refresh tokens',
  tkAutoOn:'⏸ Auto (30s)', tkAutoOff:'▶ Auto off',
  tabError:'Failed to render this tab',
  tkCostCard:'Cost per Stage (estimated)',
  tkCostNote:'Local estimate: cross-references transcript timestamps with each stage\'s execution window. Reference prices per 1M tokens (PRICING table in the code) — adjust to your contract/region.',
  tkStage:'Stage', tkTotal:'Total', tkOutside:'outside stages',
  tkCredits:'credits', tkCreditsTotal:'Credits', tkTurns:'Turns',
  tkKiroCreditCard:'Credits per Stage (Kiro)',
  tkKiroCreditNote:'Credits consumed per turn, attributed to the stage whose execution window contains the turn timestamp. Same billing unit as your Kiro subscription.'
});

// Units & Bolts (23-units-bolts.js)
Object.assign(I18N.en, {
  ubFullTitle:'Construction — Units & Bolts', ubPlanTitle:'Construction plan', ubHistTitle:'Construction complete',
  ubPlanSum:'{u} units generated · {b} bolts planned', ubHistSum:'{d}/{u} units done · {b} bolts',
  ubPreviewNote:'Plan generated in Inception — per-unit execution starts in the Construction phase.',
  ubUnits:'Units', ubBoltsPlanned:'Bolts planned', ubBoltsNoPlan:'Bolts (no bolt-plan)',
  ubDone:'Done', ubRunning:'Running', ubQueued:'Queued', ubFailed:'Failed',
  ubSt_done:'done', ubSt_running:'running', ubSt_queued:'queued', ubSt_failed:'failed', ubSt_pending:'pending',
  ubSt_skipped:'skipped', ubSt_active:'running', ubSt_awaiting:'awaiting approval', ubSt_revising:'revising',
  ubDependsOn:'depends on', ubNoDeps:'no dependencies', ubWalking:'Walking skeleton',
  ubBoltTrack:'Bolt track', ubUnitsGrid:'Units — progress per stage (3.1 → 3.5)',
  ubShowGrid:'Show stage grid', ubShowUnits:'Show units and bolts', ubSource:'Read from'
});

;

// PART 11b: I18N - English (Help)
Object.assign(I18N.en = I18N.en || {}, {
  hTitle:'What is AI-DLC?',
  hIntro:'AI-DLC (AI-Driven Development Life Cycle) is a structured methodology for AI-driven software development. It organizes work into <strong>5 phases</strong>, <strong>33 stages</strong>, with <strong>14 specialized agents</strong> and approval gates at every step.',
  hC1t:'🏗️ Initialization', hC1:'Sets up the workspace, detects the tech stack and initializes workflow state. Automatic and fast.',
  hC2t:'💡 Ideation', hC2:'Captures intent, researches the market, assesses feasibility and defines scope. Skipped in workshop/bugfix scopes.',
  hC3t:'📐 Inception', hC3:'Reverse engineering, practices discovery, requirements analysis, user stories, refined mockups, <strong>Domain Design</strong>, units generation, <strong>Contract Design</strong> and delivery planning. 9 stages.',
  hC4t:'🔨 Construction', hC4:'Functional design, NFRs, infrastructure design, code generation, build/test and CI pipeline. Default walk is <em>stage-major</em>: each stage runs per unit; build/test and CI run once at the end.',
  hC5t:'🚀 Operation', hC5:'Deployment, provisioning, observability, incident response and performance validation in production.',
  hC6t:'🤖 Agents', hC6:'14 agents: 11 domain (developer, architect, product, delivery, design, quality, aws-platform, operations, devsecops, compliance, pipeline-deploy), 2 reviewers and the adaptive composer.',
  hC7t:'📡 Sensors', hC7:'Automatically validate required sections and upstream coverage. They can pass or fail — the agent fixes issues before moving on.',
  hC8t:'🗺️ Workflow tab', hC8:'The <strong>Workflow</strong> tab shows which of the 33 stages run for the active scope (EXECUTE highlighted, SKIP dimmed), with completed stages marked from live state.',
  hScopes:'Available Scopes', hScopesNote:'Stage (EXECUTE) and approval-gate counts per scope. Composed scopes appear here when the project has a scope-grid.json.', hCommands:'Useful Commands',
  hCmd1:'Checks setup health', hCmd2:'Starts a workflow', hCmd3:'Shows current status', hCmd4:'Jumps to a stage', hCmd5:'Composes an adaptive plan'
});

;

// PART 12: I18N - Español
Object.assign(I18N.es = I18N.es || {}, {
  loadDesc:'Selecciona la carpeta <code>aidlc/</code> de tu proyecto para ver el estado del workflow, el progreso de las fases y las decisiones.',
  openBtn:'📂 Abrir Carpeta aidlc', compatNote:'Compatible con Chrome, Edge y Opera (File System Access API)',
  unsupportedTitle:'Navegador No Soportado', unsupportedDesc:'Este dashboard requiere la File System Access API, disponible en Chrome, Edge y Opera.',
  loading:'Cargando datos...', errTitle:'Error', errRead:'Error al leer la carpeta: ',
  noWf:'Ningún workflow encontrado', noWfDesc:'La carpeta aidlc no contiene intents activos.', intentsNotFound:'intents.json no encontrado',
  naTitle:'Proyecto sin AI-DLC',
  naDesc:'La estructura <code>aidlc/spaces/…/intents</code> no fue encontrada. Aparentemente este proyecto aún no ejecutó un workflow AI-DLC — ejecuta <code>/aidlc &lt;descripción&gt;</code> para iniciar uno, o selecciona otra carpeta.',
  clone:'Clone', stStagesDone:'Stages Completados', stCurrentStage:'Stage Actual', stActiveAgent:'Agente Activo', stDepth:'Profundidad',
  overallProgress:'Progreso General', lblStart:'Inicio', lblUpdated:'Actualizado', updatedAt:'Actualizado a las',
  btnPause:'⏸ Pausar', btnResume:'▶ Reanudar', btnRefresh:'🔄 Actualizar',
  updWarn:'⚠️ Error al actualizar — reintentando en 5s',
  tabPhases:'Fases', tabStages:'Stages', tabSensors:'Sensores', tabKnowledge:'Conocimiento', tabAudit:'Auditoría', tabTokens:'Tokens', tabHelp:'Ayuda',
  tabWorkflow:'Workflow',
  tabFiles:'Archivos', fbEmpty:'Ningún archivo legible en esta carpeta.', fbPick:'Selecciona un archivo a la izquierda para leerlo.',
  wfTitle:'🗺️ Formato del workflow por scope',
  wfSub:'Muestra cuáles de las 33 stages corren según el scope. Las atenuadas se omiten (el doctor aún las valida, solo no se ejecutan).',
  wfRealScope:'Scope real de este workflow', wfIsReal:'Este es el scope en ejecución:', wfNotReal:'Vista previa — el scope real es "{real}".',
  wfOf:'de', wfStagesRun:'stages corren',
  wfGates:'gates', wfComposed:'compuesto', wfGridSrc:'Grid de scopes: {src}',
  wfComposedDesc:'Scope compuesto/custom — grid derivado del estado del workflow',
  wfVGate:'Verification Gate {n}', wfVGateTip:'Gate de verificación de frontera de fase', wfVGateLeg:'gate de verificación entre fases',
  wfLegExec:'EXECUTE en este scope', wfLegSkip:'SKIP, fuera del scope', wfLegDone:'completada (estado real)', wfLegCurrent:'stage actual (estado real)',
  badgeRunning:'En Ejecución', badgeCompleted:'Completado', badgePaused:'Pausado', badgeFailed:'Falló', badgeUnknown:'Desconocido',
  phDone:'Completada', phActive:'Activa', phPending:'Pendiente', phSkipped:'Omitida',
  stDone:'Completado', stActive:'En curso', stAwaiting:'Esperando aprobación', stRevising:'En revisión', stSkipped:'Omitido', stPending:'No iniciado',
  mWhatPhase:'Qué hace esta fase', mStagesClick:'Stages (clic para detalles)', mWhatStage:'Qué hace este stage',
  mAgentResp:'Agente responsable', mExec:'Ejecución', mAgent:'Agente', mStart:'Inicio', mDuration:'Duración', mResult:'Resultado',
  mSensors:'Sensores', mApproved:'aprobado en el gate ✓', mApprovedShort:'aprobado ✓', mInProgress:'en curso',
  mNotStarted:'no iniciado', mNotStartedLong:'Aún no iniciado.', mSkippedScope:'omitido en este scope',
  mSkippedLong:'Este stage fue omitido por el scope <strong>{scope}</strong> — su trabajo ya llegó hecho o no aplica.',
  mMemory:'Memoria del stage', mInterp:'interpretaciones', mDeviations:'desviaciones', mTradeoffs:'trade-offs', mOpenQ:'preguntas abiertas',
  mLearnings:'Aprendizajes', mLearningsLine:'{o} del orquestador, {u} añadidos por el usuario',
  mSensorsLine:'{p} pasaron, {f} fallaron', noDesc:'Sin descripción.', phaseDetailsBtn:'Detalles de la fase', stageDetailsBtn:'Detalles del stage',
  kProject:'Proyecto', kType:'Tipo', kScope:'Scope', kTestStrategy:'Estrategia de Pruebas',
  kDecRules:'Decisiones y Reglas Aprendidas', kDecisions:'Decisiones', kForbidden:'Prohibiciones (NEVER)', kNever:'NUNCA',
  kMandated:'Obligatorios (ALWAYS)', kAlways:'SIEMPRE', kLearnCaptured:'Aprendizajes Capturados',
  kLearnLine:'{total} aprendizaje(s) — {o} del orquestador, {u} del usuario',
  aTitle:'Registro de Auditoría', aNone:'Sin logs de auditoría', aDecisions:'Decisiones Registradas',
  evSESSION_STARTED:'🚀 Sesión Iniciada', evHUMAN_TURN:'👤 Turno Humano', evDECISION_RECORDED:'📝 Decisión Registrada',
  evSUBAGENT_COMPLETED:'🤖 Subagente Completó', evHEALTH_CHECKED:'🩺 Health Check', evERROR_LOGGED:'⚠️ Error',
  evGUARDRAIL_LOADED:'🛡️ Guardrail Cargado', evSTAGE_STARTED:'▶️ Stage Inició', evSTAGE_COMPLETED:'✅ Stage Completó',
  evGATE_OPENED:'🚪 Gate Abierto', evGATE_APPROVED:'✓ Gate Aprobado', evSENSOR_FIRED:'📡 Sensor Disparó', evLEARNING_CAPTURED:'💡 Aprendizaje',
  sNone:'Sin datos de sensores', sNoneFired:'Ningún sensor disparado aún',
  tkTitle:'Consumo de Tokens',
  tkDesc:'Los datos de tokens no están en la carpeta <code>aidlc/</code> — están en los transcripts del harness. Selecciona la carpeta según tu harness; el formato se detecta automáticamente.',
  tkOpenBtn:'📂 Abrir Carpeta de Transcripts', tkClaudeHintTitle:'Claude Code (tokens completos)', tkKiroHintTitle:'Kiro IDE (uso de contexto por sesión)',
  tkKiroHintNote:'Kiro no guarda tokens, pero sí guarda <strong>créditos por turno</strong> — el dashboard muestra sesiones, % de la ventana de contexto y créditos consumidos (total, por sesión y por stage).',
  tkMacHint:'Tip macOS: carpetas ocultas — usa Cmd+Shift+. en el selector para mostrarlas.',
  tkNoneFound:'Ningún transcript reconocido en esa carpeta. Revisa las rutas de ejemplo.', tkChangeFolder:'📂 Cambiar carpeta',
  tkClaudeCard:'Claude Code — Tokens', tkKiroCard:'Kiro — Sesiones',
  tkKiroNote:'Kiro no guarda tokens, pero guarda créditos consumidos por turno. Abajo: sesiones con pico de contexto y créditos.',
  tkByModel:'Por Modelo', tkBySession:'Por Sesión', tkMsgs:'mensajes', tkRecords:'registros', tkContext:'contexto', tkRefresh:'🔄 Actualizar tokens',
  tkAutoOn:'⏸ Auto (30s)', tkAutoOff:'▶ Auto off',
  tabError:'Error al renderizar esta pestaña',
  tkCostCard:'Costo por Stage (estimado)',
  tkCostNote:'Estimación local: cruza los timestamps de los transcripts con la ventana de ejecución de cada stage. Precios de referencia por 1M tokens (tabla PRICING en el código) — ajusta según tu contrato/región.',
  tkStage:'Stage', tkTotal:'Total', tkOutside:'fuera de stages',
  tkCredits:'créditos', tkCreditsTotal:'Créditos', tkTurns:'Turnos',
  tkKiroCreditCard:'Créditos por Stage (Kiro)',
  tkKiroCreditNote:'Créditos consumidos por turno, atribuidos al stage cuya ventana de ejecución contiene el timestamp del turno. Misma unidad de facturación de tu suscripción Kiro.'
});

// Units & Bolts (23-units-bolts.js)
Object.assign(I18N.es, {
  ubFullTitle:'Construction — Units & Bolts', ubPlanTitle:'Plan de Construction', ubHistTitle:'Construction concluida',
  ubPlanSum:'{u} units generadas · {b} bolts planificados', ubHistSum:'{d}/{u} units concluidas · {b} bolts',
  ubPreviewNote:'Plan generado en Inception — la ejecución por unit empieza en la fase Construction.',
  ubUnits:'Units', ubBoltsPlanned:'Bolts planificados', ubBoltsNoPlan:'Bolts (sin bolt-plan)',
  ubDone:'Ejecutados', ubRunning:'En ejecución', ubQueued:'En cola', ubFailed:'Fallaron',
  ubSt_done:'concluido', ubSt_running:'en ejecución', ubSt_queued:'en cola', ubSt_failed:'falló', ubSt_pending:'pendiente',
  ubSt_skipped:'omitido', ubSt_active:'en ejecución', ubSt_awaiting:'esperando aprobación', ubSt_revising:'en revisión',
  ubDependsOn:'depende de', ubNoDeps:'sin dependencias', ubWalking:'Walking skeleton',
  ubBoltTrack:'Secuencia de Bolts', ubUnitsGrid:'Units — progreso por stage (3.1 → 3.5)',
  ubShowGrid:'Mostrar grilla de stages', ubShowUnits:'Ver units y bolts', ubSource:'Leído de'
});

;

// PART 12b: I18N - Español (Ayuda)
Object.assign(I18N.es = I18N.es || {}, {
  hTitle:'¿Qué es AI-DLC?',
  hIntro:'AI-DLC (AI-Driven Development Life Cycle) es una metodología estructurada para el desarrollo de software con IA. Organiza el trabajo en <strong>5 fases</strong>, <strong>33 stages</strong>, con <strong>14 agentes especializados</strong> y gates de aprobación en cada etapa.',
  hC1t:'🏗️ Inicialización (Initialization)', hC1:'Configura el workspace, detecta el stack tecnológico e inicializa el estado del workflow. Automática y rápida.',
  hC2t:'💡 Ideación (Ideation)', hC2:'Captura la intención, investiga el mercado, evalúa viabilidad y define el scope. Se omite en scopes workshop/bugfix.',
  hC3t:'📐 Concepción (Inception)', hC3:'Ingeniería inversa, descubrimiento de prácticas, análisis de requisitos, user stories, mockups refinados, <strong>Domain Design</strong>, generación de unidades, <strong>Contract Design</strong> y planificación de entrega. 9 stages.',
  hC4t:'🔨 Construcción (Construction)', hC4:'Diseño funcional, NFRs, diseño de infra, generación de código, build/test y pipeline de CI. El camino por defecto es <em>stage-major</em>: cada stage corre por unidad; build/test y CI corren una vez al final.',
  hC5t:'🚀 Operación (Operation)', hC5:'Deploy, aprovisionamiento, observabilidad, respuesta a incidentes y validación de performance en producción.',
  hC6t:'🤖 Agentes', hC6:'14 agentes: 11 de dominio (developer, architect, product, delivery, design, quality, aws-platform, operations, devsecops, compliance, pipeline-deploy), 2 revisores y el compositor adaptativo.',
  hC7t:'📡 Sensores', hC7:'Validan automáticamente secciones obligatorias y cobertura upstream. Pueden pasar o fallar — el agente corrige antes de seguir.',
  hC8t:'🗺️ Pestaña Workflow', hC8:'La pestaña <strong>Workflow</strong> muestra cuáles de las 33 stages corren para el scope activo (EXECUTE resaltadas, SKIP atenuadas), con las stages completadas marcadas desde el estado real.',
  hScopes:'Scopes Disponibles', hScopesNote:'Conteo de stages (EXECUTE) y gates de aprobación por scope. Los scopes compuestos aparecen aquí cuando el proyecto tiene un scope-grid.json.', hCommands:'Comandos Útiles',
  hCmd1:'Verifica la salud del setup', hCmd2:'Inicia un workflow', hCmd3:'Muestra el estado actual', hCmd4:'Salta a un stage', hCmd5:'Compone un plan adaptativo'
});

;

// PART 13: Stage descriptions - English
const STAGE_DESC_EN = {
  'workspace-scaffold':'Creates the AIDLC folder structure in the workspace',
  'workspace-detection':'Detects the project\'s languages, frameworks and build system',
  'state-init':'Initializes the state file and configures the scope',
  'intent-capture':'Captures the user\'s intent and defines the goal',
  'market-research':'Researches the market and similar solutions',
  'feasibility':'Assesses technical and business feasibility',
  'scope-definition':'Defines scope, boundaries and exclusions',
  'team-formation':'Defines team composition and roles',
  'rough-mockups':'Creates initial low-fidelity mockups',
  'approval-handoff':'Approval gate to proceed to Inception',
  'reverse-engineering':'Analyzes existing code and documents the current architecture',
  'practices-discovery':'Discovers team practices and affirms working rules',
  'requirements-analysis':'Analyzes functional and non-functional requirements',
  'user-stories':'Writes user stories with BDD acceptance criteria',
  'refined-mockups':'Refines mockups based on requirements',
  'domain-design':'Domain design, components and ADRs',
  'units-generation':'Generates work units (Bolts) for construction',
  'contract-design':'Defines contracts/interfaces between units',
  'delivery-planning':'Plans the Bolt delivery sequence',
  'functional-design':'Detailed functional design per unit',
  'nfr-requirements':'Detailed non-functional requirements',
  'nfr-design':'Design to meet non-functional requirements',
  'infrastructure-design':'Infrastructure design (IaC)',
  'code-generation':'Code generation for the unit',
  'build-and-test':'Build, tests and validation',
  'ci-pipeline':'Sets up the continuous integration pipeline',
  'deployment-pipeline':'Sets up the deployment pipeline',
  'environment-provisioning':'Provisions environments (staging/prod)',
  'deployment-execution':'Executes deployment to environments',
  'observability-setup':'Sets up monitoring and alerts',
  'incident-response':'Defines runbooks and incident plan',
  'performance-validation':'Validates performance in production',
  'feedback-optimization':'Collects feedback and optimizes'
};

;

// PART 14: Stage descriptions - Español
const STAGE_DESC_ES = {
  'workspace-scaffold':'Crea la estructura de carpetas de AIDLC en el workspace',
  'workspace-detection':'Detecta lenguajes, frameworks y build system del proyecto',
  'state-init':'Inicializa el archivo de estado y configura el scope',
  'intent-capture':'Captura la intención del usuario y define el objetivo',
  'market-research':'Investiga el mercado y soluciones similares',
  'feasibility':'Evalúa viabilidad técnica y de negocio',
  'scope-definition':'Define scope, límites y exclusiones',
  'team-formation':'Define composición y roles del equipo',
  'rough-mockups':'Crea mockups iniciales de baja fidelidad',
  'approval-handoff':'Gate de aprobación para pasar a Concepción',
  'reverse-engineering':'Analiza el código existente y documenta la arquitectura actual',
  'practices-discovery':'Descubre prácticas del equipo y afirma reglas de trabajo',
  'requirements-analysis':'Analiza requisitos funcionales y no funcionales',
  'user-stories':'Escribe user stories con criterios de aceptación BDD',
  'refined-mockups':'Refina mockups según los requisitos',
  'domain-design':'Diseño de dominio, componentes y ADRs',
  'units-generation':'Genera unidades de trabajo (Bolts) para construcción',
  'contract-design':'Define contratos/interfaces entre unidades',
  'delivery-planning':'Planifica la secuencia de entrega de los Bolts',
  'functional-design':'Diseño funcional detallado por unidad',
  'nfr-requirements':'Requisitos no funcionales detallados',
  'nfr-design':'Diseño para cumplir requisitos no funcionales',
  'infrastructure-design':'Diseño de infraestructura (IaC)',
  'code-generation':'Generación de código de la unidad',
  'build-and-test':'Build, pruebas y validación',
  'ci-pipeline':'Configura el pipeline de integración continua',
  'deployment-pipeline':'Configura el pipeline de deployment',
  'environment-provisioning':'Aprovisiona ambientes (staging/prod)',
  'deployment-execution':'Ejecuta el deploy en los ambientes',
  'observability-setup':'Configura monitoreo y alertas',
  'incident-response':'Define runbooks y plan de incidentes',
  'performance-validation':'Valida performance en producción',
  'feedback-optimization':'Recoge feedback y optimiza'
};

;

// PART 21: Workflow-shape graph — mostra o formato do workflow do scope
// que está rodando (não fixo). Fonte: matriz stage-by-scope do AI-DLC 2.0 GA
// (docs/guide/05-scopes-and-depth.md). 5 colunas × 33 stages.
//
// O grafo default reflete o scope do intent selecionado (state.scope) e marca
// como concluídas as stages com checkbox [x] no aidlc-state.md. Chips permitem
// explorar "e se fosse outro scope" sem alterar o estado real.

// Colunas canônicas — reutiliza PHASES (fonte única) para os slugs, e um mapa
// de rótulos curtos legíveis para os cards do grafo.
const WF_STAGE_LABEL = {
  'workspace-scaffold':'Workspace Scaffold', 'workspace-detection':'Workspace Detection', 'state-init':'State Init',
  'intent-capture':'Intent Capture', 'market-research':'Market Research', 'feasibility':'Feasibility',
  'scope-definition':'Scope Definition', 'team-formation':'Team Formation', 'rough-mockups':'Rough Mockups',
  'approval-handoff':'Approval & Handoff',
  'reverse-engineering':'Reverse Engineering', 'practices-discovery':'Practices Discovery',
  'requirements-analysis':'Requirements Analysis', 'user-stories':'User Stories', 'refined-mockups':'Refined Mockups',
  'domain-design':'Domain Design', 'units-generation':'Units Generation', 'contract-design':'Contract Design',
  'delivery-planning':'Delivery Planning',
  'functional-design':'Functional Design', 'nfr-requirements':'NFR Requirements', 'nfr-design':'NFR Design',
  'infrastructure-design':'Infrastructure Design', 'code-generation':'Code Generation',
  'build-and-test':'Build and Test', 'ci-pipeline':'CI Pipeline',
  'deployment-pipeline':'Deployment Pipeline', 'environment-provisioning':'Env Provisioning',
  'deployment-execution':'Deployment Exec', 'observability-setup':'Observability Setup',
  'incident-response':'Incident Response', 'performance-validation':'Performance Validation',
  'feedback-optimization':'Feedback & Optim'
};
const WF_COL_TITLE = { initialization:'0 · Init', ideation:'1 · Ideation', inception:'2 · Inception', construction:'3 · Construction', operation:'4 · Operation' };

function wfCols() {
  return PHASES.map(p => ({ key: p.id, title: WF_COL_TITLE[p.id] || p.id, stages: p.stages }));
}

// Descrição one-line de cada scope (o que ele roda). N EXECUTE derivado do grid.
const SCOPE_META = {
  enterprise:      { desc:'Rigor máximo: toda stage, todo gate, trilha de auditoria completa' },
  feature:         { desc:'O padrão full-lifecycle: todas as 33 stages', tag:'(everything)' },
  mvp:             { desc:'Entrega o core greenfield: pula a fase de operação' },
  poc:             { desc:'Prova uma ideia rápido: intent, depois direto pra código e teste' },
  bugfix:          { desc:'Corrige e faz deploy de um defeito específico' },
  refactor:        { desc:'Reestrutura código existente sem mudar comportamento' },
  infra:           { desc:'Mudança de infra: arquitetura, IaC, provisioning e observability' },
  'security-patch':{ desc:'Resposta a CVE: caminho rápido pelas stages de segurança' },
  classic:         { desc:'Estilo v1: Inception + Construction (sem Ideation, CI Pipeline e Operation)' },
  workshop:        { desc:'Sessão facilitada/treinamento com o lifecycle completo pós-Ideation' },
  express:         { desc:'O caminho mais leve: requisitos → código → deploy condicional, sem design' }
};

// Matriz stage-by-scope oficial (✓ = EXECUTE). Ausente = SKIP.
// Base: docs/guide/05-scopes-and-depth.md (AI-DLC 2.0 GA, 33 stages).
const SCOPE_EXEC = {
  enterprise: 'ALL',
  feature: 'ALL',
  mvp: ['workspace-scaffold','workspace-detection','state-init','intent-capture','feasibility','scope-definition','rough-mockups','reverse-engineering','practices-discovery','requirements-analysis','user-stories','refined-mockups','domain-design','units-generation','contract-design','delivery-planning','functional-design','nfr-requirements','nfr-design','infrastructure-design','code-generation','build-and-test','ci-pipeline'],
  poc: ['workspace-scaffold','workspace-detection','state-init','intent-capture','reverse-engineering','requirements-analysis','code-generation','build-and-test'],
  bugfix: ['workspace-scaffold','workspace-detection','state-init','reverse-engineering','requirements-analysis','code-generation','build-and-test','deployment-pipeline','deployment-execution'],
  refactor: ['workspace-scaffold','workspace-detection','state-init','reverse-engineering','requirements-analysis','functional-design','code-generation','build-and-test','deployment-pipeline','deployment-execution'],
  infra: ['workspace-scaffold','workspace-detection','state-init','practices-discovery','requirements-analysis','nfr-requirements','nfr-design','infrastructure-design','ci-pipeline','deployment-pipeline','environment-provisioning','deployment-execution','observability-setup'],
  'security-patch': ['workspace-scaffold','workspace-detection','state-init','reverse-engineering','requirements-analysis','nfr-requirements','code-generation','build-and-test','deployment-pipeline','deployment-execution'],
  classic: ['workspace-scaffold','workspace-detection','state-init','reverse-engineering','practices-discovery','requirements-analysis','user-stories','refined-mockups','domain-design','units-generation','contract-design','delivery-planning','functional-design','nfr-requirements','nfr-design','infrastructure-design','code-generation','build-and-test'],
  workshop: ['workspace-scaffold','workspace-detection','state-init','reverse-engineering','practices-discovery','requirements-analysis','user-stories','refined-mockups','domain-design','units-generation','contract-design','delivery-planning','functional-design','nfr-requirements','nfr-design','infrastructure-design','code-generation','build-and-test','ci-pipeline','deployment-pipeline','environment-provisioning','deployment-execution','observability-setup','incident-response','performance-validation','feedback-optimization'],
  express: ['workspace-scaffold','workspace-detection','state-init','reverse-engineering','requirements-analysis','code-generation','build-and-test','deployment-pipeline','deployment-execution','observability-setup']
};

// Constrói o grid base { scope: { slug: 'EXECUTE'|'SKIP' } } a partir de SCOPE_EXEC.
const SCOPE_GRID_BASE = (() => {
  const allSlugs = PHASES.flatMap(p => p.stages);
  const grid = {};
  for (const [scope, spec] of Object.entries(SCOPE_EXEC)) {
    const exec = spec === 'ALL' ? new Set(allSlugs) : new Set(spec);
    grid[scope] = {};
    for (const slug of allSlugs) grid[scope][slug] = exec.has(slug) ? 'EXECUTE' : 'SKIP';
  }
  return grid;
})();

// Grid efetivo: base hardcoded + scopes compostos/custom lidos de scope-grid.json.
// A v2 escreve scopes compostos nesse arquivo; mesclá-lo deixa a aba fiel sem
// re-sincronizar o código a cada release. Normaliza o shape ({scope:{slug:...}}
// ou {scopes:{...}}) e só aceita valores EXECUTE/SKIP para as 33 stages conhecidas.
function buildScopeGrid() {
  const allSlugs = PHASES.flatMap(p => p.stages);
  const grid = {};
  for (const [s, g] of Object.entries(SCOPE_GRID_BASE)) grid[s] = { ...g };
  const ext = (typeof dashboardData !== 'undefined' && dashboardData && dashboardData.scopeGrid) || null;
  if (ext) {
    const table = ext.scopes && typeof ext.scopes === 'object' ? ext.scopes : ext;
    for (const [scope, membership] of Object.entries(table)) {
      if (!membership || typeof membership !== 'object') continue;
      const row = {};
      for (const slug of allSlugs) {
        const v = membership[slug];
        row[slug] = (v === 'EXECUTE' || v === true) ? 'EXECUTE' : 'SKIP';
      }
      grid[scope] = row; // externo tem prioridade (inclui scopes que não existem no base)
    }
  }
  // Scope composto/custom (/aidlc compose) sem entrada no grid: sintetiza a grade a
  // partir do estado do intent atual (state.stages traz action EXECUTE/SKIP por stage).
  // Assim o compose funciona mesmo sem scope-grid.json, e o clique nos chips o mantém.
  try {
    const intent = typeof currentIntent === 'function' ? currentIntent() : null;
    const st = intent && intent.state ? parseState(intent.state) : null;
    const rs = (st?.scope || '').trim().toLowerCase();
    if (rs && !grid[rs] && st?.stages && Object.keys(st.stages).length) {
      const row = {}; let known = 0;
      for (const slug of allSlugs) {
        const act = st.stages[slug]?.action;
        if (act) known++;
        row[slug] = act === 'EXECUTE' ? 'EXECUTE' : 'SKIP';
      }
      if (known >= 3) {
        grid[rs] = row;
        if (!SCOPE_META[rs]) SCOPE_META[rs] = { desc: t('wfComposedDesc') };
      }
    }
  } catch {}
  return grid;
}

// Compat: SCOPE_GRID continua existindo como o grid base (usado pelos testes e como
// fallback). O render usa buildScopeGrid() para incluir os scopes externos.
const SCOPE_GRID = SCOPE_GRID_BASE;

function scopeExecCount(scope, grid) {
  const g = (grid || SCOPE_GRID_BASE)[scope];
  if (!g) return 0;
  return Object.values(g).filter(v => v === 'EXECUTE').length;
}

// Gates de aprovação ≈ stages EXECUTE fora da Initialization (as 3 de Init rodam
// inline, sem gate). É a mesma contagem que a v2 mostra na confirmação do scope.
const WF_INLINE_NOGATE = new Set(['workspace-scaffold', 'workspace-detection', 'state-init']);
function scopeGateCount(scope, grid) {
  const g = (grid || SCOPE_GRID_BASE)[scope];
  if (!g) return 0;
  return Object.entries(g).filter(([slug, v]) => v === 'EXECUTE' && !WF_INLINE_NOGATE.has(slug)).length;
}

// Arestas de sequência (dependências entre stages) — usadas pra desenhar o fluxo.
const WF_EDGES = [
  ['workspace-scaffold','workspace-detection'],['workspace-detection','state-init'],
  ['intent-capture','market-research'],['intent-capture','feasibility'],['market-research','feasibility'],
  ['intent-capture','scope-definition'],['feasibility','scope-definition'],
  ['scope-definition','team-formation'],['scope-definition','rough-mockups'],['team-formation','rough-mockups'],
  ['scope-definition','approval-handoff'],['team-formation','approval-handoff'],['rough-mockups','approval-handoff'],
  ['state-init','reverse-engineering'],['state-init','practices-discovery'],['reverse-engineering','practices-discovery'],
  ['approval-handoff','requirements-analysis'],['reverse-engineering','requirements-analysis'],['practices-discovery','requirements-analysis'],
  ['requirements-analysis','user-stories'],['user-stories','refined-mockups'],
  ['requirements-analysis','domain-design'],['refined-mockups','domain-design'],
  ['domain-design','units-generation'],['units-generation','contract-design'],['contract-design','delivery-planning'],['units-generation','delivery-planning'],
  ['units-generation','functional-design'],['units-generation','nfr-requirements'],['functional-design','nfr-requirements'],
  ['nfr-requirements','nfr-design'],['nfr-design','infrastructure-design'],
  ['functional-design','code-generation'],['nfr-design','code-generation'],['infrastructure-design','code-generation'],
  ['code-generation','build-and-test'],['build-and-test','ci-pipeline'],
  ['ci-pipeline','deployment-pipeline'],['infrastructure-design','deployment-pipeline'],
  ['deployment-pipeline','environment-provisioning'],['deployment-pipeline','deployment-execution'],['environment-provisioning','deployment-execution'],
  ['deployment-execution','observability-setup'],['observability-setup','incident-response'],
  ['observability-setup','performance-validation'],['observability-setup','feedback-optimization'],
  ['deployment-execution','feedback-optimization'],['incident-response','feedback-optimization'],['performance-validation','feedback-optimization']
];

// scope escolhido na aba (por intent). Default = scope real do estado.
let wfScope = null;
let wfScopeIntent = null; // dirName do intent cujo wfScope está setado (persiste entre refreshes)

function renderWorkflowTab(state) {
  const cols = wfCols();
  const grid = buildScopeGrid();
  const realScope = (state.scope || '').trim().toLowerCase();
  const intentKey = (typeof selectedIntentDir !== 'undefined' && selectedIntentDir) || (typeof currentIntent === 'function' && currentIntent()?.dirName) || '__single';
  // Reseta o scope escolhido só quando muda de intent — assim o auto-refresh não
  // tira o usuário do scope que ele estava explorando (#9).
  if (wfScope === null || !grid[wfScope] || wfScopeIntent !== intentKey) {
    wfScope = grid[realScope] ? realScope : 'feature';
    wfScopeIntent = intentKey;
  }
  const active = wfScope;
  const activeGrid = grid[active] || grid.feature;
  const isReal = active === realScope;

  const stageStatus = slug => state.stages?.[slug]?.status || null;

  // chips ordenados por nº de stages (inclui scopes externos/compostos)
  const order = Object.keys(grid).sort((a, b) => scopeExecCount(a, grid) - scopeExecCount(b, grid));
  const chips = order.map(scope => {
    const n = scopeExecCount(scope, grid);
    const g = scopeGateCount(scope, grid);
    const tag = SCOPE_META[scope]?.tag ? `<span class="wf-chip-tag">${SCOPE_META[scope].tag}</span>` : (SCOPE_GRID_BASE[scope] ? '' : `<span class="wf-chip-tag">${t('wfComposed')}</span>`);
    const realMark = scope === realScope ? ` <span class="wf-chip-real" title="${t('wfRealScope')}">●</span>` : '';
    return `<button class="wf-chip ${scope === active ? 'active' : ''}" onclick="setWfScope('${esc(scope)}')" title="${g} ${t('wfGates')}">${esc(scope)}<span class="wf-chip-n">${n}</span>${tag}${realMark}</button>`;
  }).join('');

  // Gate de verificação entre fases (a v2 roda um em cada fronteira, exceto Init→Ideation)
  const VG_AFTER = { ideation: 1, inception: 2, construction: 3 };
  const board = cols.map((col, colIdx) => {
    const cards = col.stages.map((slug, si) => {
      const exec = activeGrid[slug] === 'EXECUTE';
      const st = exec ? stageStatus(slug) : null;
      let cls = exec ? 'exec ' + col.key : 'skip';
      if (isReal && exec && st === 'done') cls += ' done';
      else if (isReal && exec && st === 'active') cls += ' current';
      return `<div class="wf-card ${cls}" data-slug="${esc(slug)}" title="${esc(stageDesc(slug))}">
        <div class="wf-num">${colIdx}.${si + 1}</div>
        <div class="wf-name">${esc(WF_STAGE_LABEL[slug] || slug)}</div>
      </div>`;
    }).join('');
    // marcador de verification gate no rodapé da coluna que fecha uma fronteira
    const vg = VG_AFTER[col.key]
      ? `<div class="wf-vgate" title="${t('wfVGateTip')}">◈ ${tf('wfVGate', { n: VG_AFTER[col.key] })}</div>`
      : '';
    return `<div class="wf-col"><div class="wf-col-title">${esc(col.title)}</div>${cards}${vg}</div>`;
  }).join('');

  const n = scopeExecCount(active, grid);
  const gates = scopeGateCount(active, grid);
  const meta = SCOPE_META[active] || {};
  const composedNote = SCOPE_GRID_BASE[active] ? '' : ` <span class="wf-hint">(${t('wfComposed')})</span>`;
  const realLine = isReal
    ? `<strong>${t('wfIsReal')}</strong> `
    : `<span class="wf-hint">${tf('wfNotReal', { real: esc(realScope || '—') })}</span> `;
  const srcLine = (typeof dashboardData !== 'undefined' && dashboardData && dashboardData.scopeGridSource)
    ? `<div class="wf-src">${tf('wfGridSrc', { src: esc(dashboardData.scopeGridSource) })}</div>` : '';

  const gridHtml = `
    <div class="wf-head">
      <h3 class="wf-title">${t('wfTitle')}</h3>
      <p class="wf-sub">${t('wfSub')}</p>
    </div>
    <div class="wf-chips">${chips}</div>
    <div class="wf-board-wrap" id="wf-board-wrap">
      <svg class="wf-edges" id="wf-edges" aria-hidden="true"></svg>
      <div class="wf-board" id="wf-board">${board}</div>
    </div>
    <div class="wf-caption">
      ${realLine}<b>${esc(active)}</b>${composedNote} · ${esc(meta.desc || '')}. <b>${n} ${t('wfOf')} 33</b> ${t('wfStagesRun')} · <b>${gates}</b> ${t('wfGates')}.
      ${srcLine}
    </div>
    <div class="wf-legend">
      <span><span class="wf-swatch exec"></span>${t('wfLegExec')}</span>
      <span><span class="wf-swatch skip"></span>${t('wfLegSkip')}</span>
      <span><span class="wf-swatch done"></span>${t('wfLegDone')}</span>
      <span><span class="wf-swatch current"></span>${t('wfLegCurrent')}</span>
      <span>◈ ${t('wfVGateLeg')}</span>
    </div>
  `;

  // Painel Units & Bolts (23-units-bolts.js). Gatilho = existem units, não a fase:
  // preview/history ficam acima da grade; durante Construction a grade recolhe.
  const intent = typeof currentIntent === 'function' ? currentIntent() : null;
  let ubModel = null, ubHtml = '';
  if (intent && typeof buildUnitsModel === 'function') {
    try { ubModel = buildUnitsModel(intent, state); ubHtml = renderUnitsPanel(intent, state, ubModel); }
    catch (e) { console.warn('painel units/bolts:', e); ubModel = null; ubHtml = ''; }
  }
  if (ubModel && ubModel.mode === 'full') {
    return `${ubHtml}
      <details class="ub-grid-toggle"${ubGridOpen ? ' open' : ''} ontoggle="toggleUbGrid(this)">
        <summary>${t('ubShowGrid')}</summary>${gridHtml}
      </details>`;
  }
  return ubHtml + gridHtml;
}

function setWfScope(scope) {
  const grid = buildScopeGrid();
  if (!grid[scope]) return;
  wfScope = scope;
  const el = document.getElementById('tab-workflow');
  if (el && typeof dashboardData !== 'undefined' && dashboardData) {
    const intent = currentIntent();
    const state = intent ? parseState(intent.state) : {};
    el.innerHTML = safeRender(renderWorkflowTab, state);
    requestAnimationFrame(drawWfEdges);
  }
}

const WF_SVGNS = 'http://www.w3.org/2000/svg';
function drawWfEdges() {
  const wrapEl = document.getElementById('wf-board-wrap');
  const svg = document.getElementById('wf-edges');
  const boardEl = document.getElementById('wf-board');
  if (!wrapEl || !svg || !boardEl) return;
  const active = wfScope && buildScopeGrid()[wfScope] ? wfScope : 'feature';
  const grid = buildScopeGrid()[active];
  const wr = wrapEl.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${wr.width} ${wr.height}`);
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const boxOf = slug => boardEl.querySelector(`.wf-card[data-slug="${slug}"]`);
  WF_EDGES.forEach(([from, to]) => {
    const a = boxOf(from), b = boxOf(to);
    if (!a || !b) return;
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    let x1, y1, x2, y2;
    if (rb.left > ra.left + 4) {
      x1 = ra.right - wr.left; y1 = ra.top + ra.height / 2 - wr.top;
      x2 = rb.left - wr.left;  y2 = rb.top + rb.height / 2 - wr.top;
    } else {
      x1 = ra.left + ra.width / 2 - wr.left; y1 = ra.bottom - wr.top;
      x2 = rb.left + rb.width / 2 - wr.left; y2 = rb.top - wr.top;
    }
    const dx = (x2 - x1) * 0.5;
    const d = Math.abs(x2 - x1) > 8
      ? `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`
      : `M${x1},${y1} C${x1},${y1 + 18} ${x2},${y2 - 18} ${x2},${y2}`;
    const p = document.createElementNS(WF_SVGNS, 'path');
    p.setAttribute('d', d);
    if (grid[from] === 'EXECUTE' && grid[to] === 'EXECUTE') p.setAttribute('class', 'live');
    svg.appendChild(p);
  });
}
if (typeof window !== 'undefined' && window.addEventListener) {
  window.addEventListener('resize', () => requestAnimationFrame(drawWfEdges));
}

;

// PART 22: File browser (aba Arquivos) — navega a pasta aidlc/ do intent e lê
// artefatos .md/.json. Markdown vira HTML por um mini-parser próprio (seguro, via
// esc()); blocos ```mermaid são renderizados pela lib mermaid (CDN no HTML
// single-file; empacotada em media/ na extensão).

let fbTree = null;          // árvore carregada (cache por render da aba)
let fbSelectedPath = null;  // arquivo aberto no leitor
let fbContentCache = {};    // path -> conteúdo lido (evita reler ao re-renderizar)
let fbLoading = false;
let fbMermaidSeq = 0;       // ids únicos por diagrama

// ---- Mini Markdown -> HTML (seguro) ----
// Escapa TUDO com esc() primeiro; só então reintroduz a marcação reconhecida.
// Blocos de código e mermaid são extraídos antes (placeholders) pra não terem
// a marcação inline aplicada dentro deles.
function mdInline(s) {
  // s já vem escapado. Aplica bold, italic, code inline e links seguros.
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');
  // links [txt](url) — só http(s), mailto, relativo/âncora; resto vira texto
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, url) => {
    const u = url.trim();
    const safe = /^(https?:\/\/|mailto:|#|\/|\.\/|\.\.\/)/i.test(u);
    return safe ? `<a href="${u}" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">${txt}</a>` : esc(`[${txt}](${url})`);
  });
  return s;
}

function renderMarkdown(md) {
  const raw = String(md || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = [];
  // 1) extrai fences ```lang ... ``` como placeholders (mermaid vira <div class=mermaid>)
  let text = raw.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, body) => {
    const idx = blocks.length;
    if ((lang || '').toLowerCase() === 'mermaid') {
      const id = 'fb-mmd-' + (fbMermaidSeq++);
      blocks.push(`<div class="fb-mermaid mermaid" id="${id}">${esc(body.trim())}</div>`);
    } else {
      blocks.push(`<pre class="fb-code"><code>${esc(body)}</code></pre>`);
    }
    return `\u0000BLOCK${idx}\u0000`;
  });
  // 2) escapa o resto
  text = esc(text);
  // 3) parse linha a linha (headings, listas, tabelas simples, hr, parágrafos)
  const lines = text.split('\n');
  let html = '', inUl = false, inOl = false, para = [];
  const flushPara = () => { if (para.length) { html += `<p>${mdInline(para.join(' '))}</p>`; para = []; } };
  const flushLists = () => { if (inUl) { html += '</ul>'; inUl = false; } if (inOl) { html += '</ol>'; inOl = false; } };
  for (const ln of lines) {
    const line = ln.replace(/\s+$/, '');
    const ph = line.match(/^\u0000BLOCK(\d+)\u0000$/);
    if (ph) { flushPara(); flushLists(); html += blocks[+ph[1]]; continue; }
    if (!line.trim()) { flushPara(); flushLists(); continue; }
    let m;
    if ((m = line.match(/^(#{1,6})\s+(.*)$/))) { flushPara(); flushLists(); const lv = m[1].length; html += `<h${lv} class="fb-h">${mdInline(m[2])}</h${lv}>`; continue; }
    if (/^(---|\*\*\*|___)\s*$/.test(line)) { flushPara(); flushLists(); html += '<hr class="fb-hr">'; continue; }
    if ((m = line.match(/^\s*[-*+]\s+(.*)$/))) { flushPara(); if (inOl) { html += '</ol>'; inOl = false; } if (!inUl) { html += '<ul class="fb-ul">'; inUl = true; } html += `<li>${mdInline(m[1])}</li>`; continue; }
    if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) { flushPara(); if (inUl) { html += '</ul>'; inUl = false; } if (!inOl) { html += '<ol class="fb-ol">'; inOl = true; } html += `<li>${mdInline(m[1])}</li>`; continue; }
    para.push(line.trim());
  }
  flushPara(); flushLists();
  return html;
}

function renderJsonPretty(txt) {
  let obj;
  try { obj = JSON.parse(txt); } catch { return `<pre class="fb-code"><code>${esc(txt)}</code></pre>`; }
  return `<pre class="fb-code"><code>${esc(JSON.stringify(obj, null, 2))}</code></pre>`;
}

function renderFileContent(path, txt) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.json')) return renderJsonPretty(txt);
  if (lower.endsWith('.md')) return `<div class="fb-md">${renderMarkdown(txt)}</div>`;
  return `<pre class="fb-code"><code>${esc(txt)}</code></pre>`;
}

// ---- Árvore ----
function renderTreeNodes(nodes) {
  let html = '<ul class="fb-tree">';
  for (const n of nodes) {
    if (n.kind === 'dir') {
      html += `<li class="fb-dir"><details open><summary>📁 ${esc(n.name)}</summary>${renderTreeNodes(n.children || [])}</details></li>`;
    } else {
      const sel = n.path === fbSelectedPath ? ' selected' : '';
      const icon = n.name.toLowerCase().endsWith('.json') ? '{ }' : n.name.toLowerCase().endsWith('.md') ? '📄' : '📃';
      html += `<li class="fb-file${sel}" onclick="openAidlcFile('${esc(n.path)}')" title="${esc(n.path)}">${icon} ${esc(n.name)}</li>`;
    }
  }
  return html + '</ul>';
}

function renderFilesTab() {
  if (fbLoading) return `<div class="empty-state">${t('loading')}</div>`;
  if (!fbTree) {
    // dispara o carregamento lazy e mostra placeholder; loadFileTree re-renderiza
    loadFileTree();
    return `<div class="empty-state">${t('loading')}</div>`;
  }
  if (!fbTree.length) return `<div class="empty-state">${t('fbEmpty')}</div>`;
  const viewer = fbSelectedPath && fbContentCache[fbSelectedPath] != null
    ? `<div class="fb-viewer-head">${esc(fbSelectedPath)}</div><div class="fb-viewer-body">${safeRenderFile(fbSelectedPath)}</div>`
    : `<div class="fb-viewer-empty">${t('fbPick')}</div>`;
  return `
    <div class="fb-layout">
      <div class="fb-sidebar">${renderTreeNodes(fbTree)}</div>
      <div class="fb-viewer">${viewer}</div>
    </div>`;
}

function safeRenderFile(path) {
  try { return renderFileContent(path, fbContentCache[path]); }
  catch (e) { return `<div class="empty-state">⚠️ ${esc(e.message)}</div>`; }
}

// Renderiza os diagramas mermaid presentes no leitor (chamado após pintar o HTML).
function runMermaid() {
  try {
    if (typeof mermaid === 'undefined') return;
    if (!runMermaid._init) {
      mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' });
      runMermaid._init = true;
    }
    const nodes = document.querySelectorAll('.fb-mermaid:not([data-processed])');
    if (nodes.length) mermaid.run({ nodes }).catch(() => {});
  } catch {}
}

;

// PART 23: Units & Bolts — dimensão de execução da Construction.
// Fontes (todas opcionais; nada aqui pode derrubar a aba Workflow):
//   inception/units-generation/unit-of-work-dependency.md → DAG (bloco ```yaml units:)
//   inception/units-generation/unit-of-work.md            → descrição por unit
//   inception/delivery-planning/bolt-plan.md              → sequência de Bolts
//   aidlc-state.md  (### CONSTRUCTION PHASE / "Per unit: X") → progresso por unit
//   audit/*.md      (BOLT_STARTED / BOLT_COMPLETED / BOLT_FAILED) → estado runtime
//
// Gatilho em 3 estados (não amarrado à fase): existem units?
//   none    → sem units (ex.: intent classic sem decomposição) — grade normal
//   preview → units geradas, Construction ainda não começou — card compacto + grade
//   full    → Construction ativa — painel cheio; grade recolhida
//   history → Construction encerrada — resumo read-only + grade

// Stages que rodam POR UNIT (3.1→3.5). build-and-test e ci-pipeline rodam uma vez no fim.
const UB_UNIT_STAGES = ['functional-design', 'nfr-requirements', 'nfr-design', 'infrastructure-design', 'code-generation'];
let ubGridOpen = false; // grade recolhida no modo full — sobrevive ao auto-refresh

function ubSlug(s) {
  return String(s || '').toLowerCase().replace(/[`*_]/g, '').trim().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '');
}
function ubCk(ch) {
  return ch === 'x' ? 'done' : ch === '-' ? 'active' : ch === '?' ? 'awaiting' : ch === 'R' ? 'revising' : ch === 'S' ? 'skipped' : 'pending';
}
function ubRx(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// DAG: bloco yaml obrigatório da stage 2.7 (fonte que o runtime usa pro fan-out).
function parseUnitsDag(md) {
  if (!md) return [];
  const blocks = [...md.matchAll(/```ya?ml[^\n]*\n([\s\S]*?)```/g)].map(m => m[1]);
  const block = blocks.find(b => /^\s*units\s*:/m.test(b));
  if (!block) return [];
  const units = [];
  let cur = null, inDeps = false;
  const unq = s => s.trim().replace(/^["']|["']$/g, '');
  for (const raw of block.split('\n')) {
    const line = raw.replace(/\s+#.*$/, '');
    let m;
    if ((m = line.match(/^\s*-\s*name\s*:\s*(.+?)\s*$/))) {
      cur = { name: unq(m[1]), kind: '', deps: [] }; units.push(cur); inDeps = false; continue;
    }
    if (!cur) continue;
    if ((m = line.match(/^\s*kind\s*:\s*(.+?)\s*$/))) { cur.kind = unq(m[1]); inDeps = false; continue; }
    if ((m = line.match(/^\s*depends_on\s*:\s*\[(.*)\]\s*$/))) {
      cur.deps = m[1].split(',').map(unq).filter(Boolean); inDeps = false; continue;
    }
    if (/^\s*depends_on\s*:\s*$/.test(line)) { inDeps = true; continue; }
    if (inDeps && (m = line.match(/^\s*-\s*(.+?)\s*$/))) { cur.deps.push(unq(m[1])); continue; }
    if (/\S/.test(line)) inDeps = false;
  }
  return units.filter(u => u.name);
}

// unit-of-work.md: seções "## Unit: <nome>" (formato dos fixtures oficiais) + tabela U{n}/diretório.
function parseUnitOfWork(md) {
  if (!md) return [];
  const out = [];
  const heads = [...md.matchAll(/^#{2,4}\s+(?:Unit\s*(U\d+)?\s*[:—–-]\s*|(U\d+)\s*[:—–-]\s*)(.+?)\s*$/gm)];
  heads.forEach((h, i) => {
    const body = md.slice(h.index + h[0].length, i + 1 < heads.length ? heads[i + 1].index : md.length);
    const descM = body.match(/###\s*Description\s*\n+([^\n#|][^\n]*)/i) || body.match(/\n\s*([^\s#|\-*>][^\n]{10,})/);
    out.push({ name: h[3].replace(/[`*]/g, '').trim(), id: h[1] || h[2] || '', desc: descM ? descM[1].trim() : '' });
  });
  // tabela "| U1 | u1-desc | ..." → id por diretório
  for (const r of md.matchAll(/^\|\s*`?(U\d+)`?\s*\|\s*`?(u\d+-[\w.-]+)`?\s*\|/gm)) {
    const dirName = r[2].replace(/^u\d+-/, '');
    const hit = out.find(u => ubSlug(u.name) === ubSlug(dirName));
    if (hit) hit.id = hit.id || r[1];
    else out.push({ name: dirName, id: r[1], desc: '' });
  }
  return out;
}

// bolt-plan.md: "## Bolt 1 — título" (ou tabela "| Bolt 1 | ... |"). Units casadas por nome.
function parseBoltPlan(md, unitNames) {
  if (!md) return [];
  const names = unitNames || [];
  const unitsIn = text => names.filter(n =>
    new RegExp('(^|[^a-z0-9-])' + ubRx(n) + '([^a-z0-9-]|$)', 'i').test(text));
  const walkRx = /walking[\s-]*skeleton\**\s*[:|]\s*\**\s*(yes|true|sim|s[ií]|✓|✅)/i;
  const bolts = [];
  const heads = [...md.matchAll(/^#{2,4}\s+.*?\bBolt\s*#?\s*(\d+)\b(.*)$/gim)];
  heads.forEach((h, i) => {
    const body = md.slice(h.index + h[0].length, i + 1 < heads.length ? heads[i + 1].index : md.length);
    const title = h[2].replace(/^[\s:—–\-.)]+/, '').replace(/[*`]/g, '').trim();
    bolts.push({
      n: parseInt(h[1], 10), title,
      units: unitsIn(body + ' ' + h[0]),
      walking: /walking[\s-]*skeleton/i.test(h[0]) || walkRx.test(body),
    });
  });
  if (!bolts.length) {
    for (const r of md.matchAll(/^\|\s*\**\s*(?:Bolt\s*)?#?\s*(\d+)\s*\**\s*\|(.*)$/gim)) {
      bolts.push({ n: parseInt(r[1], 10), title: '', units: unitsIn(r[2]), walking: /walking[\s-]*skeleton/i.test(r[2]) });
    }
  }
  const seen = new Set();
  return bolts.filter(b => !seen.has(b.n) && seen.add(b.n)).sort((a, b) => a.n - b.n);
}

// Blocos "Per unit: X" na seção de Construction do aidlc-state.md.
function parseStatePerUnit(stateMd) {
  const res = {};
  if (!stateMd) return res;
  const sec = stateMd.match(/###\s*CONSTRUCTION PHASE[^\n]*\n([\s\S]*?)(?=\n###?\s|$)/i);
  if (!sec) return res;
  let cur = [];
  for (const line of sec[1].split('\n')) {
    const pu = line.match(/^\s*Per unit:\s*(.+?)\s*$/i);
    if (pu) {
      cur = /^\[?\s*TBD\s*\]?$/i.test(pu[1]) ? [] : pu[1].split(',').map(s => s.trim()).filter(Boolean);
      cur.forEach(n => { res[n] = res[n] || {}; });
      continue;
    }
    const ck = line.match(/- \[(.)\] (\S+) [—–-] (\w+)/);
    if (ck && cur.length) {
      const st = ck[3].toUpperCase() === 'SKIP' ? 'skipped' : ubCk(ck[1]);
      cur.forEach(n => { res[n][ck[2]] = st; });
    }
  }
  return res;
}

// Eventos de Bolt do audit → último estado por unit (cronológico).
function parseBoltEvents(audit) {
  const byUnit = {};
  const events = [];
  for (const f of audit || []) {
    for (const section of String(f.content || '').split('---')) {
      const fields = {};
      for (const m of section.matchAll(/\*\*([\w ]+)\*\*:\s*(.+)/g)) fields[m[1].trim().toLowerCase()] = m[2].trim();
      if (fields.timestamp && /^BOLT_(STARTED|COMPLETED|FAILED)$/.test(fields.event || '')) events.push(fields);
    }
  }
  events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const split = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
  for (const e of events) {
    let targets;
    if (e.event === 'BOLT_FAILED') targets = split(e['bolt slug'] || e['failed bolt']);
    else targets = e['bolt slug'] ? [e['bolt slug']] : split(e['bolt names']);
    const status = e.event === 'BOLT_STARTED' ? 'running' : e.event === 'BOLT_COMPLETED' ? 'done' : 'failed';
    for (const n of targets) {
      const prev = byUnit[n] || {};
      byUnit[n] = { status, batch: e['batch number'] || prev.batch || '', walking: e['walking skeleton'] === 'true' || prev.walking || false, error: e['error summary'] || '' };
    }
  }
  return byUnit;
}

function unitsPanelMode(state, units, intent) {
  if (!units.length) return 'none';
  const ph = state.phases || {};
  const cur = (state.currentPhase || '').toLowerCase();
  const c = (ph.construction || '').toLowerCase();
  const o = (ph.operation || '').toLowerCase();
  if (cur === 'operation' || ['verified', 'completed'].includes(c) || ['active', 'verified', 'completed'].includes(o)
    || (intent && intent.status === 'completed')) return 'history';
  const conStages = (PHASES.find(p => p.id === 'construction') || { stages: [] }).stages;
  if (cur === 'construction' || c === 'active' || conStages.some(s => ['active', 'done', 'awaiting', 'revising'].includes(state.stages?.[s]?.status))) return 'full';
  return 'preview';
}

// Modelo consolidado: units (DAG manda; unit-of-work e state completam) + bolts + contagens.
function buildUnitsModel(intent, state) {
  const dag = parseUnitsDag(intent.unitsDag);
  const uow = parseUnitOfWork(intent.unitsDoc);
  const perUnit = parseStatePerUnit(intent.state);
  const rt = parseBoltEvents(intent.audit);

  const units = [];
  const find = n => units.find(u => ubSlug(u.name) === ubSlug(n));
  dag.forEach(d => units.push({ name: d.name, kind: d.kind, deps: d.deps, id: '', desc: '' }));
  uow.forEach(w => {
    const hit = find(w.name);
    if (hit) { hit.id = hit.id || w.id; hit.desc = hit.desc || w.desc; }
    else if (!dag.length) units.push({ name: w.name, kind: '', deps: [], id: w.id, desc: w.desc });
  });
  Object.keys(perUnit).forEach(n => { if (!find(n)) units.push({ name: n, kind: '', deps: [], id: '', desc: '' }); });

  const mode = unitsPanelMode(state, units, intent);
  const closed = mode === 'history';
  const activeStage = state.currentStage || '';

  units.forEach(u => {
    const st = perUnit[u.name] || perUnit[Object.keys(perUnit).find(k => ubSlug(k) === ubSlug(u.name))] || {};
    const r = rt[u.name] || rt[Object.keys(rt).find(k => ubSlug(k) === ubSlug(u.name))] || null;
    let pills = UB_UNIT_STAGES.map(s => st[s] || 'pending');
    const listed = Object.keys(st).length > 0;
    let status;
    if (r && r.status === 'failed') status = 'failed';
    else if ((r && r.status === 'done') || (listed && pills.every(p => p === 'done' || p === 'skipped')) || closed) status = 'done';
    else if ((r && r.status === 'running') || pills.some(p => p !== 'pending' && p !== 'skipped')) status = 'running';
    else status = 'queued';
    if (status === 'done') pills = pills.map(p => (p === 'skipped' ? p : 'done'));
    u.status = status;
    u.pills = pills;
    u.batch = r ? r.batch : '';
    u.error = r ? r.error : '';
    u.current = status === 'running' ? (UB_UNIT_STAGES[pills.findIndex(p => p === 'active' || p === 'awaiting' || p === 'revising')] || (UB_UNIT_STAGES.includes(activeStage) ? activeStage : '')) : '';
  });

  const bolts = parseBoltPlan(intent.boltPlan, units.map(u => u.name));
  bolts.forEach(b => {
    const us = b.units.map(n => find(n)).filter(Boolean);
    if (!us.length) b.status = closed ? 'done' : 'queued';
    else if (us.some(u => u.status === 'failed')) b.status = 'failed';
    else if (us.every(u => u.status === 'done')) b.status = 'done';
    else if (us.some(u => u.status !== 'queued')) b.status = 'running';
    else b.status = 'queued';
    us.forEach(u => { if (!u.bolt) u.bolt = b.n; });
  });

  const count = (arr, s) => arr.filter(x => x.status === s).length;
  // Sem bolt-plan, a unidade de execução contada é a própria unit (runtime: 1 Bolt por unit)
  const track = bolts.length ? bolts : units;
  return {
    mode, units, bolts,
    unitsDone: count(units, 'done'),
    done: count(track, 'done'), running: count(track, 'running'),
    queued: count(track, 'queued'), failed: count(track, 'failed'),
    trackIsBolts: bolts.length > 0,
  };
}

// ---- Render ----
const UB_COLOR = { done: 'var(--green)', running: 'var(--yellow)', failed: 'var(--red)', queued: 'var(--border)', pending: 'var(--border)', skipped: 'var(--surface2)', active: 'var(--yellow)', awaiting: 'var(--blue)', revising: 'var(--purple)' };

function ubStat(value, label, color) {
  return `<div class="ub-stat"><div class="ub-stat-v"${color ? ` style="color:${color}"` : ''}>${value}</div><div class="ub-stat-l">${label}</div></div>`;
}
function ubSegBar(items) {
  if (!items.length) return '';
  return `<div class="ub-seg" role="img" aria-label="${esc(items.map(i => i.status).join(', '))}">${items.map(i =>
    `<span style="background:${UB_COLOR[i.status] || UB_COLOR.queued}" title="${esc((i.n ? 'Bolt ' + i.n : i.name) + ' · ' + t('ubSt_' + i.status))}"></span>`).join('')}</div>`;
}
function ubBadge(status, text) {
  return `<span class="ub-badge ub-${status}">${esc(text)}</span>`;
}
function ubStatusIcon(s) { return s === 'done' ? '✓' : s === 'running' ? '⏳' : s === 'failed' ? '✗' : '○'; }

function renderUnitCard(u, m) {
  const label = u.status === 'queued' ? t('ubSt_queued') : `${ubStatusIcon(u.status)} ${u.bolt ? 'bolt ' + u.bolt : t('ubSt_' + u.status)}`;
  const deps = u.deps.length ? `${t('ubDependsOn')}: ${u.deps.map(esc).join(', ')}` : t('ubNoDeps');
  const meta = [u.id, u.kind].filter(Boolean).map(esc).join(' · ');
  const pills = u.pills.map((p, i) =>
    `<span class="ub-pill" style="background:${UB_COLOR[p] || UB_COLOR.pending}" title="${esc((WF_STAGE_LABEL[UB_UNIT_STAGES[i]] || UB_UNIT_STAGES[i]) + ' · ' + t('ubSt_' + p))}"></span>`).join('');
  let foot = '';
  if (u.current) foot = `<div class="ub-unit-foot" style="color:var(--yellow)">● ${esc(WF_STAGE_LABEL[u.current] || u.current)}</div>`;
  else if (u.status === 'failed' && u.error) foot = `<div class="ub-unit-foot" style="color:var(--red)">✗ ${esc(u.error)}</div>`;
  return `<div class="ub-unit ub-unit-${u.status}" title="${esc(u.desc)}">
    <div class="ub-unit-head"><div class="ub-unit-name">${esc(u.name)}</div>${ubBadge(u.status, label)}</div>
    <div class="ub-unit-meta">${meta ? meta + ' · ' : ''}${deps}</div>
    <div class="ub-pills">${pills}</div>${foot}
  </div>`;
}

function renderBoltTrack(m) {
  if (!m.bolts.length) return '';
  const chips = m.bolts.map(b => `<div class="ub-bolt ub-bolt-${b.status}">
      <div class="ub-bolt-head"><b>Bolt ${b.n}</b>${b.walking ? ` <span class="ub-ws" title="${t('ubWalking')}">🦴</span>` : ''}<span class="ub-bolt-st">${ubStatusIcon(b.status)}</span></div>
      ${b.title ? `<div class="ub-bolt-title">${esc(b.title)}</div>` : ''}
      <div class="ub-bolt-units">${b.units.length ? b.units.map(esc).join(', ') : '—'}</div>
    </div>`).join('<span class="ub-bolt-arrow" aria-hidden="true">→</span>');
  return `<div class="ub-sec-title">${t('ubBoltTrack')}</div><div class="ub-track">${chips}</div>`;
}

function renderUnitsStats(m) {
  const boltsLbl = m.trackIsBolts ? t('ubBoltsPlanned') : t('ubBoltsNoPlan');
  return `<div class="ub-stats">
      ${ubStat(m.units.length, t('ubUnits'))}
      <div class="ub-sep"></div>
      ${ubStat(m.trackIsBolts ? m.bolts.length : '—', boltsLbl)}
      ${ubStat(m.done, t('ubDone'), 'var(--green)')}
      ${ubStat(m.running, t('ubRunning'), 'var(--yellow)')}
      ${ubStat(m.queued, t('ubQueued'), 'var(--text-muted)')}
      ${m.failed ? ubStat(m.failed, t('ubFailed'), 'var(--red)') : ''}
    </div>`;
}

function renderUnitsPanel(intent, state, model) {
  if (!intent) return '';
  const m = model || buildUnitsModel(intent, state);
  if (m.mode === 'none') return '';
  const track = m.trackIsBolts ? m.bolts : m.units;
  const src = `<div class="ub-src">${t('ubSource')} <code>unit-of-work-dependency.md</code> · <code>unit-of-work.md</code> · <code>bolt-plan.md</code> · <code>aidlc-state.md</code> · audit</div>`;

  if (m.mode === 'preview') {
    const boltLine = m.bolts.length
      ? m.bolts.map(b => `<span class="ub-mini"><b>Bolt ${b.n}</b>${b.walking ? ' 🦴' : ''} ${b.units.length ? '· ' + b.units.map(esc).join(', ') : ''}</span>`).join('')
      : m.units.map(u => `<span class="ub-mini">${esc(u.name)}</span>`).join('');
    return `<div class="card ub-card ub-preview" data-ub-mode="preview">
      <div class="ub-head"><div class="ub-title">📦 ${t('ubPlanTitle')}</div>
        <div class="ub-head-sum">${tf('ubPlanSum', { u: m.units.length, b: m.bolts.length || '—' })}</div></div>
      <div class="ub-minis">${boltLine}</div>
      <div class="ub-note">${t('ubPreviewNote')}</div>
    </div>`;
  }

  if (m.mode === 'history') {
    return `<div class="card ub-card ub-history" data-ub-mode="history">
      <div class="ub-head"><div class="ub-title">✅ ${t('ubHistTitle')}</div>
        <div class="ub-head-sum">${tf('ubHistSum', { d: m.unitsDone, u: m.units.length, b: m.bolts.length || '—' })}</div></div>
      ${ubSegBar(track)}
      <details class="ub-details"><summary>${t('ubShowUnits')}</summary>
        ${renderBoltTrack(m)}
        <div class="ub-grid">${m.units.map(u => renderUnitCard(u, m)).join('')}</div>
      </details>
    </div>`;
  }

  // full — Construction em andamento
  return `<div class="card ub-card ub-full" data-ub-mode="full">
    <div class="ub-head"><div class="ub-title">🔨 ${t('ubFullTitle')}</div>
      <div class="ub-head-sum">${esc(intent.slug || '')}</div></div>
    ${renderUnitsStats(m)}
    ${ubSegBar(track)}
    ${renderBoltTrack(m)}
    <div class="ub-sec-title">${t('ubUnitsGrid')}</div>
    <div class="ub-grid">${m.units.map(u => renderUnitCard(u, m)).join('')}</div>
    ${src}
  </div>`;
}

function toggleUbGrid(el) {
  ubGridOpen = !!(el && el.open);
  if (ubGridOpen && typeof drawWfEdges === 'function') requestAnimationFrame(drawWfEdges);
}
