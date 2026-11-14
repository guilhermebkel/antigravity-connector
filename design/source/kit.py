import os
import sys

import pathops
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

GEIST = os.environ.get("GEIST_WOFF")
GEIST_MONO = os.environ.get("GEIST_MONO_WOFF")
if not GEIST or not GEIST_MONO:
    sys.exit("Set GEIST_WOFF and GEIST_MONO_WOFF to the latin-500-normal.woff files (npm: @fontsource/geist and @fontsource/geist-mono)")

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TITLE = "antigravity-connector"
TAGLINE = "LOCALHOST-ONLY  ·  OPENAI API + MCP"
# Why: the ink, the text and the cyan are the ones of the landing page; the deep cyan is the same hue made darker so it holds 3.8:1 on white.
INK, TEXT = "#0D0E11", "#F0F2F4"
CYAN, CYAN_DEEP = "#41D2EF", "#058EAF"
GREY, GREY_DARK = "#5E6369", "#82878C"
THEMES = {
    "light": {"ink": INK, "stem": INK, "accent": CYAN_DEEP, "tagline": GREY},
    "dark": {"ink": TEXT, "stem": TEXT, "accent": CYAN, "tagline": GREY_DARK},
}
MONO = {"black": "#000000", "white": "#ffffff"}
# Why: the mark is two inputs that merge into one output. Coordinates are on a 256 grid before the fit; the small version has heavier strokes.
STROKE, STROKE_SMALL = 32, 42
LEFT = [(72, 64), (72, 96), (128, 152)]
RIGHT = [(184, 64), (184, 96), (128, 152)]
STEM = [(128, 152), (128, 196)]
FIT_HEIGHT = 208

FONTS = {}
for key, path in (("sans", GEIST), ("mono", GEIST_MONO)):
    face = TTFont(path)
    FONTS[key] = (face.getGlyphSet(), face.getBestCmap(), face["head"].unitsPerEm)


def stroked(points, width):
    path = pathops.Path()
    pen = path.getPen()
    pen.moveTo(points[0])
    for point in points[1:]:
        pen.lineTo(point)
    pen.endPath()
    path.stroke(width, pathops.LineCap.ROUND_CAP, pathops.LineJoin.ROUND_JOIN, 4)
    # Why: Skia strokes round caps as conics, which the boolean operations and SVG do not accept; quadratics are close enough.
    path.convertConicsToQuads(0.05)
    return path


def fitted(path, scale, move_x, move_y):
    result = pathops.Path()
    path.transform(scale, 0, 0, scale, move_x, move_y).draw(result.getPen())
    return result


def path_commands(path):
    pen = SVGPathPen(None, ntos=lambda value: f"{value:.2f}".rstrip("0").rstrip("."))
    path.draw(pen)
    return pen.getCommands()


def symbol_paths(width):
    inputs = pathops.op(stroked(LEFT, width), stroked(RIGHT, width), pathops.PathOp.UNION)
    output = stroked(STEM, width)
    # Why: the output sits on top of the point where the inputs meet; cutting it out keeps the two colours from overlapping.
    inputs = pathops.op(inputs, output, pathops.PathOp.DIFFERENCE)
    box = pathops.op(inputs, output, pathops.PathOp.UNION).bounds
    scale = FIT_HEIGHT / (box[3] - box[1])
    move_x = 128 - scale * (box[0] + box[2]) / 2
    move_y = 128 - scale * (box[1] + box[3]) / 2
    return (path_commands(fitted(inputs, scale, move_x, move_y)), path_commands(fitted(output, scale, move_x, move_y)))


def text_path(text, size, x, baseline, tracking=0, face="sans"):
    glyphs, cmap, upm = FONTS[face]
    scale = size / upm
    pen = SVGPathPen(glyphs)
    cursor = x
    for char in text:
        name = cmap[ord(char)]
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, cursor, baseline)))
        cursor += glyphs[name].width * scale + tracking
    return pen.getCommands(), cursor


def text_width(text, size, tracking=0, face="sans"):
    return text_path(text, size, 0, 0, tracking, face)[1]


def symbol_group(width, stem, accent, offset_x=0):
    inputs, output = symbol_paths(width)
    move = f' transform="translate({offset_x:.1f} 0)"' if offset_x else ""
    return (f'<g id="icone"{move}><path d="{inputs}" fill="{stem}"/>'
            f'<path d="{output}" fill="{accent}"/></g>')


def wrap(view_box, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}" role="img" aria-label="{TITLE}">'
            f"<title>{TITLE}</title>{body}</svg>\n")


def symbol_svg(width, stem, accent):
    return wrap("0 0 256 256", symbol_group(width, stem, accent))


def horizontal_svg(ink, stem, accent, tagline_color):
    word, word_end = text_path(TITLE, 96, 300, 150, -1.6)
    tag, tag_end = text_path(TAGLINE, 28, 304, 206, 2.4, "mono")
    width = int(max(word_end, tag_end)) + 40
    body = (symbol_group(STROKE, stem, accent) + f'<g id="palavra"><path d="{word}" fill="{ink}"/></g>'
            f'<g id="slogan"><path d="{tag}" fill="{tagline_color}"/></g>')
    return wrap(f"0 0 {width} 256", body)


def stacked_svg(ink, stem, accent, tagline_color):
    word_width = text_width(TITLE, 56, -0.9)
    tag_width = text_width(TAGLINE, 17, 1.6, "mono")
    width = int(max(word_width, 256)) + 80
    center = width / 2
    word, _ = text_path(TITLE, 56, center - word_width / 2, 330, -0.9)
    tag, _ = text_path(TAGLINE, 17, center - tag_width / 2, 372, 1.6, "mono")
    body = (symbol_group(STROKE, stem, accent, center - 128) + f'<g id="palavra"><path d="{word}" fill="{ink}"/></g>'
            f'<g id="slogan"><path d="{tag}" fill="{tagline_color}"/></g>')
    return wrap(f"0 0 {width} 400", body)


def write(folder, name, content):
    with open(os.path.join(ROOT, folder, name), "w", encoding="utf-8") as handle:
        handle.write(content)


for theme, colors in THEMES.items():
    ink, stem, accent, tagline = colors["ink"], colors["stem"], colors["accent"], colors["tagline"]
    write("svg", f"symbol-{theme}.svg", symbol_svg(STROKE, stem, accent))
    write("svg", f"symbol-small-{theme}.svg", symbol_svg(STROKE_SMALL, stem, accent))
    write("svg", f"horizontal-{theme}.svg", horizontal_svg(ink, stem, accent, tagline))
    write("svg", f"stacked-{theme}.svg", stacked_svg(ink, stem, accent, tagline))

for name, color in MONO.items():
    write("mono", f"symbol-{name}.svg", symbol_svg(STROKE, color, color))
    write("mono", f"horizontal-{name}.svg", horizontal_svg(color, color, color, color))
    write("mono", f"stacked-{name}.svg", stacked_svg(color, color, color, color))

write("web", "antigravity-connector-app-icon.svg", wrap(
    "0 0 256 256",
    f'<rect width="256" height="256" rx="56" fill="{INK}"/><g transform="translate(32 32) scale(0.75)">'
    + symbol_group(STROKE_SMALL, TEXT, CYAN) + "</g>"))
# Why: a tab can be light or dark, so the favicon carries its own dark tile; the white strokes would vanish on a light tab.
write("web", "favicon.svg", wrap(
    "0 0 256 256",
    f'<rect width="256" height="256" rx="56" fill="{INK}"/><g transform="translate(28.2 28.2) scale(0.78)">'
    + symbol_group(STROKE_SMALL, TEXT, CYAN) + "</g>"))
print("kit written")
