import { defineConfig } from "vitest/config";
import baseConfig from "./vitest.config";

// Integration tests hit a real DB / Redis. Le harnais chatbot E2E
// (tests/integration/chatbot/**) importe le handler de route et consomme le SSE.
// `vitest.integration.setup.ts` charge `.env`/`.env.local` AVANT les tests
// (sinon DATABASE_URL/REDIS_URL/VOYAGE/ANTHROPIC paraissent absents — cf.
// PROMPT §1.0 point 4).
//
// On N'UTILISE PAS mergeConfig : il CONCATÈNE les `exclude`, ce qui réinjecte
// `tests/integration/**` (exclu par la base) et fait disparaître nos tests.
// On spread la base et on ÉCRASE include/exclude.
export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ["tests/integration/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "tests/e2e/**", "src/**"],
    setupFiles: ["./vitest.integration.setup.ts", "./vitest.setup.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // L'integration touche une vraie DB/Redis partagés → pas de coverage ratchet.
    coverage: { enabled: false },
  },
});
