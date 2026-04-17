'use strict';

var GRID_SIZE   = 25;
var START_TIME  = 60;

var TILE_TYPES = [
  { type: 'gain',       icon: '💰', label: '+10',    weight: 8 },
  { type: 'multiplier', icon: '⚡', label: '2x Next', weight: 4 },
  { type: 'risk',       icon: '🎲', label: 'Risk',   weight: 5 },
  { type: 'timer-tile', icon: '⏱',  label: '+3s',    weight: 4 },
  { type: 'block',      icon: '🚫', label: 'Block',  weight: 4 }
];

// Weighted random tile selection
function weightedRandom() {
  var total = TILE_TYPES.reduce(function(s, t) { return s + t.weight; }, 0);
  var r = Math.random() * total;
  var acc = 0;
  for (var i = 0; i < TILE_TYPES.length; i++) {
    acc += TILE_TYPES[i].weight;
    if (r < acc) return TILE_TYPES[i];
  }
  return TILE_TYPES[0];
}

var state = {
  score:      0,
  timeLeft:   START_TIME,
  multiplier: 1,
  running:    false,
  interval:   null
};

// DOM refs
var gridEl       = document.getElementById('grid');
var scoreEl      = document.getElementById('score');
var timerEl      = document.getElementById('timer');
var multiplierEl = document.getElementById('multiplier');
var statusEl     = document.getElementById('status-msg');
var overlayEl    = document.getElementById('overlay');
var startCard    = document.getElementById('start-card');
var endCard      = document.getElementById('end-card');
var finalScoreEl = document.getElementById('final-score');
var finalMsgEl   = document.getElementById('final-msg');
var startBtn     = document.getElementById('start-btn');
var replayBtn    = document.getElementById('replay-btn');

startBtn.addEventListener('click', startGame);
replayBtn.addEventListener('click', startGame);

function startGame() {
  state.score      = 0;
  state.timeLeft   = START_TIME;
  state.multiplier = 1;
  state.running    = true;

  updateHUD();
  buildGrid();

  overlayEl.classList.add('hidden');
  startCard.classList.add('hidden');
  endCard.classList.add('hidden');

  clearInterval(state.interval);
  state.interval = setInterval(tick, 1000);

  setStatus('Click tiles to score. Use multipliers wisely.');
}

function tick() {
  state.timeLeft--;
  timerEl.textContent = state.timeLeft;

  var timerHud = timerEl.closest('.hud-timer');
  if (state.timeLeft <= 10) {
    timerHud.classList.add('urgent');
  } else {
    timerHud.classList.remove('urgent');
  }

  if (state.timeLeft <= 0) {
    endGame();
  }
}

function endGame() {
  clearInterval(state.interval);
  state.running = false;

  finalScoreEl.textContent = state.score;
  finalMsgEl.textContent = getRating(state.score);

  endCard.classList.remove('hidden');
  overlayEl.classList.remove('hidden');
}

function getRating(score) {
  if (score >= 300) return 'Elite Strategist!';
  if (score >= 200) return 'Sharp moves.';
  if (score >= 100) return 'Not bad.';
  if (score >= 50)  return 'Keep practicing.';
  return 'Better luck next time.';
}

function buildGrid() {
  gridEl.innerHTML = '';
  for (var i = 0; i < GRID_SIZE; i++) {
    var def = weightedRandom();
    var tile = document.createElement('div');
    tile.className = 'tile ' + def.type;
    tile.dataset.type = def.type;
    tile.innerHTML =
      '<span class="tile-icon">' + def.icon + '</span>' +
      '<span>' + def.label + '</span>';
    tile.addEventListener('click', onTileClick);
    gridEl.appendChild(tile);
  }
}

function onTileClick(e) {
  if (!state.running) return;

  var tile = e.currentTarget;
  if (tile.classList.contains('used')) return;

  tile.classList.add('used');

  var type = tile.dataset.type;
  var delta = 0;
  var msg   = '';

  if (type === 'gain') {
    delta = 10 * state.multiplier;
    msg   = state.multiplier > 1 ? 'Multiplied! +' + delta : '+10 pts';
    state.multiplier = 1;

  } else if (type === 'multiplier') {
    state.multiplier = 2;
    msg = 'Next move doubled!';
    updateHUD();

  } else if (type === 'risk') {
    var win = Math.random() < 0.5;
    delta = win ? 50 * state.multiplier : -30;
    msg   = win ? 'Lucky! +' + (50 * state.multiplier) : 'Unlucky. -30';
    state.multiplier = 1;

  } else if (type === 'timer-tile') {
    state.timeLeft = Math.min(state.timeLeft + 3, START_TIME);
    timerEl.textContent = state.timeLeft;
    msg = '+3 seconds!';
    animatePulse(timerEl);

  } else if (type === 'block') {
    msg = 'Blocked. No effect.';
    state.multiplier = 1;
  }

  if (delta !== 0) {
    state.score = Math.max(0, state.score + delta);
    showPop(tile, delta);
    animatePulse(scoreEl);
  }

  updateHUD();
  setStatus(msg);
}

function updateHUD() {
  scoreEl.textContent      = state.score;
  timerEl.textContent      = state.timeLeft;
  multiplierEl.textContent = state.multiplier > 1 ? 'x' + state.multiplier : 'x1';
  multiplierEl.style.color = state.multiplier > 1 ? '#a855f7' : '';
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function animatePulse(el) {
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}

function showPop(tile, delta) {
  var rect = tile.getBoundingClientRect();
  var pop  = document.createElement('div');
  pop.className   = 'score-pop';
  pop.textContent = (delta > 0 ? '+' : '') + delta;
  pop.style.color = delta > 0 ? '#22c55e' : '#ef4444';
  pop.style.left  = rect.left + rect.width / 2 - 20 + 'px';
  pop.style.top   = rect.top + window.scrollY - 8 + 'px';
  document.body.appendChild(pop);
  pop.addEventListener('animationend', function() { pop.remove(); });
}
