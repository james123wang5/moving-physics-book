import * as THREE from 'three';
import { pageState, pageLayout } from '../content/book.js';
import { SERIF, HANDF, INK, SOFT, ACCENT, HAND, LEFT } from '../content/type.js';
import CONFIG from '../content/config.js';
import { T } from '../content/strings.js';

// 一课的运行时：管理这一课跨页上的状态（预测、翻盖、印章、开关），
// 左页的 3D 翻盖卡，页边的手写墨迹层（“你的数据”和印章），以及书页点击的分发。

const FLAP_ANGLE = 1.84;
const INK_RECT = { u0: 8, v0: 18, u1: 54, v1: 240 }; // 左页页边栏的手写区域（毫米）
const INK_PX = 6;

function cardFront(g, w, h) {
  g.fillStyle = '#eee4cf';
  g.fillRect(0, 0, w, h);
  let s = 41;
  const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 300; i++) {
    g.fillStyle = r() < 0.5 ? 'rgba(140,110,70,0.04)' : 'rgba(255,255,255,0.06)';
    g.beginPath(); g.arc(r() * w, r() * h, 0.5 + r() * 2.5, 0, 7); g.fill();
  }
  g.strokeStyle = 'rgba(28,36,51,0.35)';
  g.lineWidth = 0.3;
  g.strokeRect(2.2, 2.2, w - 4.4, h - 4.4);
  const mid = h / 2;
  g.textBaseline = 'alphabetic';
  g.fillStyle = ACCENT;
  g.font = `600 4px ${SERIF}`;
  if ('letterSpacing' in g) g.letterSpacing = '0.5px';
  g.fillText(T.why, 8, mid - 7.5);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.fillStyle = INK;
  g.font = `500 6.2px ${SERIF}`;
  g.fillText(T.flapTitle, 8, mid + 1.5);
  g.fillStyle = SOFT;
  g.font = `italic 400 4.2px ${SERIF}`;
  g.fillText(T.flapHint, 8, mid + 8);
  // 手写“掀这里”和箭头
  g.save();
  g.translate(w - 30, 10);
  g.rotate(-0.06);
  g.fillStyle = HAND;
  g.font = `560 4.6px ${HANDF}`;
  g.fillText(T.flapHand, 0, 0);
  g.restore();
  g.strokeStyle = HAND;
  g.lineWidth = 0.4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(w - 22, 13);
  g.quadraticCurveTo(w - 16, 18, w - 10.5, h - 9);
  g.stroke();
  g.beginPath();
  g.moveTo(w - 13.5, h - 11.2); g.lineTo(w - 10.5, h - 9); g.lineTo(w - 9.6, h - 12.6);
  g.stroke();
}

function cardBack(g, w, h) {
  g.fillStyle = '#f1e8d4';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(154,59,42,0.55)';
  g.lineWidth = 0.35; g.strokeRect(3, 3, w - 6, h - 6);
  g.lineWidth = 0.15; g.strokeRect(4.2, 4.2, w - 8.4, h - 8.4);
  g.strokeStyle = 'rgba(154,59,42,0.16)';
  g.save();
  g.beginPath(); g.rect(4.2, 4.2, w - 8.4, h - 8.4); g.clip();
  for (let x = -h; x < w; x += 2.4) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + h, 0); g.stroke(); }
  g.restore();
  const rad = Math.min(9, Math.min(w, h) * 0.36);
  g.fillStyle = '#f1e8d4';
  g.beginPath(); g.arc(w / 2, h / 2, rad, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(154,59,42,0.7)';
  g.lineWidth = 0.35;
  g.beginPath(); g.arc(w / 2, h / 2, rad * 0.89, 0, Math.PI * 2); g.stroke();
  // 徽记：config.emblem(g, cx, cy, r) 可以自己画；默认是一本翻开的书
  if (CONFIG.emblem) { CONFIG.emblem(g, w / 2, h / 2, rad); return; }
  const cx = w / 2, cy = h / 2 + rad * 0.12, bw = rad * 0.62, bh = rad * 0.42;
  g.lineWidth = 0.4;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(cx, cy - bh * 0.7); g.quadraticCurveTo(cx - bw * 0.5, cy - bh, cx - bw, cy - bh * 0.75);
  g.lineTo(cx - bw, cy + bh * 0.55); g.quadraticCurveTo(cx - bw * 0.5, cy + bh * 0.3, cx, cy + bh * 0.6);
  g.quadraticCurveTo(cx + bw * 0.5, cy + bh * 0.3, cx + bw, cy + bh * 0.55); g.lineTo(cx + bw, cy - bh * 0.75);
  g.quadraticCurveTo(cx + bw * 0.5, cy - bh, cx, cy - bh * 0.7); g.lineTo(cx, cy + bh * 0.6);
  g.stroke();
  g.fillStyle = 'rgba(154,59,42,0.75)';
  g.beginPath(); g.arc(cx, cy - bh * 1.35, 0.8, 0, 7); g.fill();
}

/** 左页的翻盖卡：上沿是铰链，掀开 1.84 弧度 */
export function makeFlap(book, k, region) {
  const w = region.u1 - region.u0, h = region.v1 - region.v0;
  const canvas = (draw) => {
    const c = document.createElement('canvas');
    c.width = Math.round(w * 6); c.height = Math.round(h * 6);
    const g = c.getContext('2d');
    g.scale(6, 6);
    draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  };
  const front = canvas(cardFront), back = canvas(cardBack);
  // 背面朝下贴着纸：画布顶端对着铰链，所以纵向要翻一下
  back.flipY = false;
  const geo = new THREE.BoxGeometry(w, 0.35, h);
  geo.translate(w / 2, 0.175, h / 2);
  const edge = new THREE.MeshStandardMaterial({ color: '#efe7d6', roughness: 0.9 });
  const mesh = new THREE.Mesh(geo, [edge, edge, new THREE.MeshStandardMaterial({ map: front, roughness: 0.88 }), new THREE.MeshStandardMaterial({ map: back, roughness: 0.9 }), edge, edge]);
  mesh.castShadow = mesh.receiveShadow = true;
  const hinge = new THREE.Group();
  hinge.add(mesh);
  const group = new THREE.Group();
  group.add(hinge);
  group.matrixAutoUpdate = false;
  let amount = 0, target = 0;
  return {
    group, mesh,
    place() {
      const a = book.pageToWorld(k, 'left', region.u0, region.v0);
      const b = book.pageToWorld(k, 'left', region.u1, region.v0);
      const c = book.pageToWorld(k, 'left', region.u0, region.v1);
      const x = b.sub(a).normalize(), z = c.sub(a).normalize();
      const y = new THREE.Vector3().crossVectors(z, x).normalize();
      const zz = new THREE.Vector3().crossVectors(x, y);
      group.matrix.makeBasis(x, y, zz).setPosition(a.addScaledVector(y, 0.12));
      group.matrixWorldNeedsUpdate = true;
    },
    set(open) { target = open ? 1 : 0; },
    lay() { amount = 0; target = 0; hinge.rotation.set(0, 0, 0); },
    get amount() { return amount; },
    get isOpen() { return target === 1; },
    update(dt) {
      amount += (target - amount) * (1 - Math.exp(-dt * 7));
      hinge.rotation.x = -FLAP_ANGLE * amount;
    },
  };
}

/** 页边的手写墨迹层：透明画布，贴在左页材质的 uInk 插槽 */
function makeInkLayer() {
  const w = INK_RECT.u1 - INK_RECT.u0, h = INK_RECT.v1 - INK_RECT.v0;
  const c = document.createElement('canvas');
  c.width = Math.round(w * INK_PX);
  c.height = Math.round(h * INK_PX);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { canvas: c, ctx: c.getContext('2d'), tex, w, h };
}

/** 红色印章，按下的过程 press 0→1（略微放大后落定） */
export function drawStamp(g, cu, cv, text, press = 1, rotate = -0.21) {
  const k = 1 + 0.35 * (1 - press) * (1 - press);
  g.save();
  g.translate(cu, cv);
  g.rotate(rotate);
  g.scale(k, k);
  g.globalAlpha = 0.85 * Math.min(1, press * 1.4);
  g.strokeStyle = '#b8412e';
  g.fillStyle = '#b8412e';
  g.lineWidth = 0.9;
  g.beginPath(); g.arc(0, 0, 11.2, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 0.35;
  g.beginPath(); g.arc(0, 0, 9.6, 0, Math.PI * 2); g.stroke();
  g.font = `700 6.4px ${SERIF}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 0, 0.4);
  g.font = `600 2.4px ${SERIF}`;
  g.fillText(CONFIG.stampMotto ?? `★ ${CONFIG.title} ★`, 0, 6.6);
  g.restore();
}

export class LessonRuntime {
  constructor(app, k, lesson) {
    this.app = app;
    this.book = app.book;
    this.k = k;
    this.lesson = lesson;
    this.state = { predict: null, flapOpen: false, stamped: false, stampPress: 0, switches: {} };
    pageState.set(k, this.state);
    this.inkLayer = makeInkLayer();
    this.inkDirty = true;
    this.numbers = [];
    const mat = this.book.pages.material(k, 'left');
    const u = mat.userData.uniforms;
    u.uInk.value = this.inkLayer.tex;
    u.uInkRect.value.set(INK_RECT.u0, INK_RECT.v0, this.inkLayer.w, this.inkLayer.h);
    this.flap = null;
  }

  layout(side) { return pageLayout.get(`${this.k}:${side}`); }

  ensureFlap() {
    if (this.flap) return;
    const region = this.layout('left')?.regions?.flap;
    if (!region) return;
    this.flap = makeFlap(this.book, this.k, region);
    this.flap.group.visible = false;
    this.app.stage.scene.add(this.flap.group);
  }

  redrawLeft() { this.book.pages.invalidate(this.k, 'left'); }

  /** 书页上的点击；返回 true 表示处理了 */
  hit(id) {
    if (id.startsWith('predict:')) {
      const i = Number(id.slice(8));
      this.state.predict = this.state.predict === i ? null : i;
      this.redrawLeft();
      this.app.sound?.play('tick');
      return true;
    }
    if (id === 'flap') { this.toggleFlap(); return true; }
    if (id.startsWith('switch:')) {
      const [, sid, i] = id.split(':');
      this.state.switches[sid] = Number(i);
      this.book.pages.invalidate(this.k, 'right');
      this.onSwitch?.(sid, Number(i));
      return true;
    }
    return false;
  }

  toggleFlap() {
    this.state.flapOpen = !this.state.flapOpen;
    this.flap?.set(this.state.flapOpen);
    this.app.sound?.play('flap');
  }

  earnStamp() {
    if (this.state.stamped) return;
    this.state.stamped = true;
    this.state.stampPress = 0;
    this.app.sound?.play('stamp');
    this.app.toast?.(T.challengeDone(this.lesson.challenge?.done ?? ''));
  }

  /** 手写的“你的数据”：每行一个字符串（不解析 $公式$，用 √ ² ₀ θ 这类字符） */
  setNumbers(lines) {
    const key = lines.join('|');
    if (key === this.numbersKey) return;
    this.numbersKey = key;
    this.numbers = lines;
    this.inkDirty = true;
  }

  paintInk() {
    const { ctx: g, canvas, w } = this.inkLayer;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.setTransform(INK_PX, 0, 0, INK_PX, -INK_RECT.u0 * INK_PX, -INK_RECT.v0 * INK_PX);
    // 手写的数字：从第 60 毫米往下排，每行略微倾斜
    let v = 62;
    g.fillStyle = HAND;
    g.textBaseline = 'alphabetic';
    for (const [i, ln] of this.numbers.entries()) {
      g.save();
      g.translate(LEFT.margin[0] + 2 + (i % 2) * 0.6, v);
      g.rotate(-0.025 + (i % 3) * 0.01);
      // 字号 4.7，一行写不下页边栏（到正文栏前 3 毫米）就按比例缩小
      g.font = `600 4.7px ${HANDF}`;
      const room = LEFT.text[0] - 3 - (LEFT.margin[0] + 2);
      const fit = room / Math.max(1e-3, g.measureText(ln).width);
      if (fit < 1) g.font = `600 ${(4.7 * fit).toFixed(2)}px ${HANDF}`;
      g.fillText(ln, 0, 0);
      g.restore();
      v += 6.8;
    }
    if (this.state.stamped) {
      const r = this.layout('left')?.regions?.stamp ?? { cu: 31, cv: 194 };
      drawStamp(g, r.cu, r.cv, T.stampText, Math.min(1, this.state.stampPress));
    }
    void w;
    this.inkLayer.tex.needsUpdate = true;
    this.inkDirty = false;
  }

  update(dt, active) {
    this.ensureFlap();
    if (this.flap) {
      const show = active && this.book.openSpread === this.k;
      if (show && !this.flap.group.visible) this.flap.lay();
      this.flap.group.visible = show;
      if (show) { this.flap.place(); this.flap.set(this.state.flapOpen); this.flap.update(dt); }
    }
    if (this.state.stamped && this.state.stampPress < 1) { this.state.stampPress = Math.min(1, this.state.stampPress + dt * 3.2); this.inkDirty = true; }
    if (this.inkDirty) this.paintInk();
  }

  /** 翻离这一页前：合上翻盖、清掉预测 */
  leave() {
    this.state.flapOpen = false;
    this.flap?.lay();
    return Promise.resolve();
  }
}
