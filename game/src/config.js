// Every tuning number, the three floor palettes and the enemy table live here.
// Nothing else in the game hard-codes a colour or a balance value.

export const WORLD = { w: 1280, h: 800 };

// The playable arena inside the HUD frame.
export const ARENA = { x: 62, y: 112, w: 1156, h: 630 };
ARENA.r = ARENA.x + ARENA.w;
ARENA.b = ARENA.y + ARENA.h;
ARENA.cx = ARENA.x + ARENA.w / 2;
ARENA.cy = ARENA.y + ARENA.h / 2;

export const FLOORS = [
  {
    id: 1,
    name: "The Kelp Stair",
    subtitle: "salt, and the slow green dark",
    enemies: ["drifter", "sporeling", "anemone"],
    boss: "kelpchoir",
    bossName: "THE KELP CHOIR",
    palette: {
      bg: "#071a2b",
      deep: "#04101a",
      tile: "#123b4f",
      accent: "#2ee6c8",
      pale: "#9ff5d9",
      ink: "#eafff9",
      warm: "#9ff5d9",
      danger: "#ff6f91",
    },
  },
  {
    id: 2,
    name: "The Rust Chapel",
    subtitle: "where the bell was cast and cracked",
    enemies: ["bellhusk", "cinderling", "chainwarden"],
    boss: "bellwarden",
    bossName: "THE BELL WARDEN",
    palette: {
      bg: "#1a0f0b",
      deep: "#0d0705",
      tile: "#3a1d0e",
      accent: "#ffb347",
      pale: "#ffe6a7",
      ink: "#fff3e0",
      warm: "#c2410c",
      danger: "#ff7043",
    },
  },
  {
    id: 3,
    name: "The Blind Deep",
    subtitle: "no floor, no ceiling, no mercy",
    enemies: ["echo", "maw", "warden"],
    boss: "blindlamp",
    bossName: "THE BLIND LAMP",
    palette: {
      bg: "#120a1f",
      deep: "#0a0512",
      tile: "#2a1440",
      accent: "#ff3ea5",
      pale: "#c9a7ff",
      ink: "#f2ecff",
      warm: "#c9a7ff",
      danger: "#ff3ea5",
    },
  },
];

export const ROOMS_PER_FLOOR = 3; // three fight rooms, then the boss room

export const PLAYER = {
  r: 13,
  speed: 262,
  accel: 2600,
  drag: 9,
  hullBase: 6,
  invulnAfterHit: 1.35,
  boltDamage: 9,
  boltSpeed: 760,
  boltRadius: 5,
  boltDelay: 0.34,
  boltLife: 0.95,
};

export const BEAM = {
  length: 640,
  halfWidth: 9,
  dps: 44,
  heatPerSecond: 27,
  coolPerSecond: 34,
  overheatAt: 100,
  resumeAt: 34,
  tickRate: 12, // damage ticks per second, so hits read as impacts
};

export const DASH = {
  speed: 720,
  duration: 0.15,
  charges: 2,
  recharge: 1.55,
  invuln: 0.24,
  damage: 0,
};

export const FLARE = {
  radius: 132,
  damage: 26,
  max: 100,
  perKill: 15,
  start: 40,
};

export const SCORE = {
  comboWindow: 3.2,
  comboStep: 0.5,
  comboMax: 8,
  roomClear: 320,
  floorClear: 900,
  boss: 1500,
  waveBanner: 1.7,
};

// Enemy archetypes. `tell` is the wind-up in seconds before the attack lands:
// every one of them flashes or swells for that long first.
export const ENEMY_TYPES = {
  drifter: { name: "Drifter", hp: 16, r: 15, speed: 66, score: 12, tell: 0.5 },
  sporeling: { name: "Sporeling", hp: 11, r: 13, speed: 96, score: 14, tell: 0.5, range: 255 },
  anemone: { name: "Anemone", hp: 24, r: 18, speed: 0, score: 18, tell: 0.7 },
  bellhusk: { name: "Bellhusk", hp: 30, r: 18, speed: 74, score: 20, tell: 0.75 },
  cinderling: { name: "Cinderling", hp: 5, r: 10, speed: 218, score: 10, tell: 0.26 },
  chainwarden: { name: "Chainwarden", hp: 38, r: 20, speed: 50, score: 26, tell: 0.65 },
  echo: { name: "Echo", hp: 20, r: 15, speed: 62, score: 22, tell: 0.45 },
  maw: { name: "Maw", hp: 22, r: 16, speed: 92, score: 18, tell: 0.45 },
  warden: { name: "Warden", hp: 68, r: 24, speed: 36, score: 34, tell: 0.85 },
};

// Bullet speeds and colours are floor-tinted at spawn time, not stored per enemy.
export const BULLET = {
  enemySpeed: 158,
  enemyRadius: 6.5,
  playerRadius: 4.5,
};

export const BOSSES = {
  kelpchoir: { name: "THE KELP CHOIR", hp: 520, r: 46, score: 1500 },
  bellwarden: { name: "THE BELL WARDEN", hp: 640, r: 52, score: 1800 },
  blindlamp: { name: "THE BLIND LAMP", hp: 760, r: 48, score: 2200 },
};

export const RARITY = {
  common: { label: "COMMON", color: "#8fa6b8" },
  uncommon: { label: "UNCOMMON", color: "#2ee6c8" },
  rare: { label: "RARE", color: "#ffb347" },
};

export const UI = {
  font: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  ink: "#eef7ff",
  dim: "#7f93a8",
  panel: "rgba(6,12,20,0.82)",
};
