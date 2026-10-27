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

  var CATS = ['එළවළු', 'කොළ වර්ග', 'පළතුරු', 'ධාන්‍ය වර්ග', 'කුළුබඩු', 'මස් මාලු බිත්තර', 'කිරි නිෂ්පාදන', 'කුස්සියේ බඩු', 'බීම වර්ග', 'බිස්කට් සහ කෑම', 'පිරිසිදු කරන ද්‍රව්‍ය', 'පුද්ගලික සනීපාරක්ෂක', 'ළදරු', 'බෙහෙත්', 'වෙනත්'];
  var SHOPS = ['සුපර්මාර්කට්', 'පොළ', 'ළඟ කඩේ', 'ෆාමසිය'];
  var PLACES = ['කුස්සිය', 'ෆ්‍රිජ්', 'ස්ටෝර් රූම්', 'නාන කාමරේ', 'බෙහෙත් පෙට්ටිය'];

  // බඩුවල පින්තූර (emoji) — සරල mode එකේ ලොකුවට පේනවා
  var ICONS = {
    rice: '🍚', dal: '🍲', atta: '🌾', 'wheat-flour': '🌾', butter: '🧈', astra: '🧈', 'coco-eat': '🥥', 'coco-lamp': '🪔', sugar: '🧂',
    tea: '🍵', potato: '🥔', 'big-onion': '🧅', 'red-onion': '🧅', veg: '🥬', highland: '🥛', salt: '🧂', 'chili-powder': '🌶️',
    'curry-powder': '🍛', turmeric: '🟡', pepper: '⚫', cinnamon: '🌰', garlic: '🧄', ginger: '🌿', noodles: '🍜', pasta: '🍝',
    soya: '🥩', chickpea: '🍲', mung: '🍲', cowpea: '🍲', 'milk-powder': '🥛', eggs: '🥚', 'canned-fish': '🐟', vinegar: '🍶',
    'soy-sauce': '🍶', 'tomato-sauce': '🍅', 'sunflower-oil': '🌻', coffee: '☕', biscuits: '🍪', peanuts: '🥜', jaggery: '🍯',
    tomato: '🍅', carrot: '🥕', beetroot: '🟣', cabbage: '🥬', beans: '🥬', brinjal: '🍆', 'bitter-gourd': '🥒', leeks: '🥬',
    cucumber: '🥒', greens: '🥬', banana: '🍌', lime: '🍋', apple: '🍎', orange: '🍊', mango: '🥭', papaya: '🍈', chicken: '🍗',
    fish: '🐟', paracetamol: '💊', plaster: '🩹', antiseptic: '🧴', 'baby-soap': '🧼', 'adult-soap': '🧼', comfort: '🧴',
    'vim-soap': '🧽', 'vim-liquid': '🧴', dash: '🧴', toilet: '🚽', air: '🌸', shampoo: '🧴', conditioner: '🧴'
  };
  var CAT_ICON = {'එළවළු': '🥦', 'කොළ වර්ග': '🥬', 'පළතුරු': '🍎', 'ධාන්‍ය වර්ග': '🌾', 'කුළුබඩු': '🌶️', 'මස් මාලු බිත්තර': '🥚', 'කිරි නිෂ්පාදන': '🥛', 'කුස්සියේ බඩු': '🥫', 'බීම වර්ග': '🥤', 'බිස්කට් සහ කෑම': '🍪', 'පිරිසිදු කරන ද්‍රව්‍ය': '🧹', 'පුද්ගලික සනීපාරක්ෂක': '🧴', 'ළදරු': '🍼', 'බෙහෙත්': '💊', 'වෙනත්': '📦'};
  // අලුත් emoji (Unicode 14+) පරණ ෆෝන්වල කොටුවක් විදිහට පේන නිසා පරණ ඒවට මාරු කරනවා
  var SAFE_EMOJI = { '\uD83E\uDED8': '🍲', '\uD83E\uDED3': '🥙', '\uD83E\uDEDB': '🥬', '\uD83E\uDEDA': '🌿' };
  function safeIcon(e) { return SAFE_EMOJI[e] || e; }
  function iconFor(it) { return safeIcon(it.icon || ICONS[it.id] || CAT_ICON[it.cat] || '📦'); }

  // ලංකාවේ ගෙවල්වල සාමාන්‍ය කෑම — මුලින්ම දාන වට්ටෝරු (ගෙදර 4කට, ආසන්න ප්‍රමාණ — app එකෙන් හදන්න පුළුවන්)
  var SEED_RECIPES = [
    { rid: 'rc-rice', name: 'බත්', icon: '🍚', items: [{ id: 'rice', qty: 0.5 }] },
    { rid: 'rc-dal', name: 'පරිප්පු කරිය', icon: '🍲', items: [{ id: 'dal', qty: 0.15 }, { id: 'red-onion', qty: 0.03 }, { id: 'garlic', qty: 5 }, { id: 'turmeric', qty: 2 }, { id: 'coco-eat', qty: 0.02 }, { id: 'salt', qty: 0.005 }] },
    { rid: 'rc-potato', name: 'අල තෙල් දාලා', icon: '🥔', items: [{ id: 'potato', qty: 0.5 }, { id: 'big-onion', qty: 0.1 }, { id: 'chili-powder', qty: 5 }, { id: 'coco-eat', qty: 0.03 }, { id: 'mustard', qty: 2 }] },
    { rid: 'rc-egg', name: 'බිත්තර කරිය', icon: '🥚', items: [{ id: 'eggs', qty: 4 }, { id: 'big-onion', qty: 0.05 }, { id: 'curry-powder', qty: 5 }, { id: 'chili-powder', qty: 3 }, { id: 'coco-eat', qty: 0.02 }] },
    { rid: 'rc-chicken', name: 'චිකන් කරිය', icon: '🍗', items: [{ id: 'chicken', qty: 0.5 }, { id: 'big-onion', qty: 0.1 }, { id: 'garlic', qty: 10 }, { id: 'ginger', qty: 10 }, { id: 'curry-powder', qty: 15 }, { id: 'chili-powder', qty: 10 }, { id: 'coco-eat', qty: 0.03 }] },
    { rid: 'rc-fish', name: 'ටින් මාළු', icon: '🐟', items: [{ id: 'canned-fish', qty: 1 }, { id: 'big-onion', qty: 0.1 }, { id: 'chili-powder', qty: 5 }, { id: 'coco-eat', qty: 0.02 }] },
    { rid: 'rc-roti', name: 'රොටී', icon: '🥙', items: [{ id: 'wheat-flour', qty: 0.3 }, { id: 'salt', qty: 0.003 }] },
    { rid: 'rc-tea', name: 'කිරි තේ (4ට)', icon: '🍵', items: [{ id: 'tea', qty: 8 }, { id: 'milk-powder', qty: 30 }, { id: 'sugar', qty: 0.04 }] }
  ];
  var BILL_SUGGEST = [
    { name: 'කරන්ට් බිල', icon: '⚡', day: 10 }, { name: 'වතුර බිල', icon: '💧', day: 15 },
    { name: 'ඉන්ටර්නෙට් / ෆෝන්', icon: '📶', day: 5 }, { name: 'ගෙවල් කුලිය', icon: '🏠', day: 1 }, { name: 'පාසල් ගාස්තු', icon: '🎒', day: 5 }
  ];

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
    if (it.cat === 'තෙල්, සෝස් සහ ටින්') return 'කුස්සියේ බඩු';
    return 'වෙනත්';
  }

  function cleanPrices(p) {
    var out = {}; if (!p || typeof p !== 'object') return out;
    Object.keys(p).slice(0, 12).forEach(function (k) { var v = p[k] || {}; var pr = Math.max(0, r2(num(v.price, 0))); if (pr) out[str(k, 30)] = { price: pr, date: validDate(v.date) ? v.date : '' }; });
    return out;
  }
  function cleanDoses(d) {
    return (Array.isArray(d) ? d : []).map(function (x) {
      var t = str(x && x.time, 5); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return null;
      return { time: t, qty: Math.max(0, r2(num(x.qty, 1))) || 1, who: str(x.who, 30) };
    }).filter(Boolean).slice(0, 8).sort(function (a, b) { return a.time < b.time ? -1 : 1; });
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
      icon: str(it.icon, 8),
      prices: cleanPrices(it.prices),                    // කඩෙන් කඩට මිල {කඩේ: {price, date}}
      doses: cleanDoses(it.doses)                        // බෙහෙත් වෙලාවල් [{time:'08:00', qty:1, who:'අම්මා'}]
    };
  }

  function cleanRecipe(r) {
    return {
      rid: str(r.rid, 40) || 'rc' + Date.now(),
      name: str(r.name, 60) || 'කෑමක්',
      icon: safeIcon(str(r.icon, 8)) || '🍛',
      items: (Array.isArray(r.items) ? r.items : []).map(function (x) { return { id: str(x.id, 60), qty: Math.max(0, r2(num(x.qty, 0))) }; }).filter(function (x) { return x.id && x.qty > 0; }).slice(0, 30)
    };
  }
  function cleanBill(b) {
    return {
      bid: str(b.bid, 40) || 'b' + Date.now(),
      name: str(b.name, 50) || 'බිලක්',
      icon: str(b.icon, 8) || '🧾',
      day: Math.min(31, Math.max(1, Math.round(num(b.day, 1)))),   // මාසේ ගෙවන්න ඕන දවස
      amount: Math.max(0, r2(num(b.amount, 0))),                  // සාමාන්‍ය ගණන
      paid: b.paid && typeof b.paid === 'object' ? b.paid : {}     // {'2026-10': {amount, by, ts}}
    };
  }
  function lastDayOf(mk) { var y = Number(mk.slice(0, 4)), m = Number(mk.slice(5, 7)); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function prevMonth(mk) { var y = Number(mk.slice(0, 4)), m = Number(mk.slice(5, 7)) - 1; if (!m) { m = 12; y--; } return y + '-' + String(m).padStart(2, '0'); }

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
      recipes: Array.isArray(s.recipes) ? s.recipes.map(cleanRecipe) : null,
      bills: Array.isArray(s.bills) ? s.bills.map(cleanBill) : [],
      gas: { history: s.gas && Array.isArray(s.gas.history) ? s.gas.history.filter(validDate).slice(-12) : [], days: s.gas ? Math.max(0, Math.round(num(s.gas.days, 0))) : 0, spend: s.gas && s.gas.spend && typeof s.gas.spend === 'object' ? s.gas.spend : {} },
      plan: s.plan && typeof s.plan === 'object' ? s.plan : {},               // සතියේ කෑම {'2026-10-28': ['rc-dal']}
      doseLog: s.doseLog && typeof s.doseLog === 'object' ? s.doseLog : {},  // {'2026-10-28': {'paracetamol@08:00': {by, ts}}}
      budget: { total: s.budget ? Math.max(0, r2(num(s.budget.total, 0))) : 0, cats: s.budget && s.budget.cats && typeof s.budget.cats === 'object' ? s.budget.cats : {} },
      seenOps: Array.isArray(s.seenOps) ? s.seenOps.slice(-SEEN_MAX) : []
    };
    out.items.forEach(function (i) { if (out.monthStart[i.id] === undefined) out.monthStart[i.id] = i.qty; });
    // මුල්ම වතාවට — ලිස්ට් එකේ තියෙන බඩු වලින් හදන්න පුළුවන් වට්ටෝරු ටික දානවා
    if (!out.recipes) {
      var have = {}; out.items.forEach(function (i) { have[i.id] = 1; });
      out.recipes = SEED_RECIPES.filter(function (r) { return have[r.items[0].id]; }).map(function (r) { return cleanRecipe({ rid: r.rid, name: r.name, icon: r.icon, items: r.items.filter(function (x) { return have[x.id]; }) }); })
        .filter(function (r) { return r.items.length; });
    }
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
    var cut14 = addDays(today, -14);
    Object.keys(state.plan).forEach(function (d) { if (d < cut14) delete state.plan[d]; });
    Object.keys(state.doseLog).forEach(function (d) { if (d < addDays(today, -7)) delete state.doseLog[d]; });
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
          if (p && q) {
            var unit = r2(p / q); if (unit !== x.price) { if (x.price) x.prevPrice = x.price; x.price = unit; }
            var shop = str(b.shop || op.shop, 30); if (shop) x.prices[shop] = { price: unit, date: op.date };
          }
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
          ['name', 'cat', 'unit', 'monthly', 'daily', 'low', 'shop', 'place', 'expiry', 'barcode', 'icon', 'doses'].forEach(function (k) {
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
      case 'cookRecipe':
        // වට්ටෝරුවක් ඉව්වාම ඒකට යන බඩු විතරක් අඩු කරනවා
        var rc = null; state.recipes.forEach(function (x) { if (x.rid === op.rid) rc = x; });
        if (!rc) return { ok: false, err: 'no recipe' };
        var times = Math.max(0.25, Math.min(10, num(op.times, 1)));
        rc.items.forEach(function (ri) {
          var x = find(state, ri.id); if (!x) return;
          var b = x.qty; x.qty = Math.max(0, r2(x.qty - ri.qty * times));
          var dd = r2(x.qty - b);
          addLog(state, op, x, dd, 'cook');
          if (dd) changes.push({ id: x.id, delta: dd });
        });
        break;
      case 'recipeUpsert':
        if (!op.recipe) return { ok: false, err: 'bad recipe' };
        var nr = cleanRecipe(op.recipe), ri2 = -1;
        state.recipes.forEach(function (x, i) { if (x.rid === nr.rid) ri2 = i; });
        if (ri2 >= 0) state.recipes[ri2] = nr; else state.recipes.push(nr);
        break;
      case 'recipeDel':
        state.recipes = state.recipes.filter(function (x) { return x.rid !== op.rid; });
        break;
      case 'billUpsert':
        if (!op.bill) return { ok: false, err: 'bad bill' };
        var ob = null; state.bills.forEach(function (x) { if (x.bid === op.bill.bid) ob = x; });
        var nb = cleanBill(Object.assign({}, op.bill, { paid: ob ? ob.paid : {} }));
        if (ob) state.bills[state.bills.indexOf(ob)] = nb; else state.bills.push(nb);
        break;
      case 'billDel':
        state.bills = state.bills.filter(function (x) { return x.bid !== op.bid; });
        break;
      case 'billPaid':
        state.bills.forEach(function (x) {
          if (x.bid !== op.bid) return;
          var bm = /^\d{4}-\d{2}$/.test(op.month || '') ? op.month : monthOf(op.date);
          if (op.paid) x.paid[bm] = { amount: Math.max(0, r2(num(op.amount, x.amount))), by: op.by, ts: op.ts || 0 };
          else delete x.paid[bm];
          var keys = Object.keys(x.paid).sort(); keys.slice(0, Math.max(0, keys.length - 13)).forEach(function (k) { delete x.paid[k]; });
        });
        break;
      case 'gas':
        if (op.action === 'changed') {
          if (state.gas.history.indexOf(op.date) < 0) state.gas.history.push(op.date);
          state.gas.history.sort(); state.gas.history = state.gas.history.slice(-12);
          var gp = Math.max(0, num(op.price, 0));
          if (gp) { var gm = monthOf(op.date); state.gas.spend[gm] = r2((state.gas.spend[gm] || 0) + gp); }
        } else if (op.action === 'undo') {
          state.gas.history = state.gas.history.filter(function (d) { return d !== op.day; });
          if (op.price) { var um = monthOf(op.day || op.date); state.gas.spend[um] = Math.max(0, r2((state.gas.spend[um] || 0) - num(op.price, 0))); }
        } else if (op.action === 'setDays') state.gas.days = Math.max(0, Math.min(365, Math.round(num(op.days, 0))));
        break;
      case 'budget':
        if (op.total !== undefined) state.budget.total = Math.max(0, r2(num(op.total, 0)));
        if (op.cats && typeof op.cats === 'object') {
          var bc = {}; Object.keys(op.cats).forEach(function (c) { var v = Math.max(0, r2(num(op.cats[c], 0))); if (v && (CATS.indexOf(c) >= 0 || c === 'ගෑස්')) bc[c] = v; });
          state.budget.cats = bc;
        }
        break;
      case 'plan':
        // එක දවසකට උයන කෑම ලිස්ට් එක
        if (!validDate(op.day)) return { ok: false, err: 'bad day' };
        var rids = (Array.isArray(op.rids) ? op.rids : []).map(function (x) { return str(x, 40); }).filter(function (x) { return state.recipes.some(function (r) { return r.rid === x; }); }).slice(0, 10);
        if (rids.length) state.plan[op.day] = rids; else delete state.plan[op.day];
        break;
      case 'dose':
        // බෙහෙත් බිව්වා / නැහැ
        it = find(state, op.id); if (!it) return { ok: false, err: 'no item' };
        var dz = null; it.doses.forEach(function (x) { if (x.time === op.time) dz = x; }); if (!dz) return { ok: false, err: 'no dose' };
        var dl = state.doseLog[op.date] || (state.doseLog[op.date] = {}), dk = it.id + '@' + op.time;
        if (op.taken && !dl[dk]) {
          dl[dk] = { by: op.by, ts: op.ts || 0 };
          var b0 = it.qty; it.qty = Math.max(0, r2(it.qty - dz.qty)); addLog(state, op, it, r2(it.qty - b0), 'use');
        } else if (!op.taken && dl[dk]) {
          delete dl[dk]; var b1 = it.qty; it.qty = r2(it.qty + dz.qty); addLog(state, op, it, r2(it.qty - b1), 'undo:use');
        }
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

  // සතියේ කෑම සැලැස්මට (අද ඉඳන් දවස් 7) ඕන බඩු ප්‍රමාණ
  function planNeeds(state, today) {
    var need = {}, end = addDays(today, 6), rmap = {};
    (state.recipes || []).forEach(function (r) { rmap[r.rid] = r; });
    Object.keys(state.plan || {}).forEach(function (d) {
      if (d < today || d > end) return;
      state.plan[d].forEach(function (rid) { var r = rmap[rid]; if (r) r.items.forEach(function (x) { need[x.id] = r2((need[x.id] || 0) + x.qty); }); });
    });
    return need;
  }
  function shopNeeded(it, planNeed) {
    var base = shopNeededBase(it);
    if (planNeed && planNeed > it.qty) return Math.max(base, r2(planNeed - it.qty));
    return base;
  }
  // බෙහෙත් වෙලාවල් — අද
  function dosesToday(state, today) {
    var out = [], dl = (state.doseLog || {})[today] || {};
    state.items.forEach(function (it) { (it.doses || []).forEach(function (d) {
      out.push({ id: it.id, name: it.name, unit: it.unit, time: d.time, qty: d.qty, who: d.who, taken: dl[it.id + '@' + d.time] || null, stock: it.qty });
    }); });
    return out.sort(function (a, b) { return a.time < b.time ? -1 : 1; });
  }
  function nowHM(d) {
    try { return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d || new Date()); }
    catch (e) { var o = new Date((d || new Date()).getTime() + 330 * 60000); return o.toISOString().slice(11, 16); }
  }
  function hmMin(t) { return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)); }

  function shopNeededBase(it) {
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

  // ගෑස් සිලින්ඩරය — සාමාන්‍යයෙන් කොච්චර දවසක් යනවද, ඊළඟට මාරු කරන්න වෙන්නේ කවදාද
  function gasStatus(state, today) {
    var h = state.gas.history; if (!h.length) return null;
    var avg = state.gas.days || 0, n = 0, sum = 0;
    if (!avg) {
      for (var i = 1; i < h.length; i++) { var g = dayNum(h[i]) - dayNum(h[i - 1]); if (g >= 7 && g <= 200) { sum += g; n++; } }
      avg = n ? Math.round(sum / n) : 45;
    }
    var last = h[h.length - 1], used = dayNum(today) - dayNum(last);
    return { last: last, avg: avg, learned: !state.gas.days && n > 0, used: used, left: avg - used, next: addDays(last, avg) };
  }

  // මාසේ වියදම කාණ්ඩ වලට බෙදලා (log එකේ ගෙවපු ගණන් වලින්)
  function spendByCat(state, mk) {
    var cat = {}, byId = {};
    state.items.forEach(function (i) { byId[i.id] = i.cat; });
    state.log.forEach(function (l) {
      if (!l.p || l.why !== 'buy' || !l.d || l.d.slice(0, 7) !== mk) return;
      var c = byId[l.id] || 'වෙනත්'; cat[c] = r2((cat[c] || 0) + l.p);
    });
    var itemsTotal = 0; Object.keys(cat).forEach(function (c) { itemsTotal += cat[c]; });
    var other = r2((state.spend[mk] || 0) - itemsTotal);  // ලිස්ට් එකේ නැති දේවල්
    if (other > 0) cat['වෙනත්'] = r2((cat['වෙනත්'] || 0) + other);
    if (state.gas.spend[mk]) cat['ගෑස්'] = state.gas.spend[mk];
    return cat;
  }
  function monthTotal(state, mk) { return r2((state.spend[mk] || 0) + (state.gas.spend[mk] || 0)); }

  function billsStatus(state, today) {
    var mk = monthOf(today), day = Number(today.slice(8)), last = lastDayOf(mk);
    return state.bills.map(function (b) {
      var due = Math.min(b.day, last), paid = b.paid[mk] || null;
      return { bid: b.bid, name: b.name, icon: b.icon, amount: b.amount, due: due, left: due - day, paid: paid };
    }).sort(function (a, b) { return (!!a.paid - !!b.paid) || a.due - b.due; });
  }
  function billsTotal(state, mk) { var t = 0; state.bills.forEach(function (b) { if (b.paid[mk]) t += b.paid[mk].amount || 0; }); return r2(t); }

  // මාසේ සාරාංශය (WhatsApp එකට යවන්න)
  function monthReport(state, mk, today) {
    var sum = {}, names = {};
    state.items.forEach(function (i) { names[i.id] = i; });
    state.log.forEach(function (l) {
      if (!l.d || l.d.slice(0, 7) !== mk) return;
      var w = baseWhy(l.why), o = sum[l.id] || (sum[l.id] = { used: 0, spent: 0 });
      if (w === 'use' || w === 'cook') o.used = r2(o.used - l.delta);
      if (l.p && l.why === 'buy') o.spent = r2(o.spent + l.p);
    });
    var top = Object.keys(sum).filter(function (id) { return sum[id].spent > 0; }).sort(function (a, b) { return sum[b].spent - sum[a].spent; }).slice(0, 5)
      .map(function (id) { return { name: (names[id] || {}).name || id, spent: sum[id].spent }; });
    var used = Object.keys(sum).filter(function (id) { return sum[id].used > 0 && names[id]; }).sort(function (a, b) { return sum[b].used - sum[a].used; }).slice(0, 5)
      .map(function (id) { return { name: names[id].name, used: sum[id].used, unit: names[id].unit }; });
    return {
      month: mk, total: monthTotal(state, mk), prevTotal: monthTotal(state, prevMonth(mk)), budget: state.budget.total,
      byCat: spendByCat(state, mk), top: top, used: used, bills: billsTotal(state, mk),
      billList: state.bills.filter(function (b) { return b.paid[mk]; }).map(function (b) { return { name: b.name, amount: b.paid[mk].amount }; }),
      unpaid: state.bills.filter(function (b) { return !b.paid[mk]; }).map(function (b) { return b.name; }),
      gasChanges: state.gas.history.filter(function (d) { return d.slice(0, 7) === mk; }).length,
      toBuy: (function () { var pn = planNeeds(state, today); return state.items.filter(function (it) { return shopNeeded(it, pn[it.id]) > 0; }).map(function (it) { return it.name; }); })()
    };
  }

  // ෆෝන් notification එකටයි app එකේ banner එකටයි පණිවිඩ
  function alerts(state, today, rates, hm) {
    rates = rates || usageRates(state, today);
    var out = [];
    var pn = planNeeds(state, today);
    // බෙහෙත් — වෙලාව පැනලා පැයක් ගියත් බිව්වේ නැත්නම්
    hm = hm || nowHM();
    var missed = dosesToday(state, today).filter(function (d) { return !d.taken && hmMin(hm) - hmMin(d.time) >= 60; });
    if (missed.length) out.push({ kind: 'dose', text: '💊 තාම බිව්වේ නැහැ: ' + missed.map(function (d) { return (d.who ? d.who + ' — ' : '') + d.name + ' (' + d.time + ')'; }).join(', ') });
    var lowMed = state.items.filter(function (it) { return it.doses && it.doses.length && rates[it.id] && rates[it.id].daysLeft <= 5; }).map(function (it) { return it.name; });
    if (lowMed.length) out.push({ kind: 'medLow', text: '💊 බෙහෙත් ඉවර වෙන්න ළඟයි (දවස් 5ක් ඇතුළත): ' + lowMed.join(', ') + ' — ෆාමසියට යන්න' });
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
    // බිල්පත්
    billsStatus(state, today).forEach(function (b) {
      if (b.paid) return;
      if (b.left < 0) out.push({ kind: 'billLate', text: b.icon + ' ' + b.name + ' තාම ගෙව්වේ නැහැ — ' + b.due + ' වෙනිදා ගෙවන්න තිබුණා' });
      else if (b.left <= 3) out.push({ kind: 'bill', text: b.icon + ' ' + b.name + ' ගෙවන්න — ' + (b.left === 0 ? 'අද' : 'දවස් ' + b.left + 'කින්') + (b.amount ? ' (~රු. ' + Math.round(b.amount) + ')' : '') });
    });
    // ගෑස්
    var gs = gasStatus(state, today);
    if (gs && gs.left <= 5) out.push({ kind: 'gas', text: '🔥 ගෑස් සිලින්ඩරය ' + (gs.left < 0 ? 'ඉවර වෙන්න ඕන කාලේ පැනලා (දවස් ' + gs.used + ')' : 'දවස් ' + gs.left + 'කින් විතර ඉවර වෙයි') + ' — අමතරයක් ගන්න' });
    // Budget
    var mkB = monthOf(today), spentB = monthTotal(state, mkB);
    if (state.budget.total > 0 && spentB >= state.budget.total * 0.8) {
      var pctB = Math.round(spentB / state.budget.total * 100);
      out.push({ kind: pctB >= 100 ? 'budgetOver' : 'budget', text: '💵 මේ මාසේ budget එකෙන් ' + pctB + '% ගියා (රු. ' + Math.round(spentB) + ' / ' + Math.round(state.budget.total) + ')' });
    }
    // මාසේ අන්තිම දවස් 2 — සාරාංශය යවන්න
    if (Number(today.slice(8)) >= lastDayOf(mkB) - 1) out.push({ kind: 'summary', text: '📊 මාසේ ඉවර වෙනවා — "මාසය" ටැබ් එකෙන් සාරාංශය ගෙදර group එකට යවන්න' });
    var day = Number(today.slice(8)), sd = state.shopDay || 25;
    var need = state.items.filter(function (it) { return shopNeeded(it, pn[it.id]) > 0; }).length + open.length;
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
      recipes: state.recipes,
      bills: state.bills,
      gas: state.gas,
      budget: state.budget,
      plan: state.plan,
      doseLog: state.doseLog,
      summary: monthSummary(state),
      rates: rates,
      recent: state.log.slice(-60).reverse(),
      // මිලක් තියෙන ගැනුම් විතරක් (අන්තිම දවස් 70) — app එකේ කාණ්ඩ වියදම / මාසික සාරාංශයට
      paidLog: state.log.filter(function (l) { return l.p && l.d >= addDays(today, -70); })
    };
  }

  return {
    TZ: TZ, CATS: CATS, SHOPS: SHOPS, PLACES: PLACES, r2: r2, localDate: localDate, monthOf: monthOf, addDays: addDays,
    normalize: normalize, rollover: rollover, pruneLog: pruneLog, apply: apply, applyOnce: applyOnce, monthSummary: monthSummary,
    usageRates: usageRates, isLow: isLow, expiryStatus: expiryStatus, shopNeeded: shopNeeded, stepFor: stepFor, alerts: alerts,
    publicView: publicView, cleanItem: cleanItem, iconFor: iconFor, gasStatus: gasStatus, spendByCat: spendByCat, monthTotal: monthTotal,
    billsStatus: billsStatus, billsTotal: billsTotal, planNeeds: planNeeds, dosesToday: dosesToday, nowHM: nowHM, monthReport: monthReport, prevMonth: prevMonth, BILL_SUGGEST: BILL_SUGGEST
  };
});
