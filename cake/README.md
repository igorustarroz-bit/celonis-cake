# Cake — Enterprise AI recipe page (local prototype)

Unofficial design prototype by Hanzo. Not an official page of the brand shown, and not published or endorsed by them.

**Open:** double-click `index.html` (works from `file://`, no server).

Replacement template for *Process Intelligence 101*, built from the approved Figma
(`🔧 FY27 - New pages`, node 6069:83240). v1 (2026-11-18) follows the conventions of the
`celonistvibecoding` repo: the site's own blocks wherever one exists, the repo's shared libs,
and the anti-phishing rules 1–13.

## Module map

| Figma | Built with |
|---|---|
| M01 Main menu, M05 Footer | header/footer of `experiments/3d-book/index.html` (already cleaned; newsletter = inert replica) + `nav-fx.js` |
| M15 Secondary hero | site block `secondary-hero` (animated circles background, CSS) |
| M03 Anchor menu | site block `anchor-secondary-menu`; layered under the header as in experiment 7 (§23.2–24.3) |
| M45 Text only | site block `text-only` (word reveal); the second half stays dim, as in the Figma |
| M46 Short list | site block `title` + check list (page CSS) |
| M09 Solutions | tabs + list on site tokens — the site's `solutions` block is an auto-advancing accordion, a different behaviour |
| M61 + M28 Method | site block `title` + journey (page CSS) |
| M19 ×3 | site block `collapse-expand` (Step 2 = `align-right`) |
| M25 Chef's tip | site block `quotes` |
| M08 Basic | site block `basic-module` |
| M13 Closing | site block `question` (marquee + XL buttons) |

Files: `css/` site CSS + `cake.css` (page CSS) · `js/` `sprite.js`, `inert-form.js`, `nav-fx.js` (copies from the repo's
`experiments/lib` and `experiments/`) + `cake.js` · `fonts/` Poppins · `img/` the illustrations from `illustrations/original`.

## Anti-phishing (verified 2026-11-18, Chromium, 1440 and 390 px)
No canonical / og / twitter / JSON-LD · `noindex,nofollow` · own title & description · every outbound link → `#` ·
0 `form/input/select/textarea/iframe` · only our scripts · 0 cross-origin requests · nothing names the source site.

## Pending
- Placeholder copy (`data-placeholder="true"`): Equipment tab and the collapsed accordion answers of Steps 1–3 (hidden in the Figma master).
- Header mega-menu and mobile menu do not open (same as every experiment: the site's own JS is stripped).
- Next: replace the PNGs with the improved animated illustrations (with a `tuner-ui` panel, per the repo rule).

## Illustration versions (2026-11-18)
Index of all versions: `../index.html` (root of celonis_cake), generated — do not edit by hand.

Each version is a full copy of this template in `versions/<slug>/` with its own `img/` (five slots:
`hero`, `shortlist`, `step-1`, `step-2`, `step-3`); site CSS/JS/fonts stay shared in `cake/`.

    python3 cake/make-version.py new <slug> "<Label>" "<description>"   # copy the template, seed img/ with the original PNGs
    python3 cake/make-version.py index                                 # rebuild the root index

Then replace the files in `versions/<slug>/img/`. Changes to the template do not reach existing versions:
re-copy a version's page with `new <slug> ... --force` (its img/ is kept).

## Version 2 — evolved line animation (video), 2026-11-18

`versions/evolved-video/` — only George's full animation, `illustrations/evolved/george/cake-ascent-30s.mp4`,
cut into chapters (no Gemini clips, not `cake-original-30s`).

| slot | cut | what it shows |
|---|---|---|
| hero | 0–30 s | the whole animation, as delivered (white on black) |
| step-1 | 0–10 s | data point → rings → data frame with sources |
| step-2 | 10–17 s | base plate and layers stacking |
| step-3 | 17–23 s | AI frosting dropping onto the top tier |
| shortlist | 23–30 s | the finished cake pulling back |

- 1280 px, 30 fps, H.264, no audio, `+faststart`; blacks crushed with `curves=all='0/0 0.07/0 1/1'`.
- Clips for white modules (step-1/2/3, shortlist) are colour-inverted **in the file** (ffmpeg `negate`):
  black lines on pure #fff. The CSS no longer inverts; it only multiplies (light) / screens (hero).
- Posters = last frame (`<slot>.jpg`). Plays only on screen; reduced motion holds the poster.
- `make-version.py` turns any slot with `img/<slot>.mp4` into a `<video>` and loads `css/cake-video.css`,
  `css/tuner-ui.css`, `js/tuner-ui.js`, `js/cake-video.js`. Tuner (key T): play/pause, speed, line contrast,
  brightness, fit, slot shape 4:3/16:9, blends. Index order comes from `"order"` in each `version.json`.
