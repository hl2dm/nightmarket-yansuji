// 資料表:食材、客人類型、台詞(純資料)
// 炸的秒數已依 3 分鐘營業時間壓縮(設計文件原始秒數 ÷ ~7)
// v42:price = 每份售價(結帳逐項加總);cost = 進貨單份成本;vendor = 攤家自己顧的料(客人不能自己撿,一定要老闆補)
const ITEMS = {
  chicken:  { size: 'L', name: '雞排', en: 'Cutlet',   cost: 30, price: 75, ideal: 170, time: 12, lo: 62, hi: 85, color: '#e8a54b', vendor: true },
  saltchicken:{ size: 'S', name: '鹽酥雞', en: 'Popcorn Chkn', cost: 22, price: 60, ideal: 175, time: 9, lo: 60, hi: 82, color: '#d08a3a', vendor: true },
  tempura:  { size: 'S', name: '甜不辣', en: 'Tempura', cost: 11, price: 30, ideal: 165, time: 8,  lo: 60, hi: 80, color: '#e9c46a' },
  riceblood:{ size: 'S', name: '米血', en: 'Rice Cake',   cost: 11, price: 30, ideal: 160, time: 9,  lo: 55, hi: 78, color: '#5a3a3a' },
  bean:     { size: 'S', name: '四季豆', en: 'Green Bean', cost: 13, price: 35, ideal: 185, time: 5,  lo: 52, hi: 72, color: '#6aa84f' },
  mushroom: { size: 'S', name: '杏鮑菇', en: 'Mushroom', cost: 15, price: 40, ideal: 170, time: 10, lo: 60, hi: 85, color: '#d9c7a0' },
  squid:    { size: 'S', name: '魷魚圈', en: 'Squid Ring', cost: 19, price: 50, ideal: 185, time: 6,  lo: 55, hi: 68, color: '#f1e3c6' },
  byo:      { size: 'S', name: '自備料', en: 'BYO', cost: 0,  price: 25, ideal: 170, time: 8,  lo: 58, hi: 80, color: '#9c8f6a' },
};
// v40 網子:L(雞排)一塊一個大網(2×2);S 小料先「備料」放進同一個小網(2×1,最多 SMALL_CAP 份),整網一次下鍋、共用一個計時、整網一次撈
const SMALL_CAP = 4;
const MENU = ['chicken', 'saltchicken', 'tempura', 'riceblood', 'bean', 'mushroom', 'squid'];
const SELF_MENU = MENU.filter(k => !ITEMS[k].vendor); // v42:客人自己撿進鐵盆的料

const TEMPS = [
  { key: 'low',  name: '低溫', target: 145 },
  { key: 'mid',  name: '中溫', target: 170 },
  { key: 'high', name: '高溫', target: 188 },
];

const SEASON_PRICE = { spicy: 5, basil: 3 };
// ---- 第二版:經營循環 ----
const START_CASH = 1000;
const rentFor = n => 300 + 80 * (n - 1);            // 第1晚 $300,每晚 +$80(依試玩校正,見 design.md §15)
// 進貨:batch = 每批份數;days = 保存晚數(含進貨當晚)。單份成本 = ITEMS.cost
const STOCK = {
  chicken:   { batch: 5, days: 2 },
  saltchicken:{ batch: 6, days: 2 },
  tempura:   { batch: 8, days: 1 },
  riceblood: { batch: 6, days: 2 },
  bean:      { batch: 8, days: 1 },
  mushroom:  { batch: 5, days: 2 },
  squid:     { batch: 4, days: 1 },
};
const MAX_STOCK = 48;                                // 每種食材庫存上限(份)
const UPGRADES = [
  { id: 'bigNet',  name: '加大網(第 3 個 2×2)', price: 600, desc: '油槽右上多一個大網:雞排不用排隊' },
  { id: 'smallNet',name: '加小網(第 3 個混炸網)', price: 300, desc: '油槽右下多一個小網(2×1,備好 4 份小料整網一起炸)' },
  { id: 'fridge',  name: '保鮮冰箱',         price: 400, desc: '當晚料也能留一晚,隔夜料不扣滿意度' },
  { id: 'filter',  name: '濾油機',           price: 350, desc: '油老化速度 -40%,少換油、少被稽查' },
  { id: 'neon',    name: '霓虹招牌',         price: 500, desc: '來客 +12%,買下時口碑 +5' },
  { id: 'fan',     name: '電風扇+板凳',      price: 300, desc: '客人耐心 +20%' },
  { id: 'bulk',    name: '批發會員卡',       price: 450, desc: '進貨價 -10%' },
];
const MAX_UPGRADES_PER_NIGHT = 2;
// 各晚登場的特殊客人(時間秒, 類型)
const NIGHT_SPECIALS = [
  [[16, 'regular']],
  [[16, 'regular'], [50, 'aunt'], [118, 'drunk']],
  [[16, 'regular'], [42, 'aunt'], [92, 'inspector'], [130, 'drunk']],
  [[16, 'regular'], [42, 'aunt'], [66, 'byo'], [92, 'inspector'], [118, 'drunk'], [146, 'aunt']],
];
const OIL_CHANGE_COST = 150;
const OIL_LIMIT = 24; // 超過即老油

// patience 秒;haggle = 殺價機率;offer = 開價比例
const CTYPES = {
  normal:    { label: '路人', en: 'Passer-by',     body: '#4f7cac', patience: 40, haggle: 0.2,  offer: [0.85, 0.9] },
  student:   { label: '趕時間學生', en: 'Student', body: '#3d9970', patience: 26, haggle: 0.0,  offer: [1, 1] },
  regular:   { label: '熟客', en: 'Regular',     body: '#2e8b57', patience: 48, haggle: 0.0,  offer: [1, 1] },
  aunt:      { label: '殺價阿姨', en: 'Haggler', body: '#b5527a', patience: 55, haggle: 1.0,  offer: [0.68, 0.78] },
  drunk:     { label: '酒醉阿伯', en: 'Drunk', body: '#8a6d3b', patience: 55, haggle: 0.3,  offer: [0.8, 0.9] },
  inspector: { label: '路人?', en: 'Passer-by?',    body: '#6c757d', patience: 60, haggle: 0.0,  offer: [1, 1] },
  byo:       { label: '自備食材客', en: 'BYO guest', body: '#7b5ea7', patience: 45, haggle: 0.0,  offer: [1, 1] },
};

const LINES = {
  greet: ['老闆,我撿好了,幫我炸~', '欸老闆,這盆麻煩你!', '這些,麻煩你!', '我夾好了,炸一下~'],
  regular: ['老闆~老樣子!', '嘿嘿,一樣喔!'],
  aunt: ['少年仔,便宜一點啦!', '算便宜一點,我常來欸!'],
  drunk: ['嗝…老闆…給我來個…那個…', '老、老闆…炸一下…嗝'],
  inspector: ['這個油…多久換一次啊?', '炸多久才會熟啊?我好奇問問。'],
  byo: ['老闆,我自己帶料,幫我炸一下就好,代炸費給你。'],
  byoSus: ['老闆,我自己帶料…(袋子聞起來怪怪的,還在滴水)'],
  student: ['老闆快點喔,我補習要遲到了!'],
  drunkChange: '啊不對不對…改成這個啦!嗝',
  happy: ['讚啦!', '香!下次再來!', '就是這個味道~'],
  ok: ['嗯…還可以。', '好啦。'],
  angry: ['這什麼啊…', '等好久欸!不買了!', '下次不來了。'],
};

const RUMORS = [
  '聽說衛生局今晚會派人喬裝客人來,油記得換、東西要炸熟。(今晚罰款加重 $200)',
  '隔壁攤阿姨說今天殺價的客人特別多。(今晚殺價機率提高)',
  '今晚廟口有活動,尖峰人潮會更多。(尖峰來客加快)',
];
