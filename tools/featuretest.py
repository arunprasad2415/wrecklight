"""Exercise the real game modules directly in the browser: apply every upgrade, run the whole
update order for several hundred frames against every creature and all three keepers, fire the
flare and the vent, buy from the shop, and draw every screen. Any exception is reported.

This runs against game/src as served, so it proves the code paths that a short play session
would only reach by luck (chain lightning, wisps, the split beam, the burning dash, the vent
shockwave, the flare blind, the lodestone).
"""
import json
import sys

from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8731/index.html"

SCRIPT = r"""
const out = { errors: [], frames: 0, draws: 0, kills: 0, arcs: 0, wisps: 0, salvage: 0 };
const note = (e) => out.errors.push(String(e && e.stack ? e.stack.split("\n")[0] : e));

try {
  const cfg = await import("/src/config.js");
  const R = await import("/src/run.js");
  const U = await import("/src/systems/upgrades.js");
  const REL = await import("/src/systems/relics.js");
  const RM = await import("/src/systems/rooms.js");
  const CB = await import("/src/systems/combat.js");
  const SH = await import("/src/systems/shop.js");
  const E = await import("/src/entities/enemies.js");
  const B = await import("/src/entities/bosses.js");
  const P = await import("/src/entities/player.js");
  const PJ = await import("/src/entities/projectiles.js");
  const PA = await import("/src/entities/particles.js");
  const BD = await import("/src/render/backdrop.js");
  const A = await import("/src/render/actors.js");
  const FX = await import("/src/render/fx.js");
  const HUD = await import("/src/ui/hud.js");
  const DR = await import("/src/ui/draft.js");
  const SC = await import("/src/ui/screens.js");
  const US = await import("/src/ui/shop.js");

  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  const input = {
    mouse: { x: 900, y: 320, down: true, right: false },
    axis: () => ({ x: 0.4, y: -0.3 }),
    firing: () => true,
    dashPressed: () => false,
    flarePressed: () => false,
    hit: () => false,
  };

  // A run with every upgrade and every relic: nothing in the pool is left untested.
  let run = R.makeRun(4242);
  R.startRun(run);
  run.rng = Math.random;
  run.state = "play";
  RM.enterRoom(run);
  for (const up of U.UPGRADES) {
    U.applyUpgrade(run, up);
  }
  for (const rel of REL.RELICS) {
    if (!run.relics.includes(rel.id)) { run.relics.push(rel.id); rel.apply(run); }
  }
  run.player.maxHull = run.build.maxHull;
  run.player.hull = run.build.maxHull;
  run.build.maxHull = 99; // keep the harness alive while it explores
  run.player.maxHull = 99;
  run.player.hull = 99;

  const drawWorld = () => {
    const pal = R.floorOf(run).palette;
    BD.drawBackdrop(ctx, run);
    FX.drawRings(ctx, run.rings);
    for (const pk of run.pickups) A.drawPickup(ctx, pk, pal, run.t);
    for (const d of run.salvageDrops) A.drawSalvage(ctx, d, pal, run.t);
    for (const e of run.enemies) A.drawEnemy(ctx, e, pal, run.t);
    A.drawBoss(ctx, run.boss, pal, run.t);
    FX.drawBolts(ctx, run.pbolts, pal);
    FX.drawEnemyBullets(ctx, run.ebullets, run.t);
    FX.drawBeam(ctx, run, pal, run.t);
    A.drawPlayer(ctx, run.player, pal, run.t);
    for (const w of run.wisps) A.drawWisp(ctx, w, pal, run.t);
    FX.drawArcs(ctx, run.arcs);
    FX.drawParticles(ctx, run.particles);
    FX.drawNumbers(ctx, run.numbers);
    FX.drawDarkPool(ctx, run);
    FX.drawHeatWarn(ctx, run, pal);
    BD.drawVignette(ctx);
    FX.drawLowHull(ctx, run, pal);
    FX.drawFlash(ctx, run, pal);
    FX.drawBanner(ctx, run, pal);
    FX.drawRoomClear(ctx, run, pal);
    HUD.drawHud(ctx, run);
    out.draws += 1;
  };

  const step = (dt) => {
    run.time += dt;
    P.updatePlayer(run, input, dt);
    for (const e of run.enemies) E.updateEnemy(run, e, dt);
    E.separateEnemies(run);
    B.updateBoss(run, run.boss, dt);
    PJ.updateProjectiles(run, dt);
    CB.stepCombat(run, dt);
    CB.updateWisps(run, dt);
    PA.updateParticles(run, dt);
    R.tickCombo(run, dt);
    run.t += dt;
    run.shake = Math.max(0, run.shake - dt * 3);
    run.chroma = Math.max(0, run.chroma - dt * 3);
    run.flash = Math.max(0, run.flash - dt * 3);
    run.banner = Math.max(0, run.banner - dt);
    run.clearBanner = Math.max(0, run.clearBanner - dt);
    if (run.darkPool > 0 && (!run.boss || !run.boss.alive)) run.darkPool = Math.max(0, run.darkPool - dt);
    out.frames += 1;
  };

  // Every creature on every floor, in every state, so each silhouette and behaviour runs.
  for (let f = 0; f < cfg.FLOORS.length; f++) {
    run.floor = f;
    run.room = 1;
    run.palette = cfg.FLOORS[f].palette;
    run.enemies = [];
    run.ebullets = [];
    run.rings = [];
    run.arcs = [];
    run.particles = [];
    run.darkPool = 0;
    run.player.x = cfg.ARENA.cx;
    run.player.y = cfg.ARENA.cy + 120;
    for (const kind of cfg.FLOORS[f].enemies) {
      for (let i = 0; i < 3; i++) {
        const e = E.makeEnemy(run, kind, cfg.ARENA.x + 200 + i * 260, cfg.ARENA.y + 150 + i * 90);
        e.state = "idle";
        run.enemies.push(e);
      }
    }
    run.boss = B.makeBoss(run, cfg.FLOORS[f].boss);
    run.boss.hp = run.boss.maxHp * 0.75;
    for (let i = 0; i < 420; i++) {
      if (i % 60 === 30) {
        run.player.flare = cfg.FLARE.max;
        CB.useFlare(run);
      }
      if (i % 90 === 60) {
        run.player.overheated = true;
        CB.ventShock(run);
        run.player.overheated = false;
      }
      if (i % 40 === 0) run.hitstop = 0;
      step(1 / 60);
      drawWorld();
    }
    out.kills = Math.max(out.kills, run.kills);
  }

  // Force each upgrade's own path once more with a close pair, so nothing is masked: the chain
  // has to have a second body to jump to, and the arcs have to be drawn.
  run.floor = 0;
  run.palette = cfg.FLOORS[0].palette;
  run.enemies = [
    E.makeEnemy(run, "drifter", 700, 400),
    E.makeEnemy(run, "drifter", 780, 420),
    E.makeEnemy(run, "drifter", 850, 380),
  ];
  run.boss = null;
  run.arcs = [];
  CB.damageEnemy(run, run.enemies[0], 5, { canCrit: true });
  FX.drawArcs(ctx, run.arcs);
  out.arcs = run.arcs.length;
  out.wisps = run.wisps.length;

  // The feel layer: a low hull, a clear banner, a flash and the dark pool all drawn at once.
  run.player.hull = 1;
  run.clearBanner = 1.6;
  run.clearTitle = "ROOM CLEAR";
  run.clearSub = "ROOM 2 OF 3   +480";
  run.flash = 0.5;
  run.darkPool = 0.6;
  run.chroma = 0.8;
  drawWorld();
  run.player.hull = 99;
  run.clearBanner = 0;
  run.darkPool = 0;
  run.chroma = 0;
  run.flash = 0;

  // The shop and the route screen, drawn with a real shop built from the pool.
  run.salvage = 400;
  run.floor = 1;
  run.player.hull = 3;
  SH.openShop(run);
  US.drawShop(ctx, run, 1.2);
  SH.buyShopItem(run, 0);
  SH.buyShopItem(run, 1);
  SH.buyShopItem(run, 2);
  out.salvage = run.salvage;
  run.state = "route";
  US.drawRouteChoice(ctx, run, 1.2);

  // Every other screen, drawn once.
  SC.drawTitle(ctx, run, 1.1);
  run.state = "draft";
  DR.drawDraft(ctx, run, U.draftChoices(run, 3), 1, 1.1);
  run.state = "shop";
  US.drawShop(ctx, run, 1.1);
  run.state = "results";
  run.victory = true;
  run.score = 51230;
  run.priorBest = 40000;
  run.best = 51230;
  SC.drawResults(ctx, run, 1.1);
  SC.drawPause(ctx, run, 1.1);
  out.upgrades = U.UPGRADES.length;
  out.relics = REL.RELICS.length;
  out.enemies = Object.keys(cfg.ENEMY_TYPES).length;
  out.screensOk = true;
} catch (err) {
  note(err);
}

window.__featureResult = out;
"""

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.goto(URL, wait_until="load")
    page.wait_for_function("() => typeof window.wrecklightStatus === 'function'", timeout=20000)
    page.wait_for_timeout(300)
    page.evaluate("async (src) => { const s = document.createElement('script'); s.type='module'; s.textContent = src; document.body.appendChild(s); }", SCRIPT)
    page.wait_for_function("() => window.__featureResult !== undefined", timeout=60000)
    result = page.evaluate("() => window.__featureResult")
    browser.close()

print(json.dumps(result, indent=2))
print("PAGE_ERRORS", errors)
ok = not result["errors"] and not errors and result.get("screensOk")
print("FEATURES_OK", bool(ok))
sys.exit(0 if ok else 1)
