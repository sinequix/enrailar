const ISSUE_REF =
  /(?:^|[^\w./])(?:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+))?#(\d+)\b/g;

export type RepositoryName = {
  owner: string;
  name: string;
};

export function parseRepository(value: string): RepositoryName {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(value.trim());
  if (!match?.[1] || !match[2]) {
    throw new Error("GITHUB_REPOSITORY tiene que ser owner/name");
  }
  return { owner: match[1], name: match[2] };
}

export function referencedIssueNumbers(
  text: string,
  repo: RepositoryName,
): number[] {
  const found = new Set<number>();
  for (const match of text.matchAll(ISSUE_REF)) {
    const owner = match[1];
    const name = match[2];
    const number = Number(match[3]);
    if (owner && name) {
      if (owner.toLowerCase() !== repo.owner.toLowerCase()) continue;
      if (name.toLowerCase() !== repo.name.toLowerCase()) continue;
    }
    if (Number.isInteger(number) && number > 0) found.add(number);
  }
  return [...found];
}

export function nextLink(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const match = /<([^>]+)>;\s*rel="next"/.exec(part);
    if (match?.[1]) return match[1];
  }
  return null;
}
