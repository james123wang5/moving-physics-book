import * as THREE from 'three';
import { DioramaLesson } from './diorama.js';
import { box, InkLathe, InkSphere, circlePts } from '../ink/shapes.js';
import { MeterTube, glowMaterial } from '../ink/glow.js';
import { V, BLUE, dashes, arrow, makeTag } from '../ink/kit.js';

// 第 2 课 · 运动的合成与分解：小船过河（船速 + 水速 = 合速度），气泡管小车（竖直匀速 + 水平匀速/加速）。

const Y0 = 5;
const WATER_Y = Y0 + 1.2;
const RIVER = { x0: 4, x1: 118, near: -14, far: -52 };   // 水面范围（z）
const WIDTH_M = 40;                                     // 河宽 40 米
const MM = (RIVER.near - RIVER.far) / WIDTH_M;          // 每米多少毫米
const DOCK = V(38, WATER_Y, RIVER.near - 3);
const BOAT_SPEED = 2.0;                                 // 米/秒
const WATER_SPEEDS = [0.8, 1.6, 2.6];
const TIME_SCALE = 6;                                   // 演示加速
const TUBE = { x0: 132, x1: 160, z: -34, h: 46, rate: 11 };
const GRAY = '#6b6f78';

function hullShape() {
  const s = new THREE.Shape();
  s.moveTo(-6, -2.6); s.lineTo(3, -2.6); s.quadraticCurveTo(6.5, -1.6, 7.5, 0); s.quadraticCurveTo(6.5, 1.6, 3, 2.6); s.lineTo(-6, 2.6); s.closePath();
  return s;
}

export class RiverLesson extends DioramaLesson {
  exhibitDefs() {
    return [
      { name: '小船', rect: [4, 120, -74, -6], scale: 1.26 },
      { name: '气泡管', rect: [124, 170, -50, -24], scale: 2.25 },
    ];
  }

  build(ex) {
    const { pop, pen, ink, faint } = this;
    const paper = (o) => pop.paper(o);
    const R = RIVER;
    if (ex === 0) {

    // 两岸
    const bank = paper({ hatchA: [0.6, 0.7, 0.4], hatchB: [1, 0, 0.3], spacing: 1.6, seed: 41, color: '#f1efe6' });
    box(pop, ink, V(R.x0, Y0, R.near), V(R.x1, Y0 + 3, -6), { mat: bank, pen, width: 1 });
    box(pop, ink, V(R.x0, Y0, -64), V(R.x1, Y0 + 3, R.far), { mat: bank, pen, width: 1 });
    for (let x = R.x0 + 4; x < R.x1; x += 6.5) {
      faint.add([V(x, Y0 + 3.02, -9 - (x % 3)), V(x + 1.4, Y0 + 3.02, -8 - (x % 3))], { sched: pen.next(2), width: 0.5 });
      faint.add([V(x + 2, Y0 + 3.02, -58 + (x % 4)), V(x + 3.4, Y0 + 3.02, -57 + (x % 4))], { sched: pen.next(2), width: 0.5 });
    }
    // 水面
    const water = paper({ hatchA: [0, 0, 1], hatchB: [1, 0, 0], spacing: 2.6, seed: 42, color: '#e6eff3', hatch: 0.3 });
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(R.x1 - R.x0, R.near - R.far).rotateX(-Math.PI / 2), water);
    wm.position.set((R.x0 + R.x1) / 2, WATER_Y, (R.near + R.far) / 2);
    pop.addSurface(wm);
    this.waterMesh = wm;
    this.flow = this.dyn('#7b93a8', 1.1, 600);
    // 码头
    const wood = paper({ hatchA: [1, 0, 0.12], hatchB: [0.2, 0.3, 1], spacing: 1.2, seed: 43 });
    box(pop, ink, V(DOCK.x - 6, Y0 + 2, R.near - 1), V(DOCK.x + 6, Y0 + 3.6, -7), { mat: wood, pen, width: 0.9 });
    // 对岸的距离刻度
    for (let m = 0; m <= 60; m += 5) {
      const x = DOCK.x + m * MM * 1.0;
      if (x > R.x1 - 2) break;
      ink.add([V(x, Y0 + 3.05, R.far - 0.5), V(x, Y0 + 3.05, R.far - (m % 10 ? 2 : 3.5))], { sched: pen.next(3), width: m % 10 ? 0.5 : 0.8, taper: false });
    }
    // 船
    this.boat = new THREE.Group();
    this.boat.scale.setScalar(1.7);
    pop.group.add(this.boat);
    const hullGeo = new THREE.ExtrudeGeometry(hullShape(), { depth: 2.4, bevelEnabled: false }).rotateX(-Math.PI / 2);
    this.hull = new THREE.Mesh(hullGeo, paper({ hatchA: [1, 0, 0.12], hatchB: [0.2, 0.3, 1], spacing: 1.0, seed: 44, color: '#f4ead9' }));
    pop.addSurface(this.hull, this.boat);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 3.4).translate(-1.5, 3.5, 0), paper({ hatchA: [0, 1, 0], hatchB: [1, 0, 0], spacing: 1, seed: 45 }));
    pop.addSurface(cabin, this.boat);
    const hullPts = hullShape().getPoints(10).map((p) => V(p.x, 0, -p.y));
    this.boatLines = this.stat(undefined, 1.5, this.boat);
    this.boatLines.add(hullPts.map((p) => p.clone().setY(2.4)), { closed: true, sched: pen.next(30), width: 1 });
    this.boatLines.add(hullPts.map((p) => p.clone()), { closed: true, sched: pen.next(30), width: 0.7 });
    for (const [x, z] of [[-6, -2.6], [-6, 2.6], [3, -2.6], [3, 2.6], [7.5, 0]]) this.boatLines.add([V(x, 0, z), V(x, 2.4, z)], { sched: pen.next(3), width: 0.7 });
    const c0 = [[-3.5, -1.7], [0.5, -1.7], [0.5, 1.7], [-3.5, 1.7]];
    this.boatLines.add(c0.map(([x, z]) => V(x, 4.6, z)), { closed: true, sched: pen.next(14), width: 0.8 });
    for (const [x, z] of c0) this.boatLines.add([V(x, 2.4, z), V(x, 4.6, z)], { sched: pen.next(2), width: 0.6 });
    this.vecs = this.dyn(undefined, 1.6, 200);
    this.vecBlue = this.dyn(BLUE, 1.7, 60);
    this.vecGray = this.dyn(GRAY, 1.7, 60);
    this.landTag = makeTag(pop, 22, 9);

    // 岸边：芦苇丛、卵石；对岸正对码头处插一面小旗
    const reeds = (x, z, lean) => {
      for (let i = 0; i < 5; i++) {
        const dx = (i - 2) * 0.7, h = 6 + ((i * 37 + x) % 5), bend = lean * (0.8 + i * 0.25);
        const pts = Array.from({ length: 6 }, (_, j) => { const t = j / 5; return V(x + dx + bend * t * t * 2.2, Y0 + 3 + h * t, z + (i % 2 ? 0.4 : -0.4)); });
        ink.add(pts, { sched: pen.next(h), width: 0.55 });
        if (i % 2 === 0) {
          const top = pts[5], c = pts[4];
          ink.add([c.clone().add(V(-0.45, 0, 0)), top.clone().add(V(-0.45, 1.6, 0)), top.clone().add(V(0.45, 1.6, 0)), c.clone().add(V(0.45, 0, 0))], { closed: true, sched: pen.next(3), width: 0.5 });
        }
      }
    };
    for (const [x, z, l] of [[9, R.near - 0.6, 1], [70, R.near - 0.6, -1], [104, R.near - 0.6, 1], [20, R.far + 0.6, -1], [58, R.far + 0.6, 1], [95, R.far + 0.6, -1], [112, R.far + 0.6, 1]]) reeds(x, z, l);
    const stone = paper({ hatchA: [0.9, 0.12, -0.42], hatchB: [0.2, 0.9, 0.4], spacing: 1, seed: 49, color: '#e9e6df' });
    for (const [x, z, r] of [[14, R.near + 0.4, 1.6], [17.5, R.near - 0.2, 1.1], [76, R.near + 0.3, 1.4], [28, R.far - 0.4, 1.7], [31.5, R.far + 0.2, 1.1], [86, R.far - 0.3, 1.5], [100, R.far + 0.1, 1.2]]) {
      const st = new InkSphere(pop, { r, centre: V(x, Y0 + 2.4, z), mat: stone, sched: pen.next(r * 6), width: 0.85 });
      this.lifters.push(st);
    }
    const fx = DOCK.x, fz = R.far - 2.5, ft = Y0 + 3 + 11;
    ink.add([V(fx, Y0 + 3, fz), V(fx, ft, fz)], { sched: pen.next(11), width: 0.85 });
    ink.add([V(fx, ft, fz), V(fx + 5, ft - 1.6, fz), V(fx, ft - 3.2, fz)], { sched: pen.next(10), width: 0.75 });
    const pennant = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(5, -1.6), new THREE.Vector2(0, -3.2)])), paper({ hatch: 0, color: '#eac9bd' }));
    pennant.material.side = THREE.DoubleSide;
    pennant.position.set(fx, ft, fz - 0.02);
    pop.addSurface(pennant);
    const goal = makeTag(pop, 15, 6);
    goal.mesh.position.set(fx + 12, Y0 + 3 + 4.5, fz - 3);
    goal.set('目标', '正对岸');
    // 顺水漂的树叶：和水一样快
    this.leaves = [];
    const leafShape = new THREE.Shape();
    leafShape.moveTo(-2.2, 0); leafShape.quadraticCurveTo(0, 1.5, 2.2, 0); leafShape.quadraticCurveTo(0, -1.5, -2.2, 0);
    const leafGeo = new THREE.ShapeGeometry(leafShape, 8).rotateX(-Math.PI / 2);
    const leafPts = leafShape.getPoints(8).map((p) => V(p.x, 0.02, -p.y));
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      pop.group.add(g);
      pop.addSurface(new THREE.Mesh(leafGeo, paper({ hatch: 0.2, color: i % 2 ? '#dfe6c4' : '#e8dcb8', seed: 70 + i })), g);
      const ls = this.stat(undefined, 1.2, g);
      ls.add(leafPts, { closed: true, sched: pen.next(10), width: 0.7 });
      ls.add([V(-2.2, 0.03, 0), V(1.8, 0.03, 0)], { sched: pen.next(4), width: 0.45 });
      g.position.set(R.x0 + 8 + i * 27, WATER_Y + 0.08, R.near - 7 - ((i * 13) % 4) * 6.5);
      g.rotation.y = i * 1.3;
      this.leaves.push({ g, z0: g.position.z, phase: i * 1.7 });
    }

    // 速度管：船速、水速
    // 仪表架：木板托着两支速度管
    [this.tubeB, this.tubeW] = this.rack({ cx: 98, z: -72, y0: Y0, legH: 7, r: 5.5, h: 12, items: [{ color: '#2f7bff', label: '船速', capacity: 3 }, { color: '#21c4c9', label: '水速', capacity: 3 }] });
    this.glows.push({ lightInfo: (o) => { this.bubble.updateWorldMatrix(true, false); return { pos: o.setFromMatrixPosition(this.bubble.matrixWorld), color: new THREE.Color('#7fd6ff'), strength: 0.25 }; } });
    }
    if (ex === 1) {
    // 气泡管小车
    const T = TUBE;
    const rail = paper({ hatchA: [0, 1, 0], hatchB: [1, 0, 0], spacing: 1.2, seed: 46, color: '#e9ecef' });
    box(pop, ink, V(T.x0 - 6, Y0, T.z - 4), V(T.x1 + 8, Y0 + 1.6, T.z - 2), { mat: rail, pen, width: 0.8 });
    box(pop, ink, V(T.x0 - 6, Y0, T.z + 2), V(T.x1 + 8, Y0 + 1.6, T.z + 4), { mat: rail, pen, width: 0.8 });
    // 后面的方格板
    const card = paper({ hatchA: [1, 0.05, 0.25], hatchB: [0.3, 1, 0.2], spacing: 2.2, seed: 47, shade: 0.06, hatch: 0.25 });
    box(pop, ink, V(T.x0 - 6, Y0, T.z - 14), V(T.x1 + 8, Y0 + T.h + 6, T.z - 12.5), { mat: card, pen, width: 0.9 });
    for (let y = Y0 + 6; y < Y0 + T.h + 5; y += 6) faint.add([V(T.x0 - 6, y, T.z - 12.5), V(T.x1 + 8, y, T.z - 12.5)], { sched: pen.next(30), width: 0.4, taper: false });
    for (let x = T.x0 - 6 + 6; x < T.x1 + 8; x += 6) faint.add([V(x, Y0, T.z - 12.5), V(x, Y0 + T.h + 6, T.z - 12.5)], { sched: pen.next(30), width: 0.4, taper: false });
    // 小车（会动）：车体 + 轮子 + 玻璃管
    this.cart = new THREE.Group();
    pop.group.add(this.cart);
    this.cartBody = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 10).translate(0, 4, 0), paper({ hatchA: [1, 0, 0.12], hatchB: [0.2, 0.3, 1], spacing: 1.2, seed: 48 }));
    pop.addSurface(this.cartBody, this.cart);
    const cartLines = this.stat(undefined, 1.5, this.cart);
    const bx = [-6, 6], by = [2, 6], bz = [-5, 5];
    for (const y of by) cartLines.add([V(-6, y, -5), V(6, y, -5), V(6, y, 5), V(-6, y, 5)], { closed: true, sched: pen.next(40), width: 0.9 });
    for (const x of bx) for (const z of bz) cartLines.add([V(x, 2, z), V(x, 6, z)], { sched: pen.next(4), width: 0.8 });
    for (const x of [-4, 4]) for (const z of [-5.4, 5.4]) cartLines.add(circlePts(1.8, 0, 20).map((p) => V(x + p.x, 2 + p.z, z)), { closed: true, sched: pen.next(6), width: 0.8 });
    const glass = new InkLathe(pop, [[3.4, 0], [3.4, T.h]], { mat: paper({ hatch: 0, color: '#ffffff' }), pen, rims: [0, 1], width: 0.9, parent: this.cart });
    glass.group.position.set(0, 6, 0);
    glass.mesh.visible = false; // 玻璃只画线
    this.deferred.push(() => glass.build());
    this.lifters.push(glass);
    this.bubbleMat = glowMaterial(pop, { color: '#7fd6ff', glow: 3.2, radius: 1.6 });
    this.bubble = new THREE.Mesh(new THREE.SphereGeometry(1.8, 20, 14), this.bubbleMat);
    this.bubble.layers.enable(1);
    this.cart.add(this.bubble);
    this.trace = this.dyn('#2a6fb0', 1.4, 600);

    }
    this.heading = Math.PI / 2;
    this.drawTime = 3.6;
  }

  get waterSpeed() { return WATER_SPEEDS[this.state.switches.water ?? 0]; }

  reset() {
    this.trip = { on: false, t: 0, p: DOCK.clone(), trail: [DOCK.clone()], landed: null };
    this.cartRun = { on: false, t: 0, x: TUBE.x0, trail: [] };
    this.placeBoat();
    this.placeCart();
  }

  onSwitch(sid, i) { if (sid === 'ex') super.onSwitch(sid, i); else this.reset(); }

  // ---------- 船 ----------
  velocity(t) {
    const vb = V(Math.cos(this.heading), 0, -Math.sin(this.heading)).multiplyScalar(BOAT_SPEED);
    const vw = this.waterSpeed * (1 + 0); void t;
    return { vb, vw: V(vw, 0, 0) };
  }

  placeBoat() {
    const tr = this.trip;
    this.boat.position.copy(tr.p);
    this.boat.rotation.y = this.heading;
    const { vb, vw } = this.velocity(tr.t);
    const k = 7;
    const o = tr.p.clone().add(V(0, 3, 0));
    this.vecBlue.setLines(arrow(o, vb.clone().multiplyScalar(k), { plane: V(0, 1, 0), width: 1.1 }));
    this.vecGray.setLines(arrow(o, vw.clone().multiplyScalar(k), { plane: V(0, 1, 0), width: 1.1 }));
    const lines = arrow(o, vb.clone().add(vw).multiplyScalar(k), { plane: V(0, 1, 0), width: 1.3 });
    for (const d of dashes(tr.trail, 2, 1.4)) lines.push({ points: d, width: 0.8, taper: false });
    if (tr.landed) {
      const f = tr.landed;
      lines.push({ points: [V(f.x, Y0 + 3, RIVER.far - 1), V(f.x, Y0 + 12, RIVER.far - 1)], width: 1, taper: false });
      lines.push({ points: [V(f.x, Y0 + 12, RIVER.far - 1), V(f.x + 5, Y0 + 10.5, RIVER.far - 1), V(f.x, Y0 + 9, RIVER.far - 1)], width: 0.9, taper: false });
      for (const d of dashes([V(DOCK.x, Y0 + 3.1, RIVER.far - 1), V(f.x, Y0 + 3.1, RIVER.far - 1)], 1.5, 1)) lines.push({ points: d, width: 0.7, taper: false });
    }
    this.vecs.setLines(lines);
    this.landTag.mesh.visible = !!tr.landed;
    if (tr.landed) {
      this.landTag.mesh.position.set(tr.landed.x + 13, Y0 + 15, RIVER.far - 1);
      this.landTag.set('下游偏移', `${tr.landed.drift.toFixed(1)} m`);
    }
    this.tubeB.setValue(BOAT_SPEED);
    this.tubeW.setValue(this.waterSpeed);
    const vperp = BOAT_SPEED * Math.sin(this.heading);
    const tCross = vperp > 0.05 ? WIDTH_M / vperp : Infinity;
    if (this.ex === 0) this.setNumbers([
      `河宽 d = ${WIDTH_M} m`,
      `船速 ${BOAT_SPEED.toFixed(1)} m/s`,
      `水速 ${this.waterSpeed.toFixed(1)} m/s`,
      `船头偏角 ${(90 - (this.heading * 180) / Math.PI).toFixed(0)}°`,
      `t = d / v⊥ = ${isFinite(tCross) ? tCross.toFixed(1) : '∞'} s`,
      tr.landed ? `靠岸偏下游 ${tr.landed.drift.toFixed(1)} m` : '',
    ]);
  }

  stepBoat(dt) {
    const tr = this.trip;
    if (!tr.on) return;
    const { vb, vw } = this.velocity(tr.t);
    const step = vb.clone().add(vw).multiplyScalar(dt * TIME_SCALE * MM);
    tr.t += dt * TIME_SCALE;
    tr.p.add(step);
    if (tr.trail[tr.trail.length - 1].distanceTo(tr.p) > 1) tr.trail.push(tr.p.clone());
    if (tr.p.z <= RIVER.far + 2 || tr.p.x > RIVER.x1 - 3 || tr.p.x < RIVER.x0 + 3) {
      tr.on = false;
      tr.landed = { x: tr.p.x, drift: (tr.p.x - DOCK.x) / MM };
      // 挑战：水比船快时，船头取最佳角度，偏移最小
      const vw = this.waterSpeed;
      if (vw > BOAT_SPEED && tr.p.z <= RIVER.far + 2) {
        const best = (WIDTH_M * Math.sqrt(vw * vw - BOAT_SPEED * BOAT_SPEED)) / BOAT_SPEED;
        if (Math.abs(tr.landed.drift - best) < best * 0.08) this.earnStamp();
      }
      this.app.sound?.play('thud');
    }
    this.placeBoat();
  }

  launchBoat() {
    if (this.trip.on) return;
    this.trip = { on: true, t: 0, p: DOCK.clone(), trail: [DOCK.clone()], landed: null };
  }

  // ---------- 气泡管 ----------
  placeCart() {
    const c = this.cartRun, T = TUBE;
    this.cart.position.set(c.x, Y0 + 1.6, T.z);
    const y = Math.min(T.h - 3, 2 + c.t * T.rate);
    this.bubble.position.set(0, 6 + y, 0);
    if (this.ex === 1) this.setNumbers(['气泡：竖直匀速', `小车：${this.state.switches.cart ? '加速 → 曲线' : '匀速 → 直线'}`, c.on ? '' : '点小车出发']);
    const lines = [];
    for (const d of dashes(c.trail, 1.6, 1.2)) lines.push({ points: d, width: 0.9, taper: false });
    this.trace.setLines(lines);
  }

  stepCart(dt) {
    const c = this.cartRun, T = TUBE;
    this.bubbleMat.uniforms.uTime.value = this.time;
    this.bubbleMat.uniforms.uAlpha.value = this.pop.u.uSurfAlpha.value;
    if (!c.on) return;
    c.t += dt;
    const accel = (this.state.switches.cart ?? 0) === 1;
    c.x = T.x0 + (accel ? 0.5 * 4.2 * c.t * c.t : 6.5 * c.t);
    const y = 2 + c.t * T.rate;
    if (c.x > T.x1 || y > T.h - 3) { c.on = false; c.x = Math.min(c.x, T.x1); }
    c.trail.push(V(c.x, Y0 + 1.6 + 6 + Math.min(y, T.h - 3), T.z - 12.4));
    this.placeCart();
  }

  runCart() { this.cartRun = { on: true, t: 0, x: TUBE.x0, trail: [] }; }

  tick(dt) {
    if (this.ex === 0) { this.stepFlow(dt); this.stepLeaves(dt); this.stepBoat(dt); } else this.stepCart(dt);
  }

  stepLeaves(dt) {
    const R = RIVER, v = this.waterSpeed * 6;
    for (const L of this.leaves) {
      const p = L.g.position;
      p.x += v * dt;
      if (p.x > R.x1 - 3) p.x = R.x0 + 3;
      p.z = L.z0 + Math.sin(this.time * 0.7 + L.phase) * 0.8;
      L.g.rotation.y += dt * 0.15 * Math.sin(this.time * 0.4 + L.phase);
      const edge = Math.min(p.x - R.x0 - 3, R.x1 - 3 - p.x);
      L.g.scale.setScalar(Math.max(0.01, Math.min(1, edge / 5)));
    }
  }

  stepFlow() {
    const R = RIVER, lines = [];
    const speed = this.waterSpeed * 6;
    for (let lane = 0; lane < 6; lane++) {
      const z = R.near - 3 - lane * ((R.near - R.far - 6) / 5);
      const off = ((this.time * speed + lane * 7.3) % 12) - 12;
      for (let x = R.x0 + off; x < R.x1 - 4; x += 12) {
        const a = Math.max(R.x0 + 1, x), b = Math.min(R.x1 - 1, x + 4.5);
        if (b - a > 0.6) lines.push({ points: [V(a, WATER_Y + 0.05, z + Math.sin(x * 0.2 + lane) * 0.4), V(b, WATER_Y + 0.05, z + Math.sin(b * 0.2 + lane) * 0.4)], width: 0.7, taper: true });
      }
    }
    this.flow.setLines(lines);
  }

  // ---------- 交互 ----------
  handles() {
    const onWater = (ray) => this.rayToPlane(ray, V(0, WATER_Y, 0), V(0, 1, 0));
    return [
      {
        object: this.hull, cursor: 'grab',
        onDown: () => { this.moved = false; },
        onMove: (ray) => {
          const p = onWater(ray);
          if (!p || this.trip.on) return;
          const d = p.sub(this.trip.p);
          if (d.length() < 2) return;
          this.moved = true;
          this.heading = Math.max(0.12, Math.min(Math.PI - 0.12, Math.atan2(-d.z, d.x)));
          this.trip.landed = null; this.trip.trail = [this.trip.p.clone()];
          this.placeBoat();
        },
        onUp: () => { if (!this.moved) { if (this.trip.landed) this.reset(); this.launchBoat(); } },
      },
      { object: this.cartBody, cursor: 'pointer', onUp: () => this.runCart() },
    ];
  }

  shots() {
    const cx = (RIVER.x0 + RIVER.x1) / 2, S = this.defs[0].scale;
    const A = (dx, dy, dz) => this.w(cx + dx / S, dy / S, -30 + dz / S);
    const T = TUBE;
    return [
      { cam: () => ({ pos: A(-20, 140, 110), look: A(-10, WATER_Y, 0) }), act: () => { this.switchExhibit(0, true); this.state.switches.water = 0; this.heading = Math.PI / 2; this.reset(); } },
      { cam: () => ({ pos: A(-25, 120, 100), look: A(-15, WATER_Y, 0) }), act: () => this.launchBoat() },
      { cam: () => ({ pos: A(-10, 90, 70), look: A(-5, WATER_Y, -6) }) },
      { cam: () => ({ pos: A(0, 140, 110), look: A(0, WATER_Y, 0) }), act: () => { this.state.switches.water = 2; this.book.pages.invalidate(this.k, 'right'); this.reset(); this.launchBoat(); } },
      { cam: () => this.near((T.x0 + T.x1) / 2, 30, T.z, V(-30, 150, 310)), act: () => { this.switchExhibit(1, true); this.state.switches.water = 0; this.book.pages.invalidate(this.k, 'right'); this.reset(); this.runCart(); } },
    ];
  }
}
