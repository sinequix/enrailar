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
  DENIED_TASK_IDS,
  formatSkips,
  listGate,
  loadSyncPolicy,
  policyFromConfig,
  type PrivacySubject,
  spacePrivacy,
  type SyncPolicy,
} from "./privacy.ts";
import { loadTombstones, tombstoneComment } from "./tombstone.ts";
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

const CONFIRMED = ["901717708587", "901717736453"];

function policy(): SyncPolicy {
  return policyFromConfig({ lists: [{ id: MARKETING }] });
}

Deno.test("la allowlist del repo es solo por id de lista y no incluye el CRM", async () => {
  const loaded = await loadSyncPolicy({});
  assertEquals([...loaded.allowListIds].sort(), [...CONFIRMED].sort());
  for (const crm of CRM_LISTS) {
    assert(loaded.denyListIds.has(crm.id));
    assertFalse(loaded.allowListIds.has(crm.id));
  }
});

Deno.test("un nombre permitido con un id desconocido no se publica", () => {
  const loaded = policyFromConfig({
    lists: [
      { name: "Marketing" },
      { name: "Producto↔Marketing" },
      { name: "Cursor · Agentes" },
      { name: "Propuesta Trenes Tandil" },
    ],
    folders: [{ id: "901700000002", name: "Marketing" }],
  });
  assertEquals(loaded.allowListIds.size, 0);
  const space = spacePrivacy([], loaded);
  assertEquals(
    listGate(
      list("901700009999", "Marketing", "901700000002", "Marketing"),
      space,
    ),
    "not-allowlisted",
  );
  assertEquals(
    classifyTask(
      subject({
        listId: "901700009999",
        listName: "Producto↔Marketing",
        folderId: "901700000002",
        folderName: "Marketing",
      }),
      space,
    ),
    { action: "skip", reason: "not-allowlisted" },
  );
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
    { action: "skip", reason: "not-allowlisted" },
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
    { action: "skip", reason: "not-allowlisted" },
  );
  for (const tag of ["voluntarios", "contactos", "leads"]) {
    assertEquals(
      classifyTask({
        listId: MARKETING,
        listName: "Marketing",
        folderId: null,
        folderName: null,
        tags: [tag],
        fuente: null,
      }, space),
      { action: "skip", reason: "deny-tag" },
    );
  }
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
    if (path.endsWith("/comment")) return { comments: [] };
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
      "deny-task": 0,
      "deny-tag": 1,
      "deny-fuente": 1,
      "deny-content": 0,
      "tombstone": 0,
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

Deno.test("tombstones.json recuerda la tarea retirada y solo guarda ids", async () => {
  const links = await loadTombstones();
  assertEquals(links.get(DENIED_TASK_IDS[0]), 65);
  assertEquals(links.size, 1);
});

Deno.test("la lista o carpeta Contactos se niega aunque no sea el id del CRM", () => {
  const space = spacePrivacy(
    [
      list("901700000310", "Contactos y contexto", "901700000311", "Marketing"),
      list("901700000312", "Notas", "901700000313", "Contactos"),
    ],
    policy(),
  );
  assertEquals(
    listGate(
      list("901700000310", "Contactos y contexto", "901700000311", "Marketing"),
      space,
    ),
    "deny-list",
  );
  assertEquals(
    listGate(list("901700000312", "Notas", "901700000313", "Contactos"), space),
    "deny-folder",
  );
});

Deno.test("un correo externo o un bloque Contactos no se publica; el dominio interno sí", () => {
  const space = spacePrivacy([list(MARKETING, "Marketing")], policy());
  const external = ["lead@gmail.com", "persona@example.com"];
  for (const mail of external) {
    assertEquals(
      classifyTask(
        subject({ text: `Escribir a ${mail} por la campaña.` }),
        space,
      ),
      { action: "skip", reason: "deny-content" },
    );
  }
  for (
    const mail of [
      "equipo@enrailar.com",
      "ops@sinequix.com",
      "mesa@mail.enrailar.com",
      "equipo@ENRAILAR.COM",
      "mesa@mail.SINEQUiX.com",
    ]
  ) {
    assertEquals(
      classifyTask(subject({ text: `Escribir a ${mail}.` }), space),
      { action: "sync" },
    );
  }
  for (
    const mail of [
      "lead@evilenrailar.com",
      "lead@enrailar.com.evil.io",
      "lead@evilsinequix.com",
      "lead@sinequix.com.evil.io",
    ]
  ) {
    assertEquals(
      classifyTask(subject({ text: `Escribir a ${mail}.` }), space),
      { action: "skip", reason: "deny-content" },
    );
  }
  for (
    const text of [
      "nombre arroba gmail punto com",
      "Nombre ARROBA Gmail Punto Com",
      "equipo arroba enrailar punto com",
      "Llamar al +54 9 249 555 0134.",
      "Teléfono 011 15 5555 0134.",
    ]
  ) {
    assertEquals(
      classifyTask(subject({ text }), space),
      { action: "skip", reason: "deny-content" },
    );
  }
  assertEquals(
    classifyTask(
      subject({ text: "Plan 2026. Lista 901717708587." }),
      space,
    ),
    { action: "sync" },
  );
  assertEquals(
    classifyTask(
      subject({ text: "Los contactos de prensa confirman el horario." }),
      space,
    ),
    { action: "sync" },
  );
  assertEquals(
    classifyTask(subject({ name: "Contactos" }), space),
    { action: "skip", reason: "deny-content" },
  );
  assertEquals(
    classifyTask(subject({ text: "Notas\n# Contactos\n" }), space),
    { action: "skip", reason: "deny-content" },
  );
  assertEquals(
    classifyTask(
      subject({ text: "Esto es contactos y contexto de la campaña." }),
      space,
    ),
    { action: "skip", reason: "deny-content" },
  );
  assertEquals(
    classifyTask(
      subject({ taskId: DENIED_TASK_IDS[0], text: "Plan de la campaña." }),
      space,
    ),
    { action: "skip", reason: "deny-task" },
  );
});

Deno.test("classifyTask niega el id de una lista del CRM", () => {
  const space = spacePrivacy([], policy());
  assertEquals(
    classifyTask(subject({ listId: VOLUNTEER, listName: "Marketing" }), space),
    { action: "skip", reason: "deny-list" },
  );
});

Deno.test("classifyTask niega la carpeta del CRM", () => {
  const lists = [
    list(VOLUNTEER, "Voluntarios y Hackatrain", CRM_FOLDER, "CRM"),
  ];
  const space = spacePrivacy(lists, policy());
  assertEquals(
    classifyTask(
      subject({
        listId: SIBLING,
        listName: "Notas internas",
        folderId: CRM_FOLDER,
        folderName: "CRM",
      }),
      space,
    ),
    { action: "skip", reason: "deny-folder" },
  );
});

Deno.test("classifyTask niega la tarea bloqueada", () => {
  const space = spacePrivacy([], policy());
  assertEquals(
    classifyTask(subject({ taskId: DENIED_TASK_IDS[0] }), space),
    { action: "skip", reason: "deny-task" },
  );
});

Deno.test("classifyTask niega la etiqueta", () => {
  const space = spacePrivacy([], policy());
  assertEquals(
    classifyTask(subject({ tags: ["voluntario"] }), space),
    { action: "skip", reason: "deny-tag" },
  );
});

Deno.test("classifyTask niega la fuente que llega como etiqueta", () => {
  const space = spacePrivacy([], policy());
  assertEquals(
    classifyTask(subject({ tags: ["fuente-sumate"] }), space),
    { action: "skip", reason: "deny-fuente" },
  );
});

Deno.test("classifyTask niega la fuente que llega como campo", () => {
  const space = spacePrivacy([], policy());
  assertEquals(
    classifyTask(subject({ fuente: "sumate" }), space),
    { action: "skip", reason: "deny-fuente" },
  );
});

Deno.test("classifyTask niega el contenido", () => {
  const space = spacePrivacy([], policy());
  assertEquals(
    classifyTask(subject({ text: "Avisar a lead@gmail.com." }), space),
    { action: "skip", reason: "deny-content" },
  );
});

Deno.test("classifyTask niega una lápida", () => {
  const space = spacePrivacy([], policy(), new Set(["tomb1"]));
  assertEquals(
    classifyTask(subject({ taskId: "tomb1" }), space),
    { action: "skip", reason: "tombstone" },
  );
});

Deno.test("classifyTask niega una lista que no está en la allowlist", () => {
  const space = spacePrivacy([], policy());
  assertEquals(
    classifyTask(
      subject({ listId: UNKNOWN, listName: "Marketing" }),
      space,
    ),
    { action: "skip", reason: "not-allowlisted" },
  );
});

Deno.test("classifyTask niega un id de lista vacío", () => {
  const space = spacePrivacy([], policy());
  assertEquals(
    classifyTask(
      subject({ listId: "", listName: "Producto↔Marketing" }),
      space,
    ),
    { action: "skip", reason: "not-allowlisted" },
  );
});

Deno.test("la sync no publica la tarea retirada ni un cuerpo con correo externo", async () => {
  const seen = new Set<string>();
  const ctx = context((method, url) => {
    const path = new URL(url).pathname;
    if (method !== "GET") throw new Error(`escritura ${method} ${path}`);
    if (path.endsWith("/list")) {
      return { lists: [list(MARKETING, "Marketing")] };
    }
    if (path.endsWith("/folder")) return { folders: [] };
    if (path.endsWith("/task")) {
      return {
        tasks: [
          { id: DENIED_TASK_IDS[0], parent: null },
          { id: "mail1", parent: null },
          { id: "press1", parent: null },
        ],
        last_page: true,
      };
    }
    if (path.endsWith("/comment")) return { comments: [] };
    if (path.endsWith("/issues")) return [];
    if (path.includes("/task/")) {
      const id = path.split("/task/")[1] ?? "";
      seen.add(id);
      if (id === DENIED_TASK_IDS[0]) {
        return publicTask(id, "Plan de la campaña.");
      }
      if (id === "mail1") return publicTask(id, "Avisar a lead@gmail.com.");
      if (id === "press1") {
        return publicTask(id, "Los contactos de prensa confirman el horario.");
      }
    }
    throw new Error(`sin mock ${method} ${path}`);
  }, true);

  const output = await capture(() => syncClickupToGithub(ctx));
  assert(seen.has(DENIED_TASK_IDS[0]));
  assert(output.includes(
    `task=${DENIED_TASK_IDS[0]} skipped reason=deny-task`,
  ));
  assert(output.includes("task=mail1 skipped reason=deny-content"));
  assert(output.includes("dry-run task=press1 action=create-issue"));
  assertFalse(output.includes("lead@gmail.com"));
  assertFalse(output.includes("@"));
  assertFalse(
    output.includes(`task=${DENIED_TASK_IDS[0]} action=create-issue`),
  );
  assertFalse(output.includes("dry-run task=mail1 action=create-issue"));
});

Deno.test("sin marcador o con el issue borrado no se crea otro", async () => {
  const posts: string[] = [];
  const ctx = context(
    (method, url) => {
      const path = new URL(url).pathname;
      if (method !== "GET") {
        posts.push(path);
        throw new Error(`escritura ${method} ${path}`);
      }
      if (path.endsWith("/list")) {
        return {
          lists: [list(MARKETING, "Marketing")],
        };
      }
      if (path.endsWith("/folder")) return { folders: [] };
      if (path.endsWith("/task")) {
        return {
          tasks: [
            { id: "kept1", parent: null },
            { id: "lost1", parent: null },
            { id: "gone1", parent: null },
            { id: "seed1", parent: null },
          ],
          last_page: true,
        };
      }
      if (path.endsWith("/comment")) {
        const id = path.split("/task/")[1]?.split("/")[0];
        if (id === "gone1") {
          return {
            comments: [{
              id: "c1",
              comment_text: tombstoneComment(
                "https://github.com/sinequix/enrailar/issues/66",
              ),
            }],
          };
        }
        return { comments: [] };
      }
      if (path.endsWith("/issues")) {
        return [{
          id: 650,
          number: 64,
          title: "Aviso",
          body: "Sigue vinculado.\n\n<!-- clickup:kept1 -->\n",
          state: "closed",
          state_reason: "completed",
          html_url: "https://github.com/sinequix/enrailar/issues/64",
        }];
      }
      if (path.endsWith("/issues/64")) {
        return {
          id: 650,
          number: 64,
          title: "Aviso",
          body: "Sigue vinculado.\n\n<!-- clickup:kept1 -->\n",
          state: "closed",
          state_reason: "completed",
          html_url: "https://github.com/sinequix/enrailar/issues/64",
        };
      }
      if (path.endsWith("/issues/64/timeline")) return [];
      if (path.endsWith("/issues/65")) {
        return {
          id: 651,
          number: 65,
          title: "Aviso",
          body: "Retirado.",
          state: "closed",
          state_reason: "completed",
          html_url: "https://github.com/sinequix/enrailar/issues/65",
        };
      }
      if (path.endsWith("/issues/66")) {
        return new Response("{}", {
          status: 404,
          headers: { "content-type": "application/json" },
        });
      }
      if (path.includes("/task/kept1")) return publicTask("kept1", "Sigue.");
      if (path.includes("/task/lost1")) {
        return publicTask(
          "lost1",
          "Plan.\n\n---\nGitHub: https://github.com/sinequix/enrailar/issues/65\n",
        );
      }
      if (path.includes("/task/gone1")) return publicTask("gone1", "Plan.");
      if (path.includes("/task/seed1")) return publicTask("seed1", "Plan.");
      throw new Error(`sin mock ${method} ${path}`);
    },
    true,
    new Map([["seed1", 65]]),
  );

  const output = await capture(() => syncClickupToGithub(ctx));
  assertEquals(posts, []);
  assertFalse(output.includes("action=create-issue"));
  assert(output.includes("task=lost1 skipped reason=tombstone"));
  assert(output.includes("task=gone1 skipped reason=tombstone"));
  assert(output.includes("task=seed1 skipped reason=tombstone"));
  assertFalse(output.includes("task=kept1 skipped reason=tombstone"));
  assert(output.includes("tombstone=3"));
});

Deno.test("al crear un issue el vínculo queda en un comentario de ClickUp", async () => {
  const comments: string[] = [];
  const issuePosts: string[] = [];
  const title = "Aviso de servicio";
  const ctx = context((method, url, body) => {
    const path = new URL(url).pathname;
    if (path.endsWith("/list")) {
      return { lists: [list(MARKETING, "Marketing")] };
    }
    if (path.endsWith("/folder")) return { folders: [] };
    if (path.endsWith("/task") && method === "GET") {
      return {
        tasks: [{ id: "new1", parent: null }],
        last_page: true,
      };
    }
    if (path.endsWith("/comment") && method === "GET") return { comments: [] };
    if (path.endsWith("/comment") && method === "POST") {
      comments.push(body ?? "");
      return {};
    }
    if (path.endsWith("/task/new1") && method === "GET") {
      return publicTask("new1", "Plan de la campaña.", title);
    }
    if (path.endsWith("/task/new1") && method === "PUT") return {};
    if (path.includes("/labels/")) return { name: "clickup", color: "ededed" };
    if (path.endsWith("/issues") && method === "GET") return [];
    if (path.endsWith("/issues") && method === "POST") {
      issuePosts.push(body ?? "");
      const sent = JSON.parse(body ?? "{}") as {
        title?: string;
        body?: string;
      };
      return {
        id: 770,
        number: 77,
        title: sent.title ?? "",
        body: sent.body ?? "",
        state: "open",
        html_url: "https://github.com/sinequix/enrailar/issues/77",
      };
    }
    if (path.endsWith("/issues/77") && method === "GET") {
      const sent = JSON.parse(issuePosts[0] ?? "{}") as { body?: string };
      return {
        id: 770,
        number: 77,
        title,
        body: sent.body ?? "",
        state: "open",
        html_url: "https://github.com/sinequix/enrailar/issues/77",
      };
    }
    if (path.endsWith("/timeline")) return [];
    throw new Error(`sin mock ${method} ${path}`);
  }, false);

  await capture(() => syncClickupToGithub(ctx));
  assertEquals(issuePosts.length, 1);
  const link = tombstoneComment(
    "https://github.com/sinequix/enrailar/issues/77",
  );
  assert(comments.some((raw) => JSON.parse(raw).comment_text === link));
  for (const raw of comments) {
    const text = JSON.parse(raw).comment_text as string;
    if (!text.includes("clickup-sync:tombstone")) continue;
    assertFalse(text.includes(title));
    assertFalse(text.includes("Plan de la campaña."));
  }
});

function subject(
  partial: Partial<PrivacySubject> = {},
): PrivacySubject {
  return {
    taskId: "task",
    name: "Campaña",
    text: "Plan de la campaña.",
    listId: MARKETING,
    listName: "Marketing",
    folderId: null,
    folderName: null,
    tags: [],
    fuente: null,
    ...partial,
  };
}

function publicTask(
  id: string,
  description: string,
  name = "Campaña",
): Record<string, unknown> {
  return {
    id,
    name,
    description,
    status: { status: "to do", type: "open" },
    tags: [],
    list: { id: MARKETING, name: "Marketing" },
  };
}

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
  route: (
    method: string,
    url: string,
    body?: string,
  ) => unknown | Response,
  dryRun: boolean,
  tombstones: ReadonlyMap<string, number> = new Map(),
): SyncContext {
  const fetchImpl: typeof fetch = (input, init) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.href
      : input.url;
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? init.body : undefined;
    const payload = route(method, url, body);
    if (payload instanceof Response) return Promise.resolve(payload);
    return Promise.resolve(Response.json(payload));
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
    tombstones,
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
