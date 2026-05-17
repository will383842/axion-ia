import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    // Audit A7 follow-up (2026-05-15) — pool=forks workaround l'incompat
    // Vitest 2.1.x ↔ Node 24+ qui casse le SSR transform par threads
    // (`ReferenceError: __vite_ssr_exportName__ is not defined`). Bug
    // upstream connu : https://github.com/vitest-dev/vitest/issues/6661
    // À retirer après upgrade Vitest 3.x (qui supporte Node 24 nativement
    // sans workaround). Forks reste ~10-15 % plus lent que threads mais
    // c'est acceptable pour débloquer l'audit A1 NODE_VERSION=24 + A7 CI
    // gate-d. Tests : 818 verts confirmés post-workaround.
    pool: "forks",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/unit/**/*.{test,spec}.{ts,tsx}",
      "tests/schemas/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["node_modules", ".next", "tests/e2e/**", "tests/integration/**"],
    coverage: {
      provider: "v8",
      // json-summary requis par scripts/ci/coverage-ratchet.ts
      // (Phase 8.bis Point 1 — runbook deploy recovery 2026-05-17).
      reporter: ["text", "html", "lcov", "json-summary"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/**/*.d.ts",
        "src/instrumentation*.ts",
        "src/sentry.*.config.ts",
        "src/env.ts",
      ],
      // Pass B P1-9 — bump 50 → 60 % (palier S6.2). Cible 70 % S6.3 quand la
      // suite tests content-gen unit (P0-1) + E2E (P0-2) sera consolidée.
      //
      // ⚠️ Ratchet temporaire 2026-05-16 (audit V1 image-bank verification — Option B Will).
      // Le code récent image-bank V1 (~3000 LOC) + S+1 securite-rgpd (~1500 LOC)
      // a fait chuter la couverture globale réelle à ~27 % statements / ~33 % functions
      // (vs 60 % attendu). Les seuils ci-dessous sont posés JUSTE EN DESSOUS du
      // niveau observé (effet "ratchet") : le CI bloquera toute future régression
      // mais accepte le niveau actuel. À remonter graduellement :
      //   - Sprint 1.5 : image-bank P1-1 tests Vitest (12-16h → +5-8 pts)
      //   - Sprint 1.6+ : couverture S+1 securite-rgpd
      //   - Cible long terme : 60 % (retour à la valeur Pass B P1-9 ci-dessus).
      // Suivi : _AUDIT/IMAGE-BANK-V1-VERIFICATION-2026-05-16/09-tests-ci.md.
      thresholds: {
        statements: 26,
        branches: 25,
        functions: 33,
        lines: 26,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
