import * as THREE from 'three';
import { StrokeSet, polyLength } from './strokes.js';

// 插图里的常用形体：纸面表面 + 墨线。坐标都在插图坐标系里（毫米）。

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** 圆（在 y = h 的水平面上），n 段 */
export function circlePts(r, h, n = 72, a0 = 0, a1 = Math.PI * 2) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return V(r * Math.cos(a), h, r * Math.sin(a));
  });
}

/**
 * 盒子：纸面 + 12 条棱。min/max 为对角点；pen 给每条棱排时间。
 * hide：不画的棱，用面名列出，例如 ['bottom'] 去掉底面四条棱。
 */
export function box(pop, set, min, max, { mat, pen, width = 1, hide = [], parent } = {}) {
  const size = max.clone().sub(min), c = min.clone().add(max).multiplyScalar(0.5);
  if (mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat);
    mesh.position.copy(c);
    pop.addSurface(mesh, parent);
  }
  if (set && set.add) {
    const [x0, y0, z0] = min.toArray(), [x1, y1, z1] = max.toArray();
    const edges = [
      ['bottom', [x0, y0, z0], [x1, y0, z0]], ['bottom', [x1, y0, z0], [x1, y0, z1]], ['bottom', [x1, y0, z1], [x0, y0, z1]], ['bottom', [x0, y0, z1], [x0, y0, z0]],
      ['top', [x0, y1, z0], [x1, y1, z0]], ['top', [x1, y1, z0], [x1, y1, z1]], ['top', [x1, y1, z1], [x0, y1, z1]], ['top', [x0, y1, z1], [x0, y1, z0]],
      ['side', [x0, y0, z0], [x0, y1, z0]], ['side', [x1, y0, z0], [x1, y1, z0]], ['side', [x1, y0, z1], [x1, y1, z1]], ['side', [x0, y0, z1], [x0, y1, z1]],
    ];
    for (const [face, a, b] of edges) {
      if (hide.includes(face)) continue;
      const p = [V(...a), V(...b)];
      set.add(p, { sched: pen?.next(polyLength(p)), width, overshoot: 0.6 });
    }
  }
}

/** 球的视轮廓：从 eye（球心坐标系里的眼睛位置）看过去的那一圈；dir 给定时按平行投影 */
export function sphereSilhouette(r, eye, dir, n = 96) {
  let centre, rad, axis;
  if (eye) {
    const d = eye.length();
    axis = eye.clone().divideScalar(d);
    centre = axis.clone().multiplyScalar((r * r) / d);
    rad = r * Math.sqrt(Math.max(0, 1 - (r * r) / (d * d)));
  } else {
    axis = dir.clone().normalize().negate();
    centre = V(0, 0, 0);
    rad = r;
  }
  const ref = Math.abs(axis.y) < 0.9 ? V(0, -1, 0) : V(1, 0, 0);
  const e1 = ref.sub(axis.clone().multiplyScalar(ref.dot(axis))).normalize();
  const e2 = new THREE.Vector3().crossVectors(axis, e1).normalize();
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return centre.clone().addScaledVector(e1, rad * Math.cos(a)).addScaledVector(e2, rad * Math.sin(a));
  });
}

/**
 * 回转体（绕 y 轴）的视轮廓。profile：[[r, y], …]。
 * 对每个高度 y，求出法线与视线垂直的两个方位角，连成左右两条轮廓线。
 */
export function latheSilhouette(profile, eye, dir) {
  const sides = [[], []], out = [];
  const flush = (k) => { if (sides[k].length > 1) out.push(sides[k]); sides[k] = []; };
  for (let i = 0; i < profile.length; i++) {
    const [r, y] = profile[i];
    const a = profile[Math.max(0, i - 1)], b = profile[Math.min(profile.length - 1, i + 1)];
    const dy = b[1] - a[1], dr = b[0] - a[0];
    const slope = Math.abs(dy) > 1e-9 ? dr / dy : dr > 0 ? 1e3 : -1e3;
    let c, base;
    if (eye) {
      const rho = Math.hypot(eye.x, eye.z);
      base = Math.atan2(eye.z, eye.x);
      c = (r + slope * (eye.y - y)) / Math.max(1e-9, rho);
    } else {
      const rho = Math.hypot(dir.x, dir.z);
      base = Math.atan2(dir.z, dir.x);
      c = (slope * dir.y) / Math.max(1e-9, rho);
    }
    if (r < 1e-6 || Math.abs(c) > 1) { flush(0); flush(1); continue; }
    const g = Math.acos(c);
    [base - g, base + g].forEach((ang, k) => sides[k].push(V(r * Math.cos(ang), y, r * Math.sin(ang))));
  }
  flush(0); flush(1);
  return out;
}

/** 世界里的相机位置 → 物体局部坐标 */
export function eyeIn(obj, camera, out = new THREE.Vector3()) {
  obj.updateWorldMatrix(true, false);
  return out.copy(camera.getWorldPosition(new THREE.Vector3())).applyMatrix4(new THREE.Matrix4().copy(obj.matrixWorld).invert());
}

/** 印刷相机的视线方向（斜投影）→ 物体局部坐标 */
export function printDirIn(cab, frame, obj, out = new THREE.Vector3()) {
  out.set(-cab.x, -cab.y, -1).transformDirection(frame);
  obj.updateWorldMatrix(true, false);
  return out.transformDirection(new THREE.Matrix4().copy(obj.matrixWorld).invert());
}

/** 球：纸面 + 实时轮廓 */
export class InkSphere {
  constructor(pop, { r, centre = V(0, 0, 0), mat, width = 1.1, widthPx = 1.75, parent, sched } = {}) {
    this.pop = pop;
    this.r = r;
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), mat);
    this.mesh.position.copy(centre);
    pop.addSurface(this.mesh, parent);
    this.set = new StrokeSet(pop.ink({ widthPx }), { capacity: 220 });
    this.mesh.add(this.set.mesh);
    this.set.mesh.layers.enable(1);
    this.set.flat.layers.enable(1);
    pop.sets.push(this.set);
    this.width = width;
    this.sched = sched ?? { t0: 0, dur: 0.4 };
  }
  update(camera, lift = 1) {
    const eye = eyeIn(this.mesh, camera);
    const dir = printDirIn(this.pop.u.uCab.value, this.pop.u.uScene.value, this.mesh);
    const stand = sphereSilhouette(this.r, eye, null);
    const flat = sphereSilhouette(this.r, null, dir);
    const pts = lift > 0.999 ? stand : lift < 0.001 ? flat : stand.map((p, i) => flat[i].clone().lerp(p, lift));
    this.set.setLines([{ points: pts, closed: true, width: this.width, sched: this.sched, seed: 90 }], [{ points: flat, closed: true, width: this.width, sched: this.sched, seed: 90 }]);
  }
}

/** 回转体：纸面 + 边沿圆 + 实时外轮廓 */
export class InkLathe {
  constructor(pop, profile, { mat, pen, rims = [], width = 1, outlineWidth = 1.15, segments = 48, parent, dense = 3 } = {}) {
    this.pop = pop;
    const fine = [];
    for (let i = 0; i < profile.length - 1; i++) {
      for (let k = 0; k < dense; k++) {
        const t = k / dense;
        fine.push([profile[i][0] + (profile[i + 1][0] - profile[i][0]) * t, profile[i][1] + (profile[i + 1][1] - profile[i][1]) * t]);
      }
    }
    fine.push(profile[profile.length - 1]);
    this.profile = fine;
    this.group = new THREE.Group();
    (parent || pop.group).add(this.group);
    this.mesh = new THREE.Mesh(new THREE.LatheGeometry(fine.map(([r, y]) => new THREE.Vector2(r, y)), segments), mat);
    pop.addSurface(this.mesh, this.group);
    this.lines = new StrokeSet(pop.ink({ widthPx: 1.4 }));
    for (const i of rims) {
      const [r, y] = profile[i];
      if (r > 0.3) this.lines.add(circlePts(r, y, 64).slice(0, 64), { closed: true, sched: pen?.next(Math.PI * r), width });
    }
    this.outline = new StrokeSet(pop.ink({ widthPx: 1.6 }), { capacity: 400 });
    this.group.add(this.outline.mesh);
    this.outline.mesh.layers.enable(1);
    this.outline.flat.layers.enable(1);
    pop.sets.push(this.outline);
    this.outSched = pen ? pen.next(polyLength(fine.map(([r, y]) => V(r, y, 0))) * 0.8) : { t0: 0, dur: 0.3 };
    this.outlineWidth = outlineWidth;
  }
  add(points, o) { this.lines.add(points, o); return this; }
  build() { this.lines.build(); this.pop.addLines(this.lines, this.group); return this; }
  update(camera, lift = 1) {
    const eye = eyeIn(this.group, camera);
    const dir = printDirIn(this.pop.u.uCab.value, this.pop.u.uScene.value, this.group);
    const stand = latheSilhouette(this.profile, eye, null);
    const flat = latheSilhouette(this.profile, null, dir);
    const mk = (list) => list.map((points, i) => ({ points, sched: this.outSched, width: this.outlineWidth, seed: 500 + i }));
    let cur = stand;
    if (lift < 0.001) cur = flat;
    else if (lift < 0.999 && stand.length === flat.length && stand.every((s, i) => s.length === flat[i].length)) cur = stand.map((s, i) => s.map((p, j) => flat[i][j].clone().lerp(p, lift)));
    this.outline.setLines(mk(cur), mk(flat));
  }
}
