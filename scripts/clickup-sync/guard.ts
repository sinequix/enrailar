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
