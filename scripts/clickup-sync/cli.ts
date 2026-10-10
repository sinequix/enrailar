import { loadContext } from "./context.ts";
import { syncSkippedForMissingToken } from "./guard.ts";
import { syncGithubToClickup } from "./sync-to-clickup.ts";
import { syncClickupToGithub } from "./sync-to-github.ts";

const dryRun = Deno.args.includes("--dry-run");
const command = parseCommand(Deno.args);
const decision = syncSkippedForMissingToken({
  CLICKUP_API_TOKEN: Deno.env.get("CLICKUP_API_TOKEN"),
});

if (decision.skip) {
  console.log(`::warning::${decision.warning}`);
  Deno.exit(0);
}

if (!command) {
  console.error("Uso: cli.ts to-github|to-clickup [--dry-run]");
  Deno.exit(1);
}

const ctx = await loadContext({ dryRun });

switch (command) {
  case "to-github":
    await syncClickupToGithub(ctx);
    break;
  case "to-clickup":
    await syncGithubToClickup(ctx);
    break;
  default: {
    const unexpected: never = command;
    throw new Error(`comando no manejado: ${String(unexpected)}`);
  }
}

function parseCommand(
  args: readonly string[],
): "to-github" | "to-clickup" | null {
  const command = args.find((arg) => !arg.startsWith("--"));
  switch (command) {
    case "to-github":
    case "to-clickup":
      return command;
    default:
      return null;
  }
}
