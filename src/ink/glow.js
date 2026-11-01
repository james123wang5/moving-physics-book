import * as THREE from 'three';
import { POP_GLSL } from './pop-glsl.js';
import { StrokeSet } from './strokes.js';
import { circlePts } from './shapes.js';

// 发光的东西：液体速度管、火花、水流。亮度超过 1，经辉光后期泛出柔光；
// 另有几盏点光源跟着最亮的发光体，把彩色的光溢到纸面和插图表面上。

const GLOW_VERT = /* glsl */ `
${POP_GLSL}
uniform float uLiftSurf;
varying vec3 vPos; varying vec3 vN; varying vec3 vView;
void main() {
  vPos = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * vec4(popWorld(w.xyz, uLiftSurf), 1.0);
  vN = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uGlow; uniform float uTime; uniform float uTop; uniform float uAlpha; uniform float uRadius; uniform float uPrint;
varying vec3 vPos; varying vec3 vN; varying vec3 vView;
void main() {
  if (uPrint > 0.5) discard;
  float h = clamp(vPos.y / max(uTop, 1e-3), 0.0, 1.0);
  float facing = abs(dot(normalize(vN), normalize(vView)));
  float rim = pow(1.0 - facing, 2.2);
  bool top = vN.y > 0.5;
  // 缓慢流动的内部暗流，满罐也不像一块平涂的颜色
  float a = atan(vPos.z, vPos.x);
  float sw = 0.5 + 0.5 * sin(vPos.y * 0.42 - uTime * 1.1 + sin(a * 3.0 + uTime * 0.6) * 1.6);
  float b = 0.58 + 0.34 * h + 0.55 * rim + 0.16 * sw;
  if (top) { float rr = length(vPos.xz) / max(uRadius, 1e-3); b = 1.25 + 0.55 * smoothstep(0.55, 1.0, rr); }
  gl_FragColor = vec4(uColor * uGlow * b, uAlpha);
}`;

/** 发光液体材质；pop：所属的立体插图（跟着立起/折回） */
export function glowMaterial(pop, { color = '#2f7bff', glow = 3.6, radius = 10 } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) }, uGlow: { value: glow }, uTime: { value: 0 },
      uTop: { value: 1 }, uAlpha: { value: 1 }, uRadius: { value: radius },
      uLiftSurf: pop.u.uLiftSurf, uPrint: pop.u.uPrint, uScene: pop.u.uScene, uSceneInv: pop.u.uSceneInv, uCab: pop.u.uCab,
    },
    vertexShader: GLOW_VERT,
    fragmentShader: GLOW_FRAG,
    transparent: true,
    depthWrite: true,
  });
}

/** 发光的小点（火花、水滴、频闪光点）：始终朝向相机的软圆 */
const SPARK_VERT = /* glsl */ `
${POP_GLSL}
uniform float uLiftSurf; uniform float uSize; uniform vec2 uRes;
attribute vec4 aCol;
varying vec4 vCol;
void main() {
  vCol = aCol;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vec4 mv = viewMatrix * vec4(popWorld(w.xyz, uLiftSurf), 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, uSize * aCol.a * 0.5 * uRes.y * projectionMatrix[1][1] / gl_Position.w);
}`;
const SPARK_FRAG = /* glsl */ `
uniform float uPrint; varying vec4 vCol;
void main() {
  if (uPrint > 0.5) discard;
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = dot(q, q);
  if (r > 1.0) discard;
  float k = exp(-r * 3.2);
  gl_FragColor = vec4(vCol.rgb * (0.4 + 1.6 * k), k);
}`;

export class Sparks {
  constructor(pop, { max = 400, size = 1.6 } = {}) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uSize: { value: size }, uRes: pop.u.uRes, uLiftSurf: pop.u.uLiftSurf, uPrint: pop.u.uPrint, uScene: pop.u.uScene, uSceneInv: pop.u.uSceneInv, uCab: pop.u.uCab },
      vertexShader: SPARK_VERT, fragmentShader: SPARK_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.layers.enable(1);
    this.points.renderOrder = 20;
    this.list = [];
  }
  /** 一个粒子：位置 p、速度 v（毫米/秒）、颜色、寿命、重力（毫米/秒²）、大小、空气阻力（a = −k v|v|，k 每毫米） */
  emit(p, v, color, life = 0.8, gravity = 0, size = 1, drag = 0) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ p: p.clone(), v: v.clone(), c: new THREE.Color(color), life, age: 0, g: gravity, size, k: drag });
  }
  update(dt, floorY = -Infinity) {
    let n = 0;
    this.list = this.list.filter((s) => (s.age += dt) < s.life);
    for (const s of this.list) {
      s.v.y -= s.g * dt;
      if (s.k) s.v.multiplyScalar(1 - s.k * s.v.length() * dt);
      s.p.addScaledVector(s.v, dt);
      if (s.p.y < floorY) { s.p.y = floorY; s.v.y *= -0.18; s.v.x *= 0.35; s.v.z *= 0.35; s.life = Math.min(s.life, s.age + 0.18); }
      const fade = 1 - s.age / s.life;
      this.pos[n * 3] = s.p.x; this.pos[n * 3 + 1] = s.p.y; this.pos[n * 3 + 2] = s.p.z;
      this.col[n * 4] = s.c.r * 5; this.col[n * 4 + 1] = s.c.g * 5; this.col[n * 4 + 2] = s.c.b * 5; this.col[n * 4 + 3] = s.size * (0.4 + 0.6 * fade);
      n++;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aCol.needsUpdate = true;
    g.setDrawRange(0, n);
  }
  /** 当前粒子的平均位置和亮度（给溢光灯用） */
  lightInfo(out = new THREE.Vector3()) {
    if (!this.list.length) return { pos: out, color: new THREE.Color(), strength: 0 };
    out.set(0, 0, 0);
    const c = new THREE.Color(0, 0, 0);
    for (const s of this.list) { out.add(s.p); c.add(s.c); }
    out.divideScalar(this.list.length);
    c.multiplyScalar(1 / this.list.length);
    this.points.updateWorldMatrix(true, false);
    out.applyMatrix4(this.points.matrixWorld);
    return { pos: out, color: c, strength: Math.min(1, this.list.length / 40) * 0.6 };
  }
}

/** 火花轨迹：每个粒子画成一小段沿速度方向的亮线（像长曝光照片里的火花） */
const STREAK_VERT = /* glsl */ `
${POP_GLSL}
uniform float uLiftSurf;
attribute vec4 aCol;
varying vec4 vCol;
void main() {
  vCol = aCol;
  vec4 w = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(popWorld(w.xyz, uLiftSurf), 1.0);
}`;
const STREAK_FRAG = /* glsl */ `
uniform float uPrint; varying vec4 vCol;
void main() { if (uPrint > 0.5) discard; gl_FragColor = vec4(vCol.rgb, vCol.a); }`;

export class Streaks {
  constructor(pop, { max = 600, tail = 0.035 } = {}) {
    this.max = max; this.tail = tail;
    this.pos = new Float32Array(max * 6);
    this.col = new Float32Array(max * 8);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aCol', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uLiftSurf: pop.u.uLiftSurf, uPrint: pop.u.uPrint, uScene: pop.u.uScene, uSceneInv: pop.u.uSceneInv, uCab: pop.u.uCab },
      vertexShader: STREAK_VERT, fragmentShader: STREAK_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.lines = new THREE.LineSegments(g, this.mat);
    this.lines.frustumCulled = false;
    this.lines.layers.enable(1);
    this.lines.renderOrder = 20;
    this.points = this.lines;
    this.list = [];
  }
  emit(p, v, color, life = 0.6, gravity = 0, size = 1, drag = 0) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ p: p.clone(), v: v.clone(), c: new THREE.Color(color), life, age: 0, g: gravity, size, k: drag });
  }
  update(dt, floorY = -Infinity) {
    this.list = this.list.filter((s) => (s.age += dt) < s.life);
    let n = 0;
    for (const s of this.list) {
      s.v.y -= s.g * dt;
      if (s.k) s.v.multiplyScalar(1 - s.k * s.v.length() * dt);
      s.p.addScaledVector(s.v, dt);
      if (s.p.y < floorY) { s.p.y = floorY; s.v.y *= -0.2; s.v.x *= 0.4; s.v.z *= 0.4; s.life = Math.min(s.life, s.age + 0.12); }
      const fade = 1 - s.age / s.life;
      const t = s.p.clone().addScaledVector(s.v, -this.tail * (0.6 + 0.4 * s.size));
      this.pos.set([s.p.x, s.p.y, s.p.z, t.x, t.y, t.z], n * 6);
      const k = 4.5 * fade;
      this.col.set([s.c.r * k, s.c.g * k, s.c.b * k, fade, s.c.r * k * 0.3, s.c.g * k * 0.3, s.c.b * k * 0.3, 0], n * 8);
      n++;
    }
    const g = this.lines.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aCol.needsUpdate = true;
    g.setDrawRange(0, n * 2);
  }
  lightInfo(out = new THREE.Vector3()) {
    if (!this.list.length) return { pos: out, color: new THREE.Color(), strength: 0 };
    out.set(0, 0, 0);
    for (const s of this.list) out.add(s.p);
    out.divideScalar(this.list.length);
    this.lines.updateWorldMatrix(true, false);
    out.applyMatrix4(this.lines.matrixWorld);
    return { pos: out, color: this.list[0].c, strength: Math.min(1, this.list.length / 60) * 0.07 };
  }
}

/**
 * 液体速度管：玻璃管（墨线轮廓）+ 发光液体 + 纸标签。value/capacity 决定液面。
 * 立在插图里，跟着一起画出来、立起来。
 */
export class MeterTube {
  constructor(pop, { r = 6, h = 34, color = '#2f7bff', position = new THREE.Vector3(), pen, label = '', unit = 'm/s', capacity = 5, makeTag = null, tagAt = null } = {}) {
    this.pop = pop;
    this.r = r; this.h = h; this.capacity = capacity; this.value = 0; this.shown = 0; this.color = new THREE.Color(color);
    this.group = new THREE.Group();
    this.group.position.copy(position);
    pop.group.add(this.group);
    // 玻璃：上下沿、刻度、两条侧轮廓
    const lines = new StrokeSet(pop.ink({ widthPx: 1.45 }));
    const rr = r + 0.9;
    const sched = (k) => pen?.next(k) ?? { t0: 0, dur: 0.3 };
    lines.add(circlePts(rr, 0, 72).slice(0, 72), { closed: true, sched: sched(rr * 3), width: 1 });
    lines.add(circlePts(rr, h, 72).slice(0, 72), { closed: true, sched: sched(rr * 3), width: 1.1 });
    lines.add(circlePts(rr - 0.7, h - 0.5, 72).slice(0, 72), { closed: true, sched: sched(rr * 3), width: 0.5 });
    for (let k = 1; k < 5; k++) {
      const y = (h * k) / 5;
      lines.add(circlePts(rr + 0.05, y, 16, -Math.PI * 0.62, -Math.PI * 0.38).map((p) => p), { sched: sched(4), width: 0.55, taper: false });
    }
    this.lines = lines;
    this.outline = new StrokeSet(pop.ink({ widthPx: 1.6 }), { capacity: 64 });
    this.outSched = sched(h * 2);
    pop.addLines(this.outline, this.group);
    // 液体
    this.liquidMat = glowMaterial(pop, { color, radius: r });
    this.liquid = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 40).translate(0, 0.5, 0), this.liquidMat);
    this.liquid.layers.enable(1);
    this.liquid.renderOrder = 3;
    this.group.add(this.liquid);
    if (makeTag) {
      this.tag = makeTag(pop, 18, 8);
      this.tag.mesh.position.set(...(tagAt ?? [0, 4.6, r + 3.2]));
      this.group.add(this.tag.mesh);
      this.label = label;
      this.unit = unit;
    }
    this.setValue(0, true);
    // 注意：钢笔时间表缩放之后再调用 buildLines()
  }
  buildLines() { this.lines.build(); this.pop.addLines(this.lines, this.group); }
  setValue(v, snap = false) {
    this.value = v;
    if (snap) this.shown = v;
    this.tag?.set(this.label, `${Math.abs(v).toFixed(1)} ${this.unit}`);
  }
  update(dt, camera, time) {
    this.shown += (this.value - this.shown) * (1 - Math.exp(-dt * 10));
    const fill = Math.min(1, Math.abs(this.shown) / this.capacity) * (this.h - 1.2);
    this.liquid.scale.y = Math.max(0.01, fill);
    this.liquid.position.y = 0.6;
    this.liquid.visible = fill > 0.05;
    this.liquidMat.uniforms.uTop.value = 1;
    this.liquidMat.uniforms.uTime.value = time;
    this.liquidMat.uniforms.uAlpha.value = this.pop.u.uSurfAlpha.value;
    // 侧面轮廓：从相机看过去的两条切线
    this.group.updateWorldMatrix(true, false);
    const eye = camera.getWorldPosition(new THREE.Vector3()).applyMatrix4(new THREE.Matrix4().copy(this.group.matrixWorld).invert());
    const a = Math.atan2(eye.z, eye.x), rr = this.r + 0.9;
    const c = Math.min(1, rr / Math.max(rr + 1e-3, Math.hypot(eye.x, eye.z)));
    const g = Math.acos(c);
    const side = (ang) => [new THREE.Vector3(rr * Math.cos(ang), 0, rr * Math.sin(ang)), new THREE.Vector3(rr * Math.cos(ang), this.h, rr * Math.sin(ang))];
    this.outline.setLines([
      { points: side(a - g), width: 1.15, sched: this.outSched, seed: 3 },
      { points: side(a + g), width: 1.15, sched: this.outSched, seed: 4 },
    ]);
  }
  lightInfo(out = new THREE.Vector3()) {
    this.group.updateWorldMatrix(true, false);
    const fill = Math.min(1, Math.abs(this.shown) / this.capacity);
    out.set(0, this.h * fill * 0.6, 0).applyMatrix4(this.group.matrixWorld);
    return { pos: out, color: this.color, strength: fill * this.pop.u.uSurfAlpha.value * (this.liquid.visible ? 1 : 0) };
  }
}

/** 溢光灯：几盏点光源，分给当前最亮的发光体，平滑地转移 */
export class SpillLights {
  constructor(scene, { count = 3, gain = 900 } = {}) {
    this.gain = gain;
    this.lights = Array.from({ length: count }, () => {
      const l = new THREE.PointLight(0xffffff, 0, 0, 2);
      l.layers.enableAll();
      scene.add(l);
      return l;
    });
    this.slots = this.lights.map(() => ({ src: null, k: 0 }));
  }
  update(sources, dt) {
    const info = new Map();
    for (const s of sources) {
      const i = s.lightInfo(new THREE.Vector3());
      if (i.strength > 0.01) info.set(s, i);
    }
    const held = new Set(this.slots.map((s) => s.src));
    const rank = (s) => info.get(s).strength + (held.has(s) ? 0.15 : 0);
    const top = new Set([...info.keys()].sort((a, b) => rank(b) - rank(a)).slice(0, this.lights.length));
    const fresh = [...top].filter((s) => !held.has(s));
    const k = 1 - Math.exp(-Math.max(0, dt) * 6);
    this.slots.forEach((slot, i) => {
      const L = this.lights[i];
      if (slot.src && !info.has(slot.src)) { slot.src = null; slot.k = 0; }
      if (slot.src && !top.has(slot.src)) { slot.k -= slot.k * k; if (slot.k < 0.02) { slot.src = null; slot.k = 0; } }
      if (!slot.src && fresh.length) { slot.src = fresh.shift(); slot.k = 0; }
      if (slot.src && top.has(slot.src)) slot.k += (1 - slot.k) * k;
      const g = slot.src ? info.get(slot.src) : null;
      if (!g) { L.intensity = 0; return; }
      L.position.copy(g.pos);
      L.color.copy(g.color);
      L.intensity = this.gain * g.strength * slot.k;
    });
  }
}
