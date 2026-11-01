// 书页排版（毫米坐标）：字体、颜色、中文断行、行内公式、标签、方框、手写。
// 版式参数参照 Every Joule：页 190×250，左页页边栏 [12,50]、正文栏 [56,172]；右页正文 [18,176]。

export const PAGE = { W: 190, D: 250 };
export const LEFT = { margin: [12, 50], text: [56, 172], bottom: 236 };
export const RIGHT = { text: [18, 176] };

export const INK = '#1c2433';
export const SOFT = '#3a4252';
export const RULE = '#b8ad97';
export const ACCENT = '#9a3b2a';
export const HAND = '#273463';

export const SERIF = '"Source Serif 4 Variable", "Noto Serif SC", "Songti SC", serif';
export const HANDF = '"Caveat Variable", "LXGW WenKai", "Kaiti SC", cursive';
export const MATHF = '"Source Serif 4 Variable", "Noto Serif SC", serif';

/** 设置字体。caps：小号大写式的标签（中文用字距代替） */
export function font(g, size, { weight = 500, italic = false, family = SERIF, caps = false } = {}) {
  g.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
  g.fontKerning = 'normal';
  if ('letterSpacing' in g) g.letterSpacing = caps ? `${(size * 0.12).toFixed(2)}px` : '0px';
}

// ---------- 行内公式：$...$ 中支持 _下标 ^上标 \rm{直立} 和少量符号 ----------
const SYMS = {
  times: '×', cdot: '·', theta: 'θ', alpha: 'α', beta: 'β', varphi: 'φ', phi: 'φ', Delta: 'Δ', sqrt: '√',
  approx: '≈', half: '½', deg: '°', to: '→', pi: 'π', ge: '≥', le: '≤', pm: '±', quad: ' ', ne: '≠', Rightarrow: '⇒', omega: 'ω', mu: 'μ',
};
const ITALIC_SYMS = new Set(['θ', 'α', 'β', 'φ', 'π', 'ω', 'μ']);

function group(src, i) {
  if (src[i] === '{') {
    let depth = 0;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}' && --depth === 0) return { text: src.slice(i + 1, j), end: j + 1 };
    }
  }
  return { text: src[i] ?? '', end: i + 1 };
}

export function parseMath(src, lv = 0, out = []) {
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') {
      const m = /^\\([a-zA-Z]+)/.exec(src.slice(i));
      if (!m) { i++; continue; }
      i += m[0].length;
      if (m[1] === 'rm' || m[1] === 'text') { const g = group(src, i); i = g.end; out.push({ t: g.text, it: false, lv }); continue; }
      const s = SYMS[m[1]];
      if (s) out.push({ t: s, it: ITALIC_SYMS.has(s), lv });
      continue;
    }
    if (ch === '_' || ch === '^') { const g = group(src, i + 1); i = g.end; parseMath(g.text, ch === '_' ? 1 : 2, out); continue; }
    if (ch === '{' || ch === '}') { i++; continue; }
    if (/[A-Za-z]/.test(ch)) out.push({ t: ch, it: true, lv });
    else if (ch === '-') out.push({ t: '−', it: false, lv, op: true });
    else if ('=+×<>≈'.includes(ch)) out.push({ t: ch, it: false, lv, op: true });
    else if (ch === ' ') out.push({ t: ' ', it: false, lv, space: true });
    else out.push({ t: ch, it: false, lv });
    i++;
  }
  return out;
}

function mathAtom(g, src, size, family, weight) {
  const toks = parseMath(src);
  let w = 0;
  for (const tk of toks) {
    const s = tk.lv ? size * 0.64 : size;
    tk.font = `${tk.it ? 'italic ' : ''}${weight} ${s}px ${family}`;
    g.font = tk.font;
    const pad = tk.op && !tk.lv ? size * 0.2 : 0;
    tk.pad = pad;
    tk.w = tk.space ? size * 0.22 : g.measureText(tk.t).width + 2 * pad + (tk.it ? size * 0.03 : 0);
    tk.dy = tk.lv === 1 ? size * 0.22 : tk.lv === 2 ? -size * 0.4 : 0;
    w += tk.w;
  }
  return { kind: 'math', toks, w };
}

const NO_START = '，。、；：？！）》」』”’…—%,.;:!?)';
const NO_END = '（《「『“‘(';
const isCJK = (ch) => /[⺀-鿿豈-﫿＀-￯　-〿]/.test(ch);

/** 把富文本切成可以断行的小块 */
export function atoms(g, str, size, opt = {}) {
  const family = opt.family ?? SERIF, weight = opt.weight ?? 400;
  const mfamily = opt.family === HANDF ? HANDF : MATHF;
  const out = [];
  String(str).split('$').forEach((part, k) => {
    if (!part) return;
    if (k % 2 === 1) { out.push(mathAtom(g, part, size, mfamily, weight)); return; }
    font(g, size, { ...opt, family });
    const f = g.font;
    let i = 0;
    while (i < part.length) {
      const ch = part[i];
      if (ch === '\n') { out.push({ kind: 'br', w: 0 }); i++; continue; }
      if (ch === ' ') { out.push({ kind: 'space', w: size * 0.28, text: ' ' }); i++; continue; }
      if (isCJK(ch)) { out.push({ kind: 'text', text: ch, w: g.measureText(ch).width, font: f }); i++; continue; }
      let j = i;
      while (j < part.length && !isCJK(part[j]) && part[j] !== ' ' && part[j] !== '\n') j++;
      const word = part.slice(i, j);
      out.push({ kind: 'text', text: word, w: g.measureText(word).width, font: f });
      i = j;
    }
  });
  return out;
}

export function layout(list, maxW) {
  const lines = [[]];
  let w = 0;
  for (const a of list) {
    let line = lines[lines.length - 1];
    if (a.kind === 'br') { lines.push([]); w = 0; continue; }
    if (a.kind === 'space' && !line.length) continue;
    if (w + a.w > maxW && line.length) {
      const first = a.text?.[0];
      if (a.kind === 'text' && first && NO_START.includes(first)) { line.push(a); w += a.w; continue; }
      const carry = [];
      while (line.length > 1 && line[line.length - 1].kind === 'text' && NO_END.includes(line[line.length - 1].text)) carry.unshift(line.pop());
      while (line.length && line[line.length - 1].kind === 'space') line.pop();
      lines.push(carry);
      line = lines[lines.length - 1];
      w = carry.reduce((s, c) => s + c.w, 0);
      if (a.kind === 'space') continue;
    }
    line.push(a);
    w += a.w;
  }
  return lines.map((l) => ({ atoms: l, w: l.reduce((s, a) => s + a.w, 0) }));
}

export function drawAtoms(g, list, x, y, color) {
  g.fillStyle = color;
  g.textBaseline = 'alphabetic';
  g.textAlign = 'left';
  for (const a of list) {
    if (a.kind === 'text') { g.font = a.font; g.fillText(a.text, x, y); }
    else if (a.kind === 'math') {
      let mx = x;
      for (const tk of a.toks) {
        if (!tk.space) { g.font = tk.font; g.fillText(tk.t, mx + tk.pad, y + tk.dy); }
        mx += tk.w;
      }
    }
    x += a.w;
  }
}

/** 单行（可含公式），返回宽度 */
export function line(g, str, x, y, size, { color = INK, align = 'left', ...opt } = {}) {
  const list = atoms(g, str, size, opt);
  const w = list.reduce((s, a) => s + a.w, 0);
  const sx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  if ('letterSpacing' in g) g.letterSpacing = opt.caps ? `${(size * 0.12).toFixed(2)}px` : '0px';
  drawAtoms(g, list, sx, y, color);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  return w;
}

export function measure(g, str, size, opt = {}) {
  return atoms(g, str, size, opt).reduce((s, a) => s + a.w, 0);
}

/** 段落：第一行基线在 y，返回最后一行之后的基线位置 */
export function para(g, str, x, y, width, size, lh, { color = INK, ...opt } = {}) {
  const lines = layout(atoms(g, str, size, opt), width);
  for (const l of lines) { drawAtoms(g, l.atoms, x, y, color); y += lh; }
  return y;
}

export function countLines(g, str, width, size, opt = {}) {
  return layout(atoms(g, str, size, opt), width).length;
}

/** 栏目标签，如“预测”“关键词”：小号、红色、加字距 */
export function label(g, text, x, y, size = 3.4) {
  font(g, size, { weight: 600, caps: true });
  g.fillStyle = ACCENT;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillText(text, x, y);
  if ('letterSpacing' in g) g.letterSpacing = '0px';
}

/** 勾选框 */
export function tickBox(g, x, y, s = 4.4) {
  g.strokeStyle = INK;
  g.lineWidth = 0.32;
  g.strokeRect(x, y - s + 0.6, s, s);
  return { u0: x - 1.5, v0: y - s - 1, u1: x + s + 1.5, v1: y + 2 };
}

/** 页眉（栏目名 + 横线）和页码 */
export function runningHead(g, isLeft, text, folio) {
  g.fillStyle = SOFT;
  font(g, 3.4, { weight: 500, caps: true });
  g.textAlign = isLeft ? 'left' : 'right';
  g.fillText(text, isLeft ? 12 : PAGE.W - 14, 10.5);
  font(g, 3.6, { weight: 500 });
  g.fillText(String(folio ?? ''), isLeft ? 12 : PAGE.W - 14, 244);
  g.textAlign = 'left';
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  g.strokeStyle = RULE;
  g.lineWidth = 0.25;
  g.beginPath();
  g.moveTo(isLeft ? 12 : 18, 13);
  g.lineTo(isLeft ? PAGE.W - 18 : PAGE.W - 14, 13);
  g.stroke();
}

/** 手写（Caveat + 霞鹜文楷），可旋转 */
export function hand(g, str, x, y, size = 4.6, { color = HAND, rotate = -0.02, align = 'left', weight = 560 } = {}) {
  g.save();
  g.translate(x, y);
  g.rotate(rotate);
  const w = line(g, str, 0, 0, size, { color, align, family: HANDF, weight });
  g.restore();
  return w;
}
