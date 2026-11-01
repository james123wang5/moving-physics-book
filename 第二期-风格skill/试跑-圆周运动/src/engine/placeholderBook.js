import * as THREE from 'three';
import { DESK_TOP } from './stage.js';

// 第 1 轮用的临时书：只为对照光照和材质。第 2 轮换成真正的书本模型。

const W = 190, D = 250, OVER = 4, BOARD = 3, CX = 9.45, STACK = 10;

export function placeholderBook() {
  const g = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: '#c99a2e', roughness: 0.85, envMapIntensity: 0.8 });
  const paper = new THREE.MeshStandardMaterial({ color: '#f4f0e6', roughness: 0.92, envMapIntensity: 0.9 });
  const edge = new THREE.MeshStandardMaterial({ color: '#e9e3d4', roughness: 0.95 });

  const base = DESK_TOP;
  for (const side of [-1, 1]) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(W + OVER + CX - 2, BOARD, D + 2 * OVER), cloth);
    board.position.set(side * ((W + OVER + CX - 2) / 2 + 2), base + BOARD / 2, 0);
    board.castShadow = board.receiveShadow = true;
    g.add(board);

    // 书页叠：截面上沿靠书脊处下弯
    const top = (x) => base + BOARD + STACK - 6 * Math.pow(Math.max(0, 1 - (x - CX) / 40), 2);
    const s = new THREE.Shape();
    s.moveTo(side * CX, base + BOARD);
    for (let i = 0; i <= 40; i++) {
      const x = CX + (W * Math.pow(i / 40, 1.4));
      s.lineTo(side * x, top(x));
    }
    s.lineTo(side * (CX + W), base + BOARD);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -D / 2);
    const block = new THREE.Mesh(geo, [paper, edge]);
    block.castShadow = block.receiveShadow = true;
    g.add(block);
  }
  // 书脊
  const spine = new THREE.Mesh(new THREE.BoxGeometry(2 * CX + 2, BOARD, D + 2 * OVER), cloth);
  spine.position.set(0, base + BOARD / 2 - 0.5, 0);
  spine.receiveShadow = true;
  g.add(spine);
  // 丝带书签：从书脊底部垂出来
  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(5, 0.4, 60), new THREE.MeshStandardMaterial({ color: '#1f2a44', roughness: 0.7 }));
  ribbon.position.set(1, base + 0.3, D / 2 + 28);
  ribbon.castShadow = true;
  g.add(ribbon);
  return g;
}
