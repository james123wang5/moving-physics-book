import { LESSONS } from './lessons.js';
import CONFIG from './config.js';
import { T } from './strings.js';
import { drawLessonLeft, drawLessonRight } from './lessonPage.js';
import { drawMatter, MATTER_TEXT } from './matter.js';
import { PAGE, INK, SOFT, RULE, ACCENT, SERIF, HANDF, font, line, para, label, runningHead } from './type.js';

// 整本书的跨页顺序与绘制分派。跨页 k 的左页页码 2k、右页 2k+1。

// 附页要哪些、按什么顺序：front 扉页和用法、contents 记号和目录、index 索引和公式一览、quiz 测验、sources 来源和给老师。
// config.matter 可以改，例如 { before: ['front', 'contents'], after: ['index'] }
const MATTER = { before: ['front', 'contents'], after: ['index', 'quiz', 'sources'], ...(CONFIG.matter ?? {}) };
const MATTER_TITLE = { front: T.frontTitle, contents: T.contentsTag, index: T.indexTag, quiz: T.quizTag, sources: T.sourcesTitle };
const matter = (kind) => ({ kind, title: MATTER_TITLE[kind] });

export const SPREADS = [
  null, // 0：合上
  ...MATTER.before.map(matter),
  ...LESSONS.map((L) => ({ kind: 'lesson', lesson: L, title: L.title })),
  ...MATTER.after.map(matter),
];
export const N_SPREADS = SPREADS.length - 1;

/** 每个跨页的交互状态（预测、开关、印章……），由课文模块写入 */
export const pageState = new Map();
/** 每页最近一次绘制得到的可点击区域与特殊区域 */
export const pageLayout = new Map();

export function lessonSpread(n) { return SPREADS.findIndex((s) => s?.kind === 'lesson' && s.lesson.n === n); }

/** 交给 Book 的绘制回调 */
export function drawPage(k, side, g) {
  const sp = SPREADS[k];
  const folio = side === 'left' ? 2 * k : 2 * k + 1;
  const st = pageState.get(k) ?? {};
  let out = { hits: [], regions: {} };
  if (sp?.kind === 'lesson') {
    out = side === 'left' ? drawLessonLeft(g, sp.lesson, st, folio) : drawLessonRight(g, sp.lesson, st, folio);
  } else if (sp) {
    out = drawMatter(g, sp, side, folio, st, { spreads: SPREADS, stampedOf: (kk) => !!pageState.get(kk)?.stamped });
  }
  pageLayout.set(`${k}:${side}`, out);
}

// ---------- 封面 ----------
const COVER_TITLE = CONFIG.title;

function framePath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y); g.arcTo(x + w, y, x + w, y + r, r);
  g.lineTo(x + w, y + h - r); g.arcTo(x + w, y + h, x + w - r, y + h, r);
  g.lineTo(x + r, y + h); g.arcTo(x, y + h, x, y + h - r, r);
  g.lineTo(x, y + r); g.arcTo(x, y, x + r, y, r);
  g.closePath();
}

export const COVER = {
  plateSize: [90, 102],
  foil(g) {
    const W = 190, cx = W / 2;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.font = `600 21px ${SERIF}`;
    // 书名太长就缩小
    for (let px = 21; px > 11 && g.measureText(COVER_TITLE).width > W - 40; px -= 1) g.font = `600 ${px}px ${SERIF}`;
    if ('letterSpacing' in g) g.letterSpacing = '2px';
    g.fillText(COVER_TITLE, cx, 66);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    g.font = `italic 500 6px ${SERIF}`;
    if (CONFIG.subtitle) g.fillText(CONFIG.subtitle, cx, 78);
    g.lineWidth = 0.35;
    g.beginPath(); g.moveTo(cx - 13, 85); g.lineTo(cx + 13, 85); g.stroke();
    // 插画板外框
    framePath(g, cx - 47 - 3.2, 156 - 53 - 3.2, 94 + 6.4, 106 + 6.4, 2.2);
    g.stroke();
    g.font = `500 4.6px ${SERIF}`;
    if ('letterSpacing' in g) g.letterSpacing = '0.8px';
    if (CONFIG.series) g.fillText(CONFIG.series, cx, 232);
  },
  deboss(g) {
    const W = 190, D = 258, inset = 9, inner = 2;
    g.lineWidth = 1.1;
    framePath(g, inset, inset, W - 2 * inset, D - 2 * inset, 1.5);
    g.stroke();
    g.lineWidth = 0.42;
    framePath(g, inset + inner, inset + inner, W - 2 * (inset + inner), D - 2 * (inset + inner), 1);
    g.stroke();
    const k = inset + inner;
    for (const [x, y, sx, sy] of [[k, k, 1, 1], [W - k, k, -1, 1], [k, D - k, 1, -1], [W - k, D - k, -1, -1]]) {
      g.lineWidth = 0.5;
      g.beginPath(); g.moveTo(x + sx * 3, y + sy * 7); g.lineTo(x + sx * 3, y + sy * 3); g.lineTo(x + sx * 7, y + sy * 3); g.stroke();
      g.beginPath(); g.arc(x + sx * 3, y + sy * 3, 0.7, 0, Math.PI * 2); g.fill();
    }
  },
  spine(g) {
    const W = 30, D = 258, cx = W / 2;
    g.lineWidth = 0.7;
    for (const y of [13, 15.2, D - 15.2, D - 13]) {
      g.lineWidth = y === 13 || y === D - 13 ? 0.7 : 0.3;
      g.beginPath(); g.moveTo(cx - 8.5, y); g.lineTo(cx + 8.5, y); g.stroke();
    }
    g.save();
    g.translate(cx, D * 0.42);
    g.rotate(Math.PI / 2);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `600 7.4px ${SERIF}`;
    if ('letterSpacing' in g) g.letterSpacing = '2.5px';
    for (let px = 7.4; px > 4 && g.measureText(COVER_TITLE).width > 200; px -= 0.2) g.font = `600 ${px.toFixed(1)}px ${SERIF}`;
    g.fillText(COVER_TITLE, 0, 0.3);
    g.restore();
  },
  /** 封面插画板：config.cover.plate(g, w, h) 可以自己画；默认是一本翻开的立体书，书上立着一个小台子和一个球 */
  plate(g, w, h) {
    g.fillStyle = '#f2e8d2';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(110,90,70,${0.05 + Math.random() * 0.08})`;
      g.fillRect(Math.random() * w, Math.random() * h, 0.08 + Math.random() * 0.25, 0.05 + Math.random() * 0.08);
    }
    const ink = '#15161a';
    g.strokeStyle = ink; g.fillStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
    g.lineWidth = 0.32; g.strokeRect(4.2, 4.2, w - 8.4, h - 8.4);
    g.lineWidth = 0.12; g.strokeRect(5.2, 5.2, w - 10.4, h - 10.4);
    if (CONFIG.cover?.plate) { g.save(); CONFIG.cover.plate(g, w, h); g.restore(); return; }
    const cx = w / 2, by = 70;
    // 翻开的书：两页向两边微微弯下
    g.lineWidth = 0.3;
    g.beginPath();
    g.moveTo(cx, by); g.quadraticCurveTo(cx - 18, by - 6, cx - 36, by - 2); g.lineTo(cx - 34, by + 10);
    g.quadraticCurveTo(cx - 17, by + 6, cx, by + 12); g.quadraticCurveTo(cx + 17, by + 6, cx + 34, by + 10);
    g.lineTo(cx + 36, by - 2); g.quadraticCurveTo(cx + 18, by - 6, cx, by); g.lineTo(cx, by + 12);
    g.stroke();
    g.lineWidth = 0.1;
    for (let i = 1; i < 9; i++) {
      const t = i / 9;
      g.beginPath(); g.moveTo(cx - 34 * t - 2, by - 3 + 9 * t); g.lineTo(cx - 34 * t + 1, by - 1 + 9 * t); g.stroke();
    }
    // 立起来的小台子（排线表示暗面）
    const tx = cx + 6, ty = by - 30, tw = 12, th = 26;
    g.lineWidth = 0.3;
    g.strokeRect(tx, ty, tw, th);
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(tx + 4, ty - 3); g.lineTo(tx + tw + 4, ty - 3); g.lineTo(tx + tw, ty); g.moveTo(tx + tw + 4, ty - 3); g.lineTo(tx + tw + 4, ty + th - 3); g.lineTo(tx + tw, ty + th); g.stroke();
    g.lineWidth = 0.09;
    for (let y = ty + 1; y < ty + th - 1; y += 1.1) { g.beginPath(); g.moveTo(tx + tw + 0.3, y + 0.4); g.lineTo(tx + tw + 3.7, y - 2.2); g.stroke(); }
    // 从台上飞出的小球和虚线轨迹
    g.setLineDash([1.2, 1.0]);
    g.lineWidth = 0.18;
    g.beginPath();
    for (let i = 0; i <= 30; i++) { const t = i / 30, x = tx - 30 * t, y = ty - 4 - 14 * t + 30 * t * t; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(47,123,255,0.85)';
    g.beginPath(); g.arc(tx - 13, ty - 12.6, 2.1, 0, Math.PI * 2); g.fill();
    g.lineWidth = 0.16; g.strokeStyle = ink;
    g.beginPath(); g.arc(tx - 13, ty - 12.6, 2.1, 0, Math.PI * 2); g.stroke();
    g.fillStyle = ink;
    g.font = `italic 3.4px ${SERIF}`;
    g.textAlign = 'center';
    g.fillText(CONFIG.subtitle ?? '', w / 2, h - 9);
  },
};

/** 预加载页面上会用到的所有字形 */
export async function preloadFonts() {
  const texts = [COVER_TITLE, CONFIG.subtitle ?? '', CONFIG.series ?? '', CONFIG.copyright ?? '', CONFIG.stampMotto ?? '', JSON.stringify(T), Object.values(T).filter((v) => typeof v === 'function').map((f) => f.toString()).join(''),
    ...LESSONS.flatMap((L) => [L.title, L.short ?? '', ...L.explanation, L.equation?.symbols ?? '', L.equation?.words ?? '', ...(L.keywords ?? []).flatMap((k) => [k.term, k.def]),
      L.predict?.question ?? '', ...(L.predict?.options ?? []), L.explain, L.challenge?.text ?? '', L.challenge?.done ?? '', L.figure, L.figureNote ?? '', L.tryHint, ...(L.exhibits ?? []).flatMap((e) => [e.figure, e.note, e.hint]), ...(L.demo ?? []), ...(L.switches ?? []).flatMap((s) => [s.label, ...s.options])]),
    MATTER_TEXT,
    '0123456789.,:;+-=×÷()（）、，。：；“”？！msJ°√½·ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
  ].join('');
  const specs = [
    `400 20px ${SERIF}`, `500 20px ${SERIF}`, `600 20px ${SERIF}`, `italic 400 20px ${SERIF}`, `italic 500 20px ${SERIF}`,
    `560 20px ${HANDF}`, `400 20px ${HANDF}`,
  ];
  await Promise.allSettled(specs.map((f) => document.fonts.load(f, texts)));
  void INK;
  void font;
  void para;
}
