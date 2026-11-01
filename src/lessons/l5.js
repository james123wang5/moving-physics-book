import * as THREE from 'three';
import { DioramaLesson } from './diorama.js';
import { box, InkSphere, InkLathe } from '../ink/shapes.js';
import { MeterTube, Sparks, Streaks } from '../ink/glow.js';
import { V, BLUE, RED, ORANGE, dashes, ringXY, ringXZ, arrow, makeTag } from '../ink/kit.js';

// 第 5 课 · 一般的抛体运动：投掷场沙盘。
// 抬高的草地上，炮口（抛出点）和地面等高；炮管绕炮口转，量角器读仰角；保留最近 4 条轨迹和落点小旗；
// 高台、空气阻力两个开关；后面的水池里一支喷嘴跟着同样的角度和速度喷水（发光的水流就是轨迹）；
// 两支速度管显示水平、竖直分速度。挑战：高台上分别找出无阻力、有阻力时最远的角度。

const Y0 = 5;
const FY = 16;              // 草地表面
const S = 26;               // 每米多少毫米
const G = 9.8;
const K_AIR = 0.06;         // 空气阻力 a = −k v|v|（每米）
const SPEEDS = [4, 5, 6];
const STAND = 1.0;          // 高台（米）
const BALL_R = 2;
const ZP = -30;             // 运动平面
const PX = 26;              // 抛出点 x
const PY = FY + BALL_R;     // 地面模式抛出点（球心）y：和落地时的球心等高
const LT = 10.4;            // 炮管长
const PROT_R = 15;          // 量角器半径
const SLOW = 0.6;           // 慢放
const DEG = Math.PI / 180;
const COLORS = [BLUE, RED, '#3d7a4e', '#6a4aa0'];
const NOZ = V(40, FY + 2.4, -55);   // 喷嘴转轴
const NOZ_L = 4;
const POOL_Y = FY + 1.2;    // 水面
const ARW = 2.4;            // 速度箭头：毫米 / (m/s)
const GR = { x0: -4.5, y0: Y0 + 5, w: 14.5, h: 19, z: -11.9, rMax: 5 };   // 射程–仰角小图（立在左前方的卡片上）

/** 一条轨迹（米，以抛出点正下方的地面为原点）：无阻力用解析式，有阻力数值积分 */
function simulate(v0, theta, h, air) {
  const vx0 = v0 * Math.cos(theta), vy0 = v0 * Math.sin(theta);
  const step = 0.004, pts = [];
  if (!air) {
    const T = (vy0 + Math.sqrt(vy0 * vy0 + 2 * G * h)) / G;
    for (let t = 0; t < T; t += step) pts.push({ x: vx0 * t, y: h + vy0 * t - 0.5 * G * t * t, t, vx: vx0, vy: vy0 - G * t });
    pts.push({ x: vx0 * T, y: 0, t: T, vx: vx0, vy: vy0 - G * T });
    return { pts, step, range: vx0 * T, top: h + (vy0 * vy0) / (2 * G), time: T, h };
  }
  const dt = 0.0005, every = Math.round(step / dt);
  let x = 0, y = h, vx = vx0, vy = vy0, t = 0, top = h, i = 0;
  pts.push({ x, y, t, vx, vy });
  while (t < 6) {
    const px = x, py = y, pt = t, sp = Math.hypot(vx, vy);
    vx += -K_AIR * sp * vx * dt;
    vy += (-G - K_AIR * sp * vy) * dt;
    x += vx * dt; y += vy * dt; t += dt; i++;
    top = Math.max(top, y);
    if (y <= 0) {
      const f = py / (py - y);
      const land = { x: px + (x - px) * f, y: 0, t: pt + dt * f, vx, vy };
      pts.push(land);
      return { pts, step, range: land.x, top, time: land.t, h };
    }
    if (i % every === 0) pts.push({ x, y, t, vx, vy });
  }
  return { pts, step, range: x, top, time: t, h };
}

function sample(sim, t) {
  const { pts, step } = sim;
  const i = Math.max(0, Math.min(pts.length - 2, Math.floor(t / step)));
  const a = pts[i], b = pts[i + 1], f = Math.max(0, Math.min(1, (t - a.t) / Math.max(1e-6, b.t - a.t)));
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, vx: a.vx + (b.vx - a.vx) * f, vy: a.vy + (b.vy - a.vy) * f, t };
}

const apexOf = (sim) => sim.pts.reduce((m, q) => (q.y > m.y ? q : m));

export class ThrowLesson extends DioramaLesson {
  exhibitDefs() {
    return [
      { name: '投掷场', rect: [12, 152, -66, -4], scale: 1.1 },
      { name: '喷泉', rect: [30, 150, -64, -38], scale: 1.28 },
      { name: '射程图', rect: [-10, 14, -17, -8], scale: 4.2 },
    ];
  }

  build(ex) {
    const { pop, pen, ink, faint } = this;
    const paper = (o) => pop.paper(o);
    this.state.switches.speed ??= 2;
    const metal = paper({ hatchA: [0, 1, 0.2], hatchB: [1, 0.2, 0.3], spacing: 1.2, seed: 61, color: '#e8eaee' });
    const wood = paper({ hatchA: [1, 0, 0.12], hatchB: [0.2, 0.3, 1], spacing: 1.4, seed: 62 });
    const turf = paper({ hatchA: [0.62, 0.62, 0.48], hatchB: [-0.5, 0.45, 0.74], spacing: 2.3, seed: 63, color: '#eef0e1', hatch: 0.25 });

    const gx = (deg) => GR.x0 + (deg / 90) * GR.w, gy = (r) => GR.y0 + (r / GR.rMax) * GR.h;
    this.gx = gx; this.gy = gy;
    if (ex === 0) {
    // 投掷场：抬高的草地，炮口和地面一样高（等高时射程公式才成立）
    box(pop, ink, V(29.5, Y0, -63), V(150, FY, -5), { mat: turf, pen, width: 1 });
    for (let i = 0; i < 110; i++) {
      const x = 33 + ((i * 47) % 114), z = -45 + ((i * 29) % 31);
      faint.add([V(x - 0.5, FY + 0.03, z + 0.2), V(x, FY + 0.03, z - 0.5), V(x + 0.5, FY + 0.03, z + 0.2)], { sched: pen.next(1), width: 0.55, taper: false });
    }
    // 方格背板：每格 0.5 m，读射高用
    const card = paper({ hatchA: [1, 0.05, 0.25], hatchB: [0.3, 1, 0.2], spacing: 2.4, seed: 68, shade: 0.05, hatch: 0.18 });
    const bx1 = 150, by1 = PY + 3.1 * S, bz = -64;
    box(pop, ink, V(29.5, Y0, bz - 1.5), V(bx1, by1, bz), { mat: card, pen, width: 1 });
    for (let m = 0.5; PY + m * S < by1 - 1; m += 0.5) faint.add([V(29.5, PY + m * S, bz + 0.02), V(bx1, PY + m * S, bz + 0.02)], { sched: pen.next(bx1 - 30), width: m % 1 ? 0.4 : 0.6, taper: false });
    for (let m = 0.5; PX + m * S < bx1 - 1; m += 0.5) faint.add([V(PX + m * S, FY, bz + 0.02), V(PX + m * S, by1, bz + 0.02)], { sched: pen.next(by1 - FY), width: m % 1 ? 0.4 : 0.6, taper: false });
    // 刻度条：每 0.25 m 一格，整米长刻度（零点在炮口）
    box(pop, ink, V(29.5, FY, -11.5), V(PX + 4.5 * S, FY + 0.3, -6), { mat: paper({ hatch: 0, color: '#fbf6ea' }), pen, width: 0.7, hide: ['side'] });
    for (let q = 1; q <= 17; q++) {
      const x = PX + q * 0.25 * S, big = q % 4 === 0;
      ink.add([V(x, FY + 0.32, -11.5), V(x, FY + 0.32, -11.5 + (big ? 3.4 : q % 2 ? 1.3 : 2.1))], { sched: pen.next(3), width: big ? 0.8 : 0.5, taper: false });
    }

    }
    if (ex === 1) {
    // 水池和喷嘴
    const water = paper({ hatchA: [1, 0, 0.1], hatchB: [0.2, 0.2, 1], spacing: 1.6, seed: 64, color: '#dde9f2', hatch: 0.3 });
    box(pop, ink, V(34, FY, -61), V(146, POOL_Y, -42), { mat: water, pen, width: 0.9 });
    box(pop, ink, V(NOZ.x - 1.6, POOL_Y, NOZ.z - 1.6), V(NOZ.x + 1.6, NOZ.y, NOZ.z + 1.6), { mat: metal, pen, width: 0.8 });
    const pipe = paper({ hatchA: [0, 1, 0.2], hatchB: [1, 0.2, 0.3], spacing: 1, seed: 65, color: '#e4e7ec' });
    pipe.side = THREE.DoubleSide;
    this.nozzle = new InkLathe(pop, [[1.1, 0], [1.1, NOZ_L - 1], [0.75, NOZ_L]], { mat: pipe, pen, rims: [2], width: 0.8 });
    this.nozzle.group.position.copy(NOZ);
    this.deferred.push(() => this.nozzle.build());
    this.lifters.push(this.nozzle);
    this.jet = new Streaks(pop, { max: 1100, tail: 0.045 });
    this.water = new Sparks(pop, { max: 900, size: 0.9 });
    for (const w of [this.jet, this.water]) pop.group.add(w.points);
    this.glows.push(this.jet);
    this.ripples = this.dyn('#5a8fbf', 1.0, 200);
    this.emitAcc = 0;
    // 背后的方格板（每格 0.5 m）：读水柱的高度和远近
    const grid = paper({ hatchA: [1, 0.05, 0.25], hatchB: [0.3, 1, 0.2], spacing: 2.4, seed: 71, shade: 0.05, hatch: 0.18 });
    const gx0 = 34, gx1 = 146, gy1 = POOL_Y + 2.6 * S, gz = -62.5;
    box(pop, ink, V(gx0, FY, gz - 1.2), V(gx1, gy1, gz), { mat: grid, pen, width: 1 });
    for (let m = 0.5; POOL_Y + m * S < gy1 - 1; m += 0.5) faint.add([V(gx0, POOL_Y + m * S, gz + 0.02), V(gx1, POOL_Y + m * S, gz + 0.02)], { sched: pen.next(gx1 - gx0), width: m % 1 ? 0.4 : 0.6, taper: false });
    for (let m = 0.5; NOZ.x + m * S < gx1 - 1; m += 0.5) faint.add([V(NOZ.x + m * S, POOL_Y, gz + 0.02), V(NOZ.x + m * S, gy1, gz + 0.02)], { sched: pen.next(gy1 - FY), width: m % 1 ? 0.4 : 0.6, taper: false });
    this.nozTag = makeTag(pop, 17, 8);
    this.nozTag.mesh.position.set(NOZ.x + 2, POOL_Y + 14, -40.5);
    this.dropTag = makeTag(pop, 20, 8);

    }
    if (ex === 2) {
    // 射程–仰角小图：理论曲线（虚线）、每次投掷一个点、当前仰角的竖线
    box(pop, ink, V(-8, Y0, GR.z - 1.2), V(12.5, Y0 + 28, GR.z - 0.1), { pen, width: 0.9 });
    this.graphCard = new THREE.Mesh(new THREE.BoxGeometry(20.5, 28, 1.1), paper({ hatch: 0.15, color: '#fbf7ee', seed: 69 }));
    this.graphCard.position.set(2.25, Y0 + 14, GR.z - 0.65);
    pop.addSurface(this.graphCard);
    this.plotSet = this.dyn(undefined, 1.3, 400);
    this.plots = [];
    // 卡面上印的坐标刻度文字
    {
      const px = 14, W = 20.5, H = 28, ox = -8, oy = Y0;
      const c = document.createElement('canvas');
      c.width = W * px; c.height = H * px;
      const g = c.getContext('2d');
      g.fillStyle = '#fbf7ee'; g.fillRect(0, 0, c.width, c.height);
      g.setTransform(px, 0, 0, -px, -ox * px, (oy + H) * px);   // 卡片坐标：x 向右，y 向上
      const text = (t, x, y, align = 'center', size = 2.1) => { g.save(); g.translate(x, y); g.scale(1, -1); g.font = `500 ${size}px "Source Serif 4 Variable", "Noto Serif SC", serif`; g.fillStyle = '#4b5466'; g.textAlign = align; g.fillText(t, 0, 0); g.restore(); };
      for (const d of [0, 45, 90]) text(`${d}°`, gx(d), GR.y0 - 3.2);
      for (let r = 1; r <= GR.rMax; r++) text(String(r), GR.x0 - 1.3, gy(r) - 0.7, 'right', 1.9);
      text('θ', gx(90) - 0.4, GR.y0 + 1.1, 'left', 2.3);
      text('R/m', GR.x0 + 0.8, gy(GR.rMax) + 0.2, 'left', 1.9);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const face = paper({ hatch: 0, color: '#ffffff' });
      face.map = tex;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(W, H), face);
      m.position.set(ox + W / 2, oy + H / 2, GR.z - 0.08);
      pop.addSurface(m);
    }
    ink.add([V(GR.x0, gy(GR.rMax) + 1, GR.z), V(GR.x0, GR.y0, GR.z), V(gx(90) + 1, GR.y0, GR.z)], { sched: pen.next(40), width: 0.8, taper: false });
    for (const d of [15, 30, 45, 60, 75, 90]) faint.add([V(gx(d), GR.y0, GR.z), V(gx(d), GR.y0 - (d % 45 ? 0.8 : 1.4), GR.z)], { sched: pen.next(1), width: 0.6, taper: false });
    for (let r = 1; r <= GR.rMax; r++) faint.add([V(GR.x0, gy(r), GR.z), V(GR.x0 - 0.8, gy(r), GR.z)], { sched: pen.next(1), width: 0.6, taper: false });
    this.graph = this.dyn(undefined, 1.2, 300);
    this.graphDots = COLORS.map((c) => this.dyn(c, 1.2, 80));
    this.graphTag = makeTag(pop, 15, 5.8);
    this.graphTag.mesh.position.set(GR.x0 + 7.6, Y0 + 25.2, GR.z + 0.05);

    }
    if (ex === 0) {
    // 高台（切到“高台”时出现）
    this.towerG = new THREE.Group();
    pop.group.add(this.towerG);
    const tl = this.stat(undefined, 1.5, this.towerG);
    const tx0 = 15.5, tx1 = 29.4, th = Y0 + STAND * S, tz = ZP + 7;
    box(pop, tl, V(tx0, Y0, ZP - 7), V(tx1, th, tz), { mat: wood, pen, width: 1, parent: this.towerG });
    for (let y = Y0 + 4; y < th - 1; y += 4) tl.add([V(tx0, y, tz + 0.02), V(tx1, y, tz + 0.02)], { sched: pen.next(14), width: 0.45, taper: false });
    tl.add([V(tx0 + 1, Y0 + 1, tz + 0.05), V(tx1 - 1, th - 1, tz + 0.05)], { sched: pen.next(30), width: 0.7 });
    tl.add([V(tx1 - 1, Y0 + 1, tz + 0.05), V(tx0 + 1, th - 1, tz + 0.05)], { sched: pen.next(30), width: 0.7 });

    // 发射器：底座、两块夹板、绕炮口转动的炮管、量角器（随高台一起升降）
    this.mount = new THREE.Group();
    pop.group.add(this.mount);
    const ml = this.stat(undefined, 1.5, this.mount);
    const mp = { mat: metal, pen, width: 0.95, parent: this.mount };
    box(pop, ml, V(17, Y0, ZP - 5.5), V(29.4, Y0 + 2, ZP + 5.5), mp);
    box(pop, ml, V(PX - 1.8, Y0 + 2, ZP - 4.1), V(PX + 1.8, PY + 2.2, ZP - 3.3), mp);
    box(pop, ml, V(PX - 1.8, Y0 + 2, ZP + 3.3), V(PX + 1.8, PY + 2.2, ZP + 4.1), mp);
    ml.add(ringXY(V(PX, PY, ZP + 4.12), 1.1, 20), { closed: true, sched: pen.next(7), width: 0.8 });
    // 量角器：立在炮管后面的四分之一圆纸板
    const prot = paper({ hatch: 0, color: '#fbf6ea' });
    this.protractor = new THREE.Mesh(new THREE.CircleGeometry(PROT_R, 48, 0, Math.PI / 2), prot);
    this.protractor.position.set(PX, PY, ZP - 4.2);
    pop.addSurface(this.protractor, this.mount);
    const pz = ZP - 4.15, P = V(PX, PY, pz);
    ml.add(ringXY(P, PROT_R, 40, 0, Math.PI / 2), { sched: pen.next(24), width: 0.85 });
    ml.add([P.clone().add(V(PROT_R, 0, 0)), P.clone(), P.clone().add(V(0, PROT_R, 0))], { sched: pen.next(30), width: 0.85 });
    ml.add(ringXY(P, PROT_R * 0.55, 24, 0, Math.PI / 2), { sched: pen.next(13), width: 0.45, taper: false });
    for (let d = 5; d < 90; d += 5) {
      const a = d * DEG, r1 = d % 45 === 0 ? PROT_R * 0.62 : d % 15 === 0 ? PROT_R - 2.4 : PROT_R - 1.3;
      ml.add([V(PX + PROT_R * Math.cos(a), PY + PROT_R * Math.sin(a), pz), V(PX + r1 * Math.cos(a), PY + r1 * Math.sin(a), pz)], { sched: pen.next(2), width: d % 15 ? 0.45 : 0.7, taper: false });
    }
    this.angleTag = makeTag(pop, 15, 8);
    this.mount.add(this.angleTag.mesh);
    this.angleTag.mesh.position.set(21.5, Y0 + 7.5, ZP + 8);
    const barrel = paper({ hatchA: [0, 1, 0.2], hatchB: [1, 0.2, 0.3], spacing: 0.8, seed: 66, color: '#c9d0da', shade: 0.24 });
    barrel.side = THREE.DoubleSide;
    this.tube = new InkLathe(pop, [[1.3, -LT - 0.8], [2.4, -LT], [2.4, -2], [2.9, -2], [2.9, 0]], { mat: barrel, pen, rims: [1, 3, 4], width: 0.9, outlineWidth: 1.3, parent: this.mount });
    this.tube.group.position.set(PX, PY, ZP);
    this.deferred.push(() => this.tube.build());
    this.lifters.push(this.tube);
    this.aim = this.dyn(RED, 1.3, 80);

    // 小球
    const ballMat = paper({ hatchA: [0.9, 0.12, -0.42], hatchB: [0.2, 0.9, 0.4], spacing: 1, seed: 67, color: '#f3dccb' });
    this.ball = new InkSphere(pop, { r: BALL_R, centre: V(PX, PY, ZP), mat: ballMat, sched: pen.next(13), width: 0.95 });
    this.lifters.push(this.ball);

    // 轨迹、落点小旗、射高虚线、速度箭头
    this.trails = COLORS.map((c) => this.dyn(c, 1.5, 1600));
    this.apex = this.dyn('#6b6f78', 1.0, 160);
    this.velX = this.dyn(BLUE, 1.7, 20);
    this.velY = this.dyn(RED, 1.7, 20);
    this.velR = this.dyn(undefined, 1.7, 20);
    this.rangeTag = makeTag(pop, 24, 9);
    // 落点小旗：每种颜色一面纸旗
    const tri = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(4.4, -1.4), new THREE.Vector2(0, -2.8)]));
    this.flags = COLORS.map((c) => {
      const m = new THREE.Mesh(tri, paper({ hatch: 0, color: '#' + new THREE.Color(c).lerp(new THREE.Color('#fbf7ee'), 0.55).getHexString() }));
      m.material.side = THREE.DoubleSide;
      m.visible = false;
      return pop.addSurface(m);
    });

    // 速度管：蓝 = 水平分速度，红 = 竖直分速度
    // 仪表架：木板托着两支速度管
    [this.tubeX, this.tubeY] = this.rack({ cx: 138, z: -55, y0: FY, legH: 10, r: 6, h: 14, items: [{ color: '#2f7bff', label: '水平 vₓ', capacity: 6.5 }, { color: '#ff4a2a', label: '竖直 vᵧ', capacity: 6.5 }] });

    }
    this.deg = 45;
    this.angle = 45 * DEG;
    this.recoil = 0;
    this.nextColor = 0;
    this.found = [false, false];
    this.bestCache = new Map();
    this.drawTime = 3.6;
  }

  get speed() { return SPEEDS[this.state.switches.speed ?? 2]; }
  get high() { return (this.state.switches.stand ?? 0) === 1; }
  get air() { return (this.state.switches.air ?? 0) === 1; }
  get dy() { return this.high ? STAND * S : 0; }
  pivot() { return V(PX, PY + this.dy, ZP); }
  toV(q) { return V(PX + q.x * S, PY + q.y * S, ZP); }

  /** 当前条件下射程随仰角变化的曲线（米） */
  rangeCurve() {
    const key = `${this.speed}|${this.high}|${this.air}`;
    if (key !== this.curveKey) {
      this.curveKey = key;
      this.curve = [];
      for (let d = 0; d <= 90; d += 3) this.curve.push({ d, r: d === 0 || d === 90 ? (d ? 0 : simulate(this.speed, 0, this.dy / S, this.air).range) : simulate(this.speed, d * DEG, this.dy / S, this.air).range });
    }
    return this.curve;
  }

  drawGraph() {
    const { gx, gy } = this, z = GR.z + 0.03;
    const pts = this.rangeCurve().map((q) => V(gx(q.d), gy(Math.min(q.r, GR.rMax)), z));
    const lines = dashes(pts, 0.9, 0.7).map((d) => ({ points: d, width: 0.5, taper: false }));
    // 当前仰角：竖线 + 曲线上的小圈
    const cur = this.rangeCurve(), d = this.deg, i = Math.min(cur.length - 2, Math.floor(d / 3)), f = (d - cur[i].d) / 3;
    const r = cur[i].r + (cur[i + 1].r - cur[i].r) * f;
    lines.push({ points: [V(gx(d), GR.y0, z), V(gx(d), gy(Math.min(r, GR.rMax)), z)], width: 0.55, taper: false });
    lines.push({ points: ringXY(V(gx(d), gy(Math.min(r, GR.rMax)), z), 0.7, 12), closed: true, width: 0.6, taper: false });
    this.graph.setLines(lines);
    this.plotSet?.setLines((this.plots ?? []).map((q) => ({ points: ringXY(V(gx(q.d), gy(Math.min(q.r, GR.rMax)), z + 0.02), 0.45, 10), closed: true, width: 1.3, taper: false })));
    this.graphTag.set('射程–仰角', `${this.speed} m/s${this.high ? ' 高台' : ''}${this.air ? ' 有阻力' : ''}`);
  }

  reset() {
    this.plots = [];
    this.plotSet?.setLines([]);
    this.throws = [];
    this.current = null;
    this.resting = false;
    for (const s of [this.velX, this.velY, this.velR]) s.setLines([]);
    this.placeMount();
    this.drawTrails();
    this.updateNumbers();
  }

  onSwitch(sid, i) { if (sid === 'ex') super.onSwitch(sid, i); else this.reset(); }

  setAngle(a) {
    const deg = Math.max(5, Math.min(85, Math.round(a / DEG)));
    if (deg === this.deg) return false;
    this.deg = deg;
    this.angle = deg * DEG;
    this.resting = false;
    this.placeMount();
    this.updateNumbers();
    return true;
  }

  placeMount() {
    const a = this.angle, u = V(Math.cos(a), Math.sin(a), 0);
    this.towerG.visible = this.high;
    this.mount.position.y = this.dy;
    this.tube.group.rotation.z = a - Math.PI / 2;
    this.tube.group.position.set(PX, PY, ZP).addScaledVector(u, -this.recoil * 1.6);
    this.nozzle.group.rotation.z = a - Math.PI / 2;
    // 瞄准线和角度弧
    const P = this.pivot().setZ(ZP - 4.1);
    const lines = dashes([P.clone().addScaledVector(u, 3), P.clone().addScaledVector(u, PROT_R + 4)], 1.3, 0.9).map((d) => ({ points: d, width: 0.7, taper: false }));
    lines.push({ points: ringXY(P, 6, 24, 0, a), width: 0.8, taper: false });
    this.aim.setLines(lines);
    this.angleTag.set('仰角 θ', `${this.deg}°`);
    this.drawGraph();
    if (!this.current && !this.resting) this.ball.mesh.position.copy(this.pivot());
  }

  updateNumbers(cur) {
    const v = this.speed, a = this.angle;
    if (this.ex === 1) {
      const R = simulate(v, a, 0, this.air).range;
      this.setNumbers([`θ = ${this.deg}°，v₀ = ${v} m/s`, '水柱就是一条轨迹：', '连续的抛体', `落水点 ≈ ${R.toFixed(2)} m`, this.air ? '有空气阻力，落点近了' : '']);
      return;
    }
    if (this.ex === 2) {
      const best = (this.plots ?? []).reduce((m, q) => (q.r > (m?.r ?? -1) ? q : m), null);
      this.setNumbers([`v₀ = ${v} m/s`, `θ = ${this.deg}°`, `已记 ${(this.plots ?? []).length} 个点`, best ? `最远：${best.d}°，${best.r.toFixed(2)} m` : '点卡片记下第一个点', '虚线：理论射程']);
      return;
    }
    const lines = [`θ = ${this.deg}°，v₀ = ${v} m/s`, `v₀ₓ = v₀cosθ = ${(v * Math.cos(a)).toFixed(2)} m/s`, `v₀ᵧ = v₀sinθ = ${(v * Math.sin(a)).toFixed(2)} m/s`];
    if (!this.high && !this.air) lines.push(`R = v₀²sin2θ/g = ${((v * v * Math.sin(2 * a)) / G).toFixed(2)} m`);
    else lines.push(`${this.high ? `抛出点高 ${STAND.toFixed(1)} m` : '地面抛出'}${this.air ? '，有空气阻力' : ''}`);
    const last = this.throws[this.throws.length - 1];
    if (cur) lines.push('', `此刻 t = ${cur.t.toFixed(2)} s`, `vₓ = ${cur.vx.toFixed(2)}，vᵧ = ${cur.vy.toFixed(2)} m/s`, cur.vy > 0.05 ? '正在上升' : cur.vy < -0.05 ? '正在下落' : '最高点：vᵧ = 0');
    else if (last) lines.push('', `${last.deg}°：射程 ${last.range.toFixed(2)} m`, `射高 ${(last.top - last.h).toFixed(2)} m，用时 ${last.time.toFixed(2)} s`);
    if (this.high) lines.push('', `高台最佳角：无阻力 ${this.found[0] ? '✓' : '？'}  有阻力 ${this.found[1] ? '✓' : '？'}`);
    this.setNumbers(lines);
  }

  fire() {
    if (this.current) this.land();
    const sim = simulate(this.speed, this.angle, this.dy / S, this.air);
    const ideal = this.air ? simulate(this.speed, this.angle, this.dy / S, false) : null;
    this.current = { sim, ideal, t: 0, color: this.nextColor, deg: this.deg, air: this.air };
    this.nextColor = (this.nextColor + 1) % COLORS.length;
    this.resting = false;
    this.recoil = 1;
    const tip = this.pivot(), u = V(Math.cos(this.angle), Math.sin(this.angle), 0);
    for (let i = 0; i < 16; i++) {
      const d = u.clone().multiplyScalar(30 + Math.random() * 40).add(V((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30));
      this.water.emit(tip.clone().addScaledVector(u, 2.6), d, Math.random() < 0.6 ? ORANGE : '#ffd27a', 0.12 + Math.random() * 0.12, 0, 0.6 + Math.random() * 0.5);
    }
    this.app.sound?.play('launch');
  }

  land() {
    const c = this.current;
    const th = { ...c, range: c.sim.range, top: c.sim.top, h: c.sim.h, time: c.sim.time };
    this.throws.push(th);
    if (this.throws.length > COLORS.length) this.throws.shift();
    this.current = null;
    this.resting = true;
    this.ball.mesh.position.copy(this.toV({ x: th.range, y: 0 }));
    for (const s of [this.velX, this.velY, this.velR]) s.setLines([]);
    this.app.sound?.play('thud');
    if (this.high && th.range >= this.bestRange(th.air) * 0.995) {
      const k = th.air ? 1 : 0;
      if (!this.found[k]) {
        this.found[k] = true;
        if (this.found[0] && this.found[1]) this.earnStamp();
        else this.app.toast?.(`${th.air ? '有' : '无'}阻力时的最佳角找到了：约 ${th.deg}°。${th.air ? '再关掉阻力试试。' : '再打开阻力试试。'}`);
      }
    }
    this.drawTrails();
    this.updateNumbers();
  }

  bestRange(air) {
    const key = `${this.speed}|${this.high}|${air}`;
    if (!this.bestCache.has(key)) {
      let best = 0;
      for (let d = 5; d <= 85; d += 0.5) best = Math.max(best, simulate(this.speed, d * DEG, this.dy / S, air).range);
      this.bestCache.set(key, best);
    }
    return this.bestCache.get(key);
  }

  drawTrails() {
    const sets = this.trails.map(() => []);
    const add = (th, upto) => {
      const pts = th.sim.pts.filter((q) => q.t <= upto).map((q) => this.toV(q));
      if (upto < th.sim.time) pts.push(this.toV(sample(th.sim, upto)));
      if (pts.length > 1) sets[th.color].push({ points: pts, width: 0.95, taper: false });
      if (th.ideal) for (const d of dashes(th.ideal.pts.map((q) => this.toV(q)), 1.5, 1.3)) sets[th.color].push({ points: d, width: 0.55, taper: false });
    };
    for (const th of this.throws) {
      add(th, Infinity);
      const fx = PX + th.range * S;
      const ft = FY + 9;
      sets[th.color].push({ points: [V(fx, FY, ZP), V(fx, ft, ZP)], width: 0.85, taper: false });
      sets[th.color].push({ points: [V(fx, ft, ZP + 0.05), V(fx + 4.4, ft - 1.4, ZP + 0.05), V(fx, ft - 2.8, ZP + 0.05)], width: 0.75, taper: false });
      this.flags[th.color].position.set(fx, ft, ZP);
    }
    this.flags.forEach((f, i) => { f.visible = this.throws.some((th) => th.color === i); });
    if (this.current) add(this.current, this.current.t);
    // 小图上的点：每次投掷一个实心小圈
    const dots = COLORS.map(() => []);
    for (const th of this.throws) {
      const c = V(this.gx(th.deg), this.gy(Math.min(th.range, GR.rMax)), GR.z + 0.05);
      dots[th.color].push({ points: ringXY(c, 0.55, 10), closed: true, width: 1.2, taper: false });
    }
    this.graphDots.forEach((s, i) => s.setLines(dots[i]));
    this.trails.forEach((s, i) => s.setLines(sets[i]));
    // 射高：最近一条（或飞过了最高点的）轨迹，虚线标出最高点
    const ap = [];
    const th = this.current ?? this.throws[this.throws.length - 1];
    if (th) {
      const top = apexOf(th.sim);
      if (!this.current || this.current.t >= top.t) {
        const A = this.toV(top);
        for (const d of dashes([A, V(A.x, FY, ZP)], 1.2, 1)) ap.push({ points: d, width: 0.5, taper: false });
        for (const d of dashes([V(PX, A.y, ZP), A], 1.2, 1)) ap.push({ points: d, width: 0.5, taper: false });
      }
    }
    this.apex.setLines(ap);
    const last = this.throws[this.throws.length - 1];
    this.rangeTag.mesh.visible = !!last;
    if (last) {
      this.rangeTag.mesh.position.set(PX + last.range * S + 4, FY + 6, ZP - 9);
      this.rangeTag.set(`${last.deg}° 射程`, `${last.range.toFixed(2)} m`);
    }
  }

  tick(dt) {
    const c = this.current;
    this.recoil = Math.max(0, this.recoil - dt * 4);
    if (c) {
      c.t = Math.min(c.sim.time, c.t + dt * SLOW);
      const q = sample(c.sim, c.t), o = this.toV(q);
      this.ball.mesh.position.copy(o);
      this.tubeX.setValue(Math.abs(q.vx));
      this.tubeY.setValue(Math.abs(q.vy));
      this.tubeY.label = q.vy >= 0 ? '竖直 vᵧ ↑' : '竖直 vᵧ ↓';
      this.velX.setLines(arrow(o, V(q.vx * ARW, 0, 0), { width: 1 }));
      this.velY.setLines(arrow(o, V(0, q.vy * ARW, 0), { width: 1 }));
      this.velR.setLines(arrow(o, V(q.vx * ARW, q.vy * ARW, 0), { width: 1 }));
      this.updateNumbers(q);
      this.drawTrails();
      if (c.t >= c.sim.time) this.land();
    } else {
      this.tubeX.setValue(this.speed * Math.cos(this.angle));
      this.tubeY.setValue(this.speed * Math.sin(this.angle));
      this.tubeY.label = '竖直 vᵧ ↑';
    }
    if (this.recoil > 0) this.placeMount();
    if (this.ex !== 1) return;
    // 喷泉：同样的仰角和速度，水流就是一条连续的轨迹
    const a = this.angle, u = V(Math.cos(a), Math.sin(a), 0), sp = this.speed * S;
    const tip = NOZ.clone().addScaledVector(u, NOZ_L);
    const k = this.air ? K_AIR / S : 0;
    this.emitAcc += dt * 420;
    for (; this.emitAcc >= 1; this.emitAcc--) {
      const v = u.clone().multiplyScalar(sp * (1 + (Math.random() - 0.5) * 0.02)).add(V((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 2));
      const p = tip.clone().addScaledVector(v, Math.random() * dt);
      if (Math.random() < 0.6) this.jet.emit(p, v, Math.random() < 0.7 ? '#3a9cff' : '#9fd6ff', 2.4, G * S, 0.6 + Math.random() * 0.4, k);
      else this.water.emit(p, v.multiplyScalar(1 + (Math.random() - 0.5) * 0.03), Math.random() < 0.5 ? '#5ab4ff' : '#9fd6ff', 2.4, G * S, 0.8 + Math.random() * 0.7, k);
    }
    // 落水处溅起的水花
    if (this.rippleX && Math.random() < dt * 40) {
      for (let i = 0; i < 2; i++) this.water.emit(V(this.rippleX + (Math.random() - 0.5) * 2, POOL_Y + 0.2, NOZ.z + (Math.random() - 0.5) * 2), V((Math.random() - 0.5) * 18, 12 + Math.random() * 22, (Math.random() - 0.5) * 18), '#a8dcff', 0.5, G * S, 0.5 + Math.random() * 0.4);
    }
    this.jet.update(dt, POOL_Y);
    this.water.update(dt, POOL_Y);
    // 水落下的地方一圈圈涟漪
    const key = `${this.deg}|${this.speed}|${this.air}`;
    if (key !== this.rippleKey) {
      this.rippleKey = key;
      this.rippleX = tip.x + simulate(this.speed, a, (tip.y - POOL_Y) / S, this.air).range * S;
      this.nozTag?.set('仰角 θ', `${this.deg}°`);
      if (this.dropTag) { this.dropTag.set('落水处', `${((this.rippleX - NOZ.x) / S).toFixed(2)} m`); this.dropTag.mesh.position.set(Math.min(132, this.rippleX + 4), POOL_Y + 7, -40.5); }
    }
    this.rippleT = (this.rippleT ?? 0) + dt;
    const rings = [];
    for (let i = 0; i < 3; i++) {
      const r = ((this.rippleT * 5 + i * 2.6) % 7.8) + 0.4;
      rings.push({ points: ringXZ(V(this.rippleX, POOL_Y + 0.05, NOZ.z), r, 32).map((p) => p.setZ(NOZ.z + (p.z - NOZ.z) * 0.75)), closed: true, width: 0.7 * (1 - r / 8.6), taper: false });
    }
    this.ripples.setLines(rings);
  }

  handles() {
    const aimFrom = (ray, z, back) => {
      const p = this.rayToPlane(ray, V(0, 0, z), V(0, 0, 1));
      if (!p) return false;
      const d = p.sub(this.pivot()).setZ(0);
      if (back) d.negate();
      return this.setAngle(Math.atan2(Math.max(d.y, 0), Math.max(d.x, 0.01)));
    };
    return [
      {
        object: this.nozzle.mesh, cursor: 'grab',
        onMove: (ray) => {
          const p = this.rayToPlane(ray, V(0, 0, NOZ.z), V(0, 0, 1));
          if (!p) return;
          const d = p.sub(NOZ);
          this.setAngle(Math.atan2(Math.max(d.y, 0), Math.max(d.x, 0.01)));
        },
      },
      {
        object: this.tube.mesh, cursor: 'grab',
        onDown: () => { this.moved = false; this.grab = null; },
        onMove: (ray) => {
          if (this.grab === null) {
            const p = this.rayToPlane(ray, V(0, 0, ZP), V(0, 0, 1));
            this.grab = p ? p.x < PX - 0.5 : true;  // 抓着炮尾就反过来
          }
          if (aimFrom(ray, ZP, this.grab)) this.moved = true;
        },
        onUp: () => { if (!this.moved) this.fire(); },
      },
      { object: this.protractor, cursor: 'crosshair', onMove: (ray) => aimFrom(ray, ZP - 4.2, false) },
      { object: this.ball.mesh, cursor: 'pointer', onUp: () => this.fire() },
      {
        // 射程图：沿横轴拖动选角度，点一下按当前角度记一个点
        object: this.graphCard, cursor: 'crosshair',
        onDown: () => { this.moved = false; },
        onMove: (ray) => {
          const p = this.rayToPlane(ray, V(0, 0, GR.z), V(0, 0, 1));
          if (p && this.setAngle(((p.x - GR.x0) / GR.w) * 90 * DEG)) this.moved = true;
        },
        onUp: () => {
          if (this.moved) return;
          const r = simulate(this.speed, this.angle, this.dy / S, this.air).range;
          this.plots = [...this.plots.filter((q) => q.d !== this.deg), { d: this.deg, r }].slice(-24);
          this.app.sound?.play('tick');
          this.drawGraph();
          this.updateNumbers();
        },
      },
    ];
  }

  shots() {
    const sw = (k, v) => { this.state.switches[k] = v; this.book.pages.invalidate(this.k, 'right'); };
    const shoot = (deg) => { this.setAngle(deg * DEG); this.fire(); };
    return [
      { cam: () => ({ pos: this.w(-5, 80, 85), look: this.w(40, 26, -30) }), act: () => { this.switchExhibit(0, true); sw('air', 0); sw('stand', 0); sw('speed', 2); this.reset(); shoot(30); } },
      { cam: () => ({ pos: this.w(70, 150, 175), look: this.w(80, 30, -32) }), act: () => shoot(60) },
      { cam: () => ({ pos: this.w(85, 160, 185), look: this.w(85, 26, -32) }), act: () => shoot(45) },
      { cam: () => ({ pos: this.w(95, 120, 145), look: this.w(90, 26, -34) }), act: () => { sw('air', 1); shoot(45); } },
      { cam: () => ({ pos: this.w(80, FY + 70, 40), look: this.w(90, FY + 14, NOZ.z) }), act: () => { sw('air', 0); this.switchExhibit(1, true); this.setAngle(45 * DEG); } },
    ];
  }
}
