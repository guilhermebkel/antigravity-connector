import os
import pathlib

from playwright.sync_api import sync_playwright

# Why: og.png is the Open Graph image of the landing page and social-preview.png is the GitHub social preview. Optional GEIST_WOFF and GEIST_MONO_WOFF load the fonts when they are not installed.
SOURCE = pathlib.Path(__file__).resolve().parent
JOBS = [
    ("og.html", (1200, 630), SOURCE / ".." / ".." / "site" / "og.png"),
    ("social-preview.html", (1280, 640), SOURCE / ".." / "social-preview.png"),
]


def font_css():
    rules = []
    for family, variable in (("Geist", "GEIST_WOFF"), ("Geist Mono", "GEIST_MONO_WOFF")):
        path = os.environ.get(variable)
        if path:
            rules.append(f'@font-face {{ font-family: "{family}"; font-weight: 400 500; src: url("{pathlib.Path(path).resolve().as_uri()}"); }}')
    return "\n".join(rules)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch()
    for name, (width, height), target in JOBS:
        page = browser.new_page(viewport={"width": width, "height": height})
        page.goto((SOURCE / name).as_uri())
        if font_css():
            page.add_style_tag(content=font_css())
        page.wait_for_timeout(600)
        page.screenshot(path=str(target.resolve()))
    browser.close()
print("images written")
