import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env["CI"];

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  ...(isCI ? { workers: 4 } : {}),
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14 Pro"] } },
  ],
  ...(isCI
    ? {}
    : {
        webServer: {
          command: "pnpm dev",
          port: 3000,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
