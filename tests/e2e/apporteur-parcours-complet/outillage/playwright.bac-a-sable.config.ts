// Configuration du BAC À SABLE seulement : pas de webServer (le serveur est lancé à part), Chromium
// du bac (chemin imposé), un seul projet. Le parcours n'est PAS joué par la CI.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "../..",
  testMatch: "apporteur-parcours-complet.spec.ts",
  timeout: 900_000,
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
