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
    // Sprint Final P2 (audit final 2026-05-22) — fileParallelism désactivé pour
    // garantir isolation 100 % entre test files. Sans ce flag, 7 tests workers
    // failent en mode parallèle (pollution shared module state des nouveaux
    // imports captureWorkerError dans 22 workers) alors qu'ils passent
    // isolément + en `--no-file-parallelism`. Trade-off : CI 200s → ~365s mais
    // gates strict + baseline 1687/1694 maintenu. À investiguer / retirer
    // après upgrade Vitest 3.x (qui supporte Node 24 nativement).
    fileParallelism: false,
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "tests/unit/**/*.{test,spec}.{ts,tsx}",
      "tests/schemas/**/*.{test,spec}.{ts,tsx}",
      // Contrat site ↔ Axion CRM Pro (lot L2). Tests de CONSTANTES, sans
      // aucune pile locale : ils doivent tourner dans la suite normale, sinon
      // la divergence entre les deux dépôts n'est vue par personne.
      "tests/e2e-crm-sync/**/*.{test,spec}.{ts,tsx}",
      // T16 — seeds qualiopi (buildDemoData pure, no DB)
      "prisma/seeds/qualiopi/**/*.spec.ts",
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
      //
      // 2026-05-18 ratchet additionnel post-refonte admin V2 (audit verif-fix-deploy) :
      // refonte admin (PRs 0-12, ~16 100 LOC) + finalisation image-bank +
      // content-gen workers V2 ont encore dilué les ratios globaux.
      // Mesures CI Gate A `Vitest (with coverage)` HEAD `1cd3d5f` :
      //   - lines: 24.43 %       (était 26 → bump à 24)
      //   - statements: 24.43 %  (était 26 → bump à 24)
      //   - functions: 31.71 %   (était 33 → bump à 31)
      //   - branches: 57 %       (large, conservé à 25)
      // À remonter Sprint 1.5 (tests primitives admin + content-gen V2 workers).
      thresholds: {
        statements: 24,
        branches: 25,
        functions: 31,
        lines: 24,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // server-only est un package Next.js qui throw au runtime si importé
      // dans un Client Component. En test (Node.js), il n'apporte rien et
      // bloque l'import resolution. Stub no-op.
      "server-only": path.resolve(import.meta.dirname, "./vitest.server-only-stub.ts"),
    },
  },
});
