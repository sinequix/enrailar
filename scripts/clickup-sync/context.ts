import {
  CLICKUP_SPACE_ID,
  ClickupClient,
  type ClickupList,
  type ClickupStatus,
} from "./clickup.ts";
import { GithubClient } from "./github.ts";
import { loadSyncPolicy, type SyncPolicy } from "./privacy.ts";
import { parseRepository, type RepositoryName } from "./references.ts";
import { parseUserMap, type UserLink } from "./users.ts";

export type SyncContext = {
  dryRun: boolean;
  spaceId: string;
  repo: RepositoryName;
  clickup: ClickupClient;
  github: GithubClient;
  users: UserLink[];
  policy: SyncPolicy;
  lists: ClickupList[] | null;
  statusByList: Map<string, ClickupStatus[]> | null;
};

export async function loadContext(
  options: { dryRun: boolean },
): Promise<SyncContext> {
  const clickupToken = Deno.env.get("CLICKUP_API_TOKEN")?.trim() ?? "";
  const githubToken = Deno.env.get("GITHUB_TOKEN")?.trim() ?? "";
  if (githubToken.length === 0) {
    throw new Error("GITHUB_TOKEN no está configurado");
  }
  const spaceId = Deno.env.get("CLICKUP_SPACE_ID")?.trim() || CLICKUP_SPACE_ID;
  if (!/^\d+$/.test(spaceId)) {
    throw new Error("CLICKUP_SPACE_ID inválido");
  }
  const repo = parseRepository(
    Deno.env.get("GITHUB_REPOSITORY")?.trim() || "sinequix/enrailar",
  );
  const parsed = parseUserMap(
    JSON.parse(
      await Deno.readTextFile(new URL("./user-map.json", import.meta.url)),
    ),
  );
  if (parsed.skipped > 0) {
    console.warn(
      `user-map.json: se ignoraron ${parsed.skipped} entradas. El mapa es por username o id, sin emails.`,
    );
  }
  return {
    dryRun: options.dryRun,
    spaceId,
    repo,
    clickup: new ClickupClient(clickupToken, { dryRun: options.dryRun }),
    github: new GithubClient(githubToken, repo, { dryRun: options.dryRun }),
    users: parsed.users,
    policy: await loadSyncPolicy(),
    lists: null,
    statusByList: null,
  };
}

export async function loadLists(ctx: SyncContext): Promise<ClickupList[]> {
  if (!ctx.lists) {
    ctx.lists = await ctx.clickup.listsInSpace(ctx.spaceId);
  }
  ctx.statusByList = new Map(
    ctx.lists.map((list) => [list.id, list.statuses]),
  );
  return ctx.lists;
}

export async function statusesFor(
  ctx: SyncContext,
  listId: string,
): Promise<readonly ClickupStatus[]> {
  const lists = await loadLists(ctx);
  if (listId.length === 0) return [];
  return lists.find((list) => list.id === listId)?.statuses ?? [];
}
