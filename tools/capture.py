"""Capture the four screenshots from ?shot= URLs, checking each render is actually lit before
it is written, then verify the files that landed on disk are 1280x800 JPEGs of real content."""
import os
import sys

from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8731/index.html"
OUT = "/root/makefun/wrecklight/screenshots"
SHOTS = [
    ("play", "1-play.jpg"),
    ("title", "2-title.jpg"),
    ("draft", "3-draft.jpg"),
    ("results", "4-results.jpg"),
]
MIN_BYTES = 20 * 1024
MAX_BYTES = 256 * 1024
MIN_LIT = 0.50


def lit_share(page):
    """Sample the canvas: share of pixels with r+g+b > 24, so a blank frame is caught."""
    return page.evaluate("""() => {
        const c = document.getElementById('stage');
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let lit = 0, total = 0;
        for (let i = 0; i < d.length; i += 4 * 5) {
            total++;
            if (d[i] + d[i + 1] + d[i + 2] > 24) lit++;
        }
        return lit / total;
    }""")


def capture(browser, shot, name):
    share = 0.0
    size = 0
    errors = []
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
        share = lit_share(page)
        path = os.path.join(OUT, name)
        page.screenshot(path=path, type="jpeg", quality=82, clip={"x": 0, "y": 0, "width": 1280, "height": 800})
        page.close()
        size = os.path.getsize(path)
        if share >= MIN_LIT and size >= MIN_BYTES:
            return size, share, errors, attempt + 1
        print(f"  retry {name}: lit={share:.1%} bytes={size}")
    return size, share, errors, 4


os.makedirs(OUT, exist_ok=True)
results = []
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
    for shot, name in SHOTS:
        size, share, errors, tries = capture(browser, shot, name)
        results.append((name, size, share, errors, tries))
        print(f"{name}: bytes={size} canvas_lit={share:.1%} tries={tries} errors={errors}")
    browser.close()

print("CAPTURE_OK", all(MIN_BYTES <= r[1] <= MAX_BYTES and r[2] >= MIN_LIT and not r[3] for r in results))
print("TOTAL_BYTES", sum(r[1] for r in results))
sys.exit(0 if all(MIN_BYTES <= r[1] <= MAX_BYTES and r[2] >= MIN_LIT and not r[3] for r in results) else 1)
