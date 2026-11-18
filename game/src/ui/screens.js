// Title, pause and results screens. Big type, high contrast, readable at a third size.
import { WORLD, ARENA, UI, FLOORS, RARITY } from "../config.js";
import { relicList } from "../systems/relics.js";
import { buildSummary } from "../systems/upgrades.js";
import { drawGlyph } from "../render/actors.js";
import { elapsedLabel } from "../run.js";

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

// The title backdrop: a drowned lighthouse with its beam sweeping over the water.
function drawTitleScene(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  g.addColorStop(0, "#04101a");
  g.addColorStop(0.55, "#071a2b");
  g.addColorStop(1, "#02090f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // Sweeping lamp beam from the top of the tower.
  const lx = 300;
  const ly = 250;
  const sweep = Math.sin(t * 0.55) * 0.9 - 0.35;
  ctx.save();
  ctx.translate(lx, ly);
  ctx.rotate(sweep);
  const beam = ctx.createLinearGradient(0, 0, 1000, 0);
  beam.addColorStop(0, "rgba(159,245,217,0.35)");
  beam.addColorStop(0.5, "rgba(46,230,200,0.10)");
  beam.addColorStop(1, "rgba(46,230,200,0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(1000, -170);
  ctx.lineTo(1000, 170);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // The tower: banded, leaning, half drowned.
  ctx.save();
  ctx.translate(lx, 0);
  for (let i = 0; i < 9; i++) {
    const w = 96 - i * 5;
    ctx.fillStyle = i % 2 === 0 ? "#123b4f" : "#0c2a3a";
    ctx.fillRect(-w / 2, ly + i * 34 - 34, w, 34);
  }
  ctx.fillStyle = "#123b4f";
  ctx.beginPath();
  ctx.moveTo(-56, ly - 34);
  ctx.lineTo(56, ly - 34);
  ctx.lineTo(38, ly - 92);
  ctx.lineTo(-38, ly - 92);
  ctx.closePath();
  ctx.fill();
  // Lamp room.
  ctx.fillStyle = "rgba(159,245,217,0.95)";
  ctx.fillRect(-26, ly - 122, 52, 32);
  ctx.fillStyle = "#2ee6c8";
  ctx.fillRect(-34, ly - 132, 68, 10);
  ctx.restore();

  // Water: horizontal lines that drift.
  for (let i = 0; i < 22; i++) {
    const y = 470 + i * 16;
    const a = 0.05 + (i / 22) * 0.16;
    ctx.strokeStyle = `rgba(159,245,217,${a})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= WORLD.w; x += 40) {
      const yy = y + Math.sin(x * 0.012 + t * 1.1 + i) * 4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }

  const v = ctx.createRadialGradient(WORLD.w / 2, WORLD.h / 2, 200, WORLD.w / 2, WORLD.h / 2, 760);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
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

  spaced(ctx, "WRECKLIGHT", WORLD.w / 2, 232, 116, 10, "#eafff9");
  ctx.save();
  ctx.globalAlpha = 0.9;
  spaced(ctx, "WRECKLIGHT", WORLD.w / 2, 232, 116, 10, "rgba(46,230,200,0.22)");
  ctx.restore();

  center(ctx, "A DESCENT THROUGH THE DROWNED LIGHTHOUSE", WORLD.w / 2, 276, 26, "#2ee6c8");
  center(ctx, "Relight the tower. Three floors, three keepers, one lamp.", WORLD.w / 2, 322, 24, "#9ff5d9", "normal");

  // Controls: compact, two columns, no line under 20px.
  ctx.fillStyle = "rgba(4,14,22,0.78)";
  ctx.fillRect(150, 368, 980, 208);
  ctx.strokeStyle = "rgba(46,230,200,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(150, 368, 980, 208);
  ctx.textAlign = "left";
  ctx.font = `bold 22px ${UI.font}`;
  ctx.fillStyle = "#2ee6c8";
  ctx.fillText("CONTROLS", 180, 402);
  controlBlock(ctx, 180, 442, [
    ["W A S D", "move"],
    ["MOUSE", "aim the lantern"],
    ["HOLD LMB", "lantern beam"],
  ]);
  controlBlock(ctx, 700, 442, [
    ["RMB / E", "flare, clears shots"],
    ["SPACE", "dash, brief immunity"],
    ["P / ESC", "pause"],
  ]);

  const pulse = 0.62 + Math.sin(t * 4) * 0.38;
  ctx.globalAlpha = pulse;
  center(ctx, "PRESS ENTER", WORLD.w / 2, 648, 44, "#ffe6a7");
  ctx.globalAlpha = 1;

  center(ctx, `BEST ${String(run.best || 0).padStart(5, "0")}`, WORLD.w / 2, 704, 24, "#9ff5d9", "normal");
  center(ctx, "THREE FLOORS  ·  NINE CREATURES  ·  THREE KEEPERS", WORLD.w / 2, 754, 22, "rgba(223,247,241,0.65)", "normal");
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
  ctx.font = `bold 22px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.62)";
  ctx.fillText(label, x, y);
  ctx.textAlign = "right";
  ctx.font = `bold 30px ${UI.font}`;
  ctx.fillStyle = "#eafff9";
  ctx.fillText(value, x + width, y);
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
  const halo = ctx.createRadialGradient(WORLD.w / 2, 190, 30, WORLD.w / 2, 190, 460);
  halo.addColorStop(0, victory ? "rgba(255,179,71,0.30)" : "rgba(255,62,165,0.16)");
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, WORLD.w, 520);

  spaced(ctx, victory ? "VICTORY" : "THE LIGHT", WORLD.w / 2, 168, 104, 8, victory ? "#ffe6a7" : "#eafff9");
  if (!victory) spaced(ctx, "GOES OUT", WORLD.w / 2, 268, 104, 8, "#ff6f91");
  center(ctx, victory ? "THE TOWER BURNS AGAIN" : "THE DROWNED DARK KEEPS ITS LAMP",
    WORLD.w / 2, victory ? 236 : 330, 26, victory ? "#ffb347" : "#c9a7ff");

  // Stats table.
  const x = 200;
  const w = 420;
  let y = 392;
  const floorReached = Math.min(FLOORS.length, run.floor + 1);
  statRow(ctx, "FLOOR REACHED", `${floorReached} / 3`, x, y, w);
  statRow(ctx, "ROOMS CLEARED", String(run.roomsCleared), x, (y += 44), w);
  statRow(ctx, "KILLS", String(run.kills), x, (y += 44), w);
  statRow(ctx, "SCORE", String(run.score), x, (y += 44), w);
  statRow(ctx, "TIME", elapsedLabel(run), x, (y += 44), w);
  statRow(ctx, "BEST", String(run.best), x, (y += 44), w);

  // Relics collected, on the right.
  const rx = 720;
  ctx.textAlign = "left";
  ctx.font = `bold 24px ${UI.font}`;
  ctx.fillStyle = "#2ee6c8";
  ctx.fillText("RELICS TAKEN", rx, 392);
  const relics = relicList(run);
  if (relics.length === 0) {
    ctx.font = `bold 22px ${UI.font}`;
    ctx.fillStyle = "rgba(223,247,241,0.55)";
    ctx.fillText("none", rx, 434);
  }
  relics.forEach((r, i) => {
    const yy = 436 + i * 56;
    ctx.fillStyle = "rgba(4,14,22,0.7)";
    ctx.fillRect(rx, yy - 26, 400, 46);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, yy - 26, 400, 46);
    drawGlyph(ctx, r.shape, rx + 24, yy - 3, 13, r.color);
    ctx.font = `bold 22px ${UI.font}`;
    ctx.fillStyle = "#eafff9";
    ctx.fillText(r.name, rx + 52, yy + 2);
  });

  // The build, small, under the relics: one upgrade per line so nothing wraps awkwardly.
  const summary = buildSummary(run);
  ctx.font = `bold 20px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.6)";
  if (summary.length === 0) {
    ctx.fillText("no upgrades taken", rx, 620);
  } else {
    summary.slice(0, 4).forEach((s, i) => {
      ctx.fillStyle = RARITY[s.rarity] ? RARITY[s.rarity].color : "rgba(223,247,241,0.6)";
      ctx.fillText(`${s.name}${s.count > 1 ? ` x${s.count}` : ""}`, rx + (i % 2) * 200, 620 + Math.floor(i / 2) * 26);
    });
    if (summary.length > 4) {
      ctx.fillStyle = "rgba(223,247,241,0.45)";
      ctx.fillText(`+${summary.length - 4} more`, rx, 620 + 2 * 26);
    }
  }

  const pulse = 0.62 + Math.sin(t * 4) * 0.38;
  ctx.globalAlpha = pulse;
  center(ctx, "PRESS R TO DESCEND AGAIN", WORLD.w / 2, 730, 40, "#ffe6a7");
  ctx.globalAlpha = 1;
  center(ctx, "ENTER ALSO RESTARTS", WORLD.w / 2, 766, 20, "rgba(223,247,241,0.5)", "normal");
}

export { center, spaced };
