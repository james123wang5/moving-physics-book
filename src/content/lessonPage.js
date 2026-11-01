import {
  PAGE, LEFT, RIGHT, INK, SOFT, RULE, ACCENT,
  font, line, para, label, tickBox, runningHead, countLines, measure,
} from './type.js';

// 课文跨页的版式。左页：课号、标题、导语、公式框、关键词、预测、为什么（翻盖下）；
// 页边栏：手写的“你的数据”和挑战（虚线圈是盖章的位置）。右页：插图区、图注、动手提示、开关。
// 返回可点击区域（页面毫米坐标）和几个特殊区域，供 3D 翻盖、手写层、印章定位。

/** 悬停提示用的文字块：记下页面毫米坐标范围、小标题和内容 */
function block(blocks, tag, text, u0, v0, u1, v1) { blocks.push({ tag, text, u0, v0, u1, v1 }); }

export function drawLessonLeft(g, L, state = {}, folio = '') {
  const hits = [];
  const blocks = [];
  runningHead(g, true, `第 ${L.n} 课 · ${L.short ?? L.title}`, folio);
  const s = LEFT.text[0], w = LEFT.text[1] - LEFT.text[0];

  font(g, 3.6, { weight: 600, caps: true });
  g.fillStyle = ACCENT;
  g.fillText(`第 ${L.n} 课`, s, 26);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  const titleSize = measure(g, L.title, 11.5, { weight: 600 }) > w ? 9 : 11.5;
  line(g, L.title, s, 39, titleSize, { weight: 600 });

  let y = 50;
  for (const p of L.explanation) {
    const y0 = y;
    y = para(g, p, s, y, w, 5.0, 6.6, { color: INK, weight: 600 }) + 1;
    block(blocks, '要点', p, s - 1, y0 - 5, s + w + 1, y - 6.3 + 2);
  }

  // 公式框
  y += 2;
  const eqTop = y;
  g.strokeStyle = RULE;
  g.lineWidth = 0.3;
  g.strokeRect(s - 2, eqTop, w + 2, 30);
  line(g, L.equation.symbols, s + 3, eqTop + 13, 8.6);
  para(g, L.equation.words, s + 3, eqTop + 21.5, w - 6, 3.4, 4.3, { color: SOFT, italic: true });
  const equation = { u0: s - 2, v0: eqTop, u1: s + w, v1: eqTop + 30 };
  block(blocks, '公式', `${L.equation.symbols}\n${L.equation.words}`, equation.u0, equation.v0, equation.u1, equation.v1);
  y = eqTop + 35;

  // 关键词
  label(g, '关键词', s, y);
  y += 5.6;
  for (const k of L.keywords) {
    const y0 = y;
    const tw = line(g, k.term, s, y, 4.3, { weight: 600 });
    y = para(g, k.def, s + tw + 2.5, y, w - tw - 2.5, 4.3, 5.2, { color: INK }) + 1;
    block(blocks, '关键词', `**${k.term}**　${k.def}`, s - 1, y0 - 4.2, s + w + 1, y - 5 + 1.5);
  }
  y += 4;

  // 预测
  label(g, '预测', s, y);
  y += 6;
  const qy = y;
  y = para(g, L.predict.question, s, y, w, 4.7, 5.8, { weight: 600 }) + 1.5;
  block(blocks, '预测', L.predict.question, s - 1, qy - 4.5, s + w + 1, y - 5.6);
  L.predict.options.forEach((opt, i) => {
    const box = tickBox(g, s, y);
    hits.push({ id: `predict:${i}`, ...box, u1: s + w });
    if (state.predict === i) {
      g.strokeStyle = '#273463';
      g.lineWidth = 0.55;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(s + 0.6, y - 1.6);
      g.lineTo(s + 1.9, y + 0.1);
      g.lineTo(s + 5.2, y - 5.2);
      g.stroke();
    }
    line(g, opt, s + 7, y, 4.3, { color: INK });
    y += 7;
  });
  y += 3;

  // 为什么（会被翻盖盖住）：字号自动缩到放得下
  let size = 4.1, lh = 5.1;
  for (; size > 3.3; size -= 0.15, lh = size * 1.25) {
    if (y + 12 + countLines(g, L.explain, w - 2, size) * lh + 3 <= LEFT.bottom - 2) break;
  }
  const n = countLines(g, L.explain, w - 2, size);
  const flap = { u0: s - 2, v0: y, u1: s + w, v1: Math.min(LEFT.bottom - 2, Math.max(y + 36, y + 12 + n * lh + 3)) };
  label(g, '为什么？', s, y + 6);
  para(g, L.explain, s, y + 12, w - 2, size, lh, { color: INK });
  hits.push({ id: 'flap', ...flap });

  // 页边栏：挑战 + 盖章位置
  const [m0, m1] = LEFT.margin;
  label(g, '挑战', m0, 212, 3.2);
  const cy = para(g, L.challenge.text, m0, 217.5, m1 - m0, 3.5, 4.4, { color: INK, italic: true });
  block(blocks, '挑战', L.challenge.text, m0 - 1, 214.5, m1 + 1, cy);
  g.setLineDash([0.8, 1.1]);
  g.strokeStyle = RULE;
  g.lineWidth = 0.35;
  g.beginPath();
  g.arc((m0 + m1) / 2, 194, 13, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);

  return {
    hits,
    blocks,
    regions: {
      equation,
      flap,
      margin: { u0: m0, v0: 20, u1: m1 + 2, v1: 180 },
      stamp: { cu: (m0 + m1) / 2, cv: 194, r: 13 },
    },
  };
}

export function drawLessonRight(g, L, state = {}, folio = '', runHead = '抛体运动') {
  const hits = [];
  const blocks = [];
  runningHead(g, false, runHead, folio);
  const s = RIGHT.text[0], e = PAGE.W - 16;
  // 当前装置的图注和动手提示（多装置的课按“装置”开关取）
  const exi = state.switches?.ex ?? 0;
  const X = L.exhibits?.[exi];
  const figure = X ? X.figure : L.figure, note = X ? X.note : L.figureNote, hint = X ? X.hint : L.tryHint;
  const caption = `图 ${L.n}　${figure}${note ? '。' + note : ''}`;
  // 一组开关：标签（斜体）+ 选项（当前的加下划线），右对齐到 right，返回左端
  const group = (sw, right, y) => {
    const widths = sw.options.map((o) => measure(g, o, 3.8, { weight: 600 }));
    const total = widths.reduce((a, b) => a + b, 0) + 5 * (sw.options.length - 1);
    let x = right - total;
    sw.options.forEach((o, i) => {
      const on = (state.switches?.[sw.id] ?? 0) === i;
      hits.push({ id: `switch:${sw.id}:${i}`, u0: x - 2, v0: y - 5, u1: x + widths[i] + 2, v1: y + 2.5 });
      line(g, o, x, y, 3.8, { weight: 600, color: on ? INK : SOFT });
      if (on) { g.strokeStyle = INK; g.lineWidth = 0.3; g.beginPath(); g.moveTo(x, y + 1.1); g.lineTo(x + widths[i], y + 1.1); g.stroke(); }
      x += widths[i] + 5;
    });
    const lw = measure(g, sw.label, 3.8, { italic: true });
    line(g, sw.label, right - total - lw - 3, y, 3.8, { color: SOFT, italic: true });
    return right - total - lw - 3;
  };
  const visible = (L.switches ?? []).filter((q) => q.ex == null || [].concat(q.ex).includes(exi));
  const exSw = visible.find((q) => q.id === 'ex'), params = visible.filter((q) => q.id !== 'ex');
  // 第一行：左图注，右参数开关；第二行：左动手提示，右“装置”切换。放不下就缩小字号
  let right = e, left1 = e;
  for (const sw of params.slice().reverse()) { left1 = group(sw, right, 222.5); right = left1 - 7; }
  let capSize = 3.4;
  while (capSize > 2.7 && s + measure(g, caption, capSize, { italic: true }) > left1 - 5) capSize -= 0.1;
  line(g, caption, s, 222, capSize, { color: SOFT, italic: true });
  const left2 = exSw ? group(exSw, e, 230) : e;
  let hintSize = 4.2;
  while (hintSize > 3.4 && s + measure(g, hint, hintSize, { italic: true }) > left2 - 6) hintSize -= 0.1;
  line(g, hint, s, 230, hintSize, { color: INK, italic: true });
  block(blocks, `图 ${L.n}`, `${figure}${note ? '。' + note : ''}`, s - 1, 218, Math.min(left1 - 4, s + 120), 224);
  block(blocks, '动手试试', hint, s - 1, 225.5, left2 - 4, 232);
  return {
    hits,
    blocks,
    regions: { figure: { u0: s - 2, v0: 215.5, u1: PAGE.W - 12, v1: 233.5 }, art: { u0: 10, v0: 16, u1: PAGE.W - 8, v1: 212 } },
  };
}
