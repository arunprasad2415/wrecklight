// Screenshot mode: ?shot=play|title|draft|results&seed=N composes one exact, complete frame
// and draws it once. No animation loop runs, so a headless browser captures it deterministically.
import { ARENA, BOSSES, FLOORS, ROOMS_PER_FLOOR, ROUTE_PER_FLOOR, SALVAGE } from "./config.js";
import { mulberry32, dist, angleTo, rand } from "./random.js";
import { makeBoss } from "./entities/bosses.js";
import { makeEnemy } from "./entities/enemies.js";
import { spawnEnemyBullet } from "./entities/projectiles.js";
import { burst, spray, damageNumber, makeParticle } from "./entities/particles.js";
import { draftChoices } from "./systems/upgrades.js";
import { grantBossRelic } from "./systems/relics.js";
import { openShop } from "./systems/shop.js";

function setBuild(run, taken) {
  const b = run.build;
  b.taken = {};
  for (const [id, n] of Object.entries(taken)) {
    b.taken[id] = n;
  }
}

function tunePlayBuild(run) {
  setBuild(run, {
    dmg: 4, firerate: 2, beamwidth: 2, heatcap: 1, maxhull: 1, crit: 2, pierce: 1, speed: 1, chain: 1,
  });
  const b = run.build;
  b.damage = 1 + 0.18 * 4 + 0.25; // four damage cards plus the Brass Lens
  b.fireRate = 1 + 0.22 * 2;
  b.beamWidth = 1 + 0.25 * 2;
  b.heatCap = 100 + 35;
  b.maxHull = 6;
  b.crit = 0.24;
  b.pierce = 1;
  b.speed = 1.12;
  b.chain = 2;
}

function placeBullet(run, x, y, angle, speed, travel, opts) {
  spawnEnemyBullet(run, x + Math.cos(angle) * travel, y + Math.sin(angle) * travel, angle, speed, opts);
}

// A comet trail: particles laid along a curve, each slightly younger than the last, so the
// still frame shows a streak rather than a single dot.
function trail(run, x0, y0, cx, cy, x1, y1, color, count, size) {
  for (let i = 0; i < count; i++) {
    const k = i / (count - 1);
    const inv = 1 - k;
    const x = inv * inv * x0 + 2 * inv * k * cx + k * k * x1;
    const y = inv * inv * y0 + 2 * inv * k * cy + k * k * y1;
    const life = 0.22 + k * 0.5;
    run.particles.push(makeParticle(x, y, 0, 0, life, size * (0.5 + k * 0.9), color));
  }
}

function composePlay(run) {
  run.state = "play";
  run.floor = 1;              // The Rust Chapel: amber and rust, the palette that photographs best
  run.room = ROOMS_PER_FLOOR; // the boss room
  run.routeIndex = 1 * ROUTE_PER_FLOOR + 3;
  run.t = 9.4;
  run.time = 402;
  run.score = 18420;
  run.combo = 3.5;
  run.comboTimer = 2.1;
  run.kills = 47;
  run.roomsCleared = 7;
  run.salvage = 47;
  run.banner = 0;
  run.clearBanner = 0;
  run.palette = FLOORS[1].palette;
  tunePlayBuild(run);
  run.relics = ["brasslens", "kelpcord"];

  const pal = FLOORS[1].palette;
  const p = run.player;
  // The lamplighter sits low-left of centre with the beam running up and right: that puts a
  // lit, legible body in the lower-left quadrant instead of an empty corner.
  p.x = 380;
  p.y = 520;
  p.r = 26;
  p.hull = 5;
  p.maxHull = 6;
  p.heat = 61;
  p.overheated = false;
  p.flare = 74;
  p.dashCharges = 1;
  p.dashRecharge = 0.72;
  p.invuln = 0;
  p.beamOn = true;
  p.boltTimer = 0.2;
  p.trail = [];

  // The Bell Warden, mid-second-phase, in the middle of a charge wind-up.
  const boss = makeBoss(run, "bellwarden");
  boss.x = 880;
  boss.y = 300;
  boss.hp = Math.round(boss.maxHp * 0.63);
  boss.phase = 2;
  boss.state = "tell";
  boss.telegraph = 0.5;
  boss.pending = 0;
  boss.t = 6.2;
  run.boss = boss;

  // Five creatures of this floor, drawn large and spread so every silhouette stands clear:
  // the beam's target in the middle, then upper-left, upper-middle, upper-right and right.
  const husk = makeEnemy(run, "bellhusk", 700, 400, { r: 28 });
  husk.hp = Math.round(husk.maxHp * 0.55);
  husk.state = "tell";
  husk.pulse = 0.72;
  husk.timer = 0.18;
  run.enemies.push(husk);

  const hand = makeEnemy(run, "slaghand", 246, 234, { r: 32 });
  hand.hp = Math.round(hand.maxHp * 0.78);
  hand.t = 3.1;
  run.enemies.push(hand);

  const cinder = makeEnemy(run, "cinderling", 556, 198, { r: 30 });
  cinder.vx = -260;
  cinder.vy = 40;
  cinder.state = "tell";
  cinder.pulse = 0.55;
  cinder.timer = 0.3;
  cinder.tellMax = 0.26;
  cinder.harmful = false;
  run.enemies.push(cinder);

  const husk2 = makeEnemy(run, "bellhusk", 1012, 162, { r: 30 });
  husk2.hp = Math.round(husk2.maxHp * 0.82);
  husk2.state = "idle";
  run.enemies.push(husk2);

  const chained = makeEnemy(run, "chainwarden", 1102, 470, { r: 28 });
  chained.angle = angleTo(chained.x, chained.y, p.x, p.y);
  chained.hp = Math.round(chained.maxHp * 0.7);
  run.enemies.push(chained);

  // Bullets in flight: a radial sweep from the bell, aimed fans from the minions, and a drift
  // of strays crossing the lower corners so no quadrant is quiet.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.22;
    placeBullet(run, boss.x, boss.y, a, 158, 112 + (i % 3) * 48, { r: 9, color: pal.pale });
  }
  for (let i = 0; i < 3; i++) {
    const a = angleTo(hand.x, hand.y, p.x, p.y) + (i - 1) * 0.22;
    placeBullet(run, hand.x, hand.y, a, 176, 58 + i * 30, { r: 8, color: pal.accent });
  }
  for (let i = 0; i < 2; i++) {
    const a = angleTo(chained.x, chained.y, p.x, p.y) + (i - 0.5) * 0.18;
    placeBullet(run, chained.x, chained.y, a, 172, 92 + i * 38, { r: 8, color: pal.accent });
  }
  for (let i = 0; i < 2; i++) {
    const a = angleTo(husk2.x, husk2.y, p.x, p.y) + (i - 0.5) * 0.16;
    placeBullet(run, husk2.x, husk2.y, a, 180, 64 + i * 34, { r: 8, color: pal.pale });
  }
  // Slow shots crossing both lower corners, each with a comet tail behind it.
  const drift = [
    [196, 598, 0.16, 128], [252, 690, -0.42, 118], [330, 664, 0.62, 136],
    [148, 556, -0.2, 122], [410, 722, -0.9, 112], [126, 652, 0.36, 130],
    [300, 566, 0.05, 124], [232, 636, -1.15, 120],
    [762, 662, -0.24, 126], [878, 706, 0.32, 118], [1010, 640, 0.14, 132],
    [946, 596, -0.62, 120],
  ];
  for (const [x, y, a, speed] of drift) {
    spawnEnemyBullet(run, x, y, a, speed, { r: 8.5, color: pal.warm });
    trail(run, x - Math.cos(a) * 78, y - Math.sin(a) * 78, x - Math.cos(a) * 40, y - Math.sin(a) * 40 - 6,
      x, y, pal.warm, 8, 3.2);
  }

  // Player bolts in flight from the lantern toward the target.
  const aimAt = angleTo(p.x, p.y, husk.x, husk.y);
  for (let i = 0; i < 3; i++) {
    run.pbolts.push({
      x: p.x + Math.cos(aimAt) * (86 + i * 74),
      y: p.y + Math.sin(aimAt) * (86 + i * 74),
      vx: Math.cos(aimAt) * 760,
      vy: Math.sin(aimAt) * 760,
      r: 5,
      life: 0.9,
      damage: 9,
      pierce: 1,
      hit: [],
    });
  }

  // The beam is burning the husk: aim at it, and stop the light on its near surface so the
  // creature's own silhouette stays readable around the impact.
  const reach = dist(p.x, p.y, husk.x, husk.y) - husk.r;
  p.angle = aimAt;
  p.beamLength = reach;
  p.beamHit = true;
  p.beamHitX = p.x + Math.cos(aimAt) * reach;
  p.beamHitY = p.y + Math.sin(aimAt) * reach;
  const hx = p.beamHitX;
  const hy = p.beamHitY;

  // Impact debris and the three damage numbers stacked just off the landing point.
  burst(run, hx, hy, pal.pale, 16, 250);
  spray(run, hx, hy, p.angle + Math.PI, 0.75, pal.ink, 12, 340);
  burst(run, boss.x - 26, boss.y + 62, pal.warm, 16, 220);
  burst(run, cinder.x - 24, cinder.y + 6, pal.warm, 8, 150);
  burst(run, hand.x + 22, hand.y - 16, pal.warm, 9, 160);
  burst(run, 1040, 300, pal.pale, 7, 120);
  damageNumber(run, hx - 52, hy - 44, 41, "#fff2a8", true);
  damageNumber(run, hx - 96, hy - 78, 23, pal.ink, false);
  damageNumber(run, hx - 30, hy - 104, 18, pal.pale, false);

  // The light's own impact flare, tight around the hit point.
  run.rings.push({
    x: hx, y: hy, r: 10, maxR: 74, speed: 220, damage: 0,
    color: "#fff2a8", width: 5, hitPlayer: false, life: 1.4, kind: "flare",
  });

  // The bell's last toll, rolling out: a wide arc that crosses the lower-left quadrant.
  run.rings.push({
    x: boss.x,
    y: boss.y,
    r: 520,
    maxR: 760,
    speed: 150,
    damage: 0,
    color: pal.pale,
    width: 11,
    hitPlayer: false,
    life: 2,
    kind: "shock",
  });
  // A second, tighter toll so the sweep has depth.
  run.rings.push({
    x: boss.x,
    y: boss.y,
    r: 300,
    maxR: 470,
    speed: 190,
    damage: 0,
    color: pal.warm,
    width: 5,
    hitPlayer: false,
    life: 2,
    kind: "shock",
  });

  // Particle trails: arcs of drifting sparks across the emptier corners.
  trail(run, 96, 700, 210, 604, 348, 640, pal.warm, 18, 3.2);
  trail(run, 62, 556, 156, 690, 312, 728, pal.pale, 16, 2.6);
  trail(run, 476, 692, 366, 738, 208, 700, pal.warm, 14, 2.8);
  trail(run, 900, 720, 1000, 660, 1104, 690, pal.warm, 14, 2.8);
  for (let i = 0; i < 16; i++) {
    const a = rand(run.rng, 0, Math.PI * 2);
    const r = rand(run.rng, 40, 210);
    run.particles.push(
      makeParticle(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r,
        Math.cos(a) * 22, Math.sin(a) * 22, rand(run.rng, 0.4, 1.0), rand(run.rng, 1.8, 3.6), pal.pale),
    );
  }

  // Two salvage tags on the floor, so the new currency is visible in the cover too.
  run.salvageDrops = [
    { x: 300, y: 592, r: 9, phase: 1.1, vx: 0, vy: 0, life: 9, value: 3 },
    { x: 470, y: 668, r: 9, phase: 3.4, vx: 0, vy: 0, life: 9, value: 2 },
  ];
}

// Two extra shot modes for the between-floor screens, so both can be inspected in a browser.
function composeShop(run) {
  run.floor = 1;
  run.room = ROOMS_PER_FLOOR;
  run.routeIndex = 1 * ROUTE_PER_FLOOR + 4;
  run.t = 2;
  run.score = 7314;
  run.kills = 34;
  run.roomsCleared = 4;
  run.salvage = 96;
  run.palette = FLOORS[1].palette;
  setBuild(run, { dmg: 2, firerate: 1, heatcap: 1, wisp: 1 });
  run.build.damage = 1.36;
  run.build.fireRate = 1.22;
  run.relics = ["brasslens"];
  run.lastRelic = "Brass Lens";
  run.player.hull = 4;
  run.player.maxHull = 6;
  openShop(run);
}

function composeRoute(run) {
  run.state = "route";
  run.floor = 1;
  run.room = ROOMS_PER_FLOOR;
  run.routeIndex = 1 * ROUTE_PER_FLOOR + 4;
  run.t = 2;
  run.score = 7314;
  run.kills = 34;
  run.roomsCleared = 4;
  run.salvage = 96;
  run.palette = FLOORS[1].palette;
  run.relics = ["brasslens", "kelpcord"];
  run.player.hull = 4;
  run.player.maxHull = 6;
}

function composeTitle(run) {
  run.state = "title";
  run.t = 0.4;
  run.best = 28460;
  run.floor = 0;
  run.routeIndex = 0;
  run.palette = FLOORS[0].palette;
}

function composeDraft(run) {
  run.state = "draft";
  run.floor = 1;
  run.room = 1;
  run.routeIndex = 1 * ROUTE_PER_FLOOR + 2;
  run.t = 4;
  run.score = 6420;
  run.kills = 31;
  run.roomsCleared = 5;
  run.salvage = 38;
  run.palette = FLOORS[1].palette;
  setBuild(run, { dmg: 2, firerate: 1, heatcap: 1, speed: 1, pierce: 1, wisp: 1 });
  const b = run.build;
  b.damage = 1.36;
  b.fireRate = 1.22;
  b.heatCap = 135;
  b.speed = 1.12;
  b.pierce = 1;
  b.wisp = 1;
  run.relics = ["brasslens", "kelpcord"];
  run.player.hull = 4;
  run.player.maxHull = 5;
  return draftChoices(run, 3);
}

function composeResults(run) {
  run.state = "results";
  run.victory = true;
  run.floor = 2;
  run.room = ROOMS_PER_FLOOR;
  run.routeIndex = 3 * ROUTE_PER_FLOOR - 1;
  run.roomsCleared = 13;
  run.kills = 214;
  run.score = 48260;
  run.best = 48260;
  run.time = 612;
  run.salvage = 64;
  run.t = 2.2;
  run.relics = [];
  grantBossRelic(run);
  grantBossRelic(run);
  grantBossRelic(run);
  run.build.maxHull = 6;
  setBuild(run, {
    dmg: 3, firerate: 2, beamwidth: 1, maxhull: 1, crit: 2, pierce: 1, speed: 1, chain: 1, wisp: 1,
  });
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
  else if (shot === "shop") composeShop(run);
  else if (shot === "route") composeRoute(run);
  else composeTitle(run);

  api.setRun(run);
  if (api.setChoices) api.setChoices(choices || []);
  api.draw();
  return { shot, choices };
}

export { BOSSES, ARENA, SALVAGE };
