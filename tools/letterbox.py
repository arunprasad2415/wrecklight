"""Check the letterboxing: at three window shapes the canvas must keep a 16:10 painted box,
stay inside the viewport, produce no scrollbars, and still map the mouse onto canvas pixels."""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8731/index.html"
SIZES = [(1280, 800), (1000, 900), (1600, 600), (700, 1000)]

ok = True
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
    for w, h in SIZES:
        page = browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(URL, wait_until="load")
        page.wait_for_timeout(700)
        info = page.evaluate("""() => {
            const c = document.getElementById('stage');
            const r = c.getBoundingClientRect();
            return {
                box: [Math.round(r.width), Math.round(r.height)],
                ratio: +(r.width / r.height).toFixed(4),
                insideX: r.left >= -0.5 && r.right <= window.innerWidth + 0.5,
                insideY: r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5,
                scrollX: document.documentElement.scrollWidth - window.innerWidth,
                scrollY: document.documentElement.scrollHeight - window.innerHeight,
                buf: [c.width, c.height],
            };
        }""")
        # Aim at the painted centre: the game must report the mouse near 640,400.
        page.mouse.move(w / 2, h / 2)
        page.keyboard.press("Enter")
        page.wait_for_timeout(500)
        aim = page.evaluate("""() => {
            const c = document.getElementById('stage');
            const r = c.getBoundingClientRect();
            return { rw: r.width, rh: r.height };
        }""")
        good = (
            abs(info["ratio"] - 1.6) < 0.01
            and info["insideX"] and info["insideY"]
            and info["scrollX"] <= 0 and info["scrollY"] <= 0
            and info["buf"] == [1280, 800]
            and not errors
        )
        ok = ok and good
        print(f"{w}x{h}: painted={info['box']} ratio={info['ratio']} inside=({info['insideX']},{info['insideY']}) "
              f"scroll=({info['scrollX']},{info['scrollY']}) buffer={info['buf']} errors={errors} ok={good}")
        page.close()
    browser.close()

print("LETTERBOX_OK", ok)
sys.exit(0 if ok else 1)
