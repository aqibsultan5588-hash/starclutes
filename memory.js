const MEMORY_EMOJIS = ['🐶', '🐱', '🐼', '🐸', '🦊', '🐯', '🐰', '🐨', '🦁', '🐙', '🐳', '🦋', '🐝', '🐞', '🐧', '🦉'];
const MEMORY_PAIRS = 8;

let memoryState = {
  cards: [],
  flipped: [],
  matched: 0,
  attempts: 0,
  canFlip: true,
  gameOver: false,
  timer: 0,
  timerInterval: null,
  started: false
};

function initMemoryGame() {
  const grid = document.getElementById('memory-grid');
  grid.innerHTML = '';
  memoryState = {
    cards: [],
    flipped: [],
    matched: 0,
    attempts: 0,
    canFlip: true,
    gameOver: false,
    timer: 0,
    timerInterval: null,
    started: false
  };

  const indices = [];
  for (let i = 0; i < MEMORY_PAIRS; i++) indices.push(i, i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  memoryState.cards = indices.map((emojiIdx, idx) => ({
    id: idx,
    emoji: MEMORY_EMOJIS[emojiIdx],
    pairId: emojiIdx,
    flipped: false,
    matched: false
  }));

  memoryState.cards.forEach((card, idx) => {
    const el = document.createElement('div');
    el.className = 'memory-card';
    el.dataset.index = idx;
    const inner = document.createElement('div');
    inner.className = 'memory-card-inner';
    const front = document.createElement('div');
    front.className = 'memory-card-front';
    front.textContent = '?';
    const back = document.createElement('div');
    back.className = 'memory-card-back';
    back.textContent = card.emoji;
    inner.appendChild(front);
    inner.appendChild(back);
    el.appendChild(inner);
    el.addEventListener('click', () => flipMemoryCard(idx));
    grid.appendChild(el);
  });

  document.getElementById('memory-attempts').textContent = '0';
  document.getElementById('memory-timer').textContent = '0:00';
  document.getElementById('memory-status').textContent = '';
  document.getElementById('memory-status').className = 'memory-status';
  document.getElementById('memory-restart-btn').style.display = 'inline-block';
}

function flipMemoryCard(idx) {
  if (!memoryState.canFlip || memoryState.gameOver) return;
  const card = memoryState.cards[idx];
  if (card.flipped || card.matched) return;

  if (!memoryState.started) {
    memoryState.started = true;
    memoryState.timerInterval = setInterval(() => {
      memoryState.timer++;
      const mins = Math.floor(memoryState.timer / 60);
      const secs = memoryState.timer % 60;
      document.getElementById('memory-timer').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }, 1000);
  }

  card.flipped = true;
  const els = document.querySelectorAll('.memory-card');
  els[idx].classList.add('flipped');
  memoryState.flipped.push(idx);
  Hub.playSound('flip');

  if (memoryState.flipped.length === 2) {
    memoryState.attempts++;
    document.getElementById('memory-attempts').textContent = memoryState.attempts;
    memoryState.canFlip = false;

    const [i1, i2] = memoryState.flipped;
    const c1 = memoryState.cards[i1];
    const c2 = memoryState.cards[i2];

    if (c1.pairId === c2.pairId) {
      c1.matched = true;
      c2.matched = true;
      memoryState.matched += 2;
      memoryState.flipped = [];
      memoryState.canFlip = true;
      Hub.addCoins(1);
      Hub.playSound('match');
      els[i1].classList.add('matched');
      els[i2].classList.add('matched');
      showCoinFloat(els[i1]);
      const hs = document.getElementById('hud-score');
      if (hs) hs.textContent = `🧠 Pairs: ${memoryState.matched / 2}`;

      if (memoryState.matched === MEMORY_PAIRS * 2) {
        memoryWon();
      }
    } else {
      setTimeout(() => {
        c1.flipped = false;
        c2.flipped = false;
        els[i1].classList.remove('flipped');
        els[i2].classList.remove('flipped');
        memoryState.flipped = [];
        memoryState.canFlip = true;
      }, 800);
    }
  }
}

function memoryWon() {
  memoryState.gameOver = true;
  if (memoryState.timerInterval) {
    clearInterval(memoryState.timerInterval);
    memoryState.timerInterval = null;
  }
  const bonus = Math.max(0, 50 - memoryState.attempts);
  const coins = 10 + bonus;
  Hub.addCoins(coins);
  Hub.playSound('cheer');
  const el = document.getElementById('memory-status');
  el.textContent = `🎉 You won! ${coins} coins earned!`;
  el.className = 'memory-status won';
}

function showCoinFloat(el) {
  const rect = el.getBoundingClientRect();
  const wrapper = document.getElementById('game-wrapper');
  const wRect = wrapper.getBoundingClientRect();
  const coin = document.createElement('div');
  coin.textContent = '🪙+1';
  coin.style.cssText = `
    position:fixed; left:${rect.left}px; top:${rect.top - 10}px;
    font-size:20px; font-family:'Fredoka One',cursive; color:#ffd700;
    pointer-events:none; z-index:200;
    text-shadow:0 2px 8px rgba(0,0,0,0.5);
    animation: coinFloatUp 0.8s ease-out forwards;
  `;
  document.body.appendChild(coin);
  setTimeout(() => coin.remove(), 850);
}

function startMemoryGame() {
  Hub.switchGame('memory');
  currentGame = GAMES.MEMORY;
  initMemoryGame();
  const hs = document.getElementById('hud-score');
  if (hs) hs.textContent = '🧠 Pairs: 0';
  const hl = document.getElementById('hud-level');
  if (hl) hl.textContent = '';
}
