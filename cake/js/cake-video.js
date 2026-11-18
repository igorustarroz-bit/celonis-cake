/* =========================================================================
   Cake — evolved video illustrations: playback + tuner panel.

   Loaded only by version pages whose slots are .mp4 (make-version.py adds it).
   window.CAKE_VIDEO is the live settings object; the panel (key T) writes it
   and apply() pushes it to the page: CSS custom properties on :root for the
   look (css/cake-video.css), playbackRate and play/pause for the motion.

   - Videos play only while on screen (IntersectionObserver), muted + looped.
   - prefers-reduced-motion: nothing autoplays; each slot shows its poster
     (the last frame, the finished drawing). The panel can still start them.
   - The panel is built from <div>s by ../../js/tuner-ui.js, so the page still
     has 0 form elements (anti-phishing rule 12).
   ========================================================================= */
(function () {
  'use strict';

  var S = window.CAKE_VIDEO = window.CAKE_VIDEO || {
    playing: 1,          // 1 = play when on screen, 0 = hold every video
    speed: 1,            // playbackRate
    offscreenPause: 1,   // pause videos that are out of the viewport
    contrast: 1,         // line weight, after the invert on light modules
    brightness: 1,
    fit: 'contain',      // contain = whole frame, cover = crop to the slot
    aspect: '4/3',       // slot shape: the template's 4:3, or the footage's 16:9
    blendLight: 'multiply',
    blendDark: 'screen'
  };

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) S.playing = 0;
  var seen = new WeakMap();

  function vids() { return [].slice.call(document.querySelectorAll('video.cake-video')); }

  function want(v) { return S.playing && (!S.offscreenPause || seen.get(v) !== false); }

  function sync() {
    vids().forEach(function (v) {
      if (want(v)) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      else v.pause();
    });
  }

  function apply() {
    var r = document.documentElement.style;
    r.setProperty('--cv-contrast', S.contrast);
    r.setProperty('--cv-brightness', S.brightness);
    r.setProperty('--cv-fit', S.fit);
    r.setProperty('--cv-aspect', String(S.aspect).replace('/', ' / '));
    r.setProperty('--cv-blend-light', S.blendLight);
    r.setProperty('--cv-blend-dark', S.blendDark);
    vids().forEach(function (v) { v.defaultPlaybackRate = v.playbackRate = +S.speed || 1; });
    sync();
  }
  window.CAKE_VIDEO_APPLY = apply;

  function init() {
    var list = vids();
    list.forEach(function (v) {
      v.muted = true;
      if (reduce) { v.removeAttribute('autoplay'); v.pause(); }
    });
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { seen.set(e.target, e.isIntersecting); });
        sync();
      }, { rootMargin: '100px 0px' });
      list.forEach(function (v) { io.observe(v); });
    }
    apply();
    tuner();
  }

  function tuner() {
    if (!window.TunerUI) { setTimeout(tuner, 300); return; }
    var p = window.TunerUI.create({
      id: 'cv-tuner',
      title: 'VIDEO TUNER',
      accent: '#5cfe50',
      target: S,
      onChange: apply,
      onReset: apply
    });

    p.button('Play / pause all', function () {
      S.playing = S.playing ? 0 : 1; p.refresh(); apply();
    }, true);
    p.button('Restart all', function () {
      vids().forEach(function (v) { v.currentTime = 0; }); sync();
    });

    p.section('Playback');
    p.choice('playing', 'playing', [1, 0]);
    p.slider('speed', 'speed', 0.25, 2, 0.05);
    p.choice('pause off-screen', 'offscreenPause', [1, 0]);

    p.section('Look');
    p.slider('line contrast', 'contrast', 0.5, 3, 0.05);
    p.slider('brightness', 'brightness', 0.5, 1.5, 0.01);
    p.choice('fit', 'fit', ['contain', 'cover']);
    p.choice('slot shape', 'aspect', ['4/3', '16/9']);
    p.choice('blend on light', 'blendLight', ['multiply', 'normal']);
    p.choice('blend on dark (hero)', 'blendDark', ['screen', 'normal']);

    p.readout(function () {
      return vids().map(function (v) {
        return v.dataset.slot + ' ' + v.currentTime.toFixed(1) + '/' + (v.duration || 0).toFixed(0) + 's' +
               (v.paused ? ' ❚❚' : '');
      }).join(' · ') + (reduce ? ' · reduced motion' : '');
    });

    p.actions();
    p.aem({
      block: 'Interactive Asset',
      rows: [['name', 'CakeVideo']]
    });
    p.hint();
    p.mount();
    window.TunerUI.hotkey(p, 't');
  }

  document.readyState !== 'loading' ? init() : document.addEventListener('DOMContentLoaded', init);
})();
