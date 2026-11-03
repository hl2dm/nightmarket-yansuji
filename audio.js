// 程序生成油炸音效(Web Audio,無外部音檔)。只在使用者第一次點擊/按鍵後啟動。
// ?mute=1 或自動化瀏覽器(navigator.webdriver)時完全不建立 AudioContext。
(() => {
'use strict';
const P = new URLSearchParams(location.search);
const HEADLESS = P.get('mute') === '1' || navigator.webdriver === true;
const VOLS = [0, 0.35, 0.7, 1];
let level = 2; try { const v = localStorage.getItem('yansuji_vol'); if (v !== null) level = +v; } catch (e) {}
let ac = null, master = null, bus = null, noiseBuf = null, bed = null;
const rnd = (a, b) => a + Math.random() * (b - a);

function makeNoise(sec) { // 粉紅雜訊(Voss 近似)
  const n = ac.sampleRate * sec, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 2.2; }
  return b;
}
function noiseSrc() { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; s.loopStart = rnd(0, 1); s.start(0, rnd(0, 1.9)); return s; }
function init() {
  if (ac || HEADLESS) return;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC(); master = ac.createGain(); master.gain.value = VOLS[level];
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  bus = ac.createGain(); bus.connect(comp); comp.connect(master); master.connect(ac.destination);
  noiseBuf = makeNoise(3);
  // 連續油泡底噪:低頻咕嘟(帶通 + 慢速 LFO)+ 高頻嘶嘶(高通)
  const low = noiseSrc(), lf = ac.createBiquadFilter(); lf.type = 'bandpass'; lf.frequency.value = 420; lf.Q.value = 1.2;
  const lowG = ac.createGain(); lowG.gain.value = 0; low.connect(lf); lf.connect(lowG); lowG.connect(bus);
  const lfo = ac.createOscillator(), lfoG = ac.createGain(); lfo.frequency.value = 5.3; lfoG.gain.value = 160; lfo.connect(lfoG); lfoG.connect(lf.frequency); lfo.start();
  const hi = noiseSrc(), hf = ac.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 3200;
  const pk = ac.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 6500; pk.gain.value = 6;
  const hiG = ac.createGain(); hiG.gain.value = 0; hi.connect(hf); hf.connect(pk); pk.connect(hiG); hiG.connect(bus);
  const flut = ac.createOscillator(), flutG = ac.createGain(); flut.frequency.value = 11; flutG.gain.value = 0; flut.connect(flutG); flutG.connect(hiG.gain); flut.start();
  bed = { lowG, hiG, flutG, hf };
}
function env(g, t, a, peak, d) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
function noiseHit({ type = 'highpass', f = 3000, q = 0.7, a = 0.005, d = 0.4, v = 0.5, at = 0, sweep = 0 }) {
  if (!ac) return; const t = ac.currentTime + at, s = noiseSrc(), fl = ac.createBiquadFilter(), g = ac.createGain();
  fl.type = type; fl.frequency.setValueAtTime(f, t); if (sweep) fl.frequency.exponentialRampToValueAtTime(sweep, t + a + d); fl.Q.value = q;
  env(g, t, a, v, d); s.connect(fl); fl.connect(g); g.connect(bus); s.stop(t + a + d + 0.05);
}
function tone({ f = 880, f2 = 0, type = 'sine', a = 0.004, d = 0.3, v = 0.3, at = 0 }) {
  if (!ac) return; const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + d);
  env(g, t, a, v, d); o.connect(g); g.connect(bus); o.start(t); o.stop(t + a + d + 0.05);
}
const pop = (at = 0, v = 0.25) => { const f = rnd(1800, 5200); noiseHit({ type: 'bandpass', f, q: rnd(2, 6), a: 0.001, d: rnd(0.012, 0.04), v, at }); };
const bubble = (at = 0, v = 0.12) => tone({ f: rnd(180, 420), f2: rnd(700, 1400), a: 0.002, d: rnd(0.03, 0.07), v, at });

let crackAcc = 0, lastN = 0, warnT = 0;
const SFX = {
  get headless() { return HEADLESS; }, get on() { return !!ac; }, get level() { return level; },
  unlock() { init(); if (ac && ac.state === 'suspended') ac.resume(); },
  cycleVolume() { level = (level + 1) % VOLS.length; try { localStorage.setItem('yansuji_vol', level); } catch (e) {} this.unlock(); if (master) master.gain.setTargetAtTime(VOLS[level], ac.currentTime, 0.05); if (level) this.click(); },
  // 每幀呼叫:n = 油裡的網數;temp = 油溫;active = 是否營業中
  tick(dt, n, temp, active) {
    if (!ac || !bed) return; const t = ac.currentTime;
    if (!active) n = 0;
    const heat = Math.max(0, Math.min(1, (temp - 120) / 70));
    const k = n ? Math.min(1, 0.35 + n * 0.11) : 0;  // 0 → 1 隨網數增加
    const idle = active ? 0.03 + 0.03 * heat : 0;      // 空鍋也有一點點熱油聲
    bed.lowG.gain.setTargetAtTime(idle + k * 0.32, t, 0.25);
    bed.hiG.gain.setTargetAtTime(idle * 0.6 + k * (0.18 + 0.12 * heat), t, 0.25);
    bed.flutG.gain.setTargetAtTime(k * 0.06, t, 0.3);
    bed.hf.frequency.setTargetAtTime(2600 + 1400 * heat, t, 0.5);
    lastN = n;
    // 隨機劈啪與油泡
    crackAcc += dt * (n ? 4 + n * 3.2 * (0.6 + heat) : active ? 0.6 : 0);
    let guard = 0; while (crackAcc > 1 && guard++ < 8) { crackAcc -= rnd(0.5, 1.5); if (Math.random() < 0.65) pop(rnd(0, 0.05), rnd(0.08, 0.3)); else bubble(rnd(0, 0.05), rnd(0.05, 0.14)); if (Math.random() < 0.15) { pop(0.03); pop(0.06, 0.15); } }
    if (warnT > 0) warnT -= dt;
  },
  drop() { // 下鍋:大聲爆嘶 + 低沉「轟」+ 一串劈啪
    if (!ac) return;
    noiseHit({ type: 'highpass', f: 1800, a: 0.01, d: 1.6, v: 0.9, sweep: 5000 });
    noiseHit({ type: 'bandpass', f: 6000, q: 0.8, a: 0.02, d: 1.1, v: 0.5 });
    noiseHit({ type: 'lowpass', f: 500, a: 0.005, d: 0.35, v: 0.6, sweep: 120 });
    for (let i = 0; i < 14; i++) pop(rnd(0.02, 1.2), rnd(0.15, 0.4));
    for (let i = 0; i < 6; i++) bubble(rnd(0.05, 0.8), 0.12);
  },
  done() { tone({ f: 1046, d: 0.25, v: 0.22, type: 'triangle' }); tone({ f: 1568, d: 0.45, v: 0.2, type: 'triangle', at: 0.11 }); },
  warn() { if (warnT > 0) return; warnT = 0.4; tone({ f: 740, d: 0.09, v: 0.16, type: 'square' }); tone({ f: 740, d: 0.09, v: 0.16, type: 'square', at: 0.16 }); noiseHit({ type: 'highpass', f: 5000, d: 0.5, v: 0.25 }); },
  burnt() { tone({ f: 220, f2: 110, d: 0.5, v: 0.25, type: 'sawtooth' }); noiseHit({ type: 'bandpass', f: 1200, q: 1, d: 0.8, v: 0.35, sweep: 400 }); },
  lift() { // 撈起:金屬籃碰撞 + 嘶聲收尾 + 滴油
    if (!ac) return;
    tone({ f: 2400, d: 0.08, v: 0.08, type: 'triangle' }); tone({ f: 3170, d: 0.06, v: 0.05, type: 'triangle', at: 0.01 });
    noiseHit({ type: 'highpass', f: 3500, a: 0.03, d: 0.6, v: 0.35, sweep: 7000 });
    for (let i = 0; i < 5; i++) { const at = 0.2 + i * rnd(0.12, 0.22); tone({ f: rnd(900, 1500), f2: rnd(300, 500), d: 0.05, v: 0.12, at }); pop(at + 0.01, 0.12); }
  },
  order() { tone({ f: 1318, d: 0.6, v: 0.2, type: 'sine' }); tone({ f: 2636, d: 0.4, v: 0.06, type: 'sine' }); },
  cash() { // 收銀機:按鍵咔 + 抽屜 + 叮叮
    if (!ac) return;
    noiseHit({ type: 'bandpass', f: 2500, q: 3, d: 0.03, v: 0.4 }); noiseHit({ type: 'lowpass', f: 900, d: 0.15, v: 0.4, at: 0.06 });
    tone({ f: 2093, d: 0.5, v: 0.2, type: 'triangle', at: 0.1 }); tone({ f: 2637, d: 0.7, v: 0.2, type: 'triangle', at: 0.2 });
    for (let i = 0; i < 4; i++) tone({ f: rnd(3500, 5000), d: 0.05, v: 0.05, at: 0.25 + i * 0.05 });
  },
  click() { tone({ f: 1400, f2: 900, d: 0.04, v: 0.08, type: 'triangle' }); },
  chop() { noiseHit({ type: 'bandpass', f: 3000, q: 2, d: 0.06, v: 0.3 }); tone({ f: 500, f2: 200, d: 0.05, v: 0.1 }); },
};
window.SFX = SFX;
const unlock = () => SFX.unlock();
window.addEventListener('pointerdown', unlock, { capture: true }); window.addEventListener('keydown', unlock, { capture: true });
})();
