// 資料表:食材、客人類型、台詞(純資料)
// 炸的秒數已依 3 分鐘營業時間壓縮(設計文件原始秒數 ÷ ~7)
// v42:price = 每份售價(結帳逐項加總);cost = 進貨單份成本;vendor = 攤家自己顧的料(客人不能自己撿,一定要老闆補)
const ITEMS = {
  chicken:  { size: 'L', cat: 'meat', solo: true, night: 1, name: '雞排', en: 'Cutlet',   cost: 30, price: 75, ideal: 170, time: 12, lo: 62, hi: 85, color: '#e8a54b', vendor: true },
  saltchicken:{ size: 'L', cat: 'meat', night: 1, name: '鹽酥雞', en: 'Popcorn', cost: 22, price: 60, ideal: 175, time: 9, lo: 60, hi: 82, color: '#d08a3a', vendor: true },
  tempura:  { size: 'S', cat: 'veg', night: 1, name: '甜不辣', en: 'Tempura', cost: 11, price: 30, ideal: 165, time: 8,  lo: 60, hi: 80, color: '#e9c46a' },
  riceblood:{ size: 'S', cat: 'veg', night: 1, name: '米血', en: 'Rice Cake',   cost: 11, price: 30, ideal: 160, time: 9,  lo: 55, hi: 78, color: '#5a3a3a' },
  bean:     { size: 'S', cat: 'veg', night: 1, name: '四季豆', en: 'Green Bean', cost: 13, price: 35, ideal: 185, time: 5,  lo: 52, hi: 72, color: '#6aa84f' },
  mushroom: { size: 'S', cat: 'veg', night: 1, name: '杏鮑菇', en: 'Mushroom', cost: 15, price: 40, ideal: 170, time: 10, lo: 60, hi: 85, color: '#d9c7a0' },
  squid:    { size: 'L', cat: 'meat', night: 1, name: '魷魚圈', en: 'Squid Ring', cost: 19, price: 50, ideal: 185, time: 6,  lo: 55, hi: 68, color: '#f1e3c6' },
  // v44 新料(night = 第幾晚解鎖)
  chickenskin:{ size: 'L', cat: 'meat', night: 2, name: '雞皮', en: 'Skin', cost: 14, price: 40, ideal: 175, time: 7, lo: 58, hi: 80, color: '#e0b070' },
  porkskewer:{ size: 'L', cat: 'meat', night: 3, name: '豬肉串', en: 'Skewer', cost: 18, price: 45, ideal: 175, time: 8, lo: 60, hi: 82, color: '#b0603a' },
  squidball:{ size: 'L', cat: 'meat', night: 4, name: '花枝丸', en: 'Squid Ball', cost: 12, price: 35, ideal: 170, time: 6, lo: 56, hi: 80, color: '#e6c48a' },
  cartilage:{ size: 'L', cat: 'meat', night: 5, name: '雞軟骨', en: 'Cartilage', cost: 16, price: 45, ideal: 180, time: 7, lo: 58, hi: 78, color: '#e7c9a4' },
  tofu:     { size: 'S', cat: 'veg', night: 2, name: '百頁豆腐', en: 'Tofu', cost: 10, price: 30, ideal: 170, time: 6, lo: 56, hi: 80, color: '#f0dca0' },
  sweetpotato:{ size: 'S', cat: 'veg', night: 2, name: '地瓜', en: 'Yam', cost: 10, price: 30, ideal: 165, time: 9, lo: 60, hi: 82, color: '#e89a3a' },
  babycorn: { size: 'S', cat: 'veg', night: 3, name: '玉米筍', en: 'Baby Corn', cost: 10, price: 30, ideal: 180, time: 5, lo: 54, hi: 76, color: '#f2d66a' },
  greenpepper:{ size: 'S', cat: 'veg', night: 3, name: '青椒', en: 'Pepper', cost: 9, price: 25, ideal: 185, time: 4, lo: 52, hi: 74, color: '#4a9a3a' },
  silverbun:{ size: 'S', cat: 'veg', night: 4, name: '銀絲卷', en: 'Roll', cost: 12, price: 35, ideal: 165, time: 5, lo: 55, hi: 78, color: '#f5efe0' },
  byo:      { size: 'S', cat: 'veg', night: 1, name: '自備料', en: 'BYO', cost: 0,  price: 25, ideal: 170, time: 8,  lo: 58, hi: 80, color: '#9c8f6a' },
};
// v40 網子:L(雞排)一塊一個大網(2×2);S 小料先「備料」放進同一個小網(2×1,最多 SMALL_CAP 份),整網一次下鍋、共用一個計時、整網一次撈
const SMALL_CAP = 4;
// v44 標準:肉類(cat:'meat')一律進大網;雞排 solo 一塊一網,其他肉每大網最多 MEAT_CAP 份混炸;非肉進小網
const MEAT_CAP = 4;
const isMeat = k => ITEMS[k] && ITEMS[k].cat === 'meat';
// 物價：第 1 晚 = 100%。菜每晚上漲 5%（上限 155%），肉每晚上漲 8%（上限 190%）。售價只跟著漲六成五，毛利會慢慢變薄。
function vegIndex(night) { return Math.min(1.55, 1 + 0.05 * ((night || 1) - 1)); }
function meatIndex(night) { return Math.min(1.9, 1 + 0.08 * ((night || 1) - 1)); }
function indexFor(k, night) { return (k && isMeat(k)) ? meatIndex(night) : vegIndex(night); }
function costOf(k, night) { const I = ITEMS[k]; return I ? Math.round(I.cost * indexFor(k, night || 1)) : 0; }
function saleOf(k, night) {
  const I = ITEMS[k]; if (!I) return 0;
  const sell = 1 + (indexFor(k, night || 1) - 1) * 0.65;
  return Math.max(5, Math.round(I.price * sell / 5) * 5);
}
const ALL_MENU = ['chicken', 'saltchicken', 'squid', 'chickenskin', 'porkskewer', 'squidball', 'cartilage', 'tempura', 'riceblood', 'bean', 'mushroom', 'tofu', 'sweetpotato', 'babycorn', 'greenpepper', 'silverbun'];
const MENU = [], SELF_MENU = []; // 依當晚解鎖重建(refreshMenu)
function refreshMenu(night) { MENU.splice(0, MENU.length, ...ALL_MENU.filter(k => (ITEMS[k].night || 1) <= night)); SELF_MENU.splice(0, SELF_MENU.length, ...MENU.filter(k => !ITEMS[k].vendor)); }
refreshMenu(1); // v42:客人自己撿進鐵盆的料

const TEMPS = [
  { key: 'low',  name: '低溫', target: 145 },
  { key: 'mid',  name: '中溫', target: 170 },
  { key: 'high', name: '高溫', target: 188 },
];

const SEASON_PRICE = { spicy: 5, basil: 3 };
// ---- 第二版:經營循環 ----
const START_CASH = 1000;
const STALL_PRICE = 3600; // 十二週起步房租。房東一口價，不跟物價漲。
const rentFor = n => n <= 6 ? 300 + 80 * (n - 1) : 700 + 50 * (n - 6);
// 進貨:batch = 每批份數;days = 保存晚數(含進貨當晚)。單份成本 = ITEMS.cost
const STOCK = {
  chicken:   { batch: 5, days: 2 },
  saltchicken:{ batch: 6, days: 2 },
  tempura:   { batch: 8, days: 1 },
  riceblood: { batch: 6, days: 2 },
  bean:      { batch: 8, days: 1 },
  mushroom:  { batch: 5, days: 2 },
  squid:     { batch: 4, days: 1 },
  chickenskin:{ batch: 4, days: 1 },
  porkskewer:{ batch: 4, days: 2 },
  squidball: { batch: 4, days: 2 },
  cartilage: { batch: 5, days: 1 },
  tofu:      { batch: 4, days: 2 },
  sweetpotato:{ batch: 4, days: 2 },
  babycorn:  { batch: 4, days: 1 },
  greenpepper:{ batch: 4, days: 1 },
  silverbun: { batch: 4, days: 2 },
};
const MAX_STOCK = 48;                                // 每種食材庫存上限(份)
const UPGRADES = [
  { id: 'bigNet',  name: '加深大網', en: 'Deeper big nets', price: 450, desc: '肉類大網一次可混 6 份，下鍋比較不降溫', descEn: 'Big nets hold 6 meats and lose less heat' },
  { id: 'smallNet',name: '右欄小網 ×2', en: 'Two more small nets', price: 300, desc: '油鍋右側再加兩個小網，兩張單可以一起炸', descEn: 'Two extra small nets so two orders can fry' },
  { id: 'fridge',  name: '保鮮冰箱', en: 'Fridge', price: 400, desc: '當晚料也能留一晚，隔夜料不扣滿意度', descEn: 'Leftovers keep one night with no penalty' },
  { id: 'filter',  name: '濾油機', en: 'Oil filter', price: 350, desc: '油老化速度 -40%，少換油、少被稽查', descEn: 'Oil ages 40% slower, fewer inspections' },
  { id: 'neon',    name: '霓虹招牌', en: 'Neon sign', price: 500, desc: '來客 +12%，買下時口碑 +5', descEn: '+12% guests, and +5 reputation now' },
  { id: 'fan',     name: '電風扇+板凳', en: 'Fan and stools', price: 300, desc: '客人耐心 +20%', descEn: 'Guests wait 20% longer' },
  { id: 'bulk',    name: '批發會員卡', en: 'Wholesale card', price: 450, desc: '進貨價 -10%', descEn: 'Supply cost −10%' },
  { id: 'heatlamp',name: '保溫燈', en: 'Heat lamp', price: 280, desc: '起鍋後沒那麼快變冷、沒那麼油', descEn: 'Plated food stays hotter, less greasy' },
  { id: 'generator',name:'發電機', en: 'Generator', price: 420, desc: '停電夜燈還亮，油溫照樣回得來', descEn: 'Blackouts stay lit and the oil recovers' },
];
const MAX_UPGRADES_PER_NIGHT = 2;
// 各晚登場的特殊客人(時間秒, 類型)
const NIGHT_SPECIALS = [
  [[70, 'student']],
  [[16, 'regular'], [50, 'aunt'], [118, 'drunk']],
  [[16, 'regular'], [42, 'aunt'], [78, 'live'], [92, 'inspector'], [130, 'drunk']],
  [[16, 'regular'], [36, 'live'], [42, 'aunt'], [66, 'byo'], [92, 'inspector'], [118, 'drunk'], [146, 'aunt']],
  [[16, 'regular'], [40, 'live'], [70, 'aunt'], [100, 'inspector'], [128, 'drunk'], [150, 'byo']],
  [[18, 'regular'], [34, 'aunt'], [58, 'live'], [86, 'byo'], [112, 'inspector'], [138, 'drunk'], [158, 'live']],
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
  inspector: { label: '路人', en: 'Passer-by',    body: '#6c757d', patience: 60, haggle: 0.0,  offer: [1, 1] },
  byo:       { label: '自備食材客', en: 'BYO guest', body: '#7b5ea7', patience: 45, haggle: 0.0,  offer: [1, 1] },
  live:      { label: '直播客', en: 'Streamer', body: '#3d9970', patience: 32, haggle: 0.0,  offer: [1, 1] },
};

const LINES = {
  greet: ['老闆,我撿好了,幫我炸~', '欸老闆,這盆麻煩你!', '這些,麻煩你!', '我夾好了,炸一下~', '老闆，油滾了嗎？', '這幾樣，炸金黃就好。', '第一次來，听说你們家雞排。', '老闆，我趕上車，快一點。'],
  regular: ['老闆~老樣子!', '嘿嘿,一樣喔!', '還是那個味道，我才會來。', '阿桑我啦，黃紙上那張。'],
  aunt: ['少年仔,便宜一點啦!', '算便宜一點,我常來欸!', '多給我一點九層塔，我再考慮。', '隔壁比較便宜你知不知道。'],
  drunk: ['嗝…老闆…給我來個…那個…', '老、老闆…炸一下…嗝', '這個…跟那個…算你會的就好。', '再一瓶…不是，再一包。'],
  inspector: ['這個油…多久換一次啊?', '炸多久才會熟啊?我好奇問問。'],
  byo: ['老闆,我自己帶料,幫我炸一下就好,代炸費給你。'],
  byoSus: ['老闆,我自己帶料…(袋子聞起來怪怪的,還在滴水)'],
  student: ['老闆快點喔,我補習要遲到了!', '安親班要關門了，炸快一點！'],
  live: ['我開直播喔，炸好看一點！', '鏡頭在這，老闆自然一點～', '觀眾說要看雞排下鍋！', '炸焦會被截圖喔，老闆小心。'],
  drunkChange: '啊不對不對…改成這個啦!嗝',
  happy: ['讚啦!', '香!下次再來!', '就是這個味道~', '外酥內嫩，可以。'],
  ok: ['嗯…還可以。', '好啦。', '沒有很雷，就這樣。'],
  angry: ['這什麼啊…', '等好久欸!不買了!', '下次不來了。', '油都黑了還端上來。'],
};
const NIGHT_ARC = [
  ['攤位不是你的。買斷價寫在牆上，這週的房租先賺出來。', 'The stall is not yours. The buyout price is on the wall. Earn this week’s rent first.'],
  ['熟客阿桑會來。她的單釘在左邊，不要問她要什麼。', 'Regular A-sang is coming. Her order is pinned on the left. Do not ask.'],
  ['放學後人會擠。後面的單先炸，熟了放下面濾油網。', 'After school it gets crowded. Fry the next tickets early. Done food waits on the drain rack.'],
  ['隔壁在傳衛生局喬裝。油黑、沒熟，罰的是你。', 'The stall next door says the health bureau is in disguise. Black oil or raw food is your fine.'],
  ['有人開直播。油花漂亮會打賞，炸焦會被截圖。', 'Someone is livestreaming. A pretty fry gets a tip. A burnt one gets posted.'],
  ['鬼月人少。爸爸說味道對，人就會再來。', 'Ghost month is quiet. Dad said if the taste is right, they come back.'],
  ['攤租又漲了。設備可以買，但先留進貨的錢。', 'Rent went up again. Gear is fine — keep cash for stock first.'],
  ['你開始像個老闆了。口碑比招牌還大聲。', 'You are starting to look like the boss. Reputation is louder than the sign.'],
];
const LINES_EN = {
  greet: ['Boss, I grabbed mine. Fry them!', 'Hey boss, this bowl please!', 'These, please!', 'Clipped and ready — just fry!', 'Is the oil rolling?', 'Golden is enough.', 'First time. I heard about the cutlet.', 'I have a bus. Make it quick.'],
  regular: ['The usual!', 'Same as always!', 'That taste is why I come back.', 'It is me. The one on the yellow note.'],
  aunt: ['Cheap it down, kid!', 'I come here a lot — discount!', 'More basil, then I will think about it.', 'The stall next door is cheaper, you know.'],
  drunk: ['Hic… boss… gimme… that thing…', 'B-boss… just fry it… hic', 'This and that… whatever you can do.', 'One more bottle… no. One more bag.'],
  inspector: ['This oil… how often do you change it?', 'How long until it is cooked? Just curious.'],
  byo: ['I brought my own. Just fry it — I will pay the fee.'],
  byoSus: ['I brought my own… (the bag smells off, and it is dripping)'],
  student: ['Hurry, I am late for cram school!', 'Daycare is closing — fry faster!'],
  live: ['I am live. Make the fry look good!', 'Camera is here. Act natural.', 'Chat wants the cutlet hitting the oil!', 'Burn it and they will screenshot you.'],
  drunkChange: 'Wait, no… change it to this! Hic',
  happy: ['Nice!', 'Smells great. I will be back!', 'That is the one!', 'Crisp outside, tender inside.'],
  ok: ['Hmm… it is fine.', 'Okay.', 'Not a disaster. That is all.'],
  angry: ['What is this…', 'I waited forever. Forget it!', 'I am not coming back.'],
};

const RUMORS = [
  '聽說衛生局今晚會派人喬裝客人來，油記得換、東西要炸熟。(今晚罰款加重 $200)',
  '隔壁攤阿姨說今天殺價的客人特別多。(今晚殺價機率提高)',
  '今晚廟口有活動，尖峰人潮會更多。(尖峰來客加快)',
  '氣象說傍晚會下雨，客人會躲一下但比較有耐心。',
  '有人在講鬼月不要把油炸得黑黑的，味道會被說閒話。',
  '補習班快下課了，等等學生會擠過來。',
  '有人說今晚會有人直播夜市。炸得漂亮有打賞，炸醜會被拍到。',
];
const RUMOR_EN = [
  'Word is the health bureau is coming in disguise. Change the oil and cook it through. (Fines +$200 tonight)',
  'The auntie next door says hagglers are out in force. (More haggling tonight)',
  'Temple fair tonight — the rush comes faster. (Peak spawns quicker)',
  'Rain later. Guests duck in, but they are more patient.',
  'Ghost month. Do not let the oil go black or people will talk.',
  'Cram school lets out soon. Students will pile in.',
  'Someone is livestreaming the market. A pretty fry gets a tip; an ugly one gets posted.',
];

// v45 夜晚氣氛。scene 對應 assets/scene_<scene>.jpg
const THEMES = {
  fair:     { name: '平常夜', en: 'Fair night', scene: 'stall_front', patience: 1, rush: 1, temp: 0 },
  rain:     { name: '雨夜', en: 'Rain', scene: 'bg_rain', patience: 1.18, rush: 0.82, temp: -12 },
  temple:   { name: '廟口夜', en: 'Temple fair', scene: 'bg_temple', patience: 0.92, rush: 1.28, temp: 0, tip: 1.25 },
  ghost:    { name: '鬼月', en: 'Ghost month', scene: 'bg_ghost', patience: 1.05, rush: 0.9, temp: -4 },
  blackout: { name: '停電夜', en: 'Blackout', scene: 'bg_blackout', patience: 0.85, rush: 0.75, temp: -26 },
};
function themeFor(night) {
  return ['fair', 'rain', 'temple', 'ghost', 'blackout', 'fair', 'temple', 'rain'][(night - 1) % 8];
}
// 夜市新聞的固定來源。每張卡都從這裡來，不是匿名公告。
const NEWS_SOURCES = {
  paper:  { zh: '夜市快報', en: 'Market Paper', via: '攤上的報紙', viaEn: 'paper on the counter' },
  critic: { zh: '阿味專欄', en: "A-Wei's column", via: '他走到攤前講', viaEn: 'he came by and said it' },
  veg:    { zh: '果菜批發站', en: 'Produce market', via: '清晨市場廣播', viaEn: 'dawn market loudspeaker' },
  meat:   { zh: '肉品公會', en: 'Butchers’ guild', via: '公會黑板', viaEn: 'the guild blackboard' },
  bureau: { zh: '衛生局', en: 'Health bureau', via: '柱上紅公告', viaEn: 'red notice on the post' },
  alley:  { zh: '巷口', en: 'The alley', via: '有人在吼', viaEn: 'someone is yelling' },
  oilco:  { zh: '北門油行', en: 'Beimen oil shop', via: '油行黑板', viaEn: 'the oil-shop board' },
  buzz:   { zh: '攤販群組', en: 'Stall group chat', via: '訊息剛傳進來', viaEn: 'a message just landed' },
  temple: { zh: '宮廟', en: 'The temple', via: '廟口廣播', viaEn: 'the temple loudspeaker' },
};
const NOTICES = [
  { id: 'quiet', src: 'paper', min: 1, tone: 'neutral', zh: '本週沒有大新聞', en: 'No big story this week', blurb: '快報只剩半版廣告。阿味這週沒寫專欄，你照平常備料。', blurbEn: 'The paper is half ads. A-Wei skipped his column. Stock as usual.', line: '沒有加減。照平常進貨。', enLine: 'No change. Stock as usual.' },
  { id: 'lantern', src: 'critic', min: 2, tone: 'good', zh: '燈節那攤值得繞路', en: 'Worth a detour at the lanterns', blurb: '阿味的專欄寫你。燈一掛起來，炸得剛好的人會多給錢，人潮也會湧過來。', blurbEn: 'A-Wei’s column names you. When the lanterns go up, a proper fry gets paid extra, and the crowd comes.', line: '滿意的客人多付 $15，今晚多兩位。', enLine: 'Happy guests pay $15 more. Two extra people.' },
  { id: 'glut', src: 'veg', min: 2, tone: 'good', zh: '菜堆到沒人要', en: 'Vegetables nobody wants', blurb: '批發站廣播：今早菜區垮了。一樣菜再便宜三成，進貨列會標出來。', blurbEn: 'The produce station says the vegetable row collapsed. One item is another 30% off, marked on the list.', line: '那樣菜再打七折。', enLine: 'That vegetable is another 30% off.' },
  { id: 'spike', src: 'meat', min: 3, tone: 'bad', zh: '雞販今早喊漲', en: 'The chicken man raised prices', blurb: '公會黑板改價。雞排和鹽酥雞今早貴兩成半，別一次進太多。', blurbEn: 'The guild board changed. Cutlet and popcorn chicken cost 25% more. Do not overbuy.', line: '肉類進價 +25%。', enLine: 'Meat costs 25% more.' },
  { id: 'cram', src: 'paper', min: 3, tone: 'neutral', zh: '補習班要放學了', en: 'Cram school is letting out', blurb: '快報社會版：學生會擠過來。單子小，人急，排隊稍微慢一點就走。', blurbEn: 'The paper’s local page: students will pile in. Small tickets, no patience.', line: '學生變多，催得更急。', enLine: 'More students, and they are less patient.' },
  { id: 'feast', src: 'critic', min: 4, tone: 'good', zh: '外帶桌菜指定這家', en: 'The banquet wants this stall', blurb: '阿味跟餐廳說，炸的找你。客人少兩位，可是每張單多一樣。', blurbEn: 'A-Wei sent the restaurant to you. Two fewer guests, one extra item on every ticket.', line: '少兩位，每張單多一樣。', enLine: 'Two fewer guests. One extra item each.' },
  { id: 'raid', src: 'bureau', min: 4, tone: 'bad', zh: '喬裝稽查本週上路', en: 'Undercover inspection this week', blurb: '紅公告釘在柱子上。喬裝客一定來，沒熟或老油罰得比平常重。', blurbEn: 'The red notice is on the post. An inspector is coming. Raw food or old oil is fined harder.', line: '稽查一定來，罰單更重。', enLine: 'An inspector is coming. The fine is heavier.' },
  { id: 'fight', src: 'alley', min: 2, tone: 'bad', cut: 2, pace: 0.86, zh: '巷口兩攤打起來', en: 'Two stalls are fighting', blurb: '鹽水雞跟魷魚羹為了排隊吵開了。人會繞路，留下來的也心不在焉。', blurbEn: 'The squid stall and the salted-chicken stall are shouting. People detour, and whoever stays is distracted.', line: '少兩位客人，剩下的比較急。', enLine: 'Two fewer guests. The rest are less patient.' },
  { id: 'protect', src: 'alley', min: 3, tone: 'bad', choice: true, zh: '有人來收保護費', en: 'Someone wants a cut', blurb: '一個不認識的人拍你的攤板。現在給他，今晚就消停。不給，收攤他會再來鬧，而且鬧得更貴。', blurbEn: 'A stranger taps your counter. Pay now and the night is quiet. Refuse, and he comes back at closing, and it costs more.', line: '付，或等收攤再被鬧。', enLine: 'Pay now, or pay more at closing.' },
  { id: 'oil', src: 'oilco', min: 2, tone: 'bad', zh: '沙拉油又漲了', en: 'Fryer oil jumped', blurb: '北門油行說原料被掃光。這週換油特別痛，老油更不能拖到稽查看見。', blurbEn: 'The oil shop says the stock was bought out. Changing the oil hurts this week. Do not let it go black.', line: '換油比平常貴六成。', enLine: 'An oil change costs 60% more.' },
  { id: 'celeb', src: 'buzz', min: 4, tone: 'good', extra: 3, tip: 20, zh: '黃仁勳來夜市', en: 'A famous boss is in the market', blurb: '群組傳爆了：皮衣大老闆往這條街走。人會擠過來拍照，炸得好的會多給錢。你不用把他的臉印上招牌。', blurbEn: 'The group chat says a famous boss in a leather jacket is walking this street. A crowd comes to look. A good fry gets paid extra.', line: '多三位客人，滿意的多付 $20。', enLine: 'Three extra guests. A happy ticket pays $20 more.' },
  { id: 'stockout', src: 'veg', min: 3, tone: 'bad', zh: '這項今晚進不到', en: 'One item is gone', blurb: '上游說這週沒貨。進貨列會標出來，手上剩下的還能炸，但不能再補。', blurbEn: 'The supplier is out. It is marked on the list. What you already have can still be fried.', line: '有一樣食材本週不能進。', enLine: 'One ingredient cannot be bought this week.' },
  { id: 'rival', src: 'paper', min: 3, tone: 'bad', zh: '對街在跳樓賣', en: 'The stall across the lane slashed prices', blurb: '對面把價錢壓下去。你這週售價跟著打八五折，不然人不過來。', blurbEn: 'Across the lane they cut prices. Your menu is 15% off this week or the crowd stays over there.', line: '所有售價 ×0.85。', enLine: 'Every sale price is ×0.85.' },
  { id: 'crew', src: 'paper', min: 4, tone: 'good', extra: 2, tip: 25, zh: '劇組來這條街取景', en: 'A film crew is shooting the lane', blurb: '燈一打，路人會多停兩批。炸得好看，他們多付。', blurbEn: 'The lights go up and two extra groups stop. Make it look good and they pay more.', line: '多兩位，滿意的多付 $25。', enLine: 'Two extra guests. A happy ticket pays $25 more.' },
  { id: 'parade', src: 'temple', min: 3, tone: 'neutral', extra: 2, pace: 0.88, zh: '宮廟遶境經過', en: 'The temple parade is coming through', blurb: '神轎會從攤前過。人變多，但大家都在趕，催得快。', blurbEn: 'The palanquin passes your stall. More people, all of them in a hurry.', line: '多兩位，客人比較急。', enLine: 'Two extra guests, and they are less patient.' },
];
const EVENT_LINES = {
  fight: [['外面還在吵，快一點啦。', 'They are still yelling. Hurry.'], ['我繞路過來的，別讓我等。', 'I detoured. Do not make me wait.'], ['鹽水雞跟魷魚羹打起來了耶。', 'The two stalls are fighting.']],
  protect: [['巷口那個黑衣的還在。', 'The man in the dark jacket is still in the alley.'], ['今晚氣氛怪怪的。', 'The lane feels off tonight.']],
  oil: [['油又漲了吧，別炸焦。', 'Oil is up. Do not burn it.'], ['聽說油行被掃光。', 'Heard the oil shop was bought out.']],
  celeb: [['外面擠滿人在拍照。', 'The lane is full of phones.'], ['有名人來了？給我一份熱的。', 'Someone famous? Give me a hot bag.'], ['我跟著人潮過來的。', 'I followed the crowd.']],
  stockout: [['今天選擇變少了喔。', 'The menu looks thinner today.'], ['缺貨就跟我說。', 'Tell me if you are out.']],
  rival: [['對街比較便宜耶。', 'Across the lane is cheaper.'], ['你不降價人會走。', 'If you do not drop the price, people leave.']],
  crew: [['鏡頭在拍，好看一點。', 'The camera is rolling. Make it pretty.'], ['我可以入鏡嗎？', 'Can I be in the shot?']],
  parade: [['神轎要過了，快。', 'The palanquin is coming. Hurry.'], ['鑼鼓好吵，給我熱的。', 'The drums are loud. Make it hot.']],
  lantern: [['燈好看，東西也要好吃。', 'The lanterns are pretty. The food should match.']],
  feast: [['餐廳說找你外帶。', 'The restaurant sent me.']],
  raid: [['今晚好像有人在看。', 'Feels like someone is watching tonight.']],
  cram: [['剛下課，趕時間。', 'Just got out of class. I am in a rush.']],
  glut: [['菜很便宜吧，多給一點。', 'Veg is cheap, right? Give me extra.']],
  spike: [['雞好貴，小份就好。', 'Chicken is pricey. A small bag.']],
};
// 這局一直帶著的機緣。收攤後三選一，買斷或倒閉才清掉。
const BOONS = [
  { id: 'loud', tone: 'mix', zh: '擴音喇叭', en: 'Street horn', up: '每週多一位客人', upEn: 'One extra guest each week', down: '大家比較急', downEn: 'Everyone is less patient' },
  { id: 'cloth', tone: 'good', zh: '舊濾布', en: 'Old filter cloth', up: '油色漲得慢三成', upEn: 'Oil darkens 30% slower', down: '', downEn: '' },
  { id: 'scale', tone: 'mix', zh: '黑心秤', en: 'Short scale', up: '售價 +10%', upEn: 'Menu prices +10%', down: '份量看起來少，滿意度 -6', downEn: 'Portions feel small, mood −6' },
  { id: 'iou', tone: 'mix', zh: '週轉欠條', en: 'A loan chit', up: '現在多 $120', upEn: '+$120 right now', down: '之後每週房租 +$25', downEn: 'Rent +$25 every later week' },
  { id: 'rush', tone: 'mix', zh: '趕火', en: 'Hot fire', up: '下鍋快 15%', upEn: 'Food fries 15% faster', down: '金黃來得快，比較容易炸老', downEn: 'Gold comes sooner, so it burns easier' },
  { id: 'charm', tone: 'good', zh: '熟客紅線', en: "Regular's thread", up: '再來一位熟客，小費比較大', upEn: 'A second regular, and a bigger tip', down: '', downEn: '' },
  { id: 'saint', tone: 'mix', zh: '好人口碑', en: 'A good name', up: '滿意時口碑多 +1', upEn: 'Happy guests give +1 more rep', down: '生氣時口碑再 -1', downEn: 'Angry guests cost 1 more rep' },
  { id: 'stash', tone: 'good', zh: '私房鐵盒', en: 'Cash tin', up: '每週房租少 $20', upEn: 'Rent is $20 less', down: '', downEn: '' },
  { id: 'night', tone: 'mix', zh: '夜貓子', en: 'Night owl', up: '收攤晚 20 秒', upEn: 'The night runs 20 seconds longer', down: '後段客人更沒耐心', downEn: 'Late guests are less patient' },
];
// 營業中途的岔路。第二週起每晚抽一張，選了才繼續炸。
const FORKS = [
  { id: 'cousin', zh: '表弟扛著箱子', en: 'Your cousin with a crate', line: '我多帶了一批，比早盤便宜一點。現在要不要？', lineEn: 'Extra batch, cheaper than this morning. Want it?' },
  { id: 'dare', zh: '醉客拍桌子', en: 'A drunk slaps the counter', line: '下一包賭雙倍。輸了這包我拿走。', lineEn: 'Double or nothing on the next bag. Lose, and it is mine.' },
  { id: 'match', zh: '對街在砍價', en: 'Across the lane', line: '他們整晚賣你的八五折。跟不跟？', lineEn: 'They are at 85% all night. Match them?' },
  { id: 'oilvan', zh: '油行小貨車', en: 'The oil van', line: '半價把油色拉回來。鍋裡的網不用起來。', lineEn: 'Half price to clear the oil. Leave the nets in.' },
  { id: 'kid', zh: '小孩扯著阿嬤', en: 'A kid and a grandmother', line: '地瓜給一條就好。錢？阿嬤說等等。', lineEn: 'One yam. Grandma says she will pay later.' },
];
const WEATHER_LINES = {
  rain: ['雨好大，炸快一點～', '躲雨順便買啦。', '傘都濕了，給我熱的。'],
  temple: ['剛拜拜下來，來一份香的。', '廟口人好多，麻煩快一點。'],
  ghost: ['今晚油不要炸黑黑的喔。', '鬼月，東西要炸透。'],
  blackout: ['停電還有在炸喔？', '燈暗暗的，小心別炸焦。'],
};
const WEATHER_EN = {
  rain: ['It is pouring. Fry it fast.', 'Hiding from the rain — might as well eat.', 'My umbrella is soaked. Make it hot.'],
  temple: ['Just came down from the temple. Something fragrant.', 'The fair is packed. Please hurry.'],
  ghost: ['Do not let the oil go black tonight.', 'Ghost month. Cook it all the way through.'],
  blackout: ['Still frying in a blackout?', 'Lights are dim. Do not burn it.'],
};

// 日常閒聊。純氣氛，不影響數值。
const CHAT = {
  normal: [
    ['今天好悶，還是想吃炸的。', 'Muggy night. Still want fried food.'],
    ['下班經過，聞到就走不動。', 'Smelled it on my way home. Had to stop.', '這條街都是我在害的。', 'Blame me for the whole lane.'],
    ['我家樓下那攤收了，只好來這。', 'The stall by my place closed. So here I am.'],
    ['老闆你幾點收？', 'What time do you close?', '賣完就收。', 'When it is gone.'],
    ['這一袋是要追劇配的。', 'This bag is for my show tonight.'],
    ['小時候都是我爸買回來。', 'My dad used to bring this home.'],
    ['醫生叫我少吃。我只吃一點點。', 'Doctor said eat less. This is "less."', '我什麼都沒聽到。', 'I heard nothing.'],
    ['公司尾牙抽到電鍋，沒用過。', 'Won a rice cooker at work. Never used it.'],
    ['你們家胡椒是自己調的嗎？', 'Is the pepper mix your own?', '我爸留下來的配方。', "My dad's recipe."],
    ['剛看完電影，肚子比劇情空。', 'Just saw a movie. My stomach had more plot.'],
    ['停車繞了三圈才有位子。', 'Circled three times to park.'],
    ['幫同事買，他們都說這家。', 'Buying for coworkers. They said this stall.'],
    ['夜市的燈一亮就想出門。', 'The lights come on and I want to go out.'],
    ['聽這個油聲就覺得放鬆。', 'That sizzle relaxes me.'],
  ],
  regular: [
    ['你爸以前都會多抓一把九層塔。', 'Your dad always threw in extra basil.', '我記住了。', 'Noted.'],
    ['我孫子下禮拜考試，買給他補。', 'My grandson has exams next week. This is fuel.'],
    ['考完了，說題目都沒看過。', 'Exams done. He says he recognized nothing.', '那今天多吃一點。', 'Then eat more tonight.'],
    ['隔壁賣襪子的說你手腳變快了。', 'The sock lady says you got faster.'],
    ['成績出來了，還可以啦。', 'Grades are out. Not bad.', '恭喜，這包炸漂亮一點。', 'Then this bag gets extra care.'],
    ['房東又在巷口看你生意喔。', 'The landlord was watching your stall again.'],
    ['我膝蓋不好，還是走過來了。', 'Bad knees, and I still walked here.'],
    ['你撐到現在，你爸會高興。', 'You made it this far. Your dad would be glad.', '……謝謝阿桑。', '…Thanks, A-sang.'],
  ],
  regularAny: [
    ['今天油很清，我看得出來。', 'Clean oil tonight. I can tell.'],
    ['不用急，我又不趕。', 'No rush. I have time.'],
    ['市場的菜又貴了。', 'Vegetables went up again.'],
    ['我都跟人家說來你這攤。', 'I tell everyone to come here.'],
  ],
  aunt: [
    ['我女兒說我血壓高，你不要講。', 'My daughter says my blood pressure is high. Not a word.', '我沒看到你。', 'Never saw you.'],
    ['隔壁賣水果的今天也漲。', 'The fruit stall raised prices too.'],
    ['我年輕的時候一包才二十。', 'A bag was twenty dollars when I was young.', '那時候我還沒出生。', 'Before my time.'],
    ['你有沒有女朋友？我姪女不錯。', 'Seeing anyone? My niece is nice.', '阿姨，我在顧油。', 'Auntie, I am watching the oil.'],
    ['袋子給我大的，我回去要裝垃圾。', 'Give me the big bag. I reuse it.'],
    ['我有在看喔，不要偷少給。', 'I am watching. No short portions.'],
    ['廟口那攤排到馬路上。', 'The temple stall has a line into the road.'],
  ],
  drunk: [
    ['我跟你說…我今天…沒有很醉。', 'Listen… tonight… I am not that drunk.'],
    ['我老婆叫我買的。大概。', 'My wife sent me. Probably.'],
    ['這個油…在轉耶。', 'This oil… is spinning.', '是你在轉。', 'That is you.'],
    ['老闆你人很好…我要認你當乾兒子。', 'You are a good kid… I am adopting you.'],
    ['我年輕也擺過攤，賣臭豆腐。', 'I ran a stall once. Stinky tofu.'],
    ['等一下…我剛剛點什麼？', 'Wait… what did I order?', '單在這，不會錯。', 'It is on the ticket.'],
  ],
  live: [
    ['各位，這就是巷子裡那一攤。', 'Chat, this is the one in the alley.'],
    ['觀眾問你單身嗎。', 'Chat wants to know if you are single.', '觀眾問太多了。', 'Chat asks too much.'],
    ['聊天室都在刷「好餓」。', 'Chat is spamming "hungry."'],
    ['等等咬下去要有聲音喔。', 'I need the crunch on mic.'],
    ['有人斗內叫我加辣。', 'Someone donated to make me add chili.'],
  ],
  byo: [
    ['這是我自己醃的，放心啦。', 'I marinated it myself. Relax.'],
    ['外面賣的我吃不習慣。', 'I do not trust store-bought.'],
    ['炸好我分你一塊。', 'I will share a piece after.', '不用，謝謝。', 'No, thank you.'],
  ],
  inspector: [
    ['這鍋油今天開的嗎？', 'Is this today\'s oil?'],
    ['雞排中間會不會還紅紅的？', 'Any chance the cutlet is pink inside?'],
    ['你們生的跟熟的夾子有分開嗎？', 'Separate tongs for raw and cooked?'],
    ['我只是好奇，沒別的意思。', 'Just curious. Nothing more.'],
  ],
  queue: [
    ['前面炸好久喔。', 'The one ahead is taking a while.'],
    ['好香，快輪到我。', 'Smells great. Almost my turn.'],
    ['我先滑個手機。', 'I will check my phone.'],
    ['老闆慢慢來，不要炸焦。', 'Take your time. Do not burn it.'],
    ['排這攤的人都很有耐心。', 'People in this line are patient.'],
    ['再不到我，我要改吃滷味了。', 'Any longer and I am switching to braised.'],
  ],
  cond: {
    late: [['這麼晚還有開，謝謝你。', 'Open this late. Thank you.'], ['最後一攤了，其他都收了。', 'You are the last one open.']],
    early: [['我是不是第一個？', 'Am I first?', '油剛熱，剛好。', 'Oil just got hot. Good timing.']],
    oilDark: [['油顏色有點深了喔。', 'The oil is getting dark.'], ['該換油了吧老闆。', 'Time for new oil, boss.']],
    crowd: [['今天生意這麼好。', 'Busy tonight.'], ['後面排一排，你紅了。', 'Look at that line. You are famous.']],
    cutlet: [['雞排不要切，我要整片啃。', 'Do not cut it. I want it whole.'], ['你們家雞排比我臉大。', 'Your cutlet is bigger than my face.']],
    basil: [['九層塔多一點，那是靈魂。', 'More basil. That is the soul.']],
    spicy: [['辣一點，我今天需要。', 'Extra heat. I need it today.']],
    rep: [['朋友推薦的，說這攤不雷。', 'A friend said this stall never misses.']],
  },
};
