// The route strip: the whole descent as one line of rooms — fights, keepers, shops — with the
// cleared ones filled, the current one ringed and the rest waiting. Used by the draft and the
// results screens so the run's structure is visible in one glance.
import { FLOORS, ROUTE_PER_FLOOR, UI } from "../config.js";
import { routeIndexOf } from "../run.js";

export function routeNodes() {
  const nodes = [];
  for (let f = 0; f < FLOORS.length; f++) {
    for (let k = 0; k < ROUTE_PER_FLOOR; k++) {
      const kind = k === 3 ? "boss" : k === 4 ? "shop" : "fight";
      nodes.push({ floor: f, k, kind });
    }
  }
  return nodes;
}

const NODES = routeNodes();

function nodeShape(ctx, kind, x, y, s) {
  ctx.beginPath();
  if (kind === "boss") {
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s, y);
    ctx.closePath();
  } else if (kind === "shop") {
    ctx.moveTo(x - s, y - s * 0.7);
    ctx.lineTo(x + s * 0.55, y - s * 0.7);
    ctx.lineTo(x + s, y - s * 0.1);
    ctx.lineTo(x + s * 0.55, y + s * 0.7);
    ctx.lineTo(x - s, y + s * 0.7);
    ctx.closePath();
  } else {
    const r = s * 0.32;
    ctx.moveTo(x - s + r, y - s);
    ctx.lineTo(x + s - r, y - s);
    ctx.quadraticCurveTo(x + s, y - s, x + s, y - s + r);
    ctx.lineTo(x + s, y + s - r);
    ctx.quadraticCurveTo(x + s, y + s, x + s - r, y + s);
    ctx.lineTo(x - s + r, y + s);
    ctx.quadraticCurveTo(x - s, y + s, x - s, y + s - r);
    ctx.lineTo(x - s, y - s + r);
    ctx.quadraticCurveTo(x - s, y - s, x - s + r, y - s);
    ctx.closePath();
  }
}

export function routeGeometry(x0, y, s, step, groupGap) {
  const out = [];
  for (let i = 0; i < NODES.length; i++) {
    const node = NODES[i];
    const groupStart = node.floor * (ROUTE_PER_FLOOR * step + groupGap);
    out.push({ ...node, x: x0 + groupStart + node.k * step, y, s });
  }
  return out;
}

// Draw the strip. `cur` is the index of the node the run is standing on.
export function drawRouteStrip(ctx, run, opts = {}) {
  const s = opts.size || 15;
  const step = opts.step || s * 2.6;
  const groupGap = opts.groupGap || s * 3.4;
  const total = FLOORS.length * (ROUTE_PER_FLOOR * step) + (FLOORS.length - 1) * groupGap;
  const x0 = (opts.x !== undefined ? opts.x : 640 - total / 2) + s;
  const y = opts.y || 60;
  const cur = routeIndexOf(run);
  const nodes = routeGeometry(x0, y, s, step, groupGap);
  const t = run.t || 0;

  ctx.save();
  ctx.lineCap = "round";

  // The line the run walks: bright behind, dim ahead.
  ctx.lineWidth = 3;
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    ctx.strokeStyle = i < cur ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.14)";
    ctx.beginPath();
    ctx.moveTo(a.x + s + 4, y);
    ctx.lineTo(b.x - s - 4, y);
    ctx.stroke();
  }

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const pal = FLOORS[n.floor].palette;
    const done = i < cur;
    const now = i === cur;

    nodeShape(ctx, n.kind, n.x, n.y, s);
    if (done) {
      ctx.fillStyle = pal.accent;
      ctx.globalAlpha = 0.92;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else if (now) {
      const pulse = 0.55 + Math.sin(t * 5) * 0.25;
      ctx.fillStyle = "rgba(255,255,255,0.10)";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.globalAlpha = 1;
      // A caret over the node the run is standing on.
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(n.x, n.y - s - 6);
      ctx.lineTo(n.x - 6, n.y - s - 14);
      ctx.lineTo(n.x + 6, n.y - s - 14);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.26)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // The node's label: room number, B for a keeper, S for a shop.
    const label = n.kind === "boss" ? "B" : n.kind === "shop" ? "S" : String(n.k + 1);
    ctx.textAlign = "center";
    ctx.font = `bold ${Math.round(s * 0.95)}px ${UI.font}`;
    ctx.fillStyle = done ? "#08131c" : now ? "#ffffff" : "rgba(255,255,255,0.45)";
    ctx.fillText(label, n.x, n.y + s * 0.34);
  }

  // Floor captions under each group.
  if (opts.labels !== false) {
    for (let f = 0; f < FLOORS.length; f++) {
      const first = nodes[f * ROUTE_PER_FLOOR];
      const last = nodes[f * ROUTE_PER_FLOOR + ROUTE_PER_FLOOR - 1];
      const cx = (first.x + last.x) / 2;
      const done = f < run.floor;
      const here = f === run.floor;
      ctx.textAlign = "center";
      ctx.font = `bold ${Math.round(s * 0.72)}px ${UI.font}`;
      ctx.fillStyle = here ? FLOORS[f].palette.accent : done ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.26)";
      ctx.fillText(`FLOOR ${f + 1}`, cx, y + s + Math.round(s * 1.35));
    }
  }
  ctx.restore();
}
