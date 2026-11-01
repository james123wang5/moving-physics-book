import * as THREE from 'three';
import { POP_GLSL } from './pop-glsl.js';
import { INK_COLOR } from './strokes.js';

// 插图表面的“纸 + 排线”材质。
// 排线固定在物体自身坐标里，每个物体给两个方向（hatchA、hatchB）；线条带噪声扰动、会随机断开，像铜版雕刻。
// 线在屏幕上保持笔宽：拉近时线距变大，就在两线之间淡入一层更密的排线。
// 明暗用固定的“插图光”算形体，真实主光的投影（含窗棂）只让表面再暗一点；发光物体的彩色光可以溢到表面上。

const HATCH = /* glsl */ `
uniform float uHatchQ;
float hh(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hh(i), hh(i + vec3(1, 0, 0)), f.x), mix(hh(i + vec3(0, 1, 0)), hh(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hh(i + vec3(0, 0, 1)), hh(i + vec3(1, 0, 1)), f.x), mix(hh(i + vec3(0, 1, 1)), hh(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
// 一层排线：h 是垂直于排线方向的坐标（以线距为单位），fw 是它在屏幕上的变化率
float hatchLayer(float h, vec3 p, vec3 along, float dark, float seed, float fw) {
  float f = abs(fract(h) - 0.5);
  float hw = min(mix(0.05, 0.2, dark), mix(0.55, 1.25, dark) * fw);
  float aa = max(fw * 0.7, 1e-4);
  float ln = 1.0 - smoothstep(hw - aa, hw + aa, f);
  float a = dot(p, along) / 13.0;
  float brk = vnoise(vec3(floor(h) * 2.31 + seed, a, seed * 0.37));
  float bw = max(fwidth(a) * 0.6, 1e-3);
  ln *= mix(1.0, smoothstep(0.1 - bw, 0.1 + bw, brk), uHatchQ);
  return mix(ln, 1.7 * hw, smoothstep(0.3, 0.7, fw));
}
float hatch(vec3 p, vec3 dir, vec3 along, float spacing, float dark, float seed) {
  float h = dot(p, dir) / spacing;
  h += 0.32 * (vnoise(p * 0.06 + seed) - 0.5);
  float fw = fwidth(h);
  float c = hatchLayer(h, p, along, dark, seed, fw);
  float fine = smoothstep(0.11, 0.05, fw);
  if (fine > 0.0) c = max(c, hatchLayer(h * 2.0, p, along, dark * 0.85, seed + 3.0, fw * 2.0) * fine);
  return c;
}`;

/** 全局：插图光方向（视空间，每帧更新）与排线质量 */
export const illusDir = { value: new THREE.Vector3(-0.5, 0.78, 0.36).normalize() };
export const hatchQuality = { value: 1 };
const ILLUS_WORLD = new THREE.Vector3(-0.5, 0.78, 0.36).normalize();
export function updateIllusLight(camera) {
  illusDir.value.copy(ILLUS_WORLD).transformDirection(camera.matrixWorldInverse);
}

function patchLights(chunk) {
  // 记录主光（聚光灯）经过窗形光斑和投影之后还剩多少：keyVis；点光源的彩色溢光：spill
  const spotAt = chunk.indexOf('spotLight = spotLights[ i ];');
  const reAt = chunk.indexOf('RE_Direct(', spotAt);
  let out = chunk.slice(0, reAt) + 'keyVis = max(keyVis, dot(directLight.color, vec3(0.299, 0.587, 0.114)) / max(dot(spotLight.color, vec3(0.299, 0.587, 0.114)), 1e-4));\n\t\t' + chunk.slice(reAt);
  out = out.replace('getPointLightInfo( pointLight, geometryPosition, directLight );', 'getPointLightInfo( pointLight, geometryPosition, directLight );\n\t\tspill += directLight.color * saturate( dot( geometryNormal, directLight.direction ) );');
  return 'float keyVis = 0.0; vec3 spill = vec3(0.0);\n' + out;
}

const perpendicular = (d) => {
  const ref = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  return ref.sub(d.clone().multiplyScalar(ref.dot(d))).normalize();
};

/**
 * @param {object} o
 * @param {string} [o.color]   纸色
 * @param {number[]} [o.hatchA] 第一层排线的法向（物体坐标）
 * @param {number[]} [o.hatchB] 第二层（交叉）排线
 * @param {number} [o.spacing] 线距（毫米）
 * @param {number} [o.shade]   暗面整体压暗多少
 */
export function paperMaterial({ color = '#fbf7ee', ink = INK_COLOR, pop, hatchA = [0.62, 0.74, 0.45], hatchB = [-0.7, 0.4, 0.6], spacing = 1.7, shade = 0.16, hatch = 1, seed = 1 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
  const A = new THREE.Vector3(...hatchA).normalize(), B = new THREE.Vector3(...hatchB).normalize();
  const u = {
    uLiftSurf: { value: 1 }, uPrint: { value: 0 }, uSurfAlpha: { value: 1 }, uPaperGain: { value: 1 },
    uInkCol: { value: new THREE.Color(ink) },
    uHatchA: { value: A }, uHatchB: { value: B }, uAlongA: { value: perpendicular(A) }, uAlongB: { value: perpendicular(B) },
    uSpacing: { value: spacing }, uShade: { value: shade }, uHatch: { value: hatch }, uSeed: { value: seed },
    uIllus: illusDir, uHatchQ: hatchQuality,
    uClip: { value: new THREE.Vector4(0, 0, 0, -1) },
    ...pop,
  };
  m.userData.uniforms = u;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${POP_GLSL}\nuniform float uLiftSurf; varying vec3 vObj; varying vec3 vWorldPop;`)
      .replace('#include <project_vertex>', `
        vObj = transformed;
        vec4 popW = modelMatrix * vec4(transformed, 1.0);
        vWorldPop = popW.xyz;
        vec4 mvPosition = viewMatrix * vec4(popWorld(popW.xyz, uLiftSurf), 1.0);
        gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${HATCH}
uniform vec4 uClip; varying vec3 vWorldPop;
uniform vec3 uInkCol, uHatchA, uHatchB, uAlongA, uAlongB, uIllus;
uniform float uSpacing, uShade, uHatch, uSeed, uPrint, uSurfAlpha, uPaperGain;
varying vec3 vObj;`)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n  if (dot(vec4(vWorldPop, 1.0), uClip) > 0.0) discard;')
      .replace('#include <lights_fragment_begin>', patchLights(THREE.ShaderChunk.lights_fragment_begin))
      .replace('#include <opaque_fragment>', `
        float form = saturate(dot(normal, uIllus)) * 0.82 + 0.18;
        float dark = 1.0 - form * mix(0.5, 1.0, smoothstep(0.12, 0.7, keyVis));
        float h1 = hatch(vObj, uHatchA, uAlongA, uSpacing, smoothstep(0.3, 1.0, dark), uSeed) * smoothstep(0.28, 0.45, dark);
        float h2 = hatch(vObj, uHatchB, uAlongB, uSpacing * 1.12, smoothstep(0.7, 1.0, dark), uSeed + 5.0) * smoothstep(0.64, 0.82, dark) * uHatchQ;
        float cover = clamp(max(h1, h2) + 0.25 * min(h1, h2), 0.0, 1.0) * uHatch * 0.68;
        vec3 paperCol = diffuseColor.rgb * uPaperGain * (1.0 - uShade * dark);
        vec3 col = paperCol + diffuseColor.rgb * spill * 0.9;
        if (uPrint > 0.5) col = vec3(1.0);
        outgoingLight = mix(col, uInkCol, cover);
        #include <opaque_fragment>
        gl_FragColor.a = uSurfAlpha;`);
  };
  m.customProgramCacheKey = () => 'ink-paper';
  return m;
}

/** 表面淡入淡出时，投影也跟着变浅（用 alphaHash 的深度材质） */
export function fadingShadowMaterial(opacity = 1) {
  const m = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, alphaHash: true, side: THREE.DoubleSide, opacity });
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n#if DEPTH_PACKING != 3200\nuniform float opacity;\n#endif')
      .replace('#include <alphahash_fragment>', 'diffuseColor.a = opacity;\n#include <alphahash_fragment>');
  };
  m.customProgramCacheKey = () => 'ink-fading-shadow';
  return m;
}
