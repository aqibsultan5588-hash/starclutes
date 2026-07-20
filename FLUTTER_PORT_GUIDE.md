# Star Catcher - Flutter/Dart Porting Guide

> Complete specification to rebuild the web game "Star Catcher" in Flutter with identical UI and features.

---

## 1. Project Setup

```bash
flutter create --org com.starcatcher --project-name star_catcher --platforms android,ios star_catcher
```

**Dependencies** (`pubspec.yaml`):
```yaml
dependencies:
  flutter:
    sdk: flutter
  shared_preferences: ^2.2.0    # localStorage replacement
  audioplayers: ^6.0.0          # Sound effects
  flutter_local_notifications: ^17.0.0  # (optional, for PWA-like)
```

---

## 2. Screen / Route Architecture

The game has 5 screens managed by a single `Stack` with visibility toggling:

| Screen | Widget Name | Route |
|--------|-------------|-------|
| Welcome | `WelcomeScreen` | `/welcome` |
| Loading | `LoadingScreen` | `/loading` |
| Start Menu | `StartScreen` | `/start` |
| Game | `GameScreen` | `/game` |
| Game Over | `GameOverScreen` | `/gameover` |

**State Management**: Use a single `GameController` class (ChangeNotifier) that holds all game state — similar to the JS global variables pattern. Wrap the app in a `ChangeNotifierProvider`.

---

## 3. Canvas & Rendering (GameScreen)

Use `CustomPainter` with `Canvas` for all game rendering — exactly mirrors the HTML Canvas 2D API.

**Canvas specs:**
- Logical size: 800×500 (same as JS `W=800, H=500`)
- HiDPI: Use `MediaQuery.devicePixelRatio` — multiply canvas size and apply scale
- Wrap in `FittedBox` + `AspectRatio` for responsive scaling

**Main widgets:**
```dart
class GameScreen extends StatefulWidget { ... }
class _GameScreenState extends State<GameScreen>
    with SingleTickerProviderStateMixin {
  late final Ticker _ticker;
  GameController controller = GameController();

  void _onTick(Duration elapsed) {
    controller.frameCount++;
    if (controller.state == GameState.playing && !controller.paused) {
      controller.update();
    }
    setState(() {});
  }
}
```

### CustomPainter Structure

```dart
class GamePainter extends CustomPainter {
  final GameController c;
  GamePainter(this.c);

  @override
  void paint(Canvas canvas, Size size) {
    drawBackground(canvas, c);
    if (c.state == GameState.playing) {
      // Depth-sorted rendering
      final entities = [...c.stars, ...c.obstacles, ...c.powerUps];
      entities.sort((a, b) => a.y.compareTo(b.y));
      for (final e in entities) { e.draw(canvas); }
      drawPlayer(canvas, c);
    }
    drawParticles(canvas, c);
    drawFloatingTexts(canvas, c);
  }
}
```

---

## 4. Screen-by-Screen Specification

### 4.1 Welcome Screen (`WelcomeScreen`)

| Element | Value |
|---------|-------|
| Background | LinearGradient(180°): #ff9a9e → #fad0c4 → #fbc2eb → #a18cd1 |
| Clouds | 3 radial gradients animating with `Transform.translate` (X offset -20px loop) |
| Star icon | Text '🌟', fontSize 80, animation: translateY bounce (-12px) + scale(1.1), 1.2s ease-in-out infinite |
| Title | "Star Catcher", font: Fredoka One 60px, color white, textShadow: 0 4px #e84393, 0 6px #c44569 |
| Subtitle | "A fun adventure for kids!", 20px white 700 weight |
| Button | "▶ Let's Go!", btn-play style (orange gradient, 50px border radius, shadow 0 6px #d35400) |

### 4.2 Loading Screen (`LoadingScreen`)

| Element | Value |
|---------|-------|
| Background | LinearGradient(135°): #0f2027 → #203a43 → #2c5364 |
| Star | Text '⭐' 64px, rotate 0→360° + scale (1→1.2→1), 1s linear infinite |
| Text | "Getting ready..." 28px Fredoka One white |
| Progress bar | Track: 280×14, bg rgba(255,255,255,0.15), borderRadius 20. Fill: gradient #f9d423→#ff4e50, animates 0→100% over ~2.4s |
| Tips | Random loading tips array (10 strings), changed every 180ms at 15% probability |

**Tips array (same as JS):**
```dart
const loadingTips = [
  'Catch shiny stars to score points!',
  'Dodge the red baddies!',
  'Use double jump to reach higher stars!',
  'How many stars can you collect?',
  'Stay away from angry blocks!',
  'Gold stars are worth 3 points!',
  'Collect power-ups for special abilities!',
  '🛡 Shield protects from one hit!',
  '🧲 Magnet attracts nearby stars!',
  '⏱ Slow-mo slows everything down!',
];
```

### 4.3 Start Screen (`StartScreen`)

| Element | Value |
|---------|-------|
| Background | LinearGradient(180°): #667eea → #764ba2 → #f093fb |
| Decoration | Radial gradients at 20%30% and 80%70% (pointer-events: none) |
| Star | '⭐' 72px, pulse animation: scale(1→1.15) + rotate(0→15°), 1.5s infinite |
| Title | "Star Catcher" 56px Fredoka One white, shadow: 0 4px #e67e22, 0 6px #d35400 |
| Subtitle | "Catch the stars, dodge the baddies!" 18px white |
| Button | "▶ PLAY" same btn-play style |
| High score | "🏆 Best: 0" 20px white, stored in SharedPreferences |
| History | Last 10 scores display: flex-wrap, each item = rounded chip (#rank + score). Latest has gold border |
| Color picker | Label "My Color:" + 6 circular buttons (28×28): #5dade2, #e74c3c, #2ecc71, #f39c12, #9b59b6, #1abc9c. Selected = white border + scale 1.25 |
| Controls hint | Bottom: "← → Move" and "↑ Jump ×2" in rounded pills |

**Persistence keys (SharedPreferences):**
```dart
'starCatcherHighScore'  → int
'starCatcherHistory'    → String (JSON list)
'starCatcherAchievements' → String (JSON list)
'starCatcherColor'      → String (hex color)
```

### 4.4 Game Screen (`GameScreen`)

**HUD Overlay (positioned absolutely over canvas):**

```
┌──────────────────────────────────────────────────────┐
│ [⭐ 0] [❤️❤️❤️] [🔥 x1]    [⏱ 0:00] [🛡]    [🏆 0] [🔊] [⏸] │
└──────────────────────────────────────────────────────┘
```

| Element | Position | Style |
|---------|----------|-------|
| Score | hud-left | "⭐ {score}", font: Fredoka One 22px white, textShadow |
| Lives | hud-left | 3 hearts '❤️' (alive) / '🖤' (lost), 18px |
| Combo | hud-left | "🔥 x{multiplier}", 16px #ff6b6b, only when combo > 0 |
| Timer | hud-center | "⏱ M:SS", 16px white |
| Power-up | hud-center | Icon when active: 🛡/🧲/⏱, 16px |
| High score | hud-right | "🏆 {highScore}", 22px |
| Mute btn | hud-right | Text '🔊'/'🔇', hud-btn style (rgba bg, border, 12px borderRadius) |
| Pause btn | hud-right | Text '⏸', same hud-btn style |

**Touch controls (visible only on touch devices):**
- Bottom of screen, `justifyContent: spaceBetween`
- Left button '◀' 60×60 circle, semi-transparent
- Right button '▶' 60×60 circle
- Jump button '▲' 72×72 circle, gold border

### 4.5 Game Over Screen (`GameOverScreen`)

| Element | Value |
|---------|-------|
| Background | LinearGradient(180°): #2c3e50 → #1a1a2e |
| Icon | '💥' 72px, shake rotate(-5°→5°) 0.5s infinite |
| Title | "Game Over!" 52px Fredoka One #e74c3c |
| Final score | "Score: {n}" 36px Fredoka One #f1c40f + optional "🎉 New Best!" in gold |
| Best combo | "🔥 Best Combo: x{multiplier}" 16px #ff6b6b below score |
| High score | "🏆 Best: {highScore}" 20px white |
| History | Same as start screen |
| Button | "▶ Play Again" btn-play style |
| Button | "🏠 Menu" btn-menu style (blue gradient #3498db) |

---

## 5. Game Controller Class (`GameController`)

### 5.1 Constants

```dart
static const double groundY = 440;
static const double canvasW = 800;
static const double canvasH = 500;
static const int maxLives = 3;
static const List<int> milestones = [10, 25, 50, 100, 200, 500];
static const int powerUpDuration = 600; // frames
```

### 5.2 State Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| state | `GameState` enum | `welcome` | welcome/loading/start/playing/gameover |
| score | `int` | 0 | Current score |
| highScore | `int` | 0 | Best score (persisted) |
| frameCount | `int` | 0 | Total frames elapsed |
| gameTime | `int` | 0 | gameTime = frameCount ~/ 60 |
| combo | `int` | 0 | Consecutive stars collected |
| maxCombo | `int` | 0 | Highest combo reached |
| difficulty | `double` | 1.0 | Increases by 0.5 every 600 frames (max 8) |
| lives | `int` | 3 | Current lives |
| invincible | `bool` | false | After hit, 90 frames invincibility |
| invincibleTimer | `int` | 0 | Countdown |
| paused | `bool` | false | Pause state |
| mute | `bool` | false | Sound mute |
| activePowerUp | `PowerUpType?` | null | shield/magnet/slowmo |
| powerUpTimer | `int` | 0 | Countdown |
| shakeIntensity | `double` | 0 | Screen shake |
| shakeX, shakeY | `double` | 0 | Shake offsets |
| achievedMilestones | `Set<int>` | {} | Persisted |

### 5.3 Entity Types

```dart
class Player {
  double x = 200, y = 396;  // y = groundY - h
  double w = 36, h = 44;
  double vx = 0, vy = 0;
  double speed = 5;
  double jumpPower = -15.5;
  double doubleJumpPower = -13.5;
  double gravity = 0.5;
  bool onGround = true;
  int jumpsLeft = 2;
  int maxJumps = 2;
  int facing = 1;           // -1 left, 1 right
  int blinkTimer = 0;
  Color color = const Color(0xFF5DADE2);
  Color colorDark = const Color(0xFF2E86C1);
  Color colorLight = const Color(0xFF85C1E9);
}

class Star {
  double x, y, w, h, speed, angle, bob, bobSpeed, glowPulse;
  bool gold;
}

class Obstacle {
  double x, y, w, h, speed, bounce, bounceSpeed;
  Color color;
}

class PowerUp {
  double x, y, w, h, speed, bob, bobSpeed;
  String type;  // 'shield', 'magnet', 'slowmo'
}

class Particle {
  double x, y, vx, vy, life, decay, size;
  Color color;
}

class FloatingText {
  double x, y, vy, life;
  String text;
  Color color;
}

class Mountain {
  double x, h, w;
  Color color;
}
```

---

## 6. Physics & Logic (identical to JS)

### 6.1 Player Update (`updatePlayer`)

```dart
void updatePlayer() {
  // Horizontal input
  if (keys.left)  { player.vx = -player.speed; player.facing = -1; }
  else if (keys.right) { player.vx = player.speed; player.facing = 1; }
  else { player.vx *= 0.7; if (player.vx.abs() < 0.3) player.vx = 0; }

  // Jump
  if (keys.jump && player.jumpsLeft > 0) {
    final isDouble = !player.onGround;
    player.vy = isDouble ? player.doubleJumpPower : player.jumpPower;
    player.jumpsLeft--;
    player.onGround = false;
    keys.jump = false;
    if (isDouble) {
      emitParticles(player.x + player.w/2, player.y + player.h, Colors.white60, 6);
      playDoubleJump();
    } else {
      playJump();
    }
  }

  // Gravity
  final gravMult = activePowerUp == 'slowmo' ? 0.4 : 1.0;
  final speedMult = activePowerUp == 'slowmo' ? 0.5 : 1.0;
  player.vy += player.gravity * gravMult;
  player.vy = player.vy.clamp(-999, 12 * speedMult);

  player.x += player.vx * speedMult;
  player.y += player.vy * speedMult;

  // Ground collision
  if (player.y + player.h >= groundY) {
    player.y = groundY - player.h;
    player.vy = 0;
    player.onGround = true;
    player.jumpsLeft = player.maxJumps;
  }

  // Bounds
  player.x = player.x.clamp(0, canvasW - player.w);
}
```

### 6.2 Star Update (`updateStars`)

```dart
void updateStars() {
  for (int i = stars.length - 1; i >= 0; i--) {
    final s = stars[i];
    final speedMult = activePowerUp == 'slowmo' ? 0.4 : 1.0;
    s.x -= s.speed * speedMult;

    // Magnet
    if (activePowerUp == 'magnet') {
      final dx = (player.x + player.w/2) - (s.x + s.w/2);
      final dy = (player.y + player.h/2) - (s.y + s.h/2);
      final dist = sqrt(dx*dx + dy*dy);
      if (dist < 150 && dist > 1) {
        final force = 3 * (1 - dist / 150);
        s.x += dx / dist * force;
        s.y += dy / dist * force;
      }
    }

    // Miss → reset combo
    if (s.x + s.w < -20) {
      combo = 0;
      stars.removeAt(i);
      continue;
    }

    // Collect
    if (rectCollide(player, s)) {
      combo++;
      if (combo > maxCombo) maxCombo = combo;
      final mult = getComboMultiplier();
      final points = (s.gold ? 3 : 1) * mult;
      score += points;
      emitStarCollect(s.x + s.w/2, s.y + s.h/2);
      addFloatingText(s.x, s.y - 10, '+$points',
          s.gold ? const Color(0xFFff8c00) : const Color(0xFFffd700));
      if (s.gold) playGoldCollect(); else playCollect();
      if (mult > 1) {
        addFloatingText(s.x + 20, s.y - 30, 'x$mult',
            const Color(0xFFff6b6b));
      }
      stars.removeAt(i);
      checkAchievements();
    }
  }
}
```

### 6.3 Obstacle Update (`updateObstacles`)

```dart
void updateObstacles() {
  for (int i = obstacles.length - 1; i >= 0; i--) {
    final o = obstacles[i];
    final speedMult = activePowerUp == 'slowmo' ? 0.4 : 1.0;
    o.x -= o.speed * speedMult;

    if (o.x + o.w < -20) { obstacles.removeAt(i); continue; }

    if (rectCollide(player, o)) {
      if (activePowerUp == 'shield') {
        activePowerUp = null;
        powerUpTimer = 0;
        emitParticles(player.x + player.w/2, player.y + player.h/2,
            const Color(0xFF3498DB), 15);
        addFloatingText(player.x, player.y - 20, '🛡',
            const Color(0xFF3498DB));
        obstacles.removeAt(i);
        return;
      }
      playerHit();
      return;
    }
  }
}
```

### 6.4 Collision Detection

```dart
bool rectCollide(dynamic a, dynamic b) {
  const shrink = 6;
  return a.x + shrink < b.x + b.w - shrink &&
      a.x + a.w - shrink > b.x + shrink &&
      a.y + shrink < b.y + b.h - shrink &&
      a.y + a.h - shrink > b.y + shrink;
}
```

### 6.5 Spawning (`manageSpawns`)

```dart
void manageSpawns() {
  final speedMult = activePowerUp == 'slowmo' ? 0.4 : 1.0;
  final adjusted = difficulty / speedMult;

  if (stars.length < 4 + adjusted.floor() && random.nextDouble() < 0.02) {
    spawnStar(random.nextDouble() < 0.15);
  }
  final maxObs = 1 + (adjusted / 2).floor();
  if (obstacles.length < maxObs && random.nextDouble() < (0.008 + adjusted * 0.002)) {
    spawnObstacle();
  }
  if (powerUps.isEmpty && activePowerUp == null && random.nextDouble() < 0.003) {
    spawnPowerUp();
  }
  if (frameCount % 600 == 0) {
    difficulty = (difficulty + 0.5).clamp(0, 8);
  }
}
```

### 6.6 Obstacle Spawning (`spawnObstacle`)

```dart
void spawnObstacle() {
  final type = random.nextDouble();
  double size, speed, yOff = 0;

  if (type < 0.2) {         // Big slow (20%)
    size = 42 + random.nextDouble() * 10;
    speed = 1.5 + difficulty * 0.3;
    yOff = -10;
  } else if (type < 0.4) {  // Small fast (20%)
    size = 18 + random.nextDouble() * 6;
    speed = 4 + difficulty * 0.6;
    yOff = 4;
  } else {                   // Normal (60%)
    size = 28 + random.nextDouble() * 16;
    speed = 2.5 + difficulty * 0.5;
  }

  obstacles.add(Obstacle(
    x: canvasW + 20,
    y: groundY - size - 4 + yOff,
    w: size, h: size,
    speed: speed,
    color: Color(hslToColor(340 + random.nextDouble() * 20, 0.7, 0.5)),
    bounce: random.nextDouble() * 10,
    bounceSpeed: 3 + random.nextDouble() * 3,
  ));
}
```

---

## 7. Drawing Functions (CustomPainter)

### 7.1 Background (`drawBackground`)

```dart
void drawBackground(Canvas canvas, Size size) {
  canvas.save();
  canvas.translate(-shakeX, -shakeY);

  // Sky gradient (top→bottom)
  final skyGrad = LinearGradient(
    begin: Alignment.topCenter, end: Alignment.bottomCenter,
    colors: [const Color(0xFF4facfe), const Color(0xFF87CEEB),
             const Color(0xFFb8e6ff), const Color(0xFF90d5a8)],
  );
  canvas.drawRect(Rect.fromLTWH(0, 0, W, H), Paint()..shader = skyGrad.createShader(Rect.fromLTWH(0, 0, W, H)));

  // Clouds (5 clouds, animate X by frameCount * 0.2)
  // Each cloud: 3 overlapping circles
  drawClouds(canvas);

  // Mountains (12 peaks, scroll by frameCount * 0.3)
  // Each: quadraticCurveTo peak
  drawMountains(canvas);

  // Ground gradient (#7ec850 → #5da832 → #8B5E3C → #6d4c2a)
  final groundGrad = LinearGradient(
    begin: Alignment.topCenter, end: Alignment.bottomCenter,
    colors: [const Color(0xFF7ec850), const Color(0xFF5da832),
             const Color(0xFF8B5E3C), const Color(0xFF6d4c2a)],
    stops: [0, 0.15, 0.4, 1],
  );
  canvas.drawRect(Rect.fromLTWH(0, groundY, W, H - groundY), Paint()..shader = groundGrad.createShader(Rect.fromLTWH(0, groundY, W, H - groundY)));

  // Grass blades (40 blades, sin wave + frame animation)
  drawGrass(canvas);

  canvas.restore();
}
```

### 7.2 Player (`drawPlayer`)

The player is a rounded rectangle body (36×44) with:
- Body gradient (color → colorDark) + border
- Belly (colorLight, inner rounded rect)
- Eyes: 2 white ellipses + black pupils (3.5px) + white highlights (1.5px)
- Blinking: every 180 frames, 5 frames closed (horizontal lines)
- Mouth: circle (vy < -1, jumping up) or arc (normal)
- Rosy cheeks: 2 pink ellipses
- Legs: 2 rectangles, animated with sin(frameCount*0.2) when moving
- Jump indicators: dots above head (yellow if 2 remaining, red if 1)
- Squash/stretch: scaleY=0.85/1.1 depending on vy direction
- Shadow: ellipse on ground
- Shield glow: pulsing circle when activePowerUp == 'shield'
- Invincible blink: skip drawing every 4 frames when invincible

### 7.3 Star (`drawStar`)

5-pointed star with outer/inner radius ratio:
- Rotation: `angle + frameCount * 0.03`
- Bob: sin(frameCount * 0.05 + bobSpeed * 0.1) * 3px
- Gold: radial golden gradient + white sparkle dots at 4 positions
- Normal: radial yellow gradient
- Glow shadow: dropShadow effect

```dart
void drawStar(Canvas canvas, Star s) {
  canvas.save();
  canvas.translate(s.x + s.w/2 + sin(frameCount * 0.05 + s.bobSpeed * 0.1) * 3,
                   s.y + s.h/2);
  canvas.rotate(s.angle + frameCount * 0.03);

  final outerR = s.w / 2, innerR = outerR * 0.45;
  final path = Path();
  for (int i = 0; i < 10; i++) {
    final r = i.isEven ? outerR : innerR;
    final angle = pi * i / 5 - pi / 2;
    final px = cos(angle) * r, py = sin(angle) * r;
    if (i == 0) path.moveTo(px, py); else path.lineTo(px, py);
  }
  path.close();

  // Fill with radial gradient + stroke
  // Gold stars get extra white sparkle dots
  canvas.restore();
}
```

### 7.4 Obstacle (`drawObstacle`)

Red rounded rectangle with angry face:
- Shadow ellipse below
- Red gradient fill (#e74c3c → #c0392b → #a93226)
- White eyes (5px arcs) + black pupils (2.5px)
- Angry eyebrows (slanted lines)
- Sad mouth (arc(0, 6, 4, 0, π))
- Bob: sin(frameCount * 0.06 + bounce) * 3

### 7.5 Power-up (`drawPowerUpItem`)

Colored circle with icon:
- Blue (#3498db) for shield 🛡
- Red (#e74c3c) for magnet 🧲
- Purple (#9b59b6) for slowmo ⏱
- Border: white 2px
- Glow shadow matching type color

### 7.6 Particles (`drawParticles`)

Circles with `life` opacity. Size = `size * life`. Gravity pulls down (vy += 0.1).

### 7.7 Floating Text (`drawFloatingTexts`)

Text with `life` opacity. Font size increases as life decreases (`20 + (1 - life) * 8`).

---

## 8. Sound System

Use `audioplayers` package:

```dart
import 'package:audioplayers/audioplayers.dart';

class SoundManager {
  final player = AudioPlayer();
  bool muted = false;

  Future<void> playJump() async {
    if (muted) return;
    // Generate tones programmatically or use pre-made assets
    // JS equivalent: 400Hz square 0.1s + 600Hz square 0.08s after 50ms
  }
}
```

**Option A**: Generate audio programmatically (WAV buffer) — matches JS
**Option B**: Pre-export WAV files for each sound effect

Sound list:
| Sound | Frequency | Duration | Type |
|-------|-----------|----------|------|
| Jump | 400→600Hz | 0.1+0.08s | square |
| DoubleJump | 500→800→1000Hz | 0.06+0.08+0.06s | square |
| Collect | 880→1100Hz | 0.08+0.1s | sine |
| GoldCollect | 660→880→1100Hz | 0.08+0.08+0.12s | sine |
| Hit | 150→100Hz | 0.15+0.2s | sawtooth |
| GameOver | 400→300→200Hz | 0.15+0.15+0.3s | square |
| Achievement | 523→659→784→1047Hz | 0.1+0.1+0.1+0.2s | sine |
| PowerUp | 440→554→659→880Hz | 0.08+0.08+0.08+0.15s | sine |

---

## 9. Input Handling

```dart
class GameInput {
  bool left = false, right = false, jump = false;
}
```

**Keyboard**: `Listener` widget wrapping GameScreen, check `onKeyDown`/`onKeyUp` for:
- ArrowLeft / A → left
- ArrowRight / D → right
- ArrowUp / W / Space → jump (edge-triggered, set to false after one frame)
- Escape → toggle pause
- Enter → start game (from welcome/gameover)

**Touch canvas swipe**: On `onPanStart` record X, on `onPanUpdate` compare X to determine left/right, on `onPanEnd` reset. Jump on tap/panStart.

**Touch buttons**: 3 `GestureDetector` buttons at bottom (left/right/jump), only shown on touch devices. Use `onTapDown`/`onTapUp`/`onTapCancel`.

**Auto-pause**: Use `WidgetsBindingObserver` — `didChangeAppLifecycleState(AppLifecycleState.paused)` → togglePause if playing.

---

## 10. Combo Multiplier Logic

```dart
int getComboMultiplier() => 1 + (combo / 5).floor();
```

- combo increments on each star collected
- combo resets to 0 when a star passes left edge OR player gets hit
- Display: "🔥 x{multiplier}" in HUD (only when combo > 0)
- Multiplier displayed as floating text "x2", "x3", etc. when above 1

---

## 11. Persistence (SharedPreferences)

```dart
class StorageManager {
  static Future<void> saveHighScore(int score) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt('starCatcherHighScore', score);
  }

  static Future<void> saveHistory(List<int> history) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('starCatcherHistory', jsonEncode(history));
  }

  static Future<void> saveAchievements(Set<int> achievements) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('starCatcherAchievements', jsonEncode(achievements.toList()));
  }

  static Future<void> saveColor(String color) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('starCatcherColor', color);
  }

  static Future<Map<String, dynamic>> loadAll() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'highScore': prefs.getInt('starCatcherHighScore') ?? 0,
      'history': (prefs.getStringList('starCatcherHistory') ?? []).map((e) => int.parse(e)).toList(),
      'achievements': (prefs.getStringList('starCatcherAchievements') ?? []).map((e) => int.parse(e)).toSet(),
      'color': prefs.getString('starCatcherColor') ?? '#5dade2',
    };
  }
}
```

---

## 12. Color Customization

```dart
void setPlayerColor(String hex) {
  final color = Color(int.parse(hex.replaceFirst('#', '0xFF')));
  player.color = color;
  // Darken by 40 on each channel
  player.colorDark = Color.fromARGB(255,
    (color.r * 255 - 40).clamp(0, 255).toInt(),
    (color.g * 255 - 40).clamp(0, 255).toInt(),
    (color.b * 255 - 40).clamp(0, 255).toInt(),
  );
  // Lighten by 40
  player.colorLight = Color.fromARGB(255,
    (color.r * 255 + 40).clamp(0, 255).toInt(),
    (color.g * 255 + 40).clamp(0, 255).toInt(),
    (color.b * 255 + 40).clamp(0, 255).toInt(),
  );
  StorageManager.saveColor(hex);
}
```

6 color options: `#5dade2`, `#e74c3c`, `#2ecc71`, `#f39c12`, `#9b59b6`, `#1abc9c`

---

## 13. Animations (identical to CSS)

| Animation | Equivalent Flutter |
|-----------|--------------------|
| `welcomeBounce` | `AnimationController` with `Tween(begin: 0, end: -12)` + `Curves.easeInOut` |
| `loadingSpin` | `AnimationController` with `Tween(begin: 0, end: 2*pi)` rotating |
| `starPulse` | Scale tween (1→1.15) + rotate tween (0→0.26 rad) |
| `cloudsDrift` | Translate X tween (0→-20) |
| `shake` (gameover) | Rotate tween (-0.09→0.09 rad) |
| `achievementIn/Out` | Opacity + translate Y + scale |
| Screen shake | Random offsets shakeX/shakeY decaying by 0.9 each frame |
| Star bob | sin(frameCount * freq) applied to Y position |
| Cloud scroll | frameCount * 0.2 mod 600 |
| Mountain scroll | frameCount * 0.3 mod 1200 |
| Player blink | Every 180 frames, 5 frames closed |
| Player leg swing | sin(frameCount * 0.2) when moving |

---

## 14. Color & Style Constants

```dart
// Backgrounds
const welcomeBg = LinearGradient(180, [0xFFff9a9e, 0xFFfad0c4, 0xFFfbc2eb, 0xFFa18cd1]);
const loadingBg = LinearGradient(135, [0xFF0f2027, 0xFF203a43, 0xFF2c5364]);
const startBg = LinearGradient(180, [0xFF667eea, 0xFF764ba2, 0xFFf093fb]);
const gameoverBg = LinearGradient(180, [0xFF2c3e50, 0xFF1a1a2e]);

// Buttons
const btnPlayGrad = LinearGradient(135, [0xFFf39c12, 0xFFe67e22]);
const btnMenuGrad = LinearGradient(135, [0xFF3498db, 0xFF2980b9]);

// Colors
const goldColor = Color(0xFFffd700);
const comboColor = Color(0xFFff6b6b);
const heartAlive = '❤️';
const heartDead = '🖤';
```

---

## 15. File Structure (Flutter)

```
lib/
  main.dart                    # App entry + MaterialApp with routes
  screens/
    welcome_screen.dart
    loading_screen.dart
    start_screen.dart
    game_screen.dart           # GameScreen (stateful, ticker) + GamePainter
    game_over_screen.dart
  controllers/
    game_controller.dart       # All game state, physics, spawning logic
    input_controller.dart      # Keyboard + touch input state
  models/
    player.dart
    star.dart
    obstacle.dart
    power_up.dart
    particle.dart
    floating_text.dart
  utils/
    sound_manager.dart         # Audio playback
    storage_manager.dart       # SharedPreferences
    painters/
      background_painter.dart  # Sky, clouds, mountains, ground
      player_painter.dart
      star_painter.dart
      obstacle_painter.dart
      powerup_painter.dart
      particle_painter.dart
  widgets/
    hud.dart                   # HUD overlay (score, lives, combo, timer, buttons)
    touch_controls.dart        # Mobile touch buttons
    achievement_toast.dart     # Achievement popup
    color_picker.dart          # Color selection row
    history_list.dart          # Score history chips
    pause_overlay.dart         # Pause/resume/quit overlay
```

---

## 16. Key Implementation Notes

1. **Game loop**: Flutter doesn't have `requestAnimationFrame`. Use `Ticker` (from `SingleTickerProviderStateMixin`) which fires ~60fps. Wrap state changes in `setState()` or use a `ValueNotifier`/`ChangeNotifier`.

2. **Canvas performance**: Use `RepaintBoundary` around GameScreen. Avoid allocating new objects in `paint()`. Pre-create paints and reuse.

3. **Depth sorting**: Before rendering, collect all entities into a list, sort by `y`, then render in order.

4. **Random**: Use a single `Random()` instance for all RNG — identical to JS.

5. **Screen shake**: Apply `canvas.translate(-shakeX, -shakeY)` at the start of `paint()`. Decay shakeIntensity by 0.9 each frame.

6. **Particle decay**: `life -= decay` per frame. Remove when life <= 0.

7. **Floating text**: `life -= 0.015` per frame. Remove when life <= 0. Y-position: `y += vy` (vy negative = float up).

8. **Achievement popup**: Show an overlay widget (not on canvas) that fades in, stays 2.5s, then fades out. Use overlay `Stack` + `AnimatedOpacity`.

9. **Pause overlay**: Stack on top of game canvas. Dark background, "PAUSED" title, Resume + Quit buttons.

10. **Loading screen**: Fake progress bar filling over ~2.4s (setInterval 180ms), tips randomly change.

11. **High score display on game over**: Show "New Best!" if score > previous high score. Update + save.

12. **Score history**: Keep last 10 scores. Display as horizontal pill chips. Latest chip has gold border.

13. **Mute button**: Toggle between 🔊/🔇 texts. Skip all `playTone` calls when muted.

14. **Auto-pause**: Use `WidgetsBindingObserver.didChangeAppLifecycleState` — when `paused`, togglePause.

15. **Responsive design**: Wrap game in `LayoutBuilder` / `FittedBox` to scale the 800×500 canvas to any screen size. Show touch controls only when `defaultTargetPlatform == TargetPlatform.android || TargetPlatform.iOS`.

---

## 17. Achievement Milestones

```dart
const milestones = [10, 25, 50, 100, 200, 500];

void checkAchievements() {
  for (final m in milestones) {
    if (score >= m && !achievedMilestones.contains(m)) {
      achievedMilestones.add(m);
      StorageManager.saveAchievements(achievedMilestones);
      showAchievement('🌟 $m Stars!');
      playAchievement();
    }
  }
}
```

---

## 18. Game Flow State Machine

```
welcome → loading (button or Enter)
loading → start (progress bar fills)
start → playing (button "PLAY")
playing → gameover (lives = 0)
gameover → start (button "Menu") OR playing (button "Play Again")
playing ↔ paused (Escape key or blur)
```

---

*End of document. This guide covers 100% of the game's features, behaviors, colors, sizes, timings, and animations to produce an identical Flutter/Dart mobile application.*
