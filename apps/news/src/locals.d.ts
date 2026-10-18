declare namespace App {
  interface Locals {
    /** Lo pone el middleware externo después de un JWT de Access válido. */
    newsAccess?: "allow";
  }
}

declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
