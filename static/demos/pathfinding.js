// pathfinding 演示场 —— 由真实 GameBox 模块驱动（GridPathPlanner 的 A*），Canvas2D 渲染。
import { GridPathPlanner, gridCellKey } from '../../gamebox/modules/behavior/GridPathPlanner.js';

// 4 向导航契约（GridPathPlanner 需要 navigation.vectors + neighborOrder）
const NAV = {
  vectors: { north: { right: 0, forward: 1 }, east: { right: 1, forward: 0 },
             south: { right: 0, forward: -1 }, west: { right: -1, forward: 0 } },
  neighborOrder: ['north', 'east', 'south', 'west'],
};
const C = { bg: '#080B12', grid: 'rgba(130,160,220,0.06)', wall: '#1B2333',
            path: 'rgba(91,140,255,0.35)', walker: '#32E0FF', start: '#46E0A0', goal: '#F5A65B' };

export function mount(host, { interactive = false, cell = 26, speed = 12 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%;height:100%;display:block' + (interactive ? ';cursor:crosshair' : '');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let cols = 10, rows = 10, dpr = 1, gx = cell;
  let planner, walls, start, goal, path = [], walkIdx = 0, waited = 0;

  const key = (c) => c.right + ':' + c.forward;
  const inb = (c) => c.right >= 0 && c.right < cols && c.forward >= 0 && c.forward < rows;

  function build() {
    planner = new GridPathPlanner({ navigation: NAV, columns: cols, rows: rows, wrap: false });
    walls = new Set();
    const density = 0.16;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      if (Math.random() < density) walls.add(x + ':' + y);
    }
    start = { right: 1, forward: (rows / 2) | 0 };
    walls.delete(key(start));
    goal = pickGoal();
    recompute();
  }

  function pickGoal() {
    for (let tries = 0; tries < 120; tries++) {
      const g = { right: (Math.random() * cols) | 0, forward: (Math.random() * rows) | 0 };
      if (walls.has(key(g)) || key(g) === key(start)) continue;
      const p = planner.findPath(start, g, [...walls]);
      if (p && p.length > 2) return g;
    }
    return { right: cols - 2, forward: (rows / 2) | 0 };
  }

  function recompute() {
    path = planner.findPath(start, goal, [...walls]) || [];
    walkIdx = 0; waited = 0;
  }

  function resize() {
    const r = host.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(r.width * dpr));
    canvas.height = Math.max(1, Math.round(r.height * dpr));
    gx = cell * dpr;
    cols = Math.max(6, Math.floor(r.width / cell));
    rows = Math.max(6, Math.floor(r.height / cell));
    build();
  }

  function cellAt(ev) {
    const r = canvas.getBoundingClientRect();
    const px = (ev.clientX - r.left) / r.width * cols;
    const py = (ev.clientY - r.top) / r.height * rows;
    return { right: px | 0, forward: (rows - 1 - (py | 0)) };
  }
  function onClick(ev) {
    const c = cellAt(ev); if (!inb(c)) return;
    if (ev.shiftKey) { const k = key(c); if (k !== key(start)) { walls.has(k) ? walls.delete(k) : walls.add(k); } }
    else { if (!walls.has(key(c))) goal = c; }
    recompute();
  }

  function tick() {
    if (!path.length) { build(); return; }
    if (walkIdx < path.length - 1) { walkIdx++; return; }
    // 到达目标：停顿后换新目标；偶尔重排障碍
    waited++;
    if (waited > speed) {
      if (interactive) { waited = 0; }          // 交互模式等用户点新目标
      else { start = path[path.length - 1] || start; if (Math.random() < 0.35) return build(); goal = pickGoal(); recompute(); }
    }
  }

  function rect(c) { return [c.right * gx, (rows - 1 - c.forward) * gx, gx, gx]; }

  function draw() {
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * gx, 0); ctx.lineTo(c * gx, rows * gx); ctx.stroke(); }
    for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * gx); ctx.lineTo(cols * gx, r * gx); ctx.stroke(); }
    ctx.fillStyle = C.wall;
    for (const k of walls) { const [x, y] = k.split(':').map(Number); const [rx, ry] = rect({ right: x, forward: y }); ctx.fillRect(rx + 1, ry + 1, gx - 2, gx - 2); }
    // path
    ctx.fillStyle = C.path;
    for (const c of path) { const [x, y, ww, hh] = rect(c); ctx.fillRect(x + gx * 0.28, y + gx * 0.28, ww - gx * 0.56, hh - gx * 0.56); }
    // start / goal
    dot(start, C.start, 0.3, true);
    ring(goal, C.goal);
    // walker
    if (path[walkIdx]) dot(path[walkIdx], C.walker, 0.34, true);
  }
  function dot(c, color, rad, glow) {
    const [x, y] = rect(c); ctx.fillStyle = color;
    if (glow) { ctx.shadowColor = color; ctx.shadowBlur = gx * 0.5; }
    ctx.beginPath(); ctx.arc(x + gx / 2, y + gx / 2, gx * rad, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
  }
  function ring(c, color) {
    const [x, y] = rect(c); ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, gx * 0.1);
    ctx.beginPath(); ctx.arc(x + gx / 2, y + gx / 2, gx * 0.32, 0, Math.PI * 2); ctx.stroke();
  }

  let raf = 0, last = 0, acc = 0, running = false;
  const stepMs = 1000 / speed;
  function loop(t) {
    if (!running) return;
    if (!last) last = t; const dt = Math.min(200, t - last); last = t; acc += dt;
    while (acc >= stepMs) { tick(); acc -= stepMs; }
    draw(); raf = requestAnimationFrame(loop);
  }

  const ro = new ResizeObserver(resize); resize(); ro.observe(host);
  if (interactive) canvas.addEventListener('click', onClick);
  draw();                                  // 立即出一帧
  running = true; raf = requestAnimationFrame(loop);

  return {
    destroy() {
      running = false; cancelAnimationFrame(raf); ro.disconnect();
      if (interactive) canvas.removeEventListener('click', onClick);
      host.removeChild(canvas);
    },
  };
}
