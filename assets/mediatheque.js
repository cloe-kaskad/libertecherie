// assets/mediatheque.js
// Logique de la médiathèque : récupère les données via la fonction Netlify,
// rend les fiches, gère recherche + filtres (Type / Thème prioritaires).

(function () {
  'use strict';

  // ── Données d'exemple (preview) ────────────────────────────────────────
  // Utilisées UNIQUEMENT si l'API Airtable n'est pas joignable (ex: preview
  // locale, env vars pas encore configurées). En production, ces fiches sont
  // remplacées par les vraies données Airtable.
  const SAMPLE = [
    {
      id: 'sample1', titre: 'La Poudre', auteur: 'Lauren Bastide', type: 'Podcast',
      recommandePar: 'Cloé Dana', themes: ['Faire entendre sa voix', 'Modèles relationnels'],
      description: "Lauren Bastide donne la parole à des femmes qui font — artistes, militantes, penseuses. Des conversations longues, sans format. La référence féministe francophone.",
      cover: null, lien: 'https://feeds.audiomeans.fr', langue: 'Français', coupDeCoeur: true, duree: '~1h', statut: 'Publié',
    },
    {
      id: 'sample2', titre: 'King Kong Théorie', auteur: 'Virginie Despentes', type: 'Livre',
      recommandePar: "L'équipe LC", themes: ['Colère juste', 'Corps & désir'],
      description: "Un essai-manifeste, brutal et lucide, sur le genre, la violence et la liberté. Un texte qui ne s'excuse pas.",
      cover: null, lien: '#', langue: 'Français', coupDeCoeur: false, duree: '160 p.', statut: 'Publié',
    },
    {
      id: 'sample3', titre: 'Portrait de la jeune fille en feu', auteur: 'Céline Sciamma', type: 'Film',
      recommandePar: 'Stéphanie Matharet', themes: ['Corps & désir', 'Regard'],
      description: "Le désir, le regard, la mémoire. Un film sur ce que veut dire vraiment voir une autre femme.",
      cover: null, lien: '#', langue: 'Français', coupDeCoeur: true, duree: '2h02', statut: 'Publié',
    },
    {
      id: 'sample4', titre: 'Les Couilles sur la table', auteur: 'Victoire Tuaillon', type: 'Podcast',
      recommandePar: 'Julie Harriau', themes: ['Masculinités', 'Faire entendre sa voix'],
      description: "Enquête sur les masculinités contemporaines. Pour comprendre comment on devient un homme — et ce que ça coûte à tout le monde.",
      cover: null, lien: '#', langue: 'Français', coupDeCoeur: false, duree: '~1h', statut: 'Publié',
    },
    {
      id: 'sample5', titre: 'Mon corps, mon choix', auteur: 'Collectif', type: 'Documentaire',
      recommandePar: 'La communauté', themes: ['Corps & désir', 'Droits'],
      description: "Un état des lieux des droits reproductifs, des reculs et des combats. Indispensable.",
      cover: null, lien: '#', langue: 'Français', coupDeCoeur: false, duree: '52 min', statut: 'Publié',
    },
    {
      id: 'sample6', titre: "L'argent des femmes", auteur: 'Léa Lejeune', type: 'Livre',
      recommandePar: 'Cloé Dana', themes: ['Indépendance financière'],
      description: "Comprendre l'écart, le plafond de verre, l'autonomie. Ce que l'argent fait aux femmes — et l'inverse.",
      cover: null, lien: '#', langue: 'Français', coupDeCoeur: true, duree: '240 p.', statut: 'Publié',
    },
  ];

  // ── Helpers ──────────────────────────────────────────────────────────
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const norm = (s) => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  const state = {
    all: [],
    type: 'Tous',
    themes: new Set(),
    auteur: '',
    reco: '',
    coupDeCoeur: false,
    query: '',
    isSample: false,
  };

  // ── Récupération des données ───────────────────────────────────────────
  async function load() {
    try {
      const res = await fetch('/api/mediatheque', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data.items || !Array.isArray(data.items)) throw new Error('Format inattendu');
      state.all = data.items;
      state.isSample = false;
    } catch (err) {
      console.warn('[médiathèque] API indisponible, données d\'exemple utilisées :', err.message);
      state.all = SAMPLE;
      state.isSample = true;
    }
    buildFilters();
    render();
    // bandeau "aperçu" si on affiche les exemples
    const note = document.getElementById('previewNote');
    if (note) note.style.display = state.isSample ? 'block' : 'none';
  }

  // ── Construction des filtres (dynamique d'après les données) ────────────
  function buildFilters() {
    // Types
    const types = Array.from(new Set(state.all.map(r => r.type).filter(Boolean))).sort();
    const typeRow = $('#typeChips');
    typeRow.innerHTML = '';
    ['Tous', ...types].forEach(t => {
      const b = document.createElement('button');
      b.className = 'chip' + (t === 'Tous' ? ' is-active' : '');
      b.textContent = t;
      b.addEventListener('click', () => {
        state.type = t;
        typeRow.querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c === b));
        render();
      });
      typeRow.appendChild(b);
    });

    // Thèmes
    const themeSet = new Set();
    state.all.forEach(r => (r.themes || []).forEach(t => themeSet.add(t)));
    const themes = Array.from(themeSet).sort((a, b) => a.localeCompare(b, 'fr'));
    const themeRow = $('#themeChips');
    themeRow.innerHTML = '';
    themes.forEach(t => {
      const b = document.createElement('button');
      b.className = 'chip chip-theme';
      b.textContent = t;
      b.addEventListener('click', () => {
        if (state.themes.has(t)) state.themes.delete(t); else state.themes.add(t);
        b.classList.toggle('is-active');
        render();
      });
      themeRow.appendChild(b);
    });
    if (themes.length === 0) $('#themeFilterBlock').style.display = 'none';

    // Auteur (select)
    const auteurs = Array.from(new Set(state.all.map(r => r.auteur).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr'));
    fillSelect($('#auteurSelect'), auteurs, 'Auteur·ice');

    // Recommandé par (select)
    const recos = Array.from(new Set(state.all.map(r => r.recommandePar).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr'));
    fillSelect($('#recoSelect'), recos, 'Recommandé par');
    if (recos.length === 0) $('#recoSelect').style.display = 'none';
  }

  function fillSelect(sel, values, label) {
    sel.innerHTML = '';
    const opt0 = document.createElement('option');
    opt0.value = ''; opt0.textContent = label + ' · tou·tes';
    sel.appendChild(opt0);
    values.forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = v;
      sel.appendChild(o);
    });
  }

  // ── Filtrage ────────────────────────────────────────────────────────────
  function filtered() {
    const q = norm(state.query);
    return state.all.filter(r => {
      if (state.type !== 'Tous' && r.type !== state.type) return false;
      if (state.themes.size > 0) {
        const has = (r.themes || []).some(t => state.themes.has(t));
        if (!has) return false;
      }
      if (state.auteur && r.auteur !== state.auteur) return false;
      if (state.reco && r.recommandePar !== state.reco) return false;
      if (state.coupDeCoeur && !r.coupDeCoeur) return false;
      if (q) {
        const hay = norm([r.titre, r.auteur, r.type, r.recommandePar, (r.themes || []).join(' '), r.description].join(' '));
        // tous les mots de la recherche doivent être présents
        const words = q.split(/\s+/).filter(Boolean);
        if (!words.every(w => hay.includes(w))) return false;
      }
      return true;
    });
  }

  // ── Rendu ────────────────────────────────────────────────────────────────
  function render() {
    const items = filtered();
    const grid = $('#grid');
    const count = $('#resultCount');

    count.textContent = items.length === 0
      ? 'Aucun résultat'
      : items.length + (items.length > 1 ? ' références' : ' référence');

    // bouton réinitialiser visible si un filtre est actif
    const anyFilter = state.type !== 'Tous' || state.themes.size > 0 || state.auteur || state.reco || state.coupDeCoeur || state.query;
    $('#resetBtn').style.display = anyFilter ? 'inline-flex' : 'none';

    if (items.length === 0) {
      grid.innerHTML = '<div class="mt-empty"><div class="mt-empty-mark">∅</div><p>Rien ne correspond à ces filtres.<br>Essaie d\'élargir ta recherche.</p></div>';
      return;
    }

    grid.innerHTML = items.map(cardHTML).join('');
  }

  function esc(s) {
    return (s || '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function cardHTML(r) {
    const themeChips = (r.themes || []).slice(0, 3).map(t => `<span class="mt-theme">${esc(t)}</span>`).join('');
    const coverInner = r.cover
      ? `<img src="${esc(r.cover)}" alt="${esc(r.titre)}" loading="lazy">`
      : `<div class="mt-cover-ph"><span>${esc((r.type || '?').charAt(0))}</span></div>`;
    const heart = r.coupDeCoeur ? '<span class="mt-heart" title="Coup de cœur">♥</span>' : '';
    const meta = [r.langue, r.duree].filter(Boolean).join(' · ');
    const reco = r.recommandePar ? `<div class="mt-reco">Recommandé par <strong>${esc(r.recommandePar)}</strong></div>` : '';
    const link = r.lien && r.lien !== '#'
      ? `<a class="mt-go" href="${esc(r.lien)}" target="_blank" rel="noopener">Découvrir <span>↗</span></a>` : '';

    return `
      <article class="mt-card">
        <div class="mt-cover">${coverInner}${heart}</div>
        <div class="mt-card-body">
          ${r.type ? `<div class="mt-type">${esc(r.type)}</div>` : ''}
          <h3 class="mt-title">${esc(r.titre)}</h3>
          ${r.auteur ? `<div class="mt-author">${esc(r.auteur)}</div>` : ''}
          ${themeChips ? `<div class="mt-themes">${themeChips}</div>` : ''}
          ${r.description ? `<p class="mt-desc">${esc(r.description)}</p>` : ''}
          <div class="mt-foot">
            ${reco}
            ${meta ? `<div class="mt-meta">${esc(meta)}</div>` : ''}
            ${link}
          </div>
        </div>
      </article>`;
  }

  // ── Init / écouteurs ─────────────────────────────────────────────────────
  function init() {
    const search = $('#searchInput');
    let t;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { state.query = search.value; render(); }, 120);
    });

    $('#auteurSelect').addEventListener('change', e => { state.auteur = e.target.value; render(); });
    $('#recoSelect').addEventListener('change', e => { state.reco = e.target.value; render(); });
    $('#coeurToggle').addEventListener('click', function () {
      state.coupDeCoeur = !state.coupDeCoeur;
      this.classList.toggle('is-active', state.coupDeCoeur);
      this.setAttribute('aria-pressed', state.coupDeCoeur);
      render();
    });
    $('#resetBtn').addEventListener('click', () => {
      state.type = 'Tous'; state.themes.clear(); state.auteur = ''; state.reco = '';
      state.coupDeCoeur = false; state.query = '';
      search.value = '';
      $('#auteurSelect').value = ''; $('#recoSelect').value = '';
      $('#coeurToggle').classList.remove('is-active');
      document.querySelectorAll('#typeChips .chip').forEach((c, i) => c.classList.toggle('is-active', i === 0));
      document.querySelectorAll('#themeChips .chip').forEach(c => c.classList.remove('is-active'));
      render();
    });

    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
