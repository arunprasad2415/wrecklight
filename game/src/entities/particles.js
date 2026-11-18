// Particles and floating damage numbers. Everything is a plain record in a flat list so the
// update and the draw pass stay cheap.
import { rand } from "../random.js";

export function makeParticle(x, y, vx, vy, life, size, color, kind = "dot") {
  return { x, y, vx, vy, life, maxLife: life, size, color, kind };
}

// A round burst, used for hits, deaths and pickups.
export function burst(run, x, y, color, count = 12, power = 220) {
  const rng = run.rng;
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const s = rand(rng, power * 0.18, power);
    const life = rand(rng, 0.22, 0.66);
    run.particles.push(makeParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, life, rand(rng, 1.6, 4.4), color));
  }
}

// A cone of sparks along a direction, for beam impacts and blocked hits.
export function spray(run, x, y, angle, spread, color, count = 8, power = 320) {
  const rng = run.rng;
  for (let i = 0; i < count; i++) {
    const a = angle + rand(rng, -spread, spread);
    const s = rand(rng, power * 0.3, power);
    const life = rand(rng, 0.14, 0.4);
    run.particles.push(makeParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, life, rand(rng, 1.4, 3.2), color));
  }
}

// Embers that drift up and fade: the death signature of the floor's creatures.
export function embers(run, x, y, color, count = 10) {
  const rng = run.rng;
  for (let i = 0; i < count; i++) {
    const a = rand(rng, 0, Math.PI * 2);
    const s = rand(rng, 10, 60);
    const life = rand(rng, 0.5, 1.3);
    run.particles.push(makeParticle(x, y, Math.cos(a) * s, Math.sin(a) * s - 40, life, rand(rng, 1.2, 3), color));
  }
}

export function damageNumber(run, x, y, amount, color = "#ffffff", crit = false) {
  run.numbers.push({
    x,
    y,
    vx: rand(run.rng, -22, 22),
    vy: -70,
    life: crit ? 0.95 : 0.7,
    maxLife: crit ? 0.95 : 0.7,
    text: String(Math.max(1, Math.round(amount))),
    color,
    crit,
  });
}

export function textPop(run, x, y, text, color = "#ffffff") {
  run.numbers.push({ x, y, vx: 0, vy: -46, life: 1.1, maxLife: 1.1, text, color, crit: false, wide: true });
}

export function updateParticles(run, dt) {
  const parts = run.particles;
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 1 - 2.6 * dt;
    p.vy *= 1 - 2.6 * dt;
    p.vy += 26 * dt;
    p.life -= dt;
    if (p.life <= 0) parts.splice(i, 1);
  }

  const nums = run.numbers;
  for (let i = nums.length - 1; i >= 0; i--) {
    const n = nums[i];
    n.x += n.vx * dt;
    n.y += n.vy * dt;
    n.vy += 90 * dt;
    n.life -= dt;
    if (n.life <= 0) nums.splice(i, 1);
  }
}
