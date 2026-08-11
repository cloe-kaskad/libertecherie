// assets/evenements.js
// Récupère les événements via la fonction Netlify et rend les deux sections.
// NOTE : les URLs d'images renvoyées par l'API sont temporaires (régénérées à
// chaque appel). On ne les stocke JAMAIS (pas de localStorage, pas de cache) —
// la page les relit à chaque chargement.

(function () {
  'use strict';

  var $ = function (s, c) { return (c || document).querySelector(s); };

  var JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function esc(s) {
    return (s == null ? '' : String(s)).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // "jeudi 24 septembre 2026, 19h" (ou "…, 19h30")
  function formatDate(iso, withHour) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    var s = JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear();
    if (withHour === false) return s;
    var h = d.getHours(), m = d.getMinutes();
    if (h || m) s += ', ' + h + 'h' + (m ? (m < 10 ? '0' + m : m) : '');
    return s;
  }

  function formatPrix(p) {
    if (p === 0) return 'Gratuit';
    if (p == null || p === '') return '';
    var n = Number(p);
    if (isNaN(n)) return String(p);
    return (n % 1 === 0 ? n : n.toFixed(2).replace('.', ',')) + ' €';
  }

  function formatJauge(j) {
    if (j == null || j === '') return '';
    var n = Number(j);
    if (isNaN(n) || n <= 0) return '';
    return (n === 1 ? '1 place maximum' : n + ' places maximum');
  }

  function normStatut(s) {
    return (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  function placesLine(n) {
    var v = Number(n);
    if (isNaN(v) || v <= 0 || v > 5) return '';
    return '<div class="ev-places">' + (v === 1 ? 'Dernière place' : v + ' places restantes') + '</div>';
  }

  function coverHTML(url, alt, cls) {
    if (url) {
      return '<div class="' + cls + '"><img src="' + esc(url) + '" alt="' + esc(alt) + '" loading="lazy"></div>';
    }
    return '<div class="' + cls + '"><div class="ev-cover-ph"><span>✦</span></div></div>';
  }

  // ── Carte "À venir" ────────────────────────────────────────────────────
  function cardAVenir(ev) {
    var st = normStatut(ev.statut);
    var isTeasing = st === 'teasing';
    var isComplet = st === 'complet';

    var action;
    if (isComplet) {
      action = '<span class="ev-btn is-disabled" aria-disabled="true">Complet</span>';
    } else if (isTeasing) {
      action = '<span class="ev-soon">Billetterie bientôt ouverte</span>';
    } else if (ev.lienPaiement) {
      action = '<a class="ev-btn" href="' + esc(ev.lienPaiement) + '" target="_blank" rel="noopener">Réserver ma place</a>';
    } else {
      action = '<span class="ev-soon">Billetterie bientôt ouverte</span>';
    }

    var meta = [];
    if (ev.lieu) meta.push('<span class="ev-lieu">' + esc(ev.lieu) + '</span>');
    var prix = formatPrix(ev.prix);
    var infos = [prix, formatJauge(ev.jauge)].filter(Boolean).join(' · ');

    return '' +
      '<article class="ev-card' + (isTeasing ? ' is-teasing' : '') + (isComplet ? ' is-complet' : '') + '">' +
        coverHTML(ev.image, ev.titre || '', 'ev-cover') +
        '<div class="ev-body">' +
          (ev.format ? '<div class="ev-format">' + esc(ev.format) + '</div>' : '') +
          '<h3 class="ev-titre">' + esc(ev.titre || 'À préciser') + '</h3>' +
          '<div class="ev-when">' + esc(formatDate(ev.date)) + '</div>' +
          (meta.length ? '<div class="ev-meta">' + meta.join('') + '</div>' : '') +
          (ev.accroche ? '<p class="ev-accroche">' + esc(ev.accroche) + '</p>' : '') +
          (infos ? '<div class="ev-infos">' + esc(infos) + '</div>' : '') +
          '<div class="ev-foot">' +
            (prix ? '<div class="ev-prix">' + esc(prix) + '</div>' : '') +
            '<div class="ev-action">' + action + placesLine(ev.placesRestantes) + '</div>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  // ── Carte "Ce qui a eu lieu" ───────────────────────────────────────────
  function cardPasse(ev) {
    return '' +
      '<article class="ev-past">' +
        coverHTML(ev.image, ev.titre || '', 'ev-past-cover') +
        '<div class="ev-past-body">' +
          '<h3 class="ev-past-titre">' + esc(ev.titre || '') + '</h3>' +
          '<div class="ev-past-when">' + esc(formatDate(ev.date, false)) + '</div>' +
          (ev.accroche ? '<p class="ev-past-accroche">' + esc(ev.accroche) + '</p>' : '') +
        '</div>' +
      '</article>';
  }

  // ── États ──────────────────────────────────────────────────────────────
  function skeletons(n) {
    var out = '';
    for (var i = 0; i < n; i++) {
      out += '<div class="ev-skel"><div class="ev-skel-cover"></div>' +
             '<div class="ev-skel-body">' +
               '<span class="ev-skel-line w30"></span>' +
               '<span class="ev-skel-line w80 tall"></span>' +
               '<span class="ev-skel-line w50"></span>' +
               '<span class="ev-skel-line w90"></span>' +
               '<span class="ev-skel-line w70"></span>' +
               '<span class="ev-skel-btn"></span>' +
             '</div></div>';
    }
    return out;
  }

  function renderError(host) {
    host.innerHTML = '<p class="ev-note">Le programme ne s\'affiche pas pour le moment. ' +
      'Écrivez-nous à <a href="mailto:bonjour@libertecherie.paris">bonjour@libertecherie.paris</a> ' +
      'et on vous répond avec les prochaines dates.</p>';
  }

  function renderEmpty(host) {
    host.innerHTML = '<p class="ev-note">La prochaine date arrive bientôt. ' +
      '<a href="newsletter.html">Inscrivez-vous à la newsletter</a> pour la recevoir en premier.</p>';
  }

  // ── Chargement ─────────────────────────────────────────────────────────
  function load() {
    var upcoming = $('#evUpcoming');
    var pastSection = $('#evPastSection');
    var pastGrid = $('#evPastGrid');

    upcoming.innerHTML = skeletons(2);
    pastSection.hidden = true;

    fetch('/api/evenements', { headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        var aVenir = (data && data.aVenir) || [];
        var passes = (data && data.passes) || [];

        if (aVenir.length) {
          upcoming.innerHTML = aVenir.map(cardAVenir).join('');
        } else {
          renderEmpty(upcoming);
        }

        if (passes.length) {
          pastGrid.innerHTML = passes.map(cardPasse).join('');
          pastSection.hidden = false;
        } else {
          pastSection.hidden = true;
        }
      })
      .catch(function (err) {
        console.warn('[événements] chargement impossible :', err && err.message);
        renderError(upcoming);
        pastSection.hidden = true;
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
