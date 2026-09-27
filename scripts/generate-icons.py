#!/usr/bin/env python3
"""Draws the atak-reactive plugin icons and writes them as Android density sets.

Usage: ./scripts/generate-icons.py [<res-dir> ...]

With no arguments it writes both of the trees the repo ships:

    example/app/src/main/res     the example plugin's own icons
    cli/src/templates/res        the tool icon `init` copies into a host plugin

The mark is two elliptical orbits inside four corner targeting brackets. It is
drawn, not traced from anywhere: an atom of elliptical orbits is a generic
symbol that long predates React, and the details that make React's logo React's
trademark -- three orbits at 60 degrees, the #61dafb cyan -- are deliberately
not reproduced here. Two orbits, phosphor green, brackets that are ours. Keep it
that way if you retune the geometry below.

Two icons come out of one drawing, because ATAK shows a plugin in two places:

    ic_launcher        colour, on a plate. AndroidManifest android:icon, which
                       is what the Plugins manager and Android itself list.
    ic_reactive_tool   white on transparent. The drawable handed to
                       AbstractPluginTool, which is the side-menu entry.

Requires Pillow (pip install Pillow). Committed output is what ships; rerun this
only when the art changes.
"""

import math
import os
import sys

from PIL import Image, ImageDraw

# Supersampled canvas. Everything below is a fraction of this, so the geometry
# is resolution independent and the density set is just repeated downsampling.
S = 2048

ORBIT = (0x3D, 0xF5, 0x7E, 255)  # phosphor green, the accent
BRACKET = (0xE8, 0xF5, 0xE9, 255)  # brackets on the colour plate
PLATE = (0x12, 0x18, 0x26, 255)  # plate behind the colour icon
WHITE = (0xFF, 0xFF, 0xFF, 255)

# An Android density set is these buckets scaled off a dp base: mdpi is 1x.
DENSITIES = [("mdpi", 1.0), ("hdpi", 1.5), ("xhdpi", 2.0),
             ("xxhdpi", 3.0), ("xxxhdpi", 4.0)]
LAUNCHER_DP = 48  # Android's launcher-icon base size
TOOL_DP = 32      # what ATAK's toolbar draws a plugin tool at


def blank():
    return Image.new("RGBA", (S, S), (0, 0, 0, 0))


def orbit(color, width, a, b, angle):
    """One elliptical orbit, rotated about the centre.

    Pillow cannot stroke a rotated ellipse, so each orbit gets its own layer
    that is drawn axis-aligned and then rotated bicubically.
    """
    layer = blank()
    c = S / 2
    ImageDraw.Draw(layer).ellipse([c - a, c - b, c + a, c + b],
                                  outline=color, width=width)
    return layer.rotate(angle, resample=Image.BICUBIC, center=(c, c))


def mark(orbit_color, bracket_color):
    """The logo itself, filling the full canvas.

    The stroke is deliberately light and there is no nucleus. Checked on a
    420dpi device, where ATAK draws the tool icon at 79px: at a heavier weight
    the two orbits and a centre dot fused into a solid four-lobe blob, which
    read as muddy next to ATAK's own open line art. Thinner strokes and a wider
    minor axis keep the two ellipses distinct all the way down to 24px. Verify
    at 24px before thickening any of this.
    """
    img = blank()
    for angle in (55, 125):
        img = Image.alpha_composite(
            img, orbit(orbit_color, int(S * 0.055), S * 0.320, S * 0.142, angle))

    draw = ImageDraw.Draw(img)

    # Four corner brackets. Straight lines survive downsampling far better than
    # the orbits do, which is what keeps the mark readable at 24-32px.
    width = int(S * 0.055)
    near, far, length = S * 0.062, S * 0.938, S * 0.225
    for x, y, sx, sy in ((near, near, 1, 1), (far, near, -1, 1),
                         (near, far, 1, -1), (far, far, -1, -1)):
        draw.line([x, y, x + sx * length, y], fill=bracket_color, width=width)
        draw.line([x, y, x, y + sy * length], fill=bracket_color, width=width)
    return img


def inset(img, pad):
    """Shrink the art and centre it, leaving transparent margin."""
    size = int(S * (1 - 2 * pad))
    out = blank()
    out.alpha_composite(img.resize((size, size), Image.LANCZOS),
                        (int(S * pad), int(S * pad)))
    return out


def launcher():
    plate = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(plate).rounded_rectangle([0, 0, S - 1, S - 1],
                                            radius=int(S * 0.22), fill=PLATE)
    return Image.alpha_composite(plate, inset(mark(ORBIT, BRACKET), 0.10))


def tool():
    # White, not green: ATAK's toolbar is monochrome, and a tinted green loses
    # too much contrast against the dark chrome once it is down at 32px.
    return inset(mark(WHITE, WHITE), 0.06)


def write(res_dir, name, img, base_dp):
    for bucket, scale in DENSITIES:
        px = int(base_dp * scale)
        out = os.path.join(res_dir, f"drawable-{bucket}")
        os.makedirs(out, exist_ok=True)
        img.resize((px, px), Image.LANCZOS).save(os.path.join(out, f"{name}.png"))
    print(f"  {name}: {base_dp}dp -> {res_dir}/drawable-*")


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    targets = sys.argv[1:] or [
        os.path.join(root, "example", "app", "src", "main", "res"),
        os.path.join(root, "cli", "src", "templates", "res"),
    ]
    for res_dir in targets:
        print(res_dir)
        # The host plugin keeps its own launcher icon, so the CLI template ships
        # the tool icon only.
        if "templates" not in res_dir:
            write(res_dir, "ic_launcher", launcher(), LAUNCHER_DP)
        write(res_dir, "ic_reactive_tool", tool(), TOOL_DP)


if __name__ == "__main__":
    main()
