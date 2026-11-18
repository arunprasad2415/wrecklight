"""Full-run test against a shortened copy of the game (tiny rooms, low boss health,
huge hull) so all three floors, all three bosses, the relic drops and the victory
screen are exercised inside a couple of minutes. The shipped game is untouched."""
import math
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8733/index.html"

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)

    page.goto(URL, wait_until="load")
    page.wait_for_timeout(500)
    page.keyboard.press("Enter")
    page.wait_for_timeout(200)

    held = set()
    def set_held(want):
        for k in list(held - want):
            page.keyboard.up(k)
            held.discard(k)
        for k in want - held:
            page.keyboard.down(k)
            held.add(k)

    events = []
    bosses = []
    last_key = None
    firing = False
    drafts = 0
    seen_results = False

    for step in range(600):
        st = page.evaluate("() => window.wrecklightStatus()")
        key = (st["state"], st["floor"], st["room"], st["bossName"])
        if key != last_key:
            events.append(key)
            last_key = key
        if st["bossName"] and st["bossName"] not in bosses:
            bosses.append(st["bossName"])

        if st["state"] == "draft":
            drafts += 1
            if firing:
                page.mouse.up()
                firing = False
            set_held(set())
            page.keyboard.press(str(1 + drafts % 3))
            page.wait_for_timeout(160)
            continue
        if st["state"] == "results":
            seen_results = True
            break
        if st["state"] != "play":
            page.wait_for_timeout(160)
            continue

        target = st["nearest"] or st["bossPos"]
        if target:
            page.mouse.move(target["x"], target["y"])
            if not firing:
                page.mouse.down()
                firing = True
            ang = step * 0.11
            tx = 640 + math.cos(ang) * 300
            ty = 400 + math.sin(ang) * 200
            dx, dy = tx - 640, ty - 400
            want = set()
            if abs(dx) > 50:
                want.add("d" if dx > 0 else "a")
            if abs(dy) > 50:
                want.add("s" if dy > 0 else "w")
            set_held(want)
        if step % 9 == 4:
            page.keyboard.press(" ")
        if step % 11 == 6:
            page.keyboard.press("e")
        page.wait_for_timeout(220)

    if firing:
        page.mouse.up()
    set_held(set())
    final = page.evaluate("() => window.wrecklightStatus()")
    print("EVENTS", events)
    print("BOSSES", bosses)
    print("DRAFTS", drafts, "RESULTS", seen_results)
    print("FINAL", final)
    print("ERRORS", errors)
    page.screenshot(path="/tmp/wl-victory.png")
    browser.close()

ok = not errors and len(bosses) >= 3 and seen_results
print("FULLRUN_OK", ok)
sys.exit(0 if ok else 1)
