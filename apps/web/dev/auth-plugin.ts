import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import type { MailJob } from "@enrailar/shared";
import { guardRequest } from "../src/app-guard.ts";
import { handleAuth } from "../src/auth-http.ts";
import { requestArea } from "../src/auth-policy.ts";
import { bindDb } from "../src/request-db.ts";
import { securityHeaders } from "../src/security-headers.ts";
import { createMemoryDatabase } from "./memory-db.ts";

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
      server.middlewares.use((_req, res, next) => {
        for (const [name, value] of securityHeaders(false)) res.setHeader(name, value);
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
