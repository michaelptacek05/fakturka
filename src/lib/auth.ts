/**
 * Jednoduché přihlášení jedním heslem pro self-hosted nasazení.
 *
 * Session je podepsaný token v HttpOnly cookie. Používá jen Web Crypto,
 * aby stejný kód fungoval v middleware (Edge runtime) i v server actions.
 */

const encoder = new TextEncoder();

export const SESSION_COOKIE = "fakturka_session";

const DEFAULT_SESSION_HOURS = 720;

export function getAuthPassword() {
  const value = process.env.AUTH_PASSWORD?.trim();

  return value && value.length > 0 ? value : null;
}

export function isAuthEnabled() {
  return getAuthPassword() !== null;
}

export function getSessionMaxAgeSeconds() {
  const hours = Number.parseInt(process.env.AUTH_SESSION_HOURS ?? "", 10);
  const safeHours =
    Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_SESSION_HOURS;

  return safeHours * 60 * 60;
}

/**
 * Klíč pro podpis kombinuje AUTH_SECRET a aktuální heslo, takže změna
 * kteréhokoli z nich zneplatní všechny existující relace.
 */
function getSigningSecret() {
  const secret = process.env.AUTH_SECRET?.trim() ?? "";

  return `${secret}:${getAuthPassword() ?? ""}`;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getSigningSecret()),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));

  return toBase64Url(new Uint8Array(signature));
}

/** Porovnání v konstantním čase, aby nešlo hádat podpis po znacích. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return diff === 0;
}

export async function verifyPassword(candidate: string) {
  const password = getAuthPassword();

  if (!password) {
    return false;
  }

  // Podepisujeme obě hodnoty, takže se porovnávají otisky stejné délky
  // a z doby porovnání nejde odvodit délku hesla.
  const [candidateDigest, passwordDigest] = await Promise.all([
    sign(`password:${candidate}`),
    sign(`password:${password}`),
  ]);

  return safeEqual(candidateDigest, passwordDigest);
}

export async function createSessionToken() {
  const expiresAt = Date.now() + getSessionMaxAgeSeconds() * 1000;
  const payload = String(expiresAt);

  return `${payload}.${await sign(payload)}`;
}

export async function verifySessionToken(token: string | undefined | null) {
  if (!token) {
    return false;
  }

  const separatorIndex = token.indexOf(".");

  if (separatorIndex <= 0) {
    return false;
  }

  const payload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expiresAt = Number.parseInt(payload, 10);

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  return safeEqual(await sign(payload), signature);
}

/**
 * Ochrana proti otevřenému přesměrování: povolíme jen cestu v rámci aplikace.
 */
export function sanitizeRedirectPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}
