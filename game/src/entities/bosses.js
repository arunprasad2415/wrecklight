// The three keepers of the lighthouse. Each has a named health bar, three attacks and two
// phase breaks at 60% and 30% health.
import { ARENA, BOSSES, FLOORS } from "../config.js";
import { rand, clamp, angleTo, dist, pointInArena } from "../random.js";
import { spawnRadial, spawnSpread, spawnEnemyBullet, spawnRing } from "./projectiles.js";
import { burst, embers } from "./particles.js";
import { makeEnemy } from "./enemies.js";
import { Sfx } from "../audio.js";
import { addScore, bumpCombo } from "../run.js";

export function makeBoss(run, kind) {
  const def = BOSSES[kind];
  const floor = FLOORS[run.floor];
  const boss = {
    kind,
    name: def.name,
    x: ARENA.cx,
    y: ARENA.y + 190,
    r: def.r,
    hp: def.hp,
    maxHp: def.hp,
    score: def.score,
    phase: 1,
    t: 0,
    timer: 1.2,
    state: "idle",
    telegraph: 0,
    act: null,
    angle: Math.PI / 2,
    vx: 0,
    vy: 0,
    hitFlash: 0,
    harmful: false,
    alive: true,
    cycle: 0,
    palette: floor.palette,
    nodes: null,
    activeNode: 0,
    chargeDirX: 0,
    chargeDirY: 0,
    ringQueue: 0,
    roarDone: false,
  };

  if (kind === "kelpchoir") {
    const nodeHp = Math.round(def.hp / 3);
    boss.nodes = [0, 1, 2].map((i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
      return {
        id: i,
        x: ARENA.cx + Math.cos(a) * 250,
        y: ARENA.cy + Math.sin(a) * 210,
        r: 34,
        hp: nodeHp,
        maxHp: nodeHp,
        alive: true,
        active: i === 0,
        angle: a + Math.PI,
        flash: 0,
        t: rand(run.rng, 0, 6),
      };
    });
    boss.x = ARENA.cx;
    boss.y = ARENA.cy;
  }
  return boss;
}

export function bossHealthFraction(boss) {
  if (!boss) return 0;
  if (boss.nodes) {
    let hp = 0;
    for (const n of boss.nodes) hp += Math.max(0, n.hp);
    return hp / boss.maxHp;
  }
  return Math.max(0, boss.hp) / boss.maxHp;
}

// Damage the boss. The Choir can only be hurt on its active node, so the fight is a
// sequence of targets rather than one big sack of health.
export function damageBoss(run, boss, amount, ref) {
  if (!boss || !boss.alive) return 0;
  let dealt = 0;
  if (boss.nodes) {
    const node = ref && ref.id !== undefined ? ref : boss.nodes[boss.activeNode];
    if (!node || !node.alive || !node.active) return 0;
    node.hp -= amount;
    node.flash = 1;
    dealt = amount;
    if (node.hp <= 0) {
      node.hp = 0;
      node.alive = false;
      node.active = false;
      addScore(run, 240);
      bumpCombo(run);
      burst(run, node.x, node.y, run.palette.pale, 30, 320);
      burst(run, node.x, node.y, run.palette.accent, 20, 200);
      run.shake = Math.max(run.shake, 0.7);
      run.hitstop = Math.max(run.hitstop, 0.09);
      Sfx.bigKill();
      const next = boss.nodes.findIndex((n) => n.alive);
      if (next >= 0) {
        boss.nodes[next].active = true;
        boss.activeNode = next;
        boss.phase = boss.nodes.filter((n) => n.alive).length <= 1 ? 3 : 2;
        run.banner = 1.1;
        run.bannerTitle = boss.phase === 3 ? "THE CHOIR ENRAGES" : "A NODE FALLS SILENT";
        run.bannerSub = "";
        Sfx.bossRoar();
      } else {
        boss.alive = false;
      }
    }
  } else {
    boss.hp -= amount;
    boss.hitFlash = 1;
    dealt = amount;
    if (boss.hp <= 0) {
      boss.hp = 0;
      boss.alive = false;
    }
  }
  return dealt;
}

function updatePhase(run, boss) {
  const f = bossHealthFraction(boss);
  if (boss.nodes) return; // the Choir's phase follows its nodes
  const next = f <= 0.3 ? 3 : f <= 0.6 ? 2 : 1;
  if (next !== boss.phase) {
    boss.phase = next;
    boss.timer = 0.7;
    boss.act = null;
    boss.state = "idle";
    run.banner = 1.3;
    run.bannerTitle = next === 3 ? `${boss.name} BREAKS` : `${boss.name} SHIFTS`;
    run.bannerSub = next === 3 ? "final phase" : "second phase";
    run.shake = Math.max(run.shake, 0.6);
    Sfx.bossRoar();
    burst(run, boss.x, boss.y, boss.palette.accent, 34, 340);
  }
}

export function updateBoss(run, boss, dt) {
  if (!boss || !boss.alive) return;
  boss.t += dt;
  boss.hitFlash = Math.max(0, boss.hitFlash - dt * 4);
  boss.telegraph = Math.max(0, boss.telegraph - dt);
  if (boss.nodes) for (const n of boss.nodes) n.flash = Math.max(0, n.flash - dt * 4);
  updatePhase(run, boss);

  if (boss.kind === "kelpchoir") updateKelpChoir(run, boss, dt);
  else if (boss.kind === "bellwarden") updateBellWarden(run, boss, dt);
  else updateBlindLamp(run, boss, dt);

  // Running multi-shot attacks advance their own clocks.
  if (boss.act) stepAct(run, boss, dt);
}

function stepAct(run, boss, dt) {
  const act = boss.act;
  act.timer -= dt;
  act.tick -= dt;

  if (act.mode === "spiral" && act.tick <= 0) {
    act.tick = act.interval;
    act.angle += act.spin;
    const ox = act.ox;
    const oy = act.oy;
    for (let i = 0; i < act.arms; i++) {
      spawnEnemyBullet(run, ox, oy, act.angle + (i * Math.PI * 2) / act.arms, act.speed, {
        r: 8,
        color: run.palette.pale,
      });
    }
  }

  if (act.mode === "ringVolley" && act.tick <= 0) {
    act.tick = act.interval;
    spawnRadial(run, act.ox, act.oy, act.count, act.speed, act.angle, { r: 7, color: run.palette.accent });
    burst(run, act.ox, act.oy, run.palette.accent, 6, 90);
  }

  if (act.mode === "bellRings" && act.tick <= 0 && act.shots > 0) {
    act.tick = 0.34;
    act.shots -= 1;
    spawnRing(run, boss.x, boss.y, 1100, 400, 1, { color: run.palette.pale, width: 16, life: 3.2 });
    run.shake = Math.max(run.shake, 0.5);
    Sfx.bossRoar();
  }

  if (act.mode === "charge") {
    boss.x += boss.chargeDirX * act.speed * dt;
    boss.y += boss.chargeDirY * act.speed * dt;
    boss.harmful = true;
    if (act.tick <= 0) {
      act.tick = 0.16;
      spawnRing(run, boss.x, boss.y, 150, 260, 1, { color: run.palette.warm, width: 9 });
    }
    if (boss.x < ARENA.x + boss.r || boss.x > ARENA.x + ARENA.w - boss.r) boss.chargeDirX *= -1;
    if (boss.y < ARENA.y + boss.r || boss.y > ARENA.y + ARENA.h - boss.r) boss.chargeDirY *= -1;
  }

  if (act.timer <= 0) {
    boss.act = null;
    boss.harmful = false;
    boss.state = "idle";
    boss.timer = boss.phase === 3 ? 0.7 : boss.phase === 2 ? 1.1 : 1.5;
  }
}

function pickAttack(boss, count) {
  const pick = boss.cycle % count;
  boss.cycle += 1;
  return pick;
}

function updateKelpChoir(run, boss, dt) {
  const alive = boss.nodes.filter((n) => n.alive);
  for (const n of alive) n.t += dt;

  if (boss.act) return;

  if (boss.state === "tell") {
    if (boss.telegraph <= 0) {
      const node = boss.nodes[boss.activeNode] || alive[0];
      const ox = node ? node.x : boss.x;
      const oy = node ? node.y : boss.y;
      const which = boss.pending;
      boss.state = "idle";
      if (which === 0) {
        boss.act = {
          mode: "ringVolley",
          ox,
          oy,
          angle: boss.t,
          count: boss.phase === 3 ? 16 : 12,
          speed: 158,
          timer: 1.5,
          tick: 0,
          interval: boss.phase === 3 ? 0.5 : 0.75,
        };
      } else if (which === 1) {
        boss.act = {
          mode: "spiral",
          ox: ARENA.cx,
          oy: ARENA.cy,
          angle: boss.t,
          arms: boss.phase === 3 ? 4 : 2,
          spin: 0.4,
          speed: 190,
          timer: boss.phase === 3 ? 2.2 : 1.6,
          tick: 0,
          interval: 0.09,
        };
      } else {
        const p = run.player;
        for (const n of alive) {
          spawnSpread(run, n.x, n.y, angleTo(n.x, n.y, p.x, p.y), 5, 0.16, 230, { r: 7 });
        }
        burst(run, ox, oy, run.palette.pale, 14, 180);
        boss.timer = boss.phase === 3 ? 1.0 : 1.5;
      }
      boss.pending = null;
    }
    return;
  }

  boss.timer -= dt;
  if (boss.timer <= 0) {
    boss.pending = pickAttack(boss, 3);
    boss.state = "tell";
    boss.telegraph = boss.phase === 3 ? 0.45 : 0.7;
  }
}

function updateBellWarden(run, boss, dt) {
  if (boss.act) return;

  if (boss.state === "tell") {
    if (boss.telegraph <= 0) {
      const which = boss.pending;
      boss.state = "idle";
      if (which === 0) {
        const p = run.player;
        const a = angleTo(boss.x, boss.y, p.x, p.y);
        boss.chargeDirX = Math.cos(a);
        boss.chargeDirY = Math.sin(a);
        boss.act = {
          mode: "charge",
          speed: boss.phase === 3 ? 900 : boss.phase === 2 ? 780 : 660,
          timer: boss.phase === 3 ? 0.95 : 0.7,
          tick: 0,
        };
        Sfx.bossRoar();
      } else if (which === 1) {
        for (let i = 0; i < 2; i++) {
          const spot = pointInArena(run.rng, ARENA, 90);
          run.enemies.push(makeEnemy(run, "bellhusk", spot.x, spot.y));
          burst(run, spot.x, spot.y, run.palette.warm, 12, 160);
        }
        boss.timer = boss.phase === 3 ? 1.1 : 1.7;
      } else {
        boss.act = { mode: "bellRings", timer: 2.0, tick: 0, shots: boss.phase === 3 ? 3 : 2 };
      }
      boss.pending = null;
    }
    return;
  }

  boss.timer -= dt;
  if (boss.timer <= 0) {
    boss.pending = pickAttack(boss, 3);
    boss.state = "tell";
    boss.telegraph = boss.phase === 3 ? 0.55 : 0.85;
    if (boss.pending === 2) Sfx.bossRoar();
  }
}

function updateBlindLamp(run, boss, dt) {
  // The arena darkens around the player for the whole fight, and deepens per phase.
  run.darkPool = Math.min(1, run.darkPool + dt * 0.9);

  if (boss.phase === 3) {
    // Final phase: the Lamp mirrors the player's movement across the arena centre.
    const p = run.player;
    const tx = ARENA.cx + (ARENA.cx - p.x) * 0.72;
    const ty = ARENA.cy + (ARENA.cy - p.y) * 0.72;
    boss.x += (tx - boss.x) * Math.min(1, dt * 3.2);
    boss.y += (ty - boss.y) * Math.min(1, dt * 3.2);
  } else {
    // It hovers slowly, keeping its distance.
    const p = run.player;
    const a = angleTo(boss.x, boss.y, p.x, p.y) + Math.PI;
    boss.x += (Math.cos(a) * 26 - (boss.x - ARENA.cx) * 0.2) * dt;
    boss.y += (Math.sin(a) * 26 - (boss.y - ARENA.cy) * 0.2) * dt;
  }

  if (boss.act) return;

  if (boss.state === "tell") {
    if (boss.telegraph <= 0) {
      const which = boss.pending;
      const p = run.player;
      boss.state = "idle";
      if (which === 0) {
        boss.act = {
          mode: "spiral",
          ox: boss.x,
          oy: boss.y,
          angle: boss.t,
          arms: boss.phase === 3 ? 3 : 2,
          spin: 0.62,
          speed: 205,
          timer: boss.phase === 3 ? 2.6 : 2.0,
          tick: 0,
          interval: 0.1,
        };
      } else if (which === 1) {
        burst(run, boss.x, boss.y, run.palette.accent, 18, 240);
        const spot = pointInArena(run.rng, ARENA, 140);
        boss.x = spot.x;
        boss.y = spot.y;
        burst(run, boss.x, boss.y, run.palette.pale, 20, 260);
        spawnSpread(run, boss.x, boss.y, angleTo(boss.x, boss.y, p.x, p.y), 5, 0.18, 240, { r: 8 });
        if (boss.phase >= 2) {
          run.enemies.push(makeEnemy(run, "echo", clamp(spot.x + 120, ARENA.x + 80, ARENA.x + ARENA.w - 80), spot.y));
        }
        boss.timer = boss.phase === 3 ? 0.8 : 1.4;
      } else {
        // The lamp stares: a tight aimed burst that tracks the player.
        spawnSpread(run, boss.x, boss.y, angleTo(boss.x, boss.y, p.x, p.y), 3, 0.1, 300, { r: 7 });
        spawnSpread(run, boss.x, boss.y, angleTo(boss.x, boss.y, p.x, p.y), 3, 0.3, 250, { r: 7 });
        boss.timer = boss.phase === 3 ? 0.7 : 1.2;
      }
      boss.pending = null;
    }
    return;
  }

  boss.timer -= dt;
  if (boss.timer <= 0) {
    boss.pending = pickAttack(boss, 3);
    boss.state = "tell";
    boss.telegraph = boss.phase === 3 ? 0.4 : 0.7;
  }
}

export function bossDeathBurst(run, boss) {
  burst(run, boss.x, boss.y, boss.palette.pale, 60, 420);
  burst(run, boss.x, boss.y, boss.palette.accent, 40, 300);
  embers(run, boss.x, boss.y, boss.palette.warm, 30);
  run.shake = 1.2;
  run.hitstop = 0.16;
  run.flash = 0.7;
  Sfx.bigKill();
}

export { dist };
