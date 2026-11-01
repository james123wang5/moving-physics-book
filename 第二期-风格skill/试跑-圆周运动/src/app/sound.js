// 音效：只负责加载和播放。录音文件放在 public/audio/<名字>.mp3（可选 <名字>-2.mp3、<名字>-3.mp3 作变体，随机挑一个）。
// 缺文件时静默。声音默认关，第一次打开（用户点击）时才创建 AudioContext 并加载。
// 用到的名字：page 翻页、pen 钢笔画线（循环）、tick 打勾、flap 掀翻盖、stamp 盖章、
// launch 发射、thud 落地、plop 落进桶、whoosh 甩出、grind 砂轮。

const NAMES = ['page', 'pen', 'tick', 'flap', 'stamp', 'launch', 'thud', 'plop', 'whoosh', 'grind'];
const BASE = `${import.meta.env.BASE_URL}audio/`;
// 各音效的音量（录音本身响度不一）
const GAIN = { page: 0.55, pen: 0.3, tick: 0.55, flap: 0.6, stamp: 0.9, launch: 0.6, thud: 0.75, plop: 0.7, whoosh: 0.5, grind: 0.45 };

export class Sound {
  constructor() {
    this.on = false;
    this.ctx = null;
    this.buffers = new Map();   // 名字 → [AudioBuffer…]
    this.loops = new Map();
  }

  enable(on) {
    this.on = on;
    if (on && !this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.7;
      this.master.connect(this.ctx.destination);
      for (const n of NAMES) this.load(n);
    }
    if (this.ctx) (on ? this.ctx.resume() : this.ctx.suspend()).catch(() => {});
  }

  async load(name) {
    const list = [];
    for (const f of [name, `${name}-2`, `${name}-3`]) {
      try {
        const r = await fetch(`${BASE}${f}.mp3`);
        if (!r.ok || !(r.headers.get('content-type') ?? '').includes('audio')) break;
        list.push(await this.ctx.decodeAudioData(await r.arrayBuffer()));
      } catch { break; }
    }
    if (list.length) this.buffers.set(name, list);
  }

  source(name, { gain = 1, rate = 1 } = {}) {
    const list = this.buffers.get(name);
    if (!this.on || !list) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = rate * (0.95 + Math.random() * 0.1);
    const g = this.ctx.createGain();
    g.gain.value = gain * (GAIN[name] ?? 0.7);
    src.connect(g).connect(this.master);
    return { src, g };
  }

  /** 播一次 */
  play(name, opt) {
    const s = this.source(name, opt);
    s?.src.start();
  }

  /** 循环播放 seconds 秒后淡出（钢笔画线） */
  loop(name, seconds, opt) {
    this.loops.get(name)?.src.stop();
    const s = this.source(name, opt);
    if (!s) return;
    s.src.loop = true;
    const t = this.ctx.currentTime;
    s.g.gain.setValueAtTime(0, t);
    const level = (opt?.gain ?? 1) * (GAIN[name] ?? 0.7);
    s.g.gain.linearRampToValueAtTime(level, t + 0.08);
    s.g.gain.setValueAtTime(level, t + Math.max(0.1, seconds - 0.25));
    s.g.gain.linearRampToValueAtTime(0, t + seconds);
    s.src.start();
    s.src.stop(t + seconds + 0.05);
    this.loops.set(name, s);
  }
}
