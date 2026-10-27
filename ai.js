// ගෙදර බඩු — AI උදව් (බිල් photo එක කියවන්න, කතා කරපු දේ තේරුම් ගන්න)
// Coolify env එකේ ANTHROPIC_API_KEY දැම්මොත් විතරයි වැඩ කරන්නේ. නැත්නම් app එකේ මේ බොත්තම් පේන්නේ නැහැ.
'use strict';

const API_KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
const MODEL = process.env.AI_MODEL || 'claude-haiku-5-5';
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 60); // වියදම පාලනයට — දවසකට උපරිම වාර ගණන

let usage = { day: '', n: 0 };
function allow(today) {
  if (usage.day !== today) usage = { day: today, n: 0 };
  if (usage.n >= DAILY_LIMIT) return false;
  usage.n++; return true;
}

async function callClaude(content, maxTokens) {
  const r = await fetch((process.env.AI_BASE_URL || 'https://api.anthropic.com') + '/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: maxTokens || 1500, messages: [{ role: 'user', content }] }),
    signal: AbortSignal.timeout(60000)
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || ('AI ' + r.status));
  const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI returned no JSON');
  return JSON.parse(m[0]);
}

function itemList(state) {
  return state.items.map(i => `${i.id} | ${i.name} | ${i.unit || '-'} | ${i.cat}`).join('\n');
}

async function readReceipt(state, image, mediaType) {
  const prompt = `This is a photo of a shop receipt from Sri Lanka (prices in LKR).
The household keeps this stock list (id | Sinhala name | unit | category):
${itemList(state)}

Read every purchased line on the receipt. For each line, set "itemId" to the matching id from the list ONLY when it is clearly the same product (receipt names are usually English or brand names, the list is Sinhala — e.g. "RICE SAMBA 5KG" = හාල්, "WHITE SUGAR" = සීනි). Otherwise use null.
"qty" must be in the list item's unit (e.g. 500g bought and unit is kg → 0.5; unit g → 500; packets → count). If unknown use the receipt quantity.
"price" is the line total paid in LKR (number).
Reply with JSON only, no other text:
{"shop": "shop name or null", "date": "YYYY-MM-DD or null", "total": number or null, "lines": [{"text": "line as printed", "itemId": "id or null", "qty": number, "price": number}]}`;
  const out = await callClaude([
    { type: 'image', source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: image } },
    { type: 'text', text: prompt }
  ], 2500);
  const ids = new Set(state.items.map(i => i.id));
  out.lines = (Array.isArray(out.lines) ? out.lines : []).slice(0, 80).map(l => ({
    text: String(l.text || '').slice(0, 80),
    itemId: ids.has(l.itemId) ? l.itemId : null,
    qty: Math.max(0, Number(l.qty) || 0),
    price: Math.max(0, Number(l.price) || 0)
  }));
  return out;
}

async function parseVoice(state, text) {
  const recipes = (state.recipes || []).map(r => `${r.rid} | ${r.name}`).join('\n');
  const prompt = `A Sri Lankan family member said this (Sinhala, maybe mixed with English) to their household stock app:
"${String(text).slice(0, 300)}"

Stock list (id | Sinhala name | unit | category):
${itemList(state)}

Recipes (id | name):
${recipes || '(none)'}

Turn it into actions. Types:
- "buy": bought an item (itemId, qty in the item's unit, price in LKR if said else 0)
- "use": used some of an item (itemId, qty)
- "finish": an item is finished / ran out (itemId)
- "cook": cooked a recipe (recipeId)
- "request": someone needs something not clearly in the list (text)
- "set": the current amount is now X (itemId, qty)
Sinhala numbers: එක=1, දෙක=2, තුන=3, හතර=4, පහ=5, හය=6, හත=7, අට=8, නවය=9, දහය=10, බාගයක්=0.5, කිලෝ=kg, ග්‍රෑම්=g, ලීටර්=L.
Reply with JSON only:
{"actions": [{"type": "...", "itemId": "id or null", "recipeId": "id or null", "qty": number, "price": number, "text": "..."}], "reply": "one short Sinhala sentence saying what you understood"}`;
  const out = await callClaude([{ type: 'text', text: prompt }], 800);
  const ids = new Set(state.items.map(i => i.id)), rids = new Set((state.recipes || []).map(r => r.rid));
  out.actions = (Array.isArray(out.actions) ? out.actions : []).slice(0, 10).filter(a => {
    if (['buy', 'use', 'finish', 'set'].includes(a.type)) return ids.has(a.itemId);
    if (a.type === 'cook') return rids.has(a.recipeId);
    if (a.type === 'request') return !!a.text;
    return false;
  }).map(a => ({ type: a.type, itemId: a.itemId || null, recipeId: a.recipeId || null, qty: Math.max(0, Number(a.qty) || 0), price: Math.max(0, Number(a.price) || 0), text: String(a.text || '').slice(0, 120) }));
  out.reply = String(out.reply || '').slice(0, 200);
  return out;
}

module.exports = { enabled: !!API_KEY, allow, readReceipt, parseVoice };
