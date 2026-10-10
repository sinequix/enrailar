export const AGENT_PLAN = "agent:plan";
export const AGENT_PLAN_REVIEW = "agent:plan-review";
export const AGENT_READY = "agent:ready";
export const AGENT_BUILDING = "agent:building";
export const AGENT_APPROVED = "agent:approved";
export const NEEDS_HUMAN = "needs:human";
export const MAX_ROUNDS = 3;

const PHASES = [
  AGENT_PLAN,
  AGENT_PLAN_REVIEW,
  AGENT_READY,
  AGENT_BUILDING,
  NEEDS_HUMAN,
] as const;

export type AgentComment = {
  id: number;
  author: string;
  body: string;
};

export type AgentReview = {
  id: number;
  author: string;
  state: string;
};

export type AgentPull = {
  number: number;
  headSha: string;
  comments: readonly AgentComment[];
  reviews: readonly AgentReview[];
  ci: "pending" | "success" | "failure";
};

export type AgentSnapshot = {
  issueNumber: number;
  issueState: "open" | "closed";
  labels: readonly string[];
  issueComments: readonly AgentComment[];
  pull: AgentPull | null;
};

export type AgentAction =
  | { kind: "labels"; add: string[]; remove: string[] }
  | {
    kind: "comment";
    target: "issue" | "pull";
    pullNumber: number | null;
    mention: boolean;
    body: string;
  }
  | { kind: "clickup"; marker: string; text: string };

type Phase =
  | "plan"
  | "plan-review"
  | "ready"
  | "building"
  | "needs-human"
  | "none";

type Signal = "approved" | "changes";

export function decide(snapshot: AgentSnapshot): AgentAction[] {
  if (snapshot.issueState !== "open") return [];
  const phase = currentPhase(snapshot.labels);
  switch (phase) {
    case "none":
    case "needs-human":
      return [];
    case "plan":
    case "plan-review":
      return decidePlan(snapshot);
    case "ready":
      return startBuilding(snapshot);
    case "building":
      return decideBuilding(snapshot);
    default: {
      const unexpected: never = phase;
      throw new Error(`fase no manejada: ${String(unexpected)}`);
    }
  }
}

export function planRequestComment(issueNumber: number): string {
  return [
    "@cursor Planificá este issue. Solo plan y diseño, sin código.",
    "",
    "Incluí alcance, enfoque, archivos, riesgos, tests y criterios de aceptación.",
    "",
    "Empezá el comentario con PLAN.",
    "",
    marker("ask-cursor-plan"),
    "",
    `Issue #${issueNumber}.`,
  ].join("\n");
}

function decidePlan(snapshot: AgentSnapshot): AgentAction[] {
  if (planApproved(snapshot)) return startBuilding(snapshot);
  const plans = cursorPlans(snapshot.issueComments);
  if (plans.length === 0) return askInitialPlan(snapshot);

  const actions: AgentAction[] = [];
  if (currentPhase(snapshot.labels) !== "plan-review") {
    actions.push(setPhase(AGENT_PLAN_REVIEW));
    actions.push(clickup(
      "phase:plan-review",
      "Hay un plan. Pasa a agent:plan-review.",
    ));
  }

  const comments = allComments(snapshot);
  const latest = plans[plans.length - 1];
  if (!latest) return actions;
  const ask = `ask-tebabot-plan:${latest.id}`;
  const asked = markerNames(comments).filter((name) =>
    name.startsWith("ask-tebabot-plan:")
  );

  if (!hasMarker(comments, ask)) {
    if (asked.length >= MAX_ROUNDS) {
      return [...actions, ...needsHuman("plan", comments)];
    }
    actions.push(issueMention(tebabotPlanComment(latest.id)));
    actions.push(clickup(ask, "Se pidió a @tebabot que revise el plan."));
    return actions;
  }

  const askComment = commentWithMarker(comments, ask);
  const response = askComment
    ? latestSignal(snapshot.issueComments, askComment.id)
    : null;
  if (!response) return actions;
  if (response.signal === "approved") {
    return [...actions, ...startBuilding(snapshot)];
  }

  const revise = `ask-cursor-revise-plan:${response.id}`;
  if (hasMarker(comments, revise)) return actions;
  if (asked.length >= MAX_ROUNDS) {
    return [...actions, ...needsHuman("plan", comments)];
  }
  actions.push(issueMention(revisePlanComment(response.id)));
  actions.push(clickup(
    revise,
    "El plan no fue aprobado. Se pidió a @cursor que lo ajuste.",
  ));
  return actions;
}

function askInitialPlan(snapshot: AgentSnapshot): AgentAction[] {
  const actions: AgentAction[] = [];
  if (!snapshot.labels.includes(AGENT_PLAN)) {
    actions.push(setPhase(AGENT_PLAN));
  }
  if (hasMarker(allComments(snapshot), "ask-cursor-plan")) return actions;
  actions.push(issueMention(planRequestComment(snapshot.issueNumber)));
  actions.push(clickup(
    "ask-cursor-plan",
    "Se pidió a @cursor un plan, sin código.",
  ));
  return actions;
}

function startBuilding(snapshot: AgentSnapshot): AgentAction[] {
  const actions: AgentAction[] = [];
  const settled = snapshot.labels.includes(AGENT_BUILDING) &&
    !snapshot.labels.some((label) =>
      label === AGENT_PLAN || label === AGENT_PLAN_REVIEW ||
      label === AGENT_READY || label === AGENT_APPROVED
    );
  if (!settled) {
    actions.push(setPhase(AGENT_READY));
    actions.push(enterBuilding());
    actions.push(clickup(
      "phase:ready",
      "Plan aprobado. Pasa a agent:ready y enseguida a agent:building. El merge no es automático.",
    ));
  }
  return [...actions, ...decideBuilding(snapshot)];
}

function decideBuilding(snapshot: AgentSnapshot): AgentAction[] {
  const comments = allComments(snapshot);
  if (!hasMarker(comments, "ask-cursor-build")) {
    return [
      issueMention(buildComment(snapshot.issueNumber)),
      clickup(
        "ask-cursor-build",
        "Se pidió a @cursor que implemente el plan aprobado. Sin auto-merge.",
      ),
    ];
  }
  const actions: AgentAction[] = [];

  const pull = snapshot.pull;
  if (!pull || !/^[0-9a-f]{7,40}$/i.test(pull.headSha)) return actions;

  const reviseCount =
    markerNames(comments).filter((name) =>
      name.startsWith("ask-cursor-revise-pr:")
    ).length;
  const approved = pullApproved(pull, snapshot.labels);
  if (pull.ci === "success" && approved) {
    const ready = `ready-for-merge:${pull.headSha}`;
    if (!hasMarker(comments, ready)) {
      actions.push({
        kind: "comment",
        target: "issue",
        pullNumber: null,
        mention: false,
        body: readyComment(pull.number, pull.headSha),
      });
      actions.push(clickup(
        ready,
        `El PR #${pull.number} tiene CI verde y aprobación. El merge lo decide una persona. Sin auto-merge.`,
      ));
    }
    return actions;
  }

  const rejection = pullRejection(pull);
  if (pull.ci === "pending" && !rejection) {
    return [...actions, ...askTebabotOnPull(pull, comments)];
  }
  if (pull.ci === "success" && !approved && !rejection) {
    return [...actions, ...askTebabotOnPull(pull, comments)];
  }

  const reason = rejection ? String(rejection.id) : "ci";
  const revise = `ask-cursor-revise-pr:${pull.headSha}:${reason}`;
  if (hasMarker(comments, revise)) return actions;
  if (reviseCount >= MAX_ROUNDS) {
    return [...actions, ...needsHuman("build", comments)];
  }
  actions.push({
    kind: "comment",
    target: "pull",
    pullNumber: pull.number,
    mention: true,
    body: revisePullComment(pull.number, pull.headSha, reason),
  });
  actions.push(clickup(
    revise,
    `CI o la revisión del PR #${pull.number} no está en verde. Se pidió un ajuste a @cursor.`,
  ));
  return actions;
}

function askTebabotOnPull(
  pull: AgentPull,
  comments: readonly AgentComment[],
): AgentAction[] {
  const ask = `ask-tebabot-pr:${pull.headSha}`;
  if (hasMarker(comments, ask)) return [];
  return [
    {
      kind: "comment",
      target: "pull",
      pullNumber: pull.number,
      mention: true,
      body: tebabotPullComment(pull.number, pull.headSha),
    },
    clickup(ask, `Se pidió a @tebabot que revise el PR #${pull.number}.`),
  ];
}

function needsHuman(
  kind: "plan" | "build",
  comments: readonly AgentComment[],
): AgentAction[] {
  const name = `needs-human:${kind}`;
  const actions: AgentAction[] = [setPhase(NEEDS_HUMAN)];
  if (hasMarker(comments, name)) return actions;
  const subject = kind === "plan" ? "del plan" : "del pull request";
  actions.push({
    kind: "comment",
    target: "issue",
    pullNumber: null,
    mention: true,
    body: [
      `@tebayoso Hace falta una persona: se agotaron las ${MAX_ROUNDS} rondas de revisión ${subject}.`,
      "",
      marker(name),
    ].join("\n"),
  });
  actions.push(clickup(
    name,
    `Se agotaron las ${MAX_ROUNDS} rondas ${subject}. Aviso a @tebayoso.`,
  ));
  return actions;
}

function planApproved(snapshot: AgentSnapshot): boolean {
  if (snapshot.labels.includes(AGENT_APPROVED)) return true;
  return snapshot.issueComments.some((comment) =>
    actorOf(comment.author) === "tebabot" &&
    !isOrchestrator(comment.body) &&
    startsWithToken(comment.body, "APPROVED")
  );
}

function pullApproved(pull: AgentPull, labels: readonly string[]): boolean {
  if (labels.includes(AGENT_APPROVED)) return true;
  const signal = latestPullSignal(pull);
  return signal?.signal === "approved";
}

function pullRejection(pull: AgentPull): { id: number } | null {
  const signal = latestPullSignal(pull);
  if (!signal || signal.signal !== "changes") return null;
  return { id: signal.id };
}

function latestPullSignal(
  pull: AgentPull,
): { id: number; signal: Signal } | null {
  const hits: { id: number; signal: Signal }[] = [];
  for (const comment of pull.comments) {
    const signal = commentSignal(comment);
    if (signal) hits.push({ id: comment.id, signal });
  }
  for (const review of pull.reviews) {
    if (actorOf(review.author) !== "tebabot") continue;
    if (review.state === "APPROVED") {
      hits.push({ id: review.id, signal: "approved" });
    } else if (review.state === "CHANGES_REQUESTED") {
      hits.push({ id: review.id, signal: "changes" });
    }
  }
  hits.sort((a, b) => a.id - b.id);
  return hits[hits.length - 1] ?? null;
}

function latestSignal(
  comments: readonly AgentComment[],
  afterId: number,
): { id: number; signal: Signal } | null {
  const hits: { id: number; signal: Signal }[] = [];
  for (const comment of comments) {
    if (comment.id <= afterId) continue;
    const signal = commentSignal(comment);
    if (signal) hits.push({ id: comment.id, signal });
  }
  hits.sort((a, b) => a.id - b.id);
  return hits[hits.length - 1] ?? null;
}

function commentSignal(comment: AgentComment): Signal | null {
  if (actorOf(comment.author) !== "tebabot" || isOrchestrator(comment.body)) {
    return null;
  }
  if (startsWithToken(comment.body, "APPROVED")) return "approved";
  if (startsWithToken(comment.body, "CHANGES")) return "changes";
  return null;
}

function cursorPlans(comments: readonly AgentComment[]): AgentComment[] {
  return [...comments]
    .filter((comment) =>
      actorOf(comment.author) === "cursor" &&
      !isOrchestrator(comment.body) &&
      startsWithToken(comment.body, "PLAN")
    )
    .sort((a, b) => a.id - b.id);
}

function currentPhase(labels: readonly string[]): Phase {
  const names = new Set(labels);
  if (names.has(NEEDS_HUMAN)) return "needs-human";
  if (names.has(AGENT_BUILDING)) return "building";
  if (names.has(AGENT_READY)) return "ready";
  if (names.has(AGENT_PLAN_REVIEW)) return "plan-review";
  if (names.has(AGENT_PLAN)) return "plan";
  return "none";
}

export function actorOf(login: string): "cursor" | "tebabot" | "other" {
  const name = login.trim().toLowerCase();
  if (name === "cursor" || name === "cursor[bot]") return "cursor";
  if (name === "tebabot" || name === "tebabot[bot]") return "tebabot";
  return "other";
}

function isOrchestrator(body: string): boolean {
  return /<!--\s*agent-orch:/.test(body);
}

function startsWithToken(body: string, token: string): boolean {
  const trimmed = body.trimStart();
  if (!trimmed.startsWith(token)) return false;
  const next = trimmed.charAt(token.length);
  return next.length === 0 || /[\s:.,;!]/.test(next);
}

function allComments(snapshot: AgentSnapshot): AgentComment[] {
  return [...snapshot.issueComments, ...(snapshot.pull?.comments ?? [])];
}

function markerNames(comments: readonly AgentComment[]): string[] {
  const names: string[] = [];
  const pattern = /<!--\s*agent-orch:([A-Za-z0-9_.:-]+)\s*-->/g;
  for (const comment of comments) {
    for (const match of comment.body.matchAll(pattern)) {
      const name = match[1];
      if (name) names.push(name);
    }
  }
  return names;
}

function hasMarker(comments: readonly AgentComment[], name: string): boolean {
  return markerNames(comments).includes(name);
}

function commentWithMarker(
  comments: readonly AgentComment[],
  name: string,
): AgentComment | null {
  const needle = marker(name);
  return comments.find((comment) => comment.body.includes(needle)) ?? null;
}

function marker(name: string): string {
  return `<!-- agent-orch:${name} -->`;
}

function setPhase(phase: string): AgentAction {
  return {
    kind: "labels",
    add: [phase],
    remove: PHASES.filter((label) => label !== phase),
  };
}

function enterBuilding(): AgentAction {
  return {
    kind: "labels",
    add: [AGENT_BUILDING],
    remove: [
      AGENT_PLAN,
      AGENT_PLAN_REVIEW,
      AGENT_READY,
      NEEDS_HUMAN,
      AGENT_APPROVED,
    ],
  };
}

function issueMention(body: string): AgentAction {
  return {
    kind: "comment",
    target: "issue",
    pullNumber: null,
    mention: true,
    body,
  };
}

function clickup(markerName: string, text: string): AgentAction {
  return { kind: "clickup", marker: markerName, text };
}

function tebabotPlanComment(planId: number): string {
  return [
    "@tebabot Revisá el plan de este issue. Si lo aprobás, empezá el comentario con APPROVED. Si pedís cambios, empezá con CHANGES.",
    "",
    marker(`ask-tebabot-plan:${planId}`),
  ].join("\n");
}

function revisePlanComment(reviewId: number): string {
  return [
    "@cursor Ajustá el plan según la revisión. Solo plan y diseño, sin código. Empezá el comentario con PLAN.",
    "",
    marker(`ask-cursor-revise-plan:${reviewId}`),
  ].join("\n");
}

function buildComment(issueNumber: number): string {
  return [
    `@cursor Implementá el plan aprobado. Abrí un pull request y poné en el cuerpo Closes #${issueNumber}. No mergees.`,
    "",
    marker("ask-cursor-build"),
  ].join("\n");
}

function tebabotPullComment(pullNumber: number, sha: string): string {
  return [
    `@tebabot Revisá el pull request #${pullNumber}. Si lo aprobás, empezá el comentario con APPROVED o dejá una review en estado APPROVED. Si pedís cambios, empezá con CHANGES.`,
    "",
    marker(`ask-tebabot-pr:${sha}`),
  ].join("\n");
}

function revisePullComment(
  pullNumber: number,
  sha: string,
  reason: string,
): string {
  return [
    `@cursor Corregí el pull request #${pullNumber}: CI o la revisión no están en verde. No mergees.`,
    "",
    marker(`ask-cursor-revise-pr:${sha}:${reason}`),
  ].join("\n");
}

function readyComment(pullNumber: number, sha: string): string {
  return [
    `CI está en verde y tebabot aprobó el pull request #${pullNumber}. El merge lo decide el ruleset de main. No hay auto-merge.`,
    "",
    marker(`ready-for-merge:${sha}`),
  ].join("\n");
}
