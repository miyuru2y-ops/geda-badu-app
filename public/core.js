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

  var CATS = ['එළවළු', 'පළතුරු', 'පිරිසිදු කරන ද්‍රව්‍ය', 'කුළුබඩු', 'බෙහෙත්', 'ධාන්‍ය වර්ග', 'මස් මාලු බිත්තර', 'වෙනත්'];

  function r2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function num(v, dflt) { var n = parseFloat(v); return isFinite(n) ? n : dflt; }

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

  // පරණ app එකේ කාණ්ඩ නම් (කෑම, පිරිසිදු, එළවළු / කිරි) අලුත් ඒවට — v8 එකේ CAT_MAP එකමයි
  var OLD_CAT = {"baby-soap": "පිරිසිදු කරන ද්‍රව්‍ය", "adult-soap": "පිරිසිදු කරන ද්‍රව්‍ය", "comfort": "පිරිසිදු කරන ද්‍රව්‍ය", "vim-soap": "පිරිසිදු කරන ද්‍රව්‍ය", "vim-liquid": "පිරිසිදු කරන ද්‍රව්‍ය", "dash": "පිරිසිදු කරන ද්‍රව්‍ය", "toilet": "පිරිසිදු කරන ද්‍රව්‍ය", "air": "පිරිසිදු කරන ද්‍රව්‍ය", "shampoo": "පිරිසිදු කරන ද්‍රව්‍ය", "conditioner": "පිරිසිදු කරන ද්‍රව්‍ය", "potato": "එළවළු", "big-onion": "එළවළු", "red-onion": "එළවළු", "veg": "එළවළු", "tomato": "එළවළු", "carrot": "එළවළු", "beetroot": "එළවළු", "cabbage": "එළවළු", "beans": "එළවළු", "brinjal": "එළවළු", "bitter-gourd": "එළවළු", "leeks": "එළවළු", "cucumber": "එළවළු", "greens": "එළවළු", "banana": "පළතුරු", "lime": "පළතුරු", "salt": "කුළුබඩු", "chili-powder": "කුළුබඩු", "curry-powder": "කුළුබඩු", "turmeric": "කුළුබඩු", "pepper": "කුළුබඩු", "cinnamon": "කුළුබඩු", "cloves": "කුළුබඩු", "cardamom": "කුළුබඩු", "mustard": "කුළුබඩු", "fenugreek": "කුළුබඩු", "cumin": "කුළුබඩු", "coriander": "කුළුබඩු", "garlic": "කුළුබඩු", "ginger": "කුළුබඩු", "rice": "ධාන්‍ය වර්ග", "dal": "ධාන්‍ය වර්ග", "atta": "ධාන්‍ය වර්ග", "wheat-flour": "ධාන්‍ය වර්ග", "chickpea": "ධාන්‍ය වර්ග", "mung": "ධාන්‍ය වර්ග", "cowpea": "ධාන්‍ය වර්ග", "noodles": "ධාන්‍ය වර්ග", "pasta": "ධාන්‍ය වර්ග", "eggs": "මස් මාලු බිත්තර", "canned-fish": "මස් මාලු බිත්තර"};
  function catFor(it) {
    if (CATS.indexOf(it.cat) >= 0) return it.cat;
    if (OLD_CAT[it.id]) return OLD_CAT[it.id];
    if (it.cat === 'පිරිසිදු') return 'පිරිසිදු කරන ද්‍රව්‍ය';
    return 'වෙනත්';
  }

  function cleanItem(it) {
    var cat = catFor(it);
    return {
      id: String(it.id).slice(0, 60),
      name: String(it.name || '').trim().slice(0, 80) || 'නමක් නැති බඩුව',
      cat: cat,
      unit: String(it.unit || '').trim().slice(0, 20),
      qty: Math.max(0, r2(num(it.qty, 0))),
      monthly: Math.max(0, r2(num(it.monthly, 0))),
      daily: Math.max(0, r2(num(it.daily, 0))),
      low: Math.max(0, r2(num(it.low, 0)))
    };
  }

  // පරණ app එකේ state එකක් (v1-v8) අලුත් හැඩයට හරවනවා
  function normalize(s, today) {
    s = s && typeof s === 'object' ? s : {};
    var items = Array.isArray(s.items) ? s.items.filter(function (i) { return i && i.id != null; }).map(cleanItem) : [];
    var seen = {};
    items = items.filter(function (i) { if (seen[i.id]) return false; seen[i.id] = 1; return true; });
    var log = Array.isArray(s.log) ? s.log.filter(Boolean).map(function (l) {
      return { d: l.d || l.date || '', id: l.id, n: l.n || l.name || '', delta: r2(l.delta), why: l.why || '', by: l.by || '', ts: l.ts || 0 };
    }) : [];
    var out = {
      schema: 2,
      version: Number(s.version) || 1,
      monthKey: s.monthKey || monthOf(today || localDate()),
      monthStart: s.monthStart && typeof s.monthStart === 'object' ? s.monthStart : {},
      lastCookDate: s.lastCookDate || '',
      items: items,
      log: log,
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
    var cut = new Date(new Date(today + 'T00:00:00Z').getTime() - LOG_KEEP_DAYS * 86400000).toISOString().slice(0, 10);
    state.log = state.log.filter(function (l) { return !l.d || l.d >= cut; });
    if (state.log.length > LOG_MAX) state.log = state.log.slice(-LOG_MAX);
  }

  function find(state, id) {
    for (var i = 0; i < state.items.length; i++) if (state.items[i].id === id) return state.items[i];
    return null;
  }

  function addLog(state, op, it, delta, why) {
    if (!delta) return;
    state.log.push({ d: op.date, id: it.id, n: it.name, delta: r2(delta), why: why, by: op.by || '', ts: op.ts || 0 });
  }

  // එක op එකක් state එකට දානවා. ආපහු දෙන්නේ undo කරන්න ඕන වෙනස්කම් ලිස්ට් එක.
  function apply(state, op) {
    if (!op || typeof op !== 'object') return { ok: false, err: 'bad op' };
    if (!validDate(op.date)) op.date = localDate();
    op.by = String(op.by || '').slice(0, 30);
    var changes = [];
    var it, d;
    switch (op.op) {
      case 'adjust':
        it = find(state, op.id); if (!it) return { ok: false, err: 'no item' };
        d = num(op.delta, 0);
        var before = it.qty;
        it.qty = Math.max(0, r2(it.qty + d));
        d = r2(it.qty - before);
        addLog(state, op, it, d, String(op.why || (d < 0 ? 'use' : 'add')).slice(0, 20));
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
        (Array.isArray(op.items) ? op.items : []).forEach(function (b) {
          var x = find(state, b.id); var q = Math.max(0, num(b.qty, 0));
          if (!x || !q) return;
          x.qty = r2(x.qty + q);
          addLog(state, op, x, q, 'buy');
          changes.push({ id: x.id, delta: q });
        });
        break;
      case 'undo':
        (Array.isArray(op.changes) ? op.changes : []).forEach(function (c) {
          var x = find(state, c.id); if (!x) return;
          var b = x.qty; x.qty = Math.max(0, r2(x.qty - num(c.delta, 0)));
          addLog(state, op, x, r2(x.qty - b), 'undo:' + String(op.of || '').slice(0, 12));
        });
        if (op.of === 'cook' && op.prevCookDate !== undefined) state.lastCookDate = String(op.prevCookDate || '');
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
          it.name = clean.name; it.cat = clean.cat; it.unit = clean.unit;
          it.monthly = clean.monthly; it.daily = clean.daily; it.low = clean.low;
          if (op.item.qty !== undefined && op.item.qty !== null && op.item.qty !== '') {
            it.qty = clean.qty;
            addLog(state, op, it, r2(it.qty - qtyBefore), 'set');
          }
        }
        break;
      case 'delete':
        var idx = -1;
        state.items.forEach(function (x, i) { if (x.id === op.id) idx = i; });
        if (idx < 0) return { ok: true, changes: [] };
        state.items.splice(idx, 1);
        break;
      default:
        return { ok: false, err: 'unknown op' };
    }
    return { ok: true, changes: changes };
  }

  // Server එකේ: op id එක කලින් දැකලා නම් ආයේ දාන්නේ නැහැ (නෙට් කැඩිලා දෙපාරක් ආවොත්)
  function applyOnce(state, op) {
    if (op.uid && state.seenOps.indexOf(op.uid) >= 0) return { ok: true, dup: true, changes: [] };
    var res = apply(state, op);
    if (op.uid) { state.seenOps.push(op.uid); if (state.seenOps.length > SEEN_MAX) state.seenOps = state.seenOps.slice(-SEEN_MAX); }
    return res;
  }

  // මේ මාසේ පාවිච්චි කළ / ගත්ත ප්‍රමාණ
  function monthSummary(state) {
    var mk = state.monthKey, out = {};
    state.log.forEach(function (l) {
      if (!l.d || l.d.slice(0, 7) !== mk) return;
      var w = l.why.indexOf('undo:') === 0 ? l.why.slice(5) : l.why;
      var o = out[l.id] || (out[l.id] = { used: 0, bought: 0 });
      if (w === 'use' || w === 'cook') o.used = r2(o.used - l.delta);
      else if (w === 'buy' || w === 'add') o.bought = r2(o.bought + l.delta);
    });
    return out;
  }

  function isLow(it) {
    if (it.low > 0 && it.qty <= it.low) return true;
    if (it.monthly > 0 && it.qty <= it.monthly * 0.25) return true;
    return it.qty <= 0;
  }

  function shopNeeded(it) {
    // මාසෙට ඕන ප්‍රමාණයෙන් බාගයක්වත් ඉවර වෙලා නම් හෝ අඩු නම් විතරයි ලිස්ට් එකට එන්නේ (0.03L වගේ පොඩි ඒවා නෙවෙයි)
    if (it.monthly > 0) return (isLow(it) || it.qty <= it.monthly * 0.5) ? Math.max(0, r2(it.monthly - it.qty)) : 0;
    if (!isLow(it)) return 0;
    var u = (it.unit || '').toLowerCase();
    if (u === 'g' || u === 'ml') return 100;
    if (u === 'kg' || u === 'l') return 1;
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

  // Client එකට යවන හැඩය (log එක ඔක්කොම නෙවෙයි — අන්තිම 40 සහ සාරාංශය විතරයි)
  function publicView(state) {
    return {
      schema: 2,
      version: state.version,
      monthKey: state.monthKey,
      monthStart: state.monthStart,
      lastCookDate: state.lastCookDate,
      items: state.items,
      summary: monthSummary(state),
      recent: state.log.slice(-40).reverse()
    };
  }

  return {
    TZ: TZ, CATS: CATS, r2: r2, localDate: localDate, monthOf: monthOf, normalize: normalize, rollover: rollover,
    pruneLog: pruneLog, apply: apply, applyOnce: applyOnce, monthSummary: monthSummary, isLow: isLow,
    shopNeeded: shopNeeded, stepFor: stepFor, publicView: publicView, cleanItem: cleanItem
  };
});
