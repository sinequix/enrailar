import { HttpStatusError, readJson, sendWithRetry } from "./http.ts";
import { asArray, asRecord, asString, idString } from "./json.ts";
import { LABEL_COLORS, LABEL_DESCRIPTIONS } from "./labels.ts";
import { nextLink, type RepositoryName } from "./references.ts";
import { normalizeCloseReason, type PullRequestRef } from "./state.ts";

const API = "https://api.github.com";

export type GithubIssue = {
  id: number;
  number: number;
  title: string;
  body: string;
  state: "open" | "closed";
  stateReason: ReturnType<typeof normalizeCloseReason>;
  htmlUrl: string;
  labels: string[];
  assignees: string[];
  isPullRequest: boolean;
};

export type GithubComment = {
  id: number;
  author: string;
  body: string;
};

export type PullReview = {
  id: number;
  author: string;
  state: string;
};

export type PullDetails = PullRequestRef & {
  title: string;
  body: string;
  headSha: string;
};

export type CiState = "pending" | "success" | "failure";

export type CreateIssueInput = {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
};

export class GithubClient {
  #token: string;
  #repo: RepositoryName;
  #dryRun: boolean;
  #fetch: typeof fetch;
  #pulls = new Map<number, PullRequestRef>();

  constructor(
    token: string,
    repo: RepositoryName,
    options: { dryRun?: boolean; fetchImpl?: typeof fetch } = {},
  ) {
    this.#token = token;
    this.#repo = repo;
    this.#dryRun = options.dryRun ?? false;
    this.#fetch = options.fetchImpl ?? fetch;
  }

  async listIssues(): Promise<GithubIssue[]> {
    const issues: GithubIssue[] = [];
    const seen = new Set<string>();
    let url: string | null =
      `${API}/repos/${this.#slug}/issues?state=all&per_page=100`;
    while (url && !seen.has(url)) {
      seen.add(url);
      const { payload, next } = await this.#getPage(url);
      for (const raw of asArray(payload)) {
        const record = asRecord(raw);
        if (!record || record.pull_request) continue;
        const issue = parseIssue(record);
        if (issue) issues.push(issue);
      }
      url = next;
    }
    return issues;
  }

  async getIssue(number: number): Promise<GithubIssue> {
    const payload = await this.#get(
      `${API}/repos/${this.#slug}/issues/${number}`,
    );
    const issue = parseIssue(asRecord(payload));
    if (!issue) throw new Error(`GitHub no devolvió el issue #${number}`);
    return issue;
  }

  async createIssue(input: CreateIssueInput): Promise<GithubIssue> {
    for (const label of input.labels) {
      await this.ensureLabel(label);
    }
    if (this.#dryRun) {
      console.log("dry-run action=create-issue");
      return {
        id: 0,
        number: 0,
        title: input.title,
        body: input.body,
        state: "open",
        stateReason: null,
        htmlUrl: "",
        labels: input.labels,
        assignees: input.assignees,
        isPullRequest: false,
      };
    }
    const payload: Record<string, unknown> = {
      title: input.title,
      body: input.body,
      labels: input.labels,
    };
    if (input.assignees.length > 0) payload.assignees = input.assignees;
    try {
      const created = parseIssue(
        asRecord(
          await this.#send(
            "POST",
            `${API}/repos/${this.#slug}/issues`,
            payload,
          ),
        ),
      );
      if (!created) throw new Error("GitHub no devolvió el issue creado");
      return created;
    } catch (error) {
      if (
        !(error instanceof HttpStatusError) || error.status !== 422 ||
        input.assignees.length === 0
      ) {
        throw error;
      }
      console.warn("GitHub rechazó los asignados. Se crea el issue sin ellos.");
      const created = parseIssue(
        asRecord(
          await this.#send("POST", `${API}/repos/${this.#slug}/issues`, {
            title: input.title,
            body: input.body,
            labels: input.labels,
          }),
        ),
      );
      if (!created) throw new Error("GitHub no devolvió el issue creado");
      return created;
    }
  }

  async updateIssue(
    number: number,
    patch: {
      state?: "open" | "closed";
      stateReason?: "completed" | "not_planned";
      body?: string;
    },
  ): Promise<void> {
    if (this.#dryRun) {
      console.log(`dry-run issue=#${number} action=update-issue`);
      return;
    }
    const body: Record<string, unknown> = {};
    if (patch.state) body.state = patch.state;
    if (patch.stateReason) body.state_reason = patch.stateReason;
    if (patch.body !== undefined) body.body = patch.body;
    await this.#send(
      "PATCH",
      `${API}/repos/${this.#slug}/issues/${number}`,
      body,
    );
  }

  async ensureLabel(name: string): Promise<void> {
    if (this.#dryRun) return;
    const encoded = encodeURIComponent(name);
    try {
      await this.#send("GET", `${API}/repos/${this.#slug}/labels/${encoded}`);
    } catch (error) {
      if (!(error instanceof HttpStatusError) || error.status !== 404) {
        throw error;
      }
      try {
        await this.#send("POST", `${API}/repos/${this.#slug}/labels`, {
          name,
          color: LABEL_COLORS[name] ?? "ededed",
          description: LABEL_DESCRIPTIONS[name] ?? "",
        });
      } catch (createError) {
        if (
          createError instanceof HttpStatusError && createError.status === 422
        ) return;
        throw createError;
      }
    }
  }

  async addSubIssue(
    parentNumber: number,
    childId: number,
  ): Promise<"ok" | "unsupported"> {
    if (this.#dryRun) {
      console.log(`dry-run issue=#${parentNumber} action=add-sub-issue`);
      return "ok";
    }
    const response = await sendWithRetry(
      () =>
        this.#fetch(
          `${API}/repos/${this.#slug}/issues/${parentNumber}/sub_issues`,
          {
            method: "POST",
            headers: this.#headers(),
            body: JSON.stringify({ sub_issue_id: childId }),
          },
        ),
      "GitHub",
    );
    if (
      response.status === 201 || response.status === 200 ||
      response.status === 204
    ) {
      await response.body?.cancel();
      return "ok";
    }
    const text = await response.text();
    if (response.status === 422 && /already/i.test(text)) return "ok";
    if (response.status === 404 || response.status === 410) {
      return "unsupported";
    }
    throw new HttpStatusError(
      response.status,
      `GitHub POST sub_issues → ${response.status}`,
    );
  }

  async linkedPullRequests(issueNumber: number): Promise<PullRequestRef[]> {
    const numbers = new Set<number>();
    const seen = new Set<string>();
    let url: string | null =
      `${API}/repos/${this.#slug}/issues/${issueNumber}/timeline?per_page=100`;
    while (url && !seen.has(url)) {
      seen.add(url);
      const { payload, next } = await this.#getPage(url, {
        Accept: "application/vnd.github+json",
      });
      for (const raw of asArray(payload)) {
        const number = pullNumberFromTimeline(asRecord(raw));
        if (number) numbers.add(number);
      }
      url = next;
    }
    const pullRequests: PullRequestRef[] = [];
    for (const number of numbers) {
      pullRequests.push(await this.getPullRequest(number));
    }
    return pullRequests;
  }

  async closingIssueNumbers(pullNumber: number): Promise<number[]> {
    const query = `
      query($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          pullRequest(number: $number) {
            closingIssuesReferences(first: 100) {
              nodes { number }
            }
          }
        }
      }
    `;
    const payload = await this.#send("POST", `${API}/graphql`, {
      query,
      variables: {
        owner: this.#repo.owner,
        name: this.#repo.name,
        number: pullNumber,
      },
    });
    if (asArray(asRecord(payload)?.errors).length > 0) {
      console.warn(`pr=#${pullNumber} sin lista de issues de cierre`);
      return [];
    }
    const repository = asRecord(asRecord(payload)?.data);
    const pullRequest = asRecord(asRecord(repository?.repository)?.pullRequest);
    const connection = asRecord(pullRequest?.closingIssuesReferences);
    const numbers: number[] = [];
    for (const node of asArray(connection?.nodes)) {
      const number = idString(asRecord(node)?.number);
      if (number && /^\d+$/.test(number)) numbers.push(Number(number));
    }
    return numbers;
  }

  async getPullRequest(number: number): Promise<PullRequestRef> {
    const cached = this.#pulls.get(number);
    if (cached) return cached;
    const payload = asRecord(
      await this.#get(`${API}/repos/${this.#slug}/pulls/${number}`),
    );
    const pullRequest: PullRequestRef = {
      number,
      state: payload?.state === "closed" ? "closed" : "open",
      merged: payload?.merged === true,
      draft: payload?.draft === true,
      url: asString(payload?.html_url) ??
        `https://github.com/${this.#slug}/pull/${number}`,
    };
    this.#pulls.set(number, pullRequest);
    return pullRequest;
  }

  rememberPullRequest(pullRequest: PullRequestRef): void {
    this.#pulls.set(pullRequest.number, pullRequest);
  }

  async listComments(number: number): Promise<GithubComment[]> {
    const comments: GithubComment[] = [];
    const seen = new Set<string>();
    let url: string | null =
      `${API}/repos/${this.#slug}/issues/${number}/comments?per_page=100`;
    while (url && !seen.has(url)) {
      seen.add(url);
      const { payload, next } = await this.#getPage(url);
      for (const raw of asArray(payload)) {
        const comment = parseComment(asRecord(raw));
        if (comment) comments.push(comment);
      }
      url = next;
    }
    return comments;
  }

  async createComment(number: number, body: string): Promise<void> {
    if (this.#dryRun) {
      console.log(`dry-run issue=#${number} action=create-comment`);
      return;
    }
    await this.#send(
      "POST",
      `${API}/repos/${this.#slug}/issues/${number}/comments`,
      { body },
    );
  }

  async addLabels(number: number, names: readonly string[]): Promise<void> {
    if (names.length === 0) return;
    for (const name of names) await this.ensureLabel(name);
    if (this.#dryRun) {
      console.log(`dry-run issue=#${number} action=add-labels`);
      return;
    }
    await this.#send(
      "POST",
      `${API}/repos/${this.#slug}/issues/${number}/labels`,
      { labels: [...names] },
    );
  }

  async removeLabel(number: number, name: string): Promise<void> {
    if (this.#dryRun) {
      console.log(`dry-run issue=#${number} action=remove-label`);
      return;
    }
    try {
      await this.#send(
        "DELETE",
        `${API}/repos/${this.#slug}/issues/${number}/labels/${
          encodeURIComponent(name)
        }`,
      );
    } catch (error) {
      if (error instanceof HttpStatusError && error.status === 404) return;
      throw error;
    }
  }

  async getPullDetails(number: number): Promise<PullDetails> {
    const payload = asRecord(
      await this.#get(`${API}/repos/${this.#slug}/pulls/${number}`),
    );
    const head = asRecord(payload?.head);
    const details: PullDetails = {
      number,
      state: payload?.state === "closed" ? "closed" : "open",
      merged: payload?.merged === true,
      draft: payload?.draft === true,
      url: asString(payload?.html_url) ??
        `https://github.com/${this.#slug}/pull/${number}`,
      title: asString(payload?.title) ?? "",
      body: asString(payload?.body) ?? "",
      headSha: asString(head?.sha) ?? "",
    };
    this.#pulls.set(number, {
      number: details.number,
      state: details.state,
      merged: details.merged,
      draft: details.draft,
      url: details.url,
    });
    return details;
  }

  async listReviews(number: number): Promise<PullReview[]> {
    const reviews: PullReview[] = [];
    const seen = new Set<string>();
    let url: string | null =
      `${API}/repos/${this.#slug}/pulls/${number}/reviews?per_page=100`;
    while (url && !seen.has(url)) {
      seen.add(url);
      const { payload, next } = await this.#getPage(url);
      for (const raw of asArray(payload)) {
        const review = parseReview(asRecord(raw));
        if (review) reviews.push(review);
      }
      url = next;
    }
    return reviews;
  }

  async ciState(sha: string): Promise<CiState> {
    if (!/^[0-9a-f]{7,40}$/i.test(sha)) return "pending";
    const runs = await this.#checkRuns(sha);
    if (runs.length > 0) return summarizeChecks(runs);
    const status = asRecord(
      await this.#get(
        `${API}/repos/${this.#slug}/commits/${sha}/status`,
      ),
    );
    const state = asString(status?.state);
    switch (state) {
      case "success":
        return "success";
      case "failure":
      case "error":
        return "failure";
      case "pending":
        return "pending";
      default:
        return "pending";
    }
  }

  async #checkRuns(
    sha: string,
  ): Promise<{ status: string; conclusion: string | null }[]> {
    const runs: { status: string; conclusion: string | null }[] = [];
    const seen = new Set<string>();
    let url: string | null =
      `${API}/repos/${this.#slug}/commits/${sha}/check-runs?per_page=100`;
    while (url && !seen.has(url)) {
      seen.add(url);
      const { payload, next } = await this.#getPage(url);
      for (const raw of asArray(asRecord(payload)?.check_runs)) {
        const record = asRecord(raw);
        const status = asString(record?.status);
        if (!status) continue;
        runs.push({
          status,
          conclusion: asString(record?.conclusion),
        });
      }
      url = next;
    }
    return runs;
  }

  get #slug(): string {
    return `${this.#repo.owner}/${this.#repo.name}`;
  }

  async #get(url: string): Promise<unknown> {
    const { payload } = await this.#getPage(url);
    return payload;
  }

  async #getPage(
    url: string,
    extraHeaders: Record<string, string> = {},
  ): Promise<{ payload: unknown; next: string | null }> {
    const response = await sendWithRetry(
      () =>
        this.#fetch(url, { headers: { ...this.#headers(), ...extraHeaders } }),
      "GitHub",
    );
    const payload = await readJson(response, `GitHub GET ${pathOf(url)}`);
    return { payload, next: nextLink(response.headers.get("link")) };
  }

  async #send(method: string, url: string, body?: unknown): Promise<unknown> {
    const response = await sendWithRetry(
      () =>
        this.#fetch(url, {
          method,
          headers: this.#headers(),
          body: body === undefined ? undefined : JSON.stringify(body),
        }),
      "GitHub",
    );
    return await readJson(response, `GitHub ${method} ${pathOf(url)}`);
  }

  #headers(): Record<string, string> {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${this.#token}`,
      "Content-Type": "application/json",
      "User-Agent": "enrailar-clickup-sync",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }
}

function parseIssue(
  record: Record<string, unknown> | null,
): GithubIssue | null {
  if (!record) return null;
  const id = idString(record.id);
  const number = idString(record.number);
  if (!id || !number) return null;
  const state = record.state === "closed" ? "closed" : "open";
  return {
    id: Number(id),
    number: Number(number),
    title: asString(record.title) ?? "",
    body: asString(record.body) ?? "",
    state,
    stateReason: normalizeCloseReason(asString(record.state_reason)),
    htmlUrl: asString(record.html_url) ?? "",
    labels: parseLabels(record.labels),
    assignees: parseLogins(record.assignees),
    isPullRequest: record.pull_request != null,
  };
}

function parseComment(
  record: Record<string, unknown> | null,
): GithubComment | null {
  if (!record) return null;
  const id = idString(record.id);
  if (!id || !/^\d+$/.test(id)) return null;
  const user = asRecord(record.user);
  return {
    id: Number(id),
    author: asString(user?.login) ?? "",
    body: asString(record.body) ?? "",
  };
}

function parseReview(
  record: Record<string, unknown> | null,
): PullReview | null {
  if (!record) return null;
  const id = idString(record.id);
  if (!id || !/^\d+$/.test(id)) return null;
  const user = asRecord(record.user);
  return {
    id: Number(id),
    author: asString(user?.login) ?? "",
    state: asString(record.state) ?? "",
  };
}

function summarizeChecks(
  runs: readonly { status: string; conclusion: string | null }[],
): CiState {
  if (runs.some((run) => run.status !== "completed")) return "pending";
  const failed = new Set([
    "failure",
    "timed_out",
    "cancelled",
    "action_required",
    "stale",
  ]);
  if (runs.some((run) => run.conclusion && failed.has(run.conclusion))) {
    return "failure";
  }
  if (runs.some((run) => run.conclusion === "success")) return "success";
  return "pending";
}

function parseLabels(value: unknown): string[] {
  const labels: string[] = [];
  for (const raw of asArray(value)) {
    const name = asString(raw) ?? asString(asRecord(raw)?.name);
    if (name) labels.push(name);
  }
  return labels;
}

function parseLogins(value: unknown): string[] {
  const logins: string[] = [];
  for (const raw of asArray(value)) {
    const login = asString(asRecord(raw)?.login);
    if (login && !login.includes("@")) logins.push(login);
  }
  return logins;
}

function pullNumberFromTimeline(
  record: Record<string, unknown> | null,
): number | null {
  if (!record) return null;
  const event = asString(record.event);
  if (event !== "cross-referenced" && event !== "connected") return null;
  const source = asRecord(record.source);
  const issue = asRecord(source?.issue);
  if (!issue?.pull_request) return null;
  const number = idString(issue.number);
  if (!number || !/^\d+$/.test(number)) return null;
  return Number(number);
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
