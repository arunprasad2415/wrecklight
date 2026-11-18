// Screenshot mode: ?shot=play|title|draft|results&seed=N composes one exact, complete frame
// and draws it once. No animation loop runs, so a headless browser captures it deterministically.
import { ARENA, BOSSES, FLOORS, ROOMS_PER_FLOOR } from "./config.js";
import { mulberry32, dist, angleTo } from "./random.js";
import { makeBoss } from "./entities/bosses.js";
import { makeEnemy } from "./entities/enemies.js";
import { spawnEnemyBullet, spawnRadial } from "./entities/projectiles.js";
import { burst, spray, damageNumber } from "./entities/particles.js";
import { draftChoices } from "./systems/upgrades.js";
import { grantBossRelic } from "./systems/relics.js";

function setBuild(run, taken) {
  const b = run.build;
  b.taken = {};
  for (const [id, n] of Object.entries(taken)) {
    b.taken[id] = n;
  }
}

function tunePlayBuild(run) {
  setBuild(run, { dmg: 4, firerate: 2, beamwidth: 2, heatcap: 1, maxhull: 1, crit: 2, pierce: 1, speed: 1 });
  const b = run.build;
  b.damage = 1 + 0.18 * 4 + 0.25; // four damage cards plus the Brass Lens
  b.fireRate = 1 + 0.22 * 2;
  b.beamWidth = 1 + 0.25 * 2;
  b.heatCap = 100 + 35;
  b.maxHull = 6;
  b.crit = 0.24;
  b.pierce = 1;
  b.speed = 1.12;
}

function placeBullet(run, x, y, angle, speed, travel, opts) {
  spawnEnemyBullet(run, x + Math.cos(angle) * travel, y + Math.sin(angle) * travel, angle, speed, opts);
}

function composePlay(run) {
  run.state = "play";
  run.floor = 1;              // The Rust Chapel
  run.room = ROOMS_PER_FLOOR; // the boss room
  run.t = 9.4;
  run.time = 402;
  run.score = 18420;
  run.combo = 3.5;
  run.comboTimer = 2.1;
  run.kills = 47;
  run.roomsCleared = 7;
  run.palette = FLOORS[1].palette;
  tunePlayBuild(run);
  run.relics = ["brasslens"];

  const pal = FLOORS[1].palette;
  const p = run.player;
  p.x = 430;
  p.y = 470;
  p.hull = 4;
  p.maxHull = 6;
  p.heat = 61;
  p.overheated = false;
  p.flare = 74;
  p.dashCharges = 1;
  p.dashRecharge = 0.72;
  p.invuln = 0;
  p.beamOn = true;
  p.boltTimer = 0.2;

  // The Bell Warden, mid-second-phase, in the middle of a charge wind-up.
  const boss = makeBoss(run, "bellwarden");
  boss.x = 880;
  boss.y = 330;
  boss.hp = Math.round(boss.maxHp * 0.62);
  boss.phase = 2;
  boss.state = "tell";
  boss.telegraph = 0.5;
  boss.pending = 0;
  boss.t = 6.2;
  run.boss = boss;

  // Four creatures of this floor, spread so every silhouette stands clear:
  // the beam's target in the middle, two across the upper half, one on the right.
  const husk = makeEnemy(run, "bellhusk", 700, 402);
  husk.hp = Math.round(husk.maxHp * 0.55);
  husk.state = "tell";
  husk.pulse = 0.72;
  husk.timer = 0.18;
  run.enemies.push(husk);

  const husk2 = makeEnemy(run, "bellhusk", 292, 214);
  husk2.hp = Math.round(husk2.maxHp * 0.8);
  run.enemies.push(husk2);

  const cinder = makeEnemy(run, "cinderling", 646, 190);
  cinder.vx = -300;
  cinder.vy = 40;
  cinder.state = "act";
  cinder.harmful = true;
  run.enemies.push(cinder);

  const chained = makeEnemy(run, "chainwarden", 1086, 486);
  chained.angle = angleTo(chained.x, chained.y, p.x, p.y);
  chained.hp = Math.round(chained.maxHp * 0.7);
  run.enemies.push(chained);

  // Bullets in flight: a radial sweep from the bell, already spread across the arena,
  // plus aimed fans from two of the minions.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.22;
    placeBullet(run, boss.x, boss.y, a, 158, 112 + (i % 3) * 48, { r: 8, color: pal.pale });
  }
  for (let i = 0; i < 3; i++) {
    const a = angleTo(husk2.x, husk2.y, p.x, p.y) + (i - 1) * 0.2;
    placeBullet(run, husk2.x, husk2.y, a, 180, 64 + i * 32, { r: 7, color: pal.accent });
  }
  for (let i = 0; i < 2; i++) {
    const a = angleTo(chained.x, chained.y, p.x, p.y) + (i - 0.5) * 0.18;
    placeBullet(run, chained.x, chained.y, a, 172, 92 + i * 38, { r: 7, color: pal.accent });
  }

  // Player bolts in flight from the lantern toward the target.
  for (let i = 0; i < 3; i++) {
    const a = angleTo(p.x, p.y, husk.x, husk.y);
    run.pbolts.push({
      x: p.x + Math.cos(a) * (86 + i * 74),
      y: p.y + Math.sin(a) * (86 + i * 74),
      vx: Math.cos(a) * 760,
      vy: Math.sin(a) * 760,
      r: 5,
      life: 0.9,
      damage: 9,
      pierce: 1,
      hit: [],
    });
  }

  // The beam is burning the husk: aim at it and stop the light on its body.
  p.angle = angleTo(p.x, p.y, husk.x, husk.y);
  p.beamLength = dist(p.x, p.y, husk.x, husk.y) - husk.r;
  p.beamHit = true;
  p.beamHitX = husk.x - 6;
  p.beamHitY = husk.y + 4;

  // Impact debris and damage numbers around the beam's landing point.
  burst(run, husk.x, husk.y, pal.pale, 14, 240);
  spray(run, husk.x, husk.y, p.angle + Math.PI, 0.7, pal.ink, 9, 300);
  burst(run, boss.x - 26, boss.y + 62, pal.warm, 16, 220);
  burst(run, cinder.x - 24, cinder.y + 6, pal.warm, 8, 150);
  burst(run, 1040, 300, pal.pale, 7, 120);
  damageNumber(run, husk.x + 44, husk.y - 34, 41, "#fff2a8", true);
  damageNumber(run, husk.x - 48, husk.y + 26, 23, pal.ink, false);
  damageNumber(run, boss.x - 78, boss.y + 88, 18, pal.pale, false);

  // A shockwave ring rolling out of the bell's last toll.
  run.rings.push({
    x: boss.x,
    y: boss.y,
    r: 168,
    maxR: 420,
    speed: 300,
    damage: 0,
    color: pal.pale,
    width: 12,
    hitPlayer: false,
    life: 2,
    kind: "shock",
  });
}

function composeTitle(run) {
  run.state = "title";
  run.t = 1.35;
  run.best = 28460;
  run.floor = 0;
  run.palette = FLOORS[0].palette;
}

function composeDraft(run) {
  run.state = "draft";
  run.floor = 1;
  run.room = 1;
  run.t = 4;
  run.score = 6420;
  run.kills = 31;
  run.roomsCleared = 5;
  run.palette = FLOORS[1].palette;
  setBuild(run, { dmg: 2, firerate: 1, heatcap: 1, speed: 1, pierce: 1 });
  const b = run.build;
  b.damage = 1.36;
  b.fireRate = 1.22;
  b.heatCap = 135;
  b.speed = 1.12;
  b.pierce = 1;
  run.relics = ["brasslens"];
  run.player.hull = 4;
  run.player.maxHull = 5;
  return draftChoices(run, 3);
}

function composeResults(run) {
  run.state = "results";
  run.victory = true;
  run.floor = 2;
  run.room = ROOMS_PER_FLOOR;
  run.roomsCleared = 12;
  run.kills = 214;
  run.score = 48260;
  run.best = 48260;
  run.time = 612;
  run.t = 2.2;
  run.relics = [];
  grantBossRelic(run);
  grantBossRelic(run);
  grantBossRelic(run);
  run.build.maxHull = 6;
  setBuild(run, { dmg: 3, firerate: 2, beamwidth: 1, maxhull: 1, crit: 2, pierce: 1, speed: 1 });
  run.player.maxHull = 6;
  run.player.hull = 4;
}

export function applyShot(api) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get("shot");
  if (!shot) return null;

  const seed = Number(params.get("seed") || 1);
  const run = api.newRun(seed);
  run.rng = mulberry32(seed);
  run.decor = null;
  let choices = null;

  if (shot === "play") composePlay(run);
  else if (shot === "draft") choices = composeDraft(run);
  else if (shot === "results") composeResults(run);
  else composeTitle(run);

  api.setRun(run);
  if (api.setChoices) api.setChoices(choices || []);
  api.draw();
  return { shot, choices };
}

export { BOSSES, ARENA };
