// The draft pool: eighteen upgrades, three offered after every non-boss room.
import { syncMaxHull, healHull } from "../run.js";
import { shuffle } from "../random.js";
import { Sfx } from "../audio.js";

// `shape` picks the drawn icon in render/actors.js, so every card has real art with no font.
export const UPGRADES = [
  {
    id: "dmg", name: "Brighter Wick", shape: "flame", rarity: "common", max: 5,
    desc: "+18% lantern damage",
    apply(b) { b.damage += 0.18; },
  },
  {
    id: "firerate", name: "Quick Trim", shape: "bolt", rarity: "common", max: 5,
    desc: "+22% bolt cadence",
    apply(b) { b.fireRate += 0.22; },
  },
  {
    id: "beamwidth", name: "Wide Shutter", shape: "cone", rarity: "uncommon", max: 3,
    desc: "+25% beam width",
    apply(b) { b.beamWidth += 0.25; },
  },
  {
    id: "heatcap", name: "Brass Reservoir", shape: "tank", rarity: "common", max: 4,
    desc: "+35 heat capacity",
    apply(b) { b.heatCap += 35; },
  },
  {
    id: "dashcharge", name: "Second Wind", shape: "wing", rarity: "rare", max: 2,
    desc: "+1 dash charge",
    apply(b) { b.dashCharges += 1; },
  },
  {
    id: "dashdmg", name: "Keel Spike", shape: "spike", rarity: "uncommon", max: 3,
    desc: "dash deals 14 damage",
    apply(b) { b.dashDamage += 14; },
  },
  {
    id: "flareradius", name: "Wide Flare", shape: "burst", rarity: "common", max: 4,
    desc: "+30% flare radius",
    apply(b) { b.flareRadius += 0.3; },
  },
  {
    id: "flarerecharge", name: "Salt Battery", shape: "cell", rarity: "common", max: 4,
    desc: "flare charges 35% faster",
    apply(b) { b.flareRecharge += 0.35; },
  },
  {
    id: "maxhull", name: "Oak Rib", shape: "heart", rarity: "rare", max: 3,
    desc: "+1 max hull, heal 1",
    apply(b, run) { b.maxHull += 1; syncMaxHull(run); healHull(run, 1); },
  },
  {
    id: "hullregen", name: "Tallow Salve", shape: "drop", rarity: "uncommon", max: 3,
    desc: "heal 1 hull per room",
    apply(b) { b.hullRegen += 1; },
  },
  {
    id: "pierce", name: "Long Bore", shape: "arrow", rarity: "uncommon", max: 3,
    desc: "bolts pierce +1 enemy",
    apply(b) { b.pierce += 1; },
  },
  {
    id: "crit", name: "Glint Eye", shape: "eye", rarity: "uncommon", max: 4,
    desc: "+12% crit chance",
    apply(b) { b.crit += 0.12; },
  },
  {
    id: "speed", name: "Light Feet", shape: "chevron", rarity: "common", max: 4,
    desc: "+12% move speed",
    apply(b) { b.speed += 0.12; },
  },
  {
    id: "magnet", name: "Iron Pull", shape: "magnet", rarity: "common", max: 4,
    desc: "+60% ember pull range",
    apply(b) { b.magnet += 0.6; },
  },
  {
    id: "combodecay", name: "Steady Hand", shape: "spiral", rarity: "uncommon", max: 3,
    desc: "combo decays 45% slower",
    apply(b) { b.comboWindow += 0.45; },
  },
  {
    id: "thorns", name: "Barbed Hull", shape: "spikes", rarity: "uncommon", max: 3,
    desc: "contact deals 12 back",
    apply(b) { b.thorns += 12; },
  },
  {
    id: "lifesteal", name: "Siphon Wick", shape: "siphon", rarity: "rare", max: 2,
    desc: "heal 1 hull every 12 kills",
    apply(b) { b.lifesteal = b.lifesteal === 0 ? 12 : b.lifesteal - 4; },
  },
  {
    id: "slowonhit", name: "Cold Ember", shape: "snow", rarity: "uncommon", max: 2,
    desc: "hits slow enemies 45%",
    apply(b) { b.slow += 1; },
  },
];

const RARITY_WEIGHT = { common: 62, uncommon: 30, rare: 12 };

export function upgradeById(id) {
  return UPGRADES.find((u) => u.id === id) || null;
}

export function stacksOf(run, id) {
  return run.build.taken[id] || 0;
}

export function isMaxed(run, upgrade) {
  return stacksOf(run, upgrade.id) >= upgrade.max;
}

// Three distinct offers, weighted by rarity, never something already at its cap.
export function draftChoices(run, count = 3) {
  const pool = UPGRADES.filter((u) => !isMaxed(run, u));
  const bag = [];
  for (const u of pool) {
    const weight = RARITY_WEIGHT[u.rarity] || 10;
    for (let i = 0; i < weight; i++) bag.push(u);
  }
  const picked = [];
  const seen = new Set();
  let guard = 0;
  while (picked.length < count && guard < 900) {
    guard += 1;
    const candidate = bag[Math.floor(run.rng() * bag.length)];
    if (!candidate || seen.has(candidate.id)) continue;
    seen.add(candidate.id);
    picked.push(candidate);
  }
  // A tiny pool can run short: fill from anything still available.
  if (picked.length < count) {
    for (const u of shuffle(run.rng, pool)) {
      if (picked.length >= count) break;
      if (!seen.has(u.id)) {
        seen.add(u.id);
        picked.push(u);
      }
    }
  }
  return picked;
}

export function applyUpgrade(run, upgrade) {
  const b = run.build;
  upgrade.apply(b, run);
  b.taken[upgrade.id] = (b.taken[upgrade.id] || 0) + 1;
  syncMaxHull(run);
  Sfx.uiPick();
}

// The right-hand column of the draft screen: what the build is made of right now.
export function buildSummary(run) {
  const rows = [];
  for (const u of UPGRADES) {
    const n = stacksOf(run, u.id);
    if (n > 0) rows.push({ name: u.name, shape: u.shape, rarity: u.rarity, count: n });
  }
  return rows;
}

export function buildPower(run) {
  const b = run.build;
  return Math.round(
    b.damage * 10 + b.fireRate * 8 + b.beamWidth * 6 + b.heatCap / 10 + b.dashCharges * 6 +
    b.flareRadius * 5 + b.maxHull * 6 + b.pierce * 4 + b.crit * 30 + b.speed * 6 + b.thorns * 0.4,
  );
}
