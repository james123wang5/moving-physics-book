import * as THREE from 'three';
import { DioramaLesson } from './diorama.js';
import { box, InkSphere, InkLathe, circlePts } from '../ink/shapes.js';
import { Streaks } from '../ink/glow.js';
import { V, RED, BLUE, ORANGE, dashes, arrow, ringXY } from '../ink/kit.js';

// 第 1 课 · 曲线运动：砂轮火花（速度沿切线）、链球转台（松手沿切线飞出）、冰球场（力与速度不共线才拐弯）。
// 插图坐标（毫米）：x 向右，y 向上，z 朝读者。

const Y0 = 5;
const GRIND = { c: V(22, Y0 + 22, -20), R: 16, thick: 5 };
const SPIN = { c: V(84, Y0, -34), R: 20, h: 26 };
const CAGE = { R: 31, h: 44, a0: Math.PI + 0.22, a1: Math.PI * 2 - 0.22, n: 8 };   // 链球护笼：后半圈立柱 + 网
const RINK = { x0: 116, x1: 168, z0: -62, z1: -6, y: Y0 + 1 };
const GOAL = { x0: 146, x1: 160, z: -60 };
const CONE = V(141, RINK.y, -34);
const PUCK_START = V(124, RINK.y, -12);

export class CurveLesson extends DioramaLesson {
  exhibitDefs() {
    return [
      { name: '砂轮', rect: [4, 110, -56, -10], scale: 1.5 },
      { name: '链球', rect: [50, 158, -66, -3], scale: 1.5 },
      { name: '冰球', rect: [114, 212, -64, -4], scale: 1.6 },
    ];
  }

  build(ex) {
    const { pop, pen, ink, faint } = this;
    const paper = (o) => pop.paper(o);

    if (ex === 0) {
    // ---------- 砂轮机 ----------
    const G = GRIND;
    const castMat = paper({ hatchA: [1, 0.05, 0.25], hatchB: [0.3, 1, 0.2], spacing: 1.4, seed: 11, color: '#f1efe9' });
    box(pop, ink, V(9, Y0, -52), V(35, G.c.y - 8.5, -24), { mat: castMat, pen, width: 1 });
    const motor = new InkLathe(pop, [[9, 0], [9, 24]], { mat: paper({ hatchA: [0, 1, 0.2], hatchB: [1, 0.2, 0.3], spacing: 1.3, seed: 12 }), pen, rims: [0, 1], width: 1 });
    motor.group.rotation.x = Math.PI / 2;
    motor.group.position.set(G.c.x, G.c.y, -48);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) motor.add([V(9.02 * Math.cos(a), 4, 9.02 * Math.sin(a)), V(9.02 * Math.cos(a), 20, 9.02 * Math.sin(a))], { sched: pen.next(16), width: 0.45 });
    this.deferred.push(() => motor.build());
    this.lifters.push(motor);
    // 砂轮（可转）：外形是圆盘，面上的刻痕跟着转
    const stone = paper({ hatchA: [0.62, 0.74, 0.45], hatchB: [-0.7, 0.4, 0.6], spacing: 1.1, seed: 13, color: '#ece6dc' });
    const wheel = new InkLathe(pop, [[2, 0], [G.R, 0], [G.R, G.thick], [2, G.thick]], { mat: stone, pen, rims: [1, 2], width: 1.05 });
    wheel.group.rotation.x = Math.PI / 2;
    wheel.group.position.set(G.c.x, G.c.y, G.c.z - G.thick);
    this.deferred.push(() => wheel.build());
    this.lifters.push(wheel);
    this.wheel = wheel;
    this.wheelMarks = this.dyn(undefined, 1.2, 60);
    // 护罩：上半圈的弧形罩子
    const guardMat = paper({ hatchA: [0.6, 0.7, 0.4], hatchB: [1, 0, 0.3], spacing: 1.4, seed: 14 });
    guardMat.side = THREE.DoubleSide;
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(G.R + 3, G.R + 3, G.thick + 4, 40, 1, true, Math.PI * 0.85, Math.PI * 0.8), guardMat);
    guard.rotation.x = Math.PI / 2;
    guard.position.set(G.c.x, G.c.y, G.c.z - G.thick / 2);
    pop.addSurface(guard);
    const arcPts = (z) => ringXY(V(G.c.x, G.c.y, z), G.R + 3, 40, Math.PI * 0.35, Math.PI * 1.15);
    ink.add(arcPts(G.c.z + 2), { sched: pen.next(50), width: 1 });
    ink.add(arcPts(G.c.z - G.thick - 2), { sched: pen.next(50), width: 0.9 });
    // 托架
    box(pop, ink, V(G.c.x + G.R + 1, G.c.y - 4, G.c.z - 6), V(G.c.x + G.R + 9, G.c.y - 2.5, G.c.z + 2), { mat: castMat, pen, width: 0.9 });
    // 钢条（可拖，改变接触点）
    this.barSet = this.dyn(undefined, 1.6, 40);
    this.barMesh = new THREE.Mesh(new THREE.BoxGeometry(28, 2.4, 2.4).translate(14, 0, 0), paper({ hatchA: [1, 0, 0], hatchB: [0, 1, 0], spacing: 1.0, seed: 15, color: '#e9ecef' }));
    pop.addSurface(this.barMesh);
    this.contact = 0.55; // 接触点的角度（弧度，砂轮圆心看过去）；护罩盖住左上方
    this.omega = 0; this.omegaGoal = 0;
    this.wheelAngle = 0;
    this.sparks = new Streaks(pop, { max: 700, tail: 0.045 });
    pop.group.add(this.sparks.points);
    this.glows.push(this.sparks);
    this.tangentSet = this.dyn(RED, 1.4, 60);
    // 仪表架：放在钢条右边，读转速和火花飞出的速率（砂轮不转时是空的，点砂轮才亮）
    [this.cupN, this.cupV] = this.rack({ cx: 89, z: -44, y0: Y0, legH: 8, r: 5.5, h: 13, items: [{ color: '#2f7bff', label: '转速 n', unit: 'r/s', capacity: 30 }, { color: '#ff8a2a', label: '火花速率', capacity: 30 }] });

    }
    if (ex === 1) {
    // ---------- 链球转台 ----------
    const S = SPIN;
    const baseMat = paper({ hatchA: [0, 1, 0.2], hatchB: [1, 0.2, 0.3], spacing: 1.4, seed: 21 });
    const base = new InkLathe(pop, [[10, 0], [8, 3]], { mat: baseMat, pen, rims: [0, 1], width: 1 });
    base.group.position.copy(S.c);
    this.deferred.push(() => base.build());
    this.lifters.push(base);
    box(pop, ink, V(S.c.x - 1.2, S.c.y + 3, S.c.z - 1.2), V(S.c.x + 1.2, S.c.y + S.h, S.c.z + 1.2), { mat: baseMat, pen, width: 0.9 });
    faint.add(circlePts(S.R, 0, 72).map((p) => p.add(V(S.c.x, S.c.y + S.h - 2, S.c.z))), { closed: true, sched: pen.next(60), width: 0.5, taper: false });
    this.spinBall = new InkSphere(pop, { r: 3.2, centre: V(0, 0, 0), mat: paper({ hatchA: [0.9, 0.12, -0.42], hatchB: [0.2, 0.9, 0.4], spacing: 1.2, seed: 22, color: '#f3e6dc' }), sched: pen.next(20) });
    this.lifters.push(this.spinBall);
    this.spinSet = this.dyn(undefined, 1.4, 400);
    // 护笼：后半圈的立柱、顶梁和斜网（球从后面飞出去会被网兜住）
    const C = CAGE, postMat = paper({ hatchA: [0, 1, 0.2], hatchB: [1, 0.2, 0.3], spacing: 1.1, seed: 23, color: '#e6e8ec' });
    const at = (a, y) => V(S.c.x + C.R * Math.cos(a), S.c.y + y, S.c.z + C.R * Math.sin(a));
    const angs = Array.from({ length: C.n }, (_, i) => C.a0 + ((C.a1 - C.a0) * i) / (C.n - 1));
    for (const a of angs) { const p = at(a, 0); box(pop, ink, V(p.x - 0.7, Y0, p.z - 0.7), V(p.x + 0.7, Y0 + C.h, p.z + 0.7), { mat: postMat, pen, width: 0.75 }); }
    const rail = (y, w) => Array.from({ length: 41 }, (_, i) => at(C.a0 + ((C.a1 - C.a0) * i) / 40, y));
    ink.add(rail(C.h, 1), { sched: pen.next(90), width: 0.9 });
    for (const y of [C.h * 0.33, C.h * 0.66]) faint.add(rail(y), { sched: pen.next(90), width: 0.4, taper: false });
    for (let i = 0; i < C.n - 1; i++) {
      for (let k = 0; k < 4; k++) {
        const u0 = angs[i] + ((angs[i + 1] - angs[i]) * k) / 4, u1 = angs[i] + ((angs[i + 1] - angs[i]) * (k + 1)) / 4;
        faint.add([at(u0, 1), at(u1, C.h * 0.5), at(u0, C.h - 1)], { sched: pen.next(20), width: 0.3, taper: false });
        faint.add([at(u1, 1), at(u0, C.h * 0.5), at(u1, C.h - 1)], { sched: pen.next(20), width: 0.3, taper: false });
      }
    }
    this.spinAngle = 0;
    this.spinFree = null;
    // 仪表架：放在护笼右边（球只会从前半圈飞出，碰不到它）。转动时左杯有读数，松手后读数移到右杯
    [this.cupSpin, this.cupFly] = this.rack({ cx: 137, z: -50, y0: Y0, legH: 8, r: 5.5, h: 13, items: [{ color: '#2f7bff', label: '转动速率', capacity: 4 }, { color: '#ff8a2a', label: '飞出速率', capacity: 4 }] });

    }
    if (ex === 2) {
    // ---------- 冰球场 ----------
    const K = RINK;
    const ice = paper({ hatchA: [1, 0, 0.3], hatchB: [0.3, 0, 1], spacing: 2.2, seed: 31, color: '#eef3f5', hatch: 0.35 });
    box(pop, ink, V(K.x0, Y0, K.z0), V(K.x1, K.y, K.z1), { mat: ice, pen, width: 1 });
    for (let z = K.z0 + 6; z < K.z1; z += 7) faint.add([V(K.x0 + 2, K.y + 0.02, z), V(K.x0 + 9 + (z % 5), K.y + 0.02, z - 1)], { sched: pen.next(8), width: 0.4 });
    // 围板：四周一圈矮木板（前面最矮，不挡视线），球门处留口；冰球撞上会反弹
    const board = paper({ hatchA: [1, 0, 0.12], hatchB: [0.2, 0.3, 1], spacing: 1.2, seed: 35, color: '#f4ecdc' });
    const T = 1.2, hb = 4.5, hf = 2.4;
    box(pop, ink, V(K.x0 - T, K.y, K.z0), V(K.x0, K.y + hb, K.z1), { mat: board, pen, width: 0.85, hide: ['bottom'] });
    box(pop, ink, V(K.x1, K.y, K.z0), V(K.x1 + T, K.y + hb, K.z1), { mat: board, pen, width: 0.85, hide: ['bottom'] });
    box(pop, ink, V(K.x0 - T, K.y, K.z1), V(K.x1 + T, K.y + hf, K.z1 + T), { mat: board, pen, width: 0.85, hide: ['bottom'] });
    box(pop, ink, V(K.x0 - T, K.y, K.z0 - T), V(GOAL.x0 - 0.8, K.y + hb, K.z0), { mat: board, pen, width: 0.85, hide: ['bottom'] });
    box(pop, ink, V(GOAL.x1 + 0.8, K.y, K.z0 - T), V(K.x1 + T, K.y + hb, K.z0), { mat: board, pen, width: 0.85, hide: ['bottom'] });
    for (let x = K.x0 + 6; x < K.x1 - 2; x += 6) faint.add([V(x, K.y + 0.3, K.z1 + T + 0.02), V(x, K.y + hf - 0.3, K.z1 + T + 0.02)], { sched: pen.next(2), width: 0.4, taper: false });
    // 球门
    const gm = paper({ hatchA: [0, 1, 0], hatchB: [1, 0, 0], spacing: 1.2, seed: 32 });
    box(pop, ink, V(GOAL.x0 - 0.8, K.y, GOAL.z - 0.8), V(GOAL.x0 + 0.8, K.y + 8, GOAL.z + 0.8), { mat: gm, pen, width: 0.8 });
    box(pop, ink, V(GOAL.x1 - 0.8, K.y, GOAL.z - 0.8), V(GOAL.x1 + 0.8, K.y + 8, GOAL.z + 0.8), { mat: gm, pen, width: 0.8 });
    ink.add([V(GOAL.x0, K.y + 8, GOAL.z), V(GOAL.x1, K.y + 8, GOAL.z)], { sched: pen.next(14), width: 0.9 });
    for (let x = GOAL.x0 + 2; x < GOAL.x1; x += 2) faint.add([V(x, K.y + 8, GOAL.z), V(x, K.y, GOAL.z - 4)], { sched: pen.next(9), width: 0.35, taper: false });
    // 锥桶
    const cone = new InkLathe(pop, [[4, 0], [0.6, 10]], { mat: paper({ hatchA: [0, 1, 0.3], hatchB: [1, 0.3, 0], spacing: 1.2, seed: 33, color: '#f4e1d6' }), pen, rims: [0], width: 1 });
    cone.group.position.copy(CONE);
    for (const y of [3, 6]) cone.add(circlePts(4 - 3.4 * (y / 10), y, 32).slice(0, 32), { closed: true, sched: pen.next(10), width: 0.5 });
    this.deferred.push(() => cone.build());
    this.lifters.push(cone);
    // 冰球
    const puckMat = paper({ hatchA: [0, 1, 0], hatchB: [1, 0, 0], spacing: 0.9, seed: 34, color: '#d9dde3' });
    this.puck = new InkLathe(pop, [[3.6, 0], [3.6, 1.8]], { mat: puckMat, pen, rims: [0, 1], width: 1 });
    this.deferred.push(() => this.puck.build());
    this.lifters.push(this.puck);
    this.puckSet = this.dyn(undefined, 1.4, 1200);
    this.forceSet = this.dyn(RED, 1.9, 40);
    // 仪表架：放在冰场右边，读冰球速率和推力
    [this.cupPuck, this.cupForce] = this.rack({ cx: 191, z: -46, y0: Y0, legH: 8, r: 5.5, h: 13, items: [{ color: '#2f7bff', label: '冰球速率', capacity: 6 }, { color: '#ff4a2a', label: '推力 F', unit: 'N', capacity: 3 }] });
    }
    this.drawTime = 3.6;
  }

  reset() {
    this.puckState = { p: PUCK_START.clone(), v: V(0, 0, -26), on: false, trail: [PUCK_START.clone()], force: null, done: false };
    this.spinFree = null;
    this.spinOn = false;
    this.placePuck();
  }

  // ---------- 冰球 ----------
  placePuck() {
    const s = this.puckState;
    this.puck.group.position.copy(s.p);
    const lines = [];
    for (const d of dashes(s.trail, 2, 1.4)) lines.push({ points: d, width: 0.8, taper: false });
    lines.push(...arrow(s.p.clone().add(V(0, 0.9, 0)), s.v.clone().multiplyScalar(0.45), { plane: V(0, 1, 0), width: 1 }));
    this.puckSet.setLines(lines);
    this.forceSet.setLines(s.force ? arrow(s.p.clone().add(V(0, 1, 0)), s.force, { plane: V(0, 1, 0), width: 1.2, head: 3 }) : []);
    const ang = s.force ? (Math.acos(Math.max(-1, Math.min(1, s.force.clone().normalize().dot(s.v.clone().normalize())))) * 180) / Math.PI : null;
    this.cupPuck.setValue(s.on ? s.v.length() / 10 : 0);
    this.cupForce.setValue(s.force ? s.force.length() / 10 : 0);
    this.pang = ang;
  }

  refreshNumbers() {
    const s = this.puckState;
    const ang = s.force ? (Math.acos(Math.max(-1, Math.min(1, s.force.clone().normalize().dot(s.v.clone().normalize())))) * 180) / Math.PI : null;
    if (this.ex === 0) {
      this.setNumbers([
        `砂轮 ω = ${this.omega.toFixed(0)} rad/s`,
        `火花 v = ωR = ${((this.omega * GRIND.R) / 1000 * 10).toFixed(1)} m/s`,
        '火花：沿切线飞出',
      ]);
    } else if (this.ex === 1) {
      this.setNumbers(['链球：转圈时速度', '沿切线、方向在变', this.spinFree ? '松手了：沿切线飞出' : this.spinOn ? '再点球松手' : '点球转起来']);
    } else {
      this.setNumbers([
        `冰球 v = ${(s.v.length() / 10).toFixed(1)} m/s`,
        s.force ? `力 F 与 v 成 ${ang.toFixed(0)}°` : '没有力：走直线',
        s.force ? (ang > 92 ? '→ 拐弯并减速' : ang < 88 ? '→ 拐弯并加速' : '→ 只拐弯，速率不变') : '',
      ]);
    }
  }

  stepPuck(dt) {
    const s = this.puckState;
    if (!s.on) return;
    if (s.force) s.v.addScaledVector(s.force, dt * 2.2);
    const sp = s.v.length();
    if (sp > 60) s.v.multiplyScalar(60 / sp);
    s.p.addScaledVector(s.v, dt);
    const last = s.trail[s.trail.length - 1];
    if (last.distanceTo(s.p) > 1) s.trail.push(s.p.clone());
    // 撞锥桶、进球门、出界
    if (s.p.clone().setY(CONE.y).distanceTo(CONE) < 7.5) { s.on = false; this.app.toast?.('撞到锥桶了'); }
    if (s.p.z < GOAL.z + 1.5 && s.p.x > GOAL.x0 + 1 && s.p.x < GOAL.x1 - 1) { s.on = false; s.done = true; this.earnStamp(); }
    // 围板：撞上就把垂直于板的速度反向（有损耗），沿板的速度保留
    const r = 3.6, e = 0.75;
    let hit = false;
    if (s.p.x < RINK.x0 + r) { s.p.x = RINK.x0 + r; s.v.x = Math.abs(s.v.x) * e; hit = true; }
    if (s.p.x > RINK.x1 - r) { s.p.x = RINK.x1 - r; s.v.x = -Math.abs(s.v.x) * e; hit = true; }
    if (s.p.z > RINK.z1 - r) { s.p.z = RINK.z1 - r; s.v.z = -Math.abs(s.v.z) * e; hit = true; }
    if (s.p.z < RINK.z0 + r && !(s.p.x > GOAL.x0 + 1 && s.p.x < GOAL.x1 - 1)) { s.p.z = RINK.z0 + r; s.v.z = Math.abs(s.v.z) * e; hit = true; }
    if (hit) { this.app.sound?.play('thud', { gain: 0.6, rate: 1.3 }); s.bounces = (s.bounces ?? 0) + 1; }
    // 没有力时冰面摩擦很小，冰球慢慢停下；停住或弹太多次就结束这一轮
    if (!s.force) s.v.multiplyScalar(Math.exp(-dt * 0.12));
    if (s.v.length() < 1.5 || s.bounces > 6) s.on = false;
    this.placePuck();
  }

  // ---------- 砂轮与链球 ----------
  stepGrinder(dt) {
    const G = GRIND;
    this.omega += (this.omegaGoal - this.omega) * (1 - Math.exp(-dt * 1.8));
    this.wheelAngle += this.omega * dt * 0.12;
    const marks = [];
    for (let i = 0; i < 6; i++) {
      const a = this.wheelAngle + (i * Math.PI) / 3;
      marks.push({ points: [V(G.c.x + 4 * Math.cos(a), G.c.y + 4 * Math.sin(a), G.c.z + 0.05), V(G.c.x + 13 * Math.cos(a), G.c.y + 13 * Math.sin(a), G.c.z + 0.05)], width: 0.55, taper: false });
    }
    marks.push({ points: ringXY(V(G.c.x, G.c.y, G.c.z + 0.05), 3, 24), width: 0.7, closed: true });
    this.wheelMarks.setLines(marks);
    // 钢条：顶在接触点上，沿半径向外偏一点
    const a = this.contact;
    const P = V(G.c.x + G.R * Math.cos(a), G.c.y + G.R * Math.sin(a), G.c.z - G.thick / 2);
    const out = V(Math.cos(a - 0.45), Math.sin(a - 0.45), 0);
    this.barMesh.position.copy(P).addScaledVector(out, 0.8);
    this.barMesh.rotation.set(0, 0, Math.atan2(out.y, out.x));
    const end = P.clone().addScaledVector(out, 28.8);
    this.barSet.setLines([{ points: [P.clone().addScaledVector(out, 0.8), end], width: 1.2, taper: false }]);
    this.barEnd = end;
    // 火花：沿切线方向（顺时针转），带一点散布和重力
    const tan = V(Math.sin(a), -Math.cos(a), 0);
    const speed = this.omega * G.R * 0.11;
    if (this.omega > 4) {
      const n = Math.round(this.omega * dt * 2.2);
      for (let i = 0; i < n; i++) {
        const v = tan.clone().multiplyScalar(speed * (0.8 + Math.random() * 0.4)).add(V((Math.random() - 0.5) * 5, (Math.random() - 0.5) * 5, (Math.random() - 0.4) * 6));
        this.sparks.emit(P.clone().add(V(0, 0, (Math.random() - 0.5) * G.thick)), v, Math.random() < 0.7 ? ORANGE : '#ffc34a', 0.35 + Math.random() * 0.4, 160, 0.55 + Math.random() * 0.4);
      }
    }
    this.sparks.update(dt, Y0 + 0.4);
    this.cupN.setValue(this.omega / (2 * Math.PI));
    this.cupV.setValue(this.omega > 4 ? this.omega * 0.16 : 0);
    // 切线和速度箭头
    const lines = [];
    const t0 = P.clone().addScaledVector(tan, -16), t1 = P.clone().addScaledVector(tan, 34);
    for (const d of dashes([t0, t1], 2, 1.5)) lines.push({ points: d, width: 0.7, taper: false });
    if (this.omega > 4) lines.push(...arrow(P, tan.clone().multiplyScalar(Math.min(24, speed * 0.25)), { width: 1.1 }));
    this.tangentSet.setLines(lines);
  }

  stepSpinner(dt) {
    const S = SPIN, y = S.c.y + S.h - 2;
    const lines = [];
    if (!this.spinFree) {
      if (this.spinOn) this.spinAngle += dt * 2.4;
      const p = V(S.c.x + S.R * Math.cos(this.spinAngle), y, S.c.z + S.R * Math.sin(this.spinAngle));
      this.spinBall.mesh.position.copy(p);
      lines.push({ points: [V(S.c.x, y + 1, S.c.z), p], width: 0.8, taper: false });
    } else {
      const f = this.spinFree;
      f.t += dt;
      f.p.addScaledVector(f.v, dt);
      // 撞到后半圈的网：兜住，掉到地上
      const rx = f.p.x - S.c.x, rz = f.p.z - S.c.z, ang = Math.atan2(rz, rx) + Math.PI * 2;
      if (!f.caught && Math.hypot(rx, rz) > CAGE.R - 3.5 && ang > CAGE.a0 && ang < CAGE.a1) { f.caught = true; f.v.multiplyScalar(0.08); this.app.sound?.play('thud'); }
      if (f.caught) { f.p.y = Math.max(Y0 + 3.2, f.p.y - dt * 60 * Math.min(1, f.t)); }
      this.spinBall.mesh.position.copy(f.p);
      for (const d of dashes([f.p0, f.p], 2, 1.4)) lines.push({ points: d, width: 0.8, taper: false });
      lines.push(...arrow(f.p0, f.v.clone().normalize().multiplyScalar(12), { plane: V(0, 1, 0), width: 1 }));
      if (f.t > 1.6 || f.p.distanceTo(f.p0) > 60) this.spinFree = null;
    }
    this.spinSet.setLines(lines);
    // 读数：桌面模型的 1 毫米代表 6 厘米，转速 2.4 rad/s → v = ωR ≈ 2.9 m/s
    const v = 2.4 * S.R * 0.06;
    this.cupSpin.setValue(this.spinOn && !this.spinFree ? v : 0);
    this.cupFly.setValue(this.spinFree && !this.spinFree.caught ? v : 0);
  }

  releaseSpinner() {
    if (this.spinFree || !this.spinOn) return;
    const S = SPIN, a = this.spinAngle, y = S.c.y + S.h - 2;
    const p0 = V(S.c.x + S.R * Math.cos(a), y, S.c.z + S.R * Math.sin(a));
    const v = V(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(2.4 * S.R);
    this.spinFree = { p0, p: p0.clone(), v, t: 0 };
    this.app.sound?.play('whoosh');
  }

  tick(dt) {
    if (this.ex === 0) this.stepGrinder(dt);
    if (this.ex === 1) this.stepSpinner(dt);
    if (this.ex === 2) this.stepPuck(dt);
    this.refreshNumbers();
  }

  // ---------- 交互 ----------
  handles() {
    const s = () => this.puckState;
    const onIce = (ray) => this.rayToPlane(ray, V(0, RINK.y + 1, 0), V(0, 1, 0));
    return [
      { object: this.wheel.mesh, cursor: 'pointer', onUp: () => { this.omegaGoal = this.omegaGoal > 0 ? 0 : 160; this.app.sound?.play('grind'); } },
      {
        object: this.barMesh, cursor: 'grab',
        onMove: (ray) => {
          const p = this.rayToPlane(ray, GRIND.c, V(0, 0, 1));
          if (p) this.contact = Math.max(-0.9, Math.min(0.95, Math.atan2(p.y - GRIND.c.y, p.x - GRIND.c.x)));
        },
      },
      { object: this.spinBall.mesh, cursor: 'pointer', onUp: () => { if (this.spinOn) this.releaseSpinner(); else { this.spinOn = true; this.app.sound?.play('tick'); } } },
      {
        object: this.puck.mesh, cursor: 'grab',
        onDown: () => { const st = s(); if (!st.on) { if (st.done || st.p.distanceTo(PUCK_START) > 1) this.reset(); s().on = true; } },
        onMove: (ray) => {
          const p = onIce(ray);
          if (!p) return;
          const st = s();
          const f = p.sub(st.p).setY(0);
          const L = f.length();
          st.force = L > 3 ? f.multiplyScalar(Math.min(30, L) / L) : null;
          st.on = true;
        },
        onUp: () => { s().force = null; },
      },
    ];
  }

  shots() {
    const S = this.defs[2].scale;
    const cx = (RINK.x0 + RINK.x1) / 2, cz = (RINK.z0 + RINK.z1) / 2;
    const at = (dx, dy, dz) => this.w(cx + dx / S, dy / S, cz + dz / S);
    const look = (dx, dz) => this.w(cx + dx / S, RINK.y, cz + dz / S);
    return [
      { cam: () => this.near(GRIND.c.x + 10, GRIND.c.y - 6, GRIND.c.z, V(-40, 120, 220)), act: () => { this.switchExhibit(0, true); this.omegaGoal = 160; } },
      { cam: () => this.near(SPIN.c.x, SPIN.c.y + 16, SPIN.c.z, V(-30, 220, 270)), act: () => { this.switchExhibit(1, true); this.spinOn = true; } },
      { cam: () => this.near(SPIN.c.x, SPIN.c.y + 16, SPIN.c.z, V(-30, 220, 270)), act: () => this.releaseSpinner() },
      { cam: () => ({ pos: at(-30, 120, 60), look: look(0, 0) }), act: () => { this.switchExhibit(2, true); this.reset(); this.puckState.on = true; } },
      { cam: () => ({ pos: at(-40, 110, 50), look: look(0, 0) }), act: () => { this.puckState.force = V(22, 0, 0); } },
      { cam: () => ({ pos: at(-20, 100, 70), look: look(6, -8) }), act: () => { this.puckState.force = null; } },
    ];
  }
}
