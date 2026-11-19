// GTA VI Trophy Guide & Tracker — static, offline, no network requests.
// Loads data/trophies.json (a file of this app), renders the checklist,
// and keeps progress in localStorage on this device only.
const DATA_URL = 'data/trophies.json';
const STORE_KEY = 'gta6-trophy-guide-progress-v1';
const SPOILER_KEY = 'gta6-trophy-guide-spoiler-v1';
const POINTS = { platinum: 300, gold: 90, silver: 30, bronze: 15 };

const state = {
  trophies: [],
  earned: new Set(),
  spoiler: false,
  filter: 'all',
  query: '',
};

const $ = (s) => document.querySelector(s);
const listEl = $('#trophyList');
const emptyEl = $('#emptyState');
const resultEl = $('#resultCount');
const listHeading = $('#listHeading');

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((n) => Number.isInteger(n)) : []);
  } catch { return new Set(); }
}
function saveStore() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify([...state.earned].sort((a, b) => a - b))); } catch { /* storage unavailable */ }
}
function loadSpoiler() {
  try { return localStorage.getItem(SPOILER_KEY) === '1'; } catch { return false; }
}
function saveSpoiler() {
  try { localStorage.setItem(SPOILER_KEY, state.spoiler ? '1' : '0'); } catch { /* ignore */ }
}

function gradeLabel(t) { return t.grade; }
function kindLabel(t) {
  return { story: 'Story', collectible: 'Collectible', activity: 'Activity', challenge: 'Challenge' }[t.kind] || t.kind;
}

function isSpoilerHidden(t) {
  return state.spoiler && t.hidden && !state.earned.has(t.id);
}

function matches(t) {
  const q = state.query.trim().toLowerCase();
  if (q) {
    const hay = `${t.name} ${t.description} ${t.guide} ${t.kind}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  switch (state.filter) {
    case 'all': return true;
    case 'story': return t.kind === 'story';
    case 'missable': return !!t.missable;
    case 'collectible': return t.kind === 'collectible';
    case 'activity': return t.kind === 'activity' || t.kind === 'challenge';
    case 'online': return t.kind === 'online';
    case 'earned': return state.earned.has(t.id);
    case 'unearned': return !state.earned.has(t.id);
    default: return true;
  }
}

function render() {
  const shown = state.trophies.filter(matches);
  listEl.innerHTML = '';
  for (const t of shown) {
    const earned = state.earned.has(t.id);
    const hidden = isSpoilerHidden(t);
    const card = document.createElement('article');
    card.className = 'card' + (earned ? ' earned' : '') + (hidden ? ' spoiler-hidden' : '');
    card.dataset.id = t.id;

    const name = hidden ? 'Hidden Trophy' : t.name;
    const desc = hidden ? 'Complete the story to reveal this trophy.' : t.description;
    const guideText = hidden ? 'This is a hidden story trophy. Its name and description stay hidden until you earn it — play the story to reveal it.' : t.guide;

    card.innerHTML =
      '<div class="card-top">' +
        '<label class="check"><input type="checkbox" ' + (earned ? 'checked' : '') + ' aria-label="Mark ' + escapeAttr(name) + ' as earned"></label>' +
        '<div class="card-head">' +
          '<h3 class="card-name"><span class="num">#' + t.id + '</span> ' + escapeHtml(name) + '</h3>' +
          '<p class="card-desc">' + escapeHtml(desc) + '</p>' +
          '<div class="badges">' +
            '<span class="badge ' + t.grade + '">' + gradeLabel(t) + '</span>' +
            '<span class="badge">' + kindLabel(t) + '</span>' +
            (t.missable ? '<span class="badge missable">Missable</span>' : '') +
            (t.hidden && !hidden ? '<span class="badge hidden-flag">Hidden</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      '<details class="guide"><summary>Guide &amp; sources</summary>' +
        '<p>' + escapeHtml(guideText) + '</p>' +
        (hidden ? '' : '<p class="sources">Sources: ' + t.sources.map((s) => '<a href="' + escapeAttr(s.url) + '" target="_blank" rel="noopener">' + escapeHtml(s.name) + '</a>').join(' &middot; ') + '</p>') +
      '</details>';

    card.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) state.earned.add(t.id); else state.earned.delete(t.id);
      saveStore();
      render();
    });
    listEl.appendChild(card);
  }
  emptyEl.hidden = shown.length !== 0;
  updateProgress();
  const names = { all: 'All trophies', story: 'Story trophies', missable: 'Missable trophies', collectible: 'Collectibles', activity: 'Activities', online: 'Online trophies', earned: 'Earned trophies', unearned: 'Trophies not earned yet' };
  listHeading.textContent = names[state.filter] || 'All trophies';
  resultEl.textContent = shown.length === state.trophies.length
    ? 'Showing all ' + shown.length + ' trophies.'
    : 'Showing ' + shown.length + ' of ' + state.trophies.length + ' trophies.';
  document.body.classList.toggle('spoiler-on', state.spoiler);
}

function updateProgress() {
  const earned = state.earned.size;
  const total = state.trophies.length || 55;
  const pct = total ? Math.round((earned / total) * 100) : 0;
  const points = state.trophies.reduce((sum, t) => sum + (state.earned.has(t.id) ? (POINTS[t.grade] || 0) : 0), 0);
  $('#earnedCount').textContent = earned;
  $('#progressPct').textContent = pct + '%';
  $('#pointsText').textContent = points + ' points';
  $('#progressFill').style.width = pct + '%';
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }

function exportProgress() {
  const payload = { app: 'gta6-trophy-guide', version: 1, exportedAt: new Date().toISOString(), earned: [...state.earned].sort((a, b) => a - b), spoiler: state.spoiler };
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
      saveStore();
      render();
    } catch { alert('That file is not a valid progress export.'); }
  };
  reader.readAsText(file);
}

async function init() {
  state.earned = loadStore();
  state.spoiler = loadSpoiler();
  const res = await fetch(DATA_URL);
  const data = await res.json();
  state.trophies = (data.trophies || data).slice().sort((a, b) => a.id - b.id);

  $('#spoilerToggle').checked = state.spoiler;
  $('#spoilerToggle').addEventListener('change', (e) => { state.spoiler = e.target.checked; saveSpoiler(); render(); });
  $('#search').addEventListener('input', (e) => { state.query = e.target.value; render(); });
  document.querySelectorAll('#filters button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#filters button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter = btn.dataset.filter;
      render();
    });
  });
  $('#exportBtn').addEventListener('click', exportProgress);
  $('#importFile').addEventListener('change', (e) => { if (e.target.files[0]) importProgress(e.target.files[0]); e.target.value = ''; });
  $('#resetBtn').addEventListener('click', () => {
    if (confirm('Clear all earned trophies and the spoiler setting on this device?')) {
      state.earned = new Set();
      state.spoiler = false;
      $('#spoilerToggle').checked = false;
      saveStore(); saveSpoiler(); render();
    }
  });

  render();

  // Deep link: #trophy-<id> opens that trophy's guide.
  const m = location.hash.match(/^#trophy-(\d+)$/);
  if (m) {
    const card = listEl.querySelector(`[data-id="${Number(m[1])}"]`);
    if (card) {
      card.scrollIntoView({ block: 'center' });
      const d = card.querySelector('details');
      if (d) d.open = true;
    }
  }
}

init().catch((err) => {
  listEl.innerHTML = '<p class="empty">Could not load the trophy list. Open this app from its own files (it needs no network, but the data file must sit beside it).</p>';
  console.error(err);
});
