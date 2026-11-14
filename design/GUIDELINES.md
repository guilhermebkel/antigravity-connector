# antigravity-connector logo guidelines

## The mark
- **Idea:** two inputs merge into one output. The two strokes are the two doors, the API (`/v1`) and the MCP endpoint (`/mcp`); the cyan stroke is the single queue that runs one `agy` call at a time. It grows from the two bars of the first landing page mark, now joined.
- **Versions:** horizontal (primary), stacked, symbol only, and a small symbol for 16 to 32 px.
- **Files:** `svg/` for screens (light and dark), `mono/` for one colour, `web/` for the favicon, app icon and manifest.
- **Not affiliated:** the mark does not use the Google or Antigravity logos or colours, and says nothing of affiliation. The tagline describes what the server does, not who made the CLI.

## Clear space
Keep a clear zone of one quarter of the symbol height on every side. The zone scales with the logo; never use a fixed distance.

## Minimum size
| Version | Screen |
| --- | --- |
| Horizontal | 120 px wide |
| Stacked | 80 px wide |
| Symbol | 32 px wide |
| Small symbol (`symbol-small-*.svg`, favicon) | 16 px |

Below 32 px always use the small symbol: its strokes are heavier so the opening between the two inputs stays clear.

## Colour
The colours are the ones of the landing page: a near-black ink, an off-white and one cyan. On light backgrounds the cyan is the same hue, darker, so it keeps its contrast.

| Name | HEX | RGB | CMYK (approx.) | Use |
| --- | --- | --- | --- | --- |
| Ink | `#0D0E11` | 13, 14, 17 | 24, 18, 0, 93 | The two inputs and the wordmark on light; dark backgrounds; the app icon tile |
| Text | `#F0F2F4` | 240, 242, 244 | 2, 1, 0, 4 | The two inputs and the wordmark on dark |
| Cyan | `#41D2EF` | 65, 210, 239 | 73, 12, 0, 6 | The output stroke on dark |
| Deep cyan | `#058EAF` | 5, 142, 175 | 97, 19, 0, 31 | The output stroke on light |
| Grey | `#5E6369` | 94, 99, 105 | 10, 6, 0, 59 | Tagline on light (`#82878C` on dark) |

CMYK values are rough conversions; check them with the printer. No Pantone is defined.

**Approved pairs** (WCAG contrast):
- `dark` files on ink are the primary use: the inputs are 17.2:1 and the cyan output 10.7:1.
- `light` files on white: the inputs are 19.3:1 and the deep cyan output 3.8:1.
- Cyan `#41D2EF` on white is 1.7:1: do not use it; use the `light` files.
- One colour: `mono/*-black.svg` or `*-white.svg` when colour is not available.

## Type
The wordmark is outlined from Geist Medium and the tagline from Geist Mono Medium (SIL OFL 1.1), so the SVG files need no font. Do not retype them in another typeface. Geist and Geist Mono are the companion typefaces for surrounding text, as on the landing page.

## Don'ts
- Do not stretch, squash or rotate the logo.
- Do not recolour outside the palette, or colour the two inputs with the cyan.
- Do not split the output from the inputs or change which stroke is cyan.
- Do not add shadows, outlines, gradients or effects.
- Do not change the size of the symbol relative to the wordmark.
- Do not use the full symbol below 32 px.
- Do not place it on a busy background without a colour block behind it.
- Do not use it in a way that suggests the project is made or endorsed by Google.
