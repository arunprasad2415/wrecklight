// Relics: one per boss, three in a full run, shown as icons beside the hull pips.
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
];

export function relicById(id) {
  return RELICS.find((r) => r.id === id) || null;
}

// Bosses drop the next relic in order, so a run always ends with all three.
export function grantBossRelic(run) {
  const next = RELICS.find((r) => !run.relics.includes(r.id));
  if (!next) return null;
  run.relics.push(next.id);
  next.apply(run);
  Sfx.relic();
  return next;
}

export function relicList(run) {
  return run.relics.map((id) => relicById(id)).filter(Boolean);
}
