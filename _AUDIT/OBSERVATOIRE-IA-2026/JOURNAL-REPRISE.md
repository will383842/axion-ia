# Observatoire IA 2026 — Journal de reprise

> **Lire en premier en cas de reprise.** Mis à jour au fil de l'implémentation.
> Source du cahier des charges : `_AUDIT/PROMPT-OBSERVATOIRE-IA-2026.md`.

## Contexte & emplacement

- **Worktree isolé** : `.claude/worktrees/observatoire-ia` — branche **`feat/observatoire-ia`** (basée sur `origin/main` `24655e04`).
- **Rien n'est poussé.** DB dev Postgres `localhost:5433` (`axion_ia_dev`) — outillage validé (node_modules, client Prisma généré, migrations à jour).
- Pour relancer les commandes Prisma/seed, exporter d'abord l'env :
  `set -a && eval "$(grep -E '^(DATABASE_URL|DIRECT_URL)=' .env.local)" && set +a`

## Décisions verrouillées (validées avec Will)

1. **Intégrité** : système 100 % fonctionnel ET honnête. Le seed de 8 627 est une **fixture DEV** (marquée `visitor_id LIKE 'seed:%'`, idempotente, n'efface jamais les vraies réponses) — **jamais lancé au deploy prod**. En prod, la page affiche l'**effectif réel** du snapshot ; tant qu'il est vide → état « enquête en cours » (aucun chiffre fabriqué publié).
2. **Comptages dérivés des SSOT** (jamais figés) : **30 secteurs** (`KB_SECTOR_TAGS`), **13 régions** métropole (`regions.ts`), **4 tailles** (enum `CompanySize`). (Le prompt disait 18/5 — corrigé.)
3. **Slugs routing `fr = en`** (`/observatoire-ia`) pour éviter le bug 307 next-intl.
4. **`barometer_insight` hors wizard** de campagne (piloté par l'action admin `generateBarometerArticle`).
5. **Enum dédié ajouté** : `CompetitorsUseAi` (Q6, nécessaire au KPI « 72 % concurrents » + agrégation indexée). 10 enums dédiés au total.

## État par tranche

- [x] **T1 — Schéma + migration + enums** ✅ vérifié sur DB réelle.
  - `schema.prisma` : `ContentType += barometer_insight` ; 10 enums dédiés ; modèles `BarometerResponse` + `BarometerSnapshot`.
  - Migration **`prisma/migrations/20260616193000_observatoire_ia_2026/migration.sql`** — **STRICTEMENT ADDITIVE** (⚠️ NE PAS régénérer via `migrate diff` global : il propose des DROP FTS/vector/`opco_baremes` liés à la dérive prod connue). Appliquée via `migrate deploy`. Client régénéré. Smoke-test insert/upsert/count OK.
- [x] **T2 — SSOT étude + questionnaire + i18n** ✅
  - `src/content/observatoire/study.ts` (métadonnées dérivées SSOT), `questions.ts` (16 questions, `value` = slugs EN alignés enums Prisma — **cross-check passé**).
  - Namespace i18n `observatoire` dans `fr.json` + `en.json`. **`pnpm i18n:check` vert (599 clés)**.
- [x] **T3 — Seed + snapshot** ✅ vérifié sur DB réelle.
  - `prisma/seeds/barometer/index.ts` (mulberry32 graine fixe, distributions+corrélations, ~12 % EN, dates jan-fév 2026, idempotent). Script `pnpm barometer:seed`.
  - Module centralisé **`src/server/observatoire/snapshot.ts`** : `aggregateBarometer(filter)`, `recomputeAndPersistSnapshot()`, `readLatestSnapshot()`, `emptySnapshotPayload()`.
  - Résultat : 8 627 exact, idempotent, tailles 45/37/13/4, EN 12 %, KPIs 73/56/75/59.
- [~] **T4 — Page résultats + CSV + JSON-LD + SEO + routing/footer** (EN COURS, quasi fini)
  - ✅ `routing.ts` (+2 pathnames), `routes.ts` (+`barometre`/`barometreParticiper`), `Footer.tsx` (+lien) — wiring vérifié runtime.
  - ✅ `src/components/observatoire/DistributionChart.tsx` (SSR, table sémantique + barres CSS, CLS 0).
  - ✅ `src/components/observatoire/ObservatoireFilters.tsx` (form GET natif, zéro JS).
  - ✅ `src/app/[locale]/observatoire-ia/page.tsx` (H1 nom officiel, H2 constats `.direct-answer`, méthodo `dl`, filtres+charts, citer, FAQ, CTA ; JSON-LD `Dataset`+`WebPage` speakable+`FAQPage` ; `buildProductMetadata` ; ISR 3600 ; fallback stub). **ESLint clean.**
  - ✅ `src/app/api/observatoire/export-csv/route.ts` (agrégats CC BY, force-dynamic/nodejs).
  - ✅ FAQ i18n ajoutée (4 Q/R), parité 599 clés.
  - **RESTE T4** : llms.txt (ajouter l'URL en T9) ; build réel de la route (T9).
  - **Commit `772e34ce`** (T1-T4, tous hooks verts).
- [x] **T5 — Formulaire public + Server Action** ✅ (typecheck+lint OK)
  - `src/server/actions/observatoire/public.ts` (`submitBarometerResponse`, Zod strict `z.nativeEnum`, honeypot `website` + horodatage MIN_FILL 3s + rate-limit IP, hashIp anonyme, Sentry, PAS de requireAdmin, pas de recompute synchrone).
  - `src/components/observatoire/BarometerForm.tsx` (client, multi-étapes, satisfaction conditionnelle maturité≥POC, honeypot, barre de progression) + `participer/page.tsx` (résout libellés i18n+SSOT).
- [x] **T6 — Dashboard admin + nav** ✅ (typecheck+lint OK)
  - `src/server/actions/observatoire/admin.ts` (`requireAdmin` : `getBarometerStats` réel vs seedé, `recomputeBarometerSnapshot` + `recomputeBarometerSnapshotForm` + revalidatePath).
  - `(admin)/.../content-gen/observatoire/page.tsx` + `_v2/ObservatoireV2.tsx` (AdminPageShell wide, effectifs, KPIs, bouton recalcul).
  - `admin-nav.ts` : entrée groupe content_gen / subGroup « suivre ».
  - **CHOIX** : recalcul = Server Action (bouton admin). ⚠️ Worker BullMQ cron de recalcul auto NON fait (évite de toucher `workers[]` partagé) → **suivi à faire** : cron de recompute périodique en prod.
- [ ] **T7 — Presse enrichie** (`content/press.ts` + `presse/page.tsx`, bloc Observatoire, fallback honnête).
- [ ] **T8 — Générateur `barometer_insight`** (`generators/barometer-insight.ts` + `index.ts` REGISTRY + `registry-phase8.spec.ts` + `WIZARD_*` + `CONTENT_TYPE_TO_KB_TYPE` ; injection « DONNÉES VÉRIFIÉES » du snapshot façon `local-anchor`).
- [ ] **T9 — Vérif globale** : `typecheck` (NODE_OPTIONS heap 8G), `test` ciblés, `i18n:check`, build route, checklist §10. **Pas de push (Will décide).**

## Pièges / rappels

- Migration : ⚠️ additive uniquement (dérive prod). Client Prisma importé en **relatif** (`../../prisma/generated/client`).
- `snapshot.ts` lit via `@/lib/prisma` (stub-safe : groupBy/$queryRaw/count → [] / 0 au build).
- Page : `searchParams` rend la route dynamique pour les vues filtrées ; vue par défaut = snapshot.
- `barometer_insight` : penser à MAJ `WIZARD_CONTENT_TYPES`/`WIZARD_SECTIONS`/`CONTENT_TYPE_TO_KB_TYPE` sinon le test registry casse.
- Bug connu `ArticleTranslation.wordCount` absent → gérer à la publication de l'article baromètre (T8).
