import { CLICKUP_SPACE_ID, ClickupClient } from "./clickup.ts";
import { GithubClient } from "./github.ts";
import { parseRepository, type RepositoryName } from "./references.ts";
import { parseUserMap, type UserLink } from "./users.ts";

export type SyncContext = {
  dryRun: boolean;
  spaceId: string;
  repo: RepositoryName;
  clickup: ClickupClient;
  github: GithubClient;
  users: UserLink[];
  statusByList: Map<string, string[]> | null;
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
    statusByList: null,
  };
}

export async function statusesFor(
  ctx: SyncContext,
  listId: string,
): Promise<readonly string[]> {
  if (!ctx.statusByList) {
    const lists = await ctx.clickup.listsInSpace(ctx.spaceId);
    ctx.statusByList = new Map(
      lists.map((
        list,
      ) => [list.id, list.statuses.map((status) => status.status)]),
    );
  }
  if (listId.length === 0) return [];
  return ctx.statusByList.get(listId) ?? [];
}
