import * as THREE from 'three';
import { bookDims, leafRange, solveSpine, leafCurve, curveAt, frontBoardFrame, spineBack, SAMPLES } from './model.js';
import { LeafBlock, SpineCloth, Headband, Ribbon, boardGeometry } from './geometry.js';
import {
  paperNormal, tiledFor, keyUniforms, edgeMaterial, weaveTextures, ribTextures, beadTextures,
  clothMaterial, ribbonMaterial, headbandMaterial, coverLayout,
} from './materials.js';
import { PageTextures } from './pages.js';

// 一本真正的书：有厚度的书页叠、翻动的单页、布面封面、书脊、堵头布、丝带书签。
// 翻页量 c[i] 驱动一切；c 变了就重算骨架并更新所有网格。

const easeCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function chaikin(pts, iterations) {
  let p = pts;
  for (let it = 0; it < iterations; it++) {
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  return p;
}

function resample(pts, count) {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = acc[acc.length - 1], out = [];
  let j = 0;
  for (let i = 0; i < count; i++) {
    const s = (total * i) / (count - 1);
    while (j < pts.length - 2 && acc[j + 1] < s) j++;
    const t = (s - acc[j]) / (acc[j + 1] - acc[j] || 1);
    out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * t, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * t]);
  }
  return out;
}

const pathLength = (pts, upto = pts.length - 1) => {
  let s = 0;
  for (let i = 1; i <= upto; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return s;
};

export class Book {
  /**
   * @param {object} o
   * @param {THREE.WebGLRenderer} o.renderer
   * @param {(k:number, side:string, ctx:CanvasRenderingContext2D, px:number)=>void} o.drawPage
   * @param {number} o.nSpreads
   * @param {object} o.cover  {foil(ctx), deboss(ctx), spine(ctx), plate(ctx, w, h)}（毫米坐标）
   */
  constructor({ renderer, drawPage, nSpreads = 10, cover = {}, ribbonSpread = 2, clothColor = '#c8961e', sheen = '#f3d79a', foil = [0.96, 0.5, 0.24] }) {
    const d = (this.dims = bookDims({ nSpreads }));
    this.group = new THREE.Group();
    this.group.name = 'book';
    this.c = new Float64Array(d.N);
    this.key = keyUniforms();
    this.ribbonSpread = clamp(ribbonSpread | 0, 1, d.N);

    const pNormal = paperNormal({ px: 512, strength: 2.2, seed: 11 });
    this.pages = new PageTextures({ renderer, drawPage, W: d.W, D: d.D, nSpreads: d.N, paperNormal: tiledFor(pNormal, d.W, d.D), key: this.key });

    // 布面：正面封面（烫金书名 + 压凹边框）、书脊（竖排书名）、封底（只有色调）
    const weave = weaveTextures();
    for (const t of [weave.normal, weave.rough]) t.repeat.set(1 / weave.tile, 1 / weave.tile);
    const front = coverLayout(d.BW, d.BD, 6, { foil: cover.foil, deboss: cover.deboss });
    const SPINE_TITLE = 30;
    const spineLay = coverLayout(SPINE_TITLE, d.BD, 10, { foil: cover.spine, seed: 5 });
    const backLay = coverLayout(d.BW, d.BD, 2, { seed: 8 });
    const clothArgs = { weave, color: clothColor, sheen, foil };
    const clothFront = clothMaterial({ ...clothArgs, layout: front.layout, layoutNormal: front.normal });
    const clothSpine = clothMaterial({ ...clothArgs, layout: spineLay.layout, layoutNormal: spineLay.normal });
    const clothBack = clothMaterial({ ...clothArgs, layout: backLay.layout, layoutNormal: backLay.normal });
    this.spineTitleLen = SPINE_TITLE;
    const edge = edgeMaterial({ leafFrom: d.B, leafTo: d.B + (d.N - 1) * d.L, leaf: d.L });
    const rib = ribTextures();
    rib.normal.repeat.set(1 / rib.tile, 1 / rib.tile);
    const ribbonMat = ribbonMaterial(rib);
    const beads = beadTextures();
    const bandMat = headbandMaterial(beads);
    this.materials = { clothFront, clothSpine, clothBack, edge, ribbonMat, bandMat };

    const hidden = (this.hidden = new THREE.MeshBasicMaterial({ visible: false }));
    const base = { ns: SAMPLES, W: d.W, D: d.D, materials: [hidden, hidden, edge] };
    this.right = new LeafBlock({ ...base, nz: 3, nsig: 6 });
    this.left = new LeafBlock({ ...base, nz: 3, nsig: 6 });
    this.frontBlock = new LeafBlock({ ...base, nz: 3, nsig: 4 });
    this.group.add(this.right.mesh, this.left.mesh, this.frontBlock.mesh);
    this.flying = [];

    // 封底板（固定在书下面）
    const backBoard = new THREE.Mesh(boardGeometry(d.BW, d.BD, d.BOARD), clothBack);
    backBoard.castShadow = backBoard.receiveShadow = true;
    backBoard.matrixAutoUpdate = false;
    backBoard.matrix.makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1)).setPosition(d.CX + d.JOINT, d.Yb, 0);
    this.group.add(backBoard);

    // 封面板（随翻开转动）+ 嵌在上面的插画板
    this.frontBoard = new THREE.Group();
    this.frontBoard.matrixAutoUpdate = false;
    this.group.add(this.frontBoard);
    const board = new THREE.Mesh(boardGeometry(d.BW, d.BD, d.BOARD), clothFront);
    board.castShadow = board.receiveShadow = true;
    this.frontBoard.add(board);
    if (cover.plate) {
      const pw = cover.plateSize?.[0] ?? 90, ph = cover.plateSize?.[1] ?? 102;
      const pc = document.createElement('canvas');
      const ppx = 14;
      pc.width = Math.round(pw * ppx); pc.height = Math.round(ph * ppx);
      const pg = pc.getContext('2d');
      pg.scale(ppx, ppx);
      cover.plate(pg, pw, ph);
      const ptex = new THREE.CanvasTexture(pc);
      ptex.colorSpace = THREE.SRGBColorSpace;
      ptex.anisotropy = 8;
      ptex.flipY = false; // 盒子顶面的 v 朝 +z（地脚），画布顶端要对着天头
      const plateMat = new THREE.MeshStandardMaterial({ roughness: 0.84, normalMap: tiledFor(pNormal, pw, ph), normalScale: new THREE.Vector2(0.3, 0.3) });
      const plateGeo = new THREE.BoxGeometry(pw, 0.25, ph);
      const top = new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.84, normalMap: plateMat.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) });
      const plate = new THREE.Mesh(plateGeo, [plateMat, plateMat, top, plateMat, plateMat, plateMat]);
      const [cx, cz] = cover.plateCentre ?? [d.BW / 2, 156 - d.BD / 2];
      plate.position.set(cx, d.BOARD + 0.12, cz);
      plate.castShadow = plate.receiveShadow = true;
      this.frontBoard.add(plate);
    }

    this.spine = new SpineCloth({ M: 48, BD: d.BD, material: clothSpine });
    this.bands = [new Headband({ material: bandMat }), new Headband({ material: bandMat })];
    this.ribbon = new Ribbon({ rows: 90, cols: 5, width: 6.5, material: ribbonMat });
    this.group.add(this.spine.mesh, this.bands[0].mesh, this.bands[1].mesh, this.ribbon.mesh);

    this.cache = new Map();
    this.dirty = true;
    this.anim = null;
    this.clock = 0;
    this.queue = Promise.resolve();
    this.turnId = 0;
    this.target = null;
    this.listeners = new Set();
    this.setPosition(0);
  }

  // ---------- 状态 ----------
  get position() { let s = 0; for (let i = 0; i < this.dims.N; i++) s += this.c[i]; return s; }
  get turning() { return !!this.anim; }
  get openSpread() {
    if (this.dirty) this.rebuild();
    const { iR, iL } = this.ends;
    return iR === iL + 1 && iR >= 1 ? iR : null;
  }

  setPosition(p) {
    const { N } = this.dims;
    p = clamp(p, 0, N);
    if (this.anim) { const r = this.anim.resolve; this.anim = null; r(); }
    for (let i = 0; i < N; i++) this.c[i] = clamp(p - i, 0, 1);
    this.dirty = true;
    this.updateFocus();
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) fn(this); }

  updateFocus() {
    const s = new Set([clamp(Math.round(this.position), 1, this.dims.N)]);
    if (this.target !== null) s.add(clamp(this.target, 1, this.dims.N));
    this.pages.setFocus([...s]);
  }

  // ---------- 翻页 ----------
  animate(entries) {
    return new Promise((resolve) => {
      const t0 = this.clock;
      this.anim = { entries: entries.map((e) => ({ ...e, t0: t0 + e.delay })), resolve };
    });
  }

  async turnTo(target, dur) {
    const now = Math.round(this.position);
    if (target === now && Math.abs(this.position - now) < 1e-6) return;
    const { c } = this;
    const run = (ids, to, single) => {
      if (!ids.length) return Promise.resolve();
      const each = single ? dur : Math.min(dur, 0.55);
      const gap = single ? 0 : Math.min(0.085, (1.6 - each) / Math.max(1, ids.length - 1));
      return this.animate(ids.map((i, k) => ({ i, from: c[i], to, dur: i === 0 ? dur * 1.25 : each, delay: k * gap, ease: single || i === 0 ? easeCubic : easeQuad })));
    };
    if (target > now) {
      if (now === 0 && target > 1) {
        const ids = [];
        for (let i = 1; i < target; i++) ids.push(i);
        await this.animate([
          { i: 0, from: c[0], to: 1, dur, delay: 0, ease: easeCubic },
          ...ids.map((i, k) => ({ i, from: c[i], to: 1, dur: dur * 0.86, delay: 0.2 + k * 0.085, ease: easeQuad })),
        ]);
        return;
      }
      if (now === 0) await run([0], 1, true);
      const ids = [];
      for (let i = Math.max(1, now); i < target; i++) ids.push(i);
      await run(ids, 1, ids.length === 1);
    } else {
      const ids = [];
      for (let i = now - 1; i >= Math.max(1, target); i--) ids.push(i);
      await run(ids, 0, ids.length === 1);
      if (target === 0) await run([0], 0, true);
    }
  }

  /** 翻到第 k 个跨页（0 = 合上）。多次调用会排队 */
  goTo(k, { duration = 1.1, beforeTurn = null } = {}) {
    k = clamp(Math.round(k), 0, this.dims.N);
    const id = ++this.turnId;
    this.target = k;
    this.updateFocus();
    this.queue = this.queue.then(async () => {
      if (id !== this.turnId) return;
      if (beforeTurn) await beforeTurn();
      if (id !== this.turnId) return;
      await this.turnTo(k, duration);
    }).catch((e) => console.error(e));
    return this.queue.then(() => {
      if (id === this.turnId) { this.target = null; this.updateFocus(); }
      this.emit();
    });
  }

  update(dt = 1 / 60) {
    this.clock += dt;
    if (this.anim) {
      let done = true;
      for (const e of this.anim.entries) {
        const t = clamp((this.clock - e.t0) / e.dur, 0, 1);
        if (t < 1) done = false;
        this.c[e.i] = e.from + (e.to - e.from) * e.ease(t);
      }
      this.dirty = true;
      if (done) { const r = this.anim.resolve; this.anim = null; r(); this.updateFocus(); }
    }
    if (this.dirty) this.rebuild();
    this.pages.step();
  }

  /** 主光方向和颜色（视空间），给纸页透光 */
  setKeyLight(light, camera) {
    const dir = light.position.clone().sub(light.target.position).normalize().transformDirection(camera.matrixWorldInverse);
    this.key.uKeyDir.value.copy(dir);
    this.key.uKeyColor.value.copy(light.color).multiplyScalar(light.intensity * 0.22);
  }

  // ---------- 几何 ----------
  curve(sigma, u, zn, flat) {
    const k = `${sigma.toFixed(4)}|${u.toFixed(5)}|${zn.toFixed(3)}|${flat ? 1 : 0}`;
    let c = this.cache.get(k);
    if (!c) { c = leafCurve(this.dims, this.sp, sigma, u, zn, flat); this.cache.set(k, c); }
    return c;
  }

  /** 第 i 张的正面（b）或背面（a）曲线 */
  leafFace(i, face, zn = 0) {
    const d = this.dims;
    const u = i >= d.N ? 0 : this.c[i];
    const [lo, hi] = leafRange(d, i);
    const sig = face === 'b' ? hi : lo;
    if (i === 0 && u > 0 && u < 1) return this.curve(sig, 1, 0, true);
    return this.curve(sig, u, u > 0 && u < 1 ? zn : 0, i === 0);
  }

  pageMat(k, side, trans) {
    const m = this.pages.material(k, side);
    if (m) m.userData.uniforms.uTrans.value = trans;
    return m;
  }

  rebuild() {
    const d = this.dims, c = this.c, S = d.S;
    this.sp = solveSpine(d, c);
    this.cache.clear();
    let iR = d.N;
    while (iR - 1 >= 0 && c[iR - 1] <= 0) iR--;
    let iL = -1;
    while (iL + 1 < d.N && c[iL + 1] >= 1) iL++;
    this.ends = { iR, iL };

    // 右边这叠
    {
      const top = leafRange(d, iR)[1];
      const layers = [];
      for (let k = 0; k <= this.right.nsig; k++) layers.push(this.curve((top * k) / this.right.nsig, 0, 0, false));
      this.right.update(S, 0, top, (k) => layers[k]);
      const k = iR >= d.N ? d.N : iR;
      this.right.mesh.material = [iR === 0 ? this.hidden : this.pageMat(k, 'right', 0), this.hidden, this.materials.edge];
    }
    // 左边这叠
    this.left.mesh.visible = iL >= 0;
    if (iL >= 0) {
      const lo = leafRange(d, iL)[0];
      const layers = [];
      for (let k = 0; k <= this.left.nsig; k++) layers.push(this.curve(lo + ((d.T - lo) * k) / this.left.nsig, 1, 0, false));
      this.left.update(S, lo, d.T, (k) => layers[k]);
      this.left.mesh.material = [this.hidden, this.pageMat(iL + 1, 'left', 0), this.materials.edge];
    }
    // 封面正在翻开时，前衬块单独转
    this.frontBlock.mesh.visible = iL < 0 && iR > 0;
    if (this.frontBlock.mesh.visible) {
      const lo = leafRange(d, 0)[0];
      const layers = [];
      for (let k = 0; k <= this.frontBlock.nsig; k++) layers.push(this.curve(lo + ((d.T - lo) * k) / this.frontBlock.nsig, 1, 0, true));
      this.frontBlock.update(S, lo, d.T, (k) => layers[k]);
      this.frontBlock.mesh.material = [this.hidden, this.pageMat(1, 'left', 0.25), this.materials.edge];
    }
    // 正在翻的单页
    let n = 0;
    for (let i = Math.max(1, iL + 1); i < iR; i++) {
      const blk = this.flyingLeaf(n++);
      const [lo, hi] = leafRange(d, i);
      const u = c[i];
      blk.update(S, lo, hi, (k, r) => this.curve(k ? hi : lo, u, -1 + (2 * r) / blk.nz, false));
      blk.mesh.material = [this.pageMat(i, 'right', 0.3), this.pageMat(i + 1, 'left', 0.3), this.materials.edge];
      blk.mesh.visible = true;
    }
    for (let i = n; i < this.flying.length; i++) this.flying[i].mesh.visible = false;

    const fb = frontBoardFrame(d, this.sp);
    this.frontBoard.matrix.makeBasis(new THREE.Vector3(fb.dx, fb.dy, 0), new THREE.Vector3(fb.nx, fb.ny, 0), new THREE.Vector3(0, 0, 1)).setPosition(fb.ox, fb.oy, 0);
    this.frontBoard.matrixWorldNeedsUpdate = true;
    this.updateSpine(fb);
    this.updateRibbon();
    this.dirty = false;
  }

  flyingLeaf(i) {
    while (this.flying.length <= i) {
      const b = new LeafBlock({ ns: SAMPLES, nz: 10, nsig: 1, W: this.dims.W, D: this.dims.D, materials: [this.hidden, this.hidden, this.materials.edge] });
      b.mesh.visible = false;
      this.flying.push(b);
      this.group.add(b.mesh);
    }
    return this.flying[i];
  }

  updateSpine(fb) {
    const d = this.dims, sp = this.sp;
    const pts = [[d.CX + d.JOINT, d.Yb - d.BOARD]];
    const s0 = -d.BOARD, s1 = d.T + d.BOARD, steps = 30;
    let mid = 0;
    for (let i = 0; i <= steps; i++) {
      const s = s0 + ((s1 - s0) * i) / steps;
      const b = spineBack(d, sp, s);
      const q = (s - s0) / (s1 - s0);
      const off = d.HOLLOW * (0.35 + 0.65 * sp.omega) + d.SPINE + 1.4 * 4 * q * (1 - q) * (1 - sp.omega);
      pts.push([b.x + b.ox * off, Math.max(d.Yb - d.BOARD + 0.02, b.y + b.oy * off)]);
      if (Math.abs(s - d.T / 2) < (s1 - s0) / steps / 2 + 1e-9) mid = pts.length - 1;
    }
    pts.push([fb.ox + d.BOARD * fb.nx, fb.oy + d.BOARD * fb.ny]);
    const frac = pathLength(pts, mid) / pathLength(pts);
    const outer = resample(chaikin(pts, 3), this.spine.M + 1);
    const inner = outer.map((p, i) => {
      const a = outer[Math.max(0, i - 1)], b = outer[Math.min(outer.length - 1, i + 1)];
      const tx = b[0] - a[0], ty = b[1] - a[1], len = Math.hypot(tx, ty) || 1;
      return [p[0] + (ty / len) * d.SPINE, p[1] - (tx / len) * d.SPINE];
    });
    const total = pathLength(outer);
    this.spine.update(outer, inner, total * frac, this.spineTitleLen);
    // 堵头布：沿书背贴在天头和地脚
    const hb = [];
    for (let i = 0; i <= 16; i++) {
      const b = spineBack(d, sp, (d.T * i) / 16);
      hb.push([b.x + b.ox * 0.55, b.y + b.oy * 0.55]);
    }
    const line = resample(chaikin(hb, 2), this.bands[0].n + 1);
    this.bands[0].update(line.map(([x, y]) => new THREE.Vector3(x, y, -d.D / 2 + 0.3)));
    this.bands[1].update(line.map(([x, y]) => new THREE.Vector3(x, y, d.D / 2 - 0.3)));
  }

  /** 丝带：夹在 ribbonSpread 那一页上，靠近书脊，从地脚垂出来落到桌面 */
  updateRibbon() {
    const d = this.dims;
    const L = this.ribbonSpread >= d.N ? d.N : this.ribbonSpread;
    const u = L >= d.N ? 0 : this.c[L];
    const sig = leafRange(d, L)[1];
    const at = [0, 0, 0];
    const onPage = (zn, s, lift) => {
      const cv = L === 0 && u > 0 && u < 1 ? this.curve(sig, 1, 0, true) : this.curve(sig, u, u > 0 && u < 1 ? zn : 0, L === 0);
      curveAt(d, cv, s, at);
      return new THREE.Vector3(at[0] - Math.sin(at[2]) * lift, at[1] + Math.cos(at[2]) * lift, zn * (d.D / 2));
    };
    const rows = this.ribbon.rows, cols = this.ribbon.cols, half = 3.25, sMid = 9, onRows = 26;
    const grid = [];
    for (let r = 0; r < onRows; r++) {
      const z = -d.D / 2 + 1 + ((d.D - 2) * r) / (onRows - 1);
      const zn = z / (d.D / 2);
      const row = [];
      for (let k = 0; k < cols; k++) {
        const p = onPage(zn, sMid + (-1 + (2 * k) / (cols - 1)) * half, 0.14);
        p.z = z;
        row.push(p);
      }
      grid.push(row);
    }
    // 垂下来：越过地脚，沿书边落到桌面，再在桌上躺一段
    const end = grid[onRows - 1][(cols - 1) >> 1];
    const floor = d.Yb - d.BOARD;
    const edgeZ = d.D / 2;
    let under = floor;
    if (end.x > d.CX + d.JOINT - 0.5 || (this.sp.open >= 1 && end.x < -d.CX - d.JOINT + 0.5)) under = d.Yb;
    const ctrl = [
      end,
      new THREE.Vector3(end.x, end.y + 0.25, edgeZ + 1),
      new THREE.Vector3(end.x + 0.3, (end.y + under) / 2 + 0.6, edgeZ + 2.2),
      new THREE.Vector3(end.x + 0.6, under + 0.45, edgeZ + d.OVER - 0.3),
      new THREE.Vector3(end.x + 1.0, under + 0.15, edgeZ + d.OVER + 1.3),
      new THREE.Vector3(end.x + 2.2, floor + 0.2, edgeZ + d.OVER + 4),
      new THREE.Vector3(end.x + 4.5, floor + 0.15, edgeZ + d.OVER + 22),
      new THREE.Vector3(end.x + 6.0, floor + 0.15, edgeZ + d.OVER + 46),
    ];
    const spline = new THREE.CatmullRomCurve3(ctrl, false, 'centripetal');
    const last = grid[onRows - 1];
    for (let r = 1; r <= rows - onRows; r++) {
      const t = r / (rows - onRows);
      const p = spline.getPoint(t);
      const blend = smooth(0, 0.12, t);
      if (p.z > edgeZ + 0.5) p.y = Math.max(p.y, p.z < edgeZ + d.OVER + 0.6 ? under + 0.15 : floor + 0.18);
      const row = [];
      for (let k = 0; k < cols; k++) {
        const flatPt = new THREE.Vector3(p.x + (-1 + (2 * k) / (cols - 1)) * half, p.y, p.z);
        const carried = last[k].clone().sub(end).add(p);
        row.push(carried.lerp(flatPt, blend));
      }
      grid.push(row);
    }
    this.ribbon.update(grid);
  }

  // ---------- 页面坐标 ----------
  /** 第 k 跨页 side 页上 (u, v) 毫米处的世界坐标；u 从页面左边算，v 从页面顶端算 */
  pageToWorld(k, side, u, v, out = new THREE.Vector3()) {
    if (this.dirty) this.rebuild();
    const d = this.dims;
    const leaf = side === 'right' ? (k >= d.N ? d.N : k) : k - 1;
    const face = side === 'right' ? 'b' : 'a';
    const s = side === 'right' ? u : d.W - u;
    const z = v - d.D / 2;
    const cv = this.leafFace(leaf, face, z / (d.D / 2));
    const at = curveAt(d, cv, s, [0, 0, 0]);
    out.set(at[0], at[1], z);
    return out.applyMatrix4(this.group.matrixWorld);
  }

  /** 页面在该点的朝外法线（世界） */
  pageNormal(k, side, u, v, out = new THREE.Vector3()) {
    const d = this.dims;
    const leaf = side === 'right' ? (k >= d.N ? d.N : k) : k - 1;
    const face = side === 'right' ? 'b' : 'a';
    const s = side === 'right' ? u : d.W - u;
    const cv = this.leafFace(leaf, face, (v - d.D / 2) / (d.D / 2));
    const at = curveAt(d, cv, s, [0, 0, 0]);
    const sgn = face === 'b' ? 1 : -1;
    return out.set(-Math.sin(at[2]) * sgn, Math.cos(at[2]) * sgn, 0).transformDirection(this.group.matrixWorld);
  }

  /** 世界点 → 当前打开跨页上的页面坐标（用于点击书页） */
  worldToPage(p) {
    const k = this.openSpread;
    if (k === null) return null;
    const d = this.dims;
    const local = this.group.worldToLocal(p.clone());
    const side = local.x >= 0 ? 'right' : 'left';
    const leaf = side === 'right' ? (k >= d.N ? d.N : k) : k - 1;
    const cv = this.leafFace(leaf, side === 'right' ? 'b' : 'a', clamp(local.z / (d.D / 2), -1, 1));
    let best = Infinity, sBest = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const x0 = cv.x[i], y0 = cv.y[i], x1 = cv.x[i + 1], y1 = cv.y[i + 1];
      const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
      const t = clamp(((local.x - x0) * dx + (local.y - y0) * dy) / L2, 0, 1);
      const qx = x0 + dx * t, qy = y0 + dy * t;
      const dd = (qx - local.x) ** 2 + (qy - local.y) ** 2;
      if (dd < best) { best = dd; sBest = d.S[i] + (d.S[i + 1] - d.S[i]) * t; }
    }
    return { k, side, u: side === 'right' ? sBest : d.W - sBest, v: local.z + d.D / 2 };
  }
}
