#!/usr/bin/env python3
"""
Pre-composite Word Racer's multi-part sprite rigs into ONE flattened PNG each.

Why: assets.json ships each rig as separate flat-colour "part" PNGs meant to be
stacked + tinted at runtime. Doing that literally means a LOT of native <Image>
views per frame — a single coin was 3 images, so 12 coins on screen = 36 images,
and the car was another 7. Flattening each rig offline collapses that to 1 image
per object with zero runtime layering cost.

Colours are already baked correctly in the source parts (verified), so this only
recolours the three cases where runtime differs from the file:
  - barrier stripe tiles alternate red / yellow
  - lane signs have an idle variant (dark plate, grey border)
  - the magnet's inner hole is a punch-out (transparent, so the black canvas
    shows through) rather than an opaque near-black fill

Geometry comes from assets.json's per-part anchor/size, converted to each rig's
tight content box (padding cropped) so the game can draw it at the same x/y it
already uses. Parts are exported at 4x, so all logical units are scaled by 4.

Run:  python3 scripts/compose-sprites.py
Out:  src/assets/images/composed/*.png
"""

import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  python3 -m pip install Pillow")

SCALE = 4  # parts are exported at 4x (assets.json: export_scale "4x")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PARTS = os.path.join(ROOT, "src", "assets", "images", "parts")
OUT = os.path.join(ROOT, "src", "assets", "images", "composed")

# Runtime colours that differ from what's baked into the part file.
SIGN_IDLE_PLATE = "#14181c"
SIGN_IDLE_BORDER = "#5b6b7e"
BARRIER_STRIPE_ALT = "#ffe600"


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def load(name):
    return Image.open(os.path.join(PARTS, f"{name}.png")).convert("RGBA")


def expect(img, name, w, h):
    """Guard against assets being re-exported at a different scale."""
    want = (w * SCALE, h * SCALE)
    if img.size != want:
        raise SystemExit(
            f"{name}.png is {img.size}, expected {want} "
            f"({w}x{h} logical @ {SCALE}x). Update SCALE or assets.json sizes."
        )


def part(name, w, h, recolor=None):
    """Load a part, assert its logical size, optionally swap its RGB (keeping
    the anti-aliased alpha channel intact)."""
    img = load(name)
    expect(img, name, w, h)
    if recolor:
        r, g, b = hex_rgb(recolor)
        alpha = img.getchannel("A")
        img = Image.new("RGBA", img.size, (r, g, b, 255))
        img.putalpha(alpha)
    return img


def canvas(w, h):
    return Image.new("RGBA", (w * SCALE, h * SCALE), (0, 0, 0, 0))


def paste(dst, src, x, y):
    """Alpha-composite `src` onto `dst` at a logical (x, y)."""
    layer = Image.new("RGBA", dst.size, (0, 0, 0, 0))
    layer.paste(src, (x * SCALE, y * SCALE))
    return Image.alpha_composite(dst, layer)


def punch_out(dst, mask, x, y):
    """Erase `mask`'s opaque pixels from `dst` (used for the magnet hole, which
    assets.json describes as a punch-out rather than a painted fill)."""
    out = dst.copy()
    ma = mask.getchannel("A")
    da = out.getchannel("A")
    px, pa = ma.load(), da.load()
    for j in range(mask.size[1]):
        for i in range(mask.size[0]):
            if px[i, j] > 127:
                pa[x * SCALE + i, y * SCALE + j] = 0
    out.putalpha(da)
    return out


def save(img, name):
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"{name}.png")
    img.save(path, optimize=True)
    lw, lh = img.size[0] // SCALE, img.size[1] // SCALE
    print(f"  {name+'.png':22s} {lw:3d}x{lh:<3d} logical  ({img.size[0]}x{img.size[1]} @{SCALE}x)")


def build_coin():
    # coin rig: disc 16x16 @(8,8), core 10x10 @(11,11) in a 32x32 frame.
    # Tight box = the disc; core offset = (11-8, 11-8) = (3,3).
    # coin_shine is intentionally EXCLUDED: assets.json notes it must not scale
    # with the pulse, while disc+core do — the game keeps it as its own 2x4 View.
    c = canvas(16, 16)
    c = paste(c, part("coin_disc", 16, 16), 0, 0)
    c = paste(c, part("coin_core", 10, 10), 3, 3)
    save(c, "coin")


CAR_STACK = [
    # (part name, logical w, h, x, y) — anchors from assets.json, rebased so the
    # car's content box starts at (0,0): frame anchors are (8,4)-relative.
    ("car_nose", 32, 12, 0, 0),
    ("car_wing_front", 32, 12, 0, 12),
    ("car_cockpit", 32, 8, 0, 24),
    ("car_wing_rear", 32, 8, 0, 32),
    ("car_wheels", 32, 4, 0, 40),
    ("car_window", 16, 8, 8, 8),
]


def build_car():
    c = canvas(32, 44)
    for name, w, h, x, y in CAR_STACK:
        c = paste(c, part(name, w, h), x, y)
    save(c, "car")

    # Shielded variant: ring is 38x50 and sits 3px outside the car on every
    # side (assets.json anchor (5,1) vs car content (8,4)).
    s = canvas(38, 50)
    s = paste(s, part("car_shield_ring", 38, 50), 0, 0)
    for name, w, h, x, y in CAR_STACK:
        s = paste(s, part(name, w, h), x + 3, y + 3)
    save(s, "car_shielded")


def build_shield_item():
    # hex 18x21 @(3,2), cross 10x10 @(7,6) in a 24x24 frame -> cross at (4,4).
    c = canvas(18, 21)
    c = paste(c, part("shield_hex", 18, 21), 0, 0)
    c = paste(c, part("shield_cross", 10, 10), 4, 4)
    save(c, "shield_item")


def build_magnet_item():
    # arc 18x9 @(3,3), legs 18x12 @(3,12), tips 18x5 @(3,24), hole 6x3 @(9,9)
    # in a 24x32 frame -> rebased to the 18x26 content box at x=3, y=3.
    c = canvas(18, 26)
    c = paste(c, part("magnet_arc", 18, 9), 0, 0)
    c = paste(c, part("magnet_legs", 18, 12), 0, 9)
    c = paste(c, part("magnet_tips", 18, 5), 0, 21)
    c = punch_out(c, part("magnet_hole", 6, 3), 6, 6)
    save(c, "magnet_item")


def build_barrier():
    # rail 288x4 @y0, 12 stripe tiles 24x16 @y6 (alternating), base 288x6 @y22.
    width = 288
    c = canvas(width, 28)
    c = paste(c, part("barrier_rail", width, 4), 0, 0)
    tile_red = part("barrier_block", 24, 16)
    tile_alt = part("barrier_block", 24, 16, recolor=BARRIER_STRIPE_ALT)
    for i in range(width // 24):
        c = paste(c, tile_red if i % 2 == 0 else tile_alt, i * 24, 6)
    c = paste(c, part("barrier_base", width, 6), 0, 22)
    save(c, "barrier")


def build_signs():
    # plate + border, both 86x20 @(2,2) in a 90x24 frame -> tight 86x20.
    active = canvas(86, 20)
    active = paste(active, part("sign_plate", 86, 20), 0, 0)
    active = paste(active, part("sign_border", 86, 20), 0, 0)
    save(active, "sign_active")

    idle = canvas(86, 20)
    idle = paste(idle, part("sign_plate", 86, 20, recolor=SIGN_IDLE_PLATE), 0, 0)
    idle = paste(idle, part("sign_border", 86, 20, recolor=SIGN_IDLE_BORDER), 0, 0)
    save(idle, "sign_idle")


def main():
    print(f"Composing sprites -> {os.path.relpath(OUT, ROOT)}")
    build_coin()
    build_car()
    build_shield_item()
    build_magnet_item()
    build_barrier()
    build_signs()
    print("Done.")


if __name__ == "__main__":
    main()
