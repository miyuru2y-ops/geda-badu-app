// ගෙදර බඩු ඇප් - එකම සර්වර් එකේ දත්ත, ෆෝන් 3ම එකම ලිස්ට් එක දකියි.
// Node පමණයි, වෙන කිසිම package එකක් ඕන නැහැ. Git -> Coolify deploy එකට හදලා තියෙන්නේ.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC = path.join(__dirname, 'public');

const INITIAL_ITEMS = [
  {"id": "baby-soap", "name": "බේබි සබන්", "cat": "පිරිසිදු කරන ද්‍රව්‍ය", "unit": "", "qty": 3, "monthly": 3, "daily": 0, "low": 1},
  {"id": "adult-soap", "name": "වැඩිහිටි සබන්", "cat": "පිරිසිදු කරන ද්‍රව්‍ය", "unit": "", "qty": 3, "monthly": 3, "daily": 0, "low": 1},
  {"id": "comfort", "name": "Comfort", "cat": "පිරිසිදු කරන ද්‍රව්‍ය", "unit": "බෝතල්", "qty": 1, "monthly": 1, "daily": 0, "low": 0},
  {"id": "vim-soap", "name": "Vim සබන්", "cat": "පිරිසිදු කරන ද්‍රව්‍ය", "unit": "", "qty": 3, "monthly": 3, "daily": 0, "low": 1},
  {"id": "vim-liquid", "name": "Vim Liquid", "cat": "පිරිසිදු කරන ද්‍රව්‍ය", "unit": "බෝතල්", "qty": 1, "monthly": 1, "daily": 0, "low": 0},
  {"id": "dash", "name": "Dash Tile Cleaner", "cat": "පිරිසිදු කරන ද්‍රව්‍ය", "unit": "බෝතල්", "qty": 1, "monthly": 1, "daily": 0, "low": 0},
  {"id": "toilet", "name": "Toilet Cleaner", "cat": "පිරිසිදු කරන ද්‍රව්‍ය", "unit": "බෝතල්", "qty": 1, "monthly": 1, "daily": 0, "low": 0},
  {"id": "air", "name": "Air Freshener", "cat": "පිරිසිදු කරන ද්‍රව්‍ය", "unit": "බෝතල්", "qty": 1, "monthly": 1, "daily": 0, "low": 0},
  {"id": "shampoo", "name": "Shampoo", "cat": "පිරිසිදු කරන ද්‍රව්‍ය", "unit": "බෝතල්", "qty": 1, "monthly": 1, "daily": 0, "low": 0},
  {"id": "conditioner", "name": "Conditioner", "cat": "පිරිසිදු කරන ද්‍රව්‍ය", "unit": "බෝතල්", "qty": 1, "monthly": 1, "daily": 0, "low": 0},
  {"id": "rice", "name": "හාල්", "cat": "ධාන්‍ය වර්ග", "unit": "kg", "qty": 15, "monthly": 15, "daily": 0.5, "low": 3},
  {"id": "dal", "name": "පරිප්පු", "cat": "ධාන්‍ය වර්ග", "unit": "kg", "qty": 3, "monthly": 3, "daily": 0.1, "low": 0.5},
  {"id": "atta", "name": "ආටා පිටි", "cat": "ධාන්‍ය වර්ග", "unit": "kg", "qty": 2, "monthly": 2, "daily": 0.1, "low": 0.5},
  {"id": "butter", "name": "බටර්", "cat": "වෙනත්", "unit": "g", "qty": 200, "monthly": 200, "daily": 10, "low": 50},
  {"id": "astra", "name": "Astra", "cat": "වෙනත්", "unit": "g", "qty": 500, "monthly": 500, "daily": 15, "low": 100},
  {"id": "coco-eat", "name": "පොල් තෙල් - කෑමට", "cat": "වෙනත්", "unit": "L", "qty": 2, "monthly": 2, "daily": 0.07, "low": 0.5},
  {"id": "coco-lamp", "name": "පොල් තෙල් - පහනට", "cat": "වෙනත්", "unit": "L", "qty": 1, "monthly": 1, "daily": 0, "low": 0.25},
  {"id": "sugar", "name": "සීනි", "cat": "වෙනත්", "unit": "kg", "qty": 5, "monthly": 5, "daily": 0.15, "low": 1},
  {"id": "tea", "name": "බෝගවන්තලාව තේ 400g x 2", "cat": "වෙනත්", "unit": "g", "qty": 800, "monthly": 800, "daily": 25, "low": 200},
  {"id": "potato", "name": "අල", "cat": "එළවළු", "unit": "kg", "qty": 3, "monthly": 3, "daily": 0.1, "low": 0.5},
  {"id": "big-onion", "name": "ලොකු ළූණු", "cat": "එළවළු", "unit": "kg", "qty": 5, "monthly": 5, "daily": 0.15, "low": 1},
  {"id": "red-onion", "name": "රතු ළූණු", "cat": "එළවළු", "unit": "kg", "qty": 2, "monthly": 2, "daily": 0.05, "low": 0.5},
  {"id": "veg", "name": "එළවළු", "cat": "එළවළු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "highland", "name": "Highland කිරි පැකට්", "cat": "වෙනත්", "unit": "පැකට්", "qty": 5, "monthly": 5, "daily": 0, "low": 1},
  {"id": "salt", "name": "ලුණු", "cat": "කුළුබඩු", "unit": "kg", "qty": 1, "monthly": 1, "daily": 0.02, "low": 0.25},
  {"id": "chili-powder", "name": "මිරිස් කුඩු", "cat": "කුළුබඩු", "unit": "g", "qty": 250, "monthly": 250, "daily": 10, "low": 50},
  {"id": "curry-powder", "name": "තුනපහ කුඩු", "cat": "කුළුබඩු", "unit": "g", "qty": 250, "monthly": 250, "daily": 15, "low": 50},
  {"id": "turmeric", "name": "කහ කුඩු", "cat": "කුළුබඩු", "unit": "g", "qty": 100, "monthly": 100, "daily": 5, "low": 20},
  {"id": "pepper", "name": "ගම්මිරිස් කුඩු", "cat": "කුළුබඩු", "unit": "g", "qty": 100, "monthly": 100, "daily": 3, "low": 20},
  {"id": "cinnamon", "name": "කුරුඳු", "cat": "කුළුබඩු", "unit": "g", "qty": 50, "monthly": 50, "daily": 0, "low": 10},
  {"id": "cloves", "name": "කරාබු නැටි", "cat": "කුළුබඩු", "unit": "g", "qty": 25, "monthly": 25, "daily": 0, "low": 5},
  {"id": "cardamom", "name": "එනසාල්", "cat": "කුළුබඩු", "unit": "g", "qty": 25, "monthly": 25, "daily": 0, "low": 5},
  {"id": "mustard", "name": "අබ", "cat": "කුළුබඩු", "unit": "g", "qty": 100, "monthly": 100, "daily": 2, "low": 20},
  {"id": "fenugreek", "name": "උළුහාල්", "cat": "කුළුබඩු", "unit": "g", "qty": 100, "monthly": 100, "daily": 2, "low": 20},
  {"id": "cumin", "name": "සූදුරු", "cat": "කුළුබඩු", "unit": "g", "qty": 100, "monthly": 100, "daily": 2, "low": 20},
  {"id": "coriander", "name": "කොත්තමල්ලි ඇට", "cat": "කුළුබඩු", "unit": "g", "qty": 100, "monthly": 100, "daily": 5, "low": 20},
  {"id": "garlic", "name": "සුදු ළූණු", "cat": "කුළුබඩු", "unit": "g", "qty": 250, "monthly": 250, "daily": 20, "low": 50},
  {"id": "ginger", "name": "ඉඟුරු", "cat": "කුළුබඩු", "unit": "g", "qty": 200, "monthly": 200, "daily": 10, "low": 50},
  {"id": "wheat-flour", "name": "පාන් පිටි", "cat": "ධාන්‍ය වර්ග", "unit": "kg", "qty": 2, "monthly": 2, "daily": 0.05, "low": 0.5},
  {"id": "noodles", "name": "නූඩ්ල්ස්", "cat": "ධාන්‍ය වර්ග", "unit": "පැකට්", "qty": 5, "monthly": 5, "daily": 0, "low": 1},
  {"id": "pasta", "name": "පැස්ටා", "cat": "ධාන්‍ය වර්ග", "unit": "g", "qty": 500, "monthly": 500, "daily": 0, "low": 100},
  {"id": "soya", "name": "සෝයා මීට්", "cat": "වෙනත්", "unit": "පැකට්", "qty": 5, "monthly": 5, "daily": 0, "low": 1},
  {"id": "chickpea", "name": "කඩල", "cat": "ධාන්‍ය වර්ග", "unit": "kg", "qty": 1, "monthly": 1, "daily": 0, "low": 0.25},
  {"id": "mung", "name": "මුං ඇට", "cat": "ධාන්‍ය වර්ග", "unit": "kg", "qty": 1, "monthly": 1, "daily": 0, "low": 0.25},
  {"id": "cowpea", "name": "කව්පි", "cat": "ධාන්‍ය වර්ග", "unit": "kg", "qty": 1, "monthly": 1, "daily": 0, "low": 0.25},
  {"id": "milk-powder", "name": "කිරි පිටි", "cat": "වෙනත්", "unit": "g", "qty": 400, "monthly": 400, "daily": 15, "low": 100},
  {"id": "eggs", "name": "බිත්තර", "cat": "මස් මාලු බිත්තර", "unit": "", "qty": 30, "monthly": 30, "daily": 2, "low": 6},
  {"id": "canned-fish", "name": "ටින් මාළු", "cat": "මස් මාලු බිත්තර", "unit": "ටින්", "qty": 4, "monthly": 4, "daily": 0, "low": 1},
  {"id": "vinegar", "name": "විනාකිරි", "cat": "වෙනත්", "unit": "බෝතල්", "qty": 1, "monthly": 1, "daily": 0, "low": 0},
  {"id": "soy-sauce", "name": "සෝයා සෝස්", "cat": "වෙනත්", "unit": "බෝතල්", "qty": 1, "monthly": 1, "daily": 0, "low": 0},
  {"id": "tomato-sauce", "name": "තක්කාලි සෝස්", "cat": "වෙනත්", "unit": "බෝතල්", "qty": 1, "monthly": 1, "daily": 0, "low": 0},
  {"id": "sunflower-oil", "name": "සූරියකාන්ත තෙල්", "cat": "වෙනත්", "unit": "L", "qty": 1, "monthly": 1, "daily": 0.03, "low": 0.25},
  {"id": "coffee", "name": "කෝපි", "cat": "වෙනත්", "unit": "g", "qty": 200, "monthly": 200, "daily": 7, "low": 50},
  {"id": "biscuits", "name": "බිස්කට්", "cat": "වෙනත්", "unit": "පැකට්", "qty": 4, "monthly": 4, "daily": 0, "low": 1},
  {"id": "peanuts", "name": "රටකජු", "cat": "වෙනත්", "unit": "g", "qty": 500, "monthly": 500, "daily": 0, "low": 100},
  {"id": "jaggery", "name": "හකුරු", "cat": "වෙනත්", "unit": "g", "qty": 500, "monthly": 500, "daily": 10, "low": 100},
  {"id": "tomato", "name": "තක්කාලි", "cat": "එළවළු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "carrot", "name": "කැරට්", "cat": "එළවළු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "beetroot", "name": "බීට්", "cat": "එළවළු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "cabbage", "name": "ගෝවා", "cat": "එළවළු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "beans", "name": "බෝංචි", "cat": "එළවළු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "brinjal", "name": "වම්බටු", "cat": "එළවළු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "bitter-gourd", "name": "කරවිල", "cat": "එළවළු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "leeks", "name": "ලීක්ස්", "cat": "එළවළු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "cucumber", "name": "පිපිඤ්ඤා", "cat": "එළවළු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "greens", "name": "කොළ වර්ග", "cat": "එළවළු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "banana", "name": "කෙසෙල්", "cat": "පළතුරු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "lime", "name": "දෙහි", "cat": "පළතුරු", "unit": "", "qty": 10, "monthly": 0, "daily": 0, "low": 0},
  {"id": "apple", "name": "ඇපල්", "cat": "පළතුරු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "orange", "name": "දොඩම්", "cat": "පළතුරු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "mango", "name": "අඹ", "cat": "පළතුරු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "papaya", "name": "පැපොල්", "cat": "පළතුරු", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "chicken", "name": "කුකුල් මස්", "cat": "මස් මාලු බිත්තර", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "fish", "name": "මාළු", "cat": "මස් මාලු බිත්තර", "unit": "kg", "qty": 1, "monthly": 0, "daily": 0, "low": 0},
  {"id": "paracetamol", "name": "පැරසිටමෝල්", "cat": "බෙහෙත්", "unit": "පැකට්", "qty": 1, "monthly": 1, "daily": 0, "low": 0},
  {"id": "plaster", "name": "ප්ලාස්ටර්", "cat": "බෙහෙත්", "unit": "පැකට්", "qty": 1, "monthly": 1, "daily": 0, "low": 0},
  {"id": "antiseptic", "name": "ඇන්ටිසෙප්ටික් ක්‍රීම්", "cat": "බෙහෙත්", "unit": "ටියුබ්", "qty": 1, "monthly": 1, "daily": 0, "low": 0}
];

function initialState() {
  const now = new Date();
  const monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = {};
  INITIAL_ITEMS.forEach(i => { monthStart[i.id] = i.qty; });
  return { version: 1, monthKey, monthStart, lastCookDate: '', items: INITIAL_ITEMS, log: [] };
}

let state;
try { state = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
catch { state = initialState(); fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2)); }

function save() {
  state.version = (state.version || 0) + 1;
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  // CORS: APK loads from file:// (origin null) — without these headers Android WebView blocks the API reply.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.url === '/api/state' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(state));
  }
  if (req.url === '/api/state' && req.method === 'POST') {
    let body = '';
    req.on('data', c => { body += c; if (body.length > 500000) req.destroy(); });
    req.on('end', () => {
      try {
        const incoming = JSON.parse(body);
        if (!incoming || !Array.isArray(incoming.items)) throw new Error('bad state');
        // සරල නීතිය: අන්තිමට Save කළ ෆෝන් එකේ දත්ත තමයි හැමෝටම පේන්නේ.
        // Polling නිසා එක ෆෝන් එකක් edit කරන වෙලාවේ අනිත් ෆෝන් එකේ පරණ දත්ත overwrite වෙන්නේ නැහැ
        // (client එක version එක වෙනස් වෙලා නම් pehle අලුත් දත්ත ගන්නවා).
        state = incoming; save();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(state));
      } catch (e) {
        res.writeHead(400); return res.end('bad request');
      }
    });
    return;
  }
  let filePath = path.join(PUBLIC, req.url === '/' ? 'index.html' : req.url);
  if (!filePath.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    const headers = { 'Content-Type': MIME[path.extname(filePath)] || 'text/plain' };
    if (filePath.endsWith('index.html')) headers['Cache-Control'] = 'no-cache';
    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, () => console.log('Geda Badu app on port ' + PORT));
