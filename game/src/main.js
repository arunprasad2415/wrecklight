// Boot, the frame loop and the run state machine: title, play, draft, shop, route, paused, results.
import { WORLD, FLOORS, FEEL, ROOMS_PER_FLOOR, ROUTE_PER_FLOOR } from "./config.js";
import { Input } from "./input.js";
import { Sfx } from "./audio.js";
import { mulberry32, rand } from "./random.js";
import { makeRun, startRun, floorOf, tickCombo, finishRun, addSalvage } from "./run.js";
import { updatePlayer } from "./entities/player.js";
import { updateEnemy, separateEnemies } from "./entities/enemies.js";
import { updateBoss, bossDeathBurst } from "./entities/bosses.js";
import { updateProjectiles } from "./entities/projectiles.js";
import { updateParticles, burst } from "./entities/particles.js";
import { stepCombat, useFlare, updateWisps, ventShock } from "./systems/combat.js";
import { enterRoom, stepRoom, completeRoom, advanceAfterDraft } from "./systems/rooms.js";
import { draftChoices, applyUpgrade } from "./systems/upgrades.js";
import { grantBossRelic } from "./systems/relics.js";
import { openShop, buyShopItem } from "./systems/shop.js";
import { drawBackdrop, drawVignette } from "./render/backdrop.js";
import { drawPlayer, drawEnemy, drawBoss, drawPickup, drawSalvage, drawWisp } from "./render/actors.js";
import {
  drawBeam, drawBolts, drawEnemyBullets, drawRings, drawParticles,
  drawNumbers, drawDarkPool, drawFlash, drawBanner, drawHeatWarn,
  drawRoomClear, drawLowHull, drawArcs,
} from "./render/fx.js";
import { drawHud } from "./ui/hud.js";
import { drawTitle, drawPause, drawResults } from "./ui/screens.js";
import { drawDraft, cardAt } from "./ui/draft.js";
import { drawShop, drawRouteChoice, shopItemAt, routeCardAt } from "./ui/shop.js";
import { applyShot } from "./shots.js";

const canvas = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const input = new Input(canvas);
input.onFirstGesture = () => Sfx.unlock();

let run = makeRun(Date.now() % 100000);
let choices = [];
let hover = -1;

function freshSeed() {
  return (Date.now() + Math.floor(Math.random() * 99991)) % 1000000;
}

// A new run from the title or the results screen.
function startGame() {
  const seed = freshSeed();
  const best = run.best;
  run = makeRun(seed);
  run.best = best;
  startRun(run);
  run.rng = mulberry32(seed);
  run.decor = null;
  enterRoom(run);
  run.banner = 1.8;
  run.bannerTitle = FLOORS[0].name.toUpperCase();
  run.bannerSub = "FLOOR 1  ·  RELIGHT THE TOWER";
  Sfx.startDrone(0);
}

function pickChoice(index) {
  const upgrade = choices[index];
  if (!upgrade) return;
  applyUpgrade(run, upgrade);
  advanceAfterDraft(run);
  run.state = "play";
  run.banner = 1.3;
  run.bannerTitle = `ROOM ${run.room + 1}`;
  run.bannerSub = upgrade.name.toUpperCase();
}

// After a room clears, a short beat lands the ROOM CLEAR banner before the next screen.
function handleRoomCleared() {
  const result = completeRoom(run);
  Sfx.roomClear();
  run.clearBanner = FEEL.clearBanner;
  run.clearTitle = result.boss ? "KEEPER DOWN" : "ROOM CLEAR";
  run.clearSub = result.boss
    ? `${floorOf(run).bossName}   +${result.gain}`
    : `ROOM ${Math.min(run.room + 1, ROOMS_PER_FLOOR)} OF ${ROOMS_PER_FLOOR}   +${result.gain}`;
  run.pending = { kind: result.boss ? "boss" : "draft", t: result.boss ? 1.5 : 0.95 };
}

function afterClear(kind) {
  if (kind === "boss") {
    const victory = run.floor >= FLOORS.length - 1;
    bossDeathBurst(run, run.boss);
    const relic = grantBossRelic(run);
    if (victory) {
      run.banner = 1.6;
      run.bannerTitle = "THE LIGHT RETURNS";
      run.bannerSub = "";
      Sfx.stopBeam();
      Sfx.stopDrone();
      Sfx.win();
      finishRun(run, true);
      return;
    }
    run.lastRelic = relic ? relic.name : "";
    // The route cursor steps onto this floor's shop node.
    run.routeIndex = run.floor * ROUTE_PER_FLOOR + ROUTE_PER_FLOOR - 1;
    openShop(run);
    Sfx.stopBeam();
    return;
  }
  choices = draftChoices(run, 3);
  hover = -1;
  run.state = "draft";
  Sfx.stopBeam();
}

function leaveShop() {
  run.state = "route";
  run.routePick = 0;
  Sfx.uiMove();
}

function takeRoute(which) {
  run.roomMod = which === 0 ? "elite" : "rest";
  run.floor += 1;
  run.room = 0;
  run.routeIndex = run.floor * ROUTE_PER_FLOOR;
  run.state = "play";
  enterRoom(run);
  run.banner = 1.8;
  run.bannerTitle = floorOf(run).name.toUpperCase();
  run.bannerSub = run.roomMod === "elite"
    ? "ELITE ROOM  ·  MORE SALVAGE"
    : "REST ROOM  ·  HULL RESTORED";
  run.flash = 0.45;
  Sfx.startDrone(run.floor);
  Sfx.uiPick();
}

function updatePlay(dt) {
  if (run.hitstop > 0) {
    run.hitstop = Math.max(0, run.hitstop - dt);
    run.shake = Math.max(0, run.shake - dt * 3);
    return;
  }

  run.time += dt;
  const events = updatePlayer(run, input, dt);
  if (events.dashed) Sfx.dash();
  if (events.overheated) {
    Sfx.overheat();
    ventShock(run);
  }

  if (input.flarePressed()) useFlare(run);
  if (run.player.beamOn && !run.player.overheated) Sfx.startBeam();
  else Sfx.stopBeam();

  for (const e of run.enemies) updateEnemy(run, e, dt);
  separateEnemies(run);
  updateBoss(run, run.boss, dt);
  updateProjectiles(run, dt);
  stepCombat(run, dt);
  updateWisps(run, dt);
  updateParticles(run, dt);
  tickCombo(run, dt);

  run.shake = Math.max(0, run.shake - dt * 3.2);
  run.chroma = Math.max(0, run.chroma - dt * 3.4);
  run.flash = Math.max(0, run.flash - dt * 3);
  run.banner = Math.max(0, run.banner - dt);
  run.clearBanner = Math.max(0, run.clearBanner - dt);
  if (run.darkPool > 0 && (!run.boss || !run.boss.alive)) {
    run.darkPool = Math.max(0, run.darkPool - dt * 1.5);
  }

  if (run.state !== "play") return;
  if (stepRoom(run, dt)) handleRoomCleared();

  if (run.pending) {
    run.pending.t -= dt;
    if (run.pending.t <= 0) {
      const kind = run.pending.kind;
      run.pending = null;
      afterClear(kind);
    }
  }
}

function update(dt) {
  run.t += dt;

  if (run.state === "title") {
    if (input.hit("enter") || input.hit(" ") || input.clicked) {
      Sfx.uiPick();
      startGame();
    }
    input.endFrame();
    return;
  }

  if (run.state === "results") {
    if (input.hit("r") || input.hit("enter") || input.clicked) {
      Sfx.uiPick();
      startGame();
    }
    input.endFrame();
    return;
  }

  if (run.state === "draft") {
    if (input.hit("1")) pickChoice(0);
    else if (input.hit("2")) pickChoice(1);
    else if (input.hit("3")) pickChoice(2);
    else if (input.clicked) {
      const index = cardAt(input.mouse.x, input.mouse.y);
      if (index >= 0) pickChoice(index);
    }
    input.endFrame();
    return;
  }

  if (run.state === "shop") {
    if (input.hit("1")) buyShopItem(run, 0);
    else if (input.hit("2")) buyShopItem(run, 1);
    else if (input.hit("3")) buyShopItem(run, 2);
    else if (input.clicked) {
      const index = shopItemAt(input.mouse.x, input.mouse.y);
      if (index >= 0) buyShopItem(run, index);
    }
    if (input.hit("enter", "escape")) leaveShop();
    input.endFrame();
    return;
  }

  if (run.state === "route") {
    if (input.hit("1", "a", "arrowleft")) takeRoute(0);
    else if (input.hit("2", "d", "arrowright")) takeRoute(1);
    else if (input.clicked) {
      const index = routeCardAt(input.mouse.x, input.mouse.y);
      if (index >= 0) takeRoute(index);
    }
    input.endFrame();
    return;
  }

  if (run.state === "paused") {
    if (input.hit("p", "escape")) {
      run.state = "play";
      Sfx.uiMove();
    }
    input.endFrame();
    return;
  }

  if (input.hit("p", "escape")) {
    run.state = "paused";
    Sfx.stopBeam();
    Sfx.uiMove();
    input.endFrame();
    return;
  }

  updatePlay(dt);
  input.endFrame();
}

// A chromatic split on player damage: the frame is re-drawn as a red and a cyan ghost either
// side of itself. Feature-detected, so a browser without canvas filters simply shakes.
const off = document.createElement("canvas");
off.width = WORLD.w;
off.height = WORLD.h;
const offCtx = off.getContext("2d");
let chromaOk = false;
try {
  ctx.filter = "blur(1px)";
  chromaOk = ctx.filter === "blur(1px)";
  ctx.filter = "none";
} catch (err) {
  chromaOk = false;
}

function drawChroma(amount) {
  if (!chromaOk || amount <= 0.03) return;
  const dx = 4 * amount;
  offCtx.globalCompositeOperation = "copy";
  offCtx.filter = "none";
  offCtx.drawImage(canvas, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.18 * amount;
  ctx.filter = "sepia(1) saturate(7) hue-rotate(-40deg)";
  ctx.drawImage(off, -dx, 0);
  ctx.filter = "sepia(1) saturate(7) hue-rotate(135deg)";
  ctx.drawImage(off, dx, 0);
  ctx.restore();
}

function drawWorld() {
  const pal = floorOf(run).palette;

  ctx.save();
  if (run.shake > 0) {
    const s = run.shake * 11;
    ctx.translate(rand(run.rng, -1, 1) * s, rand(run.rng, -1, 1) * s);
  }

  drawBackdrop(ctx, run);
  drawRings(ctx, run.rings);
  for (const pickup of run.pickups) drawPickup(ctx, pickup, pal, run.t);
  for (const drop of run.salvageDrops) drawSalvage(ctx, drop, pal, run.t);
  for (const e of run.enemies) drawEnemy(ctx, e, pal, run.t);
  drawBoss(ctx, run.boss, pal, run.t);
  drawBolts(ctx, run.pbolts, pal);
  drawEnemyBullets(ctx, run.ebullets, run.t);
  // The beam goes down before the lamplighter: the body has to sit on top of its own light,
  // or the player reads as a glowing dot lost in the glow.
  drawBeam(ctx, run, pal, run.t);
  drawPlayer(ctx, run.player, pal, run.t);
  for (const w of run.wisps) drawWisp(ctx, w, pal, run.t);
  drawArcs(ctx, run.arcs);
  drawParticles(ctx, run.particles);
  drawNumbers(ctx, run.numbers);
  drawDarkPool(ctx, run);
  drawHeatWarn(ctx, run, pal);
  drawVignette(ctx);
  drawLowHull(ctx, run, pal);
  drawFlash(ctx, run, pal);
  drawBanner(ctx, run, pal);
  drawRoomClear(ctx, run, pal);
  ctx.restore();

  drawChroma(run.chroma);
}

function draw() {
  ctx.clearRect(0, 0, WORLD.w, WORLD.h);

  if (run.state === "title") {
    drawTitle(ctx, run, run.t);
    return;
  }
  if (run.state === "results") {
    drawResults(ctx, run, run.t);
    return;
  }
  if (run.state === "draft") {
    drawDraft(ctx, run, choices, hover, run.t);
    return;
  }
  if (run.state === "shop") {
    drawShop(ctx, run, run.t);
    return;
  }
  if (run.state === "route") {
    drawRouteChoice(ctx, run, run.t);
    return;
  }

  drawWorld();
  drawHud(ctx, run);
  if (run.state === "paused") drawPause(ctx, run, run.t);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  if (run.state === "draft") hover = cardAt(input.mouse.x, input.mouse.y);
  draw();
  requestAnimationFrame(frame);
}

// ?shot=title|play|draft|results&seed=N renders one exact frame instead of starting the loop.
const shot = applyShot({
  newRun: makeRun,
  draw,
  setRun: (r) => {
    run = r;
  },
  setChoices: (c) => {
    choices = c;
  },
});

// A screenshot is a still of the game, so no pointer may sit in the frame: hide it on the
// canvas, the document and the root element, and keep the crosshair off the page entirely.
if (shot) {
  canvas.style.cursor = "none";
  document.body.style.cursor = "none";
  document.documentElement.style.cursor = "none";
  canvas.style.caretColor = "transparent";
}

// A read-only status handle, handy when tuning a run from the console.
window.wrecklightStatus = () => ({
  state: run.state,
  floor: run.floor + 1,
  room: run.room + 1,
  score: run.score,
  combo: Number(run.combo.toFixed(2)),
  kills: run.kills,
  rooms: run.roomsCleared,
  hull: run.player.hull,
  salvage: run.salvage,
  routeIndex: run.routeIndex,
  relicCount: run.relics.length,
  cards: Object.values(run.build.taken).reduce((a, b) => a + b, 0),
  enemies: run.enemies.length,
  nearest: (() => {
    let best = null;
    let bd = 1e9;
    for (const e of run.enemies) {
      const d = (e.x - run.player.x) ** 2 + (e.y - run.player.y) ** 2;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best ? { x: Math.round(best.x), y: Math.round(best.y), dist: Math.round(Math.sqrt(bd)) } : null;
  })(),
  boss: run.boss ? Math.round((run.boss.hp / run.boss.maxHp) * 100) : null,
  bossName: run.boss ? run.boss.name : null,
  bossPos: run.boss && run.boss.alive
    ? {
        x: Math.round(run.boss.nodes ? run.boss.nodes[run.boss.activeNode].x : run.boss.x),
        y: Math.round(run.boss.nodes ? run.boss.nodes[run.boss.activeNode].y : run.boss.y),
      }
    : null,
  time: Number(run.time.toFixed(1)),
});

if (!shot) requestAnimationFrame(frame);
