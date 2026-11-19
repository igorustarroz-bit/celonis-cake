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

## Version 3 — glass 3D (WebGL), 2026-11-18

`versions/glass-3d/` — **George's animation (`illustrations/evolved/george/cake-ascent-30s.mp4`) re-staged in WebGL**
with the glass of `celonistvibecoding/experiments/datacore/index3d.html`: near-black smoked glass with light edges,
screen-space refraction over a pre-pass, frost, subtle bloom. **Hero only for now**; the other four slots keep the
original PNGs (when they get 3D they go in dark cards).

27.9 s loop (the video's 30 s minus its 2.2 s lone-dot opening, plus 0.5 s of black at the end), timed and framed on the video frame by frame (2 fps contact sheets, plate / tier / star widths measured per second):

| s | what happens |
|---|---|
| 0–2.5 | the data point alone — **skipped in the loop**: drawing starts at once (every tween moved 2.2 s earlier, `SHIFT`) |
| 2.5–5 | inner ring (= top tier), then outer ring (= plate), each growing both ways from the left with a bead on each open end; four loose beads between them |
| 5–8 | rays shoot out bead-first (some with a loose bead beyond the tip); the frame grows from the middle of its left side; the two lower tiers' footprints come in faint and dotted; data beads travel in |
| 8–9 | the frame turns a few degrees in its plane (right side dips) |
| 9–10 | **fast** tilt to 3D (0.8 s); rays and frame go, their beads linger; the outer ring becomes the plate; two verticals rise on the front |
| 10–17.5 | each tier (Igor): base ring, the **dotted side lines grow up first**, then the cap — rim beads fly in, the rim draws (beads on its ends) and the glass fills in with it — then the swags; the camera keeps the tier being built at the centre |
| 17.5–19.5 | close-up: four beads, the star's arcs, its glass; frosting falls bead-first |
| 19.5–26 | pull back; drips down the top tier; push in on the plate and the stand (beads floating around it, dashed drips under it); pull back to a small cake |
| 26–27.6 | hold |
| 27.6–29.6 | slow dissolve of everything, the data point included (the video just ends; the loop needs a way back) |
| 29.6–30.1 | **0.5 s of pure black** (Igor), then the loop starts drawing again |

- Proportions from the video's end frames: plate r 1, stand (stem r 0.13 + foot r 0.5), tiers r 0.80/0.62/0.42,
  h 0.36/0.32/0.28, star r 0.30.
- View scale (Igor): 1 for the flat drawing and the tilt, **1.4 from the moment the cake starts going up** (timeline `viewK`, 9.9–11.5 s
  in the video's times), back to 1 during the final black. The tuner's `view.scale` multiplies on top (default 1).
- Glass at the canvas edges (Igor: "the inner light breaks when the shape touches the top and bottom"): the refraction pre-pass is rendered
  with a 1.4× wider frustum (`PRE_MARGIN`), the shader maps into it (`uPre`) and mirrors instead of clamping, lens centres are clamped on
  screen. The final pass has **no edge mask** any more (it darkened the glass wherever the cake touched the edge), and the black floor is a
  **soft knee** (`smoothstep(0.6·floor, 1.8·floor)` on the brightest channel) instead of a hard subtract, which drew stepped contours in the
  bloom halo; haze below ~0.03 still goes to pure black, so no grey box around the canvas.
- Rim and base rings sit **on the rounded bevel** (its 45° point: r + 0.707·bevel, 0.293·bevel in from the face) — at the wall's radius and the
  cap's height they floated outside the glass corner (Igor: "the cap's top line doesn't fit it"). Same for the plate and the stand.
- The glass cylinders are truly round: 64 curve segments (128 points per circle; at 24 they were polygons and drifted 1–2 px off the round
  line rings), with the circle's start/end seam at the back (on the right-hand silhouette it drew a small bright wedge). Rims are drawn at
  full strength all round (`lines.backArc` = 1): with a glass cap the whole ellipse is visible, so a dimmer far half read as a mismatch.
- Every line sits on the glass edge (+0.001, was +0.003 ≈ 1 px outside). Swags are offset by half a scallop so no joint bead lands on the
  left/right silhouettes (it made a bump where the side line meets the rim), and the dotted wall lines fade as they turn toward the silhouette
  (`edgeFade`, smoothstep 0.12–0.45 of the facing) so none doubles the edge.
- Side silhouettes follow the glass profile: straight along the wall (r + bevel), then along the rounded bevel into the base ring and the rim,
  so they meet them exactly (Igor: "the side lines don't fit"). Swag joints and their beads sit where the wall meets the bevel, on the side line.
- `lines.backArc` (< 1) can still dim the far half of rims once the view is 3D, like the video's hidden-line drawing (default 1, off).
- **Every line is a screen-space ribbon** (`makeLine`): constant pixel width at any zoom (`lines.px` 2, `lines.finePx` 1.2),
  drawn on by a progress uniform, occluded by the glass, optional dash. Each tier has its bottom edge at the same width
  as its top edge (Igor). Ribbons are `DoubleSide` — their winding flips with the view.
- Glass fades through a `uFade` uniform (to black, which the screen blend makes transparent): nothing pops out —
  the star fills in over 1.5 s and the whole cake dissolves over 2.4 s.
- Glass defaults = Igor's tuning of 2026-11-19 (transmission 0.14, refract 0.89, frost 0.66, pieceMag 0.87, topDarken 0.25, body 0.65,
  pre 0.15, bloom 0.1 / 0.1 / 0.83, black floor 0.045); the rest as the Data Core.
- Hover: a tier lifts, the star spins (also every ~4 s once seated). Mouse parallax; gyroscope on phones (`js/tilt-parallax.js`).
  Reduced motion: the finished cake, still (timeline paused at 27 s).
- Rendering only while the hero is on screen. The canvas is opaque black and **screen-blended** onto the hero (its circles show
  through); a final soft-knee pass takes the faintest bloom haze to pure black (otherwise a grey box shows).
- Stage is a `<figure>`, not a `<div>`: `secondary-hero.css` absolutely positions every `.secondary-hero-wrapper div:first-child`.
- No WebGL → `img/hero.png` fallback (`.cake-3d-off`).
- Tuner (key T, `window.CAKE3D`, `CAKE3D_INFO()`): line art, motion & view (+ timeline read-out), the full glass set,
  Sharpness (MSAA/FXAA/dpr/pre-pass + in-effect read-out), backdrop, bloom, black floor. `__cake3d.timeline().seek(ms)` to scrub.
- Files: `js/cake-3d.js`, `js/cake-3d-tuner.js`, `css/cake-3d.css`; libs copied from the repo: `js/three.min.js` (r147),
  `js/three-post.js`, `js/anime.umd.min.js` (v4.5), `js/tilt-parallax.js`.
- `make-version.py`: slots listed in `version.json` → `"webgl": {"hero": "cake-3d"}` become the canvas stage.
- Verified (Chromium, 1440 and 390): 0 form/input/select/textarea/iframe with the tuner mounted, 0 cross-origin requests,
  only local scripts, no console errors.
