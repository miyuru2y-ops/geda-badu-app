/* ගෙදර බඩු — shared logic (server + app දෙකම මේ file එකම පාවිච්චි කරනවා)
 * State එකට වෙනස්කම් කරන්නේ "ops" (operations) වලින් විතරයි — උදා: {op:'adjust', id:'rice', delta:-0.5}.
 * ෆෝන් දෙකක් එකවර වෙනස් කළත් දෙකේම වෙනස් ඉතිරි වෙන්නේ මුළු ලිස්ට් එකම නොයවා වෙනස විතරක් යවන නිසා.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GedaCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TZ = 'Asia/Colombo';
  var LOG_KEEP_DAYS = 100;
  var LOG_MAX = 6000;
  var SEEN_MAX = 2000;
  var RATE_DAYS = 30;       // "තව දවස් කීයද" ගණන් හදන්න අන්තිම දවස් 30ක පාවිච්චිය
  var EXPIRY_WARN_DAYS = 7;

  var CATS = ['එළවළු', 'පළතුරු', 'පිරිසිදු කරන ද්‍රව්‍ය', 'කුළුබඩු', 'බෙහෙත්', 'ධාන්‍ය වර්ග', 'මස් මාලු බිත්තර', 'වෙනත්'];
  var SHOPS = ['සුපර්මාර්කට්', 'පොළ', 'ළඟ කඩේ', 'ෆාමසිය'];
  var PLACES = ['කුස්සිය', 'ෆ්‍රිජ්', 'ස්ටෝර් රූම්', 'නාන කාමරේ', 'බෙහෙත් පෙට්ටිය'];

  // බඩුවල පින්තූර (emoji) — සරල mode එකේ ලොකුවට පේනවා
  var ICONS = {
    rice: '🍚', dal: '🫘', atta: '🌾', 'wheat-flour': '🌾', butter: '🧈', astra: '🧈', 'coco-eat': '🥥', 'coco-lamp': '🪔', sugar: '🧂',
    tea: '🍵', potato: '🥔', 'big-onion': '🧅', 'red-onion': '🧅', veg: '🥬', highland: '🥛', salt: '🧂', 'chili-powder': '🌶️',
    'curry-powder': '🍛', turmeric: '🟡', pepper: '⚫', cinnamon: '🪵', garlic: '🧄', ginger: '🫚', noodles: '🍜', pasta: '🍝',
    soya: '🥩', chickpea: '🫘', mung: '🫘', cowpea: '🫘', 'milk-powder': '🥛', eggs: '🥚', 'canned-fish': '🐟', vinegar: '🍶',
    'soy-sauce': '🍶', 'tomato-sauce': '🍅', 'sunflower-oil': '🌻', coffee: '☕', biscuits: '🍪', peanuts: '🥜', jaggery: '🍯',
    tomato: '🍅', carrot: '🥕', beetroot: '🟣', cabbage: '🥬', beans: '🫛', brinjal: '🍆', 'bitter-gourd': '🥒', leeks: '🥬',
    cucumber: '🥒', greens: '🥬', banana: '🍌', lime: '🍋', apple: '🍎', orange: '🍊', mango: '🥭', papaya: '🍈', chicken: '🍗',
    fish: '🐟', paracetamol: '💊', plaster: '🩹', antiseptic: '🧴', 'baby-soap': '🧼', 'adult-soap': '🧼', comfort: '🧴',
    'vim-soap': '🧽', 'vim-liquid': '🧴', dash: '🧴', toilet: '🚽', air: '🌸', shampoo: '🧴', conditioner: '🧴'
  };
  var CAT_ICON = { 'එළවළු': '🥦', 'පළතුරු': '🍎', 'පිරිසිදු කරන ද්‍රව්‍ය': '🧹', 'කුළුබඩු': '🌶️', 'බෙහෙත්': '💊', 'ධාන්‍ය වර්ග': '🌾', 'මස් මාලු බිත්තර': '🥚', 'වෙනත්': '📦' };
  function iconFor(it) { return it.icon || ICONS[it.id] || CAT_ICON[it.cat] || '📦'; }

  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function num(v, dflt) { var n = parseFloat(v); return isFinite(n) ? n : dflt; }
  function str(v, max) { return String(v == null ? '' : v).trim().slice(0, max); }

  // ලංකාවේ වෙලාවට අද දිනය (YYYY-MM-DD) — UTC නෙවෙයි
  function localDate(d, tz) {
    d = d || new Date();
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: tz || TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    } catch (e) {
      var o = new Date(d.getTime() + 330 * 60000); // fallback: UTC+5:30
      return o.toISOString().slice(0, 10);
    }
  }
  function monthOf(date) { return String(date).slice(0, 7); }
  function validDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function dayNum(date) { return Math.round(new Date(date + 'T00:00:00Z').getTime() / 86400000); }
  function addDays(date, n) { return new Date((dayNum(date) + n) * 86400000).toISOString().slice(0, 10); }

  // පරණ app එකේ කාණ්ඩ නම් (කෑම, පිරිසිදු, එළවළු / කිරි) අලුත් ඒවට — v8 එකේ CAT_MAP එකමයි
  var OLD_CAT = {"baby-soap": "පිරිසිදු කරන ද්‍රව්‍ය", "adult-soap": "පිරිසිදු කරන ද්‍රව්‍ය", "comfort": "පිරිසිදු කරන ද්‍රව්‍ය", "vim-soap": "පිරිසිදු කරන ද්‍රව්‍ය", "vim-liquid": "පිරිසිදු කරන ද්‍රව්‍ය", "dash": "පිරිසිදු කරන ද්‍රව්‍ය", "toilet": "පිරිසිදු කරන ද්‍රව්‍ය", "air": "පිරිසිදු කරන ද්‍රව්‍ය", "shampoo": "පිරිසිදු කරන ද්‍රව්‍ය", "conditioner": "පිරිසිදු කරන ද්‍රව්‍ය", "potato": "එළවළු", "big-onion": "එළවළු", "red-onion": "එළවළු", "veg": "එළවළු", "tomato": "එළවළු", "carrot": "එළවළු", "beetroot": "එළවළු", "cabbage": "එළවළු", "beans": "එළවළු", "brinjal": "එළවළු", "bitter-gourd": "එළවළු", "leeks": "එළවළු", "cucumber": "එළවළු", "greens": "එළවළු", "banana": "පළතුරු", "lime": "පළතුරු", "salt": "කුළුබඩු", "chili-powder": "කුළුබඩු", "curry-powder": "කුළුබඩු", "turmeric": "කුළුබඩු", "pepper": "කුළුබඩු", "cinnamon": "කුළුබඩු", "cloves": "කුළුබඩු", "cardamom": "කුළුබඩු", "mustard": "කුළුබඩු", "fenugreek": "කුළුබඩු", "cumin": "කුළුබඩු", "coriander": "කුළුබඩු", "garlic": "කුළුබඩු", "ginger": "කුළුබඩු", "rice": "ධාන්‍ය වර්ග", "dal": "ධාන්‍ය වර්ග", "atta": "ධාන්‍ය වර්ග", "wheat-flour": "ධාන්‍ය වර්ග", "chickpea": "ධාන්‍ය වර්ග", "mung": "ධාන්‍ය වර්ග", "cowpea": "ධාන්‍ය වර්ග", "noodles": "ධාන්‍ය වර්ග", "pasta": "ධාන්‍ය වර්ග", "eggs": "මස් මාලු බිත්තර", "canned-fish": "මස් මාලු බිත්තර"};
  function catFor(it) {
    if (CATS.indexOf(it.cat) >= 0) return it.cat;
    if (OLD_CAT[it.id]) return OLD_CAT[it.id];
    if (it.cat === 'පිරිසිදු') return 'පිරිසිදු කරන ද්‍රව්‍ය';
    return 'වෙනත්';
  }

  function cleanItem(it) {
    var exp = str(it.expiry, 10);
    return {
      id: String(it.id).slice(0, 60),
      name: str(it.name, 80) || 'නමක් නැති බඩුව',
      cat: catFor(it),
      unit: str(it.unit, 20),
      qty: Math.max(0, r2(num(it.qty, 0))),
      monthly: Math.max(0, r2(num(it.monthly, 0))),
      daily: Math.max(0, r2(num(it.daily, 0))),
      low: Math.max(0, r2(num(it.low, 0))),
      price: Math.max(0, r2(num(it.price, 0))),        // අන්තිමට ගත්ත මිල (ඒකකයකට)
      prevPrice: Math.max(0, r2(num(it.prevPrice, 0))), // ඊට කලින් මිල
      shop: str(it.shop, 30),                            // කොහෙන් ගන්නවද
      place: str(it.place, 30),                          // ගෙදර කොහෙද තියෙන්නේ
      expiry: validDate(exp) ? exp : '',                 // කල් ඉකුත් වෙන දිනය
      barcode: str(it.barcode, 40),
      icon: str(it.icon, 8)
    };
  }

  // පරණ app එකේ state එකක් (v1-v8, v2) අලුත් හැඩයට හරවනවා
  function normalize(s, today) {
    s = s && typeof s === 'object' ? s : {};
    var items = Array.isArray(s.items) ? s.items.filter(function (i) { return i && i.id != null; }).map(cleanItem) : [];
    var seen = {};
    items = items.filter(function (i) { if (seen[i.id]) return false; seen[i.id] = 1; return true; });
    var log = Array.isArray(s.log) ? s.log.filter(Boolean).map(function (l) {
      var o = { d: l.d || l.date || '', id: l.id, n: l.n || l.name || '', delta: r2(l.delta), why: l.why || '', by: l.by || '', ts: l.ts || 0 };
      if (l.p) o.p = r2(l.p);
      return o;
    }) : [];
    var out = {
      schema: 3,
      version: Number(s.version) || 1,
      monthKey: s.monthKey || monthOf(today || localDate()),
      monthStart: s.monthStart && typeof s.monthStart === 'object' ? s.monthStart : {},
      lastCookDate: s.lastCookDate || '',
      shopDay: Math.min(28, Math.max(1, Number(s.shopDay) || 25)),
      items: items,
      log: log,
      spend: s.spend && typeof s.spend === 'object' ? s.spend : {},     // {'2026-10': 38500}
      requests: Array.isArray(s.requests) ? s.requests.filter(Boolean).slice(-80) : [],
      ticks: s.ticks && typeof s.ticks === 'object' ? s.ticks : {},     // සාප්පු ලිස්ට් එකේ ✓ — ෆෝන් ඔක්කොටම එකයි
      seenOps: Array.isArray(s.seenOps) ? s.seenOps.slice(-SEEN_MAX) : []
    };
    out.items.forEach(function (i) { if (out.monthStart[i.id] === undefined) out.monthStart[i.id] = i.qty; });
    return out;
  }

  // අලුත් මාසයක් පටන් ගත්තාම, මාසේ මුල තිබුණ ප්‍රමාණ සටහන් කරනවා
  function rollover(state, today) {
    var mk = monthOf(today);
    if (state.monthKey === mk) return false;
    if (state.monthKey > mk) return false; // ෆෝන් එකේ වෙලාව වැරදි නම් පස්සට යන්නේ නැහැ
    state.monthStart = {};
    state.items.forEach(function (i) { state.monthStart[i.id] = i.qty; });
    state.monthKey = mk;
    return true;
  }

  function pruneLog(state, today) {
    var cut = addDays(today, -LOG_KEEP_DAYS);
    state.log = state.log.filter(function (l) { return !l.d || l.d >= cut; });
    if (state.log.length > LOG_MAX) state.log = state.log.slice(-LOG_MAX);
    // ඉවර කරපු ඉල්ලීම් දවස් 14කට පස්සේ අයින්
    var cutTs = Date.now() - 14 * 86400000;
    state.requests = state.requests.filter(function (r) { return !r.done || (r.doneTs || 0) > cutTs; });
    // මාස 13කට වඩා පරණ වියදම් අයින්
    var months = Object.keys(state.spend).sort();
    months.slice(0, Math.max(0, months.length - 13)).forEach(function (m) { delete state.spend[m]; });
  }

  function find(state, id) {
    for (var i = 0; i < state.items.length; i++) if (state.items[i].id === id) return state.items[i];
    return null;
  }

  function addLog(state, op, it, delta, why, price) {
    if (!delta && !price) return;
    var e = { d: op.date, id: it.id, n: it.name, delta: r2(delta), why: why, by: op.by || '', ts: op.ts || 0 };
    if (price) e.p = r2(price);
    state.log.push(e);
  }

  // එක op එකක් state එකට දානවා. ආපහු දෙන්නේ undo කරන්න ඕන වෙනස්කම් ලිස්ට් එක.
  function apply(state, op) {
    if (!op || typeof op !== 'object') return { ok: false, err: 'bad op' };
    if (!validDate(op.date)) op.date = localDate();
    op.by = str(op.by, 30);
    var changes = [];
    var spent = 0;
    var it, d;
    switch (op.op) {
      case 'adjust':
        it = find(state, op.id); if (!it) return { ok: false, err: 'no item' };
        d = num(op.delta, 0);
        var before = it.qty;
        it.qty = Math.max(0, r2(it.qty + d));
        d = r2(it.qty - before);
        addLog(state, op, it, d, str(op.why || (d < 0 ? 'use' : 'add'), 20));
        if (d) changes.push({ id: it.id, delta: d });
        break;
      case 'cook':
        state.items.forEach(function (x) {
          if (x.daily > 0) {
            var b = x.qty; x.qty = Math.max(0, r2(x.qty - x.daily));
            var dd = r2(x.qty - b);
            addLog(state, op, x, dd, 'cook');
            if (dd) changes.push({ id: x.id, delta: dd });
          }
        });
        state.lastCookDate = op.date;
        break;
      case 'buy':
        // items: [{id, qty, price}] — price = ඒ බඩුවට ගෙවපු මුළු ගණන (නැත්නම් 0)
        (Array.isArray(op.items) ? op.items : []).forEach(function (b) {
          var x = find(state, b.id); var q = Math.max(0, num(b.qty, 0)); var p = Math.max(0, num(b.price, 0));
          if (!x || (!q && !p)) return;
          x.qty = r2(x.qty + q);
          if (p && q) { var unit = r2(p / q); if (unit !== x.price) { if (x.price) x.prevPrice = x.price; x.price = unit; } }
          addLog(state, op, x, q, 'buy', p);
          spent += p;
          changes.push({ id: x.id, delta: q });
          delete state.ticks[x.id];
        });
        (Array.isArray(op.requests) ? op.requests : []).forEach(function (rid) {
          state.requests.forEach(function (r) { if (r.rid === rid && !r.done) { r.done = true; r.doneTs = op.ts || Date.now(); r.doneBy = op.by; } });
          delete state.ticks['r:' + rid];
        });
        if (op.extraSpent) spent += Math.max(0, num(op.extraSpent, 0)); // ලිස්ට් එකේ නැති දේවල් වලට ගෙවපු ගණන
        if (spent) { var mk = monthOf(op.date); state.spend[mk] = r2((state.spend[mk] || 0) + spent); }
        break;
      case 'undo':
        (Array.isArray(op.changes) ? op.changes : []).forEach(function (c) {
          var x = find(state, c.id); if (!x) return;
          var b = x.qty; x.qty = Math.max(0, r2(x.qty - num(c.delta, 0)));
          addLog(state, op, x, r2(x.qty - b), 'undo:' + str(op.of, 12));
        });
        if (op.of === 'cook' && op.prevCookDate !== undefined) state.lastCookDate = str(op.prevCookDate, 10);
        if (op.of === 'buy' && op.spent) { var m2 = monthOf(op.date); state.spend[m2] = Math.max(0, r2((state.spend[m2] || 0) - num(op.spent, 0))); }
        break;
      case 'upsert':
        if (!op.item || op.item.id == null) return { ok: false, err: 'bad item' };
        var clean = cleanItem(op.item);
        it = find(state, clean.id);
        if (!it) {
          state.items.push(clean);
          if (state.monthStart[clean.id] === undefined) state.monthStart[clean.id] = clean.qty;
          addLog(state, op, clean, clean.qty, 'new');
        } else {
          var qtyBefore = it.qty;
          ['name', 'cat', 'unit', 'monthly', 'daily', 'low', 'shop', 'place', 'expiry', 'barcode', 'icon'].forEach(function (k) {
            if (op.item[k] !== undefined) it[k] = clean[k];
          });
          if (op.item.price !== undefined && clean.price !== it.price) { if (it.price) it.prevPrice = it.price; it.price = clean.price; }
          if (op.item.qty !== undefined && op.item.qty !== null && op.item.qty !== '') {
            it.qty = clean.qty;
            addLog(state, op, it, r2(it.qty - qtyBefore), 'set');
          }
        }
        // එකම barcode එක බඩු දෙකක තියෙන්න බැහැ
        if (clean.barcode) state.items.forEach(function (x) { if (x.id !== clean.id && x.barcode === clean.barcode) x.barcode = ''; });
        break;
      case 'delete':
        var idx = -1;
        state.items.forEach(function (x, i) { if (x.id === op.id) idx = i; });
        if (idx < 0) return { ok: true, changes: [] };
        state.items.splice(idx, 1);
        delete state.ticks[op.id];
        break;
      case 'tick':
        // සාප්පු ලිස්ට් එකේ ☐/☑ — key = item id, නැත්නම් 'r:'+ඉල්ලීමේ id
        var k = str(op.key, 70); if (!k) return { ok: false, err: 'bad key' };
        if (op.on) state.ticks[k] = { qty: Math.max(0, r2(num(op.qty, 0))), price: Math.max(0, r2(num(op.price, 0))), by: op.by, ts: op.ts || 0 };
        else delete state.ticks[k];
        break;
      case 'request':
        var text = str(op.text, 120); if (!text) return { ok: false, err: 'empty' };
        var rid = str(op.rid, 40) || String(op.ts || Date.now());
        if (!state.requests.some(function (r) { return r.rid === rid; })) state.requests.push({ rid: rid, text: text, by: op.by, ts: op.ts || Date.now(), done: false });
        break;
      case 'requestDone':
        state.requests.forEach(function (r) { if (r.rid === op.rid) { r.done = !!op.done; r.doneTs = op.done ? (op.ts || Date.now()) : 0; r.doneBy = op.done ? op.by : ''; } });
        if (op.done) delete state.ticks['r:' + op.rid];
        break;
      case 'requestDel':
        state.requests = state.requests.filter(function (r) { return r.rid !== op.rid; });
        delete state.ticks['r:' + op.rid];
        break;
      case 'settings':
        if (op.shopDay !== undefined) state.shopDay = Math.min(28, Math.max(1, Math.round(num(op.shopDay, 25))));
        break;
      default:
        return { ok: false, err: 'unknown op' };
    }
    return { ok: true, changes: changes, spent: r2(spent) };
  }

  // Server එකේ: op id එක කලින් දැකලා නම් ආයේ දාන්නේ නැහැ (නෙට් කැඩිලා දෙපාරක් ආවොත්)
  function applyOnce(state, op) {
    if (op.uid && state.seenOps.indexOf(op.uid) >= 0) return { ok: true, dup: true, changes: [] };
    var res = apply(state, op);
    if (op.uid) { state.seenOps.push(op.uid); if (state.seenOps.length > SEEN_MAX) state.seenOps = state.seenOps.slice(-SEEN_MAX); }
    return res;
  }

  function baseWhy(w) { return w.indexOf('undo:') === 0 ? w.slice(5) : w; }

  // මේ මාසේ පාවිච්චි කළ / ගත්ත ප්‍රමාණ සහ වියදම
  function monthSummary(state) {
    var mk = state.monthKey, out = {};
    state.log.forEach(function (l) {
      if (!l.d || l.d.slice(0, 7) !== mk) return;
      var w = baseWhy(l.why);
      var o = out[l.id] || (out[l.id] = { used: 0, bought: 0, spent: 0 });
      if (w === 'use' || w === 'cook') o.used = r2(o.used - l.delta);
      else if (w === 'buy' || w === 'add') o.bought = r2(o.bought + l.delta);
      if (l.p && l.why === 'buy') o.spent = r2(o.spent + l.p);
    });
    return out;
  }

  // ඇත්ත පාවිච්චියෙන් දවසකට යන ප්‍රමාණය ඉගෙනගන්නවා → "තව දවස් කීයද"
  function usageRates(state, today) {
    var from = addDays(today, -RATE_DAYS), used = {}, first = today;
    state.log.forEach(function (l) {
      if (!l.d || l.d < from || l.d > today) return;
      if (l.d < first) first = l.d;
      var w = baseWhy(l.why);
      if (w === 'use' || w === 'cook') used[l.id] = (used[l.id] || 0) - l.delta;
    });
    var days = Math.max(1, dayNum(today) - dayNum(first) + 1);
    var out = {};
    state.items.forEach(function (it) {
      var u = Math.max(0, used[it.id] || 0), rate = 0;
      if (days >= 7 && u > 0) rate = u / days;              // සතියකට වඩා history තියෙනවා නම් ඇත්ත පාවිච්චිය
      else if (it.daily > 0) rate = it.daily;              // නැත්නම් "දවසට උයන" ප්‍රමාණය
      else if (u > 0) rate = u / Math.max(days, 7);
      if (rate > 0) out[it.id] = { rate: Math.round(rate * 1000) / 1000, daysLeft: Math.floor(it.qty / rate) };
    });
    return out;
  }

  function isLow(it) {
    if (it.low > 0 && it.qty <= it.low) return true;
    if (it.monthly > 0 && it.qty <= it.monthly * 0.25) return true;
    return it.qty <= 0;
  }

  function expiryStatus(it, today) {
    if (!it.expiry) return null;
    var left = dayNum(it.expiry) - dayNum(today);
    if (left < 0) return { left: left, level: 'expired' };
    if (left <= EXPIRY_WARN_DAYS) return { left: left, level: 'soon' };
    return { left: left, level: 'ok' };
  }

  function shopNeeded(it) {
    // මාසෙට ඕන ප්‍රමාණයෙන් බාගයක්වත් ඉවර වෙලා නම් හෝ අඩු නම් විතරයි ලිස්ට් එකට එන්නේ (0.03L වගේ පොඩි ඒවා නෙවෙයි)
    if (it.monthly > 0) return (isLow(it) || it.qty <= it.monthly * 0.5) ? Math.max(0, r2(it.monthly - it.qty)) : 0;
    if (!isLow(it)) return 0;
    var u = (it.unit || '').toLowerCase();
    if (u === 'g' || u === 'ml') return 100;
    return 1;
  }

  // +/− එකකින් වෙනස් වෙන ප්‍රමාණය
  function stepFor(it) {
    if (it.daily > 0) return it.daily;
    var u = (it.unit || '').toLowerCase();
    if (u === 'g' || u === 'ml') return it.monthly >= 500 ? 100 : 25;
    if ((u === 'kg' || u === 'l') && it.monthly > 0 && it.monthly < 3) return 0.25;
    return 1;
  }

  // ෆෝන් notification එකටයි app එකේ banner එකටයි පණිවිඩ
  function alerts(state, today, rates) {
    rates = rates || usageRates(state, today);
    var out = [];
    var expired = [], soon = [];
    state.items.forEach(function (it) {
      var e = expiryStatus(it, today);
      if (e && e.level === 'expired') expired.push(it.name);
      else if (e && e.level === 'soon') soon.push(it.name + ' (දවස් ' + e.left + ')');
    });
    if (expired.length) out.push({ kind: 'expired', text: '⛔ කල් ඉකුත් වෙලා: ' + expired.join(', ') });
    if (soon.length) out.push({ kind: 'expiry', text: '⏰ ළඟදීම කල් ඉකුත් වෙනවා: ' + soon.join(', ') });
    var ending = state.items.filter(function (it) { var r = rates[it.id]; return r && it.qty > 0 && r.daysLeft <= 3; }).map(function (it) { return it.name; });
    if (ending.length) out.push({ kind: 'ending', text: '⏳ දවස් 3කින් ඉවර වෙනවා: ' + ending.join(', ') });
    var finished = state.items.filter(function (it) { return it.qty <= 0 && (it.monthly > 0 || it.daily > 0); }).map(function (it) { return it.name; });
    if (finished.length) out.push({ kind: 'finished', text: '🚫 ඉවරයි: ' + finished.join(', ') });
    var open = state.requests.filter(function (r) { return !r.done; });
    if (open.length) out.push({ kind: 'requests', text: '📝 ගෙදර අයගේ ඉල්ලීම් ' + open.length + 'ක්: ' + open.map(function (r) { return r.text; }).slice(0, 5).join(', ') });
    var day = Number(today.slice(8)), sd = state.shopDay || 25;
    var need = state.items.filter(function (it) { return shopNeeded(it) > 0; }).length + open.length;
    if (day === sd) out.push({ kind: 'shopday', text: '🛒 අද සාප්පු යන දවස! ගන්න බඩු ' + need + 'ක් තියෙනවා.' });
    else if (day === sd - 1) out.push({ kind: 'shopday', text: '🛒 හෙට සාප්පු යන දවස — ගන්න බඩු ' + need + 'ක් තියෙනවා.' });
    return out;
  }

  // Client එකට යවන හැඩය (log එක ඔක්කොම නෙවෙයි — අන්තිම 60 සහ සාරාංශය විතරයි)
  function publicView(state, today) {
    today = today || localDate();
    var rates = usageRates(state, today);
    return {
      schema: 3,
      version: state.version,
      monthKey: state.monthKey,
      monthStart: state.monthStart,
      lastCookDate: state.lastCookDate,
      shopDay: state.shopDay,
      items: state.items,
      spend: state.spend,
      requests: state.requests,
      ticks: state.ticks,
      summary: monthSummary(state),
      rates: rates,
      recent: state.log.slice(-60).reverse()
    };
  }

  return {
    TZ: TZ, CATS: CATS, SHOPS: SHOPS, PLACES: PLACES, r2: r2, localDate: localDate, monthOf: monthOf, addDays: addDays,
    normalize: normalize, rollover: rollover, pruneLog: pruneLog, apply: apply, applyOnce: applyOnce, monthSummary: monthSummary,
    usageRates: usageRates, isLow: isLow, expiryStatus: expiryStatus, shopNeeded: shopNeeded, stepFor: stepFor, alerts: alerts,
    publicView: publicView, cleanItem: cleanItem, iconFor: iconFor
  };
});
