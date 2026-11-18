// Bullets, player bolts and expanding shockwave rings. Plain records in the run's lists.
import { BULLET, PLAYER, BEAM } from "../config.js";
import { clamp } from "../random.js";

export function spawnEnemyBullet(run, x, y, angle, speed, opts = {}) {
  run.ebullets.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: opts.r || BULLET.enemyRadius,
    life: opts.life || 5.5,
    color: opts.color || run.palette.accent,
    kind: opts.kind || "orb",
    spin: opts.spin || 0,
  });
}

export function spawnRadial(run, x, y, count, speed, offset = 0, opts = {}) {
  for (let i = 0; i < count; i++) {
    const a = offset + (i / count) * Math.PI * 2;
    spawnEnemyBullet(run, x, y, a, speed, opts);
  }
}

// A spread of shots: three for an Echo, more for a boss.
export function spawnSpread(run, x, y, angle, count, spread, speed, opts = {}) {
  const start = angle - (spread * (count - 1)) / 2;
  for (let i = 0; i < count; i++) {
    spawnEnemyBullet(run, x, y, start + spread * i, speed, opts);
  }
}

export function spawnBolt(run, x, y, angle, build) {
  run.pbolts.push({
    x,
    y,
    vx: Math.cos(angle) * PLAYER.boltSpeed,
    vy: Math.sin(angle) * PLAYER.boltSpeed,
    r: PLAYER.boltRadius,
    life: PLAYER.boltLife,
    damage: PLAYER.boltDamage * build.damage,
    pierce: build.pierce,
    hit: [],
  });
}

export function spawnRing(run, x, y, maxR, speed, damage, opts = {}) {
  run.rings.push({
    x,
    y,
    r: opts.startR || 18,
    maxR,
    speed,
    damage,
    color: opts.color || run.palette.pale,
    width: opts.width || 10,
    hitPlayer: false,
    life: opts.life || 2.6,
    kind: opts.kind || "shock",
  });
}

export function updateProjectiles(run, dt) {
  const b = run.ebullets;
  for (let i = b.length - 1; i >= 0; i--) {
    const p = b[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) b.splice(i, 1);
  }

  const bolts = run.pbolts;
  for (let i = bolts.length - 1; i >= 0; i--) {
    const p = bolts[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) bolts.splice(i, 1);
  }

  const rings = run.rings;
  for (let i = rings.length - 1; i >= 0; i--) {
    const ring = rings[i];
    ring.r += ring.speed * dt;
    ring.life -= dt;
    if (ring.r >= ring.maxR || ring.life <= 0) rings.splice(i, 1);
  }
}

// True when a point is inside the arena with a small margin: used to cull bullets.
export function inBounds(arena, x, y, pad = 40) {
  return x > arena.x - pad && x < arena.x + arena.w + pad && y > arena.y - pad && y < arena.y + arena.h + pad;
}

export function cullBullets(run, arena) {
  run.ebullets = run.ebullets.filter((p) => inBounds(arena, p.x, p.y, 60));
  run.pbolts = run.pbolts.filter((p) => inBounds(arena, p.x, p.y, 40));
}

// The beam's reach: how far along the ray the first solid thing sits. Used both for
// damage and for the drawn beam so the light visibly stops on what it burns.
export function beamReach(run, ox, oy, angle, halfWidth) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let best = BEAM.length;
  let hit = null;
  const consider = (cx, cy, cr, ref) => {
    const relx = cx - ox;
    const rely = cy - oy;
    const along = relx * dx + rely * dy;
    if (along < 0 || along > best) return;
    const perp = Math.abs(relx * dy - rely * dx);
    if (perp <= cr + halfWidth) {
      best = clamp(along, 0, BEAM.length);
      hit = ref;
    }
  };
  for (const e of run.enemies) if (!e.dead) consider(e.x, e.y, e.r, e);
  if (run.boss) {
    const boss = run.boss;
    if (boss.nodes) {
      for (const n of boss.nodes) if (n.alive) consider(n.x, n.y, n.r, n);
    }
    if (boss.alive !== false) consider(boss.x, boss.y, boss.r, boss);
  }
  return { length: best, hit };
}
