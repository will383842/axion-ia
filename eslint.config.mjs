import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// eslint-config-next already wires `eslint-plugin-jsx-a11y`. We sharpen 4
// rules to "error" — this works because flat config inherits plugin namespaces
// from earlier blocks in the same array.
//
// ⚠️ `eslint-config-next` n'active que SIX règles jsx-a11y : `alt-text`,
// `aria-props`, `aria-proptypes`, `aria-unsupported-elements`,
// `role-has-required-aria-props`, `role-supports-aria-props`. Tout le reste du
// plugin est INACTIF, et l'association libellé ↔ champ en faisait partie.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    rules: {
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      // 🔴 `D7-2-A1` (2026-08-21) — un champ sans libellé associé n'est pas
      // remplissable au lecteur d'écran. La règle était INACTIVE.
      //
      // Elle a été MESURÉE avant d'être posée : zéro violation sur le site
      // public et sur le portail stagiaire, huit dans la console admin, toutes
      // du même motif (un `<label>` au-dessus d'un éditeur riche, qui
      // n'étiquette rien). Les huit sont corrigées dans le même commit — la
      // règle démarre donc à zéro, sans rouge permanent.
      //
      // ⚠️ `depth: 3` et non le défaut 2 : le dépôt écrit ses libellés de case
      // à cocher en `<label><input/><span><strong>Texte</strong>…</span></label>`.
      // Le texte y est à la profondeur 3 ; au défaut, la règle réclamerait un
      // `aria-label` sur des libellés parfaitement corrects, et c'est ainsi
      // qu'une règle juste finit désactivée.
      "jsx-a11y/label-has-associated-control": ["error", { depth: 3 }],
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
  {
    // CLI scripts, seed scripts, BullMQ workers : `console.log` est la
    // sortie standard de ces fichiers (pas de framework de logging à côté).
    // Désactiver `no-console` ici évite ~175 warnings parasites sans
    // perdre le signal sur le code applicatif (src/app, src/components,
    // src/lib, src/hooks où la règle reste active).
    files: [
      "scripts/**/*.{ts,js,mjs,cjs}",
      "src/scripts/**/*.{ts,js,mjs,cjs}",
      "prisma/**/*.{ts,js,mjs}",
      "src/server/queue/worker.ts",
      "src/server/queue/workers/**/*.{ts,js}",
    ],
    rules: {
      "no-console": "off",
    },
  },
  {
    // scripts/*.cjs = CommonJS purs (seed-images.cjs, enrich-images.cjs).
    // Ces fichiers tournent dans le container prod via `node /tmp/*.cjs` —
    // pas de bundler, pas de tsx, `require()` est l'API légitime.
    // `@typescript-eslint/no-require-imports` est désactivé uniquement ici.
    files: ["scripts/**/*.cjs", "src/scripts/**/*.cjs"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    // react-hook-form `useForm()` retourne des fonctions non-stables ;
    // le compiler React 19 (`react-hooks/incompatible-library`) le flagge
    // systématiquement alors que c'est l'API attendue. Faux positif connu
    // qui se résoudra avec react-hook-form v8+. Le périmètre est limité
    // aux 7 formulaires `src/components/forms/**`.
    files: ["src/components/forms/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    // Templates PDF Qualiopi (@react-pdf/renderer) : ce ne sont PAS des
    // composants DOM. La règle DOM `react/no-unescaped-entities` est un
    // FAUX POSITIF ici — les apostrophes françaises (« l'organisme ») se
    // rendent parfaitement dans un PDF et ne posent aucun problème d'entité
    // HTML. On la désactive pour ce dossier uniquement.
    files: ["src/server/qualiopi/documents/**/*.{ts,tsx}"],
    rules: {
      "react/no-unescaped-entities": "off",
    },
  },
  globalIgnores([
    // Claude Code agent worktrees (locaux, jamais commités). Sans ce
    // pattern, ESLint scanne les copies complètes du repo dans chaque
    // worktree, produisant 4370 erreurs parasites depuis les Prisma
    // clients générés, les composants UI test et les scripts _AUDIT/*.cjs
    // dupliqués. Audit : `_AUDIT/LINT-AUDIT-2026-05-18/`.
    ".claude/**",
    // Préfixe `**/` sur tous les patterns suivants : sans lui, les
    // patterns sont ancrés au cwd et ne matchent pas les sous-dossiers
    // (worktrees git, monorepos imbriqués, etc.). `node_modules/**`
    // bénéficie d'un cas spécial intégré ESLint, mais pas les autres.
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/next-env.d.ts",
    "**/node_modules/**",
    "**/playwright-report/**",
    "**/test-results/**",
    "**/coverage/**",
    "**/lhci/**",
    "**/src/components/ui/**",
    // Prisma generated client = auto-generated by `prisma generate`. We
    // never edit it; linting it produces ~50 errors (require() imports,
    // unused vars, explicit any) that are intentional in the generator
    // output and out of our control.
    "**/prisma/generated/**",
    // _AUDIT/ contains throwaway perf inspection scripts (.cjs) that use
    // CommonJS require() by design (Node CLI, no bundler). Not part of
    // the app build.
    "**/_AUDIT/**",
  ]),
]);

export default eslintConfig;
