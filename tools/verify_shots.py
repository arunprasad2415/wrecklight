"""Check the JPEGs on disk: exact dimensions, format, byte size, lit share and per-quadrant
balance, so neither a black frame nor a one-sided frame can pass."""
import os
import sys

from PIL import Image

OUT = "/root/makefun/wrecklight/screenshots"
FILES = [
    ("1-play.jpg", 0.55),
    ("2-title.jpg", 0.45),
    ("3-draft.jpg", 0.45),
    ("4-results.jpg", 0.45),
]
MAX_BYTES = 262144
MIN_BYTES = 20 * 1024
MAX_SPREAD = 0.34

ok = True
total = 0
for name, floor_lit in FILES:
    path = os.path.join(OUT, name)
    size = os.path.getsize(path)
    total += size
    with Image.open(path) as img:
        dims = img.size
        fmt = img.format
        small = img.convert("RGB").resize((320, 200))
    px = small.load()
    w, h = small.size
    quad = [0, 0, 0, 0]
    quad_total = [0, 0, 0, 0]
    lit = 0
    bright = 0
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            qi = (0 if y < h // 2 else 2) + (0 if x < w // 2 else 1)
            quad_total[qi] += 1
            if r + g + b > 24:
                lit += 1
                quad[qi] += 1
            bright += r + g + b
    share = lit / (w * h)
    quads = [quad[i] / quad_total[i] for i in range(4)]
    spread = max(quads) - min(quads)
    mean = bright / (w * h * 3)
    good = (dims == (1280, 800) and fmt == "JPEG" and MIN_BYTES <= size <= MAX_BYTES
            and share >= floor_lit and spread <= MAX_SPREAD)
    ok = ok and good
    print(f"{name:14s} bytes={size:7d} dims={dims[0]}x{dims[1]} fmt={fmt} lit={share:5.1%} "
          f"quads=[{quads[0]:4.0%} {quads[1]:4.0%} {quads[2]:4.0%} {quads[3]:4.0%}] "
          f"spread={spread:.2f} mean={mean:6.1f} ok={good}")

print("TOTAL", total, "ALL_OK", ok)
sys.exit(0 if ok else 1)
