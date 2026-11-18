/* =========================================================================
   Cake — glass 3D illustration (version "glass-3d"), hero slot.

   George's animation (illustrations/evolved/george/cake-ascent-30s.mp4)
   re-staged in the Data Core language (celonistvibecoding experiment 3,
   variant B): near-black smoked glass with light edges, screen-space
   refraction over a pre-pass of the scene, frost blur, subtle bloom, ortho
   camera, mouse / gyroscope parallax, live knobs (window.CAKE3D) and a tuner.

   30 s loop, same chapters as the video:
     (times are the video's; the loop starts drawing at once, 2.2 s earlier,
      and ends with 0.5 s of black)
     0–2.5   the data point alone (skipped)
     2.5–5   inner ring, then outer ring, each growing both ways from the left
             with a bead on each open end; four loose beads between them
     5–8     rays shoot out bead-first; the frame grows from the middle of its
             left side; the lower tiers' footprints come in faint and dotted
     8–9     the frame turns a few degrees in its plane
     9–10    FAST tilt to 3D (0.8 s); rays and frame go, their beads linger;
             the outer ring becomes the plate; two verticals rise in front
     10–17.5 each tier: base ring, the dotted side lines grow UP with the glass,
             then the cap: rim beads fly in, the rim draws, swags; the camera
             climbs with it
     17.5–19 close-up: four beads, the star's arcs, its glass; frosting falls
     19.5–26 pull back: drips down the top tier, beads around the plate,
             dashed drips under it; slow pull back, hold
     27.6–30 slow dissolve back to the data point (seamless loop)
   Far halves of rims are dimmed (lines.backArc) once the view is 3D, like the
   video's hidden-line drawing.

   Every line is a screen-space ribbon (constant pixel width at any zoom, drawn
   on by a progress uniform, occluded by the glass). The glass pipeline
   (shaders, pre-pass, frost, composer, MSAA) is copied from
   experiments/datacore/anime-datacore/datacore-3d.js (v29) — read
   claude_datacore_context.md §8 before changing it. Three.js r147 + anime.js v4.
   ========================================================================= */
(function () {
  'use strict';
  if (!window.THREE) return;
  var THREE = window.THREE;

  var canvas = document.querySelector('canvas.cake-3d-canvas');
  if (!canvas) return;
  var stage = canvas.parentElement;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fail() { stage.classList.add('cake-3d-off'); }
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  } catch (e) { fail(); return; }
  if (!renderer.getContext()) { fail(); return; }
  stage.classList.add('cake-3d-on');

  /* ---------- deterministic RNG ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rnd = mulberry32(20261118);

  /* ---------- LIVE KNOBS: window.CAKE3D (the tuner writes here) ---------- */
  var TUNE = window.CAKE3D = {
    // glass — Igor's settings, 2026-11-18 (refract, frost, pieceMag,
    // topDarken, body and pre retuned from the Data Core defaults)
    tint:        { r: 1.8, g: 1.8, b: 1.8 },
    transmission: 0.43,
    transmissionSpread: 0.14,
    refract:     0.89,
    frost:       0.66,
    frostRadius: 0.98,
    pieceMag:    0.87,
    pieceShift:  0.11,
    fresnel:     0.44,
    topClear:    0.92,
    topDarken:   0.78,
    edgeWhite:   0.44,
    skyTop:      '#eef4ff',
    skyHorizon:  '#8e9aad',
    iri:         0.08,
    body:        0.65,
    rim:         1.16,
    pre:         0.15,
    backdrop:    '#e6ecf5',
    bloom:       { strength: 0.16, radius: 0.26, threshold: 0.35 },
    blackFloor:  0.05,   // crushes the bloom haze (see the floor pass)
    // line art (px = CSS pixels, constant at any zoom)
    lines:       { px: 1.2, finePx: 0.85, opacity: 0.92, silhouettes: 1, backArc: 0.25 },
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

  /* ---------- state (driven by the timeline) ---------- */
  // cam*: elevation (deg), zoom (× the fit of the finished cake), look-at height
  var state = {
    camEl: 89, camZoom: 0.8, camY: 0,
    frostOn: 0,
    fadeAll: 1, spin: 0, end: 0
  };

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
    'uniform float uEdgeWhite; uniform vec3 uSkyTop; uniform vec3 uSkyHz; uniform vec3 uTint; uniform float uFade;',
    'varying vec3 vN; varying vec3 vWN; varying vec2 vScreenUv;',
    'void main() {',
    '  vec3 N = normalize(vN);',
    '  float up = clamp(normalize(vWN).y, 0.0, 1.0);',
    '  vec2 rel = vScreenUv - uCenter;',
    '  vec2 buv = uCenter + rel * uMag + N.xy * uRefract + uOffset * uShift;',
    '  vec3 trans = mix(texture2D(uBackdrop, buv).rgb, texture2D(uBackdropBlur, buv).rgb, uFrost);',
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
        uFade: { value: 1 }
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
  var BEV = 0.016;
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
  function circleShape(r) {
    var s = new THREE.Shape(); s.absarc(0, 0, r, 0, Math.PI * 2, false); return s;
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
    'uniform vec2 uRes; uniform float uWidth;',
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
    '  gl_Position = c; vU = u; vDist = dist;',
    '}'].join('\n');
  var LINE_F = [
    'uniform float uOpacity; uniform float uProgress; uniform float uDash; uniform float uDuty;',
    'uniform float uSym; uniform float uBackOn; uniform float uBack;',
    'varying float vU; varying float vDist; varying float vFront;',
    'void main() {',
    // uSym: grows from its start point in BOTH directions (the video's rings and frame)
    '  float uu = uSym > 0.5 ? min(vU, 1.0 - vU) * 2.0 : vU;',
    '  if (uu > uProgress || uOpacity <= 0.001) discard;',
    '  if (uDash > 0.0 && fract(vDist / uDash) > uDuty) discard;',
    '  float w = uBackOn > 0.5 ? mix(uBack, 1.0, smoothstep(-0.12, 0.12, vFront)) : 1.0;',
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
      uniforms: { uRes: RES, uWidth: { value: 2 }, uOpacity: { value: 1 }, uProgress: { value: 1 },
                  uDash: { value: o.dash || 0 }, uDuty: { value: o.duty || 0.5 },
                  uSym: { value: o.sym ? 1 : 0 }, uBackOn: { value: o.back ? 1 : 0 }, uBack: BACK }
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
    u.uOpacity.value = Math.max(0, op) * l.userData.base * TUNE.lines.opacity;
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

  /* ---------- the cake (proportions from the end frames of the video) ---------- */
  var PLATE_R = 1.0, PLATE_H = 0.035;
  var TIERS = [
    { r: 0.80, h: 0.36, swags: 12, seed: 0.22, g: 0.5 },
    { r: 0.62, h: 0.32, swags: 10, seed: 0.27, g: 0.52 },
    { r: 0.42, h: 0.28, swags: 8, seed: 0.31, g: 0.55 }
  ];
  var STAR_R = 0.22, STAR_H = 0.03;   // tip to tip ≈ half the top tier, as in the video
  var RING_Y = PLATE_H + 0.003;       // the opening drawing lies on the plate's top
  var LEFT = Math.PI;                 // rings, rims and swags start drawing at the left, like the video
  var BASE = [PLATE_H, PLATE_H + TIERS[0].h, PLATE_H + TIERS[0].h + TIERS[1].h];
  var TOP_Y = BASE[2] + TIERS[2].h;

  // two dots riding the open ends of a line that grows both ways from LEFT
  function makeHeads(parent) { return [makeDot(parent, 0, 0, 0), makeDot(parent, 0, 0, 0)]; }
  function setHeads(h, r, y, prog, op, dotR) {
    var on = prog > 0.002 && prog < 0.998 ? op : 0;
    for (var s = 0; s < 2; s++) {
      var a = LEFT + (s ? 1 : -1) * prog * Math.PI;
      h[s].position.set(Math.cos(a) * r, y, Math.sin(a) * r);
      setDot(h[s], on);
      h[s].scale.setScalar(dotR * 0.8);
    }
  }

  // plate + stand
  var plate = new THREE.Group(); root.add(plate);
  var plateMesh = glassPiece(extrude(circleShape(PLATE_R), PLATE_H - 2 * 0.01, 0.01, 24), 0.34, 0.45, 0.3);
  plate.add(plateMesh);
  var plateTop = makeLine(circlePts(PLATE_R + 0.012, PLATE_H, 160), { closed: true, back: true }); plate.add(plateTop);
  var plateBot = makeLine(circlePts(PLATE_R + 0.012, 0, 160), { closed: true, opacity: 0.6, back: true }); plate.add(plateBot);
  var foot = new THREE.Group(); root.add(foot);
  var STEM_R = 0.13, STEM_H = 0.13, FOOT_R = 0.5, FOOT_H = 0.03;
  var stemMesh = glassPiece(extrude(circleShape(STEM_R), STEM_H - 0.02, 0.01, 16), 0.3, 0.5, 0.2);
  stemMesh.position.y = -STEM_H;
  var footMesh = glassPiece(extrude(circleShape(FOOT_R), FOOT_H - 0.02, 0.01, 24), 0.36, 0.5, 0.25);
  footMesh.position.y = -STEM_H - FOOT_H;
  foot.add(stemMesh); foot.add(footMesh);
  var footTop = makeLine(circlePts(FOOT_R + 0.012, -STEM_H, 120, LEFT), { closed: true, sym: true, back: true }); foot.add(footTop);
  var footBot = makeLine(circlePts(FOOT_R + 0.012, -STEM_H - FOOT_H, 120, LEFT), { closed: true, sym: true }); foot.add(footBot);
  // the two bold verticals on the front of the bottom tier, down to the stand
  var fronts = [-0.075, 0.075].map(function (x) {
    var z = Math.sqrt(Math.pow(TIERS[0].r + BEV + 0.006, 2) - x * x);
    var l = makeLine([new THREE.Vector3(x, -STEM_H, z), new THREE.Vector3(x, BASE[0] + TIERS[0].h, z)]);
    root.add(l);
    return l;
  });

  // silhouette pair: two verticals at the camera-facing tangents (drawn top → bottom)
  function silPair(r, h) {
    var g = new THREE.Group();
    var L = makeLine([new THREE.Vector3(-r, 0, 0), new THREE.Vector3(-r, h, 0)]);
    var R = makeLine([new THREE.Vector3(r, 0, 0), new THREE.Vector3(r, h, 0)]);
    g.add(L); g.add(R); g.userData.l = [L, R];
    return g;
  }

  // Each tier is built like the video: its rim beads fly in at the rim's height, the
  // rim draws, the glass wall comes DOWN from the rim, the dotted grid and the swags follow.
  var tiers = TIERS.map(function (T, i) {
    var grp = new THREE.Group(); grp.position.y = BASE[i]; root.add(grp);
    var rr = T.r + BEV + 0.004;
    var top = makeLine(circlePts(rr, T.h, 160, LEFT), { closed: true, sym: true, back: true }); grp.add(top);
    var heads = makeHeads(grp);
    var wall = new THREE.Group(); grp.add(wall);       // scale.y = growth, rises from the tier's base
    var inner = new THREE.Group(); wall.add(inner);
    var mesh = glassPiece(extrude(circleShape(T.r), T.h - 2 * BEV, BEV, 24), T.seed, T.g, 0.22);
    mesh.userData.tier = grp;
    inner.add(mesh);
    var sil = silPair(rr, T.h); inner.add(sil);
    var grid = [];
    for (var k = 0; k < 28; k++) {
      var a = k / 28 * Math.PI * 2 + i * 0.3;
      var gl = makeLine([new THREE.Vector3(Math.cos(a) * rr, 0.012, Math.sin(a) * rr),        // drawn bottom → top
                         new THREE.Vector3(Math.cos(a) * rr, T.h - 0.012, Math.sin(a) * rr)],
                        { fine: true, dash: 0.022, duty: 0.35 });
      inner.add(gl); grid.push(gl);
    }
    var sw = [], NS = 320, sag = T.h * 0.36;
    for (var s = 0; s < NS; s++) {
      var th = LEFT + s / NS * Math.PI * 2;
      var y = T.h - 0.02 - sag * Math.abs(Math.sin((th - LEFT) * T.swags / 2));
      sw.push(new THREE.Vector3(Math.cos(th) * (rr + 0.002), y, Math.sin(th) * (rr + 0.002)));
    }
    var swag = makeLine(sw, { closed: true, sym: true }); inner.add(swag);
    // rim beads (= the swag joints): fly in from a scattered cloud above the rim
    var joints = [];
    for (var q = 0; q < T.swags; q++) {
      var tj = LEFT + q / T.swags * Math.PI * 2;
      var d = makeDot(grp, 0, 0, 0);
      var u = q / T.swags;
      d.userData.u = Math.min(u, 1 - u) * 2;          // symmetric order, like the swag
      d.userData.to = new THREE.Vector3(Math.cos(tj) * (rr + 0.006), T.h - 0.02, Math.sin(tj) * (rr + 0.006));
      var fa = tj + (rnd() - 0.5) * 0.9, fr = rr * (0.55 + 0.6 * rnd());
      d.userData.from = new THREE.Vector3(Math.cos(fa) * fr, T.h + 0.12 + 0.35 * rnd(), Math.sin(fa) * fr);
      d.userData.delay = rnd() * 0.35;
      joints.push(d);
    }
    var bottom = makeLine(circlePts(rr, 0.0, 160, LEFT), { closed: true, back: true }); grp.add(bottom);
    grp.userData = { lift: 0, kind: 'tier' };
    return { T: T, i: i, grp: grp, wall: wall, mesh: mesh, top: top, heads: heads, sil: sil, grid: grid,
             swag: swag, joints: joints, bottom: bottom, rr: rr };
  });

  // star: four beads, then the concave arcs between them, then the glass
  var starPivot = new THREE.Group(); root.add(starPivot);
  var starMesh = glassPiece(extrude(starShape(STAR_R, 0.3), STAR_H - 0.016, 0.008, 6), 0.7, 0.6, 0.5);
  starMesh.userData.isStar = true;
  starPivot.add(starMesh);
  var starLine = makeLine(starShape(STAR_R * 1.03, 0.3).getPoints(10).slice(0, -1).map(function (p) {
    return new THREE.Vector3(p.x, STAR_H + 0.002, -p.y);
  }), { closed: true });
  starPivot.add(starLine);
  var starTips = [0, 1, 2, 3].map(function (k) {
    var a = Math.PI / 4 + k * Math.PI / 2;
    return makeDot(starPivot, Math.cos(a) * STAR_R * 1.03, STAR_H + 0.004, -Math.sin(a) * STAR_R * 1.03);
  });

  /* ---------- the opening drawing: data point, rings, rays, frame ---------- */
  var intro = new THREE.Group(); root.add(intro);
  var centerDot = makeDot(intro, 0, RING_Y, 0);
  // two rings drawn first (inner = the top tier, outer = the plate), then the
  // footprints of the two lower tiers come in faint and dotted
  var RINGS = [
    { r: 0.36, key: 'ringIn', op: 1 },               // the video's inner ring: 0.35 of the outer
    { r: PLATE_R + 0.012, key: 'ringOut', op: 1 },
    { r: TIERS[0].r + BEV + 0.004, key: 'ringFaint', op: 0.6, dash: 0.03 },
    { r: TIERS[1].r + BEV + 0.004, key: 'ringFaint', op: 0.6, dash: 0.03 }
  ];
  RINGS.forEach(function (R) {
    // faint rings: a row of small dots, like the video (short dash, low duty)
    R.line = makeLine(circlePts(R.r, RING_Y, 200, LEFT), { closed: true, sym: true, opacity: R.op, fine: !!R.dash, dash: R.dash || 0, duty: 0.22 });
    intro.add(R.line);
    if (!R.dash) R.heads = makeHeads(intro);
  });
  // the four loose beads between the rings
  var midDots = [0.25, 0.75, 1.25, 1.75].map(function (k) {
    var a = k * Math.PI;
    return makeDot(intro, Math.cos(a) * 0.7, RING_Y, Math.sin(a) * 0.7);
  });
  // rays to the data sources + the data frame
  var FX = 1.72, FZ = 1.32;            // ring : frame proportions of the video
  var rayGroup = new THREE.Group(); rayGroup.position.y = RING_Y; intro.add(rayGroup);
  var rays = [];
  [8, 31, 52, 77, 99, 121, 149, 172, 201, 224, 252, 284, 309, 337].forEach(function (deg, i) {
    var a = (deg + (rnd() - 0.5) * 8) * Math.PI / 180, cx = Math.cos(a), cz = Math.sin(a);
    var tEnd = Math.min(FX / Math.abs(cx || 1e-6), FZ / Math.abs(cz || 1e-6)) * (0.72 + 0.26 * rnd());
    var r0 = 1.03 + (rnd() < 0.5 ? 0 : 0.04 + 0.12 * rnd());       // many rays start a little off the ring
    var A = new THREE.Vector3(cx * r0, 0, cz * r0), B = new THREE.Vector3(cx * tEnd, 0, cz * tEnd);
    var dashed = [1, 4, 6, 9, 12].indexOf(i) >= 0;
    var l = makeLine([A, B], { fine: true, dash: dashed ? 0.028 : 0, duty: 0.3, opacity: dashed ? 0.75 : 0.85 });
    rayGroup.add(l);
    var head = makeDot(rayGroup, A.x, 0, A.z);
    var loose = rnd() < 0.2 ? makeDot(rayGroup, B.x * (1.06 + 0.06 * rnd()), 0, B.z * (1.06 + 0.06 * rnd())) : null;
    var bead = rnd() < 0.5 ? makeDot(rayGroup, B.x, 0, B.z) : null;
    rays.push({ l: l, A: A, B: B, head: head, loose: loose, bead: bead, delay: rnd() * 0.45, bd: rnd() * 0.4 });
  });
  // the frame grows from the middle of its left side, both ways
  var frameLine = makeLine([new THREE.Vector3(-FX, 0, 0), new THREE.Vector3(-FX, 0, -FZ), new THREE.Vector3(FX, 0, -FZ),
    new THREE.Vector3(FX, 0, FZ), new THREE.Vector3(-FX, 0, FZ)], { closed: true, sym: true, fine: true, opacity: 0.8 });
  rayGroup.add(frameLine);

  // loose data beads floating around the plate and the stand (end of the video)
  var floaters = [];
  for (var fl = 0; fl < 22; fl++) {
    var fa2 = rnd() * Math.PI * 2, fr2 = 0.9 + 0.45 * rnd();
    floaters.push({ m: makeDot(root, 0, 0, 0), a: fa2, r: fr2, y: -0.38 + 0.42 * rnd(), ph: rnd() * 6.28, delay: rnd() * 0.6 });
  }

  /* ---------- dashed data drips under the plate ---------- */
  var LINE_VERT = 'varying vec2 vUv; varying float vY; void main(){ vUv = uv; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  var dripMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uOffset: { value: 0 }, uDash: { value: 0.045 }, uDuty: { value: 0.55 }, uOpacity: { value: 0.8 } },
    vertexShader: LINE_VERT,
    fragmentShader: [
      'uniform float uOffset; uniform float uDash; uniform float uDuty; uniform float uOpacity;',
      'varying vec2 vUv; varying float vY;',
      'void main(){',
      '  float f = fract((vY - uOffset) / uDash);',
      '  float on = smoothstep(0.0, 0.06, f) * (1.0 - smoothstep(uDuty, uDuty + 0.06, f));',
      '  float fade = smoothstep(0.0, 0.3, vUv.y);',
      '  gl_FragColor = vec4(vec3(1.0), on * fade * uOpacity);',
      '}'].join('\n')
  });
  var drips = [], dripGroup = new THREE.Group();
  plate.add(dripGroup);
  for (var di = 0; di < 15; di++) {
    var x = -1 + 2 * di / 14, ax = Math.max(-0.995, Math.min(0.995, x * 0.995));
    var len = 0.18 + 0.34 * rnd();
    var g = new THREE.PlaneGeometry(1, len); g.translate(0, -len / 2, 0);
    var dm = new THREE.Mesh(g, dripMat);
    dm.position.set(ax * (PLATE_R + 0.012), 0, Math.sqrt(1 - ax * ax) * (PLATE_R + 0.012));
    dm.renderOrder = 2;
    dripGroup.add(dm);
    drips.push({ m: dm, len: len });
  }
  var risers = [2, 6, 10, 13].map(function (k, i) {
    return { m: makeDot(dripGroup, 0, 0, 0), drip: drips[k], t: i / 4, speed: 0.2 + 0.05 * i };
  });

  /* ---------- frosting: lines falling onto the top tier, bead first; drips down its side ---------- */
  var frostMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, toneMapped: false,
    uniforms: { uOpacity: { value: 0.85 } },
    vertexShader: LINE_VERT,
    fragmentShader: 'uniform float uOpacity; varying vec2 vUv; varying float vY;' +
      'void main(){ float a = pow(1.0 - vUv.y, 1.3); gl_FragColor = vec4(vec3(1.0), a * uOpacity); }'
  });
  var frosting = [], FROST_MAX = 18, frostGroup = new THREE.Group();
  tiers[2].grp.add(frostGroup);
  for (var fi = 0; fi < FROST_MAX; fi++) {
    var fa = rnd() * Math.PI * 2, fr = Math.sqrt(rnd()) * TIERS[2].r * 0.85;
    var fl = 0.3 + 0.4 * rnd();
    var fg = new THREE.PlaneGeometry(1, fl); fg.translate(0, fl / 2, 0);
    var fm = new THREE.Mesh(fg, frostMat.clone());
    fm.renderOrder = 3;
    frostGroup.add(fm);
    var bead = makeDot(frostGroup, 0, 0, 0);
    frosting.push({ m: fm, bead: bead, x: Math.cos(fa) * fr, z: Math.sin(fa) * fr, len: fl, ph: rnd() });
  }
  // drips hanging from the top tier's rim (front half), bead at the tip
  var topDrips = [];
  for (var td = 0; td < 11; td++) {
    var ta = Math.PI * (0.08 + 0.84 * td / 10) + (rnd() - 0.5) * 0.08;   // front half (z > 0)
    var trr = tiers[2].rr + 0.003, tl0 = 0.1 + 0.26 * rnd();
    var P0 = new THREE.Vector3(Math.cos(ta) * trr, TIERS[2].h, Math.sin(ta) * trr);
    var P1 = new THREE.Vector3(P0.x, TIERS[2].h - tl0, P0.z);
    var tln = makeLine([P0, P1], { fine: true });
    tiers[2].grp.add(tln);
    topDrips.push({ l: tln, P0: P0, P1: P1, bead: makeDot(tiers[2].grp, P0.x, P0.y, P0.z), delay: rnd() * 0.55 });
  }

  /* ---------- timeline (30 s, timed on cake-ascent-30s frame by frame) ---------- */
  var tl = null;
  var TWEENS = [
    // [prop, to, start ms, duration ms, ease]
    // 0–2.5 s: only the data point
    ['ringIn', 1, 2400, 1100, 'inOutSine'],
    ['ringOut', 1, 3900, 1300, 'inOutSine'],
    ['camZoom', 0.72, 5000, 2500, 'inOutSine'],          // the video eases back a little as the rays come out
    ['midDots', 1, 4800, 400, 'outQuad'],
    ['rays', 1, 5200, 1700, 'outQuad'],
    ['frame', 1, 6400, 1500, 'inOutSine'],
    ['ringFaint', 1, 5000, 1600, 'inOutSine'],
    ['midDots', 0, 5800, 500, 'inQuad'],
    ['beads', 1, 7000, 2000, 'linear'],
    // the frame turns in its plane, then a FAST tilt to 3D
    ['frameRot', 1, 8000, 1200, 'inOutSine'], ['camZoom', 0.78, 8000, 1200, 'inOutSine'],
    ['raysOut', 1, 9000, 450, 'inQuad'],
    // camera path measured on the video (framing of plate / tier / star per second):
    // the tier being built stays at the centre, a real close-up on the star, then
    // a pull back, a push in on the plate and the stand, and a small final cake
    ['camEl', 24, 9100, 800, 'inOutQuad'], ['camZoom', 0.7, 9100, 800, 'inOutQuad'], ['camY', 0.3, 9100, 800, 'inOutQuad'],
    ['camY', 0.57, 10200, 2800, 'inOutSine'], ['camZoom', 0.93, 10200, 2800, 'inOutSine'],
    ['camY', 0.87, 13000, 2400, 'inOutSine'], ['camZoom', 1.15, 13000, 2400, 'inOutSine'],
    ['camY', 1.08, 15400, 2000, 'inOutSine'], ['camZoom', 1.45, 15400, 2000, 'inOutSine'],
    ['camY', 1.05, 17400, 1000, 'inOutSine'], ['camZoom', 1.56, 17400, 1000, 'inOutSine'],
    ['camZoom', 1.24, 18400, 1200, 'inOutSine'],
    ['camZoom', 0.92, 19600, 2000, 'inOutSine'], ['camY', 0.7, 19600, 2000, 'inOutSine'],
    ['camZoom', 1.17, 21600, 2400, 'inOutSine'], ['camY', -0.2, 21600, 2400, 'inOutSine'],
    ['camZoom', 0.58, 24000, 2000, 'inOutCubic'], ['camY', 0.52, 24000, 2000, 'inOutCubic'],
    ['dotsOut', 1, 9400, 900, 'inOutSine'],
    ['plateIn', 1, 9500, 900, 'inOutSine'],
    ['fronts', 1, 9800, 1200, 'inOutSine'],
    ['footIn', 1, 10600, 900, 'outCubic'],
    // bottom tier
    // each tier: the dotted side lines grow UP (glass rising with them), then the cap: rim beads, rim, swags
    ['grid0', 1, 10300, 1000, 'inOutSine'], ['grow0', 1, 10400, 1000, 'inOutSine'],
    ['rimDots0', 1, 11100, 800, 'outCubic'], ['rim0', 1, 11400, 800, 'inOutSine'], ['swag0', 1, 12200, 800, 'inOutSine'],
    // middle tier
    ['grid1', 1, 13000, 1000, 'inOutSine'], ['grow1', 1, 13100, 1000, 'inOutSine'],
    ['rimDots1', 1, 13800, 800, 'outCubic'], ['rim1', 1, 14100, 700, 'inOutSine'], ['swag1', 1, 14800, 700, 'inOutSine'],
    // top tier
    ['grid2', 1, 15300, 900, 'inOutSine'], ['grow2', 1, 15400, 900, 'inOutSine'],
    ['rimDots2', 1, 16000, 700, 'outCubic'], ['rim2', 1, 16300, 700, 'inOutSine'], ['swag2', 1, 17000, 600, 'inOutSine'],
    // close-up: star from four beads, then the frosting
    ['starDots', 1, 17700, 500, 'outQuad'], ['starDraw', 1, 18000, 900, 'inOutSine'], ['starIn', 1, 18600, 1300, 'outCubic'],
    ['frostOn', 1, 18900, 600, 'linear'],
    // pull back; drips on the top tier, beads around the plate, dashed drips under it
    ['topDrips', 1, 20200, 2600, 'linear'],
    ['dripIn', 1, 21500, 1500, 'inOutSine'],
    ['floatDots', 1, 22000, 1200, 'inOutSine'],
    // hold, then a slow dissolve back to the data point (the video just ends; the loop needs a way back)
    ['frostOn', 0, 27400, 1400, 'inOutSine'],
    ['fadeAll', 0, 27600, 2000, 'inOutSine'], ['dotIn', 0, 27600, 2000, 'inOutSine'],
    ['camEl', 89, 28300, 1500, 'inOutCubic'], ['camZoom', 0.8, 28300, 1500, 'inOutCubic'],
    ['camY', 0, 28300, 1500, 'inOutCubic']
  ];
  var RESET = { ringIn: 0, ringOut: 0, ringFaint: 0, midDots: 0, rays: 0, frame: 0, beads: 0, frameRot: 0,
    raysOut: 0, dotsOut: 0, plateIn: 0, fronts: 0, footIn: 0, starDots: 0, starDraw: 0, starIn: 0,
    topDrips: 0, dripIn: 0, floatDots: 0, dotIn: 0 };
  [0, 1, 2].forEach(function (i) {
    ['rimDots', 'rim', 'grow', 'grid', 'swag'].forEach(function (k) { RESET[k + i] = 0; });
  });
  Object.keys(RESET).forEach(function (k) { state[k] = RESET[k]; });
  // the video holds the lone dot 2.2 s before drawing; here construction starts at once:
  // every tween above is moved SHIFT ms earlier. The loop ends with 0.5 s of pure black.
  var SHIFT = 2200, BLACK_FROM = 29600 - SHIFT, LOOP = BLACK_FROM + 500;
  function startTimeline() {
    var an = window.anime;
    if (!an || !an.createTimeline) { finalState(); return; }
    tl = an.createTimeline({ loop: !reduced, autoplay: !reduced });
    // in time order: each tween of a property starts from where the previous one ended
    tl.add(state, { dotIn: 1, duration: 300, ease: 'outQuad' }, 0);
    TWEENS.slice().sort(function (p, q) { return p[2] - q[2]; }).forEach(function (w) {
      var o = { duration: w[3], ease: w[4] }; o[w[0]] = w[1];
      tl.add(state, o, Math.max(0, w[2] - SHIFT));
    });
    // invisible reset, then the cake parts are allowed to show again
    var r = { duration: 10, ease: 'linear' };
    Object.keys(RESET).forEach(function (k) { r[k] = RESET[k]; });
    tl.add(state, r, BLACK_FROM + 100);
    tl.add(state, { fadeAll: 1, duration: 10, ease: 'linear' }, BLACK_FROM + 250);
    tl.add(state, { end: 1, duration: 10, ease: 'linear' }, LOOP - 10);
    if (reduced) { tl.seek(27000 - SHIFT); tl.pause(); }
    applySpeed();
  }
  function finalState() {
    Object.keys(RESET).forEach(function (k) { state[k] = 1; });
    state.frostOn = 1; state.camEl = 24; state.camZoom = 0.58; state.camY = 0.52;
  }
  function applySpeed() { if (tl && tl.speed !== undefined) tl.speed = TUNE.motion.speed; }

  /* ---------- star spin (ambient + hover) ---------- */
  var spin = { p: 0, busy: false };
  function spinStar() {
    if (reduced || spin.busy || state.starIn < 0.98 || state.fadeAll < 0.98) return false;
    var an = window.anime;
    if (!an || !an.animate) return false;
    spin.busy = true; spin.p = 0;
    an.animate(spin, { p: 1, duration: 1100, ease: 'inOutSine',
      onComplete: function () { state.spin += Math.PI / 2; spin.p = 0; spin.busy = false; } });
    return true;
  }
  if (!reduced) setInterval(function () { if (visible) spinStar(); }, 4200);

  /* ---------- hover: lift a tier / spin the star; parallax ---------- */
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

  /* ---------- sizing ---------- */
  var W = 0, H = 0, PPW = 100, fitPPW = 100, dpr = 1;
  function resize() {
    var r = stage.getBoundingClientRect();
    if (!r.width) return;
    W = Math.round(r.width); H = Math.round(r.height || r.width * 824 / 1078);
    dpr = Math.min(window.devicePixelRatio || 1, TUNE.quality.dprMax || 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(W, H); }
    if (fxaaPass) fxaaPass.material.uniforms.resolution.value.set(1 / (W * dpr), 1 / (H * dpr));
    var pr = TUNE.quality.preRes || 1;
    backRT.setSize(Math.max(2, Math.round(W * dpr * pr)), Math.max(2, Math.round(H * dpr * pr)));
    var bw = Math.max(2, Math.round(W * dpr * 0.25)), bh = Math.max(2, Math.round(H * dpr * 0.25));
    blurRT1.setSize(bw, bh); blurRT2.setSize(bw, bh);
    blurMat.uniforms.uTexel.value.set(1 / bw, 1 / bh);
    RES.value.set(W / 2, H / 2);
    // zoom 1 = the finished cake (stand, drips and star) fits at 23°
    var se = Math.sin(23 * Math.PI / 180), ce = Math.cos(23 * Math.PI / 180);
    var stackTop = PLATE_H + TIERS[0].h + TIERS[1].h + TIERS[2].h + STAR_H;
    var yTop = (stackTop - 0.14) * ce + TIERS[2].r * se, yBot = (-0.55 - 0.14) * ce - PLATE_R * se;
    var half = Math.max(Math.abs(yTop), Math.abs(yBot)) * 1.1;
    fitPPW = Math.min(W / (2 * 1.25), H / (2 * half));
    frame();
  }
  function frame() {
    PPW = fitPPW * state.camZoom * TUNE.view.scale;
    lookY = state.camY;
    placeCamera();
    camera.left = -W / PPW / 2; camera.right = W / PPW / 2;
    camera.top = H / PPW / 2; camera.bottom = -H / PPW / 2;
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
        uniforms: { tDiffuse: { value: null }, uFloor: { value: 0.05 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform sampler2D tDiffuse; uniform float uFloor; varying vec2 vUv;' +
          'void main(){ vec4 c = texture2D(tDiffuse, vUv);' +
          // soft edge mask: the bloom haze is clipped by the canvas edge, which reads as a box on small screens
          '  vec2 e = smoothstep(vec2(0.0), vec2(0.07), vUv) * smoothstep(vec2(0.0), vec2(0.07), 1.0 - vUv);' +
          '  float haze = 1.0 - smoothstep(0.0, 0.25, max(max(c.r, c.g), c.b));' +
          '  float m = mix(1.0, e.x * e.y, haze);' +
          '  gl_FragColor = vec4(max(c.rgb * m - uFloor, 0.0) / (1.0 - uFloor), 1.0); }'
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
  window.CAKE3D_INFO = function () {
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
      ud.preMat.color.copy(ud.basePre).multiplyScalar(TUNE.pre * f);
      var rl = gm.userData.rim;
      rl.material.opacity = Math.min(1, rl.userData.baseOp * TUNE.rim) * f;
      gm.visible = f > 0.002;
    }
    bgQuad.material.color.set(TUNE.backdrop);
    blurMat.uniforms.uRadius.value = TUNE.frostRadius;
    if (bloomPass) {
      bloomPass.strength = TUNE.bloom.strength; bloomPass.radius = TUNE.bloom.radius; bloomPass.threshold = TUNE.bloom.threshold;
    }
    if (floorPass) floorPass.uniforms.uFloor.value = Math.min(0.5, Math.max(0, TUNE.blackFloor));
    for (var l = 0; l < lines.length; l++) {
      lines[l].material.uniforms.uWidth.value = lines[l].userData.fine ? TUNE.lines.finePx : TUNE.lines.px;
    }
    dripMat.uniforms.uDash.value = TUNE.drips.dash;
    dripMat.uniforms.uDuty.value = TUNE.drips.duty;
    if (fxaaPass) fxaaPass.enabled = !!(+TUNE.quality.fxaa);
    if (+TUNE.quality.msaa !== _lastQ.msaa) { _lastQ.msaa = +TUNE.quality.msaa; setMsaa(_lastQ.msaa); }
    if (TUNE.quality.dprMax !== _lastQ.dprMax || TUNE.quality.preRes !== _lastQ.preRes) {
      _lastQ.dprMax = TUNE.quality.dprMax; _lastQ.preRes = TUNE.quality.preRes; resize();
    }
    if (TUNE.motion.speed !== _lastQ.speed) { _lastQ.speed = TUNE.motion.speed; applySpeed(); }
  }

  /* ---------- render loop ---------- */
  var visible = true, running = false, last = performance.now(), clock = 0;
  var _wp = new THREE.Vector3();
  function clamp01(t) { return t < 0 ? 0 : (t > 1 ? 1 : t); }
  function ease(t) { t = clamp01(t); return t * t * (3 - 2 * t); }
  function render(now) {
    running = false;
    var dt = Math.min(0.05, (now - last) / 1000) * (reduced ? 0 : TUNE.motion.speed);
    last = now; clock += dt;
    var F = state.fadeAll, dotR = TUNE.dots.px / PPW / 2;

    mouse.cx += (mouse.x - mouse.cx) * 0.055;
    mouse.cy += (mouse.y - mouse.cy) * 0.055;
    root.rotation.y = -mouse.cx * 0.22;
    root.rotation.x = mouse.cy * 0.05;
    frame();
    var tilt = clamp01((89 - state.camEl) / 63);   // 0 flat view … 1 3D

    // --- opening drawing ---
    BACK.value = 1 + (TUNE.lines.backArc - 1) * tilt;     // far half of rims: full in the flat view
    setDot(centerDot, state.dotIn);
    centerDot.scale.setScalar(dotR * 0.75);
    var dOut = 1 - state.dotsOut;
    RINGS.forEach(function (R, i) {
      var prog = state[R.key], op;
      if (i === 0) op = 1 - ease((tilt - 0.2) / 0.5);           // inner ring: the top tier is built later
      else if (i === 1) op = 1 - ease(state.plateIn);           // outer ring hands over to the plate's rim
      else op = 1 - ease((tilt - 0.2) / 0.6);
      setLine(R.line, prog, op * F);
      if (R.heads) setHeads(R.heads, R.r, RING_Y, prog, op * F, dotR);
    });
    midDots.forEach(function (d) { setDot(d, state.midDots * (1 - ease(tilt / 0.4))); d.scale.setScalar(dotR * 0.55); });
    rayGroup.rotation.y = -0.07 * state.frameRot;      // right side dips, as in the video
    var rOut = 1 - state.raysOut;
    rays.forEach(function (ry) {
      var p = ease(clamp01((state.rays - ry.delay) / 0.55));
      setLine(ry.l, p, rOut);
      ry.head.position.lerpVectors(ry.A, ry.B, p);               // the tip bead leads the ray
      setDot(ry.head, (p > 0.001 ? 1 : 0) * dOut);
      ry.head.scale.setScalar(dotR * 0.8);
      if (ry.loose) { setDot(ry.loose, (p > 0.95 ? 1 : 0) * dOut); ry.loose.scale.setScalar(dotR * 0.6); }
      if (ry.bead) {                                               // data beads travel in along the ray
        var bp = clamp01((state.beads - ry.bd) / 0.55);
        ry.bead.position.lerpVectors(ry.B, ry.A, ease(bp));
        setDot(ry.bead, (bp > 0 && bp < 1 ? 1 : 0) * rOut);
        ry.bead.scale.setScalar(dotR * 0.7);
      }
    });
    setLine(frameLine, state.frame, rOut);

    // --- plate + stand + the two front verticals ---
    var pin = state.plateIn * F, fin = state.footIn * F;
    plateMesh.userData.fade = pin;
    plateMesh.scale.y = Math.max(0.001, state.plateIn);
    setLine(plateTop, 1, pin); setLine(plateBot, 1, pin);
    foot.scale.y = Math.max(0.001, ease(state.footIn));
    stemMesh.userData.fade = fin; footMesh.userData.fade = fin;
    setLine(footTop, state.footIn, F); setLine(footBot, state.footIn, F * 0.7);
    fronts.forEach(function (l) { setLine(l, state.fronts, F * 0.9); });

    // --- tiers: rim beads fly in, rim draws, wall comes down, grid, swags ---
    tiers.forEach(function (t, i) {
      var g = state['grow' + i], rimP = state['rim' + i], rd = state['rimDots' + i], tf = F;
      t.grp.position.y = BASE[i] + t.grp.userData.lift;
      // only lines while the sides grow; the glass (and its top) fills in with the cap
      t.wall.scale.y = 1;
      t.mesh.userData.fade = tf * ease(rimP);
      setLine(t.top, rimP, tf);
      setHeads(t.heads, t.rr, TIERS[i].h, rimP, tf, dotR);
      setLine(t.bottom, 1, tf * ease(state['grid' + i] / 0.12));  // base ring first, same width as the rim
      t.sil.rotation.y = -root.rotation.y;
      t.sil.userData.l.forEach(function (l) { setLine(l, state['grid' + i], tf * TUNE.lines.silhouettes); });
      var gp = state['grid' + i];
      t.grid.forEach(function (l) { setLine(l, gp, tf * TUNE.grid.opacity); l.material.uniforms.uDash.value = TUNE.grid.dash; });
      setLine(t.swag, state['swag' + i], tf);
      t.joints.forEach(function (d) {
        var p = ease(clamp01((rd - d.userData.delay) / 0.65));
        d.position.lerpVectors(d.userData.from, d.userData.to, p);
        setDot(d, (rd > d.userData.delay ? 1 : 0) * tf);
        d.scale.setScalar(dotR * 0.75);
      });
    });

    // --- star: four beads, the arcs between them, then the glass ---
    var sIn = ease(state.starIn), spinA = state.spin + (spin.busy ? Math.sin(spin.p * Math.PI / 2) * Math.PI / 2 : 0);
    starPivot.position.y = TOP_Y + tiers[2].grp.userData.lift + 0.004 + (spin.busy ? Math.sin(spin.p * Math.PI) * 0.06 : 0);
    starPivot.rotation.y = TUNE.view.starAngle * Math.PI / 180 + spinA;
    setLine(starLine, state.starDraw, F);
    starTips.forEach(function (d) { setDot(d, state.starDots * F); d.scale.setScalar(dotR * 0.85); });
    starMesh.userData.fade = sIn * F;
    starMesh.scale.setScalar(0.9 + 0.1 * sIn);

    // --- dashed drips under the plate + risers ---
    var dIn = state.dripIn * F;
    dripMat.uniforms.uOffset.value += dt * TUNE.drips.flow;
    dripMat.uniforms.uOpacity.value = TUNE.drips.opacity * dIn;
    dripGroup.visible = dIn > 0.002;
    var wpx = TUNE.lines.finePx / PPW;
    drips.forEach(function (d) { d.m.scale.x = wpx; d.m.rotation.y = -root.rotation.y; });
    risers.forEach(function (rs) {
      rs.t += dt * rs.speed;
      if (rs.t > 1) rs.t -= 1;
      var dp = rs.drip.m.position;
      rs.m.position.set(dp.x, -rs.drip.len * (1 - rs.t) * 0.92, dp.z);
      setDot(rs.m, ease(rs.t / 0.15) * (1 - ease((rs.t - 0.85) / 0.15)) * dIn);
      rs.m.scale.setScalar(dotR * 0.7);
    });
    // beads floating around the plate and the stand
    floaters.forEach(function (fl) {
      var k = ease((state.floatDots - fl.delay) / 0.4) * F;
      fl.m.position.set(Math.cos(fl.a + clock * 0.03) * fl.r, fl.y + Math.sin(clock * 0.8 + fl.ph) * 0.015, Math.sin(fl.a + clock * 0.03) * fl.r);
      setDot(fl.m, k);
      fl.m.scale.setScalar(dotR * 0.6);
    });

    // --- frosting: each line falls bead-first, lands, fades, waits, again ---
    var nF = Math.max(0, Math.min(FROST_MAX, Math.round(TUNE.frosting.lines)));
    var fOn = state.frostOn * F;
    frostGroup.visible = fOn > 0.002;
    frosting.forEach(function (fr, i) {
      var ph = (clock * TUNE.frosting.rate * 0.5 + fr.ph) % 1;
      var fall = ease(ph / 0.45), out = 1 - ease((ph - 0.5) / 0.25);
      var on = i < nF ? fOn * (ph < 0.75 ? 1 : 0) * out : 0;
      var y = TIERS[2].h + 0.004 + (1 - fall) * 1.2;
      fr.m.visible = on > 0.002;
      fr.m.position.set(fr.x, y, fr.z);
      fr.m.rotation.y = -root.rotation.y;
      fr.m.scale.x = TUNE.lines.finePx / PPW;
      fr.m.material.uniforms.uOpacity.value = TUNE.frosting.opacity * on * ease(ph / 0.08);
      fr.bead.position.set(fr.x, y, fr.z);                      // the bead leads, at the bottom tip
      setDot(fr.bead, on);
      fr.bead.scale.setScalar(dotR * 0.8);
    });
    topDrips.forEach(function (d) {
      var p = ease(clamp01((state.topDrips - d.delay) / 0.45));
      setLine(d.l, p, F);
      d.bead.position.lerpVectors(d.P0, d.P1, p);
      setDot(d.bead, (p > 0.001 ? 1 : 0) * F);
      d.bead.scale.setScalar(dotR * 0.7);
    });

    // dot opacity (beads fade by size and alpha)
    for (var di2 = 0; di2 < dotsAll.length; di2++) dotsAll[di2].material.opacity = dotsAll[di2].userData.k;
    underLight.intensity = 0.5 + 0.4 * tilt;

    applyTune();

    // per-piece lens centres
    for (var ci = 0; ci < glassMeshes.length; ci++) {
      var cm = glassMeshes[ci];
      if (!cm.visible) continue;
      cm.getWorldPosition(_wp);
      _wp.project(camera);
      cm.material.uniforms.uCenter.value.set(_wp.x * 0.5 + 0.5, _wp.y * 0.5 + 0.5);
    }

    // PRE-PASS → backRT, frost blur
    bgQuad.visible = true;
    bgQuad.quaternion.copy(camera.quaternion);
    bgQuad.position.copy(VIEW).multiplyScalar(-8); bgQuad.position.y += lookY;
    bgQuad.scale.set((camera.right - camera.left) * 1.1, (camera.top - camera.bottom) * 1.1, 1);
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
      if (tl && !reduced) { visible ? tl.play() : tl.pause(); }
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

  window.__cake3d = { state: state, renderer: renderer, camera: camera, scene: scene, timeline: function () { return tl; } };

  /* ---------- go ---------- */
  resize();
  startTimeline();
  schedule();
})();
