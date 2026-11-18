"""Long run on a throwaway copy of the game with a huge hull, to exercise boss fights,
relic drops, floor transitions and the victory screen. The shipped game is untouched."""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8732/index.html"

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
    last_key = None
    firing = False
    boss_seen = []
    floor_seen = set()
    max_rooms = 0
    max_score = 0
    drafts = 0

    for step in range(420):  # up to 7 minutes
        st = page.evaluate("() => window.wrecklightStatus()")
        floor_seen.add(st["floor"])
        max_rooms = max(max_rooms, st["rooms"])
        max_score = max(max_score, st["score"])

        key = (st["state"], st["floor"], st["room"], st["bossName"])
        if key != last_key:
            events.append(key)
            last_key = key

        if st["bossName"] and st["bossName"] not in boss_seen:
            boss_seen.append(st["bossName"])

        if st["state"] == "draft":
            drafts += 1
            if firing:
                page.mouse.up()
                firing = False
            set_held(set())
            page.keyboard.press(str(1 + drafts % 3))
            page.wait_for_timeout(200)
            continue
        if st["state"] == "results":
            break
        if st["state"] != "play":
            page.wait_for_timeout(200)
            continue

        target = st["nearest"] or st["bossPos"]
        if target:
            page.mouse.move(target["x"], target["y"])
            if not firing:
                page.mouse.down()
                firing = True
            # Drift around the arena centre to keep the beam sweeping across targets.
            ang = step * 0.07
            import math
            tx = 640 + math.cos(ang) * 300
            ty = 400 + math.sin(ang) * 220
            dx, dy = tx - 640, ty - 400
            want = set()
            if abs(dx) > 50:
                want.add("d" if dx > 0 else "a")
            if abs(dy) > 50:
                want.add("s" if dy > 0 else "w")
            set_held(want)
        if step % 9 == 4:
            page.keyboard.press(" ")
        if step % 13 == 6:
            page.keyboard.press("e")
        page.wait_for_timeout(280)

    final = page.evaluate("() => window.wrecklightStatus()")
    print("EVENTS", events[:40])
    print("BOSSES SEEN", boss_seen)
    print("FLOORS SEEN", sorted(floor_seen))
    print("DRAFTS", drafts, "MAX ROOMS", max_rooms, "MAX SCORE", max_score)
    print("FINAL", final)
    print("ERRORS", errors)
    page.screenshot(path="/tmp/wl-long.png")
    browser.close()

print("LONG_OK", not errors and len(boss_seen) >= 3 and 3 in floor_seen)
sys.exit(0 if (not errors and len(boss_seen) >= 3) else 1)
