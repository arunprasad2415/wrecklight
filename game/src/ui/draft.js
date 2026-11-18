// The draft screen: the run's route at the top, three upgrade cards, the build on the right.
import { WORLD, UI, RARITY, FLOORS } from "../config.js";
import { buildSummary, stacksOf } from "../systems/upgrades.js";
import { relicList } from "../systems/relics.js";
import { drawGlyph } from "../render/actors.js";
import { floorOf } from "../run.js";
import { drawRouteStrip } from "./route.js";

const CARD_W = 288;
const CARD_H = 422;
const CARD_Y = 176;
const CARD_X = [40, 344, 648];
const PANEL_X = 956;
const PANEL_W = 284;

export function draftLayout() {
  return CARD_X.map((x, i) => ({ x, y: CARD_Y, w: CARD_W, h: CARD_H, index: i }));
}

export function cardAt(x, y) {
  const rects = draftLayout();
  for (const r of rects) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.index;
  }
  return -1;
}

function drawCard(ctx, card, rect, hover, run, t) {
  const rarity = RARITY[card.rarity] || RARITY.common;
  const stacks = stacksOf(run, card.id);
  const lift = hover ? -8 : 0;

  ctx.save();
  ctx.translate(rect.x, rect.y + lift);

  // Card body.
  const bg = ctx.createLinearGradient(0, 0, 0, rect.h);
  bg.addColorStop(0, "rgba(10,20,30,0.98)");
  bg.addColorStop(1, "rgba(4,10,16,0.98)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, rect.w, rect.h);

  // Rarity edge and top band.
  ctx.fillStyle = rarity.color;
  ctx.globalAlpha = hover ? 1 : 0.8;
  ctx.fillRect(0, 0, rect.w, 8);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = hover ? "#ffffff" : rarity.color;
  ctx.lineWidth = hover ? 4 : 2.5;
  ctx.strokeRect(0, 0, rect.w, rect.h);

  // Icon disc.
  const cx = rect.w / 2;
  const cy = 112;
  const glow = ctx.createRadialGradient(cx, cy, 6, cx, cy, 74);
  glow.addColorStop(0, `${rarity.color}55`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 74, 0, 6.28);
  ctx.fill();
  ctx.strokeStyle = rarity.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 50, 0, 6.28);
  ctx.stroke();
  drawGlyph(ctx, card.shape, cx, cy, 33, rarity.color);

  // Name, wrapped to two lines if needed.
  ctx.textAlign = "center";
  ctx.font = `bold 29px ${UI.font}`;
  ctx.fillStyle = "#f2fbff";
  const words = card.name.split(" ");
  if (words.length > 1 && ctx.measureText(card.name).width > rect.w - 40) {
    ctx.fillText(words[0], cx, 208);
    ctx.fillText(words.slice(1).join(" "), cx, 240);
  } else {
    ctx.fillText(card.name, cx, 220);
  }

  // Rarity label.
  ctx.font = `bold 19px ${UI.font}`;
  ctx.fillStyle = rarity.color;
  ctx.fillText(rarity.label, cx, 272);

  // Description, wrapped.
  ctx.font = `bold 21px ${UI.font}`;
  ctx.fillStyle = "#cfe4ef";
  const lines = wrapText(ctx, card.desc, rect.w - 48);
  lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, cx, 310 + i * 25));

  // Stack pips and key hint.
  const maxPips = Math.min(5, card.max);
  for (let i = 0; i < maxPips; i++) {
    const px = cx - (maxPips * 16) / 2 + i * 16 + 8;
    ctx.fillStyle = i < stacks ? rarity.color : "rgba(255,255,255,0.16)";
    ctx.beginPath();
    ctx.arc(px, rect.h - 46, 5, 0, 6.28);
    ctx.fill();
  }
  ctx.font = `bold 20px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.7)";
  ctx.fillText(`[ ${rect.index + 1} ]`, cx, rect.h - 16);

  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function drawDraft(ctx, run, choices, hover, t) {
  const pal = floorOf(run).palette;
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  g.addColorStop(0, pal.deep);
  g.addColorStop(1, "#04080c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  // The route, at the top: where this run has been and what is left of it.
  drawRouteStrip(ctx, run, { y: 40, size: 12, step: 32, groupGap: 44 });

  // Header.
  ctx.textAlign = "left";
  ctx.font = `bold 48px ${UI.font}`;
  ctx.fillStyle = "#f2fbff";
  ctx.fillText("THE LAMP GROWS", 40, 124);
  ctx.font = `bold 21px ${UI.font}`;
  ctx.fillStyle = pal.accent;
  ctx.fillText("CHOOSE ONE UPGRADE", 42, 152);

  ctx.textAlign = "right";
  ctx.font = `bold 22px ${UI.font}`;
  ctx.fillStyle = pal.ink;
  ctx.fillText(`FLOOR ${run.floor + 1}  ·  ${FLOORS[run.floor] ? FLOORS[run.floor].name.toUpperCase() : ""}`, WORLD.w - 40, 108);
  ctx.font = `bold 21px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.6)";
  ctx.fillText(`ROOM ${run.room + 1} CLEARED   ·   SCORE ${run.score}`, WORLD.w - 40, 140);

  const rects = draftLayout();
  choices.forEach((card, i) => drawCard(ctx, card, rects[i], hover === i, run, t));

  // Build panel.
  ctx.fillStyle = "rgba(6,14,22,0.9)";
  ctx.fillRect(PANEL_X, CARD_Y, PANEL_W, CARD_H);
  ctx.strokeStyle = "rgba(46,230,200,0.4)";
  ctx.lineWidth = 2;
  ctx.strokeRect(PANEL_X, CARD_Y, PANEL_W, CARD_H);

  ctx.textAlign = "left";
  ctx.font = `bold 23px ${UI.font}`;
  ctx.fillStyle = pal.accent;
  ctx.fillText("YOUR BUILD", PANEL_X + 20, CARD_Y + 38);

  const summary = buildSummary(run);
  let y = CARD_Y + 78;
  if (summary.length === 0) {
    ctx.font = `bold 20px ${UI.font}`;
    ctx.fillStyle = "rgba(223,247,241,0.5)";
    ctx.fillText("nothing yet", PANEL_X + 20, y);
    y += 30;
  }
  for (const row of summary.slice(0, 8)) {
    drawGlyph(ctx, row.shape, PANEL_X + 32, y - 6, 9, RARITY[row.rarity].color);
    ctx.font = `bold 19px ${UI.font}`;
    ctx.fillStyle = "#dff7f1";
    ctx.fillText(row.name, PANEL_X + 52, y);
    ctx.textAlign = "right";
    ctx.fillStyle = RARITY[row.rarity].color;
    ctx.fillText(`x${row.count}`, PANEL_X + PANEL_W - 18, y);
    ctx.textAlign = "left";
    y += 28;
  }

  // Relics and the purse, under the build.
  const relics = relicList(run);
  ctx.font = `bold 21px ${UI.font}`;
  ctx.fillStyle = pal.accent;
  ctx.fillText("RELICS", PANEL_X + 20, CARD_Y + CARD_H - 116);
  if (relics.length === 0) {
    ctx.font = `bold 19px ${UI.font}`;
    ctx.fillStyle = "rgba(223,247,241,0.45)";
    ctx.fillText("none", PANEL_X + 20, CARD_Y + CARD_H - 86);
  }
  relics.slice(0, 4).forEach((r, i) => {
    drawGlyph(ctx, r.shape, PANEL_X + 32, CARD_Y + CARD_H - 82 + i * 28, 9, r.color);
    ctx.font = `bold 19px ${UI.font}`;
    ctx.fillStyle = "#dff7f1";
    ctx.fillText(r.name, PANEL_X + 52, CARD_Y + CARD_H - 76 + i * 28);
  });

  ctx.font = `bold 20px ${UI.font}`;
  ctx.fillStyle = pal.warm;
  ctx.fillText(`SALVAGE ${run.salvage}`, PANEL_X + 20, CARD_Y + CARD_H - 18);

  // Footer hint.
  ctx.textAlign = "center";
  ctx.font = `bold 23px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.75)";
  ctx.fillText("PRESS 1  2  3  OR CLICK A CARD", WORLD.w / 2 - 100, 644);
  ctx.font = `bold 19px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.45)";
  ctx.fillText("hull restores a little after every room  ·  a shop waits after each keeper", WORLD.w / 2 - 100, 676);
}
