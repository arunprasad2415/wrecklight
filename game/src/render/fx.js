// Light, fire and debris: the beam, bullets, shockwaves, particles, damage numbers,
// the dark pool, the room banners and the low-hull warning.
import { WORLD, ARENA, UI, FEEL } from "../config.js";

function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function drawBeam(ctx, run, pal, t) {
  const p = run.player;
  if (!p.beamOn || p.overheated || p.beamLength <= 0) return;
  const width = run.build ? run.build.beamWidth : 1;
  // Twin Shutter draws two extra rays; everything else draws the one.
  const rays = p.beamRays && p.beamRays.length
    ? p.beamRays
    : [{ angle: p.angle, length: p.beamLength, hit: p.beamHit, hitX: p.beamHitX, hitY: p.beamHitY, main: true }];
  const ox = p.x + Math.cos(p.angle) * (p.r + 6);
  const oy = p.y + Math.sin(p.angle) * (p.r + 6);
  const flicker = 0.86 + Math.sin(t * 40) * 0.06 + Math.sin(t * 17) * 0.04;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (const ray of rays) {
    const w = width * (ray.main ? 1 : 0.55);
    const a = ray.main ? 1 : 0.72;
    const ex = ox + Math.cos(ray.angle) * ray.length;
    const ey = oy + Math.sin(ray.angle) * ray.length;

    // The light fades in over its first stretch, so the lamplighter standing at the origin
    // is never swallowed by its own bloom.
    const ramp = ctx.createLinearGradient(ox, oy, ex, ey);
    ramp.addColorStop(0, rgba(pal.accent, 0));
    ramp.addColorStop(0.1, rgba(pal.accent, 0.14 * flicker * a));
    ramp.addColorStop(1, rgba(pal.accent, 0.14 * flicker * a));
    ctx.strokeStyle = ramp;
    ctx.globalAlpha = 1;
    ctx.lineWidth = 46 * w;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    const ramp2 = ctx.createLinearGradient(ox, oy, ex, ey);
    ramp2.addColorStop(0, rgba(pal.accent, 0));
    ramp2.addColorStop(0.08, rgba(pal.accent, 0.26 * flicker * a));
    ramp2.addColorStop(1, rgba(pal.accent, 0.26 * flicker * a));
    ctx.strokeStyle = ramp2;
    ctx.lineWidth = 24 * w;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // The body of the light.
    const ramp3 = ctx.createLinearGradient(ox, oy, ex, ey);
    ramp3.addColorStop(0, rgba(pal.pale, 0));
    ramp3.addColorStop(0.07, rgba(pal.pale, 0.55 * flicker * a));
    ramp3.addColorStop(1, rgba(pal.pale, 0.55 * flicker * a));
    ctx.strokeStyle = ramp3;
    ctx.lineWidth = 13 * w;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Hot white core: starts clear of the lamplighter so the body stays readable under the glow.
    const coreStart = 54;
    const coreLen = Math.max(0, ray.length - coreStart);
    if (coreLen > 0) {
      ctx.globalAlpha = 0.96 * a;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 4.5 * w;
      ctx.beginPath();
      ctx.moveTo(ox + Math.cos(ray.angle) * coreStart, oy + Math.sin(ray.angle) * coreStart);
      ctx.lineTo(ex, ey);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Impact: a hot disc, an amber skirt, and a star of sparks where the light lands.
  for (const ray of rays) {
    if (!ray.hit) continue;
    const hx = ray.hitX;
    const hy = ray.hitY;
    const scale = ray.main ? 1 : 0.62;
    const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 54 * scale);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.22, "rgba(255,246,214,0.92)");
    g.addColorStop(0.5, pal.pale);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(hx, hy, 54 * scale, 0, 6.28);
    ctx.fill();

    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 8; i++) {
      const a = t * 6 + (i / 8) * Math.PI * 2;
      const r0 = (10 + (i % 2) * 6) * scale;
      const r1 = (26 + (i % 3) * 14) * scale;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0);
      ctx.lineTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1);
      ctx.stroke();
    }
  }
  ctx.restore();
}

export function drawBolts(ctx, bolts, pal) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const b of bolts) {
    const a = Math.atan2(b.vy, b.vx);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = pal.pale;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - Math.cos(a) * 18, b.y - Math.sin(a) * 18);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, 6.28);
    ctx.fill();
  }
  ctx.restore();
}

export function drawEnemyBullets(ctx, bullets, t) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const b of bullets) {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 3.4);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, b.color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 3.4, 0, 6.28);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.5, 0, 6.28);
    ctx.fill();
  }
  ctx.restore();
}

export function drawRings(ctx, rings) {
  ctx.save();
  for (const r of rings) {
    const life = r.kind === "flare" ? Math.max(0, r.life / 0.5) : 1;
    ctx.globalAlpha = 0.75 * life;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.width;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.r, 0, 6.28);
    ctx.stroke();
    ctx.globalAlpha = 0.3 * life;
    ctx.lineWidth = r.width * 2.2;
    ctx.stroke();
  }
  ctx.restore();
}

// Lightning arcs, drawn as a jagged run of segments between two points.
export function drawArcs(ctx, arcs) {
  if (!arcs || arcs.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const arc of arcs) {
    const a = Math.max(0, arc.life / arc.maxLife);
    ctx.globalAlpha = 0.9 * a;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(arc.x0, arc.y0);
    const steps = 6;
    for (let i = 1; i < steps; i++) {
      const k = i / steps;
      const jx = (arc.seed * 13 + i * 37) % 17 - 8;
      const jy = (arc.seed * 29 + i * 53) % 17 - 8;
      ctx.lineTo(arc.x0 + (arc.x1 - arc.x0) * k + jx, arc.y0 + (arc.y1 - arc.y0) * k + jy);
    }
    ctx.lineTo(arc.x1, arc.y1);
    ctx.stroke();
    ctx.globalAlpha = 0.35 * a;
    ctx.strokeStyle = arc.color;
    ctx.lineWidth = 7;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawParticles(ctx, parts) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of parts) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.restore();
}

export function drawNumbers(ctx, numbers) {
  ctx.save();
  ctx.textAlign = "center";
  for (const n of numbers) {
    const a = Math.min(1, n.life / (n.maxLife * 0.6));
    ctx.globalAlpha = a;
    const size = n.crit ? FEEL.critSize : n.wide ? 24 : FEEL.numberSize;
    ctx.font = `bold ${size}px ${UI.font}`;
    ctx.lineWidth = n.crit ? 6 : 4;
    ctx.strokeStyle = "rgba(0,0,0,0.78)";
    ctx.strokeText(n.text, n.x, n.y);
    ctx.fillStyle = n.color;
    ctx.fillText(n.text, n.x, n.y);
    if (n.crit) {
      ctx.font = `bold 15px ${UI.font}`;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText("CRIT", n.x, n.y - size * 0.82);
    }
  }
  ctx.restore();
}

// Floor 3's boss fight: the arena closes to a pool around the lamplighter.
export function drawDarkPool(ctx, run) {
  const amount = run.darkPool || 0;
  if (amount <= 0.01) return;
  const p = run.player;
  const inner = 120 + Math.sin(run.t * 2) * 12;
  const outer = 420;
  const g = ctx.createRadialGradient(p.x, p.y, inner, p.x, p.y, outer);
  g.addColorStop(0, "rgba(4,2,8,0)");
  g.addColorStop(0.45, `rgba(4,2,8,${0.55 * amount})`);
  g.addColorStop(1, `rgba(2,1,5,${0.97 * amount})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
}

export function drawFlash(ctx, run, pal) {
  if (run.flash <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = Math.min(0.55, run.flash * 0.5);
  ctx.fillStyle = pal.pale;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.restore();
}

export function drawBanner(ctx, run, pal) {
  if (run.banner <= 0) return;
  const a = Math.min(1, run.banner * 1.6);
  const y = ARENA.y + 92;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = "center";
  ctx.font = `bold 44px ${UI.font}`;
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.strokeText(run.bannerTitle, ARENA.cx, y);
  ctx.fillStyle = pal.ink;
  ctx.fillText(run.bannerTitle, ARENA.cx, y);
  if (run.bannerSub) {
    ctx.font = `bold 24px ${UI.font}`;
    ctx.fillStyle = pal.accent;
    ctx.fillText(run.bannerSub, ARENA.cx, y + 34);
  }
  ctx.restore();
}

// The beat after a room falls: a big word, a rule, and what it paid.
export function drawRoomClear(ctx, run, pal) {
  const life = run.clearBanner || 0;
  if (life <= 0) return;
  const k = Math.min(1, life / 0.35);
  const a = Math.min(1, k) * Math.min(1, life * 2.4);
  const cx = ARENA.cx;
  const cy = ARENA.y + 250;
  const grow = 1 + (1 - Math.min(1, life / FEEL.clearBanner)) * 0.06;

  ctx.save();
  ctx.globalAlpha = a;
  ctx.textAlign = "center";
  ctx.translate(cx, cy);
  ctx.scale(grow, grow);

  // A dark plate so the words read against a busy arena.
  ctx.fillStyle = "rgba(4,8,14,0.62)";
  ctx.fillRect(-330, -62, 660, 132);
  ctx.strokeStyle = pal.accent;
  ctx.globalAlpha = a * 0.85;
  ctx.lineWidth = 3;
  ctx.strokeRect(-330, -62, 660, 132);
  ctx.globalAlpha = a;

  ctx.font = `bold 58px ${UI.font}`;
  ctx.lineWidth = 9;
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.strokeText(run.clearTitle || "ROOM CLEAR", 0, 4);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(run.clearTitle || "ROOM CLEAR", 0, 4);

  ctx.font = `bold 24px ${UI.font}`;
  ctx.fillStyle = pal.accent;
  ctx.fillText(run.clearSub || "", 0, 44);
  ctx.restore();
}

export function drawHeatWarn(ctx, run, pal) {
  const p = run.player;
  if (!p.overheated) return;
  const pulse = 0.35 + Math.sin(run.t * 12) * 0.15;
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = pal.danger;
  ctx.lineWidth = 14;
  ctx.strokeRect(ARENA.x - 3, ARENA.y - 3, ARENA.w + 6, ARENA.h + 6);
  ctx.restore();
}

// Low hull: the edges of the arena pulse red, harder the closer the run is to over.
export function drawLowHull(ctx, run, pal) {
  const p = run.player;
  if (!p || p.hull <= 0 || p.hull > FEEL.lowHullAt) return;
  const urgency = 1 - (p.hull - 1) / (FEEL.lowHullAt + 0.001);
  const pulse = 0.45 + Math.sin(run.t * 6.2) * 0.3;
  const g = ctx.createRadialGradient(ARENA.cx, ARENA.cy, ARENA.h * 0.24, ARENA.cx, ARENA.cy, ARENA.h * 0.86);
  g.addColorStop(0, "rgba(255,40,60,0)");
  g.addColorStop(0.62, `rgba(255,40,60,${0.06 + 0.1 * urgency * pulse})`);
  g.addColorStop(1, `rgba(255,20,40,${0.2 + 0.34 * urgency * pulse})`);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
  ctx.globalAlpha = 0.5 + 0.4 * pulse;
  ctx.strokeStyle = pal.danger;
  ctx.lineWidth = 4;
  ctx.strokeRect(ARENA.x - 4, ARENA.y - 4, ARENA.w + 8, ARENA.h + 8);
  ctx.restore();
}
