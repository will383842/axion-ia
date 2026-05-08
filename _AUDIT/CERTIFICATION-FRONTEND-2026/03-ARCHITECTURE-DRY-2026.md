# 03 — ARCHITECTURE & DRY 2026

> Audit organisation fichiers, atomic design, naming, dead code, duplication.

## Audit en 7 chapitres × 10 critères = 70 points

### 1. App Router structure

1.1 Routes localisées sous `src/app/[locale]/`
1.2 1 dossier = 1 segment route, naming clair
1.3 Layouts hiérarchiques cohérents
1.4 `loading.tsx` granulaires (pas un seul global)
1.5 `error.tsx` à chaque route segment lourd
1.6 `not-found.tsx` granulaire si pertinent
1.7 Server Components par défaut (`"use client"` justifié)
1.8 Server Actions dans `actions/` ou co-localisées
1.9 Pas de fetch dans composants client (Server only)
1.10 Routes API dans `app/api/`, pas mélange

### 2. Atomic design

2.1 `components/ui/` = atoms primitifs (Button, Input, Badge)
2.2 `components/marketing/` = molecules (Cta, JsonLd)
2.3 `components/sections/` = organisms (CtaBlock, FaqSection)
2.4 `components/layout/` = templates (Section, Container)
2.5 `components/nav/` = navigation organisms (Header, Footer, Breadcrumbs)
2.6 `components/visual/` = primitives visuelles (Illustration, HeroSchema)
2.7 `components/calendar/` = features (BookingCalendar)
2.8 `components/analytics/` = invisibles (WebVitals)
2.9 `components/a11y/` = accessibility helpers (SkipToContent)
2.10 Pas de logique métier dans `components/` (déléguer à hooks/lib)

### 3. Naming conventions

3.1 Fichiers kebab-case (`hero-schema.tsx`)
3.2 Composants PascalCase (`HeroSchema`)
3.3 Hooks camelCase préfixés `use*`
3.4 Server actions verbes (`createBooking`, `validateAudit`)
3.5 Constants `SCREAMING_SNAKE_CASE` (`SITE_URL`, `MAX_BOOKINGS`)
3.6 Types préfixés `T*` ou suffixés `*Type` (cohérent partout)
3.7 Interfaces préfixées `I*` ou pas (cohérent)
3.8 Boolean préfixés `is/has/should` (`isPilot`, `hasAudit`)
3.9 Pas d'abréviation cryptique (`btn` ❌ → `button` ✅)
3.10 Naming i18n key cohérent (`section.subsection.key`)

### 4. Dead code & duplication

4.1 `depcheck` 0 dépendance inutilisée
4.2 `pnpm dedupe` clean
4.3 Knip ou ts-prune : 0 export non utilisé
4.4 0 fichier non importé
4.5 0 fonction définie 2× (DRY)
4.6 0 string hardcodée dupliquée (centraliser)
4.7 0 type dupliqué (centraliser dans `types/`)
4.8 0 component dupliqué (variants au lieu de copier)
4.9 0 logique dupliquée (extraire helper)
4.10 0 commenté code mort

### 5. Co-location vs centralisation

5.1 Tests co-localisés avec source (`*.test.ts` à côté)
5.2 Stories Storybook (si utilisé) co-localisées
5.3 Types privés à un composant : co-localisés
5.4 Types partagés : `types/`
5.5 Hooks partagés : `hooks/`
5.6 Hooks privés à un composant : co-localisés
5.7 Utils partagés : `lib/`
5.8 Constants : `lib/constants.ts` ou domain-specific
5.9 Schemas Zod : `lib/schemas/`
5.10 Pas d'index `barrel exports` excessifs (impact bundle)

### 6. Project root structure & module boundaries

6.1 Project root organisé : `src/`, `prisma/`, `tests/`, `public/`, `scripts/`, `docs/`, `_AUDIT/`, configs racine
6.2 Configs racine groupées et minimales (`next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `commitlint.config.mjs`, `lighthouserc.json`)
6.3 0 config orpheline / dépréciée
6.4 `package.json` scripts catégorisés (dev/build/lint/test/format/CI/db) + commentaires si nécessaire
6.5 Path aliases TS cohérents (`@/components/`, `@/lib/`, `@/hooks/`, `@/types/`, `@/content/`)
6.6 Imports utilisent toujours alias (jamais `../../../lib/foo`)
6.7 Module boundaries : `app/` peut importer de `components/` + `lib/` + `content/` ; `lib/` ne peut PAS importer de `components/` ou `app/` ; `components/` ne peut PAS importer de `app/`
6.8 Public vs private modules documentés (`_internal` prefix ou ESLint restricted-imports)
6.9 Folder depth max 4 niveaux (sinon refactor)
6.10 Pas de fichier > 400 LOC (sinon split)

### 7. Patterns code & error handling

7.1 Error handling cohérent (try/catch ou Result-like, jamais both mix)
7.2 Server Actions retournent shape uniforme (`{ ok: true, data }` ou `{ ok: false, error }`)
7.3 Validation Zod systématique aux frontières (Server Actions, API routes, parsing externe)
7.4 Async patterns sans race conditions (cancellation, AbortController)
7.5 Pas de promise leak (toujours await ou return)
7.6 Pas de fire-and-forget non documenté (commentaire si volontaire)
7.7 Pure functions privilégiées dans `lib/utils.ts`
7.8 Side effects isolés dans hooks ou Server Actions
7.9 Immutability respectée (pas de mutation de props/state direct)
7.10 Composition over inheritance (jamais de class hierarchy React)

## Méthode

- Phase A : `find src/`, `wc -l`, count files par dossier, audit aliases TS, audit `package.json` scripts
- Phase A bis : Audit module boundaries (madge ou grep imports)
- Phase B : Diagnostic /70
- Phase C : Plan refactor
- Phase D : STOP & ASK livre `audit-03-arch-*.md`
- Phase E : Application après GO

## STOP & ASK

1. Avant déplacement massif fichiers
2. Avant ajout `depcheck`/`knip`/`madge` deps
3. Avant changement path aliases TS (impact massif imports)
4. Avant changement module boundaries policy (ESLint restricted-imports)
5. Avant tout commit

## Anti-patterns à éviter (Pitfalls)

- ❌ Refactor « par esthétique » sans ROI mesurable
- ❌ Sur-engineering (DI, CQRS, Clean Arch sur projet solo dev — anti-ROI)
- ❌ Atomic design forcé partout (parfois 1 dossier feature suffit)
- ❌ Module boundaries violations « juste cette fois » (c'est toujours « une fois »)
- ❌ Path aliases changés sans migration imports (casse 100 fichiers)
- ❌ Folder depth > 4 niveaux (signal manquement architecture)
- ❌ Server Actions qui `throw` au lieu de retourner `{ ok: false }`

## Cible

> 70/70 = architecture exemplaire. Module boundaries enforcées par ESLint. 0 fichier > 400 LOC. Patterns error/async cohérents.

## Livrables

```
audit-03-arch-SYNTHESE.md
audit-03-arch-DIAGNOSTIC.md
audit-03-arch-PROJECT-STRUCTURE.md  (root + module boundaries map)
audit-03-arch-PATTERNS.md  (error/async/composition)
audit-03-arch-PLAN.md
```

## Complémentarité avec PROMPT-CODE-HEALTH-2026

Cet audit complète `_AUDIT/PROMPT-CODE-HEALTH-2026.md` (existing, 160 critères TS strictness, complexité, code mort, deps, tests). 03 cible **structure projet & atomic design**, CODE-HEALTH cible **engineering interne**. Pas de duplicate.
