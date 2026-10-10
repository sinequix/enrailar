import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import type { MailJob } from "@enrailar/shared";
import { guardRequest } from "../src/app-guard.ts";
import { handleAuth } from "../src/auth-http.ts";
import { requestArea } from "../src/auth-policy.ts";
import { bindDb } from "../src/request-db.ts";
import { inlineScriptHashes, securityHeaders, sumateScriptHash } from "../src/security-headers.ts";
import { createMemoryDatabase } from "./memory-db.ts";

function headContentType(args: unknown[] | null): string {
  if (!args) return "";
  for (const arg of args) {
    if (!arg || typeof arg !== "object") continue;
    for (const [key, value] of Object.entries(arg)) {
      if (key.toLowerCase() === "content-type" && typeof value === "string") return value;
    }
  }
  return "";
}

function migrationSql(): string {
  const dir = new URL("../../api/migrations/", import.meta.url);
  const names = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  return names.map((name) => readFileSync(new URL(name, dir), "utf8")).join("\n");
}

async function toRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? "localhost";
  const url = `http://${host}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(", "));
  }
  if (req.method === "GET" || req.method === "HEAD") return new Request(url, { method: req.method, headers });
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return new Request(url, { method: req.method, headers, body: Buffer.concat(chunks) });
}

async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  const cookies = response.headers.getSetCookie();
  response.headers.forEach((value, key) => {
    if (key === "set-cookie") return;
    res.setHeader(key, value);
  });
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);
  res.end(Buffer.from(await response.arrayBuffer()));
}

/** Solo `vite dev` con AUTH_MEMORY=1. El Worker de prod no carga este módulo. */
export function authDevPlugin(): Plugin {
  return {
    name: "enrailar-auth-dev",
    apply: "serve",
    configureServer(server) {
      if (process.env.AUTH_MEMORY !== "1") return;
      const sqlite = new DatabaseSync(":memory:");
      sqlite.exec(migrationSql());
      const db = createMemoryDatabase(sqlite);
      bindDb(db);
      const env = {
        DB: db,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
        ADMIN_EMAILS: process.env.ADMIN_EMAILS ?? "",
        AUTH_PRODUCTION: "0",
        TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
        MAIL_QUEUE: {
          send(body: MailJob) {
            const path = process.env.AUTH_MAIL_FILE;
            if (path) writeFileSync(path, JSON.stringify(body));
            return Promise.resolve();
          },
        },
      };
      // Vinext manda writeHead antes del HTML. Se retrasa para hashear los scripts inline.
      server.middlewares.use((_req, res, next) => {
        const chunks: Buffer[] = [];
        const originalWrite = res.write;
        const originalEnd = res.end;
        const originalWriteHead = res.writeHead;
        let ended = false;
        let headArgs: unknown[] | null = null;
        const take = (chunk: unknown) => {
          if (Buffer.isBuffer(chunk)) chunks.push(chunk);
          else if (chunk instanceof Uint8Array) chunks.push(Buffer.from(chunk));
          else chunks.push(Buffer.from(String(chunk)));
        };
        res.writeHead = ((...args: unknown[]) => {
          headArgs = args;
          return res;
        }) as typeof res.writeHead;
        res.write = ((chunk: unknown) => {
          if (chunk) take(chunk);
          return true;
        }) as typeof res.write;
        res.end = ((chunk?: unknown, encoding?: unknown, callback?: unknown) => {
          if (ended) return res;
          ended = true;
          const finish = typeof chunk === "function" ? chunk : typeof encoding === "function" ? encoding : typeof callback === "function" ? callback : undefined;
          try {
            if (typeof chunk !== "function" && chunk) take(chunk);
            const body = Buffer.concat(chunks);
            const declared = [String(res.getHeader("content-type") ?? ""), headContentType(headArgs)].join(" ");
            const looksHtml = declared.includes("text/html") || body.subarray(0, 240).toString("utf8").toLowerCase().includes("<html");
            const hashes = looksHtml
              ? [...new Set([sumateScriptHash(), ...inlineScriptHashes(body.toString("utf8"))])]
              : [sumateScriptHash()];
            for (const [name, value] of securityHeaders(false, hashes)) res.setHeader(name, value);
            res.write = originalWrite;
            res.writeHead = originalWriteHead;
            if (headArgs) originalWriteHead.apply(res, headArgs as []);
            if (finish) return originalEnd.call(res, body, finish);
            return originalEnd.call(res, body);
          } catch (error) {
            console.error(error);
            res.write = originalWrite;
            res.writeHead = originalWriteHead;
            if (!res.headersSent) res.statusCode = 500;
            return originalEnd.call(res, "csp");
          }
        }) as typeof res.end;
        next();
      });
      server.middlewares.use(async (req, res, next) => {
        const path = (req.url ?? "/").split("?")[0] ?? "/";
        const auth = path.startsWith("/api/auth");
        const guarded = requestArea(path) !== "public";
        if (!auth && !guarded) {
          next();
          return;
        }
        try {
          const request = await toRequest(req);
          const response = auth ? await handleAuth(request, env, db) : await guardRequest(request, env);
          if (!response) {
            next();
            return;
          }
          await writeResponse(res, response);
        } catch (error) {
          console.log(JSON.stringify({ status: "auth-dev-failed" }));
          console.error(error);
          res.statusCode = 500;
          res.end();
        }
      });
    },
  };
}
