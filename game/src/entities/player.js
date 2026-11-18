// The last lamplighter: movement, aim, dash, heat and flare charge.
import { ARENA, PLAYER, BEAM, DASH, FLARE } from "../config.js";
import { clamp } from "../random.js";

export function makePlayer() {
  return {
    x: ARENA.cx,
    y: ARENA.cy + 90,
    vx: 0,
    vy: 0,
    r: PLAYER.r,
    angle: -Math.PI / 2,
    hull: PLAYER.hullBase,
    maxHull: PLAYER.hullBase,
    invuln: 0,
    hurtFlash: 0,
    dashT: 0,
    dashDirX: 0,
    dashDirY: 0,
    dashCharges: DASH.charges,
    dashRecharge: 0,
    heat: 0,
    overheated: false,
    flare: FLARE.start,
    beamOn: false,
    beamLength: 0,
    beamHitX: 0,
    beamHitY: 0,
    beamHit: false,
    boltTimer: 0,
    moving: false,
    trail: [],
    kills: 0,
  };
}

export function resetPlayer(p, build) {
  p.x = ARENA.cx;
  p.y = ARENA.cy + 90;
  p.vx = 0;
  p.vy = 0;
  p.maxHull = build.maxHull;
  p.hull = build.maxHull;
  p.invuln = 0.6;
  p.hurtFlash = 0;
  p.dashT = 0;
  p.dashCharges = build.dashCharges;
  p.dashRecharge = 0;
  p.heat = 0;
  p.overheated = false;
  p.flare = FLARE.start;
  p.beamOn = false;
  p.beamRays = [];
  p.trail.length = 0;
  p.kills = 0;
}

// Called once per frame while a run is live. Returns the events the caller should play
// sound for: a dash start and an overheat.
export function updatePlayer(run, input, dt) {
  const p = run.player;
  const build = run.build;
  const events = { dashed: false, overheated: false };
  const axis = input.axis();

  // Aim follows the mouse, clamped into the canvas.
  p.angle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);

  const maxSpeed = PLAYER.speed * build.speed;

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vx = p.dashDirX * DASH.speed;
    p.vy = p.dashDirY * DASH.speed;
    p.trail.push({ x: p.x, y: p.y, life: 0.28 });
    if (p.trail.length > 16) p.trail.shift();
  } else {
    p.vx += axis.x * PLAYER.accel * dt;
    p.vy += axis.y * PLAYER.accel * dt;
    const damp = Math.max(0, 1 - PLAYER.drag * dt);
    p.vx *= damp;
    p.vy *= damp;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > maxSpeed) {
      p.vx = (p.vx / speed) * maxSpeed;
      p.vy = (p.vy / speed) * maxSpeed;
    }
    p.moving = axis.x !== 0 || axis.y !== 0;
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;

  // Dash trigger: along the movement stick, or the aim direction when standing still.
  if (input.dashPressed() && p.dashT <= 0 && p.dashCharges > 0) {
    let dx = axis.x;
    let dy = axis.y;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(p.angle);
      dy = Math.sin(p.angle);
    }
    const len = Math.hypot(dx, dy) || 1;
    p.dashDirX = dx / len;
    p.dashDirY = dy / len;
    p.dashT = DASH.duration;
    p.dashCharges -= 1;
    p.invuln = Math.max(p.invuln, DASH.invuln);
    events.dashed = true;
  }

  // Recharge one dash charge at a time, shown as a ring in the HUD.
  if (p.dashCharges < build.dashCharges) {
    p.dashRecharge += dt;
    if (p.dashRecharge >= DASH.recharge) {
      p.dashRecharge = 0;
      p.dashCharges += 1;
    }
  } else {
    p.dashRecharge = 0;
  }

  // Keep the player inside the arena.
  const pad = p.r + 2;
  p.x = clamp(p.x, ARENA.x + pad, ARENA.x + ARENA.w - pad);
  p.y = clamp(p.y, ARENA.y + pad, ARENA.y + ARENA.h - pad);

  // Beam heat: capacity is a rate divisor, so more capacity means a longer burn.
  p.beamOn = input.firing();
  if (p.beamOn && !p.overheated) {
    p.heat += BEAM.heatPerSecond * dt * (100 / build.heatCap);
    if (p.heat >= BEAM.overheatAt) {
      p.heat = BEAM.overheatAt;
      p.overheated = true;
      p.beamOn = false;
      events.overheated = true;
    }
  } else {
    p.heat = Math.max(0, p.heat - BEAM.coolPerSecond * dt);
    if (p.overheated && p.heat <= BEAM.resumeAt) p.overheated = false;
  }

  // Flare charge is earned by kills, so the flare is a reward for fighting.
  p.flare = clamp(p.flare, 0, FLARE.max);

  p.invuln = Math.max(0, p.invuln - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt * 3);

  for (const t of p.trail) t.life -= dt;
  p.trail = p.trail.filter((t) => t.life > 0);

  return events;
}

export function addDashTrail(run, x, y, life = 0.3) {
  run.player.trail.push({ x, y, life });
}

// The lantern sits slightly ahead of the body: beams and bolts start there.
export function lanternPos(p) {
  return {
    x: p.x + Math.cos(p.angle) * (p.r + 6),
    y: p.y + Math.sin(p.angle) * (p.r + 6),
  };
}
