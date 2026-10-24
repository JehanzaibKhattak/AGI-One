import { defineConfig } from "@playwright/test";
export default defineConfig({
  expect: { timeout: 20000 },
  testDir: "./tests/e2e",
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    viewport: { width: 1440, height: 1000 },
    headless: true,
    actionTimeout: 15000,
    launchOptions: { executablePath: process.env.CHROMIUM_PATH },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
