// 真實錄音油炸音效(CC0 取樣,見 assets/sfx/CREDITS.md)。只在使用者第一次點擊/按鍵後啟動與載入。
// ?mute=1 或自動化瀏覽器(navigator.webdriver)時完全不建立 AudioContext、不下載音檔。
(() => {
'use strict';
const P = new URLSearchParams(location.search);
const HEADLESS = P.get('mute') === '1' || navigator.webdriver === true;
const VOLS = [0, 0.35, 0.7, 1];
const DIR = 'assets/sfx/';
const NAMES = ['fry_loop_a', 'fry_loop_b', 'drop_sizzle', 'crackle_1', 'crackle_2', 'crackle_3', 'basket_clink', 'lift_drip',
  'scissors_snip', 'burnt_hiss', 'register']; // v37: 加回機械收銀機(按鍵+抽屜+硬幣,無鈴). v34: 移除所有叮/鈴/收銀鈴等有音高的提示音(炸歸炸,不要音樂感)
let level = 2; try { const v = localStorage.getItem('yansuji_vol'); if (v !== null) level = +v; } catch (e) {}
let ac = null, master = null, bus = null, bed = null;
const buf = {};
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];

function ext() { const a = document.createElement('audio'); return a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3'; }
function load(name, e) {
  return fetch(DIR + name + '.' + e).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
    .then(ab => new Promise((res, rej) => ac.decodeAudioData(ab, res, rej)))
    .then(b => { buf[name] = b; if (name.startsWith('fry_loop')) startBed(); })
    .catch(() => { if (e === 'ogg') return load(name, 'mp3'); });
}
function init() {
  if (ac || HEADLESS) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC(); master = ac.createGain(); master.gain.value = VOLS[level];
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 3;
  const warm = ac.createBiquadFilter(); warm.type = 'lowpass'; warm.frequency.value = 9000; // 再壓一點刺耳高頻
  bus = ac.createGain(); bus.connect(warm); warm.connect(comp); comp.connect(master); master.connect(ac.destination);
  const e = ext(); NAMES.forEach(n => load(n, e));
}
// 底噪兩層:A = 溫和薯條油泡(少量/低溫),B = 較旺的嘶滋(多網/高溫)
function startBed() {
  if (bed || !buf.fry_loop_a || !buf.fry_loop_b) return;
  const mk = (b) => { const s = ac.createBufferSource(); s.buffer = b; s.loop = true; const g = ac.createGain(); g.gain.value = 0; s.connect(g); g.connect(bus); s.start(0, rnd(0, b.duration)); return { s, g }; };
  bed = { a: mk(buf.fry_loop_a), b: mk(buf.fry_loop_b) };
}
function play(name, { v = 1, rate = 1, at = 0 } = {}) {
  if (!ac || !buf[name]) return null;
  const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = buf[name]; s.playbackRate.value = rate; g.gain.value = v;
  s.connect(g); g.connect(bus); s.start(ac.currentTime + at); return s;
}
const CRK = ['crackle_1', 'crackle_2', 'crackle_3'];
const crackle = (v) => play(pick(CRK), { v, rate: rnd(0.9, 1.12), at: rnd(0, 0.05) });

let crackAcc = 0, warnT = 0;
const SFX = {
  get headless() { return HEADLESS; }, get on() { return !!ac; }, get level() { return level; },
  unlock() { init(); if (ac && ac.state === 'suspended') ac.resume(); },
  cycleVolume() { level = (level + 1) % VOLS.length; try { localStorage.setItem('yansuji_vol', level); } catch (e) {} this.unlock(); if (master) master.gain.setTargetAtTime(VOLS[level], ac.currentTime, 0.05); if (level) this.click(); },
  // 每幀呼叫:n = 油裡的網數;temp = 油溫;active = 是否營業中
  tick(dt, n, temp, active) {
    if (warnT > 0) warnT -= dt;
    if (!ac || !bed) return; const t = ac.currentTime;
    if (!active) n = 0;
    const heat = Math.max(0, Math.min(1, (temp - 120) / 70));
    const k = n ? Math.min(1, 0.3 + n * 0.12) : 0;   // 0 → 1 隨網數增加
    const idle = active ? 0.05 + 0.05 * heat : 0;      // 空鍋也有一點點熱油聲
    const mixB = Math.min(1, k * (0.35 + 0.65 * heat)); // 越多網、越熱 → 越偏向旺嘶層
    const lvl = idle + k * 0.75;
    bed.a.g.gain.setTargetAtTime(lvl * (1 - mixB * 0.7), t, 0.3);
    bed.b.g.gain.setTargetAtTime(lvl * mixB * 0.8, t, 0.3);
    bed.b.s.playbackRate.setTargetAtTime(0.96 + 0.06 * heat, t, 0.8);
    // 隨機劈啪(真錄音片段)
    crackAcc += dt * (n ? 0.25 + n * 0.22 * (0.5 + heat) : 0);
    if (crackAcc > 1) { crackAcc -= rnd(0.6, 1.6); crackle(rnd(0.25, 0.55) * (0.6 + 0.4 * k)); }
  },
  drop() { // 下鍋:真錄音爆嘶,±5% 音高變化
    if (!ac) return;
    play('drop_sizzle', { v: rnd(0.8, 1), rate: rnd(0.95, 1.05) });
    play('basket_clink', { v: 0.35, rate: rnd(0.95, 1.05) });
  },
  done() {}, // v34: 熟度只靠畫面,不出聲
  warn() {},
  burnt() { play('burnt_hiss', { v: 0.6, rate: 0.9 }); },
  lift() { // 撈起:籃子碰撞 + 滴油嘶聲
    if (!ac) return;
    play('basket_clink', { v: 0.6, rate: rnd(0.95, 1.05) });
    play('lift_drip', { v: 0.75, rate: rnd(0.96, 1.04), at: 0.05 });
  },
  order() {}, // v34: 拿掉點單鈴
  cash() { play('register', { v: 0.6 }); },  // v37: 機械收銀機(無鈴)
  click() { play('basket_clink', { v: 0.12, rate: 1.6 }); },
  chop() { play('scissors_snip', { v: 0.6, rate: rnd(0.95, 1.05) }); },
};
window.SFX = SFX;
const unlock = () => SFX.unlock();
window.addEventListener('pointerdown', unlock, { capture: true }); window.addEventListener('keydown', unlock, { capture: true });
})();
