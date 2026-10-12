(() => {
  'use strict';
  const DIM = { p: [1440, 1920], l: [1920, 1440], m: [414, 899] };
  const canv = {};
  document.querySelectorAll('.canvas').forEach(c => { canv[c.dataset.cv] = c; });

  // ---------- global state (shared by all canvases, survives rotation) ----------
  // rs: result sub-state  C = collapsed, X = all concerns, W = wrinkles detail
  const init = () => ({ screen: 'result', rs: 'C', shelf: true, mode: 'analysis', dd: false, rec: 'products', filter: 'all', step: 0 });
  let S = init();
  let cur = null;

  const screenKey = () => {
    if (S.screen !== 'rec') return S.screen;
    if (S.rec === 'products') return S.filter === 'redness' ? 'recRed' : 'recAll';
    return S.rec;
  };
  const photoKey = cv => {
    if (S.mode === 'original') return 'orig';
    if (S.mode === 'focus') return S.rs === 'W' ? 'fwr' : 'fall';
    if (S.rs === 'W') return 'wr';
    return (S.rs === 'X' && cv === 'm') ? 'allx' : 'all';
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
      requestAnimationFrame(applyWrinkleScroll);
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
  function apply(resetScroll) {
    const key = screenKey();
    for (const cv in canv) {
      const c = canv[cv];
      c.classList.toggle('f-red', S.filter === 'redness');
      c.querySelectorAll(':scope > .screen').forEach(sc => {
        const on = sc.dataset.screen === key;
        sc.classList.toggle('active', on);
        if (on && resetScroll) { const sr = sc.querySelector('.scroller'); if (sr) sr.scrollTop = 0; }
      });
      const rf = c.querySelector('.result-frame');
      if (rf) {
        ['C', 'X', 'W'].forEach(s => rf.classList.toggle('s-' + s, S.rs === s));
        rf.querySelectorAll('.st').forEach(g => g.classList.toggle('cur', g.classList.contains('st-' + S.rs)));
        rf.classList.toggle('shelf-open', S.shelf);
        rf.querySelectorAll('.shelf').forEach(g => g.classList.toggle('cur', g.classList.contains(S.shelf ? 'shelf-o' : 'shelf-c')));
        rf.classList.toggle('dd-open', S.dd);
        const pk = photoKey(cv);
        rf.querySelectorAll('.ph').forEach(im => im.classList.toggle('on', im.classList.contains('ph-' + pk)));
        rf.querySelectorAll('.dd-row').forEach(row => {
          const sel = row.dataset.mode === S.mode;
          row.classList.toggle('sel', sel);
          const dot = row.querySelector('img');
          if (dot) dot.src = sel ? 'assets/97e67.svg' : 'assets/897ad.svg';
        });
      }
    }
    requestAnimationFrame(updateHint);
    setTimeout(updateHint, 480);   // again once transitions have settled
  }
  // the wrinkles list opens scrolled like the design; hidden canvases get it when they become active
  let wPending = {};
  function scrollWrinkles() {
    wPending = { p: true, l: true, m: true };
    applyWrinkleScroll();
  }
  function applyWrinkleScroll() {
    if (!cur || !wPending[cur] || S.rs !== 'W') return;
    wPending[cur] = false;
    canv[cur].querySelectorAll('.st-W [data-scroll]').forEach(el => { el.scrollTop = parseFloat(el.dataset.scroll) || 0; });
  }

  // ---------- navigation ----------
  function go(screen, opts = {}) {
    S.screen = screen;
    if (opts.rec) S.rec = opts.rec;
    if (opts.filter) S.filter = opts.filter;
    S.dd = false;
    apply(true);
  }
  function home() {
    if (S.screen === 'result') { const st = S.step; S = init(); S.step = st; apply(true); return; }
    S.screen = 'result'; S.dd = false; apply(true);
  }
  const advance = n => { if (S.step === n) S.step = n + 1; };

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
  function hide(sel) { each(sel, im => im.classList.remove('on')); }
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
    later(3300 + 1950 + 1850, () => { hide('.scan-dots'); play('.scan-check', 'scan_check.png'); each('.scan-done', d => d.classList.add('on')); });
    // check mark plays once (1.1s) and holds its last frame, then straight on to the result
    later(3300 + 1950 + 1850 + 1350, () => { stopTake(); S = init(); apply(true); });
  }

  // ---------- interactions ----------
  const isBack = n => /^btn_skincarepro_back/.test(n) || /^btn_ymk_livecam_back/.test(n);
  const isHome = n => /^btn_(y4b_skincarecm_home|skincarepro_home)/.test(n);
  const isGlasses = n => /^btn_skincarepro_(compare_s|previewmodes)/.test(n);

  function handle(name, el) {
    if (name === 'btn_take_back') { stopTake(); S.screen = 'result'; apply(true); return true; }
    if (S.screen === 'take') return true;
    if (isBack(name)) { startTake(); return true; }
    if (isHome(name)) { home(); return true; }
    if (S.screen === 'result') {
      if (el.classList && el.classList.contains('dd-row')) {
        S.mode = el.dataset.mode; advance(2); apply(); return true;   // dropdown stays open
      }
      if (isGlasses(name)) { S.dd = !S.dd; apply(); return true; }
      if (name === 'btn_all_concerns') {
        if (S.rs === 'C') { S.rs = 'X'; advance(0); } else S.rs = 'C';
        S.dd = false; apply(); return true;
      }
      if (name === 'handelr') { S.shelf = !S.shelf; apply(); return true; }
      if (S.rs === 'X' && (name === 'pill_Wrinkles' || name === 'wrinkles+' ||
          (/^btn_skincarepro_expand_plus/.test(name) && el.closest('[data-name="wrinkles+"]')))) {
        S.rs = 'W'; S.shelf = false; advance(1); apply(); requestAnimationFrame(scrollWrinkles); return true;
      }
      if (S.rs === 'W' && (/^btn_skincarepro_expand_minus/.test(name) ||
          (name === 'pill_Wrinkles' && el.closest('[data-name="wrinkles+"]')))) {
        S.rs = 'X'; S.shelf = true; apply(); return true;
      }
      if (name === 'btn_view_report') { advance(3); go('report'); return true; }
      if (name === 'btn_retake') { startTake(); return true; }
      if (/^tab_(Products|Routines|Treatments)/.test(name)) return true;
      return false;
    }
    if (name === 'concern_card_Redness') { advance(4); go('detail'); return true; }
    if (/^btn_matching_products/.test(name)) { advance(5); go('rec', { rec: 'products', filter: 'redness' }); return true; }
    if (name === 'tab_Report') { if (S.screen !== 'report') go('report'); return true; }
    if (name === 'tab_Recommendation') { go('rec', { rec: 'products', filter: 'all' }); return true; }
    if (name === 'tab_Get Report') { advance(6); if (S.screen !== 'share') go('share'); return true; }
    if (S.screen === 'rec') {
      if (/^tab_Products/.test(name)) { S.rec = 'products'; apply(true); return true; }
      if (/^tab_Routines/.test(name)) { S.rec = 'routines'; apply(true); return true; }
      if (/^tab_Treatments/.test(name)) { S.rec = 'treatments'; apply(true); return true; }
      if (/^chip_All/.test(name)) { if (S.filter !== 'all') { S.filter = 'all'; apply(S.rec === 'products'); } return true; }
      if (/^chip_Redness/.test(name)) { if (S.filter !== 'redness') { S.filter = 'redness'; apply(S.rec === 'products'); } return true; }
      if (name === 'btn_clear') { S.filter = 'all'; apply(true); return true; }
    }
    return false;
  }

  document.getElementById('stage').addEventListener('click', e => {
    let n = e.target;
    const insideDd = n.closest && (n.closest('.dd') || n.closest('[data-name^="btn_skincarepro_compare_s"],[data-name^="btn_skincarepro_previewmodes"]'));
    if (S.dd && !insideDd) { S.dd = false; apply(); return; }   // tap outside closes the dropdown
    while (n && n.id !== 'stage') {
      const name = n.getAttribute && n.getAttribute('data-name');
      if ((name || (n.classList && n.classList.contains('dd-row'))) && handle(name || '', n)) return;
      n = n.parentElement;
    }
  });

  // ---------- guided hints ----------
  const visible = el => {
    if (!el || el.closest('.st:not(.cur), .shelf:not(.cur)')) return false;
    const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
  };
  const firstVis = (root, sel) => [...root.querySelectorAll(sel)].find(visible) || null;
  function hintTarget(c) {
    const sc = c.querySelector(':scope > .screen.active');
    if (!sc) return null;
    const scr = sc.dataset.screen;
    switch (S.step) {
      case 0: return scr === 'result' && S.rs === 'C' ? firstVis(sc, '.st-C [data-name="btn_all_concerns"]') : null;
      case 1: return scr === 'result' && S.rs === 'X' ? firstVis(sc, '.st-X [data-name="pill_Wrinkles"]') : null;
      case 2:
        if (scr !== 'result') return null;
        if (S.dd) return firstVis(sc, '.dd-row:not(.sel)');
        return firstVis(sc, '[data-name^="btn_skincarepro_compare_s"], [data-name^="btn_skincarepro_previewmodes"]');
      case 3: return scr === 'result' && !S.dd ? firstVis(sc, '[data-name="btn_view_report"]') : null;
      case 4: return scr === 'report' ? firstVis(sc, '[data-name="concern_card_Redness"]') : null;
      case 5: return scr === 'detail' ? firstVis(sc, '[data-name^="btn_matching_products"]') : null;
      case 6: return /^(recAll|recRed|routines|treatments)$/.test(scr) ? firstVis(sc, '.fixedlayer [data-name="tab_Get Report"]') : null;
      case 7: return scr === 'share' ? firstVis(sc, '.fixedlayer [data-name^="btn_skincarepro_back"]') : null;
    }
    return null;
  }

  // bring an off-screen hint target into view: lists right away, pages only if the user
  // hasn't started scrolling by themselves within 2 s
  let revealTag = '', revealTimer = null, userScrolled = false, autoScrollUntil = 0;
  function smoothTo(box, top) {
    autoScrollUntil = Date.now() + 900;
    if ('scrollBehavior' in document.documentElement.style) box.scrollTo({ top, behavior: 'smooth' });
    else box.scrollTop = top;
  }
  function scheduleReveal(t, c) {
    const tag = S.step + ':' + S.screen + ':' + S.rs + ':' + cur;
    if (revealTag === tag) return;
    revealTag = tag;
    clearTimeout(revealTimer);
    const s = c._s || 1;
    const list = t.closest('.list-scroll');
    if (list) {
      const br = list.getBoundingClientRect(), r = t.getBoundingClientRect();
      if (r.top < br.top || r.bottom > br.bottom - br.height * 0.12) smoothTo(list, list.scrollTop + (r.top - br.top - br.height * 0.35) / s);
      return;
    }
    const sr = t.closest('.scroller');
    if (!sr) return;
    userScrolled = false;
    revealTimer = setTimeout(() => {
      if (userScrolled || revealTag !== tag || !t.isConnected) return;
      const cr = c.getBoundingClientRect(), r = t.getBoundingClientRect();
      const y = (r.top - cr.top) / s, h = DIM[cur][1];
      if (y < h * 0.12 || y > h * 0.75) smoothTo(sr, sr.scrollTop + y - h * 0.45);
    }, 2000);
  }

  let scrolling = false, scrollTimer = null;
  function updateHint() {
    if (!cur) return;
    for (const cv in canv) if (cv !== cur) canv[cv].querySelector('.hint-layer').classList.remove('hint-on');
    const c = canv[cur], layer = c.querySelector('.hint-layer'), dot = layer.querySelector('.hint');
    const t = hintTarget(c);
    if (t) scheduleReveal(t, c);
    if (!t || scrolling) { layer.classList.remove('hint-on'); return; }
    const s = c._s || 1, cr = c.getBoundingClientRect(), r = t.getBoundingClientRect();
    const x = (r.left - cr.left + r.width / 2) / s, y = (r.top - cr.top + r.height / 2) / s;
    const tag = S.step + ':' + S.screen + ':' + S.dd;
    if (!layer.classList.contains('hint-on') || layer.dataset.tag !== tag) {
      dot.classList.add('jump');                     // appear in place, no sliding across the screen
      dot.style.left = x + 'px'; dot.style.top = y + 'px';
      void dot.offsetWidth;
      dot.classList.remove('jump');
    } else if (Math.abs(parseFloat(dot.style.left) - x) > .5 || Math.abs(parseFloat(dot.style.top) - y) > .5) {
      dot.style.left = x + 'px'; dot.style.top = y + 'px';
    }
    layer.dataset.tag = tag;
    layer.classList.add('hint-on');
  }

  // hide the hint while anything scrolls; bring it back once scrolling settles
  document.addEventListener('scroll', () => {
    if (Date.now() > autoScrollUntil) userScrolled = true;
    if (!scrolling) { scrolling = true; updateHint(); }
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { scrolling = false; updateHint(); }, 260);
  }, true);
  setInterval(() => { if (!scrolling) updateHint(); }, 700);   // safety net (fonts, late layout, rotation)
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 120));
  if (window.ResizeObserver) new ResizeObserver(layout).observe(document.documentElement);
  const mq = window.matchMedia('(orientation: portrait)');
  if (mq.addEventListener) mq.addEventListener('change', layout);

  apply(true);
  layout();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateHint);
  window.__proto = { get state() { return S; }, go, home, startTake };
})();
