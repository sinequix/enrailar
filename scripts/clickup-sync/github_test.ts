import { assertEquals, assertRejects } from "@std/assert";
import { GithubClient, isDuplicateSubIssue } from "./github.ts";
import { HttpStatusError } from "./http.ts";

const DUPLICATE_BODY = JSON.stringify({
  message:
    "An error occurred while adding the sub-issue to the parent issue. Issue may not contain duplicate sub-issues and Sub issue may only have one parent",
  documentation_url:
    "https://docs.github.com/rest/issues/sub-issues#add-sub-issue",
  status: "422",
});

const repo = { owner: "sinequix", name: "enrailar" };

Deno.test("el 422 de sub-issue duplicado no es un error", () => {
  assertEquals(isDuplicateSubIssue(DUPLICATE_BODY), true);
  assertEquals(isDuplicateSubIssue("already a sub-issue"), true);
  assertEquals(
    isDuplicateSubIssue('{"message":"Invalid property /sub_issue_id"}'),
    false,
  );
});

Deno.test("vincular una subtarea que ya cuelga del padre devuelve ok", async () => {
  const github = client(422, DUPLICATE_BODY);
  assertEquals(await github.addSubIssue(84, 5891352812), "ok");
});

Deno.test("un 422 que no es duplicado sigue fallando", async () => {
  const github = client(
    422,
    JSON.stringify({ message: "Invalid property /sub_issue_id" }),
  );
  await assertRejects(
    () => github.addSubIssue(84, 5891352812),
    HttpStatusError,
  );
});

function client(status: number, body: string): GithubClient {
  const fetchImpl: typeof fetch = () =>
    Promise.resolve(new Response(body, { status }));
  return new GithubClient("token", repo, { fetchImpl });
}
