// ── Language toggle ───────────────────────────────────────────
function setLang(lang) {
  if (lang === 'uk') document.body.classList.add('lang-uk');
  else                document.body.classList.remove('lang-uk');

  document.querySelectorAll('.lang-uk').forEach(el => { el.hidden = lang !== 'uk'; });
  document.querySelectorAll('.lang-en').forEach(el => { el.hidden = lang !== 'en'; });

  document.querySelectorAll('[data-uk]').forEach(el => {
    el.textContent = lang === 'uk' ? el.dataset.uk : el.dataset.en;
  });

  document.documentElement.lang = lang;
  document.getElementById('btn-uk')?.classList.toggle('active', lang === 'uk');
  document.getElementById('btn-en')?.classList.toggle('active', lang === 'en');
  localStorage.setItem('purl-lang', lang);
  document.dispatchEvent(new Event('langchange'));
}

// ── Header injection ──────────────────────────────────────────
(function () {
  const isLegal = location.pathname.endsWith('legal.html') || location.pathname.endsWith('/legal');

  const navLinks = isLegal ? [
    ['index.html', '← Головна',  '← Home'],
    ['#donate',    'Підтримати', 'Donate'],
    ['#tos',       'Умови',      'Terms'],
    ['#contact',   'Контакти',   'Contact'],
  ] : [
    ['#features',  'Можливості',          'Features'],
    ['#blocks',    'Блоки',               'Blocks'],
    ['#faq',       'FAQ',                 'FAQ'],
    ['#download',  'Завантажити',         'Download'],
    ['legal.html', 'Правова',             'Legal'],
  ];

  const navHtml = navLinks
    .map(([href, uk, en]) =>
      `<a href="${href}" data-uk="${uk}" data-en="${en}">${en}</a>`)
    .join('');

  const sub = isLegal
    ? '<span class="logo-sub">Legal &amp; Support</span>'
    : '<span class="logo-sub">No-code IF Builder</span>';

  document.querySelector('header').innerHTML =
    '<a href="index.html" class="logo">' +
      '<img src="Icon.png" alt="Purl" class="logo-img" />' +
      '<span class="logo-text">Purl</span>' +
    '</a>' +
    sub +
    '<nav>' + navHtml + '</nav>' +
    '<div class="lang-toggle">' +
      '<button id="btn-uk" onclick="setLang(\'uk\')">UA</button>' +
      '<button id="btn-en" class="active" onclick="setLang(\'en\')">EN</button>' +
    '</div>';

  const saved = localStorage.getItem('purl-lang');
  if (saved && saved !== 'en') setLang(saved);
}());
