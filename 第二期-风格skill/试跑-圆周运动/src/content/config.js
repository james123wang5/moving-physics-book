// 整本书的设置：语言、书名、封面、附页里的说明文字。
// 每课的文字在 lessons.js，测验在 quiz.js，每课的立体装置在 ../lessons/ 下、由 ../lessons/index.js 登记。

/** 封面插画板：一个水平的转台（椭圆透视），小球、半径、蓝色速度箭头（切线）、红色加速度箭头（指向圆心） */
function plate(g, w, h) {
  const ink = '#15161a';
  const cx = w / 2, cy = 52, R = 30, k = 0.42; // 椭圆：横半轴 R、竖半轴 R·k
  g.strokeStyle = ink; g.lineCap = 'round'; g.lineJoin = 'round';
  // 转台的厚度和底座
  g.lineWidth = 0.32;
  g.beginPath(); g.ellipse(cx, cy, R, R * k, 0, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.ellipse(cx, cy + 4, R, R * k, 0, 0, Math.PI); g.stroke();
  g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx - R, cy + 4); g.moveTo(cx + R, cy); g.lineTo(cx + R, cy + 4); g.stroke();
  // 侧面排线
  g.lineWidth = 0.09;
  for (let a = 0.08; a < Math.PI - 0.05; a += 0.07) {
    const x = cx + R * Math.cos(a), y = cy + R * k * Math.sin(a);
    g.beginPath(); g.moveTo(x, y + 0.4); g.lineTo(x, y + 3.6); g.stroke();
  }
  // 底座和轴
  g.lineWidth = 0.3;
  g.beginPath(); g.moveTo(cx - 9, cy + 4 + R * k); g.lineTo(cx - 11, cy + 22); g.lineTo(cx + 11, cy + 22); g.lineTo(cx + 9, cy + 4 + R * k); g.stroke();
  g.lineWidth = 0.08;
  for (let x = cx + 1; x < cx + 10; x += 1.1) { g.beginPath(); g.moveTo(x, cy + 4 + R * k + 0.5); g.lineTo(x + 0.6, cy + 21.5); g.stroke(); }
  // 台面上的同心细圆和轨迹虚线
  g.lineWidth = 0.1;
  g.beginPath(); g.ellipse(cx, cy, R * 0.45, R * 0.45 * k, 0, 0, Math.PI * 2); g.stroke();
  g.setLineDash([1.1, 0.9]); g.lineWidth = 0.16;
  g.beginPath(); g.ellipse(cx, cy, R * 0.78, R * 0.78 * k, 0, 0, Math.PI * 2); g.stroke();
  g.setLineDash([]);
  // 圆心、半径、小球
  const a = 0.55, bx = cx + R * 0.78 * Math.cos(a), by = cy + R * 0.78 * k * Math.sin(a);
  g.fillStyle = ink; g.beginPath(); g.arc(cx, cy, 0.7, 0, Math.PI * 2); g.fill();
  g.lineWidth = 0.18; g.beginPath(); g.moveTo(cx, cy); g.lineTo(bx, by); g.stroke();
  // 箭头工具
  const arrow = (x0, y0, x1, y1, color) => {
    const ang = Math.atan2(y1 - y0, x1 - x0), hl = 2.4;
    g.strokeStyle = color; g.lineWidth = 0.45;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.beginPath(); g.moveTo(x1 - hl * Math.cos(ang - 0.45), y1 - hl * Math.sin(ang - 0.45)); g.lineTo(x1, y1); g.lineTo(x1 - hl * Math.cos(ang + 0.45), y1 - hl * Math.sin(ang + 0.45)); g.stroke();
  };
  // 切线方向（椭圆上的导数，逆时针俯视 → 画面上向右上）
  const tx = -R * 0.78 * Math.sin(a), ty = R * 0.78 * k * Math.cos(a), tl = Math.hypot(tx, ty);
  arrow(bx, by, bx - (tx / tl) * 16, by - (ty / tl) * 16, '#2a5db0');
  arrow(bx, by, bx + (cx - bx) * 0.55, by + (cy - by) * 0.55, '#b8412e');
  g.fillStyle = 'rgba(47,123,255,0.85)';
  g.beginPath(); g.arc(bx, by - 1.6, 2.2, 0, Math.PI * 2); g.fill();
  g.strokeStyle = ink; g.lineWidth = 0.16;
  g.beginPath(); g.arc(bx, by - 1.6, 2.2, 0, Math.PI * 2); g.stroke();
}

export default {
  /** 界面语言：'zh' 中文 | 'en' 英文（书页栏目名、翻盖卡、控制条、附页固定说明都跟着换） */
  lang: 'zh',

  /** 书名：封面烫金、书脊、扉页、右页页眉 */
  title: '匀速圆周运动',
  /** 副标题：封面和扉页书名下面的一行斜体 */
  subtitle: '一本会动的书',
  /** 系列 / 年级 / 章节：封面底部、扉页 */
  series: '高中物理 · 高一',
  /** 扉页底部 */
  edition: '第一版 · 2026',
  /** 页面左下角的版权小字 */
  copyright: '© 2026 匀速圆周运动',
  /** 右页页眉（默认用书名） */
  runningHead: null,

  /** 封面：芥末黄布面 + 自己画的转台小图 */
  cover: { cloth: '#c8961e', sheen: '#f3d79a', foil: [0.96, 0.5, 0.24], plate },

  /** 挑战印章下沿的小字（默认 ★ 书名 ★） */
  stampMotto: null,

  /** 第 2 个跨页“本书的记号” */
  legend: [
    { kind: 'arrow', color: '#2a5db0', dir: 'h', name: '蓝箭头', desc: '速度，沿圆的切线；越长越快。' },
    { kind: 'arrow', color: '#b8412e', dir: 'd', name: '红箭头', desc: '加速度和速度的变化 Δv，指向圆心。' },
    { kind: 'dash', name: '虚线', desc: '轨迹、半径和平移过来的速度。' },
    { kind: 'tube', colors: ['#2f7bff', '#ff4a2a'], name: '发光液柱', desc: '读数：蓝的是线速度，红的是加速度。液面越高数越大。' },
    { kind: 'tag', sample: ['半径 r', '0.15 m'], name: '纸签', desc: '插图里随时更新的读数。' },
    { kind: 'hand', sample: 'a = ω²r = 5.40 m/s²', name: '手写字', desc: '页边“你的数据”，随你的操作改写。' },
    { kind: 'stamp', name: '虚线圈', desc: '挑战完成后在这里盖章。' },
    { kind: 'switch', name: '开关', desc: '图注右边的小字；带下划线的是当前的选择。' },
  ],

  /** 索引里除了各课关键词之外，再补的词条 */
  extraTerms: [
    { term: '匀速圆周运动', n: 1, def: '速率不变、轨迹是圆的运动；速度方向时刻在变。' },
    { term: '周期', n: 1, def: '转一圈所用的时间 T。' },
    { term: '弧度', n: 1, def: '弧长除以半径；转一圈是 2π 弧度。' },
  ],

  /** 参考来源（最后一个跨页左页），按顺序编号 */
  sources: [
    '普通高中教科书《物理》必修 第二册，人民教育出版社，2019．第六章“圆周运动”．',
    'Every Joule（iamtechartist.com/every-joule）．本书的版式和“立起来的插图”的做法受它启发；文字、插图和程序都是重新写的．',
  ],
  /** 参考来源下面的几段说明 */
  notes: [
    { label: '数值约定', text: '转台的角速度取 2、4、6 rad/s，周期按 T = 2π/ω 算出，保留两位小数。半径以 0.01 m 为一档。插图按比例缩小画出，画面转速和真实转速相同。' },
    { label: '模型简化', text: '小球看成一个点，转台匀速转动，不计摩擦和空气阻力。“速度的变化”装置里取 r = 0.30 m、v = 1.2 m/s。' },
  ],
  /** 给老师（最后一个跨页右页） */
  teacher: {
    intro: '这一课大约一课时。建议先让学生独立勾预测，再在投影上拖转台上的小球验证；第二个装置用来讲向心加速度的方向，可以让学生把 B 一点点拖近 A。挑战适合课后完成。',
    notes: [
      ['转台', '先固定角速度、只改半径，让学生看 v 和 a 各自怎么变；再换角速度对比。'],
      ['速度的变化', '强调 Δv 是“末速度减初速度”，两支速度箭头要从同一点画起。'],
    ],
    misconceptions: [
      '速率不变，所以匀速圆周运动没有加速度。',
      '由 a = v²/r，半径越大向心加速度越小（忘了同一转台上 v 也随 r 变大）。',
      '外圈转得快，所以外圈的角速度更大。',
    ],
  },

  /** 覆盖引擎自带的界面文字（见 strings.js） */
  strings: {},
};
