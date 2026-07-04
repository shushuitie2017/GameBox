// snake 演示场 —— 由真实 GameBox 模块驱动（SnakeMotionController + SnakePlay），Canvas2D 渲染。
// 相对 import：从 /static/demos/ 到 /gamebox/modules/ 是 ../../gamebox/modules/（深度固定，base 无关）。
import { SnakeMotionController } from '../../gamebox/modules/actor-motion/SnakeMotionController.js';
import { SnakePlay, SNAKE_PLAY_EVENTS, SNAKE_DEATH_REASONS } from '../../gamebox/modules/gameplay/SnakePlay.js';

const CSS = {
  bg: '#080B12', grid: 'rgba(130,160,220,0.06)',
  head: '#32E0FF', body1: '#5B8CFF', body2: '#3A63C8', food: '#F5A65B',
};

export function mount(host, { interactive = false, cell = 22, speed = 9 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block';
  if (interactive) { canvas.tabIndex = 0; canvas.style.outline = 'none'; }
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let cols = 10, rows = 10, dpr = 1;
  let snake, play, food, dead = false, deadAt = 0;
  const PID = 'p1';

  function key(c) { return c.right + ':' + c.forward; }

  function resize() {
    const r = host.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    cols = Math.max(6, Math.floor(r.width / cell));
    rows = Math.max(6, Math.floor(r.height / cell));
    reset();
  }

  function freeCell() {
    const taken = new Set(snake.getSegments().map(key));
    let c, guard = 0;
    do {
      c = { right: (Math.random() * cols) | 0, forward: (Math.random() * rows) | 0 };
    } while (taken.has(key(c)) && guard++ < 200);
    return c;
  }

  function reset() {
    const start = { right: cols >> 1, forward: rows >> 1 };
    snake = new SnakeMotionController({ initialLength: 5, startCell: start, initialDirection: { right: 1, forward: 0 }, mode: 'cardinal' });
    play = new SnakePlay({ minRight: 0, maxRight: cols - 1, minForward: 0, maxForward: rows - 1 });
    play.addPlayer({ playerId: PID, segments: snake.getSegments() });
    food = freeCell();
    play.addItem({ cell: food, growth: 2 });
    dead = false;
  }

  // 键盘（interactive）：把绝对方向意图暂存，下一 tick 转成 move() 输入
  let queued = null;
  function onKey(e) {
    const m = { ArrowUp: { right: 0, forward: 1 }, ArrowDown: { right: 0, forward: -1 },
                ArrowLeft: { right: -1, forward: 0 }, ArrowRight: { right: 1, forward: 0 } }[e.key];
    if (m) { queued = m; e.preventDefault(); }
  }

  // 把「想去的绝对方向」翻成 SnakeMotionController.move 的 cardinal 输入
  function inputFor(desired) {
    const d = snake.getDirection();
    if (d.forward !== 0) {            // 纵向：只能左右转
      if (desired.right < 0) return { left: true };
      if (desired.right > 0) return { right: true };
    } else if (d.right !== 0) {       // 横向：只能上下转
      if (desired.forward > 0) return { forward: true };
      if (desired.forward < 0) return { backward: true };
    }
    return {}; // 同轴 → 直行
  }

  // 贪心 AI：在 直行 / 左转 / 右转 里选不撞墙不撞身、且离食物最近的
  function aiInput() {
    const d = snake.getDirection(), head = snake.head;
    const opts = [{ dir: d, input: {} }];
    if (d.forward !== 0) {
      opts.push({ dir: { right: -1, forward: 0 }, input: { left: true } });
      opts.push({ dir: { right: 1, forward: 0 }, input: { right: true } });
    } else {
      opts.push({ dir: { right: 0, forward: 1 }, input: { forward: true } });
      opts.push({ dir: { right: 0, forward: -1 }, input: { backward: true } });
    }
    const body = new Set(snake.getSegments().slice(0, -1).map(key));
    let best = null, bestScore = Infinity;
    for (const o of opts) {
      const nh = { right: head.right + o.dir.right, forward: head.forward + o.dir.forward };
      if (nh.right < 0 || nh.right >= cols || nh.forward < 0 || nh.forward >= rows) continue;
      if (body.has(key(nh))) continue;
      const dist = Math.abs(nh.right - food.right) + Math.abs(nh.forward - food.forward);
      const score = dist + (Object.keys(o.input).length ? 0.15 : 0);
      if (score < bestScore) { bestScore = score; best = o; }
    }
    return best ? best.input : {};
  }

  function tick() {
    if (dead) return;
    let input;
    if (interactive && queued) { input = inputFor(queued); queued = null; }
    else if (interactive) input = {};
    else input = aiInput();

    const { segments } = snake.move(input);
    play.movePlayer({ playerId: PID, segments });
    const events = play.step();
    for (const ev of events) {
      if (ev.type === SNAKE_PLAY_EVENTS.ITEM_PICKED_UP) {
        snake.grow(ev.growBy);
        food = freeCell();
        play.addItem({ cell: food, growth: 2 });
      } else if (ev.type === SNAKE_PLAY_EVENTS.PLAYER_DIED) {
        dead = true; deadAt = perf;
      }
    }
  }

  function draw() {
    const w = canvas.width, h = canvas.height, gx = cell * dpr;
    ctx.fillStyle = CSS.bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = CSS.grid; ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * gx, 0); ctx.lineTo(c * gx, rows * gx); ctx.stroke(); }
    for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * gx); ctx.lineTo(cols * gx, r * gx); ctx.stroke(); }
    // food（forward+ 朝上 → y 翻转）
    const cellRect = (c) => [c.right * gx, (rows - 1 - c.forward) * gx, gx, gx];
    ctx.fillStyle = CSS.food;
    const [fx, fy, fw, fh] = cellRect(food);
    ctx.beginPath(); ctx.arc(fx + fw / 2, fy + fh / 2, fw * 0.32, 0, Math.PI * 2); ctx.fill();
    // snake
    const segs = snake.getSegments();
    for (let i = segs.length - 1; i >= 0; i--) {
      const [x, y] = cellRect(segs[i]);
      ctx.fillStyle = i === 0 ? CSS.head : (i % 2 ? CSS.body2 : CSS.body1);
      const pad = gx * 0.12;
      roundRect(ctx, x + pad, y + pad, gx - pad * 2, gx - pad * 2, gx * 0.22); ctx.fill();
    }
    if (dead) { ctx.fillStyle = 'rgba(8,11,18,0.55)'; ctx.fillRect(0, 0, w, h); }
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  // 固定步长循环
  let raf = 0, last = 0, acc = 0, perf = 0, running = false;
  const stepMs = 1000 / speed;
  function loop(t) {
    if (!running) return;
    if (!last) last = t;
    const dt = Math.min(200, t - last); last = t; perf = t; acc += dt;
    while (acc >= stepMs) { tick(); acc -= stepMs; }
    if (dead && t - deadAt > 900) reset();
    draw();
    raf = requestAnimationFrame(loop);
  }

  const ro = new ResizeObserver(resize);
  resize();
  ro.observe(host);
  if (interactive) { canvas.addEventListener('keydown', onKey); }

  draw();                                  // 立即出一帧
  running = true; raf = requestAnimationFrame(loop);

  return {
    destroy() {
      running = false; cancelAnimationFrame(raf); ro.disconnect();
      if (interactive) canvas.removeEventListener('keydown', onKey);
      host.removeChild(canvas);
    },
    focus() { if (interactive) canvas.focus(); },
  };
}
