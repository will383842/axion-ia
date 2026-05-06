import { defineConfig, mergeConfig } from "vitest/config";
import baseConfig from "./vitest.config";

// Integration tests hit a real DB / Redis (Sprint 17). Sprint 0 just declares
// the entry point; nothing to run yet.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      include: ["tests/integration/**/*.{test,spec}.{ts,tsx}"],
      exclude: ["node_modules", ".next", "tests/e2e/**", "src/**"],
    },
  }),
);
