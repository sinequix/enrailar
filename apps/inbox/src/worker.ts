import { env } from "cloudflare:workers";
import { handleInbox, type InboxDeps } from "./handler.ts";
import { createD1Store, type ObjectStore, type SqlDatabase } from "./store.ts";

interface BucketObject {
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface Bucket {
  put(key: string, value: Uint8Array): Promise<void>;
  get(key: string): Promise<BucketObject | null>;
}

interface InboxEnv {
  DB: SqlDatabase;
  BUCKET: Bucket;
}

function bindings(): InboxEnv {
  return env as InboxEnv;
}

function objects(): ObjectStore {
  const bucket = bindings().BUCKET;
  return {
    put(key, body) {
      return bucket.put(key, body);
    },
    async get(key) {
      const object = await bucket.get(key);
      if (!object) return undefined;
      return new Uint8Array(await object.arrayBuffer());
    },
  };
}

function deps(): InboxDeps {
  return {
    store: createD1Store(bindings().DB),
    objects: objects(),
    now: () => new Date().toISOString(),
    log(event) {
      console.log(JSON.stringify(event));
    },
  };
}

export default {
  fetch(request: Request): Promise<Response> {
    return handleInbox(request, deps());
  },
};
