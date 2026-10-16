import { assert, assertEquals } from "@std/assert";
import { APEX_SPF, DKIM_PLACEHOLDER, DMARC, ROUTING_MX, SENDING_PLACEHOLDER } from "../src/email-dns.ts";

Deno.test("el ápice tiene tres MX, un SPF y DMARC en p=none", () => {
  assertEquals(ROUTING_MX.map((record) => record.host), [
    "route1.mx.cloudflare.net",
    "route2.mx.cloudflare.net",
    "route3.mx.cloudflare.net",
  ]);
  assertEquals(ROUTING_MX.map((record) => record.priority), [97, 98, 77]);
  assertEquals(APEX_SPF, "v=spf1 include:_spf.mx.cloudflare.net ~all");
  assertEquals(APEX_SPF.split("include:").length, 2);
  assertEquals(DMARC, "v=DMARC1; p=none; rua=mailto:hola@enrailar.com");
  assert(DMARC.includes("p=none"));
});

Deno.test("DKIM y Email Sending quedan como placeholder, sin clave", () => {
  assertEquals(DKIM_PLACEHOLDER.content, "");
  assertEquals(DKIM_PLACEHOLDER.routingName, "cf2024-1._domainkey");
  assertEquals(DKIM_PLACEHOLDER.sendingName, "cf-bounce._domainkey");
  assertEquals(SENDING_PLACEHOLDER.host, "cf-bounce");
  assertEquals(SENDING_PLACEHOLDER.dkimName, "cf-bounce._domainkey");
  assertEquals(SENDING_PLACEHOLDER.mx.length, 3);
  const stack = Deno.readTextFileSync(new URL("../alchemy.run.ts", import.meta.url));
  assert(stack.includes("Cloudflare.DNS.Record"));
  assert(stack.includes("APEX_SPF"));
  assert(stack.includes("DMARC"));
  assert(!stack.includes("v=DKIM1"));
  assert(!stack.includes("FORWARD_TO"));
  assert(stack.includes("CLICKUP_API_TOKEN"));
  assert(stack.includes("CLICKUP_LIST_ID_WEB"));
  assert(stack.includes("CLICKUP_LIST_ID_CONTACTS"));
  assert(!/\bCLICKUP_LIST_ID\b/.test(stack));
});
