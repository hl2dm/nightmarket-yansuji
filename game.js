// 鹽酥雞攤 MVP — 單一完整一晚
(() => {
'use strict';
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
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
const FONT = '"Noto Sans CJK TC","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

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
function loadImg(k, src) { const im = new Image(); im.onload = () => { IMG[k] = im; }; im.src = src; }
loadImg('bg', 'art/bg_stall.jpg');
['normal','student','regular','aunt','drunk','inspector','byo','inspector_revealed'].forEach(k => loadImg('c_' + k, `art/cust_${k}.png`));
['chicken','tempura','riceblood','bean','mushroom','squid'].forEach(k => loadImg('f_' + k, `art/food_${k}.png`));
loadImg('tankTop', 'art/fryer_top.jpg'); loadImg('basketTop', 'art/basket_top.png');
// v3.2:Grok 像素素材(assets/,由 _tools/cutout.py 去綠幕產生);沒載到就退回上面的舊圖
// v42:雞排改用 cutlet(整片)圖;鹽酥雞沿用原本一塊塊的雞肉圖
// v43:Grok 原圖 food_cutlet_raw 與 food_mushroom_raw 生成成同一張紫色石頭狀圖(雞排生料=杏鮑菇生料),改用 *_raw2(由炸好圖重新上色)
const ART_FILE = { chicken: 'cutlet', saltchicken: 'chicken' };
const RAW_FILE = { chicken: 'cutlet_raw2', mushroom: 'mushroom_raw2', tempura: 'tempura_raw2' };
const FRIED_FILE = { mushroom: 'art/food_mushroom.png' }; // 杏鮑菇炸好用切塊圖,和鹽酥雞塊區隔
[...ALL_MENU, 'byo'].forEach(k => { const f = ART_FILE[k] || k; loadImg('raw_' + k, `assets/food_${RAW_FILE[k] || f + '_raw'}.png`); loadImg('fr_' + k, FRIED_FILE[k] || `assets/food_${f}_fried.png`); });
loadImg('burnt', 'assets/food_burnt.png'); loadImg('bigNet', 'assets/basket_big.png'); loadImg('smallNet', 'assets/basket_small.png');
loadImg('tank2', 'assets/fryer_tank.png'); loadImg('uiCash', 'assets/ui_cash.png'); loadImg('uiRep', 'assets/ui_rep.png');
loadImg('bowl_salt', 'assets/bowl_pepper.png'); loadImg('bowl_spicy', 'assets/bowl_chili.png'); loadImg('bowl_basil', 'assets/food_basil_fried.png'); loadImg('scissorsP', 'assets/scissors.png'); loadImg('bagP', 'assets/food_bag.png'); loadImg('cashTray', 'assets/cash_tray.png');
['stall_front','bg_mid','shop_upgrade','night_summary'].forEach(k => loadImg('sc_' + k, `assets/scene_${k}.jpg`));
['bigNet','smallNet','fridge','filter','neon','fan','bulk'].forEach(k => loadImg('upg_' + k, `assets/upg_${k}.png`));
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
const pulse = (sp = 5) => 0.5 + 0.5 * Math.sin(performance.now() / 1000 * sp);
// 畫一個食材圖示(預設炸好的樣子),等比縮放置中
function foodIcon(k, cx, cy, s, fried = true) {
  const im = foodImg(k, fried); if (!im) { ctx.fillStyle = ITEMS[k].color; ctx.beginPath(); ctx.arc(cx, cy, s / 2.4, 0, 7); ctx.fill(); return; }
  const sc = s / Math.max(im.width, im.height); ctx.drawImage(im, cx - im.width * sc / 2, cy - im.height * sc / 2, im.width * sc, im.height * sc);
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
  if (st === 'need') { const p = pulse(7); ctx.fillStyle = `rgba(255,140,0,${0.35 + 0.35 * p})`; ctx.beginPath(); ctx.arc(cx, cy, s * 0.62 + p * 2, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ff7b00'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, s * 0.62 + p * 2, 0, 7); ctx.stroke(); }
  ctx.save(); if (st === 'short') ctx.globalAlpha = 0.4; foodIcon(k, cx, cy, s); ctx.restore();
  const r = Math.max(5, s * 0.2);
  if (st === 'need') plusMark(cx - s * 0.42, cy - s * 0.42, r);
  if (st === 'done') checkMark(cx + s * 0.42, cy - s * 0.42, r);
  if (st === 'short') crossMark(cx + s * 0.42, cy - s * 0.42, r);
  if (n > 1) { const fs = Math.max(10, s * 0.36); ctx.font = `bold ${fs}px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 3; ctx.strokeStyle = '#1a0d05';
    ctx.strokeText('×' + n, cx + s * 0.6, cy + s * 0.55); ctx.fillStyle = '#fff'; ctx.fillText('×' + n, cx + s * 0.6, cy + s * 0.55); }
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
function bowlIcon(cx, cy, s) { const g = ctx.createRadialGradient(cx - s * 0.1, cy - s * 0.1, 2, cx, cy, s / 2); g.addColorStop(0, '#eef1f4'); g.addColorStop(1, '#6e767e'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, s / 2, s * 0.43, 0, 0, 7); ctx.fill(); }
function netIcon(cx, cy, s) { ctx.strokeStyle = '#c9ced4'; ctx.lineWidth = 2; rr(cx - s / 2, cy - s * 0.35, s, s * 0.7, 4); ctx.stroke(); for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx - s / 2 + s * i / 4, cy - s * 0.35); ctx.lineTo(cx - s / 2 + s * i / 4, cy + s * 0.35); ctx.stroke(); } ctx.fillStyle = 'rgba(201,138,40,0.6)'; rr(cx - s / 2, cy, s, s * 0.35, 4); ctx.fill(); }
function bagIcon(cx, cy, s) { if (IMG.bagP) { const im = IMG.bagP, sc = s / Math.max(im.width, im.height); ctx.drawImage(im, cx - im.width * sc / 2, cy - im.height * sc / 2, im.width * sc, im.height * sc); } else text('🛍', cx, cy, s * 0.8, '#fff', 'center'); }
function coinIcon(cx, cy, s) { ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(cx, cy, s / 2, 0, 7); ctx.fill(); ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 2; ctx.stroke(); text('$', cx, cy + 1, s * 0.6, '#7a4b00', 'center'); }
function arrowSmall(x, cy, w = 18) { ctx.fillStyle = '#ffe8a3'; ctx.beginPath(); ctx.moveTo(x, cy - 3); ctx.lineTo(x + w - 7, cy - 3); ctx.lineTo(x + w - 7, cy - 8); ctx.lineTo(x + w, cy); ctx.lineTo(x + w - 7, cy + 8); ctx.lineTo(x + w - 7, cy + 3); ctx.lineTo(x, cy + 3); ctx.fill(); }

// ---------- 狀態 ----------
let G;
const SAVE_KEY = 'yansuji_save_v2';
function has(u) { return G.upgrades.includes(u); }
function newGame() {
  G = {
    phase: 'title', night: 1, cash: START_CASH, debt: 0, debtStrikes: 0, rep: 60, upgrades: [],
    inv: Object.fromEntries(ALL_MENU.map(k => [k, { fresh: 0, old: 0 }])),
    regularOrder: { items: ['chicken', 'tempura', 'bean'], spicy: true, basil: true },
    best: 0, gameOver: '', boughtTonight: 0, hasSave: !!loadSave(true),
    popups: [], particles: [], shake: 0,
  };
  newNight();
}
function newNight() { refreshMenu(G.night);
  Object.assign(G, {
    t: 0, dayLen: 180, grace: 45, repStart: G.rep, cashStart: G.cash, debtStart: G.debt, endBanner: false, pendingSick: false,
    queue: [], counter: null, walkers: [], baskets: basketLayout(), fryer: null, lastLine: null, fullFlash: 0, plate: [],
    temp: 150, tempKey: 'mid', oilUse: 0, oilChange: 0,
    season: { salt: false, spicy: false, basil: false }, cuts: 0, cutsNeed: 0, // v36: 剪的步驟已移除
    pay: null, schedule: [], nextId: 1, boughtTonight: 0, buyLog: {},
    rumorId: Math.floor(rng() * RUMORS.length),
    stats: { revenue: 0, tips: 0, cost: 0, buy: 0, spoil: 0, waste: 0, fines: 0, rewards: 0, served: 0, lost: 0, happy: 0, angry: 0, oos: 0 },
    log: [], hintT: 0, endReason: '', basket: [], lastServed: [], bowls: [{ items: [], cid: 0 }, { items: [], cid: 0 }], bowlSel: 0,
  });
  G.fryer = G.baskets.map(() => []);
  G.rumor = RUMORS[G.rumorId];
  G.rent = rentFor(G.night);
  buildSchedule();
}
// ---- 存檔 ----
function saveGame() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ night: G.night, cash: G.cash, debt: G.debt, debtStrikes: G.debtStrikes, rep: G.rep, upgrades: G.upgrades, inv: G.inv, regularOrder: G.regularOrder, best: G.best, phase: G.phase === 'shop' ? 'shop' : 'stock' })); } catch (e) {}
}
function loadSave(peek) {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (!d || peek) return d;
    Object.assign(G, { night: d.night, cash: d.cash, debt: d.debt, debtStrikes: d.debtStrikes, rep: d.rep, upgrades: (d.upgrades || []).map(u => u === 'baskets' ? 'bigNet' : u), inv: Object.assign(Object.fromEntries(ALL_MENU.map(k => [k, { fresh: 0, old: 0 }])), d.inv), regularOrder: d.regularOrder, best: d.best || 0 });
    newNight(); G.phase = d.phase === 'shop' ? 'shop' : 'stock'; return d; } catch (e) { return null; }
}
// ---------- 油槽格子(俯視 6×3) ----------
// 固定 9 個網位:大網 2×2 佔上兩排(編號 1–3),小網 1×1 在最下排(編號 4–9)。
// 滿配 3 大 + 6 小 = 12 + 6 = 18 格,正好填滿 6×3。升級只「解鎖」網位,不重排、不改編號。
const GRID = { x: 266, y: 304, cols: 6, rows: 3, cw: 124, ch: 116 };
const STRIP = { y0: 46, y1: 264, base: 256, x1: 700 }, COUNTER_X = 660; // 客人走上前的街景條
function basketLayout() {
  const L = [0, 2, 4].map((c, i) => ({ s: 'L', c, r: 0, locked: i === 2 && !has('bigNet'), up: 'bigNet' }));
  [0, 2, 4].forEach((c, i) => L.push({ s: 'S', c, r: 2, locked: i === 2 && !has('smallNet'), up: 'smallNet' })); // v39:小網 2×1 混炸

  return L;
}
function cellRect(b) { const n = b.s === 'L' ? 2 : 1; return { x: GRID.x + b.c * GRID.cw + 4, y: GRID.y + b.r * GRID.ch + 4, w: 2 * GRID.cw - 8, h: n * GRID.ch - 8 }; }
function slotRect(i) { return cellRect(G.baskets[i]); }
function freeBasket(k) { // v41:只找空的、不在油裡的網
  return G.baskets.findIndex((b, j) => !b.locked && !b.inOil && !G.fryer[j].length && b.s === ITEMS[k].size);
}
const BOWL_CAP = 8;
const bowlItems = () => G.bowls.flatMap(b => b.items);
const fried = () => G.fryer.flat();
// v40:整網共用一個計時。網的熟度 p(0–100):SH_LO–SH_HI 是整網「剛好」區;每份料的 d 由 p 換算到自己的熟度區,所以整網一起熟、一起焦
const SH_LO = 60, SH_HI = 80;
function mapD(P, I) { return P <= SH_LO ? P * I.lo / SH_LO : P <= SH_HI ? I.lo + (P - SH_LO) / (SH_HI - SH_LO) * (I.hi - I.lo) : Math.min(100, I.hi + (P - SH_HI) / (100 - SH_HI) * (100 - I.hi)); }
function netTime(net) { return Math.max(...net.map(it => ITEMS[it.key].time)); } // 以最久的料為準
function netIdeal(net) { return net.reduce((a, it) => a + ITEMS[it.key].ideal, 0) / net.length; }
function netSpeed(net) { return 100 / netTime(net) * clamp(1 + (G.temp - netIdeal(net)) / 35, 0.15, 2.2) * (G.oilUse > OIL_LIMIT ? 1.15 : 1) * 0.95; }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
// ---- 庫存 ----
function stockOf(k) { const v = G.inv[k]; return v ? v.fresh + v.old : 99; }
function availFor(k) { return stockOf(k) + bowlItems().filter(it => it.key === k).length + fried().filter(it => it.key === k).length + G.plate.filter(it => it.key === k).length; }
function shortItems(c) { // 這單有哪些品項庫存+鍋裡+盤上都不夠
  if (!c || c.type === 'byo') return [];
  const need = countBy(c.order.items); return Object.keys(need).filter(k => availFor(k) < need[k]);
}
function unitCost(k) { return Math.round(ITEMS[k].cost * (has('bulk') ? 0.9 : 1) * 100) / 100; }
function batchCost(k) { return Math.round(unitCost(k) * STOCK[k].batch); }

function buildSchedule() {
  // 特殊客人固定出場時間,其餘隨機
  const fixed = [[6, 'normal'], ...NIGHT_SPECIALS[Math.min(G.night, NIGHT_SPECIALS.length) - 1]];
  const busy = (1 + 0.1 * (G.night - 1)) * (has('neon') ? 1.12 : 1);
  const s = fixed.map(([t, type]) => ({ t, type }));
  let t = 10;
  while (t < G.dayLen - 4) {
    const base = t < 60 ? rand(9, 14) : t < 130 ? (G.rumorId === 2 ? rand(5, 8) : rand(6, 10)) : rand(11, 16);
    t += base / busy * (1 - Math.min(0.3, Math.max(0, (G.rep - 50) / 10 * 0.03)));
    if (s.some(x => Math.abs(x.t - t) < 4)) continue;
    s.push({ t, type: rng() < 0.3 ? 'student' : 'normal' });
  }
  s.sort((a, b) => a.t - b.t);
  G.schedule = s;
}

function makeOrder(type) {
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
  items.sort((a, b) => MENU.indexOf(a) - MENU.indexOf(b));
  return { items, add, spicy: rng() < 0.5, basil: rng() < 0.4 };
}

function spawn(type) {
  const ct = CTYPES[type];
  const c = { id: G.nextId++, type, order: makeOrder(type), patience: ct.patience * (has('fan') ? 1.2 : 1), max: ct.patience * (has('fan') ? 1.2 : 1),
    x: 150, tx: 0, atCounter: 0, changed: false, sus: type === 'byo' && rng() < 0.6, revealed: false,
    hue: rand(-15, 15), line: '' };
  const key = type === 'byo' ? (c.sus ? 'byoSus' : 'byo') : LINES[type] ? type : 'greet';
  c.line = pick(LINES[key]);
  if (G.queue.length >= 4) { // 客滿直接走
    G.stats.lost++; changeRep(-1); addLog(`${ct.label}看到隊伍太長,走掉了`); 
    G.walkers.push({ c, x: 40, dir: -1 }); return;
  }
  G.queue.push(c);
}

// ---------- 工具 ----------
function addLog(s) { G.log.push(`[${clockStr()}] ${s}`); }
function popup(text, x, y, color = '#ffd166') { G.popups.push({ text, x, y, color, life: 1.6 }); }
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
  newRun() { clearSave(); const s = seed; newGame(); seed = s; G.phase = 'stock'; },
  cont() { loadSave(); },
  buy(k, n) {
    const c = batchCost(k), v = G.inv[k];
    if (n > 0) { if (G.cash < c) { popup('現金不夠', 640, 360, '#ff6b6b'); return; } if (v.fresh + v.old + STOCK[k].batch > MAX_STOCK) { popup('冰櫃放不下了', 640, 360, '#ff6b6b'); return; }
      G.cash -= c; v.fresh += STOCK[k].batch; G.stats.buy += c; G.buyLog[k] = (G.buyLog[k] || 0) + 1; }
    else { if (!G.buyLog[k] || v.fresh < STOCK[k].batch) return; G.cash += c; v.fresh -= STOCK[k].batch; G.stats.buy -= c; G.buyLog[k]--; }
  },
  open() { G.phase = 'open'; G.t = 0; addLog(`第 ${G.night} 晚開攤!進貨花了 $${G.stats.buy}`); },
  buyUpgrade(id) {
    const u = UPGRADES.find(x => x.id === id);
    if (!u || has(id) || G.cash < u.price || G.boughtTonight >= MAX_UPGRADES_PER_NIGHT) return;
    G.cash -= u.price; G.upgrades.push(id); G.boughtTonight++; if (id === 'neon') changeRep(5);
    popup(`買了 ${u.name}`, 640, 300, '#06d6a0'); saveGame();
  },
  nextNight() { G.night++; newNight(); G.phase = 'stock'; saveGame(); },
  toShop() { G.phase = 'shop'; G.boughtTonight = 0; saveGame(); },
  swapOrder() { const c = G.counter; if (!c || G.pay || c.swapped) return;
    const need = countBy(c.order.items);
    shortItems(c).forEach(k => { let lack = need[k] - availFor(k); for (let i = 0; i < c.order.items.length && lack > 0; i++) if (c.order.items[i] === k) {
      const used = countBy(c.order.items); const ok = MENU.filter(m => m !== k && availFor(m) > (used[m] || 0)); if (!ok.length) break; c.order.items[i] = pick(ok); lack--; } });
    if (shortItems(c).length) { A.sendAway(); return; }
    c.order.items.sort((a, b) => MENU.indexOf(a) - MENU.indexOf(b)); c.order.add = (c.order.add || []).filter(k => c.order.items.includes(k));
    c.swapped = true; c.noTip = true; c.patience -= c.max * 0.3; c.line = '沒有喔…好啦,那換這些。'; addLog('缺貨,跟客人道歉換單'); },
  sendAway() { const c = G.counter; if (!c) return; G.stats.lost++; G.stats.oos++; changeRep(-2); addLog('缺貨,客人沒買就走了(口碑 -2)'); leave(c, '沒有?那不用了。', true); resetPrep(); },
  // v41:點食材 = 撿進鐵盆(不是直接進網)
  drop(k) {
    const cc = G.counter;
    if (cc && !cc.handed && !G.pay) { popup('等客人把鐵盆交給你', 130, 520, '#ffb703'); return; }
    const cid = cc ? cc.id : 0;
    if (cc && cc.handed) { const hb = G.bowls.findIndex(b => b.cid === cid && b.items.length); if (hb >= 0) G.bowlSel = hb; }
    let bi = G.bowlSel; const bw = G.bowls[bi];
    if (bw.items.length && bw.cid !== cid) { const e = G.bowls.findIndex(b => !b.items.length || b.cid === cid); if (e >= 0) bi = e; } // 換了客人 → 用另一個盆
    const B = G.bowls[bi];
    if (B.items.length >= BOWL_CAP) { G.fullFlash = 0.6; popup('鐵盆滿了!先按鐵盆下鍋', 130, 520, '#ff6b6b'); return; }
    let old = false;
    if (G.inv[k]) { const v = G.inv[k]; if (v.old > 0) { v.old--; old = true; } else if (v.fresh > 0) v.fresh--; else { popup(`${ITEMS[k].name} 缺貨!`, 130, 420, '#ff6b6b'); return; } }
    if (!B.items.length) B.cid = cid;
    B.items.push({ key: k, old }); G.bowlSel = bi; sfx('click');
  },
  // v44:鐵盆下鍋 — 自動分類:肉類進大網(雞排一塊一網、其他肉 4 份一網),非肉每 SMALL_CAP 份進一個小網;放不下的留在盆裡
  pour(bi) {
    if (bi === undefined) { bi = G.bowls[G.bowlSel].items.length ? G.bowlSel : G.bowls.findIndex(b => b.items.length); if (bi < 0) return; }
    const B = G.bowls[bi]; if (!B.items.length) { G.bowlSel = bi; return; }
    const oc = G.counter; if (oc && oc.handed && B.cid === oc.id && !G.pay) { const ml = mustLeft(oc); if (ml.length) { G.bowlSel = bi; G.mustFlash = 1; popup(`還要補:${orderText(ml)}`, 300, 470, '#ffb703'); return; } }
    if (G.oilChange > 0) { popup('換油中,等一下', 640, 560, '#ff6b6b'); return; }
    const keep = [], L = B.items.filter(it => ITEMS[it.key].size === 'L'), S = B.items.filter(it => ITEMS[it.key].size !== 'L'), used = [];
    const mk = it => ({ key: it.key, d: 0, cold: 0, age: 0, old: it.old, cid: B.cid, cue: 0 });
    // v44:雞排(solo)一塊一個大網;其他肉類每 MEAT_CAP 份共用一個大網
    const freeL = () => G.baskets.findIndex((b, j) => !b.locked && !b.inOil && !G.fryer[j].length && b.s === 'L');
    L.filter(it => ITEMS[it.key].solo).forEach(it => { const i = freeL(); if (i < 0) { keep.push(it); return; } G.fryer[i] = [mk(it)]; used.push(i); });
    const M = L.filter(it => !ITEMS[it.key].solo);
    while (M.length) { const i = freeL(); if (i < 0) { keep.push(...M); break; } G.fryer[i] = M.splice(0, MEAT_CAP).map((it, j) => Object.assign(mk(it), { slot: j })); used.push(i); }
    while (S.length) { const i = G.baskets.findIndex((b, j) => !b.locked && !b.inOil && !G.fryer[j].length && b.s === 'S'); if (i < 0) { keep.push(...S); break; }
      G.fryer[i] = S.splice(0, SMALL_CAP).map((it, j) => Object.assign(mk(it), { slot: j })); used.push(i); }
    if (!used.length) { G.fullFlash = 0.6; popup('沒有空網!先撈起熟的網', 640, 420, '#ff6b6b'); return; }
    used.forEach(i => A.dunk(i));
    B.items = keep; if (!keep.length) B.cid = 0;
    if (keep.length) popup(`網不夠,盆裡還剩 ${keep.length} 份`, 640, 420, '#ff6b6b');
  },
  clearBowl(bi) { const B = G.bowls[bi]; B.items.forEach(it => { const v = G.inv[it.key]; if (v) it.old ? v.old++ : v.fresh++; }); B.items = []; B.cid = 0; },
  dunk(i) {
    const b = G.baskets[i], net = G.fryer[i]; if (!net || !net.length || b.inOil) return;
    if (G.oilChange > 0) { popup('換油中,等一下', 640, 560, '#ff6b6b'); return; }
    b.inOil = true; b.p = 0; b.cue = 0; sfx('drop');
    G.oilUse += (has('filter') ? 0.6 : 1) * net.length; G.temp -= 3 * Math.min(3, net.length);
    const p = slotRect(i); for (let j = 0; j < 14; j++) G.particles.push({ x: p.x + rand(10, p.w - 10), y: p.y + rand(10, p.h - 10), vx: rand(-10, 10), vy: rand(-60, -20), life: rand(0.4, 0.9), c: 'rgba(255,255,255,0.5)' });
  },
  setTemp(k) { G.tempKey = k; },
  tapNet(i) { if (G.baskets[i].inOil) A.lift(i); },
  lift(i) {
    const net = G.fryer[i]; if (!net || !net.length) return;
    if (!G.baskets[i].inOil) return;
    const good = net.filter(it => it.d < 100), burnt = net.length - good.length;
    if (G.plate.length + good.length > 8) { popup('盤子滿了', 1150, 420, '#ff6b6b'); return; }
    sfx('lift');
    net.filter(it => it.d >= 100).forEach(it => G.stats.waste += ITEMS[it.key].cost);
    if (burnt) popup(`焦掉 ${burnt} 份,丟掉`, 640, 420, '#ff6b6b');
    G.fryer[i] = []; G.baskets[i].inOil = false; G.baskets[i].p = 0; good.forEach(it => G.plate.push(it));
  },
  liftAll() { G.fryer.forEach((net, i) => { if (net.length && G.baskets[i].inOil && netReady(net)) A.lift(i); }); }, // 只撈整網都熟的
  changeOil() {
    if (fried().length || G.oilChange > 0) return;
    if (G.cash < OIL_CHANGE_COST) { popup('現金不夠換油', 640, 560, '#ff6b6b'); return; }
    G.cash -= OIL_CHANGE_COST; G.stats.cost += OIL_CHANGE_COST; G.oilUse = 0; G.oilChange = 4; G.temp = 120; addLog('換了一鍋新油(-$150)');
  },
  toggle(s) { if (G.plate.length && !G.pay) { G.season[s] = !G.season[s]; if (G.season[s]) G.shakeJar = { s, t: 0.6 }; } },
  dump() { G.plate.forEach(it => G.stats.waste += ITEMS[it.key].cost); G.plate = []; resetPrep(); },
  bag() {
    if (G.pay) return;
    const why = bagBlock();
    if (why) { popup(why, 1149, 596, '#ff9f80'); G.bagHint = 1.6; return; }
    settle();
  },
  report() { if (G.counter) doReport(); },
  payAccept() { finishPay(G.pay.offer); },
  payMid() {
    const p = G.pay, c = G.counter; const mid = Math.round((p.offer + p.price) / 2 / 5) * 5;
    if (rng() < (c.type === 'aunt' ? 0.7 : 0.9)) { c.line = '好啦好啦,就這樣。'; finishPay(mid); }
    else { c.line = '再少一點啦~'; p.midTried = true; }
  },
  payInsist() {
    const p = G.pay, c = G.counter;
    const ch = c.type === 'aunt' ? 0.3 + G.rep / 250 : c.type === 'drunk' ? 0.6 : 0.7;
    if (rng() < ch) { c.line = '…好啦,算你狠。'; finishPay(p.price); }
    else { addLog(`${CTYPES[c.type].label}不爽走人,沒付錢`); changeRep(-1); G.stats.angry++; leave(c, '不賣就算了!', true); G.plate = []; resetPrep(); }
  },
  payFull() { finishPay(G.pay.price); },
  refuse() { addLog('拒絕賣給客人'); G.stats.waste += G.pay.matchedCost; leave(G.counter, '哼!', true); G.plate = []; resetPrep(); },
};

// v42:客人把自己撿好的鐵盆交給老闆(料從展示櫃拿,扣庫存);攤家料 + 口頭加點 = 老闆要補的
function handOver(c) {
  let bi = G.bowls.findIndex(b => b.cid === c.id); if (bi < 0) bi = G.bowls.findIndex(b => !b.items.length);
  if (bi < 0) { c.waitBowl = true; return; }
  c.waitBowl = false;
  const add = countBy(c.order.add || []), picked = [], need = [];
  c.order.items.forEach(k => { if (add[k] > 0 || ITEMS[k].vendor) { if (add[k]) add[k]--; need.push(k); } else picked.push(k); });
  const B = G.bowls[bi], got = [];
  picked.forEach(k => { const v = G.inv[k]; let old = false;
    if (!v) { got.push({ key: k, old: false }); return; } // byo 自備料
    if (v.old > 0) { v.old--; old = true; } else if (v.fresh > 0) v.fresh--; else { need.push(k); return; } // 展示櫃剛好沒了 → 改成老闆補
    got.push({ key: k, old }); });
  B.items.push(...got); B.cid = c.id; G.bowlSel = bi;
  c.handed = true; c.picked = got.map(it => it.key); c.need = need;
  const ex = (c.order.add || []).filter(k => !ITEMS[k].vendor), vd = need.filter(k => ITEMS[k].vendor);
  if (c.type !== 'byo' && c.type !== 'regular') c.line = ex.length ? `${c.picked.length ? '這盆我撿好了,' : ''}再加一份${orderText(ex)}!${vd.length ? `還有${orderText(vd)}。` : ''}` : vd.length ? `我撿好了~${orderText(vd)}也要一份!` : pick(LINES.greet);
  G.handAnim = { t: 0, bi, keys: c.picked.slice() }; sfx('drop');
}
function mustLeft(c) { // 這單還缺哪些料(盆+鍋+盤都沒有的)
  if (!c || !c.handed) return [];
  const have = G.plate.concat(fried(), bowlItems()).map(it => it.key), out = [];
  c.order.items.forEach(k => { const j = have.indexOf(k); if (j >= 0) have.splice(j, 1); else out.push(k); });
  return out;
}
function resetPrep() { G.season = { salt: false, spicy: false, basil: false }; G.cuts = 0; G.pay = null; }

function settle() {
  const c = G.counter, o = c.order; const need = countBy(o.items);
  const served = []; const rest = [];
  G.plate.forEach(it => { if (need[it.key] > 0) { need[it.key]--; served.push(it); } else rest.push(it); });
  const missing = Object.values(need).reduce((a, b) => a + b, 0);
  let sat = 100; const notes = [];
  served.forEach(it => {
    const [lab] = doneLabel(it);
    if (lab === '生') { sat -= 50; notes.push(L(`${ITEMS[it.key].name}是生的`, `${NM(it.key)} raw`)); }
    else if (lab === '半生') { sat -= 25; notes.push(L(`${ITEMS[it.key].name}沒熟透`, `${NM(it.key)} undercooked`)); }
    else if (lab === '太老') { sat -= 18; notes.push(L(`${ITEMS[it.key].name}炸太老`, `${NM(it.key)} overdone`)); }
    if (it.cold > 0.5) { sat -= 10; notes.push(L(`${ITEMS[it.key].name}油膩`, `${NM(it.key)} greasy`)); }
    if (it.old && !has('fridge')) { sat -= 8; notes.push(L(`${ITEMS[it.key].name}不太新鮮`, `${NM(it.key)} stale`)); }
  });
  if (missing) { sat -= 35 * missing; notes.push(L(`少了${missing}樣`, `${missing} missing`)); }
  if (!G.season.salt) { sat -= 15; notes.push(L('沒灑胡椒鹽', 'no salt')); }
  if (G.season.spicy !== o.spicy) { sat -= 20; notes.push(o.spicy ? L('忘了加辣', 'no chili') : L('我不吃辣!', 'I said no chili')); }
  if (G.season.basil !== o.basil) { sat -= 12; notes.push(o.basil ? L('沒有九層塔', 'no basil') : L('不要九層塔啦', 'I said no basil')); }
  if (c.patience / c.max < 0.3) sat -= 10;
  sat = clamp(sat, 0, 100);
  // v42:應收 = 每份料的單價逐項加總 + 調味加價;品質/小費另列
  const lines = served.map(it => [ITEMS[it.key].name, ITEMS[it.key].price, it.key]);
  const base = lines.reduce((a, l) => a + l[1], 0);
  if (G.season.spicy && o.spicy) lines.push(['辣粉', SEASON_PRICE.spicy, 'jar:spicy']);
  if (G.season.basil && o.basil) lines.push(['九層塔', SEASON_PRICE.basil, 'jar:basil']);
  let price = lines.reduce((a, l) => a + l[1], 0);
  const missNames = Object.keys(need).filter(k => need[k] > 0).map(k => `${ITEMS[k].name}×${need[k]}`);
  const ct = CTYPES[c.type];
  let tip = 0;
  if (!c.noTip && c.type === 'drunk' && rng() < 0.2) tip = 20;
  if (!c.noTip && sat >= 90 && (c.type === 'regular' || rng() < 0.4)) tip += Math.max(5, Math.round(base * 0.08 / 5) * 5) + (c.type === 'regular' ? 5 : 0);
  let offer = price;
  if (sat < 40) { offer = Math.round(price * 0.5); c.line = '這樣也敢收全價?' + (notes[0] ? `(${notes[0]})` : ''); }
  else if (rng() < ct.haggle + (G.rumorId === 1 ? 0.15 : 0)) { offer = Math.round(price * rand(...ct.offer) / 5) * 5; c.line = c.type === 'aunt' ? `算 $${offer} 啦,好不好~` : `$${offer} 啦,便宜一點~`; }
  else c.line = sat >= 80 ? pick(LINES.happy) : notes.length ? `嗯…${notes[0]}。` : pick(LINES.ok);
  G.pay = { price, base, lines, missNames, tip, offer: Math.min(offer, price), sat, notes, matchedCost: served.reduce((a, it) => a + ITEMS[it.key].cost, 0), midTried: false };
  rest.forEach(it => G.stats.waste += ITEMS[it.key].cost);
  G.plate = []; G.lastServed = served;
  // 稽查員判定
  if (c.type === 'inspector') {
    c.revealed = true;
    const raw = served.some(it => it.d < ITEMS[it.key].lo);
    const oldOil = G.oilUse > OIL_LIMIT;
    if (raw || oldOil) {
      const fine = (raw ? 1000 : 500) + (G.rumorId === 0 ? 200 : 0); G.stats.fines += fine; G.cash -= fine; changeRep(-8); G.shake = 0.5;
      c.line = `衛生局稽查!${raw ? '食物沒炸熟' : '油太老了'},罰款 $${fine}!`;
      addLog(`被衛生稽查開罰 $${fine}(${raw ? '沒熟' : '老油'})`); popup(`-$${fine}`, 640, 300, '#ff6b6b');
    } else {
      G.stats.rewards += 200; G.cash += 200; changeRep(5); c.line = '衛生局稽查,合格!這攤很乾淨,獎勵你。';
      addLog('衛生稽查合格,獎勵 $200'); popup('+$200 稽查合格', 640, 300, '#06d6a0');
    }
  }
}

function finishPay(amount) {
  const c = G.counter, p = G.pay;
  const tip = p.tip || 0; if (c.type === 'drunk' && tip >= 20) c.line = '嗝…不用找了!';
  sfx('cash'); G.stats.revenue += amount; G.cash += amount + tip; G.stats.tips += tip; G.stats.served++;
  popup(`+$${amount + tip}${tip ? `(小費 ${tip})` : ''}`, 1060, 600, '#ffd166');
  if (p.sat >= 80) { changeRep(1.5); G.stats.happy++; } else if (p.sat >= 50) changeRep(0.5); else { changeRep(-2); G.stats.angry++; }
  if (c.type === 'regular' && p.sat >= 80) changeRep(1);
  if (c.sus && G.lastServed.some(it => it.key === 'byo')) { G.pendingSick = true; }
  addLog(`${CTYPES[c.type].label} 付 $${amount}${tip ? ' + 小費' + tip : ''},滿意度 ${p.sat}`);
  leave(c, c.line, false);
  resetPrep();
}

function doReport() {
  const c = G.counter;
  if (c.sus) { changeRep(3); G.stats.rewards += 100; G.cash += 100; addLog('檢舉來路不明的食材,警察獎勵 $100'); popup('+$100 檢舉正確', 640, 300, '#06d6a0'); leave(c, '……(被帶走了)', false); }
  else { changeRep(-5); G.stats.angry++; addLog(`亂檢舉${c.type === 'inspector' ? '衛生稽查員' : '無辜客人'},口碑 -5`); popup('口碑 -5', 640, 300, '#ff6b6b'); leave(c, c.type === 'inspector' ? '我就是稽查員欸…' : '神經病喔!', true); }
  if (G.pay) { G.stats.waste += G.pay.matchedCost; }
  if (c.type === 'byo') G.plate = G.plate.filter(it => it.key !== 'byo');
  resetPrep();
}

function leave(c, line, angry) {
  G.bowls.forEach((b, i) => { if (b.cid === c.id && b.items.length) A.clearBowl(i); });
  c.line = line; c.angry = angry; G.lastLine = { who: c.revealed ? '衛生局稽查員' : CTYPES[c.type].label, text: line, angry, t: 2.5 }; G.walkers.push({ c, x: c.x || COUNTER_X, dir: -1, sayT: 1.8 }); G.counter = null;
}

// ---------- 更新 ----------
function update(dt) {
  G.popups.forEach(p => { p.life -= dt; p.y -= 30 * dt; }); G.popups = G.popups.filter(p => p.life > 0);
  G.particles.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }); G.particles = G.particles.filter(p => p.life > 0);
  G.shake = Math.max(0, G.shake - dt); if (G.shakeJar) G.shakeJar.t -= dt;
  sfx('tick', dt / SPEED, G.phase === 'open' ? fried().length : 0, G.temp, G.phase === 'open' && G.oilChange <= 0);
  if (G.phase !== 'open') return;
  G.t += dt;
  while (G.schedule.length && G.schedule[0].t <= G.t && G.t < G.dayLen) { const e = G.schedule.shift(); if ((e.type === 'normal' || e.type === 'student') && G.rep < 50 && rng() < (50 - G.rep) / 60) continue; spawn(e.type); }
  // 油溫
  if (G.oilChange > 0) { G.oilChange -= dt; }
  if (G.fullFlash > 0) G.fullFlash -= dt;
  const target = TEMPS.find(x => x.key === G.tempKey).target;
  const rate = G.oilChange > 0 ? 3 : 7;
  G.temp += clamp(target - G.temp, -rate * dt, rate * dt);
  const oldOil = G.oilUse > OIL_LIMIT;
  G.fryer.forEach((net, i) => {
    const b = G.baskets[i]; if (!net.length || !b.inOil) return; // 備料中的網不在油裡
    const p = slotRect(i);
    if (b.p < 100) {
      b.p = Math.min(100, b.p + netSpeed(net) * dt);
      net.forEach(it => { const I = ITEMS[it.key]; it.d = mapD(b.p, I); if (G.temp < I.ideal - 18) it.cold += dt / netTime(net); });
      const cue = b.p >= 100 ? 3 : b.p > SH_HI - 3 ? 2 : b.p >= SH_LO ? 1 : 0; // 1=剛好 2=快焦預警 3=焦(整網一次)
      if (cue > (b.cue || 0)) { b.cue = cue; sfx(['', 'done', 'warn', 'burnt'][cue]); }
    } else if (rng() < dt * 3) G.particles.push({ x: p.x + rand(10, p.w - 10), y: p.y + p.h / 2, vx: rand(-5, 5), vy: -40, life: 1.4, c: 'rgba(60,60,60,0.6)' });
    if (rng() < dt * 4 * net.length) G.particles.push({ x: p.x + rand(8, p.w - 8), y: p.y + rand(8, p.h - 8), vx: 0, vy: rand(-30, -10), life: rand(0.3, 0.8), c: 'rgba(255,240,200,0.5)' });
  });
  // 客人
  if (!G.counter && G.queue.length && G.t < G.dayLen + G.grace) { G.counter = G.queue.shift(); G.counter.x = G.counter.x || 400; G.counter.atCounter = 0; sfx('order'); }
  G.queue.forEach((c, i) => { c.waited = (c.waited || 0) + dt; c.patience -= dt * 0.4; c.tx = Math.max(300, 580 - i * 68) - Math.max(0, i - 4) * 6; c.x += clamp(c.tx - c.x, -160 * dt, 160 * dt); });
  for (let i = G.queue.length - 1; i >= 0; i--) if (G.queue[i].patience <= 0) {
    const c = G.queue.splice(i, 1)[0]; G.stats.lost++; changeRep(-2); addLog(`${CTYPES[c.type].label}排太久,離開了`); G.walkers.push({ c, x: c.x, dir: -1 });
  }
  const c = G.counter;
  if (c) {
    c.x += clamp(COUNTER_X - c.x, -300 * dt, 300 * dt); c.atCounter += dt;
    c.waited = (c.waited || 0) + dt; if (!G.pay) c.patience -= dt;
    if (c.type === 'drunk' && !c.changed && c.handed && c.atCounter > 6 && !G.pay) {
      c.changed = true; const ok = MENU.filter(k => stockOf(k) > 0); const k = ok.length ? pick(ok) : 'tempura'; c.order.items.push(k); (c.order.add = c.order.add || []).push(k); c.order.items.sort((a, b) => MENU.indexOf(a) - MENU.indexOf(b));
      c.line = `嗝…再、再加一份${ITEMS[k].name}啦!`; popup('臨時加點!', 900, 230, '#ffb703');
    }
    if (!c.handed && c.atCounter > 0.6 && !G.pay && !shortItems(c).length) handOver(c);
    if (c.patience <= 0) { G.stats.lost++; G.stats.angry++; changeRep(-2); addLog(`${CTYPES[c.type].label}等太久,生氣走了`); leave(c, pick(LINES.angry.slice(1)), true); resetPrep(); }
  }
  if (G.handAnim) { G.handAnim.t += dt / SPEED; if (G.handAnim.t > 0.9) G.handAnim = null; }
  if (G.mustFlash > 0) G.mustFlash -= dt / SPEED;
  if (G.lastLine) { G.lastLine.t -= dt; if (G.lastLine.t <= 0) G.lastLine = null; }
  G.walkers.forEach(w => { w.x += w.dir * 220 * dt; if (w.sayT) w.sayT -= dt; }); G.walkers = G.walkers.filter(w => w.x > 180 && w.x < 1400);
  // 收攤
  if (G.t >= G.dayLen) {
    if (!G.endBanner) { G.endBanner = true; addLog('收攤時間到,不再接新客'); }
    if ((!G.counter && !G.queue.length) || G.t >= G.dayLen + G.grace) endDay();
  }
}

function endDay() {
  G.queue = []; G.counter = null;
  fried().concat(G.plate).forEach(it => G.stats.waste += ITEMS[it.key].cost); G.fryer = G.fryer.map(() => []); G.baskets.forEach(b => { b.inOil = false; b.p = 0; }); G.plate = []; G.bowls.forEach((b, i) => A.clearBowl(i)); // 盆裡的生料退回庫存
  if (G.pendingSick) { changeRep(-6); addLog('有客人吃了來路不明的自備料,上網爆料!口碑 -6'); }
  // 隔夜耗損:保存 1 晚的剩料報廢;保存 2 晚的變「隔夜料」,原本的隔夜料報廢。冰箱:全部多留一晚。
  const spoiled = [];
  ALL_MENU.forEach(k => { const v = G.inv[k], days = has('fridge') ? 2 : STOCK[k].days;
    let lose = v.old; if (days >= 2) { v.old = v.fresh; } else { lose += v.fresh; v.old = 0; } v.fresh = 0;
    if (lose > 0) { G.stats.spoil += Math.round(lose * unitCost(k)); spoiled.push(`${ITEMS[k].name}×${lose}`); } });
  G.spoiledList = spoiled;
  // 付攤租(含前晚欠款 +20% 滯納)
  const s = G.stats; const due = G.rent + Math.round(G.debt * 1.2); s.due = due;
  if (G.cash >= due) { G.cash -= due; G.debt = 0; G.debtStrikes = 0; s.paid = due; }
  else { s.paid = Math.max(0, G.cash); G.debt = due - s.paid; G.cash = 0; G.debtStrikes++; addLog(`付不出攤租,欠 $${G.debt}`); }
  s.net = G.cash - G.debt - (G.cashStart - G.debtStart);
  s.grade = s.served === 0 ? 'C' : s.net >= 300 ? 'S' : s.net >= 100 ? 'A' : s.net >= -100 ? 'B' : 'C';
  G.best = Math.max(G.best, G.night);
  if (G.debtStrikes >= 2) G.gameOver = '連續兩晚付不出攤租,攤位被收回了。';
  else if (G.rep < 15) G.gameOver = '口碑太差,沒有客人願意上門了。';
  G.phase = 'results';
  if (G.gameOver) clearSave(); else saveGame();
}

// ---------- 輸入 ----------
let buttons = [];
function btn(id, x, y, w, h, label, onClick, opt = {}) {
  const enabled = opt.enabled !== false;
  buttons.push({ id, x, y, w, h, enabled, clickable: enabled || !!opt.clickable, onClick });
  const hover = mouse.x >= x && mouse.x <= x + w && mouse.y >= y && mouse.y <= y + h && enabled;
  const base = opt.color || '#c0392b';
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(x + 2, y + 3, w, h, 8); ctx.fill();
  ctx.fillStyle = !enabled ? '#4a4040' : opt.on ? '#f4a261' : hover ? lighten(base) : base;
  rr(x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = opt.on ? '#ffe8a3' : 'rgba(255,230,180,0.35)'; ctx.lineWidth = opt.on ? 3 : 1.5; ctx.stroke();
  ctx.fillStyle = enabled ? '#fff8e7' : '#9a8f86';
  ctx.font = `bold ${opt.size || 18}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(tr(label), x + w / 2, y + h / 2 + 1);
  ctx.restore();
}
function lighten(c) { return c === '#c0392b' ? '#e04a3a' : c === '#2a6f6a' ? '#36908a' : c === '#6b4226' ? '#8a5733' : c === '#3b5b92' ? '#4c74b8' : '#888'; }
const mouse = { x: -1, y: -1 };
function toCanvas(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
cv.addEventListener('pointermove', e => Object.assign(mouse, toCanvas(e)));
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => { e.preventDefault(); Object.assign(mouse, toCanvas(e));
  const p = toCanvas(e);
  if (e.button === 2) { for (let i = buttons.length - 1; i >= 0; i--) { const b = buttons[i]; if (b.onRight && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { b.onRight(); return; } } return; }
  for (let i = buttons.length - 1; i >= 0; i--) { const b = buttons[i];
    if ((b.enabled || b.clickable) && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { if (!/^(item_|lift_|vol)/.test(b.id)) sfx('click'); b.onClick(); return; } }
});
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'm') { sfx('cycleVolume'); return; }
  if (G.phase === 'title' && (k === 'enter' || k === ' ')) { G.hasSave ? A.cont() : A.start(); return; }
  if (G.phase === 'stock' && k === 'enter') { A.open(); return; }
  if (G.phase !== 'open') return;
  const m = { a: () => A.drop(MENU[0]), s: () => A.drop(MENU[1]), d: () => A.drop(MENU[2]), f: () => A.drop(MENU[3]), g: () => A.drop(MENU[4]), h: () => A.drop(MENU[5]),
    j: () => A.drop(MENU[6]), k: () => MENU[7] && A.drop(MENU[7]), l: () => MENU[8] && A.drop(MENU[8]),
    '1': () => A.tapNet(0), '2': () => A.tapNet(1), '3': () => A.tapNet(2), '4': () => A.tapNet(3), '5': () => A.tapNet(4), '6': () => A.tapNet(5), v: () => A.pour(), b: () => { G.bowlSel = 1 - G.bowlSel; }, o: A.changeOil, q: () => A.setTemp('low'), w: () => A.setTemp('mid'), e: () => A.setTemp('high'), ' ': A.liftAll, z: () => A.toggle('salt'), x: () => A.toggle('spicy'), c: () => A.toggle('basil'), enter: A.bag };
  if (m[k]) { m[k](); e.preventDefault(); }
});

// ---------- 繪圖 ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function text(s, x, y, size = 18, color = '#fff8e7', align = 'left', weight = 'bold') { s = tr(s);
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
}
function wrap(s, x, y, maxW, size, color, lh) {
  ctx.font = `bold ${size}px ${FONT}`; let line = '', yy = y;
  for (const ch of s) { if (ctx.measureText(line + ch).width > maxW) { text(line, x, yy, size, color); line = ch; yy += lh; } else line += ch; }
  if (line) text(line, x, yy, size, color); return yy;
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
    ctx.shadowColor = '#ff5a36'; ctx.shadowBlur = 18 + 6 * Math.sin(time * 5);
    text('阿恩鹽酥雞', 1050, 96, has('neon') ? 44 : 36, has('neon') ? '#ff9ff3' : '#ffcf6b', 'center'); ctx.shadowBlur = 0;
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
  // 本攤招牌與遮雨棚
  ctx.fillStyle = '#1b0d07'; rr(460, 110, 360, 54, 10); ctx.fill();
  ctx.shadowColor = '#ff5a36'; ctx.shadowBlur = 18 + 6 * Math.sin(time * 5);
  text('★ 阿恩鹽酥雞 ★', 640, 138, 32, '#ffcf6b', 'center'); ctx.shadowBlur = 0;
  for (let i = 0; i < 16; i++) { ctx.fillStyle = i % 2 ? '#f3ead8' : '#c0392b'; ctx.beginPath(); ctx.moveTo(400 + i * 30, 165); ctx.lineTo(430 + i * 30, 165); ctx.lineTo(430 + i * 30, 180); ctx.arc(415 + i * 30, 180, 15, 0, Math.PI); ctx.fill(); }
  // 暖光
  const wg = ctx.createRadialGradient(640, 330, 30, 640, 330, 520); wg.addColorStop(0, 'rgba(255,170,70,0.28)'); wg.addColorStop(1, 'rgba(255,170,70,0)');
  ctx.fillStyle = wg; ctx.fillRect(0, 0, W, 430);
  // 櫃台
  const cg = ctx.createLinearGradient(0, 400, 0, 432); cg.addColorStop(0, '#a0673a'); cg.addColorStop(1, '#5c3a1e');
  ctx.fillStyle = cg; ctx.fillRect(0, 400, W, 32);
  ctx.fillStyle = 'rgba(255,220,160,0.25)'; ctx.fillRect(0, 400, W, 3);
}

function drawPerson(c, x, scale = 1, mood = null, y = 400) {
  const ct = CTYPES[c.type]; const s = scale;
  const ratio = c.patience / c.max; mood = mood ?? (c.angry ? 0 : ratio);
  const im = IMG['c_' + (c.revealed ? 'inspector_revealed' : c.type)];
  if (im) {
    const bob = Math.sin(performance.now() / 300 + c.id) * 2; const h = 270 * s, w = im.width / im.height * h;
    ctx.save(); if (mood < 0.3) ctx.filter = 'sepia(0.4) saturate(1.4) hue-rotate(-15deg)';
    ctx.drawImage(im, x - w / 2, y - h + bob + 4, w, h); ctx.restore();
    if (mood < 0.3) text('💢', x + w / 2 - 10, y - h + 20, 30 * s + 6, '#ff4d4d', 'center');
    return;
  }
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const bob = Math.sin(performance.now() / 300 + c.id) * 2;
  // 身體
  ctx.fillStyle = c.revealed ? '#1d3557' : ct.body; rr(-48, -150 + bob, 96, 150, 30); ctx.fill();
  if (c.type === 'student') { ctx.fillStyle = '#e63946'; rr(-58, -140 + bob, 18, 80, 6); ctx.fill(); }
  if (c.type === 'byo') { ctx.fillStyle = c.sus ? '#7a8b5a' : '#d4c49a'; rr(36, -70 + bob, 34, 40, 6); ctx.fill(); if (c.sus) { ctx.fillStyle = '#9ad1ff'; ctx.beginPath(); ctx.arc(55, -22 + bob + (performance.now() / 50 % 20), 3, 0, 7); ctx.fill(); } }
  if (c.type === 'drunk') { ctx.fillStyle = '#2d6a4f'; rr(40, -100 + bob, 14, 50, 4); ctx.fill(); }
  if (c.revealed) { ctx.fillStyle = '#ffd166'; rr(-20, -120 + bob, 40, 26, 4); ctx.fill(); ctx.fillStyle = '#1d3557'; ctx.font = `bold 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('衛生局', 0, -106 + bob); }
  // 頭
  ctx.fillStyle = c.type === 'drunk' ? '#f2b8a0' : '#f6d5b5'; ctx.beginPath(); ctx.arc(0, -185 + bob, 42, 0, 7); ctx.fill();
  if (c.type === 'aunt') { ctx.fillStyle = '#6a4c93'; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(i * 12, -222 + bob + Math.abs(i) * 4, 14, 0, 7); ctx.fill(); } }
  if (c.type === 'regular') { ctx.fillStyle = '#e76f51'; ctx.beginPath(); ctx.arc(0, -205 + bob, 40, Math.PI, 0); ctx.fill(); ctx.fillRect(0, -210 + bob, 56, 9); }
  if (c.type === 'inspector') { ctx.fillStyle = '#222'; rr(-30, -198 + bob, 26, 12, 4); ctx.fill(); rr(4, -198 + bob, 26, 12, 4); ctx.fill(); ctx.fillStyle = '#495057'; ctx.beginPath(); ctx.arc(0, -212 + bob, 42, Math.PI, 0); ctx.fill(); }
  else { ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(-14, -190 + bob, 4, 0, 7); ctx.arc(14, -190 + bob, 4, 0, 7); ctx.fill(); }
  if (c.type === 'drunk') { ctx.fillStyle = 'rgba(230,60,60,0.5)'; ctx.beginPath(); ctx.arc(-24, -175 + bob, 9, 0, 7); ctx.arc(24, -175 + bob, 9, 0, 7); ctx.fill(); }
  ctx.strokeStyle = '#5a2a1a'; ctx.lineWidth = 3; ctx.beginPath();
  const curve = (mood - 0.5) * 16; ctx.moveTo(-12, -166 + bob); ctx.quadraticCurveTo(0, -166 + curve + bob, 12, -166 + bob); ctx.stroke();
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
  ctx.fillStyle = 'rgba(10,6,4,0.85)'; ctx.fillRect(0, 0, W, 44);
  const left = Math.max(0, G.dayLen - G.t);
  text(L(`第 ${G.night} 晚 · ${G.t < G.dayLen ? '營業中' : '收攤中'}`, `Night ${G.night} · ${G.t < G.dayLen ? 'open' : 'closing'}`), 16, 22, 20, '#ffcf6b');
  text(`🕖 ${clockStr()}`, 200, 22, 20);
  ctx.fillStyle = '#3a2a20'; rr(300, 14, 220, 16, 8); ctx.fill();
  ctx.fillStyle = '#f4a261'; rr(300, 14, 220 * clamp(G.t / G.dayLen, 0, 1), 16, 8); ctx.fill();
  text(`⏳${Math.ceil(left)}`, 530, 22, 16, '#ddd');
  if (IMG.uiCash) ctx.drawImage(IMG.uiCash, 606, 12, 32, 18);
  text(`$${Math.round(G.cash)}`, 640, 22, 20, G.cash >= G.rent ? '#ffd166' : '#ff8787');
  text(`🏠 -$${G.rent}${G.debt ? ` +${L('欠', 'debt ')}$${Math.round(G.debt * 1.2)}` : ''}`, 740, 22, 16, G.debt ? '#ff8787' : '#ccc');
  const stars = G.rep / 20; let st = ''; for (let i = 0; i < 5; i++) st += stars >= i + 0.5 ? '★' : '☆';
  if (IMG.uiRep) ctx.drawImage(IMG.uiRep, 958, 8, 28, 28);
  text(`${st} ${Math.round(G.rep)}`, 990, 22, 18, '#ffd166');
}

function drawScene(time) {
  drawBackground(time);
  // 街景條(菜單夾與油槽之間):客人從左邊走來、排隊、到櫃台點單,拿到東西或生氣離開
  ctx.fillStyle = 'rgba(10,6,4,0.35)'; ctx.fillRect(0, STRIP.y0, STRIP.x1, STRIP.y1 - STRIP.y0);
  const cg = ctx.createLinearGradient(0, STRIP.base - 2, 0, STRIP.y1); cg.addColorStop(0, '#8a5733'); cg.addColorStop(1, '#3a2312');
  ctx.fillStyle = cg; ctx.fillRect(0, STRIP.base - 2, W, STRIP.y1 - STRIP.base + 2);
  ctx.fillStyle = 'rgba(14,8,5,0.96)'; ctx.fillRect(0, STRIP.y1, W, H - STRIP.y1);
  drawNotebook(8, 152);
  const now = performance.now() / 1000;
  ctx.save(); ctx.beginPath(); ctx.rect(240, STRIP.y0, STRIP.x1 - 240, STRIP.y1 - STRIP.y0); ctx.clip(); // 客人從筆記板右側的巷口走出來,不會蓋到筆記
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(240, STRIP.y0, 18, STRIP.base - STRIP.y0);
  G.walkers.forEach(w => drawPerson(w.c, w.x, 0.74, w.c.angry ? 0 : 1, STRIP.base));
  const says = () => G.walkers.forEach(w => { if (w.sayT > 0 && w.x > 250) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.font = `bold 14px ${FONT}`; const tw = ctx.measureText(w.c.line).width + 16; rr(w.x - tw / 2, 84, tw, 24, 8); ctx.fill(); text(w.c.line, w.x, 96, 14, w.c.angry ? '#ff8787' : '#b7f5c5', 'center'); } });
  G.queue.slice().reverse().forEach(c => { if (c.x < -40) return; drawPerson(c, c.x, 0.74, null, STRIP.base);
    const r = clamp(c.patience / c.max, 0, 1); ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(c.x - 28, 52, 56, 9); ctx.fillStyle = r > 0.6 ? '#2a9d55' : r > 0.3 ? '#e98a00' : '#d62828'; ctx.fillRect(c.x - 28, 52, 56 * r, 9); });
  const c = G.counter;
  if (c) { drawPerson(c, c.x, 0.8, null, STRIP.base); }
  ctx.restore(); says(); // 台詞泡泡畫在裁切外,不會被切掉
  drawStripBubble(c);
  drawRail();
  void now;
}
function drawNotebook(x, y) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.025);
  ctx.fillStyle = '#fff3a8'; ctx.fillRect(0, 0, 222, 104);
  text(L('📒 熟客(戴帽子)老樣子', '📒 Regular (cap): usual'), 8, 13, 12, '#7a4b00');
  iconRow(countEnts(G.regularOrder.items, 'self'), 10, 52, 40, 8, 205); jarIcon('salt', 20, 88, 22, true); jarIcon('spicy', 46, 88, 22, G.regularOrder.spicy); jarIcon('basil', 72, 88, 22, G.regularOrder.basil);
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
  panel(8, 266, 244, 446, '展示櫃 — 客人自己撿;橘框=老闆補');
  const keys = [...MENU], mlk = G.counter && !G.pay ? mustLeft(G.counter) : [];
  // v44:肉類區(橘底、大格)在上;非肉(綠底、小格)在下
  ctx.fillStyle = 'rgba(224,122,31,0.22)'; rr(12, 283, 236, 149, 10); ctx.fill(); ctx.strokeStyle = '#e07a1f'; ctx.lineWidth = 2; rr(12, 283, 236, 149, 10); ctx.stroke();
  ctx.fillStyle = 'rgba(58,154,74,0.18)'; rr(12, 435, 236, 129, 10); ctx.fill(); ctx.strokeStyle = '#3a9a4a'; rr(12, 435, 236, 129, 10); ctx.stroke();
  keys.forEach((k, i) => {
    const R = ITEM_RECT(k); if (!R) return; const { x: bx, y: by, w: tw, h: th } = R, I = ITEMS[k], meat = isMeat(k);
    const q = k === 'byo' ? 1 : stockOf(k);
    const full = G.bowls.every(b => b.items.length >= BOWL_CAP);
    btn('item_' + k, bx, by, tw, th, '', () => A.drop(k), { color: meat ? '#7a3c12' : '#2f5a34', enabled: q > 0 && !full });
    const fim = foodImg(k, false), is = meat ? 40 : 26;
    if (fim) { const sc = is / Math.max(fim.width, fim.height); ctx.drawImage(fim, bx + 3 + (is - fim.width * sc) / 2, by + 2 + (is - fim.height * sc) / 2, fim.width * sc, fim.height * sc); }
    if (mlk.includes(k) && Math.sin(performance.now() / 120) > -0.3) { ctx.strokeStyle = '#ff9f1c'; ctx.lineWidth = 3.5; rr(bx - 1, by - 1, tw + 2, th + 2, 9); ctx.stroke(); }
    if (I.vendor) plusMark(bx + 6, by + 6, 6);
    const hk = 'ASDFGHJKL'[i];
    if (meat) { catBadge(bx + tw - 10, by + 10, 8, true); text(NM(k), bx + 46, by + 11, LANG === 'en' ? 11 : 14); text(`$${I.price}`, bx + 46, by + 26, 12, '#ffd166'); if (hk) text(hk, bx + tw - 10, by + 26, 10, '#ddb', 'center', 'normal'); }
    else { catBadge(bx + 26, by + 6, 5, false); text(NM(k), bx + 31, by + 9, LANG === 'en' ? 8 : 10); text(`$${I.price}`, bx + 31, by + 21, 10, '#ffd166'); if (hk) text(hk, bx + tw - 6, by + 21, 8, '#ddb', 'center', 'normal'); }
    if (k !== 'byo') { const v = G.inv[k] || { old: 0 }; const lab = q <= 0 ? '✗ 0' : `📦${q}${v.old ? ` (${L('夜', 'old')}${v.old})` : ''}`;
      const lw = meat ? 60 : tw - 6, lx = meat ? bx + 46 : bx + 3, ly = by + th - 10;
      ctx.fillStyle = q <= 0 ? '#d62828' : q <= 3 ? '#e9a400' : 'rgba(0,0,0,0.45)'; rr(lx, ly, lw, 9, 3); ctx.fill(); text(lab, lx + lw / 2, ly + 4.5, 8, '#fff', 'center'); }
  });
  // v41:鐵盆(備料盆)— 料先撿進盆,再按盆下鍋
  const cid = G.counter && !G.pay ? G.counter.id : -1;
  G.bowls.forEach((B, bi) => drawBowl(bi, B, 14 + bi * 118, 566, 112, 78, cid));
  // 油溫/油況(壓縮成兩排)
  const ty = 654, old = G.oilUse > OIL_LIMIT;
  text(`🌡 ${Math.round(G.temp)}°C`, 16, ty, 15, G.temp > 182 ? '#ff8f6b' : G.temp < 155 ? '#9ad1ff' : '#ffd166');
  text(`🛢 ${old ? L('老油!', 'OLD!') : L('新鮮', 'fresh')} ${Math.round(G.oilUse)}/${OIL_LIMIT}${has('filter') ? ' F' : ''}`, 120, ty, 12, old ? '#ff6b6b' : '#b7e4c7', 'left', 'normal');
  TEMPS.forEach((tp, i) => btn('temp_' + tp.key, 14 + i * 58, ty + 10, 54, 28, `${L(tp.name, ['Low', 'Mid', 'High'][i])}${'QWE'[i]}`, () => A.setTemp(tp.key), { on: G.tempKey === tp.key, color: '#2a6f6a', size: 12 }));
  btn('oil', 190, ty + 10, 56, 28, `換油O`, A.changeOil, { enabled: !fried().length && G.oilChange <= 0, color: '#6b4226', size: 12 });
  text(`🛢 $${OIL_CHANGE_COST} ${L('鍋要空', '(empty fryer)')}`, 16, ty + 50, 11, '#a89a86', 'left', 'normal');
}
// v41:不鏽鋼鐵盆(俯視,canvas 畫)
function drawBowl(bi, B, x, y, w, h, cid) {
  const n = B.items.length, sel = G.bowlSel === bi, cx = x + w / 2, cy = y + h / 2 + 2, R = h >= 100 ? 46 : 34, sk = R / 46;
  buttons.push({ id: 'bowl_' + bi, x, y, w, h, enabled: true, clickable: true, onClick: () => A.pour(bi), onRight: () => A.clearBowl(bi) });
  ctx.save();
  ctx.fillStyle = sel ? 'rgba(244,162,97,0.22)' : 'rgba(0,0,0,0.25)'; rr(x, y, w, h, 10); ctx.fill();
  if (sel) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2.5; rr(x, y, w, h, 10); ctx.stroke(); }
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(cx + 3, cy + 5, R, R * 0.86, 0, 0, 7); ctx.fill(); // 影子
  let g = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R); g.addColorStop(0, '#f4f6f8'); g.addColorStop(0.45, '#aab1b9'); g.addColorStop(0.7, '#e3e7eb'); g.addColorStop(1, '#6e767e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.86, 0, 0, 7); ctx.fill(); // 外緣
  g = ctx.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, R - 6); g.addColorStop(0, '#eef1f4'); g.addColorStop(0.6, '#a9b0b8'); g.addColorStop(1, '#5d656d');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, R - 7, (R - 7) * 0.86, 0, 0, 7); ctx.fill(); // 盆內
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy, R - 7, (R - 7) * 0.86, 0, Math.PI * 1.05, Math.PI * 1.6); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(cx, cy + 2, R * 0.56, R * 0.48, 0, 0, 7); ctx.stroke(); // 盆底圈
  // 盆裡的料(交盆動畫飛行中先不畫)
  if (!(G.handAnim && G.handAnim.bi === bi && G.handAnim.t < 0.6)) B.items.forEach((it, j) => { const a = j / Math.max(1, n) * Math.PI * 2 + bi, rr2 = (n === 1 ? 0 : n <= 3 ? 14 : 20) * sk;
    const ix = cx + Math.cos(a) * rr2, iy = cy + Math.sin(a) * rr2 * 0.8, s = (ITEMS[it.key].size === 'L' ? 40 : 30) * sk;
    const im = IMG['raw_' + it.key] || foodImg(it.key, false);
    if (im) { const sc = s / Math.max(im.width, im.height); ctx.drawImage(im, ix - im.width * sc / 2, iy - im.height * sc / 2, im.width * sc, im.height * sc); }
    else { ctx.fillStyle = ITEMS[it.key].color; ctx.beginPath(); ctx.arc(ix, iy, s / 3, 0, 7); ctx.fill(); } });
  ctx.restore();
  text(`#${bi + 1} · ${n}`, x + 6, y + 10, 12, sel ? '#ffd166' : '#d8c8b0', 'left');
  if (n && B.cid === cid) { ctx.fillStyle = '#4cc9f0'; rr(x + w - 36, y + 3, 32, 15, 4); ctx.fill(); text(L('這單', 'NOW'), x + w - 20, y + 10.5, 10, '#06283d', 'center'); }
  else if (n && B.cid) { ctx.fillStyle = '#888'; rr(x + w - 36, y + 3, 32, 15, 4); ctx.fill(); text(L('上一單', 'prev'), x + w - 20, y + 10.5, 9, '#fff', 'center'); }
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
  const X = 258, Y = 266, TW = 760, TH = 446;
  const tankI = IMG.tank2 || IMG.tankTop;
  if (tankI) { ctx.save(); if (old) ctx.filter = 'brightness(0.7) sepia(0.6)'; ctx.drawImage(tankI, X - 6, Y - 4, TW + 12, TH + 8); ctx.restore();
    if (fried().length) { ctx.fillStyle = `rgba(255,230,160,${0.05 + 0.03 * Math.sin(now * 9)})`; rr(X + 40, Y + 40, TW - 80, TH - 80, 10); ctx.fill(); } }
  else { ctx.fillStyle = '#6c7178'; rr(X, Y, TW, TH, 14); ctx.fill(); ctx.fillStyle = old ? '#6a440e' : '#c98a28'; rr(X + 10, Y + 10, TW - 20, TH - 20, 10); ctx.fill(); }
  if (G.fullFlash > 0) { ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 6; rr(X + 2, Y + 2, TW - 4, TH - 4, 14); ctx.stroke(); }
  // 提示條(油槽上緣)
  const h = hint(); ctx.fillStyle = 'rgba(10,6,4,0.8)'; rr(266, 271, 744, 28, 8); ctx.fill();
  if (h) G._hint = h; // 箭頭最後才畫(蓋在最上層)
  if (h) drawHint({ ...h, tgt: [] }, 278, 285);
  // 沒買的網位:可升級
  G.baskets.filter(b => b.locked).forEach(b => { const { x, y, w, h } = cellRect(b); const u = UPGRADES.find(q => q.id === b.up);
    ctx.fillStyle = 'rgba(20,12,6,0.55)'; rr(x, y, w, h, 10); ctx.fill();
    ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(255,230,180,0.45)'; ctx.lineWidth = 2; rr(x, y, w, h, 10); ctx.stroke(); ctx.setLineDash([]);
    text('🔒 可升級', x + w / 2, y + h / 2 - 12, b.s === 'L' ? 20 : 14, '#d8c8b0', 'center');
    text(`$${u.price}`, x + w / 2, y + h / 2 + 14, b.s === 'L' ? 15 : 11, '#a89a86', 'center', 'normal'); });
  const cid = G.counter && !G.pay ? G.counter.id : -1;
  for (let i = 0; i < G.fryer.length; i++) if (!G.baskets[i].locked) drawSlot(i, G.fryer[i], now, cid);
  if (G.oilChange > 0) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; rr(400, 440, 476, 80, 12); ctx.fill(); text(`🛢 ${L('換油中', 'Changing oil')}… ${G.oilChange.toFixed(1)}s`, 638, 480, 30, '#fff', 'center'); }
  // 下緣控制條
  ctx.fillStyle = 'rgba(10,6,4,0.8)'; rr(266, 658, 744, 48, 10); ctx.fill();
  // v43:流程教學圖(取代長句):盆 + 補料 → 網 → ✓ → 撈 → 撒粉 → 袋 → $
  { const st = [['bowl'], ['food', 'chicken', 'need'], ['arrow'], ['net'], ['arrow'], ['check'], ['text', '⬆'], ['arrow'], ['jar', 'salt'], ['arrow'], ['bag'], ['arrow'], ['coin']];
    drawHint({ t: '', seq: st, tgt: [] }, 282, 672); }
  const cnt = s => G.baskets.filter((b, j) => b.s === s && !b.locked && !G.fryer[j].length).length, bowlN = bowlItems().length;
  catBadge(286, 693, 8, true); arrowSmall(298, 693, 12); bigNetMini(318, 693); catBadge(352, 693, 8, false); arrowSmall(364, 693, 12); smallNetMini(384, 693);
  text(`${L('空網', 'Free')}`, 410, 693, 13, '#b7e4c7', 'left'); catBadge(452, 693, 7, true); text(`${cnt('L')}`, 462, 693, 15, G.fullFlash > 0 ? '#ff6b6b' : '#b7e4c7', 'left'); catBadge(484, 693, 7, false); text(`${cnt('S')}`, 494, 693, 15, G.fullFlash > 0 ? '#ff6b6b' : '#b7e4c7', 'left');
  if (bowlN && !G.fryer.some((n, j) => n.length && G.baskets[j].inOil && netReady(n))) btn('pour', 810, 662, 194, 40, `鐵盆下鍋(V)`, () => A.pour(), { enabled: G.oilChange <= 0, size: 16 });
  else btn('liftAll', 810, 662, 194, 40, '撈熟的(空白鍵)', A.liftAll, { enabled: G.fryer.some((n, j) => n.length && G.baskets[j].inOil && netReady(n)), size: 16 });
}

function slotState(it) {
  const I = ITEMS[it.key];
  if (it.d >= 100) return { lab: '焦了', col: '#7a1010', fg: '#ff6b6b', burnt: true };
  if (it.d < I.lo) return { lab: it.d < 40 ? '生' : '半生', col: '#4f7fa8', fg: '#cfe6ff' };
  if (it.d <= I.hi) return { lab: '剛好!', col: '#21b36b', fg: '#eafff2', ready: true };
  { const t = clamp((it.d - I.hi) / Math.max(1, 100 - I.hi), 0, 1); return { lab: '快焦!', col: `rgb(${Math.round(240 - 20 * t)},${Math.round(140 - 100 * t)},${Math.round(40)})`, fg: '#ffe0d6', warn: true }; }
}
function netReady(net) { const g = net.filter(it => it.d < 100); return net.some(it => it.d >= 100) || (g.length && g.every(it => it.d >= ITEMS[it.key].lo)); }
function drawSlot(i, net, now, cid) {
  const b = G.baskets[i], big = b.s === 'L', { x, y, w, h } = slotRect(i), on = net.length > 0;
  ctx.fillStyle = on ? 'rgba(20,10,4,0.35)' : 'rgba(20,10,4,0.18)'; rr(x, y, w, h, 10); ctx.fill();
  const netI = (big ? IMG.bigNet : IMG.smallNet) || IMG.basketTop;
  if (netI) { ctx.save(); ctx.globalAlpha = on ? 0.8 : 0.95; ctx.drawImage(netI, x, y, w, h); ctx.restore(); }
  else { ctx.strokeStyle = '#c9ced4'; ctx.lineWidth = 3; rr(x + 3, y + 3, w - 6, h - 6, 8); ctx.stroke(); }
  const bs = big ? 30 : 22; ctx.fillStyle = '#ffd166'; rr(x + 6, y + 6, bs, bs, 6); ctx.fill(); text(String(i + 1), x + 6 + bs / 2, y + 6 + bs / 2, big ? 20 : 15, '#2b1a0e', 'center');
  ctx.fillStyle = big ? 'rgba(224,122,31,0.9)' : 'rgba(59,127,184,0.9)'; rr(x + bs + 10, y + 7, big ? 60 : 74, 20, 5); ctx.fill();
  text(big ? (net.length > 1 ? `${net.length}/${MEAT_CAP}` : '') : `${net.length}/${SMALL_CAP}`, x + bs + 10 + (big ? 40 : 46), y + 17, 12, '#fff', 'center'); catBadge(x + bs + 10 + 12, y + 17, 9, big);
  if (!on) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(x + w / 2 - 70, y + h / 2 - 14, 140, 28, 8); ctx.fill();
    if (big) { ctx.save(); ctx.globalAlpha = 0.5; foodIcon('chicken', x + w / 2 - 22, y + h / 2, 36, false); foodIcon('saltchicken', x + w / 2 + 22, y + h / 2, 30, false); ctx.restore(); catBadge(x + w - 22, y + h - 22, 14, true); } else catBadge(x + w - 18, y + h - 18, 11, false); if (big) {} else { ctx.save(); ctx.globalAlpha = 0.45; ['tempura', 'bean', 'squid'].forEach((k, q) => foodIcon(k, x + w / 2 - 34 + q * 34, y + h / 2, 26, false)); ctx.restore(); }
    return;
  }
  const inOil = b.inOil;
  buttons.push({ id: 'lift_' + i, x, y, w, h, enabled: true, onClick: () => A.tapNet(i) });
  if (net.every(it => it.cid === cid)) { ctx.fillStyle = '#4cc9f0'; rr(x + w - 50, y + 7, 42, 20, 5); ctx.fill(); text(L('這單', 'NOW'), x + w - 29, y + 17, 12, '#06283d', 'center'); }
  // 料的圖(小網排一排,不再各自標熟度)
  const multi = big && net.length > 1, n = big ? (multi ? 2 : 1) : SMALL_CAP, cw = (w - 12) / n, P = b.p || 0;
  net.forEach((it, j) => {
    const I = ITEMS[it.key];
    const s = multi ? 62 : big ? 118 : 38, cx = x + 6 + cw * (multi ? j % 2 : j) + cw / 2, cy = y + (multi ? 62 + Math.floor(j / 2) * 62 : big ? 96 : 50);
    const rawI = IMG['raw_' + it.key], frI = IMG['fr_' + it.key], fim = IMG['f_' + (IMG_ALIAS[it.key] || it.key)], k = clamp(it.d / 100, 0, 1);
    const fit = (im, a, flt) => { if (!im) return; const sc = s / Math.max(im.width, im.height); ctx.save(); ctx.globalAlpha = a; if (flt) ctx.filter = flt; ctx.drawImage(im, cx - im.width * sc / 2, cy - im.height * sc / 2, im.width * sc, im.height * sc); ctx.restore(); };
    if (rawI && frI) { if (it.d >= 100) fit(IMG.burnt || frI, 1, IMG.burnt ? '' : 'brightness(0.2)');
      else { const m = clamp(it.d / I.lo, 0, 1); fit(rawI, 1); if (m > 0) fit(frI, m, it.d > I.hi ? `brightness(${1 - 0.5 * (it.d - I.hi) / (100 - I.hi)}) sepia(0.3)` : ''); } }
    else if (fim) { ctx.save(); ctx.filter = it.d >= 100 ? 'brightness(0.18) grayscale(1)' : `brightness(${1.35 - 0.7 * k}) saturate(${0.6 + 0.6 * k})`; if (it.key === 'byo') ctx.filter += ' hue-rotate(60deg)'; ctx.drawImage(fim, cx - s / 2, cy - s / 2, s, s); ctx.restore(); }
    else { ctx.fillStyle = I.color; ctx.beginPath(); ctx.arc(cx, cy, s / 3, 0, 7); ctx.fill(); }
    if (it.old && !has('fridge')) text(L('隔夜', 'old'), cx + cw / 2 - 4, cy - s / 2 + 2, 11, '#ffb703', 'right');
  });
  const blink = Math.sin(now * Math.PI * 6) > 0;
  const ph = big ? 34 : 22, px = x + 8, pw = w - 16, py = y + h - ph - (big ? 30 : 14);
  const burnt = P >= 100, warn = !burnt && P > SH_HI, ready = !burnt && !warn && P >= SH_LO;
  // v43:狀態 = 顏色條 + 圖示(生=藍色冰晶+進度圈 · 剛好=綠勾+上撈箭頭 · 快焦=橘火 · 焦=大紅火),不再顯示「還要 x.xs」
  const col = burnt ? '#7a1010' : warn ? '#e8742a' : ready ? '#21b36b' : '#4f7fa8';
  ctx.fillStyle = ready || warn || burnt ? col : 'rgba(20,30,45,0.88)'; rr(px, py, pw, ph, 7); ctx.fill();
  const ic = ph * 0.8, icx = px + pw / 2, icy = py + ph / 2;
  if (burnt) { flameIcon(icx - ic * 0.6, icy, ic, true); flameIcon(icx + ic * 0.6, icy, ic, true); }
  else if (warn) { flameIcon(icx - ic * 0.7, icy, ic); text('⬆', icx + ic * 0.5, icy, ic * 0.8, '#fff', 'center'); }
  else if (ready) { checkMark(icx - ic * 0.7, icy, ic * 0.45, '#0e7a45'); text('⬆', icx + ic * 0.5, icy, ic * 0.8, '#fff', 'center'); }
  else { rawIcon(icx - ic * 0.8, icy, ic * 0.8); const pr = clamp(P / SH_LO, 0, 1); ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(icx + ic * 0.5, icy, ic * 0.38, 0, 7); ctx.stroke();
    ctx.strokeStyle = '#9ad1ff'; ctx.beginPath(); ctx.arc(icx + ic * 0.5, icy, ic * 0.38, -Math.PI / 2, -Math.PI / 2 + pr * Math.PI * 2); ctx.stroke(); }
  const by = py + ph + 3, bh = big ? 14 : 8;
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(px, by, pw, bh);
  ctx.fillStyle = 'rgba(79,127,168,0.8)'; ctx.fillRect(px, by, pw * SH_LO / 100, bh);
  ctx.fillStyle = 'rgba(33,179,107,0.95)'; ctx.fillRect(px + pw * SH_LO / 100, by, pw * (SH_HI - SH_LO) / 100, bh);
  ctx.fillStyle = 'rgba(226,64,43,0.85)'; ctx.fillRect(px + pw * SH_HI / 100, by, pw * (1 - SH_HI / 100), bh);
  ctx.fillStyle = '#fff'; ctx.fillRect(px + pw * P / 100 - 2, by - 4, 4, bh + 8);
  ctx.strokeStyle = col; ctx.lineWidth = ready || warn || burnt ? (blink ? 7 : 3) : 3; rr(x, y, w, h, 10); ctx.stroke();
}
// v39:調味罐(canvas 畫的撒粉罐,點一下會傾斜撒粉)
function shaker(id, x, y, label, body, cap, on, en) {
  buttons.push({ id, x, y, w: 74, h: 52, enabled: en, clickable: en, onClick: () => A.toggle(id) });
  const sj = G.shakeJar && G.shakeJar.s === id && G.shakeJar.t > 0 ? G.shakeJar : null;
  ctx.save(); ctx.fillStyle = on ? 'rgba(244,162,97,0.35)' : 'rgba(0,0,0,0.3)'; rr(x, y, 74, 52, 8); ctx.fill();
  if (on) { ctx.strokeStyle = '#ffe8a3'; ctx.lineWidth = 2.5; rr(x, y, 74, 52, 8); ctx.stroke(); }
  const cx = x + 20, cy = y + 28; ctx.translate(cx, cy);
  if (sj) ctx.rotate(-0.9 * Math.sin(sj.t / 0.6 * Math.PI) - 0.15 * Math.sin(sj.t * 60));
  if (!en) ctx.globalAlpha = 0.45;
  ctx.fillStyle = cap; rr(-10, -20, 20, 9, 3); ctx.fill(); // 蓋
  ctx.fillStyle = '#d9dde2'; rr(-11, -12, 22, 4, 1); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(i * 5, -17, 1.4, 0, 7); ctx.fill(); }
  const g = ctx.createLinearGradient(-11, 0, 11, 0); g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.3, 'rgba(255,255,255,0.08)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = 'rgba(230,240,245,0.35)'; rr(-11, -8, 22, 28, 4); ctx.fill(); // 玻璃
  ctx.fillStyle = body; rr(-10, -1, 20, 20, 3); ctx.fill(); // 粉
  ctx.fillStyle = g; rr(-11, -8, 22, 28, 4); ctx.fill();
  ctx.fillStyle = '#fff8e7'; ctx.fillRect(-10, 4, 20, 8); ctx.fillStyle = cap; ctx.font = `bold 7px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(LANG === 'en' ? '' : label.slice(0, id === 'spicy' ? 2 : 3), 0, 8.5);
  ctx.restore();
  text(label.split(' ')[0], x + 54, y + 20, 11, en ? '#fff8e7' : '#9a8f86', 'center');
  text(label.split(' ')[1] || '', x + 54, y + 38, 11, '#ffd59a', 'center', 'normal');
  if (sj) for (let i = 0; i < 2; i++) G.particles.push({ x: cx - 14 + rand(-4, 4), y: cy - 18, vx: rand(-20, 10), vy: rand(30, 70), life: 0.4, c: body });
}

// ---------- 右欄:櫃台客人、起鍋盤、收銀 ----------
function drawRight() {
  panel(1026, 266, 246, 446, '');
  const c = G.counter, X = 1034;
  // 起鍋盤 / 收銀
  text(G.pay ? '收銀' : '起鍋盤 — 調味、裝袋', X, 284, 15, '#ffd59a');
  if (!G.pay) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(X, 296, 230, 112, 10); ctx.fill();
    if (!G.plate.length) { ctx.save(); ctx.globalAlpha = 0.5; netIcon(X + 85, 352, 34); arrowSmall(X + 108, 352, 22); ctx.restore(); text('🍽', X + 150, 352, 22, '#8a7a6a', 'center'); }
    // v43:盤上 = 食材圖示 + 熟度小圖示(✓剛好 · 冰晶=生 · 火=太老/焦)
    G.plate.forEach((it, i) => { const per = 5, sz = 40, bx = X + 6 + (i % per) * 45, by = 300 + Math.floor(i / per) * 44; const [lab] = doneLabel(it);
      ctx.fillStyle = 'rgba(30,15,6,0.55)'; rr(bx, by, sz + 2, sz + 2, 6); ctx.fill();
      if (it.d >= 100 && IMG.burnt) { const im = IMG.burnt, sc = sz / Math.max(im.width, im.height); ctx.drawImage(im, bx + 1 + sz / 2 - im.width * sc / 2, by + 1 + sz / 2 - im.height * sc / 2, im.width * sc, im.height * sc); } else foodIcon(it.key, bx + 1 + sz / 2, by + 1 + sz / 2, sz, it.d >= ITEMS[it.key].lo * 0.6);
      const mx = bx + sz - 4, my = by + 6;
      if (lab === '剛好') checkMark(mx, my, 7); else if (lab === '生' || lab === '半生') { ctx.fillStyle = '#4f7fa8'; ctx.beginPath(); ctx.arc(mx, my, 8, 0, 7); ctx.fill(); rawIcon(mx, my, 11); } else flameIcon(mx, my, 16, lab === '焦黑'); });
    const en = G.plate.length > 0;
    shaker('salt', X, 410, L('胡椒鹽 Z', 'Salt Z'), '#e9dfc8', '#6b5a44', G.season.salt, en);
    shaker('spicy', X + 78, 410, L('辣粉+5 X', 'Chili+5 X'), '#c8321f', '#7a1a10', G.season.spicy, en);
    shaker('basil', X + 156, 410, L('九層塔 C', 'Basil+3 C'), '#3f8f3a', '#1f4f1c', G.season.basil, en);
    btn('dump', X, 468, 230, 46, '倒掉', A.dump, { enabled: en, color: '#6b4226', size: 15 });
    const canBag = c && en && c.atCounter > 0.6;
    if (c && c.atCounter > 0.5) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(X, 592, 230, 112, 10); ctx.fill(); text('📋', X + 14, 608, 14, '#ffd59a', 'center');
      // v43:這單 = 圖示格(✓ 盤上有 · 橘色脈動＋ 要你補 · 半透明 = 還在鍋裡)
      const need = c.order.items; const pk = G.plate.map(q => q.key), ml = mustLeft(c);
      need.slice(0, 10).forEach((k, i) => { const j = pk.indexOf(k); if (j >= 0) pk.splice(j, 1); const mi = ml.indexOf(k), must = j < 0 && mi >= 0; if (must) ml.splice(mi, 1);
        const cx2 = X + 22 + (i % 5) * 46, cy2 = 636 + Math.floor(i / 5) * 40;
        if (j < 0 && !must) ctx.globalAlpha = 0.45; iconBadge(k, 1, cx2, cy2, 30, j >= 0 ? 'done' : must ? 'need' : 'self'); ctx.globalAlpha = 1; });
      if (c.type !== 'regular') { jarIcon('salt', X + 150, 606, 18, true); jarIcon('spicy', X + 174, 606, 18, c.order.spicy); jarIcon('basil', X + 198, 606, 18, c.order.basil); } }
    const bagLabel = !c ? '🛍 裝袋(等客人)' : !en ? '🛍 裝袋(盤子空)' : c.atCounter <= 0.6 ? '🛍 裝袋(客人還沒到)' : '🛍 裝袋 (Enter)';
    btn('bag', X, 522, 230, 60, bagLabel, A.bag, { enabled: !!canBag, clickable: en && !!c, size: canBag ? 20 : 17 });
    if (G.bagHint > 0) G.bagHint -= 1 / 60;
  } else {
    const p = G.pay;
    // v42:逐項收據
    ctx.fillStyle = '#fbf6e9'; rr(X, 294, 230, 210, 6); ctx.fill();
    text('🧾', X + 14, 306, 13, '#7a4b00', 'center');
    const LL = []; (p.lines || []).forEach(([nm, v, key]) => { key = key || nm; const e = LL.find(q => q[0] === key); if (e) e[2]++; else LL.push([key, v, 1]); });
    const cols = LL.length > 6 ? 2 : 1, per = Math.ceil(LL.length / cols), lh = per > 6 ? 16 : 20;
    // v43:收據 = 圖示 × 單價(同品項合併成 ×n)
    LL.forEach(([key, v, n], i) => { const cx2 = X + 8 + Math.floor(i / per) * 112, cy2 = 324 + (i % per) * lh, cw2 = cols === 2 ? 104 : 214;
      if (key.startsWith('jar:')) jarIcon(key.slice(4), cx2 + 9, cy2, lh + 2, true); else foodIcon(key, cx2 + 9, cy2, lh + 4);
      text(`×${n}  $${v}`, cx2 + 22, cy2, 13, '#2b1a0e', 'left', 'normal'); text(`$${v * n}`, cx2 + cw2, cy2, 13, '#2b1a0e', 'right'); });
    let yy = 324 + per * lh + 2; ctx.fillStyle = '#c9b89a'; ctx.fillRect(X + 8, yy - 6, 214, 1.5);
    ctx.font = `bold 11px ${FONT}`; const nums = (p.lines || []).map(l => l[1]); let f = nums.join('+') + ` = $${p.price}`; for (let m = nums.length - 1; m > 1 && ctx.measureText(f).width > 214; m--) f = nums.slice(0, m).join('+') + '+… = $' + p.price;
    text(f, X + 8, yy + 4, 11, '#5a3a00'); yy += 20;
    if (p.missNames && p.missNames.length) { text(L(`少給 ${p.missNames.join('、')} 不收`, `missing ${p.missNames.length}: $0`), X + 8, yy, 11, '#c1121f', 'left', 'normal'); yy += 15; }
    if (p.offer < p.price) { text(p.sat < 40 ? L(`品質差(滿意${p.sat}) → 客人只出`, `😠 bad food (${p.sat}) → offer`) : L('客人殺價', '🤏 haggle'), X + 8, yy, 12, '#c1121f'); text(`$${p.offer}`, X + 222, yy, 13, '#c1121f', 'right'); yy += 16; }
    if (p.tip) { text(L(`小費(滿意度 ${p.sat})`, `😄 tip (${p.sat})`), X + 8, yy, 12, '#1f7a3f'); text(`+${p.tip}`, X + 222, yy, 13, '#1f7a3f', 'right'); yy += 16; }
    coinIcon(X + 18, 492, 22); text(`$${p.price}`, X + 34, 492, 22, '#c0392b');
    if (p.offer < p.price) {
      const mid = Math.round((p.offer + p.price) / 2 / 5) * 5;
      btn('payAccept', X, 510, 230, 44, `🤝 ${L('成交', 'Accept')} $${p.offer}`, A.payAccept, { color: '#2a6f6a' });
      btn('payMid', X, 558, 230, 44, `½ ${L('讓一半', 'Meet halfway')} $${mid}`, A.payMid, { enabled: !p.midTried, color: '#6b4226' });
      btn('payInsist', X, 606, 230, 44, `✊ ${L('堅持', 'Insist')} $${p.price}${L('(可能氣走)', ' (risky)')}`, A.payInsist, { size: 16 });
      btn('refuse', X, 654, 230, 44, '不賣了', A.refuse, { color: '#4a4a4a' });
    } else btn('payFull', X, 516, 230, 80, `💰 ${L('收錢', 'Take')} $${p.price}${p.tip ? ` +${L('小費', 'tip ')}${p.tip}` : ''}`, A.payFull, { color: '#2a6f6a', size: p.tip ? 20 : 26 });
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
  const g = ctx.createLinearGradient(x - R, y - R, x + R, y + R); g.addColorStop(0, '#f4f6f8'); g.addColorStop(0.5, '#aab1b9'); g.addColorStop(1, '#6e767e');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, R, R * 0.86, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#9aa1a9'; ctx.beginPath(); ctx.ellipse(x, y, R - 6, (R - 6) * 0.86, 0, 0, 7); ctx.fill();
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
function ITEM_RECT(k) { const meat = MENU.filter(isMeat), veg = MENU.filter(m => !isMeat(m));
  let i = meat.indexOf(k); if (i >= 0) return { x: 18 + (i % 2) * 114, y: 287 + Math.floor(i / 2) * 48, w: 110, h: 45 };
  i = veg.indexOf(k); if (i >= 0) return { x: 17 + (i % 3) * 76, y: 439 + Math.floor(i / 3) * 42, w: 74, h: 39 }; return null; }
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
  { const ml = mustLeft(c); if (ml.length && !G.plate.length) return H(L('點橘框的料加進盆', 'Tap orange items to add'), countEnts(ml, 'need').map(e => ['food', e[0], 'need', e[1]]).concat([['arrow'], ['bowl']]), [ITEM_POS(ml[0])]); }
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
  // 菜單夾:橫向不鏽鋼夾條,每位客人(櫃台+排隊)一張單
  const y0 = 46, RX = 708;
  ctx.fillStyle = 'rgba(12,8,5,0.88)'; ctx.fillRect(RX, 44, W - RX, 96);
  const mg = ctx.createLinearGradient(0, y0, 0, y0 + 10); mg.addColorStop(0, '#d9dde2'); mg.addColorStop(1, '#7d848c');
  ctx.fillStyle = mg; rr(RX + 6, y0, W - RX - 12, 10, 4); ctx.fill();
  const list = (G.counter ? [G.counter] : []).concat(G.queue);
  if (!list.length) text(L('(菜單夾是空的 — 客人點單會夾在這裡)', '(order rail empty)'), (RX + W) / 2, 96, 15, '#9c8a72', 'center', 'normal');
  const now = performance.now() / 1000;
  ctx.save(); ctx.beginPath(); ctx.rect(RX, 36, W - RX, 106); ctx.clip();
  list.slice(0, 3).forEach((c, i) => {
    const born = c.railBorn ?? (c.railBorn = now); const k = clamp((now - born) * 3, 0, 1);
    const x = RX + 12 + i * 164 + (1 - k) * 220, y = y0 + 6, w = 156, h = 84;
    const ratio = clamp(c.patience / c.max, 0, 1), atC = c === G.counter;
    const col = ratio > 0.6 ? '#2a9d55' : ratio > 0.3 ? '#e98a00' : '#d62828';
    ctx.save(); ctx.translate(x + w / 2, y); ctx.rotate((i % 2 ? 1 : -1) * 0.012); ctx.translate(-x - w / 2, -y);
    ctx.fillStyle = '#fbf6e9'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.06)'; for (let ly = y + 30; ly < y + h - 8; ly += 14) ctx.fillRect(x + 4, ly, w - 8, 1);
    const blink = ratio < 0.3 && Math.sin(now * 10) > 0;
    ctx.strokeStyle = atC ? '#d4a017' : col; ctx.lineWidth = atC ? 4 : blink ? 4 : 2; ctx.strokeRect(x, y, w, h);
    // 夾子
    ctx.fillStyle = '#5c636a'; rr(x + w / 2 - 14, y - 8, 28, 12, 3); ctx.fill();
    // 臉
    const im = IMG['c_' + (c.revealed ? 'inspector_revealed' : c.type)];
    ctx.save(); ctx.beginPath(); ctx.arc(x + 18, y + 18, 14, 0, 7); ctx.clip();
    if (im) ctx.drawImage(im, im.width * 0.28, im.height * 0.02, im.width * 0.44, im.width * 0.44, x + 4, y + 4, 28, 28); else { ctx.fillStyle = '#f6d5b5'; ctx.fillRect(x + 4, y + 4, 28, 28); }
    ctx.restore();
    text(atC ? L('櫃台', 'NOW') : `#${i + (G.counter ? 0 : 1)}`, x + 36, y + 12, 12, atC ? '#a67c00' : '#6c5a45');
    const sec = atC ? c.patience : c.patience / 0.4;
    text(`⏱${Math.max(0, Math.ceil(sec))}`, x + w - 6, y + 12, 12, col, 'right');
    // v43 品項 = 圖示(一般=客人自己撿 · 橘色脈動＋=要你補 · 綠✓=補好 · 紅✗=缺貨)
    const short = shortItems(c);
    if (c.type === 'regular' && !c.swapped && !c.handed) { text('?', x + 40, y + 46, 18, '#2b1a0e'); arrowSmall(x + 56, y + 46); text('📒', x + 84, y + 46, 18, '#2b1a0e'); }
    else {
      const ml = atC ? countBy(mustLeft(c)) : {}, addC = countBy(c.handed ? c.need : (c.order.add || []).concat(c.order.items.filter(k => ITEMS[k].vendor && !(c.order.add || []).includes(k))));
      const ents = []; const pc = countBy(c.order.items);
      Object.keys(pc).forEach(kk => { const a = Math.min(pc[kk], addC[kk] || 0), sp = pc[kk] - a; if (sp) ents.push([kk, sp, short.includes(kk) ? 'short' : 'self']); if (a) ents.push([kk, a, short.includes(kk) ? 'short' : ml[kk] ? 'need' : c.handed && atC ? 'done' : 'need']); });
      const tot = sz => ents.reduce((t, e) => t + sz + (e[1] > 1 ? sz * 0.35 : 0) + 4, 0);
      let s2 = 30; while (s2 > 16 && tot(s2) > w - 14) s2 -= 2;
      iconRow(ents, x + 8, y + 50, s2, 4, w - 12);
    }
    if (c.type !== 'regular') { jarIcon('spicy', x + 12, y + h - 13, 18, c.order.spicy); jarIcon('basil', x + 32, y + h - 13, 18, c.order.basil); }
    else text('?', x + 10, y + h - 14, 12, '#555');
    if (c.type === 'byo') text('BYO', x + 46, y + h - 14, 9, '#7b5ea7');
    ctx.fillStyle = '#ddd'; ctx.fillRect(x + 70, y + h - 18, w - 76, 8); ctx.fillStyle = col; ctx.fillRect(x + 70, y + h - 18, (w - 76) * ratio, 8);
    ctx.restore();
  });
  ctx.restore();
  if (list.length > 3) text(`+${list.length - 3}`, W - 8, 130, 18, '#ffd166', 'right');
}

function infoBar(y) {
  text(`現金 $${Math.round(G.cash)}`, 60, y, 22, '#ffd166');
  text(`今晚攤租 $${G.rent}`, 260, y, 18, '#ffd59a');
  if (G.debt) text(`欠款 $${G.debt} → 今晚要還 $${Math.round(G.debt * 1.2)}(再付不出就收攤)`, 460, y, 16, '#ff6b6b');
  else text(`口碑 ${Math.round(G.rep)}`, 460, y, 18, '#ccc');
}

function drawTitle(time) {
  drawBackground(time, 'stall_front');
  ctx.fillStyle = 'rgba(10,5,3,0.78)'; rr(220, 170, 840, 520, 20); ctx.fill();
  ctx.shadowColor = '#ff5a36'; ctx.shadowBlur = 24; text('夜市攤位 · 鹽酥雞攤', 640, 215, 48, '#ffcf6b', 'center'); ctx.shadowBlur = 0;
  text(`本金 $${START_CASH} · 每晚收攤付攤租(第 1 晚 $${rentFor(1)},之後每晚 +$80)`, 640, 262, 18, '#ffd59a', 'center', 'normal');
  const lines = ['① 開攤前「進貨」:錢花下去才有料,沒賣完的會隔夜不新鮮、甚至報廢', '② 客人自己撿好一盆料交給你;雞排、鹽酥雞和「再加一份」要你補進盆,按鐵盆(V)下鍋,綠色時點網子撈起', '③ 胡椒鹽 Z、辣粉 X、九層塔 C → 裝袋 Enter → 收錢:每份料單價逐項加總(小心殺價)', '④ 缺貨時可以道歉換單,或請客人離開;收攤後付攤租,付不出就欠債', '⑤ 賺到錢去「設備店」升級:更多方籃、冰箱、濾油機、霓虹招牌…', '連續兩晚付不出攤租 → 攤位被收回。能撐幾晚?'];
  lines.forEach((l, i) => text(l, 270, 305 + i * 34, 17, i === 5 ? '#ffd166' : '#f3e6d0', 'left', 'normal'));
  const sv = loadSave(true);
  if (sv) { btn('continue', 400, 540, 230, 60, `繼續 第 ${sv.night} 晚`, A.cont, { size: 24 }); btn('newRun', 650, 540, 230, 60, '重新開始', A.newRun, { size: 22, color: '#6b4226' });
    text(`存檔:現金 $${Math.round(sv.cash)}${sv.debt ? ` · 欠 $${sv.debt}` : ''} · 升級 ${sv.upgrades.length} 項`, 640, 625, 15, '#bbb', 'center', 'normal'); }
  else btn('start', 540, 550, 200, 60, '開始進貨', A.start, { size: 24 });
}

function drawStock(time) {
  drawBackground(time, 'bg_mid');
  ctx.fillStyle = 'rgba(10,5,3,0.9)'; rr(30, 20, 1220, 680, 18); ctx.fill();
  text(`第 ${G.night} 晚 · 開攤前進貨`, 60, 56, 30, '#ffcf6b');
  text(`小道消息:「${G.rumor}」`, 1220, 56, 15, '#ffd59a', 'right', 'normal');
  infoBar(96);
  const hd = ['食材', '一批', '進價/批', '售價/份', '保存', '庫存(新鮮/隔夜)', '', '今晚進了'];
  const cx = [60, 300, 390, 500, 600, 700, 900, 1080];
  if (MENU.length <= 7) hd.forEach((h, i) => text(h, cx[i], 136, 15, '#bba'));
  else text(L('v44 新料逐晚解鎖 · 橘=肉(大網) 綠=非肉(小網)', 'New items unlock nightly · orange=meat (big net) green=veg (small net)'), 60, 136, 15, '#bba', 'left', 'normal');
  MENU.forEach((k, r) => {
    const I = ITEMS[k], st = STOCK[k], v = G.inv[k], meat = isMeat(k);
    if (MENU.length > 7) { // 兩欄精簡列
      const col = r < Math.ceil(MENU.length / 2) ? 0 : 1, rr2 = col ? r - Math.ceil(MENU.length / 2) : r, X = 46 + col * 600, y = 166 + rr2 * 50;
      ctx.fillStyle = meat ? 'rgba(224,122,31,0.16)' : 'rgba(58,154,74,0.14)'; rr(X, y - 23, 588, 46, 8); ctx.fill();
      const fim = foodImg(k, false); if (fim) ctx.drawImage(fim, X + 6, y - 20, 40, 40); catBadge(X + 44, y - 14, 7, meat);
      text(NM(k), X + 56, y - 7, LANG === 'en' ? 14 : 17); text(`$${batchCost(k)}/${st.batch} · ${L('售', 'sell')} $${I.price}`, X + 56, y + 12, 12, '#ffd166', 'left', 'normal');
      const days = has('fridge') ? 2 : st.days; text(days >= 2 ? `${days} 晚` : '當晚', X + 250, y, 14, days >= 2 ? '#b7e4c7' : '#ff9f80');
      text(`${v.fresh} / ${v.old}`, X + 320, y, 17, v.fresh + v.old ? '#fff' : '#ff6b6b');
      btn('unbuy_' + k, X + 390, y - 18, 50, 36, '−', () => A.buy(k, -1), { enabled: !!G.buyLog[k], color: '#6b4226', size: 20 });
      btn('buy_' + k, X + 446, y - 18, 80, 36, `+${st.batch}`, () => A.buy(k, 1), { enabled: G.cash >= batchCost(k), color: '#2a6f6a', size: 16 });
      text(G.buyLog[k] ? `${G.buyLog[k]}` : '—', X + 556, y, 16, '#ffd166', 'center');
      return; }
    const y = 168 + r * 56;
    ctx.fillStyle = r % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)'; rr(46, y - 25, 1188, 52, 8); ctx.fill();
    const fim = foodImg(k, false); if (fim) ctx.drawImage(fim, 58, y - 22, 44, 44);
    text(I.name, 116, y, 20); if (I.vendor) text('攤家', 116, y + 18, 11, '#ff9f80', 'left', 'normal');
    text(`${st.batch} 份`, cx[1], y, 17); text(`$${batchCost(k)}`, cx[2], y, 17, '#ffd166'); text(`$${I.price}`, cx[3], y, 17, '#b7e4c7');
    const days = has('fridge') ? 2 : st.days; text(days >= 2 ? `${days} 晚` : '當晚', cx[4], y, 17, days >= 2 ? '#b7e4c7' : '#ff9f80');
    text(`${v.fresh} / ${v.old}`, cx[5], y, 20, v.fresh + v.old ? '#fff' : '#ff6b6b');
    if (v.old && !has('fridge')) text('隔夜料滿意度 -8', cx[5] + 70, y, 12, '#ffb703', 'left', 'normal');
    btn('unbuy_' + k, cx[6], y - 20, 60, 40, '−', () => A.buy(k, -1), { enabled: !!G.buyLog[k], color: '#6b4226', size: 22 });
    btn('buy_' + k, cx[6] + 70, y - 20, 100, 40, `+${st.batch}`, () => A.buy(k, 1), { enabled: G.cash >= batchCost(k), color: '#2a6f6a', size: 18 });
    text(G.buyLog[k] ? `${G.buyLog[k]} 批` : '—', cx[7], y, 18, '#ffd166');
  });
  const est = G.schedule.length;
  const tot = MENU.reduce((a, k) => a + G.inv[k].fresh + G.inv[k].old, 0);
  text(`預估今晚約 ${est} 位客人、平均每人約 3 樣(含雞排/鹽酥雞)≈ 需要 ${est * 3} 份。目前備料 ${tot} 份。`, 60, 570, 17, '#f3e6d0', 'left', 'normal');
  text(`今晚進貨已花 $${G.stats.buy}${has('bulk') ? '(批發價 -10%)' : ''}  ·  保存 1 晚的料(甜不辣、四季豆、魷魚)沒賣完收攤就報廢`, 60, 602, 15, '#bba', 'left', 'normal');
  btn('open', 980, 630, 240, 56, '開攤!(Enter)', A.open, { size: 24 });
}

function drawShop(time) {
  drawBackground(time, 'shop_upgrade');
  ctx.fillStyle = 'rgba(10,5,3,0.9)'; rr(30, 20, 1220, 680, 18); ctx.fill();
  text('阿伯的二手設備店', 60, 56, 30, '#ffcf6b');
  text(`每晚最多買 ${MAX_UPGRADES_PER_NIGHT} 項(今晚已買 ${G.boughtTonight})`, 1220, 56, 15, '#ffd59a', 'right', 'normal');
  infoBar(96);
  text(`明晚攤租 $${rentFor(G.night + 1)}${G.debt ? ` + 還欠款 $${Math.round(G.debt * 1.2)}` : ''} — 記得留進貨錢!`, 60, 128, 16, '#ff9f80', 'left', 'normal');
  UPGRADES.forEach((u, i) => {
    const x = 60 + (i % 2) * 590, y = 160 + Math.floor(i / 2) * 112, own = has(u.id);
    ctx.fillStyle = own ? 'rgba(6,214,160,0.12)' : 'rgba(255,255,255,0.07)'; rr(x, y, 570, 100, 10); ctx.fill();
    const ui = IMG['upg_' + u.id], ix = ui ? 92 : 18; if (ui) { const sc = 80 / Math.max(ui.width, ui.height); ctx.drawImage(ui, x + 50 - ui.width * sc / 2, y + 50 - ui.height * sc / 2, ui.width * sc, ui.height * sc); }
    text(u.name, x + ix, y + 28, 21, own ? '#06d6a0' : '#fff');
    text(u.desc, x + ix, y + 64, ui ? 13 : 15, '#ddd', 'left', 'normal');
    if (own) text('已安裝 ✓', x + 550, y + 50, 18, '#06d6a0', 'right');
    else btn('up_' + u.id, x + 400, y + 26, 150, 48, `$${u.price}`, () => A.buyUpgrade(u.id), { enabled: G.cash >= u.price && G.boughtTonight < MAX_UPGRADES_PER_NIGHT, color: '#2a6f6a', size: 20 });
  });
  btn('nextNight', 980, 630, 240, 56, `第 ${G.night + 1} 晚 → 進貨`, A.nextNight, { size: 22 });
}

function drawResults(time) {
  drawBackground(time, 'night_summary');
  ctx.fillStyle = 'rgba(10,5,3,0.88)'; rr(120, 40, 1040, 650, 20); ctx.fill();
  const s = G.stats;
  text(`第 ${G.night} 晚 收攤結算`, 640, 80, 34, '#ffcf6b', 'center');
  const rows = [['營收', s.revenue, '#fff'], ['小費', s.tips, '#fff'], ['獎勵', s.rewards, '#06d6a0'], ['罰款', -s.fines, '#ff6b6b'], ['開攤前進貨', -s.buy, '#ff9f80'], ['換油', -s.cost, '#ff9f80'], [`攤租${s.due > G.rent ? '+還欠款' : ''}(應付 $${s.due})`, -s.paid, '#ff9f80']];
  rows.forEach(([k, v, col], i) => { text(k, 170, 128 + i * 32, 18, '#e8dcc8', 'left', 'normal'); text(`${v >= 0 ? '+' : '-'}$${Math.abs(Math.round(v))}`, 560, 128 + i * 32, 18, col, 'right'); });
  ctx.fillStyle = '#8a5733'; ctx.fillRect(170, 352, 390, 2);
  text('今晚淨變化', 170, 378, 22, '#ffcf6b'); text(`${s.net >= 0 ? '+' : '-'}$${Math.abs(Math.round(s.net))}`, 560, 378, 26, s.net >= 0 ? '#ffd166' : '#ff6b6b', 'right');
  text(`手上現金 $${Math.round(G.cash)}`, 170, 414, 20, '#fff'); if (G.debt) text(`欠款 $${G.debt}(第 ${G.debtStrikes} 次)`, 560, 414, 18, '#ff6b6b', 'right');
  text(`沒賣完報廢:${G.spoiledList.length ? G.spoiledList.join('、') : '無'}${s.spoil ? `(損失 $${s.spoil})` : ''}`, 170, 448, 15, '#ffb703', 'left', 'normal');
  text(`鍋裡/盤上浪費 $${s.waste} · 缺貨流失 ${s.oos} 位`, 170, 474, 15, '#aa8877', 'left', 'normal');
  text(`評等 ${s.grade}`, 365, 528, 46, { S: '#ffd166', A: '#06d6a0', B: '#9ad1ff', C: '#ff6b6b' }[s.grade], 'center');
  text(`服務 ${s.served} · 滿意 ${s.happy} · 生氣 ${s.angry} · 流失 ${s.lost}`, 170, 578, 16, '#ccc', 'left', 'normal');
  text(`口碑 ${Math.round(G.repStart)} → ${Math.round(G.rep)}`, 170, 606, 17, G.rep >= G.repStart ? '#06d6a0' : '#ff6b6b');
  text('今晚紀事', 640, 128, 19, '#ffd59a');
  G.log.slice(-13).forEach((l, i) => wrap(l, 640, 158 + i * 28, 480, 14, '#ddd', 18));
  if (G.gameOver) {
    ctx.fillStyle = 'rgba(120,10,10,0.85)'; rr(620, 540, 520, 80, 12); ctx.fill();
    text('GAME OVER', 880, 562, 26, '#fff', 'center'); text(G.gameOver, 880, 596, 15, '#ffd6d6', 'center', 'normal');
    btn('newRun', 760, 630, 240, 50, `重新開始(撐了 ${G.night} 晚)`, A.newRun, { size: 18 });
  } else btn('toShop', 860, 630, 260, 50, '收攤 → 設備店', A.toShop, { size: 22 });
}

function drawVol() {
  const S = window.SFX, lv = S ? S.level : 0, lab = !S || S.headless ? L('🔇 靜音', '🔇 Mute') : [L('🔇 靜音', '🔇 Mute'), '🔈 1', '🔉 2', '🔊 3'][lv] + ' M';
  btn('vol', 1200, 6, 74, 32, lab, () => sfx('cycleVolume'), { color: '#3b5b92', size: 13, on: false });
  btn('lang', 1130, 6, 64, 32, LANG === 'en' ? 'EN→中' : '中→EN', () => setLang(LANG === 'en' ? 'zh' : 'en'), { color: '#6b4226', size: 13 }); // v43 語言切換
}
function render(time) {
  buttons = [];
  ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0); ctx.imageSmoothingEnabled = false;
  ctx.save();
  if (G.shake > 0) ctx.translate(rand(-6, 6) * G.shake * 4, rand(-4, 4) * G.shake * 4);
  if (G.phase === 'title') drawTitle(time);
  else if (G.phase === 'results') drawResults(time);
  else if (G.phase === 'stock') drawStock(time);
  else if (G.phase === 'shop') drawShop(time);
  else {
    drawScene(time); drawStation(); drawHUD();
    if (G.t >= G.dayLen) { text('— 收攤時間,服務完排隊的客人 —', 470, 100, 18, '#ffcf6b', 'center'); }
  }
  drawVol();
  G.popups.forEach(p => { ctx.globalAlpha = clamp(p.life, 0, 1); text(p.text, p.x, p.y, 24, p.color, 'center'); ctx.globalAlpha = 1; });
  // 暈影
  const vg = ctx.createRadialGradient(640, 360, 300, 640, 360, 800); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
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
window.__game = { mustLeft: () => mustLeft(G.counter), get state() { return G; }, get buttons() { return buttons.map(({ onClick, ...b }) => b); }, A, ITEMS, SELF_MENU, MENU, step: (dt) => { update(dt); render(performance.now() / 1000); } };
requestAnimationFrame(frame);
})();
