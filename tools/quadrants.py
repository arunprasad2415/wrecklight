"""Boot every ?shot= URL and report page errors, the canvas size, and the lit share of each
quadrant, so a dark or one-sided frame is caught before any screenshot is taken."""
import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8731/index.html"
SHOTS = ["play", "title", "draft", "results"]

QUADRANTS = """() => {
  const c = document.getElementById('stage');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const w = c.width, h = c.height;
  const q = [0,0,0,0];
  const qt = [0,0,0,0];
  let lit = 0, total = 0;
  for (let y = 0; y < h; y += 4) {
    for (let x = 0; x < w; x += 4) {
      const i = (y * w + x) * 4;
      const v = d[i] + d[i+1] + d[i+2];
      const qi = (y < h/2 ? 0 : 2) + (x < w/2 ? 0 : 1);
      qt[qi]++;
      total++;
      if (v > 24) { q[qi]++; lit++; }
    }
  }
  return { lit: lit/total, quads: q.map((n,i) => n/qt[i]) };
}"""

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
    ok = True
    for shot in SHOTS:
        page = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
        errors = []
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        page.goto(f"{BASE}?shot={shot}&seed=11", wait_until="load")
        try:
            page.wait_for_function("() => typeof window.wrecklightStatus === 'function'", timeout=15000)
        except Exception as exc:
            print(f"{shot}: BOOT FAILED {exc}")
            print("  errors:", errors[:4])
            ok = False
            page.close()
            continue
        page.wait_for_timeout(600)
        size = page.evaluate("() => { const c = document.getElementById('stage'); return [c.width, c.height]; }")
        stats = page.evaluate(QUADRANTS)
        q = stats["quads"]
        spread = max(q) - min(q)
        print(f"{shot:8s} canvas={size[0]}x{size[1]} lit={stats['lit']:.1%} "
              f"quads=[{q[0]:.0%} {q[1]:.0%} {q[2]:.0%} {q[3]:.0%}] spread={spread:.2f} errors={errors[:3]}")
        if errors:
            ok = False
        page.close()
    browser.close()

print("PROBE_OK", ok)
sys.exit(0 if ok else 1)
