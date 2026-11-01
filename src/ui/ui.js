import { SPREADS, N_SPREADS, pageLayout } from '../content/book.js';
import { parseMath } from '../content/type.js';

// 书外的界面：底部的玻璃控制条（目录、翻页、看演示、当前位置 / 演示字幕、声音、静止模式、教师用书），
// 目录面板，提示条；拖动空白处环视，快速横扫翻页。玻璃本身在后期里画（ui/glass.js）。

const ICON = {
  contents: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M5 6.5h14M5 12h14M5 17.5h9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  prev: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M14.5 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  next: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M9.5 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M8 5.5l11 6.5-11 6.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M8.5 6v12M15.5 6v12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M16 9.5l4.5 5M20.5 9.5l-4.5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  still: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill="currentColor"/></svg>',
  teachers: '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><path d="M3.5 9L12 5l8.5 4-8.5 4z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M7 11v4.2c1.4 1.3 3 2 5 2s3.6-.7 5-2V11M20.5 9v5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
};

export class UI {
  constructor(app) {
    this.app = app;
    const root = (this.root = document.getElementById('ui'));
    root.innerHTML = `
      <nav class="capsule" data-glass data-r="27" aria-label="书的控制条">
        <button class="ic" id="cContents" aria-label="目录">${ICON.contents}</button>
        <button class="ic" id="cPrev" aria-label="上一页">${ICON.prev}</button>
        <div class="mid">
          <div class="where" id="cWhere"><button class="ic sm" id="cWatch" aria-label="看演示">${ICON.play}</button><span class="lbl"><b id="cN"></b><span id="cT"></span></span></div>
          <div class="caption" id="cCaption" hidden><button class="ic sm" id="cPause" aria-label="暂停演示">${ICON.pause}</button><span class="txt" id="cCap"></span><span class="dots" id="cDots"></span></div>
        </div>
        <button class="ic" id="cNext" aria-label="下一页">${ICON.next}</button>
        <span class="sep" aria-hidden="true"></span>
        <button class="ic" id="cSound" aria-label="声音" aria-pressed="false">${ICON.soundOff}</button>
        <button class="ic" id="cStill" aria-label="静止模式（停止一切动画）" aria-pressed="false">${ICON.still}</button>
        <a class="ic" id="cTeach" href="#10" aria-label="给老师">${ICON.teachers}</a>
      </nav>
      <div class="sheet" id="toc" data-glass data-r="18" hidden></div>
      <div class="lens" id="lens" data-glass data-zoom="2" data-r="48" hidden></div>
      <div class="tip" id="tip" data-glass data-r="16" hidden><div class="tag" id="tipTag"></div><div class="body" id="tipBody"></div></div>
      <div class="toast" id="toast" hidden></div>
      <div class="copy">© 2026 抛体运动 · 互动物理书</div>`;
    const $ = (id) => root.querySelector('#' + id);
    this.$ = $;
    const ctl = () => this.app.ctl;
    $('cContents').onclick = (e) => { e.stopPropagation(); this.toggleToc(); };
    $('cPrev').onclick = () => ctl().prev();
    $('cNext').onclick = () => ctl().next();
    $('cWatch').onclick = () => ctl().replay();
    $('cPause').onclick = () => ctl().togglePause();
    $('cSound').onclick = () => this.setSound(!this.app.soundOn);
    $('cStill').onclick = () => this.setStill(!this.app.still);
    $('cTeach').onclick = (e) => { e.preventDefault(); this.app.ctl.goTo(N_SPREADS); };
    root.querySelector('.capsule').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && e.detail > 0) b.blur(); });
    document.addEventListener('click', (e) => { if (!$('toc').hidden && !$('toc').contains(e.target)) $('toc').hidden = true; });
    this.orbit = app.orbit = { yaw: 0, pitch: 0, held: false, idle: 0 };
    this.bindOrbit();
  }

  // ---------- 控制条 ----------
  onSpread(k) {
    const sp = SPREADS[k];
    const $ = this.$;
    if (sp?.kind === 'lesson') { $('cN').textContent = String(sp.lesson.n); $('cT').textContent = sp.lesson.short ?? sp.lesson.title; }
    else { $('cN').textContent = ''; $('cT').textContent = sp?.title ?? '封面'; }
    $('cWatch').hidden = !(this.app.ctl.runtime(k)?.shots);
    $('cPrev').disabled = k <= 0;
    $('cNext').disabled = k >= N_SPREADS;
    history.replaceState(null, '', `#${k}`);
  }

  caption(text, i = 0, n = 5, paused = false) {
    const $ = this.$;
    const on = text != null;
    $('cWhere').hidden = on;
    $('cCaption').hidden = !on;
    this.root.querySelector('.capsule').classList.toggle('touring', on);
    if (!on) return;
    $('cCap').textContent = text;
    const dots = $('cDots');
    if (dots.children.length !== n) dots.innerHTML = '<i></i>'.repeat(n);
    [...dots.children].forEach((d, j) => { d.className = j < i ? 'done' : j === i ? 'on' : ''; });
    $('cPause').innerHTML = paused ? ICON.play : ICON.pause;
    $('cPause').setAttribute('aria-label', paused ? '继续演示' : '暂停演示');
  }

  watching(on) { if (!on) this.caption(null); }

  setSound(on) {
    this.app.soundOn = on;
    this.$('cSound').setAttribute('aria-pressed', String(on));
    this.$('cSound').innerHTML = on ? ICON.soundOn : ICON.soundOff;
    this.app.sound?.enable(on);
  }

  setStill(on) {
    this.app.still = on;
    this.$('cStill').setAttribute('aria-pressed', String(on));
    if (on) this.app.ctl.stopWatch();
    this.toast(on ? '静止模式：动画都停下来了' : '动画已恢复');
  }

  toggleToc() {
    const toc = this.$('toc');
    const k = this.app.book.openSpread ?? Math.round(this.app.book.position);
    toc.innerHTML = '<div class="k">目录</div>' + SPREADS.map((sp, i) => {
      if (!sp) return `<button data-i="0" class="${k === 0 ? 'on' : ''}"><span class="n"></span>封面</button>`;
      const n = sp.kind === 'lesson' ? sp.lesson.n : '';
      return `<button data-i="${i}" class="${k === i ? 'on' : ''}"><span class="n">${n}</span>${sp.lesson?.title ?? sp.title}</button>`;
    }).join('');
    toc.querySelectorAll('[data-i]').forEach((b) => { b.onclick = () => { toc.hidden = true; this.app.ctl.goTo(Number(b.dataset.i)); }; });
    toc.hidden = !toc.hidden;
  }

  toast(msg) {
    const t = this.$('toast');
    t.textContent = msg;
    t.hidden = false;
    t.classList.remove('out');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => { t.classList.add('out'); setTimeout(() => { t.hidden = true; }, 400); }, 2200);
  }

  // ---------- 鼠标划过书页：放大镜 + 提示卡 ----------
  /** 把带 $公式$ 和 **粗体** 的文字转成 HTML */
  richHtml(str) {
    const esc = (t) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
    return String(str).split('\n').map((ln) => ln.split('$').map((part, i) => {
      if (i % 2 === 0) return esc(part).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      return '<span class="m">' + parseMath(part).map((t) => {
        const x = esc(t.t), c = t.it ? `<i>${x}</i>` : x;
        return t.lv === 1 ? `<sub>${c}</sub>` : t.lv === 2 ? `<sup>${c}</sup>` : c;
      }).join('') + '</span>';
    }).join('')).join('<br>');
  }

  hover(ev, handle, page) {
    const lens = this.$('lens'), tip = this.$('tip');
    const blocks = page && !handle && !this.app.book.turning ? pageLayout.get(`${page.k}:${page.side}`)?.blocks : null;
    const b = blocks?.find((q) => page.u >= q.u0 && page.u <= q.u1 && page.v >= q.v0 && page.v <= q.v1);
    if (!b || this.orbit.held) { lens.hidden = tip.hidden = true; this.tipBlock = null; return; }
    const x = ev.clientX, y = ev.clientY;
    lens.style.transform = `translate(${x - 48}px, ${y - 48}px)`;
    lens.hidden = false;
    if (this.tipBlock !== b) {
      this.tipBlock = b;
      this.$('tipTag').textContent = b.tag;
      this.$('tipBody').innerHTML = this.richHtml(b.text);
    }
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const tx = Math.max(10, Math.min(innerWidth - w - 10, x - w / 2));
    const ty = y - 48 - 12 - h;
    tip.style.transform = `translate(${tx}px, ${ty < 10 ? y + 60 : ty}px)`;
  }

  // ---------- 环视与横扫 ----------
  bindOrbit() {
    const el = this.app.stage.renderer.domElement;
    let drag = null;
    this.pointerDown = (ev, onSomething) => {
      if (onSomething) return;
      drag = { x: ev.clientX, y: ev.clientY, x0: ev.clientX, t0: performance.now(), id: ev.pointerId };
      this.orbit.held = true;
      this.orbit.idle = 0;
    };
    el.addEventListener('pointermove', (ev) => {
      if (!drag || ev.pointerId !== drag.id) return;
      const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
      drag.x = ev.clientX; drag.y = ev.clientY;
      this.orbit.yaw = Math.max(-0.42, Math.min(0.42, this.orbit.yaw - dx * 0.0032));
      this.orbit.pitch = Math.max(-0.18, Math.min(0.14, this.orbit.pitch - dy * 0.0024));
      if (Math.abs(ev.clientX - drag.x0) > 6) this.app.ctl.stopWatch();
    });
    const end = (ev) => {
      if (!drag || ev.pointerId !== drag.id) return;
      const dt = performance.now() - drag.t0, dx = ev.clientX - drag.x0;
      if (dt < 350 && Math.abs(dx) > 70) { this.orbit.yaw = 0; dx < 0 ? this.app.ctl.next() : this.app.ctl.prev(); }
      drag = null;
      this.orbit.held = false;
      this.orbit.idle = 0;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  update(dt) {
    const o = this.orbit;
    if (!o.held) {
      o.idle += dt;
      if (o.idle > 1.6) { const k = 1 - Math.exp(-dt * 2.2); o.yaw -= o.yaw * k; o.pitch -= o.pitch * k; }
    }
    // 玻璃块的位置交给后期
    const rects = [];
    for (const el of this.root.querySelectorAll('[data-glass]')) {
      if (el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (!r.width) continue;
      rects.push({ x: r.left, y: r.top, w: r.width, h: r.height, r: Number(el.dataset.r ?? 18), tint: el.dataset.zoom ? 0.03 : 0.34, strength: Number(getComputedStyle(el).opacity), zoom: Number(el.dataset.zoom ?? 1) });
    }
    const s = this.app.stage;
    s.post.glass.setRects(rects, s.renderer.getPixelRatio(), s.size.w, s.size.h);
  }
}
