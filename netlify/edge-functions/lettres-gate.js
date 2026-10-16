// netlify/edge-functions/lettres-gate.js
//
// Section /lettres (archive des newsletters + toolbox).
// Tout le monde voit l'archive et un aperçu de chaque lettre ; le contenu complet
// est réservé aux inscrites à la liste Brevo #3.
//
//  - Lien depuis un email Brevo : /lettres/...?e={{ contact.EMAIL }}
//    → on vérifie dans Brevo que l'adresse est inscrite, on dépose le cookie d'accès,
//      puis on redirige vers la même URL SANS l'adresse (rien ne remonte dans GA).
//  - Cookie d'accès valide → page complète.
//  - Sinon → la page est servie en mode aperçu (<html class="lc-locked">) :
//    assets/lettres-gate.js coupe le contenu et affiche le formulaire d'inscription.
//
// Variables d'environnement : BREVO_API_KEY (déjà présente), BREVO_LIST_ID (défaut 3),
// LC_ACCESS_SECRET (facultative ; à défaut, la clé de signature est dérivée de BREVO_API_KEY).
// La signature doit rester identique à celle de netlify/functions/subscribe.js.

const COOKIE = "lc_access";
const MEMBER_COOKIE = "lc_member"; // non-HttpOnly, sert seulement à l'affichage
const MAX_AGE = 60 * 60 * 24 * 365; // 12 mois
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const env = (k) => Netlify.env.get(k);
const listId = () => Number(env("BREVO_LIST_ID") || 3);

async function hmacKey() {
  const secret = env("LC_ACCESS_SECRET") || env("BREVO_API_KEY") || "";
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("lc-access:" + secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function b64url(buf) {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(exp) {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode("v1." + exp));
  return b64url(sig);
}

async function isValidCookie(value) {
  if (!value) return false;
  const [ver, exp, sig] = value.split(".");
  if (ver !== "v1" || !exp || !sig) return false;
  if (Number(exp) < Date.now() / 1000) return false;
  return (await sign(exp)) === sig;
}

async function accessCookies() {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const token = `v1.${exp}.${await sign(String(exp))}`;
  return [
    `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax`,
    `${MEMBER_COOKIE}=1; Path=/; Max-Age=${MAX_AGE}; Secure; SameSite=Lax`,
  ];
}

async function isSubscriber(email) {
  const apiKey = env("BREVO_API_KEY");
  if (!apiKey) return false;
  const res = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
    headers: { accept: "application/json", "api-key": apiKey },
  });
  if (!res.ok) return false; // 404 = adresse inconnue
  const c = await res.json();
  const id = listId();
  return (
    Array.isArray(c.listIds) && c.listIds.includes(id) &&
    !c.emailBlacklisted &&
    !(c.listUnsubscribed || []).includes(id)
  );
}

function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const c of cookies) headers.append("Set-Cookie", c);
  return new Response(null, { status: 302, headers });
}

function privateCopy(res, body, indexable = false) {
  const out = new Response(body === undefined ? res.body : body, res);
  out.headers.set("Cache-Control", "private, no-store");
  if (!indexable) out.headers.set("X-Robots-Tag", "noindex");
  out.headers.delete("Content-Length");
  return out;
}

export default async (request, context) => {
  const url = new URL(request.url);

  // Arrivée depuis un email Brevo : on reconnaît l'inscrite, puis on nettoie l'URL
  if (url.searchParams.has("e")) {
    // Brevo n'encode pas toujours le « + » des adresses : il arrive sous forme d'espace.
    const email = (url.searchParams.get("e") || "").trim().replace(/ /g, "+").toLowerCase();
    url.searchParams.delete("e");
    let ok = false;
    try {
      ok = EMAIL_RE.test(email) && (await isSubscriber(email));
    } catch (err) {
      console.error("Vérification Brevo impossible :", err);
    }
    return redirect(url.toString(), ok ? await accessCookies() : []);
  }

  // Arrivée après le formulaire Meta (Lead Ads) : l'email vient d'être donné à Meta,
  // on ouvre l'accès sans le redemander, puis on nettoie l'URL (les utm restent).
  if (url.searchParams.get("acces") === "meta-toolbox") {
    url.searchParams.delete("acces");
    return redirect(url.toString(), await accessCookies());
  }

  // L'archive (/lettres) est une page publique : indexable par Google et les IA.
  const isArchive = /^\/lettres\/?$/.test(url.pathname);
  const res = await context.next();
  if (await isValidCookie(context.cookies.get(COOKIE))) return privateCopy(res, undefined, isArchive);

  // Pas d'accès : les pages HTML passent en mode aperçu
  const type = res.headers.get("content-type") || "";
  if (!type.includes("text/html")) return privateCopy(res);
  const html = await res.text();
  return privateCopy(res, html.replace(/<html([^>]*)>/i, '<html$1 class="lc-locked">'), isArchive);
};

// L'archive (/lettres) et les images restent publiques et en cache.
export const config = {
  path: ["/lettres", "/lettres/", "/lettres/*"],
  excludedPath: ["/lettres/img/*"],
};
