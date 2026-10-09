import { assert, assertEquals } from "@std/assert";
import { ROLE_MAILBOXES } from "../../packages/shared/src/project.ts";
import { isProductionStage, NAMED_STAGES } from "../src/stage.ts";

Deno.test("solo prod toca el DNS de enrailar.com", () => {
  assertEquals(NAMED_STAGES, ["preview", "prod"]);
  assert(isProductionStage("prod"));
  assert(!isProductionStage("preview"));
  assert(!isProductionStage("pr-7"));
});

const emailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function filePath(relative: string): string {
  return decodeURIComponent(new URL(relative, import.meta.url).pathname);
}

async function files(): Promise<string[]> {
  const found: string[] = [];
  const walk = async (dir: string) => {
    for await (const entry of Deno.readDir(dir)) {
      if (entry.name === "node_modules") continue;
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory) await walk(path);
      else found.push(path);
    }
  };
  await walk(filePath(".."));
  found.push(filePath("../../docs/deploy.md"));
  found.push(filePath("../../.env.example"));
  return found;
}

Deno.test("no hay correos fuera de las casillas de rol", async () => {
  const allowed = new Set<string>(ROLE_MAILBOXES);
  const offenders: string[] = [];
  for (const path of await files()) {
    const text = await Deno.readTextFile(path);
    for (const match of text.matchAll(emailPattern)) {
      const email = match[0].toLowerCase();
      if (!allowed.has(email)) offenders.push(`${path}: ${email}`);
    }
  }
  assertEquals(offenders, []);
});

Deno.test("el ejemplo de entorno deja los secretos vacíos", async () => {
  const text = await Deno.readTextFile(new URL("../../.env.example", import.meta.url));
  const names = [
    "CLOUDFLARE_API_TOKEN",
    "CLOUDFLARE_ACCOUNT_ID",
    "ALCHEMY_PASSWORD",
    "FORWARD_TO",
    "ACCESS_ALLOWED_EMAILS",
    "POLICY_AUD",
    "TEAM_DOMAIN",
  ];
  for (const name of names) {
    assert(text.includes(`${name}=`), name);
  }
  for (const line of text.split("\n")) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const value = line.slice(line.indexOf("=") + 1).trim();
    assertEquals(value, "");
  }
});
