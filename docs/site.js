// ── Interactive blocks split-pane ─────────────────────────────
(function () {
  const data  = window.PURL_BLOCKS;
  const kinds = window.PURL_BLOCK_KINDS;
  const list  = document.getElementById('blocks-list');
  const detail = document.getElementById('blocks-detail');
  if (!list || !detail || !data) return;

  let activeId = data[0].id;

  function getLang() {
    return document.body.classList.contains('lang-uk') ? 'uk' : 'en';
  }

  function svgSmall(b) {
    return b.svg.replace('<svg ', '<svg width="18" height="18" ');
  }

  function svgLarge(b) {
    return b.svg.replace('<svg ', '<svg width="40" height="40" ');
  }

  function renderList() {
    const lang = getLang();
    list.querySelectorAll('.block-row').forEach(r => r.remove());
    const rows = data.map(b => {
      const kindLabel = kinds[b.kind][lang];
      const name = b['name_' + lang];
      return `<div class="block-row ${b.id === activeId ? 'active' : ''}" data-id="${b.id}">
        <span class="row-glyph">${svgSmall(b)}</span>
        <span class="row-name">${name}</span>
        <span class="row-kind">${kindLabel}</span>
      </div>`;
    }).join('');
    list.insertAdjacentHTML('beforeend', rows);

    list.querySelectorAll('.block-row').forEach(row => {
      row.addEventListener('click', () => {
        activeId = row.dataset.id;
        renderList();
        renderDetail();
      });
    });
  }

  function renderDetail() {
    const lang = getLang();
    const b = data.find(x => x.id === activeId) || data[0];
    const kindLabel = kinds[b.kind][lang];
    const name = b['name_' + lang];
    const desc = b['desc_' + lang];
    const idx = data.indexOf(b) + 1;
    const total = data.length;

    detail.innerHTML = `
      <div class="detail-counter">${String(idx).padStart(2, '0')} / ${String(total).padStart(2, '0')}</div>
      <div class="detail-tag">${kindLabel}</div>
      <div class="detail-glyph">${svgLarge(b)}</div>
      <div class="detail-name">${name}</div>
      <div class="detail-desc">${desc}</div>
      <div class="detail-meta">
        ${b.tags.map(t => `<span class="badge">${t}</span>`).join('')}
      </div>
    `;
  }

  renderList();
  renderDetail();
  document.addEventListener('langchange', () => { renderList(); renderDetail(); });
})();

// ── Carousel ──────────────────────────────────────────────────
(function () {
  const MANIFEST = 'screenshots/manifest.json';
  const track    = document.getElementById('carousel-track');
  const dotsWrap = document.getElementById('carousel-dots');
  const caption  = document.getElementById('carousel-caption');
  const btnPrev  = document.getElementById('carousel-prev');
  const btnNext  = document.getElementById('carousel-next');
  if (!track) return;

  let slides = [], current = 0, autoTimer;

  function getLang() {
    return document.body.classList.contains('lang-uk') ? 'uk' : 'en';
  }

  function goTo(idx) {
    current = (idx + slides.length) % slides.length;
    track.style.transform = `translateX(-${current * 100}%)`;
    dotsWrap.querySelectorAll('.carousel-dot').forEach((d, i) =>
      d.classList.toggle('active', i === current));
    const s = slides[current];
    caption.textContent = (s[getLang()] || s.en) + '   —   ' +
      String(current + 1).padStart(2, '0') + ' / ' +
      String(slides.length).padStart(2, '0');
  }

  function resetTimer() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => goTo(current + 1), 5000);
  }

  function build(data) {
    slides = data;
    track.innerHTML = '';
    dotsWrap.innerHTML = '';

    data.forEach((s, i) => {
      const img = document.createElement('img');
      img.src = 'screenshots/' + s.file;
      img.alt = s.en;
      img.loading = i === 0 ? 'eager' : 'lazy';
      track.appendChild(img);

      const dot = document.createElement('div');
      dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      dot.addEventListener('click', () => { goTo(i); resetTimer(); });
      dotsWrap.appendChild(dot);
    });

    goTo(0);
    resetTimer();
  }

  btnPrev.addEventListener('click', () => { goTo(current - 1); resetTimer(); });
  btnNext.addEventListener('click', () => { goTo(current + 1); resetTimer(); });

  let touchX = 0;
  track.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 40) { goTo(current + (dx < 0 ? 1 : -1)); resetTimer(); }
  });

  document.addEventListener('langchange', () => {
    if (slides.length) {
      const s = slides[current];
      caption.textContent = (s[getLang()] || s.en) + '   —   ' +
        String(current + 1).padStart(2, '0') + ' / ' +
        String(slides.length).padStart(2, '0');
    }
  });

  fetch(MANIFEST)
    .then(r => r.json())
    .then(build)
    .catch(() => {
      track.innerHTML = '<img src="screenshots/Main Layout.png" alt="Purl">';
    });
})();
