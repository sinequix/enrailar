import { assertEquals, assertFalse } from "@std/assert";
import { clickupMarker } from "./marker.ts";
import {
  buildIssueBody,
  clickupDescriptionForCompare,
  creationPlan,
  descriptionsDiffer,
  hasDrift,
  issueDescriptionForCompare,
  orderParentsFirst,
  upsertSubtaskSection,
  withGithubLink,
} from "./plan.ts";
import { nextLink, referencedIssueNumbers } from "./references.ts";
import { syncSkippedForMissingToken } from "./guard.ts";

const repo = { owner: "sinequix", name: "enrailar" };

Deno.test("no crea un issue si el marcador ya existe", () => {
  const issues = [{ body: `hola\n\n${clickupMarker("abc")}\n` }];
  assertEquals(creationPlan(["abc", "def", "abc"], issues), {
    create: ["def"],
    existing: ["abc", "abc"],
  });
});

Deno.test("un issue sin marcador no bloquea a otra tarea", () => {
  assertEquals(creationPlan(["abc"], [{ body: "sin marcador" }]), {
    create: ["abc"],
    existing: [],
  });
});

Deno.test("las subtareas se crean después de su padre", () => {
  const ordered = orderParentsFirst([
    { id: "hijo", parentId: "padre" },
    { id: "padre", parentId: null },
    { id: "nieto", parentId: "hijo" },
  ]);
  assertEquals(ordered.map((task) => task.id), ["padre", "hijo", "nieto"]);
});

Deno.test("el cuerpo nuevo no cuenta como deriva y conserva el marcador", () => {
  const markdown = "Mapear el ramal.\n\nSiguiente paso.";
  const body = buildIssueBody({
    taskId: "abc",
    taskUrl: "https://app.clickup.com/t/abc",
    markdown,
  });
  assertEquals(body.includes(clickupMarker("abc")), true);
  assertFalse(descriptionsDiffer(markdown, body));
  assertFalse(hasDrift(
    { id: "abc", name: "Ramal", markdown },
    { title: "Ramal", body },
  ));
});

Deno.test("el link agregado en ClickUp no pisa la comparación", () => {
  const markdown = "Texto de la tarea.";
  const linked = withGithubLink(
    markdown,
    "https://github.com/sinequix/enrailar/issues/4",
  );
  assertEquals(linked.changed, true);
  assertEquals(
    clickupDescriptionForCompare(linked.markdown),
    issueDescriptionForCompare(markdown),
  );
  assertEquals(
    withGithubLink(
      linked.markdown,
      "https://github.com/sinequix/enrailar/issues/4",
    ).changed,
    false,
  );
});

Deno.test("un título distinto en ClickUp es deriva", () => {
  const body = buildIssueBody({
    taskId: "abc",
    taskUrl: "https://app.clickup.com/t/abc",
    markdown: "Igual",
  });
  assertEquals(
    hasDrift({ id: "abc", name: "Otro", markdown: "Igual" }, {
      title: "Uno",
      body,
    }),
    true,
  );
});

Deno.test("una descripción larga no se come el marcador", () => {
  const body = buildIssueBody({
    taskId: "abc",
    taskUrl: "https://app.clickup.com/t/abc",
    markdown: "x".repeat(80_000),
  });
  assertEquals(body.includes(clickupMarker("abc")), true);
  assertEquals(body.length <= 65_000, true);
});

Deno.test("el checklist de subtareas se reemplaza y no se duplica", () => {
  const once = upsertSubtaskSection("cuerpo", [{ number: 2, done: false }]);
  const twice = upsertSubtaskSection(once, [{ number: 2, done: true }, {
    number: 3,
    done: false,
  }]);
  assertEquals(twice.includes("<!-- clickup-subtasks:start -->"), true);
  assertEquals(twice.split("<!-- clickup-subtasks:start -->").length, 2);
  assertEquals(twice.includes("- [x] #2"), true);
  assertEquals(twice.includes("- [ ] #3"), true);
});

Deno.test("Closes #N y una mención del mismo repo cuentan, otro repo no", () => {
  const text =
    "Closes #12. Ver sinequix/enrailar#3 y other/repo#4. Otra vez #12.";
  assertEquals(referencedIssueNumbers(text, repo), [12, 3]);
});

Deno.test("la paginación sigue el link next", () => {
  assertEquals(
    nextLink(
      '<https://api.github.com/issues?page=2>; rel="next", <https://api.github.com/issues?page=4>; rel="last"',
    ),
    "https://api.github.com/issues?page=2",
  );
  assertEquals(nextLink(null), null);
});

Deno.test("sin token la sync no corre", () => {
  assertEquals(syncSkippedForMissingToken({}).skip, true);
  assertEquals(
    syncSkippedForMissingToken({ CLICKUP_API_TOKEN: "   " }).skip,
    true,
  );
  assertEquals(
    syncSkippedForMissingToken({ CLICKUP_API_TOKEN: "token" }).skip,
    false,
  );
});
