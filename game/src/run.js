// The run: which floor and room, the score and combo, the build, the relics, the clock.
// This module owns state and the small helpers that change it; nothing here draws.
import { FLOORS, PLAYER, SCORE, FLARE, SALVAGE, ROUTE_PER_FLOOR, ROOMS_PER_FLOOR } from "./config.js";
import { mulberry32, clamp } from "./random.js";
import { makePlayer, resetPlayer } from "./entities/player.js";

const BEST_KEY = "wrecklight-best";

function readBest() {
  try {
    return Number(window.localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch (err) {
    return 0;
  }
}

function writeBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch (err) {
    /* storage can be unavailable; the run still works */
  }
}

// Every upgrade multiplies or adds into this object, so a build is one plain record.
export function makeBuild() {
  return {
    damage: 1,
    fireRate: 1,
    beamWidth: 1,
    heatCap: 100,
    dashCharges: 2,
    dashDamage: 0,
    flareRadius: 1,
    flareRecharge: 1,
    maxHull: PLAYER.hullBase,
    hullRegen: 0,
    pierce: 0,
    crit: 0,
    speed: 1,
    magnet: 1,
    comboWindow: 1,
    thorns: 0,
    lifesteal: 0,
    slow: 0,
    chain: 0,        // Chain Lightning: arcs on every hit
    wisp: 0,         // Orbiting wisp count
    splitBeam: 0,    // the beam forks into two half-damage rays
    burnTrail: 0,    // the dash leaves a burning wake
    killSlow: 0,     // kills chill everything nearby
    flareBlind: 0,   // flare blinds for a second
    ventShock: 0,    // overheat vents a shockwave instead of just stopping
    lodestone: 0,    // embers and salvage fly in from anywhere
    taken: {},
  };
}

export function makeRun(seed) {
  const run = {
    state: "title",
    seed,
    rng: mulberry32(seed),
    t: 0,
    time: 0,
    floor: 0,
    room: 0,
    score: 0,
    combo: 1,
    comboTimer: 0,
    best: readBest(),
    palette: FLOORS[0].palette,
    player: makePlayer(),
    enemies: [],
    boss: null,
    ebullets: [],
    pbolts: [],
    rings: [],
    particles: [],
    numbers: [],
    pickups: [],
    salvageDrops: [],
    wisps: [],
    arcs: [],
    build: makeBuild(),
    relics: [],
    roomState: null,
    banner: 0,
    bannerTitle: "",
    bannerSub: "",
    clearBanner: 0,
    clearTitle: "",
    clearSub: "",
    hitstop: 0,
    shake: 0,
    chroma: 0,
    flash: 0,
    kills: 0,
    roomsCleared: 0,
    bossKills: 0,
    victory: false,
    darkPool: 0,
    salvage: 0,
    salvageEarned: 0,
    routeIndex: 0,
    roomMod: null,   // "elite" or "rest" for the next room, chosen after a boss
    shop: null,
    routePick: 0,
    shopPick: 0,
  };
  return run;
}

export function startRun(run) {
  run.state = "play";
  run.t = 0;
  run.time = 0;
  run.floor = 0;
  run.room = 0;
  run.score = 0;
  run.combo = 1;
  run.comboTimer = 0;
  run.enemies = [];
  run.boss = null;
  run.ebullets = [];
  run.pbolts = [];
  run.rings = [];
  run.particles = [];
  run.numbers = [];
  run.pickups = [];
  run.salvageDrops = [];
  run.wisps = [];
  run.arcs = [];
  run.build = makeBuild();
  run.relics = [];
  run.palette = FLOORS[0].palette;
  run.kills = 0;
  run.roomsCleared = 0;
  run.bossKills = 0;
  run.victory = false;
  run.hitstop = 0;
  run.shake = 0;
  run.chroma = 0;
  run.flash = 0;
  run.darkPool = 0;
  run.roomState = null;
  run.clearBanner = 0;
  run.salvage = SALVAGE.start;
  run.salvageEarned = 0;
  run.routeIndex = 0;
  run.roomMod = null;
  run.shop = null;
  resetPlayer(run.player, run.build);
}

export const floorOf = (run) => FLOORS[Math.min(run.floor, FLOORS.length - 1)];
export const isBossRoom = (run) => run.room >= ROOMS_PER_FLOOR;
export const totalRooms = FLOORS.length * (ROOMS_PER_FLOOR + 1);

export function roomTitle(run) {
  const floor = floorOf(run);
  if (isBossRoom(run)) return floor.bossName;
  return `ROOM ${run.room + 1} OF ${ROOMS_PER_FLOOR}`;
}

export function addScore(run, base) {
  run.score += Math.round(base * run.combo);
}

export function bumpCombo(run) {
  run.combo = Math.min(SCORE.comboMax, run.combo + SCORE.comboStep);
  run.comboTimer = SCORE.comboWindow * run.build.comboWindow;
}

export function tickCombo(run, dt) {
  run.comboTimer -= dt;
  if (run.comboTimer <= 0 && run.combo > 1) {
    run.combo = Math.max(1, run.combo - dt * 2.4);
    if (run.combo < 1.02) run.combo = 1;
  }
}

// Kills pay score, feed the combo, charge the flare, drop salvage and can heal (lifesteal).
export function registerKill(run, enemy) {
  const p = run.player;
  const base = enemy.score || 10;
  addScore(run, base);
  bumpCombo(run);
  run.kills += 1;
  p.kills += 1;
  p.flare = clamp(p.flare + FLARE.perKill * run.build.flareRecharge, 0, FLARE.max);
  if (run.build.lifesteal > 0 && p.kills % run.build.lifesteal === 0) {
    healHull(run, 1);
  }
}

export function healHull(run, amount) {
  const p = run.player;
  p.hull = Math.min(p.maxHull, p.hull + amount);
}

export function syncMaxHull(run) {
  const p = run.player;
  p.maxHull = run.build.maxHull;
  p.hull = Math.min(p.hull, p.maxHull);
}

export function addSalvage(run, amount) {
  const gain = Math.max(0, Math.round(amount));
  run.salvage += gain;
  run.salvageEarned += gain;
  return gain;
}

// The route strip's cursor: which node of the descent the run is standing on.
export function routeIndexOf(run) {
  return clamp(run.routeIndex | 0, 0, FLOORS.length * ROUTE_PER_FLOOR);
}

export function finishRun(run, victory) {
  run.state = "results";
  run.victory = victory;
  run.priorBest = run.best;
  run.best = Math.max(run.best, run.score);
  writeBest(run.best);
}

export function elapsedLabel(run) {
  const total = Math.floor(run.time);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// A letter rank from the final score, used on the results screen.
export function rankOf(run) {
  const s = run.score;
  if (!run.victory) return s > 30000 ? "B" : s > 16000 ? "C" : "D";
  if (s >= 60000) return "S";
  if (s >= 46000) return "A";
  if (s >= 34000) return "B";
  return "C";
}
