import { assertEquals } from "@std/assert";
import {
  type CloseReason,
  initialGithubClose,
  type PullRequestRef,
  resolveClickupStatus,
  STATUS_CANDIDATES,
  type StatusInput,
} from "./state.ts";

const today = ["to do", "complete"];

Deno.test("abierto sin PR queda en to do", () => {
  assertEquals(resolveClickupStatus(open(), today), {
    bucket: "todo",
    kind: "status",
    status: "to do",
  });
});

Deno.test("un PR abierto pide in progress y no lo inventa si la lista no lo tiene", () => {
  const resolved = resolveClickupStatus(
    open({ pullRequests: [pull()] }),
    today,
  );
  assertEquals(resolved, {
    bucket: "in_progress",
    kind: "missing",
    wanted: STATUS_CANDIDATES.inProgress,
  });
});

Deno.test("un PR en draft también es in progress", () => {
  const resolved = resolveClickupStatus(
    open({ pullRequests: [pull({ draft: true })] }),
    ["to do", "in progress", "complete"],
  );
  assertEquals(resolved, {
    bucket: "in_progress",
    kind: "status",
    status: "in progress",
  });
});

Deno.test("un PR cerrado sin merge deja la tarea en to do", () => {
  const resolved = resolveClickupStatus(
    open({ pullRequests: [pull({ state: "closed" })] }),
    today,
  );
  assertEquals(resolved.kind === "status" ? resolved.status : null, "to do");
});

Deno.test("un PR mergeado completa la tarea aunque el issue siga abierto", () => {
  const resolved = resolveClickupStatus(
    open({ pullRequests: [pull({ state: "closed", merged: true })] }),
    today,
  );
  assertEquals(resolved, {
    bucket: "complete",
    kind: "status",
    status: "complete",
  });
});

Deno.test("si hay un PR abierto y otro mergeado, sigue en progreso", () => {
  const resolved = resolveClickupStatus(
    open({
      pullRequests: [
        pull({ number: 1, state: "closed", merged: true }),
        pull({ number: 2 }),
      ],
    }),
    ["to do", "in progress", "complete"],
  );
  assertEquals(resolved, {
    bucket: "in_progress",
    kind: "status",
    status: "in progress",
  });
});

Deno.test("cerrar el issue como completed lo completa", () => {
  assertEquals(
    resolveClickupStatus(closed("completed"), today),
    { bucket: "complete", kind: "status", status: "complete" },
  );
  assertEquals(
    resolveClickupStatus(closed(null), today).kind === "status"
      ? resolveClickupStatus(closed(null), today)
      : null,
    { bucket: "complete", kind: "status", status: "complete" },
  );
});

Deno.test("not planned busca cancelled y si no existe closed", () => {
  assertEquals(resolveClickupStatus(closed("not_planned"), today), {
    bucket: "not_planned",
    kind: "missing",
    wanted: STATUS_CANDIDATES.notPlanned,
  });
  assertEquals(
    resolveClickupStatus(closed("not_planned"), [
      "to do",
      "cancelled",
      "closed",
    ]),
    { bucket: "not_planned", kind: "status", status: "cancelled" },
  );
  assertEquals(
    resolveClickupStatus(closed("duplicate"), ["to do", "Closed"]),
    { bucket: "not_planned", kind: "status", status: "Closed" },
  );
});

Deno.test("el nombre del estado respeta la lista", () => {
  assertEquals(
    resolveClickupStatus(closed("completed"), ["To Do", "Complete"]),
    { bucket: "complete", kind: "status", status: "Complete" },
  );
});

Deno.test("al importar, el tipo de estado de ClickUp decide si el issue nace cerrado", () => {
  assertEquals(initialGithubClose("to do", "open"), "open");
  assertEquals(initialGithubClose("in progress", "custom"), "open");
  assertEquals(initialGithubClose("complete", "closed"), "completed");
  assertEquals(initialGithubClose("complete", "done"), "completed");
  assertEquals(initialGithubClose("cancelled", "closed"), "not_planned");
  assertEquals(initialGithubClose("closed", "closed"), "not_planned");
  assertEquals(initialGithubClose("descartada", "closed"), "not_planned");
  assertEquals(initialGithubClose("mergeada", "done"), "completed");
  assertEquals(initialGithubClose("perdida", "done"), "not_planned");
});

Deno.test("por hacer, identificado, idea y planificada son to do", () => {
  for (const status of ["por hacer", "identificado", "idea", "planificada"]) {
    assertEquals(resolveClickupStatus(open(), [status, "hecha"]), {
      bucket: "todo",
      kind: "status",
      status,
    });
  }
});

Deno.test("el estado de una lista no cambia el de otra", () => {
  assertEquals(
    resolveClickupStatus(open(), ["to do", "complete"]),
    { bucket: "todo", kind: "status", status: "to do" },
  );
  assertEquals(resolveClickupStatus(open(), ["idea", "hecha"]), {
    bucket: "todo",
    kind: "status",
    status: "idea",
  });
  assertEquals(resolveClickupStatus(open(), ["por hacer", "mergeada"]), {
    bucket: "todo",
    kind: "status",
    status: "por hacer",
  });
});

Deno.test("las listas con estados propios no quedan en missing", () => {
  const marketing = [
    { status: "idea", type: "open" },
    { status: "priorizada", type: "custom" },
    { status: "en curso", type: "custom" },
    { status: "hecha", type: "done" },
    { status: "descartada", type: "closed" },
  ];
  const campanas = [
    { status: "planificada", type: "open" },
    { status: "en preparación", type: "custom" },
    { status: "en vivo", type: "custom" },
    { status: "medición", type: "custom" },
    { status: "cerrada", type: "closed" },
  ];
  const alianzas = [
    { status: "identificado", type: "open" },
    { status: "contactado", type: "custom" },
    { status: "conversación", type: "custom" },
    { status: "compromiso", type: "custom" },
    { status: "activo", type: "done" },
    { status: "no avanza", type: "closed" },
  ];
  const agentes = [
    { status: "por hacer", type: "open" },
    { status: "asignada a agente", type: "custom" },
    { status: "pr abierto", type: "custom" },
    { status: "en revisión humana", type: "custom" },
    { status: "mergeada", type: "done" },
    { status: "descartada", type: "closed" },
  ];
  assertEquals(resolveClickupStatus(open(), marketing), {
    bucket: "todo",
    kind: "status",
    status: "idea",
  });
  assertEquals(resolveClickupStatus(open(), campanas), {
    bucket: "todo",
    kind: "status",
    status: "planificada",
  });
  assertEquals(resolveClickupStatus(open(), alianzas), {
    bucket: "todo",
    kind: "status",
    status: "identificado",
  });
  assertEquals(
    resolveClickupStatus(open({ pullRequests: [pull()] }), marketing),
    { bucket: "in_progress", kind: "status", status: "en curso" },
  );
  assertEquals(
    resolveClickupStatus(open({ pullRequests: [pull()] }), agentes),
    { bucket: "in_progress", kind: "status", status: "pr abierto" },
  );
  assertEquals(resolveClickupStatus(closed("completed"), agentes), {
    bucket: "complete",
    kind: "status",
    status: "mergeada",
  });
  assertEquals(resolveClickupStatus(closed("completed"), marketing), {
    bucket: "complete",
    kind: "status",
    status: "hecha",
  });
  assertEquals(resolveClickupStatus(closed("not_planned"), marketing), {
    bucket: "not_planned",
    kind: "status",
    status: "descartada",
  });
  assertEquals(resolveClickupStatus(closed("completed"), campanas), {
    bucket: "complete",
    kind: "status",
    status: "cerrada",
  });
});

Deno.test("un estado done que significa perdido no se usa como complete", () => {
  const cuentas = [
    { status: "objetivo", type: "open" },
    { status: "en conversación", type: "custom" },
    { status: "cliente/aliado", type: "custom" },
    { status: "perdida", type: "done" },
    { status: "descartada", type: "closed" },
  ];
  assertEquals(resolveClickupStatus(open(), cuentas), {
    bucket: "todo",
    kind: "status",
    status: "objetivo",
  });
  assertEquals(resolveClickupStatus(closed("completed"), cuentas), {
    bucket: "complete",
    kind: "missing",
    wanted: STATUS_CANDIDATES.complete,
  });
});

Deno.test("sin tipo, el abierto con nombre desconocido sigue en missing", () => {
  assertEquals(resolveClickupStatus(open(), ["backlog propio"]), {
    bucket: "todo",
    kind: "missing",
    wanted: STATUS_CANDIDATES.todo,
  });
  assertEquals(
    resolveClickupStatus(open(), [{ status: "backlog propio", type: "open" }]),
    { bucket: "todo", kind: "status", status: "backlog propio" },
  );
});

function open(extra: Partial<StatusInput> = {}): StatusInput {
  return { issueState: "open", stateReason: null, pullRequests: [], ...extra };
}

function closed(stateReason: CloseReason): StatusInput {
  return { issueState: "closed", stateReason, pullRequests: [] };
}

function pull(extra: Partial<PullRequestRef> = {}): PullRequestRef {
  return {
    number: 1,
    state: "open",
    merged: false,
    draft: false,
    url: "https://github.com/sinequix/enrailar/pull/1",
    ...extra,
  };
}
