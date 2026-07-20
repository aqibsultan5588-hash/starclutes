const Hub = {
  coins: 0,
  totalCoins: 0,
  unlockedCharacters: ['default'],
  selectedCharacter: 'default',
  unlockedColors: ['#5dade2', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'],
  selectedColor: '#5dade2',
  musicOn: true,
  sfxOn: true,
  audioCtx: null,

  init() {
    try {
      this.totalCoins = parseInt(localStorage.getItem('kidsHubCoins') || '0', 10);
      this.musicOn = localStorage.getItem('kidsHubMusic') !== 'false';
      this.sfxOn = localStorage.getItem('kidsHubSfx') !== 'false';
      const saved = localStorage.getItem('kidsHubUnlocked');
      if (saved) this.unlockedCharacters = JSON.parse(saved);
      const sel = localStorage.getItem('kidsHubChar');
      if (sel) this.selectedCharacter = sel;
      const col = localStorage.getItem('kidsHubColor');
      if (col) this.selectedColor = col;
    } catch (e) {}
  },

  save() {
    try {
      localStorage.setItem('kidsHubCoins', this.totalCoins.toString());
      localStorage.setItem('kidsHubMusic', this.musicOn.toString());
      localStorage.setItem('kidsHubSfx', this.sfxOn.toString());
      localStorage.setItem('kidsHubUnlocked', JSON.stringify(this.unlockedCharacters));
      localStorage.setItem('kidsHubChar', this.selectedCharacter);
      localStorage.setItem('kidsHubColor', this.selectedColor);
    } catch (e) {}
  },

  addCoins(amount) {
    this.totalCoins += amount;
    this.save();
    this.updateCoinDisplay();
  },

  spendCoins(amount) {
    if (this.totalCoins >= amount) {
      this.totalCoins -= amount;
      this.save();
      this.updateCoinDisplay();
      return true;
    }
    return false;
  },

  updateCoinDisplay() {
    const el = document.getElementById('total-coins');
    if (el) el.textContent = `🪙 ${this.totalCoins}`;
  },

  initAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  },

  playSound(name) {
    if (!this.sfxOn) return;
    try {
      this.initAudio();
      const ctx = this.audioCtx;
      const now = ctx.currentTime;
      switch (name) {
        case 'click':
          this._tone(ctx, 600, 0.05, 'sine', 0.06);
          break;
        case 'shoot':
          this._tone(ctx, 300, 0.08, 'sine', 0.07);
          setTimeout(() => this._tone(ctx, 500, 0.05, 'sine', 0.04), 30);
          break;
        case 'pop':
          this._tone(ctx, 400, 0.08, 'sine', 0.1);
          setTimeout(() => this._tone(ctx, 600, 0.06, 'sine', 0.06), 40);
          break;
        case 'collect':
          this._tone(ctx, 880, 0.08, 'sine', 0.08);
          setTimeout(() => this._tone(ctx, 1100, 0.1, 'sine', 0.06), 60);
          break;
        case 'success':
          this._tone(ctx, 523, 0.1, 'sine', 0.1);
          setTimeout(() => this._tone(ctx, 659, 0.1, 'sine', 0.1), 100);
          setTimeout(() => this._tone(ctx, 784, 0.1, 'sine', 0.1), 200);
          setTimeout(() => this._tone(ctx, 1047, 0.2, 'sine', 0.12), 300);
          break;
        case 'fail':
          this._tone(ctx, 300, 0.15, 'square', 0.08);
          setTimeout(() => this._tone(ctx, 200, 0.2, 'square', 0.06), 150);
          break;
        case 'flip':
          this._tone(ctx, 500, 0.06, 'sine', 0.06);
          break;
        case 'match':
          this._tone(ctx, 660, 0.08, 'sine', 0.08);
          setTimeout(() => this._tone(ctx, 880, 0.1, 'sine', 0.06), 60);
          break;
        case 'cheer':
          [523, 587, 659, 784, 880, 1047].forEach((f, i) => {
            setTimeout(() => this._tone(ctx, f, 0.12, 'sine', 0.08), i * 80);
          });
          break;
      }
    } catch (e) {}
  },

  _tone(ctx, freq, dur, type, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  },

  startMusic() {
    if (!this.musicOn) return;
    try {
      this.initAudio();
      if (this._musicInterval) return;
      const notes = [262, 294, 330, 349, 392, 440, 494, 523];
      let i = 0;
      this._musicInterval = setInterval(() => {
        if (!this.musicOn) return;
        this._tone(this.audioCtx, notes[i], 0.2, 'sine', 0.03);
        i = (i + 1) % notes.length;
      }, 400);
    } catch (e) {}
  },

  stopMusic() {
    if (this._musicInterval) {
      clearInterval(this._musicInterval);
      this._musicInterval = null;
    }
  },

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicOn) this.startMusic();
    else this.stopMusic();
    this.save();
    const btn = document.getElementById('music-toggle');
    if (btn) btn.textContent = this.musicOn ? '🎵' : '🔇';
  },

  toggleSfx() {
    this.sfxOn = !this.sfxOn;
    this.save();
    const btn = document.getElementById('sfx-toggle');
    if (btn) btn.textContent = this.sfxOn ? '🔊' : '🔇';
  },

  switchGame(gameName) {
    document.querySelectorAll('.game-screen').forEach(s => s.classList.remove('active'));
    document.getElementById('hub-screen')?.classList.remove('active');
    const target = document.getElementById(`${gameName}-screen`);
    if (target) target.classList.add('active');
    if (gameName !== 'hub') {
      document.getElementById('hud-bar')?.classList.add('active');
    } else {
      document.getElementById('hud-bar')?.classList.remove('active');
    }
  },

  showHub() {
    this.switchGame('hub');
    this.updateCoinDisplay();
  }
};

const GAMES = {
  STAR_CATCHER: 'star-catcher',
  MEMORY: 'memory',
  BUBBLE: 'bubble'
};

let currentGame = null;
let currentScreen = null;
