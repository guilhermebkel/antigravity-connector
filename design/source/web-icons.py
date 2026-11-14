import os
import re
import shutil
import subprocess
import sys

from PIL import Image

# Why: the PNG icons and favicon.ico are drawn from the symbol files in ../svg, so they follow the kit; needs rsvg-convert and Pillow.
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
WEB = os.path.join(ROOT, "web")
INK = "#0D0E11"
if not shutil.which("rsvg-convert"):
    sys.exit("rsvg-convert is needed (librsvg)")


def symbol_group(name, scale):
    with open(os.path.join(ROOT, "svg", name), encoding="utf-8") as handle:
        paths = re.findall(r'<path d="([^"]+)" fill="([^"]+)"', handle.read())
    move = 128 * (1 - scale)
    body = "".join(f'<path d="{data}" fill="{fill}"/>' for data, fill in paths)
    return f'<g transform="translate({move:.2f} {move:.2f}) scale({scale})">{body}</g>'


def tile(radius, group):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="{radius}" fill="{INK}"/>'
            f"{group}</svg>")


def render(svg, size, name):
    target = os.path.join(WEB, name)
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), "-o", target], input=svg.encode(), check=True)


small = symbol_group("symbol-small-dark.svg", 0.78)
regular = symbol_group("symbol-dark.svg", 0.75)
maskable = symbol_group("symbol-dark.svg", 0.56)
for size in (16, 32, 48):
    render(tile(56, small), size, f"favicon-{size}.png")
render(tile(0, regular), 180, "apple-touch-icon.png")
render(tile(56, regular), 192, "icon-192.png")
render(tile(56, regular), 512, "icon-512.png")
render(tile(0, maskable), 512, "maskable-512.png")
images = [Image.open(os.path.join(WEB, f"favicon-{size}.png")).convert("RGBA") for size in (48, 32, 16)]
images[0].save(os.path.join(WEB, "favicon.ico"), sizes=[(48, 48), (32, 32), (16, 16)], append_images=images[1:])
print("web icons written")
