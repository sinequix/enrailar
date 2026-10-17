import { Stage, Stack } from "alchemy";
import { adopt } from "alchemy/AdoptPolicy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { ROLE_MAILBOXES, TRANSACTIONAL_FROM } from "@enrailar/shared";
import { accessPolicies } from "./src/access.ts";
import { optionalSecret } from "./src/clickup-env.ts";
import { APEX_SPF, DMARC, ROUTING_MX } from "./src/email-dns.ts";
import { DOMAIN, isProductionStage, stubPath } from "./src/stage.ts";

const compatibility = {
  date: "2026-10-09",
  flags: ["nodejs_compat" as const],
};

const accessSession = "24h";

export default Stack(
  "Enrailar",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const stage = yield* Stage;
    const production = isProductionStage(stage);
    const extraEmails = yield* Config.String("ACCESS_ALLOWED_EMAILS").pipe(Config.withDefault(""));
    const serviceTokenIds = yield* Config.String("ACCESS_SERVICE_TOKEN_IDS").pipe(Config.withDefault(""));
    const policies = accessPolicies(extraEmails, serviceTokenIds);
    // En prod la app es compartida por inbox y admin. El `aud` entra como
    // `POLICY_AUD` desde el entorno. Un preview no tiene hostname propio:
    // la app dedicada del Worker nace con el destino `worker`.
    const accessApp = production
      ? yield* Cloudflare.Access.Application("Access", {
          type: "self_hosted",
          domain: `inbox.${DOMAIN}`,
          // Los Workers suman destinos `worker`. Con la lista no vacía,
          // Cloudflare exige que `domain` esté incluido.
          destinations: [{ type: "public", uri: `inbox.${DOMAIN}` }],
          sessionDuration: accessSession,
          policies,
        })
      : undefined;
    const access = accessApp ?? {
      policies,
      sessionDuration: accessSession,
    };

    const zone = production
      ? yield* Cloudflare.Zone.Zone("Zone", { name: DOMAIN }).pipe(adopt(true))
      : undefined;

    const database = yield* Cloudflare.D1.Database("Database", {
      migrations: new URL("../apps/api/migrations", import.meta.url).pathname,
    });
    const bucket = yield* Cloudflare.R2.Bucket("Objects");
    const mail = yield* Cloudflare.Queues.Queue("Mail");
    const mailDeadLetter = yield* Cloudflare.Queues.Queue("MailDeadLetter");
    const audit = yield* Cloudflare.Queues.Queue("Audit");
    // La API no exporta `queue`. La cola muerta queda creada, sin consumidor.
    yield* Cloudflare.Queues.Queue("AuditDeadLetter");
    const turnstile = yield* Cloudflare.Turnstile.Widget("Turnstile", {
      domains: [DOMAIN, "localhost"],
      mode: "managed",
    });
    const outbound = yield* Cloudflare.Email.SendEmail("Outbound", {
      allowedSenderAddresses: [...ROLE_MAILBOXES, TRANSACTIONAL_FROM],
    });

    const domain = (name: string, aliases?: string[]) =>
      zone === undefined ? {} : { domain: { name, aliases, zoneId: zone.zoneId } };
    // `false` apaga la URL estable de workers.dev y los preview URLs.
    // Un preview no tiene dominio propio, así que solo se cierra en prod.
    const closedDev = production ? { workersDev: false as const } : {};
    // Sumate corre en el Worker de la API. email-in usa otra lista.
    // Las dos entran como variables de texto (vars de Actions), no como secretos.
    const clickupToken = yield* optionalSecret("CLICKUP_API_TOKEN");
    const clickupListIdWeb = (yield* Config.String("CLICKUP_LIST_ID_WEB").pipe(Config.withDefault(""))).trim();
    const clickupListIdContacts = (yield* Config.String("CLICKUP_LIST_ID_CONTACTS").pipe(Config.withDefault(""))).trim();

    const api = yield* Cloudflare.Worker("Api", {
      main: new URL("../apps/api/src/worker.ts", import.meta.url).pathname,
      compatibility,
      ...domain(`api.${DOMAIN}`),
      env: {
        DB: database,
        MAIL_QUEUE: mail,
        AUDIT_QUEUE: audit,
        TURNSTILE_SITE_KEY: turnstile.sitekey,
        TURNSTILE_SECRET_KEY: turnstile.secret,
        ...(Redacted.value(clickupToken).length > 0 ? { CLICKUP_API_TOKEN: clickupToken } : {}),
        ...(clickupListIdWeb.length > 0 ? { CLICKUP_LIST_ID_WEB: clickupListIdWeb } : {}),
      },
    });

    const inboxSend = yield* Cloudflare.Email.SendEmail("InboxSend", {
      allowedSenderAddresses: [...ROLE_MAILBOXES],
    });

    const inbox = yield* Cloudflare.Website.Vite("Inbox", {
      rootDir: decodeURIComponent(new URL("../apps/inbox/", import.meta.url).pathname),
      main: "workers/app.ts",
      compatibility,
      access,
      ...closedDev,
      ...domain(`inbox.${DOMAIN}`),
      env: {
        BUCKET: bucket,
        AI: Cloudflare.Workers.AI(),
        EMAIL: inboxSend,
        DOMAINS: DOMAIN,
        EMAIL_ADDRESSES: [...ROLE_MAILBOXES],
        POLICY_AUD: Config.Redacted("POLICY_AUD"),
        TEAM_DOMAIN: Config.Redacted("TEAM_DOMAIN"),
        MAILBOX: Cloudflare.DurableObject("Mailbox", { className: "MailboxDO" }),
        EMAIL_AGENT: Cloudflare.DurableObject("EmailAgent", { className: "EmailAgent" }),
        EMAIL_MCP: Cloudflare.DurableObject("EmailMCP", { className: "EmailMCP" }),
      },
    });

    const admin = yield* Cloudflare.Worker("Admin", {
      main: stubPath("admin"),
      compatibility,
      access,
      ...closedDev,
      ...domain(`admin.${DOMAIN}`),
      env: {
        DB: database,
      },
    });

    const emailIn = yield* Cloudflare.Worker("EmailIn", {
      main: new URL("../workers/email-in/src/worker.ts", import.meta.url).pathname,
      compatibility,
      ...closedDev,
      ...(production ? { crons: ["*/15 * * * *"] } : {}),
      env: {
        ...(Redacted.value(clickupToken).length > 0 ? { CLICKUP_API_TOKEN: clickupToken } : {}),
        ...(clickupListIdContacts.length > 0 ? { CLICKUP_LIST_ID_CONTACTS: clickupListIdContacts } : {}),
        DB: database,
        BUCKET: bucket,
        EMAIL_ADDRESSES: [...ROLE_MAILBOXES],
        MAILBOX: Cloudflare.DurableObject("Mailbox", {
          className: "MailboxDO",
          scriptName: inbox.workerName,
        }),
        EMAIL_AGENT: Cloudflare.DurableObject("EmailAgent", {
          className: "EmailAgent",
          scriptName: inbox.workerName,
        }),
      },
    });

    const emailOut = yield* Cloudflare.Worker("EmailOut", {
      main: new URL("../workers/email-out/src/worker.ts", import.meta.url).pathname,
      compatibility,
      ...closedDev,
      env: {
        DB: database,
        EMAIL: outbound,
        PUBLIC_API_ORIGIN: production ? `https://api.${DOMAIN}` : "",
        APP_BASE_URL: production ? `https://${DOMAIN}` : "",
        EMAIL_FROM: TRANSACTIONAL_FROM,
      },
    });

    const newsDatabase = yield* Cloudflare.D1.Database("NewsDatabase");
    const newsMedia = yield* Cloudflare.R2.Bucket("NewsMedia");
    // La app existe antes que el Worker: el env lee `newsAdmin.aud`, así que
    // Alchemy no despliega Noticias si Access no se creó. El dominio es solo
    // `/_emdash`. No se usa `access` en el Worker: eso inscribiría todo el
    // tráfico, también la portada. En un preview no hay hostname propio y el
    // admin queda apagado (`NEWS_ADMIN=off`); `/_emdash` responde 403.
    const newsAdmin = production
      ? yield* Cloudflare.Access.Application("NewsAdmin", {
        type: "self_hosted",
        domain: `noticias.${DOMAIN}/_emdash`,
        destinations: [{ type: "public", uri: `noticias.${DOMAIN}/_emdash` }],
        sessionDuration: accessSession,
        policies,
      })
      : undefined;
    const news = yield* Cloudflare.Website.Astro("News", {
      rootDir: decodeURIComponent(new URL("../apps/news/", import.meta.url).pathname),
      compatibility,
      ...closedDev,
      ...domain(`noticias.${DOMAIN}`),
      sessionKVBindingName: false,
      observability: { enabled: true, traces: { enabled: true } },
      env: {
        DB: newsDatabase,
        MEDIA: newsMedia,
        NEWS_RUNTIME: "cloudflare",
        NEWS_ADMIN: production ? "on" : "off",
        EMDASH_ENCRYPTION_KEY: Config.Redacted("EMDASH_ENCRYPTION_KEY"),
        ...(newsAdmin
          ? {
            ACCESS_AUD: newsAdmin.aud,
            ACCESS_TEAM_DOMAIN: Config.Redacted("TEAM_DOMAIN"),
          }
          : {}),
        ...(production ? { EMDASH_SITE_URL: `https://noticias.${DOMAIN}` } : {}),
      },
    });

    const web = yield* Cloudflare.Website.Vinext("Web", {
      rootDir: decodeURIComponent(new URL("../apps/web/", import.meta.url).pathname),
      compatibility,
      ...domain(DOMAIN, [`www.${DOMAIN}`]),
      env: {
        DB: database,
        MAIL_QUEUE: mail,
        TURNSTILE_SITE_KEY: turnstile.sitekey,
        TURNSTILE_SECRET_KEY: turnstile.secret,
        BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
        ADMIN_EMAILS: yield* Config.String("ADMIN_EMAILS").pipe(Config.withDefault("")),
        AUTH_PRODUCTION: production ? "1" : "0",
        EMAIL_VERIFICATION_REQUIRED: yield* Config.String("EMAIL_VERIFICATION_REQUIRED").pipe(Config.withDefault("")),
      },
    });

    yield* Cloudflare.Queues.Consumer("MailConsumer", {
      queueId: mail.queueId,
      scriptName: emailOut.workerName,
      deadLetterQueue: mailDeadLetter.queueName,
      settings: { batchSize: 10, maxRetries: 5 },
    });

    if (zone !== undefined) {
      for (const mx of ROUTING_MX) {
        yield* Cloudflare.DNS.Record(mx.id, {
          zoneId: zone.zoneId,
          name: "@",
          type: "MX",
          content: mx.host,
          priority: mx.priority,
        }).pipe(adopt(true));
      }
      yield* Cloudflare.DNS.Record("SpfApex", {
        zoneId: zone.zoneId,
        name: "@",
        type: "TXT",
        content: APEX_SPF,
      }).pipe(adopt(true));
      yield* Cloudflare.DNS.Record("Dmarc", {
        zoneId: zone.zoneId,
        name: "_dmarc",
        type: "TXT",
        content: DMARC,
      }).pipe(adopt(true));
      const routing = yield* Cloudflare.Email.Routing("Routing", { zone: zone.zoneId });
      for (const mailbox of ROLE_MAILBOXES) {
        const label = mailbox.slice(0, mailbox.indexOf("@"));
        yield* Cloudflare.Email.Rule(label, {
          zone: routing.zoneId,
          name: label,
          matchers: [{ type: "literal", field: "to", value: mailbox }],
          actions: [{ type: "worker", value: [emailIn.workerName] }],
        });
      }
      yield* Cloudflare.Email.CatchAll("CatchAll", {
        zone: routing.zoneId,
        actions: [{ type: "drop" }],
      });
    }

    return {
      stage,
      production,
      database: database.databaseName,
      bucket: bucket.bucketName,
      turnstileSitekey: turnstile.sitekey,
      api: api.workerName,
      web: web.workerName,
      inbox: inbox.workerName,
      admin: admin.workerName,
      emailIn: emailIn.workerName,
      emailOut: emailOut.workerName,
      news: news.workerName,
      newsUrl: news.url,
      newsDatabase: newsDatabase.databaseName,
      newsMedia: newsMedia.bucketName,
    };
  }),
);
