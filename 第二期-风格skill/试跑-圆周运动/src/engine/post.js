import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, Effect, SMAAEffect, SMAAPreset, VignetteEffect, BloomEffect } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { GlassEffect } from '../ui/glass.js';

// 后期链：环境光遮蔽（N8AO）→ SMAA 抗锯齿 → 暗角 → 保色相的 Neutral 色调映射。

// Khronos PBR Neutral 色调映射：高光被压缩时不偏色，只略微去饱和。
const NEUTRAL = /* glsl */ `
uniform float uExposure;
uniform float uDesat;
vec3 neutralTone(vec3 c) {
  c *= uExposure;
  const float start = 0.76;
  float x = min(c.r, min(c.g, c.b));
  float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  c -= offset;
  float peak = max(c.r, max(c.g, c.b));
  if (peak < start) return c;
  float d = 1.0 - start;
  float newPeak = 1.0 - d * d / (peak + d - start);
  c *= newPeak / peak;
  float g = 1.0 - 1.0 / (uDesat * (peak - newPeak) + 1.0);
  return mix(c, vec3(newPeak), g);
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  outputColor = vec4(neutralTone(max(inputColor.rgb, 0.0)), inputColor.a);
}`;

export class NeutralToneEffect extends Effect {
  constructor({ exposure = 1, desaturation = 0.03 } = {}) {
    super('NeutralTone', NEUTRAL, {
      uniforms: new Map([
        ['uExposure', new THREE.Uniform(exposure)],
        ['uDesat', new THREE.Uniform(desaturation)],
      ]),
    });
  }
  get exposure() { return this.uniforms.get('uExposure').value; }
  set exposure(v) { this.uniforms.get('uExposure').value = v; }
}

export function createPost(renderer, scene, camera) {
  const size = renderer.getSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer, { multisampling: 0, frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));
  const ao = new N8AOPostPass(scene, camera, size.x, size.y);
  Object.assign(ao.configuration, {
    aoRadius: 14,
    distanceFalloff: 2,
    intensity: 2,
    aoSamples: 8,
    denoiseSamples: 4,
    denoiseRadius: 6,
    halfRes: true,
    depthAwareUpsampling: true,
    gammaCorrection: false,
    // 插图表面淡入时是透明的：按不透明度计入遮蔽，避免看不见的表面在纸上留下亮斑
    transparencyAware: true,
  });
  ao.configuration.color = new THREE.Color('#2a2622');
  composer.addPass(ao);
  const smaa = new SMAAEffect({ preset: SMAAPreset.HIGH });
  // 辉光：只让亮度超过 1 的东西（发光液体、火花、水流）泛光
  const bloom = new BloomEffect({ luminanceThreshold: 1.8, luminanceSmoothing: 0.35, intensity: 0.9, mipmapBlur: true, radius: 0.62 });
  bloom.resolution.scale = 0.5;
  const vignette = new VignetteEffect({ offset: 0.28, darkness: 0.42 });
  const tone = new NeutralToneEffect();
  composer.addPass(new EffectPass(camera, smaa, bloom, vignette, tone));
  // 界面玻璃要采样周围像素，单独一遍，放在色调映射之后
  const glass = new GlassEffect();
  composer.addPass(new EffectPass(camera, glass));
  return {
    composer, ao, smaa, bloom, vignette, tone, glass,
    // composer 会按实际像素（乘过像素比）给每一遍设尺寸；这里不能再按 CSS 尺寸设 AO，否则高分屏上遮蔽层错位成重影
    setSize(w, h) { composer.setSize(w, h); },
    render(dt) { composer.render(dt); },
  };
}
