import { httpServerHandler } from "cloudflare:node";
import { createApp } from "./app.ts";
import { workerDeps } from "./worker-deps.ts";

const app = createApp(workerDeps());
app.listen(3000);

export default httpServerHandler({ port: 3000 });
