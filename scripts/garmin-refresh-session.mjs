// ============================================================
// scripts/garmin-refresh-session.mjs
//
// Vincula Garmin Connect con la app usando OAuth (estilo garth).
// Loguea DESDE TU PC (IP residencial, no bloqueada por Cloudflare), intercambia
// el ticket por tokens OAuth y los manda a la app. La app guarda el OAuth1 token
// (dura ~1 año) y mintea access tokens OAuth2 sola desde Vercel.
//
// → Sólo hace falta correr esto UNA VEZ (y recién de nuevo dentro de ~1 año,
//   o si revocás el acceso / cambiás la contraseña de Garmin).
//
// Requisitos: Node 18+ (fetch global). Cero dependencias.
//
// Uso (lee credenciales de .env.local automáticamente):
//   node scripts/garmin-refresh-session.mjs
//
// Variables (de .env.local o del entorno):
//   GARMIN_EMAIL, GARMIN_PASSWORD   → credenciales de Garmin Connect
//   CRON_SECRET                     → para autenticar contra el endpoint
//   APP_URL          (opcional)     → default https://app-personal-ten.vercel.app
//   APP_USER_EMAIL   (opcional)     → email de tu usuario en la app
//                                     (default: primero de ALLOWED_EMAILS)
//   GARMIN_OAUTH_CONSUMER_KEY / _SECRET (opcional) → override del consumer público
// ============================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// --- Cargar .env.local (parser mínimo) ---
function loadEnvLocal() {
  try {
    const raw = readFileSync(join(PROJECT_ROOT, ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* .env.local opcional */
  }
}
loadEnvLocal();

const EMAIL = process.env.GARMIN_EMAIL;
const PASSWORD = process.env.GARMIN_PASSWORD;
const CRON_SECRET = process.env.CRON_SECRET;
const APP_URL = (process.env.APP_URL || "https://app-personal-ten.vercel.app").replace(/\/$/, "");
const APP_USER_EMAIL =
  process.env.APP_USER_EMAIL ||
  (process.env.ALLOWED_EMAILS || "").split(",")[0].trim();

const CONSUMER_KEY = process.env.GARMIN_OAUTH_CONSUMER_KEY || "fc3e99d2-118c-44b8-8ae3-03370dde24c0";
const CONSUMER_SECRET = process.env.GARMIN_OAUTH_CONSUMER_SECRET || "E08WAR897WEy2knn7aFBrvegVAf0AFdWBBF";

function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!EMAIL || !PASSWORD) die("Faltan GARMIN_EMAIL / GARMIN_PASSWORD (en .env.local o el entorno).");
if (!CRON_SECRET) die("Falta CRON_SECRET (necesario para postear los tokens al endpoint).");
if (!APP_USER_EMAIL) die("Falta APP_USER_EMAIL (o ALLOWED_EMAILS) para identificar tu usuario.");

// --- Constantes ---
const SSO_URL = "https://sso.garmin.com/sso";
const SSO_EMBED_URL = `${SSO_URL}/embed`;
const SSO_ORIGIN = "https://sso.garmin.com";
const CONNECT_URL = "https://connect.garmin.com";
const CONNECTAPI_URL = "https://connectapi.garmin.com";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const GARMIN_UA = "com.garmin.android.apps.connectmobile";
const BROWSER_HEADERS = {
  "User-Agent": UA,
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7",
  "Upgrade-Insecure-Requests": "1",
};

const SSO_EMBED_PARAMS = new URLSearchParams({
  id: "gauth-widget",
  embedWidget: "true",
  gauthHost: SSO_URL,
});
const SSO_SIGNIN_PARAMS = new URLSearchParams({
  id: "gauth-widget",
  embedWidget: "true",
  gauthHost: SSO_EMBED_URL,
  service: SSO_EMBED_URL,
  source: SSO_EMBED_URL,
  redirectAfterAccountLoginUrl: SSO_EMBED_URL,
  redirectAfterAccountCreationUrl: SSO_EMBED_URL,
});

// --- Utils de cookies / CSRF ---
function extractCsrfToken(html) {
  let m = html.match(/name=["']_csrf["'][^>]*?\bvalue=["']([^"']+)["']/i);
  if (m) return m[1];
  m = html.match(/\bvalue=["']([^"']+)["'][^>]*?name=["']_csrf["']/i);
  if (m) return m[1];
  m = html.match(/["']?csrf(?:[_-]?token)?["']?\s*[:=]\s*["']([^"']+)["']/i);
  if (m) return m[1];
  return null;
}

function extractCookies(res) {
  let rawValues = [];
  if (typeof res.headers.getSetCookie === "function") {
    rawValues = res.headers.getSetCookie();
  } else {
    const combined = res.headers.get("set-cookie") ?? "";
    rawValues = combined ? combined.split(/,(?=[^ ][^;]*=)/) : [];
  }
  return rawValues
    .map((c) => c.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

function mergeCookieStrings(...parts) {
  const map = new Map();
  for (const part of parts) {
    if (!part) continue;
    for (const cookie of part.split("; ")) {
      const [key] = cookie.split("=");
      if (key) map.set(key.trim(), cookie.trim());
    }
  }
  return Array.from(map.values()).join("; ");
}

// --- OAuth 1.0a (HMAC-SHA1) ---
function rfc3986(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function buildOAuth1Header(method, url, token, tokenSecret) {
  const oauth = {
    oauth_consumer_key: CONSUMER_KEY,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_version: "1.0",
  };
  if (token) oauth.oauth_token = token;

  const u = new URL(url);
  const all = {};
  u.searchParams.forEach((v, k) => {
    all[k] = v;
  });
  Object.assign(all, oauth);

  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(all[k])}`)
    .join("&");
  const baseString = `${method.toUpperCase()}&${rfc3986(u.origin + u.pathname)}&${rfc3986(paramString)}`;
  const signingKey = `${rfc3986(CONSUMER_SECRET)}&${rfc3986(tokenSecret || "")}`;
  oauth.oauth_signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  return (
    "OAuth " +
    Object.keys(oauth)
      .map((k) => `${rfc3986(k)}="${rfc3986(oauth[k])}"`)
      .join(", ")
  );
}

// --- Paso 1: login SSO → ticket ---
async function ssoLoginGetTicket() {
  const embedUrl = `${SSO_EMBED_URL}?${SSO_EMBED_PARAMS}`;
  const embedRes = await fetch(embedUrl, {
    headers: {
      ...BROWSER_HEADERS,
      Referer: `${CONNECT_URL}/`,
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
    },
  });
  let cookies = extractCookies(embedRes);

  const signinUrl = `${SSO_URL}/signin?${SSO_SIGNIN_PARAMS}`;
  const signinGetRes = await fetch(signinUrl, {
    headers: {
      ...BROWSER_HEADERS,
      Cookie: cookies,
      Referer: embedUrl,
      "sec-fetch-dest": "iframe",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
    },
  });
  if (!signinGetRes.ok) die(`GET /sso/signin falló: ${signinGetRes.status}`);
  const signinHtml = await signinGetRes.text();
  const csrf = extractCsrfToken(signinHtml);
  if (!csrf) die(`No se pudo extraer el _csrf (HTML: ${signinHtml.length} chars)`);
  cookies = mergeCookieStrings(cookies, extractCookies(signinGetRes));

  const loginBody = new URLSearchParams({
    username: EMAIL,
    password: PASSWORD,
    embed: "true",
    _csrf: csrf,
  });
  const loginRes = await fetch(signinUrl, {
    method: "POST",
    headers: {
      ...BROWSER_HEADERS,
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies,
      Origin: SSO_ORIGIN,
      Referer: signinUrl,
      "sec-fetch-dest": "iframe",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "sec-fetch-user": "?1",
    },
    body: loginBody.toString(),
    redirect: "manual",
  });

  let ticket = "";
  const location = loginRes.headers.get("location") ?? "";
  const fromLoc = location.match(/ticket=([^&"']+)/);
  let loginHtml = "";
  if (fromLoc) {
    ticket = fromLoc[1];
  } else {
    loginHtml = await loginRes.text();
    const fromHtml =
      loginHtml.match(/embed\?ticket=([^"'&]+)/) || loginHtml.match(/ticket=([A-Za-z0-9-]+)/);
    if (fromHtml) ticket = fromHtml[1];
  }

  if (!ticket) {
    if (loginRes.status === 403) {
      die(
        "403 de Cloudflare incluso desde tu PC. Probá de nuevo en unos minutos o desde otra red. " +
          "Si Garmin pide captcha/MFA, este flujo no lo soporta."
      );
    }
    console.error(loginHtml.slice(0, 800));
    die(`Login falló (status ${loginRes.status}). ¿Credenciales correctas? ¿MFA activado?`);
  }
  return ticket;
}

// --- Paso 2: ticket → OAuth1 token ---
async function getOAuth1Token(ticket) {
  const url =
    `${CONNECTAPI_URL}/oauth-service/oauth/preauthorized` +
    `?ticket=${encodeURIComponent(ticket)}` +
    `&login-url=${encodeURIComponent(SSO_EMBED_URL)}` +
    `&accepts-mfa-tokens=true`;
  const res = await fetch(url, {
    headers: {
      Authorization: buildOAuth1Header("GET", url),
      "User-Agent": GARMIN_UA,
    },
  });
  const text = await res.text();
  if (!res.ok) die(`preauthorized falló (${res.status}): ${text.slice(0, 300)}`);
  const params = new URLSearchParams(text);
  const token = params.get("oauth_token");
  const secret = params.get("oauth_token_secret");
  if (!token || !secret) die(`preauthorized no devolvió oauth_token: ${text.slice(0, 200)}`);
  return { token, secret };
}

// --- Paso 3: OAuth1 → OAuth2 access token ---
async function getOAuth2Token(oauth1Token, oauth1Secret) {
  const url = `${CONNECTAPI_URL}/oauth-service/oauth/exchange/user/2.0`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: buildOAuth1Header("POST", url, oauth1Token, oauth1Secret),
      "User-Agent": GARMIN_UA,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "",
  });
  const text = await res.text();
  if (!res.ok) die(`exchange OAuth2 falló (${res.status}): ${text.slice(0, 300)}`);
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    die(`exchange OAuth2 no devolvió JSON: ${text.slice(0, 200)}`);
  }
  if (!json.access_token) die(`exchange OAuth2 sin access_token: ${text.slice(0, 200)}`);
  return { accessToken: json.access_token, expiresInSec: json.expires_in ?? 3600 };
}

// --- Paso 4: postear tokens a la app ---
async function postTokens(oauth1, oauth2) {
  const url = `${APP_URL}/api/fitness/garmin-session?secret=${encodeURIComponent(CRON_SECRET)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      oauth1Token: oauth1.token,
      oauth1Secret: oauth1.secret,
      oauth2Token: oauth2.accessToken,
      oauth2ExpiresInSec: oauth2.expiresInSec,
      email: APP_USER_EMAIL,
    }),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    die(`El endpoint no devolvió JSON (status ${res.status}). ¿Está deployado? ${text.slice(0, 300)}`);
  }
  if (!res.ok) die(`El endpoint respondió ${res.status}: ${json.error || JSON.stringify(json)}`);
  if (json.success !== true) die(`Respuesta inesperada: ${JSON.stringify(json)}`);
  return json;
}

// --- Main ---
console.log("→ Logueando en Garmin desde tu IP local…");
const ticket = await ssoLoginGetTicket();
console.log("✓ Login OK (ticket obtenido).");
console.log("→ Intercambiando ticket por tokens OAuth…");
const oauth1 = await getOAuth1Token(ticket);
const oauth2 = await getOAuth2Token(oauth1.token, oauth1.secret);
console.log("✓ Tokens OAuth obtenidos (OAuth1 dura ~1 año).");
console.log(`→ Guardando en ${APP_URL} para ${APP_USER_EMAIL}…`);
const result = await postTokens(oauth1, oauth2);
console.log(`✅ ${result.message}`);
console.log("\nListo. Garmin queda vinculado. La app renueva el acceso sola desde Vercel.");
