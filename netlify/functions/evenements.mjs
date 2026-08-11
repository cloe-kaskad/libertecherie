/* =========================================================
   LIBERTÉ, CHÉRIE ! — /api/evenements
   À placer dans : netlify/functions/evenements.mjs

   Cette fonction tourne sur le serveur Netlify, jamais dans le
   navigateur. Le jeton Airtable reste donc invisible, et seuls les
   champs listés ci-dessous sortent : aucune donnée d'inscrite ne
   peut fuiter, même en cas d'erreur de code côté page.

   VARIABLE D'ENVIRONNEMENT À CRÉER DANS NETLIFY :
   nom   : AIRTABLE_TOKEN_BILLETTERIE
   valeur: le jeton d'accès personnel Airtable, en lecture seule

   Nom distinct de AIRTABLE_TOKEN, qui existe déjà sur ce site pour
   une autre fonction et ne doit pas être écrasé.
   ========================================================= */

const BASE_ID = 'apphhe1sLf4iZE6gf';
const TABLE_ID = 'tbl4bERPAmIgEGZLQ';

// Seuls ces statuts sortent. Brouillon et Annulé ne quittent jamais Airtable.
const STATUTS_PUBLICS = ['Teasing', 'Billetterie ouverte', 'Complet', 'Passé'];

export default async () => {
  const token = process.env.AIRTABLE_TOKEN_BILLETTERIE;

  if (!token) {
    return json({ erreur: 'Jeton Airtable absent' }, 500);
  }

  const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
  url.searchParams.set('pageSize', '50');
  url.searchParams.append('sort[0][field]', 'Date et heure');
  url.searchParams.append('sort[0][direction]', 'asc');

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!res.ok) {
    return json({ erreur: `Airtable a répondu ${res.status}` }, 502);
  }

  const data = await res.json();

  const evenements = data.records
    .map((r) => r.fields)
    .filter((f) => STATUTS_PUBLICS.includes(f['Statut']))
    .map((f) => ({
      titre: f['Nom'] || '',
      format: f['Format'] || '',
      date: f['Date et heure'] || null,
      lieu: f['Lieu'] || '',
      prix: f['Prix TTC'] ?? null,
      accroche: f['Accroche'] || '',
      image: imageDe(f['Visuel']),
      lienPaiement: f['Lien de paiement'] || '',
      statut: f['Statut'],
      placesRestantes: f['Places restantes'] ?? null,
      jauge: f['Jauge'] ?? null,
    }));

  // Les événements passés basculent tout seuls, même si le statut
  // n'a pas été mis à jour à la main dans Airtable.
  const maintenant = Date.now();
  for (const e of evenements) {
    if (e.date && new Date(e.date).getTime() < maintenant && e.statut !== 'Passé') {
      e.statut = 'Passé';
    }
  }

  const aVenir = evenements
    .filter((e) => e.statut !== 'Passé');

  const passes = evenements
    .filter((e) => e.statut === 'Passé')
    .reverse(); // les plus récents d'abord

  return json({ aVenir, passes });
};

function imageDe(pieces) {
  // Airtable renvoie une URL fraîche à chaque appel de l'API. Elle expire
  // au bout de quelques heures, ce qui n'est pas un problème ici puisque
  // la fonction rappelle Airtable au moins toutes les minutes : le
  // navigateur reçoit donc toujours une adresse valide. Ne jamais stocker
  // cette URL ailleurs.
  if (!Array.isArray(pieces) || pieces.length === 0) return '';
  const p = pieces[0];
  return p.url || (p.thumbnails && p.thumbnails.large && p.thumbnails.large.url) || '';
}

function json(corps, status = 200) {
  return new Response(JSON.stringify(corps), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Une minute de cache : la page reste quasi temps réel sur le
      // compteur de places, sans taper Airtable à chaque visite.
      'Cache-Control': 'public, max-age=0, s-maxage=60',
    },
  });
}
