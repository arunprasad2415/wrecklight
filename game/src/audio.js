// WebAudio synthesis. Every sound in WRECKLIGHT is generated here at runtime: no audio files.
// One exported function per sound, plus a beam hum that follows the trigger and a per-floor drone.

let ctx = null;
let master = null;
let noiseBuffer = null;
let hum = null;
let drone = null;

function ensure() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  master = ctx.createGain();
  master.gain.value = 0.26;
  master.connect(ctx.destination);

  // One second of white noise, reused by every percussive sound.
  const len = Math.floor(ctx.sampleRate);
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return ctx;
}

function tone({ freq = 440, to = null, dur = 0.12, type = "square", gain = 0.4, attack = 0.008, delay = 0 }) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freq), t0);
  if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(env);
  env.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

function noise({ dur = 0.2, gain = 0.3, type = "lowpass", freq = 1200, to = null, delay = 0 }) {
  const c = ensure();
  if (!c || !noiseBuffer) return;
  const t0 = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, t0);
  if (to !== null) filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(env);
  env.connect(master);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export const Sfx = {
  // Called from the first key press or click: browsers only allow audio after a gesture.
  unlock() {
    const c = ensure();
    if (c && c.state === "suspended") c.resume();
  },

  bolt() {
    tone({ freq: 1180, to: 640, dur: 0.06, type: "square", gain: 0.1 });
  },
  beamHit() {
    tone({ freq: 320, to: 210, dur: 0.05, type: "sawtooth", gain: 0.07 });
  },
  kill() {
    tone({ freq: 420, to: 96, dur: 0.19, type: "sawtooth", gain: 0.24 });
    noise({ dur: 0.16, gain: 0.16, freq: 1800, to: 300 });
  },
  bigKill() {
    tone({ freq: 240, to: 60, dur: 0.34, type: "square", gain: 0.3 });
    noise({ dur: 0.34, gain: 0.22, freq: 1400, to: 160 });
  },
  hurt() {
    tone({ freq: 210, to: 55, dur: 0.3, type: "square", gain: 0.42 });
    noise({ dur: 0.18, gain: 0.2, freq: 700, to: 120 });
  },
  dash() {
    noise({ dur: 0.22, gain: 0.2, type: "bandpass", freq: 300, to: 2600 });
    tone({ freq: 240, to: 620, dur: 0.16, type: "sine", gain: 0.12 });
  },
  flare() {
    tone({ freq: 130, to: 42, dur: 0.55, type: "sine", gain: 0.5 });
    noise({ dur: 0.45, gain: 0.3, freq: 2400, to: 200 });
  },
  overheat() {
    noise({ dur: 0.5, gain: 0.22, freq: 3000, to: 400 });
    tone({ freq: 300, to: 120, dur: 0.35, type: "sawtooth", gain: 0.2 });
  },
  roomClear() {
    [392, 523, 659].forEach((f, i) => tone({ freq: f, dur: 0.2, type: "triangle", gain: 0.3, delay: i * 0.09 }));
  },
  bossRoar() {
    tone({ freq: 96, to: 46, dur: 1.1, type: "sawtooth", gain: 0.4 });
    tone({ freq: 143, to: 61, dur: 1.0, type: "square", gain: 0.16, delay: 0.05 });
    noise({ dur: 0.9, gain: 0.18, freq: 900, to: 120 });
  },
  bossHit() {
    tone({ freq: 160, to: 88, dur: 0.1, type: "square", gain: 0.14 });
  },
  uiMove() {
    tone({ freq: 640, dur: 0.05, type: "square", gain: 0.14 });
  },
  uiPick() {
    tone({ freq: 700, to: 1040, dur: 0.14, type: "triangle", gain: 0.32 });
    tone({ freq: 1050, to: 1560, dur: 0.12, type: "triangle", gain: 0.16, delay: 0.06 });
  },
  relic() {
    [523, 659, 784, 1046, 1318].forEach((f, i) =>
      tone({ freq: f, dur: 0.26, type: "triangle", gain: 0.28, delay: i * 0.08 }),
    );
  },
  win() {
    [523, 659, 784, 1046, 1318, 1568].forEach((f, i) =>
      tone({ freq: f, dur: 0.42, type: "triangle", gain: 0.34, delay: i * 0.15 }),
    );
  },
  lose() {
    [330, 262, 208, 147].forEach((f, i) =>
      tone({ freq: f, dur: 0.5, type: "sawtooth", gain: 0.32, delay: i * 0.19 }),
    );
  },

  // The lantern beam: a filtered saw that swells while the trigger is held.
  startBeam() {
    const c = ensure();
    if (!c || hum) return;
    const osc = c.createOscillator();
    const sub = c.createOscillator();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    osc.type = "sawtooth";
    sub.type = "square";
    osc.frequency.value = 168;
    sub.frequency.value = 84;
    filter.type = "lowpass";
    filter.frequency.value = 1500;
    filter.Q.value = 7;
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.11, c.currentTime + 0.09);
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    sub.start();
    hum = { osc, sub, gain, filter };
  },
  setBeamHeat(amount) {
    if (!hum || !ctx) return;
    hum.filter.frequency.setTargetAtTime(900 + amount * 2200, ctx.currentTime, 0.08);
    hum.osc.frequency.setTargetAtTime(150 + amount * 90, ctx.currentTime, 0.1);
  },
  stopBeam() {
    if (!hum || !ctx) return;
    const h = hum;
    hum = null;
    h.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
    setTimeout(() => {
      try {
        h.osc.stop();
        h.sub.stop();
      } catch (err) {
        /* already stopped */
      }
    }, 260);
  },

  // A slow drone per floor: two detuned oscillators under filtered noise.
  startDrone(floorIndex) {
    const c = ensure();
    if (!c) return;
    this.stopDrone();
    const roots = [58, 46, 39];
    const root = roots[floorIndex % roots.length];
    const osc = c.createOscillator();
    const fifth = c.createOscillator();
    const gain = c.createGain();
    const filter = c.createBiquadFilter();
    osc.type = "sine";
    fifth.type = "triangle";
    osc.frequency.value = root;
    fifth.frequency.value = root * 1.49;
    filter.type = "lowpass";
    filter.frequency.value = 420;
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.09, c.currentTime + 1.6);
    osc.connect(filter);
    fifth.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    fifth.start();
    drone = { osc, fifth, gain };
  },
  stopDrone() {
    if (!drone || !ctx) return;
    const d = drone;
    drone = null;
    d.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
    setTimeout(() => {
      try {
        d.osc.stop();
        d.fifth.stop();
      } catch (err) {
        /* already stopped */
      }
    }, 1200);
  },
};
