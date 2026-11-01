// 用本机无头 Chrome（CDP 9222）按脚本操作网页：移动、按下、拖动、松开、按键、执行 JS、截图。
// 用法：node play.mjs <url> <actions.json> [宽] [高]
// actions：[{ wait: 毫秒 } | { move: [x, y] } | { click: [x, y] } | { drag: [[x0, y0], [x1, y1], 步数, 每步毫秒] }
//          | { down: [x, y] } | { up: [x, y] } | { key: 'ArrowRight' } | { eval: 'js' } | { shot: 'out.png', clip: [x, y, w, h, scale] }]
import { readFileSync, writeFileSync } from 'node:fs';
const [url, file, W = '1600', H = '1000'] = process.argv.slice(2);
const actions = JSON.parse(readFileSync(file, 'utf8'));
const t = await (await fetch(`http://127.0.0.1:9222/json/new?about:blank`, { method: 'PUT' })).json();
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
const logs = [];
ws.addEventListener('message', (ev) => { const m = JSON.parse(ev.data); if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + String(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 200)); });
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: +(process.env.DPR ?? 1), mobile: false });
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url });
let mx = 0, my = 0, pressed = false;
const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: pressed || type !== 'mouseMoved' ? 'left' : 'none', buttons: pressed ? 1 : 0, clickCount: 1, ...extra });
for (const a of actions) {
  if (a.wait) await sleep(a.wait);
  if (a.move) { [mx, my] = a.move; await mouse('mouseMoved', mx, my); }
  if (a.down) { [mx, my] = a.down; await mouse('mouseMoved', mx, my); pressed = true; await mouse('mousePressed', mx, my); }
  if (a.up) { [mx, my] = a.up; await mouse('mouseMoved', mx, my); await mouse('mouseReleased', mx, my); pressed = false; }
  if (a.click) { const [x, y] = a.click; await mouse('mouseMoved', x, y); pressed = true; await mouse('mousePressed', x, y); await sleep(60); await mouse('mouseReleased', x, y); pressed = false; }
  if (a.drag) {
    const [[x0, y0], [x1, y1], n = 20, dt = 30] = a.drag;
    await mouse('mouseMoved', x0, y0); pressed = true; await mouse('mousePressed', x0, y0);
    for (let i = 1; i <= n; i++) { await sleep(dt); await mouse('mouseMoved', x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n); }
    if (!a.hold) { await sleep(dt); await mouse('mouseReleased', x1, y1); pressed = false; }
  }
  if (a.key) {
    for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key: a.key, code: a.key, windowsVirtualKeyCode: { ArrowRight: 39, ArrowLeft: 37, Escape: 27 }[a.key] ?? 0 });
  }
  if (a.eval) {
    const r = await send('Runtime.evaluate', { expression: a.eval, awaitPromise: true, returnByValue: true });
    logs.push('JS→ ' + JSON.stringify(r.result?.value ?? r.exceptionDetails?.text).slice(0, 600));
  }
  if (a.shot) {
    const c = a.clip;
    const s = await send('Page.captureScreenshot', c ? { format: 'png', clip: { x: c[0], y: c[1], width: c[2], height: c[3], scale: c[4] ?? 1 } } : { format: 'png' });
    writeFileSync(a.shot, Buffer.from(s.data, 'base64'));
    logs.push('shot ' + a.shot.split('/').pop());
  }
}
console.log(logs.slice(0, 30).join('\n'));
await send('Target.closeTarget', { targetId: t.id }).catch(() => {});
process.exit(0);
