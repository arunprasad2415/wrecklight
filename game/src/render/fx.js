// Light, fire and debris: the beam, bullets, shockwaves, particles, damage numbers,
// the dark pool and the room banner.
import { WORLD, ARENA, UI } from "../config.js";

export function drawBeam(ctx, run, pal, t) {
  const p = run.player;
  if (!p.beamOn || p.overheated || p.beamLength <= 0) return;
  const width = run.build ? run.build.beamWidth : 1;
  const ox = p.x + Math.cos(p.angle) * (p.r + 6);
  const oy = p.y + Math.sin(p.angle) * (p.r + 6);
  const ex = ox + Math.cos(p.angle) * p.beamLength;
  const ey = oy + Math.sin(p.angle) * p.beamLength;
  const flicker = 0.86 + Math.sin(t * 40) * 0.06 + Math.sin(t * 17) * 0.04;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  // Wide soft halo.
  ctx.strokeStyle = pal.accent;
  ctx.globalAlpha = 0.18 * flicker;
  ctx.lineWidth = 34 * width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // The body of the light.
  ctx.globalAlpha = 0.5 * flicker;
  ctx.strokeStyle = pal.pale;
  ctx.lineWidth = 15 * width;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // Hot core: starts clear of the lamplighter so the body stays readable under the glow.
  const coreStart = 46;
  const coreLen = Math.max(0, p.beamLength - coreStart);
  if (coreLen > 0) {
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4.5 * width;
    ctx.beginPath();
    ctx.moveTo(ox + Math.cos(p.angle) * coreStart, oy + Math.sin(p.angle) * coreStart);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  // Impact: a bright disc and a star of sparks where the light lands.
  if (p.beamHit) {
    const g = ctx.createRadialGradient(p.beamHitX, p.beamHitY, 0, p.beamHitX, p.beamHitY, 30);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.4, pal.pale);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.beamHitX, p.beamHitY, 30, 0, 6.28);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = t * 6 + (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(p.beamHitX + Math.cos(a) * 8, p.beamHitY + Math.sin(a) * 8);
      ctx.lineTo(p.beamHitX + Math.cos(a) * 26, p.beamHitY + Math.sin(a) * 26);
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
    const size = n.crit ? 30 : n.wide ? 24 : 20;
    ctx.font = `bold ${size}px ${UI.font}`;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.strokeText(n.text, n.x, n.y);
    ctx.fillStyle = n.color;
    ctx.fillText(n.text, n.x, n.y);
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
