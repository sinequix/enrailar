import { rateLimitDelayMs } from "./rate-limit.ts";
import { sleep } from "./sleep.ts";

const MAX_ATTEMPTS = 4;

export class HttpStatusError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "HttpStatusError";
  }
}

export async function sendWithRetry(
  doFetch: () => Promise<Response>,
  label: string,
): Promise<Response> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const response = await doFetch();
    if (!isRateLimited(response) || attempt === MAX_ATTEMPTS - 1) {
      return response;
    }
    const wait = waitMs(response);
    console.warn(
      `${label} respondió ${response.status}. Espera ${wait} ms hasta el reset.`,
    );
    await response.body?.cancel();
    await sleep(wait);
  }
  throw new Error(`${label} agotó los reintentos`);
}

export async function readJson(
  response: Response,
  label: string,
): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) {
    throw new HttpStatusError(
      response.status,
      `${label} → ${response.status} ${errorCode(text)}`.trim(),
    );
  }
  if (text.trim().length === 0) return null;
  return JSON.parse(text) as unknown;
}

function isRateLimited(response: Response): boolean {
  if (response.status === 429) return true;
  return response.status === 403 && response.headers.has("retry-after");
}

function waitMs(response: Response): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter !== null && retryAfter.trim() !== "") {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, 90_000);
    }
  }
  return rateLimitDelayMs(
    response.headers.get("x-ratelimit-reset"),
    Date.now(),
  );
}

function errorCode(text: string): string {
  try {
    const parsed = JSON.parse(text) as { ECODE?: unknown };
    return typeof parsed.ECODE === "string" ? parsed.ECODE : "";
  } catch {
    return "";
  }
}
