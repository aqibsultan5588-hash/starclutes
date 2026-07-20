const BC = document.getElementById('bubble-canvas');
const BX = BC.getContext('2d');

const BS = {
  grid: [],
  cols: 14,
  rows: 10,
  radius: 17,
  spacing: 34,
  rowHeight: 29,
  startX: 0,
  startY: 55,
  shooterX: 400,
  shooterY: 455,
  aimX: 400,
  aimY: 100,
  currentColor: 0,
  nextColor: 0,
  bullet: null,
  score: 0,
  coins: 0,
  level: 1,
  gameOver: false,
  won: false,
  paused: false,
  frame: 0,
  colors: ['#ff4757', '#3742fa', '#2ed573', '#ffa502', '#ff6b81', '#2bcbba'],
  colorNames: ['red', 'blue', 'green', 'yellow', 'pink', 'cyan'],
  touched: false,
  mouseX: 400,
  mouseY: 100,
  targetY: null,
  checkLine: false,
  animId: null,
  comboCount: 0,
  totalBubbles: 0
};

BS.startX = (800 - (BS.cols - 1) * BS.spacing) / 2;

function initBS() {
  BS.startX = (800 - (BS.cols - 1) * BS.spacing) / 2;
  BC.width = 800;
  BC.height = 500;
  BS.grid = [];
  BS.score = 0;
  BS.coins = 0;
  BS.level = 1;
  BS.gameOver = false;
  BS.won = false;
  BS.bullet = null;
  BS.comboCount = 0;
  BS.frame = 0;

  const numRows = 6 + BS.level;
  for (let r = 0; r < numRows; r++) {
    BS.grid[r] = [];
    for (let c = 0; c < BS.cols; c++) {
      BS.grid[r][c] = Math.floor(Math.random() * BS.colors.length);
    }
  }
  BS.rows = numRows;
  BS.totalBubbles = numRows * BS.cols;

  BS.currentColor = Math.floor(Math.random() * BS.colors.length);
  BS.nextColor = Math.floor(Math.random() * BS.colors.length);
  BS.shooterX = 400;
  BS.shooterY = 455;
  BS.mouseX = 400;
  BS.mouseY = 100;

  document.getElementById('bubble-score').textContent = '0';
  document.getElementById('bubble-target2').textContent = '0';
  document.getElementById('bubble-level').textContent = BS.level;
  const hs = document.getElementById('hud-score');
  if (hs) hs.textContent = '⭐ 0';
  const hl = document.getElementById('hud-level');
  if (hl) hl.textContent = '🎯 Lv ' + BS.level;

  if (BS.animId) cancelAnimationFrame(BS.animId);
  gameLoopBS();
}

function gridX(row, col) {
  return BS.startX + (row % 2 === 0 ? 0 : BS.spacing / 2) + col * BS.spacing;
}
function gridY(row) {
  return BS.startY + row * BS.rowHeight;
}

function getNearestCell(x, y) {
  const row = Math.round((y - BS.startY) / BS.rowHeight);
  if (row < 0 || row >= BS.rows + 2) return null;
  const off = row % 2 === 0 ? 0 : BS.spacing / 2;
  const col = Math.round((x - BS.startX - off) / BS.spacing);
  if (col < 0 || col >= BS.cols) return null;
  const cx = gridX(row, col);
  const cy = gridY(row);
  const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
  if (dist > BS.radius + 4) return null;
  return { row, col };
}

function isEmptyCell(row, col) {
  if (row < 0 || row >= BS.rows + 2 || col < 0 || col >= BS.cols) return false;
  if (row >= BS.rows) return true;
  return BS.grid[row][col] === undefined || BS.grid[row][col] === null;
}

function getNeighbors(row, col) {
  const neighbors = [];
  const even = row % 2 === 0;
  const offsets = even
    ? [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]]
    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
  for (const [dr, dc] of offsets) {
    const nr = row + dr, nc = col + dc;
    if (nr >= 0 && nr < BS.rows && nc >= 0 && nc < BS.cols) {
      if (BS.grid[nr][nc] !== undefined && BS.grid[nr][nc] !== null) {
        neighbors.push({ row: nr, col: nc });
      }
    }
  }
  return neighbors;
}

function snapBullet(bx, by) {
  const row = Math.round((by - BS.startY) / BS.rowHeight);
  const clampedRow = Math.max(0, Math.min(row, BS.rows));
  const off = clampedRow % 2 === 0 ? 0 : BS.spacing / 2;
  const col = Math.round((bx - BS.startX - off) / BS.spacing);
  const ccol = Math.max(0, Math.min(col, BS.cols - 1));

  if (clampedRow >= BS.rows) {
    const newRow = BS.rows;
    if (!BS.grid[newRow]) BS.grid[newRow] = [];
    if (BS.grid[newRow][ccol] === undefined || BS.grid[newRow][ccol] === null) {
      BS.grid[newRow][ccol] = BS.currentColor;
      if (newRow >= BS.rows) BS.rows = newRow + 1;
      return { row: newRow, col: ccol };
    }
  }

  let bestDist = Infinity, bestR = -1, bestC = -1;
  for (let r = Math.max(0, clampedRow - 1); r <= Math.min(BS.rows, clampedRow + 1); r++) {
    const o = r % 2 === 0 ? 0 : BS.spacing / 2;
    for (let c = Math.max(0, ccol - 1); c <= Math.min(BS.cols - 1, ccol + 1); c++) {
      if (r >= BS.rows || (BS.grid[r] && (BS.grid[r][c] === undefined || BS.grid[r][c] === null))) {
        const cx = BS.startX + o + c * BS.spacing;
        const cy = BS.startY + r * BS.rowHeight;
        const d = Math.sqrt((bx - cx) ** 2 + (by - cy) ** 2);
        if (d < bestDist) {
          bestDist = d;
          bestR = r;
          bestC = c;
        }
      }
    }
  }
  if (bestR >= 0 && bestC >= 0) {
    if (!BS.grid[bestR]) BS.grid[bestR] = [];
    BS.grid[bestR][bestC] = BS.currentColor;
    if (bestR >= BS.rows) BS.rows = bestR + 1;
    return { row: bestR, col: bestC };
  }
  return null;
}

function floodFill(row, col, color) {
  const visited = new Set();
  const queue = [{ row, col }];
  const matched = [];
  while (queue.length > 0) {
    const { row: r, col: c } = queue.shift();
    const key = r + ',' + c;
    if (visited.has(key)) continue;
    visited.add(key);
    if (r < 0 || r >= BS.rows || c < 0 || c >= BS.cols) continue;
    if (BS.grid[r][c] !== color) continue;
    matched.push({ row: r, col: c });
    const neighbors = getNeighbors(r, c);
    for (const n of neighbors) {
      if (!visited.has(n.row + ',' + n.col)) {
        queue.push(n);
      }
    }
  }
  return matched;
}

function findFloating() {
  const anchored = new Set();
  const queue = [];
  for (let c = 0; c < BS.cols; c++) {
    if (BS.grid[0] && BS.grid[0][c] !== undefined && BS.grid[0][c] !== null) {
      const key = '0,' + c;
      anchored.add(key);
      queue.push({ row: 0, col: c });
    }
  }
  while (queue.length > 0) {
    const { row, col } = queue.shift();
    const neighbors = getNeighbors(row, col);
    for (const n of neighbors) {
      const key = n.row + ',' + n.col;
      if (!anchored.has(key)) {
        anchored.add(key);
        queue.push(n);
      }
    }
  }
  const floating = [];
  for (let r = 0; r < BS.rows; r++) {
    for (let c = 0; c < BS.cols; c++) {
      if (BS.grid[r][c] !== undefined && BS.grid[r][c] !== null) {
        if (!anchored.has(r + ',' + c)) {
          floating.push({ row: r, col: c });
        }
      }
    }
  }
  return floating;
}

function shootBubble() {
  if (BS.gameOver || BS.won || BS.bullet) return;
  const dx = BS.mouseX - BS.shooterX;
  const dy = BS.mouseY - BS.shooterY;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 5) return;
  const speed = 12;
  BS.bullet = {
    x: BS.shooterX,
    y: BS.shooterY - BS.radius - 5,
    vx: (dx / len) * speed,
    vy: (dy / len) * speed
  };
  Hub.playSound('shoot');
}

function popBubbles(matched) {
  if (matched.length < 3) return false;
  const points = matched.length;
  const coinEarn = Math.floor(points / 3) + 1;
  BS.score += points;
  BS.coins += coinEarn;
  Hub.addCoins(coinEarn);
  for (const { row, col } of matched) {
    BS.grid[row][col] = null;
    emitBSParticles(gridX(row, col), gridY(row), BS.colors[BS.currentColor], 6);
  }
  BS.comboCount += points;
  const floating = findFloating();
  for (const { row, col } of floating) {
    BS.grid[row][col] = null;
    BS.coins++;
    Hub.addCoins(1);
    emitBSParticles(gridX(row, col), gridY(row), '#ddd', 4);
  }
  updateBSDisplay();
  return true;
}

function emitBSParticles(x, y, color, count) {
  const container = document.getElementById('bubble-container');
  if (!container) return;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'bubble-particle';
    const angle = Math.random() * Math.PI * 2;
    const dist = 15 + Math.random() * 35;
    const size = 3 + Math.random() * 5;
    p.style.cssText = `left:${x}px;top:${y}px;--tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist}px;background:${color};width:${size}px;height:${size}px;`;
    container.appendChild(p);
    setTimeout(() => p.remove(), 500);
  }
}

function updateBSDisplay() {
  document.getElementById('bubble-score').textContent = BS.score;
  document.getElementById('bubble-target2').textContent = BS.coins;
  document.getElementById('bubble-level').textContent = BS.level;
  const hs = document.getElementById('hud-score');
  if (hs) hs.textContent = `⭐ ${BS.score}`;
  const hl = document.getElementById('hud-level');
  if (hl) hl.textContent = `🎯 Lv ${BS.level}`;
}

function checkGameOverBS() {
  for (let c = 0; c < BS.cols; c++) {
    if (BS.grid[BS.rows - 1] && BS.grid[BS.rows - 1][c] !== undefined && BS.grid[BS.rows - 1][c] !== null) {
      const gy = gridY(BS.rows - 1);
      if (gy + BS.radius >= BS.shooterY - 30) {
        return true;
      }
    }
  }
  return false;
}

function checkWinBS() {
  for (let r = 0; r < BS.rows; r++) {
    for (let c = 0; c < BS.cols; c++) {
      if (BS.grid[r] && BS.grid[r][c] !== undefined && BS.grid[r][c] !== null) {
        return false;
      }
    }
  }
  return true;
}

function drawBSGrid() {
  for (let r = 0; r < BS.rows; r++) {
    for (let c = 0; c < BS.cols; c++) {
      if (BS.grid[r] && BS.grid[r][c] !== undefined && BS.grid[r][c] !== null) {
        drawBSBubble(gridX(r, c), gridY(r), BS.grid[r][c]);
      }
    }
  }
}

function drawBSBubble(x, y, colorIdx) {
  const color = BS.colors[colorIdx];
  const r = BS.radius;
  const grad = BX.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, lightenBS(color, 60));
  grad.addColorStop(0.6, color);
  grad.addColorStop(1, darkenBS(color, 40));
  BX.save();
  BX.shadowColor = 'rgba(255,255,255,0.15)';
  BX.shadowBlur = 4;
  BX.beginPath();
  BX.arc(x, y, r, 0, Math.PI * 2);
  BX.fillStyle = grad;
  BX.fill();
  BX.shadowBlur = 0;
  BX.strokeStyle = 'rgba(255,255,255,0.25)';
  BX.lineWidth = 1;
  BX.stroke();
  const shine = BX.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x - r * 0.35, y - r * 0.35, r * 0.5);
  shine.addColorStop(0, 'rgba(255,255,255,0.7)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  BX.beginPath();
  BX.arc(x, y, r, 0, Math.PI * 2);
  BX.fillStyle = shine;
  BX.fill();
  BX.restore();
}

function drawBSShooter() {
  const sx = BS.shooterX, sy = BS.shooterY;
  const dx = BS.mouseX - sx, dy = BS.mouseY - sy;
  const len = Math.sqrt(dx * dx + dy * dy);
  let angle = -Math.PI / 2;
  if (len > 5) {
    angle = Math.atan2(dy, dx);
    const maxAngle = Math.PI * 0.85;
    if (angle > maxAngle) angle = maxAngle;
    if (angle < -maxAngle) angle = -maxAngle;
    if (angle > -0.05 && angle < 0.05) angle = angle > 0 ? 0.05 : -0.05;
    if (angle > 0) angle = Math.min(angle, Math.PI * 0.42);
    if (angle < 0) angle = Math.max(angle, -Math.PI * 0.42);
  }

  BX.save();
  BX.translate(sx, sy);
  BX.rotate(angle);

  const aimLen = 600;
  let hitX = null, hitY = null;

  for (let t = BS.radius + 10; t < aimLen; t += 4) {
    const px = Math.cos(angle) * t;
    const py = Math.sin(angle) * t;
    let bx = sx + px, by = sy + py;

    if (bx - BS.radius < 0 || bx + BS.radius > 800) break;
    if (by < BS.startY) {
      hitX = bx;
      hitY = BS.startY;
      break;
    }

    let collided = false;
    for (let r = 0; r < BS.rows; r++) {
      for (let c = 0; c < BS.cols; c++) {
        if (BS.grid[r] && BS.grid[r][c] !== undefined && BS.grid[r][c] !== null) {
          const gx = gridX(r, c), gy = gridY(r);
          if (Math.sqrt((bx - gx) ** 2 + (by - gy) ** 2) < BS.radius * 2 - 2) {
            hitX = gx;
            hitY = gy;
            collided = true;
            break;
          }
        }
      }
      if (collided) break;
    }
    if (collided) break;
  }

  if (!hitX) {
    hitX = sx + Math.cos(angle) * aimLen;
    hitY = sy + Math.sin(angle) * aimLen;
  }

  const aimEndX = hitX, aimEndY = hitY;

  BX.restore();

  BX.save();
  BX.setLineDash([4, 6]);
  BX.strokeStyle = 'rgba(255,255,255,0.5)';
  BX.lineWidth = 2;
  BX.beginPath();
  BX.moveTo(sx, sy - BS.radius - 2);
  BX.lineTo(aimEndX, aimEndY);
  BX.stroke();
  BX.setLineDash([]);
  BX.restore();

  const bx = sx, by = sy - 10;
  drawBSBubblePreview(sx, sy - 12, BS.currentColor);
}

function drawBSBubblePreview(x, y, colorIdx) {
  const color = BS.colors[colorIdx];
  const r = BS.radius - 2;
  const grad = BX.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  grad.addColorStop(0, lightenBS(color, 60));
  grad.addColorStop(0.6, color);
  grad.addColorStop(1, darkenBS(color, 40));
  BX.save();
  BX.shadowColor = 'rgba(0,0,0,0.3)';
  BX.shadowBlur = 10;
  BX.beginPath();
  BX.arc(x, y, r, 0, Math.PI * 2);
  BX.fillStyle = grad;
  BX.fill();
  BX.shadowBlur = 0;
  const shine = BX.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x - r * 0.35, y - r * 0.35, r * 0.5);
  shine.addColorStop(0, 'rgba(255,255,255,0.6)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  BX.beginPath();
  BX.arc(x, y, r, 0, Math.PI * 2);
  BX.fillStyle = shine;
  BX.fill();
  BX.strokeStyle = 'rgba(255,255,255,0.3)';
  BX.lineWidth = 1.5;
  BX.stroke();
  BX.restore();

  const nx = x + 40, ny = y + 18;
  BX.fillStyle = 'rgba(0,0,0,0.4)';
  BX.roundRect ? BX.roundRect(nx - 20, ny - 8, 40, 16, 8) : null;
  BX.font = '11px Nunito, sans-serif';
  BX.fillStyle = '#fff';
  BX.textAlign = 'center';
  BX.textBaseline = 'middle';
  BX.fillText('NEXT', nx, ny - 1);

  const nextColor = BS.colors[BS.nextColor];
  const nr = 10;
  const ng = BX.createRadialGradient(nx - nr * 0.3, ny - nr * 0.3 + 16, nr * 0.1, nx, ny + 16, nr);
  ng.addColorStop(0, lightenBS(nextColor, 60));
  ng.addColorStop(0.6, nextColor);
  ng.addColorStop(1, darkenBS(nextColor, 40));
  BX.beginPath();
  BX.arc(nx, ny + 16, nr, 0, Math.PI * 2);
  BX.fillStyle = ng;
  BX.fill();
  BX.strokeStyle = 'rgba(255,255,255,0.2)';
  BX.lineWidth = 1;
  BX.stroke();
}

function drawBSBullet() {
  if (!BS.bullet) return;
  const b = BS.bullet;
  BX.save();
  const grad = BX.createRadialGradient(b.x - 4, b.y - 4, 2, b.x, b.y, BS.radius);
  grad.addColorStop(0, lightenBS(BS.colors[BS.currentColor], 60));
  grad.addColorStop(0.6, BS.colors[BS.currentColor]);
  grad.addColorStop(1, darkenBS(BS.colors[BS.currentColor], 40));
  BX.shadowColor = 'rgba(255,255,255,0.3)';
  BX.shadowBlur = 8;
  BX.beginPath();
  BX.arc(b.x, b.y, BS.radius - 1, 0, Math.PI * 2);
  BX.fillStyle = grad;
  BX.fill();
  BX.shadowBlur = 0;
  const shine = BX.createRadialGradient(b.x - 5, b.y - 5, 0, b.x - 5, b.y - 5, BS.radius * 0.5);
  shine.addColorStop(0, 'rgba(255,255,255,0.6)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  BX.beginPath();
  BX.arc(b.x, b.y, BS.radius - 1, 0, Math.PI * 2);
  BX.fillStyle = shine;
  BX.fill();
  BX.restore();
}

function drawBSHUD() {
  BX.fillStyle = 'rgba(0,0,0,0.3)';
  BX.fillRect(0, 0, 800, 50);
  BX.font = 'bold 18px Fredoka One, sans-serif';
  BX.fillStyle = '#fff';
  BX.textAlign = 'left';
  BX.textBaseline = 'middle';
  BX.fillText('⭐ Score: ' + BS.score, 14, 24);
  BX.textAlign = 'right';
  BX.fillText('🪙 ' + BS.coins + ' | Level ' + BS.level, 786, 24);
}

function drawBSBase() {
  const grad = BX.createLinearGradient(0, BS.shooterY + 5, 0, 500);
  grad.addColorStop(0, '#1a1a3e');
  grad.addColorStop(0.5, '#0d0d2b');
  grad.addColorStop(1, '#060618');
  BX.fillStyle = grad;
  BX.fillRect(0, BS.shooterY + 5, 800, 500 - BS.shooterY - 5);
  BX.strokeStyle = '#4facfe';
  BX.lineWidth = 2;
  BX.beginPath();
  BX.moveTo(0, BS.shooterY + 5);
  BX.lineTo(800, BS.shooterY + 5);
  BX.stroke();
  BX.fillStyle = 'rgba(79,172,254,0.08)';
  for (let i = 0; i < 30; i++) {
    const rx = Math.sin(i * 2.1 + BS.frame * 0.02) * 400 + 400;
    const ry = BS.shooterY + 15 + Math.sin(i * 1.3 + BS.frame * 0.01) * 20 + i * 2.5;
    BX.beginPath();
    BX.arc(rx, ry, 2 + Math.sin(i + BS.frame * 0.05) * 1.5, 0, Math.PI * 2);
    BX.fill();
  }
}

function updateBSBullet() {
  if (!BS.bullet) return;
  const b = BS.bullet;
  b.x += b.vx;
  b.y += b.vy;

  if (b.x - BS.radius < 0) { b.x = BS.radius; b.vx = -b.vx; }
  if (b.x + BS.radius > 800) { b.x = 800 - BS.radius; b.vx = -b.vx; }

  if (b.y - BS.radius <= BS.startY) {
    const result = snapBullet(b.x, BS.startY);
    if (result) afterSnap(result);
    else { BS.bullet = null; }
    return;
  }

  for (let r = 0; r < BS.rows; r++) {
    for (let c = 0; c < BS.cols; c++) {
      if (BS.grid[r] && BS.grid[r][c] !== undefined && BS.grid[r][c] !== null) {
        const gx = gridX(r, c), gy = gridY(r);
        if (Math.sqrt((b.x - gx) ** 2 + (b.y - gy) ** 2) < BS.radius * 2 - 1) {
          const cell = getNearestCell(b.x, b.y);
          if (cell && isEmptyCell(cell.row, cell.col)) {
            if (!BS.grid[cell.row]) BS.grid[cell.row] = [];
            BS.grid[cell.row][cell.col] = BS.currentColor;
            if (cell.row >= BS.rows) BS.rows = cell.row + 1;
            afterSnap(cell);
            return;
          }
          const s = snapBullet(b.x, b.y);
          if (s) { afterSnap(s); return; }
          b.vx = -b.vx * 0.5;
          b.x += b.vx;
          b.y += b.vy;
          return;
        }
      }
    }
  }

  if (b.y + BS.radius > BS.shooterY) {
    BS.currentColor = BS.nextColor;
    BS.nextColor = Math.floor(Math.random() * BS.colors.length);
    BS.bullet = null;
  }
}

function afterSnap(cell) {
  const matched = floodFill(cell.row, cell.col, BS.grid[cell.row][cell.col]);
  Hub.playSound('pop');
  if (matched.length >= 3) {
    popBubbles(matched);
    Hub.playSound('match');
  } else {
    emitBSParticles(gridX(cell.row, cell.col), gridY(cell.row), BS.colors[BS.currentColor], 3);
  }

  BS.currentColor = BS.nextColor;
  BS.nextColor = Math.floor(Math.random() * BS.colors.length);
  BS.bullet = null;

  if (checkWinBS()) {
    BS.won = true;
    const bonus = 5 * BS.level;
    BS.coins += bonus;
    Hub.addCoins(bonus);
    Hub.playSound('cheer');
    const status = document.getElementById('bubble-status');
    if (status) {
      status.textContent = `🎉 Level ${BS.level} Clear! +${bonus} coins!`;
      status.className = 'bubble-status won';
    }
    setTimeout(() => {
      BS.level++;
      const newRows = Math.min(6 + BS.level, BS.rows + 2);
      for (let r = 0; r < newRows; r++) {
        if (!BS.grid[r]) BS.grid[r] = [];
        for (let c = 0; c < BS.cols; c++) {
          if (BS.grid[r][c] === undefined || BS.grid[r][c] === null) {
            BS.grid[r][c] = Math.floor(Math.random() * BS.colors.length);
          }
        }
      }
      BS.rows = newRows;
      BS.won = false;
      if (status) {
        status.textContent = '';
        status.className = 'bubble-status';
      }
      document.getElementById('bubble-level').textContent = BS.level;
    }, 1500);
    return;
  }

  if (checkGameOverBS()) {
    BS.gameOver = true;
    Hub.playSound('fail');
    const status = document.getElementById('bubble-status');
    if (status) {
      status.textContent = `💥 Game Over! Score: ${BS.score} | 🪙 ${BS.coins} coins`;
      status.className = 'bubble-status lost';
    }
  }
}

function lightenBS(color, amt) {
  const h = color.replace('#', '');
  const r = Math.min(255, parseInt(h.substr(0, 2), 16) + amt);
  const g = Math.min(255, parseInt(h.substr(2, 2), 16) + amt);
  const b = Math.min(255, parseInt(h.substr(4, 2), 16) + amt);
  return `rgb(${r},${g},${b})`;
}

function darkenBS(color, amt) {
  const h = color.replace('#', '');
  const r = Math.max(0, parseInt(h.substr(0, 2), 16) - amt);
  const g = Math.max(0, parseInt(h.substr(2, 2), 16) - amt);
  const b = Math.max(0, parseInt(h.substr(4, 2), 16) - amt);
  return `rgb(${r},${g},${b})`;
}

function drawBS() {
  BX.clearRect(0, 0, 800, 500);
  const bg = BX.createLinearGradient(0, 0, 0, 500);
  bg.addColorStop(0, '#0a0a2e');
  bg.addColorStop(0.5, '#0f0f3a');
  bg.addColorStop(1, '#1a1a4e');
  BX.fillStyle = bg;
  BX.fillRect(0, 0, 800, 500);

  drawBSGrid();

  if (BS.bullet) drawBSBullet();

  drawBSShooter();

  drawBSBase();

  drawBSHUD();

  if (BS.gameOver) {
    BX.fillStyle = 'rgba(0,0,0,0.6)';
    BX.fillRect(0, 0, 800, 500);
    BX.font = 'bold 48px Fredoka One, sans-serif';
    BX.textAlign = 'center';
    BX.textBaseline = 'middle';
    BX.fillStyle = '#ff4757';
    BX.fillText('GAME OVER', 400, 200);
    BX.font = '24px Fredoka One, sans-serif';
    BX.fillStyle = '#ffd700';
    BX.fillText('⭐ ' + BS.score + '  🪙 ' + BS.coins, 400, 260);
  }

  if (BS.won && !BS.gameOver) {
    BX.fillStyle = 'rgba(0,0,0,0.3)';
    BX.fillRect(0, 0, 800, 500);
    BX.font = 'bold 36px Fredoka One, sans-serif';
    BX.textAlign = 'center';
    BX.textBaseline = 'middle';
    BX.fillStyle = '#ffd700';
    BX.fillText('🎉 LEVEL ' + BS.level + ' CLEAR!', 400, 220);
  }
}

function gameLoopBS() {
  BS.frame++;
  if (!BS.gameOver && !BS.won && BS.bullet) {
    updateBSBullet();
  }
  updateBSDisplay();
  drawBS();
  BS.animId = requestAnimationFrame(gameLoopBS);
}

function startBubbleGame() {
  Hub.switchGame('bubble');
  currentGame = GAMES.BUBBLE;
  document.getElementById('bubble-status').textContent = '';
  document.getElementById('bubble-status').className = 'bubble-status';
  initBS();
}

const bubbleCanvas = document.getElementById('bubble-canvas');
if (bubbleCanvas) {
  bubbleCanvas.addEventListener('mousemove', (e) => {
    const r = bubbleCanvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (800 / r.width);
    const y = (e.clientY - r.top) * (500 / r.height);
    BS.mouseX = Math.max(40, Math.min(760, x));
    BS.mouseY = Math.max(10, Math.min(440, y));
  });

  bubbleCanvas.addEventListener('click', (e) => {
    if (BS.gameOver) {
      startBubbleGame();
      return;
    }
    if (BS.won) return;
    shootBubble();
  });

  bubbleCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const r = bubbleCanvas.getBoundingClientRect();
    const x = (t.clientX - r.left) * (800 / r.width);
    const y = (t.clientY - r.top) * (500 / r.height);
    BS.mouseX = Math.max(40, Math.min(760, x));
    BS.mouseY = Math.max(10, Math.min(440, y));
    if (BS.gameOver) {
      startBubbleGame();
      return;
    }
    if (BS.won) return;
    shootBubble();
  });

  bubbleCanvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    const r = bubbleCanvas.getBoundingClientRect();
    const x = (t.clientX - r.left) * (800 / r.width);
    const y = (t.clientY - r.top) * (500 / r.height);
    BS.mouseX = Math.max(40, Math.min(760, x));
    BS.mouseY = Math.max(10, Math.min(440, y));
  });
}
