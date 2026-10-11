import {
  AGENT_BUILDING,
  AGENT_PLAN,
  AGENT_PLAN_REVIEW,
  AGENT_READY,
  type AgentAction,
  type AgentSnapshot,
  decide,
  NEEDS_HUMAN,
  planRequestComment,
} from "./agent.ts";
import { ClickupClient } from "./clickup.ts";
import { AGENT_MENTION_WARNING } from "./guard.ts";
import { GithubClient, type GithubIssue, type PullDetails } from "./github.ts";
import { HttpStatusError } from "./http.ts";
import { parseClickupTaskId } from "./marker.ts";
import {
  parseRepository,
  referencedIssueNumbers,
  type RepositoryName,
} from "./references.ts";

const PHASE_LABELS: readonly string[] = [
  AGENT_PLAN,
  AGENT_PLAN_REVIEW,
  AGENT_READY,
  AGENT_BUILDING,
  NEEDS_HUMAN,
];

export async function postInitialPlanRequest(
  issueNumber: number,
  repo: { owner: string; name: string },
  dryRun: boolean,
): Promise<void> {
  const token = Deno.env.get("AGENT_MENTION_TOKEN")?.trim() ?? "";
  if (token.length === 0) {
    console.log(`::warning::${AGENT_MENTION_WARNING}`);
    return;
  }
  const mention = new GithubClient(token, repo, { dryRun });
  try {
    await mention.createComment(issueNumber, planRequestComment(issueNumber));
  } catch (error) {
    const status = error instanceof HttpStatusError ? error.status : 0;
    console.warn(
      `issue=#${issueNumber} no se pudo publicar la mención de plan (${status})`,
    );
  }
}

export async function runAgent(options: { dryRun: boolean }): Promise<void> {
  const githubToken = Deno.env.get("GITHUB_TOKEN")?.trim() ?? "";
  const mentionToken = Deno.env.get("AGENT_MENTION_TOKEN")?.trim() ?? "";
  if (githubToken.length === 0) {
    throw new Error("GITHUB_TOKEN no está configurado");
  }
  if (mentionToken.length === 0) {
    console.log(`::warning::${AGENT_MENTION_WARNING}`);
    return;
  }
  const repo = parseRepository(
    Deno.env.get("GITHUB_REPOSITORY")?.trim() || "sinequix/enrailar",
  );
  const github = new GithubClient(githubToken, repo, {
    dryRun: options.dryRun,
  });
  const mention = new GithubClient(mentionToken, repo, {
    dryRun: options.dryRun,
  });
  const clickupToken = Deno.env.get("CLICKUP_API_TOKEN")?.trim() ?? "";
  const clickup = clickupToken.length > 0
    ? new ClickupClient(clickupToken, { dryRun: options.dryRun })
    : null;
  if (!clickup) {
    console.log(
      "::warning::CLICKUP_API_TOKEN no está configurado. Las transiciones no se comentan en ClickUp.",
    );
  }

  const event = Deno.env.get("EVENT_NAME")?.trim() ?? "";
  const rawNumber = Deno.env.get("ISSUE_NUMBER")?.trim() ?? "";
  if (event === "workflow_dispatch") {
    await scan(github, mention, clickup, repo);
    return;
  }
  if (!/^\d+$/.test(rawNumber)) {
    console.log("sin número de issue ni de pull request");
    return;
  }
  await route(github, mention, clickup, repo, Number(rawNumber));
}

async function scan(
  github: GithubClient,
  mention: GithubClient,
  clickup: ClickupClient | null,
  repo: RepositoryName,
): Promise<void> {
  const failures: number[] = [];
  for (const issue of await github.listIssues()) {
    if (!participates(issue)) continue;
    try {
      const pull = await selectPull(github, repo, issue.number);
      await orchestrate(github, mention, clickup, issue, pull);
    } catch (error) {
      failures.push(issue.number);
      console.error(`issue=#${issue.number} error`);
      if (error instanceof HttpStatusError && error.status === 401) throw error;
    }
  }
  if (failures.length > 0) {
    throw new Error(`Falló la orquestación de ${failures.length} issues`);
  }
}

async function route(
  github: GithubClient,
  mention: GithubClient,
  clickup: ClickupClient | null,
  repo: { owner: string; name: string },
  number: number,
): Promise<void> {
  const issue = await github.getIssue(number);
  if (!issue.isPullRequest) {
    if (!participates(issue)) {
      console.log(`issue=#${number} fuera del flujo`);
      return;
    }
    const pull = await selectPull(github, repo, issue.number);
    await orchestrate(github, mention, clickup, issue, pull);
    return;
  }

  const pull = await github.getPullDetails(number);
  const linked = new Set<number>([
    ...await github.closingIssueNumbers(number),
    ...referencedIssueNumbers(`${pull.title}\n${pull.body}`, repo),
  ]);
  let ran = false;
  for (const issueNumber of linked) {
    if (issueNumber === number) continue;
    const target = await github.getIssue(issueNumber);
    if (target.isPullRequest || !participates(target)) continue;
    await orchestrate(github, mention, clickup, target, pull);
    ran = true;
  }
  if (!ran) console.log(`pr=#${number} sin issue del flujo`);
}

async function selectPull(
  github: GithubClient,
  repo: RepositoryName,
  issueNumber: number,
): Promise<PullDetails | null> {
  const linked = await github.linkedPullRequests(issueNumber);
  const open = linked.filter((pull) => pull.state === "open");
  const details: PullDetails[] = [];
  for (const pull of open) {
    details.push(await github.getPullDetails(pull.number));
  }
  if (details.length === 0) return null;
  const referencing = details.filter((pull) =>
    referencedIssueNumbers(`${pull.title}\n${pull.body}`, repo).includes(
      issueNumber,
    )
  );
  const pool = referencing.length > 0 ? referencing : details;
  pool.sort((a, b) => b.number - a.number);
  return pool[0] ?? null;
}

async function orchestrate(
  github: GithubClient,
  mention: GithubClient,
  clickup: ClickupClient | null,
  issue: GithubIssue,
  pull: PullDetails | null,
): Promise<void> {
  const snapshot = await snapshotFor(github, issue, pull);
  const actions = decide(snapshot);
  if (actions.length === 0) {
    console.log(`issue=#${issue.number} sin cambios`);
    return;
  }
  for (const action of actions) {
    await applyAction(github, mention, clickup, issue, action);
  }
}

async function snapshotFor(
  github: GithubClient,
  issue: GithubIssue,
  pull: PullDetails | null,
): Promise<AgentSnapshot> {
  const issueComments = await github.listComments(issue.number);
  if (
    !pull || pull.state !== "open" || !/^[0-9a-f]{7,40}$/i.test(pull.headSha)
  ) {
    return {
      issueNumber: issue.number,
      issueState: issue.state,
      labels: issue.labels,
      issueComments,
      pull: null,
    };
  }
  return {
    issueNumber: issue.number,
    issueState: issue.state,
    labels: issue.labels,
    issueComments,
    pull: {
      number: pull.number,
      headSha: pull.headSha,
      comments: await github.listComments(pull.number),
      reviews: await github.listReviews(pull.number),
      ci: await github.ciState(pull.headSha),
    },
  };
}

async function applyAction(
  github: GithubClient,
  mention: GithubClient,
  clickup: ClickupClient | null,
  issue: GithubIssue,
  action: AgentAction,
): Promise<void> {
  switch (action.kind) {
    case "labels":
      console.log(`issue=#${issue.number} action=labels`);
      if (action.add.length > 0) {
        await github.addLabels(issue.number, action.add);
      }
      for (const name of action.remove) {
        await github.removeLabel(issue.number, name);
      }
      return;
    case "comment": {
      const number = action.target === "pull"
        ? action.pullNumber ?? issue.number
        : issue.number;
      const client = action.mention ? mention : github;
      console.log(
        `issue=#${issue.number} action=comment target=${action.target} mention=${action.mention}`,
      );
      await client.createComment(number, action.body);
      return;
    }
    case "clickup":
      await postClickup(clickup, issue.body, action.marker, action.text);
      return;
    default: {
      const unexpected: never = action;
      throw new Error(`acción no manejada: ${JSON.stringify(unexpected)}`);
    }
  }
}

async function postClickup(
  clickup: ClickupClient | null,
  issueBody: string,
  markerName: string,
  text: string,
): Promise<void> {
  if (!clickup) return;
  const taskId = parseClickupTaskId(issueBody);
  if (!taskId) {
    console.log(`sin tarea de ClickUp para ${markerName}`);
    return;
  }
  const needle = `agent-orch-clickup:${markerName}`;
  const comments = await clickup.comments(taskId);
  if (comments.some((comment) => comment.text.includes(needle))) return;
  console.log(`task=${taskId} action=comment marker=${markerName}`);
  await clickup.createComment(taskId, `${text}\n\n<!-- ${needle} -->`);
}

function participates(issue: GithubIssue): boolean {
  if (issue.state !== "open" || issue.isPullRequest) return false;
  return issue.labels.some((label) => PHASE_LABELS.includes(label));
}
