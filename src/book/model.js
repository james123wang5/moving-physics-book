// 书本的几何模型（毫米）。只做数学，不碰 three.js 网格。
//
// 书脊沿 z 轴。整叠书页沿“厚度坐标” σ 排列：σ=0 是最底下的后衬块，往上依次是第 N-1 张 … 第 1 张书页，
// 最上面是前衬块（第 0 张，连着封面）。每张有一个翻页量 c[i]：0 躺在右边，1 翻到左边。
//
// 书脊截面是两段直线：从右铰链出发，长度 = 右边那叠的厚度，到顶点 A；再从 A 到左边那叠的底部。
// 每张书页从书脊上自己的根部出发，按“根部斜着、往外逐渐放平”的角度函数积分出截面曲线。

export const SAMPLES = 60;

export function bookDims({ W = 190, D = 250, nSpreads = 10, leaf = 0.55, thickness = 19.15 } = {}) {
  const N = nSpreads;
  // 前后衬块分掉剩下的厚度：书总厚保持一致，书脊两段才能在顶点相交
  const base = Math.max(3, (thickness - (N - 1) * leaf) / 2);
  const front = base;
  const T = base + (N - 1) * leaf + front;
  const d = {
    W, D, N, L: leaf, B: base, F: front, T,
    BOARD: 3, OVER: 4, JOINT: 4, CX: 9.45,
    BULGE: 1.6, HOLLOW: 1.2, SPINE: 1.3,
    CURL: 0.3, CURL_Z: 0.5, DIP_N: 2.5, DROOP: 0.002,
  };
  d.Yb = -T / 2;
  d.BW = W + d.OVER - d.JOINT; // 封面板宽
  d.BD = D + 2 * d.OVER;       // 封面板深
  // 沿页宽的采样点：靠书脊处更密
  d.S = new Float64Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    d.S[i] = W * (0.3 * t + 0.7 * t * t);
  }
  return d;
}

/** 第 i 张（0 = 前衬块，1..N-1 = 书页，N = 后衬块）在厚度方向占据的 [σ下, σ上] */
export function leafRange(d, i) {
  const top = (k) => d.B + (d.N - k) * d.L;
  if (i === 0) return [top(1), d.T];
  if (i >= d.N) return [0, d.B];
  return [top(i + 1), top(i)];
}

// ∫₀¹ sin(ψ·xⁿ) dx 的查表（Simpson），用来算书页弯曲段需要多长
const integralTables = new Map();
function sinPowIntegral(psi, n) {
  let tab = integralTables.get(n);
  if (!tab) {
    tab = new Float64Array(513);
    const M = 128;
    for (let k = 0; k <= 512; k++) {
      const a = (Math.PI * k) / 512;
      let s = 0;
      for (let j = 0; j <= M; j++) {
        const x = j / M;
        const w = j === 0 || j === M ? 1 : j % 2 ? 4 : 2;
        s += w * Math.sin(a * Math.pow(x, n));
      }
      tab[k] = s / (3 * M);
    }
    integralTables.set(n, tab);
  }
  const f = (Math.min(Math.PI, Math.abs(psi)) / Math.PI) * 512;
  const i = Math.min(511, Math.floor(f));
  const t = f - i;
  return tab[i] * (1 - t) + tab[i + 1] * t;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const wrapAngle = (a) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
};

/**
 * 一侧书页的“族”：根部所在的书脊线（起点 base、方向 dir）、放平后的角度 flat、
 * 根部相对放平的偏角 psi，以及对应的积分值 I。
 */
function family(bx, by, ex, ey, flat, n) {
  const axis = Math.atan2(ey, ex);
  const r1 = wrapAngle(axis + Math.PI / 2);
  const r2 = wrapAngle(axis - Math.PI / 2);
  const root = Math.abs(wrapAngle(r1 - flat)) <= Math.abs(wrapAngle(r2 - flat)) ? r1 : r2;
  const psi = wrapAngle(root - flat);
  return { bx, by, ex, ey, flat, root, psi, n, I: sinPowIntegral(psi, n) };
}

/** 厚度 depth 处的书页需要多长的弯曲段，才能从斜着的根部过渡到放平 */
function bendLength(fam, depth) {
  const rise = depth * (1 - Math.cos(fam.psi));
  return fam.I > 1e-7 ? rise / fam.I : 0;
}

/** 弧长 s 处的角度：弯曲段内从 flat+psi 渐变到 flat，之后保持 flat（外加轻微下垂） */
function bendAngle(fam, len, s, droop = 0, W = 1) {
  const sag = droop && s > len ? (droop * (s - len)) / Math.max(1, W - len) : 0;
  if (s >= len || len <= 0) return fam.flat + sag;
  return fam.flat + fam.psi * Math.pow(1 - s / len, fam.n);
}

/**
 * 根据每张的翻页量算出整本书此刻的“骨架”：书脊两段、左右两族、封面位置。
 * c: Float64Array(N)，c[0] 是封面（前衬块）的翻开量。
 */
export function solveSpine(d, c) {
  const { T, F, L, N, CX, Yb } = d;
  let turned = 0;
  for (let i = 1; i < N; i++) turned += c[i];
  const split = T - F - L * turned;            // 右边这叠的厚度
  const open = Math.min(1, Math.max(0, c[0]));
  // 两铰链 (±CX, Yb)，两段长度 split 与 T-split，求顶点
  const a = split, b = T - split, base = 2 * CX;
  const cc = (b * b - a * a + base * base) / (2 * base);
  const h = Math.sqrt(Math.max(0, b * b - cc * cc));
  const apexX = -CX + cc, apexY = Yb + h;
  const angR = Math.atan2(apexY - Yb, apexX - CX);
  let angToLeft = Math.atan2(Yb - apexY, -CX - apexX);
  if (angToLeft < 0) angToLeft += 2 * Math.PI;
  const omega = smooth(0.35, 1, open);         // 书脊张开程度
  const flat0 = Math.PI * open;                // 封面所在角度
  const betaR = Math.PI / 2 + omega * (angR - Math.PI / 2);
  const Ax = CX + split * Math.cos(betaR), Ay = Yb + split * Math.sin(betaR);
  const twist = omega * (1.5 * Math.PI - angToLeft);
  const betaL = flat0 - twist + Math.PI / 2;
  const RTx = Ax + (T - split) * Math.cos(betaL), RTy = Ay + (T - split) * Math.sin(betaL);
  return {
    split, omega, open, flat0, betaR, betaL,
    A: [Ax, Ay], CR: [CX, Yb], RT: [RTx, RTy],
    famR: family(CX, Yb, Math.cos(betaR), Math.sin(betaR), 0, d.DIP_N),
    famL: family(RTx, RTy, -Math.cos(betaL), -Math.sin(betaL), flat0, d.DIP_N),
  };
}

/** 书脊上厚度 σ 处的点（翻页中的书页根部沿书脊滑动） */
export function spinePoint(sp, d, sigma, out = [0, 0]) {
  if (sigma <= sp.split) {
    out[0] = sp.CR[0] + sigma * Math.cos(sp.betaR);
    out[1] = sp.CR[1] + sigma * Math.sin(sp.betaR);
  } else {
    out[0] = sp.A[0] + (sigma - sp.split) * Math.cos(sp.betaL);
    out[1] = sp.A[1] + (sigma - sp.split) * Math.sin(sp.betaL);
  }
  return out;
}

/**
 * 厚度 σ、翻页量 u、页深位置 zn（-1..1）处那张书页的截面曲线。
 * 返回 {x, y, a}：每个采样点的位置和切线角。
 */
export function leafCurve(d, sp, sigma, u, zn = 0, noCurl = false, out = null) {
  const S = d.S, n = S.length;
  out = out || { x: new Float64Array(n), y: new Float64Array(n), a: new Float64Array(n) };
  const R = sp.famR, Lf = sp.famL;
  const lenR = bendLength(R, sigma);
  const lenL = bendLength(Lf, d.T - sigma);
  let x0, y0;
  if (u <= 0) {
    x0 = R.bx + sigma * R.ex;
    y0 = R.by + sigma * R.ey;
    // 合上时书页中部微微鼓起
    const k = sp.split > 0 ? Math.min(1, sigma / sp.split) : 0;
    const bulge = d.BULGE * 4 * k * (1 - k) * (1 - sp.omega) ** 2;
    x0 -= bulge * Math.cos(R.root);
    y0 -= bulge * Math.sin(R.root);
  } else if (u >= 1) {
    x0 = Lf.bx + (d.T - sigma) * Lf.ex;
    y0 = Lf.by + (d.T - sigma) * Lf.ey;
  } else {
    const p = spinePoint(sp, d, sigma);
    x0 = p[0]; y0 = p[1];
  }
  const t = Math.min(1, Math.max(0, u));
  const curl = noCurl || t <= 0 || t >= 1 ? 0 : d.CURL * Math.sin(2 * Math.PI * t) * (1 + d.CURL_Z * zn);
  const droopR = -d.DROOP * sigma * sp.omega;
  const droopL = d.DROOP * (d.T - sigma) * sp.omega * Math.sign(-Lf.psi || 1);
  const angle = (s) => {
    let a;
    if (t <= 0) a = bendAngle(R, lenR, s, droopR, d.W);
    else if (t >= 1) a = bendAngle(Lf, lenL, s, droopL, d.W);
    else a = (1 - t) * bendAngle(R, lenR, s, droopR, d.W) + t * bendAngle(Lf, lenL, s, droopL, d.W);
    if (curl) a += curl * Math.pow(s / d.W, 1.6);
    return a;
  };
  let x = x0, y = y0, a0 = angle(0);
  out.x[0] = x; out.y[0] = y; out.a[0] = a0;
  for (let i = 1; i < n; i++) {
    const s0 = S[i - 1], s1 = S[i], ds = s1 - s0;
    const am = angle((s0 + s1) / 2), a1 = angle(s1);
    // Simpson 积分
    x += (ds / 6) * (Math.cos(a0) + 4 * Math.cos(am) + Math.cos(a1));
    y += (ds / 6) * (Math.sin(a0) + 4 * Math.sin(am) + Math.sin(a1));
    out.x[i] = x; out.y[i] = y; out.a[i] = a1;
    a0 = a1;
  }
  return out;
}

/** 曲线上弧长 s 处的点和角度（线性插值） */
export function curveAt(d, curve, s, out = [0, 0, 0]) {
  const S = d.S;
  s = Math.min(d.W, Math.max(0, s));
  let lo = 0, hi = S.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (S[m] <= s) lo = m; else hi = m;
  }
  const t = (s - S[lo]) / (S[hi] - S[lo] || 1);
  out[0] = curve.x[lo] + (curve.x[hi] - curve.x[lo]) * t;
  out[1] = curve.y[lo] + (curve.y[hi] - curve.y[lo]) * t;
  out[2] = curve.a[lo] + (curve.a[hi] - curve.a[lo]) * t;
  return out;
}

/** 封面板此刻的位置：从左边那叠的底端再过一个铰缝 */
export function frontBoardFrame(d, sp) {
  const f = sp.famL.flat, cx = Math.cos(f), cy = Math.sin(f);
  return { ox: sp.RT[0] + d.JOINT * cx, oy: sp.RT[1] + d.JOINT * cy, dx: cx, dy: cy, nx: -cy, ny: cx };
}

/** 书脊外侧（书背）厚度 σ 处的位置和朝外方向 */
export function spineBack(d, sp, sigma) {
  let x, y;
  if (sigma < 0) { x = d.CX + sigma * Math.cos(sp.betaR); y = d.Yb + sigma * Math.sin(sp.betaR); }
  else if (sigma > d.T) { x = sp.RT[0] + (sigma - d.T) * Math.cos(sp.betaL); y = sp.RT[1] + (sigma - d.T) * Math.sin(sp.betaL); }
  else { const p = spinePoint(sp, d, sigma); x = p[0]; y = p[1]; }
  const oR = [-Math.cos(sp.famR.root), -Math.sin(sp.famR.root)];
  const oL = [-Math.cos(sp.famL.root), -Math.sin(sp.famL.root)];
  const k = smooth(sp.split - 2.5, sp.split + 2.5, sigma);
  let ox = oR[0] * (1 - k) + oL[0] * k, oy = oR[1] * (1 - k) + oL[1] * k;
  const len = Math.hypot(ox, oy) || 1;
  ox /= len; oy /= len;
  if (sigma > 0 && sigma < sp.split) {
    const q = sigma / sp.split;
    const bulge = d.BULGE * 4 * q * (1 - q) * (1 - sp.omega) ** 2;
    x -= bulge * Math.cos(sp.famR.root);
    y -= bulge * Math.sin(sp.famR.root);
  }
  return { x, y, ox, oy };
}
