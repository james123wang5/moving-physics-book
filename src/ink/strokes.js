import * as THREE from 'three';
import { POP_GLSL } from './pop-glsl.js';

// 墨线笔画：每一条线是一串 3D 点，展开成屏幕空间等宽的带子。
// 线宽沿笔画按噪声起伏、两端收细（笔压）；每条线有开始时间和时长，钢笔可以一笔一笔画出来。
// 平放时（印刷）线宽按毫米算，立起来后按像素算。

export const INK_COLOR = '#1c2433';

const VERT = /* glsl */ `
${POP_GLSL}
uniform float uClock, uLiftAll, uWidthPx, uWidthMm, uBias, uPrint, uPxPerMm, uCopy, uMinW;
uniform vec2 uRes;
attribute vec3 aPrev; attribute vec3 aNext; attribute vec3 aS; attribute vec4 aLine; attribute vec2 aSide; attribute float aVis;
varying float vD; varying float vHalf; varying float vS; varying float vHead; varying float vGrow; varying float vAlpha;
varying vec3 vWorld;

vec2 toPx(vec4 c) { return c.xy / c.w * 0.5 * uRes; }
vec4 viewBias(vec3 w) {
  vec4 v = viewMatrix * vec4(w, 1.0);
  bool ortho = projectionMatrix[3][3] > 0.5;
  v.xyz += (ortho ? vec3(0.0, 0.0, 1.0) : normalize(-v.xyz)) * uBias;
  return v;
}
void main() {
  float L = aLine.x;
  float prog = clamp((uClock - aLine.y) / max(aLine.z, 1e-3), 0.0, 1.0);
  float head = prog * L + (prog >= 1.0 ? 1.0 : 0.0);
  vec3 wP = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 wA = (modelMatrix * vec4(aPrev, 1.0)).xyz;
  vec3 wB = (modelMatrix * vec4(aNext, 1.0)).xyz;
  float lift = 1.0;
  if (uPrint < 0.5) {
    lift = uCopy > 0.5 ? 0.0 : uLiftAll;
    wP = popWorld(wP, lift); wA = popWorld(wA, lift); wB = popWorld(wB, lift);
  }
  vWorld = wP;
  vec4 cP = projectionMatrix * viewBias(wP), cA = projectionMatrix * viewBias(wA), cB = projectionMatrix * viewBias(wB);
  vec2 sP = toPx(cP), sA = toPx(cA), sB = toPx(cB);
  vec2 t1 = sP - sA, t2 = sB - sP;
  float l1 = length(t1), l2 = length(t2);
  vec2 dir = vec2(1.0, 0.0);
  float miter = 1.0;
  if (l1 > 1e-4 && l2 > 1e-4) {
    vec2 a = t1 / l1, b = t2 / l2;
    dir = dot(a, b) < -0.6 ? b : normalize(a + b);
    miter = 1.0 / max(0.4, abs(dot(vec2(-dir.y, dir.x), vec2(-a.y, a.x))));
  } else if (l2 > 1e-4) dir = t2 / l2;
  else if (l1 > 1e-4) dir = t1 / l1;
  vec2 nrm = vec2(-dir.y, dir.x);
  float pxPerMm = uPrint > 0.5 ? uPxPerMm : 0.5 * uRes.y * projectionMatrix[1][1] / cP.w;
  float stand = uPrint > 0.5 ? 0.0 : smoothstep(0.0, 0.35, lift);
  float w = mix(uWidthMm * pxPerMm, uWidthPx, stand) * aSide.y;
  float hw = 0.5 * w;
  vAlpha = clamp(hw / 0.5, 0.0, 1.0);
  if (uPrint < 0.5 && aLine.w < uMinW) vAlpha = 0.0;
  // 平放就是印刷：只显示印刷版里看得见的线；立起来后被挡住的线也照常画
  if (uPrint < 0.5) vAlpha *= mix(aVis, 1.0, smoothstep(0.02, 0.3, lift));
  hw = max(hw, 0.5);
  float ext = hw + 1.0;
  vD = aSide.x * ext; vHalf = hw;
  cP.xy += nrm * aSide.x * ext * min(miter, 2.5) / (0.5 * uRes) * cP.w;
  // 平放的那一份是纸上的印刷，立着的东西不能挡住它
  if (uPrint < 0.5 && uCopy > 0.5) cP.z = -cP.w * 0.995;
  vS = aS.y; vHead = head; vGrow = uPrint > 0.5 ? 0.0 : (uCopy > 0.5 ? -1.0 : 1.0);
  gl_Position = cP;
}`;

const FRAG = /* glsl */ `
uniform vec3 uInk; uniform float uOpacity; uniform vec4 uClip; uniform float uStandAlpha, uCopyAlpha;
varying float vD; varying float vHalf; varying float vS; varying float vHead; varying float vGrow; varying float vAlpha;
varying vec3 vWorld;
void main() {
  if (dot(vec4(vWorld, 1.0), uClip) > 0.0) discard;
  if (vGrow > 0.5 && vS > vHead) discard;     // 立着的：只显示钢笔已经画过的部分
  if (vGrow < -0.5 && vS <= vHead) discard;   // 平放的：只显示钢笔还没画到的部分
  float cov = clamp(vHalf + 0.5 - abs(vD), 0.0, 1.0) * vAlpha * uOpacity * (vGrow < -0.5 ? uCopyAlpha : uStandAlpha);
  if (cov < 0.003) discard;
  gl_FragColor = vec4(uInk, cov);
}`;

/** 墨线材质。pop：所属立体插图的共享 uniform（uScene、uCab、uClock…） */
export function inkMaterial({ widthPx = 1.5, widthMm = 0.34, bias = 2, color = INK_COLOR, pop } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uWidthPx: { value: widthPx },
      uWidthMm: { value: widthMm },
      uBias: { value: bias },
      uInk: { value: new THREE.Color(color) },
      uOpacity: { value: 1 },
      uClip: { value: new THREE.Vector4(0, 0, 0, -1) },
      uCopy: { value: 0 },
      ...pop,
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
}

// ---------- 笔压与抖动 ----------
function hash(n) {
  let t = (n | 0) ^ 2654435769;
  t = Math.imul(t ^ (t >>> 16), 2246822507);
  t = Math.imul(t ^ (t >>> 13), 3266489909);
  t ^= t >>> 16;
  return (t >>> 0) / 4294967296;
}
function noise1(seed, x) {
  const i = Math.floor(x), f = x - i, s = f * f * (3 - 2 * f);
  const a = hash(seed * 7919 + i), b = hash(seed * 7919 + i + 1);
  return a + (b - a) * s;
}
function noise3(x, y, z, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), sz = fz * fz * (3 - 2 * fz);
  const h = (a, b, c) => hash(((xi + a) * 73856093) ^ ((yi + b) * 19349663) ^ ((zi + c) * 83492791) ^ (seed * 2654435761));
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h(0, 0, 0), h(1, 0, 0), sx), L(h(0, 1, 0), h(1, 1, 0), sx), sy), L(L(h(0, 0, 1), h(1, 0, 1), sx), L(h(0, 1, 1), h(1, 1, 1), sx), sy), sz);
}
/** 笔压：沿弧长起伏，两端各 4.5 毫米内收细 */
function pressure(seed, s, len, taper) {
  let w = 0.8 + 0.36 * noise1(seed, s / 34) + 0.1 * noise1(seed + 17, s / 7);
  if (taper) w *= Math.min(1, 0.42 + 0.58 * Math.min(1, s / 4.5)) * Math.min(1, 0.42 + 0.58 * Math.min(1, (len - s) / 4.5));
  return w;
}

/** 把折线按最大段长细分，让笔压和抖动有足够的采样 */
function densify(pts, maxSeg = 1.6, closed = false) {
  const src = closed ? [...pts, pts[0]] : pts;
  const out = [src[0].clone()];
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1], b = src[i];
    const n = Math.max(1, Math.ceil(a.distanceTo(b) / maxSeg));
    for (let k = 1; k <= n; k++) out.push(a.clone().lerp(b, k / n));
  }
  return out;
}

export const polyLength = (pts) => { let s = 0; for (let i = 1; i < pts.length; i++) s += pts[i].distanceTo(pts[i - 1]); return s; };

/**
 * 一组笔画。add(points, opts) 加一条；build() 生成网格。
 * capacity > 0 时用于每帧更新的线（如回转体轮廓），用 setLines 改写，另有一份平放用的几何。
 * opts: {width, t0, dur, sched:{t0,dur}, taper, closed, overshoot, wobble, maxSeg, seed}
 */
export class StrokeSet {
  constructor(material, { capacity = 0 } = {}) {
    this.material = material;
    this.lines = [];
    this.geometry = new THREE.BufferGeometry();
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    const flatMat = material.clone();
    flatMat.uniforms = { ...material.uniforms, uCopy: { value: 1 }, uClip: { value: new THREE.Vector4(0, 0, 0, -1) } };
    this.flatGeometry = capacity ? new THREE.BufferGeometry() : this.geometry;
    this.flat = new THREE.Mesh(this.flatGeometry, flatMat);
    this.flat.frustumCulled = false;
    this.flat.renderOrder = 11;
    this.flat.visible = false;
    this.mesh.add(this.flat);
    this.capacity = capacity;
    if (capacity) {
      this.alloc(this.geometry, capacity, true);
      this.alloc(this.flatGeometry, capacity, true);
    }
  }

  prep(points, o, idx) {
    let pts = points.map((p) => p.clone());
    if (o.overshoot && pts.length > 1) {
      const k = o.overshoot, n = pts.length;
      pts[0] = pts[0].clone().addScaledVector(pts[0].clone().sub(pts[1]).normalize(), k);
      pts[n - 1] = pts[n - 1].clone().addScaledVector(pts[n - 1].clone().sub(pts[n - 2]).normalize(), k);
    }
    pts = densify(pts, o.maxSeg ?? 1.6, o.closed);
    const seed = o.seed ?? idx * 31 + 7;
    if (o.wobble) {
      const k = o.wobble;
      for (const p of pts) {
        const x = p.x / 22, y = p.y / 22, z = p.z / 22;
        p.x += k * (noise3(x, y, z, seed) - 0.5);
        p.y += k * (noise3(x + 9, y, z, seed) - 0.5);
        p.z += k * (noise3(x, y + 9, z, seed) - 0.5);
      }
    }
    return {
      pts, width: o.width ?? 1, t0: o.t0 ?? 0, dur: o.dur ?? 0.5, sched: o.sched ?? null,
      seed, taper: o.taper ?? true, closed: !!o.closed,
    };
  }

  add(points, o = {}) { this.lines.push(this.prep(points, o, this.lines.length)); return this; }

  alloc(g, verts, dynamic) {
    const n = verts * 2;
    const attr = (size) => { const a = new THREE.BufferAttribute(new Float32Array(n * size), size); if (dynamic) a.setUsage(THREE.DynamicDrawUsage); return a; };
    g.setAttribute('position', attr(3));
    g.setAttribute('aPrev', attr(3));
    g.setAttribute('aNext', attr(3));
    g.setAttribute('aS', attr(3));
    g.setAttribute('aLine', attr(4));
    g.setAttribute('aSide', attr(2));
    const vis = attr(1);
    vis.array.fill(1);
    g.setAttribute('aVis', vis);
    const idx = new THREE.BufferAttribute(new (n > 65535 ? Uint32Array : Uint16Array)(Math.max(1, verts - 1) * 6), 1);
    if (dynamic) idx.setUsage(THREE.DynamicDrawUsage);
    g.setIndex(idx);
  }

  write(g, lines) {
    const P = g.attributes.position.array, A = g.attributes.aPrev.array, B = g.attributes.aNext.array;
    const S = g.attributes.aS.array, Ln = g.attributes.aLine.array, Sd = g.attributes.aSide.array, I = g.index.array;
    let v = 0, ii = 0;
    for (const m of lines) {
      const c = m.pts, n = c.length;
      if (n < 2) continue;
      const acc = new Float32Array(n);
      for (let k = 1; k < n; k++) acc[k] = acc[k - 1] + c[k].distanceTo(c[k - 1]);
      const len = acc[n - 1], first = v;
      const t0 = m.sched ? m.sched.t0 : m.t0, dur = m.sched ? m.sched.dur : m.dur;
      for (let k = 0; k < n; k++) {
        const kp = k > 0 ? k - 1 : m.closed ? n - 2 : 0;
        const kn = k < n - 1 ? k + 1 : m.closed ? 1 : n - 1;
        const w = m.width * pressure(m.seed, acc[k], len, m.taper && !m.closed);
        for (const side of [-1, 1]) {
          P[v * 3] = c[k].x; P[v * 3 + 1] = c[k].y; P[v * 3 + 2] = c[k].z;
          A[v * 3] = c[kp].x; A[v * 3 + 1] = c[kp].y; A[v * 3 + 2] = c[kp].z;
          B[v * 3] = c[kn].x; B[v * 3 + 1] = c[kn].y; B[v * 3 + 2] = c[kn].z;
          S[v * 3] = acc[kp]; S[v * 3 + 1] = acc[k]; S[v * 3 + 2] = acc[kn];
          Ln[v * 4] = len; Ln[v * 4 + 1] = t0; Ln[v * 4 + 2] = dur; Ln[v * 4 + 3] = m.width;
          Sd[v * 2] = side; Sd[v * 2 + 1] = w;
          v++;
        }
      }
      for (let k = 0; k < n - 1; k++) {
        const a = first + k * 2;
        I[ii++] = a; I[ii++] = a + 2; I[ii++] = a + 1;
        I[ii++] = a + 1; I[ii++] = a + 2; I[ii++] = a + 3;
      }
    }
    for (const k of ['position', 'aPrev', 'aNext', 'aS', 'aLine', 'aSide']) g.attributes[k].needsUpdate = true;
    g.index.needsUpdate = true;
    g.setDrawRange(0, ii);
    return { verts: v, indices: ii };
  }

  build() {
    let n = 0;
    for (const m of this.lines) n += m.pts.length;
    this.alloc(this.geometry, Math.max(2, n), false);
    this.stats = this.write(this.geometry, this.lines);
    this.geometry.computeBoundingSphere();
    return this;
  }

  /** 每帧更新的线：standing 用于立着显示，flat 用于平放（印刷视角） */
  setLines(standing, flat = null) {
    this.lines = standing.map((l, i) => this.prep(l.points, l, i));
    const flatLines = flat ? flat.map((l, i) => this.prep(l.points, l, i)) : this.lines;
    const need = Math.max(this.lines.reduce((s, l) => s + l.pts.length, 0), flatLines.reduce((s, l) => s + l.pts.length, 0));
    if (need > this.capacity) {
      this.capacity = Math.ceil(need * 1.5);
      this.alloc(this.geometry, this.capacity, true);
      this.alloc(this.flatGeometry, this.capacity, true);
    }
    this.stats = this.write(this.geometry, this.lines);
    this.write(this.flatGeometry, flatLines);
  }

  get end() {
    let t = 0;
    for (const m of this.lines) t = Math.max(t, m.sched ? m.sched.t0 + m.sched.dur : m.t0 + m.dur);
    return t;
  }
}

/**
 * 钢笔：每一笔开始后隔 gap 秒就开始下一笔（笔画互相叠着，像一串连续的勾勒），
 * 每笔时长按长度 / 速度，限制在 [min, max]。fit(总时长) 把整张图缩放到指定时间。
 */
export class Pen {
  constructor({ speed = 300, gap = 0.035, min = 0.1, max = 0.55 } = {}) {
    Object.assign(this, { speed, gap, min, max });
    this.t = 0;
    this.items = [];
  }
  next(length, delay = 0) {
    const s = { t0: this.t + delay, dur: Math.min(this.max, Math.max(this.min, length / this.speed)) };
    this.t = s.t0 + this.gap;
    this.items.push(s);
    return s;
  }
  pause(dt) { this.t += dt; }
  get end() { let t = 0; for (const s of this.items) t = Math.max(t, s.t0 + s.dur); return t; }
  fit(total) {
    const k = total / Math.max(1e-6, this.end);
    for (const s of this.items) { s.t0 *= k; s.dur *= k; }
    return this;
  }
}
