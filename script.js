const BOARD_SIZE = 10;
const SPELL_COOLDOWN = 2800;
const SPELL_RADIUS = 1.65;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const randomInt = (max) => Math.floor(Math.random() * max);

class Rabbit {
  constructor(game, id, x, y, kind = "normal") {
    this.game = game;
    this.id = id;
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.held = false;
    this.nextMoveAt = performance.now() + 450 + Math.random() * 650;
    this.nextShotAt = performance.now() + 3200 + Math.random() * 1400;
    this.node = document.createElement("div");
    this.node.className = "entity rabbit";
    this.node.dataset.id = id;
    this.node.innerHTML = '<img src="assets/rabbit.png" alt="Coelho">';
    this.node.addEventListener("pointerdown", (event) => this.game.beginCapture(event, this));
    game.entityLayer.appendChild(this.node);
    this.setKind(kind);
    this.render();
  }

  setKind(kind) {
    this.kind = kind;
    this.node.classList.toggle("rabbit--powered", kind === "powered");
    this.node.querySelector("img").alt = kind === "powered" ? "Coelho fortalecido por magia" : "Coelho comum";
  }

  render() {
    this.node.style.setProperty("--x", this.x);
    this.node.style.setProperty("--y", this.y);
  }

  update(now) {
    if (this.held || now < this.nextMoveAt) return;
    this.nextMoveAt = now + 620 + Math.random() * 700;
    this.game.moveRabbit(this);

    if (this.kind === "powered" && now >= this.nextShotAt) {
      this.nextShotAt = now + Math.max(1850, 3900 - this.game.level * 120) + Math.random() * 800;
      this.game.fireEnemyShot(this);
    }
  }

  destroy() {
    this.node.remove();
  }
}

class RabbitChaos {
  constructor() {
    this.board = document.getElementById("board");
    this.entityLayer = document.getElementById("entity-layer");
    this.fxLayer = document.getElementById("fx-layer");
    this.overlay = document.getElementById("overlay");
    this.overlayTitle = document.getElementById("overlay-title");
    this.overlayText = document.getElementById("overlay-text");
    this.primaryButton = document.getElementById("primary-button");
    this.hatDrop = document.getElementById("hat-drop");
    this.magician = document.getElementById("magician-wrap");
    this.cursor = document.getElementById("magic-cursor");
    this.toastNode = document.getElementById("toast");
    this.roundBanner = document.getElementById("round-banner");
    this.boardHint = document.getElementById("board-hint");
    this.hud = {
      level: document.getElementById("level-value"),
      rabbits: document.getElementById("rabbit-value"),
      captured: document.getElementById("captured-value"),
      life: document.getElementById("life-value"),
      spellLabel: document.getElementById("spell-label"),
      spellFill: document.getElementById("spell-fill"),
      hatCount: document.getElementById("hat-count")
    };

    this.state = "menu";
    this.level = 1;
    this.lives = 3;
    this.captured = 0;
    this.totalCaptured = 0;
    this.rabbits = [];
    this.dens = [];
    this.fruits = [];
    this.enemyShots = [];
    this.draggedRabbit = null;
    this.spellReadyAt = 0;
    this.nextFruitAt = Infinity;
    this.roundToken = 0;
    this.lastFrame = performance.now();
    this.entityId = 0;
    this.toastTimer = null;

    this.primaryButton.addEventListener("click", () => this.handlePrimaryButton());
    this.board.addEventListener("contextmenu", (event) => this.castSpell(event));
    document.addEventListener("pointermove", (event) => this.handlePointerMove(event));
    document.addEventListener("pointerup", (event) => this.finishCapture(event));
    document.addEventListener("pointercancel", (event) => this.finishCapture(event));
    window.addEventListener("blur", () => this.cancelCapture());
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") this.cancelCapture();
    });

    requestAnimationFrame((now) => this.loop(now));
    this.updateHud(performance.now());
  }

  handlePrimaryButton() {
    if (this.state === "menu" || this.state === "game-over") {
      this.level = 1;
      this.totalCaptured = 0;
      this.startLevel();
      return;
    }
    if (this.state === "level-clear") {
      this.level += 1;
      this.startLevel();
    }
  }

  startLevel() {
    this.roundToken += 1;
    const token = this.roundToken;
    this.clearBoard();
    this.state = "intro";
    this.lives = 3;
    this.captured = 0;
    this.spellReadyAt = 0;
    this.nextFruitAt = performance.now() + 6500;
    this.overlay.classList.add("is-hidden");
    this.boardHint.classList.remove("is-hidden");

    const normalCount = Math.min(5 + (this.level - 1) * 2, 15);
    const denCount = Math.min(1 + Math.floor((this.level - 1) / 2), 3);
    const fruitCount = Math.min(1 + Math.floor(this.level / 2), 3);

    for (let i = 0; i < normalCount; i += 1) this.spawnRabbit("normal");
    for (let i = 0; i < denCount; i += 1) this.spawnDen();
    for (let i = 0; i < fruitCount; i += 1) this.spawnFruit();

    this.magician.classList.remove("is-hit");
    void this.magician.offsetWidth;
    this.magician.classList.add("is-conjuring");
    this.roundBanner.innerHTML = `<small>O espetáculo continua</small>Ato ${this.level}`;
    this.roundBanner.classList.remove("is-visible");
    void this.roundBanner.offsetWidth;
    this.roundBanner.classList.add("is-visible");
    this.updateHud(performance.now());

    window.setTimeout(() => {
      if (this.roundToken !== token) return;
      this.magician.classList.remove("is-conjuring");
      this.state = "running";
      this.toast("A mão mágica está sob seu controle!");
    }, 1250);
  }

  clearBoard() {
    this.cancelCapture();
    this.rabbits.forEach((rabbit) => rabbit.destroy());
    [...this.dens, ...this.fruits, ...this.enemyShots].forEach((entity) => entity.node.remove());
    this.rabbits = [];
    this.dens = [];
    this.fruits = [];
    this.enemyShots = [];
    this.fxLayer.innerHTML = "";
  }

  freeCell() {
    const occupied = new Set([
      ...this.rabbits.map((rabbit) => `${rabbit.x},${rabbit.y}`),
      ...this.dens.map((den) => `${den.x},${den.y}`),
      ...this.fruits.map((fruit) => `${fruit.x},${fruit.y}`)
    ]);
    const options = [];
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        if (!occupied.has(`${x},${y}`)) options.push({ x, y });
      }
    }
    return options[randomInt(options.length)] || { x: randomInt(BOARD_SIZE), y: randomInt(BOARD_SIZE) };
  }

  spawnRabbit(kind = "normal", near = null) {
    let position = this.freeCell();
    if (near) {
      const candidates = [
        { x: near.x - 1, y: near.y }, { x: near.x + 1, y: near.y },
        { x: near.x, y: near.y - 1 }, { x: near.x, y: near.y + 1 }
      ].filter((cell) => this.isCellFree(cell.x, cell.y));
      if (candidates.length) position = candidates[randomInt(candidates.length)];
    }
    const rabbit = new Rabbit(this, `rabbit-${this.entityId += 1}`, position.x, position.y, kind);
    this.rabbits.push(rabbit);
    return rabbit;
  }

  spawnDen() {
    const position = this.freeCell();
    const node = document.createElement("div");
    node.className = "entity den";
    node.style.setProperty("--x", position.x);
    node.style.setProperty("--y", position.y);
    node.innerHTML = '<img src="assets/loveden.png" alt="Toca de reprodução">';
    this.entityLayer.appendChild(node);
    this.dens.push({ ...position, node, readyAt: performance.now() + 6500 + Math.random() * 2500 });
  }

  spawnFruit() {
    if (this.fruits.length >= 3) return;
    const position = this.freeCell();
    const node = document.createElement("div");
    node.className = "entity fruit";
    node.style.setProperty("--x", position.x);
    node.style.setProperty("--y", position.y);
    node.innerHTML = '<span class="fruit__berry" aria-label="Fruta mágica"></span>';
    this.entityLayer.appendChild(node);
    this.fruits.push({ ...position, node });
  }

  isCellFree(x, y, ignoredRabbit = null) {
    if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return false;
    return !this.rabbits.some((rabbit) => rabbit !== ignoredRabbit && !rabbit.held && rabbit.x === x && rabbit.y === y);
  }

  moveRabbit(rabbit) {
    const directions = [
      { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }
    ];
    let choices = directions
      .map((direction) => ({ x: rabbit.x + direction.x, y: rabbit.y + direction.y }))
      .filter((cell) => this.isCellFree(cell.x, cell.y, rabbit));

    if (!choices.length) return;
    if (rabbit.kind === "normal" && this.fruits.length) {
      const closestFruit = [...this.fruits].sort((a, b) => distance(rabbit, a) - distance(rabbit, b))[0];
      choices.sort((a, b) => distance(a, closestFruit) - distance(b, closestFruit));
      if (Math.random() < .72) choices = choices.slice(0, 1);
    }
    const destination = choices[randomInt(choices.length)];
    rabbit.x = destination.x;
    rabbit.y = destination.y;
    rabbit.render();

    const fruit = this.fruits.find((item) => item.x === rabbit.x && item.y === rabbit.y);
    if (fruit && rabbit.kind === "normal") {
      this.removeFruit(fruit);
      rabbit.setKind("powered");
      rabbit.node.classList.add("rabbit--hurt");
      window.setTimeout(() => rabbit.node.classList.remove("rabbit--hurt"), 750);
      this.toast("Um coelho roubou uma fruta e ficou perigoso!");
      this.updateHud(performance.now());
    }
  }

  updateEnvironment(now) {
    for (const den of this.dens) {
      if (now < den.readyAt) continue;
      const nearbyNormal = this.rabbits.some((rabbit) => rabbit.kind === "normal" && distance(rabbit, den) <= 2.4);
      if (nearbyNormal && this.rabbits.length < 20) {
        this.spawnRabbit("normal", den);
        den.readyAt = now + Math.max(4200, 7200 - this.level * 280);
        den.node.classList.add("rabbit--hurt");
        window.setTimeout(() => den.node.classList.remove("rabbit--hurt"), 700);
        this.toast("A toca trouxe um novo coelho para o palco!");
      } else {
        den.readyAt = now + 1400;
      }
    }

    if (now >= this.nextFruitAt) {
      this.spawnFruit();
      this.nextFruitAt = now + Math.max(4800, 7600 - this.level * 250);
    }
  }

  beginCapture(event, rabbit) {
    if (this.state !== "running" || rabbit.kind !== "normal" || this.draggedRabbit) return;
    event.preventDefault();
    this.draggedRabbit = rabbit;
    rabbit.held = true;
    rabbit.node.classList.add("rabbit--held");
    document.body.appendChild(rabbit.node);
    this.cursor.classList.add("is-grabbing");
    this.boardHint.classList.add("is-hidden");
    this.positionDraggedRabbit(event.clientX, event.clientY);
  }

  handlePointerMove(event) {
    this.cursor.style.left = `${event.clientX}px`;
    this.cursor.style.top = `${event.clientY}px`;
    if (!this.draggedRabbit) return;
    this.positionDraggedRabbit(event.clientX, event.clientY);
    const hatRect = this.hatDrop.getBoundingClientRect();
    const overHat = event.clientX >= hatRect.left && event.clientX <= hatRect.right && event.clientY >= hatRect.top && event.clientY <= hatRect.bottom;
    this.hatDrop.classList.toggle("is-ready", overHat);
  }

  positionDraggedRabbit(x, y) {
    if (!this.draggedRabbit) return;
    this.draggedRabbit.node.style.left = `${x}px`;
    this.draggedRabbit.node.style.top = `${y}px`;
  }

  finishCapture(event) {
    if (!this.draggedRabbit) return;
    const rabbit = this.draggedRabbit;
    const hatRect = this.hatDrop.getBoundingClientRect();
    const overHat = event.clientX >= hatRect.left && event.clientX <= hatRect.right && event.clientY >= hatRect.top && event.clientY <= hatRect.bottom;
    this.draggedRabbit = null;
    this.cursor.classList.remove("is-grabbing");
    this.hatDrop.classList.remove("is-ready");

    if (overHat && this.state === "running") {
      rabbit.node.style.left = `${hatRect.left + hatRect.width / 2}px`;
      rabbit.node.style.top = `${hatRect.top + hatRect.height / 2}px`;
      rabbit.node.classList.add("rabbit--captured");
      this.rabbits = this.rabbits.filter((item) => item !== rabbit);
      this.captured += 1;
      this.totalCaptured += 1;
      this.hatDrop.classList.remove("is-fed");
      void this.hatDrop.offsetWidth;
      this.hatDrop.classList.add("is-fed");
      window.setTimeout(() => rabbit.destroy(), 220);
      this.updateHud(performance.now());
      this.checkRoundComplete();
      return;
    }

    rabbit.held = false;
    rabbit.node.classList.remove("rabbit--held");
    this.entityLayer.appendChild(rabbit.node);
    rabbit.node.style.left = "";
    rabbit.node.style.top = "";
    rabbit.render();
  }

  cancelCapture() {
    if (!this.draggedRabbit) return;
    const rabbit = this.draggedRabbit;
    this.draggedRabbit = null;
    rabbit.held = false;
    rabbit.node.classList.remove("rabbit--held");
    this.entityLayer.appendChild(rabbit.node);
    rabbit.node.style.left = "";
    rabbit.node.style.top = "";
    rabbit.render();
    this.cursor.classList.remove("is-grabbing");
    this.hatDrop.classList.remove("is-ready");
  }

  castSpell(event) {
    event.preventDefault();
    if (this.state !== "running") return;
    const now = performance.now();
    if (now < this.spellReadyAt) {
      this.toast("A mão mágica ainda está recuperando energia.");
      return;
    }

    const rect = this.board.getBoundingClientRect();
    const target = {
      x: clamp((event.clientX - rect.left) / rect.width * BOARD_SIZE, 0, BOARD_SIZE - .01),
      y: clamp((event.clientY - rect.top) / rect.height * BOARD_SIZE, 0, BOARD_SIZE - .01)
    };
    this.spellReadyAt = now + SPELL_COOLDOWN;
    this.cursor.classList.add("is-casting", "is-cooling");
    window.setTimeout(() => this.cursor.classList.remove("is-casting"), 330);
    this.createSpellEffects(event.clientX, event.clientY, target);

    const inRange = (entity) => distance(entity, target) <= SPELL_RADIUS;
    const normalInRange = this.rabbits.some((rabbit) => rabbit.kind === "normal" && inRange(rabbit));
    const poweredTargets = this.rabbits.filter((rabbit) => rabbit.kind === "powered" && inRange(rabbit));
    const denTargets = this.dens.filter(inRange);
    const fruitTargets = this.fruits.filter(inRange);
    const shotTargets = this.enemyShots.filter(inRange);
    const hitCount = poweredTargets.length + denTargets.length + fruitTargets.length + shotTargets.length;

    poweredTargets.forEach((rabbit) => this.destroyRabbit(rabbit));
    denTargets.forEach((den) => this.removeDen(den));
    fruitTargets.forEach((fruit) => this.removeFruit(fruit));
    shotTargets.forEach((shot) => this.removeEnemyShot(shot));

    if (!hitCount && normalInRange) this.toast("Coelhos comuns fazem parte do show: use a cartola!");
    else if (!hitCount) this.toast("A magia atingiu apenas o gramado.");
    else this.toast(hitCount === 1 ? "Ameaça removida!" : `${hitCount} ameaças removidas!`);
    this.updateHud(now);
    this.checkRoundComplete();
  }

  createSpellEffects(clientX, clientY, target) {
    const burst = document.createElement("div");
    burst.className = "spell-burst";
    burst.style.left = `${target.x / BOARD_SIZE * 100}%`;
    burst.style.top = `${target.y / BOARD_SIZE * 100}%`;
    this.fxLayer.appendChild(burst);

    const magicianRect = document.getElementById("magician").getBoundingClientRect();
    const startX = magicianRect.left + magicianRect.width * .36;
    const startY = magicianRect.top + magicianRect.height * .42;
    const beam = document.createElement("div");
    const dx = clientX - startX;
    const dy = clientY - startY;
    beam.className = "spell-beam";
    beam.style.left = `${startX}px`;
    beam.style.top = `${startY}px`;
    beam.style.width = `${Math.hypot(dx, dy)}px`;
    beam.style.setProperty("--angle", `${Math.atan2(dy, dx)}rad`);
    document.body.appendChild(beam);
    window.setTimeout(() => { burst.remove(); beam.remove(); }, 520);
  }

  destroyRabbit(rabbit) {
    this.createPoof({ x: rabbit.x + .5, y: rabbit.y + .5 });
    this.rabbits = this.rabbits.filter((item) => item !== rabbit);
    rabbit.destroy();
  }

  removeDen(den) {
    this.createPoof({ x: den.x + .5, y: den.y + .5 });
    den.node.remove();
    this.dens = this.dens.filter((item) => item !== den);
  }

  removeFruit(fruit) {
    fruit.node.remove();
    this.fruits = this.fruits.filter((item) => item !== fruit);
  }

  createPoof(position) {
    const poof = document.createElement("div");
    poof.className = "poof";
    poof.textContent = "✦";
    poof.style.left = `${position.x / BOARD_SIZE * 100}%`;
    poof.style.top = `${position.y / BOARD_SIZE * 100}%`;
    this.fxLayer.appendChild(poof);
    window.setTimeout(() => poof.remove(), 600);
  }

  fireEnemyShot(rabbit) {
    if (this.state !== "running") return;
    const shot = {
      x: rabbit.x + .5,
      y: rabbit.y + .5,
      vx: 0,
      vy: 0,
      node: document.createElement("div")
    };
    const target = { x: 5, y: 11 };
    const length = Math.hypot(target.x - shot.x, target.y - shot.y);
    const speed = 2.65 + this.level * .12;
    shot.vx = (target.x - shot.x) / length * speed;
    shot.vy = (target.y - shot.y) / length * speed;
    shot.node.className = "entity enemy-shot";
    shot.node.innerHTML = '<span class="enemy-shot__carrot"></span>';
    this.entityLayer.appendChild(shot.node);
    this.enemyShots.push(shot);
    this.renderShot(shot);
  }

  renderShot(shot) {
    shot.node.style.left = `${shot.x / BOARD_SIZE * 100}%`;
    shot.node.style.top = `${shot.y / BOARD_SIZE * 100}%`;
  }

  updateEnemyShots(delta) {
    for (const shot of [...this.enemyShots]) {
      shot.x += shot.vx * delta;
      shot.y += shot.vy * delta;
      this.renderShot(shot);
      if (shot.y >= 10.1) {
        this.removeEnemyShot(shot);
        this.takeDamage();
      } else if (shot.x < -.5 || shot.x > 10.5 || shot.y < -.5) {
        this.removeEnemyShot(shot);
      }
    }
  }

  removeEnemyShot(shot) {
    shot.node.remove();
    this.enemyShots = this.enemyShots.filter((item) => item !== shot);
  }

  takeDamage() {
    if (this.state !== "running") return;
    this.lives -= 1;
    this.magician.classList.remove("is-hit");
    void this.magician.offsetWidth;
    this.magician.classList.add("is-hit");
    this.toast("O mago foi atingido!");
    this.updateHud(performance.now());
    if (this.lives <= 0) this.gameOver();
  }

  checkRoundComplete() {
    if (this.state !== "running" || this.rabbits.length > 0) return;
    this.state = "level-clear";
    this.enemyShots.forEach((shot) => shot.node.remove());
    this.enemyShots = [];
    this.overlayTitle.textContent = `Ato ${this.level} completo!`;
    this.overlayText.textContent = `${this.captured} coelho${this.captured === 1 ? "" : "s"} na cartola. A plateia quer um truque ainda maior.`;
    this.primaryButton.textContent = "Próximo ato";
    window.setTimeout(() => this.overlay.classList.remove("is-hidden"), 480);
  }

  gameOver() {
    this.state = "game-over";
    this.cancelCapture();
    this.overlayTitle.textContent = "As cortinas se fecharam";
    this.overlayText.textContent = `Você chegou ao ato ${this.level} e guardou ${this.totalCaptured} coelho${this.totalCaptured === 1 ? "" : "s"} na cartola.`;
    this.primaryButton.textContent = "Tentar outra vez";
    window.setTimeout(() => this.overlay.classList.remove("is-hidden"), 350);
  }

  updateHud(now) {
    const remaining = Math.max(0, this.spellReadyAt - now);
    const progress = 1 - remaining / SPELL_COOLDOWN;
    this.hud.level.textContent = this.level;
    this.hud.rabbits.textContent = this.rabbits.length;
    this.hud.captured.textContent = this.captured;
    this.hud.hatCount.textContent = this.captured;
    this.hud.life.textContent = this.lives > 0 ? Array(this.lives).fill("♥").join(" ") : "—";
    this.hud.life.setAttribute("aria-label", `${this.lives} vidas`);
    this.hud.spellFill.style.width = `${clamp(progress, 0, 1) * 100}%`;
    this.hud.spellLabel.textContent = remaining > 0 ? `${(remaining / 1000).toFixed(1)}s` : "PRONTA";
    this.cursor.classList.toggle("is-cooling", remaining > 0);
  }

  toast(message) {
    window.clearTimeout(this.toastTimer);
    this.toastNode.textContent = message;
    this.toastNode.classList.add("is-visible");
    this.toastTimer = window.setTimeout(() => this.toastNode.classList.remove("is-visible"), 1900);
  }

  loop(now) {
    const delta = Math.min((now - this.lastFrame) / 1000, .05);
    this.lastFrame = now;
    if (this.state === "running") {
      this.rabbits.forEach((rabbit) => rabbit.update(now));
      this.updateEnvironment(now);
      this.updateEnemyShots(delta);
    }
    this.updateHud(now);
    requestAnimationFrame((nextNow) => this.loop(nextNow));
  }
}

new RabbitChaos();
