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
screen-space refraction over a pre-pass, frost, subtle bloom. Hero + the four white-module slots (2026-11-19), all in the same WebGL tech.

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
- Tier bevel is small (`BEV` 0.007, was 0.016): the rim on the upper bevel and the side lines at the wall's radius then differ by
  < 0.5 px, so the top corners close without a hook (Igor, 2026-11-19).
- Bottom rings (tiers, plate, stand) are drawn **front half only, always** (`frontOnly`: their own far-half opacity 0) — the full ellipse in
  perspective must never show, e.g. while a tier is built and there is no fill to hide its back yet (Igor, 2026-11-19).
- Bottom edges (tiers, plate, stand) sit at the **foot of the wall** (full radius, y = bevel), and the side lines run straight down to them:
  the lower bevel faces away from the camera, so a ring on it (or a side line curving into it) was hidden by the wall and the corners
  broke — very visible on the white modules' solid fill (Igor, 2026-11-19). Top edges stay on the upper bevel's 45° point.
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

### White modules — compositions from the hero scene (2026-11-19)

Igor first asked for "fragments of the hero animation" on white, then refined it per module ("all in the same technology").
`cake-3d.js` is instanced: one `createCake()` per `canvas.cake-3d-canvas`, all sharing `window.CAKE3D` (the tuner drives every
illustration). Light slots (`data-scene="cake-3d-light"`) render the same scene **inverted** in the floor pass (`uInvert`: white page,
dark lines, milky glass, desaturated 92 % so the glass isn't cream) and the canvas is multiplied onto the module. Each slot's
composition is `SLOTCFG[slot]` in `cake-3d.js` — the stretch of the hero timeline it loops (`seg`) or the moment it holds (`hold`),
the parts switched off (`hide`), the tiers shown and an optional fixed camera:

| slot | composition |
|---|---|
| shortlist | **only the three tiers and the star** (glass, rims, side lines) — no plate, stand, swags, grid, beads or frosting; held finished (25 s), star spin + parallax |
| step-1 | the opening drawing (0–6.75 s: dot, rings, rays, data frame), then it **undraws in sequence** (2.7 s): frame, rays (bead riding back), faint rings, outer ring, inner ring, dot — and starts again |
| step-2 | the tiers going up (7.8–15.4 s) as **lines only**: the front (lower) halves of the cap rings, the dotted wall lines and the swags (front halves); fixed camera; then **undraws in reverse**, tier by tier from the top: swags, rim, dotted lines (3.1 s) |
| step-3 | **the top tier alone and the star** with every detail — — grid, swags, beads, frosting, drips (13–20.8 s); fixed close camera; then **undraws in reverse**: frosting stops, the drips **run down and drop off** (trail emptied from the top, `uStart`), star glass → arcs → beads, the rim beads **drop and fade**, swags, rim with its fill, dotted lines (3.4 s) — nothing goes back up against gravity (Igor) |

- **Pure black and white** (Igor: "remove every glass effect from the white ones"): in light slots the glass is a flat fill (`uSolid`:
  black here, white once inverted) that only hides what is behind it — no refraction, light edges (EdgesGeometry rims off) or bloom;
  every line, bead, drip and frosting stroke is solid black (no opacity levels, frosting `uSolid` = plain stroke). Lines are pulled a
  hair toward the camera (`uZBias` 0.0002 NDC ≈ 0.01 world) so a line lying on a surface always beats its fill (polygonOffset on the
  fill was unreliable across depth formats and broke the hidden-line occlusion).
- Shortlist: no white card behind the illustration (`css/cake-3d.css`), the module's grey shows through the multiplied canvas.
- Steps 1–3 never fade: each `SLOTCFG` entry has an `outro` list `[state key, start ms, duration ms(, 'up')]` applied after the stretch ends
  (`'up'` keys grow 0 → 1 for things that fall: `dripFall`, `beadFall`)
  (Igor: "the disappearances must be sequential"). Only a stretch without an outro would fade at the seams (`uGlobal`, 0.45 s).
- Reduced motion: each light slot holds a still (90 % of its stretch; the shortlist its held moment).
- `__cake3dAll[i].seg(ms)` jumps a light slot within its stretch (debugging).

## Version 4 — glass 3D, slice hero (WebGL), 2026-11-19

`versions/glass-3d-slice/` — the Glass 3D page with a different hero (Igor: "a slice of cake like this one, not animated, but reacting to the
mouse"; reference: a cartoon pie slice with a dollop of cream). Hero `data-scene="cake-3d-slice"`; the four white modules are the Glass 3D ones.

- Same scene and glass (`cake-3d.js`, `SLICE` mode): the cake parts are hidden and a wedge is built instead — **three glass layers** (base 0.1875,
  middle 0.15, frosting 0.0825 — 75% of the first heights, Igor — gaps 0.022, camera target y 0.24; the same base / middle / frosting metaphor as the tiers) cut as a 52° sector of r 1.15, turned to a
  three-quarter view (tip front-left, crust right and back), **white lines on every edge** (top and bottom outline of each layer, the three
  vertical corners), dotted lines on the crust, a swag line with beads on the frosting's crust and the **whipped cream, cherry and stem of
  Igor's 3D model `0016.obj`**, taken as they are (materials `01`, `09-cherry` and the small `03-coffee` piece), in glass, scale 0.31,
  faint edge lines. The meshes live in `js/cake-3d-cream.js` (uint16-quantized positions + triangle indices, base64; regenerate from an
  OBJ with `python3 cake/tools/obj-to-cream.py model.obj cake/js/cake-3d-cream.js`) — `make-version.py` loads it only on pages whose hero is `cake-3d-slice`. Without it the hero
  falls back to the procedural screw-tip swirl.
- **Not animated**: the scene holds still. It turns with the mouse (gyroscope on phones); hovering a layer lifts it, hovering the dollop makes it
  bounce and turn once. Fixed camera (el 27°, zoom 1.6, look-at 0.3); the hero's 1.4 view scale doesn't apply.

## WebP exports (index thumbnails)

`cake/versions/<slug>/webp/<slot>.webp` holds every illustration as its page shows it, at 2x (1078 px wide), animated where the
slot moves (15 fps, loops): the original PNGs as stills, the evolved-video chapters converted from their MP4s, the WebGL slots
captured frame by frame from the running page (the glass-3d hero loop, the three steps; the shortlist and the slice hero are stills —
they only move on hover or with a light ambient spin). The root index uses these files as its thumbnails (the template card was
removed from the index). Regenerate everything with `bash cake/tools/export-webp.sh` (needs ffmpeg with libwebp, python3 + Pillow,
node + playwright; `cake/tools/capture-webgl.js` drives each WebGL timeline and reads the canvas). The glass-3d hero WebP is ~9 MB.
