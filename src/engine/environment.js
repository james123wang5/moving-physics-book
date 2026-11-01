import * as THREE from 'three';

// 程序生成的环境光：一个灰色房间，窗户方向有四格发亮的窗玻璃，对面有一块暖色反光墙。
// 用 PMREM 预滤波后当 scene.environment，书和桌子的反光、柔和明暗都来自它。

export function roomEnvironment(renderer, { windowDir, sigma = 0.02 } = {}) {
  const scene = new THREE.Scene();
  const mat = (r, g, b, side = THREE.BackSide) => {
    const m = new THREE.MeshBasicMaterial({ side, toneMapped: false });
    m.color.setRGB(r, g, b);
    return m;
  };
  const R = 3000;
  // 六面墙：+x, -x, +y(天花板), -y(地面), +z, -z
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(2 * R, 2 * R, 2 * R), [
    mat(0.44, 0.44, 0.45), mat(0.40, 0.40, 0.42), mat(0.62, 0.63, 0.66),
    mat(0.26, 0.23, 0.20), mat(0.36, 0.36, 0.38), mat(0.46, 0.47, 0.49),
  ]));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), mat(0.40, 0.36, 0.30, THREE.DoubleSide));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -40;
  scene.add(floor);

  // 窗：窗框 + 四块发亮的玻璃（上面两块更亮，偏天空的冷色）
  const dir = windowDir.clone().normalize();
  const win = new THREE.Group();
  win.position.copy(dir).multiplyScalar(2400);
  win.lookAt(0, 0, 0);
  scene.add(win);
  const ww = 1500, wh = 1900, mullion = 70;
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(ww + 220, wh + 220), mat(0.85, 0.86, 0.88, THREE.DoubleSide));
  frame.position.z = -2;
  win.add(frame);
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(ww / 2 - mullion, wh / 2 - mullion), mat(3.0, 3.2, 3.6, THREE.DoubleSide));
    if (sy > 0) pane.material.color.setRGB(3.4, 3.7, 4.2);
    pane.position.set((sx * ww) / 4, (sy * wh) / 4, 0);
    win.add(pane);
  }
  // 对面的暖色反光
  const bounce = new THREE.Mesh(new THREE.PlaneGeometry(1100, 1000), mat(1.5, 1.44, 1.34, THREE.DoubleSide));
  bounce.position.copy(new THREE.Vector3(0.62, 0.5, -0.61).normalize().multiplyScalar(2600));
  bounce.lookAt(0, 0, 0);
  scene.add(bounce);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, sigma, 10, 20000);
  pmrem.dispose();
  scene.traverse((o) => {
    o.geometry?.dispose();
    (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m?.dispose());
  });
  return rt.texture;
}
