// 平抛的物理模型（与画面无关）。单位：米、秒。g = 9.8。
// 场景：高 h 的平台边缘水平抛出；前方 1.0 m 处有 0.6 m 高的矮墙；1.75 m 处有半径 0.15 m、高 0.3 m 的桶。

export const G = 9.8;
export const WORLD = {
  wall: { x0: 0.94, x1: 1.06, h: 0.6 },
  bucket: { x: 1.75, r: 0.15, h: 0.3 },
  tol: 0.04,
  hRange: [0.3, 1.8],
  vRange: [0.5, 3.8],
};

/** 落地前遇到的第一个事件：ground / wall / walltop / rim / side / bucket */
export function planFlight(h, v0, w = WORLD) {
  const tG = Math.sqrt((2 * h) / G);
  const y = (t) => h - 0.5 * G * t * t;
  const ev = [{ t: tG, kind: 'ground' }];
  const tw = (w.wall.x0 - w.tol) / v0;
  if (tw < tG) {
    if (y(tw) < w.wall.h) ev.push({ t: tw, kind: 'wall' });
    else {
      const tTop = Math.sqrt((2 * (h - w.wall.h)) / G);
      const xTop = v0 * tTop;
      if (xTop > w.wall.x0 - w.tol && xTop < w.wall.x1 + w.tol) ev.push({ t: tTop, kind: 'walltop' });
    }
  }
  if (h > w.bucket.h) {
    const L = w.bucket.x - w.bucket.r, R = w.bucket.x + w.bucket.r;
    const tr = Math.sqrt((2 * (h - w.bucket.h)) / G), xr = v0 * tr;
    if (xr > L + w.tol && xr < R - w.tol) ev.push({ t: tr, kind: 'bucket' });
    else if (xr >= L - w.tol && xr <= R + w.tol) ev.push({ t: tr, kind: 'rim' });
    const ts = (L - w.tol) / v0;
    if (ts < tG && y(ts) < w.bucket.h && xr < L) ev.push({ t: ts, kind: 'side' });
  }
  ev.sort((a, b) => a.t - b.t);
  return { tG, end: ev[0] };
}

export const RESULT_TEXT = {
  ground: (x) => (x < WORLD.wall.x0 ? '没飞到墙就落地了' : '越过了墙，没进桶'),
  wall: () => '撞墙了：到墙边时太低',
  walltop: () => '落在墙顶上',
  rim: () => '打在桶沿上',
  side: () => '撞到桶外壁',
  bucket: () => '进桶了！',
};

/**
 * 一次飞行的状态机：ready → flying → settling → done。
 * 落地后的“收尾”运动（顺墙滑落、掉进桶底）单独积分。
 */
export class Flight {
  constructor() { this.reset(1.2, 2.0); }

  reset(h, v0) {
    this.h = h;
    this.v0 = v0;
    this.plan = planFlight(h, v0);
    this.phase = 'ready';
    this.t = 0;
    this.settle = null;
    this.result = null;
    this.pos = { x: 0, y: h };
  }

  launch() {
    this.plan = planFlight(this.h, this.v0);
    this.phase = 'flying';
    this.t = 0;
    this.settle = null;
    this.result = null;
  }

  /** 推进 dt 秒（已乘播放速度）。返回本帧是否结束飞行 */
  step(dt) {
    if (this.phase === 'flying') {
      this.t += dt;
      if (this.t >= this.plan.end.t) { this.finish(); return true; }
      this.pos.x = this.v0 * this.t;
      this.pos.y = this.h - 0.5 * G * this.t * this.t;
    } else if (this.phase === 'settling') {
      const s = this.settle;
      s.vy += G * dt;
      s.y -= s.vy * dt;
      if (s.xGoal != null) s.x += (s.xGoal - s.x) * (1 - Math.exp(-dt * 6));
      if (s.y <= s.floor) { s.y = s.floor; this.phase = 'done'; }
      this.pos.x = s.x; this.pos.y = s.y;
    }
    return false;
  }

  finish() {
    const w = WORLD, end = this.plan.end;
    this.t = end.t;
    const X = this.v0 * end.t, Y = this.h - 0.5 * G * end.t * end.t;
    this.result = { kind: end.kind, x: X };
    const floors = { ground: 0, wall: 0, walltop: w.wall.h, rim: 0, side: 0, bucket: 0.02 };
    const xs = {
      ground: X, wall: w.wall.x0 - w.tol, walltop: X,
      rim: X < w.bucket.x ? w.bucket.x - w.bucket.r - w.tol : w.bucket.x + w.bucket.r + w.tol,
      side: w.bucket.x - w.bucket.r - w.tol, bucket: X,
    };
    this.settle = { x: xs[end.kind], y: Y, vy: G * end.t, floor: floors[end.kind], xGoal: end.kind === 'bucket' ? w.bucket.x : null };
    this.phase = end.kind === 'ground' || end.kind === 'walltop' ? 'done' : 'settling';
    this.pos.x = this.settle.x;
    this.pos.y = Math.max(Y, this.settle.floor);
  }

  /** 第 t 秒（自由飞行段）的位置与速度 */
  at(t) {
    return { x: this.v0 * t, y: this.h - 0.5 * G * t * t, vx: this.v0, vy: G * t };
  }
}
