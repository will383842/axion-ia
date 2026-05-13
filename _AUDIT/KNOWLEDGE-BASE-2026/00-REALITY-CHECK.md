# 00 — REALITY CHECK — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md`
> Agent : 0 — Reality check (Will-équivalent, séquentiel)
> Date : 2026-05-13
> Statut : DRAFT (Phase A audit-only, seed contextuel pour 18 agents)
> Référence : HEAD `main` (commit `95bba36`)

---

## 0. TL;DR

- **Verdict** : **GO**. Le code est stabilisé (Booking V1 mergé `fa093e5`), les modèles de contenu existants sont propres et bien isolés en `features/admin-*`, le Tiptap pattern (`TiptapEditor` + triple persistance `html`/`json`/`text`) est déjà en place depuis Sprint 24 (C4). On peut concevoir une KB unifiée sans pré-requis bloquants.
- **Dette identifiée** mais hors-scope KB : 4 fichiers M non commités (cancel page, docuseal webhook, self-service-actions, docuseal.ts) + 1 fichier neuf untracked (`refund-calc.ts`). Aucun impact sur l'audit KB.
- **Pré-requis critique pour Phase B** : faire commit ou stash de ces 5 fichiers avant la création de `feature/kb-foundations`, sinon la branche partira avec du WIP non lié.
- **Décisions ouvertes** détaillées §10.

---

## 1. INVENTAIRE — CODE EXISTANT (CONTENU)

### 1.1 Modèles Prisma actuels (HEAD `main`)

Schéma : `axionia/prisma/schema.prisma` (1 666 lignes, 37 modèles, 38 enums).

Modèles **directement de connaissance** (ceux que la KB doit unifier ou adapter) :

| Modèle        | Lignes    | Translations ?                                                                                                    | Tags ?                                        | Tiptap JSON ?                    | Volumétrie estimée seed    | Surface admin         |
| ------------- | --------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------- | -------------------------- | --------------------- |
| `Article`     | 714-736   | `ArticleTranslation` (fr+en, `body`, `bodyJson`, `bodyText`)                                                      | `ArticleTag` + `ArticleTagOnArticle` (M2M)    | ✅ (`body_json` + `body_text`)   | ~12 articles seed          | `/admin/blog`         |
| `CaseStudy`   | 848-895   | `CaseStudyTranslation` (`problem` + `solution` + `problemJson` + `solutionJson` + `problemText` + `solutionText`) | inline `sector`/`modulesUsed` JSON            | ✅ (problem + solution, séparés) | ~6 cas seed                | `/admin/case-studies` |
| `FAQ`         | 901-921   | _colonnes `_fr` + `_en` directement_ (`questionFr`, `answerFr`...)                                                | enum `FAQCategory` (general, etc.)            | ❌ (Text plain)                  | ~16 entrées seed           | `/admin/faq`          |
| `HelpArticle` | 927-964   | `HelpArticleTranslation` (`body`, `bodyJson`, `bodyText`)                                                         | `Category` (FK)                               | ✅                               | ~8 entrées seed            | `/admin/help`         |
| `Category`    | 1007-1037 | _colonnes `_fr` + `_en`_                                                                                          | hiérarchique (`parentId` self) + `ModuleKind` | N/A                              | ~10 catégories             | `/admin/categories`   |
| `Author`      | 791-806   | bilingue inline (`bioFr`/`bioEn`)                                                                                 | N/A                                           | N/A                              | ~3 auteurs (Manon mémoire) | _pas d'admin dédié_   |
| `Testimonial` | 812-842   | bilingue inline                                                                                                   | sector + module enum                          | ❌                               | ~10 témoignages            | `/admin/testimonials` |

Modèles **transverses utilisables** (réutilisables tels quels) :

- `ActivityLog` (1079-1096) — `action`, `targetType`, `targetId`, `changes` JSON, déjà indexé `(targetType, targetId)`. **Réutilisable direct pour l'audit log KB**, on ajoute juste des `action='kb.*'` events.
- `AdminUser` (1043+) + `AdminRole` enum (`reader`/`editor`/...). **Réutilisable direct pour la matrice RBAC KB**.
- `Setting` (1102-1110) — `key`/`value` JSON. **Réutilisable pour seuils quality score, review windows, feature flags**.

Modèles **booking** (non-KB, listés pour éviter collisions) : `Submission`, `Booking`, `CalendarSlot`, `BookingOption`, `Payment`, `Invoice`, `Refund`, `Quote`, `CadrageMeeting`, `ContractDocument`, `ContractTemplate`, `PricingConfig`, `PaymentScheduleProfile`, `BookingPaymentSchedule`, `SiteSetting`, `BookingTransition`, `StripeWebhookEvent`, `DocusealWebhookEvent`, `CapacityWindow`. Aucune collision attendue avec les noms `Knowledge*`.

### 1.2 Enums existants (réutilisables)

- `Locale` (`fr` / `en`) → réutilisable tel quel pour `KnowledgeTranslation.locale`.
- `PublishStatus` (`draft`/`published`/... à confirmer agent 1 par lecture lignes 205-209). KB cible : workflow étendu (`draft → review → published → archived → deprecated → scheduled`). **Décision Phase A : étendre `PublishStatus` (risque de pollution cross-domaine booking) OU créer `KbStatus` dédié (recommandation forte du reality check)**.
- `AdminRole` — à confronter à la matrice RBAC KB (`OWNER`, `EDITOR`, `REVIEWER`, `READER`). **Décision Phase A : étendre OU mapper**.

### 1.3 Extensions Postgres (init container Coolify)

`axionia/docker/postgres/init.sql` charge :

```sql
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

**`pgvector` n'est PAS installé.** Confirme la doctrine V1 = FTS-only, V1.5 = pgvector (sprint séparé KB-21 avec ADR dédiée + migration `CREATE EXTENSION vector`). Bonne nouvelle : Postgres 17 est compatible pgvector 0.7+.

### 1.4 FTS actuel (`prisma/migrations_fts/0002_fts_setup.sql`)

- `article_translations.search_vector` : `tsvector` GENERATED ALWAYS STORED + index GIN. Pondération A=title, B=excerpt, C=body. Config `fr_unaccent` (custom, créée par `docker/postgres/init.sql`).
- `help_article_translations.search_vector` : idem.
- `case_study_translations.search_vector` : pondération A=title, B=problem, C=solution.
- pg_trgm GIN indexes sur `submissions.contact_email`, `testimonials.company`, `bookings_options.contact_email`.

**À noter** :

- `to_tsvector('fr_unaccent', body)` est utilisé sur `body` (HTML) — pas idéal car l'HTML pollue le vecteur (balises). Cible KB V1 : utiliser `bodyText` (plain text déjà persisté Sprint 24 C4) à la place. Migration FTS de Sprint KB-7 doit pointer sur `bodyText`/`questionFr`/etc.
- Pas de FTS sur `faqs` (questions). Sprint KB-7 doit créer.
- Pas de FTS sur Locale EN (config `english`). Sprint KB-7 doit créer `en` config + matérialisation conditionnelle.

### 1.5 SSOTs `src/content/*.ts` (pattern Axion-IA)

`ls src/content/` :

```
audit-detail-configs.ts
audit-taxonomy.ts
automatisations.ts
blog/                       ← répertoire (à inspecter par agent 1)
case-studies.ts
comparaisons.ts
implementation.ts
intervention-detail-configs.ts
interventions.ts
interventions-taxonomy.ts
interventions-taxonomy.test.ts
legal.ts
press.ts
press.test.ts
pricing.ts
regions.ts
stack-ia.ts
subprocessors.ts
transversal.ts
villes/                     ← données INSEE 2150 villes
```

**Pattern SSOT confirmé** : `interventions-taxonomy.ts` et `pricing.ts` exposent enums + arrays + helpers + types — c'est le pattern KB-base.ts à copier. `pricing.ts` est notamment l'exemple de SSOT contenu-zéro-hardcode (mémoire `axionia_pricing_zero_hardcode_2026-05-08`).

### 1.6 i18n actuel — **POINT D'ATTENTION**

```
src/messages/fr.json    (243 lignes — MONO-FICHIER)
src/messages/en.json    (243 lignes — MONO-FICHIER)
src/i18n/{navigation.ts, request.ts, routing.ts}
```

Le prompt §11.1 propose une arborescence `src/messages/fr/knowledge.json` + `src/messages/fr/knowledge-admin.json`. **Conflit avec le pattern actuel mono-fichier**. **Décision Phase A — agent 2/3** : (a) garder mono-fichier et namespacer `knowledge.*` (alignement avec l'existant, pas de risque), OU (b) migrer `fr.json` → `fr/index.json` + `fr/knowledge.json` (clean mais charge supplémentaire et risque de casser next-intl `getMessages()` config). **Recommandation reality check : (a) — namespacer dans le mono-fichier existant**.

---

## 2. INVENTAIRE — CODE EXISTANT (ADMIN)

### 2.1 Routes admin existantes (`src/app/[locale]/(admin)/[adminPrefix]/`)

```
2fa/setup/                            login MFA
activity-logs/                        log explorer
alerts/                               alerting infra
analytics/                            Plausible iframe
blog/                                 CRUD Article
  ├── page.tsx                        liste
  ├── new/page.tsx                    création
  ├── [id]/page.tsx                   édition
  └── BlogForm.tsx                    form Tiptap
calendrier/                           booking calendar admin
case-studies/                         CRUD CaseStudy
  ├── (idem)
  └── CaseStudyForm.tsx
categories/                           CRUD Category
faq/                                  CRUD FAQ
  └── FAQForm.tsx                     pas Tiptap (champs courts)
help/                                 CRUD HelpArticle
  └── HelpForm.tsx                    Tiptap
infra/                                infra dashboard
login/                                login
newsletter/                           CRUD newsletter
options/                              booking options
page.tsx                              dashboard root
settings/                             CRUD Setting (KV)
submissions/                          CRUD Submission (booking)
testimonials/                         CRUD Testimonial
users/                                CRUD AdminUser
```

**Convention de naming** : routes admin actuelles sont **mixtes** (EN majoritaire — `blog`, `help`, `case-studies`, `categories`, `users` — plus FR — `calendrier`). Le prompt impose `/connaissances/` (FR cohérent) en cible. **OK : on lance la convention FR cohérente sur KB sans toucher au legacy.**

### 2.2 TiptapEditor partagé

Fichier : `src/components/admin/TiptapEditor.tsx`.

- StarterKit only (bold/italic/h1-h6/lists/blockquote/code/strike/hr/undo/redo).
- Persiste 3 inputs hidden `${name}_html`, `${name}_json`, `${name}_text`.
- `immediatelyRender: false` SSR-safe.
- **Pas de plugins** Image/Link/Table/Callout/Code-language/Slash.
- **Pas d'autosave** (`save on submit` form only).
- **Pas de placeholder**.

**Gap KB V1** : KB Sprint KB-3 doit étendre l'éditeur (a) Image (insertion asset library), (b) Link, (c) autosave throttled, (d) slash command. Sprint KB-16 finalise (templates + snippets + TOC). **Décision Phase A** : `EntryEditor.tsx` (KB) duplique-t-il `TiptapEditor.tsx` (legacy) ou l'étend-il ? **Recommandation reality check : étendre via wrapper, garder `TiptapEditor.tsx` comme base shared (refactor mineur pour accepter extensions externes en props).**

### 2.3 Server actions pattern

Inspecté `src/features/admin-blog/actions.ts` (373 lignes, 7 actions exportées) :

```ts
listArticlesAction
getArticleDetailAction
listAuthorsAction
listBlogCategoriesAction
listAllTagsAction
upsertArticleAction (FormData, returns UpsertArticleState)
archiveArticleAction
```

Pattern : 1 fichier `actions.ts` par module admin (god-file). KB cible (§11.1) propose **1 fichier par action** dans `src/server/actions/knowledge/*.ts` — divergence assumée pour scalabilité (~25 actions KB attendues). **Décision Phase A — agent 4** : confirmer cette divergence ou s'aligner au pattern existant (recommandation : diverger, on est sur l'ordre de 25 actions).

### 2.4 Features architecture

```
src/features/
  admin-activity-logs/
  admin-auth/
  admin-blog/
  admin-calendar/
  admin-case-studies/
  admin-categories/
  admin-faq/
  admin-help/
  admin-newsletter/
  admin-options/
  admin-settings/
  admin-submissions/
  admin-testimonials/
  admin-users/
  audit/
  booking/
  contact/
  implementation/
  newsletter/
  payment/
  quote-request/
```

**Convention** : `admin-*` pour features admin, autres pour public/transverse. **KB cible** : `admin-knowledge/` + (optionnel) `knowledge-public/` ? Le prompt §11.1 propose plutôt `src/server/actions/knowledge/` + `src/lib/knowledge/` + `src/components/knowledge/{admin,public,client,shared}` — pattern **module-based** au lieu de feature-based. **Décision Phase A — agent 3** : trancher convention. **Recommandation reality check : suivre prompt §11.1 (module `knowledge/` dédié sous lib/components/server/actions), car le module KB est cross-cutting (admin + public + client) — pas un domaine "admin-only" comme `admin-blog`.**

---

## 3. INVENTAIRE — CODE EXISTANT (SURFACES PUBLIQUES)

### 3.1 Routes publiques actuelles (`src/app/[locale]/`)

| Route                                                        | Source contenu                                   | Pattern                |
| ------------------------------------------------------------ | ------------------------------------------------ | ---------------------- |
| `/blog/page.tsx`                                             | `Article` via Prisma                             | liste + pagination     |
| `/blog/[slug]/page.tsx`                                      | `Article` via Prisma                             | détail                 |
| `/blog/auteur/[slug]/page.tsx`                               | `Author` + filter articles                       | facette                |
| `/blog/categorie/[slug]/page.tsx`                            | `Category` + articles                            | facette                |
| `/blog/secteur/[slug]/page.tsx`                              | `Article.sector` filter                          | facette                |
| `/blog/service/[slug]/page.tsx`                              | `Article` filter                                 | facette                |
| `/blog/tag/[slug]/page.tsx`                                  | `ArticleTag`                                     | facette                |
| `/blog/taille/[slug]/page.tsx`                               | `Article.company_size`                           | facette                |
| `/blog/feed.xml/route.ts`                                    | Article RSS                                      | flux                   |
| `/cas-concrets/page.tsx` + `[slug]` + `secteur` + `feed.xml` | `CaseStudy`                                      | idem pattern           |
| `/centre-aide/page.tsx` + `[slug]` + `categorie`             | `HelpArticle`                                    | idem                   |
| `/glossaire/page.tsx`                                        | **HARDCODE** dans le fichier (constante `TERMS`) | aucune DB              |
| `/guide-ia/page.tsx`                                         | À auditer agent 1 (probablement hardcode)        | aucune DB              |
| `/faq/page.tsx` + `[slug]/page.tsx` + `feed.xml`             | `FAQ`                                            | hub                    |
| `/recherche/page.tsx`                                        | À auditer agent 5                                | recherche cross-type ? |

### 3.2 Implications pour KB

1. **`/blog`, `/cas-concrets`, `/centre-aide`, `/faq`** lisent déjà la DB → migration unifiée transparente (zéro 301).
2. **`/glossaire` (et probablement `/guide-ia`)** sont en hardcode → V1 doit les **importer en DB** sous `type='glossary_term'` et `type='guide'` puis basculer la page à lire depuis `KnowledgeEntry`. C'est techniquement une migration "depuis le code source" et non "depuis la DB" — script `scripts/import-knowledge-from-legacy-source.ts` à créer en KB-2.
3. **`/recherche`** doit être étendu cross-type quand KB-7 atterrit.

---

## 4. INVENTAIRE — RGPD, OBSERVABILITÉ, SÉCURITÉ

### 4.1 RGPD existant

- `src/lib/pii-redaction.ts` + `.test.ts` — helper RGPD. **Réutilisable direct pour pre-publish PII scan KB (Sprint KB-19)**.
- `src/lib/legal-snapshot.ts` — snapshot CGV/mentions par booking. **Pattern réutilisable pour snapshot doctrine** sur entrées `type='commercial_doc'` ou `type='doctrine'`.
- ADR 0010 Telegram PII minimisation (mémoire `axionia_session_2026-05-09_sprint_24_1`) — réutiliser pour notifications reviewer KB (Sprint KB-17).
- Routes existantes `/api/gdpr-export`, `retention-purge` cron (mémoire `axionia_session_2026-05-09_sprint_24`) — étendre pour `Knowledge*` tables.

### 4.2 Observabilité existante

- Sentry `@sentry/nextjs` 10.51 — réutilisable pour events `kb.*`.
- Plausible CE déployé (mémoire `axionia_plausible_ce_deploy_2026-05-13`) — Goals déjà configurés (Booking Submitted/Failed). Ajouter `kb_view`, `kb_search`, `kb_helpful_up`, `kb_helpful_down` en Sprint KB-20.
- Clarity component intégré (mémoire `axionia_session_2026-05-13_seo_email_stack`).
- BullMQ + worker (`src/server/queue/worker.ts`) — réutilisable pour workers KB (image-process, pdf, digest, broken-links, retention-purge, asset-gc, reindex).

### 4.3 Sécurité existante

- CSP nonce-based (mémoire `axionia_session_2026-05-09_sprint_24`).
- Argon2id pour passwords admin.
- 2FA TOTP via `otplib`.
- `src/lib/rate-limit.ts` + Redis bucket — réutilisable pour `kb_helpful` 1/IP/entry/24h.
- Turnstile pour formulaires publics — réutilisable pour `kb_helpful` anonyme.

---

## 5. SCHÉMAS Zod ET TESTS

### 5.1 Schémas Zod

`src/lib/schemas/` — patterns Zod existants. KB doit produire `src/server/actions/knowledge/_zod-schemas.ts` (1 fichier regroupé) OU `tests/schemas/knowledge/*.ts` (per-test). **Recommandation reality check** : `_zod-schemas.ts` regroupé (lisibilité), 1 fichier par action devient hors-DRY.

### 5.2 Couverture tests

- Tests existants `*.test.ts` colocalisés (pattern repo confirmé : `interventions-taxonomy.test.ts`, `pii-redaction.test.ts`, `quote-helpers.test.ts`, etc.).
- Suite Vitest : `pnpm test` (286+ tests après Booking V1, mémoire `axionia_session_2026-05-09_sprint_24_1`).
- Playwright pour E2E : `pnpm test:e2e`, `test:e2e:cross-browser`, `test:e2e:ui`.
- LHCI gate : `pnpm lhci`.
- Scripts custom : `pnpm i18n:check`, `pnpm anti-siren:check`, `pnpm anti-hex:check`, `pnpm use-client:check`, `pnpm contrast:check`, `pnpm radius:check`, `pnpm schemacheck`.

**Cible KB V1 §0.0/18** : ≥30 unit + ≥10 integration + ≥5 E2E. **Cohérent avec l'existant**.

---

## 6. ADRs EXISTANTS — convention de naming et localisation

ADRs réels du repo : `axionia/docs/adr/` (pas `_AUDIT/adr/` comme suggéré dans le prompt §6.3 ADR-DRAFT.md).

```
docs/adr/0001-stack-initial.md
docs/adr/0002-design-pivot-editorial-v3.md
docs/adr/0003-lift-formation-ban.md
docs/adr/0004-typography-baseline-upgrade-v3-1.md
docs/adr/0005-navigation-mega-menu.md
docs/adr/0006-pseo-villes.md
docs/adr/0007-typography-hierarchy-v3-2.md
docs/adr/0008-vocabulary-intervention-coaching.md
docs/adr/0009-hosting-hetzner-cpx32-cloudflare-free.md
docs/adr/0010-telegram-pii-minimisation.md
docs/adr/0011-interventions-taxonomy-4-families.md
docs/adr/0012-booking-v1-decisions-matrix-q1-q10.md
docs/adr/0013-stripe-checkout-hybride-manuel.md
docs/adr/0014-docuseal-self-hosted-vs-yousign.md
docs/adr/0015-tva-agnostique-fr-ee.md
docs/adr/0016-pricing-db-managed-pricingconfig.md
docs/adr/0017-multi-options-simultanees-cap-3.md
docs/adr/0018-validation-2-clics-envoi-vs-calendrier.md
docs/adr/0019-modes-manuels-d64-togglables.md
docs/adr/0020-migration-data-v0-vers-v1.md
```

**Prochain numéro ADR : `0021`** — `docs/adr/0021-knowledge-base-unifiee.md`.

Note : `_AUDIT/adr-0003-...-PROPOSITION.md` et `_AUDIT/adr-0004-...-PROPOSITION.md` existent comme propositions historiques mais la convention écrite est `docs/adr/`. **Décision Phase A — agent 8** : confirmer le chemin de l'ADR KB. **Recommandation reality check : `docs/adr/0021-knowledge-base.md` (convention écrite suivie)**. Le brouillon Phase A reste `_AUDIT/KNOWLEDGE-BASE-2026/ADR-DRAFT.md` (sandbox).

---

## 7. WIP ET ÉTAT GIT

### 7.1 Working tree

```
M  src/app/[locale]/booking/[token]/cancel/page.tsx
M  src/app/api/docuseal/webhook/route.ts
M  src/features/booking/self-service-actions.ts
M  src/lib/docuseal.ts
?? _AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md
?? src/features/booking/refund-calc.ts
```

→ 4 fichiers booking modifiés + 1 untracked (`refund-calc.ts`) + le prompt KB lui-même non commité.

### 7.2 Recommandations Phase B

- Avant `git checkout -b feature/kb-foundations`, **stash ou commit** ces fichiers booking (sinon ils partent dans la branche KB). Recommandation reality check : Will doit choisir avant Phase B (`stash`, `commit on main`, ou `commit on feature/booking-cleanup`). Phase B ne peut pas trancher seule.
- Le prompt `PROMPT-KNOWLEDGE-BASE-2026.md` lui-même est untracked → à commiter sur `main` avant la branche feature (sinon il bouge avec elle).

### 7.3 Branches existantes

- Locale : `main` (HEAD `95bba36`)
- `feature/booking-v1` mergée sur main (`fa093e5`), conservée à distance pour archive.
- **Aucune `feature/kb-*` existante**. OK pour créer `feature/kb-foundations`.

---

## 8. COMPATIBILITÉ AVEC LA DOCTRINE AXION-IA

| Doctrine                                                                                                    | Statut                  | Action KB                                                                                                |
| ----------------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Code = SSOT (mémoire `axionia_doctrine_code_ssot`)                                                          | ✅ confirmé             | Audit s'aligne au code, pas l'inverse.                                                                   |
| Zero-hardcode (mémoire `axionia_pricing_zero_hardcode_2026-05-08`)                                          | ✅ pattern à reproduire | `knowledge-base.ts` + sous-modules pour tous les enums/labels/mappings.                                  |
| Naming Axion-IA partout (mémoire `axionia_naming_brand_vs_project`)                                         | ✅ confirmé             | Identifiers JS = camelCase, marque/projet = Axion-IA.                                                    |
| Hetzner CPX32 + Cloudflare Free (mémoire `axionia_hosting_hetzner`)                                         | ✅ confirmé             | Pas de SaaS payant. pgvector V1.5 = OK (gratuit).                                                        |
| Web Vitals AGENTS.md                                                                                        | ✅ budgets connus       | LCP ≤ 1800 / INP ≤ 100 / CLS = 0 / First Load JS ≤ 75 KB gz. Sprint KB-6 et KB-10 doivent garder budget. |
| Doctrine éditoriale (mémoire `axionia_design_pivot`, `axionia_typography_v3_2`, `axionia_hero_schema_v3_2`) | ✅ confirmé             | Bloc auteur + dates lastReviewedAt visibles + heroLayout réutilise HeroSchema existants.                 |
| Cabinet IA opérationnel (mémoire `axionia_naming_cabinet`)                                                  | ✅ confirmé             | Aucune mention "agence/studio" autorisée dans rédaction.                                                 |
| Telegram PII (ADR 0010)                                                                                     | ✅ confirmé             | Notifications reviewer redactées.                                                                        |
| Doc sync (mémoire `axionia_prompt_doc_sync`)                                                                | À prévoir               | Sprint KB-20 met à jour `AGENTS.md` / `Design.md`.                                                       |

**Aucun conflit doctrine bloquant.** ✅

---

## 9. POINTS D'ATTENTION SPÉCIFIQUES — à instruire les 18 agents

### 9.1 Agent 1 (Data model)

- Confirmer enum `PublishStatus` (lecture lignes 205-209 schema.prisma) — décider extension vs nouvel enum `KbStatus`.
- Définir migration `expand` minimaliste (KB-1) : créer **tables `Knowledge*` neuves vides**, ne **PAS** toucher `articles`/`case_studies`/`faqs`/`help_articles` en KB-1. La migration backfill (KB-2) recopie les données, la contract (KB-5+) supprime les vieilles colonnes. Pattern Sprint X.4 / Sprint X.5 booking déjà éprouvé (mémoire `axionia_booking_v1_session_2026-05-13_autopilot`).
- Indexer fortement (`type`, `status`, `audience`, `confidentiality`, `domain`, `publishedAt`, `expiresAt`, `reviewDueAt`, `pinned`, `featured`, GIN sur tags JSON).
- Évaluer `KnowledgeEntry.bodyHtml` vs uniquement `bodyJson` + render-side. **Recommandation** : garder triple-source (html + json + text) cohérent avec le pattern Article/CaseStudy/HelpArticle existant.

### 9.2 Agent 2 (SSOT)

- **Pas** de surcharge i18n côté mono-fichier : namespacer dans `fr.json` et `en.json`.
- Reproduire le pattern `pricing.ts` (constantes nommées, helpers, types exportés, tests colocalisés).

### 9.3 Agent 3 (Admin UI)

- Trancher convention `admin-knowledge` feature vs `knowledge/` module. Recommandation : **module** (cross-cutting).
- Étendre `TiptapEditor.tsx` (ne pas dupliquer).
- Trancher mono-fichier i18n vs multi (recommandation : mono-fichier).

### 9.4 Agent 4 (API & server actions)

- Trancher 1-fichier-par-action vs `actions.ts` god-file. Recommandation : per-action (scalable ~25).
- Réutiliser `ActivityLog` existant (events `kb.*`).
- Hooks `revalidatePath` ('blog', 'cas-concrets', 'centre-aide', 'faq', 'ressources') systématique sur publish/unpublish.

### 9.5 Agent 5 (Search)

- Migrer FTS pour pointer sur `bodyText` (plain) au lieu de `body` (HTML).
- Créer config `english` + materialized vector EN.
- FAQ : créer FTS `faqs.search_vector` (question+answer FR+EN).
- pgvector V1.5 confirmé.

### 9.6 Agent 6 (Public surface)

- Préserver toutes les URLs `/blog`, `/cas-concrets`, `/centre-aide`, `/faq`, `/glossaire`, `/guide-ia`.
- Nouveau hub `/ressources/` (cible). Alternative `/savoir/` reste possible (décision Will).
- Slug history `KnowledgeSlugHistory` couvre `articles.slug` renames historiques (à backfiller initial).

### 9.7 Agent 7 (Client surface)

- NextAuth déjà configuré (Booking V1) — réutiliser sessions client.
- Tag matching par `bookings.modulesUsed` + `bookings.interventionType` → liste tags initial du client.

### 9.8 Agent 8 (Workflow / versionning)

- `ActivityLog` réutilisé. Pas besoin de nouvelle table audit log.
- Nouveau `KnowledgeVersion` (immutable rows).
- ADR cible `docs/adr/0021-knowledge-base.md` (convention).

### 9.9 Agent 9 (Gouvernance / RGPD)

- `pii-redaction.ts` intégré dans `publish.ts` server action (bloquant).
- Étendre cron `retention-purge` existant.
- `AdminRole` actuel → mapper à matrice KB (OWNER/EDITOR/REVIEWER/READER).
- Sous-processeurs `legal/sous-processeurs.ts` — ajouter Anthropic V1.5 si embeddings retenus (mémoire `axionia_session_2026-05-09_sprint_24_1`).

### 9.10 Agent 10 (IA V1.5)

- pgvector V1.5 confirmé (extension absente en V1 = OK).
- Embeddings : skill `claude-api` impose prompt caching (mémoire `axionia_prompt_doc_sync`). Coût chiffré obligatoire.
- Refus dur `confidentiality IN ('confidential', 'secret')` envoyé à API externe — test bloquant.

### 9.11 Agent 11 (Perf / Vitals)

- ISR `revalidate: 3600` pour pages publiques, on-demand revalidate sur publish.
- Bundle JS public ≤ 75 KB gz (AGENTS.md). Renderer Tiptap → composant SSR pur (`renderTiptapToReact`), pas le client editor.
- `loading.tsx` obligatoire par route KB publique.

### 9.12 Agent 12 (A11y / E-E-A-T)

- Palette terracotta : audits existants confirment contrast OK sur fond clair (mémoire `axionia_design_pivot`).
- Auteur SSOT : `Author` model existe, étendre `Person` JSON-LD.
- Alt text bloquant publication → quality-score `< seuil` + check séparé.

### 9.13 Agent 13 (Médias)

- Volume Coolify monté : à confirmer Will (chemin `/data/knowledge-assets/`). Mémoire `axionia_session_2026-05-08_first_deploy` ne mentionne pas explicitement de volume persistant pour les médias — **STOP & ASK Will**.
- Sharp pas dans dependencies package.json actuel — Sprint KB-11 doit `pnpm add sharp`.
- Hash de contenu : SHA-256.

### 9.14 Agent 14 (Editorial pipeline)

- `Setting` table réutilisable pour seuils quality score, review windows.
- Pas de calendrier admin générique existant (calendrier est booking-specific). Sprint KB-13 fait la sienne (FullCalendar-style ou custom léger — décision Phase A).

### 9.15 Agent 15 (Multi-format)

- llms.txt existe (mémoire `axionia_session_2026-05-13_seo_email_stack`, helper IndexNow centralisé) — l'étendre.
- PDF decisional : **`@react-pdf/renderer` recommandé reality check** (RAM CPX32 ~8GB partagé Coolify, puppeteer headless = trop lourd).

### 9.16 Agent 16 (Import tooling)

- `_AUDIT/*.md` : ~70+ fichiers, beaucoup contiennent du non-éditorial (audit reports). **Mappage manuel obligatoire**, pas d'auto-ingest bulk.
- Notion API si Will utilise Notion (mémoire = pas d'info → STOP & ASK).

### 9.17 Agent 17 (Slug / sécurité / DR)

- `@tiptap/html` server-side pas dans dependencies — Sprint KB-12 doit ajouter.
- Cron `dr-restore-kb.sh` lance restore d'un dump filtré — backup global Coolify existe déjà, dump filtré à scripter.

### 9.18 Agent 18 (Tests / observabilité)

- Pattern Playwright `@a11y` tag existe (`pnpm a11y:audit`) — KB doit produire tag `@kb` + `@a11y`.
- LHCI 6 routes pivot suggérées : `/blog/[exemple]`, `/cas-concrets/[exemple]`, `/centre-aide/[exemple]`, `/faq`, `/ressources`, `/ressources/[type]/[exemple]`.

---

## 10. DÉCISIONS OUVERTES — à inscrire en STOP & ASK final Phase A

### Top-level (à trancher Will avant Phase B)

1. **Unification vs cohabitation** : `KnowledgeEntry` polymorphique unique remplace `Article`/`CaseStudy`/`FAQ`/`HelpArticle` (recommandation forte = OUI, expand-backfill-contract) ?
2. **Nom du hub public** : `/ressources/` (recommandation), `/savoir/`, `/base-de-connaissance/`, `/kb/` ?
3. **Slug EN du hub** : `/en/resources/` (parity directe) ou `/en/library/` ou autre ?
4. **Body canonique** : Tiptap JSON canonique + HTML rendered + text plain (recommandation, pattern existant Sprint 24 C4) confirmé ?
5. **pgvector V1.5** : confirmé hors-V1 (recommandation), ou anticipation Sprint KB-21 dans la migration KB-1 sans extension active ?

### Pratiques

6. **Statut KB** : étendre `PublishStatus` enum global ou créer `KbStatus` dédié (recommandation = dédié) ?
7. **i18n** : namespacer dans mono-fichier existant `fr.json`/`en.json` (recommandation) ou éclater en multi-fichiers `fr/knowledge.json` ?
8. **Pattern actions** : 1 fichier par action sous `src/server/actions/knowledge/` (recommandation) ou god-file `actions.ts` (legacy) ?
9. **Pattern module** : `knowledge/` cross-cutting (recommandation) ou `admin-knowledge/` feature (legacy) ?
10. **PDF lib** : `@react-pdf/renderer` (recommandation, léger) ou `puppeteer` (lourd) ?
11. **Volume médias Coolify** : `/data/knowledge-assets/` monté confirmé ? Sinon configurer.
12. **Notion import** : Will utilise Notion ou non ? V1 ou V1.5 ?
13. **Glossaire migration** : extraire `TERMS` du fichier hardcodé `/glossaire/page.tsx` vers DB en KB-2 ?
14. **Guide IA migration** : audit du contenu actuel avant migration ?
15. **ADR location** : `docs/adr/0021-knowledge-base.md` (recommandation) ?

### Risque / portée

16. **Admin legacy `/blog`, `/case-studies`, `/help`, `/faq`** : strangler progressif (V1) ou Big Bang ? Recommandation strangler.
17. **Migration des autres modèles non-prio** (`Testimonial`, `Author`, `Category`) en `KnowledgeEntry` ? Recommandation : **NON V1** — ils ont des relations propres (booking testimonials, etc.). Garder hors KB.

---

## 11. VERDICT GO / NO-GO

### GO ✅

Le code est suffisamment stable pour concevoir la KB unifiée :

- Booking V1 mergé sur main (commit `fa093e5`) — pas de WIP majeur bloquant.
- Tiptap pattern + triple-persistance Sprint 24 C4 = base solide pour `KnowledgeEntry.body`.
- ActivityLog déjà en place pour audit log.
- pii-redaction.ts + legal-snapshot.ts + retention-purge cron déjà existants.
- FTS partiel déjà présent (à étendre, pas à créer ex-nihilo).
- pgvector non installé = OK pour V1 FTS-only, ne bloque rien.
- BullMQ + Sentry + Plausible + Cloudflare opérationnels.

### Pré-requis Phase B (avant `GO BUILD KB-SPRINT-1`)

1. Will tranche les 17 décisions §10 (au minimum les 5 top-level).
2. Will gère le WIP booking modifié (4 fichiers M + 1 untracked) — stash/commit/branch.
3. Will valide le brouillon ADR `docs/adr/0021-knowledge-base.md` (Phase A produit `ADR-DRAFT.md`).
4. (Optionnel) Will confirme le volume Coolify persistant pour assets en V1 (Sprint KB-11). Reportable au sprint concerné.

---

**Fin Reality Check.** Lancement des 18 agents parallèles autorisé.
