import { runAgent } from "./agent-run.ts";
import { loadContext } from "./context.ts";
import {
  agentSkippedForMissingMentionToken,
  syncSkippedForMissingToken,
} from "./guard.ts";
import { syncGithubToClickup } from "./sync-to-clickup.ts";
import { syncClickupToGithub } from "./sync-to-github.ts";

const dryRun = Deno.args.includes("--dry-run");
const command = parseCommand(Deno.args);

if (command === "agent") {
  const mention = agentSkippedForMissingMentionToken({
    AGENT_MENTION_TOKEN: Deno.env.get("AGENT_MENTION_TOKEN"),
  });
  if (mention.skip) {
    console.log(`::warning::${mention.warning}`);
    Deno.exit(0);
  }
  await runAgent({ dryRun });
  Deno.exit(0);
}

if (command !== "to-github" && command !== "to-clickup") {
  console.error("Uso: cli.ts to-github|to-clickup|agent [--dry-run]");
  Deno.exit(1);
}

const decision = syncSkippedForMissingToken({
  CLICKUP_API_TOKEN: Deno.env.get("CLICKUP_API_TOKEN"),
});

if (decision.skip) {
  console.log(`::warning::${decision.warning}`);
  Deno.exit(0);
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
): "to-github" | "to-clickup" | "agent" | null {
  const command = args.find((arg) => !arg.startsWith("--"));
  switch (command) {
    case "to-github":
    case "to-clickup":
    case "agent":
      return command;
    default:
      return null;
  }
}
