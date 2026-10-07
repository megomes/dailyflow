(() => {
'use strict';
const C = CONTENT;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ── Ícones (Lucide) ── */
const IC = {
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  sunrise: '<path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  listChecks: '<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15"/><path d="M15 6v15"/>',
  panels: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
  branch: '<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.56-2.5 5.56-5.55C21.97 6.01 17.46 2 12 2z"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
  msg: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  menu: '<path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  tasks: '<rect x="3" y="5" width="6" height="6" rx="1"/><path d="m3 17 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>',
  history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  arrowR: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  coffee: '<path d="M10 2v2"/><path d="M14 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/><path d="M6 2v2"/>',
  move: '<path d="M12 2v20"/><path d="m15 19-3 3-3-3"/><path d="m19 9 3 3-3 3"/><path d="M2 12h20"/><path d="m5 9-3 3 3 3"/><path d="m9 5 3-3 3 3"/>',
  filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  cloudOff: '<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  signal: '<path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  command: '<path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  pointer: '<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>',
  dot: '<circle cx="12" cy="12" r="3"/>',
  watch: '<circle cx="12" cy="12" r="6"/><path d="M12 10v2l1 1"/><path d="m16.13 7.66-.81-4.05a2 2 0 0 0-2-1.61h-2.68a2 2 0 0 0-2 1.61l-.78 4.05"/><path d="m7.88 16.36.8 4a2 2 0 0 0 2 1.61h2.72a2 2 0 0 0 2-1.61l.81-4.05"/>',
};
const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${IC[n] || ''}</svg>`;

const ICON_SRC = (document.querySelector('link[rel="icon"]') || {}).href || '';
const WF = makeWireframes({ icon, esc, iconSrc: ICON_SRC });
function wfFigure(key, { notes = true, nav = null } = {}) {
  const w = WF[key]; if (!w) return '';
  WF.__setNav(nav);
  let html; try { html = w.r(); } finally { WF.__setNav(null); }
  return `<figure class="wfig ${w.kind}" data-wf="${key}"><div class="wf-scroll">${html}</div>${notes ? `<figcaption><div class="wfig-t">${icon(w.kind === 'phone' ? 'phone' : 'panels', 'sm')}<b>${esc(w.t)}</b><span class="tag">Interpretação</span></div><ol class="wf-notes">${w.notes.map((n, i) => `<li><b class="pin">${i + 1}</b><span>${esc(n)}</span></li>`).join('')}</ol></figcaption>` : ''}</figure>`;
}

/* ── Estado ── */
const LS = 'dailyflow-review-v1', LS_UI = 'dailyflow-review-ui-v1';
const lsGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const ui0 = lsGet(LS_UI) || {};
const S = {
  reviews: lsGet(LS) || {},
  route: 'etapas',
  q: '',
  f: Object.assign({ storySrc: 'all', flowSrc: 'all', flowWhen: 'all', capPhase: 'all', qTopic: 'all', exportAll: false }, ui0.f || {}),
  open: new Set(ui0.open || ['F-01']),
  wfSel: {},
  growSel: 'E2',
};
const saveUi = () => lsSet(LS_UI, { f: S.f, open: [...S.open], theme: ui0.theme });
const getR = id => S.reviews[id] || { status: '', comment: '' };
const isRev = id => { const r = S.reviews[id]; return !!(r && (r.status || (r.comment || '').trim())); };

/* ── Progresso do desenvolvimento (coleções progress/ e devlog/ no db do artifact; escrito pelo Claude) ── */
const PSTATES = [['rascunho', 'Rascunho', 'gray'], ['aprovada', 'Aprovada', 'purple'], ['dev', 'Em desenvolvimento', 'blue'], ['validacao', 'Em validação', 'orange'], ['concluida', 'Concluída', 'green'], ['cortada', 'Cortada', 'pink']];
const PST = Object.fromEntries(PSTATES.map(p => [p[0], p]));
const PROG = { stages: {}, log: [], live: false };
const stState = st => (PROG.stages[st.id] && PROG.stages[st.id].state) || st.state || 'rascunho';
const featDev = (st, key) => (PROG.stages[st.id] && PROG.stages[st.id].feats && PROG.stages[st.id].feats[key]) || 'todo';
const DEV = { todo: ['A fazer', 'gray'], doing: ['Fazendo', 'blue'], done: ['Feito', 'green'], cut: ['Cortado', 'pink'] };
const devTag = k => `<span class="tag ${DEV[k][1]} dev">${k === 'done' ? icon('check', 'sm') : ''}${DEV[k][0]}</span>`;
const stageDone = st => { const keys = [...(st.setup || []).map((_, i) => 'p' + (i + 1)), ...st.feats.map((_, i) => 'f' + (i + 1))]; return { done: keys.filter(k => featDev(st, k) === 'done').length, total: keys.length }; };
function onProgress() {
  renderNav(); refreshCounters();
  const k = S.q ? '' : S.route;
  if ((k === 'etapas' || (ST_BY && ST_BY[k])) && !(document.activeElement && document.activeElement.tagName === 'TEXTAREA')) render(false);
}

/* ── Persistência: localStorage + db do artifact quando disponível ── */
let DB = null, DL = null;
const timers = new Map(), chains = new Map();
function setR(id, patch) {
  S.reviews[id] = Object.assign({}, getR(id), patch, { updatedAt: new Date().toISOString() });
  lsSet(LS, S.reviews);
  queueRemote(id);
  refreshCounters();
}
function queueRemote(id, delay = 700) {
  if (!DB) return;
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => flush(id), delay));
}
function flush(id) {
  timers.delete(id);
  const prev = chains.get(id) || Promise.resolve();
  const next = prev.then(async () => {
    const r = S.reviews[id]; if (!r) return;
    try {
      await DB.doc('reviews/' + id).set({ status: r.status || '', comment: r.comment || '', updatedAt: r.updatedAt || '' });
      setSync('cloud');
    } catch (e) { setSync('error'); }
  });
  chains.set(id, next);
}
function setSync(s) {
  const el = $('#sync'); if (!el) return;
  el.dataset.s = s;
  $('#syncTxt').textContent = { cloud: 'Salvo no artifact (sincroniza)', local: 'Salvo neste navegador', error: 'Erro ao salvar na nuvem · cópia local ok', wait: 'Conectando…' }[s];
}
async function initCloud() {
  if (!window.claude || typeof window.claude.use !== 'function') { setSync('local'); return; }
  setSync('wait');
  try { DL = await window.claude.use('downloads'); } catch { DL = null; }
  let db = null;
  try { db = await window.claude.use('db'); } catch { db = null; }
  if (!db) { setSync('local'); return; }
  DB = db;
  let first = true;
  db.collection('reviews').onSnapshot(snap => {
    const remote = {};
    snap.docs.forEach(d => { remote[d.id] = d.data(); });
    if (first) {
      first = false;
      for (const [id, r] of Object.entries(S.reviews)) {
        const rr = remote[id];
        if (!rr || (r.updatedAt || '') > (rr.updatedAt || '')) queueRemote(id, 300);
      }
    }
    let changed = false;
    for (const [id, rr] of Object.entries(remote)) {
      const lr = S.reviews[id];
      if (!lr || (rr.updatedAt || '') > (lr.updatedAt || '')) {
        S.reviews[id] = { status: rr.status || '', comment: rr.comment || '', updatedAt: rr.updatedAt || '' };
        patchItem(id); changed = true;
      }
    }
    if (changed) { lsSet(LS, S.reviews); refreshCounters(); }
    setSync('cloud');
  }, () => setSync('error'));
  db.collection('progress').onSnapshot(snap => {
    PROG.stages = {}; snap.docs.forEach(d => { PROG.stages[d.id] = d.data(); }); PROG.live = true; onProgress();
  }, () => {});
  db.collection('devlog').onSnapshot(snap => {
    PROG.log = snap.docs.map(d => Object.assign({ id: d.id }, d.data())).sort((a, b) => String(b.ts).localeCompare(String(a.ts))); onProgress();
  }, () => {});
}

/* ── Seções ── */
const stageIds = st => [st.id, ...(st.setup || []).map((_, i) => `${st.id}.p${i + 1}`), ...st.feats.map((_, i) => `${st.id}.f${i + 1}`), ...st.daily.map((_, i) => `${st.id}.d${i + 1}`), ...st.retro.map((_, i) => `${st.id}.r${i + 1}`), `${st.id}.logs`, `${st.id}.crit`];
const SECTIONS = [
  { k: 'etapas', label: 'Plano de etapas', icon: 'flag', g: 'Etapas', ids: () => ['ET-PRINC', 'ET-GRAFO', 'ET-CRESC', ...STAGE_KIT.questions.map(q => q.id)] },
  ...STAGES.map(st => ({ k: st.id, label: `${st.id} · ${st.short}`, icon: st.icon, g: 'Etapas', stage: true, ids: () => stageIds(st) })),
  { k: 'kit', label: 'Kit de validação', icon: 'help', g: 'Etapas', ids: () => ['KIT-FLUXO', 'KIT-TELAS', 'KIT-SCHEMA', 'KIT-ALWAYS'] },
  { k: 'visao', label: 'Visão geral', icon: 'home', g: 'Revisão', ids: () => ['VIS-TESE', 'VIS-CICLO', 'VIS-CAMADAS'] },
  { k: 'dia', label: 'Um dia no DailyFlow', icon: 'sunrise', g: 'Revisão', ids: () => C.day.map(d => d.id) },
  { k: 'fluxos', label: 'Fluxos ponta a ponta', icon: 'route', g: 'Revisão', ids: () => C.flows.map(f => f.id) },
  { k: 'historias', label: 'Histórias de usuário', icon: 'listChecks', g: 'Revisão', ids: () => C.stories.map(s => s[0]) },
  { k: 'capacidades', label: 'O que dá para fazer', icon: 'map', g: 'Revisão', ids: () => C.caps.flatMap(a => a.items.map(i => i[0])) },
  { k: 'mapa', label: 'Mapa do app', icon: 'layers', g: 'Modelo', ids: () => ['MAP-IA', 'MAP-CICLO', 'MAP-FUNIL', 'MAP-OBJ', 'MAP-SYNC'] },
  { k: 'telas', label: 'Telas e estados', icon: 'panels', g: 'Modelo', ids: () => C.screens.map(s => s.id) },
  { k: 'regras', label: 'Regras e ciclos de vida', icon: 'branch', g: 'Modelo', ids: () => C.rules.map(r => r.id) },
  { k: 'roadmap', label: 'Fases da spec', icon: 'flag', g: 'Modelo', ids: () => C.phases.map(p => p.id) },
  { k: 'perguntas', label: 'Perguntas abertas', icon: 'help', g: 'Decisões', ids: () => C.questions.map(q => q.id) },
  { k: 'design', label: 'Design system', icon: 'palette', g: 'Sistema', ids: () => C.design.map(d => d[0]) },
  { k: 'exportar', label: 'Exportar revisão', icon: 'download', g: 'Sistema' },
];
const SEC = Object.fromEntries(SECTIONS.map(s => [s.k, s]));

/* Índice de todos os itens revisáveis (para busca e exportação) */
const INDEX = [];
(function buildIndex() {
  const add = (id, sec, title, text = '') => INDEX.push({ id, sec, title, text });
  add('ET-PRINC', 'etapas', 'Princípios das etapas');
  add('ET-GRAFO', 'etapas', 'Dependências e sequência das etapas');
  add('ET-CRESC', 'etapas', 'O app crescendo etapa a etapa');
  add('E0', 'etapas', 'E0 · Fundação (removida, virou Passo 0 da E1)');
  STAGE_KIT.questions.forEach(q => add(q.id, 'etapas', q.q, q.rec));
  STAGES.forEach(st => {
    add(st.id, st.id, `${st.id} · ${st.name}`, st.q);
    (st.setup || []).forEach((f, i) => add(`${st.id}.p${i + 1}`, st.id, `${st.id} · passo 0: ${f[1]}`));
    st.feats.forEach((f, i) => add(`${st.id}.f${i + 1}`, st.id, `${st.id} · entrega: ${f[1]}`));
    st.daily.forEach((q, i) => add(`${st.id}.d${i + 1}`, st.id, `${st.id} · check-in diário: ${q[0]}`, q[1]));
    st.retro.forEach((q, i) => add(`${st.id}.r${i + 1}`, st.id, `${st.id} · retro: ${q[0]}`, q[1]));
    add(`${st.id}.logs`, st.id, `${st.id} · logs da etapa`, st.logs.map(l => l[0]).join(' '));
    add(`${st.id}.crit`, st.id, `${st.id} · critérios de passagem`, st.crit.join(' '));
  });
  add('KIT-FLUXO', 'kit', 'Como a validação funciona');
  add('KIT-TELAS', 'kit', 'Telas do kit: check-in, dados, retro');
  add('KIT-SCHEMA', 'kit', 'Formato dos eventos');
  add('KIT-ALWAYS', 'kit', 'Métricas medidas em todas as etapas');
  add('VIS-TESE', 'visao', 'Tese do produto: o Hoje é o objeto principal');
  add('VIS-CICLO', 'visao', 'Ciclo diário (Capturar → … → Aprender)');
  add('VIS-CAMADAS', 'visao', 'Três camadas: Baseline, Plano final, Real');
  add('MAP-IA', 'mapa', 'Mapa de navegação (arquitetura de informação)');
  add('MAP-CICLO', 'mapa', 'Ciclo de vida do dia (estados e gatilhos)');
  add('MAP-FUNIL', 'mapa', 'Funil do planejamento (etapas 0–5 e modo rápido)');
  add('MAP-OBJ', 'mapa', 'Modelo de objetos (Modelo → Dia ← Tarefas)');
  add('MAP-SYNC', 'mapa', 'Offline-first: caminho de uma alteração');
  C.day.forEach(d => add(d.id, 'dia', `${d.t} · ${d.do}`, d.app));
  C.flows.forEach(f => {
    add(f.id, 'fluxos', f.title, [f.trigger, f.goal, f.outcome].join(' '));
    f.steps.forEach((s, i) => add(`${f.id}.s${i + 1}`, 'fluxos', `${f.id} · passo ${i + 1} (${s[0]}): ${s[1]}`, s[2]));
  });
  C.stories.forEach(s => add(s[0], 'historias', s[3]));
  C.caps.forEach(a => a.items.forEach(i => add(i[0], 'capacidades', `${a.area} › ${i[1]}`, i[2])));
  C.screens.forEach(s => add(s.id, 'telas', s.name, s.purpose));
  C.rules.forEach(r => add(r.id, 'regras', r.name, r.rules.join(' ')));
  C.phases.forEach(p => add(p.id, 'roadmap', p.name, p.scope.join(', ')));
  C.questions.forEach(q => add(q.id, 'perguntas', q.q, [q.ctx, q.rec].join(' ')));
  C.design.forEach(d => add(d[0], 'design', d[1]));
  SECTIONS.forEach(s => add('sec.' + s.k, s.k, `Comentário geral · ${s.label}`));
  add('geral', 'exportar', 'Notas gerais');
})();
const BY_ID = Object.fromEntries(INDEX.map(x => [x.id, x]));

/* ── Componentes ── */
const ST_BY = Object.fromEntries(STAGES.map(st => [st.id, st]));
const ST = [
  { k: 'ok', label: 'Aprovado', icon: 'check' },
  { k: 'adj', label: 'Ajustar', icon: 'pencil' },
  { k: 'rem', label: 'Remover', icon: 'x' },
  { k: 'q', label: 'Dúvida', icon: 'help' },
];
const ST_Q = { ok: 'Concordo', adj: 'Outra ideia', rem: 'Não se aplica', q: 'Discutir' };
const stLabel = (k, id) => (id && /^Q-/.test(id) ? ST_Q[k] : (ST.find(s => s.k === k) || {}).label) || '';

function ta(id, ph) {
  const v = getR(id).comment || '';
  return `<textarea class="cm${v.trim() ? ' filled' : ''}" id="cm-${esc(id)}" data-cid="${esc(id)}" rows="2" placeholder="${esc(ph)}" aria-label="Comentário ${esc(id)}">${esc(v)}</textarea>`;
}
function chips(id, { compact = false } = {}) {
  const r = getR(id);
  return `<div class="seg st-seg${compact ? ' compact' : ''}" role="group" aria-label="Status">${ST.map(s => {
    const lbl = stLabel(s.k, id);
    return `<button type="button" class="st-${s.k}" data-st="${s.k}" data-id="${esc(id)}" aria-pressed="${r.status === s.k}" title="${lbl}" aria-label="${lbl}">${icon(s.icon)}<span>${lbl}</span></button>`;
  }).join('')}</div>`;
}
function cbtn(id, label = true) {
  const has = !!(getR(id).comment || '').trim();
  return `<button type="button" class="cbtn${has ? ' has' : ''}" data-toggle="${esc(id)}" title="Comentar" aria-expanded="${has}">${icon('msg')}${label ? `<span>${has ? 'Comentário' : 'Comentar'}</span>` : ''}</button>`;
}
function cbox(id, ph = 'Comentário…', force = false) {
  const has = !!(getR(id).comment || '').trim();
  const rep = (C.replies || {})[id];
  const reply = rep ? `<div class="reply">${icon('msg', 'sm')}<div><b>Resposta</b><span>${esc(rep)}</span></div></div>` : '';
  return `${reply}<div class="cwrap" data-for="${esc(id)}"${force || has || rep ? '' : ' hidden'}>${ta(id, rep ? 'Responder…' : ph)}</div>`;
}
const rvBar = (id, opts = {}) => `<div class="rv" data-rv="${esc(id)}">${chips(id, opts)}${opts.inline ? '' : cbtn(id)}</div>`;
const sdot = id => { const r = getR(id); return `<span class="sdot" data-sdot="${esc(id)}" data-s="${r.status || ''}" data-c="${(r.comment || '').trim() ? 1 : 0}" title="${esc(r.status ? stLabel(r.status, id) : 'Sem status')}"></span>`; };

const SRC = { spec: ['Spec', 'gray'], derivada: ['Derivada', 'cyan'], nova: ['Nova', 'purple'] };
const srcTag = s => `<span class="tag ${SRC[s][1]}" title="${{ spec: 'Está na spec', derivada: 'Implícita na spec, sem história ou fluxo explícito', nova: 'Proposta nova, não está na spec' }[s]}">${SRC[s][0]}</span>`;
const PHASE_C = p => /MVP/.test(p) ? 'green' : /Proposta/.test(p) ? 'purple' : /definir/.test(p) ? 'yellow' : 'gray';
const phaseTag = p => `<span class="tag ${PHASE_C(p)}">${esc(p)}</span>`;
const WHEN = { manha: 'Manhã', dia: 'Durante o dia', noite: 'Noite', qualquer: 'Qualquer hora', config: 'Configuração', futuro: 'Futuro' };
const STATE = { nao: 'Não planejado', plan: 'Planejando', ativo: 'Ativo', fech: 'Fechando', fechado: 'Fechado' };
const STATE_C = { nao: 'gray', plan: 'purple', ativo: 'blue', fech: 'orange', fechado: 'green' };
const link = id => `<button type="button" class="tag link" data-go="${esc(id)}">${esc(id)}</button>`;

function header(k, title, lead, extra = '') {
  const s = SEC[k];
  return `<nav class="crumbs" aria-label="Caminho">${icon('home', 'sm')}<span>›</span><span>DailyFlow</span><span>›</span><b>${esc(s ? s.label : title)}</b></nav>
  <h1>${esc(title)}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}${extra}`;
}
const secComment = k => `<section class="section" style="margin-top:40px"><div class="section-head"><h2>Comentário geral</h2><span class="muted">Algo que falta, sobra ou está errado nesta seção</span></div>${ta('sec.' + k, 'Escreva livremente…')}</section>`;
const seg = (key, opts) => `<div class="seg" role="group">${opts.map(([v, l, n]) => `<button type="button" data-f="${key}" data-v="${v}" aria-pressed="${S.f[key] === v}">${esc(l)}${n != null ? ` <span class="n">${n}</span>` : ''}</button>`).join('')}</div>`;

/* ── Timeline mini (Baseline / Final / Real e mock do Hoje) ── */
const T = (h, m = 0) => h + m / 60;
const DAY = {
  base: [[6, 9, 'Maker', 'orange'], [9, 10, 'Drive / Leo', 'cyan'], [10, 11, 'Work', 'blue'], [11, 12, 'Music', 'purple'], [12, 14, 'Lunch + FlightSim', 'yellow'], [14, 17.5, 'Work', 'blue'], [17.5, 18.5, 'Drive / Leo', 'cyan'], [18.5, 21, 'Family', 'green'], [21, 22, 'Reading', 'pink']],
  final: [[6, 9, 'Maker', 'orange'], [9, 10, 'Drive / Leo', 'cyan'], [10, 11, 'Work', 'blue'], [11.5, 12, 'Meeting', 'gray'], [12, 13, 'Lunch', 'yellow'], [13, 14, 'Music', 'purple'], [14, 18, 'Work', 'blue'], [18, 19, 'Drive / Leo', 'cyan'], [19, 21, 'Family', 'green'], [21, 22, 'Reading', 'pink']],
  real: [[T(6, 20), T(8, 50), 'Maker', 'orange'], [T(8, 50), T(10, 5), 'Commute', 'cyan'], [T(10, 5), T(11, 28), 'Work', 'blue'], [11.5, 12, 'Meeting', 'gray'], [12, T(13, 5), 'Lunch', 'yellow'], [T(13, 8), T(13, 52), 'Music', 'purple'], [T(14, 5), T(18, 10), 'Work', 'blue'], [T(18, 10), T(19, 5), 'Drive', 'cyan'], [T(19, 5), T(21, 20), 'Family', 'green'], [T(21, 20), 22, 'Reading', 'pink']],
};
const fmt = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
function miniTl(blocks, { pph = 22, from = 6, to = 22, ghost = false, now = null, labels = false, times = false } = {}) {
  const H = (to - from) * pph;
  let hrs = '';
  for (let h = from; h <= to; h += 2) hrs += `<div class="hr" style="top:${(h - from) * pph}px">${labels ? `<span>${String(h).padStart(2, '0')}</span>` : ''}</div>`;
  const bl = blocks.map(([a, b, n, c]) => {
    const top = (a - from) * pph + 1, h = Math.max((b - a) * pph - 2, 10);
    const past = now != null && b <= now;
    return `<div class="blk c-${c}${ghost ? ' ghost' : ''}" style="top:${top}px;height:${h}px;${labels ? 'left:30px;' : ''}${past ? 'opacity:.55;' : ''}" title="${fmt(a)}–${fmt(b)} ${esc(n)}"><span>${esc(n)}</span>${times && h > 16 ? `<small>${fmt(a)}</small>` : ''}</div>`;
  }).join('');
  const nl = now != null ? `<div class="nowline" style="top:${(now - from) * pph}px"><span>${fmt(now)}</span></div>` : '';
  return `<div class="tl" style="height:${H}px">${hrs}${bl}${nl}</div>`;
}
function axis(pph = 22, from = 6, to = 22) {
  let s = ''; for (let h = from; h <= to; h += 2) s += `<span style="top:${(h - from) * pph}px">${String(h).padStart(2, '0')}:00</span>`;
  return `<div class="axis" style="height:${(to - from) * pph}px">${s}</div>`;
}

/* ── Páginas ── */
const PAGES = {};

PAGES.visao = () => {
  const rows = SECTIONS.filter(s => s.ids).map(s => {
    const ids = s.ids(), n = ids.filter(isRev).length;
    return `<div class="prog" data-nav="${s.k}" role="link" tabindex="0"><span style="display:flex;gap:10px;align-items:center">${icon(s.icon)}${esc(s.label)}</span><div class="bar"><i style="width:${ids.length ? (n / ids.length) * 100 : 0}%"></i></div><span class="n" data-count="${s.k}">${n}/${ids.length}</span></div>`;
  }).join('');
  const lane = (name, sub, steps) => `<div class="lane"><div class="lane-h"><span>${name}</span><span>${sub}</span></div><div class="steps">${steps.map((s, i) => `${i ? `<span class="arrow">${icon('arrowR', 'sm')}</span>` : ''}<span class="stepchip">${s}</span>`).join('')}</div></div>`;
  const layer = (t, d, blocks, ghost, dot) => `<div class="lcol"><h3><span class="sdot" style="background:${dot};border-color:transparent"></span>${t}</h3><p>${d}</p>${miniTl(blocks, { ghost, times: true })}</div>`;
  return header('visao', 'Revisão do planejamento', 'Tudo o que dá para fazer no DailyFlow, de ponta a ponta. Marque um status em cada item, comente onde quiser e, no fim, exporte a revisão para eu atualizar a spec.') + `
  <div class="howto">
    <div><b><span class="num">1</span>Marque um status</b><span>Aprovado, Ajustar, Remover ou Dúvida em cada fluxo, história, tela e regra.</span></div>
    <div><b><span class="num">2</span>Comente</b><span>Campos abertos em cada item, em cada passo dos fluxos e no fim de cada seção. Tudo salva sozinho.</span></div>
    <div><b><span class="num">3</span>Exporte</b><span>Em Exportar revisão: copie o Markdown e cole aqui no chat.</span></div>
  </div>
  <div class="hero-wf">${wfFigure('active')}<div class="side-note"><b>O DailyFlow no meio do dia</b><span>Esta é a tela onde você vai passar mais tempo: o bloco de agora, o próximo e o dia inteiro com a linha NOW. Todas as telas desta revisão são interpretações em wireframe, com marcadores numerados explicando cada parte.</span><span>Elas usam o design system de verdade, então também servem para validar o tema escuro e o claro.</span><span class="muted" style="font-size:12px">Os textos das telas estão em português só para a revisão. O idioma final depende da Q-02.</span></div></div>
  <section class="section"><div class="section-head"><h2>Progresso</h2><span class="muted">itens com status ou comentário</span></div><div class="list">${rows}</div></section>

  <section class="section" data-item="VIS-TESE">
    <div class="section-head"><h2>A tese</h2><span class="muted">§1 · §5</span></div>
    <p class="thesis">O objeto principal não é a tarefa, o projeto nem o evento do calendário. É o Hoje.</p>
    <p class="sec" style="margin:0;font-size:13.5px">Ao abrir o app, eu entendo em segundos:</p>
    <ol class="questions6"><li>O que foi planejado?</li><li>O que está acontecendo agora?</li><li>O que vem a seguir?</li><li>O que ainda precisa caber hoje?</li><li>O que mudou?</li><li>Como o tempo foi realmente gasto?</li></ol>
    ${rvBar('VIS-TESE')}${cbox('VIS-TESE')}
  </section>

  <section class="section" data-item="VIS-CICLO">
    <div class="section-head"><h2>Ciclo diário</h2><span class="muted">§3 · a interface deve tornar isso natural, sem cerimônia</span></div>
    <div class="cycle">
      ${lane('Manhã', 'planejar', ['Capturar', 'Revisar contexto', 'Planejar', 'Alocar', 'Iniciar dia'])}
      ${lane('Durante o dia', 'executar', ['Executar', 'Replanejar', 'Registrar o real'])}
      ${lane('Noite', 'fechar', ['Revisar', 'Fechar dia'])}
    </div>
    <div class="learn">${icon('history')}<span><b style="font-weight:600;color:var(--text-primary)">Aprender</b> atravessa tudo: Histórico e Insights alimentam o planejamento dos próximos dias. Capturar também acontece a qualquer hora.</span></div>
    ${rvBar('VIS-CICLO')}${cbox('VIS-CICLO')}
  </section>

  <section class="section" data-item="VIS-CAMADAS">
    <div class="section-head"><h2>Três camadas do dia</h2><span class="muted">§6 · o plano original nunca é sobrescrito</span></div>
    <div class="layers">
      <div><h3 style="font-size:12.5px;margin-bottom:6px">&nbsp;</h3><p style="min-height:36px;margin:0 0 8px"></p>${axis()}</div>
      ${layer('Baseline', 'O plano aceito no INICIAR DIA. Imutável.', DAY.base, true, 'var(--text-muted)')}
      ${layer('Plano final', 'A última intenção, depois de 3 revisões.', DAY.final, false, 'var(--accent-purple)')}
      ${layer('Real', 'O que aconteceu: ao vivo, timer ou depois.', DAY.real, false, 'var(--accent-green)')}
    </div>
    <p class="sec" style="font-size:13.5px;margin:4px 0 0">No fim do dia, ninguém precisa comparar colunas: as diferenças aparecem em frases e em selos na timeline (entra na E2).</p>
    ${wfFigure('dayDiff')}
    ${rvBar('VIS-CAMADAS')}${cbox('VIS-CAMADAS')}
  </section>
  ${secComment('visao')}`;
};

const DAY_WF = { 'DIA-01': 'unplanned', 'DIA-02': 'ctx', 'DIA-03': 'skeleton', 'DIA-04': 'allocate', 'DIA-05': 'conflicts', 'DIA-06': 'active', 'DIA-07': 'focusEnd', 'DIA-08': 'mobile', 'DIA-10': 'conflict', 'DIA-12': 'publish', 'DIA-13': 'widget', 'DIA-15': 'closeRepair', 'DIA-16': 'closeTasks', 'DIA-17': 'summary', 'DIA-18': 'nextday' };
PAGES.dia = () => {
  const legend = Object.entries(STATE).map(([k, v]) => `<span class="tag ${STATE_C[k]}">${v}</span>`).join('');
  const n = C.day.length;
  const dots = C.day.map((d, i) => `<button type="button" class="s-${d.st}" style="grid-column:${i + 1}" data-go="${d.id}" title="${esc(d.t + ' · ' + d.do)}"><span>${esc(d.t)}</span><i></i></button>`).join('');
  const bands = []; C.day.forEach((d, i) => { const b = bands[bands.length - 1]; if (b && b.st === d.st) b.to = i; else bands.push({ st: d.st, from: i, to: i }); });
  const strip = `<div class="dia" style="padding:14px 18px"><div class="dstrip" style="grid-template-columns:repeat(${n},minmax(0,1fr))">${dots}${bands.map(b => `<span class="band tag ${STATE_C[b.st]}" style="grid-column:${b.from + 1} / ${b.to + 2}">${STATE[b.st]}</span>`).join('')}</div></div>`;
  const items = C.day.map(d => {
    const k = DAY_WF[d.id];
    const head = `<div class="head"><span class="tag ${STATE_C[d.st]}">${STATE[d.st]}</span>${d.dev !== '—' ? `<span class="tag">${icon(d.dev === 'Celular' ? 'phone' : 'panels', 'sm')}${esc(d.dev)}</span>` : ''}<span class="mono muted">${d.id}</span>${d.flow ? `<span class="muted" style="font-size:12px">fluxo</span>${link(d.flow)}` : ''}</div>`;
    const narr = `${head}<div class="io${k ? ' stack' : ''}"><div><b>Eu</b>${esc(d.do)}</div><div><b>DailyFlow</b><span class="sec">${esc(d.app)}</span></div></div>${rvBar(d.id, { compact: true })}${cbox(d.id)}`;
    return `<div class="touch s-${d.st}${k ? ' has-wf' : ''}" data-item="${d.id}"><div class="time">${esc(d.t)}</div><div class="rail"><i></i></div>
      <div class="body">${k ? `<div class="scene"><div class="narr">${narr}</div>${wfFigure(k)}</div>` : narr}</div></div>`;
  }).join('');
  return header('dia', 'Um dia no DailyFlow', 'Uma segunda-feira inteira em storyboard, de quando abro o app até fechar. Cada momento mostra o que eu faço, o que o app responde e, nos momentos importantes, como a tela deve ficar.') +
    `<section class="section" style="margin-top:20px">${strip}<div class="legend" style="margin-top:4px">${legend}</div></section>
    <section class="section" style="margin-top:16px"><div class="touches">${items}</div></section>${secComment('dia')}`;
};

const FLOW_WF = {
  'F-00': ['onboarding', 'unplanned'], 'F-01': ['unplanned', 'ctx', 'skeleton', 'allocate', 'conflicts', 'active', 'conflict', 'closeRepair', 'closeTasks', 'summary'],
  'F-02': ['quick'], 'F-03': ['conflict', 'replan', 'history'], 'F-04': ['closeRepair', 'summary'], 'F-05': ['focusEnd', 'nextday', 'insights'],
  'F-06': ['closeRepair'], 'F-07': ['publish'], 'F-08': ['history'], 'F-09': ['offline'], 'F-10': ['widget'], 'F-11': ['palette', 'mobile'],
  'F-12': ['tasks'], 'F-13': ['yesterday'], 'F-14': ['lateStart'], 'F-15': ['active', 'focusEnd', 'forgot'], 'F-16': ['palette'], 'F-17': ['cancelled'],
  'F-18': ['template'], 'F-19': ['calendars'], 'F-20': ['unplanned'], 'F-21': ['insights'], 'F-22': ['summary', 'history'], 'F-23': ['midnight'],
};
const SCR_IC = [[/Acesso/, 'lock'], [/Boas|Instalar/, 'zap'], [/Etapa|Modo rápido|Planejamento/, 'listChecks'], [/Fechar|Fechado/, 'moon'], [/Timer|Sessão/, 'clock'], [/Inspector|Detalhe/, 'panels'], [/Configura|Template|Calendários|Áreas/, 'gear'], [/Histórico/, 'history'], [/Insights/, 'chart'], [/Celular/, 'phone'], [/Widget/, 'watch'], [/Sync/, 'refresh'], [/⌘K|Captura|Qualquer tela/, 'command'], [/Conflito/, 'alert'], [/Tarefa|Tarefas|Inbox/, 'tasks'], [/Timeline|Real|Agora|Hoje/, 'home'], [/Amanhã/, 'sunrise']];
const scrIcon = n => (SCR_IC.find(([r]) => r.test(n)) || [0, 'dot'])[1];
const fstrip = f => `<div class="fstrip">${f.steps.map((st, i) => `<div class="fnode" title="${esc(st[1])}"><span class="ic">${icon(scrIcon(st[0]))}</span><b>${i + 1}</b><small>${esc(st[0])}</small></div>`).join('')}</div>`;
const shortT = k => { const t = WF[k].t.split(' · '); return t.length > 1 ? t.slice(-1)[0].replace(/^./, c => c.toUpperCase()) : t[0]; };
function fgal(f) {
  const ks = FLOW_WF[f.id] || []; if (!ks.length) return '';
  const cur = S.wfSel[f.id] && ks.includes(S.wfSel[f.id]) ? S.wfSel[f.id] : ks[0];
  return `<div class="fblock fgal" data-gal="${f.id}"><b>Como fica na tela</b>${ks.length > 1 ? `<div class="fgal-tabs"><div class="seg" role="group">${ks.map((k, i) => `<button type="button" data-wfk="${k}" data-gal-for="${f.id}" aria-pressed="${k === cur}"><span class="n">${i + 1}</span>${esc(shortT(k))}</button>`).join('')}</div></div>` : ''}<div class="fgal-fig">${wfFigure(cur)}</div></div>`;
}
PAGES.fluxos = () => {
  const cnt = f => C.flows.filter(f).length;
  const list = C.flows.filter(f => (S.f.flowSrc === 'all' || (S.f.flowSrc === 'spec' ? f.src === 'spec' : f.src !== 'spec')) && (S.f.flowWhen === 'all' || f.when === S.f.flowWhen));
  const html = list.map(f => {
    const steps = f.steps.map((s, i) => {
      const sid = `${f.id}.s${i + 1}`;
      return `<div class="fstep" data-item="${sid}"><span class="n">${i + 1}</span><span class="scr">${esc(s[0])}</span><span class="eu">${esc(s[1])}</span><span class="app-r sec">${esc(s[2])}</span>${cbtn(sid, false)}${cbox(sid, `Comentário sobre o passo ${i + 1}…`)}</div>`;
    }).join('');
    return `<details class="flow" data-item="${f.id}" data-flow="${f.id}"${S.open.has(f.id) ? ' open' : ''}>
      <summary><span class="chev">${icon('chev', 'sm')}</span><span class="mono muted">${f.id}</span><span class="t">${esc(f.title)}</span><span class="tags">${srcTag(f.src)}<span class="tag">${WHEN[f.when]}</span>${phaseTag(f.phase)}${sdot(f.id)}</span></summary>
      <div class="flow-body">
        <div class="fmeta"><div><b>Gatilho</b>${esc(f.trigger)}</div><div><b>Objetivo</b>${esc(f.goal)}</div></div>
        <div class="fblock"><b>Caminho</b>${fstrip(f)}</div>
        ${S.open.has(f.id) ? fgal(f) : `<div data-lazy-gal="${f.id}"></div>`}
        <div class="fblock"><b>Passo a passo</b></div>
        <div class="fsteps"><div class="fstep h"><span>#</span><span>Tela</span><span>Eu faço</span><span>O DailyFlow responde</span><span></span></div>${steps}</div>
        ${f.branches.length ? `<div class="fblock"><b>Ramificações</b><ul>${f.branches.map(b => `<li><b>${esc(b[0])}:</b> ${esc(b[1])}</li>`).join('')}</ul></div>` : ''}
        <div class="fmeta" style="padding-top:0"><div><b>Resultado</b>${esc(f.outcome)}</div><div><b>Origem</b>${f.ref ? esc(f.ref) : 'Não está na spec (proposta)'}</div></div>
        ${(f.stories.length || f.questions.length) ? `<div class="fmeta" style="padding-top:0">${f.stories.length ? `<div><b>Histórias</b><div class="rel">${f.stories.map(link).join('')}</div></div>` : '<div></div>'}${f.questions.length ? `<div><b>Perguntas abertas</b><div class="rel">${f.questions.map(link).join('')}</div></div>` : ''}</div>` : ''}
        <div class="fblock"><b>Sua revisão do fluxo</b>${rvBar(f.id, { inline: true })}${cbox(f.id, 'O que muda neste fluxo? O que falta? Algum passo sobra?', true)}</div>
      </div></details>`;
  }).join('') || '<p class="muted">Nenhum fluxo com esses filtros.</p>';
  return header('fluxos', 'Fluxos ponta a ponta', `${C.flows.length} fluxos: as 10 jornadas da spec (A–J) detalhadas passo a passo e mais 14 fluxos que a spec não cobre. Cada passo tem campo de comentário próprio (ícone à direita).`) +
    `<div class="toolbar">${seg('flowSrc', [['all', 'Todos', C.flows.length], ['spec', 'Da spec', cnt(f => f.src === 'spec')], ['novo', 'Novos e derivados', cnt(f => f.src !== 'spec')]])}
     ${seg('flowWhen', [['all', 'Qualquer momento'], ...Object.entries(WHEN).map(([k, v]) => [k, v, cnt(f => f.when === k)])])}
     <span class="grow"></span><button type="button" class="btn sm" data-act="expand">Expandir todos</button><button type="button" class="btn sm ghost" data-act="collapse">Recolher</button></div>
    <section class="section" style="margin-top:12px"><div class="flows">${html}</div></section>${secComment('fluxos')}`;
};

PAGES.historias = () => {
  const f = S.f.storySrc;
  const keep = s => f === 'all' || (f === 'pend' ? !isRev(s[0]) : s[2] === f);
  const n = k => C.stories.filter(s => s[2] === k).length;
  const groups = C.epics.map(([k, name]) => {
    const rows = C.stories.filter(s => s[1] === k && keep(s));
    if (!rows.length) return '';
    return `<section class="section"><div class="section-head"><h2>${esc(name)}</h2><span class="muted">${rows.length}</span></div><div class="list">${rows.map(s => `
      <div class="row" data-item="${s[0]}"><span class="mono">${s[0]}</span><div class="txt"><span>${esc(s[3])}</span><span class="meta">${srcTag(s[2])}</span></div>${rvBar(s[0], { compact: true })}${cbox(s[0])}</div>`).join('')}</div></section>`;
  }).join('') || '<p class="muted" style="margin-top:24px">Nenhuma história com esse filtro.</p>';
  return header('historias', 'Histórias de usuário', `${C.stories.length} histórias no formato “Como usuário, quero…”. ${n('spec')} vêm da spec, ${n('derivada')} estavam implícitas nela e ${n('nova')} são propostas novas para cobrir lacunas.`) +
    `<div class="toolbar">${seg('storySrc', [['all', 'Todas', C.stories.length], ['spec', 'Da spec', n('spec')], ['derivada', 'Derivadas', n('derivada')], ['nova', 'Novas', n('nova')], ['pend', 'Pendentes', C.stories.filter(s => !isRev(s[0])).length]])}</div>${groups}${secComment('historias')}`;
};

const CAP_IC = { 'CAP-A': 'lock', 'CAP-B': 'listChecks', 'CAP-C': 'play', 'CAP-D': 'refresh', 'CAP-E': 'tasks', 'CAP-F': 'clock', 'CAP-G': 'moon', 'CAP-H': 'history', 'CAP-I': 'chart', 'CAP-J': 'calendar', 'CAP-K': 'gear', 'CAP-L': 'watch' };
PAGES.capacidades = () => {
  const f = S.f.capPhase;
  const keep = p => f === 'all' || (f === 'mvp' ? /MVP/.test(p) : f === 'prop' ? /Proposta|definir/.test(p) : !/MVP|Proposta|definir/.test(p));
  const all = C.caps.flatMap(a => a.items);
  const groups = C.caps.map(a => {
    const rows = a.items.filter(i => keep(i[3]));
    if (!rows.length) return '';
    return `<section class="section"><div class="section-head"><h2 style="display:flex;gap:8px;align-items:center">${icon(CAP_IC[a.id] || 'dot')}${esc(a.area)}</h2><span class="muted">${rows.length}</span></div><div class="list">${rows.map(i => `
      <div class="row cap-row" data-item="${i[0]}"><div class="txt"><span>${esc(i[1])}</span><span class="meta"><span class="mono">${i[0]}</span>·<span>${esc(i[2])}</span>${phaseTag(i[3])}</span></div>${rvBar(i[0], { compact: true })}${cbox(i[0])}</div>`).join('')}</div></section>`;
  }).join('');
  return header('capacidades', 'O que dá para fazer', `Inventário de todas as ações possíveis no DailyFlow (${all.length}), por área, com onde cada uma acontece e em que fase entra. Use para achar o que sobra e o que falta.`) +
    `<div class="toolbar">${seg('capPhase', [['all', 'Todas', all.length], ['mvp', 'MVP', all.filter(i => /MVP/.test(i[3])).length], ['later', 'Fases seguintes', all.filter(i => !/MVP|Proposta|definir/.test(i[3])).length], ['prop', 'Propostas e a definir', all.filter(i => /Proposta|definir/.test(i[3])).length]])}</div>${groups}${secComment('capacidades')}`;
};

const SCREEN_WF = { 'SCR-ACCESS': 'onboarding', 'SCR-TODAY-0': 'unplanned', 'SCR-TODAY-PLAN': 'allocate', 'SCR-TODAY-ACTIVE': 'active', 'SCR-TODAY-CLOSE': 'closeRepair', 'SCR-TODAY-CLOSED': 'summary', 'SCR-TASKS': 'tasks', 'SCR-HISTORY': 'history', 'SCR-INSIGHTS': 'insights', 'SCR-SETTINGS': 'template', 'SCR-PALETTE': 'palette', 'SCR-QUICKADD': 'mobile', 'SCR-CONFLICT': 'conflict', 'SCR-MOBILE': 'mobile' };
PAGES.mapa = () => {
  const blk = (id, title, sub, body) => `<section class="section" data-item="${id}"><div class="section-head"><h2>${title}</h2><span class="muted">${sub}</span></div><div class="dia">${body}</div>${rvBar(id)}${cbox(id)}</section>`;
  const cols = [
    ['home', 'Hoje', 'O centro do app, sempre a um clique.', ['Não planejado', 'Planejamento (5 etapas)', 'Ativo: Agora · Próximo · Timeline', 'Fechamento (4 passos)', 'Fechado'], true],
    ['tasks', 'Tarefas', 'Tudo o que existe fora do dia.', ['Inbox', 'Em andamento', 'Backlog', 'Concluídas', 'Detalhe da tarefa']],
    ['history', 'Histórico', 'Entender e corrigir o passado.', ['Calendário', 'Lista', 'Dia: Baseline · Final · Real', 'Tarefas · Stats · Revisões']],
    ['chart', 'Insights', 'Aprender com os dados.', ['Visão geral', 'Life Areas', 'Planejado × Real', 'Estimativas', 'Foco', 'Formato do dia']],
    ['gear', 'Configurações', 'O modelo de tempo.', ['Templates', 'Life Areas e categorias', 'Presets de foco', 'Calendários', 'Notificações e exibição', 'Sync e exportação']],
  ];
  const ia = `<div class="ia-top">${icon('panels', 'sm')}<span>Sidebar no desktop · barra inferior no celular (Hoje · Tarefas · Histórico · Mais)</span><span class="line"></span></div>
    <div class="ia-cols">${cols.map(([ic, n, d, items, main]) => `<div class="ia-node${main ? ' main' : ''}"><h4>${icon(ic)}${n}</h4><p>${d}</p><ul>${items.map(x => `<li>${x}</li>`).join('')}</ul></div>`).join('')}</div>
    <div class="ia-bar"><b>Sempre à mão</b><span>${icon('command', 'sm')}⌘K Command palette</span><span>${icon('plus', 'sm')}Adição rápida</span><span>${icon('panels', 'sm')}Inspector contextual</span><span>${icon('clock', 'sm')}Timer ativo</span><span>${icon('refresh', 'sm')}Status de sync</span></div>`;
  const node = (ic, c, n, sub) => `<div class="lc-node"><span class="ic" style="color:var(--pill-${c}-fg);border-color:var(--pill-${c}-bd);background:var(--pill-${c}-bg)">${icon(ic)}</span><b>${n}</b><span>${sub}</span></div>`;
  const edge = (l, key) => `<div class="lc-edge${key ? ' key' : ''}"><i></i><span>${l}</span></div>`;
  const lc = `<div class="lc">${node('sunrise', 'gray', 'Não planejado', 'dia já preparado')}${edge('Planejar meu dia<br>ou Modo rápido')}${node('listChecks', 'purple', 'Planejando', '5 etapas, puláveis')}${edge('INICIAR DIA<br>salva o Baseline', true)}${node('play', 'blue', 'Ativo', 'mudanças viram revisões')}${edge('Fechar dia')}${node('moon', 'orange', 'Fechando', '4 passos')}${edge('Concluir')}${node('check', 'green', 'Fechado', 'continua editável')}
    <div class="lc-loop" style="grid-column:5 / 10"><span>Reabrir</span></div>
    <div class="lc-notes"><span>${icon('help', 'sm')}Nunca iniciado → Baseline implícito? (Q-05)</span><span>${icon('help', 'sm')}Não fechado → cartão no dia seguinte (Q-06)</span><span>${icon('help', 'sm')}Início tardio → Baseline a partir de agora (Q-07)</span></div></div>`;
  const stages = [['0', 'sunrise', 'Abrir o Hoje', 'O app prepara template, agenda, pendências, prazos e Inbox.', 'automático'], ['1', 'eye', 'Contexto', 'Ler compromissos e pendências; marcar “Para hoje”; adicionar compromissos.', '~1 min'], ['2', 'calendar', 'Montar o dia', 'Blocos e tarefas na mesma tela: ajustar, arrastar, capturar o que lembrar.', '~2–3 min'], ['3', 'alert', 'Conflitos', 'Excessos, sobreposições e tarefa em bloco de outra área.', '~30 s'], ['4', 'play', 'Iniciar dia', 'Salva o Baseline e muda para execução.', '1 clique', true]];
  const funnel = `<div class="funnel">${stages.map(([n, ic, t, d, e, key]) => `<div class="fs${key ? ' key' : ''}"><span class="n">Etapa ${n}</span><b>${icon(ic, 'sm')}${t}</b><p>${d}</p><em>${e}</em></div>`).join('')}
    <div class="fast"><div>${icon('zap', 'sm')}<span>Modo rápido: etapa 0 → tela única (esqueleto aceito + 1 tarefa) → etapa 4 · ~1 min</span><i></i></div></div></div>`;
  const box = (ic, t, sm = '', cls = '') => `<div class="om-box ${cls}">${icon(ic, 'sm')}<span>${t}</span>${sm ? `<small>${sm}</small>` : ''}</div>`;
  const om = `<div class="om">
    <div class="om-col"><b>${icon('gear', 'sm')}Modelo</b>${box('calendar', 'Templates', 'Weekday · Weekend')}${box('layers', 'Life Areas', '11')}${box('tasks', 'Categorias e projetos')}${box('clock', 'Presets de foco')}${box('cloud', 'Calendários conectados', 'Fase 2')}</div>
    <div class="om-arrow"><span>gera e alimenta</span><i></i></div>
    <div class="om-day"><b>${icon('home', 'sm')}Dia · o objeto central</b>${box('lock', 'Baseline Plan', 'imutável')}${box('refresh', 'Plano atual + revisões')}${box('panels', 'Blocos', '6 tipos')}${box('calendar', 'Eventos externos', 'Commitment · Awareness')}${box('clock', 'Actual Timeline · Time Records', 'ao vivo · timer · depois', 'l')}${box('moon', 'Daily Review', 'nota · energia · resumo', 'l')}</div>
    <div class="om-arrow back"><span>agendadas em blocos,<br>acumulam tempo</span><i></i></div>
    <div class="om-col"><b>${icon('tasks', 'sm')}Tarefas</b>${box('inbox', 'Task', 'Inbox → … → Completed')}${box('listChecks', 'Subtarefas e notas')}${box('clock', 'Focus Sessions')}${box('history', 'Histórico da tarefa')}</div>
    <div class="om-foot"><span>${icon('chart', 'sm')}Histórico e Insights leem tudo</span><span>${icon('database', 'sm')}Audit log (revisões, edições) separado do analytics de produto</span></div></div>`;
  const P = (ic, t, sub) => `<div class="p"><span class="ic">${icon(ic)}</span><b>${t}</b><span>${sub}</span></div>`;
  const sync = `<div class="pipe-z"><span style="flex:4">Neste dispositivo · funciona offline</span><span style="flex:1.2">Rede</span><span style="flex:2">Servidor</span></div>
    <div class="pipe">${P('pointer', 'Ação', 'toque, arraste, timer')}<i class="a"></i>${P('database', 'Banco local', 'IndexedDB')}<i class="a"></i>${P('check', 'Tela atualiza', 'na hora')}<i class="a"></i>${P('layers', 'Fila', 'mutações pendentes')}<i class="a off"></i>${P('refresh', 'Conexão', 'quando houver')}<i class="a"></i>${P('cloud', 'Servidor', 'Next.js + Neon')}<i class="a"></i>${P('check', 'Confirmado', 'fila limpa')}</div>`;
  return header('mapa', 'Mapa do app', 'Diagramas para enxergar o produto de cima: como se navega, por quais estados o dia passa, como funciona o planejamento, quais objetos existem e como uma alteração chega ao servidor.') +
    blk('MAP-IA', 'Navegação', 'arquitetura de informação · §64 · §66', ia) +
    blk('MAP-CICLO', 'Ciclo de vida do dia', 'estados e o que muda entre eles', lc) +
    blk('MAP-FUNIL', 'Funil do planejamento', '§32–39 · 4 etapas depois da revisão · o planejamento nunca é obrigatório', funnel) +
    blk('MAP-OBJ', 'Modelo de objetos', '§4 · §111', om) +
    blk('MAP-SYNC', 'Offline-first', '§75 · a interface nunca espera a rede', sync) + secComment('mapa');
};

PAGES.telas = () => header('telas', 'Telas e estados', `As ${C.screens.length} superfícies do app, cada uma com um wireframe de interpretação. Navegação principal da spec: Hoje · Tarefas · Histórico · Insights · Configurações.`) +
  `<section class="section"><div class="flows">${C.screens.map(s => {
    const k = SCREEN_WF[s.id];
    const info = `<div class="card-head"><div><h3>${esc(s.name)}</h3><span class="mono muted">${s.id}</span></div>${sdot(s.id)}</div>
      <p class="sec" style="font-size:13.5px">${esc(s.purpose)}</p>
      <dl class="kv"><dt>Estados</dt><dd>${s.states.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</dd><dt>Ações</dt><dd>${s.actions.map(x => `<span class="tag blue">${esc(x)}</span>`).join('')}</dd></dl>
      ${rvBar(s.id, { compact: true })}${cbox(s.id)}`;
    return `<div class="card" data-item="${s.id}">${k ? `<div class="scene"><div class="narr">${info}</div>${wfFigure(k)}</div>` : info}</div>`;
  }).join('')}</div></section>${secComment('telas')}`;

PAGES.regras = () => header('regras', 'Regras e ciclos de vida', 'Os estados de cada objeto do domínio e as regras que o app precisa garantir. É aqui que o comportamento “invisível” é decidido.') +
  `<section class="section"><div class="grid2">${C.rules.map(r => `
    <div class="card" data-item="${r.id}"><div class="card-head"><div><h3>${esc(r.name)}</h3><span class="mono muted">${r.id}</span></div>${sdot(r.id)}</div>
    <div class="chain">${r.chain.map((c, i) => `${i ? `<span class="arrow">${icon('arrowR', 'sm')}</span>` : ''}<span class="stepchip">${esc(c)}</span>`).join('')}</div>
    ${r.back ? `<p class="muted" style="font-size:12.5px">${esc(r.back)}</p>` : ''}
    <ul class="rules">${r.rules.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    ${rvBar(r.id, { compact: true })}${cbox(r.id)}</div>`).join('')}</div></section>${secComment('regras')}`;

PAGES.roadmap = () => header('roadmap', 'Fases da spec', 'As 7 fases originais da spec, mantidas para referência. O plano de desenvolvimento agora são as <b>Etapas</b>, mais granulares e com validação.') +
  `<section class="section"><div class="grid2">${C.phases.map(p => `
    <div class="card" data-item="${p.id}"><div class="card-head"><h3>${esc(p.name)}</h3>${sdot(p.id)}</div>
    <ul class="rules">${p.scope.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    ${p.out.length ? `<p class="muted" style="font-size:12.5px;margin-top:10px">Fora: ${esc(p.out.join(' · '))}</p>` : ''}
    <div style="margin-top:10px">${rvBar(p.id, { compact: true })}${cbox(p.id)}</div></div>`).join('')}</div></section>${secComment('roadmap')}`;

PAGES.perguntas = () => {
  const list = C.questions.filter(q => S.f.qTopic === 'all' || q.topic === S.f.qTopic);
  const T = Object.fromEntries(C.questionTopics);
  return header('perguntas', 'Perguntas abertas', `${C.questions.length} decisões que a spec não responde (ou responde de forma ambígua). Cada uma tem a minha recomendação; responda no campo aberto.`) +
    `<div class="toolbar">${seg('qTopic', [['all', 'Todas', C.questions.length], ...C.questionTopics.map(([k, v]) => [k, v, C.questions.filter(q => q.topic === k).length])])}</div>
    <section class="section" style="margin-top:12px"><div class="qs">${list.map(q => `
      <div class="q" data-item="${q.id}">
        <div class="q-head"><span class="mono muted">${q.id}</span><span class="tag">${esc(T[q.topic])}</span></div>
        <div class="q-title">${esc(q.q)}</div>
        ${q.ctx ? `<p class="q-ctx">${esc(q.ctx)}</p>` : ''}
        ${q.opts ? `<ul class="q-opts">${q.opts.map(o => `<li>${esc(o)}</li>`).join('')}</ul>` : ''}
        <div class="rec"><b>Recomendo</b><span>${esc(q.rec)}</span></div>
        ${rvBar(q.id, { inline: true })}${cbox(q.id, 'Sua decisão ou comentário…', true)}
      </div>`).join('')}</div></section>${secComment('perguntas')}`;
};

function dsPanel(theme) {
  const nav = [['home', 'Hoje', true], ['tasks', 'Tarefas'], ['history', 'Histórico'], ['chart', 'Insights'], ['gear', 'Configurações']];
  const tl = [[6, 9, 'Maker', 'orange'], [9, 10, 'Drive / Leo', 'cyan'], [10, 11, 'Work', 'blue'], [11, 12, 'Music', 'purple'], [12, 14, 'Lunch + FlightSim', 'yellow'], [14, 17.5, 'Work', 'blue'], [17.5, 18.5, 'Drive', 'cyan'], [18.5, 21, 'Family', 'green'], [21, 22, 'Reading', 'pink']];
  return `<div class="ds-panel force-${theme}">
    <div class="ds-top"><span>${theme === 'dark' ? 'Escuro' : 'Claro (proposta)'}</span><span style="text-transform:none;letter-spacing:0;font-weight:500">Seg, 28 set · 10:37</span></div>
    <div class="ds-inner">
      <div class="ds-side">${nav.map(([i, l, a]) => `<span class="nav-item"${a ? ' aria-current="page"' : ''}>${icon(i)}${l}</span>`).join('')}</div>
      <div class="ds-main">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap"><span class="h">Hoje</span><div class="seg"><button type="button" tabindex="-1" aria-pressed="true">Plano</button><button type="button" tabindex="-1">Real</button><button type="button" tabindex="-1">Comparar</button></div></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><span class="search" style="flex:1;min-width:140px;height:34px">${icon('search', 'sm')}<span style="color:var(--text-placeholder);font-size:13px;flex:1">Buscar</span><kbd>⌘K</kbd></span><span class="btn sm">+ Bloco</span><span class="btn sm">${icon('play', 'sm')} Foco</span></div>
        <div class="ds-today">
          <div style="display:flex;flex-direction:column;gap:8px">
            <div class="nowcard"><span class="lbl">Agora</span><span class="big"><i></i>Work</span><span class="muted" style="font-size:12px">10:00–11:00 · 23 min restantes</span><span class="timer">18:42</span><span class="task">Preparar relatório semanal · 50/10</span></div>
            <div class="nowcard"><span class="lbl">Próximo</span><span class="big"><i style="background:var(--accent-purple)"></i>Music</span><span class="muted" style="font-size:12px">11:00–12:00</span></div>
            <div class="pills"><span class="pill c-orange">Maker <small>06:00</small></span><span class="pill c-blue">Work <small>10:00</small></span><span class="pill c-purple">Music <small>11:00</small></span><span class="pill c-green">Family <small>18:30</small></span><span class="pill c-pink">Reading <small>21:00</small></span><span class="pill c-gray">Meeting <small>11:30</small></span></div>
          </div>
          ${miniTl(tl, { pph: 19, labels: true, now: T(10, 37) })}
        </div>
      </div>
    </div></div>`;
}
PAGES.design = () => {
  const toks = ['--bg-app', '--bg-sidebar', '--bg-surface', '--bg-surface-hover', '--bg-surface-active', '--border-default', '--border-strong', '--text-primary', '--text-secondary', '--text-muted', '--accent-blue', '--accent-purple', '--accent-pink', '--accent-orange', '--accent-green', '--accent-cyan', '--accent-yellow'];
  const cur = currentTheme();
  const item = (id, extra = '') => `<div class="card" data-item="${id}"><div class="card-head"><h3>${esc(BY_ID[id].title)}</h3>${sdot(id)}</div>${extra}${rvBar(id, { compact: true })}${cbox(id)}</div>`;
  return header('design', 'Design system', 'Dark definido por você e a minha proposta de Light, lado a lado, aplicados a um mock do Hoje ativo. Fonte da verdade no projeto: <span class="mono">design/DESIGN_SYSTEM.md</span> e <span class="mono">design/tokens.css</span>.') + `
  <section class="section">
    <div class="section-head"><h2>Transição de tema</h2><span class="muted">o único momento expressivo do sistema</span></div>
    <div class="card" style="display:flex;flex-direction:column;gap:14px">
      <div class="tx-demos">
        <div class="tx"><div class="tx-stage" aria-hidden="true"><i class="tx-c open"></i><b class="tx-btn">${icon('sun', 'sm')}</b></div><span><b>Escuro → Claro</b>Um círculo claro abre a partir do botão clicado até cobrir a tela.</span></div>
        <div class="tx"><div class="tx-stage light" aria-hidden="true"><i class="tx-c close"></i><b class="tx-btn">${icon('moon', 'sm')}</b></div><span><b>Claro → Escuro</b>O círculo claro fecha de volta no botão e revela o escuro que estava por baixo.</span></div>
      </div>
      <p class="sec" style="font-size:13.5px;margin:0">O claro é sempre a camada de cima, recortada por uma máscara circular centrada no botão. Abrir leva 700 ms com desaceleração; fechar leva 600 ms. Com “reduzir movimento” ativado, a troca é instantânea.</p>
      <div><button type="button" class="btn" data-act="theme" id="dsThemeBtn">${icon(cur === 'dark' ? 'sun' : 'moon')}<span>Testar: ir para o ${cur === 'dark' ? 'claro' : 'escuro'}</span></button></div>
    </div>
  </section>
  <section class="section"><div class="section-head"><h2>Dark × Light</h2><span class="muted">mesma tela, mesmos tokens</span></div><div class="ds-pair">${dsPanel('dark')}${dsPanel('light')}</div></section>
  <section class="section"><div class="section-head"><h2>Tokens</h2><span class="muted">lidos direto do CSS</span></div>
    <div class="table-wrap"><table class="swatches"><thead><tr><th>Token</th><th>Escuro</th><th>Claro</th></tr></thead><tbody>${toks.map(t => `<tr><td class="mono">${t}</td><td data-sw="dark" data-t="${t}"></td><td data-sw="light" data-t="${t}"></td></tr>`).join('')}</tbody></table></div>
  </section>
  <section class="section"><div class="section-head"><h2>Sua revisão</h2></div><div class="grid2">
    ${item('DS-DARK', '<p class="sec" style="font-size:13px;margin-bottom:8px">Como veio no seu documento. Adicionei pills para laranja, amarelo, ciano e cinza (reuniões externas), que faltavam.</p>')}
    ${item('DS-LIGHT', '<p class="sec" style="font-size:13px;margin-bottom:8px">Fundo #F6F6F7 (nunca branco puro), sidebar um tom abaixo, superfícies brancas, acentos ~10% mais escuros para contraste, pills pastel com texto saturado.</p>')}
    ${item('DS-TRANSITION', '<p class="sec" style="font-size:13px;margin-bottom:8px">Círculo claro que abre a partir do botão (escuro → claro) e fecha de volta nele (claro → escuro). Teste pelo botão acima ou pelo botão de tema na sidebar.</p>')}
    ${item('DS-PILLS', '<p class="sec" style="font-size:13px;margin-bottom:8px">Cor por Life Area no mock: Maker laranja, Work azul, Music roxo, Lunch/FlightSim amarelo, Family verde, Reading rosa, Commute ciano, eventos externos cinza.</p>')}
    ${item('DS-TODAY', '<p class="sec" style="font-size:13px;margin-bottom:8px">Primeiro rascunho da hierarquia Agora → Próximo → Hoje, com a linha NOW rosa cruzando a timeline.</p>')}
  </div></section>${secComment('design')}`;
};

function buildMarkdown() {
  const all = S.f.exportAll;
  const d = new Date();
  const total = INDEX.filter(x => isRev(x.id)).length;
  const L = [`# DailyFlow — Revisão do planejamento`, ``, `Exportado em ${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · ${total} itens com status ou comentário`, `Legenda: [OK] Aprovado · [AJUSTAR] · [REMOVER] · [DÚVIDA]`, ``];
  const tag = id => { const s = getR(id).status; return s ? `[${{ ok: 'OK', adj: 'AJUSTAR', rem: 'REMOVER', q: 'DÚVIDA' }[s]}] ` : ''; };
  const cm = id => (getR(id).comment || '').trim();
  const g = cm('geral');
  if (g) L.push(`## Notas gerais`, ``, g, ``);
  for (const s of SECTIONS) {
    const items = INDEX.filter(x => x.sec === s.k && x.id !== 'geral' && !x.id.startsWith('sec.'));
    const secC = cm('sec.' + s.k);
    const rows = items.filter(x => all ? !/\.s\d+$/.test(x.id) || isRev(x.id) : isRev(x.id));
    if (!rows.length && !secC) continue;
    L.push(`## ${s.label}`, ``);
    if (secC) L.push(`**Comentário geral da seção:**`, secC.split('\n').map(l => `> ${l}`).join('\n'), ``);
    const inc = new Set(rows.map(x => x.id));
    for (const x of rows) {
      const c = cm(x.id);
      const stp = /\.s\d+$/.test(x.id) && inc.has(x.id.replace(/\.s\d+$/, ''));
      L.push(`${stp ? '  - ' : '- '}**${x.id}** ${tag(x.id)}${x.title}`);
      if (c) L.push(c.split('\n').map(l => `${stp ? '    ' : '  '}> ${l}`).join('\n'));
    }
    L.push('');
  }
  return L.join('\n');
}
PAGES.exportar = () => {
  const n = k => Object.entries(S.reviews).filter(([id, r]) => BY_ID[id] && r.status === k).length;
  const nc = Object.entries(S.reviews).filter(([id, r]) => BY_ID[id] && (r.comment || '').trim()).length;
  return header('exportar', 'Exportar revisão', 'Copie o Markdown e cole no chat. Eu uso isso para atualizar a spec. O JSON serve de backup e para continuar a revisão em outro navegador.') + `
  <section class="section"><div class="stats"><div><b>${nc}</b><span>comentários</span></div><div><b>${n('ok')}</b><span>aprovados</span></div><div><b>${n('adj')}</b><span>ajustar</span></div><div><b>${n('rem')}</b><span>remover</span></div><div><b>${n('q')}</b><span>dúvidas</span></div></div></section>
  <section class="section"><div class="section-head"><h2>Notas gerais</h2><span class="muted">vão no topo da exportação</span></div>${ta('geral', 'Impressões gerais, prioridades, o que mais te incomodou…')}</section>
  <section class="section"><div class="section-head"><h2>Markdown</h2></div>
    <div class="toolbar" style="margin:0"><button type="button" class="btn" data-act="copy">${icon('copy')}Copiar Markdown</button><button type="button" class="btn" data-act="dl-md">${icon('download')}Baixar .md</button>
    <label class="check"><input type="checkbox" id="exportAll" ${S.f.exportAll ? 'checked' : ''}> Incluir itens sem revisão</label></div>
    <pre class="md-preview" id="mdPreview" tabindex="0"></pre></section>
  <section class="section"><div class="section-head"><h2>Backup</h2></div>
    <div class="toolbar" style="margin:0"><button type="button" class="btn" data-act="dl-json">${icon('download')}Baixar JSON</button><label class="btn" for="importFile">${icon('upload')}Importar JSON</label><input type="file" id="importFile" accept="application/json,.json" hidden>
    <span class="grow"></span><button type="button" class="btn danger" data-act="clear">Limpar revisão</button></div>
    <p class="muted" style="font-size:12.5px;margin:0">As respostas salvam sozinhas. No artifact publicado, ficam guardadas no próprio artifact, e eu consigo lê-las direto. Aberto como arquivo local, ficam neste navegador.</p>
  </section>`;
};

PAGES.busca = () => {
  const q = S.q.trim().toLowerCase();
  const hl = s => { const t = esc(s); const i = t.toLowerCase().indexOf(esc(q)); return i < 0 ? t : t.slice(0, i) + '<mark>' + t.slice(i, i + esc(q).length) + '</mark>' + t.slice(i + esc(q).length); };
  const res = INDEX.filter(x => !x.id.startsWith('sec.') && (x.id.toLowerCase().includes(q) || x.title.toLowerCase().includes(q) || x.text.toLowerCase().includes(q))).slice(0, 120);
  return `<nav class="crumbs">${icon('search', 'sm')}<span>›</span><b>Busca</b></nav><h1>“${esc(S.q)}”</h1><p class="lead">${res.length} resultado${res.length === 1 ? '' : 's'}</p>
  <section class="section"><div class="list">${res.map(x => `<div class="res" data-go="${esc(x.id)}" role="link" tabindex="0"><span class="mono muted">${esc(x.id)}</span><span>${hl(x.title)}${x.text && x.text.toLowerCase().includes(q) && !x.title.toLowerCase().includes(q) ? `<br><span class="muted" style="font-size:12.5px">${hl(x.text.slice(0, 200))}</span>` : ''}</span><span class="tag">${esc(SEC[x.sec].label)}</span></div>`).join('') || '<p class="muted" style="padding:14px;margin:0">Nada encontrado.</p>'}</div></section>`;
};

/* ── Etapas ── */
const PRI_C = { P0: 'pink', P1: 'orange', P2: 'blue', P3: 'gray' };
const WAVE = Object.fromEntries(STAGE_WAVES.map(w => [w[0], w]));

const stLink = id => `<button type="button" class="tag link" data-nav="${id}">${id} · ${esc(ST_BY[id].short)}</button>`;
const priTag = p => `<span class="tag ${PRI_C[p]}" title="${{ P0: 'Sem isso o framework não existe', P1: 'Completa o ciclo diário', P2: 'Amplia o alcance', P3: 'Depois da validação' }[p]}">${p}</span>`;
const waveTag = w => `<span class="tag ${WAVE[w][2]}">${esc(WAVE[w][1])}</span>`;
const chipsOf = str => str.split(' · ').map(x => `<span class="ans">${esc(x)}</span>`).join('');

function gallery(gid, keys, nav) {
  if (!keys.length) return '';
  const cur = S.wfSel[gid] && keys.includes(S.wfSel[gid]) ? S.wfSel[gid] : keys[0];
  return `<div class="fgal" data-gal="${gid}"${nav ? ` data-navset="${nav.join(',')}"` : ''}>${keys.length > 1 ? `<div class="fgal-tabs"><div class="seg" role="group">${keys.map((k, i) => `<button type="button" data-wfk="${k}" data-gal-for="${gid}" aria-pressed="${k === cur}"><span class="n">${i + 1}</span>${esc(shortT(k))}</button>`).join('')}</div></div>` : ''}<div class="fgal-fig">${wfFigure(cur, { nav })}</div></div>`;
}

function depGraph() {
  const depth = {};
  const get = id => depth[id] != null ? depth[id] : (depth[id] = ST_BY[id].deps.length ? Math.max(...ST_BY[id].deps.map(get)) + 1 : 0);
  STAGES.forEach(st => get(st.id));
  const cols = {}; STAGES.forEach(st => (cols[depth[st.id]] = cols[depth[st.id]] || []).push(st));
  const nW = 138, nH = 66, cW = 166, rH = 82;
  const maxRows = Math.max(...Object.values(cols).map(c => c.length));
  const nCols = Math.max(...Object.keys(cols).map(Number)) + 1;
  const H = maxRows * rH, W = (nCols - 1) * cW + nW;
  const pos = {};
  Object.entries(cols).forEach(([c, list]) => { const y0 = (H - list.length * rH) / 2; list.forEach((st, i) => { pos[st.id] = { x: c * cW, y: y0 + i * rH + (rH - nH) / 2 }; }); });
  const edges = STAGES.flatMap(st => st.deps.map(d => {
    const a = pos[d], b = pos[st.id]; const x1 = a.x + nW, y1 = a.y + nH / 2, x2 = b.x - 4, y2 = b.y + nH / 2, mx = (x1 + x2) / 2;
    return `<path d="M${x1} ${y1} C${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}" marker-end="url(#dgArrow)"/>`;
  })).join('');
  const nodes = STAGES.map(st => `<button type="button" class="dg-node" data-nav="${st.id}" style="left:${pos[st.id].x}px;top:${pos[st.id].y}px;width:${nW}px;height:${nH}px;--wc:var(--accent-${WAVE[st.wave][2] === 'gray' ? 'cyan' : WAVE[st.wave][2]})">
      <span class="dg-top"><b class="mono">${st.id}</b>${priTag(st.pri)}${sdot(st.id)}</span><span class="dg-name">${esc(st.name)}</span></button>`).join('');
  const lanes = Array.from({ length: nCols }, (_, c) => `<span style="left:${c * cW}px;width:${nW}px">${c === 0 ? 'começo' : `nível ${c}`}</span>`).join('');
  return `<div class="dg" style="width:${W}px;height:${H + 26}px"><div class="dg-lanes">${lanes}</div><svg class="dg-edges" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><marker id="dgArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 8 4 0 8z"/></marker></defs>${edges}</svg>${nodes}</div>`;
}

function growView(id) {
  const st = ST_BY[id];
  const idx = STAGES.indexOf(st);
  const total = STAGES.slice(0, idx + 1).reduce((n, x) => n + x.feats.length, 0);
  return `<div class="grow"><div class="grow-fig">${wfFigure(st.hero, { nav: st.nav, notes: false })}</div>
    <div class="grow-side"><div class="grow-h"><span class="mono muted">${st.id}</span><b>${esc(st.name)}</b></div><p class="sec">${esc(st.q)}</p>
      <div class="grow-n"><b>${st.feats.length}</b><span>entregas nesta etapa</span><b>${total}</b><span>acumuladas até aqui</span></div>
      <div class="wf-lbl" style="font-size:11px">Novo nesta etapa</div><ul class="grow-list">${st.grow.map(g => `<li>${icon('plus', 'sm')}${esc(g)}</li>`).join('')}</ul>
      <button type="button" class="btn sm" data-nav="${st.id}">Abrir a etapa ${icon('arrowR', 'sm')}</button></div></div>`;
}

function growMatrix() {
  const head = `<div class="gm-row gm-head"><span></span>${STAGES.map(st => `<button type="button" data-nav="${st.id}" class="mono">${st.id}</button>`).join('')}</div>`;
  const rows = STAGES.flatMap((st, si) => st.grow.map(g => `<div class="gm-row"><span title="${esc(g)}">${esc(g)}</span>${STAGES.map((_, ci) => `<i class="${ci < si ? '' : ci === si ? 'new' : 'has'}" style="--wc:var(--accent-${WAVE[st.wave][2] === 'gray' ? 'cyan' : WAVE[st.wave][2]})"></i>`).join('')}</div>`)).join('');
  return `<div class="gm" style="--n:${STAGES.length}">${head}${rows}</div>`;
}

PAGES.etapas = () => {
  const waves = STAGE_WAVES.map(([w, name, c]) => {
    const list = STAGES.filter(st => st.wave === w);
    return `<div class="wave"><div class="wave-h"><span class="tag ${c}">${esc(name)}</span></div><div class="wave-cards">${list.map(st => `
      <button type="button" class="st-card" data-nav="${st.id}"><span class="dg-top"><b class="mono">${st.id}</b>${priTag(st.pri)}<span class="tag ${PST[stState(st)][2]}">${PST[stState(st)][1]}</span>${sdot(st.id)}</span>
      <b class="st-name">${icon(st.icon)}${esc(st.name)}</b><span class="st-q">${esc(st.q)}</span>
      <span class="st-meta">${st.feats.length} entregas · ${st.daily.length + st.retro.length} perguntas · ${st.logs.length} eventos${st.deps.length ? ` · depois de ${st.deps.join(', ')}` : ''}</span></button>`).join('')}</div></div>`;
  }).join('');
  return header('etapas', 'Etapas de desenvolvimento', `O DailyFlow dividido em ${STAGES.length - 1} etapas mais o horizonte. Cada etapa entra em uso real, responde uma pergunta sobre o framework e termina numa decisão tomada com logs e respostas objetivas. A ordem respeita as dependências e, entre as livres, a prioridade.`) + `
  ${progressPanel()}
  <section class="section" data-item="ET-PRINC"><div class="section-head"><h2>Como as etapas funcionam</h2></div>
    <div class="grid4">${STAGE_KIT.principles.map(([ic, t, d]) => `<div class="card pr"><span class="pr-ic">${icon(ic)}</span><b>${t}</b><span>${d}</span></div>`).join('')}</div>
    <div class="legend">${['P0', 'P1', 'P2', 'P3'].map(p => `<span style="display:inline-flex;gap:6px;align-items:center;font-size:12.5px;color:var(--text-secondary)">${priTag(p)}${{ P0: 'sem isso o framework não existe', P1: 'completa o ciclo diário', P2: 'amplia o alcance', P3: 'depois da validação' }[p]}</span>`).join('')}</div>
    ${rvBar('ET-PRINC')}${cbox('ET-PRINC')}</section>

  <section class="section" data-item="ET-GRAFO"><div class="section-head"><h2>Dependências</h2><span class="muted">uma seta = “precisa estar pronta antes” · clique para abrir a etapa</span></div>
    <div class="dia">${depGraph()}</div>
    <div class="waves">${waves}</div>
    ${rvBar('ET-GRAFO')}${cbox('ET-GRAFO')}</section>

  <section class="section" data-item="ET-CRESC"><div class="section-head"><h2>O app crescendo</h2><span class="muted">a tela principal ao fim de cada etapa · a sidebar ganha itens conforme o app cresce</span></div>
    <div class="seg grow-seg" role="group">${STAGES.map(st => `<button type="button" data-grow="${st.id}" aria-pressed="${st.id === S.growSel}">${st.id}</button>`).join('')}</div>
    <div class="card" id="growBox">${growView(S.growSel)}</div>
    <div class="section-head" style="margin-top:8px"><h3>Matriz de entregas</h3><span class="muted" style="font-size:12.5px">● entra nesta etapa · ▬ já disponível</span></div>
    <div class="dia">${growMatrix()}</div>
    ${rvBar('ET-CRESC')}${cbox('ET-CRESC')}</section>

  <section class="section"><div class="section-head"><h2>Decisões sobre o plano de etapas</h2><span class="muted">assumi um padrão em cada uma; mude o que não fizer sentido</span></div>
    <div class="qs">${STAGE_KIT.questions.map(q => `<div class="q" data-item="${q.id}"><div class="q-head"><span class="mono muted">${q.id}</span></div><div class="q-title">${esc(q.q)}</div><div class="rec"><b>Padrão</b><span>${esc(q.rec)}</span></div>${rvBar(q.id, { inline: true })}${cbox(q.id, 'Sua decisão ou comentário…', true)}</div>`).join('')}</div></section>
  ${secComment('etapas')}`;
};

function progressPanel() {
  const cur = STAGES.find(st => ['dev', 'validacao'].includes(stState(st))) || STAGES.find(st => stState(st) === 'aprovada') || STAGES.find(st => stState(st) === 'rascunho');
  const tot = STAGES.reduce((a, st) => { const d = stageDone(st); return [a[0] + d.done, a[1] + d.total]; }, [0, 0]);
  const cs = PST[stState(cur)];
  const next = { rascunho: 'precisa da sua revisão antes de começar', aprovada: 'revisada e aprovada, pronta para desenvolver', dev: 'em desenvolvimento', validacao: 'em uso real, coletando dados', concluida: 'concluída', cortada: 'cortada' }[stState(cur)];
  const pipe = STAGES.map(st => { const d = stageDone(st), ps = PST[stState(st)]; return `<button type="button" class="pp-st${st === cur ? ' cur' : ''}" data-nav="${st.id}" title="${esc(st.name)} · ${ps[1]}" style="--pc:var(--accent-${ps[2] === 'gray' ? 'cyan' : ps[2]})" data-s="${stState(st)}"><b class="mono">${st.id}</b><span class="pp-bar"><i style="width:${d.total ? d.done / d.total * 100 : 0}%"></i></span><em>${ps[1]}</em></button>`; }).join('');
  const log = PROG.log.slice(0, 8);
  return `<section class="section"><div class="section-head"><h2>Progresso</h2><span class="muted">${PROG.live ? 'atualizado ao vivo pelo desenvolvimento' : 'abra o artifact publicado para ver o progresso ao vivo'}</span></div>
    <div class="pp">
      <div class="pp-now"><span class="wf-lbl" style="font-size:11px">Agora</span><button type="button" class="pp-cur" data-nav="${cur.id}"><b>${cur.id} · ${esc(cur.name)}</b><span class="tag ${cs[2]}">${cs[1]}</span></button><span class="sec" style="font-size:13px">${esc(next)}</span>
        <div class="grow-n"><b>${tot[0]}</b><span>de ${tot[1]} entregas feitas</span></div></div>
      <div class="pp-pipe">${pipe}</div>
    </div>
    <div class="card devlog"><div class="card-head"><h3>${icon('history', 'sm')} Diário de desenvolvimento</h3></div>${log.length ? log.map(l => `<div class="dl"><span class="mono muted">${esc(String(l.ts || '').slice(0, 10))}</span>${l.stage ? `<button type="button" class="tag link" data-nav="${esc(l.stage)}">${esc(l.stage)}</button>` : '<span></span>'}<span>${esc(l.text || '')}</span></div>`).join('') : '<p class="muted" style="font-size:13px;margin:0">Nada registrado ainda.</p>'}</div>
  </section>`;
}

function stagePage(st) {
  const i = STAGES.indexOf(st), prev = STAGES[i - 1], next = STAGES[i + 1];
  const unlocks = STAGES.filter(x => x.deps.includes(st.id));
  const qRow = (id, [q, opts]) => `<div class="vq" data-item="${id}"><div class="vq-t"><span>${esc(q)}</span><span class="vq-a">${chipsOf(opts)}</span></div>${rvBar(id, { compact: true })}${cbox(id)}</div>`;
  const feats = st.feats.map((f, k) => { const id = `${st.id}.f${k + 1}`; return `<div class="row cap-row feat" data-item="${id}"><div class="txt"><span class="feat-t">${icon(f[0])}<span>${esc(f[1])}</span></span>${f[2].length ? `<span class="meta">${f[2].map(link).join('')}</span>` : ''}</div><div class="rv-wrap">${devTag(featDev(st, 'f' + (k + 1)))}${rvBar(id, { compact: true })}</div>${cbox(id, 'Mover para outra etapa? Cortar? Mudar?')}</div>`; }).join('');
  const setup = (st.setup || []).map((f, k) => { const id = `${st.id}.p${k + 1}`; return `<div class="row cap-row feat" data-item="${id}"><div class="txt"><span class="feat-t">${icon(f[0])}<span>${esc(f[1])}</span></span></div><div class="rv-wrap">${devTag(featDev(st, 'p' + (k + 1)))}${rvBar(id, { compact: true })}</div>${cbox(id)}</div>`; }).join('');
  const slog = PROG.log.filter(l => l.stage === st.id);
  return `<nav class="crumbs" aria-label="Caminho">${icon('flag', 'sm')}<span>›</span><button type="button" class="crumb-link" data-nav="etapas">Etapas</button><span>›</span><b>${st.id}</b></nav>
  <div class="st-head"><h1>${st.id} · ${esc(st.name)}</h1><div class="st-nav">${prev ? `<button type="button" class="btn sm" data-nav="${prev.id}">← ${prev.id}</button>` : ''}${next ? `<button type="button" class="btn sm" data-nav="${next.id}">${next.id} →</button>` : ''}</div></div>
  <div class="toolbar" style="margin-top:12px">${priTag(st.pri)}${waveTag(st.wave)}<span class="tag">${icon('clock', 'sm')}validação: ${esc(st.dur)}</span>
    ${st.deps.length ? `<span class="muted" style="font-size:12.5px">depende de</span>${st.deps.map(stLink).join('')}` : '<span class="muted" style="font-size:12.5px">sem dependências</span>'}
    ${unlocks.length ? `<span class="muted" style="font-size:12.5px">libera</span>${unlocks.map(x => stLink(x.id)).join('')}` : ''}</div>
  ${stateStepper(st)}
  <div class="stage-q"><span class="sq-ic">${icon('help')}</span><div><span class="wf-lbl" style="font-size:11px">A pergunta desta etapa</span><p>${esc(st.q)}</p><span class="sec">${esc(st.why)}</span></div></div>

  ${setup ? `<section class="section"><div class="section-head"><h2>Passo 0 · fundação</h2><span class="muted">infraestrutura sem validação própria · construída antes das entregas</span></div><div class="list">${setup}</div></section>` : ''}
  <section class="section"><div class="section-head"><h2>O que entra</h2><span class="muted">${st.feats.length} entregas · os links levam aos itens da especificação</span></div>
    <div class="list">${feats}</div>
    ${st.not.length ? `<div class="notyet"><span class="muted">Ainda não entra:</span>${st.not.map(n => `<span class="tag">${esc(n)}</span>`).join('')}</div>` : ''}</section>

  <section class="section"><div class="section-head"><h2>Como fica o app nesta etapa</h2><span class="muted">a sidebar mostra só o que já existe</span></div>${gallery('st-' + st.id, st.wf, st.nav)}</section>

  <section class="section"><div class="section-head"><h2>Validação</h2><span class="muted">${esc(st.dur)} usando de verdade</span></div>
    <div class="grid2 vgrid">
      <div class="card"><div class="card-head"><h3>${icon('sunrise', 'sm')} Check-in diário</h3><span class="muted" style="font-size:12px">no fechamento do dia · ~20 s</span></div>${st.daily.length ? st.daily.map((q, k) => qRow(`${st.id}.d${k + 1}`, q)).join('') : '<p class="muted" style="font-size:13px">Sem check-in diário nesta etapa; só a retro.</p>'}</div>
      <div class="card"><div class="card-head"><h3>${icon('flag', 'sm')} Retro da etapa</h3><span class="muted" style="font-size:12px">no fim da validação</span></div>${st.retro.length ? st.retro.map((q, k) => qRow(`${st.id}.r${k + 1}`, q)).join('') : '<p class="muted" style="font-size:13px">Definida quando a etapa for planejada.</p>'}</div>
    </div>
    <div data-item="${st.id}.logs"><div class="section-head" style="margin:8px 0"><h3>${icon('layers', 'sm')} Logs registrados</h3><span class="muted" style="font-size:12.5px">além das métricas de todas as etapas (Kit de validação)</span></div>
      <div class="table-wrap"><table class="swatches logs"><thead><tr><th>Evento</th><th>Propriedades</th><th>Para responder</th></tr></thead><tbody>${st.logs.map(([e, p, w]) => `<tr><td class="mono ev">${esc(e)}</td><td class="mono muted">${esc(p)}</td><td>${esc(w)}</td></tr>`).join('')}</tbody></table></div>
      <div style="margin-top:8px">${rvBar(`${st.id}.logs`, { compact: true })}${cbox(`${st.id}.logs`, 'Falta algum evento? Algum sobra?')}</div></div>
    <div class="card crit" data-item="${st.id}.crit"><div class="card-head"><h3>${icon('check', 'sm')} Critérios para passar</h3></div>
      <ul class="crit-list">${st.crit.map(c => `<li>${icon('check', 'sm')}<span>${esc(c)}</span></li>`).join('')}</ul>
      ${st.fail ? `<div class="rec"><b>Se não passar</b><span>${esc(st.fail)}</span></div>` : ''}
      ${rvBar(`${st.id}.crit`, { compact: true })}${cbox(`${st.id}.crit`, 'Os números fazem sentido?')}</div>
  </section>

  ${slog.length ? `<section class="section"><div class="card devlog"><div class="card-head"><h3>${icon('history', 'sm')} Diário desta etapa</h3></div>${slog.map(l => `<div class="dl"><span class="mono muted">${esc(String(l.ts || '').slice(0, 10))}</span><span></span><span>${esc(l.text || '')}</span></div>`).join('')}</div></section>` : ''}
  <section class="section" data-item="${st.id}"><div class="section-head"><h2>Sua revisão da etapa</h2></div>${rvBar(st.id, { inline: true })}${cbox(st.id, 'O que você mudaria nesta etapa? Ordem, conteúdo, pergunta, duração…', true)}</section>
  <div class="st-foot">${prev ? `<button type="button" class="btn" data-nav="${prev.id}">← ${prev.id} · ${esc(prev.short)}</button>` : '<span></span>'}${next ? `<button type="button" class="btn" data-nav="${next.id}">${next.id} · ${esc(next.short)} →</button>` : ''}</div>`;
}
function stateStepper(st) {
  const cur = stState(st), dates = (PROG.stages[st.id] && PROG.stages[st.id].dates) || {};
  if (cur === 'cortada') return `<div class="pstep"><span class="tag pink">Cortada</span></div>`;
  const order = ['rascunho', 'aprovada', 'dev', 'validacao', 'concluida'];
  const ci = order.indexOf(cur), d = stageDone(st);
  return `<div class="pstep">${order.map((k, i) => `<span class="ps${i < ci ? ' done' : ''}${i === ci ? ' on' : ''}" style="--pc:var(--accent-${PST[k][2] === 'gray' ? 'cyan' : PST[k][2]})"><i>${i < ci ? icon('check', 'sm') : ''}</i><b>${PST[k][1]}</b>${dates[k] ? `<em>${esc(dates[k])}</em>` : ''}</span>`).join('<span class="ps-line"></span>')}<span class="ps-count">${d.done}/${d.total} entregas feitas</span></div>`;
}
STAGES.forEach(st => { PAGES[st.id] = () => stagePage(st); });

PAGES.kit = () => {
  const P = (ic, t, sub) => `<div class="p"><span class="ic">${icon(ic)}</span><b>${t}</b><span>${sub}</span></div>`;
  const flow = `<div class="pipe">${P('calendar', 'Usar o dia', 'uso real, sem roteiro')}<i class="a"></i>${P('layers', 'Logs automáticos', 'toda interação')}<i class="a"></i>${P('help', 'Check-in diário', '2–3 perguntas, ~20 s')}<i class="a"></i>${P('flag', 'Retro da etapa', 'critérios + perguntas')}<i class="a"></i>${P('chart', 'Relatório', 'eu analiso os dados')}<i class="a"></i>${P('check', 'Decisão', 'avançar, ajustar, cortar')}</div>`;
  return header('kit', 'Kit de validação', 'O mesmo instrumento em todas as etapas: logs automáticos para o que dá para medir e perguntas objetivas para o que só você sabe. Ele é construído no Passo 0 da E1 e evolui com o app.') + `
  <section class="section" data-item="KIT-FLUXO"><div class="section-head"><h2>Como funciona</h2></div><div class="dia">${flow}</div>
    <p class="sec" style="font-size:13.5px;margin:0;max-width:75ch">No fim de cada etapa você me avisa; eu leio os eventos e as respostas (direto do banco ou pelo export), comparo com os critérios da etapa e escrevo um relatório curto com a recomendação. A decisão é sua na retro.</p>
    ${rvBar('KIT-FLUXO')}${cbox('KIT-FLUXO')}</section>
  <section class="section" data-item="KIT-TELAS"><div class="section-head"><h2>Telas do kit</h2></div>${gallery('kit', ['checkin', 'logs', 'retro'], ['hoje', 'config'])}${rvBar('KIT-TELAS')}${cbox('KIT-TELAS')}</section>
  <section class="section" data-item="KIT-SCHEMA"><div class="section-head"><h2>Formato de cada evento</h2><span class="muted">tabela product_events, separada do audit log do domínio (§63)</span></div>
    <div class="table-wrap"><table class="swatches"><thead><tr><th>Campo</th><th>Tipo</th><th>Uso</th></tr></thead><tbody>${STAGE_KIT.schema.map(([a, b, c]) => `<tr><td class="mono">${a}</td><td class="mono muted">${esc(b)}</td><td>${esc(c)}</td></tr>`).join('')}</tbody></table></div>
    ${rvBar('KIT-SCHEMA')}${cbox('KIT-SCHEMA')}</section>
  <section class="section" data-item="KIT-ALWAYS"><div class="section-head"><h2>Medido em todas as etapas</h2></div>
    <div class="table-wrap"><table class="swatches"><thead><tr><th>Métrica</th><th>Vem de</th></tr></thead><tbody>${STAGE_KIT.always.map(([a, b]) => `<tr><td>${esc(a)}</td><td class="mono muted">${esc(b)}</td></tr>`).join('')}</tbody></table></div>
    ${rvBar('KIT-ALWAYS')}${cbox('KIT-ALWAYS')}</section>
  ${secComment('kit')}`;
};

/* ── Render ── */
function renderNav() {
  const groups = [...new Set(SECTIONS.map(s => s.g))];
  $('#nav').innerHTML = groups.map(g => `<div class="nav-group"><div class="nav-label">${g}</div>${SECTIONS.filter(s => s.g === g).map(s => {
    const ids = s.ids ? s.ids() : null;
    const n = ids ? ids.filter(isRev).length : 0;
    return `<a class="nav-item" href="#${s.k}" data-nav="${s.k}"${S.route === s.k && !S.q ? ' aria-current="page"' : ''}>${icon(s.icon)}<span>${s.label}</span>${s.stage ? `<i class="pst" style="--pc:var(--accent-${PST[stState(ST_BY[s.k])][2] === 'gray' ? 'cyan' : PST[stState(ST_BY[s.k])][2]})" data-s="${stState(ST_BY[s.k])}" title="${PST[stState(ST_BY[s.k])][1]}"></i>` : ''}${ids ? `<span class="badge${n === ids.length ? ' done' : ''}" data-badge="${s.k}">${n}/${ids.length}</span>` : ''}</a>`;
  }).join('')}</div>`).join('');
}
function refreshCounters() {
  let tot = 0, done = 0;
  SECTIONS.forEach(s => {
    if (!s.ids) return;
    const ids = s.ids(), n = ids.filter(isRev).length;
    tot += ids.length; done += n;
    const b = $(`[data-badge="${s.k}"]`); if (b) { b.textContent = `${n}/${ids.length}`; b.classList.toggle('done', n === ids.length); }
    const c = $(`[data-count="${s.k}"]`); if (c) { c.textContent = `${n}/${ids.length}`; c.previousElementSibling.firstElementChild.style.width = (n / ids.length * 100) + '%'; }
  });
  $('#progTxt').textContent = `${done} de ${tot}`;
  $('#progBar').style.width = (tot ? done / tot * 100 : 0) + '%';
  if (S.route === 'exportar' && !S.q) updatePreview();
}
function render(scrollTop = true) {
  const k = S.q.trim().length >= 2 ? 'busca' : S.route;
  $('#page').innerHTML = (PAGES[k] || PAGES.etapas)();
  renderNav();
  refreshCounters();
  $$('.cm', $('#page')).forEach(autosize);
  if (k === 'design') paintSwatches();
  if (k === 'exportar') updatePreview();
  if (scrollTop) window.scrollTo({ top: 0 });
  document.title = 'DailyFlow Review';
}
function autosize(el) { el.style.height = 'auto'; el.style.height = Math.max(38, el.scrollHeight + 2) + 'px'; }
function patchItem(id) {
  const r = getR(id);
  $$(`[data-st][data-id="${CSS.escape(id)}"]`).forEach(b => b.setAttribute('aria-pressed', String(r.status === b.dataset.st)));
  $$(`[data-sdot="${CSS.escape(id)}"]`).forEach(d => { d.dataset.s = r.status || ''; d.dataset.c = (r.comment || '').trim() ? 1 : 0; });
  const t = document.getElementById('cm-' + id);
  if (t && document.activeElement !== t && t.value !== (r.comment || '')) {
    t.value = r.comment || ''; autosize(t); t.classList.toggle('filled', !!t.value.trim());
    const w = t.closest('.cwrap'); if (w && t.value.trim()) w.hidden = false;
  }
  const cb = $(`[data-toggle="${CSS.escape(id)}"]`);
  if (cb) { const has = !!(r.comment || '').trim(); cb.classList.toggle('has', has); const sp = cb.querySelector('span'); if (sp) sp.textContent = has ? 'Comentário' : 'Comentar'; }
}
function paintSwatches() {
  const probe = { dark: document.createElement('div'), light: document.createElement('div') };
  Object.entries(probe).forEach(([t, el]) => { el.className = 'force-' + t; el.hidden = true; document.body.appendChild(el); });
  $$('[data-sw]').forEach(td => {
    const v = getComputedStyle(probe[td.dataset.sw]).getPropertyValue(td.dataset.t).trim();
    td.innerHTML = `<span class="sw"><i style="background:${esc(v)}"></i>${esc(v)}</span>`;
  });
  Object.values(probe).forEach(el => el.remove());
}
function updatePreview() { const p = $('#mdPreview'); if (p) p.textContent = buildMarkdown(); }

/* ── Navegação ── */
function go(route, { item = null, push = true } = {}) {
  S.q = ''; $('#q').value = '';
  S.route = SEC[route] ? route : 'etapas';
  if (push) { try { history.replaceState(null, '', '#' + S.route); } catch { location.hash = S.route; } }
  document.body.classList.remove('menu-open');
  render();
  if (item) focusItem(item);
}
function focusItem(id) {
  const base = id.replace(/\.s\d+$/, '');
  const fl = $(`details[data-flow="${CSS.escape(base)}"]`);
  if (fl && !fl.open) { fl.open = true; S.open.add(base); saveUi(); }
  const el = $(`[data-item="${CSS.escape(id)}"]`);
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
}
function goItem(id) {
  const x = BY_ID[id];
  if (!x) return;
  if (x.sec === 'fluxos') {
    const f = C.flows.find(f => f.id === id.replace(/\.s\d+$/, ''));
    if (f) { S.f.flowSrc = 'all'; S.f.flowWhen = 'all'; }
  }
  if (x.sec === 'historias') S.f.storySrc = 'all';
  if (x.sec === 'capacidades') S.f.capPhase = 'all';
  if (x.sec === 'perguntas') S.f.qTopic = 'all';
  go(x.sec, { item: id });
}

/* ── Tema ── */
function currentTheme() {
  const a = document.documentElement.getAttribute('data-theme');
  if (a === 'light' || a === 'dark') return a;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  ui0.theme = t; saveUi();
  syncThemeButtons(t);
}
function syncThemeButtons(t) {
  const ic = t === 'dark' ? 'sun' : 'moon';
  $$('[data-act="theme"]').forEach(b => {
    const svg = b.querySelector('svg'); if (svg) svg.outerHTML = icon(ic);
    const sp = b.querySelector('span'); if (sp) sp.textContent = b.id === 'dsThemeBtn' ? `Testar: ir para o ${t === 'dark' ? 'claro' : 'escuro'}` : (t === 'dark' ? 'Claro' : 'Escuro');
    b.title = t === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro';
  });
}
let themeBusy = false;
function toggleTheme(origin) {
  if (themeBusy) return;
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce) { applyTheme(next); return; }
  // O claro fica sempre por cima: abrindo (→ claro) anima o novo estado; fechando (→ escuro) anima o antigo.
  const cls = next === 'light' ? 'vt-open' : 'vt-close';
  root.classList.add(cls);
  themeBusy = true;
  let vt;
  try { vt = document.startViewTransition(() => applyTheme(next)); }
  catch { root.classList.remove(cls); themeBusy = false; applyTheme(next); return; }
  vt.ready.then(() => {
    const r = origin && origin.isConnected ? origin.getBoundingClientRect() : null;
    const x = r ? r.left + r.width / 2 : 40, y = r ? r.top + r.height / 2 : innerHeight - 40;
    const R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const open = `circle(${R}px at ${x}px ${y}px)`, shut = `circle(0px at ${x}px ${y}px)`;
    if (next === 'light') root.animate({ clipPath: [shut, open] }, { duration: 700, easing: 'cubic-bezier(.22,.61,.36,1)', pseudoElement: '::view-transition-new(root)', fill: 'both' });
    else root.animate({ clipPath: [open, shut] }, { duration: 600, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-old(root)', fill: 'both' });
  }).catch(() => {});
  vt.finished.finally(() => { root.classList.remove('vt-open', 'vt-close'); themeBusy = false; });
}

/* ── Arquivos ── */
async function saveFile(name, text) {
  if (DL) {
    try { await DL.save({ filename: name, data: text }); toast('Arquivo pronto'); return; }
    catch (e) { if (e && e.code === 'declined') return; if (e && e.code === 'rate_limited') { toast('Aguarde um instante e tente de novo'); return; } }
  }
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch { toast('Não deu para baixar aqui. Use Copiar.'); }
}
const stamp = () => new Date().toISOString().slice(0, 10);
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }

/* ── Eventos ── */
document.addEventListener('click', e => {
  const t = e.target.closest('button, a, [data-nav], [data-go], [data-act]');
  if (!t) return;
  if (t.dataset.st) {
    const id = t.dataset.id, cur = getR(id).status;
    setR(id, { status: cur === t.dataset.st ? '' : t.dataset.st });
    patchItem(id); return;
  }
  if (t.dataset.toggle) {
    const w = $(`.cwrap[data-for="${CSS.escape(t.dataset.toggle)}"]`);
    if (w) { w.hidden = !w.hidden; t.setAttribute('aria-expanded', String(!w.hidden)); if (!w.hidden) { const a = w.querySelector('textarea'); autosize(a); a.focus(); } }
    return;
  }
  if (t.dataset.wfk) {
    const fid = t.dataset.galFor; S.wfSel[fid] = t.dataset.wfk;
    const g = $(`[data-gal="${CSS.escape(fid)}"]`);
    if (g) { const nav = g.dataset.navset ? g.dataset.navset.split(',') : null; g.querySelector('.fgal-fig').innerHTML = wfFigure(t.dataset.wfk, { nav }); $$('[data-wfk]', g).forEach(b => b.setAttribute('aria-pressed', String(b === t))); }
    return;
  }
  if (t.dataset.grow) {
    S.growSel = t.dataset.grow;
    const box = $('#growBox'); if (box) box.innerHTML = growView(S.growSel);
    $$('[data-grow]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.grow === S.growSel)));
    return;
  }
  if (t.dataset.go) { e.preventDefault(); goItem(t.dataset.go); return; }
  if (t.dataset.nav) { e.preventDefault(); go(t.dataset.nav); return; }
  if (t.dataset.f) { S.f[t.dataset.f] = t.dataset.v; saveUi(); render(false); return; }
  const act = t.dataset.act;
  if (!act) return;
  if (act === 'theme') toggleTheme(t);
  else if (act === 'menu') document.body.classList.toggle('menu-open');
  else if (act === 'expand') { C.flows.forEach(f => S.open.add(f.id)); saveUi(); $$('details.flow').forEach(d => { d.open = true; }); }
  else if (act === 'collapse') { S.open.clear(); saveUi(); $$('details.flow').forEach(d => { d.open = false; }); }
  else if (act === 'copy') {
    const md = buildMarkdown();
    const fallback = () => { const p = $('#mdPreview'); const r = document.createRange(); r.selectNodeContents(p); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Texto selecionado. Use ⌘C.'); };
    try { navigator.clipboard.writeText(md).then(() => toast('Markdown copiado. Cole no chat.'), fallback); } catch { fallback(); }
  }
  else if (act === 'dl-md') saveFile(`dailyflow-revisao-${stamp()}.md`, buildMarkdown());
  else if (act === 'dl-json') saveFile(`dailyflow-revisao-${stamp()}.json`, JSON.stringify({ app: 'DailyFlow', kind: 'review', version: 1, exportedAt: new Date().toISOString(), reviews: S.reviews }, null, 2));
  else if (act === 'clear') {
    if (t.dataset.armed !== '1') { t.dataset.armed = '1'; t.textContent = 'Clique de novo para apagar tudo'; setTimeout(() => { if (t.isConnected) { t.dataset.armed = ''; t.textContent = 'Limpar revisão'; } }, 4000); return; }
    Object.keys(S.reviews).forEach(id => { S.reviews[id] = { status: '', comment: '', updatedAt: new Date().toISOString() }; queueRemote(id, 100); });
    lsSet(LS, S.reviews); render(); toast('Revisão apagada');
  }
});
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); document.body.classList.add('menu-open'); $('#q').focus(); $('#q').select(); }
  if (e.key === 'Escape') { if (S.q) { S.q = ''; $('#q').value = ''; render(); } document.body.classList.remove('menu-open'); }
  if (e.key === 'Enter' && e.target.matches('[data-nav][role="link"], [data-go][role="link"]')) e.target.click();
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.cid) {
    autosize(t);
    t.classList.toggle('filled', !!t.value.trim());
    setR(t.dataset.cid, { comment: t.value });
    const id = t.dataset.cid;
    $$(`[data-sdot="${CSS.escape(id)}"]`).forEach(d => { d.dataset.c = t.value.trim() ? 1 : 0; });
    const cb = $(`[data-toggle="${CSS.escape(id)}"]`);
    if (cb) { cb.classList.toggle('has', !!t.value.trim()); const sp = cb.querySelector('span'); if (sp) sp.textContent = t.value.trim() ? 'Comentário' : 'Comentar'; }
  } else if (t.id === 'q') {
    S.q = t.value; render();
    t.focus();
  }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'exportAll') { S.f.exportAll = t.checked; saveUi(); updatePreview(); }
  if (t.id === 'importFile' && t.files && t.files[0]) {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const data = JSON.parse(fr.result);
        const rv = data.reviews || data;
        let n = 0;
        for (const [id, r] of Object.entries(rv)) {
          if (!r || typeof r !== 'object' || !/^[A-Za-z0-9_.:@+~-]+$/.test(id)) continue;
          S.reviews[id] = { status: ['ok', 'adj', 'rem', 'q'].includes(r.status) ? r.status : '', comment: String(r.comment || ''), updatedAt: new Date().toISOString() };
          queueRemote(id, 200 + n * 40); n++;
        }
        lsSet(LS, S.reviews); render(); toast(`${n} itens importados`);
      } catch { toast('Arquivo inválido: esperado o JSON exportado por esta ferramenta'); }
    };
    fr.readAsText(t.files[0]);
    t.value = '';
  }
});
document.addEventListener('toggle', e => {
  const d = e.target;
  if (d.matches && d.matches('details.flow')) {
    if (d.open) {
      S.open.add(d.dataset.flow);
      const lz = d.querySelector('[data-lazy-gal]');
      if (lz) { const f = C.flows.find(x => x.id === lz.dataset.lazyGal); lz.outerHTML = fgal(f); }
    } else S.open.delete(d.dataset.flow);
    saveUi();
  }
}, true);

/* ── Boot ── */
if (ui0.theme === 'light' || ui0.theme === 'dark') document.documentElement.setAttribute('data-theme', ui0.theme);
const h = (location.hash || '').slice(1);
S.route = SEC[h] ? h : 'etapas';
render();
syncThemeButtons(currentTheme());
initCloud();
})();
