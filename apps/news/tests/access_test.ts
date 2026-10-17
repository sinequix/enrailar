import { assertEquals } from "@std/assert";
import { continueOrForbid, decideAccess, encodeJwtSegment, resetAccessKeyCache, type AccessRequest } from "../src/lib/access.ts";

const ISSUER = "https://enrailar.cloudflareaccess.com";
const AUD = "aud-news";
const CERTS = `${ISSUER}/cdn-cgi/access/certs`;
const NOW = Date.parse("2026-10-17T18:00:00.000Z");

type PublicJwk = JsonWebKey & { kid: string; alg: string; use: string };

interface Keys {
  privateKey: CryptoKey;
  publicJwk: PublicJwk;
}

async function keys(kid: string): Promise<Keys> {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: Uint8Array.from([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey) as PublicJwk;
  publicJwk.kid = kid;
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  return { privateKey: pair.privateKey, publicJwk };
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(privateKey: CryptoKey, kid: string, payload: Record<string, unknown>): Promise<string> {
  const header = encodeJwtSegment({ alg: "RS256", kid, typ: "JWT" });
  const body = encodeJwtSegment(payload);
  const encoded = new TextEncoder().encode(`${header}.${body}`);
  const data = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  data.set(encoded);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, data));
  return `${header}.${body}.${base64Url(signature)}`;
}

function request(token: string | null, patch: Partial<AccessRequest> = {}): AccessRequest {
  return {
    pathname: "/_emdash/admin",
    token,
    runtime: "cloudflare",
    admin: "on",
    aud: AUD,
    teamDomain: ISSUER,
    now: NOW,
    dev: false,
    ...patch,
  };
}

async function signHs256(secret: Uint8Array, kid: string, payload: Record<string, unknown>): Promise<string> {
  const header = encodeJwtSegment({ alg: "HS256", kid, typ: "JWT" });
  const body = encodeJwtSegment(payload);
  const raw = new Uint8Array(new ArrayBuffer(secret.byteLength));
  raw.set(secret);
  const key = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const encoded = new TextEncoder().encode(`${header}.${body}`);
  const data = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  data.set(encoded);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
  return `${header}.${body}.${base64Url(signature)}`;
}

async function status(token: string | null, jwk: JsonWebKey, patch: Partial<AccessRequest> = {}): Promise<number> {
  resetAccessKeyCache();
  const verdict = await decideAccess(request(token, patch), (url) => {
    assertEquals(url, CERTS);
    return Promise.resolve({ keys: [jwk] });
  });
  const response = await continueOrForbid(verdict, () => Promise.resolve(new Response("ok", { status: 200 })));
  return response.status;
}

Deno.test("sin header, firma mala, aud distinto o vencido responden 403; el válido pasa", async () => {
  const good = await keys("k1");
  const other = await keys("k1");
  const claims = { iss: ISSUER, aud: AUD, exp: Math.floor(NOW / 1000) + 3600 };

  assertEquals(await status(null, good.publicJwk), 403);
  assertEquals(await status(await sign(other.privateKey, "k1", claims), good.publicJwk), 403);
  assertEquals(await status(await sign(good.privateKey, "k1", { ...claims, aud: "otra-app" }), good.publicJwk), 403);
  assertEquals(await status(await sign(good.privateKey, "k1", { ...claims, exp: Math.floor(NOW / 1000) - 60 }), good.publicJwk), 403);
  assertEquals(await status(await sign(good.privateKey, "k1", claims), good.publicJwk), 200);
});

Deno.test("en preview el admin está apagado aunque el JWT sea válido", async () => {
  const good = await keys("preview");
  const token = await sign(good.privateKey, "preview", {
    iss: ISSUER,
    aud: AUD,
    exp: Math.floor(NOW / 1000) + 3600,
  });
  assertEquals(await status(token, good.publicJwk, { admin: "off" }), 403);
});

Deno.test("alg none, HS256 y un iss ajeno responden 403", async () => {
  const good = await keys("k1");
  const claims = { iss: ISSUER, aud: AUD, exp: Math.floor(NOW / 1000) + 3600 };
  const none = `${encodeJwtSegment({ alg: "none", typ: "JWT" })}.${encodeJwtSegment(claims)}.`;
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    good.publicJwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    true,
    ["verify"],
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", publicKey));
  const confused = await signHs256(spki, "k1", claims);
  const hmac = await signHs256(new TextEncoder().encode("secreto"), "k1", claims);
  const wrongIssuer = await sign(good.privateKey, "k1", { ...claims, iss: "https://otro.example" });

  assertEquals(await status(none, good.publicJwk), 403);
  assertEquals(await status(confused, good.publicJwk), 403);
  assertEquals(await status(hmac, good.publicJwk), 403);
  assertEquals(await status(wrongIssuer, good.publicJwk), 403);
});

Deno.test("sin NEWS_RUNTIME=node en dev el admin queda cerrado", async () => {
  resetAccessKeyCache();
  const refuse = () => {
    throw new Error("no debía pedir las claves");
  };
  const closed = await decideAccess(request(null, { runtime: "", dev: false }), refuse);
  assertEquals(closed.kind, "deny");
  const other = await decideAccess(request(null, { runtime: "otro", dev: false }), refuse);
  assertEquals(other.kind, "deny");
  const nodeBuild = await decideAccess(request(null, { runtime: "node", dev: false }), refuse);
  assertEquals(nodeBuild.kind, "deny");
  const local = await decideAccess(request(null, { runtime: "node", dev: true }), refuse);
  assertEquals(local.kind, "pass");
  const home = await decideAccess(request(null, { pathname: "/", runtime: "" }), refuse);
  assertEquals(home.kind, "pass");
});

Deno.test("un kid desconocido refresca las claves como mucho una vez por minuto", async () => {
  const good = await keys("k1");
  const claims = { iss: ISSUER, aud: AUD, exp: Math.floor(NOW / 1000) + 7200 };
  const known = await sign(good.privateKey, "k1", claims);
  const unknown = await sign(good.privateKey, "k2", claims);
  resetAccessKeyCache();
  let fetched = 0;
  const fetchCerts = () => {
    fetched += 1;
    return Promise.resolve({ keys: [good.publicJwk] });
  };
  const run = (token: string, now: number) => decideAccess(request(token, { now }), fetchCerts);

  assertEquals((await run(known, NOW)).kind, "pass");
  assertEquals(fetched, 1);
  assertEquals((await run(unknown, NOW + 1_000)).kind, "deny");
  assertEquals(fetched, 1);
  assertEquals((await run(unknown, NOW + 30_000)).kind, "deny");
  assertEquals(fetched, 1);
  assertEquals((await run(unknown, NOW + 60_000)).kind, "deny");
  assertEquals(fetched, 2);
  assertEquals((await run(unknown, NOW + 61_000)).kind, "deny");
  assertEquals(fetched, 2);
  assertEquals((await run(known, NOW + 90_000)).kind, "pass");
  assertEquals(fetched, 2);
});
