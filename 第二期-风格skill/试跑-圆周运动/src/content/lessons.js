// 每课一个跨页：左页文字（这里写），右页立体装置（../lessons/ 下的类，按课号 n 在 ../lessons/index.js 登记）。
// 字段说明见 skill 的 references/content-format.md。

export const LESSONS = [
  {
    n: 1,
    title: '匀速圆周运动',
    short: '圆周运动',
    textbook: '',
    explanation: [
      '同一转台上，各点的周期 T、角速度 ω 都相同。',
      '离轴越远，线速度 $v = \\omega r$ 越大。',
    ],
    equation: {
      symbols: '$a = v^2/r = \\omega^2 r$',
      words: '速度方向时刻在变，所以有加速度；它总指向圆心，叫向心加速度。',
    },
    keywords: [
      { term: '角速度', def: '每秒转过的弧度，$\\omega = 2\\pi/T$。' },
      { term: '线速度', def: '沿切线方向，大小 $v = \\omega r$。' },
      { term: '向心加速度', def: '始终指向圆心，改变速度的方向。' },
    ],
    predict: {
      question: '转台角速度不变，把小球从 0.10 m 挪到 0.20 m，向心加速度变为原来的：',
      options: ['一半', '2 倍', '4 倍'],
      answer: 1,
    },
    explain: '同一转台上 ω 不变，看 $a = \\omega^2 r$：r 变成 2 倍，a 也变成 2 倍。用 $a = v^2/r$ 容易错选“一半”——别忘了 $v = \\omega r$ 也变成 2 倍，$v^2$ 是 4 倍，再除以 2 倍的 r，还是 2 倍。',
    challenge: { text: '让小球 v 正好 1.0 m/s，a 正好 4.0 m/s²。', done: 'v = 1.0 m/s，a = 4.0 m/s²' },
    figure: '转台',
    figureNote: '蓝箭头是速度，红箭头是加速度',
    tryHint: '点转台开或停，拖小球改半径，点旋钮换 ω。',
    switches: [
      { id: 'ex', label: '装置', options: ['转台', '速度的变化'] },
      { id: 'w', label: '角速度 ω', options: ['2 rad/s', '4 rad/s', '6 rad/s'], ex: 0 },
    ],
    exhibits: [
      { figure: '转台', note: '蓝箭头是速度，红箭头是加速度', hint: '点转台开或停，拖小球改半径，点旋钮换 ω。' },
      { figure: '速度的变化', note: '红箭头是 Δv 和 Δv/Δt', hint: '沿轨道拖小球 B，让它靠近 A。' },
    ],
    demo: [
      'ω = 6 rad/s，小球在 0.10 m。',
      '挪到外圈：v、a 都变大。',
      'A 到 B：速度变了 Δv。',
      'B 靠近 A：Δv 指向圆心。',
      '轮到你：凑出 v、a 的目标值。',
    ],
  },
];
