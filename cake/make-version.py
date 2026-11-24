#!/usr/bin/env python3
"""Cake — illustration versions.

Every version is a full copy of the template page (cake/index.html) with its own
illustration assets, in cake/versions/<slug>/. The shared site CSS, JS and fonts
stay in cake/ and are referenced from the copy (../../css, ../../js), so a version
only carries what is different: its page and its img/ folder.

Usage (run from the celonis_cake folder):

  python3 cake/make-version.py new <slug> "<Label>" "<one-line description>"
      Copy the current template into cake/versions/<slug>/. Its five illustration
      slots point at cake/versions/<slug>/img/<slot>.<ext>, seeded with the original
      PNGs so the page works at once; replace those files with the new assets.
      Video slots: put <slot>.mp4 (and <slot>.jpg as its poster) in img/ BEFORE
      running `new` (or re-run with --force). Those slots become muted looping
      <video>s, and the page also loads css/cake-video.css + js/cake-video.js
      (with the shared tuner-ui panel, key T). A slot with an .mp4 is not seeded.
      WebGL slots: list them in version.json BEFORE running `new` (or --force), e.g.
      "webgl": {"hero": "cake-3d", "step-1": "cake-3d-light"}. Those slots become a
      <canvas> rendered by js/cake-3d.js (glass cake, Three.js) with its tuner (key T);
      img/<slot>.png stays as the no-WebGL fallback. "cake-3d-light" = the same scene
      inverted for white modules, looping that slot's fragment of the hero timeline.
      "classic", "classic-light" scenes (version classic-3d) use js/cake-3d-classic.js instead:
      the four original drawings rebuilt in 3D.
      Hero: "hero": "m35" in version.json swaps the M15 secondary hero for the M35
      detail page hero (site block detail-page-hero + css/cake-m35.css).
      Refuses to overwrite an existing version (add --force to re-copy the page;
      the img/ folder is never overwritten).

  The index lists versions by the optional "order" number in version.json
  (then date, then slug); `new` gives a new version the next free number.

  python3 cake/make-version.py index
      Rebuild the root index (celonis_cake/index.html) from every
      cake/versions/*/version.json. `new` runs this for you. Each version card shows
      cake/versions/<slug>/webp/<slot>.webp when it exists (falls back to img/).

WebP exports: cake/versions/<slug>/webp/<slot>.webp is each illustration as the page
shows it, at 2x (1078 px wide), animated where the slot moves (videos and WebGL
loops, 15 fps). Made with cake/tools/export-webp.sh — re-run it after changing a version.

Slots (in page order):
  hero        M15 secondary hero
  shortlist   M46 "What you need to know"
  step-1      M19 Step 1 — base layer
  step-2      M19 Step 2 — middle layer
  step-3      M19 Step 3 — frosting

Unofficial design prototype by Hanzo. Not an official page of the brand shown,
and not published or endorsed by them.
"""
import datetime, html, json, pathlib, re, shutil, sys

HERE = pathlib.Path(__file__).resolve().parent          # .../celonis_cake/cake
ROOT = HERE.parent                                       # .../celonis_cake
TEMPLATE = HERE / 'index.html'
VERSIONS = HERE / 'versions'
ORIGINALS = ROOT / 'illustrations' / 'original'

SLOTS = ['hero', 'shortlist', 'step-1', 'step-2', 'step-3']
# which original PNG seeds each slot (same choice as the template)
SEED = {'hero': 1, 'shortlist': 1, 'step-1': 2, 'step-2': 3, 'step-3': 4}


VIDEO_CSS = ['tuner-ui.css?v=1', 'cake-video.css?v=2']
VIDEO_JS = ['tuner-ui.js?v=4', 'cake-video.js?v=1']


def videoize(h, imgdir):
    """Swap every slot that has img/<slot>.mp4 for a muted looping <video>."""
    vids = [s for s in SLOTS if (imgdir / f'{s}.mp4').exists()]
    if not vids:
        return h
    for s in vids:
        pat = re.compile(r'(<picture>)?<img ([^>]*?)src="img/' + re.escape(s) + r'\.png" data-slot="'
                         + re.escape(s) + r'"([^>]*?)/?>(</picture>)?')
        def rep(m, s=s):
            attrs = m.group(2) + ' ' + m.group(3)
            get = lambda k: (re.search(k + r'="([^"]*)"', attrs) or [None, ''])[1]
            alt = get('alt').replace('Line illustration', 'Animated line illustration', 1)
            poster = f' poster="img/{s}.jpg"' if (imgdir / f'{s}.jpg').exists() else ''
            return (f'<video class="cake-video" src="img/{s}.mp4"{poster} width="{get("width")}" '
                    f'height="{get("height")}" muted loop playsinline autoplay preload="metadata" '
                    f'role="img" aria-label="{alt}" data-slot="{s}"></video>')
        h, n = pat.subn(rep, h)
        if n != 1:
            sys.exit(f'Video slot {s}: expected 1 <img>, found {n}.')
    links = ''.join(f'<link href="../../css/{c}" rel="stylesheet"/>\n' for c in VIDEO_CSS)
    h = h.replace('</head>', links + '</head>', 1)
    scripts = ''.join(f'<script src="../../js/{j}"></script>\n' for j in VIDEO_JS)
    h, n = re.subn(r'(<script src="\.\./\.\./js/cake\.js[^"]*"></script>\n)', lambda m: m.group(1) + scripts, h, count=1)
    if n != 1:
        sys.exit('Could not find cake.js to load the video scripts after it.')
    return h


WEBGL_CSS = ['tuner-ui.css?v=1', 'cake-3d.css?v=3']
CLASSIC_JS = 'cake-3d-classic.js?v=3'
WEBGL_JS = ['tilt-parallax.js?v=1', 'anime.umd.min.js?v=1', 'three.min.js?v=1', 'three-post.js?v=1',
            'tuner-ui.js?v=4', 'cake-3d.js?v=27', 'cake-3d-tuner.js?v=27']


def webglize(h, webgl):
    """Swap every slot listed in version.json "webgl" for a <canvas> stage."""
    if not webgl:
        return h
    for s, scene in webgl.items():
        if s not in SLOTS:
            sys.exit(f'WebGL slot {s}: unknown slot.')
        pat = re.compile(r'(<picture>)?<img ([^>]*?)src="img/' + re.escape(s) + r'\.png" data-slot="'
                         + re.escape(s) + r'"([^>]*?)/?>(</picture>)?')
        def rep(m, s=s, scene=scene):
            attrs = m.group(2) + ' ' + m.group(3)
            alt = (re.search(r'alt="([^"]*)"', attrs) or [None, ''])[1]
            alt3d = alt.replace('Line illustration', 'Animated 3D glass illustration', 1)
            light = ' cake-3d-light' if 'light' in scene else ''
            return (f'<figure class="cake-3d-stage{light}" data-slot="{s}" data-scene="{scene}">'
                    f'<canvas class="cake-3d-canvas" role="img" aria-label="{alt3d}"></canvas>'
                    f'<img class="cake-3d-fallback" src="img/{s}.png" alt="{alt}"/></figure>')
        h, n = pat.subn(rep, h)
        if n != 1:
            sys.exit(f'WebGL slot {s}: expected 1 <img>, found {n}.')
    links = ''.join(f'<link href="../../css/{c}" rel="stylesheet"/>\n' for c in WEBGL_CSS if c not in h)
    h = h.replace('</head>', links + '</head>', 1)
    js = list(WEBGL_JS)
    if any(v.startswith('classic') for v in webgl.values()):   # the original drawings in 3D (version classic-3d)
        js = [CLASSIC_JS if j.startswith('cake-3d.js') else j for j in js]
    if 'cake-3d-slice' in webgl.values():                 # the slice hero's cream and cherry (from Igor's 0016.obj)
        js.insert(js.index(next(j for j in js if j.startswith('cake-3d.js'))), 'cake-3d-cream.js?v=1')
    scripts = ''.join(f'<script src="../../js/{j}"></script>\n' for j in js
                      if f'js/{j.split("?")[0]}' not in h)
    h, n = re.subn(r'(<script src="\.\./\.\./js/cake\.js[^"]*"></script>\n)', lambda m: m.group(1) + scripts, h, count=1)
    if n != 1:
        sys.exit('Could not find cake.js to load the WebGL scripts after it.')
    return h


# M35 · Detail page hero (version.json "hero": "m35"): the site's `detail-page-hero` block in place of the
# M15 secondary hero. Markup from celonistvibecoding experiments/3d-book, adapted to the Figma (FY27 New pages,
# node 6334:1234): grey overtitle, "English" label, Share in, two buttons, 3:2 media slot, body copy + rating.
M35_HTML = """<!-- M35 · Detail page hero — the site's own `detail-page-hero` block (markup as in celonistvibecoding experiments/3d-book) -->
<div class="section detail-page-hero-container" data-module="M35-Detail-page-hero" id="top">
<div class="detail-page-hero-wrapper dark-base-theme">
<div class="detail-page-hero block dark-base-theme no-back-button" data-block-name="detail-page-hero" data-block-status="loaded">
<div>
<div class="labels-container dark-secondary-theme"><div class="label"><span class="icon icon-icon-globe svg-icon"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><use href="#icon-globe"></use></svg></span><span>English</span></div></div>
<div class="detail-page-hero-title-and-links"><div class="titles-container"><p class="overtitle">The BEST</p><h1 class="title">Enterprise AI Transformation Recipe</h1></div>
%LINKS%</div>
<div class="detail-page-hero-media-container cake-media-invert">%MEDIA%</div>
<p class="white-square square-l detail-text-content">Looking for a foolproof Enterprise AI transformation recipe your C-suite will love? You’ve come to the right place! We’re serving up old-fashioned flavor, mom-and-pop charm, and absolutely no skimping on the good stuff.<span class="cake-hero-rating"><span class="stars" aria-hidden="true">★★★★★</span> 5|1,401 ratings</span></p>
%LINKS%</div>
</div>
</div>
</div>
"""
M35_LINKS = ('<div class="detail-page-hero-links-area">'
             '<p class="social-links-container"><span>Share in</span><a href="#">Linkedin</a><a href="#">X</a><a href="#">Facebook</a></p>'
             '<div class="buttons-row"><p class="button-container"><a class="button" href="#ingredients" role="button"><span>Ingredients</span></a></p>'
             '<p class="button-container"><a class="button secondary" href="#method" role="button"><span>Method</span></a></p></div></div>\n')


def m35_hero(h):
    """Swap the M15 secondary hero for the M35 detail page hero (keeps the hero's illustration <img>)."""
    a = h.find('<!-- M15 ·'); b = h.find('<!-- M03 ·')
    if a < 0 or b < a:
        sys.exit('M35 hero: could not find the M15 block.')
    m = re.search(r'<picture><img [^>]*src="img/cake-1\.png"[^>]*/></picture>', h[a:b])
    if not m:
        sys.exit('M35 hero: could not find the hero illustration.')
    block = M35_HTML.replace('%LINKS%', M35_LINKS).replace('%MEDIA%', m.group(0))
    h = h[:a] + block + h[b:]
    h = h.replace('<link href="css/secondary-hero.css" rel="stylesheet"/>',
                  '<link href="css/detail-page-hero.css" rel="stylesheet"/>', 1)
    return h.replace('</head>', '<link href="css/cake-m35.css?v=1" rel="stylesheet"/>\n</head>', 1)


def page_from_template(slug, label, imgdir, webgl=None, hero=None):
    h = TEMPLATE.read_text(encoding='utf-8')
    if hero == 'm35':
        h = m35_hero(h)
    # shared assets live two levels up
    h = re.sub(r'(href|src)="(css|js|fonts)/', r'\1="../../\2/', h)
    # the template's images, in page order: cake-1 (hero), cake-1 (shortlist), cake-2, cake-3, cake-4
    found = re.findall(r'src="img/cake-\d\.png"', h)
    if len(found) != len(SLOTS):
        sys.exit(f'Expected {len(SLOTS)} illustration slots in the template, found {len(found)}.')
    it = iter(SLOTS)
    def slot(_m):
        s = next(it)
        return f'src="img/{s}.png" data-slot="{s}"'
    h = re.sub(r'src="img/cake-\d\.png"', slot, h)
    h = re.sub(r'<title>[^<]*</title>',
               f'<title>Vibecoding prototype - Enterprise AI recipe page, {html.escape(label)} (unofficial)</title>', h)
    h = h.replace('<html lang="en">', f'<html lang="en" data-cake-version="{slug}">', 1)
    return webglize(videoize(h, imgdir), webgl)


def cmd_new(argv):
    force = '--force' in argv
    argv = [a for a in argv if a != '--force']
    if len(argv) < 2:
        sys.exit(__doc__)
    slug, label = argv[0], argv[1]
    desc = argv[2] if len(argv) > 2 else ''
    if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', slug):
        sys.exit('Slug must be kebab-case, e.g. svg-line-draw')
    d = VERSIONS / slug
    if (d / 'index.html').exists() and not force:
        sys.exit(f'{d} already exists (use --force to re-copy the page; img/ is never overwritten).')
    (d / 'img').mkdir(parents=True, exist_ok=True)
    for s in SLOTS:
        dst = d / 'img' / f'{s}.png'
        if not any((d / 'img').glob(f'{s}.*')):
            shutil.copyfile(ORIGINALS / f'CEL1269 CCM Cookbook_{SEED[s]}.png', dst)
    meta = d / 'version.json'
    data = json.loads(meta.read_text()) if meta.exists() else {}
    (d / 'index.html').write_text(page_from_template(slug, label, d / 'img', data.get('webgl'), data.get('hero')), encoding='utf-8')
    if 'order' not in data:
        data['order'] = 1 + max([json.loads(q.read_text()).get('order', 0)
                                 for q in VERSIONS.glob('*/version.json') if q != meta] or [0])
    data.update({'slug': slug, 'label': label, 'description': desc or data.get('description', ''),
                 'date': data.get('date') or datetime.date.today().isoformat()})
    meta.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print('created', d.relative_to(ROOT))
    cmd_index()


INDEX = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Vibecoding prototypes — Enterprise AI recipe, illustration versions (unofficial)</title>
<meta name="description" content="Unofficial design prototypes by Hanzo. Not official pages of the brand shown, and not published or endorsed by them.">
<link rel="stylesheet" href="cake/css/poppins.css">
<style>
  :root { --bg:#000; --panel:#101010; --line:#232323; --text:#f5f5f5; --muted:#9a9a9a; --accent:#7CF77E; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:Poppins, ui-sans-serif, system-ui, sans-serif; min-height:100vh; display:flex; flex-direction:column; }
  header, .wrap, main { max-width:980px; margin:0 auto; width:100%; }
  header { padding:48px 24px 8px; }
  .brand { font-size:26px; font-weight:500; letter-spacing:.5px; }
  .brand small { display:block; color:var(--muted); font-size:14px; font-weight:300; margin-top:6px; }
  .wrap { padding:8px 24px 0; }
  .disclaimer { margin:0 0 4px; padding:14px 24px; border:1px solid #3a3a3a; border-left:3px solid var(--accent); border-radius:10px; background:#0e0e0e; color:#bdbdbd; font-size:13px; line-height:1.6; font-weight:300; }
  .disclaimer strong { color:var(--accent); font-weight:600; }
  main { padding:24px; display:grid; gap:20px; }
  .exp { position:relative; border:1px solid var(--line); background:var(--panel); border-radius:14px; padding:26px 28px; transition:border-color .2s ease, transform .2s ease; }
  .exp:hover { border-color:#3a3a3a; transform:translateY(-2px); }
  .exp .date { position:absolute; top:22px; right:26px; padding:5px 11px; border:1px solid #2b2b2b; border-radius:999px; background:#050505; color:#8a8a8a; font-size:11.5px; letter-spacing:.6px; white-space:nowrap; }
  @media (max-width:560px) { .exp .date { position:static; display:inline-block; margin-bottom:10px; } }
  .exp .num { color:var(--accent); font-size:12px; font-weight:600; letter-spacing:2px; text-transform:uppercase; }
  .exp h2 { margin:8px 0 6px; font-size:22px; font-weight:500; }
  .exp p { margin:0 0 18px; color:var(--muted); font-size:14.5px; line-height:1.55; font-weight:300; }
  .thumbs { display:grid; grid-template-columns:repeat(5, minmax(0,1fr)); gap:8px; margin:0 0 18px; }
  .thumbs figure { margin:0; background:#fff; border-radius:6px; aspect-ratio:4/3; overflow:hidden; }
  .thumbs img, .thumbs video { width:100%; height:100%; object-fit:contain; display:block; }
  .thumbs video { object-fit:cover; }
  .thumbs figcaption { display:none; }
  .links { display:flex; flex-wrap:wrap; gap:10px; }
  .links a { display:inline-block; padding:9px 18px; border-radius:8px; background:var(--accent); color:#000; text-decoration:none; font-size:14px; font-weight:500; }
  .links a:hover { filter:brightness(1.12); }
  .links a.alt { background:transparent; color:var(--text); border:1px solid var(--line); }
  .links a.alt:hover { border-color:var(--accent); color:var(--accent); }
  footer { margin-top:auto; padding:32px 24px 40px; text-align:center; color:#666; font-size:12.5px; font-weight:300; }
</style>
</head>
<body>
<header>
  <div class="brand">Enterprise AI recipe <span style="color:var(--accent)">/ illustration versions</span>
    <small>Replacement for Process Intelligence 101 — one template, several sets of illustrations</small>
  </div>
</header>
<div class="wrap">
  <p class="disclaimer"><strong>Unofficial prototype.</strong> Front-end design experiments by Hanzo exploring
  improvements to a client website. This is not an official page of the brand shown, it is not published or
  endorsed by them, and it is not a working product. Every outbound link is disabled, no data is collected and
  no third-party scripts run. All trademarks belong to their respective owners.</p>
</div>
<main>
%VERSIONS%
</main>
<footer>Generated by <code>cake/make-version.py index</code> — do not edit by hand.</footer>
</body>
</html>
'''


def cmd_index():
    cards = []
    metas = sorted((json.loads(p.read_text()) for p in VERSIONS.glob('*/version.json')),
                   key=lambda m: (m.get('order', 999), m.get('date', ''), m.get('slug', '')))
    for n, m in enumerate(metas, 1):
        slug = m['slug']
        d = VERSIONS / slug / 'img'
        thumbs = []
        for s in SLOTS:
            # thumbs: the version's WebP of the slot (2x, animated where the slot moves) — see "webp" in the docstring
            w = VERSIONS / slug / 'webp' / f'{s}.webp'
            if w.exists():
                thumbs.append(f'<figure><img src="cake/versions/{slug}/webp/{s}.webp" alt="" loading="lazy">'
                              f'<figcaption>{s}</figcaption></figure>')
                continue
            files = {f.suffix.lower(): f for f in d.glob(f'{s}.*')}
            still = files.get('.jpg') or files.get('.png') or files.get('.webp')
            if still:
                thumbs.append(f'<figure><img src="cake/versions/{slug}/img/{still.name}" alt="" loading="lazy">'
                              f'<figcaption>{s}</figcaption></figure>')
        date = datetime.date.fromisoformat(m['date']).strftime('%b %-d, %Y') if m.get('date') else ''
        cards.append(f'''  <article class="exp">
    <span class="date">{date}</span>
    <div class="num">Version {n}</div>
    <h2>{html.escape(m['label'])}</h2>
    <p>{html.escape(m.get('description', ''))}</p>
    <div class="thumbs">{''.join(thumbs)}</div>
    <div class="links"><a href="cake/versions/{slug}/index.html" target="_blank" rel="noopener">Open version</a></div>
  </article>''')
    (ROOT / 'index.html').write_text(INDEX.replace('%VERSIONS%', '\n'.join(cards)), encoding='utf-8')
    print('index:', len(cards), 'version(s) ->', (ROOT / 'index.html').relative_to(ROOT))


if __name__ == '__main__':
    if len(sys.argv) < 2 or sys.argv[1] not in ('new', 'index'):
        sys.exit(__doc__)
    cmd_new(sys.argv[2:]) if sys.argv[1] == 'new' else cmd_index()
