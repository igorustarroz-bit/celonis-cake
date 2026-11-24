// Capture a WebGL slot of a version as PNG frames (2x), driving its timeline frame by frame.
// Needs Node + Playwright (Chromium). Used by export-webp.sh.
// node cake/tools/capture-webgl.js <version> <slot> <totalMs> <fps> <outdir>   (totalMs 0 = one still frame)
const { chromium } = require('playwright');
const [ver, slot, total, fps, out] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await p.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (t, o) { if (/webgl/.test(t)) o = Object.assign({}, o, { preserveDrawingBuffer: true }); return g.call(this, t, o); }; });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'versions', ver, 'index.html'));
  await p.addStyleTag({ content: '#cake3d-tuner,header,.header-wrapper{visibility:hidden!important}' });
  await p.addStyleTag({ content: `.cake-3d-stage:not([data-slot="${slot}"]) canvas{display:none!important}` });
  const el = await p.$(`.cake-3d-stage[data-slot="${slot}"]`);
  await el.evaluate(n => n.scrollIntoView({ block: 'center' }));
  await p.waitForTimeout(2500);
  const raf2 = () => p.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const n = +total ? Math.round(+total / 1000 * +fps) : 1;
  for (let i = 0; i < n; i++) {
    const t = i * 1000 / +fps;
    if (+total) await p.evaluate(([slot, t]) => {
      window.CAKE3D.motion.speed = 0.0001;
      const api = window.__cake3dAll.find(a => a.slot === slot);
      const tl = slot === 'hero' && api.timeline && api.timeline();
      if (tl) { tl.pause(); tl.seek(t); } else api.seg(t);   // classic-3d hero: no timeline, seg() drives its ambient loop
    }, [slot, t]);
    await raf2();
    // read the canvas right after a render, in the same frame (much faster than a page screenshot)
    const url = await p.evaluate((slot) => new Promise(r => requestAnimationFrame(() => {
      const api = window.__cake3dAll.find(a => a.slot === slot);
      setTimeout(() => r(document.querySelector(`.cake-3d-stage[data-slot="${slot}"] canvas`).toDataURL('image/png')), 0);
    })), slot);
    require('fs').writeFileSync(`${out}/${String(i).padStart(4, '0')}.png`, Buffer.from(url.split(',')[1], 'base64'));
  }
  if (errs.length) console.log('ERR', errs.slice(0, 3));
  await b.close();
})();
