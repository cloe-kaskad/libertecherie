// netlify/functions/subscribe.js
//
// Endpoint : POST /.netlify/functions/subscribe
// Body JSON : { "email": "foo@bar.fr" }
//
// Ajoute l'adresse à la liste Brevo #3 (Newsletter LC) avec
// double opt-in si configuré dans Brevo.
//
// Variables d'environnement requises (Netlify → Site settings → Env vars) :
//   BREVO_API_KEY    Ta clé API v3 Brevo (xsmtpsib-…)
//   BREVO_LIST_ID    ID numérique de la liste (3)

const BREVO_LIST_ID = parseInt(process.env.BREVO_LIST_ID || '3', 10);

exports.handler = async (event) => {
  // CORS — autorise le formulaire à appeler depuis le domaine du site
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (_) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const email = (payload.email || '').trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailValid) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Adresse email invalide' }) };
  }

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Configuration manquante côté serveur' }) };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email,
        listIds: [BREVO_LIST_ID],
        updateEnabled: true,    // si l'email existe déjà, on met à jour ses listes
        attributes: {
          OPT_IN: true,
          SOURCE: 'site libertecherie.paris',
        },
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Brevo renvoie 400 si l'email est déjà dans la liste avec updateEnabled=false
      // — comme on l'a mis à true, ça ne devrait pas arriver, mais on log.
      console.error('Brevo error:', res.status, data);
      return {
        statusCode: 502,
        headers: cors,
        body: JSON.stringify({
          error: 'Inscription impossible pour le moment',
          detail: data.message || data.code,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error('Subscribe failed:', err);
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'Erreur serveur' }),
    };
  }
};
