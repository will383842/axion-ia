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
  // Phase 8.bis Point 4 — webServer CI-aware (runbook deploy recovery
  // 2026-05-17). Local : `pnpm dev` (HMR, vitest watch-friendly).
  // CI : `pnpm start` après `pnpm build` (réalité prod) — nécessite
  // que le job CI fasse un build préalable (gate-b step "Build").
  // Override via E2E_BASE_URL (déjà lu par `use.baseURL`) — skip
  // l'attribut webServer entièrement plutôt que le set à undefined
  // (exactOptionalPropertyTypes true).
  ...(process.env["E2E_BASE_URL"]
    ? {}
    : {
        webServer: {
          command: isCI ? "pnpm start" : "pnpm dev",
          port: 3000,
          reuseExistingServer: !isCI,
          timeout: 180_000,
        },
      }),
});
