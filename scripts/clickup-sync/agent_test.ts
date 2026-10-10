import { assertEquals } from "@std/assert";
import {
  AGENT_BUILDING,
  AGENT_PLAN,
  AGENT_PLAN_REVIEW,
  AGENT_READY,
  type AgentAction,
  type AgentComment,
  type AgentPull,
  type AgentSnapshot,
  decide,
  NEEDS_HUMAN,
} from "./agent.ts";
import { agentSkippedForMissingMentionToken } from "./guard.ts";
import { tagsFromLabels } from "./labels.ts";

Deno.test("agent:plan pide solo un plan a @cursor", () => {
  const actions = decide(issue());
  const body = commentBody(actions, "issue");
  assertEquals(body.includes("@cursor"), true);
  assertEquals(body.includes("@tebabot"), false);
  assertEquals(body.includes("sin código"), true);
  assertEquals(body.includes("PLAN"), true);
  assertEquals(body.includes("<!-- agent-orch:ask-cursor-plan -->"), true);
  assertEquals(actions.some((action) => action.kind === "clickup"), true);
});

Deno.test("la misma foto no vuelve a pedir el plan", () => {
  const asked = decide(issue());
  const body = commentBody(asked, "issue");
  const again = decide(issue({
    issueComments: [note(1, "tebayoso", body)],
  }));
  assertEquals(again.filter((action) => action.kind === "comment"), []);
});

Deno.test("un PLAN de @cursor pasa a revisión y menciona a @tebabot", () => {
  const actions = decide(issue({
    issueComments: [note(4, "cursor[bot]", "PLAN\nalcance y tests")],
  }));
  assertEquals(labelAdd(actions), [AGENT_PLAN_REVIEW]);
  const body = commentBody(actions, "issue");
  assertEquals(body.includes("@tebabot"), true);
  assertEquals(body.includes("APPROVED"), true);
  assertEquals(body.includes("<!-- agent-orch:ask-tebabot-plan:4 -->"), true);
});

Deno.test("APPROVED pasa a agent:building y pide el PR sin merge automático", () => {
  const actions = decide(issue({
    labels: [AGENT_PLAN_REVIEW],
    issueComments: [
      note(4, "cursor", "PLAN\nenfoque"),
      note(5, "tebayoso", "<!-- agent-orch:ask-tebabot-plan:4 -->"),
      note(6, "tebabot[bot]", "APPROVED el alcance cierra"),
    ],
  }));
  const labels = actions.filter((action) => action.kind === "labels");
  assertEquals(labels[0]?.kind === "labels" ? labels[0].add : [], [
    AGENT_READY,
  ]);
  assertEquals(
    labels[1]?.kind === "labels" ? labels[1].add : [],
    [AGENT_BUILDING],
  );
  const body = commentBody(actions, "issue");
  assertEquals(body.includes("@cursor"), true);
  assertEquals(body.includes("Closes #12"), true);
  assertEquals(body.includes("No mergees"), true);
  assertEquals(body.includes("<!-- agent-orch:ask-cursor-build -->"), true);
});

Deno.test("CHANGES dentro del tope pide otro plan", () => {
  const actions = decide(issue({
    labels: [AGENT_PLAN_REVIEW],
    issueComments: [
      note(4, "cursor", "PLAN\nv1"),
      note(5, "tebayoso", "<!-- agent-orch:ask-tebabot-plan:4 -->"),
      note(6, "tebabot", "CHANGES falta el riesgo de la sync"),
    ],
  }));
  const body = commentBody(actions, "issue");
  assertEquals(body.includes("@cursor"), true);
  assertEquals(body.includes("PLAN"), true);
  assertEquals(body.includes("@tebayoso"), false);
  assertEquals(
    body.includes("<!-- agent-orch:ask-cursor-revise-plan:6 -->"),
    true,
  );
});

Deno.test("la tercera revisión rechazada escala a @tebayoso", () => {
  const actions = decide(issue({
    labels: [AGENT_PLAN_REVIEW],
    issueComments: exhaustedPlan(),
  }));
  assertEquals(labelAdd(actions), [NEEDS_HUMAN]);
  const body = commentBody(actions, "issue");
  assertEquals(body.includes("@tebayoso"), true);
  assertEquals(body.includes("@cursor"), false);
  assertEquals(body.includes("<!-- agent-orch:needs-human:plan -->"), true);
});

Deno.test("la label agent:approved aprueba el plan", () => {
  const actions = decide(issue({
    labels: [AGENT_PLAN_REVIEW, "agent:approved"],
    issueComments: [note(4, "cursor", "PLAN\nv1")],
  }));
  const body = commentBody(actions, "issue");
  assertEquals(body.includes("<!-- agent-orch:ask-cursor-build -->"), true);
  const last = actions.filter((action) => action.kind === "labels").at(-1);
  assertEquals(
    last?.kind === "labels" ? last.remove.includes("agent:approved") : false,
    true,
  );
});

Deno.test("otro autor y Verdict APPROVE no mueven el plan", () => {
  const actions = decide(issue({
    labels: [AGENT_PLAN_REVIEW],
    issueComments: [
      note(4, "cursor", "PLAN\nv1"),
      note(5, "tebayoso", "<!-- agent-orch:ask-tebabot-plan:4 -->"),
      note(6, "github-actions[bot]", "PLAN no soy cursor"),
      note(7, "tebabot[bot]", "Verdict: APPROVE"),
    ],
  }));
  assertEquals(actions.filter((action) => action.kind === "comment"), []);
});

Deno.test("un comentario del orquestador no cuenta como plan", () => {
  const actions = decide(issue({
    issueComments: [
      note(2, "cursor", "PLAN\n<!-- agent-orch:note -->"),
    ],
  }));
  const body = commentBody(actions, "issue");
  assertEquals(body.includes("@tebabot"), false);
  assertEquals(body.includes("@cursor"), true);
  assertEquals(body.includes("<!-- agent-orch:ask-cursor-plan -->"), true);
});

Deno.test("CI rojo pide un ajuste y el marcador lleva el sha", () => {
  const sha = "abc1234def";
  const actions = decide(issue({
    labels: [AGENT_BUILDING],
    issueComments: [
      note(3, "tebayoso", "<!-- agent-orch:ask-cursor-build -->"),
    ],
    pull: pull({ headSha: sha, ci: "failure" }),
  }));
  const body = commentBody(actions, "pull");
  assertEquals(body.includes("@cursor"), true);
  assertEquals(body.includes("No mergees"), true);
  assertEquals(
    body.includes(`<!-- agent-orch:ask-cursor-revise-pr:${sha}:ci -->`),
    true,
  );
});

Deno.test("CI pendiente no gasta una ronda", () => {
  const sha = "abc1234def";
  const actions = decide(issue({
    labels: [AGENT_BUILDING],
    issueComments: [
      note(3, "tebayoso", "<!-- agent-orch:ask-cursor-build -->"),
    ],
    pull: pull({
      headSha: sha,
      ci: "pending",
      comments: [
        note(8, "tebayoso", `<!-- agent-orch:ask-tebabot-pr:${sha} -->`),
      ],
    }),
  }));
  assertEquals(actions.filter((action) => action.kind === "comment"), []);
});

Deno.test("CI verde y review APPROVED avisa el merge humano sin mencionar a @cursor", () => {
  const sha = "abc1234def";
  const actions = decide(issue({
    labels: [AGENT_BUILDING],
    issueComments: [
      note(3, "tebayoso", "<!-- agent-orch:ask-cursor-build -->"),
    ],
    pull: pull({
      headSha: sha,
      ci: "success",
      reviews: [{ id: 9, author: "tebabot[bot]", state: "APPROVED" }],
    }),
  }));
  const body = commentBody(actions, "issue");
  assertEquals(body.includes("@cursor"), false);
  assertEquals(body.includes("@tebabot"), false);
  assertEquals(body.includes("auto-merge"), true);
  assertEquals(
    body.includes(`<!-- agent-orch:ready-for-merge:${sha} -->`),
    true,
  );
  assertEquals(actions.some((action) => action.kind === "labels"), false);
});

Deno.test("tres ajustes de PR escalan a needs:human", () => {
  const sha = "abc1234def";
  const previous = [1, 2, 3].map((round) =>
    note(
      20 + round,
      "tebayoso",
      `<!-- agent-orch:ask-cursor-revise-pr:deadbee${round}:ci -->`,
    )
  );
  const actions = decide(issue({
    labels: [AGENT_BUILDING],
    issueComments: [
      note(3, "tebayoso", "<!-- agent-orch:ask-cursor-build -->"),
      ...previous,
    ],
    pull: pull({ headSha: sha, ci: "failure" }),
  }));
  assertEquals(labelAdd(actions), [NEEDS_HUMAN]);
  assertEquals(commentBody(actions, "issue").includes("@tebayoso"), true);
});

Deno.test("un issue cerrado o sin label no hace nada", () => {
  assertEquals(decide(issue({ issueState: "closed" })), []);
  assertEquals(decide(issue({ labels: ["clickup"] })), []);
});

Deno.test("needs:human frena el flujo", () => {
  assertEquals(
    decide(issue({
      labels: [NEEDS_HUMAN, AGENT_PLAN],
      issueComments: [note(4, "cursor", "PLAN\nv1")],
    })),
    [],
  );
});

Deno.test("los labels del agente no vuelven como tags de ClickUp", () => {
  assertEquals(
    tagsFromLabels([
      "clickup",
      "agent:plan",
      "needs:human",
      "priority/high",
      "Bug",
    ]),
    ["bug"],
  );
});

Deno.test("sin AGENT_MENTION_TOKEN la orquestación se omite", () => {
  assertEquals(
    agentSkippedForMissingMentionToken({ AGENT_MENTION_TOKEN: "  " }).skip,
    true,
  );
  assertEquals(
    agentSkippedForMissingMentionToken({ AGENT_MENTION_TOKEN: "pat" }).skip,
    false,
  );
});

function issue(patch: Partial<AgentSnapshot> = {}): AgentSnapshot {
  return {
    issueNumber: 12,
    issueState: "open",
    labels: [AGENT_PLAN],
    issueComments: [],
    pull: null,
    ...patch,
  };
}

function note(id: number, author: string, body: string): AgentComment {
  return { id, author, body };
}

function pull(patch: Partial<AgentPull> = {}): AgentPull {
  return {
    number: 40,
    headSha: "abc1234def",
    comments: [],
    reviews: [],
    ci: "pending",
    ...patch,
  };
}

function exhaustedPlan(): AgentComment[] {
  const comments: AgentComment[] = [];
  for (const round of [1, 2, 3]) {
    const planId = round * 10;
    comments.push(note(planId, "cursor", `PLAN\nronda ${round}`));
    comments.push(note(
      planId + 1,
      "tebayoso",
      `<!-- agent-orch:ask-tebabot-plan:${planId} -->`,
    ));
    comments.push(note(planId + 2, "tebabot", "CHANGES todavía no"));
    if (round < 3) {
      comments.push(note(
        planId + 3,
        "tebayoso",
        `<!-- agent-orch:ask-cursor-revise-plan:${planId + 2} -->`,
      ));
    }
  }
  return comments;
}

function commentBody(
  actions: readonly AgentAction[],
  target: "issue" | "pull",
): string {
  const comment = actions.find((action) =>
    action.kind === "comment" && action.target === target
  );
  return comment?.kind === "comment" ? comment.body : "";
}

function labelAdd(actions: readonly AgentAction[]): string[] {
  const labels = actions.find((action) => action.kind === "labels");
  return labels?.kind === "labels" ? labels.add : [];
}
