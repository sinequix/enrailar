export const STATUS_CANDIDATES = {
  todo: ["to do"],
  inProgress: ["in progress"],
  complete: ["complete"],
  notPlanned: ["cancelled", "closed"],
} as const;

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

export type StatusInput = {
  issueState: "open" | "closed";
  stateReason: CloseReason;
  pullRequests: readonly PullRequestRef[];
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
  if (input.pullRequests.some((pullRequest) => pullRequest.merged)) {
    return "complete";
  }
  return "todo";
}

export function resolveClickupStatus(
  input: StatusInput,
  available: readonly string[],
): StatusResolution {
  const bucket = statusBucket(input);
  const wanted = candidatesFor(bucket);
  const status = findStatus(wanted, available);
  if (status) return { bucket, kind: "status", status };
  return { bucket, kind: "missing", wanted };
}

export function initialGithubClose(
  statusName: string,
  statusType: string,
): InitialIssueClose {
  const type = statusType.trim().toLowerCase();
  if (type !== "closed" && type !== "done") return "open";
  const name = statusName.trim().toLowerCase();
  if (name === "cancelled" || name === "closed") return "not_planned";
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

function findStatus(
  candidates: readonly string[],
  available: readonly string[],
): string | null {
  const byName = new Map(
    available.map((status) => [normalizeStatus(status), status]),
  );
  for (const candidate of candidates) {
    const found = byName.get(normalizeStatus(candidate));
    if (found) return found;
  }
  return null;
}

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase();
}
