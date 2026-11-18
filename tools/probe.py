"""Load WRECKLIGHT headless, collect page errors, and report the canvas size."""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8731/index.html"

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)
    page.goto(URL, wait_until="load")
    page.wait_for_function("() => typeof window.wrecklightStatus === 'function'", timeout=20000)
    page.wait_for_timeout(1200)
    info = page.evaluate("""() => {
        const c = document.getElementById('stage');
        return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight,
                 status: window.wrecklightStatus ? window.wrecklightStatus() : null };
    }""")
    print("INFO", info)
    print("ERRORS", errors)
    page.screenshot(path="/tmp/wl-title.png")
    browser.close()

sys.exit(0 if not errors else 1)
