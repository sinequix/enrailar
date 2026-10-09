/** Stages con nombre propio. Un PR usa `pr-<número>`, que se trata como preview. */
export const NAMED_STAGES = ["preview", "prod"] as const;

export type NamedStage = (typeof NAMED_STAGES)[number];

export const DOMAIN = "enrailar.com";

export function isProductionStage(stage: string): boolean {
  return stage === "prod";
}

export function stubPath(name: string): string {
  const url = new URL(`../stubs/${name}.ts`, import.meta.url);
  return decodeURIComponent(url.pathname);
}
