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
  KEY_EVENT_UP: "KEY_EVENT_UP",
  KEY_EVENT_DOWN: "KEY_EVENT_DOWN",
  KEY_EVENT_LEFT: "KEY_EVENT_LEFT",
  KEY_EVENT_RIGHT: "KEY_EVENT_RIGHT",
  KEY_EVENT_SPACE: "KEY_EVENT_SPACE",
  COLLISION_ENEMY_LASER: "COLLISION_ENEMY_LASER"
};

const HERO_MOVE_SPEED = 15;

// 3. 전역 변수
let canvas, ctx;
let heroImg, enemyImg;
let hero;
let gameObjects = [];
let eventEmitter = new EventEmitter();

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

  rectFromGameObject() {
    return {
      top: this.y,
      left: this.x,
      bottom: this.y + this.height,
      right: this.x + this.width
    };
  }
}

// 5. 플레이어 클래스
class Hero extends GameObject {
  constructor(x, y) {
    super(x, y);
    this.width = 99;
    this.height = 75;
    this.type = "Hero";
    this.cooldown = 0;

    this.subOffset = [
      { dx: -60, dy: 30 },
      { dx: this.width + 20, dy: 30 }
    ];

    this.subOffset.forEach((offset) => {
      setInterval(() => {
        const subW = this.width * 0.6;
        const lx = this.x + offset.dx + (subW / 2) - 2;
        const ly = this.y + offset.dy;
        gameObjects.push(new Laser(lx, ly));
      }, 1000);
    });
  }

  fire() {
    if (this.canFire()) {
      gameObjects.push(new Laser(this.x + this.width / 2 - 2, this.y - 10));
      this.cooldown = 500;
      let id = setInterval(() => {
        this.cooldown -= 100;
        if (this.cooldown <= 0) clearInterval(id);
      }, 100);
    }
  }

  canFire() {
    return this.cooldown === 0;
  }

  draw(ctx) {
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

// 6. 적 클래스
class Enemy extends GameObject {
  constructor(x, y) {
    super(x, y);
    this.width = 98;
    this.height = 50;
    this.type = "Enemy";

    let id = setInterval(() => {
      if (this.y < canvas.height - this.height) {
        this.y += 5;
      } else {
        clearInterval(id);
      }
    }, 300);
  }
}

// 7. 레이저 클래스
class Laser extends GameObject {
  constructor(x, y) {
    super(x, y);
    this.width = 4;
    this.height = 20;
    this.type = 'Laser';
    this.color = 'red';

    let id = setInterval(() => {
      if (this.y > 0) {
        this.y -= 15;
      } else {
        this.dead = true;
        clearInterval(id);
      }
    }, 100);
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

// 8. 폭발 클래스
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

// 9. 유틸 함수
function loadTexture(path) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = path;
    img.onload = () => resolve(img);
  });
}

function intersectRect(r1, r2) {
  return !(
    r2.left > r1.right ||
    r2.right < r1.left ||
    r2.top > r1.bottom ||
    r2.bottom < r1.top
  );
}

function drawStars(ctx, canvas, count) {
  const colors = ["white", "#e0e0ff", "#ccccff"];
  for (let i = 0; i < count; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const radius = Math.random() * 1.5 + 0.5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.fill();
  }
}

function createHero() {
  hero = new Hero(canvas.width / 2 - 45, canvas.height - canvas.height / 4);
  hero.img = heroImg;
  gameObjects.push(hero);
}

function createEnemies() {
  const MONSTER_TOTAL = 5;
  const MONSTER_WIDTH = MONSTER_TOTAL * 98;
  const START_X = (canvas.width - MONSTER_WIDTH) / 2;
  const STOP_X = START_X + MONSTER_WIDTH;
  for (let x = START_X; x < STOP_X; x += 98) {
    for (let y = 0; y < 50 * 5; y += 50) {
      const enemy = new Enemy(x, y);
      enemy.img = enemyImg;
      gameObjects.push(enemy);
    }
  }
}

function drawGameObjects(ctx) {
  gameObjects.forEach((go) => go.draw(ctx));
}

function updateGameObjects() {
  const enemies = gameObjects.filter((go) => go.type === "Enemy");
  const lasers = gameObjects.filter((go) => go.type === "Laser");

  lasers.forEach((l) => {
    enemies.forEach((e) => {
      if (intersectRect(l.rectFromGameObject(), e.rectFromGameObject())) {
        eventEmitter.emit(Messages.COLLISION_ENEMY_LASER, { first: l, second: e });
      }
    });
  });

  gameObjects = gameObjects.filter((go) => !go.dead);
}

function initGame() {
  gameObjects = [];
  createEnemies();
  createHero();

  eventEmitter.on(Messages.KEY_EVENT_LEFT, () => {
    hero.x = Math.max(0, hero.x - HERO_MOVE_SPEED);
  });
  eventEmitter.on(Messages.KEY_EVENT_RIGHT, () => {
    hero.x = Math.min(canvas.width - hero.width, hero.x + HERO_MOVE_SPEED);
  });
  eventEmitter.on(Messages.KEY_EVENT_UP, () => {
    hero.y = Math.max(0, hero.y - HERO_MOVE_SPEED);
  });
  eventEmitter.on(Messages.KEY_EVENT_DOWN, () => {
    hero.y = Math.min(canvas.height - hero.height, hero.y + HERO_MOVE_SPEED);
  });
  eventEmitter.on(Messages.KEY_EVENT_SPACE, () => {
    if (hero.canFire()) hero.fire();
  });

  eventEmitter.on(Messages.COLLISION_ENEMY_LASER, (_, { first, second }) => {
    first.dead = true;
    second.dead = true;
    const ex = second.x + second.width / 2;
    const ey = second.y + second.height / 2;
    gameObjects.push(new Explosion(ex, ey));
  });
}

window.onload = async () => {
  canvas = document.getElementById("myCanvas");
  ctx = canvas.getContext("2d");

  heroImg = await loadTexture("assets/player.png");
  enemyImg = await loadTexture("assets/enemyShip.png");

  initGame();

  window.addEventListener("keyup", (evt) => {
    switch (evt.key) {
      case "ArrowUp": eventEmitter.emit(Messages.KEY_EVENT_UP); break;
      case "ArrowDown": eventEmitter.emit(Messages.KEY_EVENT_DOWN); break;
      case "ArrowLeft": eventEmitter.emit(Messages.KEY_EVENT_LEFT); break;
      case "ArrowRight": eventEmitter.emit(Messages.KEY_EVENT_RIGHT); break;
    }
    if (evt.keyCode === 32) {
      eventEmitter.emit(Messages.KEY_EVENT_SPACE);
    }
  });

  setInterval(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "purple";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawStars(ctx, canvas, 100);
    drawGameObjects(ctx);
    updateGameObjects();
  }, 100);
};
