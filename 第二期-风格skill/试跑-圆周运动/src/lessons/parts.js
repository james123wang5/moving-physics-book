import * as THREE from 'three';
import { StrokeSet, polyLength } from '../ink/strokes.js';
import { InkSphere, eyeIn, printDirIn } from '../ink/shapes.js';
import { SERIF, HANDF, INK, HAND } from '../content/type.js';
import { V, makeTag, dashes } from '../ink/kit.js';

// 各学科通用的零件，作为 DioramaLesson 的方法使用（this.prism(...)、this.terrain(...)……）。
// 都画在“当前装置”里：用 this.pop / this.pen / this.ink，需要每帧更新的自己登记到 this.lifters。
// 坐标是插图坐标（毫米）：x 向右，y 向上，z 朝读者为正；底座板上表面 y = this.L.Y0。

/** 直棱柱：多边形截面沿一根轴拉伸。房子、地块、楔块、台阶、卡片、柱子都用它。
 *  axis 'y'：pts 是 [x, z]，从 y = a 拉到 y = b；axis 'z'：pts 是 [x, y]，从 z = a 拉到 z = b；axis 'x'：pts 是 [z, y]，从 x = a 拉到 x = b。
 *  只在拐角（转角 > corner 弧度）处画沿轴的棱，弧形截面看起来是光滑的。 */
function prism(pts, a, b, { axis = 'y', mat, width = 1, corner = 0.35, parent } = {}) {
  const { pop, pen, ink } = this;
  const to3 = (p, t) => (axis === 'y' ? V(p[0], t, p[1]) : axis === 'z' ? V(p[0], p[1], t) : V(t, p[1], p[0]));
  if (mat) {
    const sh = new THREE.Shape(pts.map(([u, w]) => (axis === 'y' ? new THREE.Vector2(u, -w) : axis === 'z' ? new THREE.Vector2(u, w) : new THREE.Vector2(-u, w))));
    const geo = new THREE.ExtrudeGeometry(sh, { depth: b - a, bevelEnabled: false, curveSegments: 1 });
    if (axis === 'y') geo.rotateX(-Math.PI / 2);
    if (axis === 'x') geo.rotateY(Math.PI / 2);
    geo.translate(axis === 'x' ? a : 0, axis === 'y' ? a : 0, axis === 'z' ? a : 0);
    pop.addSurface(new THREE.Mesh(geo, mat), parent);
  }
  for (const t of [a, b]) {
    const ring = pts.map((p) => to3(p, t));
    ink.add(ring, { closed: true, sched: pen.next(polyLength(ring)), width });
  }
  const n = pts.length;
  pts.forEach((p, i) => {
    const q = pts[(i + n - 1) % n], r = pts[(i + 1) % n];
    const d1 = Math.atan2(p[1] - q[1], p[0] - q[0]), d2 = Math.atan2(r[1] - p[1], r[0] - p[0]);
    let turn = Math.abs(d2 - d1); if (turn > Math.PI) turn = 2 * Math.PI - turn;
    if (turn < corner) return;
    const e = [to3(p, a), to3(p, b)];
    ink.add(e, { sched: pen.next(Math.abs(b - a)), width, overshoot: 0.6 });
  });
}

/** 管子：沿一串点（自动圆滑）的圆管，轮廓线每帧按视角重算。血管、水管、河道里的水流、导线都可以用。
 *  返回 { group, mesh, curve }；curve.getPointAt(t) 可以拿来让东西沿管子走。 */
function tube(path, r, { mat, width = 1.1, segments = 64, radial = 16, caps = true, parent } = {}) {
  const t = new InkTube(this.pop, path, r, { mat, pen: this.pen, width, segments, radial, caps, parent });
  this.lifters.push(t);
  return t;
}

class InkTube {
  constructor(pop, path, r, { mat, pen, width, segments, radial, caps, parent }) {
    this.pop = pop; this.r = r; this.width = width; this.caps = caps;
    this.group = new THREE.Group();
    (parent || pop.group).add(this.group);
    this.curve = new THREE.CatmullRomCurve3(path);
    this.pts = this.curve.getSpacedPoints(segments);
    this.tans = this.pts.map((_, i) => this.curve.getTangentAt(i / segments));
    this.mesh = new THREE.Mesh(new THREE.TubeGeometry(this.curve, segments, r, radial, false), mat ?? pop.paper({ seed: 71 }));
    pop.addSurface(this.mesh, this.group);
    this.outline = new StrokeSet(pop.ink({ widthPx: 1.6 }), { capacity: 400 });
    this.group.add(this.outline.mesh);
    this.outline.mesh.layers.enable(1);
    this.outline.flat.layers.enable(1);
    pop.sets.push(this.outline);
    this.sched = pen ? pen.next(this.curve.getLength() * 1.6) : { t0: 0, dur: 0.3 };
  }
  /** 两条侧轮廓 + 两端的圆口；eye 给定按透视看，否则按平行方向 dir 看 */
  sides(eye, dir) {
    const a = [], b = [], view = new THREE.Vector3(), side = new THREE.Vector3();
    this.pts.forEach((p, i) => {
      if (eye) view.copy(eye).sub(p); else view.copy(dir).negate();
      side.copy(this.tans[i]).cross(view).normalize().multiplyScalar(this.r);
      a.push(p.clone().add(side)); b.push(p.clone().sub(side));
    });
    const out = [a, b];
    if (this.caps) for (const i of [0, this.pts.length - 1]) {
      const T = this.tans[i], u = new THREE.Vector3().crossVectors(T, Math.abs(T.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)).normalize(), w = new THREE.Vector3().crossVectors(T, u);
      out.push(Array.from({ length: 33 }, (_, k) => { const g = (k / 32) * Math.PI * 2; return this.pts[i].clone().addScaledVector(u, this.r * Math.cos(g)).addScaledVector(w, this.r * Math.sin(g)); }));
    }
    return out;
  }
  update(camera, lift = 1) {
    const stand = this.sides(eyeIn(this.group, camera), null);
    const flat = this.sides(null, printDirIn(this.pop.u.uCab.value, this.pop.u.uScene.value, this.group));
    const cur = lift < 0.001 ? flat : lift > 0.999 ? stand : stand.map((s, i) => s.map((p, j) => flat[i][j].clone().lerp(p, lift)));
    const mk = (list) => list.map((points, i) => ({ points, sched: this.sched, width: this.width, seed: 700 + i }));
    this.outline.setLines(mk(cur), mk(flat));
  }
}

/** 地形块：height(x, z) 给出相对底座的高度（毫米）。顶面 + 四周剖面墙 + 等高线（每 interval 毫米一条）。
 *  返回 { heightAt(x, z)（绝对 y）, mesh }。地理（等高线、坡度、流域）、数学（二元函数曲面）都能用。 */
function terrain({ x0, x1, z0, z1, height, base = this.L.Y0, n = 56, interval = 6, mat, width = 0.95, contourWidth = 0.55, index = 5 } = {}) {
  const { pop, pen, ink, faint } = this;
  const nx = n, nz = Math.max(4, Math.round((n * (z1 - z0)) / (x1 - x0)));
  const X = (i) => x0 + ((x1 - x0) * i) / nx, Z = (j) => z0 + ((z1 - z0) * j) / nz;
  const H = [];
  for (let j = 0; j <= nz; j++) { H.push([]); for (let i = 0; i <= nx; i++) H[j].push(Math.max(0.01, height(X(i), Z(j)))); }
  // 顶面
  const pos = [], idx = [];
  for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) pos.push(X(i), base + H[j][i], Z(j));
  const id = (i, j) => j * (nx + 1) + i;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) idx.push(id(i, j), id(i, j + 1), id(i + 1, j), id(i + 1, j), id(i, j + 1), id(i + 1, j + 1));
  // 四周的墙：沿边一圈（逆时针俯视），每段一个竖直四边形，朝外
  const rim = [];
  for (let i = 0; i <= nx; i++) rim.push([i, nz]);
  for (let j = nz - 1; j >= 0; j--) rim.push([nx, j]);
  for (let i = nx - 1; i >= 0; i--) rim.push([i, 0]);
  for (let j = 1; j <= nz; j++) rim.push([0, j]);
  const off = pos.length / 3;
  for (const [i, j] of rim) pos.push(X(i), base + H[j][i], Z(j), X(i), base, Z(j));
  for (let k = 0; k < rim.length - 1; k++) { const a = off + 2 * k; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const surf = mat ?? pop.paper({ hatchA: [0.62, 0.62, 0.48], hatchB: [-0.5, 0.45, 0.74], spacing: 1.8, seed: 81, color: '#f3ead6', hatch: 0.55 });
  surf.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, surf);
  pop.addSurface(mesh);
  // 轮廓：四条边的剖面线、底边、四个角的竖线
  const edge = (cells) => cells.map(([i, j]) => V(X(i), base + H[j][i], Z(j)));
  const sides = [
    Array.from({ length: nx + 1 }, (_, i) => [i, nz]), Array.from({ length: nz + 1 }, (_, j) => [nx, nz - j]),
    Array.from({ length: nx + 1 }, (_, i) => [nx - i, 0]), Array.from({ length: nz + 1 }, (_, j) => [0, j]),
  ];
  for (const s of sides) { const p = edge(s); ink.add(p, { sched: pen.next(polyLength(p)), width }); }
  const bottom = [V(x0, base, z1), V(x1, base, z1), V(x1, base, z0), V(x0, base, z0)];
  ink.add(bottom, { closed: true, sched: pen.next(polyLength(bottom)), width });
  for (const [i, j] of [[0, 0], [nx, 0], [nx, nz], [0, nz]]) { const p = [V(X(i), base, Z(j)), V(X(i), base + H[j][i], Z(j))]; ink.add(p, { sched: pen.next(H[j][i]), width, overshoot: 0.5 }); }
  // 等高线：逐格 marching squares，再把线段接成长线；每 index 条加粗一条（计曲线）
  let maxH = 0; for (const r of H) for (const h of r) maxH = Math.max(maxH, h);
  for (let lv = interval, k = 1; lv < maxH; lv += interval, k++) {
    for (const poly of contour(H, nx, nz, lv)) {
      const p = poly.map(([fi, fj]) => V(x0 + ((x1 - x0) * fi) / nx, base + lv + 0.15, z0 + ((z1 - z0) * fj) / nz));
      (k % index === 0 ? ink : faint).add(p, { sched: pen.next(polyLength(p) * 0.4), width: k % index === 0 ? contourWidth * 1.5 : contourWidth, taper: false });
    }
  }
  return {
    mesh,
    heightAt: (x, z) => base + Math.max(0.01, height(x, z)),
  };
}

/** 网格高度场 H[j][i] 在 level 处的等值线，返回若干条折线（格坐标 [i, j]） */
function contour(H, nx, nz, level) {
  const segs = [];
  const key = (e) => e.join(',');
  // 边编号：横边 ['h', i, j]（(i,j)–(i+1,j)），竖边 ['v', i, j]（(i,j)–(i,j+1)）
  const cross = (e) => {
    const [t, i, j] = e;
    const a = H[j][i], b = t === 'h' ? H[j][i + 1] : H[j + 1][i];
    const f = (level - a) / (b - a);
    return t === 'h' ? [i + f, j] : [i, j + f];
  };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const c = [H[j][i] > level, H[j][i + 1] > level, H[j + 1][i + 1] > level, H[j + 1][i] > level];
    const E = [['h', i, j], ['v', i + 1, j], ['h', i, j + 1], ['v', i, j]];
    const hit = [c[0] !== c[1], c[1] !== c[2], c[2] !== c[3], c[3] !== c[0]];
    const es = E.filter((_, k) => hit[k]);
    if (es.length === 2) segs.push(es);
    else if (es.length === 4) { segs.push([E[0], E[3]]); segs.push([E[1], E[2]]); }
  }
  // 接成长线
  const at = new Map();
  segs.forEach((s, n) => for2(s, (e) => { const k = key(e); (at.get(k) ?? at.set(k, []).get(k)).push(n); }));
  const used = new Set(), lines = [];
  for (let n = 0; n < segs.length; n++) {
    if (used.has(n)) continue;
    used.add(n);
    const chain = [segs[n][0], segs[n][1]];
    for (const dir of [1, 0]) {
      for (;;) {
        const end = dir ? chain[chain.length - 1] : chain[0];
        const next = (at.get(key(end)) ?? []).find((m) => !used.has(m));
        if (next == null) break;
        used.add(next);
        const [a, b] = segs[next];
        const other = key(a) === key(end) ? b : a;
        dir ? chain.push(other) : chain.unshift(other);
      }
    }
    lines.push(chain.map(cross));
  }
  return lines;
}
function for2(s, f) { f(s[0]); f(s[1]); }

/** 球棍分子：atoms [{ p: V, r, color }]，bonds [[i, j, 键数]]。返回 InkSphere 数组（已登记每帧轮廓）。
 *  这是静态的；要让分子动起来，用 this.dyn() 每帧重画键，并直接改 sphere.mesh.position。 */
function molecule(atoms, bonds = [], { width = 1.1 } = {}) {
  const { pop, pen, ink } = this;
  const spheres = atoms.map((a, i) => {
    const r = a.r ?? 3;
    const s = new InkSphere(pop, { r, centre: a.p.clone(), mat: pop.paper({ hatchA: [0.9, 0.12, -0.42], hatchB: [0.2, 0.9, 0.4], spacing: 1.1, seed: 90 + i, color: a.color ?? '#eef0f4' }), sched: pen.next(2 * Math.PI * r) });
    this.lifters.push(s);
    return s;
  });
  for (const [i, j, order = 1] of bonds) {
    const A = atoms[i], B = atoms[j], d = B.p.clone().sub(A.p).normalize();
    const s0 = A.p.clone().addScaledVector(d, A.r ?? 3), s1 = B.p.clone().addScaledVector(d, -(B.r ?? 3));
    const perp = new THREE.Vector3().crossVectors(d, Math.abs(d.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)).normalize();
    for (let k = 0; k < order; k++) {
      const o = (k - (order - 1) / 2) * 1.3;
      const p = [s0.clone().addScaledVector(perp, o), s1.clone().addScaledVector(perp, o)];
      ink.add(p, { sched: pen.next(polyLength(p)), width, taper: false });
    }
  }
  return spheres;
}

/** 自己画的纸卡片（立在插图里）：draw(g, w, h, ...args) 用毫米坐标画字、画图。
 *  返回 { mesh, redraw(...args) }。语文 / 历史的原文卡、时间轴刻度、地图图例、数学的算式卡都可以用。 */
function card(w, h, draw, { px = 10, color = '#f7f2e6' } = {}) {
  const c = document.createElement('canvas');
  c.width = Math.round(w * px); c.height = Math.round(h * px);
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = this.pop.paper({ hatch: 0, color: '#ffffff' });
  mat.map = tex;
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  this.pop.addSurface(mesh);
  mesh.userData.castShadow = false;
  const redraw = (...args) => {
    g.setTransform(px, 0, 0, px, 0, 0);
    g.fillStyle = color; g.fillRect(0, 0, w, h);
    g.strokeStyle = INK; g.lineWidth = 0.25; g.strokeRect(0.6, 0.6, w - 1.2, h - 1.2);
    g.textBaseline = 'alphabetic';
    draw(g, w, h, { SERIF, HANDF, INK, HAND }, ...args);
    tex.needsUpdate = true;
  };
  redraw();
  return { mesh, redraw };
}

/** 引线标注：在 at 处立一张纸签，一条虚线连到 target。返回纸签（tag.set(标题, 读数) 可以改字）。
 *  生物结构、地理地物、化学仪器名称都用它，代替把字直接印在物体上。 */
function callout(target, at, title, value = '', { w = 26, h = 8 } = {}) {
  const tag = makeTag(this.pop, w, h);
  tag.mesh.position.copy(at);
  tag.set(title, value);
  const from = at.clone().add(V(0, -h / 2, 0));
  for (const d of dashes([from, target], 1.3, 1.0)) this.faint.add(d, { sched: this.pen.next(2), width: 0.6, taper: false });
  return tag;
}

export const PARTS = { prism, tube, terrain, molecule, card, callout };
