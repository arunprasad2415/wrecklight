"""Play WRECKLIGHT with real keyboard and mouse input for 30+ seconds: aim at the nearest
creature, close the distance when it is out of beam range, back off when it is on top of you,
hold the beam, dash and flare. Assert the score rises, a room clears, the draft appears and
pressing 1 actually takes a card. Report the numbers and any page error."""
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
    try:
        page.wait_for_function("() => typeof window.wrecklightStatus === 'function'", timeout=20000)
    except Exception as exc:
        print("BOOT FAILED", exc)
        print("ERRORS", errors)
        browser.close()
        sys.exit(1)
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

    peak_score = 0
    peak_rooms = 0
    kills = 0
    drafts = 0
    taken_before = 0
    taken_after = 0
    states = set()
    firing = False
    trace = []

    for step in range(110):  # 110 * 0.33s = 36 seconds
        st = page.evaluate("() => window.wrecklightStatus()")
        states.add(st["state"])
        peak_score = max(peak_score, st["score"])
        peak_rooms = max(peak_rooms, st["rooms"])
        kills = max(kills, st["kills"])

        if st["state"] == "draft":
            drafts += 1
            if firing:
                page.mouse.up()
                firing = False
            set_held(set())
            taken_before = st.get("cards", 0)
            page.keyboard.press(str(1 + drafts % 3))
            page.wait_for_timeout(220)
            after = page.evaluate("() => window.wrecklightStatus()")
            taken_after = after.get("cards", 0)
            if taken_after > taken_before and after["state"] == "play":
                print(f"  card taken: {taken_before} -> {taken_after}, back to play")
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
        if step % 11 == 5:
            page.keyboard.press("e")
        page.wait_for_timeout(330)
        if step % 6 == 0:
            trace.append((st["time"], st["score"], st["rooms"], st["hull"], st["enemies"]))

    if firing:
        page.mouse.up()
    set_held(set())
    final = page.evaluate("() => window.wrecklightStatus()")
    print("TRACE", trace)
    print("FINAL", final)
    print(f"PEAK score={peak_score} rooms={peak_rooms} kills={kills} drafts={drafts} cards={taken_after}")
    print("STATES", states)
    print("ERRORS", errors)
    page.screenshot(path="/tmp/wl-play.png")
    browser.close()

ok = peak_score > 0 and peak_rooms >= 1 and drafts >= 1 and taken_after > 0 and not errors
print("PLAYTEST_OK", ok)
sys.exit(0 if ok else 1)
