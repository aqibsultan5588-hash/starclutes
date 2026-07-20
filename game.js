const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const dpr = Math.min(window.devicePixelRatio || 1, 2);
const W = 800;
const H = 500;
canvas.width = W * dpr;
canvas.height = H * dpr;
canvas.style.width = W + 'px';
canvas.style.height = H + 'px';
ctx.scale(dpr, dpr);

const DOM = {};
['welcome-screen','loading-screen','start-screen','game-screen','gameover-screen',
 'welcome-btn','start-btn','restart-btn','menu-btn',
 'score-display','highscore-display','lives-display','powerup-display',
 'final-score','final-highscore','start-highscore',
 'loading-bar','loading-tip','pause-overlay','resume-btn','quit-btn',
 'achievement-toast','touch-controls','touch-left','touch-right','touch-jump',
 'timer-display','combo-display'].forEach(id => {
  DOM[id.replace(/-/g, '_')] = document.getElementById(id);
});
const colorBtns = document.querySelectorAll('.color-btn');

let audioCtx = null;
let muted = false;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq, duration, type = 'square', volume = 0.12) {
  if (muted) return;
  try {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

function toggleMute() {
  muted = !muted;
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) muteBtn.textContent = muted ? '🔇' : '🔊';
}

function playJump() { playTone(400,0.1,'square',0.06); setTimeout(()=>playTone(600,0.08,'square',0.04),50); }
function playDoubleJump() { playTone(500,0.06,'square',0.05); setTimeout(()=>playTone(800,0.08,'square',0.05),40); setTimeout(()=>playTone(1000,0.06,'square',0.03),80); }
function playCollect() { playTone(880,0.08,'sine',0.08); setTimeout(()=>playTone(1100,0.1,'sine',0.06),60); }
function playGoldCollect() { playTone(660,0.08,'sine',0.1); setTimeout(()=>playTone(880,0.08,'sine',0.08),60); setTimeout(()=>playTone(1100,0.12,'sine',0.06),120); }
function playHit() { playTone(150,0.15,'sawtooth',0.1); setTimeout(()=>playTone(100,0.2,'sawtooth',0.08),80); }
function playGameOverSound() { playTone(400,0.15,'square',0.08); setTimeout(()=>playTone(300,0.15,'square',0.08),150); setTimeout(()=>playTone(200,0.3,'square',0.06),300); }
function playAchievementSound() { playTone(523,0.1,'sine',0.1); setTimeout(()=>playTone(659,0.1,'sine',0.1),100); setTimeout(()=>playTone(784,0.1,'sine',0.1),200); setTimeout(()=>playTone(1047,0.2,'sine',0.12),300); }
function playPowerUp() { playTone(440,0.08,'sine',0.08); setTimeout(()=>playTone(554,0.08,'sine',0.08),60); setTimeout(()=>playTone(659,0.08,'sine',0.08),120); setTimeout(()=>playTone(880,0.15,'sine',0.1),180); }

const GROUND_Y = 440;
let gameState = 'hub';
let score = 0;
let highScore = 0;
let frameCount = 0;
let gameTime = 0;
let combo = 0;
let maxCombo = 0;
let difficulty = 1;
let lives = 3;
const MAX_LIVES = 3;
let invincible = false;
let invincibleTimer = 0;
let paused = false;
let loadingInterval = null;
let gameOverTimeout = null;
let activePowerUp = null;
let powerUpTimer = 0;
const POWERUP_DURATION = 600;

const player = {
  x:200, y:GROUND_Y-40, w:36, h:44, vx:0, vy:0, speed:5, jumpPower:-15.5,
  doubleJumpPower:-13.5, gravity:0.5, onGround:true, jumpsLeft:2, maxJumps:2,
  facing:1, blinkTimer:0, color:'#5dade2', colorDark:'#2e86c1', colorLight:'#85c1e9'
};

let stars = [], obstacles = [], particles = [], floatingTexts = [], powerUps = [], bgMountains = [];
let shakeX = 0, shakeY = 0, shakeIntensity = 0;
const MILESTONES = [10,25,50,100,200,500];
let achievedMilestones = new Set();
let scoreHistory = [];
const MAX_HISTORY = 10;

try {
  highScore = parseInt(localStorage.getItem('starCatcherHighScore')||'0',10);
  const saved = localStorage.getItem('starCatcherHistory');
  if (saved) scoreHistory = JSON.parse(saved);
  const savedA = localStorage.getItem('starCatcherAchievements');
  if (savedA) JSON.parse(savedA).forEach(m=>achievedMilestones.add(m));
  const savedC = localStorage.getItem('starCatcherColor');
  if (savedC) setPlayerColor(savedC);
} catch(e){}

function setPlayerColor(hex) {
  player.color = hex;
  const temp = document.createElement('div');
  temp.style.color = hex;
  document.body.appendChild(temp);
  const c = getComputedStyle(temp).color;
  document.body.removeChild(temp);
  const m = c.match(/\d+/g);
  if (m) {
    const r=Math.min(255,parseInt(m[0])-40), g=Math.min(255,parseInt(m[1])-40), b=Math.min(255,parseInt(m[2])-40);
    player.colorDark=`rgb(${r},${g},${b})`;
    player.colorLight=`rgb(${Math.min(255,parseInt(m[0])+40)},${Math.min(255,parseInt(m[1])+40)},${Math.min(255,parseInt(m[2])+40)})`;
  } else { player.colorDark='#2e86c1'; player.colorLight='#85c1e9'; }
  try { localStorage.setItem('starCatcherColor',hex); } catch(e){}
}

function getComboMultiplier() { return 1+Math.floor(combo/5); }

function saveScore(score) {
  scoreHistory.unshift(score);
  if (scoreHistory.length>MAX_HISTORY) scoreHistory.length=MAX_HISTORY;
  try { localStorage.setItem('starCatcherHistory',JSON.stringify(scoreHistory)); } catch(e){}
}

function renderHistory(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (scoreHistory.length===0) { el.innerHTML='<div class="history-empty">No games yet</div>'; return; }
  el.innerHTML=scoreHistory.map((s,i)=>`<div class="history-item ${i===0?'latest':''}"><span class="history-rank">#${i+1}</span><span class="history-score">${s}</span></div>`).join('');
}

const keys = { left:false, right:false, jump:false, jumpPressed:false };

function initBackground() {
  bgMountains = [];
  for (let i=0;i<12;i++) bgMountains.push({x:i*80-40, h:60+Math.random()*80, w:100+Math.random()*60, color:`hsl(${210+Math.random()*30},60%,${55+Math.random()*20}%)`});
}
initBackground();

function spawnStar(isGold=false) { stars.push({x:W+30,y:80+Math.random()*(GROUND_Y-200),w:isGold?32:26,h:isGold?32:26,speed:2+difficulty*0.3,angle:Math.random()*Math.PI*2,bob:Math.random()*20,bobSpeed:2+Math.random()*2,gold:isGold,glowPulse:Math.random()*Math.PI*2}); }
function spawnObstacle() {
  const t = Math.random();
  let size, speed, yOff=0;
  if (t<0.2) { size=42+Math.random()*10; speed=1.5+difficulty*0.3; yOff=-10; }
  else if (t<0.4) { size=18+Math.random()*6; speed=4+difficulty*0.6; yOff=4; }
  else { size=28+Math.random()*16; speed=2.5+difficulty*0.5; }
  obstacles.push({x:W+20,y:GROUND_Y-size-4+yOff,w:size,h:size,speed:speed,color:`hsl(${Math.random()*20+340},70%,50%)`,bounce:Math.random()*10,bounceSpeed:3+Math.random()*3});
}
function spawnPowerUp() {
  const types=['shield','magnet','slowmo'];
  const t=types[Math.floor(Math.random()*types.length)];
  powerUps.push({x:W+30,y:120+Math.random()*(GROUND_Y-250),w:28,h:28,speed:2+difficulty*0.2,type:t,bob:Math.random()*20,bobSpeed:2+Math.random()*2});
}

function emitParticles(x,y,color,count=12) {
  for (let i=0;i<count;i++) {
    const a=Math.random()*Math.PI*2, s=1+Math.random()*4;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:1,decay:0.015+Math.random()*0.02,size:3+Math.random()*5,color});
  }
}
function emitStarCollect(x,y) {
  for (let i=0;i<20;i++) {
    const a=Math.random()*Math.PI*2, s=2+Math.random()*5;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-2,life:1,decay:0.012+Math.random()*0.015,size:3+Math.random()*6,color:`hsl(${40+Math.random()*20},100%,${60+Math.random()*30}%)`});
  }
}
function addFloatingText(x,y,text,color='#ffd700') { floatingTexts.push({x,y,text,color,life:1,vy:-2.5}); }

function drawBackground() {
  ctx.save(); ctx.translate(-shakeX,-shakeY);
  const g=ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'#4facfe'); g.addColorStop(0.5,'#87CEEB'); g.addColorStop(0.8,'#b8e6ff'); g.addColorStop(1,'#90d5a8');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(255,255,255,0.7)';
  const o=(frameCount*0.2)%600;
  for (let i=0;i<5;i++) { const cx=((i*180+50)-o+600)%900-100, cy=30+i*25; drawCloud(cx,cy,60+i*10); }
  for (const m of bgMountains) {
    const mx=((m.x-frameCount*0.3)%1200+1200)%1200-100;
    ctx.fillStyle=m.color; ctx.beginPath(); ctx.moveTo(mx-m.w/2,GROUND_Y+4); ctx.quadraticCurveTo(mx,GROUND_Y-m.h,mx+m.w/2,GROUND_Y+4); ctx.fill();
  }
  const gg=ctx.createLinearGradient(0,GROUND_Y,0,H);
  gg.addColorStop(0,'#7ec850'); gg.addColorStop(0.15,'#5da832'); gg.addColorStop(0.4,'#8B5E3C'); gg.addColorStop(1,'#6d4c2a');
  ctx.fillStyle=gg; ctx.fillRect(0,GROUND_Y,W,H-GROUND_Y);
  ctx.strokeStyle='#4a8c2a'; ctx.lineWidth=2;
  for (let i=0;i<40;i++) { const gx=(i*22+frameCount*0.2)%880, gh=6+Math.sin(i*1.7+frameCount*0.03)*4; ctx.beginPath(); ctx.moveTo(gx,GROUND_Y); ctx.lineTo(gx-3,GROUND_Y-gh); ctx.moveTo(gx,GROUND_Y); ctx.lineTo(gx+3,GROUND_Y-gh); ctx.stroke(); }
  ctx.restore();
}
function drawCloud(x,y,s) { ctx.beginPath(); ctx.arc(x,y,s*0.4,0,Math.PI*2); ctx.arc(x+s*0.35,y-s*0.15,s*0.3,0,Math.PI*2); ctx.arc(x+s*0.7,y,s*0.35,0,Math.PI*2); ctx.fill(); }

function drawPlayer() {
  const p=player, px=Math.round(p.x-shakeX), py=Math.round(p.y-shakeY);
  if (invincible&&Math.floor(frameCount/4)%2===0) return;
  ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(px+p.w/2,GROUND_Y+2-shakeY,p.w*0.6,4,0,0,Math.PI*2); ctx.fill();
  if (activePowerUp==='shield') {
    ctx.save(); ctx.shadowColor='rgba(52,152,219,0.6)'; ctx.shadowBlur=20+Math.sin(frameCount*0.1)*8;
    ctx.strokeStyle='rgba(52,152,219,0.4)'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(px+p.w/2,py+p.h/2,p.w*0.7+Math.sin(frameCount*0.08)*3,0,Math.PI*2); ctx.stroke(); ctx.restore();
  }
  const bg=ctx.createLinearGradient(px,py,px,py+p.h); bg.addColorStop(0,p.color); bg.addColorStop(1,p.colorDark);
  let sy=1,sx=1; if (!p.onGround&&p.vy<0){sy=0.85;sx=1.12} if (!p.onGround&&p.vy>0){sy=1.1;sx=0.92}
  ctx.save(); ctx.translate(px+p.w/2,py+p.h/2); ctx.scale(p.facing*sx,sy);
  const bw=p.w,bh=p.h,bx=-bw/2,by=-bh/2;
  ctx.fillStyle=bg; roundRect(ctx,bx,by,bw,bh,6); ctx.fill();
  ctx.strokeStyle=p.colorDark; ctx.lineWidth=2; roundRect(ctx,bx,by,bw,bh,6); ctx.stroke();
  ctx.fillStyle=p.colorLight; roundRect(ctx,bx+6,by+bh*0.35,bw-12,bh*0.35,4); ctx.fill();
  p.blinkTimer++; const eo=p.blinkTimer%180<175;
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.ellipse(-5,-8,6,7,0,0,Math.PI*2); ctx.ellipse(5,-8,6,7,0,0,Math.PI*2); ctx.fill();
  if(eo){ctx.fillStyle='#2c3e50';ctx.beginPath();ctx.arc(-5,-7,3.5,0,Math.PI*2);ctx.arc(5,-7,3.5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-3,-9,1.5,0,Math.PI*2);ctx.arc(7,-9,1.5,0,Math.PI*2);ctx.fill();}
  else{ctx.strokeStyle='#2c3e50';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-9,-8);ctx.lineTo(-1,-8);ctx.moveTo(1,-8);ctx.lineTo(9,-8);ctx.stroke();}
  ctx.strokeStyle=p.colorDark; ctx.lineWidth=2; ctx.beginPath();
  if(p.vy<-1) ctx.arc(0,4,5,0,Math.PI*2); else ctx.arc(0,6,5,0.1,Math.PI-0.1); ctx.stroke();
  if(p.jumpsLeft>0) for(let i=0;i<p.jumpsLeft;i++){ctx.fillStyle=p.jumpsLeft===1?'#ff6b6b':'#ffd93d';ctx.beginPath();ctx.arc(-6+i*12,-bh/2-12-i*2,4,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(0,0,0,0.2)';ctx.lineWidth=1;ctx.stroke();}
  ctx.fillStyle='rgba(255,150,150,0.4)'; ctx.beginPath(); ctx.ellipse(-11,0,4,3,0,0,Math.PI*2); ctx.ellipse(11,0,4,3,0,0,Math.PI*2); ctx.fill();
  const la=p.onGround?Math.sin(frameCount*0.2)*(Math.abs(p.vx)>0.5?4:0):0;
  ctx.fillStyle=p.colorDark; ctx.strokeStyle=p.colorDark; ctx.lineWidth=2;
  for(const s of[-1,1]){const lx=s*7,ly=bh/2-2;ctx.fillRect(bx+lx-4,ly,8,12+la*s*-1);ctx.strokeRect(bx+lx-4,ly,8,12+la*s*-1);}
  ctx.restore();
}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();}

function drawStar(s) {
  const cx=Math.round(s.x+s.w/2-shakeX),cy=Math.round(s.y+s.h/2-shakeY+Math.sin(frameCount*0.05+s.bobSpeed*0.1)*3),rot=s.angle+frameCount*0.03;
  ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot);
  ctx.shadowColor=s.gold?'rgba(255,215,0,0.8)':'rgba(255,215,0,0.6)'; ctx.shadowBlur=s.gold?20+Math.sin(frameCount*0.08+s.glowPulse)*8:15;
  const spikes=5, or=s.w/2, ir=or*0.45;
  ctx.beginPath(); for(let i=0;i<spikes*2;i++){const r=i%2===0?or:ir,a=(Math.PI*i)/spikes-Math.PI/2,px=Math.cos(a)*r,py=Math.sin(a)*r;i===0?ctx.moveTo(px,py):ctx.lineTo(px,py);} ctx.closePath();
  if(s.gold){const g=ctx.createRadialGradient(0,0,0,0,0,or);g.addColorStop(0,'#fffdf0');g.addColorStop(0.3,'#ffd700');g.addColorStop(0.7,'#ffaa00');g.addColorStop(1,'#ff8c00');ctx.fillStyle=g;ctx.strokeStyle='#cc7000';}
  else{const g=ctx.createRadialGradient(0,0,0,0,0,or);g.addColorStop(0,'#fff7a0');g.addColorStop(0.5,'#ffd700');g.addColorStop(1,'#ffaa00');ctx.fillStyle=g;ctx.strokeStyle='#e68a00';}
  ctx.fill(); ctx.lineWidth=1.5; ctx.stroke();
  if(s.gold){ctx.fillStyle='#fff';const ss=3+Math.sin(frameCount*0.12+s.glowPulse)*2;for(let i=0;i<4;i++){const a=frameCount*0.05+i*Math.PI/2;ctx.beginPath();ctx.arc(Math.cos(a)*or*0.6,Math.sin(a)*or*0.6,ss*0.5,0,Math.PI*2);ctx.fill();}}
  ctx.shadowColor='transparent'; ctx.restore();
}
function drawObstacle(o) {
  const cx=Math.round(o.x+o.w/2-shakeX),cy=Math.round(o.y+o.h/2-shakeY+Math.sin(frameCount*0.06+o.bounce)*3);
  ctx.save(); ctx.translate(cx,cy);
  ctx.fillStyle='rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.ellipse(0,o.h/2+2,o.w*0.5,3,0,0,Math.PI*2); ctx.fill();
  const g=ctx.createLinearGradient(-o.w/2,-o.h/2,o.w/2,o.h/2); g.addColorStop(0,'#e74c3c'); g.addColorStop(0.5,'#c0392b'); g.addColorStop(1,'#a93226');
  ctx.fillStyle=g; roundRect(ctx,-o.w/2,-o.h/2,o.w,o.h,4); ctx.fill();
  ctx.strokeStyle='#7b241c'; ctx.lineWidth=2; roundRect(ctx,-o.w/2,-o.h/2,o.w,o.h,4); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-6,-4,5,0,Math.PI*2); ctx.arc(6,-4,5,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#2c3e50'; ctx.beginPath(); ctx.arc(-6,-3,2.5,0,Math.PI*2); ctx.arc(6,-3,2.5,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#2c3e50'; ctx.lineWidth=2.5; ctx.beginPath(); ctx.moveTo(-12,-11); ctx.lineTo(-3,-8); ctx.moveTo(3,-8); ctx.lineTo(12,-11); ctx.stroke();
  ctx.fillStyle='#2c3e50'; ctx.beginPath(); ctx.arc(0,6,4,0,Math.PI); ctx.fill();
  ctx.restore();
}
function drawPowerUpItem(pu) {
  const cx=Math.round(pu.x+pu.w/2-shakeX),cy=Math.round(pu.y+pu.h/2-shakeY+Math.sin(frameCount*0.06+pu.bobSpeed*0.1)*3);
  ctx.save(); ctx.translate(cx,cy);
  ctx.shadowColor=pu.type==='shield'?'rgba(52,152,219,0.6)':pu.type==='magnet'?'rgba(231,76,60,0.6)':'rgba(155,89,182,0.6)'; ctx.shadowBlur=15;
  ctx.fillStyle=pu.type==='shield'?'#3498db':pu.type==='magnet'?'#e74c3c':'#9b59b6'; ctx.beginPath(); ctx.arc(0,0,pu.w/2,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
  ctx.shadowColor='transparent'; ctx.fillStyle='#fff'; ctx.font='18px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(pu.type==='shield'?'🛡':pu.type==='magnet'?'🧲':'⏱',0,1);
  ctx.restore();
}
function drawParticles() { for(const p of particles){ctx.globalAlpha=p.life;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(Math.round(p.x-shakeX),Math.round(p.y-shakeY),p.size*p.life,0,Math.PI*2);ctx.fill();} ctx.globalAlpha=1; }
function drawFloatingTexts() { for(const ft of floatingTexts){ctx.globalAlpha=ft.life;ctx.fillStyle=ft.color;ctx.font=`bold ${20+(1-ft.life)*8}px 'Fredoka One', sans-serif`;ctx.textAlign='center';ctx.shadowColor='rgba(0,0,0,0.3)';ctx.shadowBlur=6;ctx.fillText(ft.text,ft.x-shakeX,ft.y-shakeY);ctx.shadowBlur=0;} ctx.globalAlpha=1; }

function updatePlayer() {
  const p=player;
  if(keys.left){p.vx=-p.speed;p.facing=-1;} else if(keys.right){p.vx=p.speed;p.facing=1;} else{p.vx*=0.7;if(Math.abs(p.vx)<0.3)p.vx=0;}
  if(keys.jump&&p.jumpsLeft>0){const isD=!p.onGround;p.vy=isD?p.doubleJumpPower:p.jumpPower;p.jumpsLeft--;p.onGround=false;keys.jump=false;if(isD){emitParticles(p.x+p.w/2,p.y+p.h,'rgba(255,255,255,0.6)',6);playDoubleJump();}else playJump();}
  const gm=activePowerUp==='slowmo'?0.4:1, sm=activePowerUp==='slowmo'?0.5:1;
  p.vy+=p.gravity*gm; if(p.vy>12*sm)p.vy=12*sm;
  p.x+=p.vx*sm; p.y+=p.vy*sm;
  if(p.y+p.h>=GROUND_Y){p.y=GROUND_Y-p.h;p.vy=0;p.onGround=true;p.jumpsLeft=p.maxJumps;}
  if(p.x<0)p.x=0; if(p.x+p.w>W)p.x=W-p.w;
}
function updateStars() {
  for(let i=stars.length-1;i>=0;i--){
    const s=stars[i], sm=activePowerUp==='slowmo'?0.4:1; s.x-=s.speed*sm;
    if(activePowerUp==='magnet'){const dx=player.x+player.w/2-(s.x+s.w/2),dy=player.y+player.h/2-(s.y+s.h/2),dist=Math.sqrt(dx*dx+dy*dy);if(dist<150&&dist>1){const f=3*(1-dist/150);s.x+=dx/dist*f;s.y+=dy/dist*f;}}
    if(s.x+s.w<-20){combo=0;stars.splice(i,1);continue;}
    if(rectCollide(player,s)){combo++;if(combo>maxCombo)maxCombo=combo;const mult=getComboMultiplier(),pts=(s.gold?3:1)*mult;emitStarCollect(s.x+s.w/2,s.y+s.h/2);score+=pts;if(s.gold){addFloatingText(s.x,s.y-10,`+${pts}`,'#ff8c00');playGoldCollect();}else{addFloatingText(s.x,s.y-10,`+${pts}`,'#ffd700');playCollect();}if(mult>1)addFloatingText(s.x+20,s.y-30,`x${mult}`,'#ff6b6b');stars.splice(i,1);updateScoreDisplay();checkAchievements();}
  }
}
function updateObstacles() {
  for(let i=obstacles.length-1;i>=0;i--){const o=obstacles[i],sm=activePowerUp==='slowmo'?0.4:1;o.x-=o.speed*sm;if(o.x+o.w<-20){obstacles.splice(i,1);continue;}if(rectCollide(player,o)){if(activePowerUp==='shield'){activePowerUp=null;powerUpTimer=0;document.getElementById('powerup-display').textContent='';playHit();emitParticles(player.x+player.w/2,player.y+player.h/2,'#3498db',15);addFloatingText(player.x,player.y-20,'🛡','#3498db');obstacles.splice(i,1);return;}playerHit();return;}}
}
function updatePowerUps() {for(let i=powerUps.length-1;i>=0;i--){const pu=powerUps[i],sm=activePowerUp==='slowmo'?0.4:1;pu.x-=pu.speed*sm;if(pu.x+pu.w<-20){powerUps.splice(i,1);continue;}if(rectCollide(player,pu)){emitParticles(pu.x+pu.w/2,pu.y+pu.h/2,'#fff',10);activePowerUp=pu.type;powerUpTimer=POWERUP_DURATION;playPowerUp();document.getElementById('powerup-display').textContent=activePowerUp==='shield'?'🛡':activePowerUp==='magnet'?'🧲':'⏱';powerUps.splice(i,1);}}}
function updateParticles() {for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx;p.y+=p.vy;p.vy+=0.1;p.life-=p.decay;if(p.life<=0)particles.splice(i,1);}}
function updateFloatingTexts() {for(let i=floatingTexts.length-1;i>=0;i--){const ft=floatingTexts[i];ft.y+=ft.vy;ft.life-=0.015;if(ft.life<=0)floatingTexts.splice(i,1);}}
function updateShake(){if(shakeIntensity>0){shakeX=(Math.random()-0.5)*shakeIntensity*2;shakeY=(Math.random()-0.5)*shakeIntensity*2;shakeIntensity*=0.9;if(shakeIntensity<0.5){shakeIntensity=0;shakeX=0;shakeY=0;}}}
function rectCollide(a,b){const s=6;return a.x+s<b.x+b.w-s&&a.x+a.w-s>b.x+s&&a.y+s<b.y+b.h-s&&a.y+a.h-s>b.y+s;}
function manageSpawns(){const sm=activePowerUp==='slowmo'?0.4:1,ad=difficulty/sm;if(stars.length<4+Math.floor(ad)&&Math.random()<0.02)spawnStar(Math.random()<0.15);const mo=1+Math.floor(ad/2);if(obstacles.length<mo&&Math.random()<(0.008+ad*0.002))spawnObstacle();if(powerUps.length<1&&!activePowerUp&&Math.random()<0.003)spawnPowerUp();if(frameCount%600===0)difficulty=Math.min(difficulty+0.5,8);}
function playerHit(){if(invincible)return;combo=0;lives--;updateLivesDisplay();updateScoreDisplay();playHit();shakeIntensity=8;emitParticles(player.x+player.w/2,player.y+player.h/2,'#e74c3c',15);if(lives<=0)gameOver();else{invincible=true;invincibleTimer=90;activePowerUp=null;powerUpTimer=0;document.getElementById('powerup-display').textContent='';}}
function updateLivesDisplay(){document.getElementById('lives-display').textContent='';for(let i=0;i<MAX_LIVES;i++)document.getElementById('lives-display').textContent+=i<lives?'❤️':'🖤';}
function checkAchievements(){for(const m of MILESTONES)if(score>=m&&!achievedMilestones.has(m)){achievedMilestones.add(m);try{localStorage.setItem('starCatcherAchievements',JSON.stringify([...achievedMilestones]));}catch(e){}showAchievement(`🌟 ${m} Stars!`);playAchievementSound();}}
function showAchievement(text){const el=document.createElement('div');el.className='achievement-popup';el.textContent=text;document.getElementById('achievement-toast').appendChild(el);setTimeout(()=>el.remove(),2500);}

function startGame() {
  if(gameState==='playing'||gameState==='loading')return;
  score=0; frameCount=0; gameTime=0; combo=0; maxCombo=0; difficulty=1; lives=MAX_LIVES;
  invincible=false; invincibleTimer=0; activePowerUp=null; powerUpTimer=0;
  shakeIntensity=0; shakeX=0; shakeY=0;
  stars=[]; obstacles=[]; particles=[]; floatingTexts=[]; powerUps=[];
  player.x=200; player.y=GROUND_Y-player.h; player.vx=0; player.vy=0; player.onGround=true; player.jumpsLeft=player.maxJumps; player.blinkTimer=0;
  updateScoreDisplay(); updateLivesDisplay(); document.getElementById('powerup-display').textContent='';
  const hl = document.getElementById('hud-level');
  if (hl) hl.textContent = '';
  Hub.switchGame('star-catcher'); currentGame=GAMES.STAR_CATCHER; gameState='playing';
}

function gameOver() {
  gameState='gameover'; playGameOverSound();
  emitParticles(player.x+player.w/2,player.y+player.h/2,'#e74c3c',25); emitParticles(player.x+player.w/2,player.y+player.h/2,'#f39c12',15); shakeIntensity=12;
  const isNB=score>highScore;
  if(isNB){highScore=score;try{localStorage.setItem('starCatcherHighScore',highScore.toString());}catch(e){}}
  saveScore(score); renderHistory('start-history');

  const coinsEarned = Math.floor(score / 10) + 1;
  Hub.addCoins(coinsEarned);

  const fs=document.getElementById('final-score');
  fs.innerHTML=(isNB?`Score: ${score} <span style="font-size:18px;color:#ffd700;display:block;">🎉 New Best!</span>`:`Score: ${score}`)+` <span style="font-size:16px;color:#ff6b6b;display:block;">🔥 Best Combo: x${getComboMultiplier()}</span><span style="font-size:14px;color:#ffd700;display:block;">🪙 +${coinsEarned} coins</span>`;
  document.getElementById('final-highscore').textContent=`🏆 Best: ${highScore}`;
  renderHistory('gameover-history');
  gameOverTimeout=setTimeout(()=>{if(gameState==='gameover')showScreen('gameover');},500);
}

function togglePause(){if(gameState!=='playing')return;paused=!paused;document.getElementById('pause-overlay').classList.toggle('active',paused);}
function showScreen(name){
  document.getElementById('welcome-screen').classList.toggle('active',name==='welcome');
  document.getElementById('loading-screen').classList.toggle('active',name==='loading');
  document.getElementById('start-screen').classList.toggle('active',name==='start');
  document.getElementById('game-screen').classList.toggle('active',name==='game');
  document.getElementById('gameover-screen').classList.toggle('active',name==='gameover');
  document.getElementById('pause-overlay').classList.remove('active');
}
const loadingTips=['Catch shiny stars to score points!','Dodge the red baddies!','Use double jump to reach higher stars!','How many stars can you collect?','Stay away from angry blocks!','Gold stars are worth 3 points!','Collect power-ups for special abilities!','🛡 Shield protects from one hit!','🧲 Magnet attracts nearby stars!','⏱ Slow-mo slows everything down!'];
function startLoading(){if(gameState==='loading')return;gameState='loading';showScreen('loading');document.getElementById('loading-bar').style.width='0%';document.getElementById('loading-tip').textContent=loadingTips[Math.floor(Math.random()*loadingTips.length)];let p=0;loadingInterval=setInterval(()=>{const inc=5+Math.random()*15;p=Math.min(p+inc,100);document.getElementById('loading-bar').style.width=p+'%';if(Math.random()<0.15)document.getElementById('loading-tip').textContent=loadingTips[Math.floor(Math.random()*loadingTips.length)];if(p>=100){clearInterval(loadingInterval);loadingInterval=null;setTimeout(()=>{if(gameState==='loading'){showScreen('start');gameState='start';}},300);}},180);}
function updateScoreDisplay(){document.getElementById('score-display').textContent=`⭐ ${score}`;document.getElementById('highscore-display').textContent=`🏆 ${highScore}`;const te=document.getElementById('timer-display');if(te){const m=Math.floor(gameTime/60),s=gameTime%60;te.textContent=`⏱ ${m}:${s.toString().padStart(2,'0')}`;}const ce=document.getElementById('combo-display');if(ce)ce.textContent=combo>0?`🔥 x${getComboMultiplier()}`:'';const hs=document.getElementById('hud-score');if(hs)hs.textContent=`⭐ ${score}`;}

function gameLoop() {
  frameCount++;
  if(gameState==='playing'&&!paused){updatePlayer();updateStars();updateObstacles();updatePowerUps();manageSpawns();gameTime=Math.floor(frameCount/60);updateScoreDisplay();updateFloatingTexts();if(activePowerUp){powerUpTimer--;if(powerUpTimer<=0){activePowerUp=null;document.getElementById('powerup-display').textContent='';}}if(invincible){invincibleTimer--;if(invincibleTimer<=0)invincible=false;}updateShake();}
  drawBackground();
  if(gameState==='playing'){const e=[];for(const s of stars)e.push({type:'star',data:s,y:s.y});for(const o of obstacles)e.push({type:'obstacle',data:o,y:o.y});for(const pu of powerUps)e.push({type:'powerup',data:pu,y:pu.y});e.sort((a,b)=>a.y-b.y);for(const en of e){if(en.type==='star')drawStar(en.data);if(en.type==='obstacle')drawObstacle(en.data);if(en.type==='powerup')drawPowerUpItem(en.data);}drawPlayer();}
  if(particles.length>0){updateParticles();drawParticles();}
  drawFloatingTexts();
  requestAnimationFrame(gameLoop);
}

document.addEventListener('visibilitychange',()=>{if(document.hidden&&gameState==='playing'&&!paused)togglePause();});
document.addEventListener('keydown',(e)=>{
  if(e.key==='ArrowLeft'||e.key==='a')keys.left=true;
  if(e.key==='ArrowRight'||e.key==='d')keys.right=true;
  if(e.key==='ArrowUp'||e.key==='w'||e.key===' '){keys.jump=true;e.preventDefault();}
  if(e.key==='Escape'&&gameState==='playing')togglePause();
  if(e.key==='Enter'){if(gameState==='welcome')startLoading();else if(gameState==='gameover')startGame();}
});
document.addEventListener('keyup',(e)=>{if(e.key==='ArrowLeft'||e.key==='a')keys.left=false;if(e.key==='ArrowRight'||e.key==='d')keys.right=false;if(e.key==='ArrowUp'||e.key==='w'||e.key===' ')keys.jump=false;});

let touchX=null, touchJumpQueued=false;
document.getElementById('gameCanvas').addEventListener('touchstart',(e)=>{e.preventDefault();const t=e.touches[0],r=document.getElementById('gameCanvas').getBoundingClientRect();touchX=t.clientX-r.left;touchJumpQueued=true;});
document.getElementById('gameCanvas').addEventListener('touchmove',(e)=>{e.preventDefault();const t=e.touches[0],r=document.getElementById('gameCanvas').getBoundingClientRect(),nx=t.clientX-r.left;if(nx<touchX-10){keys.left=true;keys.right=false;}else if(nx>touchX+10){keys.right=true;keys.left=false;}else{keys.left=false;keys.right=false;}touchX=nx;});
document.getElementById('gameCanvas').addEventListener('touchend',(e)=>{e.preventDefault();keys.left=false;keys.right=false;keys.jump=false;touchX=null;});

function processTouchJump(){if(touchJumpQueued){keys.jump=true;touchJumpQueued=false;}}

if('ontouchstart'in window||navigator.maxTouchPoints>0)document.getElementById('touch-controls').classList.add('active');
function setupTouchButton(el,key){if(!el)return;el.addEventListener('touchstart',(e)=>{e.preventDefault();keys[key]=true;});el.addEventListener('touchend',(e)=>{e.preventDefault();keys[key]=false;});el.addEventListener('touchcancel',()=>{keys[key]=false;});el.addEventListener('mousedown',()=>{keys[key]=true;});el.addEventListener('mouseup',()=>{keys[key]=false;});el.addEventListener('mouseleave',()=>{keys[key]=false;});}
setupTouchButton(document.getElementById('touch-left'),'left'); setupTouchButton(document.getElementById('touch-right'),'right'); setupTouchButton(document.getElementById('touch-jump'),'jump');

document.getElementById('welcome-btn').addEventListener('click',startLoading);
document.getElementById('start-btn').addEventListener('click',startGame);
document.getElementById('restart-btn').addEventListener('click',startGame);
document.getElementById('menu-btn').addEventListener('click',()=>{showScreen('start');gameState='start';document.getElementById('start-highscore').textContent=`🏆 Best: ${highScore}`;});
document.getElementById('resume-btn').addEventListener('click',togglePause);
document.getElementById('mute-btn')?.addEventListener('click',toggleMute);
document.getElementById('quit-btn').addEventListener('click',()=>{paused=false;document.getElementById('pause-overlay').classList.remove('active');Hub.showHub();gameState='hub';});

colorBtns.forEach((btn)=>{btn.addEventListener('click',()=>{colorBtns.forEach(b=>b.classList.remove('selected'));btn.classList.add('selected');setPlayerColor(btn.dataset.color);});});
const sc=localStorage.getItem('starCatcherColor');if(sc){colorBtns.forEach(b=>{if(b.dataset.color===sc)b.classList.add('selected');});}else document.querySelector('.color-btn')?.classList.add('selected');

const _r=window.requestAnimationFrame; window.requestAnimationFrame=function(cb){return _r.call(window,()=>{processTouchJump();cb();});};

document.getElementById('start-highscore').textContent=`🏆 Best: ${highScore}`;
renderHistory('start-history'); renderHistory('gameover-history');
gameLoop();
