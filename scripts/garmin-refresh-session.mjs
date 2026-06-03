// ============================================================
// scripts/garmin-refresh-session.mjs
//
// Loguea en Garmin Connect DESDE TU PC (IP residencial, no bloqueada por
// Cloudflare) y postea la cookie de sesión a la app, que la guarda en la DB.
// Vercel después solo LEE datos con esa cookie (su IP de datacenter no puede
// loguearse: Garmin/Cloudflare devuelve 403).
//
// Requisitos: Node 18+ (usa fetch global). Cero dependencias.
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
//   GARMIN_TTL_HOURS (opcional)     → vida de la sesión en horas (default 20)
//
// Automatizable con el Programador de tareas de Windows (a diario), porque las
// cookies de Garmin expiran ~cada día.
// ============================================================

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

// --- Cargar .env.local (parser mínimo, sin dependencias) ---
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
      // Quitar comillas envolventes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // .env.local opcional — si no existe, se usan las vars del entorno
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
const TTL_HOURS = Number(process.env.GARMIN_TTL_HOURS) || 20;

function die(msg) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

if (!EMAIL || !PASSWORD) die("Faltan GARMIN_EMAIL / GARMIN_PASSWORD (en .env.local o el entorno).");
if (!CRON_SECRET) die("Falta CRON_SECRET (necesario para postear la sesión al endpoint).");
if (!APP_USER_EMAIL) die("Falta APP_USER_EMAIL (o ALLOWED_EMAILS) para identificar tu usuario.");

// --- Constantes del SSO (idénticas a lib/garmin.ts) ---
const SSO_URL = "https://sso.garmin.com/sso";
const SSO_EMBED_URL = `${SSO_URL}/embed`;
const SSO_ORIGIN = "https://sso.garmin.com";
const CONNECT_URL = "https://connect.garmin.com";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
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

// --- Utils (idénticos a lib/garmin.ts) ---
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

// --- Login SSO ---
async function login() {
  // Paso 0: GET /sso/embed → cookies de Cloudflare/Garmin
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

  // Paso 1: GET /sso/signin → HTML con _csrf
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

  // Paso 2: POST /sso/signin → ticket
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
  cookies = mergeCookieStrings(cookies, extractCookies(loginRes));

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
        "403 de Cloudflare incluso desde tu PC. Probá de nuevo en unos minutos, o desde otra red. " +
          "Si Garmin pide captcha/MFA, este flujo no lo soporta."
      );
    }
    console.error(loginHtml.slice(0, 800));
    die(`Login falló (status ${loginRes.status}). ¿Credenciales correctas? ¿MFA activado?`);
  }

  // Paso 3: canjear ticket por sesión de Connect
  const ticketRes = await fetch(`${CONNECT_URL}/modern/?ticket=${ticket}`, {
    headers: { "User-Agent": UA, Cookie: cookies },
    redirect: "manual",
  });
  const finalCookies = mergeCookieStrings(cookies, extractCookies(ticketRes));

  if (
    !finalCookies.includes("GARMIN-SSO") &&
    !finalCookies.includes("SESSIONID") &&
    !finalCookies.includes("connect.garmin")
  ) {
    die("Sesión no obtenida (sin cookies GARMIN-SSO/SESSIONID). El SSO puede haber cambiado.");
  }

  return finalCookies;
}

// --- Postear la sesión a la app ---
async function postSession(session) {
  const url = `${APP_URL}/api/fitness/garmin-session?secret=${encodeURIComponent(CRON_SECRET)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session, ttlHours: TTL_HOURS, email: APP_USER_EMAIL }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) die(`El endpoint respondió ${res.status}: ${json.error || JSON.stringify(json)}`);
  return json;
}

// --- Main ---
console.log("→ Logueando en Garmin Connect desde tu IP local…");
const session = await login();
console.log(`✓ Sesión obtenida (${session.length} chars de cookies).`);
console.log(`→ Inyectando en ${APP_URL} para ${APP_USER_EMAIL}…`);
const result = await postSession(session);
console.log(`✅ ${result.message} (válida ~${result.expiresInHours}h).`);
console.log("\nListo. Volvé a correr este script cuando la sync de Garmin falle por sesión expirada.");
