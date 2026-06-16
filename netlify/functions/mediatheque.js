// netlify/functions/mediatheque.js
//
// Endpoint : GET /.netlify/functions/mediatheque  (alias : GET /api/mediatheque)
//
// Va chercher les recommandations dans Airtable et renvoie un JSON propre
// que la page mediatheque.html consomme. Le token Airtable reste SECRET,
// côté serveur — il n'apparaît jamais dans le code de la page.
//
// ────────────────────────────────────────────────────────────────────────
// VARIABLES D'ENVIRONNEMENT À DÉFINIR DANS NETLIFY
// (Site settings → Environment variables) :
//
//   AIRTABLE_TOKEN     Ton Personal Access Token Airtable (scope data.records:read)
//   AIRTABLE_BASE_ID   L'ID de la base — commence par "app…"
//   AIRTABLE_TABLE     Le NOM exact de la table (ex: "Recommandations")
//                      ↳ optionnel, défaut "Recommandations"
// ────────────────────────────────────────────────────────────────────────

// Statuts qu'on NE montre PAS sur le site public.
// Par défaut on affiche TOUT (y compris "À valider") — on ne masque que
// ce qui est explicitement un brouillon ou archivé. Ajuste cette liste
// si tu veux masquer d'autres statuts (ex: ajoute 'à valider').
const STATUTS_CACHES = ['brouillon', 'archivé', 'archive', 'masqué', 'masque', 'rejeté', 'rejete'];

// Pour chaque champ logique, on essaie plusieurs orthographes possibles
// (comme ça si tu renommes une colonne, ça continue de marcher).
const FIELD_CANDIDATES = {
  titre:        ['Titre', 'Nom', 'Name'],
  auteur:       ['Auteur', 'Auteur·ice', 'Autrice', 'Auteur·rice'],
  type:         ['Type'],
  recommandePar:['Recommandé par', 'Recommandée par', 'Recommandation', 'Recommandé·e par'],
  themes:       ['Thème LC', 'Thème(s) LC', 'Thèmes LC', 'Theme LC', 'Thème', 'Themes', 'Thème(s)', 'Thèmes', 'Theme(s) LC', 'Thematiques', 'Tags', 'Catégories', 'Categories'],
  description:  ['Description', 'Résumé', 'Resume', 'Résumé automatique (AI)'],
  cover:        ['Image de couverture', 'Couverture', 'Cover', 'Image', 'Visuel'],
  lien:         ['Lien', 'URL', 'Url', 'Link'],
  langue:       ['Langue'],
  coupDeCoeur:  ['Coup de cœur', 'Coup de coeur', 'Coup de Cœur', 'Favori'],
  date:         ['Date de publication', 'Date', 'Publié le'],
  duree:        ['Durée', 'Duree', 'Duration'],
  statut:       ['Statut', 'Status', 'État', 'Etat'],
};

function pick(fields, candidates) {
  for (const name of candidates) {
    if (fields[name] !== undefined && fields[name] !== null && fields[name] !== '') {
      return fields[name];
    }
  }
  return undefined;
}

function coverUrl(att) {
  if (!Array.isArray(att) || att.length === 0) return null;
  const a = att[0];
  // préfère une vignette large si dispo, sinon l'URL d'origine
  if (a.thumbnails && a.thumbnails.large && a.thumbnails.large.url) return a.thumbnails.large.url;
  return a.url || null;
}

function normalize(record) {
  const f = record.fields || {};
  let themes = pick(f, FIELD_CANDIDATES.themes);
  // Filet 1 : cherche n'importe quelle colonne dont le nom contient "thème/theme" (insensible aux accents).
  if (themes === undefined) {
    for (const k of Object.keys(f)) {
      if (/th[eèé]me/i.test(k)) { themes = f[k]; break; }
    }
  }
  // Filet 2 : cherche n'importe quelle colonne dont la valeur est un tableau de strings
  // (c'est le format Airtable des champs "Multiple select") — exclut les champs connus.
  const KNOWN_ARRAY_FIELDS = ['Image de couverture', 'Couverture', 'Cover', 'Image', 'Visuel', 'Recommandé par', 'Recommandée par'];
  if (themes === undefined || (Array.isArray(themes) && themes.length === 0)) {
    for (const k of Object.keys(f)) {
      if (KNOWN_ARRAY_FIELDS.includes(k)) continue;
      if (FIELD_CANDIDATES.type.includes(k)) continue;
      const v = f[k];
      if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'string' && !v[0].startsWith('att')) {
        themes = v; break;
      }
    }
  }
  if (typeof themes === 'string') themes = themes.split(',').map(s => s.trim()).filter(Boolean);
  if (!Array.isArray(themes)) themes = themes ? [themes] : [];

  return {
    id:            record.id,
    titre:         pick(f, FIELD_CANDIDATES.titre) || 'Sans titre',
    auteur:        pick(f, FIELD_CANDIDATES.auteur) || '',
    type:          pick(f, FIELD_CANDIDATES.type) || '',
    recommandePar: pick(f, FIELD_CANDIDATES.recommandePar) || '',
    themes,
    description:   pick(f, FIELD_CANDIDATES.description) || '',
    cover:         coverUrl(pick(f, FIELD_CANDIDATES.cover)),
    lien:          pick(f, FIELD_CANDIDATES.lien) || '',
    langue:        pick(f, FIELD_CANDIDATES.langue) || '',
    coupDeCoeur:   !!pick(f, FIELD_CANDIDATES.coupDeCoeur),
    date:          pick(f, FIELD_CANDIDATES.date) || '',
    duree:         pick(f, FIELD_CANDIDATES.duree) || '',
    statut:        pick(f, FIELD_CANDIDATES.statut) || '',
  };
}

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    // cache court : la page recharge des URLs d'images fraîches régulièrement
    'Cache-Control': 'public, max-age=300',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }

  const token  = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table  = process.env.AIRTABLE_TABLE || 'Recommandations';

  if (!token || !baseId) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Configuration manquante : AIRTABLE_TOKEN et AIRTABLE_BASE_ID requis.' }),
    };
  }

  try {
    let records = [];
    let offset = undefined;

    // Airtable pagine par 100 — on boucle jusqu'à tout récupérer.
    do {
      const url = new URL(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`);
      url.searchParams.set('pageSize', '100');
      if (offset) url.searchParams.set('offset', offset);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error('Airtable error', res.status, detail);
        return {
          statusCode: 502,
          headers: cors,
          body: JSON.stringify({ error: 'Lecture Airtable impossible', status: res.status, detail: detail.slice(0, 300) }),
        };
      }

      const data = await res.json();
      records = records.concat(data.records || []);
      offset = data.offset;
    } while (offset);

    // MODE DEBUG : ?debug=1 → renvoie les noms de colonnes du 1er enregistrement
    if (event.queryStringParameters && event.queryStringParameters.debug === '1') {
      const firstRecord = records[0];
      const fieldNames = firstRecord ? Object.keys(firstRecord.fields || {}) : [];
      const sample = {};
      fieldNames.forEach(k => {
        const v = firstRecord.fields[k];
        sample[k] = Array.isArray(v) ? `[Array(${v.length})] ${JSON.stringify(v[0])}` : typeof v === 'string' ? v.slice(0,60) : v;
      });
      return { statusCode: 200, headers: cors, body: JSON.stringify({ totalRecords: records.length, fieldNames, sample }) };
    }

    // normalise + masque les statuts non publics
    const items = records
      .map(normalize)
      .filter(r => !STATUTS_CACHES.includes((r.statut || '').toString().trim().toLowerCase()));

    // tri : coups de cœur d'abord, puis par date décroissante
    items.sort((a, b) => {
      if (a.coupDeCoeur !== b.coupDeCoeur) return a.coupDeCoeur ? -1 : 1;
      return (b.date || '').localeCompare(a.date || '');
    });

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ count: items.length, items }),
    };
  } catch (err) {
    console.error('mediatheque failed', err);
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Erreur serveur', detail: String(err).slice(0, 300) }),
    };
  }
};
