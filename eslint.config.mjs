import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next already wires `eslint-plugin-jsx-a11y`. We sharpen 3
// rules from the recommended preset to "error" — this works because flat
// config inherits plugin namespaces from earlier blocks in the same array.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    rules: {
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // A3.2 — module boundaries enforcement (warn d'abord, durcir en error
      // une fois la baseline propre). Empêche : lib/ et content/ d'importer
      // depuis components/ ou app/ (sens descendant uniquement).
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: ["@/components/*", "@/app/*"],
              message:
                "Module boundary: lib/ and content/ must not import from components/ or app/ (descending imports only).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}", "src/app/**/*.{ts,tsx}"],
    rules: {
      // Composants et pages peuvent importer librement depuis lib/, content/,
      // hooks/, types/, etc. → on désactive la règle ci-dessus pour ce scope.
      "no-restricted-imports": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
    "lhci/**",
    "src/components/ui/**",
  ]),
]);

export default eslintConfig;
