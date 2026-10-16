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

const crypto = require('crypto');

const BREVO_LIST_ID = parseInt(process.env.BREVO_LIST_ID || '3', 10);

// Cookie d'accès aux espaces réservés (/lettres, Médiathèque).
// Même signature que netlify/edge-functions/lettres-gate.js : ne pas modifier l'un sans l'autre.
const ACCESS_MAX_AGE = 60 * 60 * 24 * 365; // 12 mois
function accessCookies() {
  const secret = process.env.LC_ACCESS_SECRET || process.env.BREVO_API_KEY || '';
  const exp = String(Math.floor(Date.now() / 1000) + ACCESS_MAX_AGE);
  const sig = crypto.createHmac('sha256', 'lc-access:' + secret).update('v1.' + exp).digest('base64url');
  return [
    `lc_access=v1.${exp}.${sig}; Path=/; Max-Age=${ACCESS_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
    `lc_member=1; Path=/; Max-Age=${ACCESS_MAX_AGE}; Secure; SameSite=Lax`,
  ];
}

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
    var source = typeof payload.source === 'string' ? payload.source.replace(/[^\w\s@\/\-\.:#?=&]/g, '').slice(0, 120) : '';
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
          SOURCE: 'site libertecherie.paris' + (source ? ' | ' + source : ''),
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
      multiValueHeaders: { 'Set-Cookie': accessCookies() },
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
