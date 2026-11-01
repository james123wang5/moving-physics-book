import * as THREE from 'three';

// 书本里会变形的网格：书页块（有厚度）、书脊布、堵头布、丝带；以及固定形状的封面板。

/**
 * 一叠（或一张）有厚度的书页：顶面、底面、天头、地脚、切口五个面。
 * 材质组：0 顶面（右页那面 / 正面），1 底面（背面），2 四周的纸边。
 * update(S, sig0, sig1, curveOf) 中 curveOf(层号, 行号) 返回 {x,y}；层号 0 = σ下，nsig = σ上。
 */
export class LeafBlock {
  constructor({ ns, nz, nsig, W, D, materials }) {
    Object.assign(this, { ns, nz, nsig, W, D });
    const face = (ns + 1) * (nz + 1);
    const side = (ns + 1) * (nsig + 1);
    const fore = (nsig + 1) * (nz + 1);
    this.offTop = 0;
    this.offBot = face;
    this.offHead = 2 * face;
    this.offTail = 2 * face + side;
    this.offFore = 2 * face + 2 * side;
    const count = 2 * face + 2 * side + fore;
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.uv = new THREE.BufferAttribute(new Float32Array(count * 2), 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos);
    g.setAttribute('uv', this.uv);
    g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    const grid = (off, cols, rows, flip) => {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const a = off + r * (cols + 1) + c, b = a + 1, e = a + cols + 1, f = e + 1;
          if (flip) idx.push(a, e, b, b, e, f); else idx.push(a, b, e, b, f, e);
        }
      }
    };
    grid(this.offTop, ns, nz, true);
    const nTop = idx.length;
    grid(this.offBot, ns, nz, false);
    const nBot = idx.length - nTop;
    grid(this.offHead, ns, nsig, true);
    grid(this.offTail, ns, nsig, false);
    grid(this.offFore, nsig, nz, false);
    g.setIndex(idx);
    g.addGroup(0, nTop, 0);
    g.addGroup(nTop, nBot, 1);
    g.addGroup(nTop + nBot, idx.length - nTop - nBot, 2);
    this.geometry = g;
    this.mesh = new THREE.Mesh(g, materials);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  update(S, sig0, sig1, curveOf) {
    const { ns, nz, nsig, W, D } = this;
    const P = this.pos.array, U = this.uv.array;
    const zAt = (r) => -D / 2 + (D * r) / nz;
    const set = (i, x, y, z, u, v) => {
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
      U[i * 2] = u; U[i * 2 + 1] = v;
    };
    for (let r = 0; r <= nz; r++) {
      const z = zAt(r);
      const top = curveOf(nsig, r), bot = curveOf(0, r);
      const v = 1 - (z + D / 2) / D; // 页面顶端（z 负方向）在纹理的上方
      for (let i = 0; i <= ns; i++) {
        set(this.offTop + r * (ns + 1) + i, top.x[i], top.y[i], z, S[i] / W, v);
        set(this.offBot + r * (ns + 1) + i, bot.x[i], bot.y[i], z, (W - S[i]) / W, v);
      }
    }
    for (let k = 0; k <= nsig; k++) {
      const sig = sig0 + ((sig1 - sig0) * k) / nsig;
      const head = curveOf(k, 0), tail = curveOf(k, nz);
      for (let i = 0; i <= ns; i++) {
        set(this.offHead + k * (ns + 1) + i, head.x[i], head.y[i], -D / 2, S[i], sig);
        set(this.offTail + k * (ns + 1) + i, tail.x[i], tail.y[i], D / 2, S[i], sig);
      }
      for (let r = 0; r <= nz; r++) {
        const c = curveOf(k, r);
        set(this.offFore + r * (nsig + 1) + k, c.x[ns], c.y[ns], zAt(r), zAt(r), sig);
      }
    }
    this.pos.needsUpdate = true;
    this.uv.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}

/** 书脊布：沿书背的一条有厚度的带子，两端连到前后封面板 */
export class SpineCloth {
  constructor({ M = 48, BD, material }) {
    this.M = M;
    this.BD = BD;
    const count = (M + 1) * 2 * 4;
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.uv = new THREE.BufferAttribute(new Float32Array(count * 2), 2).setUsage(THREE.DynamicDrawUsage);
    this.lay = new THREE.BufferAttribute(new Float32Array(count * 2), 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos);
    g.setAttribute('uv', this.uv);
    g.setAttribute('aLayout', this.lay);
    const idx = [];
    const strip = (off, flip) => {
      for (let i = 0; i < M; i++) {
        const a = off + i * 2, b = a + 1, c = a + 2, e = a + 3;
        if (flip) idx.push(a, c, b, b, c, e); else idx.push(a, b, c, b, e, c);
      }
    };
    this.off = [0, (M + 1) * 2, (M + 1) * 4, (M + 1) * 6];
    strip(this.off[0], false); // 外表面
    strip(this.off[1], true);  // 内表面
    strip(this.off[2], true);  // 天头边
    strip(this.off[3], false); // 地脚边
    g.setIndex(idx);
    this.geometry = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  /** outer/inner: [[x,y],…]（M+1 个点）；titleCentre: 书名在书背上的弧长中点；titleLen: 书名区域长度 */
  update(outer, inner, titleCentre, titleLen) {
    const { M, BD } = this;
    const P = this.pos.array, U = this.uv.array, Lay = this.lay.array;
    const set = (i, x, y, z, u, v, lu, lv) => {
      P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
      U[i * 2] = u; U[i * 2 + 1] = v;
      Lay[i * 2] = lu; Lay[i * 2 + 1] = lv;
    };
    let s = 0;
    for (let i = 0; i <= M; i++) {
      if (i) s += Math.hypot(outer[i][0] - outer[i - 1][0], outer[i][1] - outer[i - 1][1]);
      const lu = (s - titleCentre) / titleLen + 0.5;
      for (let k = 0; k < 2; k++) {
        const z = k ? BD / 2 : -BD / 2;
        set(this.off[0] + i * 2 + k, outer[i][0], outer[i][1], z, s, z, lu, (z + BD / 2) / BD);
        set(this.off[1] + i * 2 + k, inner[i][0], inner[i][1], z, s, z, -1, -1);
      }
      set(this.off[2] + i * 2, outer[i][0], outer[i][1], -BD / 2, s, 0, -1, -1);
      set(this.off[2] + i * 2 + 1, inner[i][0], inner[i][1], -BD / 2, s, 1.3, -1, -1);
      set(this.off[3] + i * 2, outer[i][0], outer[i][1], BD / 2, s, 0, -1, -1);
      set(this.off[3] + i * 2 + 1, inner[i][0], inner[i][1], BD / 2, s, 1.3, -1, -1);
    }
    this.pos.needsUpdate = this.uv.needsUpdate = this.lay.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}

/** 堵头布：沿书背天头/地脚的一根细圆管，表面是一粒粒的蓝白相间织纹 */
export class Headband {
  constructor({ n = 24, radial = 10, radius = 1.1, material, beadsPerMm = 0.8 }) {
    Object.assign(this, { n, radial, radius, beadsPerMm });
    const count = (n + 1) * (radial + 1);
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.uv = new THREE.BufferAttribute(new Float32Array(count * 2), 2);
    g.setAttribute('position', this.pos);
    g.setAttribute('uv', this.uv);
    const idx = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j, b = a + radial + 1;
        idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    g.setIndex(idx);
    this.geometry = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  update(points) {
    const { n, radial, radius } = this;
    const P = this.pos.array, U = this.uv.array;
    const t = new THREE.Vector3(), nrm = new THREE.Vector3(), bin = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
    let s = 0;
    for (let i = 0; i <= n; i++) {
      const p = points[i];
      t.subVectors(points[Math.min(n, i + 1)], points[Math.max(0, i - 1)]).normalize();
      if (i) s += p.distanceTo(points[i - 1]);
      nrm.crossVectors(t, Z).normalize();
      bin.crossVectors(nrm, t).normalize();
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const cx = Math.cos(a) * radius, cy = Math.sin(a) * radius;
        const k = i * (radial + 1) + j;
        P[k * 3] = p.x + nrm.x * cx + bin.x * cy;
        P[k * 3 + 1] = p.y + nrm.y * cx + bin.y * cy;
        P[k * 3 + 2] = p.z + nrm.z * cx + bin.z * cy;
        U[k * 2] = (s * this.beadsPerMm) / 16;
        U[k * 2 + 1] = j / radial;
      }
    }
    this.pos.needsUpdate = this.uv.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}

/** 丝带书签：一条窄布带，rows×cols 的点阵由外部算好 */
export class Ribbon {
  constructor({ rows = 90, cols = 5, width = 6.5, material }) {
    Object.assign(this, { rows, cols, width });
    const count = rows * cols;
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.uv = new THREE.BufferAttribute(new Float32Array(count * 2), 2).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pos);
    g.setAttribute('uv', this.uv);
    const idx = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c, b = a + cols;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
    g.setIndex(idx);
    this.geometry = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  update(grid) {
    const { rows, cols, width } = this;
    const P = this.pos.array, U = this.uv.array;
    let s = 0;
    const mid = (cols - 1) >> 1;
    for (let r = 0; r < rows; r++) {
      if (r) s += grid[r][mid].distanceTo(grid[r - 1][mid]);
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c, p = grid[r][c];
        P[k * 3] = p.x; P[k * 3 + 1] = p.y; P[k * 3 + 2] = p.z;
        U[k * 2] = (c / (cols - 1)) * width;
        U[k * 2 + 1] = s;
      }
    }
    this.pos.needsUpdate = this.uv.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }
}

/**
 * 封面板：圆角倒边的长方板，x 从 0 到 W，z 居中，厚度 T（y 从 0 到 T）。
 * 正面（y=T）带 aLayout 属性（烫金书名的版面坐标），其他面 aLayout = -1。
 * recess：在正面挖一个凹槽，用来嵌插画板。
 */
export function boardGeometry(W, D, T, { bevel = 0.5, corner = 2, recess = null } = {}) {
  const s = new THREE.Shape();
  const x0 = bevel, x1 = W - bevel, z0 = -D / 2 + bevel, z1 = D / 2 - bevel, r = corner;
  s.moveTo(x0 + r, z0);
  s.lineTo(x1 - r, z0); s.quadraticCurveTo(x1, z0, x1, z0 + r);
  s.lineTo(x1, z1 - r); s.quadraticCurveTo(x1, z1, x1 - r, z1);
  s.lineTo(x0 + r, z1); s.quadraticCurveTo(x0, z1, x0, z1 - r);
  s.lineTo(x0, z0 + r); s.quadraticCurveTo(x0, z0, x0 + r, z0);
  // 挤出方向转到 +y（板厚）；外形关于 z=0 对称，旋转后 z 的正负无所谓
  const g = new THREE.ExtrudeGeometry(s, { depth: T - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, bevel);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, nrm = g.attributes.normal;
  const uv = new Float32Array(pos.count * 2), lay = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
    if (Math.abs(ny) > 0.6) { uv[i * 2] = x; uv[i * 2 + 1] = z; }
    else if (Math.abs(nx) > Math.abs(nz)) { uv[i * 2] = z; uv[i * 2 + 1] = y; }
    else { uv[i * 2] = x; uv[i * 2 + 1] = y; }
    const onFront = ny > 0.3 && y > T - bevel - 0.001;
    lay[i * 2] = onFront ? x / W : -1;
    lay[i * 2 + 1] = onFront ? (z + D / 2) / D : -1;
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aLayout', new THREE.BufferAttribute(lay, 2));
  g.clearGroups();
  g.computeBoundingSphere();
  void recess;
  return g;
}
