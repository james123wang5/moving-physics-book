import * as THREE from 'three';
import { rng, gradientNoise, fbm, heightToNormal } from '../engine/noise.js';

// 书本的材质与程序贴图：纸面、纸边、布面（带烫金和压凹）、丝带、堵头布。

export const PAPER = '#f5efe2';

function dataTex(data, w, h, { srgb = false, wrap = THREE.RepeatWrapping } = {}) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.wrapS = t.wrapT = wrap;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** 纸面法线：低频起伏 + 一根根短纤维。tile = 一个平铺单元（毫米） */
export function paperNormal({ px = 512, strength = 2.2, seed = 11 } = {}) {
  const n = px;
  const big = gradientNoise(seed, 8), small = gradientNoise(seed + 5, 32);
  const r = rng(seed);
  const h = new Float32Array(n * n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n;
      h[y * n + x] = fbm(big, u * 8, v * 8, 3) * 0.5 + small(u * 32, v * 32) * 0.25;
    }
  }
  for (let i = 0; i < n * 6; i++) {
    let x = r() * n, y = r() * n;
    const a = r() * Math.PI, len = 4 + r() * 14, k = 0.25 + r() * 0.35;
    for (let j = 0; j < len; j++) {
      const xi = ((Math.round(x) % n) + n) % n, yi = ((Math.round(y) % n) + n) % n;
      h[yi * n + xi] += k;
      x += Math.cos(a); y += Math.sin(a);
    }
  }
  return dataTex(heightToNormal(h, n, n, strength, true), n, n);
}

/** 平铺贴图按物体尺寸复制一份，重复次数 = 尺寸 / 22 毫米 */
export function tiledFor(tex, w, h) {
  const t = tex.clone();
  t.repeat.set(w / 22, h / 22);
  t.needsUpdate = true;
  return t;
}

/** 主光方向/颜色，供纸页透光用（每帧由舞台更新） */
export function keyUniforms() {
  return { uKeyDir: { value: new THREE.Vector3(0, 1, 0) }, uKeyColor: { value: new THREE.Color(0, 0, 0) } };
}

const white1 = () => { const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); t.needsUpdate = true; return t; };
const black1 = () => { const t = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); t.needsUpdate = true; return t; };
const flatN = () => { const t = new THREE.DataTexture(new Uint8Array([128, 128, 255, 255]), 1, 1); t.needsUpdate = true; return t; };

/**
 * 书页材质：白纸 + 纸面法线 + 画布贴图（印刷内容）。另有三个“插槽”：
 * uInk（手写墨迹层）、uPrint（插图的印刷版，渐隐）、uSpill（发光物体溢到纸上的彩色光），
 * 都按页面毫米坐标贴在指定矩形里；uTrans 让逆光时纸透出一点亮。
 */
export function pageMaterial({ normal, key, W, D }) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.86, metalness: 0, normalMap: normal, normalScale: new THREE.Vector2(0.22, 0.22) });
  const u = {
    uPageSize: { value: new THREE.Vector2(W, D) },
    uInk: { value: white1() }, uInkRect: { value: new THREE.Vector4() },
    uPrint: { value: white1() }, uPrintRect: { value: new THREE.Vector4() }, uPrintAlpha: { value: 0 },
    uSpill: { value: black1() }, uSpillRect: { value: new THREE.Vector4() }, uSpillGain: { value: 1 },
    uTrans: { value: 0 },
    uKeyDir: key.uKeyDir, uKeyColor: key.uKeyColor,
  };
  m.userData.uniforms = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPageUv;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvPageUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec2 uPageSize;
uniform sampler2D uInk; uniform vec4 uInkRect;
uniform sampler2D uPrint; uniform vec4 uPrintRect; uniform float uPrintAlpha;
uniform sampler2D uSpill; uniform vec4 uSpillRect; uniform float uSpillGain;
uniform float uTrans; uniform vec3 uKeyDir; uniform vec3 uKeyColor;
varying vec2 vPageUv;
vec3 slotUv(vec2 mm, vec4 r) {
  vec2 q = (mm - r.xy) / max(r.zw, vec2(1e-4));
  float inside = step(0.0, q.x) * step(0.0, q.y) * step(q.x, 1.0) * step(q.y, 1.0) * step(1e-4, r.z);
  return vec3(clamp(vec2(q.x, 1.0 - q.y), 0.0, 1.0), inside);
}`)
      .replace('#include <map_fragment>', `
  #ifdef USE_MAP
    diffuseColor *= texture2D(map, vMapUv, -0.65);   // 负的 mip 偏置：缩小时字更锐利
  #endif
  vec2 pageMm = vec2(vPageUv.x, 1.0 - vPageUv.y) * uPageSize;
  { vec3 q = slotUv(pageMm, uInkRect); vec4 k = texture2D(uInk, q.xy); diffuseColor.rgb *= mix(vec3(1.0), k.rgb, k.a * q.z); }
  { vec3 q = slotUv(pageMm, uPrintRect); vec4 k = texture2D(uPrint, q.xy); diffuseColor.rgb *= mix(vec3(1.0), k.rgb, k.a * q.z * uPrintAlpha); }
  vec3 pageSpill; { vec3 q = slotUv(pageMm, uSpillRect); pageSpill = texture2D(uSpill, q.xy).rgb * q.z * uSpillGain; }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
  { float back = max(0.0, dot(-normal, uKeyDir)); reflectedLight.directDiffuse += uTrans * uKeyColor * back * diffuseColor.rgb; }`)
      .replace('#include <opaque_fragment>', 'outgoingLight += diffuseColor.rgb * pageSpill;\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'book-page';
  return m;
}

/** 纸边：一张张纸的细线（每张约 0.11 毫米），书页之间更明显的分界 */
export function edgeMaterial({ leafFrom, leafTo, leaf }) {
  const m = new THREE.MeshStandardMaterial({ color: new THREE.Color('#efe7d6'), roughness: 0.9, metalness: 0 });
  const u = { uLeafFrom: { value: leafFrom }, uLeafTo: { value: leafTo }, uLeaf: { value: leaf } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vEdge;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvEdge = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vEdge; uniform float uLeafFrom, uLeafTo, uLeaf;
float h1(float n) { return fract(sin(n * 91.345) * 47453.5453); }
float sheetLines(float f, float w) {
  float fw = max(fwidth(f), 1e-4);
  float d = abs(fract(f) - 0.5);
  float l = 1.0 - smoothstep(0.5 - w - fw, 0.5 - w + fw, 0.5 - d);
  return mix(l, w * 2.0, smoothstep(0.25, 0.6, fw));
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
  {
    float sig = vEdge.y;
    float sheet = sig / 0.11;
    float tone = 0.94 + 0.06 * h1(floor(sheet));
    tone = mix(tone, 0.97, smoothstep(0.3, 0.8, fwidth(sheet)));
    float lines = sheetLines(sheet, 0.12);
    float inLeaves = step(uLeafFrom, sig) * step(sig, uLeafTo);
    float leafLine = sheetLines((sig - uLeafFrom) / uLeaf + 0.5, 0.06) * inLeaves;
    float wav = 0.985 + 0.015 * sin(vEdge.x * 0.21 + floor(sheet) * 1.7);
    diffuseColor.rgb *= tone * wav * (1.0 - 0.10 * lines - 0.16 * leafLine);
  }`);
  };
  m.customProgramCacheKey = () => 'book-edge';
  return m;
}

/** 平纹布：72 根经线 / 32 毫米，经纬交替起伏；返回反照率、法线、粗糙度 */
export function weaveTextures({ tile = 32, threads = 72, px = 768, seed = 9 } = {}) {
  const n = px, cell = n / threads;
  const r = rng(seed);
  const slubA = gradientNoise(seed + 1, 8), slubB = gradientNoise(seed + 2, 8), tone = gradientNoise(seed + 3, 8);
  const mk = () => Array.from({ length: threads }, () => ({ w: 0.86 + r() * 0.22, c: (r() - 0.5) * 0.1, off: r() * 0.18 - 0.09, s: r() * 50 }));
  const warp = mk(), weft = mk();
  const thick = (th, t) => th.w * (1 + 0.1 * slubA(th.s, t * 8) + 0.35 * Math.max(0, slubB(th.s + 17, t * 8) - 0.35) * 1.6);
  const height = new Float32Array(n * n);
  const alb = new Uint8ClampedArray(n * n * 4), rough = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const gx = x / cell, gy = y / cell;
      const ix = Math.floor(gx), iy = Math.floor(gy);
      const fx = gx - ix, fy = gy - iy;
      const A = warp[ix % threads], B = weft[iy % threads];
      const wa = thick(A, y / n) * 0.5, wb = thick(B, x / n) * 0.5;
      const da = (fx - 0.5 - A.off) / wa, db = (fy - 0.5 - B.off) / wb;
      const over = (ix + iy) % 2 === 0;
      const pa = Math.max(0, 1 - da * da), pb = Math.max(0, 1 - db * db);
      const sy = Math.sin(Math.PI * fy), sx = Math.sin(Math.PI * fx);
      const ha = Math.sqrt(pa) * (over ? 0.55 + 0.45 * sy : 0.35 - 0.2 * sy);
      const hb = Math.sqrt(pb) * (over ? 0.35 - 0.2 * sx : 0.55 + 0.45 * sx);
      const hh = Math.max(Math.max(ha, hb), 0.22);
      height[y * n + x] = hh;
      const th = ha >= hb ? A : B;
      const o = (y * n + x) * 4;
      const a = 0.5 + 0.11 * (hh - 0.55) + th.c * 0.5 + 0.03 * tone((x / n) * 8, (y / n) * 8);
      alb[o] = alb[o + 1] = alb[o + 2] = Math.max(0, Math.min(255, a * 255));
      alb[o + 3] = 255;
      rough[o] = rough[o + 1] = rough[o + 2] = (0.8 - 0.1 * (hh - 0.5)) * 255;
      rough[o + 3] = 255;
    }
  }
  return { albedo: dataTex(alb, n, n), normal: dataTex(heightToNormal(height, n, n, 2.6, true), n, n), rough: dataTex(rough, n, n), tile, threads };
}

/** 丝带的罗纹 */
export function ribTextures({ tile = 6, ribs = 20, px = 256, seed = 4 } = {}) {
  const n = px, r = rng(seed), nz = gradientNoise(seed, 16);
  const amp = Array.from({ length: ribs }, () => 0.85 + r() * 0.2);
  const height = new Float32Array(n * n), alb = new Uint8ClampedArray(n * n * 4);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const g = (y / n) * ribs, i = Math.floor(g), f = g - i;
      const rib = Math.pow(Math.sin(Math.PI * f), 0.7) * amp[i % ribs];
      const tw = 0.12 * Math.sin((x / n) * Math.PI * 2 * 48 + i * 1.7);
      height[y * n + x] = rib + tw * rib + 0.04 * nz((x / n) * 16, (y / n) * 16);
      const o = (y * n + x) * 4;
      const a = 0.5 + 0.18 * (rib - 0.6) + 0.04 * tw;
      alb[o] = alb[o + 1] = alb[o + 2] = Math.max(0, Math.min(255, a * 255));
      alb[o + 3] = 255;
    }
  }
  return { albedo: dataTex(alb, n, n), normal: dataTex(heightToNormal(height, n, n, 3, true), n, n), tile };
}

/** 堵头布：蓝白相间的一粒粒 */
export function beadTextures({ beads = 16, px = 512, navy = [32, 45, 82], cream = [238, 228, 204] } = {}) {
  const w = px, h = 64;
  const alb = new Uint8ClampedArray(w * h * 4), height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const g = (x / w) * beads, i = Math.floor(g), f = g - i;
      const twist = (f * 6 + (y / h) * 2.5) % 1;
      const bump = Math.sin(Math.PI * f);
      const shade = 0.82 + 0.18 * bump - 0.1 * Math.abs(twist - 0.5);
      const col = i % 2 === 0 ? navy : cream;
      const o = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) alb[o + c] = col[c] * shade;
      alb[o + 3] = 255;
      height[y * w + x] = bump * 0.8 + 0.2 * Math.sin(twist * Math.PI);
    }
  }
  return { map: dataTex(alb, w, h, { srgb: true }), normal: dataTex(heightToNormal(height, w, h, 2, true), w, h) };
}

/**
 * 布面材质（MeshPhysical + 丝光）。layout 贴图：R = 烫金，G = 压凹，B = 色调；
 * layoutNormal 是这些凹凸的法线。aLayout < 0 的面只有布纹。
 */
export function clothMaterial({ weave, color = '#c8961e', sheen = '#f3d79a', layout = null, layoutNormal = null, foil = [0.96, 0.5, 0.24], foilRough = 0.15, foilEnv = 1.15 }) {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color), roughness: 1, roughnessMap: weave.rough, metalness: 0,
    normalMap: weave.normal, normalScale: new THREE.Vector2(0.75, 0.75),
    sheen: 1, sheenColor: new THREE.Color(sheen), sheenRoughness: 0.42,
  });
  const u = {
    uWeave: { value: weave.albedo },
    uLayout: { value: layout || black1() },
    uLayoutN: { value: layoutNormal || flatN() },
    uFoil: { value: new THREE.Color(foil[0], foil[1], foil[2]) },
    uFoilRough: { value: foilRough },
    uFoilEnv: { value: foilEnv },
    uThreads: { value: weave.threads ?? 72 },
  };
  m.userData.uniforms = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aLayout; varying vec2 vLayout;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvLayout = aLayout;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vLayout; uniform sampler2D uWeave, uLayout, uLayoutN; uniform vec3 uFoil; uniform float uFoilRough, uFoilEnv, uThreads;')
      .replace('#include <map_fragment>', `#include <map_fragment>
  float hasLay = step(0.0, vLayout.x);
  vec4 lay = texture2D(uLayout, clamp(vLayout, 0.0, 1.0));
  float foilK = lay.r * hasLay, deb = lay.g * hasLay, layTone = mix(0.5, lay.b, hasLay);
  // 比两个像素还细的线纱淡成平均色，避免摩尔纹
  float threadPx = length(fwidth(vNormalMapUv * uThreads));
  float fine = 1.0 - smoothstep(0.32, 0.62, threadPx);
  float wv = mix(0.5, texture2D(uWeave, vNormalMapUv).r, mix(0.35, 1.0, fine));
  vec3 cloth = diffuseColor.rgb * (2.0 * wv) * (1.0 + (layTone - 0.5) * 1.6) * (1.0 - 0.22 * deb);
  vec3 metal = uFoil * (0.9 + 0.2 * wv);
  diffuseColor.rgb = mix(cloth, metal, foilK);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(roughnessFactor * 0.92 * (1.0 - 0.25 * deb), uFoilRough * (0.75 + 0.5 * wv), foilK);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  metalnessFactor = mix(metalnessFactor, 1.0, foilK);`)
      .replace('#include <normal_fragment_maps>', `
  {
    vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
    mapN.xy *= normalScale * (1.0 - 0.1 * foilK) * (1.0 - 0.45 * deb) * mix(0.3, 1.0, fine);
    vec3 ln = texture2D( uLayoutN, clamp(vLayout, 0.0, 1.0) ).xyz * 2.0 - 1.0;
    ln = mix(vec3(0.0, 0.0, 1.0), ln, hasLay);
    mapN = normalize(vec3(mapN.xy + ln.xy, mapN.z * ln.z));
    normal = normalize( tbn * mapN );
  }`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
  material.sheenColor *= (1.0 - foilK);`)
      .replace('#include <lights_fragment_end>', `radiance *= mix(1.0, uFoilEnv, foilK);
#include <lights_fragment_end>`);
  };
  m.customProgramCacheKey = () => 'book-cloth';
  return m;
}

export function ribbonMaterial(rib) {
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1f2b52'), roughness: 0.62, normalMap: rib.normal, normalScale: new THREE.Vector2(0.9, 0.9),
    sheen: 0.8, sheenColor: new THREE.Color('#8ea0d8'), sheenRoughness: 0.35, side: THREE.DoubleSide,
  });
  const u = { uWeave: { value: rib.albedo } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uWeave;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= 2.0 * texture2D(uWeave, vNormalMapUv).r;');
  };
  m.customProgramCacheKey = () => 'book-ribbon';
  return m;
}

export function headbandMaterial(beads) {
  return new THREE.MeshPhysicalMaterial({
    map: beads.map, normalMap: beads.normal, normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.4,
  });
}

/**
 * 封面版面：分别画“烫金”和“压凹”两张黑底白字的图，模糊后合成：
 * R = 烫金覆盖，G = 压凹覆盖，B = 布面色调噪声；并据此生成凹凸法线。
 * foilFn/debossFn(ctx) 在毫米坐标里画（白色）。
 */
export function coverLayout(Wmm, Dmm, pxPerMm, { foil, deboss, seed = 2, foilDepth = 0.35, debossDepth = 1 } = {}) {
  const w = Math.round(Wmm * pxPerMm), h = Math.round(Dmm * pxPerMm);
  const layer = (fn) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.scale(pxPerMm, pxPerMm);
    g.fillStyle = g.strokeStyle = '#fff';
    if (fn) fn(g);
    return c;
  };
  const [foilC, debC] = [layer(foil), layer(deboss)];
  const blur = (src, px) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.filter = `blur(${px.toFixed(2)}px)`;
    g.drawImage(src, 0, 0);
    return g.getImageData(0, 0, w, h).data;
  };
  const debB = blur(debC, 0.22 * pxPerMm);
  const foilB = blur(foilC, 0.12 * pxPerMm);
  const foilRaw = foilC.getContext('2d').getImageData(0, 0, w, h).data;
  const tone = gradientNoise(seed), fine = gradientNoise(seed + 9);
  const out = new Uint8ClampedArray(w * h * 4);
  const height = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const t = 0.5 + 0.05 * fbm(tone, x / pxPerMm / 60, y / pxPerMm / 60, 3) + 0.02 * fine(x / pxPerMm / 9, y / pxPerMm / 9);
      out[o] = foilRaw[o];
      out[o + 1] = debB[o];
      out[o + 2] = Math.max(0, Math.min(255, t * 255));
      out[o + 3] = 255;
      height[y * w + x] = -(foilB[o] / 255) * foilDepth - (debB[o] / 255) * debossDepth;
    }
  }
  const lay = dataTex(out, w, h, { wrap: THREE.ClampToEdgeWrapping });
  const nrm = dataTex(heightToNormal(height, w, h, pxPerMm * 0.9, false), w, h, { wrap: THREE.ClampToEdgeWrapping });
  return { layout: lay, normal: nrm };
}
