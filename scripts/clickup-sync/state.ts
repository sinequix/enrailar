export const STATUS_CANDIDATES = {
  todo: [
    "to do",
    "por hacer",
    "idea",
    "planificada",
    "identificado",
    "pendiente",
    "objetivo",
    "detectada",
    "preinscripto",
  ],
  inProgress: [
    "in progress",
    "en curso",
    "pr abierto",
    "en preparación",
    "priorizada",
    "asignada a agente",
  ],
  complete: [
    "complete",
    "hecha",
    "mergeada",
    "publicado",
    "listo",
    "comunicada",
    "participó",
    "cerrada",
  ],
  notPlanned: [
    "cancelled",
    "closed",
    "descartada",
    "descartado",
    "no avanza",
    "no comunicable",
    "no contactar",
    "perdida",
  ],
} as const;

export type AvailableStatus = {
  status: string;
  type?: string;
};

export type CloseReason =
  | "completed"
  | "not_planned"
  | "duplicate"
  | "reopened"
  | null;

export type StatusBucket = "todo" | "in_progress" | "complete" | "not_planned";

export type PullRequestRef = {
  number: number;
  state: "open" | "closed";
  merged: boolean;
  draft: boolean;
  url: string;
};

/** Una PR vista desde un issue. `closes` es true solo si ese issue está en closingIssuesReferences. */
export type LinkedPullRequest = PullRequestRef & {
  closes: boolean;
};

export type StatusInput = {
  issueState: "open" | "closed";
  stateReason: CloseReason;
  pullRequests: readonly LinkedPullRequest[];
};

export type StatusResolution =
  | { bucket: StatusBucket; kind: "status"; status: string }
  | { bucket: StatusBucket; kind: "missing"; wanted: readonly string[] };

export type InitialIssueClose = "open" | "completed" | "not_planned";

export function normalizeCloseReason(
  value: string | null | undefined,
): CloseReason {
  switch (value) {
    case "completed":
    case "not_planned":
    case "duplicate":
    case "reopened":
      return value;
    case null:
    case undefined:
      return null;
    default:
      return "completed";
  }
}

export function statusBucket(input: StatusInput): StatusBucket {
  if (input.issueState === "closed") {
    switch (input.stateReason) {
      case "not_planned":
      case "duplicate":
        return "not_planned";
      case "completed":
      case "reopened":
      case null:
        return "complete";
      default: {
        const unexpected: never = input.stateReason;
        throw new Error(`estado no manejado: ${String(unexpected)}`);
      }
    }
  }

  if (input.pullRequests.some((pullRequest) => pullRequest.state === "open")) {
    return "in_progress";
  }
  if (
    input.pullRequests.some((pullRequest) =>
      pullRequest.merged && pullRequest.closes
    )
  ) {
    return "complete";
  }
  return "todo";
}

export function mergeLinkedPullRequests(
  fromApi: readonly LinkedPullRequest[],
  extra: readonly LinkedPullRequest[],
): LinkedPullRequest[] {
  const byNumber = new Map<number, LinkedPullRequest>();
  for (const pullRequest of fromApi) {
    byNumber.set(pullRequest.number, pullRequest);
  }
  for (const pullRequest of extra) {
    const previous = byNumber.get(pullRequest.number);
    byNumber.set(pullRequest.number, {
      ...pullRequest,
      closes: pullRequest.closes || previous?.closes === true,
    });
  }
  return [...byNumber.values()];
}

export function resolveClickupStatus(
  input: StatusInput,
  available: readonly (string | AvailableStatus)[],
): StatusResolution {
  const bucket = statusBucket(input);
  const wanted = candidatesFor(bucket);
  const options = normalizeAvailable(available);
  const named = findNamedStatus(wanted, options, bucket);
  if (named) return { bucket, kind: "status", status: named };
  const fallback = fallbackStatus(bucket, options);
  if (fallback) return { bucket, kind: "status", status: fallback };
  return { bucket, kind: "missing", wanted };
}

export function initialGithubClose(
  statusName: string,
  statusType: string,
): InitialIssueClose {
  const type = statusType.trim().toLowerCase();
  if (type !== "closed" && type !== "done") return "open";
  if (isNotPlannedName(statusName)) return "not_planned";
  return "completed";
}

function candidatesFor(bucket: StatusBucket): readonly string[] {
  switch (bucket) {
    case "todo":
      return STATUS_CANDIDATES.todo;
    case "in_progress":
      return STATUS_CANDIDATES.inProgress;
    case "complete":
      return STATUS_CANDIDATES.complete;
    case "not_planned":
      return STATUS_CANDIDATES.notPlanned;
    default: {
      const unexpected: never = bucket;
      throw new Error(`bucket no manejado: ${String(unexpected)}`);
    }
  }
}

type NormalizedStatus = { status: string; type: string };

function normalizeAvailable(
  available: readonly (string | AvailableStatus)[],
): NormalizedStatus[] {
  const options: NormalizedStatus[] = [];
  for (const item of available) {
    if (typeof item === "string") {
      const status = item.trim();
      if (status.length > 0) options.push({ status, type: "" });
      continue;
    }
    const status = item.status.trim();
    if (status.length === 0) continue;
    options.push({ status, type: item.type?.trim().toLowerCase() ?? "" });
  }
  return options;
}

function findNamedStatus(
  candidates: readonly string[],
  options: readonly NormalizedStatus[],
  bucket: StatusBucket,
): string | null {
  const byName = new Map<string, NormalizedStatus[]>();
  for (const option of options) {
    const key = normalizeStatus(option.status);
    const list = byName.get(key) ?? [];
    list.push(option);
    byName.set(key, list);
  }
  for (const candidate of candidates) {
    const found = byName.get(normalizeStatus(candidate));
    if (!found) continue;
    for (const option of found) {
      if (typeAllows(bucket, option.type)) return option.status;
    }
  }
  return null;
}

function fallbackStatus(
  bucket: StatusBucket,
  options: readonly NormalizedStatus[],
): string | null {
  if (!options.some((option) => option.type.length > 0)) return null;
  switch (bucket) {
    case "todo":
      return firstType(options, ["open", "unstarted"]);
    case "in_progress":
      return null;
    case "complete": {
      const done = options.find((option) =>
        option.type === "done" && !isNotPlannedName(option.status)
      );
      if (done) return done.status;
      const closed = options.filter((option) =>
        option.type === "closed" && !isNotPlannedName(option.status)
      );
      if (closed.length === 1) return closed[0]?.status ?? null;
      return null;
    }
    case "not_planned":
      return null;
    default: {
      const unexpected: never = bucket;
      throw new Error(`bucket no manejado: ${String(unexpected)}`);
    }
  }
}

function firstType(
  options: readonly NormalizedStatus[],
  types: readonly string[],
): string | null {
  for (const type of types) {
    const found = options.find((option) => option.type === type);
    if (found) return found.status;
  }
  return null;
}

function typeAllows(bucket: StatusBucket, type: string): boolean {
  if (type.length === 0) return true;
  switch (bucket) {
    case "todo":
      return type === "open" || type === "unstarted";
    case "in_progress":
      return type === "custom";
    case "complete":
      return type === "done" || type === "closed";
    case "not_planned":
      return type === "closed";
    default: {
      const unexpected: never = bucket;
      throw new Error(`bucket no manejado: ${String(unexpected)}`);
    }
  }
}

function isNotPlannedName(status: string): boolean {
  const name = normalizeStatus(status);
  return STATUS_CANDIDATES.notPlanned.some((candidate) => candidate === name);
}

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase();
}
