/* =========================================================================
   Cake — the ORIGINAL drawings in 3D (version "classic-3d").

   Igor, 2026-11-24: "faithful to the illustrations of example 1, animated
   like example 4". The four line drawings of illustrations/original (CEL1269
   CCM Cookbook 1–4) are rebuilt in 3D on their own measurements, in the
   language of glass-3d / glass-3d-slice:
     hero (dark)   drawing 1 in black and white: white lines and beads, a flat
                   black fill that only hides what is behind (no glass) — still,
                   turns with the mouse / gyroscope, hover lifts the board or a
                   tier, hover on the star spins it; the dashed drips flow and
                   two beads slide down them
     shortlist     the same cake inverted (black lines, solid white fill that
                   only hides what is behind: hidden-line drawing), held
     step-1        drawing 2 (data frame): rings grow both ways from the left
                   with beads on their open ends, rays shoot out bead-first, the
                   frame closes; hold; then it UNDRAWS in sequence
     step-2        drawing 3: the three front half-rims go down one by one and
                   their dashed drips run; then each layer drips off (never back
                   up) and undraws, from the top
     step-3        drawing 4: board, tier rising, rim, star; the frosting lines
                   fall onto the top (fading upwards, beads riding them) and the
                   trails empty downwards; then everything undraws in sequence
   The renderer, glass pipeline, screen-space lines, beads, post chain,
   inversion and tuner knobs (window.CAKE3D, key T) are those of js/cake-3d.js
   (copied, so glass-3d and glass-3d-slice stay untouched).
   Three.js r147 + anime.js v4.
   ========================================================================= */
(function () {
  'use strict';
  if (!window.THREE) return;
  var THREE = window.THREE;

  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- deterministic RNG ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- LIVE KNOBS: window.CAKE3D (the tuner writes here) ---------- */
  var TUNE = window.CAKE3D = {
    // glass — Igor's settings, 2026-11-19 (transmission, refract, frost, pieceMag, topDarken,
    // body, pre, bloom and black floor retuned from the Data Core defaults)
    tint:        { r: 1.8, g: 1.8, b: 1.8 },
    transmission: 0.14,
    transmissionSpread: 0.14,
    refract:     0.89,
    frost:       0.66,
    frostRadius: 0.98,
    pieceMag:    0.87,
    pieceShift:  0.11,
    fresnel:     0.44,
    topClear:    0.92,
    topDarken:   0.25,
    edgeWhite:   0.44,
    skyTop:      '#eef4ff',
    skyHorizon:  '#8e9aad',
    iri:         0.08,
    body:        0.65,
    rim:         1.16,
    pre:         0.15,
    backdrop:    '#e6ecf5',
    bloom:       { strength: 0.1, radius: 0.1, threshold: 0.83 },
    blackFloor:  0.045,   // crushes the bloom haze (see the floor pass)
    // line art (px = CSS pixels, constant at any zoom)
    lines:       { px: 1.2, finePx: 0.85, opacity: 0.92, silhouettes: 1, backArc: 1 },   // backArc < 1 dims the far half of rims
    grid:        { opacity: 0.28, dash: 0.022 },
    drips:       { opacity: 0.8, flow: 0.12, dash: 0.045, duty: 0.55 },
    dots:        { px: 5, orbit: 0.12 },
    frosting:    { lines: 12, opacity: 0.85, rate: 0.55 },
    // motion and framing
    motion:      { speed: 1, parallax: 1 },
    view:        { scale: 1, starAngle: 45 },
    quality:     { fxaa: 0, msaa: 4, dprMax: 2, preRes: 1 },
    copy: function () {
      var out = JSON.stringify(TUNE, function (k, v) { return typeof v === 'function' ? undefined : v; }, 2);
      console.log(out);
      return out;
    }
  };

  var instances = window.__cake3dAll = [];

  function createCake(canvas, INDEX) {
  var stage = canvas.parentElement;
  var SLOT = stage.getAttribute('data-slot') || 'hero';
  // light: the same scene inverted at the end of the post chain (white page, dark lines, solid white fill)
  var LIGHT = /light/.test(stage.getAttribute('data-scene') || '');
  // flat: pure black and white, as in the drawings (Igor, 2026-11-24: the hero cake in black and white) —
  // no glass: a flat fill that only hides what is behind it, white lines and beads; the light slots invert it
  var FLAT = true;

  function fail() { stage.classList.add('cake-3d-off'); }
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  } catch (e) { fail(); return; }
  if (!renderer.getContext()) { fail(); return; }
  stage.classList.add('cake-3d-on');

  var rnd = mulberry32(20261124);
  var state = { camEl: 23.4 };

  /* ---------- renderer / scene / camera ---------- */
  renderer.setClearColor(0x000000, 1);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  var scene = new THREE.Scene();
  var root = new THREE.Group();          // parallax rotates this group
  scene.add(root);

  // orthographic camera on +Z; elevation goes from straight above (the video's
  // flat opening) down to the line art's ~23°
  var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  var CAM_R = 20, VIEW = new THREE.Vector3(), lookY = 0;
  function placeCamera() {
    var el = Math.min(89.5, state.camEl) * Math.PI / 180;
    camera.position.set(0, lookY + CAM_R * Math.sin(el), CAM_R * Math.cos(el));
    camera.up.set(0, 1, 0);
    camera.lookAt(0, lookY, 0);
    VIEW.set(0, Math.sin(el), Math.cos(el));
  }
  placeCamera();

  /* ---------- environment: banded softboxes (Data Core) ---------- */
  function makeEnvTexture() {
    var c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    var g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#191b1f'); grad.addColorStop(0.55, '#0a0b0d'); grad.addColorStop(1, '#020203');
    g.fillStyle = grad; g.fillRect(0, 0, 1024, 512);
    function stripe(y, h, a, x0, x1) {
      var s = g.createLinearGradient(0, y - h, 0, y + h);
      s.addColorStop(0, 'rgba(255,255,255,0)');
      s.addColorStop(0.5, 'rgba(255,255,255,' + a + ')');
      s.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = s; g.fillRect(x0 || 0, y - h, (x1 || 1024) - (x0 || 0), h * 2);
    }
    stripe(78, 34, 0.95); stripe(78, 34, 0.9, 96, 480); stripe(168, 30, 0.55, 520, 1010);
    var rg = g.createRadialGradient(240, 66, 0, 240, 66, 110);
    rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(240, 66, 110, 0, 7); g.fill();
    var tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }
  var pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(makeEnvTexture()).texture;
  var key = new THREE.DirectionalLight(0xffffff, 0.35); key.position.set(-3, 6, 2); scene.add(key);
  scene.add(new THREE.AmbientLight(0xffffff, 0.05));
  var underLight = new THREE.PointLight(0xf4f7ff, 1.1, 9, 1.6);
  underLight.position.set(0, -2.4, 0); scene.add(underLight);

  /* ---------- studio backdrop + pre-pass + frost (Data Core §8) ---------- */
  function makeBackdropTexture() {
    var c = document.createElement('canvas'); c.width = 512; c.height = 512;
    var g = c.getContext('2d');
    var grad = g.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#33373d'); grad.addColorStop(0.45, '#1c1f24');
    grad.addColorStop(0.8, '#0d0f12'); grad.addColorStop(1, '#060708');
    g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
    function blob(x, y, r, col, a) {
      var rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, 'rgba(' + col + ',' + a + ')'); rg.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    blob(170, 150, 170, '245,248,252', 0.95);
    blob(410, 330, 150, '225,230,236', 0.35);
    blob(256, 470, 260, '10,11,13', 0.8);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }
  var rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
  var backRT = new THREE.WebGLRenderTarget(2, 2, rtOpts);
  var blurRT1 = new THREE.WebGLRenderTarget(2, 2, rtOpts);
  var blurRT2 = new THREE.WebGLRenderTarget(2, 2, rtOpts);
  var bgQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: makeBackdropTexture(), depthWrite: false }));
  bgQuad.visible = false;
  scene.add(bgQuad);
  var glassMeshes = [];

  var blurScene = new THREE.Scene();
  var blurCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  var blurMat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) },
                uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) }, uRadius: { value: 1.2 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: [
      'uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uTexel; uniform float uRadius; varying vec2 vUv;',
      'void main() {',
      '  vec2 st = uDir * uTexel * uRadius;',
      '  vec3 c = texture2D(tDiffuse, vUv).rgb * 0.227027;',
      '  c += (texture2D(tDiffuse, vUv + st).rgb + texture2D(tDiffuse, vUv - st).rgb) * 0.1945946;',
      '  c += (texture2D(tDiffuse, vUv + st * 2.0).rgb + texture2D(tDiffuse, vUv - st * 2.0).rgb) * 0.1216216;',
      '  c += (texture2D(tDiffuse, vUv + st * 3.0).rgb + texture2D(tDiffuse, vUv - st * 3.0).rgb) * 0.054054;',
      '  c += (texture2D(tDiffuse, vUv + st * 4.0).rgb + texture2D(tDiffuse, vUv - st * 4.0).rgb) * 0.016216;',
      '  gl_FragColor = vec4(c, 1.0);',
      '}'].join('\n')
  });
  blurScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blurMat));
  function blurPass(src, dst, dx, dy) {
    blurMat.uniforms.tDiffuse.value = src.texture;
    blurMat.uniforms.uDir.value.set(dx, dy);
    renderer.setRenderTarget(dst);
    renderer.render(blurScene, blurCam);
  }

  var GLASS_VERT = [
    'varying vec3 vN; varying vec3 vWN; varying vec2 vScreenUv;',
    'void main() {',
    '  vN = normalize(normalMatrix * normal);',
    '  vWN = normalize(mat3(modelMatrix) * normal);',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '  vScreenUv = gl_Position.xy / gl_Position.w * 0.5 + 0.5;',
    '}'].join('\n');
  var GLASS_FRAG = [
    'uniform sampler2D uBackdrop; uniform sampler2D uBackdropBlur; uniform float uFrost;',
    'uniform vec2 uCenter; uniform vec2 uOffset; uniform float uMag; uniform float uShift;',
    'uniform vec3 uBody; uniform float uTransmission; uniform float uRefract; uniform float uSeed;',
    'uniform float uIri; uniform float uFres; uniform float uTopClear; uniform float uTopDarken;',
    'uniform float uEdgeWhite; uniform vec3 uSkyTop; uniform vec3 uSkyHz; uniform vec3 uTint; uniform float uFade; uniform float uPre; uniform float uSolid;',
    'varying vec3 vN; varying vec3 vWN; varying vec2 vScreenUv;',
    'void main() {',
    '  vec3 N = normalize(vN);',
    '  float up = clamp(normalize(vWN).y, 0.0, 1.0);',
    '  vec2 rel = vScreenUv - uCenter;',
    '  vec2 buv = uCenter + rel * uMag + N.xy * uRefract + uOffset * uShift;',
    // the pre-pass covers MORE than the screen (uPre = 1 / margin), so a lens near the canvas
    // edge still finds real image; beyond that, mirror instead of smearing the edge texels
    '  vec2 suv = (buv - 0.5) * uPre + 0.5;',
    '  suv = 1.0 - abs(1.0 - abs(suv));',
    '  vec3 trans = mix(texture2D(uBackdrop, suv).rgb, texture2D(uBackdropBlur, suv).rgb, uFrost);',
    '  float topness = smoothstep(0.55, 0.95, up);',
    '  vec3 milky = mix(uBody, trans, uTransmission);',
    '  vec3 seeThru = trans * uTopDarken + uBody * 0.12;',
    '  vec3 col = mix(milky, seeThru, topness * uTopClear);',
    '  float ndv = abs(N.z);',
    '  float fres = pow(1.0 - ndv, 3.0);',
    '  vec3 sky = mix(uSkyHz, uSkyTop, clamp(N.y * 0.5 + 0.5, 0.0, 1.0));',
    '  col = mix(col, sky, fres * uFres * (1.0 - 0.7 * topness * uTopClear));',
    '  float bevel = smoothstep(0.02, 0.45, up) * (1.0 - topness);',
    '  col += sky * bevel * uEdgeWhite;',
    '  float ph = N.x * 1.7 + N.y * 2.3 + N.z * 1.1 + uSeed * 6.2831;',
    '  vec3 iri = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67)) + ph * 3.0);',
    '  col += iri * fres * uIri;',
    '  col *= uTint;',
    '  gl_FragColor = vec4(pow(col * uFade, vec3(2.2)), 1.0);',   // uFade: 0 = gone (black on black)
    // uSolid (white modules): no glass at all — a flat fill (black here, white once inverted) that only hides what is behind
    '  if (uSolid > 0.5) gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
    '}'].join('\n');

  var glassMats = [];
  function glassMat(seed, g) {
    var tint = 0.055 + 0.075 * seed + 0.055 * g;
    var body = new THREE.Color(tint * 0.95, tint * 0.98, tint * 1.05);
    var m = new THREE.ShaderMaterial({
      vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG,
      uniforms: {
        uBackdrop: { value: backRT.texture }, uBackdropBlur: { value: blurRT2.texture },
        uFrost: { value: 0.6 }, uCenter: { value: new THREE.Vector2(0.5, 0.5) },
        uOffset: { value: new THREE.Vector2(Math.sin(seed * 78.233) * 0.03, Math.sin(seed * 127.1) * 0.03) },
        uMag: { value: 0.9 }, uShift: { value: 0.5 }, uBody: { value: body.clone() },
        uTransmission: { value: 0.75 }, uRefract: { value: 0.13 }, uSeed: { value: seed },
        uIri: { value: 0.1 }, uFres: { value: 0.85 }, uTopClear: { value: 0.85 }, uTopDarken: { value: 0.9 },
        uEdgeWhite: { value: 0.35 }, uSkyTop: { value: new THREE.Color('#eef4ff') },
        uSkyHz: { value: new THREE.Color('#8e9aad') }, uTint: { value: new THREE.Color(1, 1, 1) },
        uFade: { value: 1 }, uPre: { value: 1 }, uSolid: { value: 0 }
      }
    });
    m.userData.baseRefract = 0.13 + 0.06 * seed;
    m.userData.baseBody = body;
    m.userData.preMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(tint * 0.55, tint * 0.58, tint * 0.65) });
    m.userData.basePre = m.userData.preMat.color.clone();
    glassMats.push(m);
    return m;
  }


  /* ---------- solids ---------- */
  var BEV = 0.007;          // tier bevel: small, so rim, side lines and base meet within half a pixel (was 0.016: hooks at the corners)
  function extrude(shape, depth, bevel, segs) {
    var geo = new THREE.ExtrudeGeometry(shape, {
      depth: depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
      bevelSegments: 3, curveSegments: segs || 12
    });
    geo.rotateX(-Math.PI / 2);          // shape on XZ, height on +Y
    geo.computeBoundingBox();
    geo.translate(0, -geo.boundingBox.min.y, 0);   // bottom at y = 0
    return geo;
  }
  // segments per circle: at 24 the glass was a 24-gon and drifted 1–2 px off the (truly round) line rings
  var CIRC = 64;          // ExtrudeGeometry doubles it for arcs → 128 points per circle
  function circleShape(r) {
    // start/end seam at the back (shape +y → world −z): at angle 0 it sat on the right-hand silhouette,
    // where the bevel's normals jump and drew a small bright wedge
    var s = new THREE.Shape(); s.absarc(0, 0, r, Math.PI / 2, Math.PI / 2 + Math.PI * 2, false); return s;
  }
  // the video's star: four tips on the diagonals, deeply concave sides
  function starShape(R, inner) {
    var s = new THREE.Shape(), pts = [];
    for (var i = 0; i < 4; i++) {
      var a = Math.PI / 4 + i * Math.PI / 2, b = a + Math.PI / 4;
      pts.push([Math.cos(a) * R, Math.sin(a) * R], [Math.cos(b) * R * inner, Math.sin(b) * R * inner]);
    }
    var n = pts.length, rr = 0.035 * R;
    function lerp(p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; }
    for (var k = 0; k < n; k++) {
      var p0 = pts[(k - 1 + n) % n], p1 = pts[k], p2 = pts[(k + 1) % n];
      if (k % 2 === 0) {
        var l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        var A = lerp(p1, p0, rr / l1), B = lerp(p1, p2, rr / l2);
        if (k === 0) s.moveTo(A[0], A[1]); else s.lineTo(A[0], A[1]);
        s.quadraticCurveTo(p1[0], p1[1], B[0], B[1]);
      } else s.lineTo(p1[0], p1[1]);
    }
    s.closePath();
    return s;
  }
  var edgeCache = new Map();
  function edgesFor(geo) {
    if (!edgeCache.has(geo)) edgeCache.set(geo, new THREE.EdgesGeometry(geo, 20));
    return edgeCache.get(geo);
  }
  function glassPiece(geo, seed, g, rimOp) {
    var mesh = new THREE.Mesh(geo, glassMat(seed, g));
    var rim = new THREE.LineSegments(edgesFor(geo),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: rimOp }));
    rim.userData.baseOp = rimOp;
    mesh.add(rim);
    mesh.userData.rim = rim;
    mesh.userData.fade = 1;
    glassMeshes.push(mesh);
    return mesh;
  }

  /* ---------- screen-space lines: constant pixel width, drawn on by progress ---------- */
  var RES = { value: new THREE.Vector2(1, 1) };     // half the canvas size in CSS px
  var BACK = { value: 1 };                           // opacity of the far half of rims (1 in the flat view)
  var LINE_V = [
    'attribute vec3 prev; attribute vec3 next; attribute float side; attribute float u; attribute float dist;',
    'uniform vec2 uRes; uniform float uWidth; uniform float uZBias;',
    'varying float vU; varying float vDist; varying float vFront;',
    'void main() {',
    // which side of its own centre the point is on, seen from the camera (+z):
    // the video draws the far half of a rim faint or not at all
    '  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz, wo = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;',
    '  vec2 dd = wp.xz - wo.xz; vFront = dd.y / max(length(dd), 1e-4);',
    '  mat4 mvp = projectionMatrix * modelViewMatrix;',
    '  vec4 c = mvp * vec4(position, 1.0);',
    '  vec2 cs = c.xy / c.w * uRes;',
    '  vec4 p = mvp * vec4(prev, 1.0); vec4 n = mvp * vec4(next, 1.0);',
    '  vec2 d1 = cs - p.xy / p.w * uRes, d2 = n.xy / n.w * uRes - cs;',
    '  vec2 dir = vec2(0.0);',
    '  if (dot(d1, d1) > 1e-8) dir += normalize(d1);',
    '  if (dot(d2, d2) > 1e-8) dir += normalize(d2);',
    '  dir = dot(dir, dir) > 1e-8 ? normalize(dir) : vec2(1.0, 0.0);',
    '  vec2 nrm = vec2(-dir.y, dir.x);',
    '  c.xy += nrm * side * uWidth * 0.5 / uRes * c.w;',
    // uZBias (white modules): lines on a surface must beat the flat fill they lie on — a hair toward the camera
    '  c.z -= uZBias * c.w;',
    '  gl_Position = c; vU = u; vDist = dist;',
    '}'].join('\n');
  var LINE_F = [
    'uniform float uOpacity; uniform float uProgress; uniform float uDash; uniform float uDuty;',
    'uniform float uSym; uniform float uBackOn; uniform float uBack; uniform float uEdgeFade; uniform float uStart; uniform float uDashOff;',
    'varying float vU; varying float vDist; varying float vFront;',
    'void main() {',
    // uSym: grows from its start point in BOTH directions (the video's rings and frame)
    '  float uu = uSym > 0.5 ? min(vU, 1.0 - vU) * 2.0 : vU;',
    '  if (uu > uProgress || uu < uStart || uOpacity <= 0.001) discard;',   // uStart: erased from its start (a drip running down)
    '  if (uDash > 0.0 && fract((vDist - uDashOff) / uDash) > uDuty) discard;',   // uDashOff: dashes flow along the line
    '  float w = uBackOn > 0.5 ? mix(uBack, 1.0, smoothstep(-0.12, 0.12, vFront)) : 1.0;',
    // uEdgeFade: lines on a cylinder wall fade as they turn toward the silhouette (no doubled edge)
    '  if (uEdgeFade > 0.5) w *= smoothstep(0.12, 0.45, vFront);',
    '  gl_FragColor = vec4(vec3(1.0), uOpacity * w);',
    '}'].join('\n');
  var lines = [];
  function makeLine(pts, o) {
    o = o || {};
    var closed = !!o.closed;
    if (closed) pts = pts.concat([pts[0]]);
    var n = pts.length, pos = [], prv = [], nxt = [], side = [], uu = [], dist = [], idx = [];
    var cum = [0];
    for (var i = 1; i < n; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    var total = cum[n - 1] || 1;
    for (var j = 0; j < n; j++) {
      var P = pts[j];
      var Pp = j > 0 ? pts[j - 1] : (closed ? pts[n - 2] : P);
      var Pn = j < n - 1 ? pts[j + 1] : (closed ? pts[1] : P);
      for (var s = -1; s <= 1; s += 2) {
        pos.push(P.x, P.y, P.z); prv.push(Pp.x, Pp.y, Pp.z); nxt.push(Pn.x, Pn.y, Pn.z);
        side.push(s); uu.push(cum[j] / total); dist.push(cum[j]);
      }
    }
    for (var k = 0; k < n - 1; k++) {
      var a = 2 * k; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('prev', new THREE.Float32BufferAttribute(prv, 3));
    g.setAttribute('next', new THREE.Float32BufferAttribute(nxt, 3));
    g.setAttribute('side', new THREE.Float32BufferAttribute(side, 1));
    g.setAttribute('u', new THREE.Float32BufferAttribute(uu, 1));
    g.setAttribute('dist', new THREE.Float32BufferAttribute(dist, 1));
    g.setIndex(idx);
    var m = new THREE.ShaderMaterial({
      vertexShader: LINE_V, fragmentShader: LINE_F, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uRes: RES, uZBias: { value: (LIGHT || FLAT) ? 0.0002 : 0 }, uWidth: { value: 2 }, uOpacity: { value: 1 }, uProgress: { value: 1 },
                  uDash: { value: o.dash || 0 }, uDuty: { value: o.duty || 0.5 },
                  uSym: { value: o.sym ? 1 : 0 }, uBackOn: { value: (o.back || o.frontOnly) ? 1 : 0 },
                  uBack: o.frontOnly ? { value: 0 } : BACK,   // frontOnly: the far half is never drawn
                  uEdgeFade: { value: o.edgeFade ? 1 : 0 }, uStart: { value: 0 }, uDashOff: { value: 0 } }
    });
    var mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.userData.fine = !!o.fine;
    mesh.userData.base = o.opacity === undefined ? 1 : o.opacity;
    lines.push(mesh);
    return mesh;
  }
  function setLine(l, progress, op) {
    var u = l.material.uniforms;
    u.uProgress.value = progress;
    // white modules: pure black lines (no grey levels), only the animation's own fades remain
    u.uOpacity.value = Math.max(0, op) * ((LIGHT || FLAT) ? 1 : l.userData.base * TUNE.lines.opacity);
    l.visible = progress > 0.001 && op > 0.002;
  }
  function circlePts(r, y, n, a0) {
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = (a0 || 0) + i / n * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
    }
    return pts;
  }

  // light beads (the drawing's dots): constant pixel size
  var dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true });
  var dotGeo = new THREE.SphereGeometry(1, 16, 10);
  var dotsAll = [];
  function makeDot(parent, x, y, z) {
    var m = new THREE.Mesh(dotGeo, dotMat.clone());
    m.position.set(x, y, z);
    parent.add(m);
    m.userData.k = 1;
    dotsAll.push(m);
    return m;
  }
  function setDot(d, k) { d.userData.k = Math.max(0, Math.min(1, k)); d.visible = d.userData.k > 0.01; }
  /* =======================================================================
     THE FOUR ORIGINAL DRAWINGS (illustrations/original, CEL1269 CCM Cookbook
     1–4), rebuilt in 3D on their own measurements. Units: the drawing's px
     divided by the radius of its widest ellipse; camera elevation from the
     ellipses' ry/rx (≈ 0.397 → 23.4°).
     ======================================================================= */
  var EL = 23.4, CE = Math.cos(EL * Math.PI / 180), SE = Math.sin(EL * Math.PI / 180);
  var fitPts = [];                      // what must fit in the canvas (see resize)
  var parts = {};                       // everything the render loop drives
  function V(x, y, z) { return new THREE.Vector3(x, y, z); }
  function fit() { for (var i = 0; i < arguments.length; i++) fitPts.push(arguments[i]); }
  function arcPts(r, y, a0, a1, n) {    // a: 0 = +x (right), π/2 = +z (toward the camera)
    var pts = [];
    for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; pts.push(V(Math.cos(a) * r, y, Math.sin(a) * r)); }
    return pts;
  }
  // the drawing's star: four rounded tips, straight sides into four inner corners
  function starOutline(tx, tz, ix, iz) {
    return [[tx, tz], [0, iz], [-tx, tz], [-ix, 0], [-tx, -tz], [0, -iz], [tx, -tz], [ix, 0]];
  }
  function starShapeOf(pts, round) {
    var s = new THREE.Shape(), n = pts.length;
    function lerp(p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; }
    for (var k = 0; k < n; k++) {
      var p0 = pts[(k - 1 + n) % n], p1 = pts[k], p2 = pts[(k + 1) % n];
      if (k % 2 === 0) {               // tips are rounded, like the drawing
        var l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        var A = lerp(p1, p0, round / l1), B = lerp(p1, p2, round / l2);
        if (k === 0) s.moveTo(A[0], A[1]); else s.lineTo(A[0], A[1]);
        s.quadraticCurveTo(p1[0], p1[1], B[0], B[1]);
      } else s.lineTo(p1[0], p1[1]);
    }
    s.closePath();
    return s;
  }
  // a flat glass star lying on y = 0 of its group (shape y → world −z, as in extrude())
  function makeStar(parent, tx, tz, ix, iz) {
    var P = starOutline(tx, tz, ix, iz), H = 0.022, R = 0.03 * Math.hypot(tx, tz);
    var mesh = glassPiece(extrude(starShapeOf(P, R), H - 0.012, 0.006, 6), 0.7, 0.6, 0.45);
    mesh.userData.isStar = true;
    parent.add(mesh);
    var line = makeLine(starShapeOf(P.map(function (p) { return [p[0] * 1.02, p[1] * 1.02]; }), R).getPoints(8).slice(0, -1)
      .map(function (p) { return V(p.x, H + 0.002, -p.y); }), { closed: true });
    parent.add(line);
    return { mesh: mesh, line: line, H: H };
  }
  // a glass tier: cylinder r × h on y = 0 of its group, rim line on top, silhouette pair (turned to the camera)
  function makeTier(parent, r, h, seed, g, o) {
    o = o || {};
    var grp = new THREE.Group(); parent.add(grp);
    var mesh = glassPiece(extrude(circleShape(r), h - 2 * BEV, BEV, CIRC), seed, g, 0.22);
    mesh.userData.tier = grp;
    grp.add(mesh);
    var rRim = r + 0.707 * (BEV + 0.001), yTop = h - 0.293 * BEV;
    var rim = makeLine(circlePts(rRim, yTop, 160, Math.PI), { closed: true, sym: true }); grp.add(rim);
    var sil = new THREE.Group(); grp.add(sil);
    var sl = [-1, 1].map(function (s) {
      var pts = [V(s * (r + BEV + 0.001), o.silFrom || 0, 0)];
      for (var k = 0; k <= 4; k++) { var a = Math.PI / 4 * (k / 4); pts.push(V(s * (r + Math.cos(a) * (BEV + 0.001)), h - BEV + Math.sin(a) * BEV, 0)); }
      var l = makeLine(pts); sil.add(l); return l;
    });
    grp.userData = { lift: 0, base: 0 };
    return { grp: grp, mesh: mesh, rim: rim, sil: sil, sl: sl, r: r, h: h, rRim: rRim, yTop: yTop };
  }
  // a glass board: thin disk, top at y = 0, one rim line (the drawing shows no thickness)
  function makeBoard(parent, r) {
    var grp = new THREE.Group(); parent.add(grp);
    var T = 0.02;
    var mesh = glassPiece(extrude(circleShape(r), T - 0.012, 0.006, CIRC), 0.34, 0.45, 0.2);
    mesh.position.y = -T; mesh.userData.tier = grp;
    grp.add(mesh);
    var rim = makeLine(circlePts(r + 0.005, -0.002, 200, Math.PI), { closed: true, sym: true }); grp.add(rim);
    grp.userData = { lift: 0, base: 0 };
    return { grp: grp, mesh: mesh, rim: rim, r: r };
  }
  // a vertical dashed drip from P down by len (drawn top → bottom; dashes flow down with uDashOff)
  function makeDrip(parent, P, len, dash) {
    var l = makeLine([P.clone(), V(P.x, P.y - len, P.z)], { fine: true, dash: dash || 0.034, duty: 0.6 });
    parent.add(l);
    return { l: l, P: P, len: len };
  }

  var SCENE = /step-1/.test(SLOT) && LIGHT ? 'frame' : /step-2/.test(SLOT) && LIGHT ? 'layers'
            : /step-3/.test(SLOT) && LIGHT ? 'frosting' : 'cake';
  var camEl = SCENE === 'frame' ? 89.5 : EL;
  var LOOP = 0;                          // light slots: loop length (ms); 0 = still (hero, shortlist)

  /* ---------- cake (drawing 1): the hero and the shortlist ----------
     board r 403 px; bottom tier r 309, h 232 px; top tier r 241, h 150 px;
     star tips at (±116, ±169) px (on the top's plane), inner corners (±59, 0), (0, ±86);
     beads on the rims, walls, the board's edge and the drips; 12 dashed drips under the board */
  if (SCENE === 'cake') (function () {
    var U = 403, Hk = 1 / (U * CE);            // px → units (horizontal / vertical on screen)
    var board = makeBoard(root, 1);
    var T0 = makeTier(root, 309 / U, 232 * Hk, 0.22, 0.5);
    var T1 = makeTier(root, 241 / U, 150 * Hk, 0.3, 0.55);
    T1.grp.userData.base = T0.h;
    var starG = new THREE.Group(); T1.grp.add(starG); starG.position.y = T1.h + 0.003;
    var star = makeStar(starG, 116 / U, 169 / U, 59 / U, 86 / U);
    // beads: [group, x, y, z] — measured on drawing 1
    function rimPt(r, cosA, front, y) { var s = Math.sqrt(Math.max(0, 1 - cosA * cosA)) * (front ? 1 : -1); return [cosA * r, y, s * r]; }
    var beads = [];
    function bead(grp, p, k) { var d = makeDot(grp, p[0], p[1], p[2]); d.userData.sz = k || 1; beads.push(d); return d; }
    bead(T1.grp, rimPt(T1.rRim, -190 / 241, false, T1.yTop));
    bead(T1.grp, rimPt(T1.rRim, 158 / 241, false, T1.yTop));
    var wallR = bead(T1.sil, [T1.r + 0.004, T1.h - 50 * Hk, 0.03]); wallR.userData.wall = 1;
    var wallL = bead(T1.sil, [-(T1.r + 0.004), T1.h - 119 * Hk, 0.03]); wallL.userData.wall = -1;
    bead(T0.grp, rimPt(T0.rRim, -87 / 309, true, T0.yTop));
    // beads ON a silhouette: half of the sphere is inside the wall — draw them over it, like the drawing
    [wallR, wallL].forEach(function (d) { d.material.depthTest = false; d.renderOrder = 4; });
    var wallR0 = bead(T0.sil, [T0.r + 0.004, T0.h - 194 * Hk, 0.03]); wallR0.userData.wall = 1;
    wallR0.material.depthTest = false; wallR0.renderOrder = 4;
    bead(board.grp, rimPt(1.005, -0.997, true, 0));
    bead(board.grp, rimPt(1.005, 111 / U, true, 0));
    // dashed drips under the board: [x px, bottom y px]; the board's front edge is at y = 500 + 160·sin
    var drips = [], DR = [[137, 730], [209, 690], [285, 795], [357, 770], [431, 824], [503, 750], [579, 773],
                          [651, 790], [725, 815], [797, 720], [873, 727], [943, 778]];
    DR.forEach(function (d) {
      var c = Math.max(-0.999, Math.min(0.999, (d[0] - 540) / U)), s = Math.sqrt(1 - c * c);
      var top = 500 + 160 * s + (s < 0.2 ? 14 : 4);
      drips.push(makeDrip(board.grp, V(c * 1.006, -0.01 - (top - 500 - 160 * s) * Hk, s * 1.006), (d[1] - top) * Hk));
    });
    // beads riding two of the drips, as in the drawing (x 285, 943)
    var riders = [[2, 62], [11, 86]].map(function (q) {
      var dr = drips[q[0]], d = makeDot(board.grp, dr.P.x, dr.P.y - q[1] * Hk, dr.P.z);
      return { d: d, dr: dr, y0: q[1] * Hk };
    });
    fit(V(-1, 0, 0), V(1, 0, 0), V(0, 0, 1), V(0, 0, -1), V(0, -(824 - 660) * Hk, 1), V(0, T0.h + T1.h + 0.03, -T1.r));
    parts.cake = { board: board, T0: T0, T1: T1, starG: starG, star: star, beads: beads, drips: drips, riders: riders };
  })();

  /* ---------- the data frame (drawing 2): step 1 — flat, seen from above ----------
     frame 924 × 661 px; rings r 244 and 102; twelve rays every 30° (dashed at 30, 120, 210, 300),
     from the outer ring out to the frame or beyond it; ten beads on the rays and the frame */
  if (SCENE === 'frame') (function () {
    var U = 400, FX = 462 / U, FZ = 330.5 / U, R1 = 102 / U, R2 = 244 / U;
    var g = new THREE.Group(); root.add(g);
    function P(deg, d) { var a = deg * Math.PI / 180; return V(Math.cos(a) * d / U, 0, -Math.sin(a) * d / U); }
    var inner = makeLine(circlePts(R1, 0, 160, Math.PI), { closed: true, sym: true }); g.add(inner);
    var outer = makeLine(circlePts(R2, 0, 200, Math.PI), { closed: true, sym: true }); g.add(outer);
    var heads = [makeDot(g, 0, 0, 0), makeDot(g, 0, 0, 0), makeDot(g, 0, 0, 0), makeDot(g, 0, 0, 0)];
    // [angle, from px, to px, dashed, beads at px]
    var RAYS = [[0, 244, 538, 0, [343, 463]], [30, 248, 532, 1, []], [60, 247, 465, 0, [306]], [90, 244, 404, 0, [330]],
                [120, 248, 378, 1, []], [150, 244, 624, 0, [385, 532]], [180, 244, 461, 0, [357]], [210, 243, 624, 1, []],
                [240, 245, 384, 0, [313]], [270, 244, 396, 0, [331]], [300, 248, 456, 1, []], [330, 244, 533, 0, [375]]];
    var rays = RAYS.map(function (q, i) {
      var A = P(q[0], q[1]), B = P(q[0], q[2]);
      var l = makeLine([A, B], q[3] ? { dash: 0.026, duty: 0.55 } : {}); g.add(l);
      return { l: l, A: A, B: B, head: makeDot(g, A.x, 0, A.z), delay: [0, 4, 1, 7, 10, 3, 6, 9, 2, 8, 11, 5][i] / 11,
               beads: q[4].map(function (d) { var m = makeDot(g, 0, 0, 0); m.position.copy(P(q[0], d)); m.userData.t = (d - q[1]) / (q[2] - q[1]); return m; }) };
    });
    var frame = makeLine([V(-FX, 0, 0), V(-FX, 0, -FZ), V(FX, 0, -FZ), V(FX, 0, FZ), V(-FX, 0, FZ)], { closed: true, sym: true }); g.add(frame);
    fit(V(-540 / U, 0, -404 / U), V(538 / U, 0, 420 / U));
    parts.frame = { inner: inner, outer: outer, heads: heads, rays: rays, frame: frame, R1: R1, R2: R2 };
    LOOP = 10400;
  })();

  /* ---------- the layers (drawing 3): step 2 — three front half-rims with dashed drips ----------
     rims rx 486 / 362 / 264 px at screen heights 360 / 196 / 50 px; twelve drips under each,
     their lengths measured one by one */
  if (SCENE === 'layers') (function () {
    var U = 486, Hk = 1 / (U * CE);
    var L = [
      { rx: 486, yc: 360, d: [[64, 242], [149, 117], [235, 210], [321, 162], [407, 207], [493, 119], [579, 146], [665, 171], [751, 211], [837, 118], [923, 171], [1009, 257]] },
      { rx: 362, yc: 196, d: [[185, 175], [249, 87], [313, 157], [377, 121], [441, 156], [505, 88], [569, 106], [633, 126], [697, 157], [761, 86], [826, 128], [890, 196]] },
      { rx: 264, yc: 50,  d: [[281, 120], [327, 62], [373, 114], [419, 90], [465, 115], [511, 67], [557, 83], [603, 95], [649, 116], [695, 61], [741, 83], [788, 136]] }
    ];
    var layers = L.map(function (q) {
      var r = q.rx / U, y = (360 - q.yc) * Hk, g = new THREE.Group(); g.position.y = y; root.add(g);
      var rim = makeLine(arcPts(r + 0.004, 0, Math.PI, 0, 120), {}); g.add(rim);       // front half, drawn left → right
      var drips = q.d.map(function (d, i) {
        var x = Math.max(-0.985 * r, Math.min(0.985 * r, (d[0] - 540) / U)), z = Math.sqrt(r * r - x * x);
        var dr = makeDrip(g, V(x, -0.004, z + 0.004), d[1] * Hk, 0.028);
        dr.delay = i / 11;
        return dr;
      });
      return { g: g, rim: rim, drips: drips };
    });
    fit(V(-1, 0, 0), V(1, 0, 0), V(0, -(757 - 553) * Hk, 1), V(0, (360 - 50) * Hk, -264 / U), V(-0.99, -(642 - 400) * Hk, 0.12));
    parts.layers = layers;
    LOOP = 11600;
  })();

  /* ---------- the frosting (drawing 4): step 3 — one tier on a board, star, frosting falling ----------
     board r 524 px; tier r 408, h 255 px; star tips (±199, ±280) px, inner corners (±102, 0), (0, ±150);
     fourteen falling lines that land on the top (fading upwards), five with a bead */
  if (SCENE === 'frosting') (function () {
    var U = 524, Hk = 1 / (U * CE);
    var board = makeBoard(root, 1);
    var T = makeTier(root, 408 / U, 255 * Hk, 0.24, 0.5);
    var starG = new THREE.Group(); T.grp.add(starG); starG.position.y = T.h + 0.003;
    var star = makeStar(starG, 199 / U, 280 / U, 102 / U, 150 / U);
    var frostMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      uniforms: { uOpacity: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      // the drawing's falling lines fade out upwards
      fragmentShader: 'uniform float uOpacity; varying vec2 vUv; void main(){ gl_FragColor = vec4(vec3(1.0), pow(1.0 - vUv.y, 1.15) * uOpacity); }'
    });
    // landing points [x px, y px] on the top; bead: px above the landing point
    var LAND = [[179, 382], [201, 277, 79], [283, 432, 74], [299, 222], [413, 200], [413, 467], [543, 200],
                [543, 478, 48], [665, 200, 72], [665, 467], [779, 222], [795, 432], [877, 277, 85], [899, 382]];
    var LEN = 185 * Hk;
    var fall = LAND.map(function (q, i) {
      var x = (q[0] - 540) / U, z = (q[1] - 330) / (U * SE);
      var geo = new THREE.PlaneGeometry(1, LEN); geo.translate(0, LEN / 2, 0);
      var m = new THREE.Mesh(geo, frostMat.clone()); m.renderOrder = 3; T.grp.add(m);
      var b = q[2] ? makeDot(T.grp, 0, 0, 0) : null;
      return { m: m, b: b, x: x, z: z, by: q[2] ? q[2] * Hk : 0, ph: [0, 0.55, 0.2, 0.75, 0.4, 0.9, 0.1, 0.65, 0.3, 0.85, 0.5, 0.05, 0.7, 0.35][i] };
    });
    fit(V(-1, 0, 0), V(1, 0, 0), V(0, 0, 1), V(0, T.h + LEN * 1.25, -0.2));
    parts.frost = { board: board, T: T, starG: starG, star: star, fall: fall, LEN: LEN };
    LOOP = 11200;
  })();


  /* ---------- star spin (ambient + hover) and hover lifts — as in glass-3d ---------- */
  var spin = { p: 0, busy: false, a: 0 };
  function spinStar() {
    if (reduced || spin.busy || SCENE !== 'cake') return false;
    var an = window.anime;
    if (!an || !an.animate) return false;
    spin.busy = true; spin.p = 0;
    an.animate(spin, { p: 1, duration: 1100, ease: 'inOutSine',
      onComplete: function () { spin.a += Math.PI; spin.p = 0; spin.busy = false; } });   // the star is symmetric by 180°
    return true;
  }
  var visible = true;
  if (!reduced && SCENE === 'cake') setInterval(function () { if (visible) spinStar(); }, 4200);

  var mouse = { x: 0, y: 0, cx: 0, cy: 0 };
  var raycaster = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _lastRay = 0;
  function hoverLift(grp) {
    if (reduced || grp.userData.lifting) return;
    var an = window.anime;
    if (!an) return;
    grp.userData.lifting = true;
    an.animate(grp.userData, { lift: 0.07, duration: 360, ease: 'outQuad',
      onComplete: function () { an.animate(grp.userData, { lift: 0, duration: 750, ease: 'inOutQuad',
        onComplete: function () { grp.userData.lifting = false; } }); } });
  }
  window.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect();
    if (!r.width) return;
    var k = 0.6 * TUNE.motion.parallax;
    mouse.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2))) * k;
    mouse.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2))) * k;
    if (reduced) return;
    var now = performance.now();
    if (now - _lastRay < 60) return;
    _lastRay = now;
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;
    _ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(_ndc, camera);
    var hits = raycaster.intersectObjects(glassMeshes.filter(function (m) { return m.visible; }), false);
    if (!hits.length) return;
    var o = hits[0].object;
    if (o.userData.isStar) spinStar();
    else if (o.userData.tier) hoverLift(o.userData.tier);
  }, { passive: true });
  if (window.TiltParallax) TiltParallax.start(function (x, y) {
    var k = 0.6 * TUNE.motion.parallax; mouse.x = x * k; mouse.y = y * k;
  });

  /* ---------- sizing: the drawing's fit points fill the canvas ---------- */
  var W = 0, H = 0, PPW = 100, dpr = 1, CX = 0, CY = 0;
  var PRE_MARGIN = 1.4;
  function resize() {
    var r = stage.getBoundingClientRect();
    if (!r.width) return;
    W = Math.round(r.width); H = Math.round(r.height || r.width * 2 / 3);
    dpr = Math.min(window.devicePixelRatio || 1, TUNE.quality.dprMax || 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(W, H); }
    if (fxaaPass) fxaaPass.material.uniforms.resolution.value.set(1 / (W * dpr), 1 / (H * dpr));
    var pr = (TUNE.quality.preRes || 1) * PRE_MARGIN;
    backRT.setSize(Math.max(2, Math.round(W * dpr * pr)), Math.max(2, Math.round(H * dpr * pr)));
    var bw = Math.max(2, Math.round(W * dpr * 0.25 * PRE_MARGIN)), bh = Math.max(2, Math.round(H * dpr * 0.25 * PRE_MARGIN));
    blurRT1.setSize(bw, bh); blurRT2.setSize(bw, bh);
    blurMat.uniforms.uTexel.value.set(1 / bw, 1 / bh);
    RES.value.set(W / 2, H / 2);
    // extents of the fit points in the (unrotated) camera's screen basis
    var el = Math.min(89.5, camEl) * Math.PI / 180, ux = 0, uy = Math.cos(el), uz = -Math.sin(el);
    var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    fitPts.forEach(function (p) {
      var sy = p.y * uy + p.z * uz;
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy);
    });
    var M = LIGHT ? 1.08 : 1.12;                     // a little air (the hero turns with the mouse)
    PPW = Math.min(W / ((x1 - x0) * M), H / ((y1 - y0) * M)) * TUNE.view.scale;
    CX = (x0 + x1) / 2; CY = (y0 + y1) / 2;
    frame();
  }
  function frame() {
    state.camEl = camEl;
    lookY = 0;
    placeCamera();
    camera.left = CX - W / PPW / 2; camera.right = CX + W / PPW / 2;
    camera.top = CY + H / PPW / 2; camera.bottom = CY - H / PPW / 2;
    camera.updateProjectionMatrix();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
  else window.addEventListener('resize', resize);

  /* ---------- post: bloom + gamma + black floor + FXAA, MSAA on the composer RTs ---------- */
  var composer = null, bloomPass = null, fxaaPass = null, floorPass = null;
  if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass) {
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloomPass = new THREE.UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.5, 0.55);
    composer.addPass(bloomPass);
    if (THREE.ShaderPass && THREE.GammaCorrectionShader) composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
    // black floor: crushes the faint bloom haze to pure black, so the canvas
    // (screen-blended onto the hero) leaves no grey box around the cake
    if (THREE.ShaderPass) {
      floorPass = new THREE.ShaderPass({
        uniforms: { tDiffuse: { value: null }, uFloor: { value: 0.05 }, uGlobal: { value: 1 }, uInvert: { value: LIGHT ? 1 : 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform sampler2D tDiffuse; uniform float uFloor; uniform float uGlobal; uniform float uInvert; varying vec2 vUv;' +
          // (no edge mask any more: it darkened the glass wherever the cake touched the canvas edge)
          // soft knee: haze below ~uFloor fades smoothly to black (a hard subtract drew stepped contours in the bloom halo)
          'void main(){ vec4 c = texture2D(tDiffuse, vUv); float l = max(max(c.r, c.g), c.b);' +
          '  vec3 o = c.rgb * smoothstep(uFloor * 0.6, uFloor * 1.8, l) * uGlobal;' +
          // light slots: invert — black page → white, white lines → dark, smoked glass → milky glass
          // inverted, the glass's cool tint turns cream: keep the light version neutral grey
          '  vec3 inv = 1.0 - o; inv = mix(inv, vec3(dot(inv, vec3(0.299, 0.587, 0.114))), 0.92);' +
          '  gl_FragColor = vec4(mix(o, inv, uInvert), 1.0); }'
      });
      composer.addPass(floorPass);
    }
    if (THREE.ShaderPass && THREE.FXAAShader) { fxaaPass = new THREE.ShaderPass(THREE.FXAAShader); composer.addPass(fxaaPass); }
  }
  function setMsaa(n) {
    if (!composer || !renderer.capabilities.isWebGL2) return;
    n = Math.max(0, Math.min(8, Math.round(n)));
    composer.renderTarget1.samples = n; composer.renderTarget2.samples = n;
    composer.renderTarget1.dispose(); composer.renderTarget2.dispose();
  }
  if (INDEX === 0) window.CAKE3D_INFO = function () {
    return { webgl2: !!renderer.capabilities.isWebGL2,
             msaaSamples: (composer && renderer.capabilities.isWebGL2) ? composer.renderTarget1.samples : 0,
             fxaa: !!(fxaaPass && fxaaPass.enabled), pixelRatio: renderer.getPixelRatio() };
  };
  /* ---------- apply knobs ---------- */
  var _skyTopC = new THREE.Color(), _skyHzC = new THREE.Color();
  var _lastQ = { msaa: -1, dprMax: TUNE.quality.dprMax, preRes: TUNE.quality.preRes, speed: 1 };
  function applyTune() {
    _skyTopC.set(TUNE.skyTop); _skyHzC.set(TUNE.skyHorizon);
    var trans = TUNE.transmission + TUNE.transmissionSpread * 0.5;
    for (var i = 0; i < glassMeshes.length; i++) {
      var gm = glassMeshes[i], mat = gm.material.uniforms ? gm.material : gm.userData.mainMat;
      var u = mat.uniforms, ud = mat.userData, f = gm.userData.fade;
      u.uTransmission.value = trans;
      u.uRefract.value = ud.baseRefract * TUNE.refract;
      u.uFres.value = TUNE.fresnel; u.uFrost.value = TUNE.frost;
      u.uMag.value = TUNE.pieceMag; u.uShift.value = TUNE.pieceShift;
      u.uTopClear.value = TUNE.topClear; u.uTopDarken.value = TUNE.topDarken;
      u.uEdgeWhite.value = TUNE.edgeWhite; u.uIri.value = TUNE.iri;
      u.uSkyTop.value.copy(_skyTopC); u.uSkyHz.value.copy(_skyHzC);
      u.uTint.value.setRGB(TUNE.tint.r, TUNE.tint.g, TUNE.tint.b);
      u.uBody.value.copy(ud.baseBody).multiplyScalar(TUNE.body);
      u.uFade.value = f;
      u.uSolid.value = (LIGHT || FLAT) ? 1 : 0;

      ud.preMat.color.copy(ud.basePre).multiplyScalar(TUNE.pre * f);
      var rl = gm.userData.rim;
      rl.material.opacity = (LIGHT || FLAT) ? 0 : Math.min(1, rl.userData.baseOp * TUNE.rim) * f;   // no light edges on white
      gm.visible = f > 0.002;
    }
    bgQuad.material.color.set(TUNE.backdrop);
    blurMat.uniforms.uRadius.value = TUNE.frostRadius;
    if (bloomPass) bloomPass.enabled = !LIGHT && !FLAT;            // no glow on white
    if (bloomPass) {
      bloomPass.strength = TUNE.bloom.strength; bloomPass.radius = TUNE.bloom.radius; bloomPass.threshold = TUNE.bloom.threshold;
    }
    if (floorPass) floorPass.uniforms.uFloor.value = Math.min(0.5, Math.max(0, TUNE.blackFloor));
    for (var l = 0; l < lines.length; l++) {
      lines[l].material.uniforms.uWidth.value = lines[l].userData.fine ? TUNE.lines.finePx : TUNE.lines.px;
    }
    if (fxaaPass) fxaaPass.enabled = !!(+TUNE.quality.fxaa);
    if (+TUNE.quality.msaa !== _lastQ.msaa) { _lastQ.msaa = +TUNE.quality.msaa; setMsaa(_lastQ.msaa); }
    if (TUNE.quality.dprMax !== _lastQ.dprMax || TUNE.quality.preRes !== _lastQ.preRes) {
      _lastQ.dprMax = TUNE.quality.dprMax; _lastQ.preRes = TUNE.quality.preRes; resize();
    }
  }

  /* ---------- render loop ---------- */
  var running = false, last = performance.now(), clock = 0, T = 0;
  var segMode = false, AMB = 8400;          // still scenes: ambient loop (2 star spins, one bead slide, 18 dash periods)
  var _wp = new THREE.Vector3();
  function clamp01(t) { return t < 0 ? 0 : (t > 1 ? 1 : t); }
  function ease(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function K(t, a, d) { return ease((t - a) / d); }          // 0 → 1 between a and a + d
  var dashOff = 0;

  function drive(t, dt, dotR) {
    /* --- cake: still (hero, shortlist) — mouse turns it, hover lifts a tier, the star spins, drips flow --- */
    if (parts.cake) {
      var c = parts.cake;
      c.board.grp.position.y = c.board.grp.userData.lift;
      c.T0.grp.position.y = c.T0.grp.userData.lift;
      c.T1.grp.position.y = c.T1.grp.userData.base + c.T1.grp.userData.lift;
      [c.T0, c.T1].forEach(function (Ti) {
        Ti.sil.rotation.y = -root.rotation.y;
        setLine(Ti.rim, 1, 1); Ti.sl.forEach(function (l) { setLine(l, 1, TUNE.lines.silhouettes); });
      });
      setLine(c.board.rim, 1, 1);
      setLine(c.star.line, 1, 1);
      // seg mode (WebP capture): the ambient loop is a function of time — a spin every 4.2 s, AMB long
      var sp = segMode ? ((T % 4200) < 1100 ? (T % 4200) / 1100 : -1) : (spin.busy ? spin.p : -1);
      c.starG.rotation.y = (segMode ? 0 : spin.a) + (sp >= 0 ? ease(sp) * Math.PI : 0);
      c.starG.position.y = c.T1.h + 0.003 + (sp >= 0 ? Math.sin(sp * Math.PI) * 0.05 : 0);
      c.beads.forEach(function (d) { setDot(d, 1); d.scale.setScalar(dotR); });
      c.drips.forEach(function (d) { setLine(d.l, 1, 1); d.l.material.uniforms.uDashOff.value = dashOff; });
      c.riders.forEach(function (r, i) {                      // beads slide down their drip, slowly, and drop off
        var u = ((reduced ? 0 : clock) * 1000 / AMB + i * 0.5 + r.y0 / r.dr.len) % 1;   // one slide per ambient loop
        r.d.position.y = r.dr.P.y - u * r.dr.len;
        setDot(r.d, ease(u / 0.12) * (1 - ease((u - 0.85) / 0.15)));
        r.d.scale.setScalar(dotR);
      });
    }

    /* --- step 1: the data frame draws itself, holds, then undraws in sequence --- */
    if (parts.frame) {
      var f = parts.frame, o = t - 7600;
      var pIn = K(t, 0, 900), pOut = K(t, 600, 1100);
      if (o > 0) { pOut = Math.min(pOut, 1 - K(o, 1300, 500)); pIn = Math.min(pIn, 1 - K(o, 1700, 500)); }
      setLine(f.inner, pIn, 1); setLine(f.outer, pOut, 1);
      // a bead on each open end while a ring grows (from the left, both ways)
      [[f.R1, pIn, 0], [f.R2, pOut, 2]].forEach(function (q) {
        for (var s = 0; s < 2; s++) {
          var a = Math.PI + (s ? 1 : -1) * q[1] * Math.PI, h = f.heads[q[2] + s];
          h.position.set(Math.cos(a) * q[0], 0, Math.sin(a) * q[0]);
          setDot(h, q[1] > 0.002 && q[1] < 0.998 && o < 0 ? 1 : 0); h.scale.setScalar(dotR);
        }
      });
      f.rays.forEach(function (r) {
        var p = K(t, 1500 + r.delay * 1300, 650);
        if (o > 0) p = Math.min(p, 1 - K(o, 300 + r.delay * 600, 450));   // back into the ring
        setLine(r.l, p, 1);
        r.head.position.lerpVectors(r.A, r.B, p);                         // the tip bead leads the ray
        setDot(r.head, p > 0.002 && p < 0.998 ? 1 : 0); r.head.scale.setScalar(dotR);
        r.beads.forEach(function (b) {
          var on = p >= b.userData.t ? 1 : 0;
          if (o > 0) on *= 1 - K(o, 200 + r.delay * 400, 150);
          setDot(b, on); b.scale.setScalar(dotR);
        });
      });
      var fr = K(t, 2900, 1200);
      if (o > 0) fr = Math.min(fr, 1 - K(o, 0, 500));
      setLine(f.frame, fr, 1);
    }

    /* --- step 2: the layers go down one by one, their drips run; then each drips off and undraws --- */
    if (parts.layers) {
      var o2 = t - 8000;
      parts.layers.forEach(function (L, i) {
        var rp = K(t, i * 1200, 900), j = 2 - i;                          // undraw from the top layer down
        if (o2 > 0) rp = Math.min(rp, 1 - K(o2, j * 900 + 450, 500));
        setLine(L.rim, rp, 1);
        L.drips.forEach(function (d) {
          var p = K(t, 600 + i * 1200 + d.delay * 500, 650);
          var gone = o2 > 0 ? K(o2, j * 900 + d.delay * 250, 500) : 0;   // empties from the top: falls, never goes back up
          setLine(d.l, p, 1);
          d.l.material.uniforms.uStart.value = gone;
          d.l.material.uniforms.uDashOff.value = dashOff;
          if (gone > 0.999) d.l.visible = false;
        });
      });
    }

    /* --- step 3: board, tier, star; the frosting falls onto the top; then all undraws --- */
    if (parts.frost) {
      var q = parts.frost, o3 = t - 9000;
      var bRim = K(t, 0, 900), grow = K(t, 500, 900), tRim = K(t, 1200, 800), st = K(t, 1800, 800);
      if (o3 > 0) {
        st = Math.min(st, 1 - K(o3, 0, 600)); tRim = Math.min(tRim, 1 - K(o3, 500, 600));
        grow = Math.min(grow, 1 - K(o3, 900, 600)); bRim = Math.min(bRim, 1 - K(o3, 1300, 600));
      }
      setLine(q.board.rim, bRim, 1);
      q.board.mesh.userData.fade = bRim > 0.001 ? 1 : 0;
      q.T.grp.position.y = q.T.grp.userData.lift;
      q.T.mesh.scale.y = Math.max(0.001, grow); q.T.mesh.userData.fade = grow > 0.002 ? 1 : 0;
      q.T.sil.rotation.y = -root.rotation.y;
      q.T.sl.forEach(function (l) { setLine(l, grow, 1); });
      setLine(q.T.rim, tRim, 1);
      setLine(q.star.line, st, 1);
      q.star.mesh.userData.fade = st > 0.98 ? 1 : 0;
      q.fall.forEach(function (fl) {
        var C = 3000, tt = t - 2400 - fl.ph * C, on = 0, y = 0, sc = 1, bead = 0, by = fl.by;
        if (tt > 0 && (tt - (tt % C)) < 6400 - 2400 - fl.ph * C && !reduced) {
          var u = (tt % C) / C;
          if (u < 0.25) { var a = u / 0.25; y = (1 - a * a) * 1.1; on = ease(u / 0.06); bead = on; }      // falls, accelerating
          else if (u < 0.85) {
            on = 1; bead = 1;
            var e = ease((u - 0.55) / 0.3);                         // the trail empties downwards onto the top
            sc = 1 - e; by = fl.by * (1 - e); bead = 1 - ease((u - 0.78) / 0.07);
          }
        }
        if (reduced && t > 2400) { on = 1; bead = 1; }
        fl.m.visible = on > 0.002 && sc > 0.002;
        fl.m.position.set(fl.x, q.T.h + 0.002 + y, fl.z);
        fl.m.scale.set(TUNE.lines.px / PPW, Math.max(0.001, sc), 1);
        fl.m.rotation.y = -root.rotation.y;
        fl.m.material.uniforms.uOpacity.value = on;
        if (fl.b) {
          fl.b.position.set(fl.x, q.T.h + 0.002 + y + by, fl.z);
          setDot(fl.b, on > 0.002 && sc > 0.002 ? bead : 0); fl.b.scale.setScalar(dotR);
        }
      });
    }
  }

  function render(now) {
    running = false;
    var dt = Math.min(0.05, (now - last) / 1000) * (reduced ? 0 : TUNE.motion.speed);
    last = now; clock += dt;
    if (LOOP) { T += dt * 1000; if (T >= LOOP) T -= LOOP; }
    var t = LOOP ? (reduced ? 6000 : T) : 0;
    dashOff += dt * TUNE.drips.flow * 0.6;
    if (segMode && !LOOP) { clock = T / 1000; dashOff = (T % AMB) / AMB * 0.034 * 18; }   // seamless ambient loop for the capture
    var dotR = TUNE.dots.px / PPW / 2;

    mouse.cx += (mouse.x - mouse.cx) * 0.055;
    mouse.cy += (mouse.y - mouse.cy) * 0.055;
    root.rotation.y = -mouse.cx * (SCENE === 'frame' ? 0.12 : 0.22);
    root.rotation.x = mouse.cy * (SCENE === 'frame' ? 0.12 : 0.05);
    frame();
    drive(t, dt, dotR);

    for (var di2 = 0; di2 < dotsAll.length; di2++) dotsAll[di2].material.opacity = dotsAll[di2].userData.k;
    underLight.intensity = 0.9;
    applyTune();

    // per-piece lens centres
    for (var ci = 0; ci < glassMeshes.length; ci++) {
      var cm = glassMeshes[ci];
      if (!cm.visible) continue;
      cm.getWorldPosition(_wp);
      _wp.project(camera);
      cm.material.uniforms.uCenter.value.set(clamp01(_wp.x * 0.5 + 0.5), clamp01(_wp.y * 0.5 + 0.5));   // half-off-screen pieces keep their lens on screen
      cm.material.uniforms.uPre.value = 1 / PRE_MARGIN;
    }

    // PRE-PASS → backRT (wider frustum: PRE_MARGIN), frost blur
    var cl = camera.left, cr = camera.right, ct = camera.top, cb = camera.bottom;
    camera.left = cl * PRE_MARGIN; camera.right = cr * PRE_MARGIN; camera.top = ct * PRE_MARGIN; camera.bottom = cb * PRE_MARGIN;
    camera.updateProjectionMatrix();
    bgQuad.visible = true;
    bgQuad.quaternion.copy(camera.quaternion);
    bgQuad.position.copy(VIEW).multiplyScalar(-8); bgQuad.position.y += lookY;
    bgQuad.scale.set(Math.max(Math.abs(camera.left), Math.abs(camera.right)) * 2.2, Math.max(Math.abs(camera.top), Math.abs(camera.bottom)) * 2.2, 1);   // the view is off-centre (fit)
    var gi;
    for (gi = 0; gi < glassMeshes.length; gi++) {
      var gm = glassMeshes[gi]; gm.userData.mainMat = gm.material; gm.material = gm.material.userData.preMat;
    }
    renderer.setRenderTarget(backRT);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
    renderer.render(scene, camera);
    blurPass(backRT, blurRT1, 1, 0);
    blurPass(blurRT1, blurRT2, 0, 1);
    renderer.setRenderTarget(null);
    for (gi = 0; gi < glassMeshes.length; gi++) glassMeshes[gi].material = glassMeshes[gi].userData.mainMat;
    bgQuad.visible = false;
    camera.left = cl; camera.right = cr; camera.top = ct; camera.bottom = cb;
    camera.updateProjectionMatrix();

    if (composer) composer.render(); else renderer.render(scene, camera);
    schedule();
  }
  function schedule() {
    if (!running && visible) { running = true; requestAnimationFrame(render); }
  }
  // only animate while the hero is on screen
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
            if (visible) { last = performance.now(); schedule(); }
    }, { rootMargin: '100px' }).observe(stage);
  }

  /* ---------- crosshair cursor (Data Core) ---------- */
  if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var sz = 28, half = 14, sw = 3, o = 1.5, a0 = sz * 0.04 + o, a1 = half - sw / 2 - 3 * o;
    var arms = function (g) {
      return 'M' + half + ' ' + (a0 - g) + 'V' + (a1 + g) + ' M' + half + ' ' + (sz - a0 + g) + 'V' + (sz - a1 - g) +
        ' M' + (a0 - g) + ' ' + half + 'H' + (a1 + g) + ' M' + (sz - a0 + g) + ' ' + half + 'H' + (sz - a1 - g);
    };
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28"><path d="' + arms(o) +
      '" stroke="#000" stroke-width="' + (sw + 2 * o) + '"/><path d="' + arms(0) + '" stroke="#fff" stroke-width="' + sw + '"/></svg>';
    canvas.style.cursor = 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") 14 14, crosshair';
  }


  var api = { slot: SLOT, scene: SCENE, state: state, seg: function (ms) { T = ms; segMode = true; }, loop: function () { return LOOP || AMB; }, renderer: renderer, camera: camera, scene3: scene,
              passes: function () { return { bloom: bloomPass, floor: floorPass }; }, timeline: function () { return null; } };
  instances.push(api);
  if (INDEX === 0) window.__cake3d = api;

  resize();
  schedule();
  }   // createCake

  var cv = document.querySelectorAll('canvas.cake-3d-canvas');
  for (var ci0 = 0; ci0 < cv.length; ci0++) createCake(cv[ci0], ci0);
})();
