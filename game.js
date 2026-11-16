// 鹽酥雞攤 MVP — 單一完整一晚
(() => {
'use strict';
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
cv.style.cursor = 'none';
const W = 1280, H = 720; // 版面座標(邏輯單位);v3.7 實際以 2560×1440(×DPR)繪製
const RES = 2; // 2K:1 版面單位 = 2 像素
function fitCanvas() {
  const vw = window.innerWidth, vh = window.innerHeight; const cw = Math.min(vw, vh * 16 / 9), ch = cw * 9 / 16;
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
  const dpr = window.devicePixelRatio || 1; const bw = Math.max(W * RES, Math.round(cw * dpr)), bh = Math.round(bw * 9 / 16);
  if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
}
fitCanvas(); window.addEventListener('resize', fitCanvas);
const params = new URLSearchParams(location.search);
const FONT = '"NightMarketPixel","WenQuanYi Zen Hei","Noto Sans CJK TC","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

// ---------- 亂數 ----------
let seed = +(params.get('seed') || (Date.now() % 100000));
function rng() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const rand = (a, b) => a + rng() * (b - a);
const pick = a => a[Math.floor(rng() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SPEED = clamp(+(params.get('speed') || 1), 0.25, 20);

// ---------- 美術素材(載入失敗時退回程式繪製) ----------
const IMG = {};
function assetPath(src) {
  const rel = String(src || '').replace(/^\//, '');
  const base = (typeof window !== 'undefined' && window.__ASSET_BASE) || '/';
  return base + rel;
}
if (typeof document !== 'undefined' && !document.getElementById('nm-pixel-font')) {
  const face = document.createElement('style');
  face.id = 'nm-pixel-font';
  face.textContent = `@font-face{font-family:NightMarketPixel;src:url("${assetPath('public/assets/font.ttf')}") format("truetype");font-display:swap;}`;
  document.head.appendChild(face);
}
function loadImg(k, src, trim) { const im = new Image(); im.onload = () => { IMG[k] = trim ? prepFood(im) : im; }; im.src = assetPath(src); }
// Production portraits retain their native 480×784 head-to-waist canvas and alpha.
function prepFood(im) {
  const w = im.width, h = im.height; if (!w || !h) return im;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  let d; try { d = g.getImageData(0, 0, w, h); } catch (e) { return im; }
  const px = d.data; let minX = w, minY = h, maxX = 0, maxY = 0, n = 0;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    const r = px[i], gv = px[i + 1], b = px[i + 2], mag = Math.min(r, b) - gv;
    if (mag > 40 && gv < 160) { px[i + 3] = 0; continue; }
    if (px[i + 3] > 28) { n++; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  }
  if (n < 20 || maxX <= minX) return im;
  g.putImageData(d, 0, 0);
  const pad = 2; minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad); maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  const cw = maxX - minX + 1, ch = maxY - minY + 1;
  if (cw > w * 0.94 && ch > h * 0.94) return c;
  const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
  c2.getContext('2d').drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
  return c2;
}
loadImg('bg', 'art/bg_stall.jpg');
const LAYOUT_ART = { counterBg: 'bg_counter', fryerBody: 'fryer_body', plateWell: 'plate_well', rackBoard: 'rack_board', orderSlip: 'slip', regularNote: 'note_regular' };
Object.entries(LAYOUT_ART).forEach(([key, file]) => loadImg(key, `public/assets/${file}.png?v=layout1`));
['normal','normal_b','normal_c','student','student_b','regular','aunt','drunk','inspector','byo','inspector_revealed','live'].forEach(k => loadImg('c_' + k, `public/assets/cust_${k}.png?v=waist1`));
['chicken','tempura','riceblood','bean','mushroom','squid'].forEach(k => loadImg('f_' + k, `art/food_${k}.png`));
loadImg('tankTop', 'art/fryer_top.jpg'); loadImg('basketTop', 'art/basket_top.png');
// v3.2:Grok 像素素材(assets/,由 _tools/cutout.py 去綠幕產生);沒載到就退回上面的舊圖
// v42:雞排改用 cutlet(整片)圖;鹽酥雞沿用原本一塊塊的雞肉圖
// v43:Grok 原圖 food_cutlet_raw 與 food_mushroom_raw 生成成同一張紫色石頭狀圖(雞排生料=杏鮑菇生料),改用 *_raw2(由炸好圖重新上色)
const ART_FILE = { chicken: 'cutlet', saltchicken: 'chicken' };
const RAW_FILE = { chicken: 'cutlet_raw2', mushroom: 'mushroom_raw2', tempura: 'tempura_raw2' };
const FRIED_FILE = { mushroom: 'art/food_mushroom.png' }; // 杏鮑菇炸好用切塊圖,和鹽酥雞塊區隔
const NEW_FOOD_ART = new Set(['porkskewer', 'babycorn', 'greenpepper', 'sweetpotato', 'squidball', 'silverbun']);
[...ALL_MENU, 'byo'].forEach(k => {
  if (NEW_FOOD_ART.has(k)) {
    loadImg('raw_' + k, `public/assets/food_${k}_raw.png?v=art2`);
    loadImg('fr_' + k, `public/assets/food_${k}_fried.png?v=art2`);
    return;
  }
  if (k === 'cartilage') return; const f = ART_FILE[k] || k; loadImg('raw_' + k, `assets/food_${RAW_FILE[k] || f + '_raw'}.png`, true); loadImg('fr_' + k, FRIED_FILE[k] || `assets/food_${f}_fried.png`, true); });
function keyCartilage(im, raw) {
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), px = d.data, w = c.width, h = c.height;
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    const r = px[i], gv = px[i + 1], b = px[i + 2], mag = Math.min(r, b) - gv;
    if (mag > 24 && gv < 200) px[i + 3] = mag > 70 ? 0 : Math.max(0, Math.round(px[i + 3] * (1 - (mag - 24) / 46)));
    else if (raw && px[i + 3] > 8) { px[i] = Math.min(255, Math.round(r * 0.28 + 168)); px[i + 1] = Math.min(255, Math.round(gv * 0.22 + 128)); px[i + 2] = Math.min(255, Math.round(b * 0.18 + 108)); }
    if (px[i + 3] > 24) { if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
  }
  g.putImageData(d, 0, 0);
  if (maxX <= minX) return c;
  const pad = 6; minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad); maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
  const c2 = document.createElement('canvas'); c2.width = maxX - minX + 1; c2.height = maxY - minY + 1;
  c2.getContext('2d').drawImage(c, minX, minY, c2.width, c2.height, 0, 0, c2.width, c2.height);
  return c2;
}
{ const im = new Image(); im.onload = () => { IMG.fr_cartilage = keyCartilage(im, false); IMG.raw_cartilage = keyCartilage(im, true); }; im.src = assetPath('assets/food_cartilage_fried.png'); }
loadImg('burnt', 'assets/food_burnt.png'); loadImg('bigNet', 'public/assets/basket_big.png?v=layout1'); loadImg('smallNet', 'public/assets/basket_small.png?v=layout1');
loadImg('tank2', 'assets/fryer_tank.png'); loadImg('uiCash', 'assets/ui_cash.png'); loadImg('uiRep', 'assets/ui_rep.png');
loadImg('bowl_salt', 'assets/bowl_pepper.png'); loadImg('bowl_spicy', 'assets/bowl_chili.png'); loadImg('bowl_basil', 'assets/food_basil_fried.png'); loadImg('scissorsP', 'assets/scissors.png'); loadImg('bagP', 'assets/food_bag.png'); loadImg('cashTray', 'assets/cash_tray.png');
['stall_front','bg_mid','shop_upgrade','night_summary','bg_rain','bg_temple','bg_ghost','bg_blackout','bg_far'].forEach(k => loadImg('sc_' + k, `assets/scene_${k}.jpg`));
['quiet','lantern','glut','spike','cram','feast','raid','fight','protect','oil','celeb','stockout','rival','crew','parade'].forEach(k => loadImg('news_' + k, `assets/news_${k}.jpg`));
loadImg('hand', 'assets/hand_boss.png');
loadImg('cat', 'assets/cat_market.png');
const meatCap = () => (typeof has === 'function' && has('bigNet')) ? 6 : MEAT_CAP;
['bigNet','smallNet','fridge','filter','neon','fan','bulk','heatlamp','generator'].forEach(k => loadImg('upg_' + k, `${['bigNet','smallNet','neon','bulk'].includes(k) ? 'public/assets' : 'assets'}/upg_${k}.png?v=art2`));
Object.entries({shaker_salt: 'shaker_salt', shaker_spicy: 'shaker_chili', shaker_basil: 'shaker_basil', steelBowl: 'bowl_steel', glassCase: 'case_glass'}).forEach(([key, file]) => loadImg(key, `public/assets/${file}.png?v=art2`));
const sfx = (n, ...a) => { const S = window.SFX; if (S && S[n]) S[n](...a); };
const foodImg = (k, fried = true) => IMG[(fried ? 'fr_' : 'raw_') + k] || IMG['f_' + (IMG_ALIAS[k] || k)];
const IMG_ALIAS = { byo: 'mushroom', saltchicken: 'chicken' };
// ---------- v43:語言切換 + 圖示化 UI ----------
let LANG = (() => { try { return params.get('lang') || localStorage.getItem('yansuji_lang') || 'zh'; } catch (e) { return 'zh'; } })();
const L = (zh, en) => LANG === 'en' ? en : zh;
const NM = k => LANG === 'en' ? (ITEMS[k].en || ITEMS[k].name) : ITEMS[k].name;
const CL = t => LANG === 'en' ? (CTYPES[t].en || CTYPES[t].label) : CTYPES[t].label;
function setLang(l) { LANG = l; try { localStorage.setItem('yansuji_lang', l); } catch (e) {} }
// 靜態字串字典(text()/btn() 會自動查)
const EN = {
  '倒掉': 'Dump', '不賣了': 'Refuse', '收銀': 'Register', '起鍋盤 — 調味、裝袋': 'Plate — season & bag', '收據(逐項加總)': 'Receipt',
  '🙇 道歉換單': '🙇 Swap order', '請他離開(-2)': 'Send away (-2)', '🚨 檢舉': '🚨 Report', '換油中…': 'Changing oil…',
  '🛍 裝袋 (Enter)': '🛍 Bag (Enter)', '🛍 裝袋(等客人)': '🛍 Bag (no guest)', '🛍 裝袋(盤子空)': '🛍 Bag (plate empty)', '🛍 裝袋(客人還沒到)': '🛍 Bag (guest coming)',
  '撈熟的(空白鍵)': 'Lift ready (Space)', '鐵盆下鍋(V)': 'Pour bowl (V)', '換油O': 'Oil O', '低溫Q': 'Low Q', '中溫W': 'Mid W', '高溫E': 'High E',
  '— 收攤時間,服務完排隊的客人 —': '— Closing time: serve the queue —', '🔒 可升級': '🔒 Upgrade',
  '展示櫃 — 客人自己撿;橘框=老闆補': 'Showcase  (orange = you add)',
};
const tr = s => (LANG === 'en' && typeof s === 'string' && EN[s]) || s;
function learn(zh, en) { if (zh && en) EN[zh] = en; }
if (typeof LINES_EN !== 'undefined') Object.keys(LINES_EN).forEach(k => {
  const z = LINES[k], e = LINES_EN[k];
  if (Array.isArray(z) && Array.isArray(e)) z.forEach((s, i) => learn(s, e[i]));
  else learn(z, e);
});
if (typeof WEATHER_EN !== 'undefined') Object.keys(WEATHER_EN).forEach(k => (WEATHER_LINES[k] || []).forEach((s, i) => learn(s, WEATHER_EN[k][i])));
Object.keys(CTYPES).forEach(k => learn(CTYPES[k].label, CTYPES[k].en));
['現金不夠', 'Not enough cash', '冰櫃放不下了', 'Fridge is full', '現金不夠換油', 'Cannot afford new oil', '衛生局稽查員', 'Inspector', '攤家', 'House', '當晚', 'Tonight', '隔夜料滿意度 -8', 'Day-old, mood −8', '無', 'none', '開始進貨', 'Buy stock', '重新開始', 'New game', '今晚紀事', "Tonight's log", '今晚淨變化', 'Net tonight', '收攤 → 設備店', 'Close → shop'].forEach((s, i, a) => { if (i % 2 === 0) learn(s, a[i + 1]); });
function setLine(c, zh, en) { if (!c) return; c.line = zh; c.lineEn = en || ''; }
function lineOf(c) { if (!c) return ''; return LANG === 'en' ? (c.lineEn || tr(c.line || '')) : (c.line || ''); }
function lastText() { const l = G.lastLine; if (!l) return ''; return LANG === 'en' ? (l.textEn || tr(l.text || '')) : (l.textZh || l.text || ''); }
function pickLine(key, from = 0) {
  let zhA = LINES[key] || LINES.greet; if (!Array.isArray(zhA)) zhA = [zhA]; zhA = zhA.slice(from);
  let enA = (typeof LINES_EN !== 'undefined' && LINES_EN[key]) || zhA; if (!Array.isArray(enA)) enA = [enA]; enA = enA.slice(from);
  const i = Math.floor(rng() * Math.max(1, zhA.length));
  return { zh: zhA[i] || '', en: enA[Math.min(i, Math.max(0, enA.length - 1))] || zhA[i] || '' };
}
function pickWeather() {
  const zhA = (typeof WEATHER_LINES !== 'undefined') && WEATHER_LINES[G.theme];
  if (!zhA || !zhA.length) return null;
  const enA = (typeof WEATHER_EN !== 'undefined' && WEATHER_EN[G.theme]) || zhA;
  const i = Math.floor(rng() * zhA.length);
  return { zh: zhA[i], en: enA[Math.min(i, enA.length - 1)] || zhA[i] };
}
function orderBits(items, en) {
  const m = countBy(items);
  return Object.keys(m).map(k => `${en ? (ITEMS[k].en || ITEMS[k].name) : ITEMS[k].name}×${m[k]}`).join(en ? ', ' : '、');
}
function rumorText() { const en = (typeof RUMOR_EN !== 'undefined' && RUMOR_EN[G.rumorId]) || G.rumor; return L(G.rumor, en); }
const pulse = (sp = 5) => 0.5 + 0.5 * Math.sin(performance.now() / 1000 * sp);
// 畫一個食材圖示(預設炸好的樣子),等比縮放置中
function blitFood(im, x, y, w, h, fill) {
  if (!im || !im.width || w < 2 || h < 2) return;
  const iw = im.width, ih = im.height, ar = iw / ih, extreme = ar > 1.55 || ar < 0.65;
  const sc = (fill && extreme) ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
  const dw = iw * sc, dh = ih * sc;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}
function foodIcon(k, cx, cy, s, fried = true) {
  const im = foodImg(k, fried); if (!im) { ctx.fillStyle = ITEMS[k].color; ctx.beginPath(); ctx.arc(cx, cy, s / 2.4, 0, 7); ctx.fill(); return; }
  blitFood(im, cx - s / 2, cy - s / 2, s, s, true);
}
// v44:類別徽章(語言無關)— 肉=橘底雞腿,非肉=綠底葉子
function catBadge(cx, cy, r, meat) {
  ctx.save(); ctx.fillStyle = meat ? '#e07a1f' : '#3a9a4a'; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, r * 0.18);
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.stroke();
  if (meat) { // 雞腿:肉球 + 骨頭
    ctx.fillStyle = '#8a3f12'; ctx.beginPath(); ctx.ellipse(cx - r * 0.18, cy - r * 0.15, r * 0.48, r * 0.38, -0.7, 0, 7); ctx.fill();
    ctx.strokeStyle = '#fff6e6'; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + r * 0.1, cy + r * 0.1); ctx.lineTo(cx + r * 0.45, cy + r * 0.45); ctx.stroke();
    ctx.fillStyle = '#fff6e6'; ctx.beginPath(); ctx.arc(cx + r * 0.55, cy + r * 0.38, r * 0.14, 0, 7); ctx.arc(cx + r * 0.38, cy + r * 0.56, r * 0.14, 0, 7); ctx.fill();
  } else { // 葉子
    ctx.fillStyle = '#d9ffd0'; ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.62, r * 0.32, -0.7, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2a7a35'; ctx.lineWidth = Math.max(1, r * 0.1); ctx.beginPath(); ctx.moveTo(cx - r * 0.45, cy + r * 0.45); ctx.lineTo(cx + r * 0.4, cy - r * 0.4); ctx.stroke();
  }
  ctx.restore();
}
function bigNetMini(cx, cy) { ctx.strokeStyle = '#e07a1f'; ctx.lineWidth = 2; rr(cx - 11, cy - 11, 22, 22, 4); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx, cy - 11); ctx.lineTo(cx, cy + 11); ctx.moveTo(cx - 11, cy); ctx.lineTo(cx + 11, cy); ctx.stroke(); }
function smallNetMini(cx, cy) { ctx.strokeStyle = '#3a9a4a'; ctx.lineWidth = 2; rr(cx - 11, cy - 6, 22, 12, 3); ctx.stroke(); }
function checkMark(cx, cy, r, col = '#21b36b') {
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, r * 0.32); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.45, cy); ctx.lineTo(cx - r * 0.1, cy + r * 0.38); ctx.lineTo(cx + r * 0.5, cy - r * 0.38); ctx.stroke(); ctx.lineCap = 'butt';
}
function crossMark(cx, cy, r, col = '#d62828') {
  ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, r * 0.3); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.4, cy - r * 0.4); ctx.lineTo(cx + r * 0.4, cy + r * 0.4); ctx.moveTo(cx + r * 0.4, cy - r * 0.4); ctx.lineTo(cx - r * 0.4, cy + r * 0.4); ctx.stroke(); ctx.lineCap = 'butt';
}
function plusMark(cx, cy, r) {
  ctx.fillStyle = '#ff7b00'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, r * 0.32); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy); ctx.lineTo(cx + r * 0.5, cy); ctx.moveTo(cx, cy - r * 0.5); ctx.lineTo(cx, cy + r * 0.5); ctx.stroke(); ctx.lineCap = 'butt';
}
function flameIcon(cx, cy, s, big = false) {
  const f = 1 + 0.08 * Math.sin(performance.now() / 70);
  ctx.save(); ctx.translate(cx, cy); ctx.scale(f, f);
  [[big ? '#7a1010' : '#e8742a', 1], ['#ffb703', 0.62], ['#fff3b0', 0.3]].forEach(([c, k]) => { const h = s * k, w = s * k * 0.62; ctx.fillStyle = c; ctx.beginPath();
    ctx.moveTo(0, -h / 2); ctx.bezierCurveTo(w * 0.9, -h * 0.1, w * 0.8, h * 0.5, 0, h / 2); ctx.bezierCurveTo(-w * 0.8, h * 0.5, -w * 0.9, -h * 0.1, 0, -h / 2); ctx.fill(); });
  ctx.restore();
}
function rawIcon(cx, cy, s) { // 生:藍色水滴/冰晶
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = '#cfe6ff'; ctx.lineWidth = Math.max(1.5, s * 0.1); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * s / 2, Math.sin(a) * s / 2); ctx.lineTo(-Math.cos(a) * s / 2, -Math.sin(a) * s / 2); ctx.stroke(); }
  ctx.restore();
}
// 小撒粉罐圖示;state: true=要, false=不要(畫斜線)
const JAR = { salt: ['#e9dfc8', '#6b5a44'], spicy: ['#c8321f', '#7a1a10'], basil: ['#3f8f3a', '#1f4f1c'] };
function jarIcon(id, cx, cy, s, want = true) {
  const [body, cap] = JAR[id], k = s / 40;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k); if (!want) ctx.globalAlpha = 0.55;
  ctx.fillStyle = cap; rr(-10, -20, 20, 9, 3); ctx.fill(); ctx.fillStyle = '#d9dde2'; rr(-11, -12, 22, 4, 1); ctx.fill();
  ctx.fillStyle = 'rgba(230,240,245,0.5)'; rr(-11, -8, 22, 28, 4); ctx.fill(); ctx.fillStyle = body; rr(-10, -1, 20, 20, 3); ctx.fill();
  if (id === 'spicy') { ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.moveTo(-4, 4); ctx.quadraticCurveTo(6, 6, 2, 16); ctx.quadraticCurveTo(-2, 10, -4, 4); ctx.fill(); }
  if (id === 'basil') { ctx.fillStyle = '#8fd17a'; ctx.beginPath(); ctx.ellipse(0, 9, 4, 7, 0.5, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (!want) { ctx.strokeStyle = '#d62828'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 19, 0, 7); ctx.moveTo(-13, -13); ctx.lineTo(13, 13); ctx.stroke(); }
  ctx.restore();
}
// 食材圖示 + 數量 + 狀態(self 一般 / need 要你補:橘色脈動 / done 打勾 / short 缺貨)
function iconBadge(k, n, cx, cy, s, st = 'self') {
  if (st === 'need') {
    ctx.save(); ctx.setLineDash([3, 2]); ctx.strokeStyle = '#ff9f1c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.46, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.28 + 0.15 * pulse(5); foodIcon(k, cx, cy, s * 0.8, false); ctx.restore();
  } else {
    ctx.save(); if (st === 'short') ctx.globalAlpha = 0.4; foodIcon(k, cx, cy, s, st !== 'self'); ctx.restore();
    if (st === 'done') checkMark(cx + s * 0.38, cy - s * 0.38, Math.max(5, s * 0.18));
    if (st === 'short') crossMark(cx + s * 0.38, cy - s * 0.38, Math.max(5, s * 0.18));
  }
  if (n > 1) { const fs = Math.max(10, s * 0.36); ctx.font = `normal ${fs}px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 3; ctx.strokeStyle = '#1a0d05';
    ctx.strokeText('×' + n, cx + s * 0.55, cy + s * 0.5); ctx.fillStyle = '#fff'; ctx.fillText('×' + n, cx + s * 0.55, cy + s * 0.5); }
}
// 一排圖示;ents = [[key, n, state]],回傳寬度
function iconRow(ents, x, cy, s, gap = 4, maxW = 9999) {
  let xx = x; ents.forEach(([k, n, st]) => { const w = s + (n > 1 ? s * 0.35 : 0); if (xx + w - x > maxW) return; iconBadge(k, n, xx + s / 2, cy, s, st); xx += w + gap; }); return xx - x;
}
// 教學箭頭(上下彈跳)
function arrowTo(x, y, dir = 'down', col = '#ffd166') {
  const b = Math.sin(performance.now() / 160) * 6; ctx.save(); ctx.translate(x, y); ctx.rotate({ down: 0, up: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 }[dir]); ctx.translate(0, -18 + b);
  ctx.fillStyle = col; ctx.strokeStyle = '#2b1a0e'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-8, -22); ctx.lineTo(8, -22); ctx.lineTo(8, -4); ctx.lineTo(16, -4); ctx.lineTo(0, 14); ctx.lineTo(-16, -4); ctx.lineTo(-8, -4); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
}
function bowlIcon(cx, cy, s) { if (IMG.steelBowl) { ctx.drawImage(IMG.steelBowl, cx - s / 2, cy - s * 360 / 440 / 2, s, s * 360 / 440); return; } const g = ctx.createRadialGradient(cx - s * 0.1, cy - s * 0.1, 2, cx, cy, s / 2); g.addColorStop(0, '#eef1f4'); g.addColorStop(1, '#6e767e'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, s / 2, s * 0.43, 0, 0, 7); ctx.fill(); }
function netIcon(cx, cy, s) { ctx.strokeStyle = '#c9ced4'; ctx.lineWidth = 2; rr(cx - s / 2, cy - s * 0.35, s, s * 0.7, 4); ctx.stroke(); for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - s / 2 + s * i / 4, cy - s * 0.35); ctx.lineTo(cx - s / 2 + s * i / 4, cy + s * 0.35); ctx.stroke(); } ctx.fillStyle = 'rgba(201,138,40,0.6)'; rr(cx - s / 2, cy, s, s * 0.35, 4); ctx.fill(); }
function bagIcon(cx, cy, s) { if (IMG.bagP) { const im = IMG.bagP, sc = s / Math.max(im.width, im.height); ctx.drawImage(im, cx - im.width * sc / 2, cy - im.height * sc / 2, im.width * sc, im.height * sc); } else text('🛍', cx, cy, s * 0.8, '#fff', 'center'); }
function coinIcon(cx, cy, s) { ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(cx, cy, s / 2, 0, 7); ctx.fill(); ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2; ctx.stroke(); text('$', cx, cy + 1, s * 0.6, '#7a4b00', 'center'); }
function arrowSmall(x, cy, w = 18) { ctx.fillStyle = '#ffe8a3'; ctx.beginPath(); ctx.moveTo(x, cy - 3); ctx.lineTo(x + w - 7, cy - 3); ctx.lineTo(x + w - 7, cy - 8); ctx.lineTo(x + w, cy); ctx.lineTo(x + w - 7, cy + 8); ctx.lineTo(x + w - 7, cy + 3); ctx.lineTo(x, cy + 3); ctx.fill(); }

// ---------- 狀態 ----------
let G;
const SAVE_KEY = 'yansuji_save_v2';
function has(u) { return G.upgrades.includes(u); }
function hasBoon(id) { return !!(G && G.boons && G.boons.includes(id)); }
function weekRent(n) {
  let r = typeof rentFor === 'function' ? rentFor(n) : 180;
  if (hasBoon('iou')) r += 25;
  if (hasBoon('stash')) r -= 20;
  return Math.max(40, r);
}
function boonBy(id) { return (typeof BOONS !== 'undefined' && BOONS.find(b => b.id === id)) || null; }
function rollOffer() {
  const owned = G.boons || [];
  const bag = (typeof BOONS !== 'undefined' ? BOONS : []).filter(b => !owned.includes(b.id));
  const out = [];
  while (out.length < 3 && bag.length) out.push(bag.splice(Math.floor(rng() * bag.length), 1)[0].id);
  return out;
}
function newGame() {
  G = {
    phase: 'title', night: 1, cash: START_CASH, debt: 0, debtStrikes: 0, rep: 60, upgrades: [],
    inv: Object.fromEntries(ALL_MENU.map(k => [k, { fresh: 0, old: 0 }])),
    regularOrder: { items: ['chicken', 'tempura', 'bean'], spicy: true, basil: true },
    best: 0, gameOver: '', boughtTonight: 0, hasSave: !!loadSave(true), marks: {},
    boons: [], offer: [],
    popups: [], particles: [], shake: 0,
  };
  newNight();
}
function newNight() { refreshMenu(G.night);
  Object.assign(G, {
    t: 0, dayLen: hasBoon('night') ? 200 : 180, grace: 45, repStart: G.rep, cashStart: G.cash, debtStart: G.debt, endBanner: false, pendingSick: false,
    forkId: '', forkOpen: false, forkFired: false, forkMatch: false, dare: '',
    queue: [], counter: null, walkers: [], baskets: basketLayout(), fryer: null, lastLine: null, fullFlash: 0, plate: [],
    temp: 150, tempKey: 'mid', oilUse: 0, oilChange: 0,
    season: { salt: false, spicy: false, basil: false }, cuts: 0, cutsNeed: 0, // v36: 剪的步驟已移除
    pay: null, schedule: [], nextId: 1, boughtTonight: 0, buyLog: {},
    rumorId: Math.floor(rng() * (G.night >= 3 ? RUMORS.length : RUMORS.length - 1)),
    stats: { revenue: 0, tips: 0, cost: 0, buy: 0, spoil: 0, waste: 0, fines: 0, rewards: 0, served: 0, lost: 0, happy: 0, angry: 0, oos: 0 },
    log: [], hintT: 0, endReason: '', basket: [], lastServed: [], rack: [], bills: [], plateCid: 0,
    theme: themeFor(G.night), special: (MENU[Math.floor(rng() * MENU.length)] || 'tempura'), coach: G.night <= 2,
    lesson: { fry: 0, lift: 0, salt: 0, bag: 0, pay: 0 },
    streak: 0, cat: { x: -90, dir: 1, nap: 1.5 }, beatCd: 6,
    deal: MENU[Math.floor(rng() * MENU.length)] || 'tempura', rescueUsed: false, newsRead: false,
    ban: '', protectChoice: '', beatFired: {},
  });
  G.fryer = G.baskets.map(() => []);
  G.rumor = RUMORS[G.rumorId];
  G.rent = weekRent(G.night);
  G.notice = rollNotice();
  G.glut = '';
  if (G.notice === 'glut') {
    const veg = MENU.filter(k => !isMeat(k));
    G.glut = (veg.includes(G.deal) && rng() < 0.5) ? G.deal : (veg[Math.floor(rng() * veg.length)] || '');
  }
  if (G.notice === 'stockout') G.ban = MENU[Math.floor(rng() * MENU.length)] || 'tempura';
  if (G.night > 1 && typeof FORKS !== 'undefined') {
    let bag = FORKS.filter(f => !(G.notice === 'rival' && f.id === 'match') && !(G.notice === 'oil' && f.id === 'oilvan'));
    if (!bag.length) bag = FORKS.slice();
    G.forkId = bag[Math.floor(rng() * bag.length)].id;
  }
  buildSchedule();
  if (G.night === 1) {
    const gift = { chicken: 2, tempura: 2, bean: 2 };
    const have = ALL_MENU.reduce((a, k) => a + ((G.inv[k] && G.inv[k].fresh) || 0) + ((G.inv[k] && G.inv[k].old) || 0), 0);
    if (!have) Object.keys(gift).forEach(k => { if (G.inv[k]) G.inv[k].fresh += gift[k]; });
  }
  if (G.notice === 'quiet') G.newsRead = true;
  G.creditWarned = false;
}
// ---- 存檔 ----
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ night: G.night, cash: G.cash, debt: G.debt, debtStrikes: G.debtStrikes, rep: G.rep, upgrades: G.upgrades, boons: G.boons || [], offer: G.offer || [], inv: G.inv, regularOrder: G.regularOrder, best: G.best, marks: G.marks || {}, phase: G.phase === 'shop' || G.phase === 'boon' ? G.phase : 'stock' })); } catch (e) {}
}
function loadSave(peek) {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (!d || peek) return d;
    Object.assign(G, { night: d.night, cash: d.cash, debt: d.debt, debtStrikes: d.debtStrikes, rep: d.rep, upgrades: (d.upgrades || []).map(u => u === 'baskets' ? 'bigNet' : u), boons: d.boons || [], offer: d.offer || [], inv: Object.assign(Object.fromEntries(ALL_MENU.map(k => [k, { fresh: 0, old: 0 }])), d.inv), regularOrder: d.regularOrder, best: d.best || 0, marks: d.marks || {} });
    newNight(); G.phase = d.phase === 'shop' ? 'shop' : d.phase === 'boon' ? 'boon' : 'stock'; return d; } catch (e) { return null; }
}
// ---------- 油槽格子(俯視 6×3) ----------
// 固定 9 個網位:大網 2×2 佔上兩排(編號 1–3),小網 1×1 在最下排(編號 4–9)。
// 滿配 3 大 + 6 小 = 12 + 6 = 18 格,正好填滿 6×3。升級只「解鎖」網位,不重排、不改編號。
const GRID = { x: 266, y: 304, cols: 6, rows: 3, cw: 124, ch: 116 };
const STRIP = { y0: 42, y1: 286, base: 278, x1: 1280 }, COUNTER_X = 390;
const RAIL = { x: 8, y: 44, w: 1264, h: 148 };
function basketLayout() {
  // v45：欄0 雞排大網、欄1 其他肉大網、欄2 兩個小網。smallNet 開欄3 再兩個小網。
  const extra = has('smallNet');
  return [
    { s: 'L', kind: 'chicken', col: 0, sub: 0, locked: false },
    { s: 'L', kind: 'meat', col: 1, sub: 0, locked: false },
    { s: 'S', kind: 'veg', col: 2, sub: 0, locked: false },
    { s: 'S', kind: 'veg', col: 2, sub: 1, locked: false },
    { s: 'S', kind: 'veg', col: 3, sub: 0, locked: !extra, up: 'smallNet' },
    { s: 'S', kind: 'veg', col: 3, sub: 1, locked: !extra, up: 'smallNet' },
  ];
}
function fryFrame() {
  const x = 328, y = 304, col = 142, gap = 12, n = 4, pad = 16, head = 30, oil = 172;
  return { x, y, col, gap, n, pad, head, oil, w: pad * 2 + n * col + (n - 1) * gap, h: head + oil + 16 };
}
function cellRect(b) {
  const F = fryFrame();
  const x = F.x + F.pad + b.col * (F.col + F.gap);
  const top = F.y + F.head + 8;
  if (b.s === 'L') return { x, y: top, w: F.col, h: F.oil - 16 };
  const h = Math.floor((F.oil - 24) / 2);
  return { x, y: top + (b.sub || 0) * (h + 8), w: F.col, h };
}
function slotRect(i) { return cellRect(G.baskets[i]); }
function freeBasket(k) { // v41:只找空的、不在油裡的網
  return G.baskets.findIndex((b, j) => !b.locked && !b.inOil && !G.fryer[j].length && b.s === ITEMS[k].size);
}
const BOWL_CAP = 8;
const bowlItems = () => {
  const acc = [];
  if (!G) return acc;
  const grab = c => c && (c.filled || []).forEach(it => acc.push(it));
  grab(G.counter); (G.queue || []).forEach(grab);
  (G.rack || []).forEach(r => (r.items || []).forEach(it => acc.push(it)));
  return acc;
};
const fried = () => G.fryer.flat();
// v40:整網共用一個計時。網的熟度 p(0–100):SH_LO–SH_HI 是整網「剛好」區;每份料的 d 由 p 換算到自己的熟度區,所以整網一起熟、一起焦
const SH_LO = 60, SH_HI = 80;
function mapD(P, I) { return P <= SH_LO ? P * I.lo / SH_LO : P <= SH_HI ? I.lo + (P - SH_LO) / (SH_HI - SH_LO) * (I.hi - I.lo) : Math.min(100, I.hi + (P - SH_HI) / (100 - SH_HI) * (100 - I.hi)); }
function netTime(net) { return Math.max(...net.map(it => ITEMS[it.key].time)); } // 以最久的料為準
function netIdeal(net) { return net.reduce((a, it) => a + ITEMS[it.key].ideal, 0) / net.length; }
function netSpeed(net) { return 100 / netTime(net) * clamp(1 + (G.temp - netIdeal(net)) / 35, 0.15, 2.2) * (G.oilUse > OIL_LIMIT ? 1.15 : 1) * (hasBoon('rush') ? 1.15 : 1) * 0.95; }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
// ---- 庫存 ----
function stockOf(k) { const v = G.inv[k]; return v ? v.fresh + v.old : 99; }
function availFor(k, forC) {
  let n = stockOf(k);
  if (!forC) return n + bowlItems().filter(it => it.key === k).length + fried().filter(it => it.key === k).length + G.plate.filter(it => it.key === k).length;
  (forC.filled || []).forEach(it => { if (it.key === k) n++; });
  (G.fryer || []).forEach(net => net.forEach(it => { if (it.key === k && it.cid === forC.id) n++; }));
  (G.rack || []).forEach(r => { if (r.cid === forC.id) (r.items || []).forEach(it => { if (it.key === k) n++; }); });
  if (!G.plateCid || G.plateCid === forC.id) (G.plate || []).forEach(it => { if (it.key === k) n++; });
  return n;
}
function shortItems(c) { // 這單有哪些品項，自己手上加庫存還是不夠
  if (!c || c.type === 'byo') return [];
  const need = countBy(c.order.items); return Object.keys(need).filter(k => availFor(k, c) < need[k]);
}
function unitCost(k, raw) {
  let c = (typeof costOf === 'function' ? costOf(k, G.night) : ITEMS[k].cost) * (has('bulk') ? 0.9 : 1);
  if (!raw && G && G.deal === k) c *= 0.75;
  if (G && G.notice === 'glut' && G.glut === k) c *= 0.7;
  if (G && G.notice === 'spike' && typeof isMeat === 'function' && isMeat(k)) c *= 1.25;
  return Math.round(c);
}
function noticeNow() { return (typeof NOTICES !== 'undefined' && NOTICES.find(n => n.id === G.notice)) || { id: 'quiet', src: 'paper', zh: '平常週', en: 'Quiet week', line: '', enLine: '' }; }
function newsSource(nt) {
  const id = (nt && nt.src) || 'paper';
  return (typeof NEWS_SOURCES !== 'undefined' && NEWS_SOURCES[id]) || { zh: '夜市快報', en: 'Market Paper', via: '攤上的報紙', viaEn: 'paper on the counter' };
}
function eventTalk() {
  if (G.notice === 'protect' && G.protectChoice === 'pay') return { zh: '聽說你有給錢，今晚安靜點。', en: 'Heard you paid. Quieter night.' };
  const pack = (typeof EVENT_LINES !== 'undefined' && EVENT_LINES[G.notice]) || null;
  if (!pack || !pack.length) return null;
  const row = pack[Math.floor(rng() * pack.length)];
  return { zh: row[0], en: row[1] };
}
function nightBeats() {
  if (!G.beatFired) G.beatFired = {};
  const id = G.notice;
  const fire = (k, t, zh, en, col) => {
    if (G.beatFired[k] || G.t < t) return;
    G.beatFired[k] = 1;
    popup(L(zh, en), 640, 150, col || '#ffd166');
    addLog(zh, en);
  };
  if (id === 'fight') {
    fire('fight', 4, '巷口還在吵，客人會繞路', 'The fight is still going. Guests detour.', '#ffb4a2');
    if (!G.beatFired.walk && G.t > 6) {
      G.beatFired.walk = 1;
      const shout = (zh, en, x, dir) => G.walkers.push({ c: { id: -10 - dir, type: 'aunt', look: dir > 0 ? 'aunt' : 'normal', line: zh, lineEn: en, patience: 1, max: 1, angry: true }, x, dir, sayT: 5 });
      shout('排隊是我的！', 'That line is mine!', 520, 1);
      shout('你才插隊！', 'You cut in!', 680, -1);
    }
  }
  if (id === 'celeb') fire('celeb', 18, '巷口擠滿人，都在拍照', 'The lane is packed with phones');
  if (id === 'parade') fire('parade', 32, '神轎過攤前了，手快一點', 'The palanquin is passing. Work fast.');
  if (id === 'crew') fire('crew', 24, '鏡頭對著油鍋', 'The camera is on the fryer');
  if (id === 'rival') fire('rival', 10, '對街在喊更便宜', 'Across the lane they are shouting lower prices', '#ffb4a2');
  if (id === 'oil') fire('oil', 5, `沙拉油這週換要 $${oilPrice()}`, `Oil change is $${oilPrice()} this week`, '#ffb4a2');
  if (id === 'protect' && G.protectChoice === 'refuse' && !G.beatFired.back && G.t > G.dayLen - 30) {
    G.beatFired.back = 1;
    G.walkers.push({ c: { id: -3, type: 'drunk', look: 'drunk', line: '說好的呢？', lineEn: 'We had a deal.', patience: 1, max: 1, angry: true }, x: 1100, dir: -1, sayT: 6 });
    popup(L(`他回來了。收攤要算 $${Math.round(protectFee() * 1.4)}`, `He is back. Closing costs $${Math.round(protectFee() * 1.4)}`), 640, 160, '#ff6b6b');
    addLog('收保護費的人回來了', 'The man who wanted a cut came back');
  }
}
function rollNotice() {
  if ((G.night || 1) <= 1 || typeof NOTICES === 'undefined') return 'quiet';
  const pool = NOTICES.filter(n => n.min <= G.night);
  return pool[Math.floor(rng() * pool.length)].id;
}
function costTag(k) {
  let s = '';
  if (k === G.deal) s += ' −25%';
  if (G.notice === 'glut' && k === G.glut) s += L(' 菜價−30%', ' glut−30%');
  if (G.notice === 'spike' && typeof isMeat === 'function' && isMeat(k)) s += L(' 肉+25%', ' meat+25%');
  return s;
}
function protectFee() { return Math.round((80 + (G.night || 2) * 10) / 10) * 10; }
function effectLine(nt) {
  nt = nt || noticeNow();
  if (nt.id === 'protect') {
    const fee = protectFee();
    if (G.protectChoice === 'pay') return L(`已付 $${fee}。今晚他不會再來。`, `Paid $${fee}. He stays away tonight.`);
    if (G.protectChoice === 'refuse') return L(`沒付。收攤會被鬧 $${Math.round(fee * 1.4)}，口碑也掉。`, `Refused. At closing it costs $${Math.round(fee * 1.4)}, and reputation drops.`);
    return L(`現在付 $${fee}，或收攤被鬧 $${Math.round(fee * 1.4)}。`, `Pay $${fee} now, or $${Math.round(fee * 1.4)} in trouble at closing.`);
  }
  if (nt.id === 'stockout' && G.ban) return L(`本週進不到${NM(G.ban)}。`, `Cannot buy ${NM(G.ban)} this week.`);
  if (nt.id === 'oil') return L(`這週換油 $${oilPrice()}。`, `Oil change is $${oilPrice()} this week.`);
  return L(nt.line, nt.enLine);
}
function salePrice(k) {
  let p = typeof saleOf === 'function' ? saleOf(k, G.night) : (ITEMS[k] ? ITEMS[k].price : 0);
  if (G && G.notice === 'rival') p = Math.max(1, Math.round(p * 0.85));
  if (G && G.forkMatch) p = Math.max(1, Math.round(p * 0.85));
  if (hasBoon('scale')) p = Math.max(1, Math.round(p * 1.1));
  return p;
}
function oilPrice() {
  let p = Math.round(150 * (typeof vegIndex === 'function' ? vegIndex(G.night) : 1) / 10) * 10;
  if (G && G.notice === 'oil') p = Math.round(p * 1.6 / 10) * 10;
  return p;
}
function specBonus() { return Math.max(5, Math.round(8 * (typeof vegIndex === 'function' ? vegIndex(G.night) : 1) / 5) * 5); }
function seasonPrice(id) { const b = SEASON_PRICE[id] || 0; return Math.max(b, Math.round(b * (typeof vegIndex === 'function' ? vegIndex(G.night) : 1))); }
function priceTrend() {
  const n = G.night || 1;
  const vc = Math.round(vegIndex(n) * 100), mc = Math.round(meatIndex(n) * 100);
  const vs = Math.round((1 + (vegIndex(n) - 1) * 0.65) * 100), ms = Math.round((1 + (meatIndex(n) - 1) * 0.65) * 100);
  return L(`物價比第 1 週：菜進價 ${vc}%／售價 ${vs}% · 肉進價 ${mc}%／售價 ${ms}%`, `Vs week 1: veg cost ${vc}% / sell ${vs}% · meat cost ${mc}% / sell ${ms}%`);
}
function batchQty(k) {
  const n = STOCK[k] ? STOCK[k].batch : 1;
  return G && G.night === 1 ? Math.max(2, Math.ceil(n / 2)) : n;
}
function batchCost(k) { return Math.round(unitCost(k) * batchQty(k)); }
function rescueCost(k) { return Math.round(unitCost(k, true) * batchQty(k) * 1.6); }

function guestQuota() {
  // 人數跟口碑走。口碑 0 約 6 位，100 約 14 位。第一週 8 位，才吃得完半批進貨。
  if (G.night === 1) return 8;
  let n = 6 + Math.round(clamp(G.rep, 0, 100) / 100 * 8);
  if (has('neon')) n += 2;
  if (hasBoon('loud')) n += 1;
  if (hasBoon('night')) n += 2;
  const nt = noticeNow();
  if (nt.extra) n += nt.extra;
  if (nt.cut) n -= nt.cut;
  if (G.notice === 'feast') n -= 2;
  if (G.notice === 'cram') n += 3;
  return clamp(n, 4, 18);
}
function buildSchedule() {
  // 固定人數，排進收攤前 30 秒。人少就早收，不把空檔拖到倒數結束。
  const latest = Math.max(40, G.dayLen - 30);
  const quota = guestQuota();
  const spec = [];
  if (G.night > 1) (NIGHT_SPECIALS[Math.min(G.night, NIGHT_SPECIALS.length) - 1] || []).forEach(([, type]) => spec.push(type));
  else spec.push('student');
  if (G.notice === 'raid' && !spec.includes('inspector')) spec.push('inspector');
  if (hasBoon('charm') && G.night > 1) spec.push('regular');
  const types = spec.slice(0, quota);
  while (types.length < quota) {
    let kind = 'normal';
    if (G.notice === 'cram' ? rng() < 0.7 : rng() < 0.22) kind = 'student';
    else if (G.night >= 3 && rng() < 0.08) kind = 'live';
    types.push(kind);
  }
  const n = types.length;
  const gap = n <= 1 ? 0 : Math.min(14, (latest - 6) / (n - 1));
  G.schedule = types.map((type, i) => ({ t: Math.round((6 + gap * i) * 10) / 10, type }));
  G.guestQuota = n;
}

function makeOrder(type) {
  if (G.night === 1 && type !== 'regular') {
    const pool = SELF_MENU.filter(k => stockOf(k) > 0);
    const items = [];
    for (let i = 0; i < 2; i++) items.push(pool.length ? pick(pool) : pick(SELF_MENU));
    const add = [];
    if ((G.stats.served || 0) >= 1 && stockOf('chicken') > 0) { items.push('chicken'); add.push('chicken'); }
    return { items, add, spicy: false, basil: false };
  }
  if (type === 'live') {
    const o = makeOrder('normal');
    if (!o.items.some(k => ITEMS[k].vendor)) { o.items.push('chicken'); o.add.push('chicken'); }
    return o;
  }
  if (type === 'regular') return { ...G.regularOrder, items: [...G.regularOrder.items], add: G.regularOrder.items.filter(k => ITEMS[k].vendor) };
  if (type === 'byo') return { items: ['byo', 'byo'], add: [], spicy: rng() < 0.5, basil: false };
  // v42:客人自己從展示櫃撿 n 樣進鐵盆;雞排/鹽酥雞是攤家顧的(一定要老闆補);偶爾口頭「再加一份」
  const n = type === 'student' ? 1 + (rng() < 0.4 ? 1 : 0) : type === 'aunt' ? 3 + (rng() < 0.5 ? 1 : 0) : 2 + Math.floor(rng() * 2);
  const items = [], add = [];
  const pickSelf = () => { let k = pick(SELF_MENU); if (stockOf(k) <= (countBy(items)[k] || 0)) { const ok = SELF_MENU.filter(m => stockOf(m) > (countBy(items)[m] || 0)); if (ok.length && rng() < 0.9) k = pick(ok); } return k; };
  for (let i = 0; i < n; i++) items.push(pickSelf());
  const vp = type === 'student' ? 0.45 : 0.3;
  if (rng() < vp) { items.push('chicken'); add.push('chicken'); }
  if (rng() < vp) { items.push('saltchicken'); add.push('saltchicken'); }
  if (rng() < 0.3) { const m = rng() < 0.3 ? 2 : 1; for (let i = 0; i < m; i++) { const k = pickSelf(); items.push(k); add.push(k); } }
  if (G.notice === 'feast') { const k = pickSelf(); items.push(k); add.push(k); }
  items.sort((a, b) => MENU.indexOf(a) - MENU.indexOf(b));
  return { items, add, spicy: rng() < 0.5, basil: rng() < 0.4 };
}

function spawn(type) {
  const ct = CTYPES[type];
  const nt = noticeNow();
  const pace = (type === 'inspector' ? 1 : ((nt.pace) || 1) * (hasBoon('loud') ? 0.9 : 1) * (hasBoon('night') && G.t > 120 ? 0.85 : 1)) * ((G.notice === 'cram' && type === 'student') ? 0.78 : 1);
  const c = { id: G.nextId++, type, order: makeOrder(type), patience: ct.patience * (has('fan') ? 1.2 : 1) * ((THEMES[G.theme] || {}).patience || 1) * pace, max: ct.patience * (has('fan') ? 1.2 : 1) * ((THEMES[G.theme] || {}).patience || 1) * pace,
    x: 150, tx: 0, atCounter: 0, changed: false, sus: type === 'byo' && rng() < 0.6, revealed: false,
    hue: rand(-15, 15), line: '', look: pick({ normal: ['normal', 'normal_b', 'normal_c'], student: ['student', 'student_b'], live: ['live'] }[type] || [type]) };
  const key = type === 'byo' ? (c.sus ? 'byoSus' : 'byo') : LINES[type] ? type : 'greet';
  const pl = pickLine(key); setLine(c, pl.zh, pl.en);
  const wline = pickWeather();
  if (wline && type !== 'inspector' && rng() < 0.55) setLine(c, wline.zh, wline.en);
  const ev = eventTalk();
  if (ev && type !== 'inspector' && rng() < 0.72) setLine(c, ev.zh, ev.en);
  c.x = -160;
  c.hold = 0.55;
  if (G.queue.length >= 4) {
    G.stats.lost++; changeRep(-1); addLog(`${ct.label}看到隊伍太長,走掉了`, `${ct.en} saw the line and left`);
    G.walkers.push({ c, x: 40, dir: -1 }); return;
  }
  G.queue.push(c);
}

// ---------- 工具 ----------
function addLog(zh, en) { G.log.push({ t: clockStr(), zh, en: en || zh }); }
function logText(l) { if (!l) return ''; return typeof l === 'string' ? l : `[${l.t}] ${L(l.zh, l.en)}`; }
function popup(text, x, y, color = '#ffd166') {
  const near = G.popups.filter(p => Math.hypot(p.x - x, p.y - y) < 90);
  const same = near.find(p => p.text === text);
  if (same) { same.life = 1.6; return; }
  G.popups.push({ text, x, y: y - near.length * 26, color, life: 1.6 });
}
function puff(x, y) { for (let i = 0; i < 7; i++) G.particles.push({ x, y, vx: rand(-90, 90), vy: rand(-110, -16), life: 0.32, r: rand(2, 4), c: 'rgba(255,214,120,0.85)' }); }
function changeRep(d) { G.rep = clamp(G.rep + d, 0, 100); }
function clockStr() { const m = 18 * 60 + Math.floor(G.t / G.dayLen * 300); return `${Math.floor(m / 60) % 24}:${String(m % 60).padStart(2, '0')}`; }
function countBy(arr) { const m = {}; arr.forEach(k => m[k] = (m[k] || 0) + 1); return m; }
function orderText(items) { const m = countBy(items); return Object.keys(m).map(k => `${ITEMS[k].name}×${m[k]}`).join('、'); }
function doneLabel(it) {
  const I = ITEMS[it.key];
  if (it.d >= 100) return ['焦黑', '#222'];
  if (it.d < 40) return ['生', '#e76f51'];
  if (it.d < I.lo) return ['半生', '#f4a261'];
  if (it.d <= I.hi) return ['剛好', '#2a9d8f'];
  return ['太老', '#8d5524'];
}

// ---------- 動作 ----------
const A = {
  start() { G.phase = 'stock'; },
  readNews() { G.newsRead = true; },
  payProtect() {
    const fee = protectFee();
    if (G.cash >= fee) G.cash -= fee;
    else { G.debt += fee - Math.max(0, G.cash); G.cash = 0; }
    G.stats.fines += fee; G.protectChoice = 'pay'; G.newsRead = true;
    addLog(`保護費付了 $${fee}`, `Paid the cut $${fee}`);
  },
  refuseProtect() {
    G.protectChoice = 'refuse'; G.newsRead = true;
    addLog('保護費沒付，收攤再說', 'Refused the cut. Trouble at closing.');
  },
  newRun() { clearSave(); const s = seed; newGame(); seed = s; G.phase = 'stock'; },
  cont() { loadSave(); },
  buy(k, n) {
    if (n > 0 && k === G.ban) { popup(L(`${NM(k)} 本週進不到`, `${NM(k)} is unavailable`), 640, 360, '#ff6b6b'); return; }
    const c = batchCost(k), v = G.inv[k];
    if (n > 0) { if (G.cash < c) { popup(L('現金不夠', 'Not enough cash'), 640, 360, '#ff6b6b'); return; } if (v.fresh + v.old + batchQty(k) > MAX_STOCK) { popup(L('冰櫃放不下了', 'Fridge is full'), 640, 360, '#ff6b6b'); return; }
      G.cash -= c; v.fresh += batchQty(k); G.stats.buy += c; G.buyLog[k] = (G.buyLog[k] || 0) + 1; }
    else { if (!G.buyLog[k] || v.fresh < batchQty(k)) return; G.cash += c; v.fresh -= batchQty(k); G.stats.buy -= c; G.buyLog[k]--; }
  },
  open() {
    const tot = MENU.reduce((a, k) => a + (G.inv[k] ? G.inv[k].fresh + G.inv[k].old : 0), 0);
    const canBuy = MENU.some(k => k !== G.ban && G.cash >= batchCost(k));
    if (!tot && !canBuy) {
      if (!G.creditWarned) {
        G.creditWarned = true;
        popup(L('沒有料，現金也不夠。再按一次會賒一批雞排。', 'No stock and no cash. Press again to take chicken on credit.'), 640, 360, '#ffb703');
        return;
      }
      const k = 'chicken', c = batchCost(k);
      G.debt += c; G.inv[k].fresh += batchQty(k); G.stats.buy += c; G.creditWarned = false;
      addLog(`賒進 ${ITEMS[k].name} ${batchQty(k)} 份，欠 $${c}`, `Chicken on credit, ${batchQty(k)}, owe $${c}`);
    }
    G.phase = 'open'; G.t = 0; const arc = (typeof NIGHT_ARC !== 'undefined') ? NIGHT_ARC[(G.night - 1) % NIGHT_ARC.length] : null; addLog(`第 ${G.night} 週開攤!進貨花了 $${G.stats.buy}`, `Week ${G.night} open. Stock cost $${G.stats.buy}`); if (arc) addLog(arc[0], arc[1]); const nt = noticeNow(); if (nt.id !== 'quiet') { const src = newsSource(nt); const line = effectLine(nt); addLog(`${src.zh}：${nt.zh}`, `${src.en}: ${nt.en}`); G.lastLine = { who: src.zh, whoEn: src.en, text: line, textZh: line, textEn: nt.enLine || line, t: 7 }; }
  },
  rescue(k) {
    if (G.phase !== 'open' || G.rescueUsed || !STOCK[k] || stockOf(k) > 0) return;
    const c = rescueCost(k);
    if (G.cash < c) { popup(`${NM(k)} ${L('補貨要', 'restock ')}$${c}`, 160, 400, '#ff6b6b'); return; }
    G.cash -= c; G.inv[k].fresh += batchQty(k); G.rescueUsed = true; G.stats.buy += c;
    popup(`${NM(k)} +${batchQty(k)}`, 160, 360, '#ffd166');
    addLog(`表弟緊急補貨 ${ITEMS[k].name} -$${c}`, `Cousin restock ${ITEMS[k].en || ITEMS[k].name} −$${c}`); sfx('cash');
  },
  buyUpgrade(id) {
    const u = UPGRADES.find(x => x.id === id);
    if (!u || has(id) || G.cash < u.price || G.boughtTonight >= MAX_UPGRADES_PER_NIGHT) return;
    G.cash -= u.price; G.upgrades.push(id); G.boughtTonight++; if (id === 'neon') changeRep(5);
    popup(L(`買了 ${u.name}`, `Bought ${u.en || u.name}`), 640, 300, '#06d6a0'); saveGame();
  },
  nextNight() { G.night++; newNight(); G.phase = 'stock'; saveGame(); },
  toShop() { G.phase = 'shop'; G.boughtTonight = 0; saveGame(); },
  pickBoon(id) {
    const b = boonBy(id);
    if (!b || hasBoon(id) || !(G.offer || []).includes(id)) return;
    G.boons = G.boons || [];
    G.boons.push(id);
    if (id === 'iou') { G.cash += 120; addLog('週轉欠條，手上多 $120，之後房租 +$25', 'Loan chit: +$120 now, rent +$25 later'); }
    else addLog(`機緣：${b.zh}`, `Boon: ${b.en}`);
    G.offer = [];
    G.phase = 'shop';
    saveGame();
  },
  forkYes() {
    const id = G.forkId;
    G.forkOpen = false;
    if (id === 'cousin') {
      const k = thinnest();
      const c = k ? Math.max(1, Math.round(batchCost(k) * 0.8)) : 0;
      if (!k || G.cash < c) { addLog('表弟的貨沒接下來', 'Passed on the cousin’s crate'); return; }
      G.cash -= c; G.inv[k].fresh += STOCK[k].batch; G.stats.buy += c;
      addLog(`表弟補了${NM(k)} −$${c}`, `Cousin restocked ${NM(k)} −$${c}`);
      popup(`${NM(k)} +${STOCK[k].batch}`, 200, 360, '#ffd166');
    } else if (id === 'dare') { G.dare = 'on'; addLog('下一包雙倍或白送', 'Next bag is double or nothing'); }
    else if (id === 'match') { G.forkMatch = true; spawn('normal'); spawn('student'); addLog('跟了對街的價，多來兩位', 'Matched their price. Two more guests.'); }
    else if (id === 'oilvan') {
      const c = Math.round(oilPrice() * 0.5);
      if (G.cash < c) { addLog('油錢不夠，油車開走了', 'Could not pay the oil van'); return; }
      G.cash -= c; G.stats.cost += c; G.oilUse = 0; G.oilWarned = 0;
      addLog(`油車半價換油 −$${c}`, `Oil van, half price −$${c}`);
    } else if (id === 'kid') {
      const k = 'sweetpotato', v = G.inv[k];
      if (v && stockOf(k) > 0) {
        if (v.fresh > 0) v.fresh--; else v.old--;
        changeRep(2); addLog('送了一條地瓜，口碑 +2', 'Gave a yam. Rep +2');
      } else { changeRep(1); addLog('地瓜沒了，小孩還是說你人好。口碑 +1', 'No yam left. The kid still liked you. Rep +1'); }
    }
  },
  forkNo() {
    const id = G.forkId;
    G.forkOpen = false;
    if (id === 'match') { changeRep(1); addLog('沒跟價，口碑 +1', 'Held the price. Rep +1'); }
    else if (id === 'kid') { changeRep(-1); addLog('沒給免費的，口碑 -1', 'No free yam. Rep −1'); }
    else if (id === 'cousin') addLog('表弟的貨讓給別攤了', 'The cousin sold it down the lane');
    else if (id === 'dare') addLog('沒跟醉客賭', 'No bet');
    else addLog('油車開走了', 'The oil van left');
  },
  buyStall() {
    if (G.gameOver || G.cash < STALL_PRICE) return;
    G.cash -= STALL_PRICE; G.owned = true; G.gameOver = 'owned';
    addLog(`付了 $${STALL_PRICE} 給房東，攤位是你的了`, `Paid the landlord $${STALL_PRICE}. The stall is yours.`);
    clearSave(); G.phase = 'ending';
  },
  swapOrder() { const c = G.counter; if (!c || G.pay || c.swapped) return;
    const need = countBy(c.order.items);
    shortItems(c).forEach(k => { let lack = need[k] - availFor(k, c); for (let i = 0; i < c.order.items.length && lack > 0; i++) if (c.order.items[i] === k) {
      const used = countBy(c.order.items); const ok = MENU.filter(m => m !== k && availFor(m, c) > (used[m] || 0)); if (!ok.length) break; c.order.items[i] = pick(ok); lack--; } });
    c.order.items.sort((a, b) => MENU.indexOf(a) - MENU.indexOf(b)); c.order.add = (c.order.add || []).filter(k => c.order.items.includes(k));
    c.need = mustLeft(c);
    if (shortItems(c).length) { popup(L('沒別的可換，有的可以照賣', 'Nothing else to swap. Serve what you have.'), 1100, 180, '#ffb703'); return; }
    c.swapped = true; c.noTip = true; c.patience -= c.max * 0.3; setLine(c, '沒有喔…好啦,那換這些。', 'Out of that… fine, swap these.'); addLog('缺貨,跟客人道歉換單', 'Out of stock — swapped the order'); },
  sellShort() {
    const c = G.counter; if (!c || G.pay) return;
    const have = ownedKeys(c), next = [];
    c.order.items.forEach(k => {
      const j = have.indexOf(k);
      if (j >= 0) { have.splice(j, 1); next.push(k); return; }
      if (stockOf(k) > 0) next.push(k);
    });
    if (!next.length) { A.sendAway(); return; }
    if (next.length === c.order.items.length) return;
    c.order.items = next;
    c.order.add = (c.order.add || []).filter(k => next.includes(k));
    c.need = mustLeft(c);
    c.noTip = true; c.swapped = true;
    setLine(c, '沒有的就算了，其他的給我。', 'Skip what you are out of. I will take the rest.');
    addLog('缺的不賣，其餘照出', 'Skipped the missing item, served the rest');
  },
  sendAway() { const c = G.counter; if (!c) return; G.stats.lost++; G.stats.oos++; changeRep(-2); addLog('缺貨,客人沒買就走了(口碑 -2)', 'Out of stock, guest left (rep −2)'); leave(c, '沒有?那不用了。', true, 'You are out? Never mind.'); resetPrep(); },
  // v45:把料拖到夾單上，補虛線空圈
  drop(k, cid) {
    const list = railCustomers();
    let c = cid ? list.find(x => x.id === cid) : null;
    if (!c) c = list.find(x => x.handed && !(G.pay && x === G.counter) && mustLeft(x).includes(k));
    if (!c || !c.handed || (G.pay && c === G.counter)) {
      popup(list.some(x => x.handed) ? L('這幾張單都不用', 'No ticket needs that') : L('等夾單上來', 'Wait for a ticket'), 780, 90, '#ffb703');
      return;
    }
    if (!mustLeft(c).includes(k)) { popup(L('這張單不用', 'Not on this ticket'), 780, 90, '#ffb703'); return; }
    let old = false;
    if (G.inv[k]) { const v = G.inv[k]; if (v.old > 0) { v.old--; old = true; } else if (v.fresh > 0) v.fresh--; else { popup(L(`${ITEMS[k].name} 缺貨`, `${ITEMS[k].en || NM(k)} out`), 160, 360, '#ff6b6b'); return; } }
    c.filled.push({ key: k, old }); sfx('click');
  },
  pour() { const ready = railCustomers().find(c => canFryTicket(c)); fryTicket(ready || G.counter); },
  clearBowl() {},
  dunk(i) {
    const b = G.baskets[i], net = G.fryer[i]; if (!net || !net.length || b.inOil) return;
    if (G.oilChange > 0) { popup(L('換油中', 'Changing oil'), 640, 560, '#ff6b6b'); return; }
    b.inOil = true; b.p = 0; b.cue = 0; b.age = 0; sfx('drop');
    G.oilUse += (has('filter') ? 0.6 : 1) * (hasBoon('cloth') ? 0.7 : 1) * net.length;
    if (!G.oilWarned && G.oilUse > OIL_LIMIT * 0.75) {
      G.oilWarned = 1;
      popup(G.oilUse > OIL_LIMIT ? L(`油黑了，客人吃得出來。換油 $${oilPrice()}`, `Oil is black. Guests can taste it. $${oilPrice()}`) : L(`油要換了 $${oilPrice()}`, `Change the oil $${oilPrice()}`), 640, 220, G.oilUse > OIL_LIMIT ? '#ff6b6b' : '#ffb703');
    }
    G.temp -= (has('bigNet') ? 1.6 : 3) * Math.min(3, net.length);
    const p = slotRect(i); for (let j = 0; j < 18; j++) G.particles.push({ x: p.x + rand(8, p.w - 8), y: p.y + rand(8, p.h - 8), vx: rand(-18, 18), vy: rand(-80, -24), life: rand(0.45, 1), r: rand(3, 9), c: 'rgba(255,248,220,0.55)' });
  },
  setTemp(k) { G.tempKey = k; },
  tapNet(i) { if (G.baskets[i].inOil) A.lift(i); },
  lift(i) {
    const net = G.fryer[i], b = G.baskets[i];
    if (!net || !net.length || !b || !b.inOil || b.draining) return;
    const cid = net[0].cid || 0;
    const toRack = !canPlate(cid);
    b.drainTo = toRack ? 'rack' : 'plate';
    b.drainRack = toRack ? G.rack.length + G.baskets.filter(x => x.draining && x.drainTo === 'rack').length : 0;
    b.draining = 0.42;
    sfx('lift');
  },
  liftAll() { G.fryer.forEach((net, i) => { if (net.length && G.baskets[i].inOil && !G.baskets[i].draining) A.lift(i); }); },
  changeOil() {
    if (fried().length || G.oilChange > 0) return;
    if (G.cash < oilPrice()) { popup(L(`換油要 $${oilPrice()}`, `New oil $${oilPrice()}`), 640, 560, '#ff6b6b'); return; }
    const oc = oilPrice(); G.cash -= oc; G.stats.cost += oc; G.oilUse = 0; G.oilWarned = 0; G.oilChange = 4; G.temp = 120; addLog(L(`換了一鍋新油(-$${oc})`, `Changed the oil (−$${oc})`), `Changed the oil (−$${oc})`);
  },
  toggle(s) { if (G.plate.length && !G.pay) { G.season[s] = !G.season[s]; if (G.season[s]) { G.shakeJar = { s, t: 0.6 }; if (s === 'salt') markLesson('salt'); } } },
  dump() { G.plate.forEach(it => G.stats.waste += unitCost(it.key)); G.plate = []; G.plateCid = 0; resetPrep(); },
  bag() {
    if (G.pay) return;
    const why = bagBlock();
    if (why) { popup(why, 1149, 596, '#ff9f80'); G.bagHint = 1.6; return; }
    settle(); markLesson('bag');
  },
  report() { if (G.counter) doReport(); },
  payAccept() { finishPay(G.pay.offer); },
  payMid() {
    const p = G.pay, c = G.counter; const mid = Math.round((p.offer + p.price) / 2 / 5) * 5;
    if (rng() < (c.type === 'aunt' ? 0.7 : 0.9)) { setLine(c, '好啦好啦,就這樣。', 'Fine, fine. That works.'); finishPay(mid); }
    else { setLine(c, '再少一點啦~', 'A little less~'); p.midTried = true; }
  },
  payInsist() {
    const p = G.pay, c = G.counter;
    const ch = c.type === 'aunt' ? 0.3 + G.rep / 250 : c.type === 'drunk' ? 0.6 : 0.7;
    if (rng() < ch) { setLine(c, '…好啦,算你狠。', '…Fine. You win.'); finishPay(p.price); }
    else { addLog(`${CTYPES[c.type].label}不爽走人,沒付錢`, `${CTYPES[c.type].en} stormed off without paying`); changeRep(-1); G.stats.angry++; leave(c, '不賣就算了!', true, 'Then forget it!'); G.plate = []; resetPrep(); }
  },
  payFull() { finishPay(G.pay.price); },
  refuse() { addLog('拒絕賣給客人', 'Refused the sale'); G.stats.waste += G.pay.matchedCost; leave(G.counter, '哼!', true, 'Hmph!'); G.plate = []; resetPrep(); },
};

// v45:客人夾上一張單。自己撿的是實心，雞排/鹽酥雞和口頭加點是虛線空圈。
function handOver(c) {
  const add = countBy(c.order.add || []), picked = [], need = [];
  c.order.items.forEach(k => { if (add[k] > 0 || ITEMS[k].vendor) { if (add[k]) add[k]--; need.push(k); } else picked.push(k); });
  const got = [];
  picked.forEach(k => {
    const v = G.inv[k];
    if (!v) { got.push({ key: k, old: false }); return; }
    if (v.old > 0) { v.old--; got.push({ key: k, old: true }); }
    else if (v.fresh > 0) { v.fresh--; got.push({ key: k, old: false }); }
    else need.push(k);
  });
  c.filled = got; c.need = need; c.handed = true; c.picked = got.map(it => it.key);
  const ex = (c.order.add || []).filter(k => !ITEMS[k].vendor), vd = need.filter(k => ITEMS[k].vendor);
  if (c.type !== 'byo' && c.type !== 'regular') {
    if (ex.length) setLine(c, `${c.picked.length ? '我撿好了，' : ''}再加${orderBits(ex, false)}`, `${c.picked.length ? 'I grabbed mine. ' : ''}Add ${orderBits(ex, true)}`);
    else if (vd.length) setLine(c, `幫我加${orderBits(vd, false)}`, `Add ${orderBits(vd, true)} for me`);
    else { const pl = pickLine('greet'); setLine(c, pl.zh, pl.en); }
  }
  if (c === G.counter) sfx('drop');
}
function ownedKeys(c) {
  const keys = (c.filled || []).map(it => it.key);
  G.fryer.forEach(net => net.forEach(it => { if (it.cid === c.id) keys.push(it.key); }));
  if (!G.plateCid || G.plateCid === c.id) G.plate.forEach(it => keys.push(it.key));
  (G.rack || []).forEach(r => { if (r.cid === c.id) r.items.forEach(it => keys.push(it.key)); });
  return keys;
}
function mustLeft(c) {
  if (!c || !c.handed) return [];
  const have = ownedKeys(c), out = [];
  c.order.items.forEach(k => { const j = have.indexOf(k); if (j >= 0) have.splice(j, 1); else out.push(k); });
  return out;
}
function stockBlocked(c) {
  if (!c) return [];
  const have = ownedKeys(c), out = [];
  (c.order.items || []).forEach(k => {
    const j = have.indexOf(k);
    if (j >= 0) { have.splice(j, 1); return; }
    if (stockOf(k) <= 0) out.push(k);
  });
  return out;
}
function fillableLeft(c) {
  const dead = stockBlocked(c);
  return mustLeft(c).filter(k => { const i = dead.indexOf(k); if (i >= 0) { dead.splice(i, 1); return false; } return true; });
}
function orderHeld(c) {
  if (!c) return false;
  if ((c.filled || []).length) return true;
  if ((G.fryer || []).some(n => n.some(it => it.cid === c.id))) return true;
  if ((G.rack || []).some(r => r.cid === c.id)) return true;
  return !!(G.plateCid === c.id && G.plate.length);
}
function canFryTicket(c) {
  return !!(c && c.handed && !(G.pay && c === G.counter) && (c.filled || []).length && !fillableLeft(c).length);
}
function fryTicket(c) {
  if (!c || !c.handed) return;
  if (G.pay && c === G.counter) return;
  const ml = fillableLeft(c);
  if (ml.length) { G.mustFlash = 1; c.bounce = 0.45; popup(L('先補齊空圈', 'Fill the empty rings'), 800, 120, '#ffb703'); return; }
  if (G.oilChange > 0) { c.bounce = 0.35; popup(L('換油中', 'Changing oil'), 640, 480, '#ff6b6b'); return; }
  const items = (c.filled || []).slice();
  if (!items.length) { popup(L('單子是空的', 'Empty ticket'), 800, 120, '#ffb703'); return; }
  const groups = [];
  const solo = items.filter(it => ITEMS[it.key].solo);
  const meat = items.filter(it => isMeat(it.key) && !ITEMS[it.key].solo);
  const veg = items.filter(it => !isMeat(it.key));
  solo.forEach(it => groups.push({ kind: 'chicken', items: [it] }));
  while (meat.length) groups.push({ kind: 'meat', items: meat.splice(0, meatCap()) });
  while (veg.length) groups.push({ kind: 'veg', items: veg.splice(0, SMALL_CAP) });
  const taken = new Set();
  const plan = [];
  for (const g of groups) {
    let idx = -1;
    for (let j = 0; j < G.baskets.length; j++) {
      if (taken.has(j)) continue;
      const b = G.baskets[j];
      if (b.locked || b.inOil || b.draining || (G.fryer[j] && G.fryer[j].length)) continue;
      const big = g.kind !== 'veg';
      const ok = big ? b.s === 'L' && (b.kind === g.kind || b.kind === 'chicken' || b.kind === 'meat') : b.s === 'S';
      if (ok && (idx < 0 || b.kind === g.kind)) idx = j;
      if (ok && b.kind === g.kind) break;
    }
    if (idx < 0) { G.fullFlash = 0.55; c.bounce = 0.5; popup(L('沒有空網，單子彈回', 'No free basket'), 640, 420, '#ff6b6b'); return; }
    taken.add(idx); plan.push([idx, g]);
  }
  plan.forEach(([i, g]) => {
    G.fryer[i] = g.items.map((it, j) => ({ key: it.key, d: 0, cold: 0, age: 0, old: !!it.old, cid: c.id, slot: j }));
    A.dunk(i);
  });
  c.filled = []; c.frying = true; markLesson('fry');
}
function commitLift(i) {
  const net = G.fryer[i] || [], b = G.baskets[i];
  const good = net.filter(it => it.d < 100), burnt = net.length - good.length;
  net.filter(it => it.d >= 100).forEach(it => G.stats.waste += unitCost(it.key));
  const spot = slotRect(i);
  if (burnt) popup(L(`焦掉 ${burnt}`, `Burnt ${burnt}`), spot.x + spot.w / 2, spot.y + 24, '#ff6b6b');
  const perfect = good.length && !burnt && good.every(it => { const I = ITEMS[it.key]; return it.d >= I.lo && it.d <= I.hi; });
  if (perfect) {
    G.streak = (G.streak || 0) + 1;
    popup(L('剛好', 'Perfect'), spot.x + spot.w / 2, spot.y + 18, '#b7f5c5');
    if (G.streak >= 3) {
      G.streak = 0; G.cash += 20; G.stats.rewards += 20; changeRep(1);
      popup(L('連三網好手藝 +$20', 'Three perfect +$20'), 640, 360, '#ffd166');
      addLog('連三網剛好，好手藝 +$20', 'Three perfect baskets, +$20');
    }
  } else if (good.some(it => { const I = ITEMS[it.key]; return it.d < I.lo || it.d > I.hi; })) G.streak = 0;
  if (burnt) G.streak = 0;
  if (burnt && G.theme === 'ghost') { changeRep(-1); popup(L('鬼月炸焦了', 'Burnt in ghost month'), 640, 400, '#d6c4ff'); }
  const cid = net[0] ? net[0].cid : 0;
  if (b.drainTo === 'rack' || !canPlate(cid)) G.rack.push({ cid, items: good, t: 0 });
  else { if (!G.plate.length) G.plateCid = cid; good.forEach(it => G.plate.push(it)); }
  markLesson('lift');
  G.fryer[i] = []; b.inOil = false; b.p = 0; b.draining = 0; b.age = 0;
}
function moveRackToPlate(i) {
  const r = G.rack[i]; if (!r) return;
  if (G.pay || (G.counter && G.counter.id !== r.cid)) { popup(L('這是後面的單', 'Later order'), 1150, 360, '#ffb703'); return; }
  if (G.plate.length && G.plateCid && G.plateCid !== r.cid) { popup(L('盤子是別單的', 'Plate is another order'), 1150, 360, '#ffb703'); return; }
  if (!G.plate.length) G.plateCid = r.cid;
  r.items.forEach(it => G.plate.push(it));
  G.rack.splice(i, 1); sfx('lift');
}
function resetPrep() { G.season = { salt: false, spicy: false, basil: false }; G.cuts = 0; G.pay = null; G.bills = []; }

function settle() {
  const c = G.counter, o = c.order; const need = countBy(o.items);
  const served = []; const rest = [];
  G.plate.forEach(it => { if (need[it.key] > 0) { need[it.key]--; served.push(it); } else rest.push(it); });
  const missing = Object.values(need).reduce((a, b) => a + b, 0);
  let sat = 100; const notes = [];
  served.forEach(it => {
    const [lab] = doneLabel(it);
    if (lab === '生') { sat -= 50; notes.push([`${ITEMS[it.key].name}是生的`, `${ITEMS[it.key].en} raw`]); }
    else if (lab === '半生') { sat -= 25; notes.push([`${ITEMS[it.key].name}沒熟透`, `${ITEMS[it.key].en} undercooked`]); }
    else if (lab === '太老') { sat -= 18; notes.push([`${ITEMS[it.key].name}炸太老`, `${ITEMS[it.key].en} overdone`]); }
    if (it.cold > 0.5) { sat -= 10; notes.push([`${ITEMS[it.key].name}油膩`, `${ITEMS[it.key].en} greasy`]); }
    if (it.old && !has('fridge')) { sat -= 8; notes.push([`${ITEMS[it.key].name}不太新鮮`, `${ITEMS[it.key].en} stale`]); }
  });
  if (served.length && G.oilUse > OIL_LIMIT) { sat -= 12; notes.push(['油有怪味', 'the oil tasted old']); }
  if (served.length && hasBoon('scale')) { sat -= 6; notes.push(['份量好像少', 'the portion looked short']); }
  if (missing) { sat -= 35 * missing; notes.push([`少了${missing}樣`, `${missing} missing`]); }
  if (!G.season.salt) { sat -= 15; notes.push(['沒灑胡椒鹽', 'no salt']); }
  if (G.season.spicy !== o.spicy) { sat -= 20; notes.push(o.spicy ? ['忘了加辣', 'no chili'] : ['我不吃辣!', 'I said no chili']); }
  if (G.season.basil !== o.basil) { sat -= 12; notes.push(o.basil ? ['沒有九層塔', 'no basil'] : ['不要九層塔啦', 'I said no basil']); }
  if (c.patience / c.max < 0.3) sat -= 10;
  sat = clamp(sat, 0, 100);
  // v42:應收 = 每份料的單價逐項加總 + 調味加價;品質/小費另列
  const lines = served.map(it => [ITEMS[it.key].name, salePrice(it.key), it.key]);
  const base = lines.reduce((a, l) => a + l[1], 0);
  if (G.season.spicy && o.spicy) lines.push(['辣粉', seasonPrice('spicy'), 'jar:spicy']);
  if (G.season.basil && o.basil) lines.push(['九層塔', seasonPrice('basil'), 'jar:basil']);
  const specN = served.filter(it => it.key === G.special && it.d >= ITEMS[it.key].lo && it.d <= ITEMS[it.key].hi).length;
  if (specN) lines.push([L('今日特餐', 'Tonight special'), specBonus() * specN, 'spec']);
  if (G.notice === 'lantern' && sat >= 80 && served.length) lines.push([L('燈節', 'Lantern'), 15, 'lantern']);
  const nt = noticeNow();
  if (nt.tip && sat >= 80 && served.length) lines.push([L(nt.zh, nt.en), nt.tip, nt.id]);
  let price = lines.reduce((a, l) => a + l[1], 0);
  const missNames = Object.keys(need).filter(k => need[k] > 0).map(k => [k, need[k]]);
  const ct = CTYPES[c.type];
  let tip = 0;
  if (!c.noTip && c.type === 'drunk' && rng() < 0.2) tip = 20;
  if (!c.noTip && sat >= 90 && (c.type === 'regular' || rng() < 0.4)) tip += Math.max(5, Math.round(base * 0.08 / 5) * 5) + (c.type === 'regular' ? 5 : 0) + (hasBoon('charm') && c.type === 'regular' ? 10 : 0);
  if (THEMES[G.theme] && THEMES[G.theme].tip) tip = Math.round(tip * THEMES[G.theme].tip);
  let offer = price;
  const nz = n => !n ? '' : (Array.isArray(n) ? n[0] : n);
  const ne = n => !n ? '' : (Array.isArray(n) ? n[1] : n);
  if (sat < 40) { offer = Math.round(price * 0.5); setLine(c, '這樣也敢收全價?' + (notes[0] ? `(${nz(notes[0])})` : ''), 'Full price for this?' + (notes[0] ? ` (${ne(notes[0])})` : '')); }
  else if (rng() < ct.haggle + (G.rumorId === 1 ? 0.15 : 0) + (G.notice === 'rival' ? 0.22 : 0) - ((G.notice === 'celeb' || G.notice === 'crew') ? 0.1 : 0)) { offer = Math.round(price * rand(...ct.offer) / 5) * 5; setLine(c, G.notice === 'rival' ? `對街只要 $${offer}。` : (c.type === 'aunt' ? `算 $${offer} 啦,好不好~` : `$${offer} 啦,便宜一點~`), G.notice === 'rival' ? `Across the lane it's $${offer}.` : (c.type === 'aunt' ? `Make it $${offer}, okay?` : `$${offer}, a bit cheaper?`)); }
  else if (sat >= 80) { const pl = pickLine('happy'); setLine(c, pl.zh, pl.en); }
  else if (notes.length) setLine(c, `嗯…${nz(notes[0])}。`, `Hmm… ${ne(notes[0])}.`);
  else { const pl = pickLine('ok'); setLine(c, pl.zh, pl.en); }
  if (G.dare === 'on') {
    G.dare = '';
    if (rng() < 0.5) { lines.push([L('賭贏雙倍', 'Bet won'), price, 'dare']); price *= 2; offer = price; setLine(c, '好，雙倍給你。', 'Fine. Double.'); }
    else { lines.push([L('賭輸', 'Bet lost'), -price, 'dare']); price = 0; offer = 0; setLine(c, '嘿嘿，這包我的。', 'Heh. This bag is mine.'); }
  }
  if (c.type === 'live') {
    if (sat >= 85) { G.cash += 40; G.stats.rewards += 40; changeRep(3); setLine(c, '拍到爆香了，打賞你！', 'That sizzle is going viral. Tip!'); popup(L('直播打賞 +$40', 'Stream tip +$40'), 640, 250, '#7CFFB2'); addLog('直播客打賞 +$40，口碑 +3', 'Stream tip +$40, rep +3'); }
    else if (sat < 50) { changeRep(-4); setLine(c, '這我要發限動…', 'This is going on my story…'); popup(L('被拍到翻車', 'Bad clip'), 640, 250, '#ff6b6b'); addLog('直播翻車，口碑 -4', 'Bad stream clip, rep −4'); }
    else setLine(c, '還行，我會標註攤位。', 'Fine. I will tag the stall.');
  }
  G.pay = { price, base, lines, missNames, tip, offer: Math.min(offer, price), sat, notes, matchedCost: served.reduce((a, it) => a + unitCost(it.key), 0), midTried: false };
  G.bills = [{ ...billAnchor(), life: G.pay.offer < G.pay.price ? 99 : 1.55, haggle: G.pay.offer < G.pay.price }];
  rest.forEach(it => G.stats.waste += unitCost(it.key));
  G.plate = []; G.plateCid = 0; G.lastServed = served;
  // 稽查員判定
  if (c.type === 'inspector') {
    c.revealed = true;
    const raw = served.some(it => it.d < ITEMS[it.key].lo);
    const oldOil = G.oilUse > OIL_LIMIT;
    if (raw || oldOil) {
      const fineBase = (raw ? 1000 : 500) + (G.rumorId === 0 ? 200 : 0) + (G.notice === 'raid' ? 300 : 0);
      const fine = Math.round(fineBase * (1 + 0.05 * (G.night - 1)) / 10) * 10; G.stats.fines += fine; G.cash -= fine; changeRep(-8); G.shake = 0.5;
      c.line = `衛生局稽查!${raw ? '食物沒炸熟' : '油太老了'},罰款 $${fine}!`;
      c.lineEn = `Health inspection! ${raw ? 'Food was raw' : 'The oil is old'}. Fine $${fine}!`;
      addLog(`被衛生稽查開罰 $${fine}(${raw ? '沒熟' : '老油'})`, `Inspection fine $${fine} (${raw ? 'raw' : 'old oil'})`); popup(`-$${fine}`, 640, 300, '#ff6b6b');
    } else {
      G.stats.rewards += 200; G.cash += 200; changeRep(5); setLine(c, '衛生局稽查,合格!這攤很乾淨,獎勵你。', 'Inspection passed. Clean stall — here is a reward.');
      addLog('衛生稽查合格,獎勵 $200', 'Inspection passed, +$200'); popup(L('+$200 稽查合格', '+$200 passed'), 640, 300, '#06d6a0');
    }
  }
}

function finishPay(amount) {
  const c = G.counter, p = G.pay;
  const tip = p.tip || 0; if (c.type === 'drunk' && tip >= 20) setLine(c, '嗝…不用找了!', 'Hic… keep the change!');
  sfx('cash'); G.stats.revenue += amount; G.cash += amount + tip; G.stats.tips += tip; G.stats.served++;
  popup(L(`+$${amount + tip}${tip ? `（小費 ${tip}）` : ''}`, `+$${amount + tip}${tip ? ` (tip ${tip})` : ''}`), 1060, 600, '#ffd166');
  if (p.sat >= 80) { changeRep(1.5 + (hasBoon('saint') ? 1 : 0)); G.stats.happy++; } else if (p.sat >= 50) changeRep(0.5); else { changeRep(-2 - (hasBoon('saint') ? 1 : 0)); G.stats.angry++; }
  if (c.type === 'regular' && p.sat >= 80) changeRep(1);
  if (c.sus && G.lastServed.some(it => it.key === 'byo')) { G.pendingSick = true; }
  const who = c.type === 'inspector' && c.revealed ? L('稽查員', 'Inspector') : L(CTYPES[c.type].label, CTYPES[c.type].en);
  addLog(`${who} 付 $${amount}${tip ? ' + 小費' + tip : ''},滿意度 ${p.sat}`, `${who} paid $${amount}${tip ? ' + tip ' + tip : ''}, mood ${p.sat}`);
  markLesson('pay');
  leave(c, c.line, false, c.lineEn);
  resetPrep();
}

function doReport() {
  const c = G.counter;
  if (c.sus) { changeRep(3); G.stats.rewards += 100; G.cash += 100; addLog('檢舉來路不明的食材,警察獎勵 $100', 'Reported shady food, +$100'); popup(L('+$100 檢舉正確', '+$100 right call'), 640, 300, '#06d6a0'); leave(c, '……(被帶走了)', false, '……(taken away)'); }
  else { changeRep(-5); G.stats.angry++; addLog(`亂檢舉${c.type === 'inspector' ? '衛生稽查員' : '無辜客人'},口碑 -5`, `False report on ${c.type === 'inspector' ? 'the inspector' : 'an innocent guest'}, rep −5`); popup(L('口碑 -5', 'Rep −5'), 640, 300, '#ff6b6b'); leave(c, c.type === 'inspector' ? '我就是稽查員欸…' : '神經病喔!', true, c.type === 'inspector' ? 'I AM the inspector…' : 'Are you serious?!'); }
  if (G.pay) { G.stats.waste += G.pay.matchedCost; }
  if (c.type === 'byo') G.plate = G.plate.filter(it => it.key !== 'byo');
  resetPrep();
}

function scrapOrder(c) {
  if (!c) return;
  (c.filled || []).forEach(it => {
    const v = G.inv[it.key];
    if (v && it.key !== 'byo') { if (it.old) v.old++; else v.fresh++; }
  });
  c.filled = [];
  (G.fryer || []).forEach((net, i) => {
    if (!net.some(it => it.cid === c.id)) return;
    net.forEach(it => { if (ITEMS[it.key]) G.stats.waste += unitCost(it.key); });
    G.fryer[i] = [];
    const b = G.baskets[i];
    if (b) { b.inOil = false; b.p = 0; b.draining = 0; b.age = 0; b.cue = 0; }
  });
  for (let i = (G.rack || []).length - 1; i >= 0; i--) if (G.rack[i].cid === c.id) {
    G.rack[i].items.forEach(it => { if (ITEMS[it.key]) G.stats.waste += unitCost(it.key); });
    G.rack.splice(i, 1);
  }
  if (G.plateCid === c.id) {
    G.plate.forEach(it => { if (ITEMS[it.key]) G.stats.waste += unitCost(it.key); });
    G.plate = []; G.plateCid = 0;
  }
}

function leave(c, line, angry, lineEn) {
  scrapOrder(c);
  if (typeof line === 'string') { c.line = line; c.lineEn = lineEn || ''; }
  c.angry = angry;
  G.lastLine = { who: c.revealed ? '衛生局稽查員' : CTYPES[c.type].label, whoEn: c.revealed ? 'Inspector' : CTYPES[c.type].en, text: c.line, textZh: c.line, textEn: c.lineEn || '', angry, t: 2.5 };
  G.walkers.push({ c, x: c.x || COUNTER_X, dir: -1, sayT: 1.8 }); G.counter = null;
}

// ---------- 更新 ----------
function update(dt) {
  G.popups.forEach(p => { p.life -= dt; p.y -= 30 * dt; }); G.popups = G.popups.filter(p => p.life > 0);
  G.particles.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }); G.particles = G.particles.filter(p => p.life > 0);
  G.shake = Math.max(0, G.shake - dt); if (G.shakeJar) G.shakeJar.t -= dt;
  if (G._phase !== G.phase) { G._phase = G.phase; G.veil = 1; }
  G.veil = Math.max(0, (G.veil || 0) - dt * 2.6);
  sfx('tick', dt / SPEED, G.phase === 'open' ? fried().length : 0, G.temp, G.phase === 'open' && G.oilChange <= 0);
  if (G.phase !== 'open') return;
  if (G.forkOpen) return;
  G.t += dt;
  if (G.cat) {
    if (G.cat.nap > 0) G.cat.nap -= dt;
    else {
      G.cat.x += G.cat.dir * 36 * dt;
      if (G.cat.x > 1360) { G.cat.dir = -1; G.cat.nap = rand(7, 14); }
      if (G.cat.x < -160) { G.cat.dir = 1; G.cat.nap = rand(9, 18); }
    }
  }
  if (G.theme === 'rain' && rng() < dt * 36) G.particles.push({ x: rand(-20, W), y: 44, vx: -70, vy: 280, life: 0.55, r: 1, c: 'rgba(186,206,220,0.5)', kind: 'rain' });
  else if (G.theme === 'ghost' && rng() < dt * 5) G.particles.push({ x: rand(40, W - 40), y: rand(50, 120), vx: rand(-10, 10), vy: rand(-18, -4), life: rand(1.2, 2.2), r: rand(2, 4.5), c: 'rgba(150,230,180,0.4)' });
  else if (G.theme === 'temple' && rng() < dt * 6) G.particles.push({ x: rand(60, W - 60), y: rand(48, 110), vx: rand(-8, 8), vy: rand(-14, -3), life: rand(0.8, 1.5), r: rand(1.6, 3), c: 'rgba(255,196,90,0.6)' });
  if (G.oilUse > OIL_LIMIT && rng() < dt * 5) G.particles.push({ x: rand(420, 900), y: 320, vx: rand(-8, 8), vy: rand(-28, -8), life: 1.5, r: rand(7, 14), c: 'rgba(70,55,40,0.28)' });
  while (G.schedule.length && G.schedule[0].t <= G.t && G.t < G.dayLen) { const e = G.schedule.shift(); spawn(e.type); }
  if (!G.forkFired && G.forkId && G.t >= 46 && G.t < G.dayLen - 15 && !G.pay) { G.forkFired = true; G.forkOpen = true; }
  nightBeats();
  // 油溫
  if (G.oilChange > 0) { G.oilChange -= dt; }
  if (G.fullFlash > 0) G.fullFlash -= dt;
  const th = THEMES[G.theme] || THEMES.fair;
  let target = TEMPS.find(x => x.key === G.tempKey).target + (th.temp || 0);
  if (G.theme === 'blackout' && has('generator')) target = TEMPS.find(x => x.key === G.tempKey).target;
  const rate = (G.oilChange > 0 ? 3 : 7) * (has('generator') ? 1.25 : 1);
  G.temp += clamp(target - G.temp, -rate * dt, rate * dt);
  G.baskets.forEach((b, i) => { if (b.draining > 0) { b.draining -= dt; if (b.draining <= 0) commitLift(i); } });
  (G.bills || []).forEach(b => { if (!b.haggle) b.life -= dt; });
  if (G.bills && G.bills.some(b => b.life <= 0) && G.pay) finishPay(G.pay.offer);
  if (G.counter && G.counter.bounce > 0) G.counter.bounce -= dt;
  railCustomers().forEach(c => { if (c !== G.counter && c.bounce > 0) c.bounce -= dt; });
  const oldOil = G.oilUse > OIL_LIMIT;
  G.fryer.forEach((net, i) => {
    const b = G.baskets[i]; if (!net.length || !b.inOil || b.draining) return;
    b.age = (b.age || 0) + dt;
    const p = slotRect(i);
    const stage = b.p >= 100 ? 'burn' : b.p > SH_HI ? 'warn' : b.p >= SH_LO ? 'fine' : b.age < 1.2 ? 'burst' : 'roll';
    const rateB = stage === 'burst' ? 16 : stage === 'fine' ? 12 : stage === 'warn' ? 8 : stage === 'burn' ? 5 : 6;
    if (rng() < dt * rateB) {
      const big = stage === 'burst';
      G.particles.push({ x: p.x + rand(10, p.w - 10), y: p.y + rand(12, p.h - 8), vx: rand(-8, 8), vy: rand(big ? -70 : -40, -12), life: rand(0.35, big ? 0.9 : 0.7), r: big ? rand(5, 11) : rand(1.5, 4), c: stage === 'burn' ? 'rgba(30,30,30,0.55)' : stage === 'warn' ? 'rgba(180,180,180,0.35)' : 'rgba(255,236,190,0.5)' });
    }
    if (b.p < 100) {
      b.p = Math.min(100, b.p + netSpeed(net) * dt);
      net.forEach(it => { const I = ITEMS[it.key]; it.d = mapD(b.p, I); if (G.temp < I.ideal - 18) it.cold += dt / netTime(net) * (has('heatlamp') ? 0.4 : 1); });
      const cue = b.p >= 100 ? 3 : b.p > SH_HI - 2 ? 2 : b.p >= SH_LO ? 1 : 0;
      if (cue > (b.cue || 0)) { b.cue = cue; sfx(['', 'done', 'warn', 'burnt'][cue]); if (cue === 1) b.flash = 0.35; }
      // 下一位客人的單熟了就撈上濾油網，不要停在油裡
      const owner = net[0] && net[0].cid;
      if (owner && (!G.counter || G.counter.id !== owner) && b.p >= SH_LO) A.lift(i);
    } else if (rng() < dt * 4) G.particles.push({ x: p.x + rand(10, p.w - 10), y: p.y + 16, vx: rand(-6, 6), vy: rand(-36, -16), life: 1.3, r: rand(6, 12), c: 'rgba(40,40,40,0.45)' });
    if (b.flash > 0) b.flash -= dt;
  });
  // 客人
  if (!G.counter && G.queue.length && G.t < G.dayLen + G.grace) { G.counter = G.queue.shift(); G.counter.x = G.counter.x || 400; G.counter.atCounter = 0; sfx('order'); }
  G.queue.forEach((c, i) => {
    c.waited = (c.waited || 0) + dt; c.patience -= dt * 0.4; c.tx = slotHome(i + 1);
    if (c.hold > 0) c.hold -= dt;
    else c.x += clamp(c.tx - c.x, -160 * dt, 160 * dt);
  });
  for (let i = G.queue.length - 1; i >= 0; i--) if (G.queue[i].patience <= 0) {
    const c = G.queue.splice(i, 1)[0]; scrapOrder(c); G.stats.lost++; changeRep(-2); addLog(`${CTYPES[c.type].label}排太久,離開了`, `${CTYPES[c.type].en} waited too long and left`); G.walkers.push({ c, x: c.x, dir: -1 });
  }
  const c = G.counter;
  if (c) {
    if (c.hold > 0) c.hold -= dt;
    else c.x += clamp(slotHome(0) - c.x, -160 * dt, 160 * dt);
    c.atCounter += dt;
    c.waited = (c.waited || 0) + dt; if (!G.pay) c.patience -= dt;
    if (c.type === 'drunk' && !c.changed && c.handed && c.atCounter > 6 && !G.pay) {
      c.changed = true; const ok = MENU.filter(k => stockOf(k) > 0); const k = ok.length ? pick(ok) : 'tempura'; c.order.items.push(k); (c.order.add = c.order.add || []).push(k); c.order.items.sort((a, b) => MENU.indexOf(a) - MENU.indexOf(b));
      setLine(c, `嗝…再加一份${ITEMS[k].name}!`, `Hic… one more ${ITEMS[k].en}!`); (c.need = c.need || []).push(k); popup(L('臨時加點', 'Add-on!'), 800, 140, '#ffb703');
    }
    if (c.patience <= 0) { G.stats.lost++; G.stats.angry++; changeRep(-2); addLog(`${CTYPES[c.type].label}等太久,生氣走了`, `${CTYPES[c.type].en} got mad and left`); const pl = pickLine('angry', 1); leave(c, pl.zh, true, pl.en); resetPrep(); }
  }
  clipTickets();
  pullRackForCounter();
  if (G.handAnim) { G.handAnim.t += dt / SPEED; if (G.handAnim.t > 0.9) G.handAnim = null; }
  if (G.mustFlash > 0) G.mustFlash -= dt / SPEED;
  if (G.lastLine) { G.lastLine.t -= dt; if (G.lastLine.t <= 0) G.lastLine = null; }
  G.walkers.forEach(w => { w.x += w.dir * 220 * dt; if (w.sayT) w.sayT -= dt; }); G.walkers = G.walkers.filter(w => w.x > -180 && w.x < W + 180);
  // 名單走完、攤上沒人，就收。不要空等倒數。
  if (!G.counter && !G.queue.length && !(G.schedule && G.schedule.length) && G.t > 4) {
    if (!G.endBanner) { G.endBanner = true; addLog('沒客人了，收攤', 'No one else coming. Closing.'); }
    endDay();
    return;
  }
  // 收攤
  if (G.t >= G.dayLen) {
    if (!G.endBanner) { G.endBanner = true; addLog('收攤時間到,不再接新客', 'Closing time — no new guests'); }
    if ((!G.counter && !G.queue.length) || G.t >= G.dayLen + G.grace) endDay();
  }
}

function endDay() {
  G.queue = []; G.counter = null;
  fried().concat(G.plate, (G.rack || []).flatMap(r => r.items)).forEach(it => G.stats.waste += unitCost(it.key)); G.fryer = G.fryer.map(() => []); G.baskets.forEach(b => { b.inOil = false; b.p = 0; b.draining = 0; }); G.plate = []; G.plateCid = 0; G.rack = [];
  if (G.pendingSick) { changeRep(-6); addLog('有客人吃了來路不明的自備料,上網爆料!口碑 -6', 'Someone ate shady BYO food and posted it. Rep −6'); }
  if (G.protectChoice === 'refuse') {
    const hit = Math.round(protectFee() * 1.4);
    G.stats.fines += hit; changeRep(-5);
    if (G.cash >= hit) G.cash -= hit;
    else { G.debt += hit - Math.max(0, G.cash); G.cash = 0; }
    addLog(`沒付保護費，收攤被鬧 −$${hit}，口碑 -5`, `The cut came back at closing −$${hit}, rep −5`);
  }
  // 隔夜耗損:保存 1 晚的剩料報廢;保存 2 晚的變「隔夜料」,原本的隔夜料報廢。冰箱:全部多留一晚。
  const spoiled = [];
  ALL_MENU.forEach(k => { const v = G.inv[k], days = has('fridge') ? 2 : STOCK[k].days;
    let lose = v.old; if (days >= 2) { v.old = v.fresh; } else { lose += v.fresh; v.old = 0; } v.fresh = 0;
    if (lose > 0) { G.stats.spoil += Math.round(lose * unitCost(k)); spoiled.push([k, lose]); } });
  G.spoiledList = spoiled;
  // 付攤租(含前晚欠款 +20% 滯納)
  const s = G.stats; const due = G.rent + Math.round(G.debt * 1.2); s.due = due;
  if (G.cash >= due) { G.cash -= due; G.debt = 0; G.debtStrikes = 0; s.paid = due; }
  else { s.paid = Math.max(0, G.cash); G.debt = due - s.paid; G.cash = 0; G.debtStrikes++; addLog(`付不出本週房租,欠 $${G.debt}`, `Could not cover this week's rent. Owe $${G.debt}`); }
  s.net = G.cash - G.debt - (G.cashStart - G.debtStart);
  const graded = nightGrade(s);
  s.grade = graded.g;
  s.gradeWhy = graded.why;
  if (!G.marks) G.marks = {};
  if (!G.gameOver && !G.marks.half && G.cash >= STALL_PRICE / 2) { G.marks.half = 1; addLog('現金過了買斷的一半。房租每週還是會來。', 'Past halfway to the buyout. Rent still comes every week.'); }
  if (!G.gameOver && !G.marks.near && G.cash >= STALL_PRICE * 0.85 && G.cash < STALL_PRICE) { G.marks.near = 1; addLog('再一週好生意，就夠把攤子買下來。', 'One good week and you can buy the stall.'); }
  G.best = Math.max(G.best, G.night);
  if (G.debtStrikes >= 2) G.gameOver = 'rent';
  else if (G.rep < 15) G.gameOver = 'rep';
  G.offer = G.gameOver ? [] : rollOffer();
  G.phase = 'results';
  if (G.gameOver) clearSave(); else saveGame();
}

// ---------- 輸入 ----------
let buttons = [];
function btn(id, x, y, w, h, label, onClick, opt = {}) {
  const enabled = opt.enabled !== false;
  buttons.push({ id, x, y, w, h, enabled, clickable: enabled || !!opt.clickable, onClick });
  const hover = mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h && enabled;
  const down = !!(held && held.id === id && hover);
  const dy = down ? 4 : 0;
  if (opt.bare) {
    ctx.save();
    if (hover || down || opt.on) {
      ctx.strokeStyle = opt.on ? '#ffe8a3' : '#ffd166';
      ctx.lineWidth = 2;
      rr(x, y + dy, w, h, 6);
      ctx.stroke();
    }
    if (label) {
      ctx.fillStyle = enabled ? '#fff8e7' : '#9a8f86';
      ctx.font = `normal ${opt.size || 18}px ${FONT}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(tr(label), x + w / 2, y + dy + h / 2 + 1);
    }
    ctx.restore();
    return;
  }
  const base = opt.color || '#c0392b';
  ctx.save();
  if (!down) { ctx.fillStyle = 'rgba(0,0,0,0.4)'; rr(x + 2, y + 5, w, h, 10); ctx.fill(); }
  if (opt.pulse && !down) { const q = 0.4 + 0.6 * Math.sin(performance.now() / 260); ctx.shadowColor = '#ffcf6b'; ctx.shadowBlur = 8 + q * 18; }
  ctx.fillStyle = !enabled ? '#4a4040' : opt.on ? '#f4a261' : hover ? lighten(base) : base;
  rr(x, y + dy, w, h, 10); ctx.fill();
  if (down) { ctx.fillStyle = 'rgba(0,0,0,0.22)'; rr(x, y + dy, w, h, 10); ctx.fill(); }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hover || opt.on ? '#ffe8a3' : 'rgba(255,230,180,0.28)'; ctx.lineWidth = hover || opt.on ? 3 : 1.5;
  rr(x, y + dy, w, h, 10); ctx.stroke();
  ctx.fillStyle = enabled ? '#fff8e7' : '#9a8f86';
  ctx.font = `normal ${opt.size || 18}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(tr(label), x + w / 2, y + dy + h / 2 + 1);
  ctx.restore();
}
function lighten(c) { return c === '#c0392b' ? '#e04a3a' : c === '#2a6f6a' ? '#36908a' : c === '#6b4226' ? '#8a5733' : c === '#3b5b92' ? '#4c74b8' : '#888'; }
const mouse = { x: -1, y: -1 };
let drag = null;
let held = null;
function toCanvas(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
function hitR(p, r, pad = 0) { return !!r && p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad; }
function cardGeom(i) {
  const w = 280, gap = 36, h = 236;
  return { x: 168 + i * (w + gap), y: 44, w, h };
}
function bustSlot() {
  const g = cardGeom(0);
  const foodH = 52;
  return { w: g.w - 8, h: g.h - foodH - 6, y: g.y + 2, foodH };
}
function slotHome(i) { const g = cardGeom(Math.max(0, Math.min(2, i))); return g.x + g.w / 2; }
function hitPad() { return window.innerWidth < 900 ? 16 : 0; }
function railCustomers() { return (G.counter ? [G.counter] : []).concat(G.queue || []).slice(0, 3); }
function custById(id) { return railCustomers().find(c => c.id === id) || null; }
function ticketAt(p, pad = 0) {
  const list = railCustomers();
  for (let i = list.length - 1; i >= 0; i--) if (hitR(p, cardGeom(i), pad)) return list[i];
  return null;
}
function canPlate(cid) {
  if (G.pay) return false;
  if (G.plate.length && G.plateCid && G.plateCid !== cid) return false;
  if (G.counter && G.counter.id !== cid) return false;
  return true;
}
function clipTickets() {
  const front = G.counter;
  const waitFront = front && !front.handed && (front.atCounter < 0.55 || G.pay);
  railCustomers().forEach(c => {
    if (c.handed) return;
    if (c === front && (front.atCounter < 0.55 || G.pay)) return;
    if (c !== front && waitFront) return;
    handOver(c);
  });
}
function pullRackForCounter() {
  const c = G.counter;
  if (!c || G.pay || G.plate.length || c.atCounter < 0.4) return;
  let moved = false;
  for (let i = G.rack.length - 1; i >= 0; i--) {
    if (G.rack[i].cid !== c.id) continue;
    if (!G.plate.length) G.plateCid = c.id;
    G.rack[i].items.forEach(it => G.plate.push(it));
    G.rack.splice(i, 1); moved = true;
  }
  if (moved) sfx('lift');
}
function dropPreview(k, p) {
  const over = ticketAt(p);
  if (over) return { c: over, ok: !!(over.handed && !(G.pay && over === G.counter) && mustLeft(over).includes(k)) };
  const c = railCustomers().find(x => x.handed && !(G.pay && x === G.counter) && mustLeft(x).includes(k));
  return c ? { c, ok: true } : null;
}
function ticketRect() { return cardGeom(0); }
function plateRect() { return { x: 988, y: 328, w: 272, h: 112 }; }
function guestRect() { const g = cardGeom(0); return { x: g.x, y: g.y, w: g.w, h: g.h - 30 }; }
function guestCardRect() { return cardGeom(0); }
function nightGrade(s) {
  const served = s.served || 0, lost = s.lost || 0, happy = s.happy || 0, angry = s.angry || 0;
  const seen = served + lost;
  if (!seen) return { g: 'C', why: 'empty' };
  const happyRate = served ? happy / served : 0;
  const angryRate = served ? angry / served : 0;
  const lostRate = lost / seen;
  const waste = (s.waste || 0) + (s.spoil || 0);
  const wasteHeavy = waste > Math.max(80, (s.revenue || 0) * 0.5);
  let g = 'B', why = 'ok';
  if (lostRate >= 0.45 || angryRate >= 0.5) { g = 'C'; why = lostRate >= angryRate ? 'lost' : 'angry'; }
  else if (happyRate >= 0.8 && lostRate <= 0.15 && angry === 0) { g = wasteHeavy ? 'A' : 'S'; why = wasteHeavy ? 'waste' : 'happy'; }
  else if (happyRate >= 0.55 && lostRate <= 0.3) { g = wasteHeavy ? 'B' : 'A'; why = wasteHeavy ? 'waste' : 'ok'; }
  else { g = 'B'; why = lostRate >= 0.25 ? 'lost' : 'ok'; }
  if (g !== 'C' && (lostRate >= 0.4 || angryRate >= 0.4)) { g = 'C'; why = lostRate >= angryRate ? 'lost' : 'angry'; }
  return { g, why };
}
function billRows(lines) {
  const rows = [];
  (lines || []).forEach(([nm, v, key]) => {
    key = key || nm;
    if (ITEMS[key]) {
      const hit = rows.find(q => q.key === key && q.v === v);
      if (hit) hit.n++;
      else rows.push({ key, v, n: 1, nm: NM(key), item: true });
    } else rows.push({ key, v, n: 1, nm, item: false });
  });
  return rows;
}
function billAnchor() { return { x: 900, y: 500 }; }
function cashboxRect() { return { x: 988, y: 640, w: 272, h: 48 }; }
function rackRect(i) {
  const F = fryFrame();
  const s = cellRect({ col: Math.min(3, i), s: 'L', sub: 0 });
  const spill = Math.max(0, i - 3);
  return { x: s.x + spill * 8, y: F.y + F.h + 12 + spill * 4, w: s.w, h: 88 };
}
function overFryer(p) { const F = fryFrame(); return p.x > F.x && p.x < F.x + F.w && p.y > F.y && p.y < F.y + F.h; }
const CHROME = /^(temp_|oil$|vol|lang|report|swap|send|pay|dump|refuse|up_|buy_|unbuy_|start|continue|newRun|open|next|toShop|bag)/;
function findDrag(p) {
  const pad = hitPad();
  if (G.bills && G.bills.length) { const b = billAnchor(); if (Math.hypot(p.x - b.x, p.y - b.y) < 54 + pad) return { type: 'bill' }; }
  if (G.plate.length && hitR(p, plateRect(), pad)) return { type: 'plate' };
  for (let i = (G.rack || []).length - 1; i >= 0; i--) if (hitR(p, rackRect(i), pad)) return { type: 'rack', i };
  for (let i = G.baskets.length - 1; i >= 0; i--) {
    if (G.baskets[i].locked || !(G.fryer[i] && G.fryer[i].length)) continue;
    if (hitR(p, slotRect(i), pad)) return { type: 'basket', i };
  }
  const rail = railCustomers();
  for (let i = rail.length - 1; i >= 0; i--) {
    const c = rail[i];
    if (!c.handed || !(c.filled || []).length || (G.pay && c === G.counter)) continue;
    if (hitR(p, cardGeom(i), pad)) return { type: 'ticket', cid: c.id };
  }
  for (const k of [...MENU].reverse()) { const R = ITEM_RECT(k); if (R && hitR(p, R, pad) && stockOf(k) > 0) return { type: 'item', key: k }; }
  return null;
}
function releaseDrag() {
  if (!drag) return;
  const d = drag, p = { x: d.x, y: d.y }, moved = d.moved;
  drag = null;
  const touch = () => puff(p.x, p.y);
  if (d.type === 'item') {
    const over = ticketAt(p);
    if (!moved) { A.drop(d.key); touch(); }
    else if (over) { A.drop(d.key, over.id); touch(); }
  } else if (d.type === 'ticket' && (!moved || overFryer(p))) { fryTicket(custById(d.cid)); touch(); }
  else if (d.type === 'basket' && (!moved || hitR(p, plateRect()) || overFryer(p))) { A.lift(d.i); touch(); }
  else if (d.type === 'rack' && (!moved || hitR(p, plateRect()))) { moveRackToPlate(d.i); touch(); }
  else if (d.type === 'plate' && (!moved || hitR(p, guestRect()) || hitR(p, guestCardRect()) || (p.x > 1030 && p.y > 500))) { A.bag(); touch(); G.shake = Math.max(G.shake, 0.12); }
  else if (d.type === 'bill' && G.pay) {
    if (G.pay.offer >= G.pay.price || !moved || hitR(p, guestRect()) || hitR(p, guestCardRect())) A.payAccept();
    else if (hitR(p, cashboxRect())) A.payInsist();
    else A.payMid();
    touch();
  }
}
cv.addEventListener('pointermove', e => {
  Object.assign(mouse, toCanvas(e));
  if (drag) { drag.x = mouse.x; drag.y = mouse.y; if (Math.hypot(drag.x - drag.sx, drag.y - drag.sy) > 8) drag.moved = true; }
});
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); Object.assign(mouse, toCanvas(e));
  if ((G.veil || 0) > 0.45) return;
  const p = toCanvas(e);
  if (e.button === 2) return;
  try { cv.setPointerCapture(e.pointerId); } catch (err) {}
  for (let i = buttons.length - 1; i >= 0; i--) {
    const b = buttons[i];
    if (!(b.enabled || b.clickable) || !hitR(p, b)) continue;
    if (G.phase === 'open' && /^(item_|lift_|bowl_)/.test(b.id)) continue;
    held = { id: b.id };
    if (!/^(item_|lift_|vol)/.test(b.id)) sfx('click');
    return;
  }
  if (G.phase === 'open' && !G.forkOpen) {
    if (!G.rescueUsed) {
      for (const k of MENU) { const R = ITEM_RECT(k); if (R && hitR(p, R) && stockOf(k) <= 0) { A.rescue(k); return; } }
    }
    const t = findDrag(p);
    if (t) drag = { ...t, x: p.x, y: p.y, sx: p.x, sy: p.y, moved: false };
  }
});
cv.addEventListener('pointerup', e => {
  Object.assign(mouse, toCanvas(e));
  const p = toCanvas(e);
  if (held) {
    const id = held.id;
    held = null;
    const b = buttons.find(x => x.id === id);
    if (b && (b.enabled || b.clickable) && hitR(p, b)) b.onClick();
    return;
  }
  releaseDrag();
});
cv.addEventListener('pointercancel', () => { drag = null; held = null; });
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'm') { sfx('cycleVolume'); return; }
  if (G.phase === 'title' && (k === 'enter' || k === ' ')) { G.hasSave ? A.cont() : A.start(); return; }
  if (G.phase === 'stock' && k === 'enter') { A.open(); return; }
  if (G.phase !== 'open' || G.forkOpen) return;
  const m = { a: () => A.drop(MENU[0]), s: () => A.drop(MENU[1]), d: () => A.drop(MENU[2]), f: () => A.drop(MENU[3]), g: () => A.drop(MENU[4]), h: () => A.drop(MENU[5]),
    j: () => A.drop(MENU[6]), k: () => MENU[7] && A.drop(MENU[7]), l: () => MENU[8] && A.drop(MENU[8]),
    '1': () => A.tapNet(0), '2': () => A.tapNet(1), '3': () => A.tapNet(2), '4': () => A.tapNet(3), '5': () => A.tapNet(4), '6': () => A.tapNet(5), v: () => A.pour(), o: A.changeOil, q: () => A.setTemp('low'), w: () => A.setTemp('mid'), e: () => A.setTemp('high'), ' ': A.liftAll, z: () => A.toggle('salt'), x: () => A.toggle('spicy'), c: () => A.toggle('basil'), enter: A.bag };
  if (m[k]) { m[k](); e.preventDefault(); }
});

// ---------- 繪圖 ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function wood(x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x + 40, y + h);
  g.addColorStop(0, 'rgba(74,42,20,0.96)');
  g.addColorStop(0.5, 'rgba(42,22,12,0.94)');
  g.addColorStop(1, 'rgba(24,12,6,0.96)');
  ctx.fillStyle = g; rr(x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = '#d08a48'; ctx.lineWidth = 3; rr(x + 1.5, y + 1.5, w - 3, h - 3, 16); ctx.stroke();
}
function text(s, x, y, size = 18, color = '#fff8e7', align = 'left', weight = 'normal') { s = tr(s);
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
}
function wrap(s, x, y, maxW, size, color, lh) {
  s = String(s || ''); ctx.font = `normal ${size}px ${FONT}`;
  const words = /[\u3000-\u9fff]/.test(s) ? [...s] : s.split(/(\s+)/).filter(w => w !== '');
  let line = '', yy = y;
  for (const ch of words) {
    const next = line + ch;
    if (line && ctx.measureText(next).width > maxW) { text(line.replace(/\s+$/, ''), x, yy, size, color); line = /^\s+$/.test(ch) ? '' : ch.trimStart(); yy += lh; }
    else line = next;
  }
  if (line.trim()) text(line.replace(/\s+$/, ''), x, yy, size, color);
  return yy;
}
function panel(x, y, w, h, title) {
  ctx.fillStyle = 'rgba(40,22,12,0.92)'; rr(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = '#8a5733'; ctx.lineWidth = 2; ctx.stroke();
  if (title) text(title, x + 14, y + 18, 16, '#ffd59a');
}

function drawBackground(time, scene) {
  if (scene && IMG['sc_' + scene]) { ctx.drawImage(IMG['sc_' + scene], 0, 0, W, H); return; }
  const bgI = IMG.sc_stall_front || IMG.bg;
  if (bgI) {
    ctx.fillStyle = '#0b0705'; ctx.fillRect(0, 0, W, 432);
    ctx.drawImage(bgI, 0, -115, W, 720);
    const wg = ctx.createRadialGradient(640, 300, 30, 640, 300, 560); wg.addColorStop(0, 'rgba(255,170,70,0.16)'); wg.addColorStop(1, 'rgba(255,170,70,0)');
    ctx.fillStyle = wg; ctx.fillRect(0, 0, W, 432);
    const cg = ctx.createLinearGradient(0, 404, 0, 434); cg.addColorStop(0, '#7a4a26'); cg.addColorStop(1, '#3a2312');
    ctx.fillStyle = cg; ctx.fillRect(0, 404, W, 30);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, 430); g.addColorStop(0, '#141432'); g.addColorStop(1, '#3a2340');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 430);
  // 遠方攤位剪影
  const stalls = [[0, 200, '#2a1a35', '豬血糕'], [230, 170, '#2d1c38', '大腸包小腸'], [880, 190, '#2a1a35', '珍奶'], [1090, 190, '#2d1c38', '射氣球']];
  stalls.forEach(([x, w, c, name]) => {
    ctx.fillStyle = c; ctx.fillRect(x, 170, w, 260);
    const lg = ctx.createRadialGradient(x + w / 2, 200, 5, x + w / 2, 200, 120); lg.addColorStop(0, 'rgba(255,170,80,0.35)'); lg.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = lg; ctx.fillRect(x - 60, 120, w + 120, 200);
    text(name, x + w / 2, 190, 18, 'rgba(255,200,140,0.55)', 'center');
  });
  // 燈串
  for (let row = 0; row < 2; row++) {
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = 0; x <= W; x += 20) { const y = 60 + row * 50 + Math.sin(x / 160 + row) * 14; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    for (let x = 20; x < W; x += 64) {
      const y = 66 + row * 50 + Math.sin(x / 160 + row) * 14; const fl = 0.75 + 0.25 * Math.sin(time * 3 + x);
      const cols = ['255,200,90', '255,120,90', '255,230,150'][(x / 64 + row) % 3 | 0];
      const lg = ctx.createRadialGradient(x, y, 1, x, y, 26); lg.addColorStop(0, `rgba(${cols},${0.9 * fl})`); lg.addColorStop(1, `rgba(${cols},0)`);
      ctx.fillStyle = lg; ctx.fillRect(x - 26, y - 26, 52, 52);
      ctx.fillStyle = `rgb(${cols})`; ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fill();
    }
  }
  // 遮雨棚
  for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? '#f3ead8' : '#c0392b'; ctx.beginPath(); ctx.moveTo(400 + i * 30, 165); ctx.lineTo(430 + i * 30, 165); ctx.lineTo(430 + i * 30, 180); ctx.arc(415 + i * 30, 180, 15, 0, Math.PI); ctx.fill(); }
  // 暖光
  const wg = ctx.createRadialGradient(640, 330, 30, 640, 330, 520); wg.addColorStop(0, 'rgba(255,170,70,0.28)'); wg.addColorStop(1, 'rgba(255,170,70,0)');
  ctx.fillStyle = wg; ctx.fillRect(0, 0, W, 430);
  // 櫃台
  const cg = ctx.createLinearGradient(0, 400, 0, 432); cg.addColorStop(0, '#a0673a'); cg.addColorStop(1, '#5c3a1e');
  ctx.fillStyle = cg; ctx.fillRect(0, 400, W, 32);
  ctx.fillStyle = 'rgba(255,220,160,0.25)'; ctx.fillRect(0, 400, W, 3);
}

function markLesson(k) { if (G.lesson) G.lesson[k] = 1; }
function lessonLine() {
  const Lsn = G.lesson || {};
  if (!Lsn.fry) return L('第一晚：把夾單拖進油鍋。肉進大網，菜進小網。', 'Night one: drag the ticket into the oil. Meat in the big nets, veg in the small.');
  if (!Lsn.lift) return L('油轉金黃就撈。太白是生，太暗會焦。', 'Lift when the oil turns gold. Pale is raw. Dark burns.');
  if (!Lsn.salt) return L('盤子上點胡椒鹽。今晚先不用辣粉和九層塔。', 'Tap the pepper salt. Skip chili and basil tonight.');
  if (!Lsn.bag) return L('把盤子拖給客人，或按裝袋。', 'Drag the plate to the guest, or press bag.');
  if (!Lsn.pay) return L('點鈔票，收進錢箱。', 'Tap the bill into the till.');
  return L('會了。下一位可以先炸，熟的放下面濾油網。', 'You have it. Fry the next ticket early. Done food waits on the drain rack.');
}
function custKey(c) {
  if (!c) return 'normal';
  if (c.revealed) return 'inspector_revealed';
  return c.look || (c.type === 'live' ? 'live' : c.type);
}
function custImg(c) { const k = custKey(c); return IMG['c_' + k] || IMG['c_' + (c && c.type === 'live' ? 'live' : (c && c.type) || 'normal')] || IMG.c_normal; }
function drawPerson(c, x, scale = 1, mood = null, y = 400) {
  const s = scale;
  const ratio = c.patience / c.max; mood = mood ?? (c.angry ? 0 : ratio);
  const im = custImg(c);
  if (!im) return;
  const bob = Math.sin(performance.now() / 300 + c.id) * 2; const h = 150 * s, w = im.width / im.height * h;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  if (mood < 0.3) ctx.filter = 'sepia(0.4) saturate(1.4) hue-rotate(-15deg)';
  ctx.drawImage(im, x - w / 2, y - h + bob + 4, w, h); ctx.restore();
  if (mood < 0.3) text('!', x + w / 2 - 8, y - h + 16, 18, '#ff6b6b', 'center');
}
function drawBust(c, x, y, w, h) {
  const im = custImg(c);
  if (!im) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.imageSmoothingEnabled = false;
  const ratio = (c.patience || 1) / Math.max(1, c.max || 1);
  if (ratio < 0.3) ctx.filter = 'sepia(0.45) saturate(1.35) hue-rotate(-14deg)';
  const scale = Math.min(w / im.width, h / im.height);
  const dw = Math.round(im.width * scale), dh = Math.round(im.height * scale);
  const bob = Math.sin(performance.now() / 320 + (c.id || 0)) * 1;
  ctx.drawImage(im, Math.round(x + (w - dw) / 2), Math.round(y + h - dh + bob), dw, dh);
  ctx.restore();
}
function blitCover(im, x, y, w, h) {
  if (!im) return;
  const s = Math.max(w / im.width, h / im.height);
  const dw = im.width * s, dh = im.height * s;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function chip(key, x, y, d = null, w = 92, h = 34, it = null) {
  const I = ITEMS[key];
  let col = I.color;
  if (d !== null) { const k = clamp(d / 100, 0, 1); col = d >= 100 ? '#1a1a1a' : `rgb(${Math.round(240 - 110 * k)},${Math.round(200 - 140 * k)},${Math.round(120 - 90 * k)})`; }
  const im = d !== null && d >= 100 && IMG.burnt ? IMG.burnt : foodImg(key, d !== null);
  if (im) {
    ctx.fillStyle = 'rgba(30,15,6,0.55)'; rr(x, y, w, h, 8); ctx.fill();
    const k = d === null ? 0 : clamp(d / 100, 0, 1);
    ctx.save(); if (d !== null) ctx.filter = d >= 100 ? 'brightness(0.18) grayscale(1)' : `brightness(${1.35 - 0.7 * k}) saturate(${0.6 + 0.6 * k})`;
    const s2 = h - 2; ctx.drawImage(im, x + 2, y + 1, s2, s2); ctx.restore();
    text(I.name, x + s2 + 4 + (w - s2 - 4) / 2, y + h / 2, 14, '#fff8e7', 'center');
    return;
  }
  ctx.fillStyle = col; rr(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();
  text(I.name, x + w / 2, y + h / 2, 15, d !== null && d > 55 ? '#fff' : '#2b1a0e', 'center');
}

function drawHUD() {
  ctx.fillStyle = 'rgba(10,6,4,0.9)'; ctx.fillRect(0, 0, W, 40);
  const left = Math.max(0, G.dayLen - G.t);
  text(L(`第 ${G.night} 週`, `Week ${G.night}`), 14, 20, 18, '#ffcf6b');
  text(clockStr(), 118, 20, 18);
  const coming = (G.schedule ? G.schedule.length : 0) + (G.queue ? G.queue.length : 0) + (G.counter ? 1 : 0);
  text(G.t < G.dayLen ? L(`${Math.ceil(left)}秒 · ${coming}位`, `${Math.ceil(left)}s · ${coming}`) : L('收攤中', 'Closing'), 196, 20, 14, '#e7d7c3', 'left', 'normal');
  if (IMG.uiCash) ctx.drawImage(IMG.uiCash, 360, 8, 36, 22);
  text(`$${Math.round(G.cash)}`, 402, 20, 20, G.cash >= G.rent ? '#ffd166' : '#ff8787');
  const rentStr = L(`本週 $${G.rent}`, `Week $${G.rent}`) + (G.debt ? `  ${L('欠', 'owe')} $${Math.round(G.debt * 1.2)}` : '');
  text(oneLine(rentStr, (G.streak || 0) > 0 ? 220 : 310, 14), 520, 20, 14, G.debt ? '#ff8787' : '#e7d7c3', 'left', 'normal');
  if ((G.streak || 0) > 0) text(L(`好手藝 ${G.streak}`, `Craft ${G.streak}`), 760, 20, 14, '#b7f5c5');
  const stars = G.rep / 20; let st = '';
  for (let i = 0; i < 5; i++) st += stars >= i + 0.75 ? '★' : '☆';
  if (IMG.uiRep) ctx.drawImage(IMG.uiRep, 860, 6, 26, 26);
  text(`${st} ${Math.round(G.rep)}`, 892, 20, 16, '#ffd166');
  const p = clamp(Math.max(0, G.cash) / STALL_PRICE, 0, 1);
  ctx.fillStyle = '#3a2416'; ctx.fillRect(0, 37, W, 3);
  ctx.fillStyle = p >= 1 ? '#7dcea0' : '#e07a1f'; ctx.fillRect(0, 37, W * p, 3);
}

function coverStallName() {
  const x = 348, y = 40, w = 584, h = 84;
  ctx.save();
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#3c2c3a');
  g.addColorStop(0.45, '#563a4c');
  g.addColorStop(1, '#6c485a');
  ctx.fillStyle = g;
  ctx.fillRect(x + 40, y, w - 80, h);
  for (let i = 0; i < 13; i++) {
    const fx = x + 40 + i * 39;
    const fold = ctx.createLinearGradient(fx, 0, fx + 39, 0);
    fold.addColorStop(0, 'rgba(16,6,12,0.4)');
    fold.addColorStop(0.5, 'rgba(255,214,200,0.08)');
    fold.addColorStop(1, 'rgba(16,6,12,0.32)');
    ctx.fillStyle = fold;
    ctx.fillRect(fx, y, 39, h);
  }
  const edge = (x0, dir) => {
    const lg = ctx.createLinearGradient(x0, 0, x0 + dir * 44, 0);
    lg.addColorStop(0, dir > 0 ? 'rgba(60,44,58,0)' : 'rgba(60,44,58,1)');
    lg.addColorStop(1, dir > 0 ? 'rgba(60,44,58,1)' : 'rgba(60,44,58,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(dir > 0 ? x0 : x0 - 44, y, 44, h);
  };
  edge(x, 1);
  edge(x + w, -1);
  ctx.fillStyle = 'rgba(255,220,170,0.4)';
  ctx.fillRect(x + 52, y + 6, w - 104, 2);
  ctx.fillStyle = '#e7c27a';
  ctx.fillRect(x + 52, y + h - 5, w - 104, 3);
  ctx.restore();
}
// 營業時客人那一排：自己畫的夜市巷，不用攤照（攤照上的人跟招牌會跟客人疊在一起）
const STRIP_PAL = {
  fair:     { a: '#120e1e', b: '#2a1612', c: '#3d2418', aw: '#b4332c', aw2: '#f0dcc0', lamp: [255, 196, 110], win: 'rgba(255,168,70,0.5)' },
  rain:     { a: '#101820', b: '#182834', c: '#203444', aw: '#314858', aw2: '#9aafc0', lamp: [210, 224, 240], win: 'rgba(170,200,240,0.28)' },
  temple:   { a: '#220e12', b: '#3a1410', c: '#542016', aw: '#8c1a16', aw2: '#f0c878', lamp: [255, 168, 64], win: 'rgba(255,130,50,0.55)' },
  ghost:    { a: '#0c1618', b: '#122428', c: '#1a322e', aw: '#184038', aw2: '#78aa98', lamp: [168, 224, 186], win: 'rgba(130,210,160,0.32)' },
  blackout: { a: '#07060a', b: '#0e0c10', c: '#141214', aw: '#181416', aw2: '#322824', lamp: [255, 140, 50], win: 'rgba(255,120,40,0.12)' },
};
let rowCacheKey = '', rowCache = null;
function speck(n) { let t = Math.imul(n + 1, 374761393); t = Math.imul(t ^ t >>> 13, 1274126177); return ((t ^ t >>> 16) >>> 0) / 4294967296; }
function customerRowCanvas(theme) {
  const gen = theme === 'blackout' && has('generator') ? 1 : 0;
  const key = theme + ':' + gen;
  if (rowCache && rowCacheKey === key) return rowCache;
  const c = document.createElement('canvas');
  c.width = W; c.height = STRIP.y1 + 8;
  const g = c.getContext('2d'), P = STRIP_PAL[theme] || STRIP_PAL.fair, hh = c.height;
  const sky = g.createLinearGradient(0, 0, 0, hh);
  sky.addColorStop(0, P.a); sky.addColorStop(0.62, P.b); sky.addColorStop(1, P.c);
  g.fillStyle = sky; g.fillRect(0, 0, W, hh);
  const pool = g.createRadialGradient(COUNTER_X, 108, 8, COUNTER_X, 96, 240);
  pool.addColorStop(0, theme === 'blackout' && !gen ? 'rgba(255,140,40,0.05)' : 'rgba(255,160,70,0.18)');
  pool.addColorStop(1, 'rgba(255,160,70,0)');
  g.fillStyle = pool; g.fillRect(160, 36, 480, 100);
  // 兩側遠攤，右邊不要留一片空黑
  for (let i = 0; i < 7; i++) {
    const x = 520 + i * 108, top = 78 + (i % 3) * 6;
    g.fillStyle = i % 2 ? '#4a2418' : '#2c1814';
    g.fillRect(x, top + 18, 96, hh - top - 28);
    g.fillStyle = i % 2 ? P.aw : P.aw2;
    g.fillRect(x - 4, top, 104, 14);
    if (theme !== 'blackout' || gen) {
      g.fillStyle = P.win;
      g.fillRect(x + 14, top + 28, 22, 16);
      g.fillRect(x + 48, top + 28, 22, 16);
    }
  }
  g.fillStyle = 'rgba(0,0,0,0.28)';
  [236, 700, 1088].forEach(x => g.fillRect(x, 52, 5, 74));
  // 棚沿：只佔最上緣，不蓋到臉
  for (let i = 0; i < 24; i++) {
    const x = 180 + i * 46;
    g.fillStyle = i % 2 ? P.aw : P.aw2;
    g.beginPath();
    g.moveTo(x, 40); g.lineTo(x + 46, 40); g.lineTo(x + 46, 48);
    g.quadraticCurveTo(x + 23, 58, x, 48);
    g.closePath(); g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, STRIP.base - 18, W, 28);
  g.strokeStyle = 'rgba(255,220,180,0.07)'; g.lineWidth = 1;
  for (let x = 220; x < W; x += 34) { g.beginPath(); g.moveTo(x, STRIP.base - 16); g.lineTo(x, STRIP.y1 + 2); g.stroke(); }
  const wood = g.createLinearGradient(0, STRIP.base - 4, 0, STRIP.y1 + 6);
  wood.addColorStop(0, '#d09a62'); wood.addColorStop(1, '#3a2214');
  g.fillStyle = wood; g.fillRect(0, STRIP.base - 3, W, 14);
  g.fillStyle = 'rgba(255,226,180,0.45)'; g.fillRect(0, STRIP.base - 3, W, 2);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(255,220,180,${0.025 + speck(i + 9) * 0.05})`;
    g.fillRect(speck(i) * W, 46 + speck(i + 3) * 72, 2, 2);
  }
  rowCache = c; rowCacheKey = key;
  return c;
}
function drawCustomerRow(time, theme) {
  if (IMG.counterBg) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (theme === 'blackout' && !has('generator')) ctx.filter = 'brightness(0.35)';
    ctx.drawImage(IMG.counterBg, 0, 42, 1280, 244); ctx.restore();
  } else ctx.drawImage(customerRowCanvas(theme), 0, 0);
  const P = STRIP_PAL[theme] || STRIP_PAL.fair, [lr, lg, lb] = P.lamp;
  const dark = theme === 'blackout' && !has('generator');
  const n = dark ? 5 : (theme === 'temple' ? 10 : 15);
  ctx.save();
  if (!IMG.counterBg) for (let i = 0; i < n; i++) {
    const x = 220 + i * ((W - 240) / n), y = 64 + Math.sin(i * 0.9) * 2;
    const fl = dark ? 0.2 + 0.25 * Math.sin(time * 7 + i * 2) : 0.72 + 0.28 * Math.sin(time * 2.4 + i);
    const rad = theme === 'temple' ? 16 : 11;
    const glow = ctx.createRadialGradient(x, y, 1, x, y, rad);
    glow.addColorStop(0, `rgba(${lr},${lg},${lb},${0.8 * fl})`);
    glow.addColorStop(1, `rgba(${lr},${lg},${lb},0)`);
    ctx.fillStyle = glow; ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    ctx.fillStyle = `rgba(${lr},${lg},${lb},${fl})`;
    ctx.beginPath(); ctx.arc(x, y, theme === 'temple' ? 3.2 : 2.2, 0, 7); ctx.fill();
  }
  if (theme === 'rain') {
    ctx.strokeStyle = 'rgba(190,210,230,0.28)'; ctx.lineWidth = 1;
    for (let i = 0; i < 26; i++) {
      const x = (i * 53 + time * 90) % (W + 30) - 10, y = 46 + (i * 17) % 64;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 12); ctx.stroke();
    }
  }
  if (theme === 'ghost') {
    ctx.fillStyle = `rgba(70,130,100,${0.06 + 0.04 * Math.sin(time * 0.8)})`;
    ctx.fillRect(200, 42, W - 200, STRIP.y1 - 42);
  }
  ctx.restore();
}
function drawScene(time) {
  drawCustomerRow(time, G.theme || 'fair');
  ctx.fillStyle = 'rgba(14,8,5,0.97)'; ctx.fillRect(0, STRIP.y1, W, H - STRIP.y1);
  drawNotebook(8, 198);
  drawRail();
  G.walkers.forEach(w => {
    const b = bustSlot();
    drawBust(w.c, w.x - b.w / 2, b.y, b.w, b.h);
    if (w.sayT > 0 && w.c && w.c.line) text(oneLine(L(w.c.line, w.c.lineEn || w.c.line), 150, 13), w.x + b.w * 0.28, b.y + 18, 13, '#fff8e7', 'center');
  });
}
function drawNotebook(x, y) {
  ctx.save();
  if (IMG.regularNote) { ctx.imageSmoothingEnabled = false; ctx.drawImage(IMG.regularNote, x, y, 154, 72); }
  else {
  ctx.fillStyle = '#fff3a8'; rr(x, y, 154, 72, 6); ctx.fill();
  ctx.strokeStyle = '#e1c56a'; ctx.lineWidth = 1; rr(x, y, 154, 72, 6); ctx.stroke();
  }
  text(L('熟客', 'Regular'), x + 8, y + 14, 12, '#7a4b00');
  jarIcon('spicy', x + 108, y + 14, 14, G.regularOrder.spicy);
  jarIcon('basil', x + 132, y + 14, 14, G.regularOrder.basil);
  iconRow(countEnts(G.regularOrder.items, 'self'), x + 8, y + 48, 26, 2, 138);
  ctx.restore();
}
function oneLine(s, maxW, size) {
  s = String(s || '');
  ctx.font = `normal ${size}px ${FONT}`;
  if (ctx.measureText(s).width <= maxW) return s;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
function fitSize(s, maxW, size, min) {
  let n = size;
  while (n > min) { ctx.font = `normal ${n}px ${FONT}`; if (ctx.measureText(String(s)).width <= maxW) break; n--; }
  return n;
}
function drawGuestCard() {
  const R = guestCardRect(), c = G.counter, maxW = R.w - 20;
  ctx.save(); ctx.beginPath(); rr(R.x, R.y, R.w, R.h, 10); ctx.clip();
  ctx.fillStyle = 'rgba(28,16,10,0.94)'; rr(R.x, R.y, R.w, R.h, 10); ctx.fill();
  ctx.strokeStyle = '#8a5733'; ctx.lineWidth = 2; rr(R.x, R.y, R.w, R.h, 10); ctx.stroke();
  const th = THEMES[G.theme] || THEMES.fair;
  const theme = L(th.name, th.en), spec = `${NM(G.special)} +$8`;
  ctx.font = `bold 13px ${FONT}`;
  const themeW = ctx.measureText(theme).width;
  ctx.font = `bold 12px ${FONT}`;
  const specW = ctx.measureText(spec).width;
  if (themeW + specW < maxW - 8) {
    text(theme, R.x + 10, R.y + 16, 13, '#ffd59a');
    text(spec, R.x + R.w - 8, R.y + 16, 12, '#ffcf6b', 'right');
  } else {
    text(oneLine(theme, maxW * 0.4, 12), R.x + 10, R.y + 16, 12, '#ffd59a');
    text(oneLine(spec, maxW * 0.56, 11), R.x + R.w - 8, R.y + 16, 11, '#ffcf6b', 'right');
  }
  if (!c || c.atCounter < 0.35) {
    const msg = G.t >= G.dayLen ? L('收攤了，做完鋼軌上的單', 'Closing — finish the tickets')
      : G.lastLine ? lastText() : (G.queue.length ? L('客人正在走過來', 'A guest is walking up') : L('鋼軌空著，等下一張夾單', 'Rail is empty'));
    wrap(msg, R.x + 10, R.y + 52, maxW, 14, G.lastLine && G.lastLine.angry ? '#ffb4a8' : '#f3e6d0', 18);
    ctx.restore(); return;
  }
  const ratio = clamp(c.patience / c.max, 0, 1);
  const col = ratio > 0.5 ? '#b7e4c7' : ratio > 0.25 ? '#ffd59a' : '#ff8f8f';
  text(c.revealed ? L('稽查員', 'Inspector') : CL(c.type), R.x + 10, R.y + 40, 15, col);
  text(`${Math.max(0, Math.ceil(c.patience))}${L('秒', 's')}`, R.x + R.w - 8, R.y + 40, 13, col, 'right');
  if (G.pay) {
    const face = G.pay.sat >= 80 ? L('滿意', 'Happy') : G.pay.sat >= 50 ? L('普通', 'Okay') : L('不爽', 'Unhappy');
    text(`${face} ${G.pay.sat}`, R.x + 10, R.y + 64, 14, G.pay.sat >= 80 ? '#b7f5c5' : '#ffb4a8');
    text(oneLine(lineOf(c), maxW, 13), R.x + 10, R.y + 96, 13, '#f3e6d0', 'left', 'normal');
    ctx.restore(); return;
  }
  const short = shortItems(c);
  const stuck = short.length && !orderHeld(c) && !fillableLeft(c).length;
  if (stuck) {
    text(L('缺貨', 'Out'), R.x + 10, R.y + 62, 13, '#ffb4a8');
    iconRow(short.map(k => [k, 1, 'short']), R.x + 48, R.y + 62, 22, 2, 180);
    btn('swapOrder', R.x + 8, R.y + 84, 112, 32, L('換單', 'Swap'), A.swapOrder, { enabled: !c.swapped, color: '#2a6f6a', size: 15 });
    btn('sendAway', R.x + 126, R.y + 84, 108, 32, L('請離開', 'Send off'), A.sendAway, { color: '#4a4a4a', size: 15 });
    ctx.restore(); return;
  }
  const said = lineOf(c);
  const quoted = said ? (LANG === 'en' ? `"${said}"` : `「${said}」`) : '';
  const report = c.type === 'byo' || c.sus;
  const skip = stockBlocked(c).length > 0;
  const qMax = (report || skip) ? maxW - 74 : maxW;
  if (G.coach && G.night === 1) {
    text(oneLine(quoted, qMax, 13), R.x + 10, R.y + 64, 13, '#f3e6d0', 'left', 'normal');
    text(oneLine(lessonLine(), qMax, 12), R.x + 10, R.y + 92, 12, '#ffd59a', 'left', 'normal');
  } else if (G.coach && G.stats.served < 2) {
    text(oneLine(quoted, qMax, 13), R.x + 10, R.y + 64, 13, '#f3e6d0', 'left', 'normal');
    const nxt = railCustomers().slice(1).find(q => q.handed && fillableLeft(q).length);
    const nxtFry = railCustomers().slice(1).find(q => canFryTicket(q) && !G.fryer.some(n => n.some(it => it.cid === q.id)));
    const busy = G.fryer.some(n => n.length) || G.plate.length;
    const hint = c.type === 'regular' ? L('熟客阿桑：照左邊黃紙做，不用問', 'Regular A-sang: follow the yellow note')
      : !c.handed ? L('等夾單扣上', 'Ticket is clipping on')
      : fillableLeft(c).length ? L('虛線空圈，從左邊拖料上去', 'Drag food onto the dashed rings')
      : (skip && (c.filled || []).length) ? L('缺的跳過，這張可以下鍋', 'Skip the missing one — fry this ticket')
      : (busy && nxt) ? L('這張在炸，下一張可以先補', 'This one is cooking — fill the next ticket')
      : (busy && nxtFry) ? L('下一張單可以先拖進油鍋', 'Drag the next ticket into the oil')
      : (!G.plate.length && !G.fryer.some(n => n.length)) ? L('把這張夾單拖進油鍋', 'Drag this ticket into the oil')
      : G.plate.length ? L('撒胡椒鹽，盤子拖給客人', 'Salt, then drag the plate over')
      : L('看油色，金黃就撈', 'Lift when the oil turns gold');
    text(oneLine(hint, qMax, 12), R.x + 10, R.y + 92, 12, '#ffd59a', 'left', 'normal');
  } else if (quoted) wrap(quoted, R.x + 10, R.y + 62, qMax, 13, '#f3e6d0', 16);
  if (skip) btn('sellShort', R.x + R.w - 70, R.y + 86, 60, 26, L('照賣', 'Serve'), A.sellShort, { color: '#6b4226', size: 12 });
  else if (report) btn('report', R.x + R.w - 70, R.y + 86, 60, 26, L('檢舉', 'Report'), A.report, { color: '#3b5b92', size: 12 });
  ctx.restore();
}
function drawStripBubble(c) {
  const x = 720, y = 146, w = 550, h = 112;
  ctx.fillStyle = '#fffaf0'; rr(x, y, w, h, 12); ctx.fill();
  if (!c || c.atCounter <= 0.5) {
    if (G.lastLine) { text(G.lastLine.who, x + 14, y + 18, 14, '#a33'); if (LANG === 'zh') wrap(`「${G.lastLine.text}」`, x + 14, y + 46, w - 28, 17, G.lastLine.angry ? '#c1121f' : '#2a7d4f', 22); }
    else text(c || G.queue.length ? '🚶 → …' : L('(等客人上門 — 他們會從左邊走過來)', '🚶 → (waiting for guests)'), x + w / 2, y + h / 2, 15, '#8a7a6a', 'center', 'normal');
    return;
  }
  ctx.beginPath(); ctx.moveTo(x, y + 50); ctx.lineTo(x - 22, y + 70); ctx.lineTo(x, y + 78); ctx.fill();
  const ratio = clamp(c.patience / c.max, 0, 1), col = ratio > 0.6 ? '#2a9d55' : ratio > 0.3 ? '#e98a00' : '#d62828';
  text(c.revealed ? L('衛生局稽查員', 'Inspector') : CL(c.type), x + 14, y + 16, 15, '#a33');
  text(`⏱${Math.max(0, Math.ceil(c.patience))}`, x + 150, y + 16, 13, col);
  ctx.fillStyle = '#ddd'; rr(x + 196, y + 12, 90, 8, 4); ctx.fill(); ctx.fillStyle = col; rr(x + 196, y + 12, 90 * ratio, 8, 4); ctx.fill();
  const short = !G.pay ? shortItems(c) : [];
  // v43:調味需求 = 撒粉罐圖示(紅斜線 = 不要)
  if (!G.pay && c.type !== 'regular' && !short.length) { jarIcon('salt', x + w - 90, y + 18, 26, true); jarIcon('spicy', x + w - 60, y + 18, 26, c.order.spicy); jarIcon('basil', x + w - 30, y + 18, 26, c.order.basil); }
  if (LANG === 'zh') wrap(`「${c.line}」`, x + 14, y + 40, w - 120, 13, '#6b5a4a', 17);
  if (G.pay) {
    const p = G.pay, face = p.sat >= 80 ? '😄' : p.sat >= 50 ? '😐' : '😠';
    text(face, x + 26, y + 88, 26, '#000', 'center'); ctx.fillStyle = '#ddd'; rr(x + 46, y + 82, 120, 12, 6); ctx.fill(); ctx.fillStyle = p.sat >= 80 ? '#2a9d8f' : p.sat >= 50 ? '#e9a400' : '#d62828'; rr(x + 46, y + 82, 120 * p.sat / 100, 12, 6); ctx.fill();
    if (p.notes.length) wrap(L('問題:', 'Issues: ') + p.notes.slice(0, 3).join(L('、', ', ')), x + 178, y + 88, w - 190, 12, '#7a4b4b', 15);
  } else if (short.length) {
    ctx.fillStyle = 'rgba(214,40,40,0.12)'; rr(x + 6, y + 66, w - 12, 42, 8); ctx.fill();
    iconRow(short.map(k => [k, 1, 'short']), x + 14, y + 87, 30, 6, w - 290);
    btn('swapOrder', x + w - 252, y + 72, 120, 34, '🙇 道歉換單', A.swapOrder, { enabled: !c.swapped, color: '#2a6f6a', size: 13 });
    btn('sendAway', x + w - 126, y + 72, 118, 34, '請他離開(-2)', A.sendAway, { color: '#4a4a4a', size: 13 });
  } else {
    if (c.type === 'regular' && !c.swapped && !c.handed) { text('📒', x + 24, y + 88, 22, '#555', 'center'); arrowSmall(x + 40, y + 88, 22); iconRow(countEnts(G.regularOrder.items, 'self'), x + 68, y + 88, 30, 4, 300); }
    else if (!c.handed) { bowlIcon(x + 30, y + 88, 34); if (c.waitBowl) { crossMark(x + 50, y + 76, 9); text(L('兩個鐵盆都滿 → 先下鍋', 'Both bowls full → pour first'), x + 64, y + 88, 13, '#d62828'); } else { arrowSmall(x + 52, y + 88, 24); text('…', x + 84, y + 88, 18, '#555'); } }
    else { const ml = mustLeft(c), mc = countBy(ml);
      // 盆裡(一般圖示) + 要你補(橘色脈動) / 補好(✓)
      bowlIcon(x + 26, y + 88, 30);
      const ents = countEnts(c.picked, 'self');
      const nc = countBy(c.need); Object.keys(nc).forEach(k => { const left = mc[k] || 0, done = nc[k] - left; if (left) ents.push([k, left, 'need']); if (done) ents.push([k, done, 'done']); });
      if (!ents.length) text(L('(空)', '(empty)'), x + 48, y + 88, 13, '#555');
      const wr = iconRow(ents, x + 46, y + 88, 34, 6, w - 180);
      if (!ml.length) { arrowSmall(x + 52 + wr, y + 88, 22); netIcon(x + 92 + wr, y + 88, 30); }
    }
    if (c.type === 'byo' || c.sus) btn('report', x + w - 112, y + 74, 100, 32, '🚨 檢舉', A.report, { color: '#3b5b92', size: 14 });
  }
}
function countEnts(keys, st) { const m = countBy(keys); return Object.keys(m).map(k => [k, m[k], st]); }

// ---------- 左欄:食材、油溫、換油、熟客筆記 ----------
function drawLeft() {
  panel(8, 292, 300, 420, IMG.glassCase ? '' : L('展示櫃', 'Case'));
  if (IMG.glassCase) { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(IMG.glassCase, 10, 300, 296, 356); ctx.restore(); }
  else {
  text(L('肉', 'Meat'), 200, 312, 14, '#ffb067', 'right');
  text(L('菜', 'Veg'), 292, 312, 14, '#9be7b0', 'right');
  }
  const keys = [...MENU], mlk = [];
  railCustomers().forEach(c => { if (!c.handed || (G.pay && c === G.counter)) return; mustLeft(c).forEach(k => { if (!mlk.includes(k)) mlk.push(k); }); });
  const lay = caseLayout();
  if (!IMG.glassCase) {
  ctx.fillStyle = 'rgba(224,122,31,0.22)'; rr(14, lay.meatY - 2, 280, lay.meatH, 10); ctx.fill(); ctx.strokeStyle = '#e07a1f'; ctx.lineWidth = 2; rr(14, lay.meatY - 2, 280, lay.meatH, 10); ctx.stroke();
  ctx.fillStyle = 'rgba(58,154,74,0.18)'; rr(14, lay.vegY - 2, 280, lay.vegH, 10); ctx.fill(); ctx.strokeStyle = '#3a9a4a'; rr(14, lay.vegY - 2, 280, lay.vegH, 10); ctx.stroke();
  }
  keys.forEach((k) => {
    const R = ITEM_RECT(k); if (!R) return; const { x: bx, y: by, w: tw, h: th } = R, I = ITEMS[k], meat = isMeat(k);
    const q = k === 'byo' ? 1 : stockOf(k);
    btn('item_' + k, bx, by, tw, th, '', () => A.drop(k), { bare: !!IMG.glassCase, color: meat ? '#7a3c12' : '#2f5a34', enabled: q > 0 });
    ctx.save(); ctx.beginPath(); ctx.rect(bx + 1, by + 1, tw - 2, th - 2); ctx.clip();
    const fim = foodImg(k, false), tight = th < 40, isz = th >= 58 ? 42 : th >= 44 ? 32 : tight ? 20 : 26;
    if (fim) blitFood(fim, bx + 2, by + (th - isz) / 2, isz, isz, true);
    const tx = bx + (fim ? isz + 4 : 6);
    const v = G.inv[k] || { old: 0 };
    const short = q <= 0;
    const nameMax = Math.max(24, tw - (tx - bx) - 4);
    const nm = NM(k);
    const ns = fitSize(nm, nameMax, tight ? 12 : 16, 10);
    const nameY = by + th * (tight ? 0.32 : 0.36);
    const priceY = by + th - (tight ? 8 : 12);
    ctx.font = `normal ${ns}px ${FONT}`;
    text(ctx.measureText(nm).width <= nameMax ? nm : oneLine(nm, nameMax, ns), tx, nameY, ns);
    const priceSize = tight ? 10 : 12;
    if (short && k !== 'byo') text(oneLine(G.rescueUsed ? L('沒了', 'Out') : L(`補 $${rescueCost(k)}`, `+$${rescueCost(k)}`), nameMax, priceSize), tx, priceY, priceSize, '#ffb4a8');
    else {
      const stock = k === 'byo' ? '' : (v.old ? `剩${q} 舊${v.old}` : `剩${q}`);
      const price = `$${salePrice(k)}`;
      ctx.font = `normal ${priceSize}px ${FONT}`;
      const both = stock ? `${price} ${stock}` : price;
      if (ctx.measureText(both).width <= nameMax) text(both, tx, priceY, priceSize, '#ffd166');
      else { text(price, tx, priceY, priceSize, '#ffd166'); if (stock) text(stock, bx + tw - 2, priceY, priceSize - 1, q <= 3 ? '#ffcf6b' : '#e7d7c3', 'right', 'normal'); }
    }
    ctx.restore();
    if (mlk.includes(k) && Math.sin(performance.now() / 140) > -0.2) { ctx.strokeStyle = '#ff9f1c'; ctx.lineWidth = 3; rr(bx - 1, by - 1, tw + 2, th + 2, 8); ctx.stroke(); }
  });
  const ty = 664, old = G.oilUse > OIL_LIMIT;
  text(`${Math.round(G.temp)}°`, 16, ty, 18, G.temp > 182 ? '#ff8f6b' : G.temp < 155 ? '#9ad1ff' : '#ffd166');
  text(`${old ? L('老油', 'OLD') : L('新油', 'fresh')} ${Math.round(G.oilUse)}/${OIL_LIMIT}`, 70, ty, 13, old ? '#ff6b6b' : '#b7e4c7');
  TEMPS.forEach((tp, i) => btn('temp_' + tp.key, 14 + i * 58, ty + 14, 54, 32, L(tp.name, ['Low', 'Mid', 'High'][i]), () => A.setTemp(tp.key), { on: G.tempKey === tp.key, color: '#2a6f6a', size: 14 }));
  btn('oil', 188, ty + 14, 60, 32, `$${oilPrice()}`, A.changeOil, { enabled: !fried().length && G.oilChange <= 0, color: old ? '#8a3030' : '#6b4226', size: 14 });
}
// v41:不鏽鋼鐵盆(俯視,canvas 畫)
function drawBowl(bi, B, x, y, w, h, cid) {
  const n = B.items.length, sel = G.bowlSel === bi, cx = x + w / 2, cy = y + h / 2 + 2, R = h >= 100 ? 46 : 34, sk = R / 46;
  buttons.push({ id: 'bowl_' + bi, x, y, w, h, enabled: true, clickable: true, onClick: () => A.pour(bi), onRight: () => A.clearBowl(bi) });
  ctx.save();
  ctx.fillStyle = sel ? 'rgba(244,162,97,0.22)' : 'rgba(0,0,0,0.25)'; rr(x, y, w, h, 10); ctx.fill();
  if (sel) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2.5; rr(x, y, w, h, 10); ctx.stroke(); }
  if (IMG.steelBowl) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(IMG.steelBowl, cx - R, cy - R * 360 / 440, R * 2, R * 2 * 360 / 440);
  } else {
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(cx + 3, cy + 5, R, R * 0.86, 0, 0, 7); ctx.fill(); // 影子
  let g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R); g.addColorStop(0, '#f4f6f8'); g.addColorStop(0.45, '#aab1b9'); g.addColorStop(0.7, '#e3e7eb'); g.addColorStop(1, '#6e767e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.86, 0, 0, 7); ctx.fill(); // 外緣
  g = ctx.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, R - 6); g.addColorStop(0, '#eef1f4'); g.addColorStop(0.6, '#a9b0b8'); g.addColorStop(1, '#5d656d');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, R - 7, (R - 7) * 0.86, 0, 0, 7); ctx.fill(); // 盆內
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy, R - 7, (R - 7) * 0.86, 0, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx, cy + 2, R * 0.56, R * 0.48, 0, 0, 7); ctx.stroke(); // 盆底圈
  }
  // 盆裡的料(交盆動畫飛行中先不畫)
  if (!(G.handAnim && G.handAnim.bi === bi && G.handAnim.t < 0.6)) B.items.forEach((it, j) => { const a = j / Math.max(1, n) * Math.PI * 2 + bi, rr2 = (n === 1 ? 0 : n <= 3 ? 14 : 20) * sk;
    const ix = cx + Math.cos(a) * rr2, iy = cy + Math.sin(a) * rr2 * 0.8, s = (ITEMS[it.key].size === 'L' ? 40 : 30) * sk;
    const im = IMG['raw_' + it.key] || foodImg(it.key, false);
    if (im) { const sc = s / Math.max(im.width, im.height); ctx.drawImage(im, ix - im.width * sc / 2, iy - im.height * sc / 2, im.width * sc, im.height * sc); }
    else { ctx.fillStyle = ITEMS[it.key].color; ctx.beginPath(); ctx.arc(ix, iy, s / 3, 0, 7); ctx.fill(); } });
  ctx.restore();
  text(`#${bi + 1} · ${n}`, x + 6, y + 10, 12, sel ? '#ffd166' : '#d8c8b0', 'left');
  const cc = G.counter, mine = n && cc && cc.handed && B.cid === cc.id && !G.pay, ml = mine ? mustLeft(cc) : [];
  if (ml.length) { ctx.strokeStyle = '#ff9f1c'; ctx.lineWidth = G.mustFlash > 0 && Math.sin(performance.now() / 80) > 0 ? 5 : 3; rr(x, y, w, h, 10); ctx.stroke(); }
  // v43:還要補 = 橘色脈動圖示;齊了 = 盆→網 圖示
  ctx.fillStyle = ml.length ? '#e07a1f' : n ? '#c0392b' : 'rgba(0,0,0,0.55)'; rr(x + 6, y + h - 22, w - 12, 20, 5); ctx.fill();
  if (ml.length) { const e = countEnts(ml, 'need'); iconRow(e, x + 12, y + h - 12, 16, 3, w - 20); }
  else if (n) { text('▼', x + 22, y + h - 12, 12, '#fff', 'center'); netIcon(cx + 6, y + h - 12, 26); text('V', x + w - 16, y + h - 12, 11, '#ffe8a3', 'center'); }
  else text(sel ? '⏳' : '—', cx, y + h - 12, 12, '#fff', 'center');
}

// ---------- 中央:俯視油槽 ----------
function drawTank() {
  const old = G.oilUse > OIL_LIMIT, now = performance.now() / 1000;
  const F = fryFrame();
  const X = F.x, Y = F.y, TW = F.w, TH = F.h;
  if (IMG.fryerBody) {
    ctx.save(); ctx.imageSmoothingEnabled = false;
    if (old) ctx.filter = 'brightness(0.65) sepia(0.4)';
    ctx.drawImage(IMG.fryerBody, X, Y, TW, TH); ctx.restore();
  } else {
  ctx.fillStyle = '#5c6168'; rr(X, Y, TW, TH, 12); ctx.fill();
  ctx.fillStyle = '#8d949c'; rr(X + 4, Y + 4, TW - 8, 8, 3); ctx.fill();
  ctx.fillStyle = old ? '#6a440e' : '#c98a28'; rr(X + 8, Y + F.head - 4, TW - 16, F.oil + 8, 8); ctx.fill();
  ctx.fillStyle = old ? 'rgba(40,20,0,0.35)' : 'rgba(255,220,120,0.18)'; rr(X + 14, Y + F.head, TW - 28, F.oil - 4, 6); ctx.fill();
  }
  if (G.fullFlash > 0) { ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 6; rr(X + 2, Y + 2, TW - 4, TH - 4, 14); ctx.stroke(); }
  if (G.theme === 'blackout' && has('generator')) {
    const lx = X + 70, ly = Y + 36;
    const lg = ctx.createRadialGradient(lx, ly, 2, lx, ly, 80);
    lg.addColorStop(0, 'rgba(255,214,130,0.5)'); lg.addColorStop(1, 'rgba(255,214,130,0)');
    ctx.fillStyle = lg; ctx.fillRect(lx - 80, ly - 40, 160, 110);
  }
  const cid = G.counter && !G.pay ? G.counter.id : -1;
  for (let i = 0; i < G.fryer.length; i++) if (!G.baskets[i].locked) drawSlot(i, G.fryer[i], now, cid);
  ctx.save();
  if (IMG.rackBoard) { ctx.imageSmoothingEnabled = false; ctx.drawImage(IMG.rackBoard, 344, 534, 604, 88); }
  const netI = IMG.smallNet || IMG.basketTop;
  for (let i = 0; i < 4; i++) {
    const box = rackRect(i);
    if (netI) { ctx.save(); ctx.globalAlpha = G.rack[i] ? 1 : 0.92; ctx.imageSmoothingEnabled = false; ctx.drawImage(netI, box.x, box.y, box.w, box.h); ctx.restore(); }
    else { ctx.strokeStyle = 'rgba(220,220,220,0.8)'; ctx.lineWidth = 1.5; for (let g = 0; g < 6; g++) { ctx.beginPath(); ctx.moveTo(box.x + 8, box.y + 16 + g * 14); ctx.lineTo(box.x + box.w - 8, box.y + 16 + g * 14); ctx.stroke(); } }
  }
  (G.rack || []).forEach((r, i) => {
    const box = rackRect(i);
    r.items.slice(0, 4).forEach((it, j) => foodIcon(it.key, box.x + box.w * 0.34 + (j % 2) * 40, box.y + box.h * 0.42 + Math.floor(j / 2) * 34, 36, it.d >= 40));
    const who = railCustomers().findIndex(cu => cu.id === r.cid);
    if (who >= 0) { ctx.fillStyle = ['#c8962e', '#1d7a6e', '#6d4ea0'][who]; rr(box.x + 8, box.y + 10, 16, 14, 3); ctx.fill(); text(String(who + 1), box.x + 16, box.y + 17, 11, '#fff', 'center'); }
  });
  ctx.restore();
  if (G.oilChange > 0) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; rr(430, 390, 420, 72, 12); ctx.fill(); text(`${L('換油中', 'Changing oil')} ${G.oilChange.toFixed(1)}`, 640, 426, 26, '#fff', 'center'); }
  const frontTop = 622;
  if (frontTop < 712) {
    ctx.fillStyle = '#2a180e';
    ctx.fillRect(328, frontTop, 636, 712 - frontTop);
    ctx.fillStyle = '#6b4226';
    ctx.fillRect(328, frontTop, 636, 8);
  }
}

function slotState(it) {
  const I = ITEMS[it.key];
  if (it.d >= 100) return { lab: '焦了', col: '#7a1010', fg: '#ff6b6b', burnt: true };
  if (it.d < I.lo) return { lab: it.d < 40 ? '生' : '半生', col: '#4f7fa8', fg: '#cfe6ff' };
  if (it.d <= I.hi) return { lab: '剛好!', col: '#21b36b', fg: '#eafff2', ready: true };
  { const t = clamp((it.d - I.hi) / Math.max(1, 100 - I.hi), 0, 1); return { lab: '快焦!', col: `rgb(${Math.round(240 - 20 * t)},${Math.round(140 - 100 * t)},${Math.round(40)})`, fg: '#ffe0d6', warn: true }; }
}
function drawFryLife(x, y, w, h, net, now) {
  if (!net.length) return;
  const maxD = Math.max(...net.map(it => it.d));
  const burnt = net.some(it => it.d >= 100);
  ctx.save();
  if (!burnt) {
    const bubbles = 3 + Math.floor(clamp(maxD, 0, 80) / 20);
    ctx.strokeStyle = 'rgba(255,246,210,0.8)'; ctx.lineWidth = 1;
    for (let i = 0; i < bubbles; i++) {
      const px = x + 12 + ((i * 41 + Math.floor(now * 24)) % Math.max(8, w - 24));
      const ph = (now * 26 + i * 13) % (h * 0.5);
      ctx.globalAlpha = 0.35 + (i % 3) * 0.12;
      ctx.beginPath(); ctx.arc(px, y + h - 10 - ph, 1.5 + (i % 3), 0, 7); ctx.stroke();
    }
  }
  if (maxD > 72 || burnt) {
    const puffs = burnt ? 4 : 3;
    ctx.fillStyle = burnt ? 'rgba(28,28,28,0.8)' : 'rgba(220,214,204,0.7)';
    for (let i = 0; i < puffs; i++) {
      const rise = (now * (burnt ? 24 : 16) + i * 11) % (burnt ? 40 : 26);
      ctx.globalAlpha = burnt ? 0.55 : 0.32;
      ctx.beginPath(); ctx.arc(x + w * 0.28 + i * (w * 0.16), y + 10 - rise, (burnt ? 6 : 4) + (i % 2), 0, 7); ctx.fill();
    }
  }
  ctx.restore();
}
function netReady(net) { const g = net.filter(it => it.d < 100); return net.some(it => it.d >= 100) || (g.length && g.every(it => it.d >= ITEMS[it.key].lo)); }
function drawSlot(i, net, now, cid) {
  const b = G.baskets[i], big = b.s === 'L', { x, y, w, h } = slotRect(i), on = net.length > 0;
  const draining = b.draining > 0;
  if (draining) {
    const k = 1 - b.draining / 0.42;
    const dest = b.drainTo === 'plate' ? { x: 1140, y: 360 } : { x: rackRect(b.drainRack || 0).x + 56, y: rackRect(b.drainRack || 0).y + 48 };
    ctx.save(); ctx.translate((dest.x - x - w / 2) * k, (dest.y - y - h / 2) * k);
  }
  const finish = () => { if (draining) ctx.restore(); };
  ctx.fillStyle = on ? 'rgba(20,10,4,0.28)' : 'rgba(20,10,4,0.12)'; rr(x, y, w, h, 10); ctx.fill();
  const netI = (big ? IMG.bigNet : IMG.smallNet) || IMG.basketTop;
  if (netI) { ctx.save(); ctx.globalAlpha = on ? 0.92 : 0.8; ctx.imageSmoothingEnabled = false; ctx.drawImage(netI, x, y, w, h); ctx.restore(); }
  if (!on) { finish(); return; }
  const multi = big && net.length > 1, n = big ? (multi ? 2 : 1) : Math.max(1, net.length), cw = (w - 12) / (big && multi ? 2 : Math.max(1, net.length)), P = b.p || 0;
  net.forEach((it, j) => {
    const I = ITEMS[it.key];
    const s = multi ? 48 : big ? 88 : 34, cx = x + 6 + cw * (multi ? j % 2 : j) + cw / 2, cy = y + (multi ? h * 0.38 + Math.floor(j / 2) * (h * 0.36) : h * 0.46);
    const rawI = IMG['raw_' + it.key], frI = IMG['fr_' + it.key], fim = IMG['f_' + (IMG_ALIAS[it.key] || it.key)], k = clamp(it.d / 100, 0, 1);
    const fit = (im, a, flt) => { if (!im) return; ctx.save(); ctx.globalAlpha = a; if (flt) ctx.filter = flt; blitFood(im, cx - s / 2, cy - s / 2, s, s, false); ctx.restore(); };
    if (rawI && frI) { if (it.d >= 100) fit(IMG.burnt || frI, 1, IMG.burnt ? '' : 'brightness(0.2)');
      else { const m = clamp((it.d - I.lo * 0.45) / Math.max(8, I.lo * 0.55), 0, 1); fit(rawI, 1 - m * 0.85); if (m > 0) {
        const over = it.d > I.hi ? clamp((it.d - I.hi) / Math.max(8, 100 - I.hi), 0, 1) : 0;
        const hot = it.d >= I.lo && it.d <= I.hi;
        fit(frI, Math.max(m, hot ? 1 : m), over ? `brightness(${1 - 0.72 * over}) sepia(${0.25 + 0.5 * over}) saturate(${1.1 - 0.7 * over})` : hot ? 'saturate(1.25) brightness(1.05)' : '');
      } } }
    else if (fim) { ctx.save(); ctx.filter = it.d >= 100 ? 'brightness(0.18) grayscale(1)' : `brightness(${1.25 - 0.55 * k}) saturate(${0.7 + 0.5 * k})`; ctx.drawImage(fim, cx - s / 2, cy - s / 2, s, s); ctx.restore(); }
    else { ctx.fillStyle = I.color; ctx.beginPath(); ctx.arc(cx, cy, s / 3, 0, 7); ctx.fill(); }
  });
  drawFryLife(x, y, w, h, net, now);
  if (b.flash > 0) { ctx.save(); ctx.globalAlpha = Math.min(0.55, b.flash * 1.6); ctx.fillStyle = '#fff2b0'; rr(x, y, w, h, 10); ctx.fill(); ctx.restore(); }
  const who = railCustomers().findIndex(cu => net[0] && cu.id === net[0].cid);
  if (who >= 0) { ctx.fillStyle = ['#c8962e', '#1d7a6e', '#6d4ea0'][who]; rr(x + 6, y + 6, 18, 16, 4); ctx.fill(); text(String(who + 1), x + 15, y + 14, 12, '#fff', 'center'); }
  const ready = P >= SH_LO && P < 100 && P <= SH_HI + 8, burnt = P >= 100;
  if (burnt) { ctx.strokeStyle = 'rgba(20,20,20,0.85)'; ctx.lineWidth = 4; rr(x, y, w, h, 10); ctx.stroke(); }
  else if (ready) {
    ctx.strokeStyle = `rgba(255,210,90,${0.45 + 0.45 * Math.sin(now * 7)})`; ctx.lineWidth = 4; rr(x, y, w, h, 10); ctx.stroke();
    ctx.save();
    ctx.fillStyle = 'rgba(70,32,6,0.88)'; ctx.beginPath(); ctx.arc(x + w - 18, y + 18, 13, 0, 7); ctx.fill();
    text(L('撈', 'UP'), x + w - 18, y + 18, 14, '#ffe08a', 'center');
    ctx.restore();
  }
  finish();
}
// v39:調味罐(canvas 畫的撒粉罐,點一下會傾斜撒粉)
function shaker(id, x, y, label, body, cap, on, en) {
  buttons.push({ id, x, y, w: 74, h: 52, enabled: en, clickable: en, onClick: () => A.toggle(id) });
  const sj = G.shakeJar && G.shakeJar.s === id && G.shakeJar.t > 0 ? G.shakeJar : null;
  const jar = IMG['shaker_' + id];
  ctx.save();
  if (!jar) { ctx.fillStyle = on ? 'rgba(244,162,97,0.35)' : 'rgba(0,0,0,0.3)'; rr(x, y, 74, 52, 8); ctx.fill(); }
  if (on) { ctx.strokeStyle = '#ffe8a3'; ctx.lineWidth = 2.5; rr(x, y, 74, 52, 8); ctx.stroke(); }
  const cx = x + 37, cy = y + 26; ctx.translate(cx, cy);
  if (sj) ctx.rotate(-0.9 * Math.sin(sj.t / 0.6 * Math.PI) - 0.15 * Math.sin(sj.t * 60));
  if (!en) ctx.globalAlpha = 0.45;
  if (jar) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(jar, -37, -26, 74, 52);
    ctx.globalAlpha = 1;
    const parts = label.split(' ');
    text(parts[0], 0, -2, 11, '#3a2416', 'center');
    if (parts[1]) text(parts[1], 0, 12, 10, '#5a3a12', 'center');
  } else {
  ctx.fillStyle = cap; rr(-10, -20, 20, 9, 3); ctx.fill(); // 蓋
  ctx.fillStyle = '#d9dde2'; rr(-11, -12, 22, 4, 1); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 5, -17, 1.4, 0, 7); ctx.fill(); }
  const g = ctx.createLinearGradient(-11, 0, 11, 0); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.3, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = 'rgba(230,240,245,0.35)'; rr(-11, -8, 22, 28, 4); ctx.fill(); // 玻璃
  ctx.fillStyle = body; rr(-10, -1, 20, 20, 3); ctx.fill(); // 粉
  ctx.fillStyle = g; rr(-11, -8, 22, 28, 4); ctx.fill();
  ctx.fillStyle = '#fff8e7'; ctx.fillRect(-10, 4, 20, 8); ctx.fillStyle = cap; ctx.font = `bold 7px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(LANG === 'en' ? '' : label.slice(0, id === 'spicy' ? 2 : 3), 0, 8.5);
  }
  ctx.restore();
  if (!jar) {
    text(label.split(' ')[0], x + 54, y + 20, 11, en ? '#fff8e7' : '#9a8f86', 'center');
    text(label.split(' ')[1] || '', x + 54, y + 38, 11, '#ffd59a', 'center', 'normal');
  }
  if (sj) for (let i = 0; i < 2; i++) G.particles.push({ x: cx - 14 + rand(-4, 4), y: cy - 18, vx: rand(-20, 10), vy: rand(30, 70), life: 0.4, c: body });
}

// ---------- 右欄:櫃台客人、起鍋盤、收銀 ----------
function drawRight() {
  panel(976, 292, 296, 420, '');
  const c = G.counter, X = 988;
  if (!G.pay) {
    text(L('起鍋盤', 'Plate'), X, 308, 16, '#ffd59a');
    const en = G.plate.length > 0;
    if (en) btn('dump', X + 190, 292, 78, 28, L('倒掉', 'Dump'), A.dump, { color: '#6b4226', size: 14 });
    const well = plateRect();
    ctx.save();
    if (IMG.plateWell) { ctx.imageSmoothingEnabled = false; ctx.drawImage(IMG.plateWell, well.x, well.y, well.w, well.h); }
    else {
    ctx.fillStyle = '#6e757c'; rr(well.x - 4, well.y - 4, well.w + 8, well.h + 8, 16); ctx.fill();
    ctx.fillStyle = '#c5ccd2'; rr(well.x, well.y, well.w, well.h, 14); ctx.fill();
    const steel = ctx.createLinearGradient(well.x, well.y, well.x, well.y + well.h);
    steel.addColorStop(0, '#eef2f4'); steel.addColorStop(0.45, '#b7c0c6'); steel.addColorStop(1, '#8e989f');
    ctx.fillStyle = steel; ctx.beginPath(); ctx.ellipse(well.x + well.w / 2, well.y + well.h / 2, well.w * 0.42, well.h * 0.38, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(well.x + well.w / 2, well.y + well.h / 2 - 4, well.w * 0.28, well.h * 0.16, 0, 0, 7); ctx.stroke();
    }
    if (has('heatlamp')) {
      const lg = ctx.createRadialGradient(X + 115, well.y + 54, 6, X + 115, well.y + 60, 110);
      lg.addColorStop(0, 'rgba(255,186,70,0.28)'); lg.addColorStop(1, 'rgba(255,186,70,0)');
      ctx.fillStyle = lg; ctx.fillRect(well.x, well.y, well.w, well.h);
    }
    if (!en && !IMG.plateWell) {
      text(L('空盤', 'Empty'), well.x + well.w / 2, well.y + well.h / 2, 14, 'rgba(60,40,20,0.45)', 'center');
    }
    G.plate.forEach((it, i) => {
      const per = 4, sz = 44, bx = X + 10 + (i % per) * 64, by = well.y + 10 + Math.floor(i / per) * 50;
      if (by + sz > well.y + well.h - 4) return;
      const [lab] = doneLabel(it);
      ctx.fillStyle = 'rgba(30,15,6,0.55)'; rr(bx, by, sz + 2, sz + 2, 6); ctx.fill();
      if (it.d >= 100 && IMG.burnt) { const im = IMG.burnt, sc = sz / Math.max(im.width, im.height); ctx.drawImage(im, bx + 1 + sz / 2 - im.width * sc / 2, by + 1 + sz / 2 - im.height * sc / 2, im.width * sc, im.height * sc); }
      else foodIcon(it.key, bx + 1 + sz / 2, by + 1 + sz / 2, sz, it.d >= ITEMS[it.key].lo * 0.6);
      const mx = bx + sz - 2, my = by + 6;
      if (lab === '剛好') checkMark(mx, my, 7);
      else if (lab === '生' || lab === '半生') { ctx.fillStyle = '#4f7fa8'; ctx.beginPath(); ctx.arc(mx, my, 8, 0, 7); ctx.fill(); rawIcon(mx, my, 11); }
      else flameIcon(mx, my, 16, lab === '焦黑');
    });
    ctx.restore();
    ctx.strokeStyle = 'rgba(138,87,51,0.9)'; ctx.lineWidth = 1.5; rr(well.x, well.y, well.w, well.h, 10); ctx.stroke();
    shaker('salt', X, 450, L('椒鹽 免費', 'Salt free'), '#e9dfc8', '#6b5a44', G.season.salt, en);
    shaker('spicy', X + 92, 450, L('辣粉 +$5', 'Chili +$5'), '#c8321f', '#7a1a10', G.season.spicy, en);
    shaker('basil', X + 184, 450, L('九層 +$3', 'Basil +$3'), '#3f8f3a', '#1f4f1c', G.season.basil, en);
    const canBag = c && en && c.atCounter > 0.6;
    btn('bag', X, 508, 272, 46, L('裝袋', 'Bag'), A.bag, { enabled: !!canBag, clickable: en && !!c, size: canBag ? 22 : 15 });
    if (G.bagHint > 0) G.bagHint -= 1 / 60;
    if (c && c.atCounter > 0.5) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(X, 562, 272, 136, 10); ctx.fill();
      text(L('這單', 'Order'), X + 8, 576, 13, '#ffd59a');
      if (c.type !== 'regular') { jarIcon('salt', X + 186, 576, 18, true); jarIcon('spicy', X + 212, 576, 18, c.order.spicy); jarIcon('basil', X + 238, 576, 18, c.order.basil); }
      const need = c.order.items, pk = G.plate.map(q => q.key), ml = mustLeft(c);
      const shown = need.slice(0, 10);
      const step = shown.length > 5 ? 32 : 48;
      const sz = shown.length > 5 ? 24 : 32;
      shown.forEach((k, i) => {
        const j = pk.indexOf(k); if (j >= 0) pk.splice(j, 1);
        const mi = ml.indexOf(k), must = j < 0 && mi >= 0; if (must) ml.splice(mi, 1);
        const cx2 = X + 22 + (i % 5) * step, cy2 = 612 + Math.floor(i / 5) * 40;
        if (j < 0 && !must) ctx.globalAlpha = 0.45;
        iconBadge(k, 1, cx2, cy2, sz, j >= 0 ? 'done' : must ? 'need' : 'self');
        ctx.globalAlpha = 1;
      });
    }
  } else {
    const p = G.pay;
    const paper = { x: X, y: 324, w: 272, h: 140 };
    ctx.save();
    ctx.beginPath(); rr(paper.x, paper.y, paper.w, paper.h, 6); ctx.clip();
    ctx.fillStyle = '#fbf6e9'; ctx.fillRect(paper.x, paper.y, paper.w, paper.h);
    text(L('收據', 'Bill'), X + 10, paper.y + 16, 15, '#7a4b00');
    const LL = billRows(p.lines);
    const lh = LL.length > 5 ? 15 : 18;
    let shown = 0;
    LL.forEach(row => {
      const cy2 = paper.y + 38 + shown * lh;
      if (cy2 > paper.y + paper.h - 28) return;
      shown++;
      if (String(row.key).startsWith('jar:')) jarIcon(row.key.slice(4), X + 16, cy2, lh, true);
      else if (row.item) foodIcon(row.key, X + 16, cy2, lh + 2, true);
      const label = row.item ? `${row.nm} ×${row.n}` : row.nm;
      const sum = row.item ? row.v * row.n : row.v;
      text(oneLine(`${label}  $${row.item ? row.v : sum}`, 150, 12), X + 30, cy2, 12, '#2b1a0e', 'left', 'normal');
      text(`$${sum}`, paper.x + paper.w - 12, cy2, 13, '#2b1a0e', 'right');
    });
    const foot = paper.y + paper.h - 14;
    ctx.fillStyle = '#c9b89a'; ctx.fillRect(X + 8, foot - 12, paper.w - 16, 1);
    const miss = (p.missNames || []).map(x => Array.isArray(x) ? `${NM(x[0])}×${x[1]}` : x).join(L('、', ', '));
    text(miss ? oneLine(L(`少 ${miss}`, `Miss ${miss}`), 140, 11) : (shown < LL.length ? '…' : L('合計', 'Total')), X + 8, foot, 12, miss ? '#c1121f' : '#5a3a00');
    text(`$${p.price}`, paper.x + paper.w - 12, foot, 15, '#5a3a00', 'right');
    ctx.restore();
    ctx.strokeStyle = '#c9b89a'; ctx.lineWidth = 1.5; rr(paper.x, paper.y, paper.w, paper.h, 6); ctx.stroke();
    if (p.offer < p.price) {
      const mid = Math.round((p.offer + p.price) / 2 / 5) * 5;
      btn('payAccept', X, 478, 272, 36, `${L('成交', 'Deal')} $${p.offer}`, A.payAccept, { color: '#2a6f6a', size: 16 });
      btn('payMid', X, 520, 272, 36, `${L('各讓', 'Split')} $${mid}`, A.payMid, { enabled: !p.midTried, color: '#6b4226', size: 16 });
      btn('payInsist', X, 562, 272, 36, `${L('全價', 'Full')} $${p.price}`, A.payInsist, { size: 16 });
      btn('refuse', X, 604, 272, 32, L('不賣', 'No sale'), A.refuse, { color: '#4a4a4a', size: 15 });
    } else btn('payFull', X, 490, 272, 64, `${L('收錢', 'Take')} $${p.price}${p.tip ? ` +$${p.tip}` : ''}`, A.payFull, { color: '#2a6f6a', size: 22 });
  }
}

function drawStation() { G._hint = null; drawLeft(); drawTank(); drawRight(); drawHandAnim(); if (G._hint) G._hint.tgt.forEach(([tx, ty]) => { if (tx > 0) arrowTo(tx, ty); }); }
// v42:客人把鐵盆遞過來(從櫃台客人手上飛到盆位)
function drawHandAnim() {
  const a = G.handAnim; if (!a) return;
  const k = clamp(a.t / 0.6, 0, 1), e = 1 - Math.pow(1 - k, 3);
  const sx = COUNTER_X - 30, sy = 200, tx = 14 + a.bi * 118 + 56, ty = 606;
  const x = sx + (tx - sx) * e, y = sy + (ty - sy) * e - Math.sin(e * Math.PI) * 90, R = 34 + 12 * e;
  ctx.save(); ctx.globalAlpha = k >= 1 ? clamp(1 - (a.t - 0.6) / 0.3, 0, 1) : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 8, R, R * 0.8, 0, 0, 7); ctx.fill();
  if (IMG.steelBowl) { ctx.imageSmoothingEnabled = false; ctx.drawImage(IMG.steelBowl, x - R, y - R * 360 / 440, R * 2, R * 2 * 360 / 440); }
  else {
  const g = ctx.createLinearGradient(x - R, y - R, x + R, y + R); g.addColorStop(0, '#f4f6f8'); g.addColorStop(0.5, '#aab1b9'); g.addColorStop(1, '#6e767e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.86, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#9aa1a9'; ctx.beginPath(); ctx.ellipse(x, y, R - 6, (R - 6) * 0.86, 0, 0, 7); ctx.fill();
  }
  a.keys.forEach((kk, j) => { const an = j / Math.max(1, a.keys.length) * 6.28, im = foodImg(kk, false), s2 = 22 + 6 * e;
    const ix = x + Math.cos(an) * (a.keys.length > 1 ? R * 0.4 : 0), iy = y + Math.sin(an) * (a.keys.length > 1 ? R * 0.32 : 0);
    if (im) { const sc = s2 / Math.max(im.width, im.height); ctx.drawImage(im, ix - im.width * sc / 2, iy - im.height * sc / 2, im.width * sc, im.height * sc); } });
  ctx.restore();
  
}

function bagBlock() {
  if (!G.plate.length) return L('盤子是空的:先撈起炸好的料', 'Plate is empty');
  if (!G.counter) return L('還沒有客人,等客人來再裝袋', 'No guest yet');
  if (G.counter.atCounter <= 0.6) return L('客人還沒走到櫃台', 'Guest not at counter yet');
  return '';
}
// v43:提示 = 圖示序列(seq)+ 短字 + 畫面上的彈跳箭頭(tgt)
// v44:肉類 2 欄大格(112×60),非肉 3 欄小格(74×68)
function caseLayout() {
  const meat = MENU.filter(isMeat), veg = MENU.filter(m => !isMeat(m));
  const top = 332, bot = 640, gap = 8;
  const meatRows = Math.max(1, Math.ceil(meat.length / 2));
  const vegRows = Math.max(1, Math.ceil(veg.length / 2));
  const inner = bot - top - gap;
  const meatH = Math.round(inner * meatRows / (meatRows + vegRows));
  const vegH = inner - meatH;
  return { meat, veg, meatY: top, meatH, vegY: top + meatH + gap, vegH, meatRows, vegRows };
}
function ITEM_RECT(k) {
  const L = caseLayout();
  let i = L.meat.indexOf(k);
  if (i >= 0) {
    const h = Math.max(32, Math.min(68, Math.floor((L.meatH - 4) / L.meatRows) - 4));
    const block = L.meatRows * (h + 4);
    const y0 = L.meatY + Math.max(0, (L.meatH - block) / 2);
    return { x: 18 + (i % 2) * 142, y: y0 + Math.floor(i / 2) * (h + 4), w: 134, h };
  }
  i = L.veg.indexOf(k);
  if (i >= 0) {
    const h = Math.max(30, Math.min(56, Math.floor((L.vegH - 4) / L.vegRows) - 4));
    const block = L.vegRows * (h + 4);
    const y0 = L.vegY + Math.max(0, (L.vegH - block) / 2);
    return { x: 18 + (i % 2) * 142, y: y0 + Math.floor(i / 2) * (h + 4), w: 134, h };
  }
  return null;
}
const ITEM_POS = k => { const r = ITEM_RECT(k) || { x: 16, y: 290, w: 0, h: 0 }; return [r.x + r.w / 2, r.y + r.h / 2]; };
const BOWL_POS = bi => [14 + bi * 118 + 56, 566];
const NET_POS = i => { const r = slotRect(i); return [r.x + r.w / 2, r.y + 6]; };
function hint() {
  if (G.phase !== 'open') return null;
  const c = G.counter, H = (t, seq = [], tgt = []) => ({ t, seq, tgt });
  if (!c) return G.t >= G.dayLen ? H(L('收攤囉!', 'Closing!'), [['text', '🌙']]) : H(L('等客人上門', 'Waiting for guests'), [['text', '🚶'], ['arrow'], ['bowl']]);
  if (G.pay) return G.pay.offer < G.pay.price ? H(L('殺價:成交/讓價/堅持', 'Haggle: accept / half / insist'), [['text', '🤏'], ['coin']], [[1149, 510]]) : H(L('收錢', 'Take the money'), [['coin']], [[1149, 516]]);
  if (c.atCounter > 0.6 && shortItems(c).length) return H(L('料不夠:換單或請離開', 'Out of stock: swap or send away'), shortItems(c).map(k => ['food', k, 'short']));
  if (c.sus && c.atCounter > 1) return H(L('自備料怪怪的?', 'Suspicious BYO?'), [['food', 'byo', 'self'], ['text', '🚨?']]);
  if (!c.handed) return c.waitBowl ? H(L('先把盆下鍋', 'Pour a bowl first'), [['bowl'], ['arrow'], ['net']], [BOWL_POS(G.bowls.findIndex(b => b.items.length))]) : H('', [['text', '🚶'], ['arrow'], ['bowl']]);
  { const ml = fillableLeft(c); if (ml.length && !G.plate.length) return H(L('點橘框的料加進盆', 'Tap orange items to add'), countEnts(ml, 'need').map(e => ['food', e[0], 'need', e[1]]).concat([['arrow'], ['bowl']]), [ITEM_POS(ml[0])]); }
  if (G.plate.length) return H(L('撒粉 → 裝袋', 'Season → bag'), [['jar', 'salt'], ['jar', 'spicy'], ['jar', 'basil'], ['arrow'], ['bag']], [[1149, 410], [1149, 522]]);
  const rd = G.fryer.findIndex((n, j) => n.length && G.baskets[j].inOil && netReady(n)), pr = G.bowls.findIndex(b => b.items.length);
  if (rd >= 0) return H(L(`撈 ${rd + 1} 號網(空白鍵)`, `Lift basket ${rd + 1} (Space)`), [['check'], ['net'], ['text', '⬆'], ['text', '🍽']], [NET_POS(rd)]);
  if (pr >= 0) return H(L('點鐵盆下鍋(V)', 'Tap bowl to pour (V)'), [['bowl'], ['arrow'], ['net']], [BOWL_POS(pr)]);
  if (fried().length) return H(L('等綠色再撈', 'Lift when green'), [['raw'], ['arrow'], ['check'], ['text', '⬆']]);
  return H(L('點鐵盆下鍋(V)', 'Tap bowl to pour (V)'), [['bowl'], ['arrow'], ['net']]);
}
function drawHint(h, x, cy) {
  let xx = x; const S = 22;
  h.seq.forEach(e => { const [k, a, b, n] = e;
    if (k === 'text') { text(a, xx + S / 2, cy, 17, '#fff', 'center'); xx += S + 4; }
    else if (k === 'arrow') { arrowSmall(xx, cy, 20); xx += 24; }
    else if (k === 'bowl') { bowlIcon(xx + S / 2, cy, S); xx += S + 4; }
    else if (k === 'net') { netIcon(xx + S / 2, cy, S); xx += S + 4; }
    else if (k === 'bag') { bagIcon(xx + S / 2, cy, S + 4); xx += S + 4; }
    else if (k === 'coin') { coinIcon(xx + S / 2, cy, S - 2); xx += S + 4; }
    else if (k === 'jar') { jarIcon(a, xx + S / 2, cy, S + 2, true); xx += S; }
    else if (k === 'check') { checkMark(xx + S / 2, cy, 9); xx += S; }
    else if (k === 'raw') { ctx.fillStyle = '#4f7fa8'; ctx.beginPath(); ctx.arc(xx + S / 2, cy, 10, 0, 7); ctx.fill(); rawIcon(xx + S / 2, cy, 13); xx += S + 2; }
    else if (k === 'food') { iconBadge(a, n || 1, xx + S / 2 + 2, cy, S, b); xx += S + 8 + (n > 1 ? 8 : 0); } });
  if (h.t) text(h.t, xx + 10, cy, 14, '#ffe8a3', 'left', 'normal');
  h.tgt.forEach(([tx, ty]) => { if (tx > 0) arrowTo(tx, ty); });
}

function drawRail() {
  const list = (G.counter ? [G.counter] : []).concat(G.queue || []);
  if (!list.length) {
    text(L('客人會站上來，下面是想吃的', 'Guests stand up top. Order underneath.'), 640, 120, 16, '#f3e6d0', 'center', 'normal');
    return;
  }
  const now = performance.now() / 1000;
  list.slice(0, 3).forEach((c, i) => {
    const g = cardGeom(i);
    const born = c.railBorn ?? (c.railBorn = now);
    const x = g.x, y = g.y, w = g.w, h = g.h;
    const foodH = bustSlot().foodH, bust = bustSlot();
    const ratio = clamp(c.patience / c.max, 0, 1), atC = c === G.counter;
    const col = ratio > 0.5 ? '#2f6b3a' : ratio > 0.25 ? '#a86b12' : '#9a2b2b';
    const home = g.x + g.w / 2;
    ctx.fillStyle = '#fffaf4';
    if (IMG.orderSlip) { ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(IMG.orderSlip, x, y + h - foodH, w, foodH); ctx.restore(); }
    else { rr(x, y + h - foodH, w, foodH, 4); ctx.fill(); }
    ctx.strokeStyle = atC ? '#c8962e' : '#2b1a0e'; ctx.lineWidth = atC ? 3 : 1.5;
    rr(x, y + h - foodH, w, foodH, 4); ctx.stroke();
    const px = (c.hold > 0 ? -160 : (c.x == null ? -160 : c.x));
    drawBust(c, px - bust.w / 2, bust.y, bust.w, bust.h);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + 10, y + h - foodH - 4, w - 20, 3);
    ctx.fillStyle = col;
    ctx.fillRect(x + 10, y + h - foodH - 4, (w - 20) * ratio, 3);
    ctx.fillStyle = ['#c8962e', '#1d7a6e', '#6d4ea0'][i] || '#5c636a';
    ctx.fillRect(x + 2, y + h - foodH + 3, 4, foodH - 6);
    const short = shortItems(c);
    const stuck = atC && short.length && !orderHeld(c) && !fillableLeft(c).length;
    const fy = y + h - foodH / 2;
    if (stuck) {
      btn('swapOrder', x + 6, y + h - foodH + 4, 114, 22, L('換單', 'Swap'), A.swapOrder, { enabled: !c.swapped, color: '#2a6f6a', size: 12 });
      btn('sendAway', x + 126, y + h - foodH + 4, 116, 22, L('請離開', 'Send off'), A.sendAway, { color: '#4a4a4a', size: 12 });
    } else if (c.type === 'regular' && !c.swapped && !c.handed && !short.length) {
      text(L('看黃紙', 'Yellow note'), x + 12, fy, 16, '#7a4b00');
    } else {
      const ml = c.handed ? countBy(mustLeft(c)) : {};
      const addSrc = c.handed ? (c.need || []) : (c.order.add || []).concat(c.order.items.filter(k => ITEMS[k].vendor && !(c.order.add || []).includes(k)));
      const addC = countBy(addSrc);
      const ents = []; const pc = countBy(c.order.items);
      const paying = !!(G.pay && atC);
      const servedN = {};
      if (paying) (G.pay.lines || []).forEach(([, , key]) => { if (ITEMS[key]) servedN[key] = (servedN[key] || 0) + 1; });
      Object.keys(pc).forEach(kk => {
        if (paying) {
          const got = Math.min(pc[kk], servedN[kk] || 0);
          const miss = pc[kk] - got;
          if (got) ents.push([kk, got, 'done']);
          if (miss) ents.push([kk, miss, 'short']);
          return;
        }
        const a = Math.min(pc[kk], addC[kk] || 0), sp = pc[kk] - a;
        if (sp) ents.push([kk, sp, short.includes(kk) ? 'short' : 'self']);
        if (a) ents.push([kk, a, short.includes(kk) ? 'short' : (ml[kk] ? 'need' : (c.handed ? 'done' : 'need'))]);
      });
      let s2 = 26;
      const tot = sz => ents.reduce((t, e) => t + sz + (e[1] > 1 ? sz * 0.3 : 0) + 4, 0);
      while (s2 > 16 && tot(s2) > w - 52) s2 -= 2;
      const used = Math.min(tot(s2), w - 52);
      iconRow(ents, x + 8, fy, s2, 4, w - 48);
    }
    if (!stuck && c.type !== 'regular') { jarIcon('spicy', x + w - 28, fy, 14, c.order.spicy); jarIcon('basil', x + w - 12, fy, 14, c.order.basil); }
    if (atC && !stuck && stockBlocked(c).length) btn('sellShort', x + w - 70, y + h - foodH + 4, 60, 20, L('照賣', 'Serve'), A.sellShort, { color: '#6b4226', size: 11 });
    else if (atC && !stuck && (c.type === 'byo' || c.sus)) btn('report', x + w - 70, y + h - foodH + 4, 60, 20, L('檢舉', 'Report'), A.report, { color: '#3b5b92', size: 11 });
    if (canFryTicket(c) && !atC) text(L('可下鍋', 'Fry'), x + 8, y + h - 10, 11, '#8a5a10');
  });
  if (list.length > 3) text(`+${list.length - 3}`, cardGeom(2).x + cardGeom(2).w + 10, 70, 13, '#ffd166');
}

function drawBuyMeter(x, y, w) {
  const p = clamp(Math.max(0, G.cash) / STALL_PRICE, 0, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.1)'; rr(x, y, w, 10, 5); ctx.fill();
  if (p > 0) { ctx.fillStyle = p >= 1 ? '#7dcea0' : '#e07a1f'; rr(x, y, Math.max(8, w * p), 10, 5); ctx.fill(); }
}
function infoBar(y) {
  const gap = Math.max(0, STALL_PRICE - Math.round(G.cash));
  const buyLabel = gap ? L(`買斷還差 $${gap}`, `Buyout $${gap} short`) : (G.phase === 'stock' ? L('收攤扣完房租才能買', 'Buy after this week’s rent') : L(`買斷 $${STALL_PRICE}，可以買了`, `Buyout $${STALL_PRICE} ready`));
  text(L(`現金 $${Math.round(G.cash)}`, `Cash $${Math.round(G.cash)}`), 60, y, 22, '#ffd166');
  text(L(`本週房租 $${G.rent}`, `This week $${G.rent}`), 260, y, 18, '#ffd59a');
  text(buyLabel, 500, y, 16, (gap || G.phase === 'stock') ? '#e7d7c3' : '#b7f5c5');
  if (G.debt) text(L(`欠 $${G.debt}，再付不出就收回`, `Owe $${G.debt}. Miss again and it's gone`), 860, y, 15, '#ff6b6b');
  else text(L(`口碑 ${Math.round(G.rep)}`, `Rep ${Math.round(G.rep)}`), 900, y, 18, '#ccc');
}

function drawTitle(time) {
  drawBackground(time, 'stall_front');
  ctx.fillStyle = 'rgba(10,5,3,0.82)'; rr(260, 108, 760, 340, 16); ctx.fill();
  ctx.shadowColor = '#ff5a36'; ctx.shadowBlur = 24; text(L('夜市攤位 · 鹽酥雞攤', 'Night market · fry stall'), 640, 156, 36, '#ffcf6b', 'center'); ctx.shadowBlur = 0;
  text(L(`本金 $${START_CASH}　買斷 $${STALL_PRICE}`, `Start $${START_CASH}    Buyout $${STALL_PRICE}`), 640, 206, 18, '#ffd59a', 'center', 'normal');
  text(L('攤位不是你的。每週收攤扣房租，連續兩週付不出就收回。', "The stall isn't yours. Rent comes out every week. Miss two and it's gone."), 640, 248, 16, '#f3e6d0', 'center', 'normal');
  text(L('第一週：把單補滿，下鍋，金黃就撈，撒鹽，收錢。', 'Week one: fill the ticket, fry, lift at gold, salt, take the cash.'), 640, 280, 16, '#ffd166', 'center', 'normal');
  const sv = loadSave(true);
  if (sv) { btn('continue', 340, 330, 250, 52, L(`繼續第 ${sv.night} 週`, `Continue week ${sv.night}`), A.cont, { size: 20 }); btn('newRun', 640, 330, 250, 52, L('重新開始', 'New game'), A.newRun, { size: 18, color: '#6b4226' });
    text(L(`存檔：現金 $${Math.round(sv.cash)}${sv.debt ? ` · 欠 $${sv.debt}` : ''} · 升級 ${sv.upgrades.length} 項`, `Save: $${Math.round(sv.cash)} cash${sv.debt ? ` · owe $${sv.debt}` : ''} · ${sv.upgrades.length} upgrades`), 640, 410, 14, '#bbb', 'center', 'normal'); }
  else btn('start', 470, 330, 340, 64, L('開始進貨', 'Buy stock'), A.start, { size: 26, pulse: true });
}

function drawNewsCard(time) {
  drawBackground(time, 'stall_front');
  ctx.fillStyle = 'rgba(6,3,2,0.62)'; ctx.fillRect(0, 0, W, H);
  const nt = noticeNow();
  const src = newsSource(nt);
  const tone = nt.tone || 'neutral';
  const col = tone === 'good' ? '#2c6b4a' : tone === 'bad' ? '#8a3030' : '#8a5a12';
  const x = 210, y = 78, w = 860, h = 520;
  ctx.fillStyle = '#f6ecd4'; rr(x, y, w, h, 18); ctx.fill();
  ctx.strokeStyle = '#4a2c18'; ctx.lineWidth = 8; rr(x, y, w, h, 18); ctx.stroke();
  ctx.fillStyle = col; rr(x + 22, y + 20, w - 44, 48, 8); ctx.fill();
  text(L('來源', 'Source'), x + 40, y + 44, 13, '#fff8e8', 'left', 'normal');
  text(L(src.zh, src.en), x + w / 2, y + 44, 22, '#fff8e8', 'center');
  text(L(src.via, src.viaEn), x + w - 40, y + 44, 14, '#fff8e8', 'right', 'normal');
  const im = IMG['news_' + nt.id];
  const ix = x + 36, iy = y + 88, iw = 360, ih = 250;
  ctx.save(); rr(ix, iy, iw, ih, 10); ctx.clip();
  if (im) ctx.drawImage(im, ix, iy, iw, ih); else { ctx.fillStyle = '#e4d2b0'; ctx.fillRect(ix, iy, iw, ih); }
  ctx.restore();
  ctx.strokeStyle = '#4a2c18'; ctx.lineWidth = 2; rr(ix, iy, iw, ih, 10); ctx.stroke();
  text(L(nt.zh, nt.en), x + 420, y + 112, 26, '#3a2416', 'left');
  text(L(`來自${src.zh}`, `From ${src.en}`), x + 420, y + 146, 14, col, 'left', 'normal');
  wrap(L(nt.blurb || nt.line, nt.blurbEn || nt.enLine), x + 420, y + 176, 400, 16, '#4a3424', 26);
  ctx.fillStyle = 'rgba(74,44,24,0.08)'; rr(x + 28, y + 360, w - 56, 72, 10); ctx.fill();
  text(L('本週效果', 'This week'), x + 48, y + 382, 13, col, 'left', 'normal');
  text(oneLine(effectLine(nt), w - 100, 16), x + 48, y + 410, 16, '#3a2416', 'left');
  if (nt.id === 'protect' && !G.protectChoice) {
    btn('payProtect', x + 80, y + h - 68, 320, 48, L(`付錢 $${protectFee()}`, `Pay $${protectFee()}`), A.payProtect, { size: 18, color: '#8a3030' });
    btn('refuseProtect', x + 440, y + h - 68, 320, 48, L('不付，收攤再算', 'Refuse'), A.refuseProtect, { size: 18, color: '#6b4226' });
  } else btn('readNews', x + w / 2 - 140, y + h - 68, 280, 48, L('收起，去進貨', 'Put it away'), A.readNews, { size: 20, color: col });
}

function drawStock(time) {
  if (!G.newsRead) { drawNewsCard(time); return; }
  drawBackground(time, 'bg_mid');
  wood(30, 20, 1220, 680);
  text(L(`第 ${G.night} 週 · 開攤前進貨`, `Week ${G.night} · stock up`), 60, 48, 28, '#ffcf6b');
  drawBuyMeter(720, 34, 220);
  text(L(`$${Math.round(G.cash)} / $${STALL_PRICE}`, `$${Math.round(G.cash)} / $${STALL_PRICE}`), 960, 42, 14, '#ffd59a', 'left', 'normal');
  const nt = noticeNow();
  const src = newsSource(nt);
  const nim = IMG['news_' + nt.id];
  if (nim) { ctx.save(); rr(56, 66, 52, 38, 4); ctx.clip(); ctx.drawImage(nim, 56, 66, 52, 38); ctx.restore(); ctx.strokeStyle = '#6b3a1f'; ctx.lineWidth = 1; rr(56, 66, 52, 38, 4); ctx.stroke(); }
  text(L(`${src.zh} · ${nt.zh}`, `${src.en} · ${nt.en}`), 118, 76, 15, '#ffcf6b');
  text(oneLine(effectLine(nt), 420, 13), 118, 96, 13, '#fff4df', 'left', 'normal');
  const enR = (typeof RUMOR_EN !== 'undefined' && RUMOR_EN[G.rumorId]) || G.rumor;
  text(oneLine(L(`耳語：${G.rumor}`, `Rumor: ${enR}`), 620, 12), 560, 96, 12, '#c9b59a', 'left', 'normal');
  infoBar(118);
  const hd = LANG === 'en' ? ['Item', 'Batch', 'Cost', 'Price', 'Keep', 'Fresh / old', '', 'Bought'] : ['食材', '一批', '進價/批', '售價/份', '保存', '庫存(新鮮/上週)', '', '本週進了'];
  const cx = [60, 300, 390, 500, 600, 700, 900, 1080];
  const keep = days => days >= 2 ? L(`保存 ${days} 週`, `keeps ${days} wk`) : L('當週用掉', 'this week');
  if (MENU.length <= 7) hd.forEach((h, i) => text(h, cx[i], 142, 14, '#bba'));
  else text(L('新料逐晚解鎖 · 橘=肉（大網） 綠=菜（小網）', 'New items unlock nightly · orange = meat (big net)  green = veg (small net)'), 60, 142, 14, '#bba', 'left', 'normal');
  MENU.forEach((k, r) => {
    const I = ITEMS[k], st = STOCK[k], v = G.inv[k], meat = isMeat(k);
    if (MENU.length > 7) {
      const col = r < Math.ceil(MENU.length / 2) ? 0 : 1, rr2 = col ? r - Math.ceil(MENU.length / 2) : r, X = 46 + col * 600, y = 178 + rr2 * 48;
      ctx.fillStyle = meat ? 'rgba(224,122,31,0.16)' : 'rgba(58,154,74,0.14)'; rr(X, y - 23, 588, 46, 8); ctx.fill();
      if (k === G.deal) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; rr(X, y - 23, 588, 46, 8); ctx.stroke(); }
      const fim = foodImg(k, false); if (fim) blitFood(fim, X + 6, y - 20, 40, 40, true); catBadge(X + 44, y - 14, 7, meat);
      text(NM(k), X + 56, y - 7, LANG === 'en' ? 14 : 17); text(`$${batchCost(k)}/${batchQty(k)}${costTag(k)} · ${L('售', 'sell')} $${salePrice(k)}`, X + 56, y + 12, 12, k === G.deal || k === G.glut ? '#b7f5c5' : (G.notice === 'spike' && meat ? '#ffb4a2' : '#ffd166'), 'left', 'normal');
      const days = has('fridge') ? 2 : st.days; text(keep(days), X + 250, y, 14, days >= 2 ? '#b7e4c7' : '#ff9f80');
      text(`${v.fresh} / ${v.old}`, X + 320, y, 17, v.fresh + v.old ? '#fff' : '#ff6b6b');
      btn('unbuy_' + k, X + 390, y - 18, 50, 36, '−', () => A.buy(k, -1), { enabled: !!G.buyLog[k], color: '#6b4226', size: 20 });
      if (k === G.ban) text(L('本週缺', 'none'), X + 470, y, 14, '#ff8b8b');
      else btn('buy_' + k, X + 446, y - 18, 80, 36, `+${batchQty(k)}`, () => A.buy(k, 1), { enabled: G.cash >= batchCost(k), color: '#2a6f6a', size: 16 });
      text(G.buyLog[k] ? `${G.buyLog[k]}` : '—', X + 556, y, 16, '#ffd166', 'center');
      return; }
    const y = 180 + r * 54;
    ctx.fillStyle = r % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)'; rr(46, y - 25, 1188, 52, 8); ctx.fill();
    if (k === G.deal) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; rr(46, y - 25, 1188, 52, 8); ctx.stroke(); }
    const fim = foodImg(k, false); if (fim) blitFood(fim, 58, y - 22, 44, 44, true);
    text(NM(k), 116, y, 20); if (I.vendor) text(L('攤家', 'House'), 116, y + 18, 11, '#ff9f80', 'left', 'normal');
    text(L(`${batchQty(k)} 份`, `×${batchQty(k)}`), cx[1], y, 17); text(`$${batchCost(k)}${costTag(k)}`, cx[2], y, 17, k === G.deal || k === G.glut ? '#b7f5c5' : (G.notice === 'spike' && meat ? '#ffb4a2' : '#ffd166')); text(`$${salePrice(k)}`, cx[3], y, 17, '#b7e4c7');
    const days = has('fridge') ? 2 : st.days; text(keep(days), cx[4], y, 17, days >= 2 ? '#b7e4c7' : '#ff9f80');
    text(`${v.fresh} / ${v.old}`, cx[5], y, 20, v.fresh + v.old ? '#fff' : '#ff6b6b');
    if (v.old && !has('fridge')) text(L('上週料滿意度 -8', 'Last week’s stock, mood −8'), cx[5] + 70, y, 12, '#ffb703', 'left', 'normal');
    btn('unbuy_' + k, cx[6], y - 20, 60, 40, '−', () => A.buy(k, -1), { enabled: !!G.buyLog[k], color: '#6b4226', size: 22 });
    if (k === G.ban) text(L('本週缺', 'none'), cx[6] + 120, y, 16, '#ff8b8b');
    else btn('buy_' + k, cx[6] + 70, y - 20, 100, 40, `+${batchQty(k)}`, () => A.buy(k, 1), { enabled: G.cash >= batchCost(k), color: '#2a6f6a', size: 18 });
    text(G.buyLog[k] ? L(`${G.buyLog[k]} 批`, `${G.buyLog[k]}`) : '—', cx[7], y, 18, '#ffd166');
  });
  const est = G.schedule.length;
  const tot = MENU.reduce((a, k) => a + G.inv[k].fresh + G.inv[k].old, 0);
  text(L(`本週 ${est} 位（口碑 ${Math.round(G.rep)}，越高人越多）。備料 ${tot} 份。沒人了就收攤。`, `This week ${est} guests (rep ${Math.round(G.rep)}: higher brings more). ${tot} portions. An empty stall closes.`), 60, 578, 16, '#f3e6d0', 'left', 'normal');
  text(oneLine(priceTrend(), 1160, 14), 60, 552, 14, '#ffd59a', 'left', 'normal');
  text(L('營業中某種料賣完，可點紅字「補」叫表弟送一次，比批發貴。', 'If something sells out mid-shift, tap the red + once. Cousin charges more than wholesale.'), 60, 606, 14, '#bba', 'left', 'normal');
  btn('open', 980, 632, 240, 56, L('開攤', 'Open'), A.open, { size: 24 });
}

function drawShop(time) {
  drawBackground(time, 'shop_upgrade');
  wood(30, 20, 1220, 680);
  text(L('阿伯的二手設備店', "Uncle's used-gear shop"), 60, 52, 28, '#ffcf6b');
  text(L(`每週最多 ${MAX_UPGRADES_PER_NIGHT} 項 · 本週已買 ${G.boughtTonight}`, `Max ${MAX_UPGRADES_PER_NIGHT} a week · bought ${G.boughtTonight}`), 1220, 52, 15, '#ffd59a', 'right');
  infoBar(96);
  text(oneLine(L(`下週房租 $${weekRent(G.night + 1)}${G.debt ? ` + 還欠款 $${Math.round(G.debt * 1.2)}` : ''}。二手價跟買斷價都不漲。`, `Next week's rent $${weekRent(G.night + 1)}${G.debt ? ` + debt $${Math.round(G.debt * 1.2)}` : ''}. Used gear and the buyout do not inflate.`), 1100, 15), 60, 128, 15, '#ff9f80', 'left', 'normal');
  const owned = (G.boons || []).map(id => { const b = boonBy(id); return b ? L(b.zh, b.en) : id; });
  if (owned.length) text(oneLine(L(`這局機緣：${owned.join('、')}`, `This run: ${owned.join(', ')}`), 1100, 13), 60, 148, 13, '#b7f5c5', 'left', 'normal');
  UPGRADES.forEach((u, i) => {
    const x = 48 + (i % 3) * 400, y = 168 + Math.floor(i / 3) * 148, own = has(u.id);
    ctx.fillStyle = own ? 'rgba(6,214,160,0.12)' : 'rgba(255,255,255,0.07)'; rr(x, y, 384, 136, 10); ctx.fill();
    const ui = IMG['upg_' + u.id], ix = ui ? 78 : 16; if (ui) { const sc = 64 / Math.max(ui.width, ui.height); ctx.drawImage(ui, x + 40 - ui.width * sc / 2, y + 48 - ui.height * sc / 2, ui.width * sc, ui.height * sc); }
    text(L(u.name, u.en || u.name), x + ix, y + 28, 18, own ? '#06d6a0' : '#fff');
    wrap(L(u.desc, u.descEn || u.desc), x + ix, y + 58, 290, 13, '#ddd', 18);
    if (own) text(L('已裝上', 'Installed'), x + 360, y + 110, 14, '#06d6a0', 'right');
    else btn('up_' + u.id, x + 230, y + 88, 140, 36, `$${u.price}`, () => A.buyUpgrade(u.id), { enabled: G.cash >= u.price && G.boughtTonight < MAX_UPGRADES_PER_NIGHT, color: '#2a6f6a', size: 16 });
  });
  btn('nextNight', 980, 630, 240, 56, L(`再撐一週 → 進貨`, `Another week → stock`), A.nextNight, { size: 18 });
  if (G.cash >= STALL_PRICE) btn('buyStall', 700, 630, 260, 56, L(`買下攤位 $${STALL_PRICE}`, `Buy stall $${STALL_PRICE}`), A.buyStall, { size: 18, color: '#8a5a10' });
  else text(L(`買斷還差 $${Math.max(0, STALL_PRICE - Math.round(G.cash))}`, `$${Math.max(0, STALL_PRICE - Math.round(G.cash))} short of the buyout`), 48, 662, 16, '#ffd59a', 'left', 'normal');
}

function drawResults(time) {
  drawBackground(time, 'night_summary');
  wood(120, 40, 1040, 650);
  const s = G.stats;
  text(L(`第 ${G.night} 週 收攤`, `Week ${G.night} close`), 640, 80, 34, '#ffcf6b', 'center');
  drawBuyMeter(430, 98, 420);
  const thN = THEMES[G.theme] || THEMES.fair;
  const nt = noticeNow();
  const head = nt.id === 'quiet'
    ? `${L(thN.name, thN.en)} · ${NM(G.special)} +$${specBonus()}`
    : `${L(thN.name, thN.en)} · ${NM(G.special)} +$${specBonus()} · ${L(nt.zh, nt.en)}`;
  text(oneLine(head, 760, 15), 640, 126, 15, '#ffd59a', 'center', 'normal');
  const rentLab = L(`本週房租${s.due > G.rent ? '＋欠款' : ''}（$${s.due}）`, `Week's rent${s.due > G.rent ? ' + debt' : ''} ($${s.due})`);
  const rows = [[L('營收', 'Sales'), s.revenue, '#fff'], [L('小費', 'Tips'), s.tips, '#fff'], [L('獎勵', 'Rewards'), s.rewards, '#06d6a0'], [L('罰款', 'Fines'), -s.fines, '#ff6b6b'], [L('開攤前進貨', 'Stock'), -s.buy, '#ff9f80'], [L('換油', 'Oil'), -s.cost, '#ff9f80'], [rentLab, -s.paid, '#ff9f80']];
  rows.forEach(([k, v, col], i) => { const n = Math.round(v); const neg = n < 0; text(k, 170, 150 + i * 30, 17, '#e8dcc8', 'left', 'normal'); text(n === 0 ? '$0' : `${neg ? '−' : '+'}$${Math.abs(n)}`, 560, 150 + i * 30, 17, col, 'right'); });
  ctx.fillStyle = '#8a5733'; ctx.fillRect(170, 364, 390, 2);
  text(L('本週淨變化', 'Net this week'), 170, 388, 22, '#ffcf6b'); text(`${s.net >= 0 ? '+' : '−'}$${Math.abs(Math.round(s.net))}`, 560, 388, 26, s.net >= 0 ? '#ffd166' : '#ff6b6b', 'right');
  text(L(`手上現金 $${Math.round(G.cash)}`, `Cash $${Math.round(G.cash)}`), 170, 422, 20, '#fff');
  if (G.debt) text(L(`欠款 $${G.debt}（第 ${G.debtStrikes} 週）`, `Debt $${G.debt} (week ${G.debtStrikes})`), 560, 422, 16, '#ff6b6b', 'right');
  else text(G.cash >= STALL_PRICE ? L('夠付買斷價', 'Buyout ready') : L(`買斷還差 $${STALL_PRICE - Math.round(G.cash)}`, `$${STALL_PRICE - Math.round(G.cash)} to buyout`), 560, 422, 16, G.cash >= STALL_PRICE ? '#b7f5c5' : '#ffd59a', 'right');
  const spoilTxt = (G.spoiledList || []).map(x => Array.isArray(x) ? `${NM(x[0])}×${x[1]}` : x).join(L('、', ', ')) || L('無', 'none');
  text(L(`沒賣完報廢：${spoilTxt}${s.spoil ? `（損失 $${s.spoil}）` : ''}`, `Spoiled: ${spoilTxt}${s.spoil ? ` (−$${s.spoil})` : ''}`), 170, 456, 15, '#ffb703', 'left', 'normal');
  text(L(`鍋裡／盤上浪費 $${s.waste} · 缺貨流失 ${s.oos} 位`, `Wasted in the oil $${s.waste} · ${s.oos} walked, out of stock`), 170, 482, 15, '#aa8877', 'left', 'normal');
  const gradeCol = { S: '#ffd166', A: '#06d6a0', B: '#9ad1ff', C: '#ff6b6b' }[s.grade] || '#fff';
  text(s.grade, 210, 528, 48, gradeCol, 'center');
  const note = {
    happy: L('客人都滿意。下週招牌可以多備一點。', 'Guests left happy. Stock more of the special.'),
    ok: L('大致穩住。下週少炸焦、少讓人走。', 'Steady enough. Burn less and lose fewer next week.'),
    waste: L('客人還行，但報廢太多。下週少進會壞的。', 'Guests were fine. Too much spoiled. Buy less that dies.'),
    lost: L('走掉的人太多。先把單做完。', 'Too many walked. Finish the tickets.'),
    angry: L('滿意度太差。先顧火候和味道。', 'Mood was bad. Watch the fry.'),
    empty: L('這週沒有服務到客人。', 'Nobody was served.'),
  }[s.gradeWhy] || '';
  text(oneLine(note, 390, 15), 250, 512, 15, '#ffd59a', 'left', 'normal');
  const arc = (typeof NIGHT_ARC !== 'undefined') ? NIGHT_ARC[G.night % NIGHT_ARC.length] : null;
  if (arc) text(oneLine(L(arc[0], arc[1]), 420, 13), 250, 540, 13, '#f3e6d0', 'left', 'normal');
  text(L(`服務 ${s.served} · 滿意 ${s.happy} · 生氣 ${s.angry} · 流失 ${s.lost}`, `Served ${s.served} · happy ${s.happy} · angry ${s.angry} · lost ${s.lost}`), 170, 578, 16, '#ccc', 'left', 'normal');
  text(L(`口碑 ${Math.round(G.repStart)} → ${Math.round(G.rep)}`, `Rep ${Math.round(G.repStart)} → ${Math.round(G.rep)}`), 170, 606, 17, G.rep >= G.repStart ? '#06d6a0' : '#ff6b6b');
  text(L('本週紀事', "This week's log"), 640, 150, 19, '#ffd59a');
  G.log.slice(-12).forEach((l, i) => wrap(logText(l), 640, 176 + i * 28, 480, 14, '#ddd', 18));
  if (G.gameOver) {
    const over = G.gameOver === 'rent' ? L('連續兩週付不出房租，房東把攤位收回了。', 'Missed rent two weeks. The landlord took the stall.') : G.gameOver === 'rep' ? L('口碑太差，沒有客人願意上門了。', 'Reputation collapsed. Nobody comes.') : G.gameOver;
    ctx.fillStyle = 'rgba(120,10,10,0.85)'; rr(620, 540, 520, 80, 12); ctx.fill();
    text('GAME OVER', 880, 562, 26, '#fff', 'center'); text(over, 880, 596, 14, '#ffd6d6', 'center', 'normal');
    btn('newRun', 760, 630, 240, 50, L(`重新開始（撐了 ${G.night} 週）`, `New game (${G.night} weeks)`), A.newRun, { size: 16 });
  } else if (G.cash >= STALL_PRICE) {
    btn('buyStall', 640, 628, 280, 52, L(`買下攤位 $${STALL_PRICE}`, `Buy the stall $${STALL_PRICE}`), A.buyStall, { size: 18, color: '#8a5a10' });
    btn('toShop', 940, 628, 180, 52, (G.offer && G.offer.length) ? L('挑機緣', 'Pick a boon') : L('再撐一週', 'One more week'), () => { if (G.offer && G.offer.length) G.phase = 'boon'; else A.toShop(); }, { size: 16 });
  } else btn('toShop', 860, 630, 260, 50, (G.offer && G.offer.length) ? L('挑一張機緣', 'Pick a boon') : L('收攤 → 設備店', 'Close → shop'), () => { if (G.offer && G.offer.length) G.phase = 'boon'; else A.toShop(); }, { size: 20 });
}

function thinnest() {
  let best = '', n = 1e9;
  MENU.forEach(k => {
    if (k === 'byo' || k === G.ban) return;
    const q = stockOf(k);
    if (q < n) { n = q; best = k; }
  });
  return best;
}
function drawFork() {
  const f = (typeof FORKS !== 'undefined' && FORKS.find(x => x.id === G.forkId)) || null;
  if (!f) { G.forkOpen = false; return; }
  ctx.fillStyle = 'rgba(6,3,2,0.72)'; ctx.fillRect(0, 0, W, H);
  const x = 250, y = 150, w = 780, h = 400;
  ctx.fillStyle = '#f6ecd4'; rr(x, y, w, h, 16); ctx.fill();
  ctx.strokeStyle = '#4a2c18'; ctx.lineWidth = 6; rr(x, y, w, h, 16); ctx.stroke();
  text(L('營業中', 'Mid shift'), x + 36, y + 42, 14, '#8a5a12', 'left', 'normal');
  text(L(f.zh, f.en), x + 36, y + 86, 32, '#3a2416');
  wrap(L(f.line, f.lineEn), x + 36, y + 140, w - 72, 20, '#3a2416', 30);
  const item = f.id === 'cousin' ? thinnest() : '';
  const cost = item ? Math.max(1, Math.round(batchCost(item) * 0.8)) : 0;
  const oilC = Math.round(oilPrice() * 0.5);
  let aLab = L('要', 'Yes'), bLab = L('不要', 'No'), aOk = true;
  if (f.id === 'cousin') { aLab = item ? L(`補${NM(item)} $${cost}`, `${NM(item)} $${cost}`) : L('沒得補', 'Nothing to add'); aOk = !!item && G.cash >= cost; bLab = L('讓給別攤', 'Let it go'); }
  else if (f.id === 'dare') { aLab = L('跟他賭', 'Take the bet'); bLab = L('不做這生意', 'No bet'); }
  else if (f.id === 'match') { aLab = L('跟價，多叫兩位', 'Match, two more guests'); bLab = L('不跟，口碑 +1', 'Hold price, rep +1'); }
  else if (f.id === 'oilvan') { aLab = L(`半價換油 $${oilC}`, `Half-price oil $${oilC}`); aOk = G.cash >= oilC; bLab = L('這鍋還能用', 'This oil is fine'); }
  else if (f.id === 'kid') { aLab = L('送一條地瓜', 'Give a yam'); bLab = L('沒有免費的', 'Nothing is free'); }
  btn('forkYes', x + 36, y + h - 84, 340, 52, aLab, A.forkYes, { size: 18, color: '#2c6b4a', enabled: aOk });
  btn('forkNo', x + w - 376, y + h - 84, 340, 52, bLab, A.forkNo, { size: 18, color: '#6b4226' });
}
function drawBoonChips() {
  const ids = G.boons || [];
  if (!ids.length) return;
  ids.slice(0, 4).forEach((id, i) => {
    const b = boonBy(id); if (!b) return;
    const bx = 10 + (i % 2) * 120, by = 46 + Math.floor(i / 2) * 22;
    ctx.fillStyle = 'rgba(12,6,3,0.78)'; rr(bx, by, 114, 18, 4); ctx.fill();
    text(oneLine(L(b.zh, b.en), 104, 11), bx + 57, by + 9, 11, '#ffe8a3', 'center');
  });
}

function drawBoon() {
  drawBackground(0, 'night_summary');
  ctx.fillStyle = 'rgba(8,4,2,0.9)'; ctx.fillRect(0, 0, W, H);
  text(L('機緣', 'A boon'), 640, 48, 32, '#ffcf6b', 'center');
  text(L('選一張。這局結束前都在，不能拿掉。', 'Pick one. It stays until this run ends.'), 640, 84, 16, '#f3e6d0', 'center', 'normal');
  const ids = G.offer || [];
  const n = Math.max(1, ids.length);
  ids.forEach((id, i) => {
    const b = boonBy(id); if (!b) return;
    const w = 360, h = 420, gap = 24;
    const x = (W - (n * w + (n - 1) * gap)) / 2 + i * (w + gap), y = 120;
    const tone = b.tone === 'good' ? '#2c6b4a' : '#8a5a12';
    ctx.fillStyle = '#f6ecd4'; rr(x, y, w, h, 16); ctx.fill();
    ctx.strokeStyle = '#4a2c18'; ctx.lineWidth = 6; rr(x, y, w, h, 16); ctx.stroke();
    ctx.fillStyle = tone; rr(x + 18, y + 18, w - 36, 44, 8); ctx.fill();
    text(L(b.tone === 'good' ? '順' : '有代價', b.tone === 'good' ? 'Clean' : 'It costs'), x + 36, y + 40, 14, '#fff8e8', 'left', 'normal');
    text(L(b.zh, b.en), x + w / 2, y + 110, 28, '#3a2416', 'center');
    text(L('得到', 'You get'), x + 36, y + 170, 14, '#2c6b4a', 'left', 'normal');
    wrap(L(b.up, b.upEn), x + 36, y + 200, w - 72, 18, '#2a3a28', 26);
    text(L('付出', 'You pay'), x + 36, y + 280, 14, '#8a3030', 'left', 'normal');
    wrap(L(b.down || '沒有', b.downEn || 'Nothing'), x + 36, y + 310, w - 72, 18, '#4a2424', 26);
    btn('boon_' + id, x + 40, y + h - 72, w - 80, 48, L('選這張', 'Take this'), () => A.pickBoon(id), { size: 18, color: tone });
  });
  const owned = (G.boons || []).map(id => { const b = boonBy(id); return b ? L(b.zh, b.en) : id; });
  if (owned.length) text(oneLine(L(`已經帶著：${owned.join('、')}`, `Already carrying: ${owned.join(', ')}`), 1100, 15), 640, 680, 15, '#b7f5c5', 'center', 'normal');
}

function drawEnding(time) {
  drawBackground(time, 'stall_front');
  ctx.fillStyle = 'rgba(10,5,3,0.84)'; rr(160, 110, 960, 500, 20); ctx.fill();
  ctx.shadowColor = '#ff5a36'; ctx.shadowBlur = 18;
  text(L('這攤是你的了', 'The stall is yours'), 640, 190, 44, '#ffcf6b', 'center');
  ctx.shadowBlur = 0;
  wrap(L(`$${STALL_PRICE} 交給房東。招牌還掛在夜市，下週起不用再扣房租。`, `$${STALL_PRICE} to the landlord. The sign stays up. No rent from next week.`), 220, 250, 840, 20, '#f3e6d0', 32);
  text(L(`撐了 ${G.night} 週 · 買完還剩 $${Math.round(G.cash)} · 口碑 ${Math.round(G.rep)}`, `${G.night} weeks · $${Math.round(G.cash)} left · rep ${Math.round(G.rep)}`), 640, 360, 18, '#ffd59a', 'center', 'normal');
  const gear = (G.upgrades || []).map(id => { const u = UPGRADES.find(x => x.id === id); return u ? L(u.name, u.en || u.name) : id; }).join(L('、', ', '));
  text(oneLine(gear ? L(`留下的設備：${gear}`, `Gear you kept: ${gear}`) : L('沒有添設備，空手把攤子買下來了。', 'No gear. You bought it bare.'), 860, 16), 640, 400, 16, '#e7d7c3', 'center', 'normal');
  btn('newRun', 500, 500, 280, 56, L('再租一攤', 'Rent another'), A.newRun, { size: 22 });
}

function drawFx() {
  (G.particles || []).forEach(p => {
    ctx.globalAlpha = clamp(p.life, 0, 1) * 0.9;
    ctx.fillStyle = p.c || 'rgba(255,255,255,0.6)';
    if (p.kind === 'rain') {
      ctx.strokeStyle = p.c; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - 6, p.y + 14); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 3, 0, 7); ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
  (G.bills || []).forEach(() => {
    if (drag && drag.type === 'bill') return;
    const b = billAnchor();
    const x = b.x, y = b.y, amt = G.pay ? G.pay.offer + (G.pay.tip || 0) : 0;
    ctx.fillStyle = '#e7f8d8'; rr(x - 50, y - 30, 100, 60, 8); ctx.fill();
    ctx.strokeStyle = '#2f6b3a'; ctx.lineWidth = 2; ctx.stroke();
    text(`$${amt}`, x, y, 22, '#14532d', 'center');
  });
  if (drag) {
    let pv = null;
    if (drag.type === 'item') {
      pv = dropPreview(drag.key, { x: drag.x, y: drag.y });
      if (pv) {
        const g = cardGeom(railCustomers().indexOf(pv.c));
        ctx.save(); ctx.strokeStyle = pv.ok ? '#ff9f1c' : '#d62828'; ctx.lineWidth = 3; ctx.setLineDash([5, 4]);
        rr(g.x - 3, g.y - 3, g.w + 6, g.h + 6, 4); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
      }
    }
    ctx.save();
    const tilt = clamp(((drag.x - (drag.lx == null ? drag.x : drag.lx)) * 0.035), -0.35, 0.35);
    drag.lx = drag.x;
    ctx.translate(drag.x, drag.y); ctx.rotate(tilt); ctx.translate(-drag.x, -drag.y);
    ctx.globalAlpha = 0.94;
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(drag.x + 10, drag.y + 16, 22, 8, 0, 0, 7); ctx.fill();
    if (drag.type === 'item') {
      foodIcon(drag.key, drag.x, drag.y, 68, false);
      if (pv) {
        const i = railCustomers().indexOf(pv.c);
        ctx.globalAlpha = 1; ctx.fillStyle = ['#c8962e', '#1d7a6e', '#6d4ea0'][i] || '#5c636a';
        ctx.beginPath(); ctx.arc(drag.x + 26, drag.y - 26, 12, 0, 7); ctx.fill();
        text(String(i + 1), drag.x + 26, drag.y - 26, 14, '#fff', 'center');
      }
    }
    else if (drag.type === 'ticket') { ctx.fillStyle = '#fbf6e9'; rr(drag.x - 46, drag.y - 30, 92, 60, 6); ctx.fill(); text(L('下鍋', 'Fry'), drag.x, drag.y, 16, '#5a3a12', 'center'); }
    else if (drag.type === 'basket') (G.fryer[drag.i] || []).forEach((it, j) => foodIcon(it.key, drag.x - 16 + j * 20, drag.y, 40, it.d > 30));
    else if (drag.type === 'plate') G.plate.forEach((it, j) => foodIcon(it.key, drag.x - 20 + (j % 4) * 22, drag.y + Math.floor(j / 4) * 22, 34, true));
    else if (drag.type === 'rack' && G.rack[drag.i]) G.rack[drag.i].items.forEach((it, j) => foodIcon(it.key, drag.x + j * 16, drag.y, 30, true));
    else if (drag.type === 'bill' && G.pay) text(`$${G.pay.offer + (G.pay.tip || 0)}`, drag.x, drag.y, 24, '#ffd166', 'center');
    ctx.restore();
  }
  if (G.night === 1 && G.coach && G.stats.served < 3 && G.phase === 'open' && !drag && G.counter && G.counter.handed && !G.pay) {
    const c = G.counter, ml = fillableLeft(c);
    const laterNeed = railCustomers().slice(1).find(q => q.handed && fillableLeft(q).length);
    const laterFry = railCustomers().slice(1).find(q => canFryTicket(q) && !G.fryer.some(n => n.some(it => it.cid === q.id)));
    const mineIn = G.fryer.some(n => n.some(it => it.cid === c.id)) || (G.plate.length && G.plateCid === c.id);
    let a = null, b = null;
    if (ml.length) { a = ITEM_POS(ml[0]); const rc = ticketRect(); b = [rc.x + rc.w / 2, rc.y + rc.h / 2]; }
    else if (!G.fryer.some(n => n.some(it => it.cid === c.id)) && !G.plate.length) { const rc = ticketRect(); a = [rc.x + 40, rc.y + 30]; b = [560, 420]; }
    else if (laterNeed && mineIn) { const g = cardGeom(railCustomers().indexOf(laterNeed)); a = ITEM_POS(mustLeft(laterNeed)[0]); b = [g.x + g.w / 2, g.y + 50]; }
    else if (laterFry && mineIn) { const g = cardGeom(railCustomers().indexOf(laterFry)); a = [g.x + 36, g.y + 40]; b = [560, 420]; }
    else {
      const ri = G.fryer.findIndex((n, j) => n.length && G.baskets[j].inOil && (G.baskets[j].p || 0) >= SH_LO);
      if (ri >= 0) { const r = slotRect(ri); a = [r.x + r.w / 2, r.y + 36]; b = canPlate(G.fryer[ri][0].cid) ? [1140, 350] : [346, 620]; }
      else if (G.plate.length) { a = [1140, 360]; b = [COUNTER_X, 80]; }
    }
    if (a && b) {
      const t = (Math.sin(performance.now() / 480) + 1) / 2;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 28;
      ctx.save(); ctx.globalAlpha = 0.45 + 0.2 * Math.sin(performance.now() / 480);
      if (IMG.hand) ctx.drawImage(IMG.hand, x - 10, y - 4, 54, 54);
      ctx.restore();
    }
  }
}
function drawCursor() {
  if (mouse.x < 0 || mouse.y < 0) return;
  if (drag) return;
  const hot = buttons.some(b => b.enabled && hitR(mouse, b)) || (G.phase === 'open' && !!findDrag(mouse));
  ctx.save();
  ctx.translate(mouse.x, mouse.y);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(2, 3, hot ? 9 : 7, 0, 7); ctx.fill();
  ctx.fillStyle = hot ? '#fff4d2' : '#ffd166';
  ctx.beginPath(); ctx.arc(0, 0, hot ? 8 : 6, 0, 7); ctx.fill();
  ctx.strokeStyle = hot ? '#c0392b' : '#6b3a12'; ctx.lineWidth = 2; ctx.stroke();
  if (!hot) { ctx.strokeStyle = '#fff8e7'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-4, 0); ctx.moveTo(4, 0); ctx.lineTo(11, 0); ctx.moveTo(0, -11); ctx.lineTo(0, -4); ctx.moveTo(0, 4); ctx.lineTo(0, 11); ctx.stroke(); }
  ctx.restore();
}

function drawVol() {
  const S = window.SFX, lv = S ? S.level : 0, lab = !S || S.headless ? L('靜音', 'Mute') : L(['靜音', '小', '中', '大'][lv], ['Mute', 'Low', 'Mid', 'High'][lv]);
  btn('vol', 1200, 6, 74, 32, lab, () => sfx('cycleVolume'), { color: '#3b5b92', size: 13, on: false });
  btn('lang', 1130, 6, 64, 32, LANG === 'en' ? 'EN→中' : '中→EN', () => setLang(LANG === 'en' ? 'zh' : 'en'), { color: '#6b4226', size: 13 });
}
function render(time) {
  buttons = [];
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.save();
  if (G.shake > 0) ctx.translate(rand(-6, 6) * G.shake * 4, rand(-4, 4) * G.shake * 4);
  if (G.phase === 'title') drawTitle(time);
  else if (G.phase === 'ending') drawEnding(time);
  else if (G.phase === 'boon') drawBoon();
  else if (G.phase === 'results') drawResults(time);
  else if (G.phase === 'stock') drawStock(time);
  else if (G.phase === 'shop') drawShop(time);
  else {
    drawScene(time); drawStation(); drawHUD(); drawBoonChips();
    drawFx();
    if (G.theme === 'blackout' && !has('generator')) {
      const flick = Math.sin(performance.now() / 90) > 0.96 ? 0.12 : 0.4;
      ctx.fillStyle = `rgba(2,6,18,${flick})`; ctx.fillRect(0, 40, W, H - 40);
    }
    if (G.forkOpen) drawFork();
  }
  drawVol();
  G.popups.forEach(p => { ctx.globalAlpha = clamp(p.life, 0, 1); text(p.text, p.x, p.y, 24, p.color, 'center'); ctx.globalAlpha = 1; });
  // 暈影
  const vg = ctx.createRadialGradient(640, 360, 300, 640, 360, 800); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  if (G.veil > 0.02) { ctx.fillStyle = `rgba(6,3,1,${G.veil})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
  drawCursor();
  if (window.innerHeight > window.innerWidth + 40) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(8,4,2,0.94)';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#ffcf6b';
    ctx.font = `28px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('請把手機橫過來', cv.width / 2, cv.height / 2);
    ctx.restore();
  }
}

// ---------- 主迴圈 ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000) * SPEED; last = now;
  update(dt); render(now / 1000);
  requestAnimationFrame(frame);
}
newGame();
if (params.has('autostart')) A.start();
// 測試介面
window.__game = { mustLeft: () => mustLeft(G.counter), get state() { return G; }, get buttons() { return buttons.map(({ onClick, ...b }) => b); }, A, ITEMS, SELF_MENU, MENU, nightGrade, billRows, batchQty, guestQuota, step: (dt) => { update(dt); render(performance.now() / 1000); } };
requestAnimationFrame(frame);
})();
