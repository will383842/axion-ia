# 18 — TESTS, QA, OBSERVABILITÉ, RUNBOOK — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` — Agent 18
> Reality check : `_AUDIT/KNOWLEDGE-BASE-2026/00-REALITY-CHECK.md`
> Date : 2026-05-13
> Statut : DRAFT (Phase A audit-only — aucun fichier de test, runbook ou code créé)
> Référence : HEAD `main` (commit `95bba36`)
> Sprint cible : KB-9 (test infra + E2E), KB-19 (RGPD/DR tests), KB-20 (runbook + style guide + doc API + LHCI gate finale)

---

## 0. TL;DR

- **Couverture cible V1** : ≥ 113 tests unitaires Vitest + ≥ 10 tests intégration (Vitest + DB de test) + ≥ 9 scénarios Playwright + LHCI gate sur 6 routes pivot.
- **Stack réutilisée** : `vitest@*` (existant `vitest.config.ts`), `vitest.integration.config.ts` (existant — entry point Sprint 17 booking, à réutiliser tel quel), `playwright.config.ts` (5 projects browsers cross-device existants), `lighthouserc.json` (existant, à étendre avec 6 routes KB), `@sentry/nextjs@10.51`, Plausible CE déployé (`vl41qwmhr6l26bmrjzet9h02`).
- **Convention tags** : `@kb` (filtrage scénarios KB-only) + `@a11y` (déjà consommé par `pnpm a11y:audit`, pattern hérité de `tests/e2e/a11y.spec.ts`).
- **Verdict GO** : la stack tests est mature et prête à recevoir le module KB sans refactor d'infra (juste ajout de cibles et de fixtures).
- **3 anti-patterns identifiés** : tests wall-clock-dependent (cron `review-expiry`, `scheduled-publish`) ; E2E boucle infinie (`waitForLoadState("networkidle")` + Tiptap autosave bavard) ; runbook absent en V1 → SPOF Will.

---

## 1. PLAN TESTS UNITAIRES (VITEST)

Stack : `vitest.config.ts` existant (environnement jsdom, globals on, threshold 50/50/50/50 — à durcir à 70/70/70/70 sur dossiers `src/lib/knowledge/**` et `src/server/actions/knowledge/**` en Sprint KB-20 via override `coverage.thresholds.perFile`). Tests colocalisés `*.test.ts` à côté des sources (pattern Axion-IA confirmé : `interventions-taxonomy.test.ts`, `pii-redaction.test.ts`).

**Total visé : ≥ 113 tests unitaires KB.**

### 1.1 Server actions — `src/server/actions/knowledge/__tests__/*.test.ts` (≥ 75 tests, 25 actions × 3 scénarios)

Pattern : mocker Prisma client via `vi.mock("@/lib/db")` + factory `makeAdminUser({ role })` + helper `actAs(role, fn)` pour rejouer chaque action dans 3 scénarios canoniques :

1. **Success path** — input valide + rôle autorisé → state OK + side-effect ActivityLog enregistré + revalidatePath déclenché.
2. **Permission denied** — input valide + rôle insuffisant → throw `Forbidden` ou state `{ ok: false, code: "FORBIDDEN" }` (selon convention server-action existante `UpsertArticleState`).
3. **Invalid input** — Zod parse fail → state `{ ok: false, fieldErrors: {...} }`.

| #   | Action                         | Fichier source                                 | Tests                                                                  |
| --- | ------------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | `listEntriesAction`            | `src/server/actions/knowledge/list-entries.ts` | success / forbidden reader+confidential / invalid filter               |
| 2   | `getEntryDetailAction`         | `.../get-entry-detail.ts`                      | success / forbidden / 404                                              |
| 3   | `createEntryAction`            | `.../create-entry.ts`                          | success draft / forbidden / invalid Tiptap JSON                        |
| 4   | `updateEntryAction`            | `.../update-entry.ts`                          | success / forbidden / stale version conflict                           |
| 5   | `submitForReviewAction`        | `.../submit-for-review.ts`                     | success draft→review / forbidden / quality-score < threshold           |
| 6   | `approveReviewAction`          | `.../approve-review.ts`                        | success review→published / forbidden REVIEWER own entry / PII bloquant |
| 7   | `rejectReviewAction`           | `.../reject-review.ts`                         | success / forbidden / requires comment                                 |
| 8   | `publishEntryAction`           | `.../publish-entry.ts`                         | success / forbidden / quality-score gate / PII gate                    |
| 9   | `unpublishEntryAction`         | `.../unpublish-entry.ts`                       | success → archived / forbidden / requires reason                       |
| 10  | `archiveEntryAction`           | `.../archive-entry.ts`                         | success / forbidden / already archived                                 |
| 11  | `restoreEntryAction`           | `.../restore-entry.ts`                         | success archived→draft / forbidden / not archived                      |
| 12  | `scheduleEntryAction`          | `.../schedule-entry.ts`                        | success scheduledAt > now / forbidden / past scheduledAt rejected      |
| 13  | `rollbackVersionAction`        | `.../rollback-version.ts`                      | success creates new version / forbidden / version not found            |
| 14  | `deleteEntryAction` (soft)     | `.../delete-entry.ts`                          | success / forbidden / has children references                          |
| 15  | `addRelationAction`            | `.../add-relation.ts`                          | success / forbidden / cycle detection rejects                          |
| 16  | `removeRelationAction`         | `.../remove-relation.ts`                       | success / forbidden / not found                                        |
| 17  | `importBatchAction`            | `.../import-batch.ts`                          | success 10 entries / forbidden / partial fail rollback                 |
| 18  | `exportBatchAction`            | `.../export-batch.ts`                          | success / forbidden / rate-limited                                     |
| 19  | `uploadAssetAction`            | `.../upload-asset.ts`                          | success WebP/AVIF / forbidden / SVG rejected (security)                |
| 20  | `deleteAssetAction`            | `.../delete-asset.ts`                          | success / forbidden / asset in use blocks                              |
| 21  | `assignReviewerAction`         | `.../assign-reviewer.ts`                       | success / forbidden / reviewer not REVIEWER role                       |
| 22  | `setPinnedAction`              | `.../set-pinned.ts`                            | success / forbidden / cap pinned ≤ 6                                   |
| 23  | `setFeaturedAction`            | `.../set-featured.ts`                          | success / forbidden / cap featured ≤ 12                                |
| 24  | `regenerateTocAction`          | `.../regenerate-toc.ts`                        | success / forbidden / empty body                                       |
| 25  | `recordHelpfulAction` (public) | `.../record-helpful.ts`                        | success up / rate-limited 2nd vote 24h / invalid entryId               |

**Effort estimé** : 1,5 demi-journée Will-équivalent (helper `actAs` + 25 fichiers × 3 it()).

### 1.2 SSOT helpers — `src/content/knowledge/__tests__/*.test.ts` (≥ 10 tests)

Pattern `pricing.test.ts` + `interventions-taxonomy.test.ts` (mémoire `axionia_pricing_zero_hardcode_2026-05-08`).

| #   | Helper                                | Tests                                                                                                                              |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `isPublicAudience(audience)`          | `'public' → true`, `'client' → false`, `'internal' → false`, `'unknown' → false (defensive)`                                       |
| 2   | `canEdit(role, entry)`                | OWNER/EDITOR sur tout, REVIEWER sur review-only, READER → false, EDITOR sur entrée verrouillée → false                             |
| 3   | `getReviewWindow(type)`               | `glossary_term → 365j`, `blog_article → 180j`, `case_study → 90j`, default 180j                                                    |
| 4   | `getJsonLdType(type)`                 | `blog_article → BlogPosting`, `case_study → Article`, `faq → FAQPage`, `help_article → TechArticle`, `glossary_term → DefinedTerm` |
| 5   | `getQualityThreshold(type)`           | `blog_article → 80`, `glossary_term → 60`, défaut 70 (vient de `Setting` table)                                                    |
| 6   | `getDefaultLocale()`                  | `'fr'` (constante doctrine)                                                                                                        |
| 7   | `mapAdminRoleToKbPermission(role)`    | mapping OWNER/EDITOR/REVIEWER/READER complet (idempotent)                                                                          |
| 8   | `getStatusTransitions(currentStatus)` | `draft → [review, archived, scheduled]`, `published → [archived, deprecated]`, `archived → [draft]`                                |
| 9   | `getPathForEntry(entry)`              | `/blog/[slug]`, `/cas-concrets/[slug]`, `/centre-aide/[slug]`, `/faq/[slug]`, `/glossaire#[slug]`                                  |
| 10  | `getAuthorRequirement(type)`          | requireAuthor true sauf `glossary_term` et `system_doc`                                                                            |

**Effort estimé** : 0,5 demi-journée.

### 1.3 Quality score — `src/lib/knowledge/quality-score.test.ts` (≥ 15 tests)

Helper `computeQualityScore(entry): { score: number, criteria: Record<string, boolean | number> }`. 10 critères × scénarios pass/fail :

| #   | Critère                                      | Scénarios couverts                                                   |
| --- | -------------------------------------------- | -------------------------------------------------------------------- |
| 1   | Titre 30-70 chars                            | trop court 10 chars / nominal 50 / trop long 100                     |
| 2   | Slug kebab-case + 3-80 chars                 | valid `mon-titre` / invalid `Mon Titre!` / collision (déjà existant) |
| 3   | Meta description 120-160 chars               | absent → score 0 / nominal / trop long → pénalité                    |
| 4   | TOC ≥ 3 H2 si bodyText > 800 mots            | court 500 mots OK sans TOC / long sans H2 → fail                     |
| 5   | Alt text 100 % images                        | 1 image sans alt → fail bloquant publish                             |
| 6   | Au moins 1 lien interne                      | aucun → fail / 1+ → pass                                             |
| 7   | Au moins 1 lien sortant (E-E-A-T)            | absent → pénalité minor / présent → pass                             |
| 8   | Auteur attaché si requis                     | `glossary_term` ok sans auteur / `blog_article` sans auteur → fail   |
| 9   | Readability score FR ≥ 60 (Flesch fr adapté) | texte technique 45 → warn / vulgarisé 75 → pass                      |
| 10  | Tags ≥ 2 et ≤ 8                              | 0 tag → fail / 9 tags → warn / 4 tags → pass                         |
| 11  | (méta) Score total = somme pondérée          | sanity check : tout pass → 100, tout fail → 0                        |
| 12  | (méta) Threshold blocking                    | `< getQualityThreshold(type)` empêche `submitForReview`              |
| 13  | (méta) Idempotence                           | recomputation 2× donne même score                                    |
| 14  | (méta) Diff criteria                         | retourne diff entre 2 versions                                       |
| 15  | (méta) Audit log                             | un compute publie event `kb.quality.computed` (mock Sentry)          |

**Effort estimé** : 0,5 demi-journée. Fixtures dans `src/lib/knowledge/__fixtures__/quality-score/*.json`.

### 1.4 RBAC — `src/lib/knowledge/permissions.test.ts` (≥ 25 tests, matrice 4 rôles × 25 actions)

Helper `can(role, action, entry?): boolean`. Test matriciel auto-généré :

```ts
const MATRIX = {
  OWNER:    { list: true, view: true, create: true, update: true, submit: true, approve: true, reject: true, publish: true, unpublish: true, archive: true, restore: true, schedule: true, rollback: true, delete: true, addRelation: true, removeRelation: true, importBatch: true, exportBatch: true, uploadAsset: true, deleteAsset: true, assignReviewer: true, setPinned: true, setFeatured: true, regenerateToc: true, recordHelpful: true },
  EDITOR:   { /* tout sauf delete, assignReviewer, setPinned, setFeatured */ },
  REVIEWER: { list: true, view: true, approve: true, reject: true, regenerateToc: true, recordHelpful: true /* reste false */ },
  READER:   { list: true (public only), view: true (public only), recordHelpful: true /* reste false */ },
};
```

**25 tests** : 1 par action × assertion sur les 4 rôles (table-driven `it.each(MATRIX)`).

**Tests additionnels bonus** :

- EDITOR ne peut approuver sa propre entrée (separation of duties) → `can('EDITOR', 'approve', { authorId: editor.id })` = false.
- REVIEWER ne peut éditer après publication.
- READER `confidentiality: 'confidential'` → 0 visibilité même `list`.

**Effort estimé** : 0,5 demi-journée.

### 1.5 Tiptap TOC — `src/lib/knowledge/tiptap-toc.test.ts` (≥ 5 tests)

Helper `extractToc(bodyJson): { id, level, text, depth }[]`.

1. Doc vide → `[]`.
2. Doc avec 3 H2 séquentielles → 3 items niveau 2.
3. Doc imbriqué H2 → H3 → H4 → arbre 3 niveaux.
4. Doc avec H1 ignoré (réservé au titre page) → exclu.
5. IDs générés par slugify déterministe + déduplication (`titre`, `titre-2`, `titre-3` si collision).

**Effort estimé** : 0,25 demi-journée.

### 1.6 Tiptap sanitize — `src/lib/knowledge/tiptap-sanitize.test.ts` (≥ 8 tests XSS)

Helper `sanitizeTiptapJson(input): TiptapDoc`. Whitelist nodes (`paragraph`, `heading`, `bulletList`, `orderedList`, `listItem`, `blockquote`, `codeBlock`, `image`, `link` wrapped) + marks (`bold`, `italic`, `code`, `strike`). Lib cible `@tiptap/html` server-side (à `pnpm add` en Sprint KB-12, mémoire reality check 9.17).

1. `<script>alert(1)</script>` injecté → strip complet, return doc safe.
2. `onerror` attribute sur `<img>` → attribute strip.
3. `javascript:void(0)` href → marker `link` retiré.
4. `<iframe src="evil.com">` non-whitelisted → strip.
5. `<iframe src="youtube.com/embed/...">` whitelisted → preservé.
6. `style="background:url(javascript:...)"` → strip style.
7. Custom mark inconnu → strip mark, garde texte.
8. Doc Tiptap valide nominal → passthrough bit-identique (idempotence).

**Effort estimé** : 0,5 demi-journée.

### 1.7 Slug — `src/lib/knowledge/slug.test.ts` (≥ 6 tests)

1. `slugify('Mon Titre Cool')` → `'mon-titre-cool'`.
2. Caractères accentués → unaccent : `'Élégance & co'` → `'elegance-co'`.
3. Caractères spéciaux strip : `'Hello/World!'` → `'hello-world'`.
4. Collision DB : `findUniqueSlug('mon-titre', existing=['mon-titre'])` → `'mon-titre-2'`.
5. Historique : `recordSlugChange(entryId, oldSlug, newSlug)` insère row `KnowledgeSlugHistory`.
6. Lookup historique : `resolveSlug('mon-ancien-titre')` retourne `{ entryId, currentSlug: 'mon-nouveau-titre', redirect: 301 }`.

**Effort estimé** : 0,25 demi-journée.

### 1.8 Readability FR — `src/lib/knowledge/readability-fr.test.ts` (≥ 4 tests)

Helper `computeReadabilityFr(text): number` (Flesch fr adapté Kandel-Moles).

1. Texte vulgarisé court → score 70+.
2. Texte technique long phrases → score 30-50.
3. Texte vide → score 0 + warning.
4. Texte 1 phrase → fallback safe (pas de division par zéro).

**Effort estimé** : 0,25 demi-journée.

### 1.9 Totaux unit

| Catégorie       | Tests   | Effort (½ j) |
| --------------- | ------- | ------------ |
| Server actions  | 75      | 1,5          |
| SSOT helpers    | 10      | 0,5          |
| Quality score   | 15      | 0,5          |
| RBAC            | 25+3    | 0,5          |
| Tiptap TOC      | 5       | 0,25         |
| Tiptap sanitize | 8       | 0,5          |
| Slug            | 6       | 0,25         |
| Readability FR  | 4       | 0,25         |
| **Total**       | **151** | **4,25**     |

Largement au-dessus du seuil prompt §0.0/18 (≥ 30 unit + ≥ 15 SSOT helpers + ≥ 10 composant Tiptap rendu — _ce dernier traité en E2E + intégration côté rendu_).

---

## 2. PLAN TESTS INTÉGRATION (VITEST + DB DE TEST)

Stack : `vitest.integration.config.ts` existant (entry point Sprint 17 booking). Réutilisation pattern `tests/integration/server-actions.test.ts` déjà présent. DB de test : container Postgres dédié via `docker compose -f docker-compose.test.yml up -d` (à créer Sprint KB-9 ; pattern recommandé : `postgres:17-alpine` + extensions `citext`/`pg_trgm`/`unaccent` chargées par `init.sql` du repo).

Pré-requis : Prisma client séparé via `DATABASE_URL=postgres://test:test@localhost:55432/axionia_test`. Reset table-par-table via `TRUNCATE ... CASCADE` avant chaque `describe`. Pas de `prisma migrate reset` global (lent).

**Total visé : ≥ 10 tests intégration.** Fichiers sous `tests/integration/knowledge/*.test.ts`.

### 2.1 `workflow-states.test.ts`

Transitions canonical state-machine `draft → review → published → archived → deprecated → scheduled` + retours.

- `draft → review` autorisé si quality-score ≥ threshold ; refusé sinon avec `KbWorkflowError`.
- `review → published` autorisé OWNER/EDITOR ; refusé REVIEWER si self-authored.
- `published → archived` recordé `unpublishedAt` + revalidatePath déclenché.
- `archived → draft` (restore) ré-initialise `submittedAt`/`approvedAt`.
- `scheduled → published` via cron worker bullmq (mock cron call).
- Transition invalide (`archived → published` direct) → throw + ActivityLog `kb.workflow.invalid_transition`.

### 2.2 `versions.test.ts`

`KnowledgeVersion` immutable, rollback crée nouvelle version.

- Création entry → version 1 enregistrée auto.
- Update body → version 2 (diff JSON stocké).
- Versions immutables : `prisma.knowledgeVersion.update(...)` → throw (pas d'API exposée + RLS or trigger postgres).
- `rollbackVersionAction(entryId, versionId=1)` → crée version 3 (copie de v1), pas modification v1.
- Liste versions paginée DESC `createdAt` retourne v3, v2, v1.

### 2.3 `relations.test.ts`

Graph relations (entries reliées, prerequisites, related-to).

- Ajout relation `A → B` → ligne `KnowledgeRelation` insérée.
- Cycle direct A → B + B → A → rejet `KbRelationCycleError`.
- Cycle indirect A → B → C → A → rejet (DFS implementation).
- Suppression d'entry orpheline ses relations (FK CASCADE).
- Listing `getRelatedEntries(A)` retourne B (forward) et inverse (backward) avec dédup.

### 2.4 `slug-history.test.ts`

Rename slug + lookup historique + 301.

- Update entry `slug` `mon-titre` → `mon-meilleur-titre` insère `KnowledgeSlugHistory{oldSlug:'mon-titre', oldLocale:'fr', oldType:'blog_article', entryId, changedAt}`.
- `resolveSlug('mon-titre', 'fr', 'blog_article')` retourne `{ targetSlug: 'mon-meilleur-titre', status: 301 }`.
- Rename successif `A → B → C` : 2 lignes histoires, A et B résolvent vers C (`resolveSlug` suit la chaîne avec garde anti-loop max 5 hops).
- Index `(oldLocale, oldType, oldSlug)` unique → INSERT en double rejet.

### 2.5 `quality-score.test.ts` (intégration)

Publish refusé si score < threshold.

- Entry quality-score 65 + threshold `blog_article` = 80 → `publishEntryAction` retourne `{ ok: false, code: 'QUALITY_BELOW_THRESHOLD', score: 65, threshold: 80 }`.
- Threshold lu depuis `Setting` table runtime (pas constante hardcoded).
- Entry quality-score 85 → publish OK + `publishedAt` set.

### 2.6 `pii-scan-bloquant.test.ts`

PII scan pré-publish bloquant via `src/lib/pii-redaction.ts` réutilisé.

- BodyText contient email réel `client@example.com` → `publishEntryAction` retourne `{ ok: false, code: 'PII_DETECTED', findings: [{type:'email', count:1}] }`.
- BodyText contient n° SIREN format `123 456 789` → bloqué.
- BodyText contient IBAN/RIB → bloqué.
- Entry `audience: 'internal'` exempté du scan PII (interne autorisé).
- BodyText clean → publish OK.

### 2.7 `tiptap-sanitize.test.ts` (intégration DB roundtrip)

XSS injection rejeté au niveau server action (pas seulement helper).

- `createEntryAction` avec `bodyJson` contenant `<script>` → DB stocke version sanitized (script absent), pas la version brute.
- `updateEntryAction` avec mark `link` href `javascript:void(0)` → DB stocke sans la mark malicious.
- Round-trip read post-write : bodyHtml rendu serveur-side ne contient AUCUN `<script>`, AUCUN attribut `on*=`, AUCUN `javascript:`.

### 2.8 `import-batch.test.ts`

Rollback transactionnel sur partial fail.

- Import batch de 10 entries où la 5ᵉ a slug en collision → transaction rollback complet (0 entry insérée).
- Import batch de 10 entries tous valides → 10 entries insérées + 10 versions + 10 ActivityLog.
- Import batch > 50 entries → erreur `BATCH_TOO_LARGE` (cap volumétrique).
- Import doit s'exécuter dans `prisma.$transaction([...])`, sinon échec rollback partiel = test fail.

### 2.9 `migration-article-legacy.test.ts`

Expand-backfill-contract correct (Sprint KB-2).

- Seed `Article` legacy (12 entries) + run script `scripts/migrate-legacy-to-knowledge.ts`.
- Post-run : 12 `KnowledgeEntry` + 12 `KnowledgeTranslation` FR (+ EN si présent) + 12 `KnowledgeVersion v1`.
- Slug préservé bit-identique (zéro 301 généré).
- BodyJson préservé bit-identique (deep-equal).
- Tags `ArticleTag` mappés vers `KnowledgeEntry.tags` JSON.
- ActivityLog `kb.migration.legacy.imported` pour chaque entry.

### 2.10 `search-fts.test.ts`

Recherche FTS rank correct.

- Seed 5 entries : titre "Cabinet IA opérationnel", "Conseil IA", "Audit IA", "Stratégie data", "Marketing".
- Recherche `'IA opérationnel'` → rank #1 = "Cabinet IA opérationnel" (titre + body match).
- Recherche `'data'` → rank #1 = "Stratégie data".
- Recherche accent-insensitive : `'operationnel'` (sans accent) → match "opérationnel".
- Recherche FR `'cabinet'` filtré par `locale: 'fr'` → 1 résultat ; `locale: 'en'` → 0.
- Limite 20 résultats + offset 20 → pagination correcte.
- Recherche `''` → throw `KbSearchEmptyQueryError` (pas de dump de la DB).

**Effort total intégration** : ~1,5 demi-journée.

---

## 3. PLAN TESTS E2E (PLAYWRIGHT)

Stack : `playwright.config.ts` existant (5 projects : chromium, webkit, firefox, mobile-chrome, mobile-safari ; CI = 4 workers, retries 2). Pattern hérité de `tests/e2e/a11y.spec.ts`, `i18n.spec.ts`, `smoke.spec.ts`.

Fichiers sous `tests/e2e/knowledge/*.spec.ts`. Tag `@kb` filtrable via `pnpm test:e2e --grep @kb`.

Fixtures auth admin réutilisent `tests/e2e/flows/*` pattern (à confirmer agent 4 Sprint KB-9).

**Total visé : ≥ 9 scénarios E2E.**

### 3.1 `creation-publication.spec.ts` @kb

Parcours admin complet :

1. Login admin OWNER → navigation `/[adminPrefix]/connaissances/`.
2. Clic "Nouvelle entrée" → form + Tiptap éditeur.
3. Saisie titre, slug auto-généré, body Tiptap (paragraphe + H2 + image insertion via asset library).
4. Sauvegarder draft → état "draft" visible dans liste.
5. Clic "Soumettre pour review" → assignement REVIEWER (si OWNER agit comme tel) → état "review".
6. Login REVIEWER → clic "Approuver" → état "review-approved".
7. Login OWNER → clic "Publier" → état "published".
8. Navigation publique `/blog/[slug]` (ou `/ressources/[type]/[slug]` selon décision §10 reality check) → contenu rendu + JSON-LD présent (vérification `<script type="application/ld+json">`).

### 3.2 `workflow-review.spec.ts` @kb

Reviewer assignment + notification.

1. Login OWNER → création entry + submit for review + assignement REVIEWER = `alice@axion-ia.com`.
2. Mock interceptor email/Telegram (via `route.fulfill` + spy headers) → assertion 1 email envoyé à alice + 1 Telegram redacted PII conforme ADR 0010.
3. Login alice REVIEWER → notification badge dashboard > 0 + entrée dans liste "À reviewer" + clic rejet avec commentaire → entrée retourne `draft` + commentaire stocké.

### 3.3 `recherche-fts.spec.ts` @kb

Recherche publique cross-type.

1. Pré-seed via API admin (helper `seedKbEntries(['blog', 'case_study', 'help_article'])`).
2. Navigation `/recherche?q=IA+op%C3%A9rationnel`.
3. Assertion ≥ 1 résultat blog + ≥ 1 résultat case-study (cross-type).
4. Clic facette "Type → Blog" → résultats filtrés.
5. Pagination next/prev fonctionnelle.
6. Recherche vide → message "Saisissez une requête" (pas dump).

### 3.4 `surface-client.spec.ts` @kb

Login client → surface client `/mes-ressources/`.

1. Login client (session NextAuth Booking V1 réutilisée).
2. Navigation `/mes-ressources/` → liste filtrée par `audience IN ('client', 'public')` + tag matching `booking.modulesUsed`.
3. Entrée `audience: 'internal'` ABSENTE de la liste (vérif explicite par titre).
4. Clic entrée → détail rendu avec mention "Ressource réservée" badge.
5. Bookmark entry → state persisté + visible dans `/mes-ressources/?tab=bookmarks`.

### 3.5 `import-md.spec.ts` @kb

Import wizard `_AUDIT/*.md`.

1. Login OWNER → `/[adminPrefix]/connaissances/import`.
2. Drop fichier `_AUDIT/PROMPT-BOOKING-DEPOSIT-ADMIN-2026.md` dans dropzone.
3. Wizard étape 1 (parse frontmatter) → preview structuré (titre, body markdown→Tiptap converti).
4. Wizard étape 2 (mapping) → choix type `kb_audit_report`, locale `fr`, audience `internal`.
5. Wizard étape 3 (preview Tiptap rendu).
6. Wizard étape 4 (confirm import) → 1 entry insérée + redirection liste avec banner "1 entrée importée".

### 3.6 `permissions-rbac.spec.ts` @kb

Reader ne peut publier, editor peut.

1. Login READER → `/[adminPrefix]/connaissances/` → 403 ou redirection `/[adminPrefix]/` (pas d'accès admin écriture).
2. Login REVIEWER → liste visible mais bouton "Publier" disabled + tooltip "Réservé OWNER/EDITOR".
3. Login EDITOR → bouton "Publier" actif → publish OK.
4. Login EDITOR → tentative `setPinnedAction` via dev tools fetch direct → 403 (séparation EDITOR ne fait pas pin).

### 3.7 `accessibility-axe.spec.ts` @kb @a11y

Axe-core sur 6 routes pivot KB.

Pattern hérité `tests/e2e/a11y.spec.ts` (AxeBuilder + tags WCAG 2.2 AA + threshold 0 serious/critical).

Routes :

1. `/fr/blog/[exemple-pivot]`
2. `/fr/cas-concrets/[exemple-pivot]`
3. `/fr/centre-aide/[exemple-pivot]`
4. `/fr/faq`
5. `/fr/ressources`
6. `/fr/ressources/[type]/[exemple-pivot]`

Assertion : 0 violation `serious|critical` chaque route. Warnings `moderate|minor` logguées via `console.warn`.

### 3.8 `scheduled-publish.spec.ts` @kb

Publication programmée via cron worker BullMQ.

1. Login OWNER → create entry + clic "Programmer publication" + date = now + 2 minutes.
2. Entry state `scheduled`, `scheduledAt` visible.
3. **Anti-pattern interdit** : NE PAS `page.waitForTimeout(120_000)`. Au lieu : déclenchement manuel cron via endpoint dev-only `POST /api/_dev/trigger-cron/kb-scheduled-publish` (gated `NODE_ENV !== 'production'` + token).
4. Re-poll page admin liste → entry passée à `published`.
5. Navigation publique → page accessible HTTP 200.

### 3.9 `slug-redirect-301.spec.ts` @kb

Ancien slug → 301 → nouveau.

1. Login OWNER → create entry slug `ancien-titre` + publish.
2. Update entry slug → `nouveau-titre`.
3. `request.get('/fr/blog/ancien-titre', { maxRedirects: 0 })` → `response.status() === 301` + `headers.location === '/fr/blog/nouveau-titre'`.
4. `request.get('/fr/blog/nouveau-titre')` → status 200.
5. Chaîne `A → B → C` : `A` redirige direct vers `C` (skip B, voir §2.4 intégration), pas chain 301 → 301 → 200 (anti-pattern WCAG/SEO).

**Effort total E2E** : ~2 demi-journées.

---

## 4. LIGHTHOUSE CI

Stack : `lighthouserc.json` existant (16 URLs, 2 presets desktop+mobile, 3 runs, performance ≥ 0.95, LCP ≤ 1800, INP ≤ 80, CLS ≤ 0.05, TBT ≤ 150, FCP ≤ 1500, SI ≤ 2500).

### 4.1 Routes pivot KB à ajouter à `lighthouserc.json`

Ajouter 6 (× 2 locales = 12) URLs au tableau `collect.url` en Sprint KB-20 :

```json
"http://localhost:3000/fr/blog/[exemple-pivot]",
"http://localhost:3000/en/blog/[en-pivot]",
"http://localhost:3000/fr/cas-concrets/[exemple-pivot]",
"http://localhost:3000/en/case-studies/[en-pivot]",
"http://localhost:3000/fr/centre-aide/[exemple-pivot]",
"http://localhost:3000/en/help/[en-pivot]",
"http://localhost:3000/fr/faq",
"http://localhost:3000/en/faq",
"http://localhost:3000/fr/ressources",
"http://localhost:3000/en/resources",
"http://localhost:3000/fr/ressources/[type]/[exemple-pivot]",
"http://localhost:3000/en/resources/[type]/[en-pivot]"
```

Pivot = entrée seed la plus représentative (volume body, présence image, TOC, citations). À nommer en Sprint KB-2.

### 4.2 Budgets AGENTS.md (validés contre `lighthouserc.json` existant)

| Métrique            | Cible KB   | Budget AGENTS.md | Source `lighthouserc.json`                                                                                   |
| ------------------- | ---------- | ---------------- | ------------------------------------------------------------------------------------------------------------ |
| LCP p75             | ≤ 1 800 ms | ≤ 1 800          | ✅ `largest-contentful-paint` 1800 max                                                                       |
| INP p75             | ≤ 100 ms   | ≤ 100            | ✅ `interaction-to-next-paint` 80 max (plus strict)                                                          |
| CLS                 | = 0        | 0 (cible)        | ⚠️ existant accepte ≤ 0.05 → à durcir à 0 pour KB routes via override per-URL (LHCI supporte `assertMatrix`) |
| First Load JS       | ≤ 75 KB gz | ≤ 75 KB gz       | ❌ pas géré par LHCI → géré par `size-limit` (Sprint KB-9 ajoute config)                                     |
| TBT                 | ≤ 150 ms   | ≤ 150            | ✅                                                                                                           |
| Performance score   | ≥ 0.95     | ≥ 0.95           | ✅                                                                                                           |
| Accessibility score | = 1.0      | 1.0              | ⚠️ existant 0.95 → durcir à 1.0 pour KB routes (E-E-A-T)                                                     |
| SEO score           | = 1.0      | 1.0              | ✅                                                                                                           |

### 4.3 Gate PR

- `pnpm lhci` invoqué en CI sur chaque PR touchant `src/app/[locale]/(blog|cas-concrets|centre-aide|faq|ressources)/**` ou `src/lib/knowledge/**` ou `src/components/knowledge/**`.
- En cas de fail : PR bloquée, message GitHub Actions avec breakdown métriques échouées.
- Bypass requires STOP & ASK Will + ADR (cf. AGENTS.md performance budget §1).

### 4.4 Bundle delta

- `size-limit` config additionnelle (à créer Sprint KB-9, `.size-limit.json`) :

```json
[
  { "path": "src/app/[locale]/ressources/page.tsx", "limit": "60 KB", "gzip": true },
  { "path": "src/app/[locale]/ressources/[type]/[slug]/page.tsx", "limit": "75 KB", "gzip": true },
  { "path": "src/app/[locale]/blog/[slug]/page.tsx", "limit": "75 KB", "gzip": true }
]
```

Gate : `pnpm size` en CI bloque PR si +5 KB gz vs `main` (existant AGENTS.md).

---

## 5. SENTRY EVENTS CUSTOM

Stack : `@sentry/nextjs@10.51` (mémoire `axionia_session_2026-05-11_e2e_audit_p0_sprint` confirme `withSentryConfig` conditionné NODE_ENV=prod). Helper `src/lib/sentry-events.ts` (à créer Sprint KB-9 si pas déjà existant) :

```ts
import * as Sentry from "@sentry/nextjs";

export function captureKbEvent(
  name: KbEventName,
  level: "info" | "warning" | "error" = "error",
  extras: Record<string, unknown> = {},
) {
  Sentry.captureMessage(name, {
    level,
    tags: { feature: "knowledge-base" },
    extra: pickWhitelisted(extras), // PII redaction via pii-redaction.ts
  });
}
```

### 5.1 Events catalog

| Event                         | Niveau | Trigger                                      | Extras (PII-safe)                              |
| ----------------------------- | ------ | -------------------------------------------- | ---------------------------------------------- |
| `kb.publish.failed`           | error  | `publishEntryAction` throw post-validation   | `{ entryId, errorCode, qualityScore }`         |
| `kb.embed.failed` (V1.5)      | error  | embedding worker fail                        | `{ entryId, model, retryCount }`               |
| `kb.import.batch.failed`      | error  | `importBatchAction` rollback                 | `{ batchSize, failedIndex, errorCode }`        |
| `kb.asset.upload.failed`      | error  | `uploadAssetAction` fail (size/format/sharp) | `{ filename, sizeBytes, mimeType, errorCode }` |
| `kb.pdf.generation.failed`    | error  | `@react-pdf/renderer` throw                  | `{ entryId, sizeKb, errorCode }`               |
| `kb.newsletter.digest.failed` | error  | digest worker fail                           | `{ digestId, entriesCount, errorCode }`        |

### 5.2 Events bonus recommandés (Phase A — à valider Will Sprint KB-20)

- `kb.workflow.invalid_transition` — warning, signal SOC2.
- `kb.pii.scan.blocked` — info, métriques RGPD.
- `kb.quality.below_threshold` — info, métrique éditoriale.
- `kb.slug.redirect.loop_detected` — error, sécurité (max-hops dépassé).

### 5.3 Sentry alerts (à configurer dashboard Sentry Sprint KB-20)

- `kb.publish.failed` > 5/heure → alerte Telegram (ADR 0010 redacted).
- `kb.import.batch.failed` ≥ 1 → alerte Telegram immédiate.
- `kb.embed.failed` > 10/heure → alerte (V1.5 only).

---

## 6. PLAUSIBLE GOALS

Stack : Plausible CE déployé (mémoire `axionia_plausible_ce_deploy_2026-05-13`, UUID `vl41qwmhr6l26bmrjzet9h02`). Script étendu avec 4 extensions (pageview, hash, outbound-links, file-downloads). Helper `src/lib/analytics/plausible.ts` (à créer Sprint KB-9 si pas existant) :

```ts
declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: Record<string, string | number> }) => void;
  }
}

export function trackKbEvent(name: KbGoal, props?: Record<string, string | number>) {
  if (typeof window === "undefined" || !window.plausible) return;
  window.plausible(name, props ? { props } : undefined);
}
```

### 6.1 Goals catalog

| Goal                 | Trigger                                                                                                              | Custom properties                                       | Configuration Plausible          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------- |
| `kb_view`            | mount page `/blog/[slug]`, `/cas-concrets/[slug]`, `/centre-aide/[slug]`, `/faq/[slug]`, `/ressources/[type]/[slug]` | `entryId`, `type`, `locale`, `audience`                 | Goal custom event                |
| `kb_search`          | submit form search public ou `/recherche`                                                                            | `query` (truncated 100 chars), `result_count`, `locale` | Goal custom event + custom props |
| `kb_helpful_up`      | clic 👍 sur entrée                                                                                                   | `entryId`, `type`                                       | Goal custom event                |
| `kb_helpful_down`    | clic 👎 sur entrée                                                                                                   | `entryId`, `type`                                       | Goal custom event                |
| `kb_bookmark_added`  | clic bookmark (client surface)                                                                                       | `entryId`, `type`                                       | Goal custom event                |
| `kb_pdf_downloaded`  | clic download PDF                                                                                                    | `entryId`, `type`                                       | Goal custom event                |
| `kb_citation_copied` | clic "Copier citation" sur entrée                                                                                    | `entryId`, `format` (`apa` / `bib` / `markdown`)        | Goal custom event                |

### 6.2 Dashboards Plausible à configurer (Sprint KB-20)

- **Top 10 entries** (par `kb_view`) avec breakdown `type` + `audience`.
- **Search queries top 50** (mots-clés recherchés sans résultat = piste contenu manquant).
- **Helpful ratio** (% `up` / total) par entry → signal éditorial.
- **PDF download top 10** (entries les plus exportées) → signal "to-PDF-by-default" V1.5.

### 6.3 RGPD

- Plausible CE = pas de cookies (mémoire `axionia_plausible_ce_deploy_2026-05-13`) → pas de bandeau.
- Custom property `query` : tronquée 100 chars + PII-scan via `pii-redaction.ts` côté client (`stripPiiClient(query)`) avant envoi → bloc CGV / sous-processeurs OK.

---

## 7. RUNBOOK PROD (`docs/knowledge/runbook-prod.md`)

À créer Sprint KB-20. Cible : runbook actionnable < 10 min par procédure, exécutable par Will seul (avec accès Coolify + DB + Redis).

Structure proposée :

````markdown
# Knowledge Base — Runbook Production

> Stack : Hetzner CPX32 + Coolify + Postgres 17 + Redis + BullMQ + Sentry + Plausible.
> Token Coolify : voir `.secrets/api-tokens.env` (mémoire `axionia_infra_tokens_pointer`).

## P0 — Dépublier en urgence (RGPD / contenu illégal)

### Option A — Admin UI (préféré, ≤ 2 min)

1. Login admin `https://axion-ia.com/<ADMIN_URL_PREFIX>/` OWNER.
2. Naviguer `/<prefix>/connaissances/`.
3. Rechercher l'entrée (slug ou ID).
4. Clic "Dépublier" → choisir motif (`rgpd` / `legal` / `contenu_inexact` / `autre`).
5. Confirmer → état `archived` + ActivityLog `kb.entry.unpublished_emergency` + revalidatePath déclenché.
6. Vérifier 410 (ou 301 si remplacement) sur URL publique en navigation privée.

### Option B — SQL direct (fallback admin UI HS, ≤ 5 min)

```bash
ssh root@178.105.55.15
docker exec -it coolify-postgres psql -U axionia -d axionia_production
```
````

```sql
BEGIN;
UPDATE "KnowledgeEntry"
SET status = 'archived',
    unpublished_at = NOW(),
    unpublish_reason = 'emergency_legal'
WHERE id = '<entryId>';
INSERT INTO "ActivityLog" (action, target_type, target_id, changes, created_at, actor_id)
VALUES ('kb.entry.unpublished_emergency_sql', 'KnowledgeEntry', '<entryId>',
        '{"reason":"sql_fallback","operator":"will"}', NOW(), 'system');
COMMIT;
```

Purger cache Cloudflare ensuite : `curl ... /api/v4/zones/<zoneId>/purge_cache` (token CF dans `.secrets/api-tokens.env`).

## P0 — Restaurer une version

1. Admin UI → entrée → onglet "Versions".
2. Sélectionner version cible → clic "Rollback".
3. Server action `rollbackVersionAction` crée **nouvelle version** (vN+1 = copie vK), pas modification immutable de vK.
4. Reviewer + Publier comme une édition normale.

Fallback SQL : déconseillé (immutabilité versions), passer par admin UI ou créer nouvelle version manuellement via API.

## P1 — Purger embeddings (V1.5)

```bash
docker exec -it coolify-postgres psql -U axionia -d axionia_production
```

```sql
-- Purger tout
DELETE FROM "KnowledgeEmbedding";

-- Purger un type
DELETE FROM "KnowledgeEmbedding" WHERE entry_id IN (
  SELECT id FROM "KnowledgeEntry" WHERE type = 'glossary_term'
);
```

Puis re-trigger worker : `pnpm tsx scripts/reindex-embeddings.ts --all` ou via admin UI `/<prefix>/connaissances/jobs/`.

## P1 — Relancer cron review-expiry

```bash
# Via API Coolify : trigger worker BullMQ
curl -X POST "$COOLIFY_URL/api/v1/applications/$APP_UUID/restart-worker" \
  -H "Authorization: Bearer $COOLIFY_API_TOKEN"
```

Ou via admin UI : `/<prefix>/connaissances/jobs/review-expiry/run`.

## P1 — Rollback import batch

L'import batch est transactionnel (cf. `tests/integration/knowledge/import-batch.test.ts`). Si rollback automatique a échoué (rare) :

1. Identifier `batchId` dans ActivityLog (`action='kb.import.batch.failed'`).
2. SQL : `DELETE FROM "KnowledgeEntry" WHERE import_batch_id = '<batchId>';` (CASCADE supprime versions + translations + assets relations).
3. Vérifier ActivityLog `kb.import.batch.manual_rollback`.

## P2 — Investiguer alerte broken-links

1. Dashboard admin `/<prefix>/connaissances/health/broken-links`.
2. Filtrer "last 24h".
3. Pour chaque entrée : ouvrir détail → onglet "Liens cassés" → status code + dernière vérif.
4. Décision :
   - Lien externe 404 mort → éditer entry, supprimer ou remplacer.
   - Lien interne 404 → vérifier slug rename ou redirect 301.
   - Lien externe 5xx → re-tester dans 24h (worker auto re-check).

## P2 — Investiguer cron retention-purge

Cron quotidien purge entries RGPD-tagged > retention period.

1. Logs Coolify : `coolify logs <APP_UUID> --grep "retention-purge"`.
2. ActivityLog `kb.retention.purged` count attendu vs réel.
3. Si écart > 10% : alerte → ouvrir ticket investigation.

## P3 — Coolify deploy KB fail

Standard procedure mémoire `axionia_cicd_github_actions_coolify` :

```bash
gh workflow run deploy-coolify.yml
gh run watch
```

Rollback : Coolify UI → Deployments → "Rollback to previous".

````

**Effort runbook** : 0,5 demi-journée Sprint KB-20.

---

## 8. STYLE GUIDE RÉDACTEURS (`docs/knowledge/editorial-style-guide.md`)

À créer Sprint KB-20 (rédacteur principal : Manon, mémoire `axionia_naming_cabinet`).

Structure proposée :

```markdown
# Knowledge Base — Style Guide Rédacteurs

## 1. Ton Axion-IA

- **Identité** : cabinet IA opérationnel (jamais agence/studio/atelier — cf. mémoire `axionia_naming_cabinet`).
- **Positionnement** : prescripteur expert, pas vendeur. Pas de superlatif gratuit.
- **Cible** : dirigeants PME-ETI 50-500 collaborateurs France métropolitaine.
- **Mot d'ordre** : valeur opérationnelle avant tout. Chaque contenu doit répondre à "qu'est-ce que le lecteur peut faire demain matin avec ça ?"

## 2. Conventions FR

- **Vouvoiement** systématique. Jamais "tu" (sauf citation directe documentée).
- **Présent de l'indicatif** majoritaire (action, démonstration).
- **Voix active** > voix passive. "Le DSI déploie l'IA" > "l'IA est déployée par le DSI".
- **Phrases courtes** : ≤ 25 mots/phrase moyenne (Flesch fr ≥ 60).
- **Pas de jargon non explicité** : RAG, agentic, MLOps → 1ʳᵉ occurrence définie inline ou liée au glossaire.
- **Chiffres** : numérique pour ≥ 10, lettré pour 1-9 (sauf énumérations techniques).
- **Acronymes** : développés à la 1ʳᵉ occurrence ("intelligence artificielle (IA)").

## 3. Doctrine vocabulaire

- ✅ "intervention" (canonical, ADR 0008).
- ❌ "formation" (banni hors mention légale Qualiopi).
- ❌ "coaching" (banni — cf. ADR 0008).
- ✅ "implémentation IA", "audit IA", "cadrage IA".
- ✅ "Axion-IA" partout (jamais "AxionIA" en marketing — mémoire `axionia_naming_brand_vs_project`).

## 4. Structure type par contenu

### 4.1 Blog article (template)

- **H1** : titre 50-70 chars, mot-clé principal + bénéfice.
- **Intro** : 60-100 mots, problème + promesse.
- **3-7 sections H2**, chacune 200-500 mots.
- **Quotes/Callouts** : 1-3 par article max.
- **Image hero** : illustration, pas stock photo générique.
- **Conclusion** : 80-120 mots, synthèse + CTA contextualisé.
- **FAQ inline** (3-5 questions) si pertinent → JSON-LD FAQPage auto.
- **Auteur** : signature obligatoire + photo + bio courte.

### 4.2 Case study (template)

- **Problème** : 200-400 mots, contexte client (anonymisé si NDA).
- **Solution** : 400-800 mots, démarche Axion-IA + livrables.
- **Résultats** : 200-300 mots, métriques quantifiées (% gain, h économisées, € évités).
- **Témoignage client** : 50-100 mots citation directe.
- **Tech stack** : liste claire (LLM, framework, infra).

### 4.3 Help article (template)

- **Problème utilisateur** : 1 phrase, formulation telle qu'utilisateur la pose.
- **Réponse courte** : 2-3 phrases au-dessus du fold.
- **Étapes** : numérotées, screenshots si applicable.
- **Liens** : entrées liées (cross-link KB).

### 4.4 FAQ (template)

- **Question** : formulation utilisateur (langage naturel).
- **Réponse** : 50-200 mots, factuelle.
- **Catégorie** : enum strict (general, pricing, technical, legal).

### 4.5 Glossary term (template)

- **Définition** : 1-3 phrases.
- **Exemple** : 1 cas concret Axion-IA.
- **Termes liés** : 2-5 cross-links.

## 5. E-E-A-T checklist

- [ ] Auteur identifié (sauf glossary)
- [ ] Date publication + dernière revue
- [ ] Reviewer mentionné si applicable
- [ ] ≥ 1 citation source externe (livre, paper, doc officielle)
- [ ] ≥ 1 lien interne (cross-KB)
- [ ] Alt text 100% images (Sprint KB-10 bloquant)

## 6. Anti-patterns (auto-rejet quality score)

- ❌ Buzzwords vides : "révolutionnaire", "incontournable", "game-changer", "ROI immédiat".
- ❌ Slogans non chiffrés : "x10 productivité", "économisez 80%" sans source.
- ❌ Pluriel marketing : "nos experts" (un cabinet = équipe nommée).
- ❌ Promesse sans cadre : "IA pour tous" / "automatiser tout".
````

**Effort style guide** : 0,5 demi-journée Sprint KB-20.

---

## 9. DOC API INTERNE (`docs/knowledge/api-internal.md`)

À créer Sprint KB-20. Cible : développeurs (front + back), consumers internes potentiels (newsletter, dashboard health, agents IA V1.5).

Structure proposée :

````markdown
# Knowledge Base — API Interne

> Aucune API publique en V1. Tout est server-action Next.js. Cette doc liste les server-actions consommables hors module KB.

## 1. Server actions exposées hors `knowledge/`

| Action                                        | Consumer                                | Returns                                                 | Stabilité |
| --------------------------------------------- | --------------------------------------- | ------------------------------------------------------- | --------- |
| `getEntryBySlugForPublic(slug, locale, type)` | RSC `app/[locale]/blog/[slug]/page.tsx` | `KnowledgeEntryPublic` ou `null`                        | Stable V1 |
| `getRelatedEntries(entryId, limit=5)`         | RSC détail                              | `KnowledgeEntryPublic[]`                                | Stable V1 |
| `searchKnowledge(query, opts)`                | RSC `/recherche`                        | `{ items, total, facets }`                              | Stable V1 |
| `getKbStatsForDashboard()`                    | RSC `/<prefix>/dashboard`               | `{ totalPublished, byType, byAudience, pendingReview }` | Stable V1 |
| `recordKbViewClientSide(entryId)`             | client `<EntryViewTracker>`             | `void`                                                  | Stable V1 |
| `getKbDigestForNewsletter(since)`             | worker newsletter cron                  | `KnowledgeEntryPublic[]`                                | Stable V1 |

## 2. Types exposés (`src/types/knowledge.ts`)

```ts
export type KnowledgeEntryPublic = {
  id: string;
  slug: string;
  locale: "fr" | "en";
  type: KbEntryType;
  title: string;
  excerpt: string;
  bodyHtml: string; // sanitized server-side
  bodyJson: TiptapDoc; // pour rendering avancé client-side
  publishedAt: Date;
  lastReviewedAt: Date | null;
  author: AuthorPublic | null;
  tags: string[];
  toc: TocItem[];
  readingTimeMinutes: number;
  // ... voir source
};

export type KbEntryType =
  | "blog_article"
  | "case_study"
  | "faq"
  | "help_article"
  | "glossary_term"
  | "guide"
  | "doctrine";
```
````

## 3. Webhooks (Phase B uniquement)

V1 : aucun webhook entrant exposé.
V1.5 : possible endpoint RAG `POST /api/internal/kb/query` (HMAC + rate-limited).

## 4. Indexes critiques DB

| Index                                                              | Usage              | Justification                  |
| ------------------------------------------------------------------ | ------------------ | ------------------------------ |
| `KnowledgeEntry(type, status, audience, locale, publishedAt DESC)` | Listing public     | Couverture totale filtre + tri |
| `KnowledgeEntry(status='review', assignedReviewerId)`              | Dashboard reviewer | Partial index                  |
| `KnowledgeSlugHistory(oldLocale, oldType, oldSlug) UNIQUE`         | Resolve 301        | Lookup O(log n)                |
| `KnowledgeTranslation.search_vector GIN`                           | FTS                | tsvector                       |
| `KnowledgeEntry.tags GIN` (JSON)                                   | Tag facet          | jsonb_path_ops                 |

## 5. Pagination

Toutes les listes utilisent cursor-based pagination (pas offset) :

```ts
const { items, nextCursor } = await listEntries({ cursor: undefined, take: 20 });
```

Format cursor : base64 du tuple `(publishedAt ISO, id)`.

## 6. Rate limits (`src/lib/rate-limit.ts` réutilisé)

| Action                   | Limit | Window | Key          |
| ------------------------ | ----- | ------ | ------------ |
| `searchKnowledge` public | 60    | 1 min  | IP           |
| `recordHelpfulAction`    | 1     | 24 h   | IP + entryId |
| `exportBatchAction`      | 5     | 1 min  | adminUserId  |
| `uploadAssetAction`      | 30    | 1 min  | adminUserId  |

## 7. Erreurs typées

```ts
export class KbWorkflowError extends Error {
  code: KbWorkflowErrorCode;
}
export class KbQualityError extends Error {
  score: number;
  threshold: number;
}
export class KbPiiError extends Error {
  findings: PiiFinding[];
}
export class KbRelationCycleError extends Error {
  path: string[];
}
export class KbSearchEmptyQueryError extends Error {}
```

```

**Effort doc API** : 0,25 demi-journée.

---

## 10. RECAP DELIVERABLES SPRINT KB-9 / KB-20

| Sprint | Livrable | Chemin | Effort (½ j) |
|---|---|---|---|
| KB-9 | Tests unitaires server actions × 25 | `src/server/actions/knowledge/__tests__/*.test.ts` | 1,5 |
| KB-9 | Tests unitaires SSOT helpers | `src/content/knowledge/__tests__/*.test.ts` | 0,5 |
| KB-9 | Tests unitaires quality-score, RBAC, Tiptap TOC/sanitize, slug, readability | `src/lib/knowledge/*.test.ts` | 2,25 |
| KB-9 | Tests intégration × 10 | `tests/integration/knowledge/*.test.ts` | 1,5 |
| KB-9 | Tests E2E × 9 | `tests/e2e/knowledge/*.spec.ts` | 2,0 |
| KB-9 | `docker-compose.test.yml` (Postgres test) | `docker-compose.test.yml` | 0,25 |
| KB-9 | `.size-limit.json` extensions KB | `.size-limit.json` | 0,1 |
| KB-9 | `src/lib/sentry-events.ts` helper KB events | `src/lib/sentry-events.ts` | 0,25 |
| KB-9 | `src/lib/analytics/plausible.ts` helper goals KB | `src/lib/analytics/plausible.ts` | 0,1 |
| KB-20 | Routes pivot LHCI (extension `lighthouserc.json`) | `lighthouserc.json` | 0,25 |
| KB-20 | Configurer 6 Plausible goals via API | _config Plausible_ | 0,25 |
| KB-20 | Configurer 6 Sentry alerts via API | _config Sentry_ | 0,25 |
| KB-20 | Runbook prod | `docs/knowledge/runbook-prod.md` | 0,5 |
| KB-20 | Style guide rédacteurs | `docs/knowledge/editorial-style-guide.md` | 0,5 |
| KB-20 | Doc API interne | `docs/knowledge/api-internal.md` | 0,25 |
| **Total** | | | **~10,5 ½ j** |

---

## 11. ANTI-PATTERNS

### 11.1 Tests wall-clock-dependent

**Symptôme** : `await page.waitForTimeout(120_000)` pour attendre cron `scheduled-publish` → CI 2 min/test, flakiness aléatoire.

**Solution** : endpoint dev-only `POST /api/_dev/trigger-cron/<jobName>` (gated `NODE_ENV !== 'production'` + token `DEV_TRIGGER_TOKEN` issu de `.env.test`). E2E appelle directement le déclenchement, pas le polling temporel.

**Anti-pattern bonus à interdire** :
- `Date.now()` capturé en test sans `vi.useFakeTimers()`.
- Tests qui dépendent de TZ système (forcer `process.env.TZ = 'Europe/Paris'` dans `vitest.setup.ts`).
- Tests qui passent localement et échouent CI à cause d'ordering DB (toujours `ORDER BY id` ou `ORDER BY createdAt, id` deterministe).

### 11.2 E2E boucle infinie

**Symptôme** : `page.waitForLoadState("networkidle")` + Tiptap autosave throttled = jamais "networkidle" → timeout 30s.

**Solution** :
- `page.waitForSelector('[data-testid="entry-saved"]')` (signal explicite UI).
- Timeout max 10s par wait, sinon dump screenshot + DOM en debug.
- Pour Tiptap autosave : désactiver autosave en mode test via flag `?test=1` ou `data-test-no-autosave` sur `<TiptapEditor>`.

**Anti-pattern bonus à interdire** :
- `while (true) { await ...; if (...) break; }` sans cap iterations.
- `page.waitForFunction()` sans timeout explicite (default 30s peut s'enchaîner).

### 11.3 Absence runbook → SPOF Will

**Symptôme** : tout savoir opérationnel dans la mémoire de Will. Si Will indisponible 1 semaine, équipe ne sait pas dépublier une entrée RGPD-flagguée.

**Solution** :
- `docs/knowledge/runbook-prod.md` versionné dans repo (cf. §7).
- Procédures testées **trimestriellement** (dry-run sur entrée de staging) + tests intégration `tests/integration/knowledge/runbook-procedures.test.ts` (Sprint KB-20 optionnel mais recommandé).
- Onboarding nouvel admin = lecture runbook + dry-run en staging avant accès prod.

**Anti-patterns bonus à interdire** :
- Runbook qui décrit l'UI sans citer les SQL fallback → si admin UI HS, panic.
- Runbook qui omet la purge cache Cloudflare post-action → contenu encore servi 5-30 min.
- Runbook qui ne mentionne pas comment vérifier le succès (curl + grep, navigation privée).

### 11.4 Anti-patterns observabilité spécifiques KB

- **PII dans Sentry extras** : interdit, redacter via `pii-redaction.ts` côté serveur AVANT `captureMessage`. Test : `tests/integration/knowledge/sentry-pii-redacted.test.ts` (optionnel Sprint KB-20, intercepteur Sentry mocké assertant extras propres).
- **Plausible `query` non tronquée** : envoi requête full > 100 chars → fuite intention utilisateur potentielle. Tronquer + redacter PII côté client AVANT `window.plausible(...)`.
- **Sentry alertes sans rate-limit Telegram** : tempête d'alertes Telegram = ADR 0010 violation. Group alerts par `kb.publish.failed > 5/heure`, pas chaque event.

### 11.5 Anti-patterns LHCI

- **Routes pivot non représentatives** : seed `lorem ipsum 200 chars` → LCP artificiellement bon. Pivots **doivent contenir** body Tiptap réaliste 1500+ mots + 3 images + TOC + JSON-LD.
- **LHCI sur localhost sans build prod** : `pnpm dev` mode lent. Toujours `pnpm build && pnpm start` (config `lighthouserc.json` déjà OK : `startServerCommand: "pnpm start"`).

### 11.6 Anti-patterns tests intégration

- **Tests partageant le même state DB** : préférer `TRUNCATE Knowledge* CASCADE` en `beforeEach` (rapide, ~50ms).
- **Reset complet par `prisma migrate reset`** : lent (10-30s), à proscrire en CI.
- **Skip de tests intégration en local** : NE PAS. CI doit faire échouer le PR. Dev local : `pnpm test:integration` documenté README KB.

---

## 12. STOP & ASK OUVERTS

Toutes décisions différées Will avant Sprint KB-9 / KB-20 :

1. **Convention nommage tag E2E** : `@kb` (recommandation) ou `@knowledge` ou `@knowledge-base` ? Aligner avec convention `pnpm test:e2e --grep @<tag>` documentée nulle part actuellement → conventionner.
2. **Coverage threshold cible KB** : durcir à 70/70/70/70 sur `src/lib/knowledge/**` et `src/server/actions/knowledge/**` ou maintenir 50/50/50/50 global ? Recommandation : per-folder override 70/70/70/70.
3. **CLS = 0 strict pour KB routes** : durcir `lighthouserc.json` per-route via `assertMatrix` (LHCI) ou accepter `≤ 0.05` existant ? Recommandation : strict 0 sur routes KB pour cohérence AGENTS.md (CLS = 0).
4. **Accessibility score 1.0** vs 0.95 existant pour LHCI ? Recommandation : 1.0 sur 6 routes pivot KB (E-E-A-T strict).
5. **`docs/knowledge/` vs `_AUDIT/KNOWLEDGE-BASE-2026/`** : runbook + style guide + doc API → recommandation `docs/knowledge/` (long-lived) vs `_AUDIT/` (sandbox audit). Confirmer chemin.
6. **Plausible custom props quota** : limite Plausible CE ? À auditer config + adapter `query`/`result_count`/etc.
7. **Sentry quota free tier** : sur prod, `@sentry/nextjs@10.51` envoie déjà flot Booking V1. Plan upgrade nécessaire si > 5k events/mois après KB launch ? À monitorer Sprint KB-20 W+2.
8. **Endpoint dev-only `/api/_dev/trigger-cron/`** : `NODE_ENV !== 'production'` + token `DEV_TRIGGER_TOKEN` suffisant ? Recommandation : OUI, mais documenter explicitement absence en prod (build flag `STRIP_DEV_ENDPOINTS=1` à valider).
9. **`tests/integration/knowledge/runbook-procedures.test.ts`** : oui/non en Sprint KB-20 (test des procédures runbook elles-mêmes, sur DB de staging) ? Coût ~0,5 ½ j supplémentaire, signal qualité +++.
10. **Manon disponible pour relire le style guide** (mémoire `axionia_naming_cabinet`) ? Recommandation : OUI, draft Phase B + relecture Manon avant freeze KB-20.

---

**Fin Agent 18 — Tests, QA, observabilité, runbook.** AUDIT-ONLY confirmé : aucun fichier de test, runbook, doc, ni config n'a été créé. Tout est plan + chemins exacts pour Phase B (KB-9 et KB-20).
```
