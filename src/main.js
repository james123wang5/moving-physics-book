import './style.css';
import '@fontsource-variable/source-serif-4/index.css';
import '@fontsource-variable/source-serif-4/wght-italic.css';
import '@fontsource-variable/caveat/index.css';
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-sc/500.css';
import '@fontsource/noto-serif-sc/600.css';
import '@fontsource/noto-serif-sc/700.css';
import 'lxgw-wenkai-webfont/lxgwwenkai-regular.css';
import * as THREE from 'three';
import { Stage, DESK_TOP, VIEW_OPEN } from './engine/stage.js';
import { Book } from './book/book.js';
import { drawPage, N_SPREADS, COVER, preloadFonts } from './content/book.js';
import { updateIllusLight } from './ink/paper.js';
import { Controller } from './app/controller.js';
import { UI } from './ui/ui.js';
import { Sound } from './app/sound.js';

const app = { camOverride: null, still: false, sound: new Sound() };
app.stage = new Stage(document.getElementById('app'));
app.stage.camera.layers.enable(1);

await Promise.race([preloadFonts(), new Promise((r) => setTimeout(r, 4000))]);

const book = new Book({ renderer: app.stage.renderer, drawPage, nSpreads: N_SPREADS, cover: COVER, ribbonSpread: 2 });
const d = book.dims;
book.group.position.y = DESK_TOP - (d.Yb - d.BOARD);
app.stage.scene.add(book.group);
app.book = book;

// 机位：合上时从侧上方看封面，翻开后从正前上方看整个跨页；演示时由镜头接管
const centreClosed = new THREE.Vector3(d.CX + (d.W + d.OVER) / 2, d.Yb + d.T / 2 + book.group.position.y, 0);
const VIEW_CLOSED = { pos: centreClosed.clone().add(new THREE.Vector3(-300, 360, 400)), look: centreClosed.clone().add(new THREE.Vector3(4, -8, 6)) };
const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3(), off = new THREE.Vector3();
function aimCamera() {
  let fov = 30;
  if (app.camOverride) { tmpPos.copy(app.camOverride.pos); tmpLook.copy(app.camOverride.look); fov = app.camOverride.fov ?? 30; }
  else {
    const t = Math.min(1, Math.max(0, book.position));
    const k = t * t * (3 - 2 * t);
    tmpPos.copy(VIEW_CLOSED.pos).lerp(VIEW_OPEN.pos, k);
    tmpLook.copy(VIEW_CLOSED.look).lerp(VIEW_OPEN.look, k);
  }
  // 环视：绕注视点转一点角度
  const o = app.orbit;
  if (o && (o.yaw || o.pitch)) {
    off.copy(tmpPos).sub(tmpLook);
    off.applyAxisAngle(UP, o.yaw);
    right.crossVectors(off, UP).normalize();
    off.applyAxisAngle(right, o.pitch);
    tmpPos.copy(tmpLook).add(off);
  }
  app.stage.setView(tmpPos, tmpLook, fov);
}

book.update(0);
const ctl = (app.ctl = new Controller(app));
app.ui = new UI(app);
app.toast = (m) => app.ui.toast(m);
app.stage.onUpdate((dt) => {
  book.update(dt);
  updateIllusLight(app.stage.camera);
  ctl.update(dt);
  app.ui.update(dt);
  aimCamera();
  book.setKeyLight(app.stage.key, app.stage.camera);
});

// 起始：网址 #数字 直接翻到那个跨页；否则先合着，再自动翻开
const start = Number(location.hash.slice(1));
book.setPosition(Number.isInteger(start) && start > 0 ? Math.min(start, N_SPREADS) : 0);
book.update(0);
aimCamera();
app.stage.snapView();
if (start > 0) ctl.arrived();
else setTimeout(() => ctl.goTo(1), 900);

window.addEventListener('keydown', (e) => {
  if (e.target.closest?.('input, textarea')) return;
  if (e.key === 'ArrowRight') ctl.next();
  if (e.key === 'ArrowLeft') ctl.prev();
  if (e.key === 'Escape') ctl.stopWatch();
});

window.__app = app;
window.THREE = THREE;
