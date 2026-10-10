import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import vinext from "vinext";
import { authDevPlugin } from "./dev/auth-plugin.ts";

export default defineConfig({
  plugins: [authDevPlugin(), tailwindcss(), vinext()],
});
