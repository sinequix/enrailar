// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Alchemy beta inyecta su plugin (`ALCHEMY_CLOUDFLARE_VITE_INJECTED=1`).
// El plugin oficial, si sigue acá, se registra dos veces. Ver docs/inbox.md.
const cloudflarePlugin =
  process.env.ALCHEMY_CLOUDFLARE_VITE_INJECTED === "1"
    ? []
    : [cloudflare({ viteEnvironment: { name: "ssr" } })];

export default defineConfig({
  plugins: [...cloudflarePlugin, tailwindcss(), reactRouter(), tsconfigPaths()],
});
