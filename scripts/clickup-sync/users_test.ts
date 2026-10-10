import { assertEquals } from "@std/assert";
import {
  assigneePatch,
  clickupIdFor,
  githubLoginFor,
  parseUserMap,
} from "./users.ts";
import userMap from "./user-map.json" with { type: "json" };

const users = [
  { clickupUserId: "10", clickupUsername: "ada", githubLogin: "ada-gh" },
];

Deno.test("el archivo commiteado no tiene personas", () => {
  const parsed = parseUserMap(userMap);
  assertEquals(parsed.users, []);
  assertEquals(parsed.skipped, 0);
});

Deno.test("una entrada con email o con un campo email se ignora", () => {
  const email = ["ada", "example.com"].join("@");
  const parsed = parseUserMap({
    users: [
      { clickupUserId: "1", clickupUsername: email, githubLogin: "ada" },
      { clickupUserId: "2", clickupUsername: "ada", githubLogin: email },
      { clickupUserId: "3", clickupUsername: "ada", githubLogin: "ada", email },
      { clickupUserId: "4", clickupUsername: "ada", githubLogin: "ada-gh" },
    ],
  });
  assertEquals(parsed.skipped, 3);
  assertEquals(parsed.users.map((user) => user.clickupUserId), ["4"]);
});

Deno.test("el par se resuelve por id y, si no hay id, por username", () => {
  assertEquals(githubLoginFor(users, { id: "10", username: "otro" }), "ada-gh");
  assertEquals(githubLoginFor(users, { id: "99", username: "Ada" }), "ada-gh");
  const email = ["ada", "example.com"].join("@");
  assertEquals(githubLoginFor(users, { id: "99", username: email }), null);
  assertEquals(clickupIdFor(users, "ADA-GH"), "10");
  assertEquals(clickupIdFor(users, email), null);
});

Deno.test("no borra asignados de ClickUp que no están en el mapa", () => {
  const patch = assigneePatch(
    [],
    [{ id: "10", username: "ada" }],
    ["alguien"],
  );
  assertEquals(patch, { add: [], rem: [], unmapped: ["alguien"] });
});

Deno.test("agrega y quita solo personas mapeadas", () => {
  assertEquals(
    assigneePatch(users, [], ["ada-gh", "nadie"]),
    { add: ["10"], rem: [], unmapped: ["nadie"] },
  );
  assertEquals(
    assigneePatch(users, [{ id: "10", username: "ada" }, {
      id: "99",
      username: "otra",
    }], []),
    { add: [], rem: ["10"], unmapped: [] },
  );
});
