declare module "cloudflare:workers" {
  export const env: object;
}

declare class EmailMessage {
  constructor(from: string, to: string, raw: string);
}
