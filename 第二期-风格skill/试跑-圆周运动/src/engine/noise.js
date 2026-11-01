// 可复现的随机数与噪声：程序纹理（木纹、油毡、纸）都靠它们，种子相同结果就相同。

/** 线性同余随机数，返回 [0,1) */
export function rng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * 二维梯度噪声，输出约在 [-1,1]。period > 0 时在该周期上无缝平铺。
 */
export function gradientNoise(seed = 1, period = 0) {
  const r = rng(seed * 2654435761 + 97);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const a = r() * Math.PI * 2;
    gx[i] = Math.cos(a);
    gy[i] = Math.sin(a);
  }
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const P = period > 0 ? period : 256;
  const wrap = (v) => ((v % P) + P) % P;
  const hash = (x, y) => perm[(perm[x & 255] + y) & 255];
  const dot = (h, x, y) => gx[h] * x + gy[h] * y;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = wrap(xi), y0 = wrap(yi), x1 = wrap(xi + 1), y1 = wrap(yi + 1);
    const u = fade(xf), v = fade(yf);
    const a = dot(hash(x0, y0), xf, yf);
    const b = dot(hash(x1, y0), xf - 1, yf);
    const c = dot(hash(x0, y1), xf, yf - 1);
    const d = dot(hash(x1, y1), xf - 1, yf - 1);
    const top = a + (b - a) * u;
    return (top + (c + (d - c) * u - top) * v) * 1.41;
  };
}

/** 分形叠加 */
export function fbm(noise, x, y, octaves = 4, gain = 0.5) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise(x * freq, y * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= 2;
  }
  return sum / norm;
}

export const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 高度场 → 切线空间法线贴图（RGBA8）。tile=true 时边缘按平铺处理 */
export function heightToNormal(height, w, h, strength, tile = true, out = new Uint8ClampedArray(w * h * 4)) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const xl = tile ? (x - 1 + w) % w : Math.max(0, x - 1);
      const xr = tile ? (x + 1) % w : Math.min(w - 1, x + 1);
      const yu = tile ? (y - 1 + h) % h : Math.max(0, y - 1);
      const yd = tile ? (y + 1) % h : Math.min(h - 1, y + 1);
      const dx = (height[y * w + xl] - height[y * w + xr]) * strength;
      const dy = (height[yu * w + x] - height[yd * w + x]) * strength;
      const len = Math.hypot(dx, dy, 1);
      const o = (y * w + x) * 4;
      out[o] = (dx / len * 0.5 + 0.5) * 255;
      out[o + 1] = (dy / len * 0.5 + 0.5) * 255;
      out[o + 2] = (1 / len * 0.5 + 0.5) * 255;
      out[o + 3] = 255;
    }
  }
  return out;
}
