import * as THREE from 'three';
import { rng, gradientNoise, fbm } from '../engine/noise.js';
import { pageMaterial, PAPER } from './materials.js';

// 每一页一张画布。平时用低分辨率（1.6 像素/毫米）；当前跨页和前后各一个跨页换成高分辨率（6 像素/毫米），
// 每帧最多升级一页，避免卡顿。drawPage(spread, side, ctx, pxPerMm) 在毫米坐标里画内容。

const paperCache = new Map();

/** 纸张底色：纸色 + 低频斑驳 + 随机短纤维。按尺寸和种子缓存 */
function paperBase(w, h, pxPerMm, seed) {
  const key = `${w}x${h}:${seed}`;
  if (paperCache.has(key)) return paperCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = PAPER;
  g.fillRect(0, 0, w, h);
  // 低分辨率的斑驳层，放大叠上去
  const sw = Math.max(8, Math.round(w / pxPerMm / 2)), sh = Math.max(8, Math.round(h / pxPerMm / 2));
  const s = document.createElement('canvas');
  s.width = sw; s.height = sh;
  const sg = s.getContext('2d');
  const img = sg.createImageData(sw, sh);
  const nz = gradientNoise(seed + 40);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const v = fbm(nz, x * 0.09, y * 0.09, 4);
      const o = (y * sw + x) * 4;
      if (v > 0) { img.data[o] = 150; img.data[o + 1] = 122; img.data[o + 2] = 84; img.data[o + 3] = Math.min(255, v * 34); }
      else { img.data[o] = 255; img.data[o + 1] = 253; img.data[o + 2] = 246; img.data[o + 3] = Math.min(255, -v * 40); }
    }
  }
  sg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(s, 0, 0, w, h);
  // 纤维
  const r = rng(seed + 7);
  const n = Math.round(((w * h) / (pxPerMm * pxPerMm)) * 0.06);
  for (let i = 0; i < n; i++) {
    const x = r() * w, y = r() * h, a = r() * Math.PI, len = (0.3 + r() * 1.2) * pxPerMm;
    g.strokeStyle = r() < 0.85 ? 'rgba(160,135,100,0.10)' : 'rgba(110,95,80,0.16)';
    g.lineWidth = Math.max(0.6, 0.06 * pxPerMm);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
  paperCache.set(key, c);
  return c;
}

export class PageTextures {
  constructor({ renderer, drawPage, W, D, nSpreads, paperNormal, key, hiPx = 8, loPx = 1.6 }) {
    Object.assign(this, { renderer, drawPage, W, D, nSpreads, hiPx, loPx });
    this.aniso = Math.min(16, renderer.capabilities.getMaxAnisotropy());
    this.pages = new Map();
    for (let k = 1; k <= nSpreads; k++) {
      for (const side of ['left', 'right']) {
        const mat = pageMaterial({ normal: paperNormal, key, W, D });
        const lo = this.makeCanvas(loPx, k, side);
        mat.map = lo.tex;
        this.pages.set(this.key(k, side), { k, side, mat, lo, hi: null });
      }
    }
    this.wanted = new Set();
    this.queue = [];
  }

  key(k, side) { return `${k}:${side}`; }

  paint(canvas, px, k, side) {
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    const base = paperBase(canvas.width, canvas.height, px, side === 'left' ? 3 : 4);
    if (k % 2) { g.save(); g.translate(canvas.width, 0); g.scale(-1, 1); g.drawImage(base, 0, 0); g.restore(); }
    else g.drawImage(base, 0, 0);
    g.setTransform(px, 0, 0, px, 0, 0);
    g.save();
    try { this.drawPage(k, side, g, px); } finally { g.restore(); }
  }

  makeCanvas(px, k, side) {
    const c = document.createElement('canvas');
    c.width = Math.round(this.W * px);
    c.height = Math.round(this.D * px);
    this.paint(c, px, k, side);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.aniso;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return { canvas: c, tex, px };
  }

  material(k, side) { return this.pages.get(this.key(k, side))?.mat ?? null; }
  entry(k, side) { return this.pages.get(this.key(k, side)); }

  /** 设定需要高清的跨页（当前和目标跨页 ±1） */
  setFocus(spreads) {
    this.wanted = new Set();
    for (const s of spreads) {
      for (let k = s - 1; k <= s + 1; k++) {
        if (k >= 1 && k <= this.nSpreads) { this.wanted.add(this.key(k, 'left')); this.wanted.add(this.key(k, 'right')); }
      }
    }
    const dist = (key) => Math.min(...spreads.map((s) => Math.abs(Number(key.split(':')[0]) - s)));
    this.queue = [...this.wanted].filter((key) => !this.pages.get(key).hi).sort((a, b) => dist(a) - dist(b));
    for (const p of this.pages.values()) {
      if (p.hi && spreads.every((s) => Math.abs(p.k - s) >= 2)) {
        p.mat.map = p.lo.tex;
        p.hi.tex.dispose();
        p.hi = null;
      }
    }
  }

  /** 每帧调用一次：最多升级一页到高清 */
  step() {
    while (this.queue.length) {
      const key = this.queue.shift();
      const p = this.pages.get(key);
      if (!this.wanted.has(key) || p.hi) continue;
      p.hi = this.makeCanvas(this.hiPx, p.k, p.side);
      p.mat.map = p.hi.tex;
      return true;
    }
    return false;
  }

  /** 内容变了（预测勾选、实时数据……）就重画这一页 */
  invalidate(k, side) {
    const p = this.pages.get(this.key(k, side));
    if (!p) return;
    this.paint(p.lo.canvas, p.lo.px, k, side);
    p.lo.tex.needsUpdate = true;
    if (p.hi) { this.paint(p.hi.canvas, p.hi.px, k, side); p.hi.tex.needsUpdate = true; }
  }

  /** 只重画高清版（实时数据刷新用，省掉低清） */
  invalidateHi(k, side) {
    const p = this.pages.get(this.key(k, side));
    if (!p) return;
    if (p.hi) { this.paint(p.hi.canvas, p.hi.px, k, side); p.hi.tex.needsUpdate = true; }
    else { this.paint(p.lo.canvas, p.lo.px, k, side); p.lo.tex.needsUpdate = true; }
  }

  get pending() { return this.queue.filter((k) => this.wanted.has(k) && !this.pages.get(k).hi).length; }
}
