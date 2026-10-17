import { assertEquals, assertRejects } from "@std/assert";
import { GithubClient, isDuplicateSubIssue } from "./github.ts";
import { HttpStatusError } from "./http.ts";
import { resolveClickupStatus } from "./state.ts";

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

Deno.test("el timeline mergeado completa solo con closingIssuesReferences", async () => {
  const github = timelineClient({
    pull: { state: "closed", merged: true },
    closing: [12],
  });
  const linked = await github.linkedPullRequests(12);
  assertEquals(linked[0]?.closes, true);
  assertEquals(
    resolveClickupStatus(
      { issueState: "open", stateReason: null, pullRequests: linked },
      ["to do", "complete"],
    ).bucket,
    "complete",
  );
});

Deno.test("un cross-reference mergeado sin keyword de cierre no completa", async () => {
  const github = timelineClient({
    pull: { state: "closed", merged: true },
    closing: [],
  });
  const linked = await github.linkedPullRequests(12);
  assertEquals(linked[0]?.closes, false);
  assertEquals(
    resolveClickupStatus(
      { issueState: "open", stateReason: null, pullRequests: linked },
      ["to do", "complete"],
    ).bucket,
    "todo",
  );
});

Deno.test("una PR abierta en el timeline deja in progress y no consulta el cierre", async () => {
  const seen: string[] = [];
  const github = timelineClient({
    pull: { state: "open", merged: false },
    closing: [12],
    seen,
  });
  const linked = await github.linkedPullRequests(12);
  assertEquals(linked[0]?.closes, false);
  assertEquals(seen.some((url) => url.includes("/graphql")), false);
  assertEquals(
    resolveClickupStatus(
      { issueState: "open", stateReason: null, pullRequests: linked },
      ["to do", "in progress", "complete"],
    ).bucket,
    "in_progress",
  );
});

Deno.test("una PR cerrada sin merge no cuenta como progreso", async () => {
  const seen: string[] = [];
  const github = timelineClient({
    pull: { state: "closed", merged: false },
    closing: [12],
    seen,
  });
  const linked = await github.linkedPullRequests(12);
  assertEquals(linked[0]?.merged, false);
  assertEquals(linked[0]?.closes, false);
  assertEquals(seen.some((url) => url.includes("/graphql")), false);
  assertEquals(
    resolveClickupStatus(
      { issueState: "open", stateReason: null, pullRequests: linked },
      ["to do", "in progress", "complete"],
    ).bucket,
    "todo",
  );
});

function timelineClient(input: {
  pull: { state: string; merged: boolean };
  closing: number[];
  seen?: string[];
}): GithubClient {
  const fetchImpl: typeof fetch = (request, init) => {
    const url = String(request);
    input.seen?.push(url);
    if (url.includes("/issues/12/timeline")) {
      return json([{
        event: "cross-referenced",
        source: {
          issue: {
            number: 7,
            pull_request: { url: "https://api.github.com/pulls/7" },
          },
        },
      }]);
    }
    if (url.includes("/pulls/7")) {
      return json({
        state: input.pull.state,
        merged: input.pull.merged,
        draft: false,
        html_url: "https://github.com/sinequix/enrailar/pull/7",
      });
    }
    if (url.includes("/graphql")) {
      const raw = typeof init?.body === "string" ? init.body : "";
      const parsed = JSON.parse(raw) as { variables?: { number?: number } };
      const nodes = parsed.variables?.number === 7
        ? input.closing.map((number) => ({ number }))
        : [];
      return json({
        data: {
          repository: {
            pullRequest: { closingIssuesReferences: { nodes } },
          },
        },
      });
    }
    return json({ message: "no" }, 404);
  };
  return new GithubClient("token", repo, { fetchImpl });
}

function json(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

function client(status: number, body: string): GithubClient {
  const fetchImpl: typeof fetch = () =>
    Promise.resolve(new Response(body, { status }));
  return new GithubClient("token", repo, { fetchImpl });
}
