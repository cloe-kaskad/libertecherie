/* Suivi des conversions Liberté, Chérie ! -> envoie des événements à GTM (dataLayer) */
(function () {
  var dl = window.dataLayer = window.dataLayer || [];
  var page = location.pathname.replace(/\.html$/, '') || '/';
  function push(event, data) {
    var o = { event: event, page_location_path: page };
    for (var k in data) o[k] = data[k];
    dl.push(o);
  }

  // 1. Inscription newsletter réussie (accueil, page newsletter, médiathèque)
  if (window.fetch) {
    var _fetch = window.fetch;
    window.fetch = function (url, opts) {
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
  if (/\/merci$/.test(page)) {
    try {
      if (!sessionStorage.getItem('lc_resa_tracked')) {
        sessionStorage.setItem('lc_resa_tracked', '1');
        push('reservation_confirmed', {});
      }
    } catch (e) { push('reservation_confirmed', {}); }
  }
})();
