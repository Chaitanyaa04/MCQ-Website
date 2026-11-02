'use strict';
const ENV = { itt: ['ITT Practice', 'Information Technology', 'data/itt.json'], ca: ['CA Practice', 'Subjects and chapters', 'data/ca.json'] };
const KEY = 'studyspace-v1', DAY = 864e5, REF = /\b(both|all of|none|neither|above|these)\b/i;
const app = document.getElementById('app');

/* Safe DOM builder: text is always added as text nodes, never parsed as HTML. */
const h = (t, p, ...c) => {
  const e = document.createElement(t);
  for (const k in p || {}) k.startsWith('on') ? e.addEventListener(k.slice(2), p[k]) : e.setAttribute(k, p[k]);
  c.flat().filter(x => x != null && x !== false).forEach(x => e.append(x));
  return e;
};
const shuf = a => { a = a.slice(); for (let i = a.length - 1; i; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const dk = () => new Date().toLocaleDateString('en-CA');
const num = (x, d) => Number.isFinite(+x) ? +x : d;

/* Every load and every import is rebuilt field by field, so bad data cannot get in. */
function clean(o) {
  const d = { v: 1, theme: o && (o.theme === 'dark' || o.theme === 'light') ? o.theme : '', goal: Math.min(500, Math.max(1, num(o && o.goal, 30))), days: {}, itt: {}, ca: {} };
  if (!o || typeof o !== 'object') return d;
  for (const k in o.days || {}) if (/^\d{4}-\d\d-\d\d$/.test(k)) d.days[k] = num(o.days[k], 0);
  for (const e of ['itt', 'ca']) for (const id in o[e] || {}) {
    const r = o[e][id];
    if (/^[\w-]{1,20}$/.test(id) && id !== '__proto__' && r && typeof r === 'object')
      d[e][id] = { iv: num(r.iv, 0), ease: Math.min(3, Math.max(1.3, num(r.ease, 2.5))), due: num(r.due, 0), miss: num(r.miss, 0), n: num(r.n, 0), w: r.w ? 1 : 0, bm: r.bm ? 1 : 0 };
  }
  return d;
}
let db; try { db = clean(JSON.parse(localStorage.getItem(KEY))); } catch (e) { db = clean(null); }
let env = null, bank = [];
let user = false, syncT = 0;
const api = (p, m, b) => fetch('/api/' + p, { method: m, headers: { 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined, credentials: 'same-origin' }).then(r => r.ok ? r.json() : Promise.reject(r.status));
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('Could not save here. Export a backup.'); } if (user) { clearTimeout(syncT); syncT = setTimeout(() => api('data', 'PUT', db).catch(() => {}), 1500); } };
function merge(s) { s = clean(s); for (const k in s.days) db.days[k] = Math.max(db.days[k] || 0, s.days[k]); for (const e of ['itt', 'ca']) for (const id in s[e]) if (!db[e][id] || s[e][id].n > db[e][id].n) db[e][id] = s[e][id]; db.theme = db.theme || s.theme; }
const rec = id => db[env][id] || (db[env][id] = { iv: 0, ease: 2.5, due: 0, miss: 0, n: 0, w: 0, bm: 0 });
function theme() { document.documentElement.dataset.theme = db.theme || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'); }
function toast(m) { const t = h('div', { class: 'toast', role: 'status' }, m); document.body.append(t); setTimeout(() => t.remove(), 3000); }

/* Question files are validated before use. */
function validBank(a) {
  return Array.isArray(a) ? a.filter(q => q && typeof q.id === 'string' && typeof q.q === 'string' && Array.isArray(q.o) && q.o.length === 4 && Number.isInteger(q.a) && q.a >= 0 && q.a < 4)
    .map(q => ({ id: q.id.slice(0, 20), ch: String(q.ch || 'General').slice(0, 60), q: q.q.slice(0, 1000), o: q.o.map(x => String(x).slice(0, 400)), a: q.a, e: String(q.e || '').slice(0, 1000) })) : [];
}

/* Spaced repetition. Grades: 0 Again, 1 Hard, 2 Good, 3 Easy. (SM-2 style; see notes about FSRS.) */
function grade(id, g) {
  const r = rec(id), now = Date.now(); r.n++;
  if (!g) { r.iv = 0; r.due = now + 6e5; r.ease = Math.max(1.3, r.ease - .2); r.miss++; r.w = 1; }
  else {
    r.w = 0; r.ease = Math.min(3, r.ease + (g === 3 ? .1 : g === 1 ? -.1 : 0));
    r.iv = r.iv ? Math.max(1, r.iv * r.ease * [0, .8, 1, 1.3][g]) : [0, 1, 2, 4][g];
    r.due = now + r.iv * DAY;
  }
  db.days[dk()] = (db.days[dk()] || 0) + 1; save();
}

const head = () => h('header', { class: 'top' }, h('b', { class: 'brand' }, 'StudySpace'),
  user && h('button', { class: 'ic', 'aria-label': 'My profile', onclick: profile }, avatar()),
  h('button', { class: 'ic', 'aria-label': 'Switch light or dark theme', onclick: () => { db.theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; theme(); save(); } }, '◐'));

function backup() {
  return h('div', { class: 'row' },
    h('button', { class: 'ghost', onclick: () => { const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(db)], { type: 'application/json' })), download: 'studyspace-backup-' + dk() + '.json' }); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); } }, 'Export backup'),
    h('label', { class: 'ghost' }, 'Import backup', h('input', { type: 'file', accept: '.json', class: 'hid', onchange: e => {
      const f = e.target.files[0]; if (!f || f.size > 5e6) return toast('Missing or too large.');
      f.text().then(t => { db = clean(JSON.parse(t)); save(); theme(); toast('Restored.'); env ? home() : pick(); }).catch(() => toast('Not a valid backup.'));
    } })));
}

function pick() {
  env = null;
  app.replaceChildren(head(), h('h1', {}, 'What are we studying today?'),
    h('div', { class: 'grid' }, Object.keys(ENV).map(k => h('button', { class: 'card', onclick: () => open(k) }, h('b', {}, ENV[k][0]), h('span', {}, ENV[k][1])))), account(), backup());
}
async function open(k) {
  env = k; api('hit', 'POST', { env: k }).catch(() => {});
  try { const r = await fetch(ENV[k][2], { credentials: 'omit' }); if (!r.ok) throw 0; bank = validBank(await r.json()); } catch (e) { bank = []; }
  home();
}

function home() {
  const S = db[env], now = Date.now(), today = db.days[dk()] || 0;
  const ids = f => bank.filter(q => S[q.id] && f(S[q.id])).map(q => q.id);
  const due = ids(r => r.n && r.due <= now), mis = ids(r => r.w), bms = ids(r => r.bm);
  const chs = [...new Set(bank.map(q => q.ch))];
  const sel = h('select', { 'aria-label': 'Chapter' }, h('option', { value: '' }, 'All chapters (' + bank.length + ')'), chs.map(c => h('option', { value: c }, c)));
  const pool = () => bank.filter(q => !sel.value || q.ch === sel.value).map(q => q.id);
  const bar = h('div', { class: 'bar' }, h('i', {})); bar.firstChild.style.width = Math.min(100, today / db.goal * 100) + '%';
  const go = (list, mode) => () => list.length ? run(list, mode) : toast('Nothing here yet.');
  app.replaceChildren(head(), h('h2', {}, ENV[env][0]),
    !bank.length && h('p', { class: 'panel' }, 'No questions loaded yet. Add them to ' + ENV[env][2] + '.'),
    h('div', { class: 'panel' }, h('small', {}, 'Revision due'), h('div', { class: 'big' }, due.length + ' cards'),
      h('button', { class: 'btn', disabled: due.length ? null : 'disabled', onclick: go(due, 'card') }, 'Review now'),
      h('p', {}, h('small', {}, 'Daily goal: ' + today + ' / ' + db.goal)), bar),
    h('div', { class: 'panel' }, sel,
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => go(shuf(pool()).slice(0, 20), 'mcq')() }, 'Practice 20 MCQs'),
        h('button', { class: 'ghost', onclick: () => go(shuf(pool()).slice(0, 20), 'card')() }, 'Flashcards'))),
    h('div', { class: 'panel' }, h('div', { class: 'row' },
      h('button', { class: 'ghost', onclick: go(mis, 'mcq') }, 'Mistake notebook (' + mis.length + ')'),
      h('button', { class: 'ghost', onclick: go(bms, 'mcq') }, 'Bookmarks (' + bms.length + ')'))),
    h('div', { class: 'row' }, h('button', { class: 'ghost', onclick: pick }, '← Switch environment')), backup());
}

function run(ids, mode) {
  const qs = shuf(ids).map(id => bank.find(q => q.id === id)).filter(Boolean); let i = 0, ok = 0;
  const step = () => {
    if (i >= qs.length) return app.replaceChildren(head(), h('h2', {}, 'Done: ' + ok + ' / ' + qs.length), h('button', { class: 'btn', onclick: home }, 'Home'));
    const q = qs[i], r = rec(q.id), out = h('div', {}), nxt = () => { i++; step(); };
    const bar = h('div', { class: 'bar' }, h('i', {})); bar.firstChild.style.width = i / qs.length * 100 + '%';
    const bm = h('button', { class: 'ghost', onclick: e => { r.bm = r.bm ? 0 : 1; save(); e.target.textContent = r.bm ? '★ Bookmarked' : '☆ Bookmark'; } }, r.bm ? '★ Bookmarked' : '☆ Bookmark');
    const expl = [q.e && h('p', {}, q.e)];
    if (mode === 'mcq') {
      const ord = q.o.some(o => REF.test(o)) ? [0, 1, 2, 3] : shuf([0, 1, 2, 3]);
      const bs = ord.map((oi, p) => h('button', { class: 'opt', onclick: () => {
        bs.forEach((b, x) => { b.disabled = true; if (ord[x] === q.a) b.classList.add('ok'); });
        const good = oi === q.a; if (!good) bs[p].classList.add('bad'); if (good) ok++; grade(q.id, good ? 2 : 0);
        out.append(h('p', { class: 'fb' }, good ? 'Correct.' : 'Answer: ' + q.o[q.a]), ...expl, h('button', { class: 'btn', onclick: nxt }, i + 1 < qs.length ? 'Next' : 'Finish'));
      } }, 'ABCD'[p] + '. ' + q.o[oi]));
      out.append(...bs);
    } else {
      out.append(h('button', { class: 'btn', onclick: e => { e.target.remove();
        out.append(h('p', { class: 'fb' }, q.o[q.a]), ...expl, h('div', { class: 'row' }, ['Again', 'Hard', 'Good', 'Easy'].map((l, g) => h('button', { class: 'btn', onclick: () => { grade(q.id, g); if (g) ok++; nxt(); } }, l))));
      } }, 'Show answer'));
    }
    app.replaceChildren(head(), h('button', { class: 'ghost', onclick: home }, '← Exit'), bar, h('div', { class: 'q' }, h('small', {}, q.ch + ' · ' + (i + 1) + '/' + qs.length), h('p', { class: 'qt' }, q.q), out), bm);
  };
  step();
}
function account() {
  if (user) return h('div', { class: 'panel' }, h('small', {}, '✓ Progress is saved to your study code'), h('div', {}, h('button', { class: 'ghost', onclick: profile }, 'My profile')));
  const inp = h('input', { type: 'text', class: 'inp', placeholder: 'e.g. mango-tiger-orbit-river-42', autocomplete: 'off', maxlength: '60', 'aria-label': 'Study code' });
  return h('div', { class: 'panel' }, h('b', {}, 'Save your progress'), h('p', {}, h('small', {}, 'Get a study code to continue on any device. No email or password.')),
    h('button', { class: 'btn', onclick: () => api('join', 'POST', {}).then(r => { user = true; remember(r.code); save(); showCode(r.code); }).catch(() => toast('Please try again later.')) }, 'Create my study code'),
    inp, h('button', { class: 'ghost', onclick: () => api('login', 'POST', { code: inp.value }).then(() => api('data', 'GET')).then(d => { user = true; remember(inp.value); merge(d); save(); toast('Welcome back!'); pick(); }).catch(c => toast(c === 429 ? 'Too many tries. Wait a few minutes.' : 'Code not found.')) }, 'Continue'));
}
function showCode(c) {
  app.replaceChildren(head(), h('div', { class: 'panel' }, h('h2', {}, 'Your study code'), h('p', { class: 'big code' }, c),
    h('p', {}, 'This is your key. Anyone who has it can open your progress, and it cannot be recovered, so save it now.'),
    h('button', { class: 'ghost', onclick: () => navigator.clipboard && navigator.clipboard.writeText(c).then(() => toast('Copied.')) }, 'Copy'),
    h('button', { class: 'ghost', onclick: () => { const a = h('a', { href: URL.createObjectURL(new Blob(['StudySpace study code: ' + c], { type: 'text/plain' })), download: 'studyspace-code.txt' }); a.click(); } }, 'Download'),
    h('button', { class: 'btn', onclick: pick }, 'I have saved it')));
}
theme(); pick();
api('hit', 'POST', {}).catch(() => {});
const CK = 'studyspace-code';
function remember(c) { try { localStorage.setItem(CK, String(c).trim().toLowerCase().slice(0, 60)); } catch (e) {} }
function avatar() { const c = localStorage.getItem(CK) || '?'; let n = 0; for (const ch of c) n += ch.charCodeAt(0); return ['🦊', '🐼', '🦉', '🐯', '🐙', '🦋', '🐳', '🦄', '🐲', '🐸', '🦁', '🐧', '🐨', '🦖', '🐝', '🦈'][n % 16]; }
function profile() {
  const c = localStorage.getItem(CK) || '', days = Object.keys(db.days).length, qs = Object.values(db.days).reduce((a, x) => a + x, 0);
  const code = h('p', { class: 'big code' }, '••••••••••••'); let vis = 0;
  const link = location.origin + location.pathname + '#c=' + encodeURIComponent(c);
  const copy = (t, m) => navigator.clipboard && navigator.clipboard.writeText(t).then(() => toast(m));
  app.replaceChildren(head(), h('button', { class: 'ghost', onclick: pick }, '← Back'),
    h('div', { class: 'panel' }, h('div', { class: 'big' }, avatar()), h('h2', {}, 'My profile'), h('small', {}, qs + ' questions answered · ' + days + ' study days')),
    h('div', { class: 'panel' }, h('b', {}, 'My study code'),
      c ? [code, h('button', { class: 'ghost', onclick: e => { vis = !vis; code.textContent = vis ? c : '••••••••••••'; e.target.textContent = vis ? 'Hide' : 'Show'; } }, 'Show'),
        h('button', { class: 'ghost', onclick: () => copy(c, 'Code copied.') }, 'Copy code'),
        h('button', { class: 'btn', onclick: () => copy(link, 'Login link copied. Open it on your other device.') }, 'Copy login link'),
        h('p', {}, h('small', {}, 'On a new device, open the login link (send it to yourself on WhatsApp or email) or type the code once. Treat the link like a password.'))]
        : h('p', {}, 'Your code is not stored on this device. Log out and sign in once with your code and it will appear here.')),
    h('button', { class: 'ghost', onclick: () => { if (confirm('Log out? You will need your study code to get back in.')) api('logout', 'POST', {}).finally(() => { try { localStorage.removeItem(CK); } catch (e) {} user = false; pick(); }); } }, 'Log out'));
}
function bootLogin() {
  const m = /^#c=([\w%-]{3,90})$/.exec(location.hash); let code = '';
  if (m) { try { code = decodeURIComponent(m[1]); } catch (e) {} history.replaceState(null, '', location.pathname); }
  const done = d => { user = true; if (code) remember(code); merge(d); save(); if (code) toast('Welcome back!'); if (!env) pick(); };
  (code ? api('login', 'POST', { code }).then(() => api('data', 'GET')) : api('data', 'GET')).then(done).catch(() => { if (code) toast('That login link did not work.'); });
}
bootLogin();
