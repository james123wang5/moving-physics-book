import * as THREE from 'three';
import { StrokeSet } from '../ink/strokes.js';
import { box, InkSphere, InkLathe, circlePts } from '../ink/shapes.js';
import { DioramaLesson } from './diorama.js';
import { Flight, WORLD, G, RESULT_TEXT } from './projectile-model.js';
import { makeTag, dashes, arrow, BLUE, RED } from '../ink/kit.js';
import { MeterTube } from '../ink/glow.js';

// 第 4 课 · 平抛运动的规律：抛射台沙盘。
// 插图坐标（毫米）：x 沿页面向右，y 向上，z 朝读者；物体都在折线后面（z < 0）。1 米画成 S 毫米。

const S = 48;
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const L = {
  u0: 14, foldV: 208,
  Y0: 5,            // 底座板上表面
  launchX: 30,      // 抛出点 x
  zc: -30,          // 运动平面
  platformW: 22,
  postX: -1, postZ: -44,
  rulerZ: -12,      // 地面刻度尺
  backZ: -60,       // 方格背景板
};
const X = (m) => L.launchX + m * S;
const Yp = (m) => L.Y0 + m * S;
const BALL_R = 3.4;
const ARW = 9; // 箭头长度：毫米 / (m/s)
// 斜面上的平抛：楔块顶上水平弹出，落回斜面。落点速度方向和初速度无关（tanα = 2tanφ）
const RAMP = { x0: 122.5, x1: 128.5, x2: 167, h: 30, z0: -40, z1: -24, zc: -32, r: 2.2, speeds: [0.8, 1.4, 2.0], slow: 0.25 };
RAMP.tan = RAMP.h / (RAMP.x2 - RAMP.x1);
RAMP.lift = RAMP.r / Math.cos(Math.atan(RAMP.tan));   // 球心离斜面 r 时，竖直方向高出 r/cosφ

export class ProjectileLesson extends DioramaLesson {
  exhibitDefs() {
    return [
      { name: '抛射台', rect: [-6, 170, -66, -2], scale: 0.97, pad: 2 },
      { name: '斜面', rect: [110, 184, -62, -18], scale: 2.1 },
    ];
  }

  build(ex) {
    const { pop, pen, ink, faint } = this;
    const zc = L.zc;
    if (ex === 0) {
      this.flight = new Flight();
      this.h = 1.2;
      this.v0 = 2.0;
      this.speed = 0.3;
    }
    const ballMat = pop.paper({ hatchA: [0.9, 0.12, -0.42], hatchB: [0.2, 0.9, 0.4], spacing: 1.3, seed: 7, shade: 0.12 });
    if (ex === 0) {
    // 方格背景板（每格 0.25 m）
    const backMat = pop.paper({ hatchA: [1, 0.05, 0.25], hatchB: [0.3, 1, 0.2], spacing: 2.6, seed: 9, shade: 0.04, hatch: 0.14 });
    const bx0 = 2, bx1 = X(2.4), by1 = Yp(2.0);
    box(pop, ink, V(bx0, L.Y0, L.backZ - 2), V(bx1, by1, L.backZ), { mat: backMat, pen, width: 1 });
    for (let m = 0.25; m < 2.0; m += 0.25) faint.add([V(bx0, Yp(m), L.backZ), V(bx1, Yp(m), L.backZ)], { sched: pen.next(bx1 - bx0), width: m % 0.5 < 1e-6 ? 0.7 : 0.45, taper: false });
    for (let x = X(0); x < bx1; x += 0.25 * S) faint.add([V(x, L.Y0, L.backZ), V(x, by1, L.backZ)], { sched: pen.next(by1 - L.Y0), width: 0.45, taper: false });

    // 立柱（记高度）
    const postMat = pop.paper({ hatchA: [0.6, 0.7, 0.4], hatchB: [1, 0, 0.3], spacing: 1.4, seed: 5 });
    box(pop, ink, V(L.postX - 1.3, L.Y0, L.postZ - 1.3), V(L.postX + 1.3, Yp(1.95), L.postZ + 1.3), { mat: postMat, pen, width: 0.9 });
    for (let m = 0.25; m <= 1.9001; m += 0.25) {
      const big = Math.abs(m * 2 - Math.round(m * 2)) < 1e-6;
      ink.add([V(L.postX + 1.3, Yp(m), L.postZ + 1.3), V(L.postX + 1.3 + (big ? 4.2 : 2.4), Yp(m), L.postZ + 1.3)], { sched: pen.next(4), width: big ? 0.85 : 0.6, taper: false });
    }

    // 地面刻度尺：一条薄纸条
    const rulerMat = pop.paper({ hatch: 0, color: '#fbf6ea' });
    box(pop, ink, V(X(-0.05), L.Y0, L.rulerZ - 3), V(X(2.4), L.Y0 + 0.3, L.rulerZ + 3), { mat: rulerMat, pen, width: 0.7, hide: ['side'] });
    for (let m = 0; m <= 2.4001; m += 0.125) {
      const big = Math.abs(m * 2 - Math.round(m * 2)) < 1e-6;
      ink.add([V(X(m), L.Y0 + 0.31, L.rulerZ - 3), V(X(m), L.Y0 + 0.31, L.rulerZ - 3 + (big ? 3.2 : 1.6))], { sched: pen.next(3), width: big ? 0.75 : 0.5, taper: false });
    }

    // 矮墙（带砖缝）
    const wallMat = pop.paper({ hatchA: [0.62, 0.62, 0.48], hatchB: [-0.5, 0.45, 0.74], spacing: 1.5, seed: 3 });
    const w0 = X(WORLD.wall.x0), w1 = X(WORLD.wall.x1);
    box(pop, ink, V(w0, L.Y0, zc - 10), V(w1, Yp(WORLD.wall.h), zc + 10), { mat: wallMat, pen, width: 1 });
    for (let y = Yp(0.1); y < Yp(WORLD.wall.h) - 1; y += 0.1 * S) faint.add([V(w0, y, zc + 10), V(w1, y, zc + 10)], { sched: pen.next(w1 - w0), width: 0.5, taper: false });

    // 桶
    const r0 = WORLD.bucket.r * S, bh = WORLD.bucket.h * S;
    const tin = pop.paper({ hatchA: [1, 0.05, 0.25], hatchB: [0.3, 1, 0.2], spacing: 1.3, seed: 7, color: '#f7f6f2' });
    tin.side = THREE.DoubleSide;
    this.bucket = new InkLathe(pop, [[r0 * 0.8, 0.2], [r0, bh]], { mat: tin, pen, rims: [0, 1], width: 1 });
    this.bucket.group.position.set(X(WORLD.bucket.x), L.Y0, zc);
    for (let a = 0.3; a < Math.PI * 2; a += Math.PI / 6) {
      this.bucket.add([V(r0 * 0.82 * Math.cos(a), 1, r0 * 0.82 * Math.sin(a)), V(r0 * 0.99 * Math.cos(a), bh - 1, r0 * 0.99 * Math.sin(a))], { sched: pen.next(bh), width: 0.45 });
    }

    // 平台（高度可调：表面按比例拉伸，棱线每次重算）
    const wood = pop.paper({ hatchA: [1, 0, 0.12], hatchB: [0.2, 0.3, 1], spacing: 1.5, seed: 4 });
    this.platform = new THREE.Mesh(new THREE.BoxGeometry(L.platformW, 1, 20).translate(0, 0.5, 0), wood);
    this.platform.position.set(L.launchX - L.platformW / 2, L.Y0, zc);
    pop.addSurface(this.platform);
    this.platformEdges = new StrokeSet(pop.ink({ widthPx: 1.55 }), { capacity: 64 });
    pop.addLines(this.platformEdges);
    this.platformSched = Array.from({ length: 12 }, () => pen.next(40));
    // 平台顶上的把手
    const knobMat = pop.paper({ hatchA: [0.9, 0.12, -0.42], hatchB: [0.2, 0.9, 0.4], spacing: 1.2, seed: 8, color: '#f1d9c9' });
    this.knob = new InkSphere(pop, { r: 2.2, centre: V(L.launchX - L.platformW + 5, 0, zc), mat: knobMat, sched: pen.next(14), width: 0.9 });

    // 小球
    this.ball = new InkSphere(pop, { r: BALL_R, centre: V(0, 0, zc), mat: ballMat, sched: pen.next(2 * Math.PI * BALL_R) });

    // 动态线：初速度箭头、轨迹、频闪圈、投影记号、速度分解箭头
    this.arrowSet = new StrokeSet(pop.ink({ widthPx: 1.9 }), { capacity: 40 });
    this.arrowSched = pen.next(30);
    this.trail = new StrokeSet(pop.ink({ widthPx: 1.3 }), { capacity: 2000 });
    this.blueSet = new StrokeSet(pop.ink({ widthPx: 1.7, color: BLUE }), { capacity: 400 });
    this.redSet = new StrokeSet(pop.ink({ widthPx: 1.7, color: RED }), { capacity: 400 });
    for (const s of [this.arrowSet, this.trail, this.blueSet, this.redSet]) pop.addLines(s);

    // 纸标签
    this.tagH = makeTag(pop, 22, 9);
    this.tagV = makeTag(pop, 22, 9);

    // 两支发光的速度管：蓝 = 水平分速度，红 = 竖直分速度
    // 仪表架：木板托着两支速度管
    [this.tubeX, this.tubeY] = this.rack({ cx: 154, z: -50, y0: L.Y0, legH: 14, r: 7, h: 17, items: [{ color: '#2f7bff', label: '水平 vₓ', capacity: 6 }, { color: '#ff4a2a', label: '竖直 vᵧ', capacity: 6 }] });

    this.drawTime = 3.4;
    this.deferred.push(() => { this.bucket.build(); });
    this.lifters.push(this.ball, this.knob, this.bucket);
    this.applyHeight();
    this.placeBall();
    }
    if (ex === 1) {

      const R = RAMP;
      const shape = new THREE.Shape([new THREE.Vector2(R.x0, 0), new THREE.Vector2(R.x0, R.h), new THREE.Vector2(R.x1, R.h), new THREE.Vector2(R.x2, 0)]);
      const wedgeMat = pop.paper({ hatchA: [0.6, 0.7, 0.4], hatchB: [1, 0, 0.3], spacing: 1.6, seed: 81, color: '#f6f3ec', hatch: 0.45 });
      const wedge = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: R.z1 - R.z0, bevelEnabled: false }), wedgeMat);
      wedge.position.set(0, L.Y0, R.z0);
      pop.addSurface(wedge);
      const outline = (z) => [V(R.x0, L.Y0, z), V(R.x0, L.Y0 + R.h, z), V(R.x1, L.Y0 + R.h, z), V(R.x2, L.Y0, z)];
      ink.add(outline(R.z1), { closed: true, sched: pen.next(120), width: 1 });
      ink.add(outline(R.z0).slice(1, 4), { sched: pen.next(60), width: 0.8 });
      for (const [x, y] of [[R.x0, R.h], [R.x1, R.h], [R.x2, 0], [R.x0, 0]]) ink.add([V(x, L.Y0 + y, R.z0), V(x, L.Y0 + y, R.z1)], { sched: pen.next(16), width: 0.9 });
      // 斜面上的刻度（每 0.1 m 水平距离一格）
      for (let m = 0.1; m < (R.x2 - R.x1) / S - 0.02; m += 0.1) {
        const x = R.x1 + m * S, y = L.Y0 + R.h - m * S * R.tan;
        faint.add([V(x, y + 0.05, R.z1 - 3), V(x, y + 0.05, R.z1 - 0.2)], { sched: pen.next(3), width: 0.5, taper: false });
      }
      const knob = pop.paper({ hatchA: [1, 0, 0.12], hatchB: [0.2, 0.3, 1], spacing: 1.1, seed: 82, color: '#f0d8c8' });
      this.rampKick = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4, 6), knob);
      this.rampKick.position.set(R.x0 + 2.4, L.Y0 + R.h + 2, R.zc);
      pop.addSurface(this.rampKick);
      box(pop, ink, V(R.x0 + 0.3, L.Y0 + R.h, R.zc - 3), V(R.x0 + 4.5, L.Y0 + R.h + 4, R.zc + 3), { pen, width: 0.8 });
      this.rampBall = new InkSphere(pop, { r: R.r, centre: V(R.x1 - R.r, L.Y0 + R.h + R.lift, R.zc), mat: ballMat, sched: pen.next(14), width: 0.95 });
      this.rampSet = new StrokeSet(pop.ink({ widthPx: 1.4 }), { capacity: 600 });
      this.rampRed = new StrokeSet(pop.ink({ widthPx: 1.5, color: RED }), { capacity: 120 });
      for (const st of [this.rampSet, this.rampRed]) pop.addLines(st);
      this.rampTag = makeTag(pop, 26, 9);
      this.rampTag.mesh.position.set(R.x0 + 2, L.Y0 + R.h + 13, R.zc);
      this.rampTag.mesh.scale.setScalar(0.62);
      this.rampTag.set('斜面上平抛', '点木块发射');
      this.ramp = { throws: [], cur: null, next: 0 };
      // 仪表架：高脚架立在斜面右后方，杯子高出斜面顶，读水平、竖直分速度；落地后停在落点的值，比一比 vᵧ / vₓ
      [this.rampVx, this.rampVy] = this.rack({ cx: 162, z: -54, y0: L.Y0, legH: 30, r: 5.5, h: 13, items: [{ color: '#2f7bff', label: '水平 vₓ', capacity: 4 }, { color: '#ff4a2a', label: '竖直 vᵧ', capacity: 4 }] });
      this.lifters.push(this.rampBall);
    }
  }

  // ---------- 场景更新 ----------
  applyHeight() {
    const hS = this.h * S, zc = L.zc;
    this.platform.scale.y = hS;
    const x0 = L.launchX - L.platformW, x1 = L.launchX, y0 = L.Y0, y1 = L.Y0 + hS, z0 = zc - 10, z1 = zc + 10;
    const E = [
      [[x0, y0, z1], [x1, y0, z1]], [[x0, y1, z0], [x1, y1, z0]], [[x0, y1, z1], [x1, y1, z1]], [[x0, y1, z0], [x0, y1, z1]], [[x1, y1, z0], [x1, y1, z1]],
      [[x0, y0, z0], [x0, y1, z0]], [[x1, y0, z0], [x1, y1, z0]], [[x0, y0, z1], [x0, y1, z1]], [[x1, y0, z1], [x1, y1, z1]],
    ];
    this.platformEdges.setLines(E.map(([a, b], i) => ({ points: [V(...a), V(...b)], width: 1.05, overshoot: 0.6, sched: this.platformSched[i], seed: 40 + i })));
    this.knob.mesh.position.set(L.launchX - L.platformW + 5, y1 + 2.2, zc - 4);
    this.tagH.mesh.position.set(L.postX + 13, Math.min(Yp(1.95) - 6, y1 + 13), L.postZ + 1.5);
    this.tagH.set('高度 h', `${this.h.toFixed(2)} m`);
  }

  ballPos(x, y) { return V(X(x) - BALL_R * 0.6, Yp(y) + BALL_R, L.zc); }

  placeBall() {
    const f = this.flight;
    const p = f.phase === 'ready' ? { x: 0, y: this.h } : f.pos;
    this.ball.mesh.position.copy(this.ballPos(p.x, p.y));
    // 初速度箭头（准备时显示，可拖）
    const ready = f.phase === 'ready';
    const b = this.ball.mesh.position;
    const tail = b.clone().add(V(BALL_R + 1, 0, 0));
    const tip = tail.clone().add(V(this.v0 * ARW, 0, 0));
    const arrows = [];
    if (ready) {
      arrows.push({ points: [tail, tip], width: 1.2, sched: this.arrowSched, taper: false });
      arrows.push({ points: [tip.clone().add(V(-3, 1.6, 0)), tip, tip.clone().add(V(-3, -1.6, 0))], width: 1.2, sched: this.arrowSched, taper: false });
    }
    this.arrowSet.setLines(arrows);
    this.tagV.mesh.visible = ready;
    this.tagV.mesh.position.set(tip.x + 13, tip.y + 7, L.zc);
    this.tagV.set('初速度 v₀', `${this.v0.toFixed(1)} m/s`);
    this.arrowTip = tip;
  }

  /** 飞行中的轨迹、频闪、投影记号和速度分解 */
  drawTrail() {
    const f = this.flight, zc = L.zc;
    if (f.phase === 'ready') {
      this.trail.setLines([]); this.blueSet.setLines([]); this.redSet.setLines([]);
      return;
    }
    const tEnd = f.phase === 'flying' ? f.t : f.plan.end.t;
    const trail = [], blue = [], red = [];
    const curve = [];
    const n = Math.max(2, Math.ceil(tEnd / 0.01));
    for (let i = 0; i <= n; i++) { const a = f.at((tEnd * i) / n); curve.push(this.ballPos(a.x, a.y)); }
    for (const d of dashes(curve, 2.2, 1.4)) trail.push({ points: d, width: 0.8, taper: false });
    // 频闪：每 0.1 s 一个小圈，以及蓝（水平）红（竖直）记号
    for (let t = 0; t <= tEnd + 1e-9; t += 0.1) {
      const a = f.at(t), c = this.ballPos(a.x, a.y);
      trail.push({ points: circlePts(BALL_R * 0.55, 0, 24).map((p) => V(c.x + p.x, c.y + p.z, zc)), closed: true, width: 0.7, taper: false });
      blue.push({ points: [V(X(a.x) - BALL_R * 0.6, L.Y0 + 0.35, L.rulerZ - 3.2), V(X(a.x) - BALL_R * 0.6, L.Y0 + 0.35, L.rulerZ + 3.2)], width: 1.3, taper: false });
      red.push({ points: [V(L.postX + 1.3, Yp(a.y) + BALL_R, L.postZ + 1.3), V(L.postX + 7, Yp(a.y) + BALL_R, L.postZ + 1.3)], width: 1.3, taper: false });
    }
    // 此刻的速度分解（飞行中）
    if (f.phase === 'flying') {
      const a = f.at(f.t), o = this.ballPos(a.x, a.y);
      const vx = V(a.vx * ARW * 0.8, 0, 0), vy = V(0, -a.vy * ARW * 0.8, 0);
      const arrow = (from, d) => {
        const tip = from.clone().add(d), u = d.clone().normalize(), nrm = V(-u.y, u.x, 0);
        return [{ points: [from, tip], width: 1.1, taper: false }, { points: [tip.clone().addScaledVector(u, -2.6).addScaledVector(nrm, 1.4), tip, tip.clone().addScaledVector(u, -2.6).addScaledVector(nrm, -1.4)], width: 1.1, taper: false }];
      };
      blue.push(...arrow(o, vx));
      red.push(...arrow(o, vy));
      trail.push(...arrow(o, vx.clone().add(vy)));
      // 投影虚线：球到地面、球到立柱
      for (let y = o.y - BALL_R - 1; y > L.Y0 + 1; y -= 3) blue.push({ points: [V(o.x, y, zc), V(o.x, Math.max(L.Y0 + 0.5, y - 1.6), zc)], width: 0.6, taper: false });
      for (let x = o.x - BALL_R - 1; x > L.postX + 2; x -= 3) red.push({ points: [V(x, o.y, zc), V(Math.max(L.postX + 2, x - 1.6), o.y, zc)], width: 0.6, taper: false });
    }
    this.trail.setLines(trail);
    this.blueSet.setLines(blue);
    this.redSet.setLines(red);
  }

  updateNumbers() {
    if (this.ex !== 0) { this.setNumbers(['斜面上平抛：', '落点速度与斜面的夹角', '和 v₀ 无关']); return; }
    const f = this.flight, h = this.h, v0 = this.v0;
    const tG = Math.sqrt((2 * h) / G);
    const lines = [`h = ${h.toFixed(2)} m`, `v₀ = ${v0.toFixed(1)} m/s`, `t = √(2h/g)`, `  = ${tG.toFixed(2)} s`, `x = v₀t = ${(v0 * tG).toFixed(2)} m`];
    if (f.phase !== 'ready') {
      const t = f.phase === 'flying' ? f.t : f.plan.end.t;
      lines.push('', `此刻 t = ${t.toFixed(2)} s`, `x = ${(v0 * t).toFixed(2)} m`, `下落 ½gt² = ${(0.5 * G * t * t).toFixed(2)} m`, `v_y = gt = ${(G * t).toFixed(1)} m/s`);
      if (f.result) lines.push(RESULT_TEXT[f.result.kind](f.result.x));
    }
    this.setNumbers(lines);
  }

  // ---------- 交互 ----------
  setHeight(h) {
    h = Math.round(Math.min(WORLD.hRange[1], Math.max(WORLD.hRange[0], h)) / 0.05) * 0.05;
    if (Math.abs(h - this.h) < 1e-6) return;
    this.h = h;
    this.resetFlight();
    this.applyHeight();
  }

  setSpeed(v) {
    v = Math.round(Math.min(WORLD.vRange[1], Math.max(WORLD.vRange[0], v)) * 10) / 10;
    if (Math.abs(v - this.v0) < 1e-6) return;
    this.v0 = v;
    this.resetFlight();
  }

  resetFlight() {
    this.flight.reset(this.h, this.v0);
    this.placeBall();
    this.drawTrail();
    this.updateNumbers();
  }

  // ---------- 斜面上的平抛 ----------
  fireRamp() {
    const R = RAMP, r = this.ramp;
    if (r.cur) return;
    const v0 = R.speeds[r.next % R.speeds.length];
    r.next++;
    const T = (2 * v0 * R.tan) / G;
    r.cur = { v0, T, t: 0 };
    if (r.next % R.speeds.length === 1) r.throws = [];
    this.app.sound?.play('launch');
  }

  rampPos(v0, t) { const R = RAMP; return V(R.x1 + v0 * t * S, L.Y0 + R.h + R.lift - 0.5 * G * t * t * S, R.zc); }

  stepRamp(dt) {
    const R = RAMP, r = this.ramp;
    if (r.cur) {
      r.cur.t = Math.min(r.cur.T, r.cur.t + dt * R.slow);
      this.rampBall.mesh.position.copy(this.rampPos(r.cur.v0, r.cur.t));
      if (r.cur.t >= r.cur.T) { r.throws.push(r.cur); r.cur = null; this.app.sound?.play('thud'); }
    }
    const lines = [], red = [];
    const all = r.cur ? [...r.throws, r.cur] : r.throws;
    for (const th of all) {
      const tEnd = th.t, pts = [];
      for (let i = 0; i <= 24; i++) pts.push(this.rampPos(th.v0, (tEnd * i) / 24));
      for (const d of dashes(pts, 1.4, 1.1)) lines.push({ points: d, width: 0.6, taper: false });
      if (th !== r.cur) {
        // 落点：速度箭头（黑）和它与斜面的夹角（红弧）
        const P = this.rampPos(th.v0, th.T), vx = th.v0, vy = -G * th.T, k = 4.2;
        const dir = V(vx, vy, 0).normalize();
        lines.push(...arrow(P, dir.clone().multiplyScalar(11), { width: 1 }));
        const slope = Math.atan2(-R.tan, 1), va = Math.atan2(dir.y, dir.x);
        const arc = Array.from({ length: 9 }, (_, i) => { const a = slope + ((va - slope) * i) / 8; return P.clone().add(V(Math.cos(a) * k, Math.sin(a) * k, 0)); });
        red.push({ points: arc, width: 0.8, taper: false });
        red.push({ points: [P, P.clone().add(V(Math.cos(slope) * 9, Math.sin(slope) * 9, 0))], width: 0.7, taper: false });
      }
    }
    this.rampSet.setLines(lines);
    this.rampRed.setLines(red);
    const last = r.throws[r.throws.length - 1];
    const shown = r.cur ?? last;
    this.rampVx.setValue(shown ? shown.v0 : 0);
    this.rampVy.setValue(shown ? G * (r.cur ? r.cur.t : last.T) : 0);
    if (last) {
      const ang = Math.atan2(G * last.T, last.v0) - Math.atan(R.tan);
      this.rampTag.set(`v₀ = ${last.v0.toFixed(1)} m/s`, `与斜面 ${(ang * 180 / Math.PI).toFixed(1)}°`);
    }
  }

  launch() {
    if (this.flight.phase !== 'ready') this.resetFlight();
    this.flight.launch();
    this.app.sound?.play('launch');
  }

  /** 可拖动的东西：返回 [{object, cursor, onDown, onMove, onUp, onClick}] */
  handles() {
    const toLocal = (ray) => {
      const inv = this.pop.u.uSceneInv.value;
      const o = ray.origin.clone().applyMatrix4(inv), d = ray.direction.clone().transformDirection(inv);
      if (Math.abs(d.z) < 1e-6) return null;
      const t = (L.zc - o.z) / d.z;
      return o.addScaledVector(d, t);
    };
    return [
      { object: this.rampKick, cursor: 'pointer', onUp: () => this.fireRamp() },
      { object: this.rampBall.mesh, cursor: 'pointer', onUp: () => this.fireRamp() },
      {
        object: this.platform, cursor: 'ns-resize',
        onMove: (ray) => { const p = toLocal(ray); if (p) this.setHeight((p.y - L.Y0) / S); },
      },
      {
        object: this.knob.mesh, cursor: 'ns-resize',
        onMove: (ray) => { const p = toLocal(ray); if (p) this.setHeight((p.y - 2.2 - L.Y0) / S); },
      },
      {
        object: this.ball.mesh, cursor: 'ew-resize',
        onDown: () => { this.dragged = false; },
        onMove: (ray) => {
          const p = toLocal(ray);
          if (!p) return;
          this.dragged = true;
          const tail = this.ball.mesh.position.x + BALL_R + 1;
          this.setSpeed((p.x - tail) / ARW);
        },
        onUp: () => { if (this.dragged) setTimeout(() => this.launch(), 250); else this.launch(); },
      },
    ];
  }

  // ---------- 自动演示：5 个镜头，每个 2 秒 ----------
  shots() {
    const R = RAMP;
    return [
      { cam: () => ({ pos: this.w(-40, 95, 120), look: this.w(L.launchX, Yp(this.h) - 10, L.zc) }), act: () => { this.switchExhibit(0, true); this.speed = 0.12; this.resetFlight(); this.launch(); } },
      { cam: () => ({ pos: this.w(70, 70, 150), look: this.w(X(0.6), L.Y0, L.rulerZ) }) },
      { cam: () => ({ pos: this.w(30, 110, 150), look: this.w(L.postX, Yp(0.6), L.postZ) }) },
      { cam: () => this.near((R.x0 + R.x2) / 2, L.Y0 + 14, R.zc, V(-40, 150, 230)), act: () => { this.switchExhibit(1, true); this.fireRamp(); } },
      { cam: null, act: () => { this.speed = 0.3; } },
    ];
  }

  reset() { this.resetFlight(); }

  // ---------- 每帧（装置在手边、画好了才跑） ----------
  tick(dt) {
    const f = this.flight;
    if (this.ex === 1) { this.stepRamp(dt); return; }
    const vy = f.phase === 'flying' ? G * f.t : 0;
    this.tubeX.setValue(f.phase === 'flying' || f.phase === 'ready' ? this.v0 : 0);
    this.tubeY.setValue(vy);
    if (f.phase === 'flying' || f.phase === 'settling') {
      const ended = f.step(dt * (f.phase === 'flying' ? this.speed : Math.max(this.speed, 0.3)));
      if (ended && f.result?.kind === 'bucket') this.earnStamp();
      if (ended) this.app.sound?.play(f.result?.kind === 'bucket' ? 'plop' : 'thud');
      this.placeBall();
      this.drawTrail();
      this.updateNumbers();
    }
  }

  leave() {
    this.speed = 0.3;
    return super.leave();
  }
}
