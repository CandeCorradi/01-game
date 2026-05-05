const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const soundToggle = document.getElementById("soundToggle");

const state = {
  running: false,
  time: 0,
  score: 0,
  best: Number(localStorage.getItem("neonDashBest") || 0),
  speed: 3.6,
  gravity: 0.42,
  jumpPower: 8.2,
  dashPower: 9.4,
  dashAvailable: true,
  lastSpawn: 0,
  spawnGap: 1150,
  shake: 0,
  sound: false,
};

bestEl.textContent = state.best;

const player = {
  x: 120,
  y: 0,
  w: 22,
  h: 22,
  vy: 0,
  onGround: false,
};

const floorY = canvas.height - 48;
const obstacles = [];
const particles = [];

let audioCtx = null;

function createAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function beep(freq, duration, type = "sine") {
  if (!state.sound || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = 0.06;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  osc.stop(audioCtx.currentTime + duration);
}

function thump() {
  if (!state.sound || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.value = 70;
  gain.gain.value = 0.08;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.18);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
  osc.stop(audioCtx.currentTime + 0.2);
}

function spawnObstacle() {
  const height = 22 + Math.random() * 28;
  const width = 18 + Math.random() * 18;
  obstacles.push({
    x: canvas.width + width,
    y: floorY - height,
    w: width,
    h: height,
    scored: false,
  });
}

function addParticle(x, y, color, count = 8) {
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.7) * 3.2,
      life: 26 + Math.random() * 18,
      color,
    });
  }
}

function reset() {
  state.time = 0;
  state.score = 0;
  state.speed = 3.6;
  state.spawnGap = 1150;
  state.lastSpawn = 0;
  state.shake = 0;
  player.y = floorY - player.h;
  player.vy = 0;
  player.onGround = true;
  state.dashAvailable = true;
  obstacles.length = 0;
  particles.length = 0;
  scoreEl.textContent = 0;
}

function start() {
  reset();
  overlay.classList.add("hidden");
  state.running = true;
  createAudio();
  if (state.sound && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function end() {
  state.running = false;
  overlay.classList.remove("hidden");
  overlay.querySelector(".panel").innerHTML = `
    <h1>Tablero de Neón</h1>
    <p>Puntaje: <strong>${state.score}</strong></p>
    <p>Mejor: <strong>${state.best}</strong></p>
    <p class="hint">Presiona Espacio / Click / Toque para reiniciar</p>
  `;
}

function jumpOrDash() {
  if (!state.running) {
    start();
    return;
  }

  if (player.onGround) {
    player.vy = -state.jumpPower;
    player.onGround = false;
    state.dashAvailable = true;
    addParticle(player.x + player.w / 2, player.y + player.h, "rgba(84,247,255,0.8)", 10);
    beep(520, 0.12, "square");
  } else if (state.dashAvailable) {
    player.vy = -state.dashPower;
    state.dashAvailable = false;
    addParticle(player.x + player.w / 2, player.y + player.h / 2, "rgba(255,77,216,0.9)", 14);
    beep(880, 0.1, "sawtooth");
  }
}

function update(delta) {
  state.time += delta;
  state.speed = 3.6 + Math.min(5, state.time / 15000) * 1.2;
  state.spawnGap = Math.max(620, 1150 - state.time / 25);

  player.vy += state.gravity;
  player.y += player.vy;
  if (player.y + player.h >= floorY) {
    player.y = floorY - player.h;
    player.vy = 0;
    player.onGround = true;
    state.dashAvailable = true;
  }

  if (state.time - state.lastSpawn > state.spawnGap) {
    spawnObstacle();
    state.lastSpawn = state.time;
  }

  obstacles.forEach((obs) => {
    obs.x -= state.speed;
    if (!obs.scored && obs.x + obs.w < player.x) {
      obs.scored = true;
      state.score += 1;
      scoreEl.textContent = state.score;
      addParticle(player.x + player.w, player.y + player.h / 2, "rgba(84,247,255,0.8)", 6);
      beep(660, 0.08, "sine");
      if (state.score > state.best) {
        state.best = state.score;
        bestEl.textContent = state.best;
        localStorage.setItem("neonDashBest", state.best);
      }
    }
  });

  while (obstacles.length && obstacles[0].x + obstacles[0].w < -40) {
    obstacles.shift();
  }

  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.08;
    p.life -= 1;
  });
  while (particles.length && particles[0].life <= 0) {
    particles.shift();
  }

  for (const obs of obstacles) {
    if (
      player.x < obs.x + obs.w &&
      player.x + player.w > obs.x &&
      player.y < obs.y + obs.h &&
      player.y + player.h > obs.y
    ) {
      state.shake = 8;
      addParticle(player.x + player.w / 2, player.y + player.h / 2, "rgba(255,77,216,0.9)", 22);
      thump();
      end();
      break;
    }
  }
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#07070c";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(84,247,255,0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, floorY + 10 + i * 6);
    ctx.lineTo(canvas.width, floorY + 10 + i * 6);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(84,247,255,0.08)";
  ctx.fillRect(0, floorY + 8, canvas.width, canvas.height - floorY);
}

function draw() {
  const shake = state.shake > 0 ? (Math.random() - 0.5) * state.shake : 0;
  if (state.shake > 0) {
    state.shake *= 0.85;
  }

  ctx.save();
  ctx.translate(shake, shake);
  drawBackground();

  ctx.fillStyle = "rgba(84,247,255,0.12)";
  ctx.fillRect(0, floorY, canvas.width, 4);

  ctx.shadowColor = "rgba(84,247,255,0.8)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#54f7ff";
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.shadowBlur = 0;

  obstacles.forEach((obs) => {
    ctx.shadowColor = "rgba(255,77,216,0.8)";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#ff4dd8";
    ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
    ctx.shadowBlur = 0;
  });

  particles.forEach((p) => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 3, 3);
  });

  ctx.restore();
}

let lastTime = performance.now();
function loop(now) {
  const delta = now - lastTime;
  lastTime = now;

  if (state.running) {
    update(delta);
  }
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// --- MODIFICACIONES PARA MÓVILES ---

// --- SISTEMA DE ENTRADA UNIFICADO ---

function handleInput(event) {
  // Solo actuamos si el clic no fue sobre el botón de sonido
  if (event && event.target === soundToggle) return;

  // Evita el comportamiento molesto de scroll/zoom en móviles
  if (event && event.cancelable) {
    event.preventDefault();
  }

  jumpOrDash();
}

// Teclado (PC)
window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    handleInput(event);
  }
});

// Toque en celulares (Touch)
// Lo ponemos en window para que detecte el toque aunque esté el overlay activo
window.addEventListener("touchstart", (event) => {
  handleInput(event);
}, { passive: false });

// Click del Mouse (PC)
window.addEventListener("mousedown", (event) => {
  // Evitamos que se dispare doble si es un toque
  if (event.pointerType !== "touch") {
    handleInput(event);
  }
});

// Sonido
soundToggle.addEventListener("click", () => {
  state.sound = !state.sound;
  soundToggle.setAttribute("aria-pressed", String(state.sound));
  soundToggle.textContent = state.sound ? "Sonido: On" : "Sonido: Off";
  if (state.sound) {
    createAudio();
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    beep(520, 0.08, "square");
  }
});

reset();