/** Cabeceras de la web. El script de Sumate es inline, así que script-src no puede ser solo 'self'. */

export function securityHeaders(https: boolean): ReadonlyArray<readonly [string, string]> {
  const headers: Array<readonly [string, string]> = [
    ["content-security-policy", [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' https://api.enrailar.com https://challenges.cloudflare.com",
      "frame-src https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ")],
    ["x-content-type-options", "nosniff"],
    ["referrer-policy", "strict-origin-when-cross-origin"],
  ];
  if (https) headers.push(["strict-transport-security", "max-age=31536000"]);
  return headers;
}

export function withSecurityHeaders(response: Response, https: boolean): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of securityHeaders(https)) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
