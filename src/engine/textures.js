import * as THREE from 'three';
import { rng, gradientNoise, fbm, smoothstep, heightToNormal } from './noise.js';

// 程序生成的材质贴图：橡木桌面、油毡垫板、窗形光斑。单位都是毫米。

function dataTexture(data, w, h, { srgb = false, repeat = true } = {}) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * 浅色橡木桌面：一条条横向木板，每条有自己的宽度、色调和木纹走向。
 * 返回 {map, roughnessMap, normalMap, W, H}，贴图覆盖 W×H 毫米并可平铺。
 */
export function oakTexture({ W = 1400, H = 900, pxPerMm = 1.2, seed = 5 } = {}) {
  const w = Math.round(W * pxPerMm), h = Math.round(H * pxPerMm);
  const warp = gradientNoise(seed), fine = gradientNoise(seed + 11), band = gradientNoise(seed + 23);
  const tone = gradientNoise(seed + 37), pore = gradientNoise(seed + 51), ray = gradientNoise(seed + 63);
  const r = rng(seed * 31 + 7);

  // 木板：宽 95–150 mm
  const planks = [];
  for (let y = -r() * 60; y < H + 10;) {
    const pw = 95 + r() * 55;
    planks.push({
      y0: y, y1: y + pw,
      tone: 0.975 + r() * 0.04,
      cool: r() - 0.5,
      freq: 0.45 + r() * 0.35,
      phase: r() * 50,
      rays: r() < 0.55 ? 0.6 + r() * 0.4 : 0,
      tilt: (r() - 0.5) * 0.004,
    });
    y += pw;
  }

  const col = new Uint8ClampedArray(w * h * 4);
  const rough = new Uint8ClampedArray(w * h * 4);
  const height = new Float32Array(w * h);
  const base = [204, 191, 168], light = [221, 210, 190], late = [168, 150, 124];
  let k = 0;
  for (let py = 0; py < h; py++) {
    const y = py / pxPerMm;
    while (k < planks.length - 1 && y > planks[k].y1) k++;
    const P = planks[k];
    const ly = y - P.y0;
    for (let px = 0; px < w; px++) {
      const x = px / pxPerMm;
      // 木纹坐标：按木板内的位置，被低频噪声扭曲
      const g = (ly + x * P.tilt + warp(x * 0.0016, y * 0.006 + P.phase) * 5 + fine(x * 0.004, y * 0.05 + P.phase) * 1.2) * P.freq + P.phase;
      const f = g - Math.floor(g);
      const bw = 0.18 + 0.12 * (band(x * 0.002, g * 0.21) * 0.5 + 0.5);
      const lateWood = Math.max(0, 1 - Math.abs(f - 0.62) / bw) ** 2;
      const poreBand = Math.max(0, 1 - Math.abs(f - 0.32) / 0.12);
      const pores = poreBand > 0 && pore(x * 0.55, g * 9) > 0.42 ? poreBand : 0;
      const flecks = P.rays ? Math.max(0, ray(x * 0.09, y * 0.9 + P.phase) - 0.62) * 3.2 * P.rays : 0;
      const t1 = tone(x * 0.0008, y * 0.008 + P.phase) * 0.5 + 0.5;
      const t2 = fine(x * 0.003 + 7, y * 0.25) * 0.5 + 0.5;
      const o = (py * w + px) * 4;
      for (let c = 0; c < 3; c++) {
        let v = base[c] + (light[c] - base[c]) * (t1 * 0.9 + t2 * 0.4 - 0.45);
        v = v * P.tone + P.cool * (c === 2 ? 5 : c === 0 ? -3 : 0);
        v += (late[c] - v) * lateWood * 0.55;
        v += (238 - v) * Math.min(0.35, flecks);
        if (pores) v *= 1 - 0.16 * pores;
        col[o + c] = v;
      }
      col[o + 3] = 255;
      // 木板之间的缝
      const edge = ly < 0.6 || P.y1 - y < 0.6;
      if (edge) { col[o] *= 0.88; col[o + 1] *= 0.88; col[o + 2] *= 0.88; }
      height[py * w + px] = lateWood * 0.1 - pores * 0.35 + flecks * 0.05 - (edge ? 0.6 : 0);
      const rv = 150 + pores * 60 - flecks * 30 - lateWood * 8 + (edge ? 40 : 0);
      rough[o] = rough[o + 1] = rough[o + 2] = rv;
      rough[o + 3] = 255;
    }
  }
  return {
    map: dataTexture(col, w, h, { srgb: true }),
    roughnessMap: dataTexture(rough, w, h),
    normalMap: dataTexture(heightToNormal(height, w, h, 1.0, true), w, h),
    W, H,
  };
}

/** 灰绿色油毡：斑驳底色 + 少量深浅颗粒。tile 毫米为一个平铺单元 */
export function linoTexture({ tile = 96, px = 512, seed = 21 } = {}) {
  const n = px;
  const big = gradientNoise(seed, 6), mid = gradientNoise(seed + 3, 24), small = gradientNoise(seed + 9, 64);
  const r = rng(seed);
  const col = new Uint8ClampedArray(n * n * 4);
  const rough = new Uint8ClampedArray(n * n * 4);
  const height = new Float32Array(n * n);
  const sage = [143, 154, 140];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n;
      const m = fbm(big, u * 6, v * 6, 2) * 0.6 + mid(u * 24, v * 24) * 0.3 + small(u * 64, v * 64) * 0.25;
      const o = (y * n + x) * 4;
      for (let c = 0; c < 3; c++) col[o + c] = sage[c] * (1 + 0.045 * m) + (c === 1 ? 1.5 * m : 0);
      col[o + 3] = 255;
      height[y * n + x] = small(u * 64, v * 64) * 0.5 + mid(u * 24, v * 24) * 0.3;
      rough[o] = rough[o + 1] = rough[o + 2] = 210 + 12 * m;
      rough[o + 3] = 255;
    }
  }
  // 颗粒
  const scale = n / tile;
  for (let i = 0; i < n * n * 0.004; i++) {
    const cx = r() * n, cy = r() * n, rad = (0.1 + r() * 0.18) * scale;
    const lightFleck = r() < 0.6, a = 0.35 + r() * 0.3;
    for (let yy = Math.floor(cy - rad); yy <= cy + rad; yy++) {
      for (let xx = Math.floor(cx - rad); xx <= cx + rad; xx++) {
        if ((xx - cx) ** 2 + (yy - cy) ** 2 > rad * rad) continue;
        const o = ((((yy % n) + n) % n) * n + (((xx % n) + n) % n)) * 4;
        for (let c = 0; c < 3; c++) col[o + c] = col[o + c] * (1 - a) + (lightFleck ? 196 : 104) * a;
      }
    }
  }
  return {
    map: dataTexture(col, n, n, { srgb: true }),
    normalMap: dataTexture(heightToNormal(height, n, n, 0.8, true), n, n),
    roughnessMap: dataTexture(rough, n, n),
    tile,
  };
}

/**
 * 窗形光斑：给聚光灯当贴图。逐像素算出光线落在桌面上的位置，
 * 在“沿光方向 / 垂直光方向”的坐标里判断是否落在窗框内、是否被窗棂挡住。
 */
export function windowCookie(light, deskY, {
  size = 512,
  cross = [-560, -210],          // 窗棂交叉点投在桌面上的位置（世界 x, z），亮区以它为中心
  extent = [700, 620, 900, 980], // 亮区范围：垂直光方向左、右，沿光方向后、前（毫米）
  bars = [30, 44],               // 竖棂、横棂影子的宽度
  soft = 26,
} = {}) {
  light.updateMatrixWorld();
  light.target.updateMatrixWorld();
  light.shadow.updateMatrices(light);
  const cam = light.shadow.camera;
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const unproject = new THREE.Matrix4().multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse);
  const origin = light.getWorldPosition(new THREE.Vector3());
  const along = new THREE.Vector2(light.target.position.x - origin.x, light.target.position.z - origin.z).normalize();
  const across = new THREE.Vector2(along.y, -along.x);
  const band = (x, lo, hi) => smoothstep(lo - soft, lo + soft, x) * (1 - smoothstep(hi - soft, hi + soft, x));
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const p = new THREE.Vector3();
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      p.set(((i + 0.5) / size) * 2 - 1, 1 - ((j + 0.5) / size) * 2, 0.5).applyMatrix4(unproject);
      const dir = p.sub(origin);
      const t = (deskY - origin.y) / dir.y;
      const x = origin.x + dir.x * t - cross[0];
      const z = origin.z + dir.z * t - cross[1];
      const T = x * across.x + z * across.y;
      const A = x * along.x + z * along.y;
      let v = band(T, -extent[0], extent[1]) * band(A, -extent[2], extent[3]);
      v *= smoothstep(bars[0] / 2 - soft * 0.6, bars[0] / 2 + soft * 0.6, Math.abs(T));
      v *= smoothstep(bars[1] / 2 - soft * 0.6, bars[1] / 2 + soft * 0.6, Math.abs(A));
      const o = (j * size + i) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = Math.round(255 * v);
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}
