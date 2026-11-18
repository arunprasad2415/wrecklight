// Every actor shape in the game, plus the drawn icons used by upgrades and relics.
// All of it is canvas geometry: no images, no font-dependent symbols.

function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
  ctx.closePath();
}

export function drawPlayer(ctx, p, pal, t) {
  const blink = p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0;

  // Dash afterimages.
  for (let i = 0; i < p.trail.length; i++) {
    const tr = p.trail[i];
    ctx.globalAlpha = (tr.life / 0.3) * 0.35;
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.arc(tr.x, tr.y, p.r * 0.9, 0, 6.28);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalAlpha = blink ? 0.45 : 1;

  // Ground shadow.
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(0, 6, p.r * 1.05, p.r * 0.55, 0, 0, 6.28);
  ctx.fill();

  // Cloak: a wide teardrop that points where the lamplighter faces.
  ctx.save();
  ctx.rotate(p.angle + Math.PI / 2);
  const cloak = ctx.createLinearGradient(0, -p.r, 0, p.r * 1.8);
  cloak.addColorStop(0, pal.pale);
  cloak.addColorStop(1, pal.tile);
  ctx.fillStyle = p.hurtFlash > 0 ? "#ffffff" : cloak;
  poly(ctx, [
    [0, -p.r * 1.15],
    [p.r * 0.95, p.r * 0.5],
    [p.r * 0.5, p.r * 1.5],
    [-p.r * 0.5, p.r * 1.5],
    [-p.r * 0.95, p.r * 0.5],
  ]);
  ctx.fill();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Hood.
  ctx.beginPath();
  ctx.arc(0, -p.r * 0.1, p.r * 0.58, 0, 6.28);
  ctx.fillStyle = pal.deep;
  ctx.fill();
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // The lantern itself: the brightest thing on screen, always.
  const lx = Math.cos(p.angle) * (p.r + 7);
  const ly = Math.sin(p.angle) * (p.r + 7);
  const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, 34);
  glow.addColorStop(0, "rgba(255,255,255,0.95)");
  glow.addColorStop(0.3, pal.pale);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = blink ? 0.5 : 0.9;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(lx, ly, 34, 0, 6.28);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#fffdf2";
  ctx.beginPath();
  ctx.arc(lx, ly, 4.5, 0, 6.28);
  ctx.fill();

  // While the lantern burns, a bright halo ring marks the lamplighter against its own light.
  if (p.beamOn && !p.overheated) {
    ctx.globalCompositeOperation = "lighter";
    const ringPulse = 1 + Math.sin(t * 9) * 0.06;
    ctx.strokeStyle = pal.ink;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, (p.r + 12) * ringPulse, 0, 6.28);
    ctx.stroke();
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

function tellAura(ctx, e, pal) {
  if (e.state !== "tell") return;
  const p = Math.min(1, e.pulse);
  ctx.save();
  ctx.globalAlpha = 0.25 + p * 0.55;
  ctx.strokeStyle = pal.danger;
  ctx.lineWidth = 2 + p * 3;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r + 8 + p * 14, 0, 6.28);
  ctx.stroke();
  // A closing ring: the attack lands when it reaches the body.
  ctx.globalAlpha = 0.5 + p * 0.4;
  ctx.beginPath();
  ctx.arc(e.x, e.y, e.r + 30 * (1 - p), 0, 6.28);
  ctx.stroke();
  ctx.restore();
}

export function drawEnemy(ctx, e, pal, t) {
  tellAura(ctx, e, pal);
  ctx.save();
  ctx.translate(e.x, e.y);
  const swell = e.state === "tell" ? 1 + Math.min(1, e.pulse) * 0.16 : 1;
  ctx.scale(swell, swell);
  const body = e.hitFlash > 0.4 ? "#ffffff" : pal.accent;
  const edge = pal.ink;
  ctx.lineWidth = 2;

  switch (e.kind) {
    case "drifter": {
      // A jellyfish dome with drifting tentacles.
      ctx.beginPath();
      ctx.arc(0, 0, e.r, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.stroke();
      ctx.strokeStyle = pal.pale;
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(i * e.r * 0.38, 0);
        ctx.quadraticCurveTo(
          i * e.r * 0.38 + Math.sin(t * 3 + i) * 5,
          e.r * 0.9,
          i * e.r * 0.38 + Math.sin(t * 3 + i + 1) * 8,
          e.r * 1.5,
        );
        ctx.stroke();
      }
      ctx.fillStyle = pal.deep;
      ctx.beginPath();
      ctx.arc(0, -e.r * 0.22, e.r * 0.28, 0, 6.28);
      ctx.fill();
      break;
    }
    case "sporeling": {
      // Spiked ball on a stem, one bright eye.
      ctx.fillStyle = body;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const rr = i % 2 === 0 ? e.r : e.r * 0.62;
        const x = Math.cos(a) * rr;
        const y = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.stroke();
      ctx.strokeStyle = pal.pale;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, e.r * 0.9);
      ctx.lineTo(0, e.r * 1.6);
      ctx.stroke();
      ctx.fillStyle = pal.deep;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.34, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = pal.ink;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.16, 0, 6.28);
      ctx.fill();
      break;
    }
    case "anemone": {
      // Eight tentacle arms around a mouth.
      ctx.strokeStyle = body;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      for (let i = 0; i < 8; i++) {
        const a = e.angle + (i / 8) * Math.PI * 2;
        const len = e.r * (1.35 + Math.sin(t * 2.4 + i) * 0.16);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * e.r * 0.4, Math.sin(a) * e.r * 0.4);
        ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.lineCap = "butt";
      ctx.fillStyle = pal.pale;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.62, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = pal.deep;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.3, 0, 6.28);
      ctx.fill();
      break;
    }
    case "bellhusk": {
      // A cracked bell, wider at the hem.
      poly(ctx, [
        [-e.r * 0.62, -e.r * 0.95],
        [e.r * 0.62, -e.r * 0.95],
        [e.r * 0.95, e.r * 0.75],
        [-e.r * 0.95, e.r * 0.75],
      ]);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.stroke();
      ctx.fillStyle = pal.deep;
      ctx.fillRect(-e.r * 0.16, -e.r * 1.15, e.r * 0.32, e.r * 0.3);
      ctx.fillStyle = pal.warm;
      ctx.beginPath();
      ctx.arc(0, e.r * 0.72, e.r * 0.22, 0, 6.28);
      ctx.fill();
      ctx.strokeStyle = pal.deep;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-e.r * 0.2, -e.r * 0.6);
      ctx.lineTo(e.r * 0.05, 0);
      ctx.lineTo(-e.r * 0.14, e.r * 0.5);
      ctx.stroke();
      break;
    }
    case "cinderling": {
      // A dart with a flame tail.
      const a = Math.atan2(e.vy, e.vx);
      ctx.rotate(a);
      const grad = ctx.createLinearGradient(-e.r * 2.4, 0, 0, 0);
      grad.addColorStop(0, "rgba(255,120,60,0)");
      grad.addColorStop(1, pal.warm);
      ctx.fillStyle = grad;
      poly(ctx, [[-e.r * 2.6, 0], [-e.r * 0.2, -e.r * 0.6], [-e.r * 0.2, e.r * 0.6]]);
      ctx.fill();
      poly(ctx, [[e.r * 1.5, 0], [-e.r * 0.5, -e.r * 0.85], [-e.r * 0.5, e.r * 0.85]]);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case "chainwarden": {
      ctx.rotate(e.angle);
      poly(ctx, [
        [e.r, 0],
        [e.r * 0.4, e.r * 0.9],
        [-e.r * 0.7, e.r * 0.7],
        [-e.r * 0.7, -e.r * 0.7],
        [e.r * 0.4, -e.r * 0.9],
      ]);
      ctx.fillStyle = body;
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.stroke();
      // The shield arc: thick, bright, and clearly in front.
      ctx.strokeStyle = pal.pale;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 1.18, -1.05, 1.05);
      ctx.stroke();
      ctx.strokeStyle = pal.deep;
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        const a = i * 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * e.r * 0.85, Math.sin(a) * e.r * 0.85);
        ctx.lineTo(Math.cos(a) * e.r * 1.3, Math.sin(a) * e.r * 1.3);
        ctx.stroke();
      }
      break;
    }
    case "echo": {
      // A hollow ring, doubled, so it reads as a reflection.
      ctx.strokeStyle = body;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.95, 0, 6.28);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 1.3, 0.4, 5.2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = pal.pale;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.3, 0, 6.28);
      ctx.fill();
      break;
    }
    case "maw": {
      // A round mouth full of teeth.
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, 6.28);
      ctx.fill();
      ctx.strokeStyle = edge;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = pal.deep;
      ctx.beginPath();
      ctx.arc(0, 0, e.r * 0.66, 0, 6.28);
      ctx.fill();
      ctx.fillStyle = pal.ink;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * 0.6;
        poly(ctx, [
          [Math.cos(a) * e.r * 0.62, Math.sin(a) * e.r * 0.62],
          [Math.cos(a + 0.22) * e.r * 0.3, Math.sin(a + 0.22) * e.r * 0.3],
          [Math.cos(a - 0.22) * e.r * 0.3, Math.sin(a - 0.22) * e.r * 0.3],
        ]);
        ctx.fill();
      }
      break;
    }
    case "warden": {
      // A chained block of a body.
      ctx.rotate(Math.sin(t * 0.8) * 0.08);
      ctx.fillStyle = body;
      ctx.fillRect(-e.r * 0.8, -e.r * 0.8, e.r * 1.6, e.r * 1.6);
      ctx.strokeStyle = edge;
      ctx.lineWidth = 3;
      ctx.strokeRect(-e.r * 0.8, -e.r * 0.8, e.r * 1.6, e.r * 1.6);
      ctx.strokeStyle = pal.pale;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, e.r * (0.3 + i * 0.22), 0.6, 2.6);
        ctx.stroke();
      }
      ctx.fillStyle = pal.danger;
      ctx.fillRect(-e.r * 0.22, -e.r * 0.22, e.r * 0.44, e.r * 0.44);
      break;
    }
    default:
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(0, 0, e.r, 0, 6.28);
      ctx.fill();
      break;
  }
  ctx.restore();

  // Health pip above damaged enemies.
  if (e.hp < e.maxHp) {
    const w = e.r * 2;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(e.x - w / 2, e.y - e.r - 13, w, 4);
    ctx.fillStyle = pal.ink;
    ctx.fillRect(e.x - w / 2, e.y - e.r - 13, w * Math.max(0, e.hp / e.maxHp), 4);
  }
}

export function drawBoss(ctx, boss, pal, t) {
  if (!boss || !boss.alive) return;
  ctx.save();
  const flash = boss.hitFlash > 0.5;

  if (boss.kind === "kelpchoir") {
    // Three singing nodes, each an organ pipe; only the active one is lit and vulnerable.
    for (const n of boss.nodes) {
      if (!n.alive) {
        ctx.save();
        ctx.translate(n.x, n.y);
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = pal.tile;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, n.r * 0.8, 0, 6.28);
        ctx.stroke();
        ctx.restore();
        continue;
      }
      const glow = n.active ? 1 : 0.35;
      ctx.save();
      ctx.translate(n.x, n.y);
      ctx.globalAlpha = glow;
      const pulse = 1 + Math.sin(t * (n.active ? 5 : 2) + n.id) * 0.05;
      ctx.scale(pulse, pulse);
      // Pipe.
      ctx.fillStyle = n.flash > 0.4 ? "#ffffff" : pal.tile;
      poly(ctx, [
        [-n.r * 0.55, n.r * 1.1],
        [n.r * 0.55, n.r * 1.1],
        [n.r * 0.42, -n.r * 1.5],
        [-n.r * 0.42, -n.r * 1.5],
      ]);
      ctx.fill();
      ctx.strokeStyle = n.active ? pal.accent : pal.tile;
      ctx.lineWidth = n.active ? 4 : 2;
      ctx.stroke();
      // Mouth of the pipe.
      ctx.fillStyle = n.active ? pal.pale : pal.tile;
      ctx.beginPath();
      ctx.ellipse(0, -n.r * 1.35, n.r * 0.42, n.r * 0.2, 0, 0, 6.28);
      ctx.fill();
      // Sound rings from the active node.
      if (n.active) {
        ctx.strokeStyle = pal.accent;
        for (let i = 0; i < 3; i++) {
          const rr = ((t * 60 + i * 40) % 120) + n.r;
          ctx.globalAlpha = 0.5 * (1 - ((rr - n.r) / 120));
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, rr, 0, 6.28);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    // The choir core: a knot of light in the middle of the three pipes.
    ctx.save();
    ctx.translate(boss.x, boss.y);
    ctx.globalAlpha = 0.8;
    const core = ctx.createRadialGradient(0, 0, 4, 0, 0, 90);
    core.addColorStop(0, pal.pale);
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 0, 90, 0, 6.28);
    ctx.fill();
    ctx.restore();
  } else if (boss.kind === "bellwarden") {
    ctx.save();
    ctx.translate(boss.x, boss.y);
    const wob = boss.state === "tell" ? Math.sin(t * 40) * 3 : Math.sin(t * 2) * 1.2;
    ctx.rotate(wob * 0.01);
    // The great bell.
    ctx.beginPath();
    ctx.moveTo(-boss.r * 0.62, -boss.r * 1.05);
    ctx.quadraticCurveTo(-boss.r * 1.05, -boss.r * 0.2, -boss.r * 1.12, boss.r * 0.72);
    ctx.quadraticCurveTo(0, boss.r * 1.02, boss.r * 1.12, boss.r * 0.72);
    ctx.quadraticCurveTo(boss.r * 1.05, -boss.r * 0.2, boss.r * 0.62, -boss.r * 1.05);
    ctx.closePath();
    ctx.fillStyle = flash ? "#ffffff" : pal.tile;
    ctx.fill();
    ctx.strokeStyle = boss.state === "tell" ? pal.pale : pal.warm;
    ctx.lineWidth = 5;
    ctx.stroke();
    // Crown and clapper.
    ctx.fillStyle = pal.warm;
    ctx.fillRect(-boss.r * 0.2, -boss.r * 1.28, boss.r * 0.4, boss.r * 0.28);
    ctx.beginPath();
    ctx.arc(0, boss.r * 0.78, boss.r * 0.2, 0, 6.28);
    ctx.fill();
    // Eye slit.
    ctx.fillStyle = pal.danger;
    ctx.fillRect(-boss.r * 0.45, -boss.r * 0.3, boss.r * 0.9, boss.r * 0.16);
    ctx.restore();
  } else {
    // The Blind Lamp: a huge hooded lantern with one closed eye.
    ctx.save();
    ctx.translate(boss.x, boss.y);
    const aura = ctx.createRadialGradient(0, 0, 10, 0, 0, boss.r * 3);
    aura.addColorStop(0, "rgba(255,62,165,0.30)");
    aura.addColorStop(1, "rgba(255,62,165,0)");
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, boss.r * 3, 0, 6.28);
    ctx.fill();
    poly(ctx, [
      [0, -boss.r * 1.3],
      [boss.r * 0.95, -boss.r * 0.35],
      [boss.r * 0.8, boss.r * 1.1],
      [-boss.r * 0.8, boss.r * 1.1],
      [-boss.r * 0.95, -boss.r * 0.35],
    ]);
    ctx.fillStyle = flash ? "#ffffff" : pal.tile;
    ctx.fill();
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 4;
    ctx.stroke();
    // The lamp's eye.
    ctx.fillStyle = pal.pale;
    ctx.beginPath();
    ctx.ellipse(0, -boss.r * 0.1, boss.r * 0.5, boss.r * 0.3, 0, 0, 6.28);
    ctx.fill();
    ctx.fillStyle = pal.deep;
    ctx.beginPath();
    ctx.ellipse(0, -boss.r * 0.1, boss.r * 0.14, boss.r * 0.26, 0, 0, 6.28);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function drawPickup(ctx, p, pal, t) {
  const pulse = 1 + Math.sin(t * 6 + p.phase) * 0.18;
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = pal.pale;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r * 2.6 * pulse, 0, 6.28);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = pal.ink;
  poly(ctx, [[p.x, p.y - p.r], [p.x + p.r, p.y], [p.x, p.y + p.r], [p.x - p.r, p.y]]);
  ctx.fill();
  ctx.restore();
}

// Icons for upgrades and relics: each one is a small vector drawing, not a font glyph.
export function drawGlyph(ctx, shape, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.14);
  ctx.lineCap = "round";
  const s = size;
  switch (shape) {
    case "flame":
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.9, -s * 0.1, s * 0.3, s * 0.8);
      ctx.quadraticCurveTo(0, s * 1.05, -s * 0.3, s * 0.8);
      ctx.quadraticCurveTo(-s * 0.9, -s * 0.1, 0, -s);
      ctx.fill();
      break;
    case "bolt":
      poly(ctx, [[s * 0.2, -s], [-s * 0.6, s * 0.1], [-s * 0.05, s * 0.1], [-s * 0.25, s], [s * 0.6, -s * 0.15], [s * 0.05, -s * 0.15]]);
      ctx.fill();
      break;
    case "cone":
      poly(ctx, [[-s * 0.9, -s * 0.5], [s * 0.9, -s * 0.9], [s * 0.9, s * 0.9], [-s * 0.9, s * 0.5]]);
      ctx.fill();
      break;
    case "tank":
      ctx.strokeRect(-s * 0.7, -s * 0.9, s * 1.4, s * 1.8);
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, s * 0.2);
      ctx.lineTo(s * 0.7, s * 0.2);
      ctx.stroke();
      break;
    case "wing":
      ctx.beginPath();
      ctx.moveTo(-s * 0.9, s * 0.6);
      ctx.quadraticCurveTo(-s * 0.2, -s, s * 0.9, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.1, -s * 0.1, -s * 0.2, s * 0.6);
      ctx.closePath();
      ctx.fill();
      break;
    case "spike":
      poly(ctx, [[0, -s], [s * 0.45, s * 0.2], [0, s], [-s * 0.45, s * 0.2]]);
      ctx.fill();
      break;
    case "burst":
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * 0.35, Math.sin(a) * s * 0.35);
        ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
        ctx.stroke();
      }
      break;
    case "cell":
      ctx.strokeRect(-s * 0.55, -s * 0.9, s * 1.1, s * 1.8);
      ctx.fillRect(-s * 0.3, -s * 0.5, s * 0.6, s * 0.45);
      ctx.fillRect(-s * 0.3, s * 0.15, s * 0.6, s * 0.45);
      break;
    case "heart":
      ctx.beginPath();
      ctx.moveTo(0, s * 0.9);
      ctx.bezierCurveTo(-s * 1.1, s * 0.1, -s * 0.7, -s * 0.9, 0, -s * 0.3);
      ctx.bezierCurveTo(s * 0.7, -s * 0.9, s * 1.1, s * 0.1, 0, s * 0.9);
      ctx.fill();
      break;
    case "drop":
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.quadraticCurveTo(s * 0.8, s * 0.2, 0, s * 0.9);
      ctx.quadraticCurveTo(-s * 0.8, s * 0.2, 0, -s);
      ctx.fill();
      break;
    case "arrow":
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.lineTo(s * 0.4, 0);
      ctx.moveTo(s * 0.1, -s * 0.5);
      ctx.lineTo(s * 0.9, 0);
      ctx.lineTo(s * 0.1, s * 0.5);
      ctx.stroke();
      break;
    case "eye":
      ctx.beginPath();
      ctx.ellipse(0, 0, s, s * 0.58, 0, 0, 6.28);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.3, 0, 6.28);
      ctx.fill();
      break;
    case "chevron":
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, s * 0.3);
      ctx.lineTo(0, -s * 0.5);
      ctx.lineTo(s * 0.7, s * 0.3);
      ctx.moveTo(-s * 0.7, s * 0.9);
      ctx.lineTo(0, s * 0.1);
      ctx.lineTo(s * 0.7, s * 0.9);
      ctx.stroke();
      break;
    case "magnet":
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.7, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.7, 0);
      ctx.lineTo(-s * 0.7, s * 0.7);
      ctx.moveTo(s * 0.7, 0);
      ctx.lineTo(s * 0.7, s * 0.7);
      ctx.stroke();
      break;
    case "spiral":
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 3.4;
        const rr = (i / 40) * s;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      break;
    case "spikes":
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * s * 0.2, Math.sin(a) * s * 0.2);
        ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.28, 0, 6.28);
      ctx.fill();
      break;
    case "siphon":
      ctx.beginPath();
      ctx.moveTo(0, s);
      ctx.lineTo(0, -s);
      ctx.moveTo(-s * 0.5, -s * 0.4);
      ctx.lineTo(0, -s);
      ctx.lineTo(s * 0.5, -s * 0.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, s * 0.55, s * 0.3, 0, 6.28);
      ctx.fill();
      break;
    case "snow":
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(-Math.cos(a) * s, -Math.sin(a) * s);
        ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s);
        ctx.stroke();
      }
      break;
    case "lens":
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.75, 0, 6.28);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.3, 0, 6.28);
      ctx.fill();
      break;
    case "cord":
      ctx.beginPath();
      ctx.moveTo(-s, -s * 0.6);
      ctx.quadraticCurveTo(0, s * 0.2, s, -s * 0.6);
      ctx.quadraticCurveTo(0, s, -s, s * 0.6);
      ctx.stroke();
      break;
    default:
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.7, 0, 6.28);
      ctx.fill();
      break;
  }
  ctx.restore();
}
