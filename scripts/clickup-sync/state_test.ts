import { assertEquals } from "@std/assert";
import {
  type CloseReason,
  initialGithubClose,
  type PullRequestRef,
  resolveClickupStatus,
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
    wanted: ["in progress"],
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
    wanted: ["cancelled", "closed"],
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
