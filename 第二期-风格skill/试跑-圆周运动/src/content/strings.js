import CONFIG from './config.js';

// 引擎自带的界面文字（书页上的栏目名、翻盖卡、控制条、附页的固定说明）。
// 按 CONFIG.lang 取一套；CONFIG.strings 里写的同名项会覆盖这里的。

const ZH = {
  lessonNo: (n) => `第 ${n} 课`,
  lessonHead: (n, t) => `第 ${n} 课 · ${t}`,
  figure: (n) => `图 ${n}`,
  page: (p) => `第 ${p} 页`,
  question: (i) => `第 ${i} 题`,
  step: (i, t) => `第 ${i} 步　${t}`,
  point: '要点', equation: '公式', keywords: '关键词', predict: '预测', why: '为什么？', challenge: '挑战', tryIt: '动手试试',
  flapTitle: '掀开翻盖看答案', flapHint: '……先勾好你的预测再掀。', flapHand: '掀这里',
  stampText: '过关', challengeDone: (t) => `挑战完成：${t}`,
  textbookRef: (ref, n, fig) => `${ref ? `教材 ${ref}　·　` : ''}图 ${n}　${fig}`,
  // 附页
  frontTag: '开始之前', frontTitle: '这本书怎么用', opsLabel: '操作',
  howto: [
    ['predict', '先猜', '每课左页有一道预测题。动手之前，先勾一个你觉得对的答案。'],
    ['popup', '看它立起来', '翻到一课，右页的插图会先被钢笔画出来，再从纸面上立起来，变成可以摆弄的小沙盘。'],
    ['hands', '动手', '拖动、点击插图里的装置；图注右边的小字是开关。页边的手写数字会跟着你的操作改写。'],
    ['flap', '掀开翻盖', '“为什么？”藏在翻盖下面。做完实验再掀开，对一对你的预测。'],
    ['stamp', '接受挑战', '每课页边都有一个挑战。完成了，虚线圈里会盖上一个章。'],
  ],
  ops: [['拖动书页空白处', '转一转视角，松手会回正'], ['在书页上快速横扫', '翻页（← → 键也可以）'], ['底部控制条', '目录、看演示、声音、静止模式'], ['Esc', '停止正在播放的演示']],
  legendTag: '图例', legendTitle: '本书的记号', legendHand: ['颜色在每一课', '都是同一个意思'],
  contentsTag: '目录', contentsTitle: (n) => `${n} 课`, contentsHand: '点标题就能翻过去', stampedCount: (d, n) => `已盖章 ${d} / ${n}`,
  indexEntry: '索引 · 公式一览', quizEntry: '测验', sourcesEntry: '参考来源 · 给老师',
  indexTag: '索引', indexTitle: '词条', indexHand: ['点词条，', '直接翻到那一课'], termEntry: (p) => `词条　第 ${p} 页`, seeLesson: (n) => `见第 ${n} 课。`,
  recapTag: '回顾', recapTitle: '公式一览', recapItem: (n) => `第 ${n} 课　公式`,
  quizTag: '测验', quizTitle: '自我检测', quizIntro: (n) => `${n} 道题，点方框作答，马上就能看到对错和理由。`,
  quizHand: ['答错了也没关系，', '回到那一课', '再玩一次。'], answerIs: (L) => `答案是 ${L}。`,
  quizScore: (a, r, all) => `答了 ${a} 题，对 ${r} 题${all ? '　全对！' : ''}`, quizReset: '重新做一遍', quizEmpty: '答完的题会在这里计分。',
  sourcesTag: '来源', sourcesTitle: '参考来源', sourceItem: (i) => `参考来源 [${i}]`, fontsLabel: '字体与程序',
  fontsText: '字体：Source Serif 4、Noto Serif SC、Caveat、霞鹜文楷（SIL Open Font License 1.1）。程序库：three.js（MIT）、postprocessing（Zlib）、N8AO（ISC）、KaTeX（MIT）。',
  teacherTag: '给老师', teacherTitle: '课堂上怎么用', misconLabel: '常见误区',
  // 控制条
  ui: { bar: '书的控制条', contents: '目录', prev: '上一页', next: '下一页', watch: '看演示', pause: '暂停演示', resume: '继续演示', sound: '声音', still: '静止模式（停止一切动画）', teachers: '给老师', cover: '封面', stillOn: '静止模式：动画都停下来了', stillOff: '动画已恢复' },
  listSep: '、', period: '。',
};

const EN = {
  lessonNo: (n) => `Lesson ${n}`,
  lessonHead: (n, t) => `Lesson ${n} · ${t}`,
  figure: (n) => `Fig. ${n}`,
  page: (p) => `p. ${p}`,
  question: (i) => `Question ${i}`,
  step: (i, t) => `Step ${i}  ${t}`,
  point: 'Key idea', equation: 'The equation', keywords: 'Keywords', predict: 'Predict', why: 'Why?', challenge: 'Challenge', tryIt: 'Try it',
  flapTitle: 'Lift the flap', flapHint: '…tick your prediction first.', flapHand: 'lift here',
  stampText: 'DONE', challengeDone: (t) => `Challenge complete: ${t}`,
  textbookRef: (ref, n, fig) => `${ref ? `Syllabus ${ref}  ·  ` : ''}Fig. ${n}  ${fig}`,
  frontTag: 'Before you start', frontTitle: 'How to use this book', opsLabel: 'Controls',
  howto: [
    ['predict', 'Predict', 'Each lesson starts with a question. Tick the answer you believe before touching anything.'],
    ['popup', 'Watch it rise', 'Turn to a lesson: the pen draws the figure on the page, then it folds up into a little model you can play with.'],
    ['hands', 'Experiment', 'Drag and click the apparatus. The small words beside the caption are switches. The handwriting in the margin follows what you do.'],
    ['flap', 'Lift the flap', '“Why?” hides under a flap. Lift it after the experiment and check your prediction.'],
    ['stamp', 'Take the challenge', 'Every lesson has a challenge in the margin. Finish it and the dashed circle gets a stamp.'],
  ],
  ops: [['Drag empty page', 'look around; it eases back'], ['Swipe across the page', 'turn the page (← → keys too)'], ['Bottom bar', 'contents, demo, sound, still mode'], ['Esc', 'stop the demo']],
  legendTag: 'Legend', legendTitle: 'Marks in this book', legendHand: ['Colours mean the', 'same in every lesson'],
  contentsTag: 'Contents', contentsTitle: (n) => `${n} lessons`, contentsHand: 'Click a title to go there', stampedCount: (d, n) => `${d} of ${n} stamped`,
  indexEntry: 'Index · Equations', quizEntry: 'Quiz', sourcesEntry: 'Sources · For teachers',
  indexTag: 'Index', indexTitle: 'Terms', indexHand: ['Click a term', 'to jump to its lesson'], termEntry: (p) => `Term  p. ${p}`, seeLesson: (n) => `See lesson ${n}.`,
  recapTag: 'Recap', recapTitle: 'All the equations', recapItem: (n) => `Lesson ${n}  equation`,
  quizTag: 'Quiz', quizTitle: 'Check yourself', quizIntro: (n) => `${n} questions. Tick a box and see right away whether you got it, and why.`,
  quizHand: ['Wrong is fine:', 'go back to the lesson', 'and play again.'], answerIs: (L) => `The answer is ${L}. `,
  quizScore: (a, r, all) => `${r} right out of ${a}${all ? '  All correct!' : ''}`, quizReset: 'Start again', quizEmpty: 'Your score shows up here.',
  sourcesTag: 'Sources', sourcesTitle: 'References', sourceItem: (i) => `Reference [${i}]`, fontsLabel: 'Fonts and code',
  fontsText: 'Fonts: Source Serif 4, Caveat (SIL Open Font License 1.1). Libraries: three.js (MIT), postprocessing (Zlib), N8AO (ISC), KaTeX (MIT).',
  teacherTag: 'For teachers', teacherTitle: 'Using it in class', misconLabel: 'Common misconceptions',
  ui: { bar: 'Book controls', contents: 'Contents', prev: 'Previous page', next: 'Next page', watch: 'Play demo', pause: 'Pause demo', resume: 'Resume demo', sound: 'Sound', still: 'Still mode (stop all animation)', teachers: 'For teachers', cover: 'Cover', stillOn: 'Still mode: all animation stopped', stillOff: 'Animation back on' },
  listSep: ', ', period: '. ',
};

const BASE = { zh: ZH, en: EN }[CONFIG.lang] ?? ZH;

/** 当前语言的界面文字 */
export const T = { ...BASE, ...(CONFIG.strings ?? {}), ui: { ...BASE.ui, ...(CONFIG.strings?.ui ?? {}) } };
