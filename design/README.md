# Design

Brand kit for antigravity-connector: the logo, its variants, the web icons and the presentation.

| Folder or file | What is in it |
| --- | --- |
| `svg/` | Symbol, horizontal and stacked logos, each in `light` and `dark`; `symbol-small-*` for 16 to 32 px. No background. |
| `mono/` | One-colour versions: black and white. |
| `web/` | `favicon.ico`, `favicon.svg`, PNG icons, `apple-touch-icon.png`, the app icon, `site.webmanifest` and `head-snippet.html`. |
| `presentation/` | The identity deck (`index.html`, `slide-*.png`) and the `spec.json` it is built from. |
| `social-preview.png` | The 1280 x 640 image for the GitHub social preview (Settings, General, Social preview). |
| `GUIDELINES.md` | Clear space, minimum sizes, colours and what not to do. |
| `source/` | The scripts that generate the SVG files, the web icons, the deck, the social preview and the Open Graph image (`og.html`, written to `site/og.png`). |

The landing page in `site/` uses the files in `web/` and `site/og.png`; copy them there again when the logo changes.

## Rebuild

```
cd design/source
export GEIST_WOFF=<path>/geist-latin-500-normal.woff GEIST_MONO_WOFF=<path>/geist-mono-latin-500-normal.woff
python3 kit.py                   # rewrites ../svg, ../mono and the SVG icons in ../web
python3 web-icons.py             # rewrites the PNG icons and favicon.ico in ../web
python3 build-images.py          # rewrites ../social-preview.png and ../../site/og.png
SKILL_DIR=<logo-skill-dir> ./build-presentation.sh
```

`kit.py` needs `fonttools` and `skia-pathops`; `web-icons.py` needs `Pillow` and `rsvg-convert`; `build-images.py` and `build-presentation.sh` need Playwright. The fonts come from the npm packages `@fontsource/geist` and `@fontsource/geist-mono`.

`site.webmanifest` and `head-snippet.html` in `web/` are written by hand. None of this is in the repository's scripts: `design/` is not part of the Docker image (`.dockerignore`) or the `pnpm check` run.
