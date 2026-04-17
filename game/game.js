'use strict';

const SIZE        = 4;
const WIN         = 256;
const BOMB_CHANCE = 0.10;
const SLIDE_MS    = 110; // slide animation duration

const PAD = 8; // grid padding (matches CSS)
const GAP = 8; // grid gap (matches CSS)

let grid, score, best, gameOver, won, animating;
let tileIdCounter = 0;
let tileEls = new Map(); // id → DOM element

// ── Cells ─────────────────────────────────────────────────────────────────────
function num(v) { return { id: ++tileIdCounter, value: v, immune: false, justMerged: false }; }
function bomb() { return { id: ++tileIdCounter, bomb: true }; }

function cp(c) {
  if (!c) return null;
  return c.bomb
    ? { id: c.id, bomb: true }
    : { id: c.id, value: c.value, immune: c.immune, justMerged: c.justMerged };
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

// ── Grid metrics ──────────────────────────────────────────────────────────────
function cellSize() {
  return (document.getElementById('grid').clientWidth - 2 * PAD - (SIZE - 1) * GAP) / SIZE;
}

function tilePos(r, c, sz) {
  return { left: PAD + c * (sz + GAP), top: PAD + r * (sz + GAP) };
}

// ── Init ──────────────────────────────────────────────────────────────────────
function initGame() {
  grid      = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  score     = 0;
  gameOver  = false;
  won       = false;
  animating = false;

  for (const el of tileEls.values()) el.remove();
  tileEls.clear();

  // Build static background cells (grid items that size the container)
  const gridEl = document.getElementById('grid');
  gridEl.querySelectorAll('.cell-bg').forEach(el => el.remove());
  for (let i = 0; i < SIZE * SIZE; i++) {
    const bg = document.createElement('div');
    bg.className = 'cell-bg';
    gridEl.appendChild(bg);
  }

  spawn(); spawn();
  render(null);
  updateHUD();
  document.getElementById('overlay').classList.add('hidden');
}

// ── Spawn ─────────────────────────────────────────────────────────────────────
function spawn() {
  const empty = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!grid[r][c]) empty.push([r, c]);
  if (!empty.length) return;

  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  grid[r][c] = Math.random() < BOMB_CHANCE ? bomb() : num(Math.random() < 0.9 ? 2 : 4);
}

// ── Slide ─────────────────────────────────────────────────────────────────────
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
      // Merge
      out.pop();
      const merged = num(prev.value * 2);
      merged.justMerged = true;
      merged._mergedFrom = [prev.id, curr.id]; // tracked for animation
      delta += merged.value;
      out.push(merged);

    } else if ((pB && !cB && curr.value >= 64 && !curr.immune) ||
               (!pB && cB && prev.value >= 64 && !prev.immune)) {
      // Bomb destroys big tile — both gone
      out.pop();

    } else {
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
  if (gameOver || won || animating) return;

  // Promote justMerged → immune; clear stale merge data
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      if (cell && !cell.bomb) {
        cell.immune     = cell.justMerged;
        cell.justMerged = false;
        delete cell._mergedFrom;
      }
    }

  // Snapshot {r,c} for every tile before the slide
  const prevPos = new Map();
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      if (cell) prevPos.set(cell.id, { r, c });
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

  if (!won && !canMove()) gameOver = true;

  animating = true;
  render(prevPos);
  updateHUD();

  // Release input lock after animations finish
  setTimeout(() => {
    animating = false;
    if (won)           showEnd(true);
    else if (gameOver) showEnd(false);
  }, SLIDE_MS + 60);
}

// ── Lose detection ────────────────────────────────────────────────────────────
function canMove() {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!grid[r][c]) return true;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const a = grid[r][c];
      if (!a) continue;
      for (const [nr, nc] of [[r, c + 1], [r + 1, c]]) {
        if (nr >= SIZE || nc >= SIZE) continue;
        const b = grid[nr][nc];
        if (!b) continue;
        if (!a.bomb && !b.bomb && a.value === b.value) return true;
        if (a.bomb  && !b.bomb && b.value >= 64) return true;
        if (!a.bomb && b.bomb  && a.value >= 64) return true;
      }
    }
  }
  return false;
}

// ── Render ────────────────────────────────────────────────────────────────────
function render(prevPos) {
  const gridEl = document.getElementById('grid');
  const sz     = cellSize();

  // Identify merged tiles and their source IDs
  const mergeTargets = []; // { cell, r, c }
  const ghostIds     = new Set();
  const mergedIds    = new Set();

  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      if (cell && cell._mergedFrom) {
        mergeTargets.push({ cell, r, c });
        mergedIds.add(cell.id);
        cell._mergedFrom.forEach(id => ghostIds.add(id));
      }
    }

  // IDs that belong in the new grid
  const newIds = new Set();
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      if (cell) newIds.add(cell.id);
    }

  // Remove tiles not in new grid and not ghost sources
  for (const [id, el] of tileEls) {
    if (!newIds.has(id) && !ghostIds.has(id)) {
      el.remove();
      tileEls.delete(id);
    }
  }

  // --- Step 1: place all NEW-GRID tiles at their final positions ---
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      if (!cell) continue;

      const pos   = tilePos(r, c, sz);
      let   el    = tileEls.get(cell.id);
      const isNew = !el;

      if (isNew) {
        el = makeTileEl(gridEl);
        tileEls.set(cell.id, el);
      }

      applyClass(el, cell);
      el.style.width  = sz + 'px';
      el.style.height = sz + 'px';
      el.style.left   = pos.left + 'px';
      el.style.top    = pos.top  + 'px';
      el.style.zIndex = '1';

      // FLIP: animate existing tiles from their old {r,c} to new position
      if (prevPos && !isNew) {
        const old = prevPos.get(cell.id);
        if (old) {
          const oldP = tilePos(old.r, old.c, sz);
          const dx   = oldP.left - pos.left;
          const dy   = oldP.top  - pos.top;
          if (dx !== 0 || dy !== 0) {
            el.style.transition = 'none';
            el.style.transform  = `translate(${dx}px,${dy}px)`;
            el.offsetHeight; // flush so browser sees the offset
            el.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(0.25,0.46,0.45,0.94)`;
            el.style.transform  = 'translate(0,0)';
          }
        }
      }

      // Newly spawned tiles (not in prevPos, not a merge result): scale in after slide
      if (prevPos && isNew && !mergedIds.has(cell.id)) {
        el.style.transform  = 'scale(0)';
        el.style.transition = 'none';
        setTimeout(() => {
          el.style.transition = `transform ${Math.round(SLIDE_MS * 0.7)}ms cubic-bezier(0.34,1.56,0.64,1)`;
          el.style.transform  = 'scale(1)';
        }, SLIDE_MS + 20);
      }
    }
  }

  // --- Step 2: animate ghost tiles (merge sources) into merge position ---
  if (prevPos) {
    for (const { cell, r, c } of mergeTargets) {
      const mPos = tilePos(r, c, sz);

      // Ghost tiles slide into the merge cell, then disappear
      for (const srcId of cell._mergedFrom) {
        const el = tileEls.get(srcId);
        if (!el) continue;

        const old = prevPos.get(srcId);
        if (old) {
          const oldP = tilePos(old.r, old.c, sz);
          const dx   = oldP.left - mPos.left;
          const dy   = oldP.top  - mPos.top;

          el.style.left       = mPos.left + 'px';
          el.style.top        = mPos.top  + 'px';
          el.style.width      = sz + 'px';
          el.style.height     = sz + 'px';
          el.style.zIndex     = '2'; // above the merge result briefly
          el.style.transition = 'none';
          el.style.transform  = `translate(${dx}px,${dy}px)`;
          el.offsetHeight;
          el.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(0.25,0.46,0.45,0.94)`;
          el.style.transform  = 'translate(0,0)';
        }

        // Remove ghost after its slide finishes
        setTimeout(() => {
          el.remove();
          tileEls.delete(srcId);
        }, SLIDE_MS + 10);
      }

      // Merged tile pops after the ghosts arrive
      const mergedEl = tileEls.get(cell.id);
      if (mergedEl) {
        mergedEl.style.zIndex = '3';
        setTimeout(() => {
          mergedEl.style.transition = 'none';
          mergedEl.style.transform  = 'scale(1.18)';
          mergedEl.offsetHeight;
          mergedEl.style.transition = 'transform 0.1s ease-out';
          mergedEl.style.transform  = 'scale(1)';
        }, SLIDE_MS);
      }
    }
  } else {
    // No animation (init): ensure all tiles are at scale 1 with no transition
    for (const el of tileEls.values()) {
      el.style.transition = 'none';
      el.style.transform  = 'scale(1)';
    }
  }
}

function makeTileEl(parent) {
  const el = document.createElement('div');
  el.style.position   = 'absolute';
  el.style.willChange = 'transform';
  el.style.zIndex     = '1';
  parent.appendChild(el);
  return el;
}

function applyClass(el, cell) {
  if (cell.bomb) {
    el.className   = 'cell bomb';
    el.textContent = '💣';
  } else {
    el.className   = 'cell tile-' + cell.value + (cell.immune ? ' immune' : '');
    el.textContent = cell.value;
  }
}

// ── HUD / End ─────────────────────────────────────────────────────────────────
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

// ── Resize: reposition tiles without animation ────────────────────────────────
window.addEventListener('resize', () => {
  const sz = cellSize();
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const cell = grid[r][c];
      if (!cell) continue;
      const el = tileEls.get(cell.id);
      if (!el) continue;
      const pos = tilePos(r, c, sz);
      el.style.transition = 'none';
      el.style.transform  = 'translate(0,0)';
      el.style.left       = pos.left + 'px';
      el.style.top        = pos.top  + 'px';
      el.style.width      = sz + 'px';
      el.style.height     = sz + 'px';
    }
});

// ── Input: keyboard ───────────────────────────────────────────────────────────
const KEY_MAP = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

document.addEventListener('keydown', e => {
  if (KEY_MAP[e.key]) { e.preventDefault(); move(KEY_MAP[e.key]); }
});

// ── Input: swipe ──────────────────────────────────────────────────────────────
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
}, { passive: true });

// ── Bootstrap ─────────────────────────────────────────────────────────────────
best = 0;
document.getElementById('restart-btn').addEventListener('click', initGame);
document.getElementById('play-again-btn').addEventListener('click', initGame);
initGame();
