export function syncSkippedForMissingToken(
  env: { CLICKUP_API_TOKEN?: string },
): { skip: true; warning: string } | { skip: false } {
  const token = env.CLICKUP_API_TOKEN?.trim() ?? "";
  if (token.length > 0) return { skip: false };
  return {
    skip: true,
    warning:
      "CLICKUP_API_TOKEN no está configurado. Se omite la sincronización.",
  };
}

export const AGENT_MENTION_WARNING =
  "AGENT_MENTION_TOKEN no está configurado. Se omite la orquestación. Una mención de github-actions[bot] no activa a @cursor.";

export function agentSkippedForMissingMentionToken(
  env: { AGENT_MENTION_TOKEN?: string },
): { skip: true; warning: string } | { skip: false } {
  const token = env.AGENT_MENTION_TOKEN?.trim() ?? "";
  if (token.length > 0) return { skip: false };
  return { skip: true, warning: AGENT_MENTION_WARNING };
}
