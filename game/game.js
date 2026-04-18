'use strict';

// ── Constants ─────────────────────────────────────────────────────────────────
const COLS          = 6;
const ROWS          = 6;
const GAP           = 6;
const PAD           = 8;
const TILE_R        = 8;
const GAME_DURATION = 60;
const MIN_CHAIN     = 3;
const PTS_PER_TILE  = 10;
const FALL_GRAVITY  = 3800; // px/s²

// Color palette: base fill, highlight (selected), shadow (bottom edge)
const PALETTE = [
  { base: '#7c3aed', hi: '#a07cff', shadow: '#4c1d95' }, // purple
  { base: '#2563eb', hi: '#60a5fa', shadow: '#1e40af' }, // blue
  { base: '#16a34a', hi: '#4ade80', shadow: '#14532d' }, // green
  { base: '#ea580c', hi: '#fb923c', shadow: '#9a3412' }, // orange
];

// ── DOM ───────────────────────────────────────────────────────────────────────
const canvas      = document.getElementById('game-canvas');
const ctx         = canvas.getContext('2d');
const scoreEl     = document.getElementById('score');
const timerEl     = document.getElementById('timer');
const overlay     = document.getElementById('overlay');
const endTitleEl  = document.getElementById('end-title');
const endMsgEl    = document.getElementById('end-msg');

document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('play-again-btn').addEventListener('click', startGame);

// ── State ─────────────────────────────────────────────────────────────────────
let grid, chain, isDragging, score, timeLeft, gameActive, animating;
let rafId, prevTs, timerInterval;
let cw = 0, tileSize = 0;

// ── Grid ──────────────────────────────────────────────────────────────────────
function makeTile(color) {
  return { color, opacity: 1, fy: 0, vy: 0, removing: false };
}

function initGrid() {
  grid = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => makeTile(rand(PALETTE.length)))
  );
}

function rand(n) { return Math.floor(Math.random() * n); }

// ── Canvas sizing ─────────────────────────────────────────────────────────────
function resizeCanvas() {
  cw = Math.min(canvas.parentElement.clientWidth, 440);
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = Math.round(cw * dpr);
  canvas.height = Math.round(cw * dpr);
  canvas.style.width  = cw + 'px';
  canvas.style.height = cw + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tileSize = (cw - 2 * PAD - (COLS - 1) * GAP) / COLS;
  // Snap all fall offsets so pixel values stay valid after resize
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid?.[r]?.[c]) { grid[r][c].fy = 0; grid[r][c].vy = 0; }
}

// ── Coordinate helpers ────────────────────────────────────────────────────────
function tileXY(r, c) {
  return { x: PAD + c * (tileSize + GAP), y: PAD + r * (tileSize + GAP) };
}

function gridHit(px, py) {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const { x, y } = tileXY(r, c);
      if (px >= x && px < x + tileSize && py >= y && py < y + tileSize)
        return { row: r, col: c };
    }
  }
  return null;
}

// ── Input ─────────────────────────────────────────────────────────────────────
function evtPt(e) {
  const rect  = canvas.getBoundingClientRect();
  const scale = cw / rect.width;
  const src   = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left) * scale,
    y: (src.clientY - rect.top)  * scale,
  };
}

function isAdjacent(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

function inChain(r, c) {
  return chain.some(t => t.row === r && t.col === c);
}

function onDown(e) {
  if (!gameActive || animating) return;
  e.preventDefault();
  const { x, y } = evtPt(e);
  const hit = gridHit(x, y);
  if (!hit || !grid[hit.row][hit.col]) return;
  chain = [hit];
  isDragging = true;
}

function onMove(e) {
  if (!isDragging || !gameActive) return;
  e.preventDefault();
  const { x, y } = evtPt(e);
  const hit = gridHit(x, y);
  if (!hit || !grid[hit.row][hit.col]) return;

  const last = chain[chain.length - 1];
  if (last.row === hit.row && last.col === hit.col) return;

  // Backtrack when dragging over the second-to-last tile
  if (chain.length >= 2) {
    const prev = chain[chain.length - 2];
    if (prev.row === hit.row && prev.col === hit.col) { chain.pop(); return; }
  }

  const color0 = grid[chain[0].row][chain[0].col].color;
  const t = grid[hit.row][hit.col];
  if (!inChain(hit.row, hit.col) && isAdjacent(last, hit) && t.color === color0)
    chain.push(hit);
}

function onUp() {
  if (!isDragging) return;
  isDragging = false;
  if (chain.length >= MIN_CHAIN) commitChain();
  else chain = [];
}

canvas.addEventListener('mousedown',  onDown, { passive: false });
canvas.addEventListener('mousemove',  onMove, { passive: false });
canvas.addEventListener('mouseup',    onUp);
canvas.addEventListener('touchstart', onDown, { passive: false });
canvas.addEventListener('touchmove',  onMove, { passive: false });
canvas.addEventListener('touchend',   onUp,   { passive: false });
window.addEventListener('mouseup',    onUp);

// ── Scoring ───────────────────────────────────────────────────────────────────
function calcScore(len) {
  const mult = len >= 7 ? 3 : len >= 5 ? 2 : 1;
  return len * PTS_PER_TILE * mult;
}

function showScorePop(pts, chainTiles) {
  const mid      = chainTiles[Math.floor(chainTiles.length / 2)];
  const { x, y } = tileXY(mid.row, mid.col);
  const scale    = canvas.getBoundingClientRect().width / cw;
  const pop      = document.createElement('span');
  pop.className  = 'score-pop';
  pop.textContent = '+' + pts;
  pop.style.left  = ((x + tileSize / 2) * scale) + 'px';
  pop.style.top   = (y * scale) + 'px';
  canvas.parentElement.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove());
}

// ── Chain commit ──────────────────────────────────────────────────────────────
function commitChain() {
  const done = [...chain];
  chain = [];
  animating = true;

  const pts = calcScore(done.length);
  score += pts;
  scoreEl.textContent = score;
  showScorePop(pts, done);

  // Mark tiles for fade-out
  done.forEach(({ row, col }) => { grid[row][col].removing = true; });

  setTimeout(() => {
    done.forEach(({ row, col }) => { grid[row][col] = null; });
    applyGravity();
    spawnTiles();
    animating = false;
  }, 220);
}

// ── Gravity ───────────────────────────────────────────────────────────────────
function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (grid[r][c] !== null) {
        if (r !== write) {
          // Tile drops (write - r) rows; start it above its destination
          grid[r][c].fy = -(write - r) * (tileSize + GAP);
          grid[r][c].vy = 0;
          grid[write][c] = grid[r][c];
          grid[r][c] = null;
        }
        write--;
      }
    }
  }
}

function spawnTiles() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === null) {
        const t = makeTile(rand(PALETTE.length));
        t.fy      = -(r + 1) * (tileSize + GAP); // spawn above row 0
        t.opacity = 0;
        grid[r][c] = t;
      }
    }
  }
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

function render(ts) {
  const dt = Math.min(ts - prevTs, 50); // cap delta to avoid large jumps
  prevTs = ts;

  ctx.clearRect(0, 0, cw, cw);

  // Grid background
  ctx.fillStyle = '#1a2642';
  rr(0, 0, cw, cw, 14);
  ctx.fill();

  // Empty cell slots
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const { x, y } = tileXY(r, c);
      rr(x, y, tileSize, tileSize, TILE_R);
      ctx.fill();
    }
  }

  // Chain connector line — drawn behind tiles
  if (chain.length >= 2) {
    const pal0 = PALETTE[grid[chain[0].row][chain[0].col]?.color ?? 0];
    ctx.save();
    ctx.strokeStyle  = pal0.hi;
    ctx.lineWidth    = tileSize * 0.22;
    ctx.lineCap      = 'round';
    ctx.lineJoin     = 'round';
    ctx.globalAlpha  = 0.45;
    ctx.beginPath();
    chain.forEach(({ row, col }, i) => {
      const t = grid[row][col];
      const { x, y } = tileXY(row, col);
      const cx = x + tileSize / 2;
      const cy = y + (t?.fy ?? 0) + tileSize / 2;
      i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy);
    });
    ctx.stroke();
    ctx.restore();
  }

  // Tiles
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r]?.[c];
      if (!t) continue;

      // Gravity-based fall animation
      if (t.fy < 0) {
        t.vy += FALL_GRAVITY * dt / 1000;
        t.fy  = Math.min(0, t.fy + t.vy * dt / 1000);
        if (t.fy === 0) t.vy = 0;
      }

      // Opacity: fade out when removing, fade in when spawned
      if (t.removing) {
        t.opacity = Math.max(0, t.opacity - dt / 180);
      } else if (t.opacity < 1) {
        t.opacity = Math.min(1, t.opacity + dt / 200);
      }

      const { x, y } = tileXY(r, c);
      const drawY    = y + t.fy;
      const pal      = PALETTE[t.color];
      const sel      = inChain(r, c);

      ctx.save();
      ctx.globalAlpha = t.opacity;

      if (sel) {
        ctx.shadowColor = pal.hi;
        ctx.shadowBlur  = 16;
      }

      // Tile body
      ctx.fillStyle = sel ? pal.hi : pal.base;
      rr(x, drawY, tileSize, tileSize, TILE_R);
      ctx.fill();

      // Bottom-edge depth stripe (clipped to tile via separate draw)
      ctx.shadowBlur = 0;
      ctx.save();
      rr(x, drawY, tileSize, tileSize, TILE_R);
      ctx.clip();
      ctx.fillStyle = pal.shadow;
      ctx.fillRect(x, drawY + tileSize * 0.82, tileSize, tileSize * 0.18);
      ctx.restore();

      // Specular highlight dot (top-left)
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.arc(x + tileSize * 0.28, drawY + tileSize * 0.28, tileSize * 0.11, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  rafId = requestAnimationFrame(render);
}

// ── Timer ─────────────────────────────────────────────────────────────────────
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!gameActive) return;
    timeLeft = Math.max(0, timeLeft - 1);
    timerEl.textContent = timeLeft;
    timerEl.classList.toggle('timer-low', timeLeft <= 10);
    if (timeLeft === 0) endGame();
  }, 1000);
}

// ── Game lifecycle ────────────────────────────────────────────────────────────
function startGame() {
  score      = 0;
  timeLeft   = GAME_DURATION;
  chain      = [];
  isDragging = false;
  animating  = false;
  gameActive = true;

  scoreEl.textContent = '0';
  timerEl.textContent = GAME_DURATION;
  timerEl.classList.remove('timer-low');
  overlay.classList.add('hidden');

  resizeCanvas();
  initGrid();
  startTimer();

  if (rafId) cancelAnimationFrame(rafId);
  prevTs = performance.now();
  rafId  = requestAnimationFrame(render);
}

function endGame() {
  gameActive = false;
  clearInterval(timerInterval);
  chain = [];

  endTitleEl.textContent = "Time's Up!";
  endMsgEl.textContent   = score >= 800 ? `${score} pts — incredible run!`
    : score >= 400 ? `${score} pts — well played!`
    : `${score} pts — keep chaining!`;
  overlay.classList.remove('hidden');
}

window.addEventListener('resize', () => { if (gameActive) resizeCanvas(); });
startGame();
