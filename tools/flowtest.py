"""Play WRECKLIGHT until it reaches the shop and the route choice, exercising the whole loop:
fights, drafts, a keeper, the salvage table and the two doors. Reports every state it saw and
any page error, so the screens added between floors are proven to work in a real run."""
import sys
from playwright.sync_api import sync_playwright

URL = "http://127.0.0.1:8731/index.html"
BUDGET_STEPS = 620  # 620 * 0.33s = about 205 seconds of play

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True, args=["--no-sandbox"])
    page = browser.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=1)
    errors = []
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type == "error" else None)

    page.goto(URL, wait_until="load")
    page.wait_for_function("() => typeof window.wrecklightStatus === 'function'", timeout=20000)
    page.wait_for_timeout(400)
    page.keyboard.press("Enter")
    page.wait_for_timeout(300)

    held = set()

    def set_held(want):
        for k in list(held - want):
            page.keyboard.up(k)
            held.discard(k)
        for k in want - held:
            page.keyboard.down(k)
            held.add(k)

    states = []
    drafts = 0
    shops = 0
    routes = 0
    bought = 0
    peak_score = 0
    peak_rooms = 0
    firing = False

    for step in range(BUDGET_STEPS):
        st = page.evaluate("() => window.wrecklightStatus()")
        if not states or states[-1] != st["state"]:
            states.append(st["state"])
            print(f"  t={st['time']:6.1f} -> {st['state']:8s} floor={st['floor']} room={st['room']} "
                  f"score={st['score']} salvage={st['salvage']} hull={st['hull']}")
        peak_score = max(peak_score, st["score"])
        peak_rooms = max(peak_rooms, st["rooms"])

        if st["state"] == "draft":
            drafts += 1
            if firing:
                page.mouse.up()
                firing = False
            set_held(set())
            page.keyboard.press(str(1 + drafts % 3))
            page.wait_for_timeout(180)
            continue

        if st["state"] == "shop":
            shops += 1
            if firing:
                page.mouse.up()
                firing = False
            set_held(set())
            before = page.evaluate("() => window.wrecklightStatus().salvage")
            page.keyboard.press("1")
            page.wait_for_timeout(150)
            after = page.evaluate("() => window.wrecklightStatus().salvage")
            if after < before:
                bought += 1
                print(f"  bought item 1: salvage {before} -> {after}")
            page.keyboard.press("2")
            page.wait_for_timeout(150)
            page.keyboard.press("Enter")
            page.wait_for_timeout(200)
            continue

        if st["state"] == "route":
            routes += 1
            set_held(set())
            page.keyboard.press("2")
            page.wait_for_timeout(250)
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
            dx = target["x"] - 640
            dy = target["y"] - 400
            want = set()
            if abs(dx) > 40:
                want.add("d" if dx > 0 else "a")
            if abs(dy) > 40:
                want.add("s" if dy > 0 else "w")
            set_held(want)
        if step % 7 == 3:
            page.keyboard.press(" ")
        if step % 9 == 5:
            page.keyboard.press("e")
        page.wait_for_timeout(330)

    if firing:
        page.mouse.up()
    set_held(set())
    final = page.evaluate("() => window.wrecklightStatus()")
    print("STATES", states)
    print("FINAL", final)
    print(f"PEAK score={peak_score} rooms={peak_rooms} drafts={drafts} shops={shops} routes={routes} bought={bought}")
    print("ERRORS", errors[:5])
    browser.close()

ok = peak_score > 0 and peak_rooms >= 3 and drafts >= 1 and shops >= 1 and routes >= 1 and not errors
print("FLOW_OK", ok)
sys.exit(0 if ok else 1)
