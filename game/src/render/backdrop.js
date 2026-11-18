// The room itself: floor tiles, parallax decor, the arena frame and the vignette.
// Each floor has its own construction so the three read as three different places.
import { WORLD, ARENA, FLOORS } from "../config.js";
import { mulberry32, rand } from "../random.js";

function buildDecor(seed, floorIndex) {
  const rng = mulberry32(seed * 7 + floorIndex * 131 + 11);
  const decor = { motes: [], kelp: [], arches: [], shards: [], bricks: [] };

  for (let i = 0; i < 60; i++) {
    decor.motes.push({
      x: rand(rng, 0, WORLD.w),
      y: rand(rng, 0, WORLD.h),
      r: rand(rng, 0.8, 2.4),
      a: rand(rng, 0.15, 0.6),
      speed: rand(rng, 6, 26),
      phase: rand(rng, 0, 6.28),
    });
  }
  for (let i = 0; i < 18; i++) {
    decor.kelp.push({
      x: rand(rng, 20, WORLD.w - 20),
      h: rand(rng, 90, 260),
      w: rand(rng, 5, 13),
      lean: rand(rng, -0.5, 0.5),
      phase: rand(rng, 0, 6.28),
      side: rng() < 0.5 ? -1 : 1,
    });
  }
  for (let i = 0; i < 7; i++) {
    decor.arches.push({ x: 90 + i * 170, w: rand(rng, 100, 130), h: rand(rng, 250, 340) });
  }
  for (let i = 0; i < 26; i++) {
    decor.shards.push({
      x: rand(rng, 40, WORLD.w - 40),
      y: rand(rng, 120, WORLD.h - 40),
      s: rand(rng, 5, 17),
      rot: rand(rng, 0, 6.28),
      spin: rand(rng, -0.5, 0.5),
      drift: rand(rng, 4, 16),
      phase: rand(rng, 0, 6.28),
    });
  }
  for (let i = 0; i < 120; i++) {
    decor.bricks.push({ x: rand(rng, 0, WORLD.w), y: rand(rng, 0, WORLD.h), w: rand(rng, 34, 64), shade: rng() });
  }
  return decor;
}

export function ensureDecor(run) {
  if (!run.decor || run.decorFloor !== run.floor) {
    run.decor = buildDecor(run.seed || 1, run.floor);
    run.decorFloor = run.floor;
  }
  return run.decor;
}

export function drawBackdrop(ctx, run) {
  const floor = FLOORS[Math.min(run.floor, FLOORS.length - 1)];
  const pal = floor.palette;
  const t = run.t;
  const decor = ensureDecor(run);

  const base = ctx.createLinearGradient(0, 0, 0, WORLD.h);
  base.addColorStop(0, pal.bg);
  base.addColorStop(1, pal.deep);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);

  if (floor.id === 1) drawKelpStair(ctx, pal, decor, t);
  else if (floor.id === 2) drawRustChapel(ctx, pal, decor, t);
  else drawBlindDeep(ctx, pal, decor, t);

  drawFloorTiles(ctx, pal, t);
  drawMotes(ctx, pal, decor, t);
  drawFrame(ctx, pal, run);
}

// Floor 1: a spiral stair seen from above, kelp swaying at the edges.
function drawKelpStair(ctx, pal, decor, t) {
  ctx.save();
  ctx.translate(ARENA.cx, ARENA.cy);
  for (let i = 0; i < 9; i++) {
    const r = 80 + i * 62;
    ctx.beginPath();
    ctx.strokeStyle = i % 2 === 0 ? pal.tile : "rgba(46,230,200,0.10)";
    ctx.lineWidth = i % 2 === 0 ? 14 : 2;
    ctx.arc(0, 0, r, t * 0.05 + i * 0.4, t * 0.05 + i * 0.4 + Math.PI * 1.25);
    ctx.stroke();
  }
  ctx.restore();

  for (const k of decor.kelp) {
    const sway = Math.sin(t * 0.8 + k.phase) * 0.35;
    ctx.beginPath();
    ctx.moveTo(k.x, WORLD.h);
    ctx.bezierCurveTo(
      k.x + k.lean * k.h * 0.3, WORLD.h - k.h * 0.4,
      k.x + (k.lean + sway) * k.h * 0.6, WORLD.h - k.h * 0.75,
      k.x + (k.lean + sway * 1.6) * k.h * 0.9, WORLD.h - k.h,
    );
    ctx.strokeStyle = "rgba(159,245,217,0.16)";
    ctx.lineWidth = k.w;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  ctx.lineCap = "butt";
}

// Floor 2: gothic arches and amber light shafts falling through the chapel roof.
function drawRustChapel(ctx, pal, decor, t) {
  for (const a of decor.arches) {
    ctx.beginPath();
    ctx.moveTo(a.x - a.w / 2, 0);
    ctx.lineTo(a.x - a.w / 2, a.h * 0.62);
    ctx.quadraticCurveTo(a.x - a.w / 2, a.h, a.x, a.h);
    ctx.quadraticCurveTo(a.x + a.w / 2, a.h, a.x + a.w / 2, a.h * 0.62);
    ctx.lineTo(a.x + a.w / 2, 0);
    ctx.strokeStyle = "rgba(194,65,12,0.30)";
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,179,71,0.13)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Light shafts: wide warm wedges that drift a little.
  for (let i = 0; i < 4; i++) {
    const x = 160 + i * 320 + Math.sin(t * 0.25 + i) * 14;
    const g = ctx.createLinearGradient(x, 0, x + 120, WORLD.h);
    g.addColorStop(0, "rgba(255,179,71,0.14)");
    g.addColorStop(0.55, "rgba(255,179,71,0.05)");
    g.addColorStop(1, "rgba(255,179,71,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - 26, 0);
    ctx.lineTo(x + 26, 0);
    ctx.lineTo(x + 150, WORLD.h);
    ctx.lineTo(x + 40, WORLD.h);
    ctx.closePath();
    ctx.fill();
  }

  for (const b of decor.bricks) {
    ctx.fillStyle = b.shade > 0.72 ? "rgba(194,65,12,0.14)" : "rgba(58,29,14,0.35)";
    ctx.fillRect(b.x, b.y, b.w, 22);
  }
}

// Floor 3: nothing but rings, shards and a violet vein system.
function drawBlindDeep(ctx, pal, decor, t) {
  ctx.save();
  ctx.translate(ARENA.cx, ARENA.cy);
  for (let i = 0; i < 7; i++) {
    const r = 120 + i * 88 + Math.sin(t * 0.5 + i) * 8;
    ctx.beginPath();
    ctx.strokeStyle = i % 2 === 0 ? "rgba(255,62,165,0.13)" : "rgba(201,167,255,0.09)";
    ctx.lineWidth = i % 2 === 0 ? 3 : 1.5;
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Veins: jagged lines radiating from the centre.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.sin(t * 0.2 + i) * 0.08;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let s = 1; s <= 5; s++) {
      const rr = s * 130;
      const aa = a + Math.sin(s * 2.3 + i) * 0.12;
      ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
    }
    ctx.strokeStyle = "rgba(201,167,255,0.08)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  for (const s of decor.shards) {
    const y = s.y + Math.sin(t * 0.7 + s.phase) * s.drift;
    ctx.save();
    ctx.translate(s.x, y);
    ctx.rotate(s.rot + t * s.spin);
    ctx.beginPath();
    ctx.moveTo(0, -s.s);
    ctx.lineTo(s.s * 0.55, 0);
    ctx.lineTo(0, s.s);
    ctx.lineTo(-s.s * 0.55, 0);
    ctx.closePath();
    ctx.fillStyle = "rgba(201,167,255,0.10)";
    ctx.fill();
    ctx.strokeStyle = "rgba(242,236,255,0.22)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}

// A tiled floor over everything, faint: it gives the arena a scale.
function drawFloorTiles(ctx, pal, t) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = pal.tile;
  ctx.lineWidth = 1;
  const step = 74;
  ctx.beginPath();
  for (let x = ARENA.x; x <= ARENA.x + ARENA.w; x += step) {
    ctx.moveTo(x, ARENA.y);
    ctx.lineTo(x, ARENA.y + ARENA.h);
  }
  for (let y = ARENA.y; y <= ARENA.y + ARENA.h; y += step) {
    ctx.moveTo(ARENA.x, y);
    ctx.lineTo(ARENA.x + ARENA.w, y);
  }
  ctx.stroke();

  // Diamonds at the intersections, pulsing gently with the room's own clock.
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = pal.accent;
  for (let x = ARENA.x; x <= ARENA.x + ARENA.w; x += step * 2) {
    for (let y = ARENA.y; y <= ARENA.y + ARENA.h; y += step * 2) {
      const s = 2 + Math.sin(t * 1.2 + x * 0.01 + y * 0.01) * 0.8;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
  }
  ctx.restore();
}

function drawMotes(ctx, pal, decor, t) {
  ctx.save();
  for (const m of decor.motes) {
    const y = (m.y - t * m.speed) % (WORLD.h + 30);
    const yy = y < -15 ? y + WORLD.h + 30 : y;
    ctx.globalAlpha = m.a * (0.6 + Math.sin(t * 2 + m.phase) * 0.4);
    ctx.fillStyle = pal.pale;
    ctx.beginPath();
    ctx.arc(m.x + Math.sin(t * 0.6 + m.phase) * 6, yy, m.r, 0, 6.28);
    ctx.fill();
  }
  ctx.restore();
}

// The arena frame: a bright inset border with corner ticks, legible at a third of the size.
export function drawFrame(ctx, pal, run) {
  ctx.save();
  ctx.strokeStyle = pal.accent;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 3;
  ctx.strokeRect(ARENA.x - 3, ARENA.y - 3, ARENA.w + 6, ARENA.h + 6);
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = 12;
  ctx.strokeRect(ARENA.x - 9, ARENA.y - 9, ARENA.w + 18, ARENA.h + 18);

  ctx.globalAlpha = 0.95;
  ctx.lineWidth = 5;
  ctx.strokeStyle = pal.pale;
  const L = 34;
  const corners = [
    [ARENA.x - 3, ARENA.y - 3, 1, 1],
    [ARENA.x + ARENA.w + 3, ARENA.y - 3, -1, 1],
    [ARENA.x - 3, ARENA.y + ARENA.h + 3, 1, -1],
    [ARENA.x + ARENA.w + 3, ARENA.y + ARENA.h + 3, -1, -1],
  ];
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * L);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * L, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawVignette(ctx, strength = 0.75) {
  const g = ctx.createRadialGradient(WORLD.w / 2, WORLD.h / 2, WORLD.h * 0.28, WORLD.w / 2, WORLD.h / 2, WORLD.h * 0.86);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.w, WORLD.h);
}
