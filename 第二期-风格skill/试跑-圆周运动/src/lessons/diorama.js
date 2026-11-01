import * as THREE from 'three';
import { PopFigure, pageFrame } from '../ink/pop.js';
import { StrokeSet, Pen } from '../ink/strokes.js';
import { box } from '../ink/shapes.js';
import { LessonRuntime } from './runtime.js';
import { V, makeTag } from '../ink/kit.js';
import { MeterTube } from '../ink/glow.js';
import { PARTS } from './parts.js';

// “沙盘课”的公共部分：右页上的立体插图（底座板 + 若干装置）、印刷版、画出来/折回、
// 每帧更新实时轮廓的物体、发光体、拖动用的平面求交。具体装置由子类在 build() 里搭。

/** 记下“推进时处在哪个装置”的数组：push 时顺便登记所属装置 */
function tagged(owner, arr = []) {
  const push = arr.push.bind(arr);
  arr.push = (...xs) => { for (const x of xs) owner.secOf.set(x, owner.sec); return push(...xs); };
  return arr;
}

export class DioramaLesson extends LessonRuntime {
  constructor(app, k, lesson, { u0 = 14, foldV = 208, printRect = { x0: -12, x1: 178, y0: -4, y1: 130 }, Y0 = 5 } = {}) {
    super(app, k, lesson);
    this.L = { u0, foldV, Y0 };
    this.sec = 0;               // 当前正在搭 / 正在用的装置序号
    this.ex = 0;                // 当前摆出来的装置
    this.secOf = new Map();
    this.lifters = tagged(this);   // update(camera, lift)
    this.tickers = tagged(this);   // update(dt, camera, time)
    this.glows = tagged(this);     // lightInfo()
    this.time = 0;
    this.baseFrame = pageFrame(app.book, k, u0, foldV);
    this.pop = new PopFigure(app.stage.renderer, { frame: this.baseFrame, printRect, pxPerMm: 6 });
    const pop = this.pop;
    this.defs = this.exhibitDefs();
    this.exGroups = this.defs.map(() => { const g = new THREE.Group(); THREE.Group.prototype.add.call(pop.group, g); return g; });
    // 装置里新加的东西都归到当前装置的组里，换装置时整组显示 / 隐藏
    const rawAdd = THREE.Group.prototype.add;
    pop.group.add = (...xs) => { const g = this.exGroups[this.sec]; for (const x of xs) (this.exGroups.includes(x) ? rawAdd.call(pop.group, x) : g.add(x)); return pop.group; };
    this.exs = this.defs.map(() => ({ pen: new Pen() }));
    const D = [];
    this.deferred = { push: (fn) => D.push([fn, this.sec]) };
    for (const [i, d] of this.defs.entries()) {
      this.sec = i;
      const e = this.exs[i];
      e.ink = new StrokeSet(pop.ink({ widthPx: 1.55 }));
      e.faint = new StrokeSet(pop.ink({ widthPx: 1.0 }));
      e.boardMat = pop.paper({ hatchA: [0.62, 0.62, 0.48], hatchB: [-0.5, 0.45, 0.74], spacing: 1.9, seed: 2 + i, hatch: 0.42 });
      const [x0, x1, z0, z1] = d.rect;
      box(pop, e.ink, V(x0 - 7, 0, z0 - 7), V(x1 + 7, Y0, z1 + 5), { mat: e.boardMat, pen: e.pen, width: 1.05 });
      this.use(i);
      this.build(i);
    }
    this.drawTime ??= 3.6;
    for (const [i, e] of this.exs.entries()) {
      this.sec = i;
      e.pen.fit(Math.min(e.pen.end, this.drawTime));
      e.ink.build(); pop.addLines(e.ink);
      e.faint.build(); pop.addLines(e.faint);
    }
    for (const [fn, i] of D) { this.sec = i; this.use(i); fn(); }
    this.deferred = D.map(([fn]) => fn);
    this.sec = 0;
    this.use(0);
    app.stage.scene.add(pop.group);
    this.applyExhibit(0);
    this.pop.set('print');
    this.reset?.();
  }

  /** 子类重写：每个装置的范围 [{ name, rect:[x0,x1,z0,z1], scale }]（插图坐标，毫米） */
  exhibitDefs() { return [{ name: '', rect: [-8, 170, -66, -2], scale: 1 }]; }

  /** 搭第 i 个装置时用它自己的笔和墨线组 */
  use(i) {
    const e = this.exs[i];
    this.pen = e.pen; this.ink = e.ink; this.faint = e.faint; this.boardMat = e.boardMat;
    return e;
  }

  /** 把第 i 个装置摆到页面上：放大、居中、其余的藏起来，并换印刷相机的取景 */
  applyExhibit(i) {
    this.ex = i; this.sec = i;
    const d = this.defs[i], S = d.scale ?? 1;
    const [x0, x1, z0, z1] = d.rect;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const px = d.at?.[0] ?? 82;
    const pz = d.at?.[1] ?? -4 - S * (z1 + 5 - cz);
    const M = this.baseFrame.clone().multiply(new THREE.Matrix4().makeTranslation(px - S * cx, 0, pz - S * cz)).multiply(new THREE.Matrix4().makeScale(S, S, S));
    this.pop.setFrame(M);
    const r = this.pop.printRect;
    this.pop.print.setRect({ x0: cx + (r.x0 - px) / S, x1: cx + (r.x1 - px) / S, y0: r.y0 / S, y1: r.y1 / S }, 6 * S);
    for (const m of this.pop.inkMats) m.uniforms.uWidthMm.value = 0.34 / S;
    this.exGroups.forEach((g, j) => { g.visible = j === i; });
    this.use(i);
  }

  /** 这个物体现在看得见吗（所在装置没被藏起来） */
  shown(o) { for (; o; o = o.parent) if (!o.visible) return false; return true; }
  /** 登记过的东西（升降器、发光体……）属于当前装置吗 */
  mine(o) { return (this.secOf.get(o) ?? this.ex) === this.ex; }

  /** 换装置：钢笔图折回纸面，换成另一个装置，再重新画出来。instant 用于自动演示：直接换好 */
  async switchExhibit(i, instant = false) {
    if (i === this.ex || this.switching || i < 0 || i >= this.defs.length) return;
    this.switching = true;
    const pageU = this.book.pages.material(this.k, 'right').userData.uniforms;
    if (!instant) await this.pop.undraw();
    this.applyExhibit(i);
    for (const o of this.lifters) if (this.mine(o)) o.update(this.app.stage.camera, 0);
    pageU.uPrint.value = this.pop.renderPrint(this.app.stage.scene);
    pageU.uPrintAlpha.value = 1;
    this.state.switches.ex = i;
    this.book.pages.invalidate(this.k, 'right');
    this.reset?.();
    this.switching = false;
    if (instant) { this.pop.set('live'); return; }
    if (this.book.openSpread === this.k) { this.pop.draw(); this.app.sound?.loop('pen', this.pop.drawEnd); }
  }

  onSwitch(sid, i) { if (sid === 'ex') this.switchExhibit(i); }

  /** 子类重写：搭装置 */
  build() {}

  /** 动态线组（每帧改写），颜色可选 */
  dyn(color, widthPx = 1.6, capacity = 200) {
    const s = new StrokeSet(this.pop.ink({ widthPx, color }), { capacity });
    this.pop.addLines(s);
    return s;
  }

  /** 静态线组（独立颜色），时间表缩放后再生成 */
  stat(color, widthPx = 1.5, parent) {
    const s = new StrokeSet(this.pop.ink({ widthPx, color }));
    this.deferred.push(() => { s.build(); this.pop.addLines(s, parent); });
    return s;
  }

  /** 射线与插图坐标里的平面求交：平面由点和法向给出（插图坐标） */
  /**
   * 仪表架（仿原作的能量瓶架）：两条腿托着一块搁板，宽口玻璃杯排在搁板上，读数纸签挂在搁板前沿，
   * 后面两根立柱和横梁。items：[{ color, label, unit, capacity, digits（读数保留几位小数，默认 1） }]，返回 MeterTube 数组（已登记画线、每帧更新和溢光）。
   */
  rack({ cx, z, y0 = this.L.Y0, legH = 12, r = 6.5, h = 15, items }) {
    const { pop, pen, ink } = this;
    const n = items.length, sp = Math.max(2 * r + 5, 19.5), W = n * sp + 3, D = 2 * r + 5;
    const x0 = cx - W / 2, x1 = cx + W / 2, top = y0 + legH, th = 1.8;
    const wood = pop.paper({ hatchA: [1, 0, 0.12], hatchB: [0.2, 0.3, 1], spacing: 1.2, seed: 93, color: '#f1e3cb' });
    const post = pop.paper({ hatchA: [0, 1, 0.2], hatchB: [1, 0.2, 0.3], spacing: 1.1, seed: 94, color: '#e9ebee' });
    box(pop, ink, V(x0, top, z - D / 2), V(x1, top + th, z + D / 2), { mat: wood, pen, width: 0.95 });
    for (const x of [x0 + 0.8, x1 - 0.8]) {
      box(pop, ink, V(x - 0.7, y0, z + D / 2 - 2), V(x + 0.7, top, z + D / 2 - 0.6), { mat: post, pen, width: 0.75 });
      box(pop, ink, V(x - 0.7, y0, z - D / 2 + 0.6), V(x + 0.7, top + th + h + 4, z - D / 2 + 2), { mat: post, pen, width: 0.75 });
    }
    ink.add([V(x0 + 0.8, top + th + h + 4, z - D / 2 + 1.3), V(x1 - 0.8, top + th + h + 4, z - D / 2 + 1.3)], { sched: pen.next(W), width: 0.85 });
    ink.add([V(x0 + 0.8, top + th + h * 0.5, z - D / 2 + 1.3), V(x1 - 0.8, top + th + h * 0.5, z - D / 2 + 1.3)], { sched: pen.next(W), width: 0.5, taper: false });
    return items.map((it, i) => {
      const t = new MeterTube(pop, { r, h, color: it.color, position: V(x0 + 1.5 + sp * (i + 0.5), top + th, z), pen, label: it.label, unit: it.unit, capacity: it.capacity, digits: it.digits, makeTag, tagAt: [0, -th - 4.4, D / 2 + 0.15] });
      this.deferred.push(() => t.buildLines());
      this.tickers.push(t);
      this.glows.push(t);
      return t;
    });
  }

  rayToPlane(ray, point, normal) {
    const inv = this.pop.u.uSceneInv.value;
    const o = ray.origin.clone().applyMatrix4(inv), d = ray.direction.clone().transformDirection(inv);
    const den = d.dot(normal);
    if (Math.abs(den) < 1e-6) return null;
    const t = point.clone().sub(o).dot(normal) / den;
    return t > 0 ? o.addScaledVector(d, t) : null;
  }

  /** 插图坐标 → 世界（演示镜头用） */
  w(x, y, z) { return V(x, y, z).applyMatrix4(this.pop.u.uScene.value); }
  /** 演示镜头：盯住插图坐标里的一点，相机放在离它 off（世界毫米）的地方——不随装置放大倍数变远变近 */
  near(x, y, z, off) { const look = this.w(x, y, z); return { pos: look.clone().add(off), look }; }

  glowSources() { return this.pop.state === 'print' ? [] : this.glows.filter((g) => this.mine(g)); }

  enter() {
    const pr = this.pop.printRect, L = this.L;
    const pageU = this.book.pages.material(this.k, 'right').userData.uniforms;
    pageU.uPrintRect.value.set(L.u0 + pr.x0, L.foldV - pr.y1, pr.x1 - pr.x0, pr.y1 - pr.y0);
    if (!this.printed) {
      for (const o of this.lifters) if (this.mine(o)) o.update(this.app.stage.camera, 0);
      pageU.uPrint.value = this.pop.renderPrint(this.app.stage.scene);
      pageU.uPrintAlpha.value = 1;
      this.printed = true;
    }
    this.reset?.();
  }

  draw() { if (this.pop.state === 'print') { this.pop.draw(); this.app.sound?.loop('pen', this.pop.drawEnd); } }

  leave() { super.leave(); return this.pop.undraw(); }

  update(dt, active) {
    super.update(dt, active);
    const cam = this.app.stage.camera;
    const r = this.app.stage.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.pop.setResolution(r.x, r.y);
    this.pop.update(dt, this.app.stage.scene);
    const lift = this.pop.u.uLiftAll.value;
    for (const o of this.lifters) if (this.mine(o)) o.update(cam, lift);
    this.time += dt;
    for (const o of this.tickers) if (this.mine(o)) o.update(dt, cam, this.time);
    this.book.pages.material(this.k, 'right').userData.uniforms.uPrintAlpha.value = this.pop.printAlpha;
    this.pop.group.visible = this.book.openSpread === this.k && this.pop.state !== 'print';
    if (active && this.pop.state === 'live') this.tick?.(dt);
  }
}

// 通用零件（棱柱、管子、地形、分子、纸卡片、引线标注）挂成方法：this.prism(...) 等，见 parts.js
Object.assign(DioramaLesson.prototype, PARTS);
