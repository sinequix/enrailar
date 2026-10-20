import { assert, assertEquals, assertFalse } from "@std/assert";
import {
  CLICKUP_SPACE_ID,
  ClickupClient,
  type ClickupList,
} from "./clickup.ts";
import type { SyncContext } from "./context.ts";
import { GithubClient } from "./github.ts";
import {
  classifyTask,
  CRM_LISTS,
  formatSkips,
  listGate,
  loadSyncPolicy,
  normalizeLabel,
  policyFromConfig,
  spacePrivacy,
  type SyncPolicy,
} from "./privacy.ts";
import { syncGithubToClickup } from "./sync-to-clickup.ts";
import { syncClickupToGithub } from "./sync-to-github.ts";

const MARKETING = "901700000010";
const SIBLING = "901700000099";
const UNKNOWN = "901700000012";
const CRM_FOLDER = "901700000001";
const VOLUNTEER = "901717736446";

const SECRET_NAME = "SECRET_NAME";
const SECRET_MAIL = "secret.person@example.com";
const SECRET_CITY = "CiudadSecreta";
const PUBLIC_TITLE = "PUBLIC_SENTINEL";
const ISSUE_TITLE = "SECRET_ISSUE_TITLE";

function list(
  id: string,
  name: string,
  folderId: string | null = null,
  folderName: string | null = null,
): ClickupList {
  return {
    id,
    name,
    folderId,
    folderName,
    statuses: [{ status: "to do", type: "open" }],
  };
}

function policy(): SyncPolicy {
  return policyFromConfig({
    lists: [
      { name: "Producto↔Marketing" },
      { name: "Cursor · Agentes" },
      { name: "Propuesta Trenes Tandil" },
      { name: "Marketing" },
    ],
    folders: [{ name: "Marketing" }],
  });
}

Deno.test("la allowlist del repo nombra el trabajo público y no incluye el CRM", async () => {
  const loaded = await loadSyncPolicy({});
  for (
    const name of [
      "Producto↔Marketing",
      "Cursor · Agentes",
      "Propuesta Trenes Tandil",
      "Marketing",
    ]
  ) {
    assert(loaded.allowNames.has(normalizeLabel(name)));
  }
  for (const crm of CRM_LISTS) {
    assert(loaded.denyListIds.has(crm.id));
    assertFalse(loaded.allowListIds.has(crm.id));
  }
});

Deno.test("un id del CRM en la allowlist o en el entorno sigue denegado", () => {
  const loaded = policyFromConfig(
    { lists: [{ id: VOLUNTEER, name: "Marketing" }] },
    { CLICKUP_SYNC_ALLOWLIST: VOLUNTEER },
  );
  const decision = classifyTask({
    listId: VOLUNTEER,
    listName: "Marketing",
    folderId: null,
    folderName: null,
    tags: [],
    fuente: null,
  }, spacePrivacy([], loaded));
  assertEquals(decision, { action: "skip", reason: "deny-list" });
});

Deno.test("la carpeta del CRM deniega también a la lista hermana", () => {
  const lists = [
    list(VOLUNTEER, "Voluntarios y Hackatrain", CRM_FOLDER, "CRM"),
    list(SIBLING, "Notas internas", CRM_FOLDER, "CRM"),
  ];
  const space = spacePrivacy(lists, policy());
  assertEquals(listGate(lists[1], space), "deny-folder");
});

Deno.test("etiqueta, fuente y lista desconocida se saltan; la lista permitida pasa", () => {
  const space = spacePrivacy([list(MARKETING, "Marketing")], policy());
  assertEquals(
    classifyTask({
      listId: MARKETING,
      listName: "Marketing",
      folderId: null,
      folderName: null,
      tags: ["Voluntario"],
      fuente: null,
    }, space),
    { action: "skip", reason: "deny-tag" },
  );
  assertEquals(
    classifyTask({
      listId: MARKETING,
      listName: "Marketing",
      folderId: null,
      folderName: null,
      tags: ["contacto"],
      fuente: null,
    }, space),
    { action: "skip", reason: "deny-tag" },
  );
  assertEquals(
    classifyTask({
      listId: MARKETING,
      listName: "Marketing",
      folderId: null,
      folderName: null,
      tags: ["lead"],
      fuente: null,
    }, space),
    { action: "skip", reason: "deny-tag" },
  );
  for (const fuente of ["sumate", "hola@", "email", "Hola@"]) {
    assertEquals(
      classifyTask({
        listId: MARKETING,
        listName: "Marketing",
        folderId: null,
        folderName: null,
        tags: [],
        fuente,
      }, space),
      { action: "skip", reason: "deny-fuente" },
    );
  }
  assertEquals(
    classifyTask({
      listId: MARKETING,
      listName: "Marketing",
      folderId: null,
      folderName: null,
      tags: ["fuente-sumate"],
      fuente: null,
    }, space),
    { action: "skip", reason: "deny-fuente" },
  );
  assertEquals(
    listGate(list(UNKNOWN, "Otra"), space),
    "not-allowlisted",
  );
  assertEquals(
    classifyTask({
      listId: MARKETING,
      listName: "Marketing",
      folderId: null,
      folderName: null,
      tags: [],
      fuente: null,
    }, space),
    { action: "sync" },
  );
  assertEquals(
    classifyTask({
      listId: "901700000077",
      listName: "Campañas",
      folderId: "901700000002",
      folderName: "Marketing",
      tags: [],
      fuente: null,
    }, space),
    { action: "sync" },
  );
  assertEquals(
    classifyTask({
      listId: "901700000078",
      listName: "Cursor - Agentes",
      folderId: null,
      folderName: null,
      tags: [],
      fuente: null,
    }, space),
    { action: "sync" },
  );
});

Deno.test("un dropdown de fuente se lee como texto", async () => {
  const client = new ClickupClient("token", {
    fetchImpl: () =>
      Promise.resolve(Response.json({
        id: "src-drop",
        name: "tarea",
        list: { id: MARKETING, name: "Marketing" },
        custom_fields: [{
          id: "field-fuente",
          name: "fuente",
          type: "drop_down",
          type_config: {
            options: [{ id: "opt", name: "sumate", orderindex: 0 }],
          },
          value: 0,
        }],
      })),
  });
  const task = await client.getTask("src-drop");
  const space = spacePrivacy([list(MARKETING, "Marketing")], policy());
  assertEquals(
    classifyTask({
      listId: task.listId,
      listName: task.listName,
      folderId: task.folderId,
      folderName: task.folderName,
      tags: task.tags,
      fuente: task.customFields.find((field) =>
        field.name === "fuente"
      )?.value ?? null,
    }, space),
    { action: "skip", reason: "deny-fuente" },
  );
});

Deno.test("la sync publica solo la lista permitida y el log no lleva datos personales", async () => {
  const fetched: string[] = [];
  const ctx = context((method, url) => {
    const path = new URL(url).pathname;
    if (method !== "GET") throw new Error(`escritura ${method} ${path}`);
    if (path.endsWith("/space/" + CLICKUP_SPACE_ID + "/list")) {
      return {
        lists: [
          list(MARKETING, "Marketing"),
          list(UNKNOWN, "Otra"),
        ],
      };
    }
    if (path.endsWith("/space/" + CLICKUP_SPACE_ID + "/folder")) {
      return {
        folders: [{
          id: CRM_FOLDER,
          name: "CRM",
          lists: [
            list(VOLUNTEER, "Voluntarios y Hackatrain", CRM_FOLDER, "CRM"),
            list(SIBLING, "Notas internas", CRM_FOLDER, "CRM"),
          ],
        }],
      };
    }
    if (path.endsWith("/task")) {
      const listId = path.split("/list/")[1]?.split("/")[0];
      const ids: Record<string, string[]> = {
        [MARKETING]: ["vol1", "src1", "pub1"],
        [UNKNOWN]: ["unk1"],
        [VOLUNTEER]: ["crm1"],
        [SIBLING]: ["sib1"],
      };
      return {
        tasks: (ids[listId ?? ""] ?? []).map((id) => ({ id, parent: null })),
        last_page: true,
      };
    }
    if (path.includes("/task/")) {
      const id = path.split("/task/")[1] ?? "";
      fetched.push(id);
      return taskPayload(id);
    }
    if (path.endsWith("/issues")) return [];
    throw new Error(`sin mock ${method} ${path}`);
  }, true);

  const output = await capture(() => syncClickupToGithub(ctx));
  assertEquals(fetched.slice().sort(), ["pub1", "src1", "vol1"]);
  assert(output.includes("dry-run task=pub1 action=create-issue"));
  assert(output.includes(
    formatSkips({
      "deny-list": 1,
      "deny-folder": 1,
      "deny-tag": 1,
      "deny-fuente": 1,
      "not-allowlisted": 1,
    }),
  ));
  for (const secret of [SECRET_NAME, SECRET_MAIL, SECRET_CITY, PUBLIC_TITLE]) {
    assertFalse(output.includes(secret));
  }
  assertFalse(output.includes("@"));
});

Deno.test("el camino inverso no vincula una tarea del CRM ni una fuente sumate", async () => {
  const writes: string[] = [];
  const logs: string[] = [];
  const ctx = context((method, url) => {
    const path = new URL(url).pathname;
    if (method !== "GET") {
      writes.push(`${method} ${path}`);
      throw new Error(`escritura ${method} ${path}`);
    }
    if (path.endsWith("/issues/7")) {
      return {
        id: 70,
        number: 7,
        title: ISSUE_TITLE,
        body: "<!-- clickup:crm1 -->",
        state: "open",
        html_url: "https://github.com/sinequix/enrailar/issues/7",
      };
    }
    if (path.endsWith("/issues/8")) {
      return {
        id: 80,
        number: 8,
        title: ISSUE_TITLE,
        body: "<!-- clickup:src9 -->",
        state: "open",
        html_url: "https://github.com/sinequix/enrailar/issues/8",
      };
    }
    if (path.endsWith("/task/crm1")) return taskPayload("crm1");
    if (path.endsWith("/task/src9")) return taskPayload("src9");
    if (path.includes("/space/")) {
      return path.endsWith("/folder") ? { folders: [] } : { lists: [] };
    }
    throw new Error(`sin mock ${method} ${path}`);
  }, false);

  await capture(() =>
    syncGithubToClickup(ctx, {
      name: "issues",
      event: { issue: { number: 7 } },
    }), logs);
  ctx.lists = null;
  await capture(() =>
    syncGithubToClickup(ctx, {
      name: "issues",
      event: { issue: { number: 8 } },
    }), logs);
  assertEquals(writes, []);
  assert(logs.some((line) => line === "task=crm1 skipped reason=deny-list"));
  assert(logs.some((line) => line === "task=src9 skipped reason=deny-fuente"));
  assertFalse(logs.join("\n").includes(ISSUE_TITLE));
  assertFalse(logs.join("\n").includes(SECRET_NAME));
  assertFalse(logs.join("\n").includes("@"));
});

function taskPayload(id: string): Record<string, unknown> {
  switch (id) {
    case "vol1":
      return {
        id,
        name: SECRET_NAME,
        description: `${SECRET_MAIL}\n${SECRET_CITY}`,
        status: { status: "to do", type: "open" },
        tags: [{ name: "voluntario" }],
        list: { id: MARKETING, name: "Marketing" },
      };
    case "src1":
    case "src9":
      return {
        id,
        name: SECRET_NAME,
        description: `${SECRET_MAIL}\n${SECRET_CITY}`,
        status: { status: "to do", type: "open" },
        tags: [],
        custom_fields: [{
          id: "field-fuente",
          name: "fuente",
          type: "short_text",
          value: "sumate",
        }],
        list: { id: MARKETING, name: "Marketing" },
      };
    case "pub1":
      return {
        id,
        name: PUBLIC_TITLE,
        description: "Plan de la campaña.",
        status: { status: "to do", type: "open" },
        tags: [],
        list: { id: MARKETING, name: "Marketing" },
      };
    case "crm1":
      return {
        id,
        name: SECRET_NAME,
        description: `${SECRET_MAIL}\n${SECRET_CITY}`,
        status: { status: "to do", type: "open" },
        tags: [{ name: "voluntario" }],
        custom_fields: [{
          id: "field-fuente",
          name: "fuente",
          type: "short_text",
          value: "sumate",
        }],
        list: { id: VOLUNTEER, name: "Voluntarios y Hackatrain" },
        folder: { id: CRM_FOLDER, name: "CRM" },
      };
    default:
      throw new Error("tarea de prueba desconocida");
  }
}

function context(
  route: (method: string, url: string) => unknown,
  dryRun: boolean,
): SyncContext {
  const fetchImpl: typeof fetch = (input, init) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : input.url;
    const method = init?.method ?? "GET";
    return Promise.resolve(Response.json(route(method, url)));
  };
  const repo = { owner: "sinequix", name: "enrailar" };
  return {
    dryRun,
    spaceId: CLICKUP_SPACE_ID,
    repo,
    clickup: new ClickupClient("token", { dryRun, fetchImpl }),
    github: new GithubClient("token", repo, { dryRun, fetchImpl }),
    users: [],
    policy: policy(),
    lists: null,
    statusByList: null,
  };
}

async function capture(
  run: () => Promise<void>,
  into: string[] = [],
): Promise<string> {
  const log = console.log;
  const warn = console.warn;
  const error = console.error;
  const push = (...args: unknown[]) => {
    into.push(args.map((arg) => String(arg)).join(" "));
  };
  console.log = push;
  console.warn = push;
  console.error = push;
  try {
    await run();
  } finally {
    console.log = log;
    console.warn = warn;
    console.error = error;
  }
  return into.join("\n");
}
