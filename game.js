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
['chicken','tempura','riceblood','bean','mushroom','squid','byo'].forEach(k => { loadImg('raw_' + k, `assets/food_${k}_raw.png`); loadImg('fr_' + k, `assets/food_${k}_fried.png`); });
loadImg('burnt', 'assets/food_burnt.png'); loadImg('bigNet', 'assets/basket_big.png'); loadImg('smallNet', 'assets/basket_small.png');
loadImg('tank2', 'assets/fryer_tank.png'); loadImg('uiCash', 'assets/ui_cash.png'); loadImg('uiRep', 'assets/ui_rep.png');
loadImg('bowl_salt', 'assets/bowl_pepper.png'); loadImg('bowl_spicy', 'assets/bowl_chili.png'); loadImg('bowl_basil', 'assets/food_basil_fried.png'); loadImg('scissorsP', 'assets/scissors.png'); loadImg('bagP', 'assets/food_bag.png'); loadImg('cashTray', 'assets/cash_tray.png');
['stall_front','bg_mid','shop_upgrade','night_summary'].forEach(k => loadImg('sc_' + k, `assets/scene_${k}.jpg`));
['bigNet','smallNet','fridge','filter','neon','fan','bulk'].forEach(k => loadImg('upg_' + k, `assets/upg_${k}.png`));
const sfx = (n, ...a) => { const S = window.SFX; if (S && S[n]) S[n](...a); };
const foodImg = (k, fried = true) => IMG[(fried ? 'fr_' : 'raw_') + k] || IMG['f_' + (IMG_ALIAS[k] || k)];
const IMG_ALIAS = { byo: 'mushroom' };

// ---------- 狀態 ----------
let G;
const SAVE_KEY = 'yansuji_save_v2';
function has(u) { return G.upgrades.includes(u); }
function newGame() {
  G = {
    phase: 'title', night: 1, cash: START_CASH, debt: 0, debtStrikes: 0, rep: 60, upgrades: [],
    inv: Object.fromEntries(MENU.map(k => [k, { fresh: 0, old: 0 }])),
    regularOrder: { items: ['chicken', 'tempura', 'bean'], spicy: true, basil: true },
    best: 0, gameOver: '', boughtTonight: 0, hasSave: !!loadSave(true),
    popups: [], particles: [], shake: 0,
  };
  newNight();
}
function newNight() {
  Object.assign(G, {
    t: 0, dayLen: 180, grace: 45, repStart: G.rep, cashStart: G.cash, debtStart: G.debt, endBanner: false, pendingSick: false,
    queue: [], counter: null, walkers: [], baskets: basketLayout(), fryer: null, lastLine: null, fullFlash: 0, plate: [],
    temp: 150, tempKey: 'mid', oilUse: 0, oilChange: 0,
    season: { salt: false, spicy: false, basil: false }, cuts: 0, cutsNeed: 0, // v36: 剪的步驟已移除
    pay: null, schedule: [], nextId: 1, boughtTonight: 0, buyLog: {},
    rumorId: Math.floor(rng() * RUMORS.length),
    stats: { revenue: 0, tips: 0, cost: 0, buy: 0, spoil: 0, waste: 0, fines: 0, rewards: 0, served: 0, lost: 0, happy: 0, angry: 0, oos: 0 },
    log: [], hintT: 0, endReason: '', basket: [], lastServed: [],
  });
  G.fryer = Array(G.baskets.length).fill(null);
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
    Object.assign(G, { night: d.night, cash: d.cash, debt: d.debt, debtStrikes: d.debtStrikes, rep: d.rep, upgrades: (d.upgrades || []).map(u => u === 'baskets' ? 'bigNet' : u), inv: d.inv, regularOrder: d.regularOrder, best: d.best || 0 });
    newNight(); G.phase = d.phase === 'shop' ? 'shop' : 'stock'; return d; } catch (e) { return null; }
}
// ---------- 油槽格子(俯視 6×3) ----------
// 固定 9 個網位:大網 2×2 佔上兩排(編號 1–3),小網 1×1 在最下排(編號 4–9)。
// 滿配 3 大 + 6 小 = 12 + 6 = 18 格,正好填滿 6×3。升級只「解鎖」網位,不重排、不改編號。
const GRID = { x: 266, y: 304, cols: 6, rows: 3, cw: 124, ch: 116 };
const STRIP = { y0: 46, y1: 264, base: 256, x1: 700 }, COUNTER_X = 660; // 客人走上前的街景條
function basketLayout() {
  const L = [0, 2, 4].map((c, i) => ({ s: 'L', c, r: 0, locked: i === 2 && !has('bigNet'), up: 'bigNet' }));
  for (let c = 0; c < 6; c++) L.push({ s: 'S', c, r: 2, locked: c >= 4 && !has('smallNet'), up: 'smallNet' });
  return L;
}
function cellRect(b) { const n = b.s === 'L' ? 2 : 1; return { x: GRID.x + b.c * GRID.cw + 4, y: GRID.y + b.r * GRID.ch + 4, w: n * GRID.cw - 8, h: n * GRID.ch - 8 }; }
function slotRect(i) { return cellRect(G.baskets[i]); }
function freeBasket(k) {
  const big = ITEMS[k].size === 'L', free = s => G.baskets.findIndex((b, j) => b.s === s && !b.locked && !G.fryer[j]);
  if (big) return free('L');
  const i = free('S'); return i >= 0 ? i : free('L');
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
// ---- 庫存 ----
function stockOf(k) { const v = G.inv[k]; return v ? v.fresh + v.old : 99; }
function availFor(k) { return stockOf(k) + G.fryer.filter(it => it && it.key === k).length + G.plate.filter(it => it.key === k).length; }
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
  if (type === 'regular') return { ...G.regularOrder, items: [...G.regularOrder.items] };
  if (type === 'byo') return { items: ['byo', 'byo'], spicy: rng() < 0.5, basil: false };
  const n = type === 'student' ? 1 + (rng() < 0.4 ? 1 : 0) : type === 'aunt' ? 3 + (rng() < 0.5 ? 1 : 0) : 1 + Math.floor(rng() * 3);
  const items = []; for (let i = 0; i < n; i++) { let k = pick(MENU); if (stockOf(k) <= (countBy(items)[k] || 0)) { const ok = MENU.filter(m => stockOf(m) > (countBy(items)[m] || 0)); if (ok.length && rng() < 0.7) k = pick(ok); } items.push(k); }
  items.sort((a, b) => MENU.indexOf(a) - MENU.indexOf(b));
  return { items, spicy: rng() < 0.5, basil: rng() < 0.4 };
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
    c.order.items.sort((a, b) => MENU.indexOf(a) - MENU.indexOf(b));
    c.swapped = true; c.noTip = true; c.patience -= c.max * 0.3; c.line = '沒有喔…好啦,那換這些。'; addLog('缺貨,跟客人道歉換單'); },
  sendAway() { const c = G.counter; if (!c) return; G.stats.lost++; G.stats.oos++; changeRep(-2); addLog('缺貨,客人沒買就走了(口碑 -2)'); leave(c, '沒有?那不用了。', true); resetPrep(); },
  // 點食材 = 直接下鍋到第一個空格
  drop(k) {
    if (G.oilChange > 0) { popup('換油中,等一下', 640, 560, '#ff6b6b'); return; }
    const i = freeBasket(k);
    if (i < 0) { G.fullFlash = 0.6; G.fullSize = ITEMS[k].size;
      popup(ITEMS[k].size === 'L' ? `大網都在用!${ITEMS[k].name}要大網` : '網子都滿了!先撈起', 640, 420, '#ff6b6b'); return; }
    let old = false;
    if (G.inv[k]) { const v = G.inv[k]; if (v.old > 0) { v.old--; old = true; } else if (v.fresh > 0) v.fresh--; else { popup(`${ITEMS[k].name} 缺貨!`, 130, 420, '#ff6b6b'); return; } }
    G.fryer[i] = { key: k, d: 0, cold: 0, age: 0, old, cid: G.counter ? G.counter.id : 0, cue: 0 }; sfx('drop');
    G.oilUse += has('filter') ? 0.6 : 1; G.temp -= 3;
    const p = slotRect(i); for (let j = 0; j < 10; j++) G.particles.push({ x: p.x + rand(10, p.w - 10), y: p.y + rand(10, p.h - 10), vx: rand(-10, 10), vy: rand(-60, -20), life: rand(0.4, 0.9), c: 'rgba(255,255,255,0.5)' });
  },
  setTemp(k) { G.tempKey = k; },
  lift(i) {
    const it = G.fryer[i]; if (!it) return;
    sfx('lift');
    if (it.d >= 100) { G.fryer[i] = null; G.stats.waste += ITEMS[it.key].cost; popup('焦掉了!丟掉', 640, 420, '#ff6b6b'); return; }
    if (G.plate.length >= 8) { popup('盤子滿了', 1150, 420, '#ff6b6b'); return; }
    G.fryer[i] = null; G.plate.push(it);
  },
  liftAll() { G.fryer.forEach((it, i) => { if (it && it.d >= ITEMS[it.key].lo && it.d < 100) A.lift(i); }); }, // 只撈「剛好/快焦」的
  changeOil() {
    if (G.fryer.some(Boolean) || G.oilChange > 0) return;
    if (G.cash < OIL_CHANGE_COST) { popup('現金不夠換油', 640, 560, '#ff6b6b'); return; }
    G.cash -= OIL_CHANGE_COST; G.stats.cost += OIL_CHANGE_COST; G.oilUse = 0; G.oilChange = 4; G.temp = 120; addLog('換了一鍋新油(-$150)');
  },
  toggle(s) { if (G.plate.length && !G.pay) G.season[s] = !G.season[s]; },
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

function resetPrep() { G.season = { salt: false, spicy: false, basil: false }; G.cuts = 0; G.pay = null; }

function settle() {
  const c = G.counter, o = c.order; const need = countBy(o.items);
  const served = []; const rest = [];
  G.plate.forEach(it => { if (need[it.key] > 0) { need[it.key]--; served.push(it); } else rest.push(it); });
  const missing = Object.values(need).reduce((a, b) => a + b, 0);
  let sat = 100; const notes = [];
  served.forEach(it => {
    const [lab] = doneLabel(it);
    if (lab === '生') { sat -= 50; notes.push(`${ITEMS[it.key].name}是生的`); }
    else if (lab === '半生') { sat -= 25; notes.push(`${ITEMS[it.key].name}沒熟透`); }
    else if (lab === '太老') { sat -= 18; notes.push(`${ITEMS[it.key].name}炸太老`); }
    if (it.cold > 0.5) { sat -= 10; notes.push(`${ITEMS[it.key].name}油膩`); }
    if (it.old && !has('fridge')) { sat -= 8; notes.push(`${ITEMS[it.key].name}不太新鮮`); }
  });
  if (missing) { sat -= 35 * missing; notes.push(`少了${missing}樣`); }
  if (!G.season.salt) { sat -= 15; notes.push('沒灑胡椒鹽'); }
  if (G.season.spicy !== o.spicy) { sat -= 20; notes.push(o.spicy ? '忘了加辣' : '我不吃辣!'); }
  if (G.season.basil !== o.basil) { sat -= 12; notes.push(o.basil ? '沒有九層塔' : '不要九層塔啦'); }
  if (c.patience / c.max < 0.3) sat -= 10;
  sat = clamp(sat, 0, 100);
  let price = served.reduce((a, it) => a + ITEMS[it.key].price, 0);
  if (G.season.spicy && o.spicy) price += SEASON_PRICE.spicy;
  if (G.season.basil && o.basil) price += SEASON_PRICE.basil;
  const ct = CTYPES[c.type];
  let offer = price;
  if (sat < 40) { offer = Math.round(price * 0.5); c.line = '這樣也敢收全價?' + (notes[0] ? `(${notes[0]})` : ''); }
  else if (rng() < ct.haggle + (G.rumorId === 1 ? 0.15 : 0)) { offer = Math.round(price * rand(...ct.offer) / 5) * 5; c.line = c.type === 'aunt' ? `算 $${offer} 啦,好不好~` : `$${offer} 啦,便宜一點~`; }
  else c.line = sat >= 80 ? pick(LINES.happy) : notes.length ? `嗯…${notes[0]}。` : pick(LINES.ok);
  G.pay = { price, offer: Math.min(offer, price), sat, notes, matchedCost: served.reduce((a, it) => a + ITEMS[it.key].cost, 0), midTried: false };
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
  let tip = 0;
  if (c.noTip) {} else if (c.type === 'drunk' && rng() < 0.2) { tip = 20; c.line = '嗝…不用找了!'; }
  if (!c.noTip && p.sat >= 90 && (c.type === 'regular' || rng() < 0.4)) tip += c.type === 'regular' ? 10 : 5;
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
  c.line = line; c.angry = angry; G.lastLine = { who: c.revealed ? '衛生局稽查員' : CTYPES[c.type].label, text: line, angry, t: 2.5 }; G.walkers.push({ c, x: c.x || COUNTER_X, dir: -1, sayT: 1.8 }); G.counter = null;
}

// ---------- 更新 ----------
function update(dt) {
  G.popups.forEach(p => { p.life -= dt; p.y -= 30 * dt; }); G.popups = G.popups.filter(p => p.life > 0);
  G.particles.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }); G.particles = G.particles.filter(p => p.life > 0);
  G.shake = Math.max(0, G.shake - dt);
  sfx('tick', dt / SPEED, G.phase === 'open' ? G.fryer.filter(Boolean).length : 0, G.temp, G.phase === 'open' && G.oilChange <= 0);
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
  G.fryer.forEach((it, i) => { if (!it) return;
    const I = ITEMS[it.key], p = slotRect(i);
    if (it.d < 100) {
      const f = clamp(1 + (G.temp - I.ideal) / 35, 0.15, 2.2) * (oldOil ? 1.15 : 1);
      it.d = Math.min(100, it.d + 100 / I.time * f * dt * 0.95);
      const cue = it.d >= 100 ? 3 : it.d > I.hi - (I.hi - I.lo) * 0.15 ? 2 : it.d >= I.lo ? 1 : 0; // 1=剛好 2=快焦預警 3=焦
      if (cue > (it.cue || 0)) { it.cue = cue; sfx(['', 'done', 'warn', 'burnt'][cue]); }
      if (G.temp < I.ideal - 18) it.cold += dt / I.time; // 低溫吸油
    } else if (rng() < dt * 3) G.particles.push({ x: p.x + rand(10, p.w - 10), y: p.y + p.h / 2, vx: rand(-5, 5), vy: -40, life: 1.4, c: 'rgba(60,60,60,0.6)' });
    if (rng() < dt * 4) G.particles.push({ x: p.x + rand(8, p.w - 8), y: p.y + rand(8, p.h - 8), vx: 0, vy: rand(-30, -10), life: rand(0.3, 0.8), c: 'rgba(255,240,200,0.5)' });
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
    if (c.type === 'drunk' && !c.changed && c.atCounter > 6 && !G.pay) {
      c.changed = true; const i = Math.floor(rng() * c.order.items.length); c.order.items[i] = pick(MENU.filter(k => k !== c.order.items[i]));
      c.line = LINES.drunkChange; popup('改單了!', 900, 230, '#ffb703');
    }
    if (c.patience <= 0) { G.stats.lost++; G.stats.angry++; changeRep(-2); addLog(`${CTYPES[c.type].label}等太久,生氣走了`); leave(c, pick(LINES.angry.slice(1)), true); resetPrep(); }
  }
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
  G.fryer.filter(Boolean).concat(G.plate).forEach(it => G.stats.waste += ITEMS[it.key].cost); G.fryer = G.fryer.map(() => null); G.plate = [];
  if (G.pendingSick) { changeRep(-6); addLog('有客人吃了來路不明的自備料,上網爆料!口碑 -6'); }
  // 隔夜耗損:保存 1 晚的剩料報廢;保存 2 晚的變「隔夜料」,原本的隔夜料報廢。冰箱:全部多留一晚。
  const spoiled = [];
  MENU.forEach(k => { const v = G.inv[k], days = has('fridge') ? 2 : STOCK[k].days;
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
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  ctx.restore();
}
function lighten(c) { return c === '#c0392b' ? '#e04a3a' : c === '#2a6f6a' ? '#36908a' : c === '#6b4226' ? '#8a5733' : c === '#3b5b92' ? '#4c74b8' : '#888'; }
const mouse = { x: -1, y: -1 };
function toCanvas(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
cv.addEventListener('pointermove', e => Object.assign(mouse, toCanvas(e)));
cv.addEventListener('pointerdown', e => { e.preventDefault(); Object.assign(mouse, toCanvas(e));
  const p = toCanvas(e);
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
    j: () => { if (G.counter && G.counter.type === 'byo') A.drop('byo'); },
    '1': () => A.lift(0), '2': () => A.lift(1), '3': () => A.lift(2), '4': () => A.lift(3), '5': () => A.lift(4), '6': () => A.lift(5), '7': () => A.lift(6), '8': () => A.lift(7), '9': () => A.lift(8), o: A.changeOil, q: () => A.setTemp('low'), w: () => A.setTemp('mid'), e: () => A.setTemp('high'), ' ': A.liftAll, z: () => A.toggle('salt'), x: () => A.toggle('spicy'), c: () => A.toggle('basil'), enter: A.bag };
  if (m[k]) { m[k](); e.preventDefault(); }
});

// ---------- 繪圖 ----------
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function text(s, x, y, size = 18, color = '#fff8e7', align = 'left', weight = 'bold') {
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
  text(`第 ${G.night} 晚 · ${G.t < G.dayLen ? '營業中' : '收攤中'}`, 16, 22, 20, '#ffcf6b');
  text(`🕖 ${clockStr()}`, 200, 22, 20);
  ctx.fillStyle = '#3a2a20'; rr(300, 14, 220, 16, 8); ctx.fill();
  ctx.fillStyle = '#f4a261'; rr(300, 14, 220 * clamp(G.t / G.dayLen, 0, 1), 16, 8); ctx.fill();
  text(`剩 ${Math.ceil(left)} 秒`, 530, 22, 16, '#ddd');
  if (IMG.uiCash) ctx.drawImage(IMG.uiCash, 606, 12, 32, 18);
  text(`現金 $${Math.round(G.cash)}`, 640, 22, 20, G.cash >= G.rent ? '#ffd166' : '#ff8787');
  text(`收攤付租 $${G.rent}${G.debt ? ` +欠$${Math.round(G.debt * 1.2)}` : ''}`, 800, 22, 16, G.debt ? '#ff8787' : '#ccc');
  const stars = G.rep / 20; let st = ''; for (let i = 0; i < 5; i++) st += stars >= i + 0.5 ? '★' : '☆';
  if (IMG.uiRep) ctx.drawImage(IMG.uiRep, 958, 8, 28, 28);
  text(`口碑 ${st}`, 990, 22, 20, '#ffd166');
  text(`${Math.round(G.rep)}`, 1170, 22, 16, '#aaa');
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
  text('熟客筆記 · 戴帽子的大哥(老樣子)', 8, 13, 12, '#7a4b00');
  wrap(orderText(G.regularOrder.items), 8, 34, 208, 13, '#5a3a00', 17); text('要辣 + 九層塔', 8, 90, 13, '#a33');
  ctx.restore();
}
function drawStripBubble(c) {
  const x = 720, y = 146, w = 550, h = 112;
  ctx.fillStyle = '#fffaf0'; rr(x, y, w, h, 12); ctx.fill();
  if (!c || c.atCounter <= 0.5) {
    if (G.lastLine) { text(G.lastLine.who, x + 14, y + 18, 14, '#a33'); wrap(`「${G.lastLine.text}」`, x + 14, y + 46, w - 28, 17, G.lastLine.angry ? '#c1121f' : '#2a7d4f', 22); }
    else text(c ? '客人走過來了…' : G.queue.length ? '下一位客人走上前…' : '(等客人上門 — 他們會從左邊走過來)', x + w / 2, y + h / 2, 15, '#8a7a6a', 'center', 'normal');
    return;
  }
  ctx.beginPath(); ctx.moveTo(x, y + 50); ctx.lineTo(x - 22, y + 70); ctx.lineTo(x, y + 78); ctx.fill();
  const ratio = clamp(c.patience / c.max, 0, 1), col = ratio > 0.6 ? '#2a9d55' : ratio > 0.3 ? '#e98a00' : '#d62828';
  text(c.revealed ? '衛生局稽查員' : CTYPES[c.type].label, x + 14, y + 16, 15, '#a33');
  text(`耐心 ${Math.max(0, Math.ceil(c.patience))}s`, x + 130, y + 16, 13, col);
  ctx.fillStyle = '#ddd'; rr(x + 196, y + 12, 90, 8, 4); ctx.fill(); ctx.fillStyle = col; rr(x + 196, y + 12, 90 * ratio, 8, 4); ctx.fill();
  const short = !G.pay ? shortItems(c) : [];
  if (!G.pay && c.type !== 'regular' && !short.length) [c.order.spicy ? '要辣' : '不要辣', c.order.basil ? '加九層塔' : '不要塔'].forEach((t, i) => {
    ctx.fillStyle = i === 0 ? (c.order.spicy ? '#e63946' : '#6c757d') : (c.order.basil ? '#2a9d8f' : '#6c757d'); rr(x + w - 222 + i * 106, y + 4, 100, 24, 12); ctx.fill(); text(t, x + w - 172 + i * 106, y + 16, 13, '#fff', 'center'); });
  wrap(`「${c.line}」`, x + 14, y + 40, w - 28, 14, '#2b1a0e', 18);
  if (G.pay) {
    const p = G.pay; text(`滿意度 ${p.sat}`, x + 14, y + 92, 17, p.sat >= 80 ? '#2a9d8f' : p.sat >= 50 ? '#e9a400' : '#d62828');
    if (p.notes.length) wrap('問題:' + p.notes.slice(0, 3).join('、'), x + 120, y + 92, w - 134, 13, '#7a4b4b', 16);
  } else if (short.length) {
    ctx.fillStyle = 'rgba(214,40,40,0.12)'; rr(x + 6, y + 70, w - 12, 38, 8); ctx.fill();
    text(`缺:${short.map(k => ITEMS[k].name).join('、')}`, x + 14, y + 89, 14, '#d62828');
    btn('swapOrder', x + w - 252, y + 72, 120, 34, '🙇 道歉換單', A.swapOrder, { enabled: !c.swapped, color: '#2a6f6a', size: 13 });
    btn('sendAway', x + w - 126, y + 72, 118, 34, '請他離開(-2)', A.sendAway, { color: '#4a4a4a', size: 13 });
  } else {
    if (c.type === 'regular' && !c.swapped) text('點餐:老樣子(看左邊熟客筆記)', x + 14, y + 92, 15, '#555');
    else wrap('點餐:' + orderText(c.order.items), x + 14, y + 92, w - 140, 15, '#333', 18);
    if (c.type === 'byo' || c.sus) btn('report', x + w - 112, y + 74, 100, 32, '🚨 檢舉', A.report, { color: '#3b5b92', size: 14 });
  }
}

// ---------- 左欄:食材、油溫、換油、熟客筆記 ----------
function drawLeft() {
  panel(8, 266, 244, 446, '食材 — 點了就下鍋');
  const keys = [...MENU]; if (G.counter && G.counter.type === 'byo') keys.push('byo');
  keys.forEach((k, i) => {
    const bx = 16 + (i % 2) * 118, by = 292 + Math.floor(i / 2) * 64, I = ITEMS[k];
    const q = k === 'byo' ? 1 : stockOf(k), big = I.size === 'L';
    const noNet = G.oilChange <= 0 && q > 0 && freeBasket(k) < 0;
    btn('item_' + k, bx, by, 112, 60, '', () => A.drop(k), { color: '#6b4226', enabled: G.oilChange <= 0 && q > 0 });
    const fim = foodImg(k, false);
    if (fim) { ctx.save(); if (k === 'byo' && !IMG.raw_byo) ctx.filter = 'hue-rotate(60deg) saturate(0.6)'; if (noNet) ctx.globalAlpha = 0.45; ctx.drawImage(fim, bx + 3, by + 8, 42, 42); ctx.restore(); }
    text(I.name, bx + 48, by + 15, 15);
    ctx.fillStyle = big ? '#e07a1f' : '#3b7fb8'; rr(bx + 84, by + 30, 24, 16, 4); ctx.fill(); text(big ? '大' : '小', bx + 96, by + 38, 12, '#fff', 'center');
    text((k === 'byo' ? '代炸' : `$${I.price}`) + ' ' + 'ASDFGHJ'[i], bx + 48, by + 38, 11, '#ffd59a', 'left', 'normal');
    if (k !== 'byo' || noNet) { const v = G.inv[k] || { old: 0 }; const lab = q <= 0 ? '缺貨' : noNet ? `${big ? '大網滿' : '網滿'} 剩${k === 'byo' ? 1 : q}` : `剩${q}${v.old ? `(夜${v.old})` : ''}`;
      ctx.fillStyle = q <= 0 ? '#d62828' : noNet ? '#b5461f' : q <= 3 ? '#e9a400' : 'rgba(0,0,0,0.45)'; rr(bx + 46, by + 47, 62, 12, 4); ctx.fill(); text(lab, bx + 77, by + 53, 10, '#fff', 'center'); }
  });
  // 油溫
  const ty = 566; const old = G.oilUse > OIL_LIMIT;
  text(`油溫 ${Math.round(G.temp)}°C`, 18, ty, 18, G.temp > 182 ? '#ff8f6b' : G.temp < 155 ? '#9ad1ff' : '#ffd166');
  TEMPS.forEach((tp, i) => btn('temp_' + tp.key, 16 + i * 78, ty + 12, 72, 36, `${tp.name} ${'QWE'[i]}`, () => A.setTemp(tp.key), { on: G.tempKey === tp.key, color: '#2a6f6a', size: 14 }));
  text(`油況 ${old ? '老油!' : '新鮮'} ${Math.round(G.oilUse)}/${OIL_LIMIT}${has('filter') ? ' 濾油' : ''}`, 18, ty + 60, 14, old ? '#ff6b6b' : '#b7e4c7');
  btn('oil', 16, ty + 76, 228, 36, `換油 $${OIL_CHANGE_COST} (O,鍋要空)`, A.changeOil, { enabled: !G.fryer.some(Boolean) && G.oilChange <= 0, color: '#6b4226', size: 14 });
}

// ---------- 中央:俯視油槽 ----------
function drawTank() {
  const old = G.oilUse > OIL_LIMIT, now = performance.now() / 1000;
  const X = 258, Y = 266, TW = 760, TH = 446;
  const tankI = IMG.tank2 || IMG.tankTop;
  if (tankI) { ctx.save(); if (old) ctx.filter = 'brightness(0.7) sepia(0.6)'; ctx.drawImage(tankI, X - 6, Y - 4, TW + 12, TH + 8); ctx.restore();
    if (G.fryer.some(Boolean)) { ctx.fillStyle = `rgba(255,230,160,${0.05 + 0.03 * Math.sin(now * 9)})`; rr(X + 40, Y + 40, TW - 80, TH - 80, 10); ctx.fill(); } }
  else { ctx.fillStyle = '#6c7178'; rr(X, Y, TW, TH, 14); ctx.fill(); ctx.fillStyle = old ? '#6a440e' : '#c98a28'; rr(X + 10, Y + 10, TW - 20, TH - 20, 10); ctx.fill(); }
  if (G.fullFlash > 0) { ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 6; rr(X + 2, Y + 2, TW - 4, TH - 4, 14); ctx.stroke(); }
  // 提示條(油槽上緣)
  const h = hint(); ctx.fillStyle = 'rgba(10,6,4,0.8)'; rr(266, 271, 744, 28, 8); ctx.fill();
  if (h) text('💡 ' + h, 278, 285, 15, '#ffe8a3', 'left', 'normal');
  // 沒買的網位:可升級
  G.baskets.filter(b => b.locked).forEach(b => { const { x, y, w, h } = cellRect(b); const u = UPGRADES.find(q => q.id === b.up);
    ctx.fillStyle = 'rgba(20,12,6,0.55)'; rr(x, y, w, h, 10); ctx.fill();
    ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(255,230,180,0.45)'; ctx.lineWidth = 2; rr(x, y, w, h, 10); ctx.stroke(); ctx.setLineDash([]);
    text('🔒 可升級', x + w / 2, y + h / 2 - 12, b.s === 'L' ? 20 : 14, '#d8c8b0', 'center');
    text(b.s === 'L' ? `${u.name.split('(')[0]} $${u.price}` : `小網 $${u.price}/2個`, x + w / 2, y + h / 2 + 14, b.s === 'L' ? 15 : 11, '#a89a86', 'center', 'normal'); });
  const cid = G.counter && !G.pay ? G.counter.id : -1;
  for (let i = 0; i < G.fryer.length; i++) if (!G.baskets[i].locked) drawSlot(i, G.fryer[i], now, cid);
  if (G.oilChange > 0) { ctx.fillStyle = 'rgba(0,0,0,0.65)'; rr(400, 440, 476, 80, 12); ctx.fill(); text(`換油中… ${G.oilChange.toFixed(1)}s`, 638, 480, 30, '#fff', 'center'); }
  // 下緣控制條
  ctx.fillStyle = 'rgba(10,6,4,0.8)'; rr(266, 658, 744, 48, 10); ctx.fill();
  text('大網 2×2 放雞排/魷魚/杏鮑菇 · 小網 1×1 放小料(小網滿才用大網)', 280, 671, 13, '#d8c8b0', 'left', 'normal');
  const cnt = s => G.baskets.filter((b, j) => b.s === s && !b.locked && !G.fryer[j]).length;
  text('大網 1–3 · 小網 4–9 撈該網', 280, 693, 14, '#ffd59a', 'left', 'normal');
  text(`空大網 ${cnt('L')} · 空小網 ${cnt('S')}`, 500, 693, 15, G.fullFlash > 0 ? '#ff6b6b' : '#b7e4c7', 'left');
  btn('liftAll', 810, 662, 194, 40, '撈熟的(空白鍵)', A.liftAll, { enabled: G.fryer.some(it => it && it.d >= ITEMS[it.key].lo && it.d < 100), size: 16 });
}

function slotState(it) {
  const I = ITEMS[it.key];
  if (it.d >= 100) return { lab: '焦了', col: '#7a1010', fg: '#ff6b6b', burnt: true };
  if (it.d < I.lo) return { lab: it.d < 40 ? '生' : '半生', col: '#4f7fa8', fg: '#cfe6ff' };
  if (it.d <= I.hi) return { lab: '剛好!', col: '#21b36b', fg: '#eafff2', ready: true };
  { const t = clamp((it.d - I.hi) / Math.max(1, 100 - I.hi), 0, 1); return { lab: '快焦!', col: `rgb(${Math.round(240 - 20 * t)},${Math.round(140 - 100 * t)},${Math.round(40)})`, fg: '#ffe0d6', warn: true }; }
}
function drawSlot(i, it, now, cid) {
  const b = G.baskets[i], big = b.s === 'L', { x, y, w, h } = slotRect(i);
  ctx.fillStyle = it ? 'rgba(20,10,4,0.35)' : 'rgba(20,10,4,0.18)'; rr(x, y, w, h, 10); ctx.fill();
  const netI = (big ? IMG.bigNet : IMG.smallNet) || IMG.basketTop;
  if (netI) { ctx.save(); ctx.globalAlpha = it ? 0.8 : 0.95; ctx.drawImage(netI, x, y, w, h); ctx.restore(); }
  else { ctx.strokeStyle = '#c9ced4'; ctx.lineWidth = 3; rr(x + 3, y + 3, w - 6, h - 6, 8); ctx.stroke(); }
  // 鍵位徽章 + 網子尺寸
  const bs = big ? 30 : 24; ctx.fillStyle = '#ffd166'; rr(x + 6, y + 6, bs, bs, 6); ctx.fill(); text(String(i + 1), x + 6 + bs / 2, y + 6 + bs / 2, big ? 20 : 16, '#2b1a0e', 'center');
  ctx.fillStyle = big ? 'rgba(224,122,31,0.9)' : 'rgba(59,127,184,0.9)'; rr(x + bs + 10, y + 8, big ? 46 : 30, big ? 22 : 18, 5); ctx.fill();
  text(big ? '大網' : '小', x + bs + 10 + (big ? 23 : 15), y + 8 + (big ? 11 : 9), big ? 14 : 11, '#fff', 'center');
  if (!it) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(x + w / 2 - (big ? 70 : 34), y + h / 2 - 16, big ? 140 : 68, 32, 8); ctx.fill();
    text(big ? '空 · 放大料' : '空', x + w / 2, y + h / 2, big ? 17 : 15, '#e8d9c0', 'center');
    if (G.fullFlash > 0 && G.fullSize === 'L' && !big) { ctx.fillStyle = 'rgba(59,127,184,0.25)'; rr(x, y, w, h, 10); ctx.fill(); }
    return;
  }
  buttons.push({ id: 'lift_' + i, x, y, w, h, enabled: true, onClick: () => A.lift(i) });
  const I = ITEMS[it.key], st = slotState(it), k = clamp(it.d / 100, 0, 1);
  const blink = st.ready ? (Math.sin(now * Math.PI * 4) > 0) : st.warn ? (Math.sin(now * Math.PI * 8) > 0) : true;
  if (big && ITEMS[it.key].size === 'S') { ctx.fillStyle = 'rgba(224,122,31,0.85)'; rr(x + 6, y + 44, 120, 22, 5); ctx.fill(); text('小料佔用大網', x + 66, y + 55, 12, '#fff', 'center'); }
  // 這單 / 隔夜 標籤(右上)
  if (it.cid === cid) { ctx.fillStyle = '#4cc9f0'; rr(x + w - (big ? 58 : 40), y + 8, big ? 50 : 34, 20, 5); ctx.fill(); text('這單', x + w - (big ? 33 : 23), y + 18, big ? 13 : 11, '#06283d', 'center'); }
  if (it.old && !has('fridge')) text('隔夜', x + w - 10, y + (big ? 42 : 34), 12, '#ffb703', 'right');
  // 食材(俯視,依熟度變色)
  const fim = IMG['f_' + (IMG_ALIAS[it.key] || it.key)], s = big ? 118 : 44, cx = x + w / 2, cy = y + (big ? 100 : 50);
  const rawI = IMG['raw_' + it.key], frI = IMG['fr_' + it.key];
  const fit = (im, a, flt) => { if (!im) return; const sc = s / Math.max(im.width, im.height); ctx.save(); ctx.globalAlpha = a; if (flt) ctx.filter = flt; ctx.drawImage(im, cx - im.width * sc / 2, cy - im.height * sc / 2, im.width * sc, im.height * sc); ctx.restore(); };
  if (rawI && frI) { // 生→熟:生料圖淡出、炸好圖淡入;過熟變暗;焦了換焦黑圖
    if (it.d >= 100) fit(IMG.burnt || frI, 1, IMG.burnt ? '' : 'brightness(0.2)');
    else { const m = clamp(it.d / I.lo, 0, 1); fit(rawI, 1); if (m > 0) fit(frI, m, it.d > I.hi ? `brightness(${1 - 0.5 * (it.d - I.hi) / (100 - I.hi)}) sepia(0.3)` : ''); }
  } else if (fim) { ctx.save(); ctx.filter = it.d >= 100 ? 'brightness(0.18) grayscale(1)' : `brightness(${1.35 - 0.7 * k}) saturate(${0.6 + 0.6 * k})`; if (it.key === 'byo') ctx.filter += ' hue-rotate(60deg)'; ctx.drawImage(fim, cx - s / 2, cy - s / 2, s, s); ctx.restore(); }
  else { ctx.fillStyle = I.color; ctx.beginPath(); ctx.arc(cx, cy, s / 3, 0, 7); ctx.fill(); }
  if (it.d >= 100) { ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(cx - s / 2.4, cy - s / 2.4); ctx.lineTo(cx + s / 2.4, cy + s / 2.4); ctx.moveTo(cx + s / 2.4, cy - s / 2.4); ctx.lineTo(cx - s / 2.4, cy + s / 2.4); ctx.stroke(); }
  // 狀態外框
  ctx.strokeStyle = st.col; ctx.lineWidth = st.ready || st.warn ? (blink ? 7 : 3) : 3; rr(x, y, w, h, 10); ctx.stroke();
  // 狀態膠囊 + 倒數
  let sub = st.lab;
  if (!st.ready && !st.warn && it.d < 100) { const f = clamp(1 + (G.temp - I.ideal) / 35, 0.15, 2.2) * (G.oilUse > OIL_LIMIT ? 1.15 : 1); const sec = (I.lo - it.d) / (100 / I.time * f * 0.95); sub = big ? `${I.name} ${st.lab} ${sec.toFixed(1)}s` : `${st.lab} ${sec.toFixed(0)}s`; }
  else if (st.burnt) sub = big ? `焦了!按 ${i + 1} 丟掉` : '焦!丟';
  else if (big) sub = `${I.name} ${st.lab}`;
  const ph = big ? 34 : 24, py = y + h - (big ? 64 : 44);
  ctx.fillStyle = st.ready || st.warn || st.burnt ? st.col : 'rgba(20,30,45,0.85)'; rr(x + 6, py, w - 12, ph, 7); ctx.fill();
  text(sub, x + w / 2, py + ph / 2, big ? (st.ready || st.warn ? 20 : 16) : (st.ready || st.warn ? 14 : 12), '#fff', 'center');
  // 橫向熟度條:藍=未熟 綠=剛好 紅=快焦,白線=目前
  const bx = x + 8, by = y + h - (big ? 24 : 16), bw = w - 16, bh = big ? 14 : 9;
  ctx.fillStyle = '#1a1a1a'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = 'rgba(79,127,168,0.8)'; ctx.fillRect(bx, by, bw * I.lo / 100, bh);
  ctx.fillStyle = 'rgba(33,179,107,0.95)'; ctx.fillRect(bx + bw * I.lo / 100, by, bw * (I.hi - I.lo) / 100, bh);
  ctx.fillStyle = 'rgba(226,64,43,0.85)'; ctx.fillRect(bx + bw * I.hi / 100, by, bw * (1 - I.hi / 100), bh);
  ctx.fillStyle = '#fff'; ctx.fillRect(bx + bw * k - 2, by - 4, 4, bh + 8);
}

// ---------- 右欄:櫃台客人、起鍋盤、收銀 ----------
function drawRight() {
  panel(1026, 266, 246, 446, '');
  const c = G.counter, X = 1034;
  // 起鍋盤 / 收銀
  text(G.pay ? '收銀' : '起鍋盤 — 調味、裝袋', X, 284, 15, '#ffd59a');
  if (!G.pay) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(X, 296, 230, 112, 10); ctx.fill();
    if (!G.plate.length) text('(撈起的會放這裡)', X + 115, 352, 14, '#8a7a6a', 'center', 'normal');
    G.plate.forEach((it, i) => { const bx = X + 4 + (i % 2) * 113, by = 300 + Math.floor(i / 2) * 27; chip(it.key, bx, by, it.d, 108, 24);
      const [lab, col] = doneLabel(it); ctx.fillStyle = col; rr(bx + 74, by + 13, 34, 12, 4); ctx.fill(); text(lab, bx + 91, by + 19, 9, '#fff', 'center'); });
    const en = G.plate.length > 0;
    btn('salt', X, 416, 74, 44, '胡椒鹽 Z', () => A.toggle('salt'), { on: G.season.salt, enabled: en, color: '#6b4226', size: 12 });
    btn('spicy', X + 78, 416, 74, 44, '辣+5 X', () => A.toggle('spicy'), { on: G.season.spicy, enabled: en, color: '#6b4226', size: 12 });
    btn('basil', X + 156, 416, 74, 44, '九層塔 C', () => A.toggle('basil'), { on: G.season.basil, enabled: en, color: '#6b4226', size: 12 });
    btn('dump', X, 468, 230, 46, '倒掉', A.dump, { enabled: en, color: '#6b4226', size: 15 });
    const canBag = c && en && c.atCounter > 0.6;
    if (c && c.atCounter > 0.5) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(X, 592, 230, 112, 10); ctx.fill(); text('這單要的(✓=盤上有)', X + 8, 606, 13, '#ffd59a');
      const need = c.type === 'regular' && !c.swapped ? G.regularOrder.items : c.order.items; const pk = G.plate.map(q => q.key);
      need.forEach((k, i) => { const j = pk.indexOf(k); if (j >= 0) pk.splice(j, 1); text(`${j >= 0 ? '✓' : '·'} ${ITEMS[k].name}`, X + 10 + (i % 2) * 112, 628 + Math.floor(i / 2) * 20, 14, j >= 0 ? '#8ce99a' : '#d8c8b0'); }); }
    const bagLabel = !c ? '🛍 裝袋(等客人)' : !en ? '🛍 裝袋(盤子空)' : c.atCounter <= 0.6 ? '🛍 裝袋(客人還沒到)' : '🛍 裝袋 (Enter)';
    btn('bag', X, 522, 230, 60, bagLabel, A.bag, { enabled: !!canBag, clickable: en && !!c, size: canBag ? 20 : 17 });
    if (G.bagHint > 0) G.bagHint -= 1 / 60;
  } else {
    const p = G.pay;
    text(`應收 $${p.price}`, X + 4, 310, 24, '#ffd166');
    if (p.offer < p.price) {
      text(`客人開價 $${p.offer}`, X + 4, 342, 18, '#ff9f80');
      const mid = Math.round((p.offer + p.price) / 2 / 5) * 5;
      btn('payAccept', X, 362, 230, 48, `成交 $${p.offer}`, A.payAccept, { color: '#2a6f6a' });
      btn('payMid', X, 416, 230, 48, `讓一半 $${mid}`, A.payMid, { enabled: !p.midTried, color: '#6b4226' });
      btn('payInsist', X, 470, 230, 48, `堅持 $${p.price}(可能氣走)`, A.payInsist, { size: 16 });
      btn('refuse', X, 524, 230, 48, '不賣了', A.refuse, { color: '#4a4a4a' });
    } else btn('payFull', X, 350, 230, 80, `收錢 $${p.price}`, A.payFull, { color: '#2a6f6a', size: 26 });
  }
}

function drawStation() { drawLeft(); drawTank(); drawRight(); }

function bagBlock() {
  if (!G.plate.length) return '盤子是空的:先撈起炸好的料';
  if (!G.counter) return '還沒有客人,等客人來再裝袋';
  if (G.counter.atCounter <= 0.6) return '客人還沒走到櫃台';
  return '';
}
function hint() {
  if (G.phase !== 'open') return '';
  const c = G.counter;
  if (!c) return G.t >= G.dayLen ? '收攤囉!' : '等客人上門…可以先炸一些熱門的料備著';
  if (G.pay) return G.pay.offer < G.pay.price ? '客人在殺價:成交、讓價或堅持原價?' : '收錢!';
  if (c.atCounter > 0.6 && shortItems(c).length) return '這單的料不夠了:道歉換單(沒小費、耐心-30%)或請客人離開';
  if (c.sus && c.atCounter > 1) return '這包自備料看起來怪怪的…要幫他炸,還是檢舉?';
  if (G.plate.length) return '可調味(胡椒鹽/辣粉/九層塔),再按「裝袋」交給客人';
  const rd = G.fryer.findIndex(it => it && it.d >= ITEMS[it.key].lo && it.d < 100);
  if (rd >= 0) return `${rd + 1} 號網「剛好!」→ 按 ${rd + 1} 或點那個網撈起(空白鍵撈全部熟的)`;
  if (G.fryer.some(Boolean)) return '熟度條的白線走到綠色就「剛好!」;紅色「快焦!」要馬上撈';
  return '照客人點的,點左邊食材(或按 A–H)下鍋:大料進大網、小料進小網';
}

function drawRail() {
  // 菜單夾:橫向不鏽鋼夾條,每位客人(櫃台+排隊)一張單
  const y0 = 46, RX = 708;
  ctx.fillStyle = 'rgba(12,8,5,0.88)'; ctx.fillRect(RX, 44, W - RX, 96);
  const mg = ctx.createLinearGradient(0, y0, 0, y0 + 10); mg.addColorStop(0, '#d9dde2'); mg.addColorStop(1, '#7d848c');
  ctx.fillStyle = mg; rr(RX + 6, y0, W - RX - 12, 10, 4); ctx.fill();
  const list = (G.counter ? [G.counter] : []).concat(G.queue);
  if (!list.length) text('(菜單夾是空的 — 客人點單會夾在這裡)', (RX + W) / 2, 96, 15, '#9c8a72', 'center', 'normal');
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
    text(atC ? '櫃台' : `#${i + (G.counter ? 0 : 1)} 排隊`, x + 36, y + 12, 12, atC ? '#a67c00' : '#6c5a45');
    text(CTYPES[c.type].label.slice(0, 6), x + 36, y + 26, 11, '#7a4b4b', 'left', 'normal');
    const sec = atC ? c.patience : c.patience / 0.4;
    text(`⏱${Math.max(0, Math.ceil(sec))}s`, x + w - 6, y + 12, 12, col, 'right');
    // 品項
    const short = shortItems(c);
    if (c.type === 'regular' && !c.swapped) text('老樣子(看熟客筆記)', x + 6, y + 44, 12, '#2b1a0e');
    else { const m = countBy(c.order.items); let xx = x + 6, yy = y + 44;
      Object.keys(m).forEach(kk => { const t = `${ITEMS[kk].name}${m[kk] > 1 ? '×' + m[kk] : ''}`; ctx.font = `bold 12px ${FONT}`; const tw = ctx.measureText(t).width + 6;
        if (xx + tw > x + w - 4) { xx = x + 6; yy += 15; } text(t, xx, yy, 12, short.includes(kk) ? '#d62828' : '#2b1a0e'); if (short.includes(kk)) { ctx.fillStyle = '#d62828'; ctx.fillRect(xx, yy, tw - 6, 1.5); } xx += tw; }); }
    const tags = (c.type === 'regular' ? '?' : `${c.order.spicy ? '辣' : '不辣'}・${c.order.basil ? '塔' : '無塔'}`) + (c.type === 'byo' ? '・代炸' : '');
    text(tags, x + 6, y + h - 14, 11, c.order.spicy && c.type !== 'regular' ? '#c1121f' : '#555');
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
  const lines = ['① 開攤前「進貨」:錢花下去才有料,沒賣完的會隔夜不新鮮、甚至報廢', '② 客人點單會夾在上方的菜單夾;點食材櫃下鍋,熟度到綠色按 1–6 撈起', '③ 胡椒鹽 Z、辣粉 X、九層塔 C → 裝袋 Enter → 收錢(小心殺價)', '④ 缺貨時可以道歉換單,或請客人離開;收攤後付攤租,付不出就欠債', '⑤ 賺到錢去「設備店」升級:更多方籃、冰箱、濾油機、霓虹招牌…', '連續兩晚付不出攤租 → 攤位被收回。能撐幾晚?'];
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
  hd.forEach((h, i) => text(h, cx[i], 136, 15, '#bba'));
  MENU.forEach((k, r) => {
    const y = 172 + r * 64, I = ITEMS[k], st = STOCK[k], v = G.inv[k];
    ctx.fillStyle = r % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.07)'; rr(46, y - 28, 1188, 58, 8); ctx.fill();
    const fim = foodImg(k, false); if (fim) ctx.drawImage(fim, 56, y - 24, 50, 50);
    text(I.name, 116, y, 20);
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
  text(`預估今晚約 ${est} 位客人、平均每人 2 樣 ≈ 需要 ${est * 2} 份。目前備料 ${tot} 份。`, 60, 570, 17, '#f3e6d0', 'left', 'normal');
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
  const S = window.SFX, lv = S ? S.level : 0, lab = !S || S.headless ? '🔇 靜音' : ['🔇 靜音', '🔈 小', '🔉 中', '🔊 大'][lv] + ' M';
  btn('vol', 1200, 6, 74, 32, lab, () => sfx('cycleVolume'), { color: '#3b5b92', size: 13, on: false });
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
window.__game = { get state() { return G; }, get buttons() { return buttons.map(({ onClick, ...b }) => b); }, A, ITEMS, step: (dt) => { update(dt); render(performance.now() / 1000); } };
requestAnimationFrame(frame);
})();
