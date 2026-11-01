import * as THREE from 'three';
import { popUniforms, CABINET } from './pop-glsl.js';
import { inkMaterial } from './strokes.js';
import { paperMaterial, fadingShadowMaterial } from './paper.js';

// 一幅“会立起来的插图”。
// 状态：print（只是印在纸上的图）→ peel（钢笔一笔笔把线从纸上“揭”起来）→ shade（表面排线淡入）→ live（可操作）；
// undraw：表面淡出、整幅图折回纸面，最后变回印刷图。
// 印刷图：用一台带斜投影的正交相机，把立着的模型渲染成书页上的贴图（6 像素/毫米），被挡住的线自然消失。

export const POP_LAYER = 1;

/** 印刷相机 + 渲染目标；另外负责算平放那一份线条里哪些点在印刷版上被挡住 */
class PrintRenderer {
  constructor(renderer, { rect, pxPerMm = 6, cab }) {
    this.renderer = renderer;
    this.rect = rect;
    this.pxPerMm = pxPerMm;
    this.cab = cab;
    this.zc = 600;
    const w = Math.round((rect.x1 - rect.x0) * pxPerMm), h = Math.round((rect.y1 - rect.y0) * pxPerMm);
    this.size = new THREE.Vector2(w, h);
    this.target = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, colorSpace: THREE.SRGBColorSpace, samples: 4, depthBuffer: true });
    this.target.texture.generateMipmaps = false;
    this.camera = new THREE.Camera();
    this.camera.matrixAutoUpdate = false;
    this.camera.layers.set(POP_LAYER);
    this.depthTarget = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true });
    this.depthTarget.depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
    this.visMat = new THREE.ShaderMaterial({
      uniforms: { uDepth: { value: this.depthTarget.depthTexture }, uVP: { value: new THREE.Matrix4() }, uOut: { value: new THREE.Vector2(1, 1) }, uBias: { value: 0.003 } },
      vertexShader: `
        attribute float aIdx; uniform sampler2D uDepth; uniform mat4 uVP; uniform vec2 uOut; uniform float uBias; varying float vVis;
        void main() {
          vec4 c = uVP * modelMatrix * vec4(position, 1.0);
          vec3 n = c.xyz / c.w; vec2 uv = n.xy * 0.5 + 0.5; float z = n.z * 0.5 + 0.5;
          float dc = texture2D(uDepth, uv).r;
          vVis = (z - uBias <= dc || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) ? 1.0 : 0.0;
          float x = mod(aIdx, uOut.x), y = floor(aIdx / uOut.x);
          gl_Position = vec4((x + 0.5) / uOut.x * 2.0 - 1.0, (y + 0.5) / uOut.y * 2.0 - 1.0, 0.0, 1.0);
          gl_PointSize = 1.0;
        }`,
      fragmentShader: 'varying float vVis; void main() { gl_FragColor = vec4(vVis, 0.0, 0.0, 1.0); }',
      depthTest: false,
      depthWrite: false,
    });
  }

  /** 换成另一块插图区域（插图坐标）：像素尺寸不变，所以 rect 与 pxPerMm 要同比例缩放 */
  setRect(rect, pxPerMm) {
    this.rect = rect;
    this.pxPerMm = pxPerMm;
  }

  setFrame(frame) {
    const cam = this.camera;
    cam.matrix.copy(frame).multiply(new THREE.Matrix4().makeTranslation(0, 0, this.zc));
    cam.matrixWorld.copy(cam.matrix);
    cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    const { x0, x1, y0, y1 } = this.rect, c = this.cab, h = this.zc;
    const ortho = new THREE.Matrix4().makeOrthographic(x0, x1, y1, y0, 1, 2000);
    // 斜投影：往里的深度 d 让点向右上偏 (cab.x·d, cab.y·d)
    const shear = new THREE.Matrix4().set(1, 0, -c.x, -c.x * h, 0, 1, -c.y, -c.y * h, 0, 0, 1, 0, 0, 0, 0, 1);
    cam.projectionMatrix.copy(ortho).multiply(shear);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }

  /** 把 sets 里静态线条的每个顶点在印刷视角下是否可见写进 aVis */
  computeVisibility(scene, sets) {
    const r = this.renderer;
    const prev = r.getRenderTarget(), bg = scene.background;
    scene.background = null;
    r.setRenderTarget(this.depthTarget);
    r.clear(true, true, false);
    r.render(scene, this.camera);
    scene.background = bg;
    this.visMat.uniforms.uVP.value.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    const tmp = new THREE.Scene();
    const cam = new THREE.Camera();
    for (const s of sets) {
      const g = s.geometry, n = g.attributes.position?.count ?? 0;
      if (!n || s.capacity) continue;
      const side = Math.ceil(Math.sqrt(n));
      const rt = new THREE.WebGLRenderTarget(side, side, { depthBuffer: false });
      const idx = new Float32Array(n);
      for (let i = 0; i < n; i++) idx[i] = i;
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', g.attributes.position);
      pg.setAttribute('aIdx', new THREE.BufferAttribute(idx, 1));
      const pts = new THREE.Points(pg, this.visMat);
      pts.frustumCulled = false;
      s.mesh.updateWorldMatrix(true, false);
      pts.matrixAutoUpdate = false;
      pts.matrixWorld.copy(s.mesh.matrixWorld);
      pts.matrixWorldAutoUpdate = false;
      tmp.add(pts);
      this.visMat.uniforms.uOut.value.set(side, side);
      r.setRenderTarget(rt);
      r.setClearColor(0x000000, 1);
      r.clear(true, false, false);
      r.render(tmp, cam);
      const buf = new Uint8Array(side * side * 4);
      r.readRenderTargetPixels(rt, 0, 0, side, side, buf);
      const vis = g.attributes.aVis.array;
      for (let i = 0; i < n; i++) vis[i] = buf[i * 4] > 127 ? 1 : 0;
      for (let i = 0; i < n; i += 2) { const v = Math.max(vis[i], vis[i + 1]); vis[i] = vis[i + 1] = v; }
      g.attributes.aVis.needsUpdate = true;
      tmp.remove(pts);
      pg.dispose();
      rt.dispose();
    }
    r.setRenderTarget(prev);
  }

  render(scene, inkMats, paperMats, sets = []) {
    const r = this.renderer;
    const prevRT = r.getRenderTarget(), prevClear = r.getClearColor(new THREE.Color()), prevAlpha = r.getClearAlpha();
    const saved = new Map();
    const set = (u, v) => {
      if (!u) return;
      if (!saved.has(u)) saved.set(u, u.value?.clone ? u.value.clone() : u.value);
      if (u.value?.copy) u.value.copy(v); else u.value = v;
    };
    for (const m of inkMats) {
      const u = m.uniforms;
      set(u.uPrint, 1); set(u.uRes, this.size); set(u.uPxPerMm, this.pxPerMm); set(u.uLiftAll, 1); set(u.uClock, 1e6);
    }
    const writes = paperMats.map((m) => m.colorWrite);
    for (const m of paperMats) {
      const u = m.userData.uniforms;
      set(u.uPrint, 1); set(u.uLiftSurf, 1); set(u.uSurfAlpha, 1);
      m.colorWrite = true;
    }
    const bg = scene.background;
    scene.background = null;
    r.setRenderTarget(this.target);
    r.setClearColor(0xffffff, 1);
    r.clear(true, true, false);
    r.render(scene, this.camera);
    scene.background = bg;
    if (sets.length) this.computeVisibility(scene, sets);
    for (const [u, v] of saved) { if (u.value?.copy) u.value.copy(v); else u.value = v; }
    paperMats.forEach((m, i) => { m.colorWrite = writes[i]; });
    r.setRenderTarget(prevRT);
    r.setClearColor(prevClear, prevAlpha);
    return this.target.texture;
  }
}

export class PopFigure {
  static lineScale = 1.32;

  constructor(renderer, { frame, printRect, pxPerMm = 6, cab = CABINET } = {}) {
    this.renderer = renderer;
    this.u = {
      ...popUniforms(),
      uClock: { value: 0 },
      uLiftAll: { value: 1 },
      uPrint: { value: 0 },
      uPxPerMm: { value: pxPerMm },
      uRes: { value: new THREE.Vector2(1, 1) },
      uLiftSurf: { value: 1 },
      uSurfAlpha: { value: 0 },
      uStandAlpha: { value: 1 },
      uCopyAlpha: { value: 1 },
      uMinW: { value: 0 },
    };
    this.u.uCab.value.copy(cab);
    this.group = new THREE.Group();
    this.group.userData.popout = true;
    this.group.matrixAutoUpdate = false;
    this.inkMats = [];
    this.paperMats = [];
    this.sets = [];
    this.surfaces = [];
    this.state = 'print';
    this.t = 0;
    this.printAlpha = 1;
    this.printRect = printRect;
    this.print = new PrintRenderer(renderer, { rect: printRect, pxPerMm, cab: this.u.uCab.value });
    this.onState = null;
    this.setFrame(frame || new THREE.Matrix4());
  }

  setFrame(m) {
    this.group.matrix.copy(m);
    this.group.matrixWorldNeedsUpdate = true;
    this.group.updateMatrixWorld(true);
    this.u.uScene.value.copy(m);
    this.u.uSceneInv.value.copy(m).invert();
    this.print.setFrame(m);
  }

  ink(o = {}) {
    const m = inkMaterial({ ...o, widthPx: (o.widthPx ?? 1.5) * PopFigure.lineScale, pop: this.u });
    this.inkMats.push(m);
    return m;
  }

  paper(o = {}) {
    const m = paperMaterial({ ...o, pop: this.u });
    m.transparent = true;
    this.paperMats.push(m);
    return m;
  }

  addLines(set, parent = this.group) {
    set.mesh.layers.enable(POP_LAYER);
    set.flat.layers.enable(POP_LAYER);
    parent.add(set.mesh);
    this.sets.push(set);
    return set;
  }

  addSurface(mesh, parent = this.group) {
    mesh.layers.enable(POP_LAYER);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.renderOrder = 2;
    this.shadowDepth ??= fadingShadowMaterial(0);
    mesh.customDepthMaterial = this.shadowDepth;
    parent.add(mesh);
    this.surfaces.push(mesh);
    return mesh;
  }

  get drawEnd() { let t = 0; for (const s of this.sets) t = Math.max(t, s.end); return t; }

  setResolution(w, h) { this.u.uRes.value.set(w, h); }

  /** 渲染印刷版（其他立体插图暂时隐藏） */
  renderPrint(scene) {
    const dyn = this.sets.filter((s) => s.capacity);
    for (const s of dyn) s.mesh.geometry = s.flatGeometry;
    const others = [];
    scene.traverse((o) => { if (o.userData.popout && o !== this.group && o.visible) others.push(o); });
    for (const o of others) o.visible = false;
    const wasVisible = this.group.visible;
    this.group.visible = true;
    const tex = this.print.render(scene, this.inkMats, this.paperMats, this.sets);
    this.group.visible = wasVisible;
    for (const o of others) o.visible = true;
    for (const s of dyn) s.mesh.geometry = s.geometry;
    return tex;
  }

  surfacesAlpha(a) {
    this.u.uSurfAlpha.value = a;
    const write = a > 0.001;
    // 表面基本透明时不写深度：否则环境光遮蔽会把看不见的表面当成实物，在纸上留下亮斑
    for (const m of this.paperMats) { m.colorWrite = write; m.depthWrite = a > 0.25; }
    if (this.shadowDepth) this.shadowDepth.opacity = a;
    for (const s of this.surfaces) s.castShadow = a > 0.002 && s.userData.castShadow !== false;
  }

  showFlat(on) { for (const s of this.sets) s.flat.visible = on; }

  set(state) {
    this.state = state;
    this.t = 0;
    this.u.uStandAlpha.value = 1;
    this.u.uCopyAlpha.value = 1;
    if (state === 'print') {
      this.u.uClock.value = 0; this.u.uLiftAll.value = 1; this.surfacesAlpha(0); this.showFlat(false);
      this.printAlpha = 1; this.group.visible = false;
    }
    if (state === 'live') {
      this.u.uClock.value = 1e5; this.u.uLiftAll.value = 1; this.surfacesAlpha(1); this.showFlat(false);
      this.printAlpha = 0; this.group.visible = true;
    }
    this.onState?.(state);
  }

  /** 从印刷图开始画出来 */
  draw() {
    if (this.state !== 'print') return;
    this.state = 'peel';
    this.t = 0;
    this.group.visible = true;
    this.u.uCopyAlpha.value = 0;
    this.u.uClock.value = 0;
    this.u.uLiftAll.value = 1;
    this.surfacesAlpha(0);
    this.showFlat(true);
    this.onState?.('peel');
  }

  /** 折回纸面，变回印刷图 */
  undraw() {
    if (this.state === 'print') return Promise.resolve();
    this.state = 'undraw';
    this.t = 0;
    this.onState?.('undraw');
    return new Promise((r) => { this.undrawDone = r; });
  }

  update(dt, scene) {
    this.t += dt;
    const fadePrint = 0.28, shadeTime = 0.45;
    const sm = (x) => x * x * (3 - 2 * x);
    if (this.state === 'peel') {
      this.u.uClock.value = this.t;
      const k = Math.min(1, this.t / fadePrint);
      this.printAlpha = 1 - sm(k);
      this.u.uCopyAlpha.value = 1 - this.printAlpha;
      if (this.t >= this.drawEnd) { this.state = 'shade'; this.t = 0; this.showFlat(false); this.u.uCopyAlpha.value = 1; this.onState?.('shade'); }
      return true;
    }
    if (this.state === 'shade') {
      const k = Math.min(1, this.t / shadeTime);
      this.surfacesAlpha(sm(k));
      if (k >= 1) { this.state = 'live'; this.t = 0; this.onState?.('live'); }
      return true;
    }
    if (this.state === 'undraw') {
      if (scene && !this.printed) { this.renderPrint(scene); this.printed = true; }
      const a = Math.min(1, this.t / 0.15);
      this.surfacesAlpha(1 - a);
      const r = Math.max(0, Math.min(1, (this.t - 0.15) / 0.35));
      this.u.uLiftAll.value = 1 - sm(r);
      this.u.uLiftSurf.value = this.u.uLiftAll.value;
      const p = Math.max(0, Math.min(1, (r - 0.78) / 0.22));
      this.printAlpha = sm(p);
      this.u.uStandAlpha.value = 1 - this.printAlpha;
      if (r >= 1) {
        this.printed = false;
        this.u.uLiftSurf.value = 1;
        this.set('print');
        this.undrawDone?.();
        this.undrawDone = null;
      }
      return true;
    }
    return false;
  }
}

/**
 * 在右页上沿“折线”（页面坐标 v = foldV）建立插图坐标系：x 沿页面向右，y 垂直页面向上，z 朝读者。
 * 页面靠书脊处是弯的：取一串点拟合直线，并把原点抬到所有点之上，插图就不会陷进纸里。
 */
export function pageFrame(book, k, u0, foldV) {
  const pts = [];
  for (let u = u0 + 6; u <= Math.min(188, u0 + 166); u += 8) pts.push(book.pageToWorld(k, 'right', u, foldV));
  const toward = book.pageToWorld(k, 'right', u0 + 60, foldV).sub(book.pageToWorld(k, 'right', u0 + 60, foldV - 60)).normalize();
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, sxy = 0;
  for (const p of pts) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); }
  const slope = sxy / Math.max(1e-9, sxx);
  let lift = 0;
  for (const p of pts.slice(2)) lift = Math.max(lift, p.y - (my + slope * (p.x - mx)));
  const origin = book.pageToWorld(k, 'right', u0, foldV);
  origin.y = my + slope * (origin.x - mx) + lift + 0.05;
  const x = new THREE.Vector3(1, slope, (pts[n - 1].z - pts[0].z) / Math.max(1e-9, pts[n - 1].x - pts[0].x)).normalize();
  const z = toward.sub(x.clone().multiplyScalar(toward.dot(x))).normalize();
  const y = new THREE.Vector3().crossVectors(z, x).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(origin);
}
