# 🔬 PROMPT CODE HEALTH AUDIT 2026 — AxionIA · Rapidité site (Phase A) + Santé long-terme (Phase B)

> **Version 1.0 · 2026-05-07**
> Working directory : `C:\Users\willi\Documents\Projets\Axion-IA\axionia` (sous-repo Next.js 16).
> Sortie : `_AUDIT/AUDIT-CODE-HEALTH-2026.md` (rapport unifié 2 phases) + 7 livrables annexes (cf. ✅ Livrables).
> Durée estimée : Phase A ~2-4h (rapidité site quick wins) + Phase B ~6-8h (santé long-terme refactor).
> **Empile** sur la séquence existante (post FRONTEND-DEEP-CHECK / TYPOGRAPHY / PARITY / PAGE-AUDIT / HEADER-NAV ✅ / VISUAL-RHYTHM ✅ / SEO-MASTER en attente). Spécifique **code-level** : ce qu'aucun audit précédent ne couvre frontalement.

---

## 🎯 MISSION

Will prépare Sprint 15+ avec expansion programmatic SEO **toutes les villes FR > 5 000 habitants (~2 150 villes)** + ~15 régions + maintenance long-terme cabinet IA opérationnel B2B premium. Le code doit :

1. **Scaler proprement** à 2 150+ pages SSG sans exploser le build time, le bundle JS, ni dégrader les Core Web Vitals.
2. **Rester maintenable** sur 12+ mois (Will = développeur unique, refactor coûteux à rattraper si dette technique installée).
3. **Tenir les standards 2026** (Server Components Next.js 16 majoritaires, TypeScript strict, zéro code mort, zéro duplication structurelle).

**Mission double — 2 phases distinctes mais consolidées** :

### Phase A — Rapidité site (quick wins immédiats)

Audit **focused performance / bundle** : ce qui impacte LCP/INP/CLS au niveau code (pas page-level — le SEO-MASTER ch.12 couvre déjà page-level). Cible : identifier les **3-5 quick wins majeurs** exécutables en < 2 jours.

Périmètre Phase A :

- Bundle JavaScript (taille totale, splits, heavy deps).
- Server vs Client Components ratio (Next.js 16 doctrine).
- Hydration cost (Client Components abusés).
- Heavy dependencies (lodash full vs lodash-es, moment vs date-fns, framer-motion sur 50% du site, etc.).
- Tree-shaking efficacité.
- Font loading (next/font config).
- Image optimization (next/image config + AVIF/WebP).
- CSS critical / unused.
- ISR/SSG strategy actuelle.

### Phase B — Santé long-terme (refactor structurel)

Audit **maintenabilité du code** : ce qui rend le code dur à faire évoluer après 6-12 mois. Cible : produire un plan de **refactor priorisé P0/P1/P2** + métriques baseline pour suivi continu.

Périmètre Phase B :

- Taille fichiers (LOC, lignes par fonction).
- Complexité cyclomatique (par fonction, par composant).
- Code mort (exports/imports/composants inutilisés).
- Duplication structurelle (blocs de code répétés).
- Dependencies circulaires.
- TypeScript strictness (`any`, `unknown` abuse, `// @ts-ignore`).
- Test coverage par fichier (lacunes critiques).
- Hooks custom dupliqués / mal placés.
- « God components » (composants > 300 lignes faisant trop de choses).
- « God content files » (ex: `stack-ia.ts` 682 lignes — à splitter ?).
- Convention de nommage cohérence.
- Erreurs `console.log` / `debugger` oubliés.
- TODO/FIXME orphelins.

**Posture** :

- **Auto-tooling first** : utiliser les outils standards (knip, madge, jscpd, @next/bundle-analyzer, ESLint, tsc) plutôt que d'analyser manuellement 150+ fichiers.
- **Lecture seule strict** : aucune modif code durant l'audit. Patches en annexe diff.
- **3 scénarios chiffrés** par phase (MIN / STANDARD / PERFECTION).
- **Réaliste** : Will = solo developer, on ne peut pas refactor 100% du code, prioriser ROI.

---

## 🧠 RÔLE & POSTURE

Tu es **lead software engineer + principal performance engineer** pour Next.js 16 + TypeScript + B2B SaaS premium. Tu connais à froid :

- **Next.js 16 doctrine** : Server Components par défaut, Client Components minimaux et bien isolés, `use server` actions vs API routes, Streaming + Suspense, partial prerendering (PPR), ISR strategy, edge vs node runtime.
- **Bundle optimization 2026** : code splitting route-based + component-level, dynamic imports avec `next/dynamic`, tree-shaking ES modules pur, side-effects-free packages, lodash-es vs lodash, date-fns vs moment, immer vs structural cloning natif.
- **Performance metrics 2026** : Core Web Vitals (LCP P75 < 2.5s, INP P75 < 200ms, CLS P75 < 0.1), TTFB, FCP, performance budget par route, Lighthouse CI.
- **TypeScript strict** : `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, élimination `any`, type narrowing, branded types.
- **Code quality metrics** : cyclomatic complexity (cible ≤ 10 par fonction), cognitive complexity, fan-in/fan-out, LCOM4 cohésion classes, halstead metrics (academic mais utile).
- **Outils** : `knip` (dead code + unused deps), `madge` (circular deps), `jscpd` (clone detection), `@next/bundle-analyzer` (bundle composition), ESLint (`eslint-plugin-complexity`, `eslint-plugin-functional`, `eslint-plugin-import`), `depcheck` (unused npm deps).
- **Code smells** : long methods (> 50 lignes), god classes, feature envy, primitive obsession, shotgun surgery, divergent change, switch statement abuse.

**Spécialisation AxionIA** : tu sais que Will doit gérer ~150 fichiers actuels + scale ~2 150 pages générées via templates (villes) + i18n FR/EN + 7+ factories JSON-LD + composants HeroSchema multiples. Le prompt vise **maintenabilité solo dev** sur 12+ mois + scale build à 2 150 routes statiques.

**Posture** :

- **Pragmatique** : ne pas refactor pour le plaisir. Chaque proposition justifie ROI (effort vs gain).
- **Mesurable** : produire des **chiffres baseline** (LOC, complexity, bundle KB, etc.) pour suivi continu trimestriel.
- **Tooling-first** : si une métrique n'est pas mesurable automatiquement par un outil standard, la skipper (sauf cas critique).
- **Transparente sur incertitudes** : certains seuils (LOC max par fichier, complexity max) sont des conventions, pas des lois. Justifier les choix.

---

## 🏗️ STACK & CENTRALISATIONS (rappel — RESPECTER, ne pas réinventer)

> Cf. `_AUDIT/stack-fit-analysis.md` (1130 lignes Agent E Header-Nav) pour détails complets.

- **Contenu** : `src/content/*.ts` (TS typé) — **fichiers à audit complexité/taille en priorité** : `stack-ia.ts` (682 lignes vu), `case-studies.ts`, `interventions.ts`, `transversal.ts`.
- **Routing** : `src/i18n/routing.ts` (`routing.pathnames`).
- **SEO** : `src/lib/seo.ts` (3 factories existantes + 4 à créer Sprint 15).
- **JSON-LD** : `src/components/marketing/JsonLd.tsx`.
- **Sitemap** : `src/app/sitemap.ts` (refactor sitemap-index Sprint 15).
- **Server Components** par défaut. Client Components à isoler et minimiser.

### Anti-patterns à NE PAS proposer (rappel)

- ❌ Réécrire en patterns Next.js < 16.
- ❌ Introduire des deps lourdes (Algolia, Framer Motion full, Lottie) sans justification ROI.
- ❌ Refactor massif sans étape baseline mesurée.
- ❌ Supprimer du code « par esthétique » sans certitude qu'il est mort (vérifier `knip` + tests + grep usages).
- ❌ Imposer convention nommage différente de l'existant sans ADR.

---

## 📚 SOURCES DE VÉRITÉ

### Référence interne (à inventorier complètement)

1. `axionia/package.json` — deps + scripts + engines.
2. `axionia/tsconfig.json` — strict mode actuel + paths.
3. `axionia/next.config.ts` (ou `.js`) — config Next 16 (experimental, images, headers, redirects).
4. `axionia/eslint.config.js` ou `.eslintrc.*` — rules actives.
5. `axionia/.prettierrc.*` — formatting.
6. `axionia/src/**/*.{ts,tsx}` — toute la codebase.
7. `axionia/src/content/*.ts` — fichiers contenu (tailles individuelles à mesurer).
8. `axionia/src/components/**/*.tsx` — composants (audit god components).
9. `axionia/src/lib/**/*.ts` — utilities + seo.ts + schemas/forms.ts.
10. `axionia/src/app/[locale]/**/*` — pages App Router.
11. `axionia/src/app/api/**/*` — API routes si présentes.
12. `axionia/__tests__/**/*` ou `src/**/*.test.*` — tests existants.
13. `axionia/.github/workflows/*` — CI config (linting, tests, build).
14. `axionia/_AUDIT/AUDIT-HEADER-NAVIGATION-2026.md` + `stack-fit-analysis.md` — patterns à respecter.

### Standards & doctrine 2026

- **Next.js 16 docs** (`node_modules/next/dist/docs/` + officiel).
- **Conventions React 19** (Server Components, hooks, Suspense).
- **ESLint best practices 2026** (flat config, typed-linting).
- **TypeScript 5.7+ strict** patterns.

---

## 🔍 PHASE A — RAPIDITÉ SITE (audit perf bundle)

### Chapitre A1 — Bundle JavaScript

A1.1 Bundle total size (uncompressed + gzipped) — outil : `@next/bundle-analyzer`.
A1.2 Top 10 deps lourdes (par taille). Identifier candidates remplacement (lodash → lodash-es ou natif, moment → date-fns, etc.).
A1.3 Code splitting actuel : routes statiques bien splittées ? Composants partagés correctement extraits ?
A1.4 Dynamic imports `next/dynamic` : usages actuels + opportunités (composants lourds non-critiques sous-le-fold).
A1.5 Tree-shaking effective : packages avec `sideEffects: false` correctement déclaré ? Imports nominaux vs default ?
A1.6 Polyfills inutiles : Next.js 16 cible browsers modernes, audit polyfills résiduels.
A1.7 Source maps prod : présents ou pas ? (impact taille mais utile debug).
A1.8 Bundle par route (top 5 routes les plus lourdes) — identifier surcharge.
A1.9 CSS bundle : Tailwind v4 JIT — vérifier purge agressif effectif, no unused.
A1.10 Performance budget : définir cible (ex: < 250 KB JS gzipped page typique, < 500 KB total).

### Chapitre A2 — Server vs Client Components (Next.js 16)

A2.1 Ratio Server / Client Components actuel — grep `"use client"` + comptage.
A2.2 Client Components candidats à server-ifier (pas d'interactivité réelle, juste affichage).
A2.3 Client Components trop larges (encapsulent du Server-only) → split + extraire les parties statiques.
A2.4 Hooks dans Server Components (anti-pattern) — détecter `useState`/`useEffect` mal placés.
A2.5 Server Actions vs API Routes : usages actuels + cohérence.
A2.6 Streaming + Suspense : opportunités (pages avec sections lentes pouvant streamer).
A2.7 Partial Prerendering (PPR) : si Next 16 le supporte, audit candidats.
A2.8 ISR strategy : pages dynamiques avec `revalidate` correctement configuré ?
A2.9 Edge vs Node runtime : choix actuels + pertinence (edge plus rapide mais limites).
A2.10 `'use cache'` (si Next 16 le propose) : cache server-side fine-grained, opportunités.

### Chapitre A3 — Heavy dependencies

A3.1 Audit `package.json` : deps anciennes/inutilisées (`depcheck`).
A3.2 Deps lourdes à challenger : Framer Motion (gzip ~50KB), date-fns full (~80KB → import nominaux), zod (~50KB acceptable car critique).
A3.3 Versions : deps obsolètes à upgrade (security + perf gains).
A3.4 Duplicates lockfile : audit `pnpm-lock.yaml` pour duplicate versions.
A3.5 Native vs lib : preferer Web APIs (Intl, fetch, structuredClone) à lodash quand possible.
A3.6 React 19 features : `useTransition`, `useDeferredValue`, `useOptimistic` adoptés ?
A3.7 Server-only libs accidentellement client-bundled (ex: `fs`, `path` côté client = bundle bloater).
A3.8 Polyfills automatiques : Next 16 inclut-il des polyfills inutiles pour browsers modernes targets ?
A3.9 Icon libs : Lucide React tree-shaké correctement (1 icon = 1 import nominal, pas full lib) ?
A3.10 Devs deps en prod ? Audit `dependencies` vs `devDependencies` correctness.

### Chapitre A4 — Hydration & runtime perf

A4.1 Hydration cost actuel : mesurer via Performance API + React DevTools Profiler.
A4.2 Components avec `useEffect` lourds bloquant hydration.
A4.3 Layout shifts (CLS) causés par composants hydratés tardivement.
A4.4 Re-renders abusifs : audit React DevTools flame graph sur pages typiques.
A4.5 `useMemo`/`useCallback` mal placés (sur-optimisation = surcoût) ou manquants (sous-optimisation).
A4.6 Context providers trop larges (re-render cascade).
A4.7 Listes non-virtualisées si > 100 items (rare sur AxionIA mais à vérifier sur catalogue villes futur).
A4.8 Animations CSS vs JS : cohérence, prefers-reduced-motion respect.
A4.9 Event listeners passifs (`{ passive: true }`) sur scroll/touch.
A4.10 Web Workers / OffscreenCanvas : si calcul lourd côté client (ROI calculator ?), envisager.

### Chapitre A5 — Build time & DX

A5.1 Build time actuel (`next build` durée) — baseline pour comparaison post-2150 villes.
A5.2 Estimation build time avec 2 150 villes templates (extrapolation linéaire).
A5.3 Incremental builds : Turborepo / Nx ? (probablement pas pour un seul package, mais à valider).
A5.4 Cache Next.js : `.next/cache` taille + efficacité.
A5.5 TypeScript compile time : `tsc` mode incremental, `composite` projects ?
A5.6 ESLint exec time : flat config + `--cache` ?
A5.7 Dev server (`next dev`) responsiveness : Turbopack stable Next 16 ? RSC dev-time perf ?
A5.8 HMR efficiency : modifications JSX propagées rapidement ?
A5.9 Environment variables : audit `.env*` files cohérence (no secrets committed).
A5.10 CI build time (GitHub Actions) — gains possibles via cache + matrix.

---

## 🔍 PHASE B — SANTÉ LONG-TERME (audit maintenabilité)

### Chapitre B1 — Taille fichiers & complexité

B1.1 LOC par fichier — outil : `cloc` ou `tokei`. Cible : aucun fichier > 500 lignes (sauf justifié, ex: schema centralisé).
B1.2 Top 20 fichiers les plus longs — analyse cas par cas (god component / god content file ?).
B1.3 Complexité cyclomatique par fonction — outil : `eslint-plugin-complexity` rule `complexity`. Cible : ≤ 10.
B1.4 Cognitive complexity (SonarJS metric) — alternative plus moderne.
B1.5 Fonctions > 50 lignes — refactor candidates (extract method).
B1.6 Components > 300 lignes — refactor candidates (split en sous-composants).
B1.7 Props count par composant — > 8 props = signal abstraction wrong.
B1.8 Hooks count par composant — > 5 hooks = signal complexity.
B1.9 Nesting depth (JSX et code) — > 4 niveaux = signal refactor.
B1.10 « God content files » : `stack-ia.ts` 682 lignes — split par fonction (think.ts, produce.ts, etc.) ou conserver monolithique ?

### Chapitre B2 — Code mort & duplication

B2.1 Code mort détecté par `knip` : exports inutilisés, fichiers orphelins, deps non-importées.
B2.2 Imports inutiles par fichier (ESLint `unused-imports/no-unused-imports`).
B2.3 Duplication détectée par `jscpd` : blocs > 5 lignes répétés.
B2.4 Composants similaires non-factorisés (ex: 3 versions de Card avec micro-variations).
B2.5 Hooks custom dupliqués (ex: `useScroll` redéfini dans 2 endroits).
B2.6 Constants/strings dupliquées (ex: même URL en 3 fichiers).
B2.7 Helpers utilitaires en double (`formatPrice` dans `lib/utils.ts` ET inline dans component).
B2.8 Fichiers de test couvrant code supprimé (orphan tests).
B2.9 Branches `if/else` dead (logique inatteignable détectée via TypeScript narrowing).
B2.10 TODO/FIXME orphelins ≥ 6 mois — décider : faire, supprimer, ou ticket externe.

### Chapitre B3 — Dependencies & architecture

B3.1 Dependencies circulaires détectées par `madge` (`madge --circular src/`).
B3.2 Import depth excessive (ex: `../../../../components/Card` → utiliser path aliases `@/components/Card`).
B3.3 Path aliases (`@/*`) cohérents dans tsconfig + utilisés partout.
B3.4 Layered architecture respectée : `app/` peut importer de `components/`, `lib/`, `content/`. `components/` ne doit pas importer de `app/`.
B3.5 Modules « god » : fichier importé par > 30 autres = candidat splitting.
B3.6 Exports nommés vs default : convention cohérente (recommandation moderne = nommés).
B3.7 Index `barrel exports` (`index.ts` qui re-export tout) : impact tree-shaking + circular deps.
B3.8 Coupling : composants UI dépendant de business logic (anti-pattern).
B3.9 Cohesion : composants faisant trop de choses non-liées.
B3.10 Layer violations : `lib/` importing `components/` (anti-pattern, lib doit être pure).

### Chapitre B4 — TypeScript strictness

B4.1 `tsconfig.json` strict mode actif : `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`.
B4.2 Occurrences `any` explicites — grep `: any` + ESLint `@typescript-eslint/no-explicit-any`.
B4.3 Occurrences `unknown` non-narrowed.
B4.4 `// @ts-ignore` / `// @ts-expect-error` orphelins ou abusifs.
B4.5 Type assertions `as` excessives (signal modeling wrong).
B4.6 Discriminated unions vs type assertions (préférer les premiers).
B4.7 Branded types pour primitive obsession (`UserId` vs `string`).
B4.8 Generics over-engineered ou manquants.
B4.9 `Partial<T>` / `Required<T>` / utility types : usage approprié vs duplication manuelle.
B4.10 Inférence vs annotation explicite : balance lisibilité/sécurité.

### Chapitre B5 — Tests & qualité

B5.1 Test coverage globale (% lines + % branches) — outil : Vitest/Jest coverage.
B5.2 Coverage par fichier — identifier zones critiques sous-testées.
B5.3 Tests existants pertinence : tests qui testent l'implémentation (cassent au refactor) vs tests qui testent le comportement (robustes).
B5.4 Tests E2E vs unit vs integration : ratio AxionIA actuel.
B5.5 `lib/utils.test.ts` et autres tests existants : qualité (assertions précises, edge cases).
B5.6 Mocks : usage approprié vs sur-mocking qui casse la confiance.
B5.7 Snapshot tests : volume + maintenance cost.
B5.8 Tests a11y (axe-core) sur composants interactifs.
B5.9 Tests visuels (Playwright/Chromatic) : ROI vs cost pour solo dev.
B5.10 CI : tests run on every PR + linting + type-check + build (audit `.github/workflows`).

### Chapitre B6 — Conventions & DX

B6.1 Naming conventions : camelCase fonctions/variables, PascalCase composants/types, UPPER_SNAKE constants — cohérence.
B6.2 File naming : `kebab-case.ts` vs `PascalCase.tsx` vs autres — choix et cohérence.
B6.3 Folder structure : feature-based vs type-based — actuel + proposition si refactor.
B6.4 Imports order : ESLint `import/order` (external > internal > parent > sibling).
B6.5 `console.log` / `debugger` orphelins (pré-commit hook ?).
B6.6 Magic numbers : extraire en constantes nommées.
B6.7 Commentaires : ratio code/commentaire, qualité (commentaires explicatifs vs paraphrastes).
B6.8 JSDoc sur APIs publiques (factories `lib/seo.ts`, hooks publics) ?
B6.9 README à jour ? Onboarding doc ?
B6.10 Commit messages convention (Conventional Commits + scope ?).

---

## 🛠️ MÉTHODOLOGIE D'AUDIT (5 agents parallèles + agent principal)

### Agent A — Tooling check + Phase A.1 Bundle (perf)

- Vérifier outils installés : `@next/bundle-analyzer`, `knip`, `madge`, `jscpd`, `depcheck`, ESLint complexity rules.
- Si manquants : recommander installation (1 commande npm chacune, ~5 min total).
- Lancer `next build` + `@next/bundle-analyzer` → produire rapport bundle.
- Top 10 deps lourdes + propositions remplacement.
- Output : `phaseA-01-bundle.md` + `tooling-status.md`.

### Agent B — Phase A.2-A.3 Server/Client + heavy deps (perf)

- Grep `"use client"` → comptage par dossier.
- Audit Client Components > 200 lignes (top 5 candidates server-ifier ou split).
- Audit imports lourds (`framer-motion`, `lodash`, `moment`).
- Output : `phaseA-02-server-client-deps.md`.

### Agent C — Phase A.4-A.5 Hydration + build time (perf)

- Mesurer build time `next build` (timer).
- Estimation build time avec 2 150 villes (extrapolation).
- Audit hydration cost via grep patterns + heuristiques.
- Output : `phaseA-03-hydration-build.md`.

### Agent D — Phase B.1-B.3 Taille/complexité/code mort (santé)

- Lancer `cloc src/` → distribution LOC.
- Lancer `knip` → code mort + unused deps.
- Lancer `madge --circular` → deps circulaires.
- Lancer `jscpd src/` → duplication.
- Top 20 fichiers à refactor + métriques chiffrées.
- Output : `phaseB-01-files-deps.md` + `code-metrics-baseline.csv`.

### Agent E — Phase B.4-B.6 TS + tests + conventions (santé)

- Lire `tsconfig.json` → strict flags actifs.
- Grep `: any` / `// @ts-ignore` → comptage.
- Lancer Vitest coverage → identifier zones critiques sous-testées.
- Audit conventions naming/file/folder.
- Output : `phaseB-02-typescript-tests-conventions.md`.

### Agent principal — Synthèse + scoring + 2 plans d'action

- Consolider les 5 agents.
- **Scoring code health** par axe (10 axes Phase A + 6 axes Phase B = 16 axes × scoring 0-10 = /160).
- **Plan d'action Phase A** (rapidité site) avec priorité P0/P1/P2 + effort + impact bundle KB / LCP estimé.
- **Plan d'action Phase B** (santé long-terme) avec priorité P0/P1/P2 + effort + dette technique réduite (heures futures épargnées).
- **3 scénarios chiffrés par phase** :
  - Phase A MIN : top 3 quick wins (~1-2 jours).
  - Phase A STANDARD : top 5-10 actions (~3-5 jours).
  - Phase A PERFECTION : tout (~1-2 semaines).
  - Phase B MIN : code mort + duplication critique (~2-3 jours).
  - Phase B STANDARD : MIN + complexité top 10 fichiers (~1 semaine).
  - Phase B PERFECTION : tout (~3-4 semaines).
- **Baseline metrics CSV** : `code-metrics-baseline.csv` pour suivi continu trimestriel.
- Output : `_AUDIT/AUDIT-CODE-HEALTH-2026.md` consolidant Phase A + Phase B + scoring /160 + 2 plans d'action.

---

## ⛔ INTERDITS ABSOLUS

- ❌ **Modifier du code** durant l'audit (lecture seule strict, patches en annexe diff).
- ❌ **Refactor « par esthétique »** sans ROI mesurable.
- ❌ **Recommander de réécrire de zéro** un fichier/composant qui marche, sauf cas extrême documenté.
- ❌ **Changer convention sans ADR** si elle est cohérente partout.
- ❌ **Installer des outils** durant l'audit (lecture seule). Recommander dans le rapport.
- ❌ **Casser les patterns existants** validés (`src/content/*.ts` TS typé, factories `lib/seo.ts`, etc.).
- ❌ **Sur-engineering** (introduire DI, CQRS, Clean Architecture sur projet solo dev — anti-ROI).

---

## ✅ LIVRABLES ATTENDUS

1. **`_AUDIT/AUDIT-CODE-HEALTH-2026.md`** (rapport principal, ~5000-7000 mots) :
   - Synthèse exécutive (1 page, scoring /160).
   - Phase A diagnostic + plan d'action.
   - Phase B diagnostic + plan d'action.
   - Top 5 quick wins immédiats (Phase A).
   - Top 10 dette technique critique (Phase B).
   - Roadmap par sprint (Sprint 15 perf prio + Sprints suivants santé).

2. **`_AUDIT/code-metrics-baseline.csv`** : matrice fichier × métriques (LOC, complexity max, hooks count, props count, dead code %, dups %, TS strict %, test coverage %).

3. **`_AUDIT/phaseA-perf-action-plan.md`** : actions Phase A priorisées (rapidité site).

4. **`_AUDIT/phaseB-health-action-plan.md`** : actions Phase B priorisées (santé long-terme).

5. **`_AUDIT/tooling-status.md`** : outils installés vs requis + commandes installation.

6. **`_AUDIT/scale-2150-villes-impact.md`** : analyse spécifique impact build/runtime avec 2 150 villes templates.

7. **`_AUDIT/code-health-maintenance-protocol.md`** : protocole audit récurrent (trimestriel) + KPIs + outils + cadence.

8. **5 livrables agents intermédiaires** (`phaseA-01` à `phaseB-02`).

---

## 🚦 PROTOCOLE STOP & ASK

À chaque jonction critique :

1. **Avant recommandation refactor majeur** d'un fichier > 500 lignes (god content/component) — Will valide le split proposé.
2. **Avant remplacement dépendance lourde** (Framer Motion, lodash) — Will valide migration cost vs gain.
3. **Avant changement strict TypeScript flags** — peut casser du code existant.
4. **Avant proposition installation outils non standards** (Lighthouse CI, Playwright visual regression) — engagement maintenance.
5. **Avant suppression de code suspecté mort** — vérifier triple (knip + tests + grep usages externes).
6. **Avant migration runtime edge ↔ node** — impact features (cookies, fs, etc.).
7. **Avant proposition Turborepo/Nx** — solo dev, sur-engineering possible.
8. **Avant recommandation scénario** (MIN/STANDARD/PERFECTION par phase).

---

## 📐 FORMAT DE SORTIE PRINCIPAL

Le rapport `AUDIT-CODE-HEALTH-2026.md` doit ouvrir sur :

```
# Audit Code Health 2026 — AxionIA

> Statut : DRAFT en attente validation Will
> Date : 2026-05-XX
> Référence HEAD : <sha>
> Périmètre : Phase A perf bundle + Phase B santé long-terme · ~150 fichiers · scale cible 2 150 villes

## 0. Synthèse exécutive (1 page)

**Score code health** : XXX / 160 (XX %).
**Phase A scoring** : XX/100.
**Phase B scoring** : XX/60.
**Top 5 quick wins Phase A (perf)** : <liste>.
**Top 10 dette Phase B (santé)** : <liste>.
**Estimation build time 2 150 villes** : XX min.
**Estimation gain bundle Phase A MIN** : XX KB / X% LCP improvement.
**Recommandation** : <scénario par phase>.
**Effort total estimé** : <jours-homme>.
**Décisions Will requises (8 STOP & ASK)** : <liste>.
```

Puis :

- Phase A : 5 chapitres × 10 critères avec scoring + diff annexes.
- Phase B : 6 chapitres × 10 critères avec scoring + diff annexes.

---

## 🎬 EXEMPLE DE LANCEMENT (pour Will)

> « Lance l'audit Code Health 2026 selon `_AUDIT/PROMPT-CODE-HEALTH-2026.md` (v1.0). Working dir : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`. Lis intégralement le prompt avant de démarrer. Lance les 5 agents parallèles + agent principal. Audit lecture seule strict (zéro modif code, juste diffs en annexe). Couvre Phase A (rapidité site quick wins) ET Phase B (santé long-terme refactor) — produire 2 plans d'action distincts mais consolidés. 8 STOP & ASK obligatoires sur les décisions critiques (refactor majeur, remplacement deps, TS strict, suppression code, etc.). Cible scale = 2 150 villes >5000 hab (toutes communes FR), pas 1160. Vise scénarios perfection par phase. Livre les 8 fichiers attendus dans `_AUDIT/` avec rapport principal `AUDIT-CODE-HEALTH-2026.md` consolidant tout + scoring /160 + matrice CSV baseline + protocole maintenance trimestriel. »

---

**Fin du prompt v1.0 · 2026-05-07.**
