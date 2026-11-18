// Two screens between floors: the salvage table (spend what the kills dropped) and the
// route choice (an elite door or a rest door). One screen each, big cards, keys or a click.
import { WORLD, UI, RARITY, FLOORS } from "../config.js";
import { floorOf } from "../run.js";
import { drawGlyph } from "../render/actors.js";
import { drawRouteStrip } from "./route.js";
import { shopLayout, shopItemAt } from "../systems/shop.js";
import { relicList } from "../systems/relics.js";

export { shopItemAt };

const CARD_W = 340;
const CARD_H = 420;
const CARD_Y = 200;

export function routeCards() {
  const w = 430;
  const h = 430;
  const gap = 60;
  const total = w * 2 + gap;
  const x0 = (WORLD.w - total) / 2;
  const y = 232;
  return [
    { x: x0, y, w, h, index: 0, kind: "elite" },
    { x: x0 + w + gap, y, w, h, index: 1, kind: "rest" },
  ];
}

export function routeCardAt(x, y) {
  for (const r of routeCards()) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.index;
  }
  return -1;
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

function backdrop(ctx, run, top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  // A faint room grid, so the screen still reads as a place in the tower.
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  for (let x = 0; x <= WORLD.w; x += 74) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, WORLD.h);
    ctx.stroke();
  }
  for (let y = 0; y <= WORLD.h; y += 74) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WORLD.w, y);
    ctx.stroke();
  }
  ctx.restore();
}

function salvageTag(ctx, x, y, amount, pal, size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size, size);
  ctx.fillStyle = pal.warm;
  ctx.strokeStyle = pal.warm;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-11, -8);
  ctx.lineTo(4, -8);
  ctx.lineTo(11, 0);
  ctx.lineTo(4, 8);
  ctx.lineTo(-11, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.textAlign = "left";
  ctx.font = `bold ${Math.round(26 * size)}px ${UI.font}`;
  ctx.fillStyle = pal.ink;
  ctx.fillText(String(amount), x + 20 * size, y + 9 * size);
}

function drawShopCard(ctx, run, item, rect, index, t) {
  const pal = floorOf(run).palette;
  const rarity = RARITY[item.rarity] || RARITY.common;
  const afford = !item.sold && run.salvage >= item.price;
  const edge = item.sold ? "rgba(255,255,255,0.18)" : rarity.color;

  ctx.save();
  ctx.translate(rect.x, rect.y);

  const bg = ctx.createLinearGradient(0, 0, 0, rect.h);
  bg.addColorStop(0, item.sold ? "rgba(8,12,18,0.85)" : "rgba(12,22,32,0.97)");
  bg.addColorStop(1, "rgba(4,9,14,0.97)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, rect.w, rect.h);

  ctx.fillStyle = item.sold ? "rgba(255,255,255,0.18)" : rarity.color;
  ctx.fillRect(0, 0, rect.w, 8);
  ctx.strokeStyle = edge;
  ctx.lineWidth = afford ? 3 : 2;
  ctx.strokeRect(0, 0, rect.w, rect.h);

  const cx = rect.w / 2;
  const cy = 116;

  // Icon disc.
  const glow = ctx.createRadialGradient(cx, cy, 6, cx, cy, 76);
  glow.addColorStop(0, item.sold ? "rgba(255,255,255,0.05)" : `${rarity.color}55`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 76, 0, 6.28);
  ctx.fill();
  ctx.strokeStyle = item.sold ? "rgba(255,255,255,0.2)" : rarity.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 54, 0, 6.28);
  ctx.stroke();
  drawGlyph(ctx, item.shape, cx, cy, 34, item.sold ? "rgba(255,255,255,0.25)" : rarity.color);

  ctx.textAlign = "center";
  ctx.font = `bold 30px ${UI.font}`;
  ctx.fillStyle = item.sold ? "rgba(255,255,255,0.3)" : "#f2fbff";
  ctx.fillText(item.name, cx, 226);

  ctx.font = `bold 19px ${UI.font}`;
  ctx.fillStyle = item.sold ? "rgba(255,255,255,0.2)" : rarity.color;
  ctx.fillText(item.sold ? "BOUGHT" : rarity.label, cx, 258);

  ctx.font = `bold 21px ${UI.font}`;
  ctx.fillStyle = item.sold ? "rgba(255,255,255,0.22)" : "#cfe4ef";
  const lines = wrapText(ctx, item.desc, rect.w - 56);
  lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, cx, 296 + i * 26));

  // Price plate.
  const pw = rect.w - 56;
  const px = 28;
  const py = rect.h - 96;
  ctx.fillStyle = item.sold ? "rgba(255,255,255,0.05)" : afford ? "rgba(255,179,71,0.16)" : "rgba(255,80,80,0.12)";
  ctx.fillRect(px, py, pw, 40);
  ctx.strokeStyle = item.sold ? "rgba(255,255,255,0.14)" : afford ? pal.warm : "rgba(255,110,110,0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, 40);
  ctx.font = `bold 22px ${UI.font}`;
  ctx.fillStyle = item.sold ? "rgba(255,255,255,0.28)" : afford ? pal.warm : "rgba(255,140,140,0.9)";
  ctx.fillText(item.sold ? "SOLD" : `${item.price} SALVAGE`, cx, py + 28);

  ctx.font = `bold 20px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.7)";
  ctx.fillText(`[ ${index + 1} ]`, cx, rect.h - 20);

  ctx.restore();
}

export function drawShop(ctx, run, t) {
  const pal = floorOf(run).palette;
  backdrop(ctx, run, pal.deep, "#04080c");

  drawRouteStrip(ctx, run, { y: 54, size: 13, step: 34, groupGap: 46 });

  ctx.textAlign = "left";
  ctx.font = `bold 54px ${UI.font}`;
  ctx.fillStyle = "#f2fbff";
  ctx.fillText("THE SALVAGE TABLE", 60, 168);
  ctx.font = `bold 22px ${UI.font}`;
  ctx.fillStyle = pal.accent;
  ctx.fillText("SPEND WHAT THE DARK PAID YOU", 62, 200 - 4);

  // The purse, top right.
  ctx.textAlign = "right";
  ctx.font = `bold 22px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.6)";
  ctx.fillText("PURSE", WORLD.w - 60, 150);
  salvageTag(ctx, WORLD.w - 150, 182, run.salvage, pal, 1.25);

  const layout = shopLayout();
  const items = run.shop ? run.shop.items : [];
  for (let i = 0; i < layout.length; i++) {
    if (!items[i]) continue;
    drawShopCard(ctx, run, items[i], layout[i], i, t);
  }

  ctx.textAlign = "center";
  ctx.font = `bold 24px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.8)";
  ctx.fillText("PRESS 1  2  3  TO BUY", WORLD.w / 2, 682);
  ctx.font = `bold 22px ${UI.font}`;
  ctx.fillStyle = pal.warm;
  ctx.fillText("ENTER  ·  DESCEND", WORLD.w / 2, 720);
  ctx.font = `bold 19px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.45)";
  ctx.fillText("salvage carries over to the next table", WORLD.w / 2, 756);
}

function drawDoor(ctx, run, rect, kind, t) {
  const pal = floorOf(run).palette;
  const elite = kind === "elite";
  const accent = elite ? pal.danger : pal.accent;

  ctx.save();
  ctx.translate(rect.x, rect.y);

  const bg = ctx.createLinearGradient(0, 0, 0, rect.h);
  bg.addColorStop(0, elite ? "rgba(28,12,10,0.96)" : "rgba(8,22,24,0.96)");
  bg.addColorStop(1, "rgba(4,8,12,0.98)");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, rect.w, rect.h);

  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, rect.w, rect.h);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, rect.w, 9);

  // An arched doorway at the top of the card: the shape of the thing you are choosing.
  const cx = rect.w / 2;
  const doorW = 150;
  const doorH = 168;
  const top = 44;
  ctx.beginPath();
  ctx.moveTo(cx - doorW / 2, top + doorH);
  ctx.lineTo(cx - doorW / 2, top + doorW / 2);
  ctx.arc(cx, top + doorW / 2, doorW / 2, Math.PI, 0);
  ctx.lineTo(cx + doorW / 2, top + doorH);
  ctx.closePath();
  const dg = ctx.createLinearGradient(0, top, 0, top + doorH);
  dg.addColorStop(0, elite ? "rgba(255,112,67,0.55)" : "rgba(46,230,200,0.5)");
  dg.addColorStop(1, "rgba(0,0,0,0.15)");
  ctx.fillStyle = dg;
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.stroke();

  // The glyph inside the doorway.
  drawGlyph(ctx, elite ? "spikes" : "heart", cx, top + doorH * 0.62, 40, elite ? "#ffd0b8" : "#d8fff6");

  ctx.textAlign = "center";
  ctx.font = `bold 40px ${UI.font}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(elite ? "ELITE ROOM" : "REST ROOM", cx, top + doorH + 48);

  ctx.font = `bold 20px ${UI.font}`;
  ctx.fillStyle = accent;
  ctx.fillText(elite ? "MORE BODIES  ·  MORE SALVAGE" : "QUIET WATER  ·  HULL RESTORED", cx, top + doorH + 80);

  ctx.font = `bold 21px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.75)";
  const lines = elite
    ? ["three extra creatures", "tougher, and worth 1.8x", "+40 salvage on the clear"]
    : ["no fight in this room", "repair 2 hull", "+18 salvage"];
  lines.forEach((line, i) => ctx.fillText(line, cx, top + doorH + 118 + i * 27));

  ctx.font = `bold 22px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.7)";
  ctx.fillText(`[ ${rect.index + 1} ]`, cx, rect.h - 18);

  ctx.restore();
}

export function drawRouteChoice(ctx, run, t) {
  const pal = floorOf(run).palette;
  backdrop(ctx, run, "#0b141c", "#03070b");

  ctx.textAlign = "center";
  ctx.font = `bold 52px ${UI.font}`;
  ctx.fillStyle = "#f2fbff";
  ctx.fillText("TWO DOORS", WORLD.w / 2, 122);
  ctx.font = `bold 23px ${UI.font}`;
  ctx.fillStyle = pal.accent;
  ctx.fillText(`THE KEEPER IS DOWN  ·  CHOOSE HOW YOU ENTER ${floorOf(run) ? FLOORS[Math.min(run.floor + 1, FLOORS.length - 1)].name.toUpperCase() : ""}`,
    WORLD.w / 2, 162);

  for (const rect of routeCards()) drawDoor(ctx, run, rect, rect.kind, t);

  const relics = relicList(run);
  ctx.font = `bold 21px ${UI.font}`;
  ctx.fillStyle = "rgba(223,247,241,0.55)";
  ctx.fillText(`RELICS ${relics.length}   ·   SALVAGE ${run.salvage}`, WORLD.w / 2, 706);

  ctx.font = `bold 22px ${UI.font}`;
  ctx.fillStyle = pal.warm;
  ctx.fillText("PRESS 1  OR  2", WORLD.w / 2, 748);
}

export { CARD_W, CARD_H, CARD_Y };
