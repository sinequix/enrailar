import { assertEquals, assertRejects } from "@std/assert";
import { HttpStatusError } from "./http.ts";
import { linkChildren } from "./sync-to-github.ts";

const PREINSCRIPCION = "86e3nwc8q";
const PRENSA = "86e3nwc8p";

Deno.test("una subtarea que falla no aborta ni marca a las demás", async () => {
  const seen: number[] = [];
  const result = await linkChildren(
    (issueId) => {
      seen.push(issueId);
      if (issueId === 5891352812) {
        return Promise.reject(
          new Error(
            "GitHub POST sub_issues → 422 duplicate sub-issues and Sub issue may only have one parent",
          ),
        );
      }
      return Promise.resolve("ok");
    },
    [
      { taskId: PREINSCRIPCION, issueId: 5891352812 },
      { taskId: PRENSA, issueId: 5891353001 },
    ],
  );
  assertEquals(seen, [5891352812, 5891353001]);
  assertEquals(result, {
    mode: "sub-issues",
    failed: [PREINSCRIPCION],
  });
});

Deno.test("un 401 al vincular corta la sync", async () => {
  const seen: number[] = [];
  await assertRejects(
    () =>
      linkChildren(
        (issueId) => {
          seen.push(issueId);
          return Promise.reject(new HttpStatusError(401, "GitHub → 401"));
        },
        [
          { taskId: PREINSCRIPCION, issueId: 1 },
          { taskId: PRENSA, issueId: 2 },
        ],
      ),
    HttpStatusError,
  );
  assertEquals(seen, [1]);
});
