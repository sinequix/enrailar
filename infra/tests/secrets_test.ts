import { assertEquals } from "@std/assert";

const script = new URL("../../scripts/ci/require-secrets.sh", import.meta.url);

const names = [
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "ALCHEMY_PASSWORD",
  "FORWARD_TO",
  "ACCESS_ALLOWED_EMAILS",
  "POLICY_AUD",
  "TEAM_DOMAIN",
];

function run(env: Record<string, string>) {
  return new Deno.Command("bash", {
    args: [script.pathname],
    clearEnv: true,
    env,
    stdout: "piped",
    stderr: "piped",
  }).output();
}

Deno.test("sin secretos el script corta antes de desplegar", async () => {
  const result = await run({});
  assertEquals(result.code, 1);
  const text = new TextDecoder().decode(result.stdout);
  for (const name of names) assertEquals(text.includes(`falta ${name}`), true);
});

Deno.test("con los nombres presentes el script sigue", async () => {
  const env = Object.fromEntries(names.map((name) => [name, "present"]));
  const result = await run(env);
  assertEquals(result.code, 0);
});
