/* =========================================================================
   Cake glass tuner — knobs wired to window.CAKE3D (js/cake-3d.js), which the
   render loop reads every frame. Built on the shared kit (js/tuner-ui.js):
   collapsed pill bottom-right, expands upwards, × or T hides it, double-click
   a row to reset that knob, Copy settings exports the JSON.
   Same glass sections as the Data Core tuner, plus the line-art and motion
   knobs of the cake; the Sharpness section always reports what is really in
   effect (CAKE3D_INFO) — Igor's standing rule.
   ========================================================================= */
(function () {
  'use strict';

  function build() {
    var T = window.CAKE3D;
    if (!T || !window.TunerUI) { setTimeout(build, 300); return; }

    var p = window.TunerUI.create({
      id: 'cake3d-tuner', title: 'GLASS TUNER', accent: '#5cfe50',
      target: T, onChange: function () {}
    });

    p.section('Line art');
    p.slider('line width px', 'lines.px', 0.5, 5, 0.1);
    p.slider('fine line px', 'lines.finePx', 0.3, 4, 0.1);
    p.slider('line opacity', 'lines.opacity', 0, 1, 0.01);
    p.choice('silhouettes', 'lines.silhouettes', [0, 1]);
    p.slider('far half of rims', 'lines.backArc', 0, 1, 0.01);
    p.slider('grid opacity', 'grid.opacity', 0, 1, 0.01);
    p.slider('grid dash', 'grid.dash', 0.005, 0.08, 0.001);
    p.slider('dot size px', 'dots.px', 0, 24, 0.5);
    p.slider('dot orbit', 'dots.orbit', 0, 1, 0.01);
    p.slider('drip opacity', 'drips.opacity', 0, 1, 0.01);
    p.slider('drip flow', 'drips.flow', 0, 0.6, 0.01);
    p.slider('dash length', 'drips.dash', 0.01, 0.15, 0.001);
    p.slider('dash duty', 'drips.duty', 0.1, 0.9, 0.01);
    p.slider('frosting lines', 'frosting.lines', 0, 18, 1);
    p.slider('frosting opacity', 'frosting.opacity', 0, 1, 0.01);
    p.slider('frosting rate', 'frosting.rate', 0.1, 2, 0.01);

    p.section('Motion & view');
    p.slider('speed', 'motion.speed', 0, 2, 0.05);
    p.slider('parallax', 'motion.parallax', 0, 2, 0.05);
    p.slider('scale', 'view.scale', 0.5, 1.5, 0.01);
    p.slider('star angle °', 'view.starAngle', -90, 90, 1);
    p.readout(function () {
      var c = window.__cake3d, tl = c && c.timeline && c.timeline();
      return tl ? 'timeline: ' + (tl.currentTime / 1000 % 30).toFixed(1) + ' s of 30' : '…';
    });

    p.section('Glass tint');
    p.slider('tint R', 'tint.r', 0.4, 1.8, 0.01);
    p.slider('tint G', 'tint.g', 0.4, 1.8, 0.01);
    p.slider('tint B', 'tint.b', 0.4, 1.8, 0.01);

    p.section('Transparency');
    p.slider('transmission', 'transmission', 0, 1, 0.01);
    p.slider('+ on explode', 'transmissionSpread', 0, 0.5, 0.01);
    p.slider('refraction', 'refract', 0, 3, 0.01);
    p.slider('frost blur', 'frost', 0, 1, 0.01);
    p.slider('blur radius', 'frostRadius', 0, 4, 0.01);
    p.slider('piece magnify', 'pieceMag', 0.6, 1.2, 0.01);
    p.slider('piece shift', 'pieceShift', 0, 1.5, 0.01);
    p.slider('body (tops)', 'body', 0, 3, 0.01);
    p.slider('see-through (pre)', 'pre', 0, 3, 0.01);

    p.section('Clear tops');
    p.slider('top clarity', 'topClear', 0, 1, 0.01);
    p.slider('through glow', 'topDarken', 0, 1.5, 0.01);
    p.slider('edge white', 'edgeWhite', 0, 1.2, 0.01);

    p.section('Edges & glow');
    p.slider('fresnel', 'fresnel', 0, 1.5, 0.01);
    p.colour('sky top', 'skyTop');
    p.colour('sky horizon', 'skyHorizon');
    p.slider('light rims', 'rim', 0, 3, 0.01);
    p.slider('iridescence', 'iri', 0, 0.6, 0.01);

    p.section('Sharpness');
    p.choice('MSAA samples', 'quality.msaa', [0, 2, 4, 8]);
    p.choice('FXAA', 'quality.fxaa', [0, 1]);
    p.slider('max pixel ratio', 'quality.dprMax', 0.5, 3, 0.25);
    p.slider('pre-pass res', 'quality.preRes', 0.2, 1, 0.05);
    p.readout(function () {
      if (!window.CAKE3D_INFO) return '…';
      var i = window.CAKE3D_INFO();
      return 'in effect: ' + (i.webgl2 ? 'WebGL2, MSAA ' + i.msaaSamples + 'x' : 'WebGL1, no MSAA') +
             ', FXAA ' + (i.fxaa ? 'on' : 'off') + ', dpr ' + i.pixelRatio.toFixed(2);
    });

    p.section('Backdrop & bloom');
    p.colour('studio backdrop', 'backdrop');
    p.slider('bloom strength', 'bloom.strength', 0, 1.5, 0.01);
    p.slider('bloom radius', 'bloom.radius', 0, 1, 0.01);
    p.slider('bloom threshold', 'bloom.threshold', 0, 1, 0.01);
    p.slider('black floor', 'blackFloor', 0, 0.2, 0.005);

    p.actions();
    p.hint();
    p.mount();
    window.TunerUI.hotkey(p, 't');

    window.CAKE3D_TUNER = {
      show: function () { p.show(); }, hide: function () { p.hide(); },
      open: function () { p.show().open(); }, toggle: function () { p.toggle(); }
    };
  }

  window.TunerUI ? window.TunerUI.ready(build)
                 : (document.readyState !== 'loading' ? build()
                    : document.addEventListener('DOMContentLoaded', build));
})();
