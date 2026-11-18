// Collision, damage, hitstop and screen shake: everything that decides what a hit does.
import { ARENA, BEAM, FLARE, PLAYER, FEEL, SALVAGE } from "../config.js";
import { dist, dist2, angleTo, clamp, shortestAngle, rand } from "../random.js";
import { killEnemy } from "../entities/enemies.js";
import { damageBoss } from "../entities/bosses.js";
import { burst, spray, damageNumber, textPop, embers } from "../entities/particles.js";
import { spawnBolt, spawnRing, beamReach, cullBullets } from "../entities/projectiles.js";
import { lanternPos } from "../entities/player.js";
import { registerKill, addScore, finishRun, addSalvage } from "../run.js";
import { Sfx } from "../audio.js";

// A shield is a front arc: hits arriving inside this half-angle are turned away.
const SHIELD_ARC = 1.15;

export function shieldBlocks(e, fromX, fromY) {
  if (e.kind !== "chainwarden") return false;
  const incoming = angleTo(e.x, e.y, fromX, fromY);
  return Math.abs(shortestAngle(e.angle, incoming)) < SHIELD_ARC;
}

// Chain Lightning: a hit can arc to the nearest untouched bodies for a fraction of the damage.
function chainFrom(run, source, amount) {
  const links = run.build.chain;
  if (!links || links <= 0) return;
  const hit = new Set([source.id]);
  let from = source;
  for (let i = 0; i < links; i++) {
    let best = null;
    let bd = 210 * 210;
    for (const e of run.enemies) {
      if (e.dead || hit.has(e.id)) continue;
      const d = dist2(e.x, e.y, from.x, from.y);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (!best) break;
    hit.add(best.id);
    run.arcs.push({
      x0: from.x, y0: from.y, x1: best.x, y1: best.y,
      life: 0.18, maxLife: 0.18, color: run.palette.pale, seed: run.rng() * 100,
    });
    damageEnemy(run, best, amount * 0.45, { canCrit: false, noChain: true });
    from = best;
  }
}

export function damageEnemy(run, e, amount, opts = {}) {
  if (!e || e.dead) return 0;
  if (opts.from && shieldBlocks(e, opts.from.x, opts.from.y)) {
    spray(run, e.x + Math.cos(angleTo(e.x, e.y, opts.from.x, opts.from.y)) * e.r, e.y, 0, Math.PI, run.palette.pale, 5, 180);
    textPop(run, e.x, e.y - e.r - 8, "BLOCKED", run.palette.pale);
    Sfx.beamHit();
    return 0;
  }
  let dmg = amount;
  let crit = false;
  if (opts.canCrit && run.build.crit > 0 && run.rng() < run.build.crit) {
    dmg *= 2;
    crit = true;
  }
  e.hp -= dmg;
  e.hitFlash = 1;
  if (run.build.slow > 0) e.slow = 1.2;
  if (opts.showNumber !== false) {
    damageNumber(run, e.x, e.y - e.r - 6, dmg, crit ? run.palette.accent : run.palette.ink, crit);
  }
  if (!opts.noChain && run.build.chain > 0) chainFrom(run, e, amount);
  if (e.hp <= 0) {
    killEnemy(run, e);
    registerKill(run, e);
    run.hitstop = Math.max(run.hitstop, FEEL.killHitstop);
    run.shake = Math.max(run.shake, 0.22);
    dropEmber(run, e);
    dropSalvage(run, e);
    if (run.build.killSlow > 0) chillNearby(run, e);
    if (e.r > 20) {
      embers(run, e.x, e.y, run.palette.warm, 12);
      Sfx.bigKill();
    } else {
      Sfx.kill();
    }
  }
  return dmg;
}

// Grave Chill: a kill drops the temperature around the body.
function chillNearby(run, e) {
  const radius = 150 + run.build.killSlow * 40;
  for (const other of run.enemies) {
    if (other.dead || other === e) continue;
    if (dist2(other.x, other.y, e.x, e.y) < radius * radius) {
      other.slow = Math.max(other.slow, 1.6 + run.build.killSlow * 0.4);
      burst(run, other.x, other.y, run.palette.pale, 3, 60);
    }
  }
}

export function hurtPlayer(run, cause = "hit") {
  const p = run.player;
  if (run.state !== "play" || p.invuln > 0) return false;
  p.hull -= 1;
  p.invuln = PLAYER.invulnAfterHit;
  p.hurtFlash = 1;
  run.combo = 1;
  run.comboTimer = 0;
  run.shake = 0.55;
  run.chroma = 1;
  run.hitstop = Math.max(run.hitstop, FEEL.hurtHitstop);
  run.flash = 0.35;
  burst(run, p.x, p.y, run.palette.danger, 26, 300);
  textPop(run, p.x, p.y - 34, cause === "ring" ? "SHOCKWAVE" : "HULL HIT", run.palette.danger);
  Sfx.hurt();
  if (p.hull <= 0) {
    p.hull = 0;
    finishRun(run, false);
    Sfx.lose();
    Sfx.stopBeam();
  }
  return true;
}

// The lantern beam: rays that burn everything they cross and stop visibly on the first body.
// Twin Shutter splits it into two half-damage rays either side of the aim line.
export function stepBeam(run, dt) {
  const p = run.player;
  const build = run.build;
  p.beamLength = 0;
  p.beamHit = false;
  p.beamRays = [];
  if (!p.beamOn || p.overheated) return;

  const origin = lanternPos(p);
  const halfWidth = BEAM.halfWidth * build.beamWidth;
  const spread = build.splitBeam > 0 ? 0.11 : 0;

  const rays = [{ angle: p.angle, mul: 1, main: true }];
  if (spread > 0) {
    rays.push({ angle: p.angle - spread, mul: 0.5, main: false });
    rays.push({ angle: p.angle + spread, mul: 0.5, main: false });
  }

  p.beamTick = (p.beamTick || 0) - dt;
  const doTick = p.beamTick <= 0;
  if (doTick) p.beamTick = 1 / BEAM.tickRate;

  for (const ray of rays) {
    const dx = Math.cos(ray.angle);
    const dy = Math.sin(ray.angle);
    const reach = beamReach(run, origin.x, origin.y, ray.angle, halfWidth);
    const out = { angle: ray.angle, length: reach.length, hit: false, hitX: 0, hitY: 0, main: ray.main };
    if (ray.main) p.beamLength = reach.length;

    for (const e of run.enemies) {
      if (e.dead) continue;
      const relx = e.x - origin.x;
      const rely = e.y - origin.y;
      const along = relx * dx + rely * dy;
      if (along < -e.r || along > BEAM.length) continue;
      const perp = Math.abs(relx * dy - rely * dx);
      if (perp > e.r + halfWidth) continue;
      const impactX = origin.x + dx * clamp(along, 0, BEAM.length);
      const impactY = origin.y + dy * clamp(along, 0, BEAM.length);
      out.hit = true;
      out.hitX = impactX;
      out.hitY = impactY;
      if (ray.main) {
        p.beamHit = true;
        p.beamHitX = impactX;
        p.beamHitY = impactY;
      }
      if (doTick) {
        damageEnemy(run, e, (BEAM.dps / BEAM.tickRate) * build.damage * ray.mul, { from: origin, canCrit: true });
        spray(run, impactX, impactY, ray.angle + Math.PI, 0.8, run.palette.pale, 3, 240);
        Sfx.beamHit();
      }
    }

    if (run.boss && run.boss.alive) {
      const targets = run.boss.nodes
        ? run.boss.nodes.filter((n) => n.alive && n.active)
        : [run.boss];
      for (const t of targets) {
        const relx = t.x - origin.x;
        const rely = t.y - origin.y;
        const along = relx * dx + rely * dy;
        if (along < 0 || along > BEAM.length) continue;
        const perp = Math.abs(relx * dy - rely * dx);
        if (perp > t.r + halfWidth) continue;
        const impactX = origin.x + dx * along;
        const impactY = origin.y + dy * along;
        out.hit = true;
        out.hitX = impactX;
        out.hitY = impactY;
        if (ray.main) {
          p.beamHit = true;
          p.beamHitX = impactX;
          p.beamHitY = impactY;
        }
        if (doTick) {
          damageBoss(run, run.boss, (BEAM.dps / BEAM.tickRate) * build.damage * ray.mul, t);
          spray(run, impactX, impactY, ray.angle + Math.PI, 0.7, run.palette.pale, 3, 260);
          Sfx.bossHit();
        }
      }
    }
    p.beamRays.push(out);
  }

  // A bolt leaves the lantern at a fixed cadence while the beam burns.
  p.boltTimer -= dt;
  if (p.boltTimer <= 0) {
    p.boltTimer = PLAYER.boltDelay / build.fireRate;
    spawnBolt(run, origin.x, origin.y, p.angle, build);
    Sfx.bolt();
  }
}

export function useFlare(run) {
  const p = run.player;
  if (p.flare < FLARE.max) return false;
  p.flare = 0;
  const radius = FLARE.radius * run.build.flareRadius;
  let cleared = 0;

  for (let i = run.ebullets.length - 1; i >= 0; i--) {
    const b = run.ebullets[i];
    if (dist2(b.x, b.y, p.x, p.y) < radius * radius) {
      run.ebullets.splice(i, 1);
      cleared += 1;
    }
  }

  // Flares ignore shields: that is the answer to a Chainwarden facing you.
  for (const e of run.enemies) {
    if (e.dead) continue;
    if (dist(e.x, e.y, p.x, p.y) < radius + e.r) {
      if (run.build.flareBlind > 0) e.blind = Math.max(e.blind || 0, 1);
      damageEnemy(run, e, FLARE.damage * run.build.damage, { showNumber: true });
    }
  }
  if (run.boss && run.boss.alive) {
    const targets = run.boss.nodes ? run.boss.nodes.filter((n) => n.alive && n.active) : [run.boss];
    for (const t of targets) {
      if (dist(t.x, t.y, p.x, p.y) < radius + t.r) damageBoss(run, run.boss, FLARE.damage * run.build.damage, t);
    }
  }

  spawnRing(run, p.x, p.y, radius, radius / 0.3, 0, { color: run.palette.pale, width: 8, life: 0.5, kind: "flare" });
  burst(run, p.x, p.y, run.palette.pale, 40, 420);
  burst(run, p.x, p.y, run.palette.accent, 22, 260);
  run.shake = Math.max(run.shake, 0.55);
  run.flash = 0.45;
  run.hitstop = Math.max(run.hitstop, 0.05);
  Sfx.flare();
  if (cleared > 0) textPop(run, p.x, p.y - 40, `${cleared} CLEARED`, run.palette.pale);
  return true;
}

// Vent Hammer: overheating no longer just stops the light, it throws a shockwave.
export function ventShock(run) {
  if (!run.build.ventShock) return false;
  const p = run.player;
  const radius = 150 + run.build.ventShock * 45;
  spawnRing(run, p.x, p.y, radius, radius / 0.28, 0, { color: run.palette.accent, width: 10, life: 0.5, kind: "flare" });
  burst(run, p.x, p.y, run.palette.accent, 34, 400);
  for (const e of run.enemies) {
    if (e.dead) continue;
    if (dist(e.x, e.y, p.x, p.y) < radius + e.r) {
      damageEnemy(run, e, 26 * run.build.damage * run.build.ventShock, { showNumber: true });
    }
  }
  if (run.boss && run.boss.alive) {
    const targets = run.boss.nodes ? run.boss.nodes.filter((n) => n.alive && n.active) : [run.boss];
    for (const t of targets) {
      if (dist(t.x, t.y, p.x, p.y) < radius + t.r) damageBoss(run, run.boss, 26 * run.build.damage, t);
    }
  }
  run.shake = Math.max(run.shake, 0.5);
  textPop(run, p.x, p.y - 44, "VENT BLAST", run.palette.accent);
  return true;
}

function stepBolts(run, dt) {
  const bolts = run.pbolts;
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    let gone = false;
    for (const e of run.enemies) {
      if (e.dead || b.hit.includes(e.id)) continue;
      if (dist2(b.x, b.y, e.x, e.y) < (e.r + b.r) ** 2) {
        damageEnemy(run, e, b.damage, { from: { x: b.x - b.vx, y: b.y - b.vy }, canCrit: true });
        b.hit.push(e.id);
        if (b.pierce <= 0) {
          gone = true;
          break;
        }
        b.pierce -= 1;
      }
    }
    if (!gone && run.boss && run.boss.alive) {
      const targets = run.boss.nodes ? run.boss.nodes.filter((n) => n.alive && n.active) : [run.boss];
      for (const t of targets) {
        if (dist2(b.x, b.y, t.x, t.y) < (t.r + b.r) ** 2) {
          damageBoss(run, run.boss, b.damage, t);
          spray(run, b.x, b.y, Math.atan2(-b.vy, -b.vx), 0.6, run.palette.pale, 4, 220);
          gone = true;
          break;
        }
      }
    }
    if (gone) bolts.splice(i, 1);
  }
}

function stepEnemyBullets(run) {
  const p = run.player;
  for (let i = run.ebullets.length - 1; i >= 0; i--) {
    const b = run.ebullets[i];
    if (dist2(b.x, b.y, p.x, p.y) < (b.r + p.r * 0.82) ** 2) {
      run.ebullets.splice(i, 1);
      burst(run, b.x, b.y, b.color, 8, 180);
      hurtPlayer(run, "shot");
      if (run.state !== "play") return;
    }
  }
}

function stepRings(run) {
  const p = run.player;
  for (const ring of run.rings) {
    if (ring.damage <= 0 || ring.hitPlayer) continue;
    const d = dist(ring.x, ring.y, p.x, p.y);
    if (Math.abs(d - ring.r) < p.r + ring.width * 0.55) {
      ring.hitPlayer = true;
      hurtPlayer(run, "ring");
      if (run.state !== "play") return;
    }
  }
}

function stepContact(run) {
  const p = run.player;
  const build = run.build;
  for (const e of run.enemies) {
    if (e.dead) continue;
    const touching = dist2(e.x, e.y, p.x, p.y) < (e.r + p.r * 0.9) ** 2;
    if (!touching) continue;
    if (e.harmful) {
      if (hurtPlayer(run, "touch") && build.thorns > 0) {
        damageEnemy(run, e, build.thorns, { showNumber: true });
      }
      if (run.state !== "play") return;
    }
  }
  const boss = run.boss;
  if (boss && boss.alive && boss.harmful) {
    const body = boss.nodes ? boss.nodes.find((n) => n.alive && n.active) : boss;
    if (body && dist2(body.x, body.y, p.x, p.y) < (body.r + p.r) ** 2) {
      hurtPlayer(run, "touch");
    }
  }
}

// Dash damage, the Kelp Cord's trail and the Cinder Wake upgrade: all three are the same
// "burn what you passed through" test with a different damage source.
function stepDash(run, dt) {
  const p = run.player;
  const build = run.build;
  if (p.dashT <= 0 && p.trail.length === 0) return;
  const burning = build.burnTrail > 0 || run.relics.includes("kelpcord");
  for (const e of run.enemies) {
    if (e.dead) continue;
    e.trailCooldown = Math.max(0, (e.trailCooldown || 0) - dt);
    let hit = false;
    if (p.dashT > 0 && build.dashDamage > 0 && dist2(e.x, e.y, p.x, p.y) < (e.r + p.r + 6) ** 2) {
      hit = true;
    }
    if (!hit && burning) {
      for (const t of p.trail) {
        if (dist2(e.x, e.y, t.x, t.y) < (e.r + 18) ** 2) {
          hit = true;
          break;
        }
      }
    }
    if (!hit) continue;
    if (e.trailCooldown > 0) continue;
    e.trailCooldown = 0.25;
    let amount = build.dashDamage;
    if (burning) amount = Math.max(amount, build.burnTrail > 0 ? 7 + build.burnTrail * 3 : 9);
    damageEnemy(run, e, amount, { showNumber: true });
  }
}

// Kills sometimes leave a soul ember worth score and a little flare charge; the magnet
// stat widens the pull, so that upgrade changes something the player can feel.
function dropEmber(run, e) {
  if (run.rng() > 0.45) return;
  run.pickups.push({
    x: e.x,
    y: e.y,
    vx: (run.rng() - 0.5) * 90,
    vy: (run.rng() - 0.5) * 90,
    r: 6,
    life: 11,
    value: Math.max(4, Math.round(e.score * 0.6)),
    phase: run.rng() * 6.28,
  });
}

// Salvage tags: the shop's currency, dropped by kills and pulled in like embers.
function dropSalvage(run, e) {
  const count = e.r > 20 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    if (run.rng() > (e.r > 20 ? 0.9 : 0.62)) continue;
    run.salvageDrops.push({
      x: e.x + rand(run.rng, -10, 10),
      y: e.y + rand(run.rng, -10, 10),
      vx: (run.rng() - 0.5) * 80,
      vy: (run.rng() - 0.5) * 80,
      r: 7,
      life: 13,
      value: Math.max(SALVAGE.min, Math.round(e.score * SALVAGE.perKill)),
      phase: run.rng() * 6.28,
    });
  }
}

function stepPickups(run, dt) {
  const p = run.player;
  const range = run.build.lodestone > 0 ? 5000 : 96 * run.build.magnet;
  for (let i = run.pickups.length - 1; i >= 0; i--) {
    const pk = run.pickups[i];
    pk.life -= dt;
    const d = dist(pk.x, pk.y, p.x, p.y);
    if (d < range) {
      const a = angleTo(pk.x, pk.y, p.x, p.y);
      pk.x += Math.cos(a) * 430 * dt;
      pk.y += Math.sin(a) * 430 * dt;
    } else {
      pk.x += pk.vx * dt;
      pk.y += pk.vy * dt;
      pk.vx *= 1 - 2 * dt;
      pk.vy *= 1 - 2 * dt;
    }
    if (d < p.r + 14) {
      run.pickups.splice(i, 1);
      addScore(run, pk.value);
      p.flare = Math.min(FLARE.max, p.flare + 3);
      burst(run, pk.x, pk.y, run.palette.ink, 6, 120);
      Sfx.uiMove();
    } else if (pk.life <= 0) {
      run.pickups.splice(i, 1);
    }
  }
}

function stepSalvage(run, dt) {
  const p = run.player;
  const range = run.build.lodestone > 0 ? 5000 : 104 * run.build.magnet;
  const drops = run.salvageDrops;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.life -= dt;
    const dd = dist(d.x, d.y, p.x, p.y);
    if (dd < range) {
      const a = angleTo(d.x, d.y, p.x, p.y);
      d.x += Math.cos(a) * 470 * dt;
      d.y += Math.sin(a) * 470 * dt;
    } else {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 1 - 2.2 * dt;
      d.vy *= 1 - 2.2 * dt;
    }
    if (dd < p.r + 16) {
      drops.splice(i, 1);
      addSalvage(run, d.value);
      burst(run, d.x, d.y, run.palette.warm, 5, 110);
      textPop(run, d.x, d.y - 12, `+${d.value}`, run.palette.warm);
    } else if (d.life <= 0) {
      drops.splice(i, 1);
    }
  }
}

// Orbiting wisps: they circle the lamplighter and take their own shots at whatever is closest.
export function updateWisps(run, dt) {
  const p = run.player;
  const want = run.build.wisp | 0;
  while (run.wisps.length < want) {
    run.wisps.push({ phase: (run.wisps.length / Math.max(1, want)) * 6.28, cooldown: 0.3, x: p.x, y: p.y });
  }
  while (run.wisps.length > want) run.wisps.pop();

  for (let i = 0; i < run.wisps.length; i++) {
    const w = run.wisps[i];
    const a = run.t * 2.1 + w.phase + i * 0.4;
    const radius = 52 + Math.sin(run.t * 1.4 + w.phase) * 6;
    w.x = p.x + Math.cos(a) * radius;
    w.y = p.y + Math.sin(a) * radius;
    w.cooldown -= dt;
    if (w.cooldown > 0) continue;
    let target = null;
    let bd = 460 * 460;
    for (const e of run.enemies) {
      if (e.dead) continue;
      const d = dist2(e.x, e.y, w.x, w.y);
      if (d < bd) {
        bd = d;
        target = e;
      }
    }
    if (!target && run.boss && run.boss.alive) target = run.boss;
    if (!target) continue;
    w.cooldown = 0.55;
    const ang = angleTo(w.x, w.y, target.x, target.y);
    run.pbolts.push({
      x: w.x,
      y: w.y,
      vx: Math.cos(ang) * 700,
      vy: Math.sin(ang) * 700,
      r: 4,
      life: 0.8,
      damage: PLAYER.boltDamage * 0.55 * run.build.damage,
      pierce: 0,
      hit: [],
      wisp: true,
    });
  }
}

function stepArcs(run, dt) {
  const arcs = run.arcs;
  for (let i = arcs.length - 1; i >= 0; i--) {
    arcs[i].life -= dt;
    if (arcs[i].life <= 0) arcs.splice(i, 1);
  }
}

export function stepCombat(run, dt) {
  const p = run.player;

  if (p.beamOn && !p.overheated) Sfx.setBeamHeat(clamp(p.heat / 100, 0, 1));
  stepBeam(run, dt);
  stepBolts(run, dt);
  stepEnemyBullets(run);
  if (run.state !== "play") return;
  stepRings(run);
  if (run.state !== "play") return;
  stepContact(run);
  if (run.state !== "play") return;
  stepDash(run, dt);
  stepPickups(run, dt);
  stepSalvage(run, dt);
  stepArcs(run, dt);

  run.enemies = run.enemies.filter((e) => !e.dead);
  cullBullets(run, ARENA);
}

export { dist };
