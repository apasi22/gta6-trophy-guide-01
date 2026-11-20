// GTA VI Trophy Guide & Tracker — static, offline, no network requests.
// Loads data/trophies.json (a file of this app), renders the checklist with
// numbered, cited steps per trophy, counters, a 7-stage roadmap, a sources
// panel and an audit strip, and keeps progress in localStorage only.
const DATA_URL = 'data/trophies.json';
const STORE_KEY = 'gta6-trophy-guide-progress-v1';
const COUNTER_KEY = 'gta6-trophy-guide-counters-v1';
const SPOILER_KEY = 'gta6-trophy-guide-spoiler-v1';
const FEATURED_KEY = 'gta6-trophy-guide-featured-v1';
const POINTS = { platinum: 300, gold: 90, silver: 30, bronze: 15 };

const state = {
  trophies: [],
  sources: [],
  roadmap: [],
  byId: new Map(),
  earned: new Set(),
  counters: new Map(),
  spoiler: false,
  filter: 'all',
  query: '',
  featuredId: 28,
};

const $ = (s) => document.querySelector(s);
const listEl = $('#trophyList');
const emptyEl = $('#emptyState');
const resultEl = $('#resultCount');
const listHeading = $('#listHeading');

function loadSet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((n) => Number.isInteger(n)) : []);
  } catch { return new Set(); }
}
function loadCounters() {
  try {
    const raw = localStorage.getItem(COUNTER_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    const m = new Map();
    if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        const id = Number(k);
        if (Number.isInteger(id) && Number.isInteger(v) && v >= 0) m.set(id, v);
      }
    }
    return m;
  } catch { return new Map(); }
}
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify([...state.earned].sort((a, b) => a - b))); } catch { /* ignore */ }
}
function saveCounters() {
  try { localStorage.setItem(COUNTER_KEY, JSON.stringify(Object.fromEntries(state.counters))); } catch { /* ignore */ }
}
function loadSpoiler() {
  try { return localStorage.getItem(SPOILER_KEY) === '1'; } catch { return false; }
}
function saveSpoiler() {
  try { localStorage.setItem(SPOILER_KEY, state.spoiler ? '1' : '0'); } catch { /* ignore */ }
}
function loadFeatured() {
  try {
    const n = Number(localStorage.getItem(FEATURED_KEY));
    return Number.isInteger(n) && n >= 1 && n <= 55 ? n : 28;
  } catch { return 28; }
}
function saveFeatured() {
  try { localStorage.setItem(FEATURED_KEY, String(state.featuredId)); } catch { /* ignore */ }
}

function gradeLabel(t) { return t.grade; }
function kindLabel(t) {
  return { story: 'Story', collectible: 'Collectible', activity: 'Activity', challenge: 'Challenge' }[t.kind] || t.kind;
}
function statusLabel(t) {
  return { 'possibly-missable': 'Possibly missable', watch: 'Watch', unconfirmed: 'Unconfirmed', cleared: 'Cleared' }[t.status] || t.status;
}
function statusClass(t) {
  return { 'possibly-missable': 'st-missable', watch: 'st-watch', unconfirmed: 'st-unconfirmed', cleared: 'st-cleared' }[t.status] || '';
}
function isSpoilerHidden(t) {
  return state.spoiler && t.hidden && !state.earned.has(t.id);
}
function sourceById(id) {
  return state.sources.find((s) => s.id === id);
}
function citeLinks(cites) {
  return cites.map((c) => {
    const s = sourceById(c);
    const title = s ? escapeAttr(s.name) : ('Source ' + c);
    return '<a class="cite" href="#sourcesPanel" title="' + title + '">[' + c + ']</a>';
  }).join('');
}

function matches(t) {
  const q = state.query.trim().toLowerCase();
  if (q) {
    const hay = `${t.name} ${t.description} ${t.guide} ${t.steps.map((s) => s.text).join(' ')} ${t.kind} ${statusLabel(t)}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  switch (state.filter) {
    case 'all': return true;
    case 'story': return t.kind === 'story';
    case 'possibly-missable': return t.status === 'possibly-missable';
    case 'watch': return t.status === 'watch';
    case 'unconfirmed': return t.status === 'unconfirmed';
    case 'disagree': return !!t.disagree;
    case 'collectible': return t.kind === 'collectible';
    case 'activity': return t.kind === 'activity' || t.kind === 'challenge';
    case 'earned': return state.earned.has(t.id);
    case 'unearned': return !state.earned.has(t.id);
    default: return true;
  }
}

function counterHtml(t) {
  if (!t.counter) return '';
  const n = state.counters.get(t.id) || 0;
  const done = n >= t.counter.target;
  const pct = Math.min(100, Math.round((n / t.counter.target) * 100));
  return '<div class="counter" data-counter="' + t.id + '">' +
    '<span class="counter-label">YOUR COUNT</span>' +
    '<button type="button" class="counter-btn" data-dec="' + t.id + '" aria-label="Decrease count">&minus;</button>' +
    '<strong class="counter-value">' + n + ' / ' + t.counter.target + ' ' + escapeHtml(t.counter.label) + '</strong>' +
    '<button type="button" class="counter-btn" data-inc="' + t.id + '" aria-label="Increase count">+</button>' +
    (done ? '<span class="counter-done">Target reached — mark it earned above.</span>' : '') +
    '<span class="counter-bar"><span style="width:' + pct + '%"></span></span>' +
  '</div>';
}

function disagreeHtml(t) {
  if (!t.disagree) return '';
  return '<div class="disagree"><strong>' + escapeHtml(t.disagree.note) + '</strong><ul>' +
    t.disagree.versions.map((v) => '<li>' + escapeHtml(v) + '</li>').join('') + '</ul></div>';
}

function stepsHtml(t) {
  return '<ol class="steps">' + t.steps.map((s) =>
    '<li>' + escapeHtml(s.text) + ' ' + citeLinks(s.cites) + '</li>').join('') + '</ol>';
}

function sourcesLine(t) {
  return '<p class="sources">Sources: ' + t.sources.map((id) => {
    const s = sourceById(id);
    return s ? '<a href="' + escapeAttr(s.url) + '" target="_blank" rel="noopener">[' + s.id + '] ' + escapeHtml(s.name.split(' — ')[0]) + '</a>' : '[' + id + ']';
  }).join(' &middot; ') + '</p>';
}

function cardHtml(t, featured) {
  const earned = state.earned.has(t.id);
  const hidden = isSpoilerHidden(t);
  const name = hidden ? 'Hidden Trophy' : t.name;
  const desc = hidden ? 'Complete the story to reveal this trophy.' : t.description;
  const guideText = hidden ? 'This is a hidden story trophy. Its name and description stay hidden until you earn it — play the story to reveal it.' : t.guide;
  const statusBadge = t.status !== 'cleared'
    ? '<span class="badge ' + statusClass(t) + '">' + statusLabel(t) + '</span>' : '';
  const disagreeBadge = t.disagree ? '<span class="badge st-disagree">Disagree</span>' : '';
  return '<div class="card-top">' +
    '<label class="check"><input type="checkbox" ' + (earned ? 'checked' : '') + ' aria-label="Mark ' + escapeAttr(name) + ' as earned"></label>' +
    '<div class="card-head">' +
      '<h3 class="card-name"><span class="num">#' + t.id + '</span> ' + escapeHtml(name) + '</h3>' +
      '<p class="card-desc">' + escapeHtml(desc) + '</p>' +
      '<div class="badges">' +
        '<span class="badge ' + t.grade + '">' + gradeLabel(t) + '</span>' +
        '<span class="badge">' + kindLabel(t) + '</span>' +
        statusBadge + disagreeBadge +
        (t.hidden && !hidden ? '<span class="badge hidden-flag">Hidden</span>' : '') +
      '</div>' +
    '</div>' +
  '</div>' +
  '<div class="guide">' +
    '<div class="inshort' + (t.status !== 'cleared' ? ' inshort-' + t.status : '') + '">' +
      '<strong>IN SHORT' + (t.status !== 'cleared' ? ' — ' + statusLabel(t).toUpperCase() : '') + '</strong>' +
      '<p class="guide-prose">' + escapeHtml(guideText) + '</p>' +
    '</div>' +
    (hidden ? '' : counterHtml(t) + stepsHtml(t) + disagreeHtml(t) + sourcesLine(t)) +
  '</div>' +
  (featured ? '' : '<button type="button" class="feature-btn" data-feature="' + t.id + '">Show this guide at the top</button>');
}

function renderFeatured() {
  const t = state.byId.get(state.featuredId) || state.trophies[0];
  if (!t) return;
  const el = $('#featuredCard');
  el.innerHTML = '';
  const card = document.createElement('article');
  card.className = 'card featured-card' + (state.earned.has(t.id) ? ' earned' : '');
  card.dataset.id = t.id;
  card.innerHTML = cardHtml(t, true);
  card.querySelector('input').addEventListener('change', (e) => {
    if (e.target.checked) state.earned.add(t.id); else state.earned.delete(t.id);
    saveStore(); render();
  });
  bindCounters(card);
  el.appendChild(card);
  $('#featuredHeading').textContent = 'Featured guide — #' + t.id + ' ' + t.name;
}

function rowHtml(t) {
  const earned = state.earned.has(t.id);
  const hidden = isSpoilerHidden(t);
  const name = hidden ? 'Hidden Trophy' : t.name;
  const desc = hidden ? 'Hidden until earned.' : t.description;
  const statusBadge = t.status !== 'cleared'
    ? '<span class="badge ' + statusClass(t) + '">' + statusLabel(t) + '</span>' : '';
  const disagreeBadge = t.disagree ? '<span class="badge st-disagree">Disagree</span>' : '';
  return '<label class="check"><input type="checkbox" ' + (earned ? 'checked' : '') + ' aria-label="Mark ' + escapeAttr(name) + ' as earned"></label>' +
    '<div class="row-body">' +
      '<p class="row-name"><span class="num">#' + t.id + '</span> ' + escapeHtml(name) + '</p>' +
      '<p class="row-desc">' + escapeHtml(desc) + '</p>' +
      '<div class="badges">' +
        '<span class="badge ' + t.grade + '">' + gradeLabel(t) + '</span>' +
        '<span class="badge">' + kindLabel(t) + '</span>' +
        statusBadge + disagreeBadge +
        (t.hidden && !hidden ? '<span class="badge hidden-flag">Hidden</span>' : '') +
      '</div>' +
    '</div>';
}

function renderList() {
  const shown = state.trophies.filter(matches);
  listEl.innerHTML = '';
  for (const t of shown) {
    const earned = state.earned.has(t.id);
    const hidden = isSpoilerHidden(t);
    const row = document.createElement('article');
    row.className = 'row' + (earned ? ' earned' : '') + (hidden ? ' spoiler-hidden' : '') + (t.id === state.featuredId ? ' selected' : '');
    row.dataset.id = t.id;
    row.id = 'card-' + t.id;
    row.innerHTML = rowHtml(t);
    row.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) state.earned.add(t.id); else state.earned.delete(t.id);
      saveStore(); render();
    });
    row.addEventListener('click', (e) => {
      if (e.target.closest('input')) return;
      state.featuredId = t.id; saveFeatured(); renderFeatured();
      document.querySelectorAll('#trophyList .row').forEach((r) => r.classList.toggle('selected', Number(r.dataset.id) === t.id));
    });
    listEl.appendChild(row);
  }
  emptyEl.hidden = shown.length !== 0;
  const names = { all: 'All trophies', story: 'Story trophies', 'possibly-missable': 'Possibly missable', watch: 'Watch list', unconfirmed: 'Unconfirmed triggers', disagree: 'Source disagreements', collectible: 'Collectibles', activity: 'Activities', earned: 'Earned trophies', unearned: 'Trophies not earned yet' };
  listHeading.textContent = names[state.filter] || 'All trophies';
  resultEl.textContent = shown.length === state.trophies.length
    ? 'Showing all ' + shown.length + ' trophies.'
    : 'Showing ' + shown.length + ' of ' + state.trophies.length + ' trophies.';
}

function bindCounters(root) {
  root.querySelectorAll('[data-inc]').forEach((btn) => btn.addEventListener('click', () => {
    const id = Number(btn.dataset.inc);
    state.counters.set(id, (state.counters.get(id) || 0) + 1);
    saveCounters(); render();
  }));
  root.querySelectorAll('[data-dec]').forEach((btn) => btn.addEventListener('click', () => {
    const id = Number(btn.dataset.dec);
    state.counters.set(id, Math.max(0, (state.counters.get(id) || 0) - 1));
    saveCounters(); render();
  }));
}

function renderFilters() {
  const counts = {
    all: state.trophies.length,
    story: state.trophies.filter((t) => t.kind === 'story').length,
    'possibly-missable': state.trophies.filter((t) => t.status === 'possibly-missable').length,
    watch: state.trophies.filter((t) => t.status === 'watch').length,
    unconfirmed: state.trophies.filter((t) => t.status === 'unconfirmed').length,
    disagree: state.trophies.filter((t) => t.disagree).length,
    collectible: state.trophies.filter((t) => t.kind === 'collectible').length,
    activity: state.trophies.filter((t) => t.kind === 'activity' || t.kind === 'challenge').length,
    earned: state.earned.size,
    unearned: state.trophies.length - state.earned.size,
  };
  const defs = [
    ['all', 'All'], ['story', 'Story'], ['possibly-missable', 'Possibly missable'],
    ['watch', 'Watch'], ['unconfirmed', 'Unconfirmed'], ['disagree', 'Disagree'],
    ['collectible', 'Collectibles'], ['activity', 'Activities'],
    ['earned', 'Earned'], ['unearned', 'Not earned'],
  ];
  const wrap = $('#filters');
  wrap.innerHTML = '';
  for (const [key, label] of defs) {
    const b = document.createElement('button');
    b.dataset.filter = key;
    b.className = state.filter === key ? 'active' : '';
    b.textContent = label + ' ' + counts[key];
    b.addEventListener('click', () => { state.filter = key; render(); });
    wrap.appendChild(b);
  }
}

function renderAudit() {
  const totalSteps = state.trophies.reduce((n, t) => n + t.steps.length, 0);
  const citedSteps = state.trophies.reduce((n, t) => n + t.steps.filter((s) => s.cites && s.cites.length).length, 0);
  const guided = state.trophies.filter((t) => t.sources && t.sources.length >= 2).length;
  const pm = state.trophies.filter((t) => t.status === 'possibly-missable').length;
  const watch = state.trophies.filter((t) => t.status === 'watch').length;
  const unc = state.trophies.filter((t) => t.status === 'unconfirmed').length;
  const single = state.trophies.filter((t) => t.sources.length < 2).length;
  const dis = state.trophies.filter((t) => t.disagree).length;
  const citedBy = state.sources.map((s) => {
    const n = state.trophies.filter((t) => t.sources.includes(s.id)).length;
    return '[' + s.id + '] ' + n + '/55';
  }).join(' &middot; ');
  const citedNames = state.sources.map((s) => '[' + s.id + '] ' + escapeHtml(s.name.split(' — ')[0])).join(' &middot; ');
  $('#auditStrip').innerHTML =
    '<strong>AUDIT</strong> 55 official &middot; 1P 2G 6S 46B &middot; 28 hidden &middot; ' +
    guided + '/55 guides cite a source &middot; ' + citedSteps + '/' + totalSteps + ' steps cited &middot; ' +
    state.sources.length + ' sources read 20 Nov 2026 &middot; ' +
    pm + ' possibly missable &middot; ' + watch + ' watch &middot; ' + unc + ' unconfirmed &middot; ' +
    single + ' single-source &middot; ' + dis + ' disagree' +
    '<div class="citedby">CITED BY ' + citedBy + ' — ' + citedNames + '</div>';
}

function renderProgress() {
  const earned = state.earned.size;
  const total = state.trophies.length || 55;
  const pct = total ? Math.round((earned / total) * 100) : 0;
  const points = state.trophies.reduce((sum, t) => sum + (state.earned.has(t.id) ? (POINTS[t.grade] || 0) : 0), 0);
  const g = (grade) => state.trophies.filter((t) => t.grade === grade && state.earned.has(t.id)).length;
  const tot = (grade) => state.trophies.filter((t) => t.grade === grade).length;
  $('#earnedCount').textContent = earned;
  $('#progressPct').textContent = pct + '%';
  $('#pointsText').textContent = points + ' points';
  $('#progressFill').style.width = pct + '%';
  $('#gradeProgress').textContent = 'P ' + g('platinum') + '/' + tot('platinum') + ' · G ' + g('gold') + '/' + tot('gold') + ' · S ' + g('silver') + '/' + tot('silver') + ' · B ' + g('bronze') + '/' + tot('bronze');
}

function roadmapOrder() {
  const order = [];
  for (const stage of state.roadmap) for (const id of stage.trophies) order.push(id);
  return order;
}

function renderRoadmap() {
  const stagesEl = $('#stages');
  stagesEl.innerHTML = '';
  for (const stage of state.roadmap) {
    const earned = stage.trophies.filter((id) => state.earned.has(id)).length;
    const li = document.createElement('li');
    li.innerHTML = '<h3>Stage ' + stage.stage + ' — ' + escapeHtml(stage.title) +
      ' <span class="stage-count">' + earned + '/' + stage.trophies.length + ' earned</span></h3>' +
      '<p>' + escapeHtml(stage.text) + '</p>' +
      '<div class="chips">' + stage.trophies.map((id) => {
        const t = state.byId.get(id);
        const e = state.earned.has(id);
        return '<button type="button" class="chip' + (e ? ' chip-earned' : '') + '" data-chip="' + id + '">' +
          '#' + id + ' ' + escapeHtml(t ? t.name : '') + (e ? ' ✓' : '') + '</button>';
      }).join('') + '</div>';
    stagesEl.appendChild(li);
  }
  stagesEl.querySelectorAll('[data-chip]').forEach((b) => b.addEventListener('click', () => {
    const id = Number(b.dataset.chip);
    state.featuredId = id; saveFeatured(); renderFeatured();
    state.filter = 'all'; state.query = ''; const si = $('#search'); if (si) si.value = '';
    render();
    const card = document.getElementById('card-' + id);
    if (card) card.scrollIntoView({ block: 'center' });
  }));
  const next = roadmapOrder().filter((id) => !state.earned.has(id)).slice(0, 5);
  const nextEl = $('#nextUp');
  nextEl.innerHTML = '<h3>Next up</h3>' + (next.length
    ? '<ol class="nextup-list">' + next.map((id) => {
        const t = state.byId.get(id);
        return '<li><button type="button" class="nextup-btn" data-next="' + id + '">#' + id + ' ' + escapeHtml(t.name) +
          (t.status !== 'cleared' ? ' — ' + statusLabel(t) : '') + '</button></li>';
      }).join('') + '</ol>'
    : '<p>All 55 earned — the platinum is yours.</p>');
  nextEl.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', () => {
    const id = Number(b.dataset.next);
    state.featuredId = id; saveFeatured(); renderFeatured();
    $('#featured').scrollIntoView({ block: 'start' });
  }));
}

function renderSources() {
  const counts = new Map();
  for (const t of state.trophies) for (const id of new Set(t.sources)) counts.set(id, (counts.get(id) || 0) + 1);
  const el = $('#sourcesList');
  el.innerHTML = '<table class="source-table"><thead><tr><th>#</th><th>Source</th><th>Read</th><th>Cited by</th></tr></thead><tbody>' +
    state.sources.map((s) =>
      '<tr><td>[' + s.id + ']</td><td><a href="' + escapeAttr(s.url) + '" target="_blank" rel="noopener">' + escapeHtml(s.name) + '</a><div class="src-url">' + escapeHtml(s.url) + '</div></td>' +
      '<td>' + escapeHtml(s.read) + '</td><td>' + (counts.get(s.id) || 0) + ' of 55 guides</td></tr>').join('') +
    '</tbody></table>';
}

function render() {
  renderAudit();
  renderProgress();
  renderFilters();
  renderFeatured();
  renderList();
  renderRoadmap();
  renderSources();
  document.body.classList.toggle('spoiler-on', state.spoiler);
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

function exportProgress() {
  const payload = { app: 'gta6-trophy-guide', version: 2, exportedAt: new Date().toISOString(), earned: [...state.earned].sort((a, b) => a - b), counters: Object.fromEntries(state.counters), spoiler: state.spoiler };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gta6-trophy-progress.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function importProgress(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      const arr = Array.isArray(data) ? data : data.earned;
      if (!Array.isArray(arr)) throw new Error('no earned list');
      const ids = new Set(arr.filter((n) => Number.isInteger(n) && n >= 1 && n <= 55));
      state.earned = ids;
      if (data && data.counters && typeof data.counters === 'object') {
        const m = new Map();
        for (const [k, v] of Object.entries(data.counters)) {
          const id = Number(k);
          if (Number.isInteger(id) && Number.isInteger(v) && v >= 0) m.set(id, v);
        }
        state.counters = m;
      }
      saveStore(); saveCounters(); render();
    } catch { alert('That file is not a valid progress export.'); }
  };
  reader.readAsText(file);
}

async function init() {
  state.earned = loadSet(STORE_KEY);
  state.counters = loadCounters();
  state.spoiler = loadSpoiler();
  state.featuredId = loadFeatured();
  const res = await fetch(DATA_URL);
  const data = await res.json();
  state.trophies = (data.trophies || data).slice().sort((a, b) => a.id - b.id);
  state.sources = data.sources || [];
  state.roadmap = data.roadmap || [];
  for (const t of state.trophies) state.byId.set(t.id, t);
  if (!state.byId.has(state.featuredId)) state.featuredId = 28;

  $('#spoilerToggle').checked = state.spoiler;
  $('#spoilerToggle').addEventListener('change', (e) => { state.spoiler = e.target.checked; saveSpoiler(); render(); });
  $('#search').addEventListener('input', (e) => { state.query = e.target.value; render(); });
  $('#exportBtn').addEventListener('click', exportProgress);
  $('#importFile').addEventListener('change', (e) => { if (e.target.files[0]) importProgress(e.target.files[0]); e.target.value = ''; });
  $('#resetBtn').addEventListener('click', () => {
    if (confirm('Clear all earned trophies, counters and the spoiler setting on this device?')) {
      state.earned = new Set();
      state.counters = new Map();
      state.spoiler = false;
      $('#spoilerToggle').checked = false;
      saveStore(); saveCounters(); saveSpoiler(); render();
    }
  });

  render();

  // Deep link: #trophy-<id> features that trophy's guide and scrolls to it.
  const m = location.hash.match(/^#trophy-(\d+)$/);
  if (m) {
    const id = Number(m[1]);
    if (state.byId.has(id)) {
      state.featuredId = id; saveFeatured(); renderFeatured();
      const card = document.getElementById('card-' + id);
      if (card) card.scrollIntoView({ block: 'center' });
    }
  }
}

init().catch((err) => {
  listEl.innerHTML = '<p class="empty">Could not load the trophy list. Open this app from its own files (it needs no network, but the data file must sit beside it).</p>';
  console.error(err);
});
