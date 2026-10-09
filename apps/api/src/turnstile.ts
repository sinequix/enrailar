const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstile(input: {
  secret: string;
  token: string;
  ip: string | undefined;
  fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const body = new URLSearchParams({ secret: input.secret, response: input.token });
  if (input.ip !== undefined && input.ip.length > 0) body.set("remoteip", input.ip);
  const response = await (input.fetchImpl ?? fetch)(SITEVERIFY, { method: "POST", body });
  if (!response.ok) return false;
  const payload: unknown = await response.json();
  return typeof payload === "object" && payload !== null && "success" in payload && payload.success === true;
}
