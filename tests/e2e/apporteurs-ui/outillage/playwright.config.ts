// Bac à sable seulement : serveur lancé à part, base/Redis/faux services LOCAUX, données fictives.
// Jamais jouée par la CI (les specs se sautent sans APPORTEUR_BAC_A_SABLE=1).
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "..",
  testMatch: "*.spec.ts",
  timeout: 300_000,
  workers: 1,
  retries: 0,
  reporter: "list",
  outputDir: "../test-results",
  use: {
    baseURL: process.env["E2E_BASE_URL"] ?? "http://localhost:3000",
    actionTimeout: 30_000,
    navigationTimeout: 180_000,
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: { executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] },
      },
    },
  ],
});
