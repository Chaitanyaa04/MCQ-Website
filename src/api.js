// StudySpace API (Cloudflare Pages Function + D1). Secrets needed: PEPPER, ADMIN_KEY. Binding: DB.
const W = 'amber anchor apple arrow aspen atlas badge bamboo beacon berry birch bison breeze cactus canyon cedar cloud cobalt comet coral cosmos daisy delta dune eagle ember falcon fern fjord flame forest galaxy garnet glacier harbor hazel iris island jade jaguar juniper kite lagoon lemon lotus lunar maple meadow mango nectar ocean olive orbit otter panda pearl pine planet quartz raven river sailor tiger violet willow zephyr'.split(' ');
const rnd = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
const J = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...h } });
const mk = () => [0, 0, 0].map(() => W[rnd(W.length)]).join('-') + '-' + String(rnd(100)).padStart(2, '0');

export async function onRequest({ request: rq, env }) {
  const DB = env.DB, m = rq.method, p = new URL(rq.url).pathname.replace(/^\/api\//, '');
  if (!env.PEPPER || !env.ADMIN_KEY) return J({ error: 'not configured' }, 500);
  if (m !== 'GET' && !(rq.headers.get('content-type') || '').includes('application/json')) return J({ error: 'bad request' }, 400);
  const ip = rq.headers.get('cf-connecting-ip') || '', now = Date.now(), day = new Date().toISOString().slice(0, 10);
  const body = async () => { try { const t = await rq.text(); return t.length > 3e5 ? null : JSON.parse(t); } catch { return null; } };
  const rl = async (k, max, win) => {
    const key = k + await sha(ip + env.PEPPER), r = await DB.prepare('SELECT n,t FROM tries WHERE k=?1').bind(key).first();
    if (r && now - r.t < win) { if (r.n >= max) return false; await DB.prepare('UPDATE tries SET n=n+1 WHERE k=?1').bind(key).run(); }
    else await DB.prepare('INSERT OR REPLACE INTO tries(k,n,t) VALUES(?1,1,?2)').bind(key, now).run();
    return true;
  };
  const sid = () => (/(?:^|; )sid=([\w-]{20,100})/.exec(rq.headers.get('cookie') || '') || [])[1];
  const who = async () => { const t = sid(); if (!t) return null; const r = await DB.prepare('SELECT student FROM sessions WHERE h=?1 AND exp>?2').bind(await sha(t + env.PEPPER), now).first(); return r && r.student; };
  const open = async id => { const t = crypto.randomUUID() + crypto.randomUUID(); await DB.prepare('INSERT INTO sessions(h,student,exp) VALUES(?1,?2,?3)').bind(await sha(t + env.PEPPER), id, now + 30 * 864e5).run(); return { 'set-cookie': `sid=${t}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=2592000` }; };

  if (p === 'hit' && m === 'POST') { // anonymous visit counter: a daily rotating hash, no cookie, no IP stored
    const b = await body(), e = b && (b.env === 'itt' || b.env === 'ca') ? b.env : '-';
    const vh = (await sha(ip + rq.headers.get('user-agent') + day + env.PEPPER)).slice(0, 16);
    await DB.prepare('INSERT OR IGNORE INTO hits(day,vh,env) VALUES(?1,?2,?3)').bind(day, vh, e).run();
    return J({ ok: 1 });
  }
  if (p === 'join' && m === 'POST') {
    if (!await rl('j', 10, 36e5)) return J({ error: 'slow down' }, 429);
    const id = crypto.randomUUID(), code = mk();
    await DB.prepare('INSERT INTO students(id,ch,created,seen) VALUES(?1,?2,?3,?3)').bind(id, await sha(code + env.PEPPER), now).run();
    return J({ code }, 200, await open(id));
  }
  if (p === 'login' && m === 'POST') {
    if (!await rl('l', 10, 9e5)) return J({ error: 'too many tries' }, 429);
    const b = await body(), code = b && typeof b.code === 'string' ? b.code.trim().toLowerCase().slice(0, 60) : '';
    const r = code && await DB.prepare('SELECT id FROM students WHERE ch=?1').bind(await sha(code + env.PEPPER)).first();
    return r ? J({ ok: 1 }, 200, await open(r.id)) : J({ error: 'not found' }, 401);
  }
  if (p === 'logout' && m === 'POST') {
    const t = sid(); if (t) await DB.prepare('DELETE FROM sessions WHERE h=?1').bind(await sha(t + env.PEPPER)).run();
    return J({ ok: 1 }, 200, { 'set-cookie': 'sid=; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=0' });
  }
  if (p === 'data') {
    const id = await who(); if (!id) return J({ error: 'login' }, 401);
    if (m === 'GET') { const r = await DB.prepare('SELECT data FROM students WHERE id=?1').bind(id).first(); await DB.prepare('UPDATE students SET seen=?2 WHERE id=?1').bind(id, now).run(); return J(JSON.parse(r.data)); }
    if (m === 'PUT') {
      const b = await body(); if (!b || typeof b !== 'object' || Array.isArray(b)) return J({ error: 'bad' }, 400);
      const d = { v: 1, theme: b.theme, goal: b.goal, days: b.days, itt: b.itt, ca: b.ca };
      const ans = Object.values(d.days && typeof d.days === 'object' ? d.days : {}).reduce((a, x) => a + (Number.isFinite(+x) ? +x : 0), 0);
      await DB.prepare('UPDATE students SET data=?2,answered=?3,seen=?4 WHERE id=?1').bind(id, JSON.stringify(d), ans | 0, now).run();
      return J({ ok: 1 });
    }
  }
  if (p === 'admin' && m === 'GET') {
    if (!await rl('a', 10, 9e5)) return J({ error: 'locked' }, 429);
    if (await sha(rq.headers.get('x-admin-key') || '') !== await sha(env.ADMIN_KEY)) return J({ error: 'no' }, 401);
    const back = n => new Date(now - n * 864e5).toISOString().slice(0, 10);
    const q = (s, ...a) => DB.prepare(s).bind(...a);
    const r = await DB.batch([
      q('SELECT COUNT(DISTINCT vh) c FROM hits WHERE day=?1', day), q('SELECT COUNT(DISTINCT vh) c FROM hits WHERE day>=?1', back(6)), q('SELECT COUNT(DISTINCT vh) c FROM hits WHERE day>=?1', back(29)),
      q('SELECT env,COUNT(DISTINCT vh) c FROM hits WHERE day>=?1 GROUP BY env', back(6)),
      q('SELECT COUNT(*) c, COALESCE(SUM(answered),0) a, SUM(seen>?1) w, SUM(created>?2) t FROM students', now - 7 * 864e5, now - 864e5),
      q('SELECT day,COUNT(DISTINCT vh) c FROM hits WHERE day>=?1 GROUP BY day ORDER BY day', back(13)),
      q('DELETE FROM hits WHERE day<?1', back(90)), q('DELETE FROM sessions WHERE exp<?1', now)]);
    const s = r[4].results[0];
    return J({ today: r[0].results[0].c, week: r[1].results[0].c, month: r[2].results[0].c, byEnv: r[3].results, students: s.c, active7: s.w || 0, new24h: s.t || 0, answered: s.a, daily: r[5].results });
  }
  return J({ error: 'not found' }, 404);
}
