// Relics: a pool of six, one granted per keeper, shown as icons beside the hull pips.
import { Sfx } from "../audio.js";
import { syncMaxHull, healHull } from "../run.js";

export const RELICS = [
  {
    id: "tallowheart",
    name: "Tallow Heart",
    shape: "heart",
    color: "#ff8f7a",
    desc: "+1 max hull, heal 1 per room",
    apply(run) {
      run.build.maxHull += 1;
      syncMaxHull(run);
      healHull(run, 1);
    },
  },
  {
    id: "brasslens",
    name: "Brass Lens",
    shape: "lens",
    color: "#ffb347",
    desc: "+25% lantern beam damage",
    apply(run) {
      run.build.damage += 0.25;
    },
  },
  {
    id: "kelpcord",
    name: "Kelp Cord",
    shape: "cord",
    color: "#2ee6c8",
    desc: "your dash leaves a burning trail",
    apply() {
      /* the trail is read directly from run.relics in combat */
    },
  },
  {
    id: "wickstone",
    name: "Wick Stone",
    shape: "stone",
    color: "#ffd27a",
    desc: "+25% cadence, +10% speed",
    apply(run) {
      run.build.fireRate += 0.25;
      run.build.speed += 0.1;
    },
  },
  {
    id: "tideglass",
    name: "Tide Glass",
    shape: "glass",
    color: "#7ad7ff",
    desc: "bolts pierce +2, +10% damage",
    apply(run) {
      run.build.pierce += 2;
      run.build.damage += 0.1;
    },
  },
  {
    id: "ironrosary",
    name: "Iron Rosary",
    shape: "rosary",
    color: "#c9a7ff",
    desc: "+2 max hull, heal 2",
    apply(run) {
      run.build.maxHull += 2;
      syncMaxHull(run);
      healHull(run, 2);
    },
  },
];

export function relicById(id) {
  return RELICS.find((r) => r.id === id) || null;
}

// Keepers drop a relic nobody has yet, picked from what is left in the pool.
export function grantBossRelic(run) {
  const pool = RELICS.filter((r) => !run.relics.includes(r.id));
  if (pool.length === 0) return null;
  const next = pool[Math.floor(run.rng() * pool.length)];
  run.relics.push(next.id);
  next.apply(run);
  Sfx.relic();
  return next;
}

export function relicList(run) {
  return run.relics.map((id) => relicById(id)).filter(Boolean);
}
