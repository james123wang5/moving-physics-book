import { LESSONS } from './lessons.js';
import { PAGE, LEFT, RIGHT, INK, SOFT, RULE, ACCENT, HAND, HANDF, font, line, para, label, tickBox, runningHead, hand, measure, countLines } from './type.js';

// 前后附页：扉页与“这本书怎么用”、本书的记号与目录、索引与公式一览、测验、参考来源与给老师的话。
// 版式沿用课文页：栏目标签（红色小字）+ 大标题 + 正文；能点的地方返回点击区域。

const BLUE = '#2a5db0', RED = '#b8412e';

/** 原创测验题：答案序号从 0 开始；why 是答完后出现的手写理由 */
export const QUIZ = [
  { q: '物体做曲线运动时，它在某一点的速度方向：', options: ['指向轨迹弯曲的内侧', '沿轨迹在这一点的切线', '和合力方向相同'], answer: 1, why: '速度沿切线；指向内侧的是合力。', n: 1 },
  { q: '物体做曲线运动，下面哪一项一定在变化？', options: ['速度的大小', '加速度', '速度的方向'], answer: 2, why: '平抛的加速度不变，匀速圆周的速率不变，但方向一定在变。', n: 1 },
  { q: '河宽 60 m，水速 3 m/s，船在静水中的速度 5 m/s。最短的过河时间是：', options: ['12 s', '15 s', '20 s'], answer: 0, why: '船头正对对岸：t = 60 m ÷ 5 m/s = 12 s。', n: 2 },
  { q: '同一条河、同一条船，要正好到达正对岸，过河要用：', options: ['12 s', '15 s', '20 s'], answer: 1, why: '船头偏向上游，合速度 √(5² − 3²) = 4 m/s，t = 15 s。', n: 2 },
  { q: '频闪间隔 T = 0.1 s，平抛小球相邻两段竖直位移之差约为（g 取 9.8 m/s²）：', options: ['4.9 cm', '9.8 cm', '19.6 cm'], answer: 1, why: 'Δy = gT² = 9.8 × 0.01 m ≈ 9.8 cm。', n: 3 },
  { q: '从 0.8 m 高处以 3 m/s 水平抛出（g 取 10 m/s²），落地点离抛出点的水平距离：', options: ['1.2 m', '1.6 m', '2.4 m'], answer: 0, why: 't = √(2h/g) = 0.4 s，x = v₀t = 1.2 m。', n: 4 },
  { q: '平抛运动中，任意两段相等时间内速度的变化量：', options: ['大小相等，方向不同', '大小、方向都相同', '越来越大'], answer: 1, why: 'Δv = gΔt，方向总是竖直向下。', n: 4 },
  { q: '平抛 t 时刻，速度与水平方向夹角为 α，位移与水平方向夹角为 β，则：', options: ['tanα = tanβ', 'tanα = 2tanβ', 'tanβ = 2tanα'], answer: 1, why: 'tanα = gt/v₀，tanβ = gt/(2v₀)。', n: 4 },
  { q: '在平地上以同样大小的速度斜抛，仰角 30° 和 60° 的射程相比：', options: ['30° 远', '60° 远', '一样远'], answer: 2, why: 'sin60° = sin120°，两个角互余，射程相同。', n: 5 },
  { q: '斜抛的物体到达最高点时：', options: ['速度为零', '加速度为零', '速度水平，加速度仍为 g'], answer: 2, why: '竖直分速度为零，水平分速度还在；重力一直都在。', n: 5 },
];

/** 索引里除了关键词以外的词条 */
const EXTRA_TERMS = [
  { term: '速度的方向', n: 1 }, { term: '合速度', n: 2 }, { term: '运动的独立性', n: 3 }, { term: '自由落体', n: 3 },
  { term: '重力加速度 g', n: 4 }, { term: '最佳抛射角', n: 5 }, { term: '射高', n: 5 },
];

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
  line(g, '抛体运动', cx, 92, 15, { weight: 600, align: 'center' });
  line(g, '一本会动的物理书', cx, 106, 5, { italic: true, color: SOFT, align: 'center' });
  g.strokeStyle = RULE; g.lineWidth = 0.3;
  g.beginPath(); g.moveTo(cx - 14, 114); g.lineTo(cx + 14, 114); g.stroke();
  line(g, '高中物理 · 第五章', cx, 124, 4, { color: SOFT, align: 'center' });
  // 一条小小的抛物线做装饰：抛出点、四个频闪圈、落点
  const x0 = cx - 26, y0 = 160, pts = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; pts.push([x0 + 52 * t, y0 - 26 * t + 26 * t * t * 1.0 + 0]); }
  g.setLineDash([1, 1]); g.strokeStyle = SOFT; g.lineWidth = 0.25;
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); g.setLineDash([]);
  for (const i of [0, 10, 20, 30, 40]) { const [x, y] = pts[i]; g.strokeStyle = INK; g.lineWidth = 0.3; g.beginPath(); g.arc(x, y - 1.6, 1.4, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = INK; g.lineWidth = 0.3; g.beginPath(); g.moveTo(x0 - 6, y0 + 0.2); g.lineTo(x0 + 58, y0 + 0.2); g.stroke();
  line(g, '第一版 · 2026', cx, 222, 3.4, { color: SOFT, align: 'center', italic: true });
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
  heading(g, '开始之前', '这本书怎么用', s);
  const steps = [
    ['predict', '先猜', '每课左页有一道预测题。动手之前，先勾一个你觉得对的答案。'],
    ['popup', '看它立起来', '翻到一课，右页的插图会先被钢笔画出来，再从纸面上立起来，变成可以摆弄的小沙盘。'],
    ['hands', '动手', '拖动、点击插图里的装置；图注右边的小字是开关。页边的手写数字会跟着你的操作改写。'],
    ['flap', '掀开翻盖', '“为什么？”藏在翻盖下面。做完实验再掀开，对一对你的预测。'],
    ['stamp', '接受挑战', '每课页边都有一个挑战。完成了，虚线圈里会盖上一个章。'],
  ];
  let y = 56;
  steps.forEach(([icon, head, body], i) => {
    ICONS[icon](g, s, y - 6);
    line(g, `${i + 1}`, s + 22, y, 4.7, { weight: 600, color: ACCENT });
    line(g, head, s + 28, y, 4.7, { weight: 600 });
    const y0 = y;
    y = para(g, body, s + 28, y + 6, w - 28, 4.1, 5.2, { color: SOFT }) + 7;
    ctx.block(`第 ${i + 1} 步　${head}`, body, s - 1, y0 - 6, s + w, y - 5);
  });
  g.strokeStyle = RULE; g.lineWidth = 0.25;
  g.beginPath(); g.moveTo(s, y); g.lineTo(s + w, y); g.stroke();
  y += 8;
  label(g, '操作', s, y, 3.2);
  y += 6;
  const ops = [['拖动书页空白处', '转一转视角，松手会回正'], ['在书页上快速横扫', '翻页（← → 键也可以）'], ['底部控制条', '目录、看演示、声音、静止模式'], ['Esc', '停止正在播放的演示']];
  for (const [a, b] of ops) {
    const tw = line(g, a, s, y, 3.9, { weight: 600 });
    line(g, b, s + Math.max(tw + 3, 38), y, 3.9, { color: SOFT });
    y += 5.6;
  }
}

// ---------- 跨页 2：本书的记号 + 目录 ----------
const LEGEND = [
  ['blue', '蓝色', '水平方向：水平分速度、水平分位移和它们的投影。'],
  ['red', '红色', '竖直方向：竖直分速度、下落的高度。'],
  ['ink', '黑色箭头', '合速度：真实的速度，沿着轨迹的切线。'],
  ['strobe', '小圆圈', '频闪：每隔相同的时间（多为 0.1 s）留下的一个位置。'],
  ['dash', '虚线', '理想轨迹（不计空气阻力）、投影线和辅助线。'],
  ['tube', '发光液柱', '速度的大小：液面越高越快，管上的纸签写着读数。'],
  ['tag', '纸签', '插图里随时更新的读数。'],
  ['hand', '手写字', '页边“你的数据”，随你的操作改写。'],
  ['stamp', '虚线圈', '挑战完成后在这里盖章。'],
  ['switch', '开关', '图注右边的小字；带下划线的是当前的选择。'],
];

function legendSample(g, kind, x, y) {
  if (kind === 'blue') arrowLine(g, x, y, x + 20, y, BLUE, 0.55);
  if (kind === 'red') arrowLine(g, x + 10, y - 5, x + 10, y + 3.5, RED, 0.55);
  if (kind === 'ink') arrowLine(g, x + 2, y + 3, x + 19, y - 4, INK, 0.5);
  if (kind === 'strobe') {
    g.strokeStyle = INK; g.lineWidth = 0.3;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x + 2 + i * 4.4, y - 3 + i * i * 0.45, 1.2, 0, Math.PI * 2); g.stroke(); }
  }
  if (kind === 'dash') {
    g.setLineDash([1.2, 1]); g.strokeStyle = INK; g.lineWidth = 0.3;
    g.beginPath(); for (let i = 0; i <= 20; i++) { const t = i / 20, xx = x + 20 * t, yy = y + 3 - 14 * t + 12 * t * t; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke(); g.setLineDash([]);
  }
  if (kind === 'tube') {
    for (const [dx, c, f] of [[4, '#2f7bff', 0.7], [12, '#ff4a2a', 0.4]]) {
      g.save(); g.shadowColor = c; g.shadowBlur = 3; g.fillStyle = c; g.globalAlpha = 0.85;
      g.fillRect(x + dx, y + 4 - 10 * f, 4, 10 * f); g.restore();
      g.strokeStyle = INK; g.lineWidth = 0.28; g.strokeRect(x + dx - 0.5, y - 6.5, 5, 11);
    }
  }
  if (kind === 'tag') {
    g.fillStyle = '#f7f2e6'; g.fillRect(x + 1, y - 5, 18, 8); g.strokeStyle = INK; g.lineWidth = 0.22; g.strokeRect(x + 1, y - 5, 18, 8);
    font(g, 1.9, { weight: 600 }); g.fillStyle = SOFT; g.fillText('高度 h', x + 2.4, y - 2.4);
    hand(g, '1.20 m', x + 2.4, y + 1.8, 3.6, { rotate: 0 });
  }
  if (kind === 'hand') hand(g, 'v₀ = 2.0 m/s', x, y + 1.2, 4.2);
  if (kind === 'stamp') { g.setLineDash([0.8, 1.1]); g.strokeStyle = RULE; g.lineWidth = 0.35; g.beginPath(); g.arc(x + 10, y - 0.5, 5.5, 0, Math.PI * 2); g.stroke(); g.setLineDash([]); }
  if (kind === 'switch') {
    line(g, '关', x + 3, y + 1.4, 3.8, { weight: 600, color: SOFT });
    const w = line(g, '开', x + 11, y + 1.4, 3.8, { weight: 600 });
    g.strokeStyle = INK; g.lineWidth = 0.3; g.beginPath(); g.moveTo(x + 11, y + 2.5); g.lineTo(x + 11 + w, y + 2.5); g.stroke();
  }
}

function contentsLeft(g, ctx) {
  const s = LEFT.text[0], w = LEFT.text[1] - s;
  heading(g, '图例', '本书的记号', s);
  let y = 58;
  for (const [kind, name, desc] of LEGEND) {
    legendSample(g, kind, s, y - 1.5);
    line(g, name, s + 27, y, 4.2, { weight: 600 });
    para(g, desc, s + 27, y + 5, w - 27, 3.7, 4.6, { color: SOFT });
    ctx.block(`记号　${name}`, desc, s - 1, y - 7, s + w, y + 9);
    y += 16.2;
  }
  const [m0, m1] = LEFT.margin;
  hand(g, '颜色在每一课', m0, 64, 4.2);
  hand(g, '都是同一个意思', m0, 70, 4.2);
  void m1;
}

function contentsRight(g, ctx) {
  const { spreads, hits } = ctx;
  const s = RIGHT.text[0], e = RIGHT.text[1];
  heading(g, '目录', '五课', s);
  let y = 62;
  for (const L of LESSONS) {
    const k = lessonK(spreads, L.n);
    const page = 2 * k;
    line(g, String(L.n), s, y, 9, { weight: 600, color: ACCENT });
    const tw = line(g, L.title, s + 12, y - 1, 5.6, { weight: 600 });
    const pw = measure(g, String(page), 4.6, { weight: 500 });
    line(g, String(page), e, y - 1, 4.6, { weight: 500, align: 'right' });
    leader(g, s + 12 + tw + 2, e - pw - 2, y - 1);
    line(g, `教材 ${L.textbook}　·　图 ${L.n}　${L.figure}`, s + 12, y + 5.4, 3.5, { color: SOFT, italic: true });
    const stamped = ctx.stampedOf?.(k);
    if (stamped) {
      g.save(); g.globalAlpha = 0.85; g.strokeStyle = ACCENT; g.lineWidth = 0.35;
      g.beginPath(); g.arc(e - 3.5, y + 4.2, 3, 0, Math.PI * 2); g.stroke();
      font(g, 2.8, { weight: 600 }); g.fillStyle = ACCENT; g.textAlign = 'center'; g.fillText('★', e - 3.5, y + 5.2); g.textAlign = 'left'; g.restore();
    }
    hits.push({ id: `goto:${k}`, u0: s - 2, v0: y - 9, u1: e + 1, v1: y + 8 });
    ctx.block(`第 ${L.n} 课　第 ${page} 页`, `**${L.title}**　${L.explanation[0]}`, s - 2, y - 9, e + 1, y + 8);
    y += 21;
  }
  y += 4;
  g.strokeStyle = RULE; g.lineWidth = 0.25; g.beginPath(); g.moveTo(s, y - 6); g.lineTo(e, y - 6); g.stroke();
  for (const [kind, name] of [['index', '索引 · 公式一览'], ['quiz', '测验'], ['sources', '参考来源 · 给老师']]) {
    const k = kOf(spreads, (x) => x.kind === kind);
    const tw = line(g, name, s + 12, y, 4.6, { weight: 500 });
    const pw = measure(g, String(2 * k), 4.2);
    line(g, String(2 * k), e, y, 4.2, { align: 'right' });
    leader(g, s + 12 + tw + 2, e - pw - 2, y);
    hits.push({ id: `goto:${k}`, u0: s - 2, v0: y - 5, u1: e + 1, v1: y + 2.5 });
    y += 9;
  }
  const done = LESSONS.filter((L) => ctx.stampedOf?.(lessonK(spreads, L.n))).length;
  hand(g, done ? `已盖章 ${done} / 5` : '点标题就能翻过去', e, 214, 4.4, { align: 'right' });
}

// ---------- 跨页 8：索引 + 公式一览 ----------
function indexLeft(g, ctx) {
  const { spreads, hits } = ctx;
  const s = LEFT.text[0], e = LEFT.text[1];
  heading(g, '索引', '词条', s);
  const coll = new Intl.Collator('zh-Hans-CN-u-co-pinyin');
  const seen = new Set();
  const terms = [...LESSONS.flatMap((L) => L.keywords.map((kw) => ({ term: kw.term, def: kw.def, n: L.n }))), ...EXTRA_TERMS]
    .filter((t) => !seen.has(t.term) && seen.add(t.term))
    .sort((a, b) => coll.compare(a.term, b.term));
  // 按拼音首字母分组：每个字母的“第一个字”作边界（拼音排序下的常用技巧）
  const BOUND = [['A', '阿'], ['B', '八'], ['C', '嚓'], ['D', '哒'], ['E', '妸'], ['F', '发'], ['G', '旮'], ['H', '哈'], ['J', '讥'], ['K', '咔'], ['L', '垃'], ['M', '妈'], ['N', '拏'], ['O', '噢'], ['P', '妑'], ['Q', '七'], ['R', '呥'], ['S', '仨'], ['T', '他'], ['W', '屲'], ['X', '夕'], ['Y', '丫'], ['Z', '帀']];
  const letterOf = (t) => { let L = ''; for (const [l, c] of BOUND) if (coll.compare(t, c) >= 0) L = l; return L; };
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
    ctx.block(`词条　第 ${page} 页`, `**${t.term}**　${t.def ?? `见第 ${t.n} 课。`}`, x - 1, y - 4.5, x + colW + 1, y + 1.8);
    y += 6.4;
  });
  const [m0] = LEFT.margin;
  hand(g, '点词条，', m0, 64, 4.2);
  hand(g, '直接翻到那一课', m0, 70, 4.2);
}

function indexRight(g, ctx) {
  const { spreads, hits } = ctx;
  const s = RIGHT.text[0], e = RIGHT.text[1];
  heading(g, '回顾', '公式一览', s);
  let y = 60;
  for (const L of LESSONS) {
    const k = lessonK(spreads, L.n);
    label(g, `第 ${L.n} 课　${L.short ?? L.title}`, s, y, 3.2);
    line(g, String(2 * k), e, y, 3.4, { align: 'right', color: SOFT });
    line(g, L.equation.symbols, s, y + 10, 7.2);
    const end = para(g, L.equation.words, s, y + 17, e - s, 3.6, 4.6, { color: SOFT, italic: true });
    hits.push({ id: `goto:${k}`, u0: s - 2, v0: y - 5, u1: e + 1, v1: end - 2 });
    ctx.block(`第 ${L.n} 课　公式`, `${L.equation.symbols}\n${L.equation.words}`, s - 2, y - 5, e + 1, end - 2);
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
  if (ans != null) y = (() => { g.save(); const yy = para(g, (ans === Q.answer ? '' : `答案是 ${'ABC'[Q.answer]}。`) + Q.why, x + 6, y, w - 8, 3.9, 4.8, { color: HAND, family: HANDF, weight: 500 }); g.restore(); return yy; })();
  else y += 4.8;
  ctx.block(`第 ${i + 1} 题`, `${Q.q}　${Q.options.map((o, j) => `${'ABC'[j]}. ${o}`).join('　')}`, x - 1, top - 5, x + w, y);
  return y + 5.2;
}

function quizLeft(g, ctx) {
  const s = LEFT.text[0], w = LEFT.text[1] - s;
  heading(g, '测验', '自我检测', s);
  para(g, '十道题，点方框作答，马上就能看到对错和理由。', s, 50, w, 4.1, 5.2, { color: SOFT });
  let y = 62;
  for (let i = 0; i < 5; i++) y = quizBlock(g, ctx, i, s, y, w);
  const [m0] = LEFT.margin;
  hand(g, '答错了也没关系，', m0, 64, 4.2);
  hand(g, '回到那一课', m0, 70, 4.2);
  hand(g, '再玩一次。', m0, 76, 4.2);
}

function quizRight(g, ctx) {
  const s = RIGHT.text[0], w = RIGHT.text[1] - s;
  let y = 26;
  for (let i = 5; i < 10; i++) y = quizBlock(g, ctx, i, s, y, w);
  const q = ctx.st.quiz ?? {};
  const answered = Object.keys(q).length, right = Object.entries(q).filter(([i, j]) => QUIZ[i].answer === j).length;
  g.strokeStyle = RULE; g.lineWidth = 0.25; g.beginPath(); g.moveTo(s, 212); g.lineTo(s + w, 212); g.stroke();
  if (answered) {
    hand(g, `答了 ${answered} 题，对 ${right} 题${answered === QUIZ.length ? (right === QUIZ.length ? '　全对！' : '') : ''}`, s, 224, 5.2);
    const rw = measure(g, '重新做一遍', 3.9, { italic: true });
    line(g, '重新做一遍', s + w, 223, 3.9, { italic: true, color: SOFT, align: 'right' });
    g.strokeStyle = SOFT; g.lineWidth = 0.22; g.beginPath(); g.moveTo(s + w - rw, 224.2); g.lineTo(s + w, 224.2); g.stroke();
    ctx.hits.push({ id: 'quiz:reset', u0: s + w - rw - 2, v0: 218, u1: s + w + 1, v1: 226.5 });
  } else {
    line(g, '答完的题会在这里计分。', s, 223, 3.9, { italic: true, color: SOFT });
  }
}

// ---------- 跨页 10：参考来源 + 给老师 ----------
function sourcesLeft(g, ctx) {
  const s = LEFT.text[0], w = LEFT.text[1] - s;
  heading(g, '来源', '参考来源', s);
  const refs = [
    '中华人民共和国教育部．普通高中物理课程标准（2017 年版 2020 年修订）．北京：人民教育出版社，2020．',
    '人民教育出版社 课程教材研究所 物理课程教材研究开发中心．普通高中教科书 物理 必修 第二册．北京：人民教育出版社，2019．第五章 抛体运动．',
    'Every Joule（iamtechartist.com/every-joule）．本书的版式和“立起来的插图”的做法受它启发；文字、插图和程序都是重新写的．',
  ];
  let y = 58;
  refs.forEach((r, i) => {
    line(g, `[${i + 1}]`, s, y, 3.9, { color: SOFT });
    const y0 = y;
    y = para(g, r, s + 8, y, w - 8, 3.9, 5, { color: INK }) + 3.5;
    ctx.block(`参考来源 [${i + 1}]`, r, s - 1, y0 - 4.5, s + w, y - 3);
  });
  y += 4;
  label(g, '数值约定', s, y, 3.2);
  y = para(g, '书中 g 取 9.8 m/s²（测验题按题中给出的值）。第 5 课的空气阻力用 a = −kv|v| 的简化模型，k 取 0.06 m⁻¹，只用来看出趋势，不对应某个具体的球。插图里的比例尺写在每张图的刻度上。', s, y + 6, w, 3.9, 5, { color: SOFT }) + 5;
  label(g, '字体与程序', s, y, 3.2);
  y = para(g, '字体：Source Serif 4、Noto Serif SC、Caveat、霞鹜文楷（SIL Open Font License 1.1）。程序库：three.js（MIT）、postprocessing（Zlib）、N8AO（ISC）、KaTeX（MIT）。', s, y + 6, w, 3.9, 5, { color: SOFT });
  void countLines;
}

function sourcesRight(g) {
  const s = RIGHT.text[0], w = RIGHT.text[1] - s;
  heading(g, '给老师', '课堂上怎么用', s);
  let y = 54;
  y = para(g, '每课一个跨页，大约对应一课时。建议的顺序是：先让学生独立勾预测，再在投影上一起摆弄插图，最后掀开翻盖讨论。挑战适合留作课后。', s, y, w, 4, 5.2, { color: INK }) + 4;
  const notes = [
    ['第 1 课', '撤力后冰球为什么走切线？追问：砂轮的火花、链球脱手各沿什么方向。'],
    ['第 2 课', '先让学生说出“过河时间只看垂直河岸的分速度”，再用“水比船快”的挑战引出最短路程。'],
    ['第 3 课', '实验课：可以配合真实的平抛仪。频闪表格里的数能直接算出 gT²。'],
    ['第 4 课', '“飞行时间只由高度决定”是本章最常见的考点，翻盖里给了推导。'],
    ['第 5 课', '高台上最佳角小于 45°、空气阻力让最佳角变小，都超出课标要求，适合学有余力的学生。'],
  ];
  for (const [a, b] of notes) {
    line(g, a, s, y, 4, { weight: 600, color: ACCENT });
    y = para(g, b, s + 16, y, w - 16, 3.9, 5, { color: SOFT }) + 2.6;
  }
  y += 3;
  label(g, '常见误区', s, y, 3.2);
  y += 6;
  for (const m of ['曲线运动的速度一定变大或变小。', '平抛的初速度越大，下落得越慢。', '斜抛到最高点时速度为零。', '45° 在任何情况下都扔得最远。']) {
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
export const MATTER_TEXT = [...Object.values(PAGES), ...Object.values(ICONS), quizBlock, legendSample].map((f) => f.toString()).join('') + JSON.stringify([QUIZ, LEGEND, EXTRA_TERMS]);
