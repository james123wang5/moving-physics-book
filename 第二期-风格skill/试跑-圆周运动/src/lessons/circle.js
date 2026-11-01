import * as THREE from 'three';
import { DioramaLesson } from './diorama.js';
import { box, InkSphere, InkLathe } from '../ink/shapes.js';
import { V, RED, BLUE, dashes, arrow, ringXZ, makeTag } from '../ink/kit.js';

// 第 1 课 · 匀速圆周运动。两个装置：
//  0 转台：径向滑轨上的小球随转台转动。点转台开 / 停，沿滑轨拖小球改半径，开关换角速度。
//    读数：线速度 v = ωr、向心加速度 a = v²/r = ω²r；蓝箭头沿切线（速度），红箭头指向圆心（加速度）。
//    挑战：v 正好 1.0 m/s，同时 a 正好 4.0 m/s²（唯一解 ω = 4 rad/s、r = 0.25 m）。
//  1 速度的变化：同一颗小球在 A、B 两个时刻的速度，把 vB 平移到 A，红色 Δv 从 vA 的箭头尖指到 vB 的箭头尖。
//    拖 B 靠近 A：Δv 越来越指向圆心，平均加速度 Δv/Δt 越来越接近 v²/r。
// 模型（米、秒、弧度）和画面分开：this.m0 / this.m1 只放数，placeAll() 负责画。

const Y0 = 5;
const S = 100;                          // 每米画成多少毫米
const OMEGAS = [2, 4, 6];               // 角速度开关（rad/s）
const R_MIN = 0.06, R_MAX = 0.30;       // 滑轨上的半径范围（米）
const RB = 3.6;                         // 小球半径（毫米）

// ---- 装置 0：转台 ----
const C0 = V(38, 0, -40);               // 转轴位置（只用 x、z）
const PLINTH = { x0: 4, x1: 72, z0: -74, z1: -6, top: Y0 + 6 };
const DISC = { R: 33, y: Y0 + 9, th: 3 }; // 转盘：底面高度 y，厚 th
const DISC_TOP = DISC.y + DISC.th;
const BALL_Y = DISC_TOP + RB;            // 小球球心高度（插图坐标）
const KV = 20, KA = 2.5;                 // 箭头：每 m/s 画多少毫米、每 m/s² 画多少毫米（从球心量起）
const KNOB = V(65, 0, -11);              // 角速度旋钮（底座右前角）

// ---- 装置 1：速度的变化 ----
const C1 = V(37, 0, -40);
const TABLE = { R: 36, top: Y0 + 8 };
const R1 = 0.30, V1 = 1.2;               // 轨道半径（米）、速率（m/s）
const S1 = 100;                          // 每米多少毫米（轨道半径 30 毫米）
const K1 = 17;                           // 速度箭头：每 m/s 画多少毫米
const KA1 = 3;                           // 平均加速度箭头：每 m/s² 画多少毫米
const TH_A = -Math.PI / 2;               // A 点在轨道最前面（离读者最近），速度朝右
const Y1 = TABLE.top + RB;

const deg = (x) => (x * 180) / Math.PI;
const rad = (x) => (x * Math.PI) / 180;
const round2 = (x) => Math.round(x * 100) / 100;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export class CircleLesson extends DioramaLesson {
  exhibitDefs() {
    return [
      { name: '转台', rect: [4, 123, -74, -6], scale: 1.35 },
      { name: '速度的变化', rect: [1, 126, -76, -4], scale: 1.33 },
    ];
  }

  build(ex) {
    const { pop, pen, ink, faint } = this;
    const wood = pop.paper({ hatchA: [1, 0, 0.12], hatchB: [0.2, 0.3, 1], spacing: 1.6, seed: 11 + ex, color: '#f3e4c8', hatch: 0.6 });
    const metal = pop.paper({ hatchA: [0, 1, 0.2], hatchB: [1, 0.2, 0.3], spacing: 1.3, seed: 13 + ex, color: '#eceef0' });
    const ballMat = pop.paper({ hatchA: [0.9, 0.12, -0.42], hatchB: [0.2, 0.9, 0.4], spacing: 1.1, seed: 15, color: '#e9eef6' });
    const rig = {};
    (this.rigs ??= [])[ex] = rig;

    if (ex === 0) {
      this.state.switches.w ??= 2;   // 默认 6 rad/s（开关的下划线也要对上）
      this.book.pages.invalidate(this.k, 'right');
      // 木底座 + 轴承座
      box(pop, ink, V(PLINTH.x0, Y0, PLINTH.z0), V(PLINTH.x1, PLINTH.top, PLINTH.z1), { mat: wood, pen, width: 1.05 });
      const hub = new InkLathe(pop, [[10, 0], [10, DISC.y - PLINTH.top]], { mat: metal, pen, rims: [1], width: 0.9 });
      hub.group.position.set(C0.x, PLINTH.top, C0.z);
      this.deferred.push(() => hub.build());
      this.lifters.push(hub);
      // 转盘：回转体，画在它上面的线（滑轨、刻度）跟着它转
      const discMat = pop.paper({ hatchA: [0, 1, 0.2], hatchB: [1, 0.2, 0.6], spacing: 1.5, seed: 17, color: '#eef0f2', hatch: 0.7 });
      const disc = new InkLathe(pop, [[2, 0], [DISC.R, 0], [DISC.R, DISC.th], [2, DISC.th]], { mat: discMat, pen, rims: [1, 2], width: 1.05 });
      disc.group.position.set(C0.x, DISC.y, C0.z);
      rig.disc = disc;
      // 滑轨：两根细铁条（沿局部 +x），尽头一块挡片；刻度每 0.05 m 一道
      const railMat = pop.paper({ hatchA: [1, 0, 0], hatchB: [0, 1, 0.3], spacing: 1.0, seed: 19, color: '#e4e6ea' });
      rig.rails = [];
      for (const zs of [-1, 1]) {
        const z0 = zs * 3.3, z1 = zs * 4.2;
        const mn = V(3.5, DISC.th, Math.min(z0, z1)), mx = V(R_MAX * S + 2, DISC.th + 1.4, Math.max(z0, z1));
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(mx.x - mn.x, mx.y - mn.y, mx.z - mn.z), railMat);
        mesh.position.copy(mn.clone().add(mx).multiplyScalar(0.5));
        pop.addSurface(mesh, disc.group);
        box(pop, disc, mn, mx, { pen, width: 0.75 });
        rig.rails.push(mesh);
      }
      box(pop, disc, V(R_MAX * S + 2, DISC.th, -4.2), V(R_MAX * S + 3.2, DISC.th + 3, 4.2), { mat: railMat, pen, width: 0.8, parent: disc.group });
      for (let k = 1; k <= 6; k++) {
        const x = k * 5;
        disc.add([V(x, DISC.th + 0.05, 4.6), V(x, DISC.th + 0.05, k % 2 ? 6.2 : 7.4)], { sched: pen.next(2), width: 0.55, taper: false });
      }
      // 转盘边上一圈小刻痕，转起来看得出在转
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2, r0 = DISC.R - (k % 6 === 0 ? 3.2 : 1.6);
        disc.add([V(r0 * Math.cos(a), DISC.th + 0.05, r0 * Math.sin(a)), V((DISC.R - 0.3) * Math.cos(a), DISC.th + 0.05, (DISC.R - 0.3) * Math.sin(a))], { sched: pen.next(1.5), width: 0.5, taper: false });
      }
      this.deferred.push(() => disc.build());
      this.lifters.push(disc);
      // 轴心小帽
      const cap = new InkLathe(pop, [[2.2, 0], [2.2, 1.2], [1.2, 1.8]], { mat: metal, pen, rims: [1], width: 0.8 });
      cap.group.position.set(C0.x, DISC_TOP, C0.z);
      this.deferred.push(() => cap.build());
      this.lifters.push(cap);
      // 角速度旋钮：点一下换一档（和图注旁的开关同步），指针指着 2 / 4 / 6
      const knob = new InkLathe(pop, [[4.2, 0], [4.2, 2.6], [3.2, 3.4], [0, 3.4]], { mat: metal, pen, rims: [1], width: 0.9 });
      knob.group.position.set(KNOB.x, PLINTH.top, KNOB.z);
      this.deferred.push(() => knob.build());
      this.lifters.push(knob);
      rig.knob = knob;
      for (const [i, a] of [-1, 0, 1].entries()) {
        const t = rad(90 + a * 55), c = Math.cos(t), sn = Math.sin(t);
        faint.add([V(KNOB.x + 5.4 * c, PLINTH.top + 0.06, KNOB.z - 5.4 * sn), V(KNOB.x + (i === 1 ? 7.4 : 6.6) * c, PLINTH.top + 0.06, KNOB.z - (i === 1 ? 7.4 : 6.6) * sn)], { sched: pen.next(2), width: 0.6, taper: false });
      }
      rig.knobPtr = this.dyn(undefined, 1.5, 20);
      // 小球：挂在转盘上（局部坐标 x = r）
      rig.ball = new InkSphere(pop, { r: RB, centre: V(0.15 * S, DISC.th + RB, 0), mat: ballMat, parent: disc.group, sched: pen.next(20) });
      this.lifters.push(rig.ball);
      // 动态线：轨迹虚线、速度箭头、加速度箭头
      rig.path = this.dyn(undefined, 1.0, 900);
      rig.vel = this.dyn(BLUE, 1.9, 40);
      rig.acc = this.dyn(RED, 1.9, 40);
      // 仪表架：线速度、向心加速度
      [rig.cupV, rig.cupA] = this.rack({ cx: 100, z: -58, legH: 10, r: 5.5, h: 14, items: [
        { color: '#2f7bff', label: '线速度 v', unit: 'm/s', capacity: 2, digits: 2 },
        { color: '#ff4a2a', label: '向心加速度 a', unit: 'm/s²', capacity: 12, digits: 2 },
      ] });
      // 纸签：半径、周期
      rig.tagR = makeTag(pop, 21, 8);
      rig.tagR.mesh.position.set(88, Y0 + 6, -28);
      rig.tagT = makeTag(pop, 21, 8);
      rig.tagT.mesh.position.set(112, Y0 + 6, -28);
    }

    if (ex === 1) {
      // 圆桌 + 一圈轨道槽
      const table = new InkLathe(pop, [[TABLE.R, 0], [TABLE.R, TABLE.top - Y0]], { mat: wood, pen, rims: [1], width: 1.05 });
      table.group.position.set(C1.x, Y0, C1.z);
      this.deferred.push(() => table.build());
      this.lifters.push(table);
      for (const rr of [R1 * S1 - 1.6, R1 * S1 + 1.6]) faint.add(ringXZ(V(C1.x, TABLE.top + 0.08, C1.z), rr, 96), { closed: true, sched: pen.next(rr * 2), width: 0.6, taper: false });
      // 圆心：小十字
      ink.add([V(C1.x - 2, TABLE.top + 0.1, C1.z), V(C1.x + 2, TABLE.top + 0.1, C1.z)], { sched: pen.next(4), width: 0.7, taper: false });
      ink.add([V(C1.x, TABLE.top + 0.1, C1.z - 2), V(C1.x, TABLE.top + 0.1, C1.z + 2)], { sched: pen.next(4), width: 0.7, taper: false });
      rig.ballA = new InkSphere(pop, { r: RB, centre: this.onTrack(TH_A), mat: ballMat, sched: pen.next(20) });
      rig.ballB = new InkSphere(pop, { r: RB, centre: this.onTrack(TH_A + rad(60)), mat: pop.paper({ hatchA: [0.9, 0.12, -0.42], hatchB: [0.2, 0.9, 0.4], spacing: 1.1, seed: 16, color: '#f3e6dc' }), sched: pen.next(20) });
      this.lifters.push(rig.ballA, rig.ballB);
      rig.guide = this.dyn(undefined, 1.0, 600);
      rig.vel = this.dyn(BLUE, 1.9, 120);
      rig.dv = this.dyn(RED, 2.1, 60);
      [rig.cupDv, rig.cupA] = this.rack({ cx: 103, z: -58, legH: 10, r: 5.5, h: 14, items: [
        { color: '#ff4a2a', label: 'Δv/Δt', unit: 'm/s²', capacity: 8, digits: 2 },
        { color: '#ff4a2a', label: 'v²/r', unit: 'm/s²', capacity: 8, digits: 2 },
      ] });
      rig.tagA = makeTag(pop, 8, 7);
      rig.tagB = makeTag(pop, 8, 7);
      rig.tagA.set('', 'A');
      rig.tagB.set('', 'B');
      rig.tagTh = makeTag(pop, 21, 8);
      rig.tagTh.mesh.position.set(91, Y0 + 6, -28);
      rig.tagDt = makeTag(pop, 21, 8);
      rig.tagDt.mesh.position.set(115, Y0 + 6, -28);
    }
    this.drawTime = 3.4;
  }

  get rig() { return this.rigs[this.ex]; }

  /** 轨道上角度 θ 处的球心（俯视逆时针为正，θ = −90° 在最前面） */
  onTrack(th) { return V(C1.x + R1 * S1 * Math.cos(th), Y1, C1.z - R1 * S1 * Math.sin(th)); }

  reset() {
    this.m0 ??= { r: 0.15, phi: 0.5, on: true };
    this.m0.on = true;
    this.m1 = { dth: rad(60) };
    this.placeAll();
  }

  get omega() { return OMEGAS[this.state.switches.w ?? 2]; }

  onSwitch(sid, i) {
    if (sid === 'ex') super.onSwitch(sid, i);
    else { this.m0.on = true; this.placeAll(); }
  }

  /** 演示里改角速度：同时更新开关的下划线 */
  setOmega(i) {
    this.state.switches.w = i;
    this.book.pages.invalidate(this.k, 'right');
  }

  placeAll() {
    if (this.ex === 0) this.place0(); else this.place1();
  }

  place0() {
    const rig = this.rigs[0], m = this.m0, w = this.omega;
    const r = m.r, v = w * r, a = w * w * r, T = (2 * Math.PI) / w;
    rig.disc.group.rotation.y = m.phi;
    rig.ball.mesh.position.set(r * S, DISC.th + RB, 0);
    const c = Math.cos(m.phi), s = Math.sin(m.phi);
    const P = V(C0.x + r * S * c, BALL_Y, C0.z - r * S * s);
    // 轨迹：半径 r 的虚线圆，贴在转盘面上
    const path = [];
    for (const d of dashes(ringXZ(V(C0.x, DISC_TOP + 0.12, C0.z), r * S, 120), 1.8, 1.4)) path.push({ points: d, width: 0.6, taper: false });
    rig.path.setLines(path);
    // 速度（切线）和加速度（指向圆心）箭头；停着时都没有
    // 长度从球心量起：和 v、a 成正比；太短时留一小截露出球外，只为看清方向
    const tan = V(-s, 0, -c), inw = V(-c, 0, s);
    const lv = Math.min(Math.max(RB + 3, KV * v), 36), la = Math.min(Math.max(RB + 3, KA * a), r * S - 3);
    const from = (d) => P.clone().addScaledVector(d, RB * 0.5);
    rig.vel.setLines(m.on ? arrow(from(tan), tan.clone().multiplyScalar(lv - RB * 0.5), { plane: V(0, 1, 0), width: 1.2, head: 3.2 }) : []);
    rig.acc.setLines(m.on && la - RB * 0.5 > 1 ? arrow(from(inw), inw.clone().multiplyScalar(la - RB * 0.5), { plane: V(0, 1, 0), width: 1.2, head: 3.2 }) : []);
    // 旋钮指针
    const wi = this.state.switches.w ?? 2, kt = rad(90 + (wi - 1) * 55);
    rig.knobPtr.setLines([{ points: [V(KNOB.x, PLINTH.top + 3.5, KNOB.z), V(KNOB.x + 3.4 * Math.cos(kt), PLINTH.top + 3.5, KNOB.z - 3.4 * Math.sin(kt))], width: 1.1, taper: false }]);
    rig.cupV.setValue(m.on ? v : 0);
    rig.cupA.setValue(m.on ? a : 0);
    rig.tagR.set('半径 r', `${r.toFixed(2)} m`);
    rig.tagT.set('周期 T = 2π/ω', `${T.toFixed(2)} s`);
    this.setNumbers([
      `ω = ${w} rad/s`,
      `T = 2π/ω = ${T.toFixed(2)} s`,
      `r = ${r.toFixed(2)} m`,
      `v = ωr = ${v.toFixed(2)} m/s`,
      `a = v²/r = ${((v * v) / r).toFixed(2)} m/s²`,
      `a = ω²r = ${a.toFixed(2)} m/s²`,
      m.on ? '' : '转台停了：点一下转起来',
    ].filter(Boolean));
    // 挑战：v = 1.0 m/s 且 a = 4.0 m/s²（r 以 0.01 m 为一档，v、a 都是准确值）
    if (m.on && Math.abs(v - 1.0) < 1e-6 && Math.abs(a - 4.0) < 1e-6) this.earnStamp();
  }

  place1() {
    const rig = this.rigs[1], dth = this.m1.dth;
    const thB = TH_A + dth;
    const A = this.onTrack(TH_A), B = this.onTrack(thB);
    rig.ballA.mesh.position.copy(A);
    rig.ballB.mesh.position.copy(B);
    // A、B 小纸签放在球的外侧（背离圆心），不挡住朝圆心的箭头
    const outA = V(Math.cos(TH_A), 0, -Math.sin(TH_A)), outB = V(Math.cos(thB), 0, -Math.sin(thB));
    rig.tagA.mesh.position.copy(A).addScaledVector(outA, RB + 5.5).add(V(0, -2, 0));
    rig.tagB.mesh.position.copy(B).addScaledVector(outB, RB + 5.5).add(V(0, -2, 0));
    const vdir = (th) => V(-Math.sin(th), 0, -Math.cos(th));
    const vA = vdir(TH_A).multiplyScalar(V1 * K1), vB = vdir(thB).multiplyScalar(V1 * K1);
    const up = V(0, 1, 0), O = V(C1.x, TABLE.top + 0.15, C1.z);
    // 辅助线：两条半径（虚线）、圆心处的 Δθ 小弧、A 到 B 之间的频闪小圈
    const g = [];
    const flat = (p) => V(p.x, TABLE.top + 0.15, p.z);
    for (const p of [A, B]) for (const d of dashes([O, flat(p)], 1.6, 1.2)) g.push({ points: d, width: 0.6, taper: false });
    const arc = [];
    for (let i = 0; i <= 24; i++) { const t = TH_A + (dth * i) / 24; arc.push(V(C1.x + 8 * Math.cos(t), TABLE.top + 0.15, C1.z - 8 * Math.sin(t))); }
    g.push({ points: arc, width: 0.6, taper: false });
    const n = Math.max(2, Math.round(deg(dth) / 15));
    for (let i = 1; i < n; i++) g.push({ points: ringXZ(flat(this.onTrack(TH_A + (dth * i) / n)), 1.4, 20), width: 0.5, closed: true, taper: false });
    // vB 平移到 A：虚线杆 + 箭头
    const tipA = A.clone().add(vA), tipB2 = A.clone().add(vB);
    for (const d of dashes([A.clone(), tipB2], 1.6, 1.1)) g.push({ points: d, width: 0.9, taper: false });
    rig.guide.setLines(g);
    const blue = [
      ...arrow(A.clone(), vA, { plane: up, width: 1.15, head: 3 }),
      ...arrow(B.clone(), vB, { plane: up, width: 1.15, head: 3 }),
      arrow(A.clone(), vB, { plane: up, width: 0.9, head: 2.6 })[1],
    ].filter(Boolean);
    rig.vel.setLines(blue);
    // 模型：Δt = rΔθ/v，|Δv| = 2v·sin(Δθ/2)
    const dt = (R1 * dth) / V1, dv = 2 * V1 * Math.sin(dth / 2), aAvg = dv / dt, aC = (V1 * V1) / R1;
    // 红：Δv（vA 的箭头尖 → 平移过来的 vB 的箭头尖）；平均加速度 Δv/Δt 画在弧 AB 的中点，正好沿半径指向圆心
    const thM = TH_A + dth / 2, M = this.onTrack(thM), inM = V(-Math.cos(thM), 0, Math.sin(thM));
    rig.dv.setLines([
      ...arrow(tipA, tipB2.clone().sub(tipA), { plane: up, width: 1.2, head: 2.8 }),
      ...arrow(M.clone().addScaledVector(inM, RB * 0.5), inM.clone().multiplyScalar(KA1 * aAvg), { plane: up, width: 1.2, head: 3 }),
    ]);
    rig.cupDv.setValue(aAvg);
    rig.cupA.setValue(aC);
    rig.tagTh.set('转过的角 Δθ', `${Math.round(deg(dth))}°`);
    rig.tagDt.set('所用时间 Δt', `${dt.toFixed(2)} s`);
    this.setNumbers([
      `r = ${R1.toFixed(2)} m，v = ${V1.toFixed(1)} m/s`,
      `Δθ = ${Math.round(deg(dth))}°`,
      `Δt = rΔθ/v = ${dt.toFixed(2)} s`,
      `|Δv| = ${dv.toFixed(2)} m/s`,
      `Δv/Δt = ${aAvg.toFixed(2)} m/s²`,
      `v²/r = ${aC.toFixed(2)} m/s²`,
      `Δv 偏离半径 ${(deg(dth) / 2).toFixed(0)}°`,
    ]);
  }

  tick(dt) {
    if (this.ex === 0 && this.m0.on) this.m0.phi = (this.m0.phi + this.omega * dt) % (Math.PI * 2);
    this.placeAll();
  }

  handles() {
    const out = [];
    const r0 = this.rigs[0], r1 = this.rigs[1];
    // 装置 0：拖小球（或滑轨）改半径；点转盘开 / 停
    const dragR = (ray) => {
      const p = this.rayToPlane(ray, V(0, BALL_Y, 0), V(0, 1, 0));
      if (!p) return;
      this.m0.r = round2(clamp(Math.hypot(p.x - C0.x, p.z - C0.z) / S, R_MIN, R_MAX));
    };
    for (const o of [r0.ball.mesh, ...r0.rails]) out.push({ object: o, cursor: 'grab', onMove: dragR, onUp: () => this.app.sound?.play('tick') });
    out.push({ object: r0.disc.mesh, cursor: 'pointer', onUp: () => { this.m0.on = !this.m0.on; this.app.sound?.play('tick'); } });
    out.push({ object: r0.knob.mesh, cursor: 'pointer', onUp: () => { this.setOmega(((this.state.switches.w ?? 2) + 1) % OMEGAS.length); this.m0.on = true; this.app.sound?.play('tick'); } });
    // 装置 1：沿轨道拖 B
    out.push({
      object: r1.ballB.mesh, cursor: 'grab',
      onMove: (ray) => {
        const p = this.rayToPlane(ray, V(0, Y1, 0), V(0, 1, 0));
        if (!p) return;
        let d = Math.atan2(-(p.z - C1.z), p.x - C1.x) - TH_A;
        d = ((d % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (d > rad(250)) d = rad(15);           // 拖过了 A，停在最小角
        this.m1.dth = rad(clamp(Math.round(deg(d)), 15, 150));   // 小于 15° 两颗球会叠在一起
      },
      onUp: () => this.app.sound?.play('tick'),
    });
    return out;
  }

  shots() {
    return [
      { cam: () => this.near(C0.x + 6, DISC_TOP, C0.z, V(-20, 190, 250)), act: () => { this.switchExhibit(0, true); this.setOmega(2); this.m0.r = 0.10; this.m0.on = true; this.placeAll(); } },
      { cam: () => this.near(C0.x + 30, DISC_TOP, C0.z - 6, V(0, 200, 280)), act: () => { this.switchExhibit(0, true); this.setOmega(2); this.m0.r = 0.20; this.m0.on = true; this.placeAll(); } },
      { cam: () => this.near(C1.x + 6, Y1, C1.z + 18, V(-10, 170, 220)), act: () => { this.switchExhibit(1, true); this.m1.dth = rad(90); this.placeAll(); } },
      { cam: () => this.near(C1.x + 6, Y1, C1.z + 24, V(0, 140, 180)), act: () => { this.switchExhibit(1, true); this.m1.dth = rad(15); this.placeAll(); } },
      { cam: null, act: () => { this.switchExhibit(0, true); this.m0.r = 0.15; this.placeAll(); } },
    ];
  }
}
