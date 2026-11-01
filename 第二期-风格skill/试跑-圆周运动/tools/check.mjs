// 检查整本书：先查内容格式，再开开发服务器 + 无头 Chrome，逐个跨页截图、切换每个装置截图、可选跑演示截图，
// 收集脚本报错、控制台错误和排版警告。截图和报告写到 check-shots/。
//
// 用法（在项目根目录）：
//   node tools/check.mjs                 全书：每个跨页 + 每个装置
//   node tools/check.mjs --only 3        只查第 3 个跨页（网址 #3 那一页）
//   node tools/check.mjs --demo          另外把每课的自动演示每个镜头截一张
//   node tools/check.mjs --content       只查内容格式，不开浏览器
// 环境变量：CHROME=浏览器路径（默认按系统找 Chrome / Chromium / Edge）；PORT=开发服务器端口（默认 5199）。
// 退出码：有错误为 1，只有警告为 0。

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const ONLY = args.includes('--only') ? Number(args[args.indexOf('--only') + 1]) : null;
const DEMO = args.includes('--demo');
const CONTENT_ONLY = args.includes('--content');
const PORT = Number(process.env.PORT ?? 5199);
const OUT = 'check-shots';
const errors = [], warnings = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- 1. 内容格式 ----------
const imp = (p) => import(pathToFileURL(join(process.cwd(), p)).href);
const { LESSONS } = await imp('src/content/lessons.js');
const { QUIZ } = await imp('src/content/quiz.js');
const CONFIG = (await imp('src/content/config.js')).default;
const str = (v) => typeof v === 'string' && v.trim().length > 0;
const E = (m) => errors.push(m), W = (m) => warnings.push(m);

if (!str(CONFIG.title)) E('config.title 不能为空');
if (!['zh', 'en'].includes(CONFIG.lang)) E(`config.lang 只能是 'zh' 或 'en'（现在是 ${CONFIG.lang}）`);
const seen = new Set();
LESSONS.forEach((L, i) => {
  const at = `lessons[${i}]（第 ${L.n} 课）`;
  if (!Number.isInteger(L.n)) E(`${at}：n 必须是整数`);
  if (seen.has(L.n)) E(`${at}：课号 n 重复`); seen.add(L.n);
  if (L.n !== i + 1) W(`${at}：课号最好按顺序从 1 开始`);
  for (const k of ['title', 'explain', 'figure', 'tryHint']) if (!str(L[k])) E(`${at}：缺少 ${k}`);
  if (!Array.isArray(L.explanation) || !L.explanation.length) E(`${at}：explanation 要写成字符串数组（1–3 段）`);
  else if (L.explanation.length > 3) W(`${at}：explanation 超过 3 段，左页可能放不下`);
  if (L.equation && !str(L.equation.symbols)) E(`${at}：equation 要有 symbols`);
  if (L.keywords && (!Array.isArray(L.keywords) || L.keywords.some((k) => !str(k.term) || !str(k.def)))) E(`${at}：keywords 每项要有 term 和 def`);
  if ((L.keywords?.length ?? 0) > 4) W(`${at}：关键词超过 4 个，左页可能放不下`);
  if (L.predict) {
    const p = L.predict;
    if (!str(p.question)) E(`${at}：predict.question 为空`);
    if (!Array.isArray(p.options) || p.options.length < 2 || p.options.length > 4) E(`${at}：predict.options 要 2–4 个`);
    else if (!(Number.isInteger(p.answer) && p.answer >= 0 && p.answer < p.options.length)) E(`${at}：predict.answer 要是选项序号（从 0 开始）`);
  } else W(`${at}：没有 predict（预测题是这种书的核心，建议加上）`);
  if (L.challenge && (!str(L.challenge.text) || !str(L.challenge.done))) E(`${at}：challenge 要有 text 和 done`);
  const ex = (L.switches ?? []).find((s) => s.id === 'ex');
  if (ex && (!Array.isArray(L.exhibits) || L.exhibits.length !== ex.options.length)) E(`${at}：“装置”开关有 ${ex.options.length} 个选项，exhibits 也要有同样多项`);
  for (const sw of L.switches ?? []) if (!str(sw.id) || !str(sw.label) || !Array.isArray(sw.options) || sw.options.length < 2) E(`${at}：开关 ${sw.id} 要有 id、label 和至少 2 个 options`);
  if (!Array.isArray(L.demo) || !L.demo.length) W(`${at}：没有 demo 字幕（自动演示会没有字）`);
});
QUIZ.forEach((Q, i) => {
  const at = `quiz[${i}]`;
  if (!str(Q.q) || !str(Q.why)) E(`${at}：要有 q 和 why`);
  if (!Array.isArray(Q.options) || Q.options.length < 2 || Q.options.length > 4) E(`${at}：options 要 2–4 个`);
  else if (!(Q.answer >= 0 && Q.answer < Q.options.length)) E(`${at}：answer 超出选项范围`);
  if (!seen.has(Q.n)) W(`${at}：n = ${Q.n} 不是任何一课的课号（索引“回到那一课”会失效）`);
});
if (QUIZ.length > 10) W(`测验有 ${QUIZ.length} 题，两页最多放 10 题左右`);

function report() {
  const errs = [...new Set(errors)], warns = [...new Set(warnings)];
  const lines = [`错误 ${errs.length} 条，警告 ${warns.length} 条`, ...errs.map((m) => '✗ ' + m), ...warns.map((m) => '! ' + m)];
  console.log(lines.join('\n'));
  if (!CONTENT_ONLY) writeFileSync(join(OUT, 'report.txt'), lines.join('\n') + '\n');
  process.exit(errors.length ? 1 : 0);
}
if (CONTENT_ONLY) report();

// ---------- 2. 浏览器 ----------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const chromePath = process.env.CHROME ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => existsSync(p));
if (!chromePath) { E('找不到 Chrome / Chromium / Edge，请用环境变量 CHROME 指定浏览器路径'); report(); }

const procs = [];
const cleanup = () => { for (const p of procs) try { p.kill(); } catch { /* 已退出 */ } };
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
procs.push(vite);
let viteLog = '';
vite.stdout.on('data', (d) => (viteLog += d));
vite.stderr.on('data', (d) => (viteLog += d));
for (let i = 0; i < 60 && !/Local:/.test(viteLog); i++) await sleep(250);
if (!/Local:/.test(viteLog)) { E('开发服务器没起来：\n' + viteLog.slice(-800)); report(); }

const profile = mkdtempSync(join(tmpdir(), 'inkbook-check-'));
const chrome = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--no-first-run', '--window-size=1600,1000', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
procs.push(chrome);
let chromeLog = '';
chrome.stderr.on('data', (d) => (chromeLog += d));
let wsUrl = null;
for (let i = 0; i < 80 && !wsUrl; i++) { await sleep(150); wsUrl = chromeLog.match(/ws:\/\/[^\s]+/)?.[0]; }
if (!wsUrl) { E('无头 Chrome 没起来'); report(); }
const http = wsUrl.replace(/^ws:\/\/([^/]+).*/, 'http://$1');
const target = await (await fetch(`${http}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const send = (method, params = {}) => new Promise((res, rej) => {
  const my = ++id;
  const on = (ev) => { const m = JSON.parse(ev.data); if (m.id === my) { ws.removeEventListener('message', on); m.error ? rej(new Error(m.error.message)) : res(m.result); } };
  ws.addEventListener('message', on);
  ws.send(JSON.stringify({ id: my, method, params }));
});
let where = '';
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; E(`${where}：脚本报错 ${String(d.exception?.description ?? d.text).slice(0, 400)}`); }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') E(`${where}：控制台错误 ${m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300)}`);
});
await send('Runtime.enable');
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
const js = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const shot = async (name) => { const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(join(OUT, name), Buffer.from(s.data, 'base64')); return name; };
const waitFor = async (expr, ms = 15000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await js(expr)) return true; } catch { /* 还没加载好 */ } await sleep(200); } return false; };

const base = `http://localhost:${PORT}/`;
await send('Page.navigate', { url: base + '#1' });
if (!(await waitFor('!!window.__app?.ctl'))) { E('页面没加载起来（window.__app 不存在），先看上面的脚本报错'); report(); }
const info = await js(`(() => { const ctl = __app.ctl; const out = []; for (const [k, rt] of ctl.runtimes) out.push({ k, kind: rt.lesson ? 'lesson' : 'matter', n: rt.lesson?.n, title: rt.lesson?.title, ex: rt.defs?.length ?? 0, live: !!rt.pop, shots: rt.shots ? rt.shots().length : 0, demo: rt.lesson?.demo?.length ?? 0, handles: rt.handles ? rt.handles().length : 0 }); return out; })()`);
const shots = [];
for (const s of info.sort((a, b) => a.k - b.k)) {
  if (ONLY != null && s.k !== ONLY) continue;
  where = s.kind === 'lesson' ? `跨页 ${s.k}（第 ${s.n} 课 ${s.title}）` : `跨页 ${s.k}（附页）`;
  if (s.kind === 'lesson') {
    if (!s.live) W(`${where}：没有登记立体装置（src/lessons/index.js），右页是空的`);
    if (s.live && s.shots !== s.demo) W(`${where}：演示有 ${s.shots} 个镜头，demo 字幕有 ${s.demo} 句，最好一一对应`);
    if (s.live && !s.handles) W(`${where}：装置里没有能拖、能点的东西（handles() 为空）`);
  }
  await send('Page.navigate', { url: `${base}?k=${s.k}#${s.k}` });
  await waitFor('!!window.__app?.ctl');
  if (s.live) {
    if (!(await waitFor(`__app.ctl.current?.k === ${s.k} && __app.ctl.current.pop.state === 'live'`, 20000))) W(`${where}：等了 20 秒插图还没立起来`);
  }
  // 第一次翻到一课会自动放演示；截图前停掉，等镜头回到默认机位
  // 试跑修改：演示要在插图立起来后再过 0.6 秒才开始，原来立刻 stopWatch 会落空，演示随后照常开播，
  // 默认视角截图有时拍成演示第 1 个镜头。先等演示开播（最多 4 秒）再停。
  if (s.live && s.shots) await waitFor(`__app.ctl.watched.has(${s.k})`, 4000);
  await js('__app.ctl.stopWatch()');
  await sleep(1800);
  shots.push(await shot(`k${String(s.k).padStart(2, '0')}.png`));
  for (let i = 1; i < s.ex; i++) {
    await js(`__app.ctl.current.switchExhibit(${i})`);
    await waitFor(`__app.ctl.current.ex === ${i} && __app.ctl.current.pop.state === 'live' && !__app.ctl.current.switching`, 15000);
    await sleep(900);
    shots.push(await shot(`k${String(s.k).padStart(2, '0')}-ex${i}.png`));
  }
  if (DEMO && s.live && s.shots) {
    if (s.ex > 1) { await js('__app.ctl.current.switchExhibit(0, true)'); await sleep(300); }
    await js('__app.ctl.replay()');
    for (let i = 0; i < s.shots; i++) {
      // 试跑修改：原来是固定 sleep(1600 / 2000)，没算截图本身的耗时，第 2 张起会晚一个镜头。
      // 改成等演示自己的时钟走到第 i 个镜头的 1.6 秒处再截。
      await waitFor(`(__app.ctl.watch?.t ?? 1e9) >= ${2 * i + 1.6}`, 8000);
      shots.push(await shot(`k${String(s.k).padStart(2, '0')}-demo${i + 1}.png`));
    }
    await sleep(800);
  }
  const lw = await js('[...(globalThis.__layoutWarnings ?? [])]');
  for (const m of lw) W(m);
  await js('globalThis.__layoutWarnings?.clear()');
}
writeFileSync(join(OUT, 'shots.txt'), shots.join('\n') + '\n');
console.log(`截图 ${shots.length} 张，在 ${OUT}/`);
try { await send('Browser.close'); } catch { /* 已关 */ }
report();
