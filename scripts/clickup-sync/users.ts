export type UserLink = {
  clickupUserId: string;
  clickupUsername: string;
  githubLogin: string;
};

export type ClickupPerson = {
  id: string;
  username: string;
};

const EMAIL_KEYS = ["email", "clickupEmail", "githubEmail"];

export function parseUserMap(
  raw: unknown,
): { users: UserLink[]; skipped: number } {
  if (typeof raw !== "object" || raw === null || !("users" in raw)) {
    throw new Error("user-map.json tiene que tener un arreglo users");
  }
  const users = (raw as { users: unknown }).users;
  if (!Array.isArray(users)) {
    throw new Error("users tiene que ser un arreglo");
  }
  const links: UserLink[] = [];
  let skipped = 0;
  for (const entry of users) {
    const link = parseLink(entry);
    if (link) links.push(link);
    else skipped += 1;
  }
  return { users: links, skipped };
}

export function githubLoginFor(
  users: readonly UserLink[],
  person: ClickupPerson,
): string | null {
  const byId = users.find((user) => user.clickupUserId === person.id);
  if (byId) return byId.githubLogin;
  const username = person.username.trim().toLowerCase();
  if (username.length === 0 || username.includes("@")) return null;
  const byUsername = users.find((user) =>
    user.clickupUsername.trim().toLowerCase() === username
  );
  return byUsername?.githubLogin ?? null;
}

export function clickupIdFor(
  users: readonly UserLink[],
  login: string,
): string | null {
  const normalized = login.trim().toLowerCase();
  if (normalized.length === 0 || normalized.includes("@")) return null;
  const found = users.find((user) =>
    user.githubLogin.trim().toLowerCase() === normalized
  );
  return found?.clickupUserId ?? null;
}

export function assigneePatch(
  users: readonly UserLink[],
  clickupAssignees: readonly ClickupPerson[],
  githubLogins: readonly string[],
): { add: string[]; rem: string[]; unmapped: string[] } {
  const desired = new Set<string>();
  const unmapped: string[] = [];
  for (const login of githubLogins) {
    const id = clickupIdFor(users, login);
    if (id) desired.add(id);
    else unmapped.push(login);
  }
  const current = new Set(clickupAssignees.map((person) => person.id));
  const add = [...desired].filter((id) => !current.has(id));
  const githubSet = new Set(
    githubLogins.map((login) => login.trim().toLowerCase()),
  );
  const rem: string[] = [];
  for (const person of clickupAssignees) {
    const login = githubLoginFor(users, person);
    if (!login) continue;
    if (!githubSet.has(login.toLowerCase())) rem.push(person.id);
  }
  return { add, rem, unmapped };
}

function parseLink(entry: unknown): UserLink | null {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    return null;
  }
  const record = entry as Record<string, unknown>;
  if (EMAIL_KEYS.some((key) => key in record)) return null;
  const id = record.clickupUserId;
  const username = record.clickupUsername;
  const login = record.githubLogin;
  if (typeof username !== "string" || typeof login !== "string") return null;
  if (typeof id !== "string" && typeof id !== "number") return null;
  const clickupUserId = String(id).trim();
  const clickupUsername = username.trim();
  const githubLogin = login.trim();
  if (!/^\d+$/.test(clickupUserId)) return null;
  if (clickupUsername.length === 0 || githubLogin.length === 0) return null;
  if (clickupUsername.includes("@") || githubLogin.includes("@")) return null;
  if (/\s/.test(githubLogin)) return null;
  return { clickupUserId, clickupUsername, githubLogin };
}
