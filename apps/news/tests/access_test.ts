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
    ...patch,
  };
}

async function status(token: string | null, jwk: JsonWebKey, patch: Partial<AccessRequest> = {}): Promise<number> {
  resetAccessKeyCache();
  let fetched = 0;
  const verdict = await decideAccess(request(token, patch), (url) => {
    fetched += 1;
    assertEquals(url, CERTS);
    return Promise.resolve({ keys: [jwk] });
  });
  assertEquals(fetched > 0 || token === null || patch.admin === "off" || patch.runtime !== undefined && patch.runtime !== "cloudflare", true);
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

Deno.test("la portada no pide Access y el dev local deja el admin", async () => {
  resetAccessKeyCache();
  const publicVerdict = await decideAccess(request(null, { pathname: "/" }), () => {
    throw new Error("no debía pedir las claves");
  });
  assertEquals(publicVerdict.kind, "pass");
  const local = await decideAccess(request(null, { runtime: "" }), () => {
    throw new Error("no debía pedir las claves");
  });
  assertEquals(local.kind, "pass");
});
