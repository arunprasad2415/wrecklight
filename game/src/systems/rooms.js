// Room composition: what spawns in a room, in what order, and when the room is cleared.
import { FLOORS, ROOMS_PER_FLOOR, SCORE } from "../config.js";
import { randInt, pick, shuffle } from "../random.js";
import { spawnAtEdge } from "../entities/enemies.js";
import { makeBoss } from "../entities/bosses.js";
import { isBossRoom, floorOf, addScore, healHull } from "../run.js";

// The three fight rooms of a floor get bigger and more mixed as you go.
const ROOM_SIZES = [4, 6, 8];

export function planRoom(run) {
  const floor = floorOf(run);
  const size = ROOM_SIZES[Math.min(run.room, ROOM_SIZES.length - 1)];
  const roster = floor.enemies;
  const plan = [];

  // Room 1 leans on the first creature; later rooms use the whole roster.
  const kinds = run.room === 0 ? [roster[0], roster[0], roster[1]] : roster.slice();
  for (let i = 0; i < size; i++) {
    plan.push(pick(run.rng, kinds));
  }
  // Guarantee at least two distinct creatures once the room has room for them.
  const distinct = new Set(plan);
  if (distinct.size < 2) plan[plan.length - 1] = roster[1];

  return shuffle(run.rng, plan).map((kind, i) => ({
    kind,
    at: 0.5 + i * (0.52 - Math.min(0.2, run.floor * 0.05)) + randInt(run.rng, 0, 3) * 0.05,
  }));
}

export function beginRoom(run) {
  return {
    boss: false,
    queue: planRoom(run),
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
    run.enemies.push(spawnAtEdge(run, entry.kind));
  }
  if (!st.queue.length) st.spawnedAll = true;

  const empty = st.boss ? (!run.boss || !run.boss.alive) : run.enemies.length === 0;
  if (st.spawnedAll && empty) {
    st.clearDelay += dt;
    if (st.clearDelay > (st.boss ? 1.2 : 0.6)) {
      st.cleared = true;
      return true;
    }
  }
  return false;
}

// What clearing the room pays: score, the room bonus, hull regen, and the next step.
export function completeRoom(run) {
  run.roomsCleared += 1;
  addScore(run, SCORE.roomClear);
  if (run.build.hullRegen > 0) healHull(run, run.build.hullRegen);
  if (run.relics.includes("tallowheart")) healHull(run, 1);

  const bossRoom = isBossRoom(run);
  if (bossRoom) {
    run.bossKills += 1;
    addScore(run, SCORE.boss);
    return { draft: false, boss: true, floorUp: run.floor < FLOORS.length - 1, victory: run.floor >= FLOORS.length - 1 };
  }
  return { draft: true, boss: false, floorUp: false, victory: false };
}

export function advanceAfterDraft(run) {
  run.room += 1;
  enterRoom(run);
}

export function advanceAfterBoss(run) {
  if (run.floor >= FLOORS.length - 1) return false;
  run.floor += 1;
  run.room = 0;
  enterRoom(run);
  return true;
}

export { ROOMS_PER_FLOOR };
