// Title, pause and results screens. Big type, high contrast, readable at a third size.
import { WORLD, ARENA, UI, FLOORS, RARITY } from "../config.js";
import { relicList } from "../systems/relics.js";
import { buildSummary } from "../systems/upgrades.js";
import { drawGlyph } from "../render/actors.js";
import { elapsedLabel, rankOf } from "../run.js";
import { drawRouteStrip } from "./route.js";

function spaced(ctx, text, cx, y, size, spacing, color, weight = "bold") {
  ctx.font = `${weight} ${size}px ${UI.font}`;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  let total = 0;
  for (const ch of text) total += ctx.measureText(ch).width + spacing;
  total -= spacing;
  let x = cx - total / 2;
  for (const ch of text) {
    ctx.fillText(ch, x, y);
    x += ctx.measureText(ch).width + spacing;
  }
}

function center(ctx, text, cx, y, size, color, weight = "bold") {
  ctx.font = `${weight} ${size}px ${UI.font}`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(text, cx, y);
}

// A drawn lighthouse: sky, stars, a lit lamp, a beam sweeping out over a dark sea, rocks and
// foam at the base. Everything is geometry, and the lamp is the brightest point on the canvas.
const LAMP = { x: 300, y: 288 };
const HORIZON = 566;

function drawSky(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
  g.addColorStop(0, "#03080e");
  g.addColorStop(0.45, "#07182a");
  g.addColorStop(0.82, "#0d2c3f");
  g.addColorStop(1, "#123b4f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, HORIZON + 2);

  // Stars: fixed positions, slow twinkle.
  for (let i = 0; i < 90; i++) {
    const x = ((i * 137.5) % WORLD.w);
    const y = ((i * 61.7) % (HORIZON - 120)) + 20;
    const tw = 0.25 + Math.abs(Math.sin(t * 0.7 + i)) * 0.55;
    ctx.globalAlpha = tw * 0.7;
    ctx.fillStyle = i % 9 === 0 ? "#cfefff" : "#9ff5d9";
    ctx.fillRect(x, y, i % 13 === 0 ? 2 : 1.4, i % 13 === 0 ? 2 : 1.4);
  }
  ctx.globalAlpha = 1;

  // A band of low cloud over the horizon, so the sea line has weight.
  for (let i = 0; i < 5; i++) {
    const y = HORIZON - 96 + i * 22;
    const a = 0.05 + i * 0.02;
    ctx.fillStyle = `rgba(159,245,217,${a})`;
    ctx.beginPath();
    ctx.ellipse(180 + i * 240, y, 260 + i * 30, 16 + i * 3, 0, 0, 6.28);
    ctx.fill();
  }
}

function drawSea(ctx, t) {
  const g = ctx.createLinearGradient(0, HORIZON, 0, WORLD.h);
  g.addColorStop(0, "#0a2434");
  g.addColorStop(0.5, "#061520");
  g.addColorStop(1, "#02080d");
  ctx.fillStyle = g;
  ctx.fillRect(0, HORIZON, WORLD.w, WORLD.h - HORIZON);

  // The horizon itself: one bright line, then wave rows getting taller as they come forward.
  ctx.strokeStyle = "rgba(159,245,217,0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, HORIZON);
  ctx.lineTo(WORLD.w, HORIZON);
  ctx.stroke();

  for (let i = 0; i < 16; i++) {
    const y = HORIZON + 8 + i * i * 1.05 + i * 5;
    if (y > WORLD.h) break;
    const a = 0.06 + (i / 16) * 0.16;
    ctx.strokeStyle = `rgba(159,245,217,${a})`;
    ctx.lineWidth = 1 + i * 0.12;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.w; x += 26) {
      const yy = y + Math.sin(x * 0.011 + t * 1.2 + i * 0.7) * (2 + i * 0.35);
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  // The lamp's reflection: a broken column of light down the water.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 26; i++) {
    const y = HORIZON + 6 + i * i * 0.62 + i * 3;
    if (y > WORLD.h) break;
    const w = 30 + i * 5;
    const jitter = Math.sin(t * 2 + i) * (3 + i * 0.5);
    ctx.globalAlpha = 0.16 * (1 - i / 26);
    ctx.fillStyle = "#ffe6a7";
    ctx.fillRect(LAMP.x - w / 2 + jitter, y, w, 3);
  }
  ctx.restore();
}

function drawBeam(ctx, t) {
  // The lamp turns: a long cone sweeps across the sky and a dimmer twin swings behind it.
  const turn = t * 0.42;
  const sweep = Math.sin(turn) * 0.78 - 0.16;
  const near = 0.35 + Math.abs(Math.cos(turn)) * 0.65;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const cones = [
    { angle: sweep, len: 1180 * near, alpha: 0.5 },
    { angle: sweep + Math.PI, len: 620 * (1.35 - near), alpha: 0.2 },
  ];
  for (const cone of cones) {
    const half = 0.085 + 0.02 * Math.sin(t * 3);
    const g = ctx.createLinearGradient(
      LAMP.x, LAMP.y,
      LAMP.x + Math.cos(cone.angle) * cone.len,
      LAMP.y + Math.sin(cone.angle) * cone.len,
    );
    g.addColorStop(0, `rgba(255,246,214,${0.85 * cone.alpha})`);
    g.addColorStop(0.18, `rgba(255,230,167,${0.34 * cone.alpha})`);
    g.addColorStop(0.6, `rgba(159,245,217,${0.12 * cone.alpha})`);
    g.addColorStop(1, "rgba(159,245,217,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(LAMP.x, LAMP.y);
    ctx.lineTo(
      LAMP.x + Math.cos(cone.angle - half) * cone.len,
      LAMP.y + Math.sin(cone.angle - half) * cone.len,
    );
    ctx.lineTo(
      LAMP.x + Math.cos(cone.angle + half) * cone.len,
      LAMP.y + Math.sin(cone.angle + half) * cone.len,
    );
    ctx.closePath();
    ctx.fill();

    // A brighter spine inside the cone.
    ctx.strokeStyle = `rgba(255,255,255,${0.3 * cone.alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(LAMP.x, LAMP.y);
    ctx.lineTo(
      LAMP.x + Math.cos(cone.angle) * cone.len * 0.82,
      LAMP.y + Math.sin(cone.angle) * cone.len * 0.82,
    );
    ctx.stroke();
  }
  ctx.restore();
}

function drawTower(ctx, t) {
  const topW = 74;
  const botW = 138;
  const topY = 302;
  const botY = 672;

  // The tower body: ten bands, tapering, alternating cream and rust.
  for (let i = 0; i < 10; i++) {
    const k0 = i / 10;
    const k1 = (i + 1) / 10;
    const y0 = topY + (botY - topY) * k0;
    const y1 = topY + (botY - topY) * k1 + 0.6;
    const w0 = topW + (botW - topW) * k0;
    const w1 = topW + (botW - topW) * k1;
    ctx.beginPath();
    ctx.moveTo(LAMP.x - w0 / 2, y0);
    ctx.lineTo(LAMP.x + w0 / 2, y0);
    ctx.lineTo(LAMP.x + w1 / 2, y1);
    ctx.lineTo(LAMP.x - w1 / 2, y1);
    ctx.closePath();
    ctx.fillStyle = i % 2 === 0 ? "#d9e6df" : "#8a2f14";
    ctx.fill();
  }

  // Shading: the right side of the tower falls away into the dark.
  const shade = ctx.createLinearGradient(LAMP.x - botW / 2, 0, LAMP.x + botW / 2, 0);
  shade.addColorStop(0, "rgba(0,0,0,0)");
  shade.addColorStop(0.55, "rgba(0,0,0,0.12)");
  shade.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = shade;
  ctx.fillRect(LAMP.x - botW / 2, topY, botW, botY - topY);

  // Windows, two per band on the left.
  ctx.fillStyle = "rgba(8,20,28,0.9)";
  for (let i = 1; i < 9; i += 2) {
    const y = topY + (botY - topY) * (i / 10) + 14;
    const w = 11;
    ctx.fillRect(LAMP.x - 20, y, w, 17);
    ctx.fillRect(LAMP.x + 9, y, w, 17);
  }

  // Gallery: a slab with a railing.
  ctx.fillStyle = "#243642";
  ctx.fillRect(LAMP.x - 56, topY - 10, 112, 12);
  ctx.strokeStyle = "#9ff5d9";
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.75;
  for (let i = -5; i <= 5; i++) {
    ctx.beginPath();
    ctx.moveTo(LAMP.x + i * 10, topY - 26);
    ctx.lineTo(LAMP.x + i * 10, topY - 10);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(LAMP.x - 54, topY - 26);
  ctx.lineTo(LAMP.x + 54, topY - 26);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Lantern room: a glazed drum under a cone roof.
  ctx.beginPath();
  ctx.moveTo(LAMP.x - 31, topY - 10);
  ctx.lineTo(LAMP.x + 31, topY - 10);
  ctx.lineTo(LAMP.x + 26, topY - 66);
  ctx.lineTo(LAMP.x - 26, topY - 66);
  ctx.closePath();
  ctx.fillStyle = "rgba(20,40,52,0.95)";
  ctx.fill();
  ctx.strokeStyle = "#8fb3ad";
  ctx.lineWidth = 2;
  ctx.stroke();

  // The glass, lit from inside.
  const glow = ctx.createLinearGradient(LAMP.x - 26, 0, LAMP.x + 26, 0);
  glow.addColorStop(0, "rgba(255,230,167,0.55)");
  glow.addColorStop(0.5, "rgba(255,250,235,0.95)");
  glow.addColorStop(1, "rgba(255,196,110,0.6)");
  ctx.fillStyle = glow;
  ctx.fillRect(LAMP.x - 24, topY - 62, 48, 50);

  // Mullions.
  ctx.strokeStyle = "rgba(12,26,34,0.8)";
  ctx.lineWidth = 2.5;
  for (const dx of [-14, 0, 14]) {
    ctx.beginPath();
    ctx.moveTo(LAMP.x + dx, topY - 62);
    ctx.lineTo(LAMP.x + dx, topY - 12);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(LAMP.x - 24, topY - 38);
  ctx.lineTo(LAMP.x + 24, topY - 38);
  ctx.stroke();

  // Roof and the rod above it.
  ctx.beginPath();
  ctx.moveTo(LAMP.x - 36, topY - 66);
  ctx.lineTo(LAMP.x, topY - 100);
  ctx.lineTo(LAMP.x + 36, topY - 66);
  ctx.closePath();
  ctx.fillStyle = "#243642";
  ctx.fill();
  ctx.strokeStyle = "#9ff5d9";
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#8fb3ad";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(LAMP.x, topY - 100);
  ctx.lineTo(LAMP.x, topY - 128);
  ctx.stroke();

  // The lamp: the brightest thing on the screen, with a pulse that never quite settles.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const pulse = 1 + Math.sin(t * 2.4) * 0.06;
  const halo = ctx.createRadialGradient(LAMP.x, LAMP.y, 2, LAMP.x, LAMP.y, 150 * pulse);
  halo.addColorStop(0, "rgba(255,255,255,1)");
  halo.addColorStop(0.16, "rgba(255,246,214,0.9)");
  halo.addColorStop(0.42, "rgba(255,214,140,0.32)");
  halo.addColorStop(1, "rgba(255,196,110,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(LAMP.x, LAMP.y, 150 * pulse, 0, 6.28);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(LAMP.x, LAMP.y, 9 * pulse, 0, 6.28);
  ctx.fill();
  ctx.restore();

  // Rocks at the waterline, and the foam where the sea hits them.
  ctx.fillStyle = "#05121a";
  ctx.beginPath();
  ctx.moveTo(LAMP.x - 210, WORLD.h);
  ctx.lineTo(LAMP.x - 170, 716);
  ctx.lineTo(LAMP.x - 118, 700);
  ctx.lineTo(LAMP.x - 70, 724);
  ctx.lineTo(LAMP.x + 40, 712);
  ctx.lineTo(LAMP.x + 118, 700);
  ctx.lineTo(LAMP.x + 176, 726);
  ctx.lineTo(LAMP.x + 214, WORLD.h);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(159,245,217,0.45)";
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) {
    const y = 704 + i * 7;
    ctx.globalAlpha = 0.5 - i * 0.1;
    ctx.beginPath();
    ctx.moveTo(LAMP.x - 150 + i * 22, y);
    ctx.quadraticCurveTo(LAMP.x - 60, y - 8, LAMP.x + 30, y + 2);
    ctx.quadraticCurveTo(LAMP.x + 120, y + 8, LAMP.x + 186, y - 4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawTitleScene(ctx, t) {
  drawSky(ctx, t);
  drawSea(ctx, t);
  drawBeam(ctx, t);
  drawTower(ctx, t);

  // Vignette, gentler than the arena's so the art stays readable.
  const v = ctx.createRadialGradient(WORLD.w / 2, WORLD.h * 0.45, 260, WORLD.w / 2, WORLD.h * 0.45, 860);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.82)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // A soft dark plate behind the type block so the wordmark always reads.
  const plate = ctx.createLinearGradient(0, 40, 0, 300);
  plate.addColorStop(0, "rgba(2,7,12,0.72)");
  plate.addColorStop(1, "rgba(2,7,12,0)");
  ctx.fillStyle = plate;
  ctx.fillRect(0, 0, WORLD.w, 300);
}

function controlBlock(ctx, x, y, rows) {
  ctx.textAlign = "left";
  rows.forEach((row, i) => {
    const yy = y + i * 34;
    ctx.font = `bold 22px ${UI.font}`;
    ctx.fillStyle = "#2ee6c8";
    ctx.fillText(row[0], x, yy);
    ctx.fillStyle = "#dff7f1";
    ctx.fillText(row[1], x + 210, yy);
  });
}

export function drawTitle(ctx, run, t) {
  drawTitleScene(ctx, t);

  spaced(ctx, "WRECKLIGHT", WORLD.w / 2, 132, 104, 9, "#eafff9");
  ctx.save();
  ctx.globalAlpha = 0.9;
  spaced(ctx, "WRECKLIGHT", WORLD.w / 2, 132, 104, 9, "rgba(46,230,200,0.22)");
  ctx.restore();

  center(ctx, "A DESCENT THROUGH THE DROWNED LIGHTHOUSE", WORLD.w / 2, 178, 25, "#2ee6c8");
  center(ctx, "Relight the tower. Three floors, three keepers, one lamp.", WORLD.w / 2, 216, 23, "#9ff5d9", "normal");

  // Controls: compact, two columns, no line under 20px.
  ctx.fillStyle = "rgba(4,14,22,0.82)";
  ctx.fillRect(700, 296, 500, 236);
  ctx.strokeStyle = "rgba(46,230,200,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(700, 296, 500, 236);
  ctx.textAlign = "left";
  ctx.font = `bold 22px ${UI.font}`;
  ctx.fillStyle = "#2ee6c8";
  ctx.fillText("CONTROLS", 730, 332);
  controlBlock(ctx, 730, 376, [
    ["W A S D", "move"],
    ["MOUSE", "aim the lantern"],
    ["HOLD LMB", "lantern beam"],
  ]);
  controlBlock(ctx, 730, 478, [
    ["RMB / E", "flare, clears shots"],
    ["SPACE", "dash, brief immunity"],
  ]);

  // The run's shape, stated once, quietly, under the tagline where the sky is darkest.
  center(ctx, "THREE FLOORS  ·  TWELVE CREATURES  ·  THREE KEEPERS  ·  A SHOP BETWEEN EACH",
    WORLD.w / 2, 252, 19, "rgba(223,247,241,0.72)", "normal");

  const pulse = 0.8 + Math.sin(t * 4) * 0.2;
  ctx.globalAlpha = pulse;
  center(ctx, "PRESS ENTER", WORLD.w / 2, 654, 42, "#ffe6a7");
  ctx.globalAlpha = 1;

  center(ctx, `BEST ${String(run.best || 0).padStart(5, "0")}`, WORLD.w / 2, 706, 24, "#9ff5d9", "normal");
}

export function drawPause(ctx, run, t) {
  ctx.fillStyle = "rgba(3,7,12,0.82)";
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  spaced(ctx, "PAUSED", WORLD.w / 2, 250, 84, 8, "#eafff9");
  center(ctx, "THE LAMP IS STILL BURNING", WORLD.w / 2, 296, 24, "#2ee6c8");

  ctx.fillStyle = "rgba(4,14,22,0.8)";
  ctx.fillRect(330, 350, 620, 260);
  ctx.strokeStyle = "rgba(46,230,200,0.45)";
  ctx.lineWidth = 2;
  ctx.strokeRect(330, 350, 620, 260);
  controlBlock(ctx, 372, 400, [
    ["W A S D", "move"],
    ["MOUSE", "aim the lantern"],
    ["HOLD LMB", "lantern beam"],
    ["RMB / E", "flare"],
    ["SPACE", "dash"],
  ]);

  const pulse = 0.62 + Math.sin(t * 4) * 0.38;
  ctx.globalAlpha = pulse;
  center(ctx, "PRESS P TO RESUME", WORLD.w / 2, 682, 36, "#ffe6a7");
  ctx.globalAlpha = 1;
}

function statRow(ctx, label, value, x, y, width) {
  ctx.textAlign = "left";
  ctx.font = `bold 21px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.62)";
  ctx.fillText(label, x, y);
  ctx.textAlign = "right";
  ctx.font = `bold 27px ${UI.font}`;
  ctx.fillStyle = "#eafff9";
  ctx.fillText(value, x + width, y);
}

// The rank badge: a hexagon with the letter in it, in the accent of the run.
function rankBadge(ctx, cx, cy, letter, color) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
    const x = cx + Math.cos(a) * 44;
    const y = cy + Math.sin(a) * 44;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(6,12,20,0.9)";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.font = `bold 46px ${UI.font}`;
  ctx.fillStyle = color;
  ctx.fillText(letter, cx, cy + 16);
  ctx.restore();
}

export function drawResults(ctx, run, t) {
  const victory = run.victory;
  const pal = victory ? FLOORS[2].palette : FLOORS[Math.min(run.floor, 2)].palette;

  const g = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  g.addColorStop(0, pal.deep);
  g.addColorStop(0.6, pal.bg);
  g.addColorStop(1, "#04070c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // A ring of light behind the verdict.
  const halo = ctx.createRadialGradient(WORLD.w / 2, 150, 30, WORLD.w / 2, 150, 470);
  halo.addColorStop(0, victory ? "rgba(255,179,71,0.30)" : "rgba(255,62,165,0.16)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, WORLD.w, 460);

  spaced(ctx, victory ? "VICTORY" : "THE LIGHT", WORLD.w / 2, 132, 92, 8, victory ? "#ffe6a7" : "#eafff9");
  if (!victory) spaced(ctx, "GOES OUT", WORLD.w / 2, 216, 92, 8, "#ff6f91");
  center(ctx, victory ? "THE TOWER BURNS AGAIN" : "THE DROWNED DARK KEEPS ITS LAMP",
    WORLD.w / 2, victory ? 186 : 272, 25, victory ? "#ffb347" : "#c9a7ff");

  // Rank and the comparison against the best run so far.
  const rank = rankOf(run);
  const rankColor = rank === "S" ? "#ffe6a7" : rank === "A" ? "#ffb347" : rank === "B" ? "#2ee6c8" : "#8fa6b8";
  rankBadge(ctx, 300, 286, rank, rankColor);
  ctx.textAlign = "left";
  ctx.font = `bold 38px ${UI.font}`;
  ctx.fillStyle = rankColor;
  ctx.fillText(`${rank} RANK`, 366, 300);

  const newBest = run.score >= (run.priorBest || 0) && run.score >= run.best;
  ctx.font = `bold 21px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.6)";
  ctx.fillText(newBest ? `BEST ${run.best}  ·  SET JUST NOW` : `BEST ${run.best}  ·  ${run.best - run.score} SHORT`,
    366, 330);
  ctx.fillStyle = newBest ? "#ffe6a7" : "rgba(223,247,241,0.45)";
  ctx.font = `bold 20px ${UI.font}`;
  ctx.fillText(`${run.roomsCleared} ROOMS  ·  ${run.kills} KILLS  ·  ${run.relics.length} RELICS`, 366, 358);

  // The route, filled in: the whole run at a glance.
  ctx.textAlign = "center";
  ctx.font = `bold 19px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.45)";
  ctx.fillText("THE DESCENT", WORLD.w / 2, 394);
  drawRouteStrip(ctx, run, { y: 424, size: 11, step: 28, groupGap: 40 });

  // Stats table.
  const x = 200;
  const w = 400;
  let y = 500;
  const floorReached = Math.min(FLOORS.length, run.floor + 1);
  statRow(ctx, "FLOOR REACHED", `${floorReached} / 3`, x, y, w);
  statRow(ctx, "ROOMS CLEARED", String(run.roomsCleared), x, (y += 42), w);
  statRow(ctx, "KILLS", String(run.kills), x, (y += 42), w);
  statRow(ctx, "SCORE", String(run.score), x, (y += 42), w);
  statRow(ctx, "TIME", elapsedLabel(run), x, (y += 42), w);

  // Relics collected, on the right.
  const rx = 720;
  ctx.textAlign = "left";
  ctx.font = `bold 23px ${UI.font}`;
  ctx.fillStyle = "#2ee6c8";
  ctx.fillText("RELICS TAKEN", rx, 500);
  const relics = relicList(run);
  if (relics.length === 0) {
    ctx.font = `bold 21px ${UI.font}`;
    ctx.fillStyle = "rgba(223,247,241,0.55)";
    ctx.fillText("none", rx, 540);
  }
  relics.slice(0, 4).forEach((r, i) => {
    const yy = 544 + i * 42;
    ctx.fillStyle = "rgba(4,14,22,0.7)";
    ctx.fillRect(rx, yy - 24, 420, 36);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, yy - 24, 420, 36);
    drawGlyph(ctx, r.shape, rx + 22, yy - 6, 11, r.color);
    ctx.font = `bold 20px ${UI.font}`;
    ctx.fillStyle = "#eafff9";
    ctx.fillText(r.name, rx + 48, yy);
    ctx.textAlign = "right";
    ctx.font = `bold 15px ${UI.font}`;
    ctx.fillStyle = "rgba(223,247,241,0.5)";
    ctx.fillText(r.desc, rx + 406, yy - 1);
    ctx.textAlign = "left";
  });

  const pulse = 0.62 + Math.sin(t * 4) * 0.38;
  ctx.globalAlpha = pulse;
  center(ctx, "PRESS R TO DESCEND AGAIN", WORLD.w / 2, 762, 34, "#ffe6a7");
  ctx.globalAlpha = 1;
}

export { center, spaced };
