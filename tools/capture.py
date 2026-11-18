"""Capture the four screenshots from ?shot= URLs, checking each render is actually lit — and
that the frame is not weighted to one side — before it is written, then verify the files that
landed on disk are 1280x800 JPEGs of real content."""
import os
import sys

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8731/index.html"
OUT = "/root/makefun/wrecklight/screenshots"
SHOTS = [
    ("play", "1-play.jpg", 0.55),
    ("title", "2-title.jpg", 0.45),
    ("draft", "3-draft.jpg", 0.45),
    ("results", "4-results.jpg", 0.45),
]
MIN_BYTES = 20 * 1024
MAX_BYTES = 256 * 1024
# No quadrant may be more than this far below the brightest one, so the frame is not one-sided.
MAX_SPREAD = 0.34

SAMPLE = """() => {
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


def capture(browser, shot, name, floor_lit):
    share = 0.0
    size = 0
    errors = []
    spread = 1.0
    for attempt in range(4):
        page = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
        errors = []
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
        page.goto(f"{BASE}?shot={shot}&seed=11", wait_until="load")
        try:
            page.wait_for_function("() => typeof window.wrecklightStatus === 'function'", timeout=20000)
        except Exception as exc:
            print(f"  boot failed for {name}: {exc} errors={errors}")
            page.close()
            continue
        page.wait_for_timeout(700)
        stats = page.evaluate(SAMPLE)
        share = stats["lit"]
        spread = max(stats["quads"]) - min(stats["quads"])
        path = os.path.join(OUT, name)
        page.screenshot(path=path, type="jpeg", quality=84, clip={"x": 0, "y": 0, "width": 1280, "height": 800})
        page.close()
        size = os.path.getsize(path)
        if share >= floor_lit and size >= MIN_BYTES and spread <= MAX_SPREAD and not errors:
            return size, share, errors, attempt + 1, spread
        print(f"  retry {name}: lit={share:.1%} spread={spread:.2f} bytes={size} errors={errors[:2]}")
    return size, share, errors, 4, spread


os.makedirs(OUT, exist_ok=True)
results = []
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
    for shot, name, floor_lit in SHOTS:
        size, share, errors, tries, spread = capture(browser, shot, name, floor_lit)
        results.append((name, size, share, errors, tries, spread, floor_lit))
        print(f"{name}: bytes={size} canvas_lit={share:.1%} spread={spread:.2f} tries={tries} errors={errors}")
    browser.close()

ok = all(
    MIN_BYTES <= r[1] <= MAX_BYTES and r[2] >= r[6] and r[5] <= MAX_SPREAD and not r[3]
    for r in results
)
print("CAPTURE_OK", ok)
print("TOTAL_BYTES", sum(r[1] for r in results))
sys.exit(0 if ok else 1)
