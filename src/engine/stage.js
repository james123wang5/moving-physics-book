import * as THREE from 'three';
import { roomEnvironment } from './environment.js';
import { oakTexture, linoTexture, windowCookie } from './textures.js';
import { createPost } from './post.js';

// 舞台：渲染器、相机、窗光、桌面和垫板、后期、主循环。单位：毫米。
// 书放在原点附近，书脊沿 z 轴；桌面垫板的上表面在 y = DESK_TOP。

export const DESK_TOP = -11;
const PAD_T = 2.5;
const WINDOW_DIR = new THREE.Vector3(-0.6, 0.66, -0.48).normalize();

// 书摊开时的机位（屏幕宽高比 1.6 时）
export const VIEW_OPEN = {
  pos: new THREE.Vector3(16, 430, 400),
  look: new THREE.Vector3(12, 24, 4),
  fov: 30,
};

export class Stage {
  constructor(container) {
    this.container = container;
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#b9b0a2');
    scene.environment = roomEnvironment(renderer, { windowDir: WINDOW_DIR });
    scene.environmentIntensity = 0.75;
    this.scene = scene;

    this.camera = new THREE.PerspectiveCamera(VIEW_OPEN.fov, 16 / 9, 20, 9000);
    this.view = { pos: VIEW_OPEN.pos.clone(), look: VIEW_OPEN.look.clone(), fov: VIEW_OPEN.fov };
    this.goal = { pos: VIEW_OPEN.pos.clone(), look: VIEW_OPEN.look.clone(), fov: VIEW_OPEN.fov };

    this.addLights();
    this.addDesk();

    this.post = createPost(renderer, scene, this.camera);
    this.updaters = new Set();
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.enableAll();
    this.ndcPt = new THREE.Vector2();
    this.clock = new THREE.Clock();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    renderer.setAnimationLoop(() => this.frame());
  }

  addLights() {
    const { scene } = this;
    // 主光：从窗户方向打进来的聚光灯，贴窗形光斑
    const key = new THREE.SpotLight(new THREE.Color('#f3f7ff'), 4.2, 0, 0.36, 0.35, 0);
    key.position.copy(WINDOW_DIR).multiplyScalar(2300);
    key.target.position.set(0, DESK_TOP, 20);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1400;
    key.shadow.camera.far = 3300;
    key.shadow.bias = -2e-4;
    key.shadow.normalBias = 0.8;
    key.shadow.radius = 2.4;
    scene.add(key, key.target);
    key.map = windowCookie(key, DESK_TOP);
    this.key = key;
    // 半球光：上冷下暖，很弱
    this.hemi = new THREE.HemisphereLight(new THREE.Color('#dce7f6'), new THREE.Color('#c9ad8a'), 0.35);
    scene.add(this.hemi);
  }

  addDesk() {
    const { scene } = this;
    const deskY = DESK_TOP - PAD_T;
    // 橡木桌面
    const oak = oakTexture();
    const deskGeo = new THREE.PlaneGeometry(8000, 8000);
    const uv = deskGeo.attributes.uv, pos = deskGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) / oak.W, -pos.getY(i) / oak.H);
    const desk = new THREE.Mesh(deskGeo, new THREE.MeshStandardMaterial({
      map: oak.map, roughnessMap: oak.roughnessMap, roughness: 1,
      normalMap: oak.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 0.8,
    }));
    desk.rotation.x = -Math.PI / 2;
    desk.position.y = deskY;
    desk.receiveShadow = true;
    scene.add(desk);

    // 油毡垫板：640×430 的圆角板，四周倒一点小斜边
    const lino = linoTexture();
    for (const t of [lino.map, lino.normalMap, lino.roughnessMap]) t.repeat.set(1 / lino.tile, 1 / lino.tile);
    const PW = 640, PD = 430, rad = 7, bev = 0.5;
    const s = new THREE.Shape();
    const x0 = -PW / 2 + bev, x1 = PW / 2 - bev, z0 = -PD / 2 + bev, z1 = PD / 2 - bev;
    s.moveTo(x0 + rad, z0);
    s.lineTo(x1 - rad, z0); s.quadraticCurveTo(x1, z0, x1, z0 + rad);
    s.lineTo(x1, z1 - rad); s.quadraticCurveTo(x1, z1, x1 - rad, z1);
    s.lineTo(x0 + rad, z1); s.quadraticCurveTo(x0, z1, x0, z1 - rad);
    s.lineTo(x0, z0 + rad); s.quadraticCurveTo(x0, z0, x0 + rad, z0);
    const padGeo = new THREE.ExtrudeGeometry(s, { depth: PAD_T - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 5 });
    padGeo.translate(0, 0, bev);
    padGeo.rotateX(-Math.PI / 2);
    const puv = padGeo.attributes.uv, ppos = padGeo.attributes.position;
    for (let i = 0; i < puv.count; i++) puv.setXY(i, ppos.getX(i), ppos.getZ(i));
    const pad = new THREE.Mesh(padGeo, [
      new THREE.MeshStandardMaterial({ map: lino.map, normalMap: lino.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: lino.roughnessMap, roughness: 1, envMapIntensity: 0.7 }),
      new THREE.MeshStandardMaterial({ color: '#6f6a5d', roughness: 0.9 }),
    ]);
    pad.position.set(0, deskY, 12);
    pad.receiveShadow = pad.castShadow = true;
    scene.add(pad);
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h);
    this.size = { w, h };
  }

  /** 设置相机目标；窗口比 16:10 窄时自动拉远 */
  setView(pos, look, fov = 30) {
    const n = this.camera.aspect;
    const s = n < 1.6 ? Math.pow(1.6 / n, n < 1 ? 0.75 : 0.9) : 1;
    this.goal.pos.copy(pos).sub(look).multiplyScalar(s).add(look);
    this.goal.look.copy(look);
    this.goal.fov = fov;
  }

  snapView() {
    this.view.pos.copy(this.goal.pos);
    this.view.look.copy(this.goal.look);
    this.view.fov = this.goal.fov;
  }

  onUpdate(fn) { this.updaters.add(fn); return () => this.updaters.delete(fn); }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    const k = 1 - Math.exp(-dt * 4);
    this.view.pos.lerp(this.goal.pos, k);
    this.view.look.lerp(this.goal.look, k);
    this.view.fov += (this.goal.fov - this.view.fov) * k;
    const cam = this.camera;
    cam.position.copy(this.view.pos);
    cam.lookAt(this.view.look);
    if (Math.abs(cam.fov - this.view.fov) > 1e-3) { cam.fov = this.view.fov; cam.updateProjectionMatrix(); }
    for (const fn of this.updaters) fn(dt, t);
    this.post.render(dt);
  }

  ndc(ev) {
    const r = this.renderer.domElement.getBoundingClientRect();
    return this.ndcPt.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  }

  pick(ev, objects) {
    this.raycaster.setFromCamera(this.ndc(ev), this.camera);
    return this.raycaster.intersectObjects(objects, true);
  }
}
