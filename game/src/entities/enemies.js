// The nine creatures of the descent. Each one has its own silhouette, its own approach and a
// visible wind-up before anything it does can hurt the player.
import { ARENA, ENEMY_TYPES, BULLET } from "../config.js";
import { rand, dist, angleTo, clamp, shortestAngle, pointInArena } from "../random.js";
import { spawnEnemyBullet, spawnRadial, spawnSpread, spawnRing } from "./projectiles.js";
import { burst } from "./particles.js";

let nextId = 1;

// Health grows with the floor and with the room, so floor 3 room 2 is a real fight.
export function makeEnemy(run, kind, x, y, opts = {}) {
  const type = ENEMY_TYPES[kind];
  const scale = (1 + 0.16 * run.floor) * (1 + 0.09 * run.room);
  const hp = opts.hp !== undefined ? opts.hp : Math.round(type.hp * scale);
  const e = {
    id: nextId++,
    kind,
    name: type.name,
    x,
    y,
    vx: 0,
    vy: 0,
    r: opts.r !== undefined ? opts.r : type.r,
    hp,
    maxHp: hp,
    speed: type.speed * (1 + 0.05 * run.floor),
    score: Math.round(type.score * (1 + 0.25 * run.floor)),
    tellTime: type.tell,
    state: "idle",
    timer: rand(run.rng, 0.1, 0.7),
    cooldown: rand(run.rng, 0.2, 0.9),
    angle: 0,
    t: rand(run.rng, 0, 10),
    pulse: 0,
    hitFlash: 0,
    slow: 0,
    harmful: false,
    gen: opts.gen || 0,
    dead: false,
    wobble: rand(run.rng, 0, Math.PI * 2),
    chargeDirX: 0,
    chargeDirY: 0,
    homeX: x,
    homeY: y,
  };
  if (kind === "anemone") {
    e.timer = rand(run.rng, 0.6, 1.4);
    e.cooldown = 0;
  }
  if (kind === "chainwarden") e.angle = rand(run.rng, 0, Math.PI * 2);
  return e;
}

function seek(e, tx, ty, speed, dt) {
  const a = Math.atan2(ty - e.y, tx - e.x);
  e.vx += (Math.cos(a) * speed - e.vx) * Math.min(1, dt * 4);
  e.vy += (Math.sin(a) * speed - e.vy) * Math.min(1, dt * 4);
}

function drift(e, dt) {
  e.vx *= 1 - Math.min(1, dt * 3.4);
  e.vy *= 1 - Math.min(1, dt * 3.4);
}

// Enter the wind-up state: the frame after this, every attack is visible before it lands.
function beginTell(e, seconds) {
  e.state = "tell";
  e.timer = seconds;
  e.tellMax = seconds;
  e.pulse = 0;
  e.vx *= 0.2;
  e.vy *= 0.2;
}

function beginAct(e, seconds) {
  e.state = "act";
  e.timer = seconds;
  e.harmful = true;
}

function recover(e, seconds) {
  e.state = "recover";
  e.timer = seconds;
  e.harmful = false;
}

export function updateEnemy(run, e, dt) {
  const p = run.player;
  e.t += dt;
  e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
  e.slow = Math.max(0, e.slow - dt);
  const slowFactor = e.slow > 0 ? 0.55 : 1;
  const d = dist(e.x, e.y, p.x, p.y);
  const aim = angleTo(e.x, e.y, p.x, p.y);

  if (e.state === "tell") {
    e.timer -= dt;
    e.pulse = 1 - Math.max(0, e.timer) / (e.tellMax || e.tellTime);
    if (e.timer <= 0) {
      e.pulse = 1;
      onTellDone(run, e, d, aim);
    }
  } else if (e.state === "act") {
    e.timer -= dt;
    if (e.timer <= 0) {
      e.harmful = false;
      recover(e, 0.35);
    }
  } else if (e.state === "recover") {
    e.timer -= dt;
    e.pulse = Math.max(0, e.pulse - dt * 3);
    if (e.timer <= 0) {
      e.state = "idle";
      e.cooldown = rand(run.rng, 0.5, 1.4);
    }
  }

  switch (e.kind) {
    case "drifter":
      steerDrifter(run, e, dt, d, aim, slowFactor);
      break;
    case "sporeling":
      steerSporeling(run, e, dt, d, aim, slowFactor);
      break;
    case "anemone":
      steerAnemone(run, e, dt);
      break;
    case "bellhusk":
      steerBellhusk(run, e, dt, d, aim, slowFactor);
      break;
    case "cinderling":
      steerCinderling(run, e, dt, d, aim, slowFactor);
      break;
    case "chainwarden":
      steerChainwarden(run, e, dt, d, aim, slowFactor);
      break;
    case "echo":
      steerEcho(run, e, dt, d, aim, slowFactor);
      break;
    case "maw":
      steerMaw(run, e, dt, d, aim, slowFactor);
      break;
    case "warden":
      steerWarden(run, e, dt, d, aim, slowFactor);
      break;
    default:
      break;
  }

  // Enemies stay inside the arena, so nothing can corner the player from outside.
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.x = clamp(e.x, ARENA.x + e.r, ARENA.x + ARENA.w - e.r);
  e.y = clamp(e.y, ARENA.y + e.r, ARENA.y + ARENA.h - e.r);
}

function onTellDone(run, e, d, aim) {
  const p = run.player;
  switch (e.kind) {
    case "drifter":
      beginAct(e, 0.34);
      e.vx = Math.cos(aim) * 430;
      e.vy = Math.sin(aim) * 430;
      break;
    case "sporeling":
      spawnEnemyBullet(run, e.x, e.y, aim, BULLET.enemySpeed, { r: 8, color: run.palette.accent });
      burst(run, e.x, e.y, run.palette.accent, 6, 90);
      e.state = "idle";
      e.cooldown = 2.1;
      break;
    case "anemone":
      spawnRadial(run, e.x, e.y, 8, 150, e.t + 0.2, { r: 7, color: run.palette.pale });
      e.state = "idle";
      e.cooldown = 2.7;
      break;
    case "bellhusk":
      beginAct(e, 0.55);
      e.chargeDirX = Math.cos(aim);
      e.chargeDirY = Math.sin(aim);
      e.vx = e.chargeDirX * 620;
      e.vy = e.chargeDirY * 620;
      break;
    case "cinderling":
      beginAct(e, 0.22);
      e.vx = Math.cos(aim) * 700;
      e.vy = Math.sin(aim) * 700;
      break;
    case "chainwarden":
      beginAct(e, 0.22);
      e.vx = Math.cos(e.angle) * 300;
      e.vy = Math.sin(e.angle) * 300;
      break;
    case "echo":
      // Blink to the far side of the player, then fire the three-shot spread.
      {
        const away = aim + Math.PI + rand(run.rng, -0.5, 0.5);
        const spot = {
          x: clamp(p.x + Math.cos(away) * 230, ARENA.x + 60, ARENA.x + ARENA.w - 60),
          y: clamp(p.y + Math.sin(away) * 230, ARENA.y + 60, ARENA.y + ARENA.h - 60),
        };
        burst(run, e.x, e.y, run.palette.accent, 10, 140);
        e.x = spot.x;
        e.y = spot.y;
        burst(run, e.x, e.y, run.palette.pale, 14, 200);
        spawnSpread(run, e.x, e.y, angleTo(e.x, e.y, p.x, p.y), 3, 0.24, 210, { r: 7 });
        e.state = "idle";
        e.cooldown = 2.4;
      }
      break;
    case "maw":
      beginAct(e, 0.26);
      e.vx = Math.cos(aim) * 520;
      e.vy = Math.sin(aim) * 520;
      break;
    case "warden":
      beginAct(e, 0.3);
      spawnRing(run, e.x, e.y, 260, 330, 1, { color: run.palette.pale, width: 12 });
      burst(run, e.x, e.y, run.palette.warm, 18, 260);
      break;
    default:
      break;
  }
}

function steerDrifter(run, e, dt, d, aim, slow) {
  if (e.state === "idle") {
    if (d > 70) seek(e, run.player.x, run.player.y, e.speed * slow, dt);
    else drift(e, dt);
    e.cooldown -= dt;
    if (d < 170 && e.cooldown <= 0) beginTell(e, e.tellTime);
  } else if (e.state === "act") {
    drift(e, dt);
  } else {
    drift(e, dt);
  }
}

function steerSporeling(run, e, dt, d, aim, slow) {
  const range = ENEMY_TYPES.sporeling.range;
  if (e.state === "idle") {
    if (d > range + 50) seek(e, run.player.x, run.player.y, e.speed * slow, dt);
    else if (d < range - 60) seek(e, e.x * 2 - run.player.x, e.y * 2 - run.player.y, e.speed * slow, dt);
    else {
      // Strafe around the player so it is never a sitting target.
      const side = aim + Math.PI / 2;
      e.vx += (Math.cos(side) * e.speed * 0.6 - e.vx) * Math.min(1, dt * 3);
      e.vy += (Math.sin(side) * e.speed * 0.6 - e.vy) * Math.min(1, dt * 3);
    }
    e.cooldown -= dt;
    if (e.cooldown <= 0 && d < 620) beginTell(e, e.tellTime);
  } else {
    drift(e, dt);
  }
}

function steerAnemone(run, e, dt) {
  e.vx = 0;
  e.vy = 0;
  e.angle += dt * 0.6;
  if (e.state === "idle") {
    e.cooldown -= dt;
    if (e.cooldown <= 0) beginTell(e, e.tellTime);
  }
}

function steerBellhusk(run, e, dt, d, aim, slow) {
  if (e.state === "idle") {
    if (d > 260) seek(e, run.player.x, run.player.y, e.speed * slow, dt);
    else {
      drift(e, dt);
      e.cooldown -= dt;
      if (e.cooldown <= 0) beginTell(e, e.tellTime);
    }
  } else if (e.state === "act") {
    // A straight charge: it does not steer once it commits.
    e.vx = e.chargeDirX * 620;
    e.vy = e.chargeDirY * 620;
  } else {
    drift(e, dt);
  }
}

function steerCinderling(run, e, dt, d, aim, slow) {
  if (e.state === "idle") {
    // Erratic: a wandering heading that leans toward the player.
    e.wobble += dt * rand(run.rng, 6, 11);
    const jitter = Math.sin(e.wobble) * 1.5;
    const a = aim + jitter;
    e.vx += (Math.cos(a) * e.speed * slow - e.vx) * Math.min(1, dt * 6);
    e.vy += (Math.sin(a) * e.speed * slow - e.vy) * Math.min(1, dt * 6);
    e.cooldown -= dt;
    if (d < 240 && e.cooldown <= 0) beginTell(e, e.tellTime);
  } else if (e.state === "act") {
    drift(e, dt);
  }
}

function steerChainwarden(run, e, dt, d, aim, slow) {
  // The shield faces the player only as fast as the creature can turn: get behind it.
  const want = angleTo(e.x, e.y, run.player.x, run.player.y);
  e.angle += clamp(shortestAngle(e.angle, want), -1.3 * dt, 1.3 * dt);
  if (e.state === "idle") {
    if (d > 150) seek(e, run.player.x, run.player.y, e.speed * slow, dt);
    else {
      drift(e, dt);
      e.cooldown -= dt;
      if (e.cooldown <= 0) beginTell(e, e.tellTime);
    }
  } else if (e.state === "act") {
    drift(e, dt);
  }
}

function steerEcho(run, e, dt, d, aim, slow) {
  if (e.state === "idle") {
    if (d > 300) seek(e, run.player.x, run.player.y, e.speed * slow, dt);
    else drift(e, dt);
    e.cooldown -= dt;
    if (e.cooldown <= 0) beginTell(e, e.tellTime);
  }
}

function steerMaw(run, e, dt, d, aim, slow) {
  if (e.state === "idle") {
    seek(e, run.player.x, run.player.y, e.speed * slow, dt);
    e.cooldown -= dt;
    if (d < 130 && e.cooldown <= 0) beginTell(e, e.tellTime);
  } else if (e.state === "act") {
    drift(e, dt);
  }
}

function steerWarden(run, e, dt, d, aim, slow) {
  if (e.state === "idle") {
    seek(e, run.player.x, run.player.y, e.speed * slow, dt);
    e.cooldown -= dt;
    if (d < 210 && e.cooldown <= 0) beginTell(e, e.tellTime);
  } else {
    drift(e, dt);
  }
}

// A light push so a pack reads as separate bodies rather than one blob.
export function separateEnemies(run) {
  const list = run.enemies;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.r + b.r;
      const dd = dx * dx + dy * dy;
      if (dd > 0.01 && dd < min * min) {
        const len = Math.sqrt(dd);
        const push = ((min - len) / len) * 0.35;
        a.x -= dx * push;
        a.y -= dy * push;
        b.x += dx * push;
        b.y += dy * push;
      }
    }
  }
}

// Death: score is paid by the caller, this spawns the burst and the split.
export function killEnemy(run, e) {
  e.dead = true;
  burst(run, e.x, e.y, run.palette.pale, 18, 260);
  burst(run, e.x, e.y, run.palette.accent, 10, 140);
  if (e.kind === "maw" && e.gen === 0) {
    for (let i = 0; i < 2; i++) {
      const a = rand(run.rng, 0, Math.PI * 2);
      const child = makeEnemy(run, "maw", e.x + Math.cos(a) * 18, e.y + Math.sin(a) * 18, {
        hp: Math.round(e.maxHp * 0.4),
        r: 11,
        gen: 1,
      });
      child.score = Math.round(e.score * 0.4);
      run.enemies.push(child);
    }
  }
  if (e.kind === "warden") {
    spawnRing(run, e.x, e.y, 240, 340, 1, { color: run.palette.pale, width: 12 });
  }
}

export function spawnAtEdge(run, kind, opts = {}) {
  const spot = pointInArena(run.rng, ARENA, 80);
  // Bias spawns away from the player so nothing appears on top of them.
  const p = run.player;
  for (let i = 0; i < 6; i++) {
    if (dist(spot.x, spot.y, p.x, p.y) > 260) break;
    spot.x = ARENA.x + ARENA.w - spot.x;
    spot.y = ARENA.y + ARENA.h - spot.y;
  }
  return makeEnemy(run, kind, spot.x, spot.y, opts);
}
