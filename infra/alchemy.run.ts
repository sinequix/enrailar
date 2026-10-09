import { Stage, Stack } from "alchemy";
import { adopt } from "alchemy/AdoptPolicy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { ROLE_MAILBOXES } from "@enrailar/shared";
import { DOMAIN, isProductionStage, stubPath } from "./src/stage.ts";

const compatibility = {
  date: "2026-10-09",
  flags: ["nodejs_compat" as const],
};

const accessSession = "24h";

/** Dominio del proyecto, más las direcciones de `ACCESS_ALLOWED_EMAILS` si el entorno las trae. */
function accessInclude(extraEmails: string) {
  const include: Array<{ emailDomain: string } | { email: string }> = [
    { emailDomain: DOMAIN },
  ];
  for (const part of extraEmails.split(",")) {
    const email = part.trim();
    if (email.length > 0) include.push({ email });
  }
  return include;
}

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
    const include = accessInclude(extraEmails);
    const accessPolicies = [
      {
        decision: "allow" as const,
        include,
      },
    ];
    // En prod la app se declara acá para poder atar `POLICY_AUD` a su `aud`.
    // Un preview no tiene hostname propio todavía: la app dedicada del Worker
    // sigue naciendo con el destino `worker`, y el aud entra por el entorno.
    const accessApp = production
      ? yield* Cloudflare.Access.Application("Access", {
          type: "self_hosted",
          domain: `inbox.${DOMAIN}`,
          // Los Workers suman destinos `worker`. Con la lista no vacía,
          // Cloudflare exige que `domain` esté incluido.
          destinations: [{ type: "public", uri: `inbox.${DOMAIN}` }],
          sessionDuration: accessSession,
          policies: accessPolicies,
        })
      : undefined;
    const access = accessApp ?? {
      policies: accessPolicies,
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
      allowedSenderAddresses: [...ROLE_MAILBOXES],
    });

    const domain = (name: string, aliases?: string[]) =>
      zone === undefined ? {} : { domain: { name, aliases, zoneId: zone.zoneId } };

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
      ...domain(`inbox.${DOMAIN}`),
      env: {
        BUCKET: bucket,
        AI: Cloudflare.Workers.AI(),
        EMAIL: inboxSend,
        DOMAINS: DOMAIN,
        EMAIL_ADDRESSES: [...ROLE_MAILBOXES],
        POLICY_AUD: accessApp ? Redacted.make(accessApp.aud) : Config.Redacted("POLICY_AUD"),
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
      ...domain(`admin.${DOMAIN}`),
      env: {
        DB: database,
      },
    });

    const emailIn = yield* Cloudflare.Worker("EmailIn", {
      main: new URL("../workers/email-in/src/worker.ts", import.meta.url).pathname,
      compatibility,
      env: {
        FORWARD_TO: Config.Redacted("FORWARD_TO"),
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
      env: {
        DB: database,
        SEND_EMAIL: outbound,
        PUBLIC_API_ORIGIN: production ? `https://api.${DOMAIN}` : "",
      },
    });

    const web = yield* Cloudflare.Website.Vinext("Web", {
      rootDir: decodeURIComponent(new URL("../apps/web/", import.meta.url).pathname),
      compatibility,
      ...domain(DOMAIN, [`www.${DOMAIN}`]),
      env: {
        TURNSTILE_SITE_KEY: turnstile.sitekey,
      },
    });

    yield* Cloudflare.Queues.Consumer("MailConsumer", {
      queueId: mail.queueId,
      scriptName: emailOut.workerName,
      deadLetterQueue: mailDeadLetter.queueName,
      settings: { batchSize: 10, maxRetries: 5 },
    });

    if (zone !== undefined) {
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
    };
  }),
);
