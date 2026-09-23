/* ferret · site behaviour: language, theme, reveal, filters, live activity. */
(() => {
  const root = document.documentElement;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  };
  const I18N = JSON.parse($('#i18n').textContent);
  const lang = () => root.dataset.lang;
  const t = key => I18N[lang()][key];

  // ---------------------------------------------------------------- language
  function applyLang(next, remember) {
    root.dataset.lang = next;
    root.lang = next === 'zh' ? 'zh-CN' : 'en';
    document.title = t('title');
    $('meta[name="description"]').content = t('description');
    for (const el of $$('[data-zh-label]')) el.setAttribute('aria-label', el.dataset[next + 'Label']);
    for (const el of $$('[data-zh-alt]')) el.alt = el.dataset[next + 'Alt'];
    for (const b of $$('[data-set-lang]')) b.setAttribute('aria-pressed', String(b.dataset.setLang === next));
    const url = new URL(location.href);
    if (next === 'en') url.searchParams.set('lang', 'en'); else url.searchParams.delete('lang');
    history.replaceState(null, '', url);
    if (remember) store.set('lang', next);
    if (stats) renderStats(stats);
  }
  for (const b of $$('[data-set-lang]')) b.addEventListener('click', () => applyLang(b.dataset.setLang, true));

  // ---------------------------------------------------------------- theme
  const media = matchMedia('(prefers-color-scheme: dark)');
  $('.theme-btn').addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    store.set('theme', next);
  });
  media.addEventListener('change', e => { if (!store.get('theme')) root.dataset.theme = e.matches ? 'dark' : 'light'; });

  // ---------------------------------------------------------------- header + reveal
  const top = $('.top');
  const onScroll = () => top.classList.toggle('scrolled', scrollY > 8);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  const io = new IntersectionObserver(entries => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  for (const el of $$('.reveal, .head')) io.observe(el);

  // ---------------------------------------------------------------- filters
  const tiles = $$('.tile');
  for (const b of $$('.filters button')) b.addEventListener('click', () => {
    for (const o of $$('.filters button')) o.setAttribute('aria-pressed', String(o === b));
    const g = b.dataset.group;
    for (const tile of tiles) tile.hidden = g !== 'all' && tile.dataset.group !== g;
  });

  // ---------------------------------------------------------------- copy email
  const toast = $('.toast');
  let toastTimer;
  $('[data-copy]').addEventListener('click', async e => {
    const text = e.currentTarget.dataset.copy;
    try { await navigator.clipboard.writeText(text); } catch { location.href = 'mailto:' + text; return; }
    toast.textContent = t('copied');
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  });

  // ---------------------------------------------------------------- activity
  let stats = null;
  const NS = 'http://www.w3.org/2000/svg';
  const ALPHA = [0, .2, .42, .68, .95];
  const LANG_COLORS = ['var(--ink)', 'var(--red)', '#4A6670', '#A0703C', '#6F8B6E', '#C09A4A', 'var(--ink-3)'];

  function countUp(el, value) {
    const done = () => { el.textContent = el.dataset.format === 'year' ? String(value) : value.toLocaleString('en-US'); };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || el.dataset.counted) return done();
    el.dataset.counted = '1';
    const from = el.dataset.format === 'year' ? value - 12 : 0;
    const start = performance.now();
    const tick = now => {
      const k = Math.min(1, (now - start) / 1200);
      const v = Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3)));
      el.textContent = el.dataset.format === 'year' ? String(v) : v.toLocaleString('en-US');
      if (k < 1) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  }

  function heatmap(weeks) {
    const cell = 12, gap = 4, step = cell + gap, left = 34, topPad = 22;
    const w = left + weeks.length * step, h = topPad + 7 * step;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', t('heatLabel'));
    const months = t('months');
    let last = null;
    weeks.forEach((week, wi) => {
      for (const [date, count, level] of week) {
        const d = new Date(date + 'T00:00:00');
        const r = document.createElementNS(NS, 'rect');
        r.setAttribute('x', left + wi * step);
        r.setAttribute('y', topPad + d.getDay() * step);
        r.setAttribute('width', cell); r.setAttribute('height', cell); r.setAttribute('rx', 3);
        if (level) { r.setAttribute('fill', 'var(--ink)'); r.setAttribute('fill-opacity', ALPHA[level]); }
        else r.setAttribute('fill', 'var(--line-2)');
        const title = document.createElementNS(NS, 'title');
        title.textContent = `${date} · ${count}`;
        r.append(title);
        svg.append(r);
      }
      const m = +week[0][0].slice(5, 7);
      if (m !== last && wi < weeks.length - 2) {
        if (last !== null || +week[0][0].slice(8, 10) <= 7) {
          const tx = document.createElementNS(NS, 'text');
          tx.setAttribute('x', left + wi * step); tx.setAttribute('y', 12);
          tx.setAttribute('fill', 'var(--ink-3)'); tx.setAttribute('font-size', '11');
          tx.textContent = months[m - 1];
          svg.append(tx);
        }
        last = m;
      }
    });
    t('weekdays').forEach((label, i) => {
      const tx = document.createElementNS(NS, 'text');
      tx.setAttribute('x', 0); tx.setAttribute('y', topPad + (i * 2 + 1) * step + cell - 2);
      tx.setAttribute('fill', 'var(--ink-3)'); tx.setAttribute('font-size', '11');
      tx.textContent = label;
      svg.append(tx);
    });
    return svg;
  }

  function renderStats(s) {
    for (const el of $$('[data-stat]')) {
      const v = s[el.dataset.stat];
      if (typeof v === 'number') countUp(el, v);
    }
    for (const el of $$('[data-stat-text]')) {
      const key = el.dataset.statText;
      el.textContent = t(key).replace('{repo}', s.top_repo.name).replace('{stars}', s.top_repo.stars)
        .replace('{streak}', s.longest_streak).replace('{year}', s.year_on_github);
    }
    const heat = $('.heat');
    heat.replaceChildren(heatmap(s.weeks));
    const bar = $('.bar'), list = $('.langs ul');
    bar.replaceChildren(); list.replaceChildren();
    s.languages.forEach((item, i) => {
      const color = item.name ? LANG_COLORS[Math.min(i, LANG_COLORS.length - 1)] : 'var(--ink-3)';
      const seg = document.createElement('span');
      seg.style.width = (item.share * 100).toFixed(2) + '%';
      seg.style.background = color;
      bar.append(seg);
      const li = document.createElement('li');
      li.innerHTML = `<i style="background:${color}"></i>${item.name || t('other')} <em>${(item.share * 100).toFixed(1)}%</em>`;
      list.append(li);
    });
    $('.updated').textContent = t('updated').replace('{date}', s.updated);
  }

  const SOURCES = [
    'https://raw.githubusercontent.com/ferretgeek/ferretgeek/main/assets/stats/stats.json',
    'https://cdn.jsdelivr.net/gh/ferretgeek/ferretgeek@main/assets/stats/stats.json',
  ];
  async function loadStats() {
    stats = JSON.parse($('#stats-fallback').textContent);
    renderStats(stats);
    for (const src of SOURCES) {
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 4000);
        const res = await fetch(src, { signal: ctl.signal, cache: 'no-cache' });
        clearTimeout(timer);
        if (!res.ok) continue;
        const live = await res.json();
        if (live && live.weeks && live.updated >= stats.updated) { stats = live; renderStats(stats); }
        return;
      } catch { /* try the next mirror */ }
    }
  }

  applyLang(root.dataset.lang, false);
  loadStats();
})();
