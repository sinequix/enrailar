import { assertEquals } from "@std/assert";
import { accessPolicies } from "../src/access.ts";

Deno.test("la política deja el dominio y los correos del entorno", () => {
  assertEquals(accessPolicies("  hola@enrailar.com , ,prensa@enrailar.com", " "), [
    {
      decision: "allow",
      include: [
        { emailDomain: "enrailar.com" },
        { email: "hola@enrailar.com" },
        { email: "prensa@enrailar.com" },
      ],
    },
  ]);
});

Deno.test("los service tokens van en una política Service Auth", () => {
  const policies = accessPolicies("", " aaa , bbb ");
  assertEquals(policies, [
    { decision: "allow", include: [{ emailDomain: "enrailar.com" }] },
    {
      decision: "non_identity",
      include: [{ serviceToken: "aaa" }, { serviceToken: "bbb" }],
    },
  ]);
});
