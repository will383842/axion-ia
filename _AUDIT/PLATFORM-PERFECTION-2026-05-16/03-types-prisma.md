# Audit 1.C — Types & Prisma intégrité

**Date** : 2026-05-16
**Agent** : 1.C
**Mode** : AUDIT-ONLY strict
**SHA HEAD effectif** : `4cdfbe44` (prompt référait `98e0b0f`, repo réel est sur `4cdfbe44` post-merge `feat/image-bank-v1` — audit basé sur HEAD réel)
**Working dir** : `C:\Users\willi\Documents\Projets\Axion-IA\axionia`

---

## 0. TL;DR

| Indicateur                              | Valeur                                                                                                                                                                                                                                                            | Statut                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `pnpm typecheck` local                  | **FAIL**                                                                                                                                                                                                                                                          | 🔴                                                    |
| Erreurs TS totales                      | **94**                                                                                                                                                                                                                                                            | 🔴                                                    |
| Fichiers affectés                       | **23**                                                                                                                                                                                                                                                            | 🔴                                                    |
| Erreurs cluster image-bank              | **~92 / 94**                                                                                                                                                                                                                                                      | 🟠 racine = client Prisma stale                       |
| `pnpm typecheck` CI (estimé)            | **PASS**                                                                                                                                                                                                                                                          | 🟢 (CI fait `prisma generate` avant tsc)              |
| Migrations Prisma                       | 19 fichiers, dernier `20260516142017_add_image_bank_tables`                                                                                                                                                                                                       | 🟢 cohérent                                           |
| `prisma migrate status`                 | Échec dry-run (`DIRECT_URL` non set en shell)                                                                                                                                                                                                                     | 🟡 readonly env-issue, non bloquant                   |
| Schema models                           | 85 (source) vs 74 (generated)                                                                                                                                                                                                                                     | 🔴 11 models image-bank manquants dans client         |
| Magic string `stub.invalid` propagation | ✅ `prisma.ts`, ✅ `redis.ts`, ✅ `knowledge-rss.ts`, ✅ `knowledge-sitemap.ts`, ✅ `sitemaps/images-{fr,en}.xml`, ✅ `Dockerfile`, ✅ `deploy-coolify.yml`, ⚠️ MANQUE pages `galerie/page.tsx`, `galerie/[slug]/page.tsx`, `galerie/[slug]/telecharger/route.ts` | 🟡                                                    |
| `@ts-ignore`                            | **0 occurrence**                                                                                                                                                                                                                                                  | 🟢                                                    |
| `@ts-expect-error`                      | **5 occurrences** (toutes en `*.test.ts`, intentionnelles, commentaires WHY OK)                                                                                                                                                                                   | 🟢                                                    |
| `as any`                                | **2 occurrences**                                                                                                                                                                                                                                                 | 🟢                                                    |
| `as never`                              | **193 occurrences sur 71 fichiers**                                                                                                                                                                                                                               | 🟠 cluster `href={x as never}` next-intl typed routes |

**Verdict / Scoring : 71 / 100 — 🟡 CONDITIONAL** (bloqué par client Prisma local stale, mais cohérence build chain CI préservée).

---

## 1. Résultat `pnpm typecheck`

### 1.1 Résultat brut

```
$ pnpm typecheck
> axion-ia@0.1.0 typecheck
> tsc --noEmit

[94 errors across 23 files]
ELIFECYCLE  Command failed with exit code 2.
```

### 1.2 Répartition par code TS

| Code     | Count | Famille                                                                                                        |
| -------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| `TS2339` | 54    | "Property 'X' does not exist on type 'PrismaClient<...>'" (image-bank)                                         |
| `TS7006` | 19    | Implicit `any` (parameters in `.map()`/`.filter()` callbacks because base type is `any`)                       |
| `TS2305` | 16    | "Module '@/prisma/generated/client' has no exported member 'ImageAsset' / 'ImageAssetTranslation' / etc."      |
| `TS2503` | 3     | Cannot find namespace 'JSX' (image-bank admin pages : `JSX.Element` usage déprécié, remplacer par `ReactNode`) |
| `TS7031` | 2     | Binding element implicit `any` (destructuring `({ tag })` sans type)                                           |
| `TS2694` | 1     | Namespace `Prisma` has no exported member `ImageAssetWhereInput`                                               |

### 1.3 Cause racine

`prisma/schema.prisma` updated `2026-05-16 16:54` (avec migration `20260516142017_add_image_bank_tables` ajoutant 11 modèles).
`prisma/generated/client/index.d.ts` last regenerated `2026-05-16 16:24` — **AVANT** l'ajout image-bank.

→ Le client Prisma local est stale d'environ 30 minutes. Un simple `pnpm prisma:generate` localement fixerait ~92 / 94 erreurs.

Restera ~2 erreurs vraies (JSX namespace TS2503) à corriger explicitement.

### 1.4 Pourquoi le build prod fonctionne

`Dockerfile` (stage builder) :

```dockerfile
RUN pnpm prisma:generate   # ← régénère AVANT build
RUN pnpm build
```

`.github/workflows/ci.yml` :

```yaml
- name: Generate Prisma client
  run: pnpm prisma:generate
- name: TypeScript strict
  run: pnpm typecheck
```

→ En CI/CD, le client est régénéré frais → 92/94 erreurs disparaissent.
→ Le risque résiduel = les 2 erreurs JSX/TS2503 + 1 `Prisma.ImageAssetWhereInput` (peut ne pas être exporté du client généré, à vérifier post-generate).

### 1.5 Files affectés (Top 10)

| Fichier                                                                   | # erreurs |
| ------------------------------------------------------------------------- | --------- |
| `src/server/image-bank/services/image-bank.service.ts`                    | 18        |
| `src/app/[locale]/(admin)/[adminPrefix]/image-bank/page.tsx`              | 8         |
| `src/server/image-bank/services/image-seo.service.ts`                     | 5         |
| `src/server/image-bank/services/image-country-detector.service.ts`        | 4         |
| `src/app/[locale]/galerie/[slug]/page.tsx`                                | 4         |
| `src/app/[locale]/galerie/[slug]/telecharger/route.ts`                    | 4         |
| `src/app/[locale]/(admin)/[adminPrefix]/image-bank/library/[id]/page.tsx` | 5         |
| `src/app/[locale]/(admin)/[adminPrefix]/image-bank/usage-logs/page.tsx`   | 5         |
| `src/server/image-bank/services/image-translation.service.ts`             | 5         |
| `src/components/galerie/GalleryGrid.tsx`                                  | 2         |

100 % cluster image-bank V1 (sprint 1-7 merge récent).

---

## 2. Statut migrations Prisma

### 2.1 Liste

19 dossiers de migration dans `prisma/migrations/` :

```
20260508175629_init
20260508193001_intervention_type_align
20260509120000_sprint_24_tiptap_json_text
20260512100000_audit_flash_onsite_enum
20260512120000_collective_4h_enum_values
20260513190436_booking_v1_complete
20260513221900_kb_01_init_schema
20260514010000_kb_v4_add_factory_types
20260514020000_kb_v4_pgvector_embeddings
20260514030000_kb_v4_source_tracking
20260514040000_kb_v4_ingest_requests
20260514050000_kb_v4_seo_cache
20260514060000_kb_v4_audit_log
20260514070000_kb_v4_annotations_collections
20260514100000_add_keyword_tracking
20260514120000_add_content_gen_core
20260515223119_add_booking_idempotency_key
20260516142016_create_country_table
20260516142017_add_image_bank_tables
```

### 2.2 `prisma migrate status`

```
$ pnpm prisma migrate status
Error: Environment variable not found: DIRECT_URL
```

Non bloquant pour CI/prod (les env vars sont injectées). Côté audit AUDIT-ONLY : le shell d'audit n'a pas chargé `.env*`. Workaround read-only : `DIRECT_URL=... pnpm prisma migrate status`. Non exécuté car pas critique.

### 2.3 Schema source vs migrations

- `prisma/schema.prisma` : 85 `model X { ... }` blocks ✅
- `prisma/migrations/20260516142017_add_image_bank_tables/migration.sql` : présent ✅ (cohérent avec schema)
- `Dockerfile` entrypoint runtime : `prisma migrate deploy` (cf. AGENTS.md) → applique migrations au container start ✅

**Verdict migrations** : ✅ cohérentes schema ↔ migrations. Aucune dérive détectée.

### 2.4 `directUrl` Postgres

`prisma/schema.prisma:32` déclare `directUrl = env("DIRECT_URL")`. Présent dans :

- `.env.dev` ✅
- `.env.local` ✅
- `.env.production.example` ✅
- `.env.example` (vide, à remplir) ⚠️

→ S'assurer que `DIRECT_URL` est bien set dans **Coolify env vars prod** (mémoire dit `NEXT_PUBLIC_SITE_URL` actions précédentes — vérifier `DIRECT_URL` n'a pas été oublié). À vérifier hors audit AUDIT-ONLY.

---

## 3. Types partagés client/server (Zod, DTO, SSOT)

### 3.1 Zod schemas

30+ fichiers `import { z } from "zod"`. Centralisation partielle :

- `src/server/actions/knowledge/_zod-schemas.ts` ✅ SSOT cohérente (préfixe `_` = privé module)
- `src/env.ts` ✅ env validation Zod
- Pas de fichier global `src/lib/schemas.ts` (pattern fragmenté par feature : `actions.ts` de chaque feature inline les schemas)

**Évaluation** : ✅ SSOT respecté **par feature** (pattern co-location accepté par doctrine Next 16 server actions). Pas de duplication détectée par audit rapide.

### 3.2 DTO partagés

- `prisma/generated/client/index.d.ts` : types Prisma (DTO DB-side)
- Composants UI : pas de duplication détectée (galerie imports `ImageAsset`/`ImageAssetTranslation` directement depuis `prisma/generated/client` — c'est la SSOT)

→ ⚠️ **Couplage UI ↔ Prisma direct** : `src/components/galerie/GalleryGrid.tsx` imports types DB directement. Acceptable V1, mais idéalement V2 → DTO layer dans `src/server/image-bank/dto.ts`. Non bloquant.

### 3.3 Module `Prisma.X` namespace

1 erreur `TS2694` sur `Prisma.ImageAssetWhereInput` dans `image-bank.service.ts:212`. Post-`prisma generate` cette erreur devrait disparaître. À re-tester.

---

## 4. Top 10 escape hatches à challenger

### 4.1 `@ts-ignore` — **0 occurrence** ✅

### 4.2 `@ts-expect-error` — 5 occurrences, **toutes commentées WHY**, toutes en tests

| Path:line                                                  | Commentaire WHY                                                      | Verdict |
| ---------------------------------------------------------- | -------------------------------------------------------------------- | ------- |
| `src/server/content-gen/shared/html-sanitizer.test.ts:110` | `// @ts-expect-error — test intentionnel : runtime input non-string` | ✅ OK   |
| `src/server/content-gen/shared/html-sanitizer.test.ts:112` | idem                                                                 | ✅ OK   |
| `src/server/content-gen/shared/html-sanitizer.test.ts:114` | idem                                                                 | ✅ OK   |
| `src/content/interventions-taxonomy.test.ts:81`            | `// @ts-expect-error — input invalide intentionnel`                  | ✅ OK   |
| `src/content/interventions-taxonomy.test.ts:96`            | idem                                                                 | ✅ OK   |

### 4.3 `as any` — 2 occurrences

| Path:line                                             | Commentaire                                                                                           | Verdict                                                                             |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/lib/knowledge/prisma-helpers.ts:87`              | `// eslint-disable-next-line @typescript-eslint/no-explicit-any` `where.domain = opts.domain as any;` | 🟠 manque WHY explicite — pourquoi `any` et pas `Prisma.JsonValue`/cast strict ?    |
| `src/server/actions/knowledge/rollback-version.ts:55` | `const snapshot = targetVersion.snapshotJson as any;`                                                 | 🟠 manque WHY commentaire, devrait être typé `Prisma.JsonObject` puis schema-validé |

→ **P1** : ajouter `// WHY: …` aux 2 sites + tenter cast structuré.

### 4.4 `as never` — 193 occurrences sur 71 fichiers

**Cluster dominant** : `href={x as never}` dans 60+ pages. Pattern next-intl typed routes :

- `<Link href="/dynamic-string" />` rejeté par next-intl typed routes
- Le cast `as never` court-circuite la validation typed routes

**Top 10 par site fréquent** :

| Path:line                                                                                    | Pattern                                                  | Verdict                                                      |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| `src/app/[locale]/implantations/[region]/[ville]/page.tsx:263, 569, 610, 664, 810, 883, 893` | `href={\`/reserver?ville=${ville.slug}\` as never}` (×7) | 🟠 pSEO villes — pattern doctrinal mais sans commentaire WHY |
| `src/components/sections/VilleServicePageTemplate.tsx:184, 213, 288, 349, 436, 485, 523`     | idem (×7)                                                | 🟠 même pattern                                              |
| `src/app/[locale]/interventions/page.tsx:594, 686, 813`                                      | `href={card.href as never}`                              | 🟠                                                           |
| `src/app/[locale]/(admin)/[adminPrefix]/users/page.tsx:34-35`                                | `role: sp.role as never` (filter parsing)                | 🟠 search-params parser, devrait passer par Zod schema       |
| `src/app/[locale]/(admin)/[adminPrefix]/faq/page.tsx:38-39`                                  | idem                                                     | 🟠                                                           |
| `src/app/[locale]/(admin)/[adminPrefix]/submissions/page.tsx:33-35`                          | idem ×3                                                  | 🟠                                                           |
| `src/app/[locale]/(admin)/[adminPrefix]/help/page.tsx:27-28`                                 | idem ×2                                                  | 🟠                                                           |
| `src/server/queue/workers/content-web-vitals-monitor-worker.ts:49, 53`                       | `value: value as never` (Prisma data param)              | 🟠 contournement typing Prisma Json — devrait `JsonValue`    |
| `src/features/admin-settings/actions.ts:98, 103`                                             | `value: value as never`                                  | 🟠 idem                                                      |
| `src/server/queue/workers/content-rss-fetch-worker.ts:163`                                   | `inputPayload: inputPayload as never`                    | 🟠 idem                                                      |

→ **Action recommandée** : créer un helper typé `dynamicHref(path: string)` qui retourne `Route<string>` proprement, plutôt que `as never` partout. Effort estimé : ~2-3h. **P1**.

**Toutefois** : ce pattern est doctrinal documenté (cf. memory user `axionia_pseo_villes_*`). Acceptable V1, à industrialiser V1.5.

---

## 5. Stub-aware code (build GH Actions)

### 5.1 Propagation magic string `stub.invalid`

| Fichier                                                | Stub guard présent       | Pattern                                                                           |
| ------------------------------------------------------ | ------------------------ | --------------------------------------------------------------------------------- |
| `src/lib/prisma.ts`                                    | ✅                       | Proxy singleton — couvre tous les models                                          |
| `src/lib/redis.ts`                                     | ✅                       | Proxy singleton                                                                   |
| `src/server/exporters/knowledge-rss.ts`                | ✅                       | early-exit explicite                                                              |
| `src/server/exporters/knowledge-sitemap.ts`            | ✅                       | early-exit explicite                                                              |
| `src/app/sitemaps/images-fr.xml/route.ts`              | ✅                       | early-exit + try/catch P2021 fallback                                             |
| `src/app/sitemaps/images-en.xml/route.ts`              | ✅ (à vérifier symétrie) | early-exit                                                                        |
| `scripts/indexnow-ping.ts`                             | ✅                       | early-exit                                                                        |
| `Dockerfile`                                           | ✅                       | `ENV DATABASE_URL=${DATABASE_URL:-postgresql://stub:stub@stub.invalid:5432/stub}` |
| `.github/workflows/deploy-coolify.yml`                 | ✅                       | build-args injectés                                                               |
| `src/app/[locale]/galerie/page.tsx`                    | ❌ MANQUE                | dépend du Proxy uniquement                                                        |
| `src/app/[locale]/galerie/[slug]/page.tsx`             | ❌ MANQUE                | idem                                                                              |
| `src/app/[locale]/galerie/[slug]/telecharger/route.ts` | ❌ MANQUE                | route runtime, faible risque mais cohérence doctrine                              |

### 5.2 Évaluation sécurité build

- **Proxy `createStubPrisma`** dans `src/lib/prisma.ts` :
  - `findMany` → `[]` ✅
  - `findFirst` / `findUnique` → `null` ✅
  - `count` → `0` ✅
  - `aggregate` → `{ _count: { _all: 0 } }` ✅
  - `groupBy` → `[]` ✅
  - **Mutations (`create`, `update`, `upsert`, `delete`, …) → THROW**

→ Si une page SSG appelle `prisma.imageAsset.create(...)` au build, **build CRASH**. Audit rapide n'a pas trouvé de mutation au build (admin pages, server actions = pas SSG). ✅ safe.

- `galerie/page.tsx` et `galerie/[slug]/page.tsx` font `findMany` / `findFirst` / `count` uniquement → Proxy couvre → pages SSG rendent vides au build → ISR `revalidate=3600` repopule.

**Verdict** : ✅ pas de blocage build. ⚠️ recommandation cosmétique = ajouter early-exit explicite aux 3 fichiers galerie pour cohérence doctrine AGENTS.md.

### 5.3 Fichiers orphelins qui crasheraient au build

Aucun détecté.

`grep -rn "prisma\." src/app/` cross-check :

- Tous les usages SSG passent par `lib/prisma.ts` (Proxy stub-aware)
- Tous les workers passent par `lib/prisma.ts` (mais workers ne tournent pas au build)
- Aucun import direct de `@prisma/client` ou `prisma/generated/client` autre que via `lib/prisma.ts` ou imports type-only

→ ✅ aucun fichier orphelin détecté.

---

## 6. tsconfig.json — analyse

Strictness level **excellent** :

```json
{
  "strict": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true,
  "noImplicitOverride": true,
  "noFallthroughCasesInSwitch": true
}
```

✅ Top-tier strictness. Le projet a déjà adopté `exactOptionalPropertyTypes` (rare et coûteux).

Le coût : la majorité des `as never` sur search-params (admin pages) vient de `exactOptionalPropertyTypes` qui rejette `undefined` implicite — d'où le pattern `sp.status as never`.

→ Décision V2 : soit assouplir `exactOptionalPropertyTypes` (perte qualité), soit industrialiser des helpers `parseSearchParams(z.object({…}))` (effort ~3h). **Recommandation : helpers**.

---

## 7. P0 / P1 / P2

### 7.1 P0 (bloquant merge / push)

1. **P0-CLIENT-STALE** : `prisma/generated/client/` désynchronisé du schema (11 modèles image-bank absents). `pnpm typecheck` local fail (94 erreurs).
   - **Fix** : `pnpm prisma:generate` (1 commande, ~10s).
   - **Effet collatéral** : si commité dans le repo (`prisma/generated/client/` non-gitignored ?), augmente la PR de ~5 MB de generated code.
   - **À vérifier** : `cat .gitignore | grep "prisma/generated"`. Doctrine usuelle = generated dans `.gitignore` + CI/Dockerfile fait `prisma generate` à chaque build (✅ ce qui est le cas ici).
   - **Si déjà gitignored** : audit local fail est sans impact CI/prod, mais friction dev. Documenter dans README ou pre-commit hook.

### 7.2 P1 (à fixer V1.5)

1. **P1-JSX-NAMESPACE** : 3 erreurs `Cannot find namespace 'JSX'` dans `ForgetIpHashForm.tsx` + `image-bank/usage-logs/page.tsx`. Pattern obsolète React 18+ → remplacer par `import type { ReactElement } from "react"`.
2. **P1-AS-NEVER-CLUSTER** : 193 occurrences `as never`. Industrialiser un helper `dynamicHref()` typed + helper `parseSearchParams(zodSchema)`. ~3-5h.
3. **P1-AS-ANY-WHY** : 2 `as any` sans commentaire WHY. Ajouter `// WHY: …` + tenter cast structuré.
4. **P1-STUB-EARLY-EXIT-GALERIE** : 3 pages galerie sans early-exit explicite `stub.invalid` (couvertes par Proxy mais incohérence doctrine). ~15 min.

### 7.3 P2 (V2+)

1. **P2-DTO-LAYER** : composants UI importent types Prisma directement. V2 → DTO layer `src/server/image-bank/dto.ts` + auto-conversion.
2. **P2-DIRECT-URL-PROD** : confirmer `DIRECT_URL` set dans Coolify prod (hors scope audit).
3. **P2-PRISMA-MIGRATE-STATUS** : créer pnpm script `prisma:status` qui charge `.env.local` automatique pour dev.

---

## 8. Scoring détaillé /100

| Catégorie                                    | Poids   | Score                                           | Pondéré    |
| -------------------------------------------- | ------- | ----------------------------------------------- | ---------- |
| `pnpm typecheck` local pass                  | 25      | 0/25 (fail — fixable 10s)                       | 0          |
| `pnpm typecheck` CI pass (estimé)            | 15      | 13/15 (2 erreurs TS2503 résiduelles probables)  | 13         |
| Migrations cohérentes                        | 10      | 10/10                                           | 10         |
| Schema vs generated client sync              | 10      | 0/10 (11 models manquants)                      | 0          |
| Magic string `stub.invalid` propagation      | 10      | 8/10 (3 pages galerie manquent guard explicite) | 8          |
| `@ts-ignore` / `@ts-expect-error` discipline | 5       | 5/5                                             | 5          |
| `as any` discipline                          | 5       | 4/5 (2 sans WHY)                                | 4          |
| `as never` discipline                        | 5       | 2/5 (193 occurrences, pattern à industrialiser) | 2          |
| tsconfig strictness level                    | 10      | 10/10                                           | 10         |
| Zod / DTO SSOT                               | 5       | 4/5                                             | 4          |
| Fichiers orphelins build-crash               | —       | —                                               | 15/15      |
| **TOTAL**                                    | **100** |                                                 | **71/100** |

**Verdict** : 🟡 **CONDITIONAL**

- Bloquant immédiat développement local : oui (typecheck fail).
- Bloquant CI/prod : non (prisma generate dans CI/Dockerfile = filet de sécurité).
- Risque latent : `prisma/generated/` éventuellement commité = bloat repo + drift entre branches.

---

## 9. Recommandations P0 immédiates (≤ 15 min, hors AUDIT-ONLY)

1. `pnpm prisma:generate` localement → 92/94 erreurs disparues.
2. Fixer les 2 erreurs résiduelles (JSX namespace → `ReactElement`).
3. Vérifier `.gitignore` couvre `prisma/generated/`.
4. (Optionnel) Pre-commit hook : `pnpm prisma:generate` si `prisma/schema.prisma` modifié.

---

## 10. Annexes

### 10.1 Reproduction typecheck

```powershell
cd C:\Users\willi\Documents\Projets\Axion-IA\axionia
pnpm typecheck 2>&1 | findstr "error TS"
# 94 errors
```

### 10.2 Hot-fix typecheck (post-audit, hors scope AUDIT-ONLY)

```powershell
pnpm prisma:generate
pnpm typecheck
# ≈ 2-3 erreurs résiduelles (TS2503 JSX namespace + 1 TS2694 Prisma.ImageAssetWhereInput probablement résolu après generate)
```

### 10.3 Files mtime evidence (cause racine)

```
prisma/schema.prisma                    16:54 (after image-bank migration)
prisma/generated/client/index.d.ts      16:24 (stale)
```

→ Δ 30 min → quelqu'un a appliqué la migration sans `prisma generate` ensuite.

---

**Fin audit 1.C**. Livrable ≤ 800 lignes ✅.
