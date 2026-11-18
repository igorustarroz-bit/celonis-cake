/* cake.js v1 — page behaviour for the Cake prototype (vanilla, no network).
   What the site does with its block JS, re-implemented for the blocks used here:
   text-only reveal, question marquee measuring, anchor-menu indicator, one-open
   accordions; plus the tabs that Figma's M09 asks for. The header's hide-on-scroll
   comes from the shared nav-fx.js. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Header layering — same fix as experiment 7 (solutions-fx/header-layers.js, claude_solutions_context.md
     §23.2-24.3): publish the measured bar height and mirror nav-fx's state onto <html>, so the sticky
     anchor menu parks under the header while it is down and at the very top while nav-fx has faded it. */
  const bar = document.querySelector('.nav-wrapper');
  if (bar) {
    let last = -1;
    const measure = () => {
      const h = bar.offsetHeight;
      if (h && h !== last) { last = h; document.documentElement.style.setProperty('--cake-nav-h', `${h}px`); }
    };
    const mirror = () => document.documentElement.setAttribute('data-cake-nav', bar.classList.contains('nav-hidden') ? 'hidden' : 'shown');
    measure(); mirror();
    new MutationObserver(mirror).observe(bar, { attributes: true, attributeFilter: ['class'] });
    if (window.ResizeObserver) new ResizeObserver(measure).observe(bar);
    addEventListener('resize', measure, { passive: true });
    document.fonts && document.fonts.ready.then(measure);
  }

  /* Disabled links: every "#" link does nothing (prototype) */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href="#"]');
    if (a) e.preventDefault();
  });

  /* text-only: words light up once the paragraph is in view (the block's .visible class) */
  const paras = document.querySelectorAll('.text-only p:not(.button-container)');
  if (reduce || !('IntersectionObserver' in window)) paras.forEach((p) => p.classList.add('visible'));
  else {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
    }), { threshold: 0.4 });
    paras.forEach((p) => io.observe(p));
  }

  /* question: the block's CSS animates with --marquise-item-width / --marquise-el-width */
  const measureMarquee = () => document.querySelectorAll('.question .question-text-row').forEach((row) => {
    const items = row.querySelectorAll('.question-text');
    if (!items.length) return;
    row.style.setProperty('--marquise-item-width', `${-100 / items.length}%`);
    row.style.setProperty('--marquise-el-width', items[0].getBoundingClientRect().width);
    if (reduce) row.classList.remove('question-animate');
  });
  measureMarquee();
  document.fonts && document.fonts.ready.then(measureMarquee);
  addEventListener('resize', measureMarquee);

  /* anchor-secondary-menu: active item + sliding indicator (the block reads --indicator-*) */
  const menu = document.querySelector('.anchor-secondary-menu ul');
  if (menu) {
    const items = [...menu.querySelectorAll('li')];
    const targets = items.map((li) => document.querySelector(li.querySelector('a').getAttribute('href')));
    const setActive = (i) => {
      items.forEach((li, k) => (k === i ? li.setAttribute('aria-current', 'true') : li.removeAttribute('aria-current')));
      const li = items[i];
      if (!li) { menu.style.setProperty('--indicator-scale', 0); return; }
      menu.style.setProperty('--indicator-scale', li.offsetWidth);
      menu.style.setProperty('--indicator-offset', li.offsetLeft);
      const scroller = menu.closest('.anchor-secondary-menu');
      if (scroller && scroller.scrollWidth > scroller.clientWidth) {
        scroller.scrollTo({ left: li.offsetLeft - 20, behavior: reduce ? 'auto' : 'smooth' });
      }
    };
    let current = -1;
    const onScroll = () => {
      const line = innerHeight * 0.3;
      let idx = -1;
      targets.forEach((t, k) => { if (t && t.getBoundingClientRect().top <= line) idx = k; });
      if (idx !== current) { current = idx; setActive(idx); }
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', () => { current = -2; onScroll(); });
    onScroll();
  }

  /* collapse-expand: one item open at a time per block */
  document.querySelectorAll('.accordion[data-exclusive]').forEach((acc) => {
    acc.addEventListener('toggle', (e) => {
      if (!e.target.open) return;
      acc.querySelectorAll('details[open]').forEach((d) => { if (d !== e.target) d.open = false; });
    }, true);
  });

  /* M09 tabs (ARIA tabs pattern, arrow keys) */
  document.querySelectorAll('.cake-tabs').forEach((wrap) => {
    const tabs = [...wrap.querySelectorAll('[role="tab"]')];
    const select = (tab) => tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(t));
      t.addEventListener('keydown', (e) => {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        const n = tabs[(i + d + tabs.length) % tabs.length];
        n.focus(); select(n);
      });
    });
  });
})();
