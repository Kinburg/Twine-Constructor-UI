// ── Language toggle ───────────────────────────────────────────
function setLang(lang) {
  // CSS body-class approach (index.html uses [lang-content] visibility)
  if (lang === 'uk') {
    document.body.classList.add('lang-uk');
  } else {
    document.body.classList.remove('lang-uk');
  }

  // .lang-uk / .lang-en hidden-attribute approach (legal.html)
  document.querySelectorAll('.lang-uk').forEach(el => { el.hidden = lang !== 'uk'; });
  document.querySelectorAll('.lang-en').forEach(el => { el.hidden = lang !== 'en'; });

  // data-uk / data-en text swap (nav links, hero, badges)
  document.querySelectorAll('[data-uk]').forEach(el => {
    el.textContent = lang === 'uk' ? el.dataset.uk : el.dataset.en;
  });

  document.documentElement.lang = lang;
  document.getElementById('btn-uk')?.classList.toggle('active', lang === 'uk');
  document.getElementById('btn-en')?.classList.toggle('active', lang === 'en');
  localStorage.setItem('purl-lang', lang);
  document.dispatchEvent(new Event('langchange'));
}

// ── Header injection + lang restore ──────────────────────────
(function () {
  const isLegal = location.pathname.endsWith('legal.html');

  const navLinks = isLegal ? [
    ['/',          '← Головна',        '← Home'],
    ['#donate',    'Підтримати',        'Support'],
    ['#terms',     'Умови',             'Terms'],
    ['#refund',    'Повернення',        'Refund'],
    ['#contacts',  'Контакти',         'Contacts'],
  ] : [
    ['#features',  'Можливості',        'Features'],
    ['#download',  'Завантажити',       'Download'],
    ['legal.html', 'Правова інформація','Legal'],
  ];

  const navHtml = navLinks
    .map(([href, uk, en]) => `<a href="${href}" data-uk="${uk}" data-en="${en}">${en}</a>`)
    .join('');

  const sub = isLegal
    ? '<span class="logo-sub">Twine Story Constructor</span>'
    : '';

  document.querySelector('header').innerHTML =
    '<a href="/" class="logo">' +
      '<img src="Icon.PNG" alt="Purl" class="logo-img" />' +
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
