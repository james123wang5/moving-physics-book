import * as THREE from 'three';
import { SERIF, HANDF, INK, HAND } from '../content/type.js';
import { circlePts } from './shapes.js';

// 各课插图共用的小部件：纸标签、虚线、箭头、圆盘/齿轮等的笔画。

export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const BLUE = '#2a5db0';
export const RED = '#b8412e';
export const ORANGE = '#ff7a1c';
export const KINETIC = '#2f7bff';

/** 纸标签：写字的小卡片，立在插图里，跟着一起印刷、立起 */
export function makeTag(pop, w, h) {
  const px = 10;
  const c = document.createElement('canvas');
  c.width = w * px; c.height = h * px;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = pop.paper({ hatch: 0, color: '#ffffff' });
  mat.map = tex;
  mat.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  pop.addSurface(mesh);
  mesh.userData.castShadow = false;
  let last = '';
  return {
    mesh,
    set(title, value) {
      const key = title + '|' + value;
      if (key === last) return;
      last = key;
      g.setTransform(px, 0, 0, px, 0, 0);
      g.fillStyle = '#f7f2e6'; g.fillRect(0, 0, w, h);
      g.strokeStyle = INK; g.lineWidth = 0.25; g.strokeRect(0.6, 0.6, w - 1.2, h - 1.2);
      g.fillStyle = '#4b5466'; g.font = `600 ${Math.min(2.4, h * 0.28).toFixed(2)}px ${SERIF}`; g.textBaseline = 'alphabetic';
      g.fillText(title, 1.6, Math.min(3.4, h * 0.4));
      g.fillStyle = HAND; g.font = `560 ${Math.min(4.4, h * 0.5).toFixed(2)}px ${HANDF}`;
      g.fillText(value, 1.6, h - 1.6);
      tex.needsUpdate = true;
    },
  };
}

/** 把折线切成虚线：on 毫米画、off 毫米空 */
export function dashes(pts, on, off) {
  const out = [];
  if (pts.length < 2) return out;
  let cur = [pts[0].clone()], drawing = true, left = on;
  for (let i = 1; i < pts.length; i++) {
    let a = pts[i - 1].clone();
    const b = pts[i];
    let seg = a.distanceTo(b);
    while (seg > left) {
      const p = a.clone().lerp(b, left / seg);
      if (drawing) { cur.push(p); out.push(cur); } else cur = [p];
      seg -= left;
      a = p;
      drawing = !drawing;
      left = drawing ? on : off;
    }
    left -= seg;
    if (drawing) cur.push(b.clone());
  }
  if (drawing && cur.length > 1) out.push(cur);
  return out;
}

/** 箭头：返回两条笔画（杆 + 箭头），nrm 给定箭头所在平面的法向 */
export function arrow(from, vec, { head = 2.6, width = 1.1, plane = V(0, 0, 1) } = {}) {
  const len = vec.length();
  if (len < 0.4) return [];
  const tip = from.clone().add(vec), u = vec.clone().divideScalar(len);
  const side = new THREE.Vector3().crossVectors(plane, u).normalize();
  const h = Math.min(head, len * 0.6);
  return [
    { points: [from.clone(), tip], width, taper: false },
    { points: [tip.clone().addScaledVector(u, -h).addScaledVector(side, h * 0.55), tip, tip.clone().addScaledVector(u, -h).addScaledVector(side, -h * 0.55)], width, taper: false },
  ];
}

/** 竖立的圆（在 xy 平面，圆心 c） */
export function ringXY(c, r, n = 48, a0 = 0, a1 = Math.PI * 2) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return V(c.x + r * Math.cos(a), c.y + r * Math.sin(a), c.z);
  });
}

/** 水平的圆（xz 平面） */
export function ringXZ(c, r, n = 48) {
  return circlePts(r, 0, n).map((p) => p.add(c));
}

/** 线段 a→b 上的一串刻度 */
export function ticks(a, b, n, len, dir) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const p = a.clone().lerp(b, i / n);
    out.push({ points: [p, p.clone().addScaledVector(dir, len * (i % 2 ? 0.55 : 1))], width: i % 2 ? 0.5 : 0.75, taper: false });
  }
  return out;
}
