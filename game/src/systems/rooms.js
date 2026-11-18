// Room composition: what spawns in a room, in what order, and when the room is cleared.
// The first room of a floor can be an elite room (tougher, richer) or a rest room (a heal).
import { FLOORS, ROOMS_PER_FLOOR, SCORE, SALVAGE } from "../config.js";
import { randInt, pick, shuffle } from "../random.js";
import { spawnAtEdge } from "../entities/enemies.js";
import { makeBoss } from "../entities/bosses.js";
import { isBossRoom, floorOf, addScore, healHull, addSalvage } from "../run.js";

// The three fight rooms of a floor get bigger and more mixed as you go.
const ROOM_SIZES = [4, 6, 8];

export function planRoom(run, elite = false) {
  const floor = floorOf(run);
  const base = ROOM_SIZES[Math.min(run.room, ROOM_SIZES.length - 1)];
  const size = elite ? base + 3 : base;
  const roster = floor.enemies;
  const plan = [];

  // Room 1 leans on the first creature; later rooms use the whole roster.
  const kinds = run.room === 0 && !elite ? [roster[0], roster[0], roster[1]] : roster.slice();
  for (let i = 0; i < size; i++) {
    plan.push(pick(run.rng, kinds));
  }
  // Guarantee at least two distinct creatures once the room has room for them.
  const distinct = new Set(plan);
  if (distinct.size < 2) plan[plan.length - 1] = roster[1];

  const gap = 0.52 - Math.min(0.2, run.floor * 0.05);
  return shuffle(run.rng, plan).map((kind, i) => ({
    kind,
    at: 0.5 + i * gap + randInt(run.rng, 0, 3) * 0.05,
    tough: elite ? 1.45 : 1,
    bounty: elite ? 1.8 : 1,
  }));
}

export function beginRoom(run) {
  const mod = run.room === 0 ? run.roomMod : null;
  if (mod === "rest") {
    // A rest room has no fight in it: the door closes, the hull comes back, the room clears.
    healHull(run, 2);
    addSalvage(run, SALVAGE.restBonus);
    return {
      boss: false,
      rest: true,
      elite: false,
      queue: [],
      timer: 0,
      spawnedAll: true,
      clearDelay: 0,
      cleared: false,
      total: 0,
    };
  }
  const elite = mod === "elite";
  return {
    boss: false,
    rest: false,
    elite,
    queue: planRoom(run, elite),
    timer: 0,
    spawnedAll: false,
    clearDelay: 0,
    cleared: false,
    total: 0,
  };
}

export function beginBossRoom(run) {
  run.boss = makeBoss(run, floorOf(run).boss);
  return {
    boss: true,
    rest: false,
    elite: false,
    queue: [],
    timer: 0,
    spawnedAll: true,
    clearDelay: 0,
    cleared: false,
    total: 1,
  };
}

export function enterRoom(run) {
  run.palette = floorOf(run).palette;
  run.ebullets = [];
  run.pbolts = [];
  run.rings = [];
  run.enemies = [];
  run.boss = null;
  run.pickups = [];
  run.salvageDrops = [];
  run.arcs = [];
  run.darkPool = 0;
  run.roomState = isBossRoom(run) ? beginBossRoom(run) : beginRoom(run);
  run.roomState.total = run.roomState.boss ? 1 : run.roomState.queue.length;
}

// Advances the spawn queue and reports the frame the room is cleared, exactly once.
export function stepRoom(run, dt) {
  const st = run.roomState;
  if (!st || st.cleared) return false;

  st.timer += dt;
  while (st.queue.length && st.queue[0].at <= st.timer) {
    const entry = st.queue.shift();
    run.enemies.push(spawnAtEdge(run, entry.kind, { tough: entry.tough, bounty: entry.bounty }));
  }
  if (!st.queue.length) st.spawnedAll = true;

  const empty = st.boss ? (!run.boss || !run.boss.alive) : run.enemies.length === 0;
  if (st.spawnedAll && empty) {
    st.clearDelay += dt;
    if (st.clearDelay > (st.boss ? 1.2 : st.rest ? 0.9 : 0.6)) {
      st.cleared = true;
      return true;
    }
  }
  return false;
}

// What clearing the room pays: score, the room bonus, salvage, hull regen, and the next step.
export function completeRoom(run) {
  const before = run.score;
  run.roomsCleared += 1;
  addScore(run, SCORE.roomClear);
  if (run.build.hullRegen > 0) healHull(run, run.build.hullRegen);
  if (run.relics.includes("tallowheart")) healHull(run, 1);

  const st = run.roomState;
  const elite = !!(st && st.elite);
  addSalvage(run, SALVAGE.roomClear + (elite ? SALVAGE.eliteBonus : 0));

  const bossRoom = isBossRoom(run);
  if (bossRoom) {
    run.bossKills += 1;
    addScore(run, SCORE.boss);
    return {
      draft: false,
      boss: true,
      elite: false,
      floorUp: run.floor < FLOORS.length - 1,
      victory: run.floor >= FLOORS.length - 1,
      gain: run.score - before,
    };
  }
  return { draft: true, boss: false, elite, floorUp: false, victory: false, gain: run.score - before };
}

export function advanceAfterDraft(run) {
  run.room += 1;
  run.routeIndex += 1;
  enterRoom(run);
}

export { ROOMS_PER_FLOOR };
