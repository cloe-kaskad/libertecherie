/* Suivi des conversions Liberté, Chérie ! -> envoie des événements à GTM (dataLayer) */
(function () {
  var dl = window.dataLayer = window.dataLayer || [];
  var page = location.pathname.replace(/\.html$/, '') || '/';
  function push(event, data) {
    var o = { event: event, page_location_path: page };
    for (var k in data) o[k] = data[k];
    dl.push(o);
  }


  // 0. UTM : on garde le premier point de contact (90 jours) pour l'attribution des inscriptions
  try {
    var qs = new URLSearchParams(location.search), utm = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(function (k) { if (qs.get(k)) utm[k] = qs.get(k).slice(0, 60); });
    if (Object.keys(utm).length) {
      var prev = JSON.parse(localStorage.getItem('lc_utm') || 'null');
      if (!prev || (Date.now() - (prev.t || 0)) > 90 * 864e5) { utm.t = Date.now(); utm.landing = page; localStorage.setItem('lc_utm', JSON.stringify(utm)); }
    }
  } catch (e) {}
  window.lcSource = function () {
    try {
      var u = JSON.parse(localStorage.getItem('lc_utm') || 'null');
      if (!u) return page;
      return [u.utm_source, u.utm_medium, u.utm_campaign, u.utm_content].filter(Boolean).join('/') + ' @ ' + (u.landing || page);
    } catch (e) { return page; }
  };

  // 0 bis. Clics : CTA principaux, cartes, liens sortants
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    var sec = a.closest('section, header, footer, nav');
    var section = sec ? (sec.id || sec.className.split(' ')[0] || sec.tagName.toLowerCase()) : '';
    if (a.dataset.cta) {
      push('cta_click', { cta_id: a.dataset.cta, cta_text: (a.textContent || '').trim().slice(0, 60), section: section });
    } else if (a.classList.contains('fcard-link') || a.closest('.fcard')) {
      var card = a.closest('.fcard'), cat = card && card.querySelector('.fcard-cat');
      push('format_click', { format: cat ? cat.textContent.trim() : '', section: section });
    } else if (a.classList.contains('ec-link')) {
      var ec = a.closest('.edito-card'), name = ec && ec.querySelector('.ec-name');
      push('edito_click', { item: name ? name.textContent.trim().replace(/\s+/g, ' ') : '', section: section });
    } else if (a.classList.contains('invitee')) {
      push('invitee_click', { name: (a.getAttribute('aria-label') || '').replace(/^Instagram de /, ''), section: section });
    } else if (/^https?:/.test(href) && a.host !== location.host && !/^\/lettres\//.test(page)) {
      var dom = a.host.replace(/^www\./, '');
      push('outbound_click', { link_domain: dom, link_url: a.href.split('?')[0], link_text: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 60), section: section });
    } else if (href === '#newsletter' || href === '/#newsletter') {
      push('cta_click', { cta_id: 'newsletter_anchor', cta_text: (a.textContent || '').trim().slice(0, 60), section: section });
    }
  }, true);


  // 0 ter. FAQ : question ouverte
  document.addEventListener('toggle', function (e) {
    var d = e.target; if (!d || !d.classList || !d.classList.contains('faq-item') || !d.open) return;
    var q = d.querySelector('summary span'); push('faq_open', { question: q ? q.textContent.trim().slice(0, 80) : '' });
  }, true);

  // 1. Inscription newsletter réussie (accueil, page newsletter, médiathèque)
  if (window.fetch) {
    var _fetch = window.fetch;
    window.fetch = function (url, opts) {
      try {
        if (String(url).indexOf('/api/subscribe') !== -1 && opts && typeof opts.body === 'string') {
          var b = JSON.parse(opts.body); if (b && b.email && !b.source) { b.source = window.lcSource(); opts.body = JSON.stringify(b); }
        }
      } catch (e) {}
      var p = _fetch.apply(this, arguments);
      try {
        if (String(url).indexOf('/api/subscribe') !== -1) {
          p.then(function (r) { if (r && r.ok) push('newsletter_signup', { form_location: page }); });
        }
      } catch (e) {}
      return p;
    };
  }

  // 2. Accès à la médiathèque débloqué
  try {
    var _set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'lc_mediatheque_unlocked' && localStorage.getItem(k) !== '1') push('mediatheque_unlock', {});
      return _set.apply(this, arguments);
    };
  } catch (e) {}

  // 2 bis. Clics sortants dans les lettres / la toolbox (/lettres/...)
  if (/^\/lettres\//.test(page)) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a');
      if (!a || !/^(https?:|mailto:)/.test(a.getAttribute('href') || '')) return;
      push('lettre_click', { link_url: a.href.split('?')[0], link_text: (a.textContent || '').trim().slice(0, 80) });
    }, true);
  }

  // 3. Clics sur les événements
  function titleFor(el) {
    var card = el.closest('article, section, .ev-card');
    var h = card && card.querySelector('h1, h2, h3');
    return (h ? h.textContent : document.title).trim().slice(0, 100);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a || !a.getAttribute('href')) return;
    if (a.classList.contains('ev-more')) {
      push('event_details_click', { event_title: titleFor(a) });
    } else if ((a.classList.contains('ev-btn') || a.classList.contains('fe-btn')) &&
               !a.classList.contains('is-disabled') && !a.classList.contains('is-soon') &&
               /^https?:/.test(a.getAttribute('href'))) {
      push('reserve_click', { event_title: titleFor(a), cta_id: a.id || 'liste' });
    }
  }, true);

  // 4. Réservation confirmée (page merci, une seule fois par session)
  // Envoyé après le chargement complet, pour passer après le choix cookies (pixel Meta).
  if (/\/merci$/.test(page)) {
    window.addEventListener('load', function () {
      try {
        if (!sessionStorage.getItem('lc_resa_tracked')) {
          sessionStorage.setItem('lc_resa_tracked', '1');
          var ev = new URLSearchParams(location.search).get('event') || '';
          push('reservation_confirmed', { event_title: ev });
        }
      } catch (e) { push('reservation_confirmed', {}); }
    });
  }
})();
