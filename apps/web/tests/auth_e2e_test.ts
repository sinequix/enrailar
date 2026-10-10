import { assert, assertEquals } from "@std/assert";
import { chromium, type Browser, type Page } from "playwright-core";
import { securityHeaders } from "../src/security-headers.ts";

const port = 4188;
const base = `http://localhost:${port}`;
const password = "correct-horse-battery";
const authSecret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
const mailFile = "/tmp/enrailar-e2e-mail.json";
const host = ["example", "test"].join(".");
const userEmail = ["cuenta", host].join("@");
const adminEmail = ["mesa", host].join("@");

function chromePath(): string {
  const fromEnv = Deno.env.get("CHROME_PATH");
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  for (const path of ["/usr/local/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/google-chrome", "/usr/bin/chromium"]) {
    try {
      Deno.statSync(path);
      return path;
    } catch {
      // siguiente candidato
    }
  }
  throw new Error("falta Chrome");
}

async function codeFor(secret: string): Promise<string> {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = secret.toUpperCase().replace(/=+$/g, "");
  let bits = "";
  for (const char of clean) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes = (bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2));
  const raw = new Uint8Array(bytes);
  const counter = Math.floor(Date.now() / 30000);
  const msg = new ArrayBuffer(8);
  new DataView(msg).setBigUint64(0, BigInt(counter));
  const cryptoKey = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, msg));
  const offset = digest[digest.length - 1]! & 0xf;
  const binary = ((digest[offset]! & 0x7f) << 24) | (digest[offset + 1]! << 16) | (digest[offset + 2]! << 8) | digest[offset + 3]!;
  return String(binary % 1_000_000).padStart(6, "0");
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/es`);
      if (response.ok) return;
    } catch {
      // todavía no escucha
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("el servidor de prueba no arrancó");
}

async function mailToken(): Promise<string> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const job = JSON.parse(await Deno.readTextFile(mailFile)) as { path?: string };
      if (typeof job.path === "string" && job.path.includes("token=")) {
        return new URL(job.path, base).searchParams.get("token") ?? "";
      }
    } catch {
      // el correo todavía no se escribió
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("no llegó el correo de verificación");
}

async function clickAndWait(page: Page, selector: string, path: string) {
  try {
    const [response] = await Promise.all([
      page.waitForResponse((item) => item.url().includes(path)),
      page.click(selector),
    ]);
    return response;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${path}: ${detail}`);
  }
}

async function expectOk(response: { status: () => number; text: () => Promise<string> }): Promise<void> {
  const body = (await response.text()).replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g, "[correo]");
  assertEquals(response.status(), 200, body.slice(0, 300));
}

Deno.test({
  name: "registro, ingreso, TOTP, passkey y 403 de admin",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
    const https = securityHeaders(true);
    const cspOf = (headers: ReadonlyArray<readonly [string, string]>) => headers.find((header) => header[0] === "content-security-policy")?.[1] ?? "";
    assert(cspOf(https).includes("frame-ancestors 'none'"));
    assert(https.some((header) => header[0] === "strict-transport-security"));

    await Deno.remove(mailFile).catch(() => undefined);
    const child = new Deno.Command("pnpm", {
      args: ["exec", "vite", "dev", "--host", "localhost", "--port", String(port), "--strictPort"],
      cwd: new URL("..", import.meta.url).pathname,
      env: {
        ...Deno.env.toObject(),
        AUTH_MEMORY: "1",
        BETTER_AUTH_SECRET: authSecret,
        AUTH_PRODUCTION: "0",
        TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
        TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
        AUTH_MAIL_FILE: mailFile,
        ADMIN_EMAILS: adminEmail,
      },
      stdout: "null",
      stderr: "null",
    }).spawn();

    let browser: Browser | undefined;
    try {
      await waitForServer();
      const home = await fetch(`${base}/es`);
      const csp = home.headers.get("content-security-policy") ?? "";
      assert(csp.includes("frame-ancestors 'none'"));
      assertEquals(home.headers.get("strict-transport-security"), null);

      browser = await chromium.launch({
        executablePath: chromePath(),
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      });
      const page = await browser.newPage();
      await page.goto(`${base}/es/cuenta/crear`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("form[data-live='1']");
      await page.fill("#account-email", userEmail);
      await page.fill("#account-password", password);
      await page.fill("#account-password-again", password);
      await page.locator("input[type=checkbox]").setChecked(true);
      const signupResponse = await Promise.all([
        page.waitForResponse((item) => item.url().includes("/api/auth/sign-up/email")),
        page.evaluate("(() => { const token = 'XXXX.DUMMY.TOKEN.XXXX'; const nodes = document.querySelectorAll('[name=cf-turnstile-response]'); const node = nodes[0] ?? document.body.appendChild(document.createElement('input')); node.name = 'cf-turnstile-response'; node.value = token; document.querySelector('form')?.requestSubmit(); })()"),
      ]).then(([response]) => response);
      await expectOk(signupResponse);

      const token = await mailToken();
      await page.goto(`${base}/es/cuenta/verificar?token=${encodeURIComponent(token)}`, { waitUntil: "domcontentloaded" });
      const verifyResponse = await clickAndWait(page, "button[type=submit]", "/api/auth/verify-email");
      await expectOk(verifyResponse);

      await page.goto(`${base}/es/cuenta/ingresar`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("form[data-live='1']");
      await page.fill("#account-email", userEmail);
      await page.fill("#account-password", password);
      const signinResponse = await clickAndWait(page, "button[type=submit]", "/api/auth/sign-in/email");
      await expectOk(signinResponse);

      const denied = await page.goto(`${base}/es/app/admin`, { waitUntil: "domcontentloaded" });
      assertEquals(denied?.status(), 403);

      await page.goto(`${base}/es/app/seguridad`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#account-totp-password");
      await page.fill("#account-totp-password", password);
      const enableResponse = await clickAndWait(page, "button:has-text('Activar')", "/api/auth/two-factor/enable");
      await expectOk(enableResponse);
      const secret = await page.locator("code").first().innerText();
      await page.fill("#account-code", await codeFor(secret));
      const confirmResponse = await clickAndWait(page, "button:has-text('Confirmar')", "/api/auth/two-factor/verify-totp");
      await expectOk(confirmResponse);
      const stillDenied = await page.goto(`${base}/es/app/admin`, { waitUntil: "domcontentloaded" });
      assertEquals(stillDenied?.status(), 403);

      await page.goto(`${base}/es/app/seguridad`, { waitUntil: "domcontentloaded" });
      const client = await page.context().newCDPSession(page);
      await client.send("WebAuthn.enable");
      await client.send("WebAuthn.addVirtualAuthenticator", {
        options: {
          protocol: "ctap2",
          transport: "internal",
          hasResidentKey: true,
          hasUserVerification: true,
          isUserVerified: true,
          automaticPresenceSimulation: true,
        },
      });
      const passkeyResponse = await clickAndWait(page, "button:has-text('Agregar passkey')", "/api/auth/passkey/verify-registration");
      await expectOk(passkeyResponse);

      const adminJar = await adminSession();
      if (!browser) throw new Error("sin navegador");
      const adminContext = await browser.newContext();
      const adminPage = await adminContext.newPage();
      const pairs = adminJar.split(";").map((part) => part.trim()).filter((part) => part.includes("="));
      await adminContext.addCookies(pairs.map((part) => {
        const eq = part.indexOf("=");
        return { name: part.slice(0, eq), value: part.slice(eq + 1), domain: "localhost", path: "/" };
      }));
      const allowed = await adminPage.goto(`${base}/es/app/admin`, { waitUntil: "domcontentloaded" });
      assertEquals(allowed?.status(), 200);
      assert(await adminPage.getByRole("heading", { name: "Usuarios" }).isVisible());

      await page.goto(`${base}/es/app/seguridad`, { waitUntil: "domcontentloaded" });
      await clickAndWait(page, "button:has-text('Revocar')", "/api/auth/revoke-session");
      const after = await page.goto(`${base}/es/app`, { waitUntil: "domcontentloaded" });
      assertEquals(after?.status(), 200);
      assert(page.url().includes("/cuenta/ingresar"));
    } finally {
      await browser?.close();
      child.kill("SIGTERM");
      await child.status.catch(() => undefined);
      await Deno.remove(mailFile).catch(() => undefined);
    }
  },
});

async function adminSession(): Promise<string> {
  await Deno.remove(mailFile).catch(() => undefined);
  const signup = await fetch(`${base}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: base,
      "x-turnstile-token": "XXXX.DUMMY.TOKEN.XXXX",
    },
    body: JSON.stringify({
      email: adminEmail,
      password,
      name: "cuenta",
      consentAt: new Date().toISOString(),
      locale: "es",
    }),
  });
  assertEquals(signup.status, 200);
  const token = await mailToken();
  const verify = await fetch(`${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`, { headers: { origin: base } });
  assertEquals(verify.status, 200);
  const signin = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({ email: adminEmail, password }),
  });
  assertEquals(signin.status, 200);
  let jar = signin.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
  const enable = await fetch(`${base}/api/auth/two-factor/enable`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base, cookie: jar },
    body: JSON.stringify({ password }),
  });
  assertEquals(enable.status, 200);
  const payload = await enable.json() as { totpURI: string };
  const secret = new URL(payload.totpURI).searchParams.get("secret") ?? "";
  jar = merge(jar, enable.headers.getSetCookie());
  const confirmed = await fetch(`${base}/api/auth/two-factor/verify-totp`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base, cookie: jar },
    body: JSON.stringify({ code: await codeFor(secret) }),
  });
  assertEquals(confirmed.status, 200);
  return merge(jar, confirmed.headers.getSetCookie());
}

function merge(jar: string, cookies: string[]): string {
  const map = new Map<string, string>();
  for (const part of jar.split(";").map((item) => item.trim()).filter(Boolean)) {
    const eq = part.indexOf("=");
    if (eq > 0) map.set(part.slice(0, eq), part.slice(eq + 1));
  }
  for (const raw of cookies) {
    const pair = raw.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq > 0) map.set(pair.slice(0, eq), pair.slice(eq + 1));
  }
  return [...map.entries()].map(([key, value]) => `${key}=${value}`).join("; ");
}
