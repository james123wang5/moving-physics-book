import * as THREE from 'three';
import { DioramaLesson } from './diorama.js';
import { box, InkSphere, InkLathe } from '../ink/shapes.js';
import { glowMaterial } from '../ink/glow.js';
import { V, RED, BLUE, dashes, ringXY, makeTag } from '../ink/kit.js';

// 第 3 课 · 实验：同时下落仪（弹簧发射管剖面）、频闪残影、两球等高的虚线；挑战：从频闪数据读出弹出速度。
// 两个装置：全景（1 m 高，频闪灯 + 方格板 + 挑战卡）和特写（矮一些的同一种发射器，放大看弹簧、活塞和夹子）。

const Y0 = 5;
const S = 62;                    // 每米多少毫米
const G = 9.8;

// 两套发射器的尺寸：发射高度 H（米）、A 球出口、B 球所在的竖直面、频闪间隔、慢放倍数、沙盘范围、仪表架（特写里不放，专看机构）
const RIGS = [
  { H: 1.0, launch: V(46, Y0 + 2 + 1.0 * S, -30), zb: -22, strobe: 0.1, slow: 0.22, sand: [36, 124, -44, -10], grid: [38, 124, -54, 0.1], rack: { cx: 150, z: -32 }, cap: 5 },
  { H: 0.32, launch: V(46, Y0 + 2 + 0.32 * S, -30), zb: -22, strobe: 0.05, slow: 0.14, sand: [36, 86, -42, -12], grid: [36, 86, -46, 0.05], rack: null, cap: 3 },
];

export class DropLesson extends DioramaLesson {
  exhibitDefs() {
    return [
      { name: '全景', rect: [5, 171, -62, -8], scale: 1.0 },
      { name: '特写', rect: [2, 90, -50, -8], scale: 1.8 },
    ];
  }

  build(ex) {
    const { pop, pen, ink, faint } = this;
    const paper = (o) => pop.paper(o);
    const cfg = RIGS[ex], L = cfg.launch, ZB = cfg.zb;
    const rig = { cfg };
    (this.rigs ??= [])[ex] = rig;
    const metal = paper({ hatchA: [0, 1, 0.2], hatchB: [1, 0.2, 0.3], spacing: 1.3, seed: 51, color: '#eceef0' });
    const wood = paper({ hatchA: [1, 0, 0.12], hatchB: [0.2, 0.3, 1], spacing: 1.5, seed: 52 });

    // 支架：底板、立柱、横臂
    box(pop, ink, V(L.x - 42, Y0, -46), V(L.x - 12, Y0 + 2, -14), { mat: wood, pen, width: 1 });
    box(pop, ink, V(L.x - 37, Y0 + 2, L.z - 3), V(L.x - 33, L.y + 6, L.z + 1), { mat: metal, pen, width: 0.95 });
    box(pop, ink, V(L.x - 37, L.y + 6, L.z - 3), V(L.x - 16, L.y + 9, L.z + 1), { mat: metal, pen, width: 0.95 });
    // 发射管（剖面：只画玻璃的线，里面的弹簧和活塞看得见）
    const tube = new InkLathe(pop, [[3.4, 0], [3.4, 18]], { mat: paper({ hatch: 0 }), pen, rims: [0, 1], width: 1 });
    tube.mesh.visible = false;
    tube.group.rotation.z = -Math.PI / 2;
    tube.group.position.set(L.x - 18, L.y, L.z);
    this.deferred.push(() => tube.build());
    this.lifters.push(tube);
    box(pop, ink, V(L.x - 20, L.y - 4, L.z - 4), V(L.x - 17.5, L.y + 4, L.z + 4), { mat: metal, pen, width: 0.9 });
    box(pop, ink, V(L.x - 19, L.y + 3.4, L.z - 1.2), V(L.x - 16, L.y + 9, L.z + 1.2), { mat: metal, pen, width: 0.8 });
    rig.springSet = this.dyn(undefined, 1.3, 400);
    rig.piston = new THREE.Mesh(new THREE.BoxGeometry(2.2, 5.2, 5.2), paper({ hatchA: [1, 0, 0], hatchB: [0, 1, 0], spacing: 0.9, seed: 53, color: '#e3e6ea' }));
    pop.addSurface(rig.piston);
    const cut = makeTag(pop, 26, 8);
    cut.mesh.position.set(L.x - 10, L.y + 23, L.z - 2);
    cut.set('剖面', '弹簧推活塞');
    // 扳机（可拖）：往后拉压缩弹簧，松手发射
    rig.lever = new THREE.Mesh(new THREE.BoxGeometry(2.2, 14, 2.2).translate(0, 7, 0), paper({ hatchA: [1, 0, 0.12], hatchB: [0.2, 0.3, 1], spacing: 1.1, seed: 54, color: '#f0d8c8' }));
    rig.lever.position.set(L.x - 8, L.y + 3.4, L.z - 6);
    pop.addSurface(rig.lever);
    rig.leverSet = this.dyn(undefined, 1.5, 40);
    // B 球的夹子
    box(pop, ink, V(L.x - 1.5, L.y + 4, ZB - 2), V(L.x + 1.5, L.y + 9, ZB + 2), { mat: metal, pen, width: 0.8 });
    ink.add([V(L.x - 6, L.y + 7.5, L.z), V(L.x, L.y + 7.5, ZB)], { sched: pen.next(10), width: 0.8 });
    // 沙盘（落地区）
    const [sx0, sx1, sz0, sz1] = cfg.sand;
    const sand = paper({ hatchA: [0.62, 0.62, 0.48], hatchB: [-0.5, 0.45, 0.74], spacing: 2.4, seed: 55, color: '#f1e7d2', hatch: 0.4 });
    box(pop, ink, V(sx0, Y0, sz0), V(sx1, Y0 + 2, sz1), { mat: sand, pen, width: 1 });
    const nDots = Math.round(((sx1 - sx0) * (sz1 - sz0)) / 40);
    for (let i = 0; i < nDots; i++) {
      const x = sx0 + 4 + ((i * 37) % (sx1 - sx0 - 8)), z = sz0 + 2 + ((i * 53) % (sz1 - sz0 - 4));
      faint.add([V(x, Y0 + 2.02, z), V(x + 0.4, Y0 + 2.02, z + 0.3)], { sched: pen.next(1), width: 0.6, taper: false });
    }
    // 方格背景板（全景每格 0.1 m，特写每格 0.05 m）
    const [gx0, gx1, gz, step] = cfg.grid, gf = gz + 1.5;
    const card = paper({ hatchA: [1, 0.05, 0.25], hatchB: [0.3, 1, 0.2], spacing: 2.2, seed: 56, shade: 0.06, hatch: 0.25 });
    box(pop, ink, V(gx0, Y0 + 2, gz), V(gx1, L.y + 10, gf), { mat: card, pen, width: 0.9 });
    for (let y = Y0 + 2 + step * S; y < L.y + 10; y += step * S) faint.add([V(gx0, y, gf), V(gx1, y, gf)], { sched: pen.next(40), width: 0.4, taper: false });
    for (let x = L.x; x < gx1; x += step * S) faint.add([V(x, Y0 + 2, gf), V(x, L.y + 10, gf)], { sched: pen.next(30), width: 0.4, taper: false });
    if (ex === 0) {
      // 频闪灯：灯头、灯架、发光的灯泡
      const lampMat = paper({ hatchA: [0, 1, 0.3], hatchB: [1, 0.3, 0], spacing: 1.2, seed: 57 });
      box(pop, ink, V(130, Y0, -60), V(140, Y0 + 2, -50), { mat: lampMat, pen, width: 0.9 });
      box(pop, ink, V(134, Y0 + 2, -56), V(136, Y0 + 58, -54), { mat: lampMat, pen, width: 0.8 });
      const head = new InkLathe(pop, [[2.6, 0], [7.5, 9]], { mat: lampMat, pen, rims: [0, 1], width: 1 });
      head.group.rotation.z = Math.PI / 2 + 0.35;
      head.group.position.set(135, Y0 + 60, -55);
      this.deferred.push(() => head.build());
      this.lifters.push(head);
      this.bulbMat = glowMaterial(pop, { color: '#fff1c2', glow: 2, radius: 3 });
      this.bulb = new THREE.Mesh(new THREE.SphereGeometry(3.4, 20, 14), this.bulbMat);
      this.bulb.position.set(132, Y0 + 61, -55);
      this.bulb.layers.enable(1);
      pop.group.add(this.bulb);
      this.flash = 0;
      this.glows.push({ lightInfo: (o) => { this.bulb.updateWorldMatrix(true, false); return { pos: o.setFromMatrixPosition(this.bulb.matrixWorld), color: new THREE.Color('#fff1c2'), strength: this.flash * 0.9 }; } });
      // 挑战：三张数字卡，点出 A 球的弹出速度
      this.cards = [0, 1, 2].map((i) => {
        const t = makeTag(pop, 16, 8);
        t.mesh.position.set(70 + i * 18, Y0 + 8, -8);
        return t;
      });
    }
    // 两个球
    const ballMat = (seed, color) => paper({ hatchA: [0.9, 0.12, -0.42], hatchB: [0.2, 0.9, 0.4], spacing: 1.2, seed, color });
    rig.ballA = new InkSphere(pop, { r: 2.6, centre: L.clone(), mat: ballMat(58, '#e9eef6'), sched: pen.next(16) });
    rig.ballB = new InkSphere(pop, { r: 2.6, centre: V(L.x, L.y, ZB), mat: ballMat(59, '#f6e9e4'), sched: pen.next(16) });
    this.lifters.push(rig.ballA, rig.ballB);
    rig.ghostA = this.dyn(BLUE, 1.2, 600);
    rig.ghostB = this.dyn(RED, 1.2, 600);
    rig.levels = this.dyn(undefined, 1.0, 400);
    // 仪表架：两球的竖直速度——每一刻都一样
    if (cfg.rack) [rig.cupA, rig.cupB] = this.rack({ cx: cfg.rack.cx, z: cfg.rack.z, y0: Y0, legH: 8, r: 5.5, h: 13, items: [{ color: '#2f7bff', label: 'A 竖直 vᵧ', capacity: cfg.cap }, { color: '#ff4a2a', label: 'B 竖直 vᵧ', capacity: cfg.cap }] });
    this.drawTime = 3.4;
  }

  /** 当前摆出来的那套发射器 */
  get rig() { return this.rigs[this.ex]; }

  reset() {
    this.c = 0;
    this.run = null;
    this.choices = null;
    for (const r of this.rigs) this.placeRig(r, r === this.rig);
  }

  placeAll() { this.placeRig(this.rig, true); }

  placeRig(rig, current) {
    const { launch: L, zb: ZB, H, strobe } = rig.cfg;
    const run = current ? this.run : null;
    const c = current ? this.c : 0;
    const tA = run ? Math.min(run.t, run.tLand) : 0;
    const vA = run ? run.v : 0;
    const yA = L.y - 0.5 * G * tA * tA * S;
    rig.ballA.mesh.position.set(run ? L.x + vA * tA * S : L.x - c * 6, Math.max(Y0 + 2 + 2.6, yA), L.z);
    rig.ballB.mesh.position.set(L.x, Math.max(Y0 + 2 + 2.6, yA), ZB);
    // 读数：飞行中两球的竖直速度都是 gt；落地后归零
    const vy = run && !run.landed ? G * tA : 0;
    rig.cupA?.setValue(vy);
    rig.cupB?.setValue(vy);
    // 弹簧：压缩量 c 决定长度；发射后弹回
    const ext = run ? Math.min(1, run.t / 0.03) : 0;
    const comp = run ? c * (1 - ext) : c;
    const x0 = L.x - 17.5, x1 = L.x - 3.2 - comp * 7;
    const helix = [];
    const turns = 9;
    for (let i = 0; i <= turns * 16; i++) {
      const t = i / (turns * 16), a = t * turns * Math.PI * 2;
      helix.push(V(x0 + (x1 - x0) * t, L.y + 2.3 * Math.sin(a), L.z + 2.3 * Math.cos(a)));
    }
    rig.springSet.setLines([{ points: helix, width: 0.7, taper: false }]);
    rig.piston.position.set(x1 + 1.1, L.y, L.z);
    // 扳机
    const ang = 0.6 * comp;
    rig.lever.rotation.z = ang;
    const top = V(rig.lever.position.x - 14 * Math.sin(ang), rig.lever.position.y + 14 * Math.cos(ang), rig.lever.position.z);
    rig.leverSet.setLines([{ points: [rig.lever.position.clone(), top], width: 1.1, taper: false }]);
    // 频闪残影与等高线
    const ga = [], gb = [], lv = [];
    for (const g of run?.ghosts ?? []) {
      ga.push({ points: ringXY(V(g.xa, g.y, L.z), 2.6, 28), width: 0.8, closed: true });
      gb.push({ points: ringXY(V(L.x, g.y, ZB), 2.6, 28), width: 0.8, closed: true });
      for (const d of dashes([V(L.x, g.y, ZB), V(g.xa, g.y, L.z)], 1.4, 1.1)) lv.push({ points: d, width: 0.55, taper: false });
    }
    rig.ghostA.setLines(ga);
    rig.ghostB.setLines(gb);
    rig.levels.setLines(lv);
    if (!current) return;
    // 数字卡（只在全景里）
    for (const [i, t] of (this.cards ?? []).entries()) {
      t.mesh.visible = !!this.choices;
      if (this.choices) t.set(i === this.choices.pick ? '你选了' : '弹出速度？', `${this.choices.values[i].toFixed(1)} m/s`);
    }
    // 手写数据
    const lines = [`h = ${H.toFixed(2)} m`, `闪光间隔 T = ${strobe} s`];
    if (run) {
      for (const [i, g] of run.ghosts.slice(0, 5).entries()) {
        const dx = (g.xa - L.x) / S, dy = (L.y - g.y) / S;
        lines.push(`${i}：x = ${dx.toFixed(2)}, y = ${dy.toFixed(2)}`);
      }
      if (run.ghosts.length >= 3) lines.push('Δx 每段相等', `Δy 每段多 gT² ≈ ${(G * strobe * strobe).toFixed(3)} m`);
      if (run.landed) lines.push('两球同时落地');
    }
    this.setNumbers(lines);
  }

  fire() {
    if (this.run && !this.run.landed) return;
    const c = Math.max(0.15, this.c);
    const v = Math.round((0.8 + 1.8 * c) * 10) / 10;
    const { H } = this.rig.cfg;
    this.run = { t: 0, v, tLand: Math.sqrt((2 * (H - 0.04)) / G), ghosts: [], nextFlash: 0, landed: false };
    this.app.sound?.play('launch');
  }

  tick(dt) {
    const run = this.run;
    const { launch: L, strobe, slow } = this.rig.cfg;
    this.flash = Math.max(0, this.flash - dt * 6);
    this.bulbMat.uniforms.uGlow.value = 1.2 + 7 * this.flash;
    this.bulbMat.uniforms.uTime.value = this.time;
    this.bulbMat.uniforms.uAlpha.value = this.pop.u.uSurfAlpha.value;
    if (run && !run.landed) {
      run.t += dt * slow;
      while (run.t >= run.nextFlash && run.nextFlash <= run.tLand + 1e-6) {
        const t = run.nextFlash;
        run.ghosts.push({ xa: L.x + run.v * t * S, y: L.y - 0.5 * G * t * t * S });
        run.nextFlash += strobe;
        if (this.ex === 0) this.flash = 1;
        this.app.sound?.play('tick');
      }
      if (run.t >= run.tLand) {
        run.landed = true;
        // 全景里出三个选项，其中一个是正确的弹出速度
        if (this.ex === 0) {
          const opts = [run.v, Math.round((run.v * 0.6) * 10) / 10, Math.round((run.v * 1.5) * 10) / 10];
          const order = [0, 1, 2].sort(() => Math.random() - 0.5);
          this.choices = { values: order.map((i) => opts[i]), answer: order.indexOf(0), pick: -1 };
        }
        this.app.sound?.play('thud');
      }
    }
    this.placeAll();
  }

  handles() {
    const out = this.rigs.map((rig) => ({
      object: rig.lever, cursor: 'grab',
      onMove: (ray) => {
        const p = this.rayToPlane(ray, V(0, 0, rig.cfg.launch.z - 6), V(0, 0, 1));
        if (!p) return;
        if (this.run?.landed) this.reset();
        this.c = Math.max(0, Math.min(1, (rig.lever.position.x - p.x) / 12));
      },
      onUp: () => { if (this.c > 0.05) this.fire(); },
    }));
    this.cards.forEach((t, i) => out.push({
      object: t.mesh, cursor: 'pointer',
      onUp: () => {
        if (!this.choices) return;
        this.choices.pick = i;
        if (i === this.choices.answer) this.earnStamp();
        else this.app.toast?.('再看看频闪：每 0.1 s 水平走了多远？');
      },
    }));
    return out;
  }

  shots() {
    const L0 = RIGS[0].launch, L1 = RIGS[1].launch;
    return [
      { cam: () => this.near(L1.x - 4, L1.y - 4, -26, V(-30, 110, 190)), act: () => { this.switchExhibit(1, true); this.reset(); this.c = 0.55; this.placeAll(); } },
      { cam: () => this.near(L1.x + 14, L1.y - 10, -26, V(-20, 120, 210)), act: () => this.fire() },
      { cam: () => this.near(L0.x + 25, Y0 + 30, -28, V(10, 150, 260)), act: () => { this.switchExhibit(0, true); this.reset(); this.c = 0.55; this.placeAll(); setTimeout(() => this.fire(), 300); } },
      { cam: () => this.near(L0.x + 30, Y0 + 6, -26, V(20, 120, 220)) },
      { cam: null },
    ];
  }
}
