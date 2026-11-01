import * as THREE from 'three';

// “插图立起来”的顶点变换，墨线和纸面材质共用。
//
// 插图有自己的坐标系（uScene）：原点在书页上的“折线”处，x 沿页面向右，y 垂直页面向上，z 朝向读者。
// 物体都在折线后面（z ≤ 0）、页面上方（y ≥ 0）。
// lift = 0：整幅图绕折线向后放倒贴在纸上，深度按斜投影（uCab）画成斜线——就是一张课本插图；
// lift = 1：立起来，变成真正的 3D。中间连续过渡：先转起来，深度最后才从斜线变回真实深度。

export const POP_GLSL = /* glsl */ `
uniform mat4 uScene; uniform mat4 uSceneInv; uniform vec2 uCab;
vec3 popWorld(vec3 w, float lift) {
  if (lift > 0.9995) return w;
  vec3 q = (uSceneInv * vec4(w, 1.0)).xyz;
  float depth = max(0.0, -q.z);
  float u = clamp(lift, 0.0, 1.0);
  float ang = 1.5707963 * u * u * (3.0 - 2.0 * u);
  float realDepth = pow(u, 8.0);
  float X = q.x + (1.0 - realDepth) * depth * uCab.x;
  float Y = q.y + (1.0 - realDepth) * depth * uCab.y;
  vec3 r = vec3(X, 0.0, 0.0) + Y * vec3(0.0, sin(ang), -cos(ang)) + realDepth * depth * vec3(0.0, -cos(ang), -sin(ang));
  r.y = max(r.y, 0.06 + 0.02 * u);
  return (uScene * vec4(r, 1.0)).xyz;
}`;

/** 斜投影：深度缩到 0.4，倾角约 35° */
export const CABINET = new THREE.Vector2(0.4 * Math.cos(0.61), 0.4 * Math.sin(0.61));

export function popUniforms() {
  return {
    uScene: { value: new THREE.Matrix4() },
    uSceneInv: { value: new THREE.Matrix4() },
    uCab: { value: CABINET.clone() },
  };
}
