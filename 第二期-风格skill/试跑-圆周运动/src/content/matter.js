import { LESSONS } from './lessons.js';
import { QUIZ } from './quiz.js';
import CONFIG from './config.js';
import { T } from './strings.js';
import { PAGE, LEFT, RIGHT, INK, SOFT, RULE, ACCENT, HAND, HANDF, font, line, para, label, tickBox, runningHead, hand, measure, countLines, fitLine, isCJK } from './type.js';

// 前后附页：扉页与“这本书怎么用”、本书的记号与目录、索引与公式一览、测验、参考来源与给老师的话。
// 版式沿用课文页：栏目标签（红色小字）+ 大标题 + 正文；能点的地方返回点击区域。

const LETTERS = 'ABCDEF';
/** 测验左页放几题（其余放右页） */
const QUIZ_LEFT = Math.ceil(QUIZ.length / 2);

export function drawMatter(g, sp, side, folio, st, env) {
  if (!(sp.kind === 'front' && side === 'left')) runningHead(g, side === 'left', sp.title, folio);
  const ctx = { st: st ?? {}, spreads: env.spreads, stampedOf: env.stampedOf, hits: [], blocks: [] };
  ctx.block = (tag, text, u0, v0, u1, v1) => ctx.blocks.push({ tag, text, u0, v0, u1, v1 });
  const fn = PAGES[`${sp.kind}:${side}`];
  if (fn) fn(g, ctx);
  return { hits: ctx.hits, blocks: ctx.blocks, regions: {} };
}

const kOf = (spreads, pred) => spreads.findIndex((s) => s && pred(s));
const lessonK = (spreads, n) => kOf(spreads, (s) => s.kind === 'lesson' && s.lesson.n === n);

function heading(g, tag, title, x, y = 26) {
  label(g, tag, x, y, 3.6);
  line(g, title, x, y + 13, 11.5, { weight: 600 });
}

function leader(g, x0, x1, y) {
  if (x1 - x0 < 3) return;
  g.fillStyle = SOFT;
  for (let x = x0 + 1; x < x1 - 1; x += 1.7) { g.beginPath(); g.arc(x, y - 0.9, 0.24, 0, Math.PI * 2); g.fill(); }
}

function arrowLine(g, x0, y0, x1, y1, color, w = 0.5) {
  const a = Math.atan2(y1 - y0, x1 - x0), h = 2.2;
  g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
  g.beginPath();
  g.moveTo(x1 - h * Math.cos(a - 0.42), y1 - h * Math.sin(a - 0.42));
  g.lineTo(x1, y1);
  g.lineTo(x1 - h * Math.cos(a + 0.42), y1 - h * Math.sin(a + 0.42));
  g.stroke();
}

function handTick(g, x, y) {
  g.strokeStyle = HAND; g.lineWidth = 0.55; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x + 0.6, y - 1.6); g.lineTo(x + 1.9, y + 0.1); g.lineTo(x + 5.2, y - 5.2); g.stroke();
}

// ---------- 跨页 1：扉页 + 这本书怎么用 ----------
function frontLeft(g) {
  const cx = PAGE.W / 2;
  const ts = measure(g, CONFIG.title, 15, { weight: 600 }) > 150 ? 11 : 15;
  line(g, CONFIG.title, cx, 92, ts, { weight: 600, align: 'center' });
  if (CONFIG.subtitle) line(g, CONFIG.subtitle, cx, 106, 5, { italic: true, color: SOFT, align: 'center' });
  g.strokeStyle = RULE; g.lineWidth = 0.3;
  g.beginPath(); g.moveTo(cx - 14, 114); g.lineTo(cx + 14, 114); g.stroke();
  if (CONFIG.series) line(g, CONFIG.series, cx, 124, 4, { color: SOFT, align: 'center' });
  // 扉页装饰：可在 config 里自己画（frontArt(g, cx, y)），默认是一本小小的立体书
  if (CONFIG.frontArt) CONFIG.frontArt(g, cx, 160);
  else { g.save(); g.translate(cx - 22, 138); g.scale(2.8, 2.8); ICONS.popup(g, 0, 0); g.restore(); }
  if (CONFIG.edition) line(g, CONFIG.edition, cx, 222, 3.4, { color: SOFT, align: 'center', italic: true });
}

const ICONS = {
  predict(g, x, y) {
    g.strokeStyle = INK; g.lineWidth = 0.32; g.strokeRect(x + 4, y + 3, 7, 7);
    g.strokeStyle = HAND; g.lineWidth = 0.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x + 5, y + 6.6); g.lineTo(x + 7, y + 9); g.lineTo(x + 12.5, y + 1.5); g.stroke();
  },
  popup(g, x, y) {
    g.strokeStyle = INK; g.lineWidth = 0.3;
    g.beginPath(); g.moveTo(x, y + 12); g.lineTo(x + 11, y + 12); g.lineTo(x + 15, y + 8); g.lineTo(x + 4, y + 8); g.closePath(); g.stroke();
    g.lineWidth = 0.35;
    g.beginPath(); g.moveTo(x + 5, y + 10.5); g.lineTo(x + 5, y + 4); g.lineTo(x + 9, y + 4); g.lineTo(x + 9, y + 10.5); g.stroke();
    g.beginPath(); g.moveTo(x + 5, y + 4); g.lineTo(x + 7, y + 2); g.lineTo(x + 11, y + 2); g.lineTo(x + 9, y + 4); g.moveTo(x + 11, y + 2); g.lineTo(x + 11, y + 8.5); g.stroke();
    arrowLine(g, x + 13.5, y + 6, x + 13.5, y + 1, SOFT, 0.3);
  },
  hands(g, x, y) {
    g.strokeStyle = INK; g.lineWidth = 0.32;
    g.beginPath(); g.arc(x + 4, y + 9, 2.2, 0, Math.PI * 2); g.stroke();
    g.setLineDash([0.8, 0.8]); g.beginPath(); g.arc(x + 4, y + 9, 6, -1.35, -0.2); g.stroke(); g.setLineDash([]);
    arrowLine(g, x + 8.5, y + 6.5, x + 9.6, y + 7.9, INK, 0.3);
    g.fillStyle = INK; g.beginPath(); g.moveTo(x + 10, y + 1); g.lineTo(x + 10, y + 9); g.lineTo(x + 12, y + 7.2); g.lineTo(x + 13.6, y + 10.4); g.lineTo(x + 14.6, y + 9.9); g.lineTo(x + 13, y + 6.8); g.lineTo(x + 15.6, y + 6.6); g.closePath(); g.fill();
  },
  flap(g, x, y) {
    g.strokeStyle = INK; g.lineWidth = 0.32;
    g.beginPath(); g.moveTo(x + 1, y + 2); g.lineTo(x + 15, y + 2); g.lineTo(x + 15, y + 7); g.quadraticCurveTo(x + 9, y + 6, x + 7, y + 12); g.lineTo(x + 1, y + 12); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(x + 15, y + 7); g.quadraticCurveTo(x + 12.5, y + 10.5, x + 7, y + 12); g.stroke();
    g.lineWidth = 0.2;
    for (const yy of [4.6, 7, 9.4]) { g.beginPath(); g.moveTo(x + 3, y + yy); g.lineTo(x + (yy > 8 ? 6.5 : 11), y + yy); g.stroke(); }
  },
  stamp(g, x, y) {
    g.setLineDash([0.8, 1]); g.strokeStyle = RULE; g.lineWidth = 0.35;
    g.beginPath(); g.arc(x + 8, y + 7, 6.5, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.strokeStyle = ACCENT; g.lineWidth = 0.4; g.globalAlpha = 0.85;
    g.beginPath(); g.arc(x + 8.6, y + 6.6, 5.2, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(x + 8.6, y + 6.6, 4.3, 0, Math.PI * 2); g.stroke();
    font(g, 3.6, { weight: 600 }); g.fillStyle = ACCENT; g.textAlign = 'center'; g.fillText('★', x + 8.6, y + 8); g.textAlign = 'left';
    g.globalAlpha = 1;
  },
};

function frontRight(g, ctx) {
  const s = RIGHT.text[0], w = RIGHT.text[1] - s;
  heading(g, T.frontTag, T.frontTitle, s);
  const steps = T.howto;
  let y = 56;
  steps.forEach(([icon, head, body], i) => {
    ICONS[icon](g, s, y - 6);
    line(g, `${i + 1}`, s + 22, y, 4.7, { weight: 600, color: ACCENT });
    line(g, head, s + 28, y, 4.7, { weight: 600 });
    const y0 = y;
    y = para(g, body, s + 28, y + 6, w - 28, 4.1, 5.2, { color: SOFT }) + 7;
    ctx.block(T.step(i + 1, head), body, s - 1, y0 - 6, s + w, y - 5);
  });
  g.strokeStyle = RULE; g.lineWidth = 0.25;
  g.beginPath(); g.moveTo(s, y); g.lineTo(s + w, y); g.stroke();
  y += 8;
  label(g, T.opsLabel, s, y, 3.2);
  y += 6;
  const ops = T.ops;
  for (const [a, b] of ops) {
    const tw = line(g, a, s, y, 3.9, { weight: 600 });
    line(g, b, s + Math.max(tw + 3, 38), y, 3.9, { color: SOFT });
    y += 5.6;
  }
}

// ---------- 跨页 2：本书的记号 + 目录 ----------
const LEGEND = CONFIG.legend ?? [];

function legendSample(g, it, x, y) {
  const kind = it.kind;
  if (kind === 'arrow') {
    const c = it.color ?? INK;
    if (it.dir === 'v') arrowLine(g, x + 10, y - 5, x + 10, y + 3.5, c, 0.55);
    else if (it.dir === 'd') arrowLine(g, x + 2, y + 3, x + 19, y - 4, c, 0.5);
    else arrowLine(g, x, y, x + 20, y, c, 0.55);
  }
  if (kind === 'strobe') {
    g.strokeStyle = INK; g.lineWidth = 0.3;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x + 2 + i * 4.4, y - 3 + i * i * 0.45, 1.2, 0, Math.PI * 2); g.stroke(); }
  }
  if (kind === 'dash') {
    g.setLineDash([1.2, 1]); g.strokeStyle = INK; g.lineWidth = 0.3;
    g.beginPath(); for (let i = 0; i <= 20; i++) { const t = i / 20, xx = x + 20 * t, yy = y + 3 - 14 * t + 12 * t * t; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); g.setLineDash([]);
  }
  if (kind === 'tube') {
    const cs = it.colors ?? ['#2f7bff', '#ff4a2a'];
    for (const [dx, c, f] of [[4, cs[0], 0.7], [12, cs[1] ?? cs[0], 0.4]]) {
      g.save(); g.shadowColor = c; g.shadowBlur = 3; g.fillStyle = c; g.globalAlpha = 0.85;
      g.fillRect(x + dx, y + 4 - 10 * f, 4, 10 * f); g.restore();
      g.strokeStyle = INK; g.lineWidth = 0.28; g.strokeRect(x + dx - 0.5, y - 6.5, 5, 11);
    }
  }
  if (kind === 'tag') {
    const [head, val] = it.sample ?? ['h', '1.20 m'];
    g.fillStyle = '#f7f2e6'; g.fillRect(x + 1, y - 5, 18, 8); g.strokeStyle = INK; g.lineWidth = 0.22; g.strokeRect(x + 1, y - 5, 18, 8);
    font(g, 1.9, { weight: 600 }); g.fillStyle = SOFT; g.fillText(head, x + 2.4, y - 2.4);
    hand(g, val, x + 2.4, y + 1.8, 3.6, { rotate: 0 });
  }
  if (kind === 'hand') hand(g, it.sample ?? 'x = 1.0', x, y + 1.2, 4.2);
  if (kind === 'stamp') { g.setLineDash([0.8, 1.1]); g.strokeStyle = RULE; g.lineWidth = 0.35; g.beginPath(); g.arc(x + 10, y - 0.5, 5.5, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
  if (kind === 'switch') {
    const [off, on] = it.sample ?? (CONFIG.lang === 'en' ? ['off', 'on'] : ['关', '开']);
    const ow = line(g, off, x + 1, y + 1.4, 3.8, { weight: 600, color: SOFT });
    const w = line(g, on, x + ow + 4, y + 1.4, 3.8, { weight: 600 });
    g.strokeStyle = INK; g.lineWidth = 0.3; g.beginPath(); g.moveTo(x + ow + 4, y + 2.5); g.lineTo(x + ow + 4 + w, y + 2.5); g.stroke();
  }
}

function contentsLeft(g, ctx) {
  const s = LEFT.text[0], w = LEFT.text[1] - s;
  heading(g, T.legendTag, T.legendTitle, s);
  let y = 58;
  const gap = LEGEND.length > 10 ? 16.2 * 10 / LEGEND.length : 16.2;
  for (const it of LEGEND) {
    const { name, desc } = it;
    legendSample(g, it, s, y - 1.5);
    line(g, name, s + 27, y, 4.2, { weight: 600 });
    para(g, desc, s + 27, y + 5, w - 27, 3.7, 4.6, { color: SOFT });
    ctx.block(`${T.legendTag}　${name}`, desc, s - 1, y - 7, s + w, y + 9);
    y += gap;
  }
  const [m0, m1] = LEFT.margin;
  T.legendHand.forEach((t, i) => hand(g, t, m0, 64 + 6 * i, 4.2));
  void m1;
}

function contentsRight(g, ctx) {
  const { spreads, hits } = ctx;
  const s = RIGHT.text[0], e = RIGHT.text[1];
  heading(g, T.contentsTag, T.contentsTitle(LESSONS.length), s);
  const step = LESSONS.length > 6 ? Math.max(14, 126 / LESSONS.length) : 21;
  let y = 62;
  for (const L of LESSONS) {
    const k = lessonK(spreads, L.n);
    const page = 2 * k;
    line(g, String(L.n), s, y, 9, { weight: 600, color: ACCENT });
    const tw = line(g, L.title, s + 12, y - 1, 5.6, { weight: 600 });
    const pw = measure(g, String(page), 4.6, { weight: 500 });
    line(g, String(page), e, y - 1, 4.6, { weight: 500, align: 'right' });
    leader(g, s + 12 + tw + 2, e - pw - 2, y - 1);
    line(g, T.textbookRef(L.textbook, L.n, L.figure), s + 12, y + 5.4, 3.5, { color: SOFT, italic: true });
    const stamped = ctx.stampedOf?.(k);
    if (stamped) {
      g.save(); g.globalAlpha = 0.85; g.strokeStyle = ACCENT; g.lineWidth = 0.35;
      g.beginPath(); g.arc(e - 3.5, y + 4.2, 3, 0, Math.PI * 2); g.stroke();
      font(g, 2.8, { weight: 600 }); g.fillStyle = ACCENT; g.textAlign = 'center'; g.fillText('★', e - 3.5, y + 5.2); g.textAlign = 'left'; g.restore();
    }
    hits.push({ id: `goto:${k}`, u0: s - 2, v0: y - 9, u1: e + 1, v1: y + 8 });
    ctx.block(`${T.lessonNo(L.n)}　${T.page(page)}`, `**${L.title}**　${L.explanation[0]}`, s - 2, y - 9, e + 1, y + 8);
    y += step;
  }
  y += 4;
  g.strokeStyle = RULE; g.lineWidth = 0.25; g.beginPath(); g.moveTo(s, y - 6); g.lineTo(e, y - 6); g.stroke();
  for (const [kind, name] of [['index', T.indexEntry], ['quiz', T.quizEntry], ['sources', T.sourcesEntry]]) {
    const k = kOf(spreads, (x) => x.kind === kind);
    if (k < 0) continue;
    const tw = line(g, name, s + 12, y, 4.6, { weight: 500 });
    const pw = measure(g, String(2 * k), 4.2);
    line(g, String(2 * k), e, y, 4.2, { align: 'right' });
    leader(g, s + 12 + tw + 2, e - pw - 2, y);
    hits.push({ id: `goto:${k}`, u0: s - 2, v0: y - 5, u1: e + 1, v1: y + 2.5 });
    y += 9;
  }
  const done = LESSONS.filter((L) => ctx.stampedOf?.(lessonK(spreads, L.n))).length;
  hand(g, done ? T.stampedCount(done, LESSONS.length) : T.contentsHand, e, 214, 4.4, { align: 'right' });
}

// ---------- 跨页 8：索引 + 公式一览 ----------
function indexLeft(g, ctx) {
  const { spreads, hits } = ctx;
  const s = LEFT.text[0], e = LEFT.text[1];
  heading(g, T.indexTag, T.indexTitle, s);
  const zh = CONFIG.lang !== 'en';
  const coll = new Intl.Collator(zh ? 'zh-Hans-CN-u-co-pinyin' : 'en', { sensitivity: 'base' });
  const seen = new Set();
  const terms = [...LESSONS.flatMap((L) => L.keywords.map((kw) => ({ term: kw.term, def: kw.def, n: L.n }))), ...(CONFIG.extraTerms ?? [])]
    .filter((t) => !seen.has(t.term) && seen.add(t.term))
    .sort((a, b) => coll.compare(a.term, b.term));
  // 按拼音首字母分组：每个字母的“第一个字”作边界（拼音排序下的常用技巧）
  const BOUND = [['A', '阿'], ['B', '八'], ['C', '嚓'], ['D', '哒'], ['E', '妸'], ['F', '发'], ['G', '旮'], ['H', '哈'], ['J', '讥'], ['K', '咔'], ['L', '垃'], ['M', '妈'], ['N', '拏'], ['O', '噢'], ['P', '妑'], ['Q', '七'], ['R', '呥'], ['S', '仨'], ['T', '他'], ['W', '屲'], ['X', '夕'], ['Y', '丫'], ['Z', '帀']];
  const letterOf = (t) => {
    if (!zh || !isCJK(t[0])) return t[0].toLocaleUpperCase();
    let L = ''; for (const [l, c] of BOUND) if (coll.compare(t, c) >= 0) L = l; return L;
  };
  const rows = [];
  let last = '';
  for (const t of terms) { const L = letterOf(t.term); if (L !== last) { rows.push({ letter: L }); last = L; } rows.push(t); }
  const colW = (e - s - 10) / 2, y0 = 60;
  // 分栏放在离中间最近的字母处，避免一组被拆开
  const half = rows.reduce((best, r, i) => (r.letter && Math.abs(i - rows.length / 2) < Math.abs(best - rows.length / 2) ? i : best), rows.length);
  let y = y0;
  rows.forEach((t, i) => {
    if (i === half) y = y0;
    const x = s + (i < half ? 0 : colW + 10);
    if (t.letter) { if (y > y0) y += 1.5; line(g, t.letter, x, y, 4.4, { weight: 600, color: ACCENT }); y += 6.2; return; }
    const k = lessonK(spreads, t.n), page = String(2 * k);
    const tw = line(g, t.term, x, y, 4.1);
    const pw = measure(g, page, 4.1);
    line(g, page, x + colW, y, 4.1, { align: 'right', color: SOFT });
    leader(g, x + tw + 1.5, x + colW - pw - 1.5, y);
    hits.push({ id: `goto:${k}`, u0: x - 1, v0: y - 4.5, u1: x + colW + 1, v1: y + 1.8 });
    ctx.block(T.termEntry(page), `**${t.term}**　${t.def ?? T.seeLesson(t.n)}`, x - 1, y - 4.5, x + colW + 1, y + 1.8);
    y += 6.4;
  });
  const [m0] = LEFT.margin;
  T.indexHand.forEach((t, i) => hand(g, t, m0, 64 + 6 * i, 4.2));
}

function indexRight(g, ctx) {
  const { spreads, hits } = ctx;
  const s = RIGHT.text[0], e = RIGHT.text[1];
  heading(g, T.recapTag, T.recapTitle, s);
  let y = 60;
  for (const L of LESSONS) {
    const k = lessonK(spreads, L.n);
    label(g, `${T.lessonNo(L.n)}　${L.short ?? L.title}`, s, y, 3.2);
    line(g, String(2 * k), e, y, 3.4, { align: 'right', color: SOFT });
    fitLine(g, L.equation.symbols, s, y + 10, 7.2, e - s, 5);
    const end = para(g, L.equation.words, s, y + 17, e - s, 3.6, 4.6, { color: SOFT, italic: true });
    hits.push({ id: `goto:${k}`, u0: s - 2, v0: y - 5, u1: e + 1, v1: end - 2 });
    ctx.block(T.recapItem(L.n), `${L.equation.symbols}\n${L.equation.words}`, s - 2, y - 5, e + 1, end - 2);
    y = end + 6.5;
  }
}

// ---------- 跨页 9：测验 ----------
function quizBlock(g, ctx, i, x, y, w) {
  const Q = QUIZ[i], ans = ctx.st.quiz?.[i];
  const top = y;
  line(g, String(i + 1), x, y, 4.4, { weight: 600, color: ACCENT });
  y = para(g, Q.q, x + 6, y, w - 6, 4.2, 5.3, { weight: 500 }) + 1.2;
  // 选项横排，放不下就换行
  let ox = x + 6;
  Q.options.forEach((opt, j) => {
    const ow = 7 + measure(g, opt, 4) + 7;
    if (ox + ow > x + w && ox > x + 6) { ox = x + 6; y += 6.4; }
    const box = tickBox(g, ox, y, 4);
    ctx.hits.push({ id: `quiz:${i}:${j}`, u0: box.u0, v0: box.v0, u1: ox + ow - 4, v1: box.v1 });
    line(g, opt, ox + 6, y, 4, { color: INK });
    if (ans === j) {
      handTick(g, ox - 0.4, y + 0.3);
      const ok = j === Q.answer;
      hand(g, ok ? '✓' : '✗', ox + ow - 6.5, y + 0.4, 5, { color: ok ? HAND : ACCENT, rotate: 0 });
    }
    ox += ow;
  });
  y += 5.6;
  if (ans != null) y = (() => { g.save(); const yy = para(g, (ans === Q.answer ? '' : T.answerIs(LETTERS[Q.answer])) + Q.why, x + 6, y, w - 8, 3.9, 4.8, { color: HAND, family: HANDF, weight: 500 }); g.restore(); return yy; })();
  else y += 4.8;
  ctx.block(T.question(i + 1), `${Q.q}　${Q.options.map((o, j) => `${LETTERS[j]}. ${o}`).join('　')}`, x - 1, top - 5, x + w, y);
  return y + 5.2;
}

function quizLeft(g, ctx) {
  const s = LEFT.text[0], w = LEFT.text[1] - s;
  heading(g, T.quizTag, T.quizTitle, s);
  para(g, T.quizIntro(QUIZ.length), s, 50, w, 4.1, 5.2, { color: SOFT });
  let y = 62;
  for (let i = 0; i < Math.min(QUIZ.length, QUIZ_LEFT); i++) y = quizBlock(g, ctx, i, s, y, w);
  const [m0] = LEFT.margin;
  T.quizHand.forEach((t, i) => hand(g, t, m0, 64 + 6 * i, 4.2));
}

function quizRight(g, ctx) {
  const s = RIGHT.text[0], w = RIGHT.text[1] - s;
  let y = 26;
  for (let i = QUIZ_LEFT; i < QUIZ.length; i++) y = quizBlock(g, ctx, i, s, y, w);
  const q = ctx.st.quiz ?? {};
  const answered = Object.keys(q).length, right = Object.entries(q).filter(([i, j]) => QUIZ[i].answer === j).length;
  g.strokeStyle = RULE; g.lineWidth = 0.25; g.beginPath(); g.moveTo(s, 212); g.lineTo(s + w, 212); g.stroke();
  if (answered) {
    hand(g, T.quizScore(answered, right, answered === QUIZ.length && right === QUIZ.length), s, 224, 5.2);
    const rw = measure(g, T.quizReset, 3.9, { italic: true });
    line(g, T.quizReset, s + w, 223, 3.9, { italic: true, color: SOFT, align: 'right' });
    g.strokeStyle = SOFT; g.lineWidth = 0.22; g.beginPath(); g.moveTo(s + w - rw, 224.2); g.lineTo(s + w, 224.2); g.stroke();
    ctx.hits.push({ id: 'quiz:reset', u0: s + w - rw - 2, v0: 218, u1: s + w + 1, v1: 226.5 });
  } else {
    line(g, T.quizEmpty, s, 223, 3.9, { italic: true, color: SOFT });
  }
}

// ---------- 跨页 10：参考来源 + 给老师 ----------
function sourcesLeft(g, ctx) {
  const s = LEFT.text[0], w = LEFT.text[1] - s;
  heading(g, T.sourcesTag, T.sourcesTitle, s);
  let y = 58;
  (CONFIG.sources ?? []).forEach((r, i) => {
    line(g, `[${i + 1}]`, s, y, 3.9, { color: SOFT });
    const y0 = y;
    y = para(g, r, s + 8, y, w - 8, 3.9, 5, { color: INK }) + 3.5;
    ctx.block(T.sourceItem(i + 1), r, s - 1, y0 - 4.5, s + w, y - 3);
  });
  y += 4;
  for (const n of [...(CONFIG.notes ?? []), { label: T.fontsLabel, text: T.fontsText }]) {
    label(g, n.label, s, y, 3.2);
    y = para(g, n.text, s, y + 6, w, 3.9, 5, { color: SOFT }) + 5;
  }
  void countLines;
}

function sourcesRight(g) {
  const s = RIGHT.text[0], w = RIGHT.text[1] - s;
  heading(g, T.teacherTag, T.teacherTitle, s);
  const TC = CONFIG.teacher ?? {};
  let y = 54;
  if (TC.intro) y = para(g, TC.intro, s, y, w, 4, 5.2, { color: INK }) + 4;
  for (const [a, b] of TC.notes ?? []) {
    const aw = Math.max(16, measure(g, a, 4, { weight: 600 }) + 3);
    line(g, a, s, y, 4, { weight: 600, color: ACCENT });
    y = para(g, b, s + aw, y, w - aw, 3.9, 5, { color: SOFT }) + 2.6;
  }
  if (!TC.misconceptions?.length) return;
  y += 3;
  label(g, T.misconLabel, s, y, 3.2);
  y += 6;
  for (const m of TC.misconceptions) {
    g.strokeStyle = ACCENT; g.lineWidth = 0.3;
    g.beginPath(); g.moveTo(s + 0.5, y - 2.8); g.lineTo(s + 3, y - 0.3); g.moveTo(s + 3, y - 2.8); g.lineTo(s + 0.5, y - 0.3); g.stroke();
    y = para(g, m, s + 6, y, w - 6, 3.9, 5, { color: INK }) + 1.4;
  }
}

const PAGES = {
  'front:left': frontLeft, 'front:right': frontRight,
  'contents:left': contentsLeft, 'contents:right': contentsRight,
  'index:left': indexLeft, 'index:right': indexRight,
  'quiz:left': quizLeft, 'quiz:right': quizRight,
  'sources:left': sourcesLeft, 'sources:right': sourcesRight,
};

/** 附页上出现的所有文字（预加载字形用） */
export const MATTER_TEXT = [...Object.values(PAGES), ...Object.values(ICONS), quizBlock, legendSample].map((f) => f.toString()).join('') + JSON.stringify([QUIZ, LEGEND, CONFIG.extraTerms, CONFIG.sources, CONFIG.notes, CONFIG.teacher, T]) + Object.values(T).filter((v) => typeof v === 'function').map((f) => f.toString()).join('');
