import { LESSONS } from './lessons.js';
import { drawLessonLeft, drawLessonRight } from './lessonPage.js';
import { drawMatter, MATTER_TEXT } from './matter.js';
import { PAGE, INK, SOFT, RULE, ACCENT, SERIF, HANDF, font, line, para, label, runningHead } from './type.js';

// 整本书的跨页顺序与绘制分派。跨页 k 的左页页码 2k、右页 2k+1。

export const SPREADS = [
  null, // 0：合上
  { kind: 'front', title: '这本书怎么用' },
  { kind: 'contents', title: '目录' },
  ...LESSONS.map((L) => ({ kind: 'lesson', lesson: L, title: L.title })),
  { kind: 'index', title: '索引' },
  { kind: 'quiz', title: '测验' },
  { kind: 'sources', title: '参考来源' },
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
const COVER_TITLE = '抛体运动';

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
    if ('letterSpacing' in g) g.letterSpacing = '2px';
    g.fillText(COVER_TITLE, cx, 66);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    g.font = `italic 500 6px ${SERIF}`;
    g.fillText('一本会动的物理书', cx, 78);
    g.lineWidth = 0.35;
    g.beginPath(); g.moveTo(cx - 13, 85); g.lineTo(cx + 13, 85); g.stroke();
    // 插画板外框
    framePath(g, cx - 47 - 3.2, 156 - 53 - 3.2, 94 + 6.4, 106 + 6.4, 2.2);
    g.stroke();
    g.font = `500 4.6px ${SERIF}`;
    if ('letterSpacing' in g) g.letterSpacing = '0.8px';
    g.fillText('高中物理 · 第五章', cx, 232);
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
    g.fillText(COVER_TITLE, 0, 0.3);
    g.restore();
  },
  /** 封面插画：一个球从台边水平飞出，频闪点从蓝渐变到橙 */
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
    // 地面与排线
    const groundY = 84;
    g.lineWidth = 0.22;
    g.beginPath(); g.moveTo(10, groundY); g.lineTo(w - 10, groundY); g.stroke();
    g.lineWidth = 0.1;
    for (let x = 12; x < w - 10; x += 1.6) { g.beginPath(); g.moveTo(x, groundY + 0.3); g.lineTo(x - 2.2, groundY + 3.2); g.stroke(); }
    // 台子
    const tx = 14, tw = 16, ty = 38;
    g.lineWidth = 0.32;
    g.strokeRect(tx, ty, tw, groundY - ty);
    g.lineWidth = 0.09;
    for (let y = ty + 1.4; y < groundY; y += 1.2) { g.beginPath(); g.moveTo(tx + tw * 0.62, y); g.lineTo(tx + tw, y - 0.8); g.stroke(); }
    // 轨迹
    const x0 = tx + tw, y0 = ty - 2.2, v0 = 2.9, gg = 0.115;
    const pt = (t) => [x0 + v0 * t, y0 + 0.5 * gg * t * t];
    const T = Math.sqrt((2 * (groundY - 2.2 - y0)) / gg);
    g.setLineDash([1.2, 1.0]);
    g.lineWidth = 0.18;
    g.beginPath();
    for (let i = 0; i <= 60; i++) { const [x, y] = pt((T * i) / 60); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.setLineDash([]);
    const steps = 7;
    for (let i = 0; i <= steps; i++) {
      const [x, y] = pt((T * i) / steps);
      const k = i / steps;
      const c = [47 + (255 - 47) * k, 123 + (122 - 123) * k, 255 + (28 - 255) * k].map((v) => Math.round(v * 0.92));
      g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.85)`;
      g.beginPath(); g.arc(x, y, 2.1, 0, Math.PI * 2); g.fill();
      g.lineWidth = 0.16; g.strokeStyle = ink;
      g.beginPath(); g.arc(x, y, 2.1, 0, Math.PI * 2); g.stroke();
      // 水平与竖直投影刻度
      g.lineWidth = 0.1;
      g.beginPath(); g.moveTo(x, groundY - 1); g.lineTo(x, groundY + 1); g.stroke();
      g.beginPath(); g.moveTo(9, y); g.lineTo(11, y); g.stroke();
    }
    g.fillStyle = ink;
    g.font = `italic 3.4px ${SERIF}`;
    g.textAlign = 'center';
    g.fillText('图 0　每 0.1 秒拍下一次', w / 2, h - 9);
  },
};

/** 预加载页面上会用到的所有字形 */
export async function preloadFonts() {
  const texts = [COVER_TITLE, '一本会动的物理书高中物理第五章这本书怎么用目录索引测验参考来源图第课关键词预测为什么挑战',
    ...LESSONS.flatMap((L) => [L.title, L.short ?? '', ...L.explanation, L.equation.symbols, L.equation.words, ...L.keywords.flatMap((k) => [k.term, k.def]),
      L.predict.question, ...L.predict.options, L.explain, L.challenge.text, L.figure, L.figureNote ?? '', L.tryHint, ...(L.exhibits ?? []).flatMap((e) => [e.figure, e.note, e.hint]), ...(L.demo ?? []), ...(L.switches ?? []).flatMap((s) => [s.label, ...s.options])]),
    MATTER_TEXT,
    '0123456789.,:;+-=×÷()（）、，。：；“”？！msJ°√½·',
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
