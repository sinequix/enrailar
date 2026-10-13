import { assert } from "@std/assert";

const css = Deno.readTextFileSync(new URL("../app/globals.css", import.meta.url));
const sumate = Deno.readTextFileSync(new URL("../app/forms.tsx", import.meta.url));
const account = Deno.readTextFileSync(new URL("../app/components/account-forms.tsx", import.meta.url));

Deno.test("el slot de Turnstile no reserva alto y el widget es flexible", () => {
  assert(!css.includes("min-height: 65px"));
  assert(css.includes(".turnstile-slot:empty {\n  display: none;\n}"));
  assert(sumate.includes('size: "flexible"'));
  assert(account.includes('size: "flexible"'));
});
