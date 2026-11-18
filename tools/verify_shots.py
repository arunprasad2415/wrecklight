"""Check the JPEGs on disk: exact dimensions, format, byte size, and that each frame is
actually lit (mean brightness well above black), so a black screenshot cannot pass."""
import os
import sys

from PIL import Image

OUT = "/root/makefun/wrecklight/screenshots"
NAMES = ["1-play.jpg", "2-title.jpg", "3-draft.jpg", "4-results.jpg"]
MAX_BYTES = 262144
MIN_BYTES = 20 * 1024

ok = True
total = 0
for name in NAMES:
    path = os.path.join(OUT, name)
    size = os.path.getsize(path)
    total += size
    with Image.open(path) as img:
        dims = img.size
        fmt = img.format
        small = img.convert("RGB").resize((320, 200))
    pixels = list(small.getdata())
    lit = sum(1 for r, g, b in pixels if r + g + b > 24) / len(pixels)
    mean = sum(r + g + b for r, g, b in pixels) / (len(pixels) * 3)
    good = dims == (1280, 800) and fmt == "JPEG" and MIN_BYTES <= size <= MAX_BYTES and lit >= 0.5
    ok = ok and good
    print(f"{name:14s} bytes={size:7d} dims={dims[0]}x{dims[1]} fmt={fmt} lit={lit:5.1%} mean={mean:6.1f} ok={good}")

print("TOTAL", total, "ALL_OK", ok)
sys.exit(0 if ok else 1)
