import express, { type Express } from "express";
import { originAllowed, type ApiDeps } from "./deps.ts";
import { errorHandler, mountRoutes } from "./http.ts";

export function createApp(deps: ApiDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    const origin = req.header("origin");
    if (originAllowed(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin ?? "");
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  mountRoutes(app, deps);
  app.use(errorHandler(deps));
  return app;
}
