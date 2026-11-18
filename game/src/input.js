// Keyboard and mouse state: WASD or arrows to move, the mouse to aim, the left button to hold
// the beam, the right button or E for a flare, space to dash, P or Escape to pause.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouse = { x: canvas.width * 0.62, y: canvas.height * 0.45, down: false, right: false };
    this.clicked = false;
    this.onFirstGesture = null;
    this.anyGesture = false;

    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      this.gesture();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => {
      this.keys.clear();
      this.mouse.down = false;
      this.mouse.right = false;
    });

    canvas.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (e.button === 0) {
        this.mouse.down = true;
        this.clicked = true;
      }
      if (e.button === 2) this.mouse.right = true;
      this.gesture();
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  gesture() {
    if (!this.anyGesture) {
      this.anyGesture = true;
      if (this.onFirstGesture) this.onFirstGesture();
    }
  }

  axis() {
    const k = this.keys;
    const x = (k.has("d") || k.has("arrowright") ? 1 : 0) - (k.has("a") || k.has("arrowleft") ? 1 : 0);
    const y = (k.has("s") || k.has("arrowdown") ? 1 : 0) - (k.has("w") || k.has("arrowup") ? 1 : 0);
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  firing() {
    return this.mouse.down;
  }

  flarePressed() {
    return this.mouse.right || this.hit("e");
  }

  dashPressed() {
    return this.hit(" ");
  }

  hit(...names) {
    for (const n of names) if (this.pressed.has(n)) return true;
    return false;
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.right = false;
    this.clicked = false;
  }
}
