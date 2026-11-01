import * as THREE from 'three';
import { Effect, EffectAttribute } from 'postprocessing';

// “液态玻璃”：界面控件后面的那块玻璃在后期里画——边缘折射、磨砂模糊、色散、高光边和投影；
// zoom > 1 时变成清晰的放大镜。最多 8 块，由 DOM 元素的位置驱动。

const MAX = 8;

const FRAG = /* glsl */ `
uniform vec4 uRects[${MAX}];   // x, y, w, h（设备像素，左上为原点）
uniform vec4 uStyle[${MAX}];   // 圆角半径、磨砂程度、强度、按下
uniform vec4 uExtra[${MAX}];   // 放大倍数
uniform int uCount;
uniform vec2 uRes;

float sdBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
vec3 frost(vec2 uv, float px) {
  vec3 c = vec3(0.0); float w = 0.0;
  for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) {
    vec2 o = vec2(float(i), float(j)) * px / uRes;
    float k = 1.0 - 0.12 * float(i * i + j * j);
    c += texture2D(inputBuffer, uv + o).rgb * k; w += k;
  }
  return c / w;
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 frag = vec2(uv.x * uRes.x, (1.0 - uv.y) * uRes.y);
  vec3 col = inputColor.rgb;
  float shadow = 0.0;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uCount) break;
    vec4 R = uRects[i]; vec4 S = uStyle[i]; float zoom = uExtra[i].x;
    if (S.z < 0.01) continue;
    vec2 hb = R.zw * 0.5, c = R.xy + hb, p = frag - c;
    float r = min(S.x, min(hb.x, hb.y));
    float d = sdBox(p, hb, r);
    if (d > 0.0) { float sd = sdBox(p - vec2(0.0, 7.0), hb, r); shadow = max(shadow, (1.0 - smoothstep(0.0, 20.0, sd)) * 0.16 * S.z); continue; }
    float e = 1.0;
    vec2 g = vec2(sdBox(p + vec2(e, 0.0), hb, r) - sdBox(p - vec2(e, 0.0), hb, r), sdBox(p + vec2(0.0, e), hb, r) - sdBox(p - vec2(0.0, e), hb, r));
    vec2 n = normalize(g + 1e-5);
    float band = min(24.0, min(hb.x, hb.y) * 0.9);
    float edge = 1.0 - smoothstep(0.0, band, -d);
    float lens = edge * edge * (1.0 + 0.6 * S.w);
    vec2 off = -n * lens * 30.0 / uRes; off.y = -off.y;
    float disp = edge * edge * 3.0 / uRes.x;
    vec3 refr;
    if (zoom > 1.01) {
      vec2 cuv = vec2(c.x / uRes.x, 1.0 - c.y / uRes.y);
      vec2 zuv = cuv + (uv - cuv) / zoom + off * 0.6;
      refr = vec3(texture2D(inputBuffer, zuv + vec2(disp * 1.5, 0.0)).r, texture2D(inputBuffer, zuv).g, texture2D(inputBuffer, zuv - vec2(disp * 1.5, 0.0)).b);
    } else {
      refr = vec3(frost(uv + off * 1.08 + vec2(disp, 0.0), 3.4).r, frost(uv + off, 3.4).g, frost(uv + off * 0.92 - vec2(disp, 0.0), 3.4).b);
    }
    vec3 glass = mix(refr, vec3(1.0, 0.985, 0.96), S.y) * 1.04 + 0.015;
    float rim = smoothstep(2.4, 0.0, abs(d + 1.1));
    vec2 L = normalize(vec2(-0.6, -0.8));
    glass += rim * (0.45 + 0.55 * max(0.0, dot(n, L))) * 0.55;
    glass -= rim * max(0.0, dot(n, -L)) * 0.08 + (1.0 - smoothstep(0.0, band, -d)) * max(0.0, n.y) * 0.06;
    col = mix(col, glass, smoothstep(0.8, -0.8, d) * S.z);
    shadow = 0.0;
  }
  col *= 1.0 - shadow;
  outputColor = vec4(col, inputColor.a);
}`;

export class GlassEffect extends Effect {
  constructor() {
    super('LiquidGlass', FRAG, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map([
        ['uRects', new THREE.Uniform(Array.from({ length: MAX }, () => new THREE.Vector4()))],
        ['uStyle', new THREE.Uniform(Array.from({ length: MAX }, () => new THREE.Vector4()))],
        ['uExtra', new THREE.Uniform(Array.from({ length: MAX }, () => new THREE.Vector4(1, 0, 0, 0)))],
        ['uCount', new THREE.Uniform(0)],
        ['uRes', new THREE.Uniform(new THREE.Vector2(1, 1))],
      ]),
    });
  }
  /** rects：[{x,y,w,h,r,tint,strength,pressed,zoom}]（CSS 像素）；dpr：设备像素比 */
  setRects(rects, dpr, w, h) {
    const R = this.uniforms.get('uRects').value, S = this.uniforms.get('uStyle').value, X = this.uniforms.get('uExtra').value;
    const n = Math.min(MAX, rects.length);
    for (let i = 0; i < n; i++) {
      const q = rects[i];
      R[i].set(q.x * dpr, q.y * dpr, q.w * dpr, q.h * dpr);
      S[i].set(q.r * dpr, q.tint ?? 0.34, q.strength ?? 1, q.pressed ? 1 : 0);
      X[i].set(q.zoom ?? 1, 0, 0, 0);
    }
    this.uniforms.get('uCount').value = n;
    this.uniforms.get('uRes').value.set(w * dpr, h * dpr);
  }
}
