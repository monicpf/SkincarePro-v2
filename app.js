(() => {
  'use strict';
  const DIM = { p: [1440, 1920], l: [1920, 1440], m: [414, 899] };
  const canv = {};
  document.querySelectorAll('.canvas').forEach(c => { canv[c.dataset.cv] = c; });

  // ---------- global state (survives orientation change) ----------
  const init = () => ({ screen: 'result', rec: 'products', filter: 'all', expanded: false, mode: 'analysis', dd: false, hist: [], done: [false, false, false, false] });
  let S = init();
  let cur = null;

  const screenKey = () => {
    if (S.screen !== 'rec') return S.screen;
    if (S.rec === 'products') return S.filter === 'redness' ? 'recRed' : 'recAll';
    return S.rec;
  };

  // ---------- layout / orientation ----------
  function pickCv() {
    const w = window.innerWidth, h = window.innerHeight;
    if (w < 600) return 'm';
    return w > h ? 'l' : 'p';
  }
  function layout() {
    const cv = pickCv();
    if (cv !== cur) {
      if (cur) canv[cur].classList.remove('active');
      cur = cv; canv[cv].classList.add('active');
    }
    const [W, H] = DIM[cv];
    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.min(vw / W, vh / H);
    const c = canv[cv];
    c._s = s;
    c.style.transform = `translate(${(vw - W * s) / 2}px, ${(vh - H * s) / 2}px) scale(${s})`;
    updateHint();
  }

  // ---------- render state into every canvas ----------
  function apply(resetScrollKey) {
    const key = screenKey();
    for (const cv in canv) {
      const c = canv[cv];
      c.querySelectorAll(':scope > .screen').forEach(sc => {
        const on = sc.dataset.screen === key;
        sc.classList.toggle('active', on);
        if (on && resetScrollKey) { const sr = sc.querySelector('.scroller'); if (sr) sr.scrollTop = 0; }
      });
      const rf = c.querySelector('.result-frame');
      if (rf) {
        rf.classList.toggle('expanded', S.expanded);
        rf.classList.toggle('dd-open', S.dd);
        rf.querySelectorAll('.ph').forEach(im => im.classList.toggle('on', im.classList.contains('ph-' + S.mode)));
        rf.querySelectorAll('.dd-row').forEach(row => {
          const sel = row.dataset.mode === S.mode;
          row.classList.toggle('sel', sel);
          const dot = row.querySelector('img');
          if (dot) dot.src = sel ? 'assets/dotb.svg' : 'assets/dotw.svg';
        });
      }
    }
    requestAnimationFrame(updateHint);
  }

  // ---------- navigation ----------
  const snap = () => ({ screen: S.screen, rec: S.rec, filter: S.filter });
  function go(screen, opts = {}) {
    S.hist.push(snap());
    S.screen = screen;
    if (opts.rec) S.rec = opts.rec;
    if (opts.filter) S.filter = opts.filter;
    S.dd = false;
    apply(true);
  }
  function back() {
    if (S.screen === 'result') return;
    const prev = S.hist.pop();
    if (prev) Object.assign(S, prev); else S.screen = 'result';
    apply(true);
  }
  function home() {
    if (S.screen === 'result') { S = init(); apply(true); return; }
    S.hist = []; S.screen = 'result'; S.dd = false; apply(true);
  }
  function setRec(rec, filter) {
    S.rec = rec; if (filter) S.filter = filter;
    apply(true);
  }

  // ---------- take photo + analysis ----------
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  function stopTake() {
    timers.forEach(clearTimeout); timers = [];
    document.querySelectorAll('.take').forEach(t => {
      t.classList.remove('analyzing');
      t.querySelectorAll('.scan, .scan-done').forEach(x => { x.classList.remove('on'); if (x.tagName === 'IMG') x.removeAttribute('src'); });
      const c = t.querySelector('.tp-count'); c.textContent = ''; c.classList.remove('tick');
    });
  }
  const each = (sel, fn) => document.querySelectorAll('.take ' + sel).forEach(fn);
  function play(sel, file) { const v = Date.now(); each(sel, im => { im.src = 'assets/' + file + '?v=' + v; im.classList.add('on'); }); }
  function hide(sel) { each(sel, im => { im.classList.remove('on'); }); }
  function startTake() {
    stopTake();
    S.dd = false; S.screen = 'take'; apply(true);
    [3, 2, 1].forEach((n, i) => later(300 + i * 1000, () => each('.tp-count', c => { c.textContent = n; c.classList.remove('tick'); void c.offsetWidth; c.classList.add('tick'); })));
    later(3300, () => {
      each('.tp-count', c => { c.textContent = ''; });
      each('.tp-flash', f => { f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); });
      document.querySelectorAll('.take').forEach(t => t.classList.add('analyzing'));
      play('.scan-rings', 'scan_rings.png');
    });
    later(3300 + 1950, () => { hide('.scan-rings'); play('.scan-dots', 'scan_dots.png'); });
    later(3300 + 1950 + 1850, () => { hide('.scan-dots'); each('.scan-done', d => d.classList.add('on')); play('.scan-check', 'scan_check.png'); });
    later(3300 + 1950 + 1850 + 1900, () => { stopTake(); S = init(); apply(true); });
  }

  // ---------- interactions ----------
  function handle(name, el) {
    if (name === 'btn_take_back') { stopTake(); S.screen = 'result'; apply(true); return true; }
    if (S.screen === 'take') return true;
    const inResult = !!el.closest('.result-frame');
    if (el.classList && el.classList.contains('dd-row')) {
      S.mode = el.dataset.mode; S.done[1] = true; apply(); return true;
    }
    if (inResult) {
      if (name === 'btn_all_concerns') { S.expanded = !S.expanded; S.dd = false; S.done[0] = true; apply(); return true; }
      if (/^btn_skincarepro_(compare_s|previewmodes)/.test(name)) { S.dd = !S.dd; apply(); return true; }
      if (name === 'pill_Redness' || name === 'pin_Red') { S.done[2] = true; go('detail'); return true; }
      if (name === 'btn_view_report') { S.done[3] = true; go('report'); return true; }
      if (/^btn_skincarepro_back/.test(name) || /^btn_ymk_livecam_back/.test(name)) { startTake(); return true; }
      if (/home/.test(name) && /^btn_/.test(name)) { home(); return true; }
      return false;
    }
    if (/^btn_skincarepro_back/.test(name)) { back(); return true; }
    if (/^btn_(y4b_skincarecm_home|skincarepro_home)/.test(name)) { home(); return true; }
    if (name === 'concern_card_Redness') { go('detail'); return true; }
    if (/^btn_matching_products/.test(name)) { go('rec', { rec: 'products', filter: 'redness' }); return true; }
    if (name === 'tab_Report') { if (S.screen !== 'report') go('report'); return true; }
    if (name === 'tab_Recommendation') { if (S.screen !== 'rec') go('rec', { rec: 'products', filter: 'all' }); return true; }
    if (name === 'tab_Get Report') return true;
    if (/^tab_Products/.test(name)) { setRec('products'); return true; }
    if (/^tab_Routines/.test(name)) { setRec('routines'); return true; }
    if (/^tab_Treatments/.test(name)) { setRec('treatments'); return true; }
    if (/^chip_All/.test(name)) { if (S.rec === 'products' && S.filter !== 'all') setRec('products', 'all'); return true; }
    if (/^chip_Redness/.test(name)) { if (S.rec === 'products' && S.filter !== 'redness') setRec('products', 'redness'); return true; }
    if (name === 'btn_clear') { setRec('products', 'all'); return true; }
    return false;
  }

  document.getElementById('stage').addEventListener('click', e => {
    let n = e.target;
    const insideDd = n.closest && (n.closest('.dd') || n.closest('[data-name^="btn_skincarepro_compare_s"],[data-name^="btn_skincarepro_previewmodes"]'));
    while (n && n.id !== 'stage') {
      const name = n.getAttribute && n.getAttribute('data-name');
      if ((name || (n.classList && n.classList.contains('dd-row'))) && handle(name || '', n)) return;
      n = n.parentElement;
    }
    if (S.dd && !insideDd) { S.dd = false; apply(); }
  });

  // ---------- guided hints ----------
  const HINTS = [
    { pref: 'above', text: 'Tap to see all concerns', target: rf => rf.querySelector('.concerns-collapsed [data-name="btn_all_concerns"]') },
    { pref: () => cur === 'm' ? 'below' : 'left', text: () => S.dd ? 'Pick any view' : 'Switch the photo view',
      target: rf => S.dd ? rf.querySelector('.dd') : [...rf.children].find(k => /^btn_skincarepro_(compare_s|previewmodes)/.test(k.getAttribute('data-name') || '')) },
    { pref: 'right', text: 'Tap Redness for details', target: rf => S.expanded ? rf.querySelector('.concerns-expanded [data-name="pill_Redness"]') : rf.querySelector('.pins [data-name="pin_Red"]') },
    { pref: 'above', text: 'View your full skin report', target: rf => rf.querySelector('[data-name="btn_view_report"]') },
  ];

  function updateHint() {
    for (const cv in canv) canv[cv].querySelector('.hint-layer').classList.remove('hint-on');
    if (!cur) return;
    const c = canv[cur];
    let t = null;
    if (S.screen === 'result') {
      const step = S.done.findIndex(d => !d);
      if (step < 0) return;
      const rf = c.querySelector('.result-frame');
      if (step === 1 && S.dd) t = rf.querySelector('.dd-row:not(.sel)');
      else t = HINTS[step].target(rf);
    } else if (S.screen === 'detail' && S.done[2] && !S.done[3]) {
      t = c.querySelector('.screen.active .fixedlayer [data-name^="btn_skincarepro_back"]');
    } else return;
    if (!t) return;
    const s = c._s || 1, cr = c.getBoundingClientRect(), r = t.getBoundingClientRect();
    if (!r.width) return;
    const layer = c.querySelector('.hint-layer'), dot = layer.querySelector('.hint');
    dot.style.left = ((r.left - cr.left + r.width / 2) / s) + 'px';
    dot.style.top = ((r.top - cr.top + r.height / 2) / s) + 'px';
    layer.classList.add('hint-on');
  }

  document.addEventListener('scroll', () => requestAnimationFrame(updateHint), true);
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 120));
  if (window.ResizeObserver) new ResizeObserver(layout).observe(document.documentElement);
  const mq = window.matchMedia('(orientation: portrait)');
  if (mq.addEventListener) mq.addEventListener('change', layout);

  apply(true);
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateHint);
  window.__proto = { get state() { return S; }, go, back, home };
})();
