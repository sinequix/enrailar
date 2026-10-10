import { assertEquals } from "@std/assert";
import { watchTurnstileScript, type TurnstileScriptHandle } from "../src/turnstile-script.ts";

class FakeScript implements TurnstileScriptHandle {
  loaded = false;
  mounted = false;
  listeners = new Set<() => void>();

  addLoadListener(listener: () => void): void {
    this.listeners.add(listener);
  }

  removeLoadListener(listener: () => void): void {
    this.listeners.delete(listener);
  }

  markLoaded(): void {
    this.loaded = true;
  }

  mount(): void {
    this.mounted = true;
  }

  fire(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

function harness(script: FakeScript | null, apiReady: () => boolean) {
  let created: FakeScript | null = null;
  return {
    created: () => created,
    dom: {
      apiReady,
      findScript: () => script,
      createScript: () => {
        created = new FakeScript();
        return created;
      },
    },
  };
}

Deno.test("si el script ya cargó, no espera otro evento load", () => {
  const script = new FakeScript();
  let api = false;
  const { dom } = harness(script, () => api);
  let ready = false;
  const stop = watchTurnstileScript(dom, () => {
    ready = true;
  });
  assertEquals(ready, false);
  stop();
  script.fire();
  assertEquals(ready, false);
  api = true;
  watchTurnstileScript(dom, () => {
    ready = true;
  });
  assertEquals(ready, true);
});

Deno.test("un script nuevo se monta después de enganchar el load", () => {
  const { dom, created } = harness(null, () => false);
  let ready = false;
  watchTurnstileScript(dom, () => {
    ready = true;
  });
  const script = created();
  assertEquals(script?.mounted, true);
  assertEquals(ready, false);
  script?.fire();
  assertEquals(script?.loaded, true);
  assertEquals(ready, true);
});
