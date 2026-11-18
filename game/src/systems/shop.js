// The shop between floors: three priced items, paid for with the salvage the kills dropped.
import { SHOP, RARITY } from "../config.js";
import { UPGRADES, isMaxed, stacksOf } from "./upgrades.js";
import { syncMaxHull, healHull } from "../run.js";
import { Sfx } from "../audio.js";

const RARITY_WEIGHT = { common: 58, uncommon: 30, rare: 12 };

function rollUpgrade(run, taken) {
  const pool = UPGRADES.filter((u) => !isMaxed(run, u) && !taken.has(u.id));
  if (pool.length === 0) return null;
  const bag = [];
  for (const u of pool) {
    const weight = RARITY_WEIGHT[u.rarity] || 10;
    for (let i = 0; i < weight; i++) bag.push(u);
  }
  const pick = bag[Math.floor(run.rng() * bag.length)];
  taken.add(pick.id);
  return pick;
}

// Three items: two upgrades off the draft pool and one service (a heal or a hull plate).
export function openShop(run) {
  const taken = new Set();
  const items = [];
  const bump = Math.min(30, run.floor * 10);

  for (let i = 0; i < SHOP.itemCount - 1; i++) {
    const upgrade = rollUpgrade(run, taken);
    if (!upgrade) break;
    const base = SHOP.basePrice[upgrade.rarity] || 40;
    items.push({
      kind: "upgrade",
      upgrade,
      name: upgrade.name,
      desc: upgrade.desc,
      shape: upgrade.shape,
      rarity: upgrade.rarity,
      price: base + bump,
      sold: false,
    });
  }

  const wantHeal = run.player.hull < run.player.maxHull - 1;
  if (wantHeal) {
    items.push({
      kind: "heal",
      upgrade: null,
      name: "Tallow Draught",
      desc: `repair ${SHOP.healAmount} hull`,
      shape: "drop",
      rarity: "common",
      price: SHOP.healPrice + bump,
      sold: false,
    });
  } else {
    items.push({
      kind: "hull",
      upgrade: null,
      name: "Oak Rib",
      desc: `+${SHOP.hullAmount} max hull, heal ${SHOP.hullAmount}`,
      shape: "heart",
      rarity: "rare",
      price: SHOP.hullPrice + bump,
      sold: false,
    });
  }

  run.shop = { items, note: run.lastRelic ? `RELIC TAKEN  ·  ${run.lastRelic.toUpperCase()}` : "" };
  run.shopPick = 0;
  run.state = "shop";
  return run.shop;
}

export function buyShopItem(run, index) {
  const shop = run.shop;
  if (!shop) return false;
  const item = shop.items[index];
  if (!item || item.sold) return false;
  if (run.salvage < item.price) {
    Sfx.uiMove();
    run.shopDenied = 0.8;
    run.shopDeniedIndex = index;
    return false;
  }
  run.salvage -= item.price;
  item.sold = true;

  if (item.kind === "upgrade" && item.upgrade) {
    item.upgrade.apply(run.build, run);
    run.build.taken[item.upgrade.id] = stacksOf(run, item.upgrade.id) + 1;
    syncMaxHull(run);
  } else if (item.kind === "heal") {
    healHull(run, SHOP.healAmount);
  } else {
    run.build.maxHull += SHOP.hullAmount;
    syncMaxHull(run);
    healHull(run, SHOP.hullAmount);
  }
  Sfx.uiPick();
  return true;
}

export function shopItemAt(x, y) {
  const layout = shopLayout();
  for (let i = 0; i < layout.length; i++) {
    const r = layout[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

// Three tall cards in a row, the same rhythm as the draft screen.
export function shopLayout() {
  const w = 340;
  const h = 420;
  const y = 200;
  const gap = 40;
  const total = 3 * w + 2 * gap;
  const x0 = (1280 - total) / 2;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (w + gap), y, w, h }));
}

export function priceLabel(item) {
  return item.sold ? "SOLD" : `${item.price} SALVAGE`;
}

export function rarityColor(item) {
  return item.rarity && RARITY[item.rarity] ? RARITY[item.rarity].color : RARITY.common.color;
}
