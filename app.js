// 1. EventEmitter 정의
class EventEmitter {
  constructor() {
    this.listeners = {};
  }
  on(message, listener) {
    if (!this.listeners[message]) this.listeners[message] = [];
    this.listeners[message].push(listener);
  }
  emit(message, payload = null) {
    if (this.listeners[message]) {
      this.listeners[message].forEach((l) => l(message, payload));
    }
  }
}

// 2. 상수 정의
const Messages = {
  KEY_EVENT_SPACE: "KEY_EVENT_SPACE",
  COLLISION_ENEMY_LASER: "COLLISION_ENEMY_LASER",  // 내 레이저 vs 적
  COLLISION_HERO_LASER: "COLLISION_HERO_LASER"     // 적 레이저 vs 히어로
};

// 기체 타입별 설정
const HERO_TYPES = {
  basic: {
    key: "basic",
    name: "기본형",
    moveSpeed: 10,
    fireCooldown: 180,
    pattern: "single"
  },
  speed: {
    key: "speed",
    name: "속도형",
    moveSpeed: 14,
    fireCooldown: 150,
    pattern: "single"
  },
  spread: {
    key: "spread",
    name: "확산형",
    moveSpeed: 8,
    fireCooldown: 220,
    pattern: "triple"
  }
};

const START_LIVES = 3;
const ITEM_DROP_CHANCE = 0.1;
const MAX_LIVES = 3; // 최대 목숨 3

// 난이도 설정
const difficultyConfigs = {
  easy: {
    name: "EASY",
    enemyFireBase: 0.004,
    enemySpeedFactor: 0.8
  },
  normal: {
    name: "NORMAL",
    enemyFireBase: 0.01,
    enemySpeedFactor: 1.0
  },
  hard: {
    name: "HARD",
    enemyFireBase: 0.02,
    enemySpeedFactor: 1.3
  }
};

const BOSS_WAVE = 4;

// 저장 관련
const SAVE_KEY = "SPACE_GAME_SAVE_V1";
let playerSave = {
  gold: 0,
  upgrades: {
    moveSpeed: 0,
    fireRate: 0,
    attackPower: 0
  }
};

// 3. 전역 변수
let canvas, ctx;

// 기체/적/보스 이미지들
let heroImgBasic, heroImgSpeed, heroImgSpread;
let enemyImgNormal, enemyImgZigzag, enemyImgDash;
let bossImg;

// 현재 선택된 기체 이미지
let heroImg;

let hero;
let gameObjects = [];
let eventEmitter = new EventEmitter();

let gameLoopId = null;
let waveTimerId = null;

let mainMenu, modeScreen, difficultyScreen, shipScreen, gameOverScreen;
let startBtn, shopBtn, loadingText;
let modeStageBtn, modeEndlessBtn, modeBackBtn;
let easyBtn, normalBtn, hardBtn, backToMenuBtn;
let shipBackBtn, restartBtn;
let gameOverTitle, finalInfo, rewardInfo;
let goldMainSpan, goldShopSpan;
let upMoveLevelSpan, upFireLevelSpan, upAttackLevelSpan;
let upMoveBtn, upFireBtn, upAttackBtn, upgradeMsgEl;

let currentDifficultyKey = "normal";
let currentDifficulty = difficultyConfigs.normal;
let difficultyLevel = 1;
let enemyFireChance = 0.01;

let currentWave = 1;
let enemiesRemaining = 0;
let bossActive = false;

// 모드: stage / endless
let currentMode = "stage";
let pendingMode = "stage";

// 선택된 기체 타입
let selectedHeroTypeKey = "basic";

// 별 배경
let stars = [];

// 키 입력 상태
let keys = {};

// UI 메시지
let waveMessage = "";
let waveMessageEndTime = 0;

// 점수
let score = 0;

// 직전 클리어 보상
let lastRewardGold = 0;

// 랜덤 스폰 관리
let enemiesToSpawn = 0;
let enemiesSpawned = 0;
let enemySpawnTimerId = null;

// 4. 공통 클래스
class GameObject {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.dead = false;
    this.type = "";
    this.width = 0;
    this.height = 0;
    this.img = undefined;
  }
  draw(ctx) {
    if (this.img)
      ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
  }
  update() {}
  rectFromGameObject() {
    return {
      top: this.y,
      left: this.x,
      bottom: this.y + this.height,
      right: this.x + this.width
    };
  }
}

// 5. 레이저 클래스 (vx 추가: 확산샷용)
class Laser extends GameObject {
  constructor(x, y, vy, color, owner, vx = 0) {
    super(x, y);
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.owner = owner;
    this.type = owner === "hero" ? "HeroLaser" : "EnemyLaser";

    if (owner === "hero") {
      this.width = 6;
      this.height = 16;
    } else {
      this.width = 4;
      this.height = 20;
    }
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (
      this.y + this.height < 0 ||
      this.y > canvas.height ||
      this.x + this.width < 0 ||
      this.x > canvas.width
    ) {
      this.dead = true;
    }
  }
  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

// 6. 아이템 클래스
class Item extends GameObject {
  constructor(x, y, itemType) {
    super(x, y);
    this.width = 24;
    this.height = 24;
    this.type = "Item";
    this.itemType = itemType; // 'life' or 'sub'
    this.vy = 2;
  }
  update() {
    this.y += this.vy;
    if (this.y > canvas.height) {
      this.dead = true;
    }
  }
  draw(ctx) {
    ctx.beginPath();
    ctx.rect(this.x, this.y, this.width, this.height);
    ctx.fillStyle = this.itemType === "life" ? "lime" : "cyan";
    ctx.fill();
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "black";
    ctx.fillText(
      this.itemType === "life" ? "+1" : "SUB",
      this.x + this.width / 2,
      this.y + this.height / 2
    );
  }
}

// 7. 플레이어 클래스
class Hero extends GameObject {
  constructor(x, y, heroConfig, heroKind) {
    super(x, y);
    this.width = 99;
    this.height = 75;
    this.type = "Hero";
    this.heroKind = heroKind;
    this.heroConfig = heroConfig;

    this.moveSpeed = heroConfig.moveSpeed;
    this.fireCooldownMax = heroConfig.fireCooldown;
    this.firePattern = heroConfig.pattern;

    this.cooldown = 0;
    this.lives = START_LIVES;
    this.attackPower = 1;

    this.availableSubOffsets = [
      { dx: -60, dy: 30 },
      { dx: this.width + 20, dy: 30 }
    ];
    this.subOffset = [];
    this.subShootIntervalIds = [];

    this.invincible = false;
    this.invincibleUntil = 0;
  }

  addSubShip() {
    if (this.subOffset.length >= this.availableSubOffsets.length) return;

    const newOffset = this.availableSubOffsets[this.subOffset.length];
    this.subOffset.push(newOffset);

    const subW = this.width * 0.6;
    const id = setInterval(() => {
      if (this.dead) return;
      const lx = this.x + newOffset.dx + (subW / 2) - 2;
      const ly = this.y + newOffset.dy;
      gameObjects.push(new Laser(lx, ly, -15, "red", "hero"));
    }, 1000);
    this.subShootIntervalIds.push(id);
  }

  stopSubShots() {
    this.subShootIntervalIds.forEach((id) => clearInterval(id));
    this.subShootIntervalIds = [];
  }

  fire() {
    if (!this.canFire()) return;

    const centerX = this.x + this.width / 2 - 2;
    const startY = this.y - 10;

    if (this.firePattern === "single") {
      gameObjects.push(new Laser(centerX, startY, -15, "red", "hero", 0));
    } else if (this.firePattern === "triple") {
      gameObjects.push(new Laser(centerX, startY, -15, "red", "hero", 0));
      gameObjects.push(new Laser(centerX, startY, -14, "red", "hero", -3));
      gameObjects.push(new Laser(centerX, startY, -14, "red", "hero", 3));
    } else {
      gameObjects.push(new Laser(centerX, startY, -15, "red", "hero", 0));
    }

    this.cooldown = this.fireCooldownMax;
    let id = setInterval(() => {
      this.cooldown -= 40;
      if (this.cooldown <= 0) {
        this.cooldown = 0;
        clearInterval(id);
      }
    }, 40);
  }

  canFire() {
    return this.cooldown === 0 && !this.dead;
  }

  update() {
    if (this.invincible && Date.now() > this.invincibleUntil) {
      this.invincible = false;
    }
  }

  draw(ctx) {
    if (this.invincible && Math.floor(Date.now() / 100) % 2 === 0) {
      return;
    }
    super.draw(ctx);

    const subW = this.width * 0.6;
    const subH = this.height * 0.6;
    this.subOffset.forEach((offset) => {
      const x = this.x + offset.dx;
      const y = this.y + offset.dy;
      ctx.drawImage(heroImg, x, y, subW, subH);
    });
  }
}

// 8. 적 기본형 (속도↑, 불규칙 이동, 플레이어 추적)
class Enemy extends GameObject {
  constructor(x, y) {
    super(x, y);
    this.width = 98;
    this.height = 50;
    this.type = "Enemy";
    this.subtype = "normal";

    const base = (1.5 + difficultyLevel * 0.6) * currentDifficulty.enemySpeedFactor;
    this.speedY = base * (0.8 + Math.random() * 0.8); // 0.8~1.6배 랜덤

    this.vx = (Math.random() - 0.5) * 3;  // -1.5 ~ 1.5
    this.maxVx = 4 + difficultyLevel * 0.7;

    this.hp = 1;

    this.fireChanceFactor = 0.5 + Math.random(); // 0.5~1.5배
  }

  fire() {
    const lx = this.x + this.width / 2 - 2;
    const ly = this.y + this.height + 5;
    gameObjects.push(
      new Laser(lx, ly, 8 + difficultyLevel * 0.5, "yellow", "enemy", 0)
    );
  }

  update() {
    this.y += this.speedY;

    // 좌우 가속(랜덤 + 플레이어 방향으로 끌림)
    let ax = (Math.random() - 0.5) * 0.6;

    if (hero && !hero.dead) {
      const cx = this.x + this.width / 2;
      const hx = hero.x + hero.width / 2;
      const dir = hx > cx ? 1 : -1;
      ax += 0.09 * dir;
    }

    this.vx += ax;
    if (this.vx > this.maxVx) this.vx = this.maxVx;
    if (this.vx < -this.maxVx) this.vx = -this.maxVx;

    this.x += this.vx;

    if (this.x < -40 || this.x > canvas.width - this.width + 40) {
      this.vx *= -0.8;
    }

    if (this.y > canvas.height && !this.dead) {
      this.dead = true;
      enemiesRemaining = Math.max(0, enemiesRemaining - 1);
    }

    if (Math.random() < enemyFireChance * this.fireChanceFactor) {
      this.fire();
    }
  }
}

// 9. 지그재그 적 (HP↑, 크게 흔들 + 베이스 위치도 움직임)
class ZigZagEnemy extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.subtype = "zigzag";

    this.baseX = x;
    this.angle = Math.random() * Math.PI * 2;
    this.amplitude = 50 + Math.random() * 70;
    this.angleSpeed = 0.06 + Math.random() * 0.04;

    this.hp = 3;

    this.fireChanceFactor = 0.8 + Math.random() * 0.7;
  }

  update() {
    this.y += this.speedY;

    this.baseX += (Math.random() - 0.5) * 2.0;

    if (hero && !hero.dead) {
      const hx = hero.x + hero.width / 2;
      this.baseX += (hx - this.baseX) * 0.015;
    }

    this.angle += this.angleSpeed;
    this.x = this.baseX + Math.sin(this.angle) * this.amplitude;

    if (this.y > canvas.height && !this.dead) {
      this.dead = true;
      enemiesRemaining = Math.max(0, enemiesRemaining - 1);
    }

    if (Math.random() < enemyFireChance * this.fireChanceFactor) {
      this.fire();
    }
  }
}

// 10. 돌진형 적 (속도↑, 진입/돌진 모두 불규칙)
class DashEnemy extends Enemy {
  constructor(x, y) {
    super(x, y);
    this.subtype = "dash";
    this.state = "fall";

    this.dashSpeed = 11 * currentDifficulty.enemySpeedFactor;
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = this.speedY;
    this.triggerY = 120 + Math.random() * 140;

    this.fireChanceFactor = 0.3 + Math.random() * 0.7;
  }

  update() {
    if (this.state === "fall") {
      this.y += this.speedY;
      this.x += this.vx;
      this.vx += (Math.random() - 0.5) * 0.5;
      this.vx = Math.max(-4, Math.min(4, this.vx));

      if (this.y >= this.triggerY && hero && !hero.dead) {
        const cx = this.x + this.width / 2;
        const cy = this.y + this.height / 2;
        const hx = hero.x + hero.width / 2;
        const hy = hero.y + hero.height / 2;
        const dx = hx - cx;
        const dy = hy - cy;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        this.vx = (dx / len) * this.dashSpeed;
        this.vy = (dy / len) * this.dashSpeed;
        this.state = "dash";
      }
    } else {
      const noiseX = (Math.random() - 0.5) * 0.6;
      const noiseY = (Math.random() - 0.5) * 0.3;
      this.vx += noiseX;
      this.vy += noiseY;

      const maxDash = this.dashSpeed * 1.2;
      const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy) || 1;
      if (speed > maxDash) {
        const s = maxDash / speed;
        this.vx *= s;
        this.vy *= s;
      }

      this.x += this.vx;
      this.y += this.vy;
    }

    if (
      this.y > canvas.height + 50 ||
      this.x < -120 ||
      this.x > canvas.width + 120
    ) {
      if (!this.dead) {
        this.dead = true;
        enemiesRemaining = Math.max(0, enemiesRemaining - 1);
      }
    }

    if (this.state === "fall" && Math.random() < enemyFireChance * this.fireChanceFactor * 0.5) {
      this.fire();
    }
  }
}

// 11. 보스 클래스 (이미지 + HP바)
class Boss extends GameObject {
  constructor() {
    super(canvas.width / 2 - 200, 60);
    this.width = 400;
    this.height = 160;
    this.type = "Boss";

    this.maxHp = 60;
    this.hp = this.maxHp;

    this.speedX = 3 * currentDifficulty.enemySpeedFactor;
    this.direction = 1;
    this.fireCooldown = 0;
  }

  update() {
    this.x += this.speedX * this.direction;
    if (this.x < 50 || this.x + this.width > canvas.width - 50) {
      this.direction *= -1;
    }

    if (this.fireCooldown > 0) {
      this.fireCooldown--;
    } else {
      this.firePattern();
      this.fireCooldown = 40;
    }
  }

  firePattern() {
    const centerX = this.x + this.width / 2;
    const ly = this.y + this.height;
    const offsets = [-120, -60, 0, 60, 120];
    offsets.forEach((off) => {
      const lx = centerX + off;
      gameObjects.push(new Laser(lx, ly, 7, "orange", "enemy", 0));
    });
  }

  draw(ctx) {
    if (this.img) {
      ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
    }

    const barWidth = this.width;
    const barHeight = 16;
    const barX = this.x;
    const barY = this.y - 24;

    const ratio = Math.max(0, this.hp / this.maxHp);

    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = "red";
    ctx.fillRect(barX, barY, barWidth * ratio, barHeight);

    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }
}

// 12. 폭발 클래스
class Explosion extends GameObject {
  constructor(x, y) {
    super(x, y);
    this.radius = 0;
    this.maxRadius = 30;
    this.color = "orange";
    this.startTime = Date.now();
    this.type = "Explosion";
    setTimeout(() => {
      this.dead = true;
    }, 500);
  }
  draw(ctx) {
    const elapsed = Date.now() - this.startTime;
    const progress = elapsed / 500;
    const r = this.maxRadius * progress;

    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 1 - progress;
    ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

// 13. 유틸 함수
function loadTexture(path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = path;
    img.onload = () => resolve(img);
  });
}

// 까만색(또는 거의 까만색) 배경을 투명하게 만드는 함수
function makeBlackTransparent(img) {
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = img.width;
  tempCanvas.height = img.height;
  const tctx = tempCanvas.getContext("2d");

  tctx.drawImage(img, 0, 0);

  const imgData = tctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    if (r < 10 && g < 10 && b < 10) {
      data[i + 3] = 0;
    }
  }

  tctx.putImageData(imgData, 0, 0);
  return tempCanvas;
}

function intersectRect(r1, r2) {
  return !(
    r2.left > r1.right ||
    r2.right < r1.left ||
    r2.top > r1.bottom ||
    r2.bottom < r1.top
  );
}

// 별 초기화 & 업데이트
function initStars(count) {
  stars = [];
  for (let i = 0; i < count; i++) {
    const layer = Math.floor(Math.random() * 3);
    const baseSpeed = [0.3, 0.7, 1.2][layer];
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * (layer === 0 ? 1.2 : 1.8) + 0.4,
      speed: baseSpeed + Math.random() * 0.5
    });
  }
}

function updateAndDrawStars(ctx) {
  ctx.save();
  const colors = ["white", "#e0e0ff", "#ccccff"];
  stars.forEach((s) => {
    s.y += s.speed;
    if (s.y > canvas.height) s.y = 0;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.fill();
  });
  ctx.restore();
}

// 저장 로드
function loadPlayerData() {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === "object") {
        playerSave = {
          gold: parsed.gold ?? 0,
          upgrades: {
            moveSpeed: parsed.upgrades?.moveSpeed ?? 0,
            fireRate: parsed.upgrades?.fireRate ?? 0,
            attackPower: parsed.upgrades?.attackPower ?? 0
          }
        };
      }
    }
  } catch (e) {
    console.warn("loadPlayerData 실패", e);
  }
}

function savePlayerData() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(playerSave));
  } catch (e) {
    console.warn("savePlayerData 실패", e);
  }
}

function getUpgradeCost(kind) {
  const level = playerSave.upgrades[kind] || 0;
  const base = {
    moveSpeed: 100,
    fireRate: 120,
    attackPower: 150
  }[kind] || 100;
  return base * (level + 1);
}

function refreshGoldUI() {
  if (goldMainSpan) goldMainSpan.textContent = playerSave.gold;
  if (goldShopSpan) goldShopSpan.textContent = playerSave.gold;

  if (upMoveLevelSpan) upMoveLevelSpan.textContent = playerSave.upgrades.moveSpeed;
  if (upFireLevelSpan) upFireLevelSpan.textContent = playerSave.upgrades.fireRate;
  if (upAttackLevelSpan) upAttackLevelSpan.textContent = playerSave.upgrades.attackPower;

  if (upMoveBtn) upMoveBtn.textContent = `업그레이드 (${getUpgradeCost("moveSpeed")}G)`;
  if (upFireBtn) upFireBtn.textContent = `업그레이드 (${getUpgradeCost("fireRate")}G)`;
  if (upAttackBtn) upAttackBtn.textContent = `업그레이드 (${getUpgradeCost("attackPower")}G)`;
}

function setUpgradeMessage(text) {
  if (!upgradeMsgEl) return;
  upgradeMsgEl.textContent = text;
  if (text) {
    setTimeout(() => {
      if (upgradeMsgEl.textContent === text) {
        upgradeMsgEl.textContent = "";
      }
    }, 2000);
  }
}

function buyUpgrade(kind) {
  const cost = getUpgradeCost(kind);
  if (playerSave.gold < cost) {
    setUpgradeMessage("골드가 부족합니다.");
    return;
  }
  playerSave.gold -= cost;
  playerSave.upgrades[kind] = (playerSave.upgrades[kind] || 0) + 1;
  savePlayerData();
  refreshGoldUI();
  setUpgradeMessage("업그레이드 완료!");
}

// 14. 생성 함수들
function createHero() {
  const cfg = HERO_TYPES[selectedHeroTypeKey] || HERO_TYPES.basic;
  hero = new Hero(
    canvas.width / 2 - 45,
    canvas.height - canvas.height / 4,
    cfg,
    cfg.key
  );

  if (cfg.key === "basic") heroImg = heroImgBasic;
  else if (cfg.key === "speed") heroImg = heroImgSpeed;
  else if (cfg.key === "spread") heroImg = heroImgSpread;
  else heroImg = heroImgBasic;

  hero.img = heroImg;

  const moveLv = playerSave.upgrades.moveSpeed || 0;
  const fireLv = playerSave.upgrades.fireRate || 0;
  const atkLv = playerSave.upgrades.attackPower || 0;

  hero.moveSpeed += moveLv * 1.5;
  const fireRateFactor = 1 - 0.07 * fireLv;
  hero.fireCooldownMax = Math.max(80, hero.fireCooldownMax * fireRateFactor);
  hero.attackPower = 1 + atkLv;

  gameObjects.push(hero);
}

// 랜덤 스폰 방식으로 웨이브 생성
// → 총 몬스터 수는 기존 수준 유지, 대신 한 번 호출 때마다 5마리씩 묶어서 스폰
function createEnemiesForWave(wave) {
  if (enemySpawnTimerId) {
    clearTimeout(enemySpawnTimerId);
    enemySpawnTimerId = null;
  }

  const baseCount = currentMode === "endless" ? 12 : 10;
  const extraPerWave = currentMode === "endless" ? 4 : 3;
  enemiesToSpawn = baseCount + extraPerWave * (wave - 1);

  // 스테이지 모드에서 보스 웨이브는 적 스폰 안 함
  if (currentMode === "stage" && wave >= BOSS_WAVE) {
    enemiesToSpawn = 0;
    enemiesSpawned = 0;
    enemiesRemaining = 0;
    return;
  }

  enemiesSpawned = 0;
  enemiesRemaining = 0;

  const spawnEnemyOnce = () => {
    if (!canvas) return;
    if (enemiesSpawned >= enemiesToSpawn) {
      enemySpawnTimerId = null;
      return;
    }

    const groupSize = 5;
    const remaining = enemiesToSpawn - enemiesSpawned;
    const count = Math.min(groupSize, remaining);

    for (let i = 0; i < count; i++) {
      const x = Math.random() * (canvas.width - 98);
      const y = -60 - Math.random() * 80;

      let enemy;
      const rand = Math.random();
      if (rand < 0.5) enemy = new Enemy(x, y);
      else if (rand < 0.8) enemy = new ZigZagEnemy(x, y);
      else enemy = new DashEnemy(x, y);

      if (enemy instanceof ZigZagEnemy) {
        enemy.img = enemyImgZigzag;
      } else if (enemy instanceof DashEnemy) {
        enemy.img = enemyImgDash;
      } else {
        enemy.img = enemyImgNormal;
      }

      gameObjects.push(enemy);
      enemiesSpawned++;
      enemiesRemaining++;
    }

    // 아직 소환할 적이 남아 있으면 다음 그룹 예약
    if (enemiesSpawned < enemiesToSpawn) {
      const difficultyFactor = Math.min(wave / 8, 1);
      const minInterval = 300;
      const maxInterval = 1200;
      const base = maxInterval - (maxInterval - minInterval) * difficultyFactor;
      const interval = base * (0.5 + Math.random()); // 0.5~1.5배 랜덤

      enemySpawnTimerId = setTimeout(spawnEnemyOnce, interval);
    } else {
      enemySpawnTimerId = null;
    }
  };

  spawnEnemyOnce();
}

function spawnBoss() {
  const boss = new Boss();
  boss.img = bossImg;
  gameObjects.push(boss);
  bossActive = true;
}

function showWaveMessage(text, duration = 2000) {
  waveMessage = text;
  waveMessageEndTime = Date.now() + duration;
}

function drawGameObjects(ctx) {
  gameObjects.forEach((go) => go.draw(ctx));
}

// UI
function drawUI() {
  ctx.fillStyle = "white";
  ctx.font = "20px Arial";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const livesText = hero && !hero.dead ? hero.lives : 0;
  ctx.fillText(`LIVES: ${livesText}`, 20, 20);
  ctx.fillText(`SCORE: ${score}`, 20, 48);
  ctx.fillText(`WAVE: ${currentWave}`, 20, 76);
  ctx.fillText(`MODE: ${currentDifficulty.name}`, 20, 104);

  const heroCfg = HERO_TYPES[selectedHeroTypeKey];
  if (heroCfg) {
    ctx.fillText(`SHIP: ${heroCfg.name}`, 20, 132);
  }

  ctx.textAlign = "right";
  ctx.fillText(`GOLD: ${playerSave.gold}`, canvas.width - 20, 20);
  ctx.textAlign = "left";

  if (waveMessage && Date.now() < waveMessageEndTime) {
    ctx.font = "36px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(waveMessage, canvas.width / 2, canvas.height / 2);
  }
}

// 15. 게임 업데이트
function updateGameObjects() {
  gameObjects.forEach((go) => {
    if (typeof go.update === "function") go.update();
  });

  const enemies = gameObjects.filter((go) => go.type === "Enemy");
  const heroLasers = gameObjects.filter((go) => go.type === "HeroLaser");
  const enemyLasers = gameObjects.filter((go) => go.type === "EnemyLaser");
  const items = gameObjects.filter((go) => go.type === "Item");
  const bosses = gameObjects.filter((go) => go.type === "Boss");

  // 내 레이저 vs 적
  heroLasers.forEach((l) => {
    enemies.forEach((e) => {
      if (l.dead || e.dead) return;
      if (intersectRect(l.rectFromGameObject(), e.rectFromGameObject())) {
        eventEmitter.emit(Messages.COLLISION_ENEMY_LASER, {
          first: l,
          second: e
        });
      }
    });
  });

  // 내 레이저 vs 보스
  heroLasers.forEach((l) => {
    bosses.forEach((b) => {
      if (l.dead || b.dead) return;
      if (intersectRect(l.rectFromGameObject(), b.rectFromGameObject())) {
        l.dead = true;

        const atk = hero && hero.attackPower ? hero.attackPower : 1;
        b.hp -= atk;

        gameObjects.push(
          new Explosion(
            l.x + l.width / 2,
            l.y + l.height / 2
          )
        );
        score += 20;
        if (b.hp <= 0 && !b.dead) {
          b.dead = true;
          bossActive = false;
          score += 500;

          lastRewardGold = 0;
          if (currentMode === "stage") {
            let reward = 0;
            if (currentDifficultyKey === "easy") reward = 100;
            else if (currentDifficultyKey === "normal") reward = 200;
            else if (currentDifficultyKey === "hard") reward = 300;
            playerSave.gold += reward;
            lastRewardGold = reward;
            savePlayerData();
            refreshGoldUI();
          }

          const centerX = b.x + b.width / 2;
          const centerY = b.y + b.height / 2;
          for (let i = 0; i < 10; i++) {
            const rx = centerX + (Math.random() - 0.5) * b.width * 0.8;
            const ry = centerY + (Math.random() - 0.5) * b.height * 0.8;
            gameObjects.push(new Explosion(rx, ry));
          }

          setTimeout(() => {
            showWaveMessage("YOU WIN!", 4000);
            showGameOver(true);
          }, 600);
        }
      }
    });
  });

  // 적 레이저 vs 히어로
  if (hero && !hero.dead) {
    enemyLasers.forEach((l) => {
      if (l.dead) return;
      if (intersectRect(l.rectFromGameObject(), hero.rectFromGameObject())) {
        eventEmitter.emit(Messages.COLLISION_HERO_LASER, {
          first: l,
          second: hero
        });
      }
    });
  }

  // 아이템 vs 히어로
  if (hero && !hero.dead) {
    items.forEach((item) => {
      if (item.dead) return;
      if (intersectRect(item.rectFromGameObject(), hero.rectFromGameObject())) {
        if (item.itemType === "life") {
          hero.lives = Math.min(MAX_LIVES, hero.lives + 1);
        } else if (item.itemType === "sub") {
          hero.addSubShip();
        }
        item.dead = true;
      }
    });
  }

  gameObjects = gameObjects.filter((go) => !go.dead);

  // 웨이브 클리어 조건
  if (
    !bossActive &&
    enemiesRemaining === 0 &&
    !gameObjects.some((go) => go.type === "Boss") &&
    enemiesSpawned >= enemiesToSpawn
  ) {
    if (currentMode === "stage" && currentWave < BOSS_WAVE) {
      handleWaveClear();
    } else if (currentMode === "endless") {
      handleWaveClear();
    }
  }
}

function bossExists() {
  return gameObjects.some((go) => go.type === "Boss");
}

// 16. 게임 흐름
function initGame(difficultyKey) {
  if (enemySpawnTimerId) {
    clearTimeout(enemySpawnTimerId);
    enemySpawnTimerId = null;
  }
  enemiesToSpawn = 0;
  enemiesSpawned = 0;
  enemiesRemaining = 0;

  if (hero && hero.stopSubShots) {
    hero.stopSubShots();
  }
  gameObjects = [];
  score = 0;
  difficultyLevel = 1;
  currentDifficultyKey = difficultyKey;
  currentDifficulty = difficultyConfigs[difficultyKey];
  enemyFireChance = currentDifficulty.enemyFireBase;
  currentWave = 1;
  bossActive = false;

  createHero();
  createEnemiesForWave(currentWave);
  showWaveMessage(`WAVE ${currentWave}`, 2000);
}

function handleWaveClear() {
  if (waveTimerId) return;

  if (currentMode === "stage") {
    // STAGE 모드: 3웨이브 클리어 후 보스
    if (currentWave >= BOSS_WAVE - 1) {
      showWaveMessage("BOSS INCOMING!", 2000);
      waveTimerId = setTimeout(() => {
        waveTimerId = null;
        currentWave = BOSS_WAVE;
        spawnBoss();
      }, 2000);
    } else {
      showWaveMessage("WAVE CLEAR!", 1500);
      waveTimerId = setTimeout(() => {
        waveTimerId = null;
        currentWave++;
        difficultyLevel = currentWave;
        enemyFireChance = Math.min(
          currentDifficulty.enemyFireBase + currentWave * 0.005,
          0.08
        );
        createEnemiesForWave(currentWave);
        showWaveMessage(`WAVE ${currentWave}`, 2000);
      }, 1500);
    }
  } else {
    // ENDLESS MODE
    showWaveMessage("WAVE CLEAR!", 1000);
    waveTimerId = setTimeout(() => {
      waveTimerId = null;
      currentWave++;
      difficultyLevel = currentWave;
      enemyFireChance = Math.min(
        currentDifficulty.enemyFireBase + currentWave * 0.007,
        0.12
      );
      createEnemiesForWave(currentWave);
      showWaveMessage(`WAVE ${currentWave}`, 1500);
    }, 1000);
  }
}

// 부드러운 이동 + 대각선 속도 보정
function handleInput() {
  if (!hero || hero.dead) return;
  let dx = 0;
  let dy = 0;
  const speed = hero.moveSpeed || 10;

  if (keys["ArrowLeft"]) dx -= speed;
  if (keys["ArrowRight"]) dx += speed;
  if (keys["ArrowUp"]) dy -= speed;
  if (keys["ArrowDown"]) dy += speed;

  if (dx !== 0 && dy !== 0) {
    const scale = 1 / Math.sqrt(2);
    dx *= scale;
    dy *= scale;
  }

  hero.x += dx;
  hero.y += dy;

  hero.x = Math.max(0, Math.min(canvas.width - hero.width, hero.x));
  hero.y = Math.max(0, Math.min(canvas.height - hero.height, hero.y));
}

function gameLoop() {
  handleInput();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "purple";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  updateAndDrawStars(ctx);
  drawGameObjects(ctx);
  drawUI();
  updateGameObjects();
}

function startGame(difficultyKey, mode = "stage") {
  stopGame();
  currentMode = mode;
  initGame(difficultyKey);
  gameLoopId = setInterval(gameLoop, 100);
}

function stopGame() {
  if (gameLoopId) clearInterval(gameLoopId);
  if (waveTimerId) clearTimeout(waveTimerId);
  if (enemySpawnTimerId) clearTimeout(enemySpawnTimerId);
  gameLoopId = null;
  waveTimerId = null;
  enemySpawnTimerId = null;

  if (hero && hero.stopSubShots) {
    hero.stopSubShots();
  }
}

function showGameOver(isWin = false) {
  stopGame();
  gameOverScreen.style.display = "flex";
  if (isWin) {
    gameOverTitle.textContent = "YOU WIN!";
  } else {
    gameOverTitle.textContent = "GAME OVER";
  }
  finalInfo.textContent = `SCORE: ${score} | WAVE: ${currentWave} | DIFF: ${currentDifficulty.name} | MODE: ${currentMode.toUpperCase()}`;

  if (isWin && currentMode === "stage" && lastRewardGold > 0) {
    rewardInfo.textContent = `클리어 보상: +${lastRewardGold} GOLD`;
  } else {
    rewardInfo.textContent = "";
  }
}

// 17. 이벤트 핸들러
function setupEventHandlers() {
  window.addEventListener("keydown", (evt) => {
    keys[evt.key] = true;
    if (evt.key === " " || evt.key === "Spacebar") {
      eventEmitter.emit(Messages.KEY_EVENT_SPACE);
    }
  });
  window.addEventListener("keyup", (evt) => {
    keys[evt.key] = false;
  });

  eventEmitter.on(Messages.KEY_EVENT_SPACE, () => {
    if (hero && hero.canFire()) hero.fire();
  });

  // 내 레이저 vs 적 (HP 사용)
  eventEmitter.on(Messages.COLLISION_ENEMY_LASER, (_, { first, second }) => {
    first.dead = true;
    if (second.dead) return;

    if (second.hp === undefined) second.hp = 1;

    const atk = hero && hero.attackPower ? hero.attackPower : 1;
    second.hp -= atk;

    const ex = second.x + second.width / 2;
    const ey = second.y + second.height / 2;
    gameObjects.push(new Explosion(ex, ey));

    if (second.hp <= 0) {
      second.dead = true;
      enemiesRemaining = Math.max(0, enemiesRemaining - 1);
      score += 50;

      if (Math.random() < ITEM_DROP_CHANCE) {
        const itemType = Math.random() < 0.5 ? "life" : "sub";
        gameObjects.push(new Item(ex - 12, ey - 12, itemType));
      }
    }
  });

  // 적 레이저 vs 히어로
  eventEmitter.on(Messages.COLLISION_HERO_LASER, (_, { first }) => {
    if (!hero || hero.dead) return;

    if (hero.invincible) {
      first.dead = true;
      return;
    }

    first.dead = true;
    hero.lives--;
    hero.invincible = true;
    hero.invincibleUntil = Date.now() + 1500;

    gameObjects.push(
      new Explosion(
        hero.x + hero.width / 2,
        hero.y + hero.height / 2
      )
    );

    if (hero.lives <= 0) {
      hero.dead = true;
      showGameOver(false);
    }
  });
}

// 18. 기체 선택 UI 관련
function setSelectedShipUI(typeKey) {
  const cards = document.querySelectorAll(".ship-card");
  cards.forEach((card) => {
    if (card.dataset.type === typeKey) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }
  });
  selectedHeroTypeKey = typeKey;
}

// 19. 초기화
window.onload = async () => {
  canvas = document.getElementById("myCanvas");
  ctx = canvas.getContext("2d");

  mainMenu = document.getElementById("mainMenu");
  modeScreen = document.getElementById("modeScreen");
  difficultyScreen = document.getElementById("difficultyScreen");
  shipScreen = document.getElementById("shipScreen");
  gameOverScreen = document.getElementById("gameOverScreen");

  startBtn = document.getElementById("startBtn");
  shopBtn = document.getElementById("shopBtn");
  loadingText = document.getElementById("loadingText");

  modeStageBtn = document.getElementById("modeStageBtn");
  modeEndlessBtn = document.getElementById("modeEndlessBtn");
  modeBackBtn = document.getElementById("modeBackBtn");

  easyBtn = document.getElementById("easyBtn");
  normalBtn = document.getElementById("normalBtn");
  hardBtn = document.getElementById("hardBtn");
  backToMenuBtn = document.getElementById("backToMenuBtn");

  shipBackBtn = document.getElementById("shipBackBtn");
  restartBtn = document.getElementById("restartBtn");

  gameOverTitle = document.getElementById("gameOverTitle");
  finalInfo = document.getElementById("finalInfo");
  rewardInfo = document.getElementById("rewardInfo");

  goldMainSpan = document.getElementById("goldMain");
  goldShopSpan = document.getElementById("goldShop");

  upMoveLevelSpan = document.getElementById("upMoveLevel");
  upFireLevelSpan = document.getElementById("upFireLevel");
  upAttackLevelSpan = document.getElementById("upAttackLevel");

  upMoveBtn = document.getElementById("upMoveBtn");
  upFireBtn = document.getElementById("upFireBtn");
  upAttackBtn = document.getElementById("upAttackBtn");
  upgradeMsgEl = document.getElementById("upgradeMsg");

  [
    heroImgBasic,
    heroImgSpeed,
    heroImgSpread,
    enemyImgNormal,
    enemyImgZigzag,
    enemyImgDash,
    bossImg
  ] = await Promise.all([
    loadTexture("assets/기체1.png"),
    loadTexture("assets/기체2.png"),
    loadTexture("assets/기체3.png"),
    loadTexture("assets/적기체1.png"),
    loadTexture("assets/적기체2.png"),
    loadTexture("assets/적기체3.png"),
    loadTexture("assets/보스기체.png")
  ]);

  heroImgBasic  = makeBlackTransparent(heroImgBasic);
  heroImgSpeed  = makeBlackTransparent(heroImgSpeed);
  heroImgSpread = makeBlackTransparent(heroImgSpread);
  enemyImgNormal  = makeBlackTransparent(enemyImgNormal);
  enemyImgZigzag  = makeBlackTransparent(enemyImgZigzag);
  enemyImgDash    = makeBlackTransparent(enemyImgDash);
  bossImg = makeBlackTransparent(bossImg);

  const previewBasic  = document.querySelector("#ship-basic  .ship-preview img");
  const previewSpeed  = document.querySelector("#ship-speed  .ship-preview img");
  const previewSpread = document.querySelector("#ship-spread .ship-preview img");
  if (previewBasic)  previewBasic.src  = heroImgBasic.toDataURL();
  if (previewSpeed)  previewSpeed.src  = heroImgSpeed.toDataURL();
  if (previewSpread) previewSpread.src = heroImgSpread.toDataURL();

  loadPlayerData();
  setupEventHandlers();
  initStars(120);
  refreshGoldUI();

  startBtn.disabled = false;
  shopBtn.disabled = false;
  if (loadingText) loadingText.textContent = "";

  // 메인 메뉴 → 모드 선택
  startBtn.addEventListener("click", () => {
    mainMenu.style.display = "none";
    modeScreen.style.display = "flex";
  });

  // 메인 메뉴 → 기체 선택/상점
  shopBtn.addEventListener("click", () => {
    mainMenu.style.display = "none";
    shipScreen.style.display = "flex";
    refreshGoldUI();
  });

  // 모드 선택 화면
  modeStageBtn.addEventListener("click", () => {
    pendingMode = "stage";
    modeScreen.style.display = "none";
    difficultyScreen.style.display = "flex";
  });
  modeEndlessBtn.addEventListener("click", () => {
    pendingMode = "endless";
    modeScreen.style.display = "none";
    difficultyScreen.style.display = "flex";
  });
  modeBackBtn.addEventListener("click", () => {
    modeScreen.style.display = "none";
    mainMenu.style.display = "flex";
  });

  // 기체 선택 버튼들
  const shipButtons = document.querySelectorAll(".select-ship-btn");
  shipButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const typeKey = btn.dataset.type;
      setSelectedShipUI(typeKey);
    });
  });

  // 업그레이드 버튼
  upMoveBtn.addEventListener("click", () => buyUpgrade("moveSpeed"));
  upFireBtn.addEventListener("click", () => buyUpgrade("fireRate"));
  upAttackBtn.addEventListener("click", () => buyUpgrade("attackPower"));

  // 초기 선택은 기본형
  setSelectedShipUI("basic");

  // 상점에서 BACK → 메인 메뉴
  shipBackBtn.addEventListener("click", () => {
    shipScreen.style.display = "none";
    mainMenu.style.display = "flex";
    refreshGoldUI();
  });

  // 난이도 선택 → 게임 시작 (현재 선택된 모드로)
  easyBtn.addEventListener("click", () => {
    difficultyScreen.style.display = "none";
    gameOverScreen.style.display = "none";
    startGame("easy", pendingMode);
  });
  normalBtn.addEventListener("click", () => {
    difficultyScreen.style.display = "none";
    gameOverScreen.style.display = "none";
    startGame("normal", pendingMode);
  });
  hardBtn.addEventListener("click", () => {
    difficultyScreen.style.display = "none";
    gameOverScreen.style.display = "none";
    startGame("hard", pendingMode);
  });

  // 난이도 화면에서 BACK → 모드 선택
  backToMenuBtn.addEventListener("click", () => {
    difficultyScreen.style.display = "none";
    modeScreen.style.display = "flex";
  });

  // 게임 오버 화면 → 메인 메뉴
  restartBtn.addEventListener("click", () => {
    gameOverScreen.style.display = "none";
    mainMenu.style.display = "flex";
    refreshGoldUI();
  });
};
