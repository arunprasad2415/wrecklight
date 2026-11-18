// Boot, the frame loop and the run state machine: title, play, draft, paused, results.
import { WORLD, FLOORS } from "./config.js";
import { Input } from "./input.js";
import { Sfx } from "./audio.js";
import { mulberry32, rand } from "./random.js";
import { makeRun, startRun, floorOf, tickCombo, finishRun } from "./run.js";
import { updatePlayer } from "./entities/player.js";
import { updateEnemy, separateEnemies } from "./entities/enemies.js";
import { updateBoss, bossDeathBurst } from "./entities/bosses.js";
import { updateProjectiles } from "./entities/projectiles.js";
import { updateParticles, burst } from "./entities/particles.js";
import { stepCombat, useFlare } from "./systems/combat.js";
import { enterRoom, stepRoom, completeRoom, advanceAfterDraft, advanceAfterBoss } from "./systems/rooms.js";
import { draftChoices, applyUpgrade } from "./systems/upgrades.js";
import { grantBossRelic } from "./systems/relics.js";
import { drawBackdrop, drawVignette } from "./render/backdrop.js";
import { drawPlayer, drawEnemy, drawBoss, drawPickup } from "./render/actors.js";
import {
  drawBeam, drawBolts, drawEnemyBullets, drawRings, drawParticles,
  drawNumbers, drawDarkPool, drawFlash, drawBanner, drawHeatWarn,
} from "./render/fx.js";
import { drawHud } from "./ui/hud.js";
import { drawTitle, drawPause, drawResults } from "./ui/screens.js";
import { drawDraft, cardAt } from "./ui/draft.js";
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

function handleRoomCleared() {
  const result = completeRoom(run);
  Sfx.roomClear();

  if (result.boss) {
    bossDeathBurst(run, run.boss);
    const relic = grantBossRelic(run);
    if (result.victory) {
      run.banner = 1.6;
      run.bannerTitle = "THE LIGHT RETURNS";
      run.bannerSub = "";
      Sfx.stopBeam();
      Sfx.stopDrone();
      Sfx.win();
      finishRun(run, true);
      return;
    }
    advanceAfterBoss(run);
    run.banner = 2.2;
    run.bannerTitle = floorOf(run).name.toUpperCase();
    run.bannerSub = relic ? `RELIC TAKEN  ·  ${relic.name.toUpperCase()}` : "DESCENDING";
    run.flash = 0.6;
    Sfx.startDrone(run.floor);
    return;
  }

  choices = draftChoices(run, 3);
  hover = -1;
  run.state = "draft";
  Sfx.stopBeam();
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
  if (events.overheated) Sfx.overheat();

  if (input.flarePressed()) useFlare(run);
  if (run.player.beamOn && !run.player.overheated) Sfx.startBeam();
  else Sfx.stopBeam();

  for (const e of run.enemies) updateEnemy(run, e, dt);
  separateEnemies(run);
  updateBoss(run, run.boss, dt);
  updateProjectiles(run, dt);
  stepCombat(run, dt);
  updateParticles(run, dt);
  tickCombo(run, dt);

  run.shake = Math.max(0, run.shake - dt * 3.2);
  run.flash = Math.max(0, run.flash - dt * 3);
  run.banner = Math.max(0, run.banner - dt);
  if (run.darkPool > 0 && (!run.boss || !run.boss.alive)) {
    run.darkPool = Math.max(0, run.darkPool - dt * 1.5);
  }

  if (run.state !== "play") return;
  if (stepRoom(run, dt)) handleRoomCleared();
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
  for (const e of run.enemies) drawEnemy(ctx, e, pal, run.t);
  drawBoss(ctx, run.boss, pal, run.t);
  drawBolts(ctx, run.pbolts, pal);
  drawEnemyBullets(ctx, run.ebullets, run.t);
  drawPlayer(ctx, run.player, pal, run.t);
  drawBeam(ctx, run, pal, run.t);
  drawParticles(ctx, run.particles);
  drawNumbers(ctx, run.numbers);
  drawDarkPool(ctx, run);
  drawHeatWarn(ctx, run, pal);
  drawVignette(ctx);
  drawFlash(ctx, run, pal);
  drawBanner(ctx, run, pal);
  ctx.restore();
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

// A screenshot is a still of the game, so no pointer may sit in the frame.
if (shot) canvas.style.cursor = "none";

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
