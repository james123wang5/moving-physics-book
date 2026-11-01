// 用本机无头 Chrome（CDP 9222）按固定尺寸截图。
// 用法：node shot.mjs <url> <out.png> [waitMs] [js 表达式（截图前执行，可返回 Promise）] [宽] [高]
const [url, out, waitMs = '6000', js = '', W = '1600', H = '1000'] = process.argv.slice(2);
import { writeFileSync } from 'node:fs';
const t = await (await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent('about:blank')}`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0;
const send = (method, params = {}) => new Promise((res, rej) => {
  const my = ++id;
  const on = (ev) => { const m = JSON.parse(ev.data); if (m.id === my) { ws.removeEventListener('message', on); m.error ? rej(new Error(m.error.message)) : res(m.result); } };
  ws.addEventListener('message', on);
  ws.send(JSON.stringify({ id: my, method, params }));
});
await new Promise((r) => ws.addEventListener('open', r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: 1, mobile: false });
await send('Runtime.enable');
const logs = [];
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300)); if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('ERR ' + m.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300)); });
await send('Page.enable');
await send('Page.navigate', { url });
await sleep(+waitMs);
if (js) {
  const r = await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) logs.push('JS ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  else if (r.result?.value !== undefined) logs.push('JS→ ' + JSON.stringify(r.result.value).slice(0, 300));
  await sleep(1500);
}
const clipEnv = process.env.CLIP ? process.env.CLIP.split(',').map(Number) : null;
const shot = await send('Page.captureScreenshot', clipEnv ? { format: 'png', clip: { x: clipEnv[0], y: clipEnv[1], width: clipEnv[2], height: clipEnv[3], scale: clipEnv[4] ?? 1 } } : { format: 'png' });
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log(out, [...new Set(logs)].slice(0, 4).join('\n').slice(0, 1500));
ws.close();
await fetch(`http://127.0.0.1:9222/json/close/${t.id}`);
