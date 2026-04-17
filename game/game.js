'use strict';

const SIZE        = 4;
const WIN         = 256;
const BOMB_CHANCE = 0.10;

let grid, score, best, gameOver, won;

// ── Cell constructors ─────────────────────────────────────────────────────────
function num(v)  { return { value: v, immune: false, justMerged: false }; }
function bomb()  { return { bomb: true }; }

function cp(c) {
  if (!c) return null;
  return c.bomb ? bomb() : { value: c.value, immune: c.immune, justMerged: c.justMerged };
}

function cellsEq(a, b) {
  if (!a && !b) return true;
  if (!a || !b)  return false;
  if (a.bomb)    return !!b.bomb;
  return !b.bomb && a.value === b.value;
}

function copyGrid(g) { return g.map(r => r.map(cp)); }

function gridsEq(a, b) {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!cellsEq(a[r][c], b[r][c])) return false;
  return true;
}

// ── Init / spawn ──────────────────────────────────────────────────────────────
function initGame() {
  grid     = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  score    = 0;
  gameOver = false;
  won      = false;

  spawn(); spawn();
  render();
  updateHUD();
  document.getElementById('overlay').classList.add('hidden');
}

function spawn() {
  const empty = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!grid[r][c]) empty.push([r, c]);
  if (!empty.length) return;

  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  grid[r][c] = Math.random() < BOMB_CHANCE
    ? bomb()
    : num(Math.random() < 0.9 ? 2 : 4);
}

// ── Slide one line left ───────────────────────────────────────────────────────
// Returns { row: Cell[SIZE], delta: number }
// Rules:
//   • Equal number tiles merge (once per tile per move)
//   • Number tile ≥64 (not immune) + bomb → both destroyed
//   • Otherwise tiles stack normally; bombs act as walls for small tiles
function slideLeft(row) {
  const tiles = row.filter(Boolean);
  const out   = [];
  let   delta = 0;

  for (let i = 0; i < tiles.length; i++) {
    const curr = tiles[i];
    const prev = out.length ? out[out.length - 1] : null;

    if (!prev) { out.push(cp(curr)); continue; }

    const pB = !!prev.bomb, cB = !!curr.bomb;

    if (!pB && !cB && prev.value === curr.value && !prev.justMerged && !curr.justMerged) {
      // Merge equal number tiles
      out.pop();
      const merged = num(prev.value * 2);
      merged.justMerged = true;
      delta += merged.value;
      out.push(merged);

    } else if ((pB && !cB && curr.value >= 64 && !curr.immune) ||
               (!pB && cB && prev.value >= 64 && !prev.immune)) {
      // Big tile collides with bomb — destroy both
      out.pop();

    } else {
      // Normal stack (bomb acts as wall for small tiles, etc.)
      out.push(cp(curr));
    }
  }

  while (out.length < SIZE) out.push(null);
  return { row: out, delta };
}

function slideRight(row) {
  const { row: r, delta } = slideLeft([...row].reverse());
  return { row: r.reverse(), delta };
}

// ── Apply a slide direction to the whole grid ─────────────────────────────────
function applySlide(g, dir) {
  const horiz = dir === 'left' || dir === 'right';
  const fn    = (dir === 'left' || dir === 'up') ? slideLeft : slideRight;
  let   delta = 0;

  for (let i = 0; i < SIZE; i++) {
    const line = horiz ? g[i] : g.map(row => row[i]);
    const { row: out, delta: d } = fn(line);
    delta += d;
    if (horiz) g[i] = out;
    else       out.forEach((cell, r) => { g[r][i] = cell; });
  }
  return delta;
}

// ── Move ──────────────────────────────────────────────────────────────────────
function move(dir) {
  if (gameOver || won) return;

  // Promote justMerged → immune for this move, then clear justMerged
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      if (cell && !cell.bomb) {
        cell.immune     = cell.justMerged;
        cell.justMerged = false;
      }
    }

  const snap  = copyGrid(grid);
  const delta = applySlide(grid, dir);

  if (gridsEq(snap, grid)) return; // nothing moved

  score += delta;
  if (score > best) best = score;

  spawn();

  // Win check
  outer: for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      if (cell && !cell.bomb && cell.value >= WIN) { won = true; break outer; }
    }

  // Lose check (only if not won)
  if (!won && !canMove()) gameOver = true;

  render();
  updateHUD();

  if (won)           showEnd(true);
  else if (gameOver) showEnd(false);
}

// ── Lose detection ────────────────────────────────────────────────────────────
function canMove() {
  // Empty cell → always can move
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!grid[r][c]) return true;

  // Adjacent pairs that could merge or trigger bomb
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const a = grid[r][c];
      if (!a) continue;
      for (const [nr, nc] of [[r, c+1], [r+1, c]]) {
        if (nr >= SIZE || nc >= SIZE) continue;
        const b = grid[nr][nc];
        if (!b) continue;
        if (!a.bomb && !b.bomb && a.value === b.value) return true;
        if (a.bomb && !b.bomb && b.value >= 64) return true;
        if (!a.bomb && b.bomb && a.value >= 64) return true;
      }
    }
  }
  return false;
}

// ── Render ────────────────────────────────────────────────────────────────────
function render() {
  const gridEl = document.getElementById('grid');
  gridEl.innerHTML = '';

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      const div  = document.createElement('div');

      if (!cell) {
        div.className = 'cell empty';

      } else if (cell.bomb) {
        div.className = 'cell bomb';
        div.textContent = '💣';

      } else {
        let cls = 'cell tile-' + cell.value;
        if (cell.immune) cls += ' immune';
        div.className = cls;
        div.textContent = cell.value;
      }

      gridEl.appendChild(div);
    }
  }
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  document.getElementById('best').textContent  = best;
}

function showEnd(isWin) {
  document.getElementById('end-title').textContent = isWin ? '🎉 You Win!' : 'Game Over';
  document.getElementById('end-msg').textContent   = isWin
    ? 'You hit 256! Final score: ' + score
    : 'No valid moves left. Score: ' + score;
  document.getElementById('overlay').classList.remove('hidden');
}

// ── Input: keyboard ───────────────────────────────────────────────────────────
const KEY_MAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

document.addEventListener('keydown', e => {
  if (KEY_MAP[e.key]) { e.preventDefault(); move(KEY_MAP[e.key]); }
});

// ── Input: touch/swipe ────────────────────────────────────────────────────────
let tx = null, ty = null;

document.addEventListener('touchstart', e => {
  tx = e.touches[0].clientX;
  ty = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchend', e => {
  if (tx == null) return;
  const dx = e.changedTouches[0].clientX - tx;
  const dy = e.changedTouches[0].clientY - ty;
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (Math.max(ax, ay) >= 24) {
    move(ax > ay ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  }
  tx = ty = null;
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────
best = 0;
document.getElementById('restart-btn').addEventListener('click', initGame);
document.getElementById('play-again-btn').addEventListener('click', initGame);
initGame();
