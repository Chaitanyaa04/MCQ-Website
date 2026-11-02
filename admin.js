'use strict';
const app = document.getElementById('app');
const h = (t, p, ...c) => { const e = document.createElement(t); for (const k in p || {}) k.startsWith('on') ? e.addEventListener(k.slice(2), p[k]) : e.setAttribute(k, p[k]); c.flat().filter(x => x != null).forEach(x => e.append(x)); return e; };
const stat = (l, v) => h('div', { class: 'panel' }, h('small', {}, l), h('div', { class: 'big' }, String(v)));
function login() {
  const k = h('input', { type: 'password', class: 'inp', placeholder: 'Admin key', autocomplete: 'off', 'aria-label': 'Admin key' });
  app.replaceChildren(h('h1', {}, 'Admin'), k, h('button', { class: 'btn', onclick: () => load(k.value) }, 'Open dashboard'));
}
function load(key) {
  fetch('/api/admin', { headers: { 'x-admin-key': key } }).then(r => r.ok ? r.json() : Promise.reject(r.status)).then(d => {
    const max = Math.max(1, ...d.daily.map(x => x.c));
    app.replaceChildren(h('h1', {}, 'StudySpace admin'),
      h('div', { class: 'grid' }, stat('Visitors today', d.today), stat('Visitors, 7 days', d.week), stat('Visitors, 30 days', d.month),
        stat('Students with a code', d.students), stat('Active in 7 days', d.active7), stat('New in 24 hours', d.new24h), stat('Questions answered (synced)', d.answered)),
      h('div', { class: 'panel' }, h('b', {}, 'Visitors by environment (7 days)'), d.byEnv.map(e => h('p', {}, ({ itt: 'ITT Practice', ca: 'CA Practice' }[e.env] || 'Home only') + ': ' + e.c))),
      h('div', { class: 'panel' }, h('b', {}, 'Daily visitors, last 14 days'), d.daily.map(x => { const b = h('div', { class: 'bar' }, h('i', {})); b.firstChild.style.width = x.c / max * 100 + '%'; return h('div', {}, h('small', {}, x.day + ' · ' + x.c), b); })),
      h('button', { class: 'ghost', onclick: () => load(key) }, 'Refresh'));
  }).catch(s => { login(); app.append(h('p', {}, s === 429 ? 'Locked for a few minutes.' : 'Wrong key.')); });
}
login();
