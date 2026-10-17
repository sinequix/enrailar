const CERTS_PATH = "/cdn-cgi/access/certs";
const KEY_TTL_MS = 60 * 60 * 1000;

export interface AccessRequest {
  pathname: string;
  token: string | null;
  runtime: string;
  admin: string;
  aud: string;
  teamDomain: string;
  now: number;
}

export type AccessVerdict =
  | { kind: "pass" }
  | {
    kind: "deny";
    reason: "admin-off" | "config" | "missing-token" | "bad-token" | "bad-signature" | "wrong-aud" | "expired" | "wrong-iss";
  };

interface JsonWebKeySet {
  keys?: JsonWebKey[];
}

interface CachedKeys {
  fetchedAt: number;
  byKid: Map<string, CryptoKey>;
}

const keyCache = new Map<string, CachedKeys>();

export function resetAccessKeyCache(): void {
  keyCache.clear();
}

export function isEmDashPath(pathname: string): boolean {
  return pathname === "/_emdash" || pathname.startsWith("/_emdash/");
}

export function accessUrls(teamDomain: string): { issuer: string; certsUrl: string } | undefined {
  const raw = teamDomain.trim();
  if (raw.length === 0) return undefined;
  const withScheme = raw.startsWith("https://") || raw.startsWith("http://") ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;
  const issuer = url.origin;
  const certsUrl = url.pathname.endsWith(CERTS_PATH) ? url.toString() : new URL(CERTS_PATH, issuer).toString();
  return { issuer, certsUrl };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> | undefined {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return undefined;
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeJson(segment: string): unknown {
  const bytes = base64UrlToBytes(segment);
  if (bytes === undefined) return undefined;
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function audienceMatches(claim: unknown, expected: string): boolean {
  if (typeof claim === "string") return claim === expected;
  if (!Array.isArray(claim)) return false;
  return claim.some((item) => item === expected);
}

async function keysFor(certsUrl: string, fetchCerts: (url: string) => Promise<unknown>, force: boolean): Promise<Map<string, CryptoKey>> {
  const cached = keyCache.get(certsUrl);
  if (!force && cached !== undefined && Date.now() - cached.fetchedAt < KEY_TTL_MS) return cached.byKid;
  const body = await fetchCerts(certsUrl);
  if (!isRecord(body) || !Array.isArray(body.keys)) throw new Error("jwks");
  const byKid = new Map<string, CryptoKey>();
  for (const jwk of body.keys) {
    if (!isRecord(jwk) || jwk.kty !== "RSA" || typeof jwk.kid !== "string") continue;
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk as JsonWebKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    byKid.set(jwk.kid, key);
  }
  keyCache.set(certsUrl, { fetchedAt: Date.now(), byKid });
  return byKid;
}

async function signatureOk(
  token: string,
  certsUrl: string,
  fetchCerts: (url: string) => Promise<unknown>,
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (encodedHeader === undefined || encodedPayload === undefined || encodedSignature === undefined) return false;
  const header = decodeJson(encodedHeader);
  if (!isRecord(header) || header.alg !== "RS256" || typeof header.kid !== "string") return false;
  const signature = base64UrlToBytes(encodedSignature);
  if (signature === undefined) return false;
  const encoded = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
  const data = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  data.set(encoded);
  let keys = await keysFor(certsUrl, fetchCerts, false);
  let key = keys.get(header.kid);
  if (key === undefined) {
    keys = await keysFor(certsUrl, fetchCerts, true);
    key = keys.get(header.kid);
  }
  if (key === undefined) return false;
  return crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature, data);
}

function payloadOf(token: string): Record<string, unknown> | undefined {
  const encoded = token.split(".")[1];
  if (encoded === undefined) return undefined;
  const payload = decodeJson(encoded);
  return isRecord(payload) ? payload : undefined;
}

/**
 * `/_emdash` solo sigue si el JWT de Access verifica. El resto del sitio pasa.
 * Fuera de Cloudflare (astro dev) el admin local no pide el header.
 */
export async function decideAccess(
  request: AccessRequest,
  fetchCerts: (url: string) => Promise<unknown>,
): Promise<AccessVerdict> {
  if (!isEmDashPath(request.pathname)) return { kind: "pass" };
  if (request.runtime !== "cloudflare") return { kind: "pass" };
  if (request.admin !== "on") return { kind: "deny", reason: "admin-off" };
  const urls = accessUrls(request.teamDomain);
  if (urls === undefined || request.aud.trim().length === 0) return { kind: "deny", reason: "config" };
  if (request.token === null || request.token.trim().length === 0) return { kind: "deny", reason: "missing-token" };
  let signed = false;
  try {
    signed = await signatureOk(request.token, urls.certsUrl, fetchCerts);
  } catch {
    return { kind: "deny", reason: "bad-signature" };
  }
  if (!signed) return { kind: "deny", reason: "bad-signature" };
  const payload = payloadOf(request.token);
  if (payload === undefined) return { kind: "deny", reason: "bad-token" };
  if (payload.iss !== urls.issuer) return { kind: "deny", reason: "wrong-iss" };
  if (!audienceMatches(payload.aud, request.aud)) return { kind: "deny", reason: "wrong-aud" };
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp * 1000 <= request.now) {
    return { kind: "deny", reason: "expired" };
  }
  return { kind: "pass" };
}

export function continueOrForbid(
  verdict: AccessVerdict,
  next: () => Promise<Response>,
): Promise<Response> {
  switch (verdict.kind) {
    case "pass":
      return next();
    case "deny":
      return Promise.resolve(new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store" } }));
    default: {
      const unexpected: never = verdict;
      throw new Error(unexpected);
    }
  }
}

export function encodeJwtSegment(value: unknown): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

export type { JsonWebKeySet };
