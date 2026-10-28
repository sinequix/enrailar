import { assert, assertEquals } from "@std/assert";
import { encodeJwtSegment } from "../src/lib/access.ts";

const NEWS_ROOT = new URL("..", import.meta.url);
const AUD = "aud-news-route";
const ARTICLE = "Esta nota no está";

type PublicJwk = JsonWebKey & { kid: string; alg: string; use: string };

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function signingKeys(): Promise<{ privateKey: CryptoKey; publicJwk: PublicJwk }> {
  const pair = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: Uint8Array.from([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey) as PublicJwk;
  publicJwk.kid = "route-test";
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  return { privateKey: pair.privateKey, publicJwk };
}

async function sign(privateKey: CryptoKey, issuer: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = encodeJwtSegment({ alg: "RS256", kid: "route-test", typ: "JWT" });
  const body = encodeJwtSegment({
    iss: issuer,
    aud: AUD,
    exp: now + 3600,
    iat: now,
    sub: "route-test",
  });
  const encoded = new TextEncoder().encode(`${header}.${body}`);
  const data = new Uint8Array(new ArrayBuffer(encoded.byteLength));
  data.set(encoded);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, data));
  return `${header}.${body}.${base64Url(signature)}`;
}

function encryptionKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `emdash_enc_v1_${base64Url(bytes)}`;
}

function freePort(): number {
  const listener = Deno.listen({ port: 0, hostname: "127.0.0.1" });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}

async function waitFor(url: string): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    try {
      const response = await fetch(url);
      await response.body?.cancel();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`el server no escuchó en ${url}`);
}

async function follow(url: string, token: string | null): Promise<{ status: number; body: string; path: string }> {
  let current = url;
  for (let hop = 0; hop < 6; hop += 1) {
    const headers = new Headers();
    if (token !== null) headers.set("cf-access-jwt-assertion", token);
    const response = await fetch(current, { headers, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (location === null) throw new Error(`redirect sin location desde ${current}`);
      current = new URL(location, current).toString();
      continue;
    }
    const body = await response.text();
    return { status: response.status, body, path: new URL(current).pathname };
  }
  throw new Error(`demasiados redirects desde ${url}`);
}

Deno.test({
  name: "con JWT /_emdash/admin es el admin y sin JWT es 403",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { privateKey, publicJwk } = await signingKeys();
    const jwksPort = freePort();
    const appPort = freePort();
    const issuer = `https://127.0.0.1:${jwksPort}`;
    const token = await sign(privateKey, issuer);
    const dir = await Deno.makeTempDir({ prefix: "news-admin-route-" });
    const keyPath = `${dir}/jwks.key`;
    const certPath = `${dir}/jwks.crt`;
    const openssl = new Deno.Command("openssl", {
      args: ["req", "-x509", "-newkey", "rsa:2048", "-keyout", keyPath, "-out", certPath, "-days", "1", "-nodes", "-subj", "/CN=127.0.0.1"],
      stdout: "null",
      stderr: "null",
    });
    const generated = await openssl.output();
    assertEquals(generated.code, 0);

    const jwks = Deno.serve({
      port: jwksPort,
      hostname: "127.0.0.1",
      cert: await Deno.readTextFile(certPath),
      key: await Deno.readTextFile(keyPath),
      handler(request) {
        const url = new URL(request.url);
        if (url.pathname === "/cdn-cgi/access/certs") return Response.json({ keys: [publicJwk] });
        return new Response("no", { status: 404 });
      },
    });

    const buildEnv = Deno.env.toObject();
    delete buildEnv.NEWS_RUNTIME;
    const build = new Deno.Command("pnpm", {
      args: ["exec", "astro", "build"],
      cwd: NEWS_ROOT,
      env: buildEnv,
      stdout: "inherit",
      stderr: "inherit",
    });
    const built = await build.output();
    assertEquals(built.code, 0, "astro build");

    const serverCwd = `${dir}/app`;
    await Deno.mkdir(`${serverCwd}/data`, { recursive: true });
    // Con `migrations.runtime: "check"` el server no migra solo: igual que
    // en prod y preview, se migra antes con la CLI y el fingerprint del target.
    const dbPath = `${serverCwd}/data/news.db`;
    const migrate = async (...extra: string[]) => {
      const run = await new Deno.Command("pnpm", {
        args: ["exec", "emdash", "migrate", "--from-config", "--database", dbPath, "--json", ...extra],
        cwd: NEWS_ROOT,
        env: buildEnv,
        stdout: "piped",
        stderr: "piped",
      }).output();
      const out = new TextDecoder().decode(run.stdout);
      const json = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
      return { code: run.code, report: JSON.parse(json || "{}"), stderr: new TextDecoder().decode(run.stderr) };
    };
    const pending = await migrate("--check");
    assertEquals(pending.code, 2, pending.stderr);
    assert(pending.report.pending.length > 0);
    const applied = await migrate("--expected-target-fingerprint", pending.report.target.fingerprint);
    assertEquals(applied.code, 0, applied.stderr);
    assertEquals((await migrate("--check")).code, 0);

    const serverEnv = {
      ...buildEnv,
      HOST: "127.0.0.1",
      PORT: String(appPort),
      NEWS_RUNTIME: "node",
      NEWS_ADMIN: "on",
      ACCESS_AUD: AUD,
      ACCESS_TEAM_DOMAIN: `127.0.0.1:${jwksPort}`,
      EMDASH_ENCRYPTION_KEY: encryptionKey(),
      NODE_TLS_REJECT_UNAUTHORIZED: "0",
    };
    const server = new Deno.Command("node", {
      args: [new URL("./dist/server/entry.mjs", NEWS_ROOT).pathname],
      cwd: serverCwd,
      env: serverEnv,
      stdout: "piped",
      stderr: "piped",
    }).spawn();
    const origin = `http://127.0.0.1:${appPort}`;
    try {
      await waitFor(`${origin}/`);
      const blocked = await follow(`${origin}/_emdash/admin`, null);
      assertEquals(blocked.status, 403);
      assert(!blocked.body.includes(ARTICLE));

      const bare = await follow(`${origin}/_emdash`, null);
      assertEquals(bare.status, 403);
      assert(!bare.body.includes(ARTICLE));

      const admin = await follow(`${origin}/_emdash/admin`, token);
      assertEquals(admin.status, 200);
      assert(admin.body.includes("EmDash Admin"), admin.body.slice(0, 240));
      assert(!admin.body.includes(ARTICLE));
      assert(admin.path.startsWith("/_emdash/admin"));

      const root = await follow(`${origin}/_emdash`, token);
      assertEquals(root.status, 200);
      assert(root.body.includes("EmDash Admin"), root.path);
      assert(!root.body.includes(ARTICLE));

      const note = await follow(`${origin}/ypf-arena-fractura-vaca-muerta`, null);
      assertEquals(note.status, 200);
      assert(!note.body.includes(ARTICLE));
      assert(note.body.includes("YPF empieza a enviar arena de fractura a Vaca Muerta por tren"));
    } finally {
      server.kill("SIGTERM");
      await server.status;
      await jwks.shutdown();
    }

    const query = new Deno.Command("node", {
      args: ["--input-type=module", "-e", `
        import { DatabaseSync } from "node:sqlite";
        const db = new DatabaseSync(${JSON.stringify(`${serverCwd}/data/news.db`)});
        const flag = db.prepare("select id from enrailar_news_seed").all();
        const notes = db.prepare("select slug, status from ec_noticia").all();
        console.log(JSON.stringify({ flag, notes }));
      `],
      stdout: "piped",
      stderr: "piped",
    });
    const queried = await query.output();
    const stderr = new TextDecoder().decode(queried.stderr);
    assertEquals(queried.code, 0, stderr);
    const parsed = JSON.parse(new TextDecoder().decode(queried.stdout)) as {
      flag: { id: string }[];
      notes: { slug: string; status: string }[];
    };
    assertEquals(parsed.flag.map((row) => row.id), ["noticia-v1"]);
    assert(parsed.notes.some((row) => row.slug === "ypf-arena-fractura-vaca-muerta" && row.status === "published"));
  },
});
