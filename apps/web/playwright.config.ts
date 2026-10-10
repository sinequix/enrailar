import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL },
  webServer: {
    command: `pnpm exec vite dev --host 127.0.0.1 --port ${port}`,
    url: `${baseURL}/es`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
    },
  },
  projects: [
    {
      name: "iphone",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        defaultBrowserType: "chromium",
      },
    },
  ],
});
