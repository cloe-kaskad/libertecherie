// netlify/edge-functions/lettres-gate.js
//
// Protège la section /lettres (archive des newsletters + toolbox).
// Seules les inscrites à la liste Brevo #3 y ont accès.
//
// Trois façons d'entrer :
//  1. Cookie d'accès valide (déposé lors d'une visite précédente ou d'une inscription)
//  2. Lien depuis un email Brevo : /lettres/...?e={{ contact.EMAIL }}
//     → on vérifie dans Brevo que l'adresse est inscrite, on dépose le cookie,
//       puis on redirige vers la même URL SANS l'adresse (rien ne remonte dans GA).
//  3. Sinon → page publique /lettres-acces (aperçu + formulaire d'inscription)
//
// Variables d'environnement : BREVO_API_KEY (déjà présente), BREVO_LIST_ID (défaut 3),
// LC_ACCESS_SECRET (facultative ; à défaut, la clé de signature est dérivée de BREVO_API_KEY).
// La signature doit rester identique à celle de netlify/functions/subscribe.js.

const COOKIE = "lc_access";
const MEMBER_COOKIE = "lc_member"; // non-HttpOnly, sert seulement à l'affichage (Médiathèque)
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

function toAccessPage(url) {
  const dest = new URL("/lettres-acces", url);
  dest.searchParams.set("suite", url.pathname);
  for (const [k, v] of url.searchParams) if (k.startsWith("utm_")) dest.searchParams.set(k, v);
  return redirect(dest.toString());
}

export default async (request, context) => {
  const url = new URL(request.url);

  // 2. Arrivée depuis un email Brevo
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
    if (ok) return redirect(url.toString(), await accessCookies());
    return toAccessPage(url);
  }

  // 1. Cookie déjà présent
  if (await isValidCookie(context.cookies.get(COOKIE))) {
    const res = await context.next();
    const out = new Response(res.body, res);
    out.headers.set("Cache-Control", "private, no-store");
    out.headers.set("X-Robots-Tag", "noindex");
    return out;
  }

  // 3. Pas d'accès
  return toAccessPage(url);
};

export const config = { path: ["/lettres", "/lettres/*"] };
