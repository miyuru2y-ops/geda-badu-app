// ගෙදර බඩු — server v2
// Node පමණයි, වෙන package එකක් ඕන නැහැ. Coolify (Dockerfile) එකට හදලා තියෙන්නේ.
//
// Environment variables:
//   PORT            (default 3000)
//   DATA_DIR        දත්ත තියෙන folder එක (default ./data) — Coolify එකේ persistent volume එකක් මෙතනට mount කරන්න: /app/data
//   HOUSEHOLD_KEY   ගෙදර කෝඩ් එක (password). දැම්මොත් කෝඩ් එක නැති කෙනෙක්ට ලිස්ට් එක බලන්න/වෙනස් කරන්න බැහැ.
//   TZ_NAME         default Asia/Colombo
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const core = require('./public/core.js');
const ai = require('./ai.js');

const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const PUBLIC = path.join(__dirname, 'public');
const KEY = (process.env.HOUSEHOLD_KEY || '').trim();
const TZ = process.env.TZ_NAME || core.TZ;
const MAX_BODY = 6 * 1024 * 1024; // බිල් photo එකට

const today = () => core.localDate(new Date(), TZ);

fs.mkdirSync(BACKUP_DIR, { recursive: true });

// ---------- load ----------
function loadInitial() {
  const candidates = [STATE_FILE, path.join(__dirname, 'data.json')]; // data.json = පරණ v1 file එක
  for (const f of candidates) {
    try {
      const s = JSON.parse(fs.readFileSync(f, 'utf8'));
      console.log('Loaded state from', f);
      return core.normalize(s, today());
    } catch (e) { /* next */ }
  }
  // අන්තිම backup එකෙන් ගන්න උත්සාහ කරනවා
  try {
    const b = fs.readdirSync(BACKUP_DIR).filter(n => n.endsWith('.json')).sort().pop();
    if (b) { console.log('Restored from backup', b); return core.normalize(JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, b), 'utf8')), today()); }
  } catch (e) { /* ignore */ }
  console.log('Starting with seed list');
  return core.normalize(require('./seed.json'), today());
}

let state = loadInitial();
core.rollover(state, today());
writeState();

// ---------- save (atomic) + daily backup ----------
function writeState() {
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, STATE_FILE);
  const bf = path.join(BACKUP_DIR, 'state-' + today() + '.json');
  if (!fs.existsSync(bf)) {
    try {
      fs.copyFileSync(STATE_FILE, bf);
      const all = fs.readdirSync(BACKUP_DIR).filter(n => /^state-.*\.json$/.test(n)).sort();
      all.slice(0, Math.max(0, all.length - 30)).forEach(n => fs.unlinkSync(path.join(BACKUP_DIR, n)));
    } catch (e) { console.error('backup failed', e.message); }
  }
}
function commit() {
  state.version = (state.version || 0) + 1;
  core.pruneLog(state, today());
  writeState();
}

// ---------- helpers ----------
function send(res, code, obj, extra) {
  const body = obj === undefined ? '' : JSON.stringify(obj);
  res.writeHead(code, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, extra || {}));
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(Object.assign(new Error('too big'), { code: 413 })); req.resume(); return; } chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(Object.assign(new Error('bad json'), { code: 400 })); } });
    req.on('error', reject);
  });
}
function safeEq(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
// වැරදි කෝඩ් දාලා guess කරන එක හෙමින් කරනවා
const fails = new Map();
function authorized(req, url) {
  if (!KEY) return true;
  const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const f = fails.get(ip);
  if (f && f.n >= 20 && Date.now() - f.t < 10 * 60000) return false;
  const given = String(req.headers['x-household-key'] || url.searchParams.get('key') || '').trim();
  if (!given) return false; // කෝඩ් එකක් නැති request (උදා: පරණ app) — lock කරන්නේ නැහැ
  if (safeEq(given, KEY)) { fails.delete(ip); return true; }
  fails.set(ip, { n: (f && Date.now() - f.t < 10 * 60000 ? f.n : 0) + 1, t: Date.now() });
  return false;
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;

  if (p.startsWith('/api/')) {
    // APK එකේ පරණ fallback (file://) එකටත් වැඩ කරන්න CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Household-Key');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (p === '/api/health') return send(res, 200, { ok: true, version: state.version, keyRequired: !!KEY, ai: ai.enabled });
    // පරණ app (v1–v8): error එකක body එක හිස්ව යවනවා — එතකොට පරණ app එක "offline" කියලා හිතනවා, ලිස්ට් එක හිස් කරන්නේ නැහැ
    const legacy = p === '/api/state' && (req.method === 'POST' || !url.searchParams.has('v'));
    if (!authorized(req, url)) { if (legacy) { res.writeHead(401); return res.end(); } return send(res, 401, { error: 'key' }); }

    if (rolloverIfNeeded()) commit();

    try {
      if (p === '/api/state' && req.method === 'GET') {
        const v = url.searchParams.get('v');
        if (v === null) {
          // පරණ app (v1–v8) එකට — කියවන්න විතරයි
          const legacy = Object.assign({}, view(), { log: state.log.filter(l => l.d.slice(0, 7) === state.monthKey).map(l => ({ date: l.d, id: l.id, name: l.n, delta: l.delta, why: l.why })) });
          return send(res, 200, legacy);
        }
        if (v === state.version + '_' + today()) { res.writeHead(204, { 'Cache-Control': 'no-store' }); return res.end(); }
        return send(res, 200, view());
      }
      if (p === '/api/state' && req.method === 'POST') {
        // පරණ app එක මුළු ලිස්ට් එකම යවලා අනිත් අයගේ වෙනස්කම් මකන එක නවත්තනවා
        res.writeHead(410); return res.end();
      }
      if (p === '/api/ops' && req.method === 'POST') {
        const body = await readBody(req);
        const ops = Array.isArray(body.ops) ? body.ops.slice(0, 500) : [];
        const results = [];
        let changed = false;
        for (const op of ops) {
          const r = core.applyOnce(state, op);
          results.push({ uid: op.uid, ok: r.ok, dup: !!r.dup, err: r.err, changes: r.changes || [] });
          if (r.ok && !r.dup) changed = true;
        }
        if (changed) commit();
        return send(res, 200, { results, state: view() });
      }
      if (p === '/api/doses' && req.method === 'GET') {
        // APK එකේ බෙහෙත් alarm වලට
        const list = [];
        state.items.forEach(it => (it.doses || []).forEach(d => list.push({ id: it.id, name: it.name, unit: it.unit, time: d.time, qty: d.qty, who: d.who })));
        return send(res, 200, { doses: list });
      }
      if (p === '/api/widget' && req.method === 'GET') {
        // Home screen widget එකට — පොඩි සාරාංශයක්
        const t = today(), pn = core.planNeeds(state, t);
        const low = state.items.filter(core.isLow).sort((a, b) => a.qty - b.qty).map(i => core.iconFor(i) + ' ' + i.name);
        const shop = state.items.filter(i => core.shopNeeded(i, pn[i.id], t) > 0).length + state.requests.filter(r => !r.done).length;
        const al = core.alerts(state, t).filter(a => a.kind !== 'requests').map(a => a.text);
        return send(res, 200, { low: low.slice(0, 6), lowCount: low.length, shop, alerts: al.slice(0, 2) });
      }
      if (p.startsWith('/api/ai/') && req.method === 'POST') {
        if (!ai.enabled) return send(res, 501, { error: 'ai off' });
        const body = await readBody(req);
        if (!ai.allow(today())) return send(res, 429, { error: 'අද දවසට AI සීමාව ඉවරයි — හෙට ආයේ උත්සාහ කරන්න' });
        try {
          if (p === '/api/ai/receipt') {
            const img = String(body.image || '').replace(/^data:[^,]+,/, '');
            if (img.length < 1000) return send(res, 400, { error: 'no image' });
            return send(res, 200, await ai.readReceipt(state, img, body.mediaType));
          }
          if (p === '/api/ai/voice') return send(res, 200, await ai.parseVoice(state, String(body.text || '')));
          if (p === '/api/ai/cook') {
            const t = today(), soon = {};
            state.items.forEach(i => { const e = core.expiryStatus(i, t); if (e && e.level !== 'ok') soon[i.id] = 1; });
            return send(res, 200, await ai.cookIdeas(state, t, soon));
          }
          if (p === '/api/ai/identify') {
            const img = String(body.image || '').replace(/^data:[^,]+,/, '');
            if (img.length < 1000) return send(res, 400, { error: 'no image' });
            return send(res, 200, await ai.identifyItem(state, img, body.mediaType));
          }
        } catch (e) { console.error('AI error', e.message); return send(res, 502, { error: 'AI එකට සම්බන්ධ වෙන්න බැරි වුණා' }); }
        return send(res, 404, { error: 'not found' });
      }
      if (p === '/api/alerts' && req.method === 'GET') {
        // APK එකේ notification එකට — දවසට වරක් මේක බලනවා
        return send(res, 200, { date: today(), alerts: core.alerts(state, today(), null, core.nowHM()) });
      }
      if (p === '/api/export' && req.method === 'GET') {
        const out = Object.assign({}, state); delete out.seenOps;
        return send(res, 200, out, { 'Content-Disposition': 'attachment; filename="geda-badu-' + today() + '.json"' });
      }
      if (p === '/api/import' && req.method === 'POST') {
        const body = await readBody(req);
        const s = body && body.state ? body.state : body;
        if (!s || !Array.isArray(s.items) || !s.items.length) return send(res, 400, { error: 'bad state' });
        // import කරන්න කලින් දැනට තියෙන එකේ backup එකක්
        fs.writeFileSync(path.join(BACKUP_DIR, 'before-import-' + Date.now() + '.json'), JSON.stringify(state));
        const ver = state.version;
        state = core.normalize(s, today());
        state.version = ver;
        rolloverIfNeeded();
        commit();
        return send(res, 200, { ok: true, items: state.items.length, state: view() });
      }
      return send(res, 404, { error: 'not found' });
    } catch (e) {
      return send(res, e.code === 413 ? 413 : e.code === 400 ? 400 : 500, { error: e.message });
    }
  }

  // ---------- static files ----------
  let rel = p === '/' ? '/index.html' : decodeURIComponent(p);
  const filePath = path.join(PUBLIC, rel);
  if (!filePath.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('not found'); }
    const headers = { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' };
    headers['Cache-Control'] = /\.(html|js|json|webmanifest)$/.test(filePath) ? 'no-cache' : 'public, max-age=86400';
    if (filePath.endsWith('sw.js')) headers['Service-Worker-Allowed'] = '/';
    res.writeHead(200, headers);
    res.end(data);
  });
});

function view() { const t = today(); return Object.assign(core.publicView(state, t), { tag: state.version + '_' + t, today: t }); }
function rolloverIfNeeded() { return core.rollover(state, today()); }

server.listen(PORT, () => console.log('Geda Badu v2 on port ' + PORT + ' | data: ' + DATA_DIR + ' | key: ' + (KEY ? 'ON' : 'OFF') + ' | AI: ' + (ai.provider || 'OFF')));
