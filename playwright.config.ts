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
    // 🔴 2026-08-22 — CAUSE RACINE : SANS CES DEUX LIGNES, LA VALEUR EST « AUCUNE
    // LIMITE », PAS UNE LIMITE PAR DÉFAUT.
    //
    // Playwright met `actionTimeout` et `navigationTimeout` à **0** quand on ne
    // les déclare pas, et 0 signifie « attends indéfiniment ». Les ~70
    // `page.goto()` de `tests/e2e/` n'avaient donc AUCUNE borne propre : chacun
    // pouvait consommer le budget entier de son test, puis rendre
    // « Test timeout of Nms exceeded » — un message qui ne nomme ni l'URL, ni
    // l'étape, ni la cause.
    //
    // 🔑 Toute la famille de défauts de cette session tient là-dedans : trois
    // rouges distincts (parcours 6, `/fr/implantations`, `vente-parcours`) se
    // présentaient comme « délai dépassé » sans jamais dire de quoi. On borne à
    // la SOURCE, pour que l'échec nomme l'action qui n'a pas abouti plutôt que
    // le test qui l'englobe.
    //
    // Valeurs : une navigation légitime la plus lente mesurée dans ce dépôt est
    // `/fr/implantations` (8,7 Mo, ~6 s en froid). 30 s laisse une marge de 5×
    // sous quatre workers concurrents, tout en restant très en dessous des
    // budgets de suite (90 s à 600 s) — un dépassement reste donc lisible.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
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
