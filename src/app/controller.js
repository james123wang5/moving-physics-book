import * as THREE from 'three';
import { SPREADS, N_SPREADS, pageLayout, pageState } from '../content/book.js';
import { LessonRuntime } from '../lessons/runtime.js';
import { ProjectileLesson } from '../lessons/l4.js';
import { CurveLesson } from '../lessons/l1.js';
import { RiverLesson } from '../lessons/l2.js';
import { DropLesson } from '../lessons/l3.js';
import { ThrowLesson } from '../lessons/l5.js';
import { SpillLights } from '../ink/glow.js';

// 总控：翻页（翻走前把插图折回纸面，翻到后再画出来）、书页与插图的点击和拖动、自动演示。

const SHOT = 2; // 每个演示镜头 2 秒

export class Controller {
  constructor(app) {
    this.app = app;
    const { book } = app;
    this.runtimes = new Map();
    SPREADS.forEach((sp, k) => {
      if (sp && sp.kind !== 'lesson') { this.runtimes.set(k, new MatterRuntime(app, k, sp)); return; }
      if (sp?.kind !== 'lesson') return;
      const R = { 1: CurveLesson, 2: RiverLesson, 3: DropLesson, 4: ProjectileLesson, 5: ThrowLesson }[sp.lesson.n] ?? LessonRuntime;
      this.runtimes.set(k, new R(app, k, sp.lesson));
    });
    this.current = null;
    this.watch = null;
    this.watched = new Set();
    this.drag = null;
    this.spill = new SpillLights(app.stage.scene);
    this.bind();
    book.onChange(() => this.arrived());
  }

  runtime(k = this.app.book.openSpread) { return this.runtimes.get(k) ?? null; }

  /** 翻到第 k 个跨页 */
  goTo(k) {
    const { book } = this.app;
    k = Math.max(0, Math.min(N_SPREADS, k));
    this.stopWatch();
    const leaving = this.current;
    this.current = null;
    return book.goTo(k, { beforeTurn: async () => { if (leaving) await leaving.leave(); this.app.sound?.play('page'); } });
  }

  next() { const b = this.app.book; this.goTo((b.target ?? Math.round(b.position)) + 1); }
  prev() { const b = this.app.book; this.goTo((b.target ?? Math.round(b.position)) - 1); }

  arrived() {
    const k = this.app.book.openSpread;
    if (k == null || this.app.book.target !== null) return;
    const rt = this.runtime(k);
    if (!rt || this.current === rt) return;
    this.current = rt;
    rt.enter?.();
    this.app.ui?.onSpread(k);
    setTimeout(() => {
      if (this.current !== rt) return;
      if (this.app.still) { rt.pop?.set('live'); this.fastForward(rt); } else rt.draw?.();
      const wait = (rt.pop?.drawEnd ?? 0) + 0.6;
      if (rt.shots && !this.watched.has(k) && !this.app.still) setTimeout(() => { if (this.current === rt) this.startWatch(rt); }, wait * 1000);
    }, 250);
    this.app.ui?.onSpread(k);
  }

  // ---------- 自动演示 ----------
  startWatch(rt) {
    this.watched.add(rt.k);
    const shots = rt.shots();
    this.watch = { rt, shots, t: 0, i: -1, paused: false, captions: rt.lesson.demo ?? [] };
    this.app.ui?.watching(true);
  }

  stopWatch() {
    if (!this.watch) return;
    this.watch = null;
    this.app.camOverride = null;
    this.app.ui?.caption(null);
    this.app.ui?.watching(false);
  }

  /** 静止模式：不播放画线和演示，直接把演示前几个镜头的结果算出来，装置停在“做完了”的样子 */
  fastForward(rt) {
    if (!rt.shots) return;
    for (const s of rt.shots().slice(0, -1)) {
      s.act?.();
      for (let i = 0; i < 150; i++) rt.update(1 / 60, true);
    }
  }

  togglePause() { if (this.watch) { this.watch.paused = !this.watch.paused; this.app.ui?.caption(this.watch.captions[this.watch.i], this.watch.i, this.watch.shots.length, this.watch.paused); } }

  replay() { const rt = this.runtime(); if (rt?.shots) { this.stopWatch(); this.startWatch(rt); } }

  updateWatch(dt) {
    const w = this.watch;
    if (!w) return;
    if (!w.paused) w.t += dt;
    const i = Math.min(w.shots.length - 1, Math.floor(w.t / SHOT));
    if (i !== w.i) {
      w.i = i;
      const s = w.shots[i];
      s.act?.();
      const cam = typeof s.cam === 'function' ? s.cam() : s.cam;
      this.app.camOverride = cam ? { pos: cam.pos, look: cam.look, fov: cam.fov ?? 30 } : null;
      this.app.ui?.caption(w.captions[i] ?? '', i, w.shots.length, w.paused);
    }
    if (w.t > SHOT * w.shots.length + 0.4) this.stopWatch();
  }

  // ---------- 指针 ----------
  pageHit(ev) {
    const { book, stage } = this.app;
    const meshes = [book.right.mesh, book.left.mesh];
    const hits = stage.pick(ev, meshes);
    if (!hits.length) return null;
    const p = book.worldToPage(hits[0].point);
    if (!p) return null;
    const lay = pageLayout.get(`${p.k}:${p.side}`);
    const hit = lay?.hits?.find((h) => p.u >= h.u0 && p.u <= h.u1 && p.v >= h.v0 && p.v <= h.v1);
    return { ...p, hit, dist: hits[0].distance };
  }

  handleHit(ev) {
    const rt = this.runtime();
    if (!rt || this.app.book.turning) return null;
    const list = rt.pop?.state === 'live' ? (rt.handles?.() ?? []).filter((h) => !rt.shown || rt.shown(h.object)) : [];
    const objs = list.map((h) => h.object);
    if (rt.flap?.group.visible) objs.push(rt.flap.mesh);
    const hits = this.app.stage.pick(ev, objs);
    for (const h of hits) {
      let o = h.object;
      while (o) {
        if (rt.flap && o === rt.flap.mesh) return { flap: true, dist: h.distance };
        const handle = list.find((x) => x.object === o);
        if (handle) return { handle, dist: h.distance };
        o = o.parent;
      }
    }
    return null;
  }

  bind() {
    const el = this.app.stage.renderer.domElement;
    const ray = (ev) => { this.app.stage.raycaster.setFromCamera(this.app.stage.ndc(ev), this.app.stage.camera); return this.app.stage.raycaster.ray; };
    el.addEventListener('pointermove', (ev) => {
      if (this.drag) { this.drag.handle.onMove?.(ray(ev)); return; }
      const h = this.handleHit(ev);
      const p = h ? null : this.pageHit(ev);
      el.style.cursor = h?.handle ? h.handle.cursor ?? 'grab' : h?.flap || p?.hit ? 'pointer' : '';
      this.app.ui?.hover?.(ev, h, p);
    });
    el.addEventListener('pointerdown', (ev) => {
      if (ev.button !== 0) return;
      const h = this.handleHit(ev);
      if (h?.handle) {
        this.stopWatch();
        this.drag = h;
        h.handle.onDown?.();
        el.setPointerCapture(ev.pointerId);
        ev.preventDefault();
        return;
      }
      this.down = { h, p: h ? null : this.pageHit(ev), x: ev.clientX, y: ev.clientY };
      this.app.ui?.pointerDown?.(ev, !!(h || this.down.p?.hit));
    });
    el.addEventListener('pointerup', (ev) => {
      if (this.drag) {
        this.drag.handle.onUp?.();
        this.drag = null;
        el.releasePointerCapture?.(ev.pointerId);
        return;
      }
      const d = this.down;
      this.down = null;
      if (!d || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 6) return;
      const rt = this.runtime();
      if (d.h?.flap) { this.stopWatch(); rt?.toggleFlap(); return; }
      if (d.p?.hit && rt && d.p.k === rt.k) { this.stopWatch(); rt.hit(d.p.hit.id); }
    });
  }

  update(dt) {
    const k = this.app.book.openSpread;
    for (const [kk, rt] of this.runtimes) {
      const near = Math.abs(kk - this.app.book.position) < 1.5;
      if (near || rt === this.current) rt.update(dt, rt === this.current && kk === k);
    }
    this.updateWatch(dt);
    this.spill.update(this.current?.glowSources?.() ?? [], dt);
  }
}

export const tmpV = new THREE.Vector3();

/** 附页（目录、索引、测验……）：没有插图，只处理书页上的点击 */
class MatterRuntime {
  constructor(app, k, sp) {
    this.app = app; this.book = app.book; this.k = k; this.sp = sp;
    this.state = { quiz: {} };
    pageState.set(k, this.state);
  }
  redraw() { this.book.pages.invalidate(this.k, 'left'); this.book.pages.invalidate(this.k, 'right'); }
  enter() { this.redraw(); }
  leave() { return Promise.resolve(); }
  update() {}
  hit(id) {
    if (id.startsWith('goto:')) { this.app.sound?.play('tick'); this.app.ctl.goTo(Number(id.slice(5))); return true; }
    if (id === 'quiz:reset') { this.state.quiz = {}; this.redraw(); return true; }
    if (id.startsWith('quiz:')) {
      const [, q, j] = id.split(':').map(Number);
      if (this.state.quiz[q] != null) return true;
      this.state.quiz[q] = j;
      this.app.sound?.play('tick');
      this.redraw();
      return true;
    }
    return false;
  }
}
