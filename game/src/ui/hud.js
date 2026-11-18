// The HUD: hull, relics, floor and room, boss bar, score and combo, heat, flare and dash.
// Everything here is sized to stay readable at a third of the canvas.
import { WORLD, ARENA, UI, FLARE, DASH, ROOMS_PER_FLOOR } from "../config.js";
import { floorOf, isBossRoom } from "../run.js";
import { relicList } from "../systems/relics.js";
import { bossHealthFraction } from "../entities/bosses.js";
import { drawGlyph } from "../render/actors.js";

function panel(ctx, x, y, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(4,8,14,${alpha})`;
  ctx.fillRect(x, y, w, h);
}

function drawHullPips(ctx, run, pal) {
  const p = run.player;
  const x0 = 34;
  const y = 20;
  for (let i = 0; i < p.maxHull; i++) {
    const x = x0 + i * 30;
    const filled = i < p.hull;
    ctx.beginPath();
    ctx.moveTo(x + 11, y);
    ctx.lineTo(x + 22, y + 13);
    ctx.lineTo(x + 11, y + 26);
    ctx.lineTo(x, y + 13);
    ctx.closePath();
    ctx.fillStyle = filled ? pal.ink : "rgba(255,255,255,0.10)";
    ctx.fill();
    ctx.strokeStyle = filled ? pal.accent : "rgba(255,255,255,0.22)";
    ctx.lineWidth = 2;
    ctx.stroke();
    if (filled) {
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(x + 11, y + 13, 3.4, 0, 6.28);
      ctx.fill();
    }
  }

  // Relics sit immediately beside the hull pips.
  const relics = relicList(run);
  for (let i = 0; i < relics.length; i++) {
    const r = relics[i];
    const x = x0 + p.maxHull * 30 + 16 + i * 42;
    ctx.fillStyle = "rgba(4,8,14,0.7)";
    ctx.fillRect(x, y - 3, 36, 32);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y - 3, 36, 32);
    drawGlyph(ctx, r.shape, x + 18, y + 13, 11, r.color);
  }
}

function drawFloorLabel(ctx, run, pal) {
  const floor = floorOf(run);
  ctx.textAlign = "left";
  ctx.fillStyle = pal.accent;
  ctx.font = `bold 26px ${UI.font}`;
  ctx.fillText(`FLOOR ${floor.id}`, 34, 78);
  ctx.fillStyle = pal.ink;
  ctx.font = `bold 24px ${UI.font}`;
  ctx.fillText(floor.name.toUpperCase(), 140, 78);

  const label = isBossRoom(run) ? "BOSS" : `ROOM ${run.room + 1}/${ROOMS_PER_FLOOR}`;
  ctx.fillStyle = isBossRoom(run) ? pal.danger : pal.pale;
  ctx.font = `bold 22px ${UI.font}`;
  ctx.fillText(label, 34, 104);
}

function drawBossBar(ctx, run, pal) {
  const boss = run.boss;
  if (!boss || !boss.alive) return;
  const w = 520;
  const x = WORLD.w / 2 - w / 2;
  const y = 52;
  const frac = bossHealthFraction(boss);

  ctx.textAlign = "center";
  ctx.font = `bold 27px ${UI.font}`;
  ctx.fillStyle = pal.ink;
  ctx.fillText(boss.name, WORLD.w / 2, y - 8);

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x, y, w, 22);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, pal.danger);
  g.addColorStop(1, pal.accent);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w * frac, 22);
  ctx.strokeStyle = pal.pale;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, 22);

  // Phase ticks at 60% and 30%: the player can see the fight's structure.
  ctx.strokeStyle = "rgba(255,255,255,0.65)";
  ctx.lineWidth = 2;
  for (const m of [0.3, 0.6]) {
    ctx.beginPath();
    ctx.moveTo(x + w * m, y - 3);
    ctx.lineTo(x + w * m, y + 25);
    ctx.stroke();
  }

  ctx.textAlign = "left";
  ctx.font = `bold 20px ${UI.font}`;
  ctx.fillStyle = pal.pale;
  ctx.fillText(`PHASE ${boss.phase}`, x, y + 48);
  ctx.textAlign = "right";
  ctx.fillStyle = pal.ink;
  ctx.fillText(`${Math.ceil(frac * 100)}%`, x + w, y + 48);
}

function drawScore(ctx, run, pal) {
  ctx.textAlign = "right";
  ctx.fillStyle = pal.ink;
  ctx.font = `bold 46px ${UI.font}`;
  ctx.fillText(String(run.score).padStart(5, "0"), WORLD.w - 34, 58);

  const combo = run.combo;
  const hot = combo >= 3;
  ctx.font = `bold 26px ${UI.font}`;
  ctx.fillStyle = hot ? pal.accent : pal.pale;
  ctx.fillText(`COMBO x${combo.toFixed(1)}`, WORLD.w - 34, 92);

  // A thin bar showing how long the combo has left.
  const w = 180;
  const frac = Math.max(0, Math.min(1, run.comboTimer / 3.2));
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(WORLD.w - 34 - w, 100, w, 5);
  ctx.fillStyle = hot ? pal.accent : pal.pale;
  ctx.fillRect(WORLD.w - 34 - w, 100, w * frac, 5);
}

function drawHeat(ctx, run, pal) {
  const p = run.player;
  const x = 34;
  const y = WORLD.h - 52;
  const w = 330;
  const h = 22;
  ctx.textAlign = "left";
  ctx.font = `bold 22px ${UI.font}`;
  ctx.fillStyle = p.overheated ? pal.danger : pal.pale;
  ctx.fillText(p.overheated ? "OVERHEAT" : `HEAT ${Math.round(p.heat)}%`, x, y - 12);

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x, y, w, h);
  const frac = p.heat / 100;
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, pal.accent);
  g.addColorStop(0.6, pal.pale);
  g.addColorStop(1, pal.danger);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w * frac, h);
  ctx.strokeStyle = p.overheated ? pal.danger : pal.accent;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  // Tick marks so the bar reads as a gauge, not a blob.
  ctx.strokeStyle = "rgba(0,0,0,0.45)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(x + (w / 10) * i, y);
    ctx.lineTo(x + (w / 10) * i, y + h);
    ctx.stroke();
  }

  if (p.overheated) {
    ctx.font = `bold 20px ${UI.font}`;
    ctx.fillStyle = pal.danger;
    ctx.fillText("COOLING", x + w + 16, y + 18);
  }
}

// One ring gauge: the flare and each dash charge are drawn the same way.
function ringGauge(ctx, cx, cy, radius, frac, color, dim, label, ready) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 6.28);
  ctx.strokeStyle = dim;
  ctx.lineWidth = 7;
  ctx.stroke();

  if (frac > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, frac));
    ctx.strokeStyle = color;
    ctx.lineWidth = 7;
    ctx.stroke();
  }
  ctx.textAlign = "center";
  ctx.font = `bold 19px ${UI.font}`;
  ctx.fillStyle = ready ? color : "rgba(255,255,255,0.55)";
  ctx.fillText(label, cx, cy + 7);
}

function drawGauges(ctx, run, pal) {
  const p = run.player;
  const build = run.build;
  const cy = WORLD.h - 46;

  // Flare: one large ring on the left of the cluster.
  const flareX = 1024;
  ringGauge(ctx, flareX, cy, 28, p.flare / FLARE.max, pal.accent, "rgba(255,255,255,0.14)",
    p.flare >= FLARE.max ? "FLARE" : `${Math.floor(p.flare)}%`, p.flare >= FLARE.max);
  ctx.textAlign = "center";
  ctx.font = `bold 17px ${UI.font}`;
  ctx.fillStyle = pal.pale;
  ctx.fillText("RMB / E", flareX, cy - 40);

  // Dash: one small ring per charge, the next charge filling the first empty one.
  const dashX = 1104;
  for (let i = 0; i < build.dashCharges; i++) {
    const cx = dashX + i * 44;
    const ready = i < p.dashCharges;
    const frac = ready ? 1 : i === p.dashCharges ? p.dashRecharge / DASH.recharge : 0;
    ringGauge(ctx, cx, cy, 17, frac, pal.pale, "rgba(255,255,255,0.14)", ready ? "D" : "", ready);
  }
  ctx.textAlign = "center";
  ctx.font = `bold 17px ${UI.font}`;
  ctx.fillStyle = pal.pale;
  ctx.fillText("SPACE", dashX + ((build.dashCharges - 1) * 44) / 2, cy - 40);
}

export function drawHud(ctx, run) {
  const pal = floorOf(run).palette;

  // Top and bottom strips: dark bars that frame the arena and hold the readouts.
  ctx.fillStyle = "rgba(4,8,14,0.72)";
  ctx.fillRect(0, 0, WORLD.w, ARENA.y - 6);
  panel(ctx, 0, ARENA.y + ARENA.h + 8, WORLD.w, WORLD.h - (ARENA.y + ARENA.h + 8), 0.72);

  drawHullPips(ctx, run, pal);
  drawFloorLabel(ctx, run, pal);
  drawScore(ctx, run, pal);
  drawBossBar(ctx, run, pal);
  drawHeat(ctx, run, pal);
  drawGauges(ctx, run, pal);

  // Kills in the middle of the bottom strip: a small, honest run stat.
  ctx.textAlign = "center";
  ctx.font = `bold 22px ${UI.font}`;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(`${run.kills} KILLS   ${run.roomsCleared} ROOMS`, WORLD.w / 2 - 40, WORLD.h - 30);
}
