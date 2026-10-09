export function receiveEmail(
  event: { raw: ReadableStream<Uint8Array>; rawSize: number },
  env: object,
  ctx: { waitUntil(promise: Promise<unknown>): void },
): Promise<void>;
