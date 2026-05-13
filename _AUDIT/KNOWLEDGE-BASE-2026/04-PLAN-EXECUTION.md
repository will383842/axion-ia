# 04 — PLAN-EXECUTION — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md`
> Plan consolidé après 18 agents (la version du master prompt §13 reste la source de vérité du périmètre ; ce fichier en est la version exécutable post-audit).
> Date : 2026-05-13
> Statut : DRAFT (en attente décisions Will SYNTHESIS §3 + GO BUILD KB-SPRINT-1)

---

## 0. Vue d'ensemble (Gantt textuel)

```
PHASE 0 — Audit Phase A (DONE)                      ░░░░░  5 dj  ✅ livré
─────────────────────────────────────────────────────────────────────────
PHASE 1 — Fondations (KB-1 → KB-4)                  ████  16 dj
PHASE 2 — Migration data (KB-5 → KB-6)              ████  10 dj
PHASE 3 — Surfaces (KB-7 → KB-10)                   ████  14 dj
PHASE 4 — Enrichissement (KB-11 → KB-16)            ███████  22 dj
PHASE 5 — Polish + tests prod (KB-17 → KB-20)       ████  14 dj
─── 🚦 BORNE V1 — production-ready ──────────────────────────────────────
PHASE 6 — IA (V1.5 — KB-21 → KB-24)                 █████  18 dj
PHASE 7 — V2+ (chatbot, multi-tenant, etc.)         [non chiffré]
```

**Total V1** : ~81 demi-journées Will-équivalent (≈ 4 mois calendaires à 1 dj/jour mixé).
**Total V1.5** : ~18 dj.
**Coût additionnel V1** : €0/mois (Hetzner CPX32 absorbe).
**Coût additionnel V1.5** : €0.05 → €13/mois (Voyage AI `voyage-3-lite`, fonction du volume).

---

## 1. CONVENTIONS

- **1 dj** = 1 demi-journée focus ≈ 4 h.
- **Branche** : `feature/kb-<sous-domaine>` (jamais main directement). Phase B autopilot user-driven = `feature/kb-foundations` pour KB-1+KB-2 expand+KB-3.
- **Commits** : Conventional Commits, atomiques par étape.
- **Gates par sprint** : `pnpm typecheck` + `pnpm lint` + `pnpm test` verts + tests E2E si applicable.
- **Migrations Prisma** : nommées `kb_NN_description/`, jamais destructive sans deprecation window (expand → backfill → contract).
- **STOP & ASK** explicite : si conflit, ambiguïté, ou décision hors scope sprint → poser, attendre Will.
- **AUTOPILOT** autorisé uniquement sur le périmètre demandé (user-driven). Sinon `GO BUILD KB-SPRINT-N` strict.

---

## 2. PHASE 1 — Fondations (16 dj)

### Sprint KB-1 — Schéma Prisma + SSOT `knowledge-base.ts` — 4 dj

**Pré-requis** : Phase A GO + décisions 1, 2 (et idéalement 3, 6) tranchées par Will.

**Livrables** :

- `prisma/schema.prisma` étendu : 12 modèles `Knowledge*` V1 + 7 enums dédiés (`KbType`, `KbDomain`, `KbAudience`, `KbConfidentiality`, `KbStatus`, `KbPipelineStage`, `KbRelationKind`).
- Migration Prisma `kb_01_init_schema/migration.sql` (expand only — pas de touch aux tables legacy `articles`/`case_studies`/`faqs`/`help_articles`).
- `src/content/knowledge-base.ts` SSOT principal (exports enums + arrays + helpers + types).
- `src/content/knowledge/{types,domains,audiences,confidentialities,statuses,relation-kinds,routes}.ts` (sous-modules SSOT — réduction `knowledge-base.ts` à un barrel export).
- `src/content/knowledge/templates/{article,case-study,help-article,faq,glossary-term,guide}.ts` (Tiptap JSON skeletons).
- `src/content/knowledge/{quality-thresholds,review-windows,snippets}.ts`.
- `src/lib/knowledge/prisma-helpers.ts` (query builders typés : `findEntryById`, `findEntryBySlug`, `listEntriesByType`, etc.).
- `src/lib/knowledge/prisma-helpers.test.ts` (15+ tests Vitest).
- i18n : namespacer `knowledge.*` dans `src/messages/{fr,en}.json` (labels enums + UI strings).

**Critères d'acceptation** :

- `pnpm prisma generate` OK.
- `pnpm prisma migrate dev --name kb_01_init_schema` OK (locale).
- `pnpm typecheck` OK.
- `pnpm lint` OK.
- `pnpm test` (vitest) ≥ 15 tests nouveaux verts.
- `pnpm i18n:check` OK (parity FR/EN).

**STOP & ASK obligatoires** : aucun (décisions §3 SYNTHESIS doivent être déjà tranchées).

### Sprint KB-2 — Migration legacy `Article` → `KnowledgeEntry` (expand-backfill) — 5 dj

**Pré-requis** : KB-1 mergé.

**Livrables** :

- Migration `kb_02_expand_article_legacy/migration.sql` : pas de changement de tables, juste ajout (si besoin) de colonnes shim sur `articles` pour faciliter le mapping. Pas de DROP.
- `scripts/import-knowledge-from-legacy.ts` : script Node TS-X qui lit tous les `articles` + `article_translations` + `article_tags_on_articles` et crée des rows correspondantes dans `knowledge_entries`/`knowledge_translations`/`knowledge_tags_on_entries`/etc. avec `type='article'`. Mode `--dry-run` (default) + `--commit` + `--batch-size`.
- **Décision actée du user pour cette session** : **expand only, pas le contract** (le contract réel viendra plus tard, KB-5+). Donc les anciennes tables `articles/article_translations/article_tags/article_tags_on_articles` **subsistent** intactes.
- Backfill optionnel des données seed dev/test : `prisma/seed-knowledge.ts`.
- `tests/integration/knowledge/migration-article-legacy.test.ts` : crée fixtures dans `articles`, lance le script `--dry-run` + `--commit`, vérifie que `knowledge_entries` contient les bonnes rows.
- Mise à jour `docs/knowledge/migration-runbook.md` (procédure prod : test sur copie DB → smoke test → commit).

**Critères d'acceptation** :

- Script `--dry-run` produit un rapport JSON (mapping ID → entryId) sans toucher la DB.
- Script `--commit` sur DB de test crée toutes les `KnowledgeEntry` `type='article'` avec slug préservé.
- Tests intégration verts (≥ 5 nouveaux).
- Aucune ligne supprimée dans les tables legacy (assertion explicite dans test).

**STOP & ASK** : confirmer si Glossaire/Guide-IA hardcode sont migrés dans ce sprint ou KB-5 (décision §3 SYNTHESIS).

### Sprint KB-3 — Admin core CRUD `/connaissances/` — 5 dj

**Pré-requis** : KB-2 mergé. Décisions 6, 7, 8, 9 tranchées (KbStatus dédié confirmé, i18n mono-fichier, actions per-file, module cross-cutting).

**Livrables** :

- Pages admin sous `src/app/[locale]/(admin)/[adminPrefix]/connaissances/` :
  - `page.tsx` (liste filtrable — type/domain/audience/status/tags, search, tri, pagination).
  - `ConnaissancesListClient.tsx` (composant client filtres + pagination + bulk actions).
  - `nouvelle/page.tsx` (création — type picker → skeleton template).
  - `[id]/page.tsx` (édition tabbed UI — Contenu / Métadonnées / Relations / Versions / Publication / RGPD / Médias).
  - `[id]/EditeurTiptapClient.tsx` (wrapper Tiptap étendu — basé sur `TiptapEditor.tsx` shared, ajout Link/Image/Placeholder/SlashMenu/Autosave/Keymap).
  - `[id]/PanneauMetadonnees.tsx`, `PanneauVersions.tsx`, `PanneauRelations.tsx`, `PanneauPublication.tsx`, `PanneauRgpd.tsx`, `PanneauMedias.tsx` (placeholders pour KB-11+).
  - `[id]/apercu/page.tsx` (SSR preview en mode draft, `noindex`).
- Server actions sous `src/server/actions/knowledge/` (5 minimales V1 KB-3) :
  - `create-entry.ts` (Zod, RBAC, audit log).
  - `update-entry.ts` (Zod, optimistic concurrency).
  - `save-draft.ts` (autosave throttled 2s).
  - `delete-entry.ts` (soft-delete + audit log).
  - `_zod-schemas.ts` (Zod regroupés).
  - `_guards.ts` (RBAC helpers : `requireRole`, `requireOwnerOrEditor`).
  - `_audit.ts` (ActivityLog wrappers).
  - `_revalidate.ts` (revalidatePath helpers).
- Tiptap extensions ajoutées : `pnpm add @tiptap/extension-link @tiptap/extension-image @tiptap/extension-placeholder lowlight @tiptap/extension-code-block-lowlight` (versions compatibles avec `@tiptap/starter-kit@3.22.5`).
- E2E `tests/e2e/knowledge/creation-publication.spec.ts` (create draft → publish → public 200 → archive).

**Critères d'acceptation** :

- `pnpm typecheck` + `pnpm lint` + `pnpm test` verts.
- `pnpm test:e2e creation-publication` vert.
- Lighthouse `/connaissances` admin OK (LCP non-budgeted admin, mais INP < 200 ms).
- Editeur Tiptap fonctionnel (insert image asset, link, slash menu).
- Autosave fonctionnel (indicator triple ARIA-live).

**STOP & ASK** : confirmer si Phase B s'arrête après KB-3 ou continue (la consigne user dit STOP ici).

### Sprint KB-4 — Workflow états + versionning + audit log — 2 dj

**Pré-requis** : KB-3 mergé.

**Livrables** :

- Migration `kb_03_versions_relations/migration.sql` : `KnowledgeVersion`, `KnowledgeRelation`, `KnowledgeReviewerAssignment` tables.
- State machine TS pure `src/lib/knowledge/state-machine.ts` (validateTransition(from, to, userRole)).
- `src/server/actions/knowledge/{submit-for-review,publish,unpublish,schedule-publish,archive,restore,rollback-version,add-relation,remove-relation,assign-reviewer}.ts` (10 actions).
- 26 events `kb.*` dans `ActivityLog` via `_audit.ts` helper.
- `tests/integration/knowledge/workflow-states.test.ts` (transitions allowed/refused), `versions.test.ts` (immutability + rollback), `relations.test.ts` (cycle detection, add/remove).

---

## 3. PHASE 2 — Migration data + surfaces publiques (10 dj)

### Sprint KB-5 — Migration `CaseStudy` + `HelpArticle` + `FAQ` + Glossaire/Guide-IA hardcode — 5 dj

**Pré-requis** : KB-4 mergé. Décision §3.3 SYNTHESIS tranchée (Glossaire/Guide-IA migrer ou pas).

**Livrables** :

- 3 nouveaux scripts d'import : `import-knowledge-from-case-study.ts`, `import-knowledge-from-faq.ts`, `import-knowledge-from-help-article.ts`.
- 2 scripts d'import depuis hardcode : `import-knowledge-from-glossary-hardcode.ts`, `import-knowledge-from-guide-ia-hardcode.ts`.
- Tests intégration (`migration-case-study-legacy.test.ts`, `migration-faq-legacy.test.ts`, `migration-help-legacy.test.ts`, `migration-glossary-hardcode.test.ts`).
- Mise à jour `docs/knowledge/migration-runbook.md`.

### Sprint KB-6 — Routes publiques branchées sur backend unifié — 5 dj

**Pré-requis** : KB-5 mergé.

**Livrables** :

- Refactor `src/app/[locale]/blog/page.tsx`, `blog/[slug]/page.tsx`, et facettes (`auteur`, `categorie`, `secteur`, `service`, `tag`, `taille`) pour lire depuis `KnowledgeEntry WHERE type='article'`.
- Refactor `cas-concrets/[slug]/page.tsx` + facettes pour `type='case_study'`.
- Refactor `centre-aide/[slug]/page.tsx` + facettes pour `type='help_article'`.
- Refactor `faq/page.tsx` + `[slug]/page.tsx` + `feed.xml` pour `type='faq'`.
- Refactor `glossaire/page.tsx` + `[slug]/page.tsx` (créer si absent) pour `type='glossary_term'`.
- Refactor `guide-ia/page.tsx` pour `type='guide'`.
- Feature flag `KB_BACKEND_UNIFIED` env var pour rollback chirurgical route par route.
- `pnpm lhci` sur 6 routes pivot : `/blog/[exemple]`, `/cas-concrets/[exemple]`, `/centre-aide/[exemple]`, `/faq`, `/glossaire`, `/guide-ia`.

---

## 4. PHASE 3 — Surfaces nouvelles (14 dj)

### Sprint KB-7 — Recherche FTS Postgres FR + EN + facettes — 4 dj

**Livrables** :

- `prisma/migrations_fts/kb_fts_french.sql`, `kb_fts_english.sql`, `kb_unaccent_trgm.sql` (étendus depuis l'existant `0002_fts_setup.sql`).
- `src/lib/knowledge/search-fts.ts` (builder requêtes FTS + ranking + facets).
- `/api/internal/kb/search/route.ts` (endpoint).
- Refactor `src/app/[locale]/recherche/page.tsx` cross-type.
- E2E `recherche-fts.spec.ts`.

### Sprint KB-8 — Hub `/ressources/` + RSS/Atom/JSON Feed + llms.txt enrichi — 4 dj

**Livrables** :

- `src/app/[locale]/ressources/{page,loading,opengraph-image,feed.xml/route,feed.json/route,tag/[tag]/page,auteur/[slug]/page}.tsx`.
- Helpers `src/server/exporters/{knowledge-rss-atom,knowledge-json-feed,knowledge-llms-txt}.ts`.
- Sitemap : `src/app/sitemap-knowledge.ts` rejoint `sitemap-index.xml` existant.
- IndexNow ping via helper centralisé existant.
- Validateur W3C RSS + JSON Feed.

### Sprint KB-9 — Surface client `/mes-ressources/` + bookmarks + notes privées — 3 dj

**Pré-requis** : magic-token Booking V1 réutilisé (cf. Agent 7).

**Livrables** :

- `src/app/[locale]/mes-ressources/{page,favoris/page,[slug]/page}.tsx`.
- Migration `kb_04_bookmarks/migration.sql` (`KnowledgeBookmark`).
- E2E `surface-client.spec.ts`.

### Sprint KB-10 — Accessibilité WCAG 2.2 AA + E-E-A-T — 3 dj

**Livrables** :

- Composants `src/components/knowledge/public/{AuthorByline,FactCheckedBadge,RelatedEntries,ShareCitationButton,HelpfulVoteButton}.tsx`.
- Schema `Person` JSON-LD intégré.
- Alt text bloquant publication (quality-score gate dans `publish.ts`).
- E2E `accessibility-axe.spec.ts` tag `@a11y` sur 6 routes pivot.

---

## 5. PHASE 4 — Enrichissement (22 dj)

### Sprint KB-11 — Pipeline médias + asset library + sharp AVIF/WebP — 5 dj

**Pré-requis** : volume Coolify persistant confirmé (décision §3.4 SYNTHESIS).

**Livrables** :

- `pnpm add sharp`.
- Migration `kb_06_assets/migration.sql` (`KnowledgeAsset`).
- Worker BullMQ `src/server/queue/workers/knowledge-image-process.ts`.
- Server actions `upload-asset.ts`, `delete-asset.ts`.
- Pages admin `/connaissances/medias` + `[assetId]/page.tsx`.
- Composant `MediaPicker.tsx` (drag-into-editor).
- Cron `knowledge-asset-gc.ts` (soft-delete + GC 30j).
- Strip EXIF/GPS systématique.

### Sprint KB-12 — Slug history + redirects 301 + sécurité contenu — 3 dj

**Livrables** :

- Migration `kb_05_slug_history/migration.sql` (`KnowledgeSlugHistory`).
- Backfill initial depuis git log (one-shot).
- Middleware `src/middleware.ts` étendu : lookup KnowledgeSlugHistory + 301 anti-chaîne.
- `pnpm add @tiptap/html` (server-side renderer).
- `src/lib/knowledge/tiptap-sanitize.ts` (whitelist nodes/marks).
- 8+ tests injection XSS.
- E2E `slug-redirect-301.spec.ts`.

### Sprint KB-13 — Editorial pipeline + calendrier + health dashboard + quality score — 5 dj

**Livrables** :

- Migration `kb_07_pipeline_editorial/migration.sql` (pipelineStage, briefMarkdown, targetWordCount, targetKeyword, assignedAuthorId, assignedReviewerId).
- Pages admin `/connaissances/{calendrier,sante,files-attente-revue}/page.tsx`.
- Composants `CalendarBoard.tsx` (CSS grid 7×N custom), `HealthDashboard.tsx`, `QualityScoreGauge.tsx`.
- `src/lib/knowledge/quality-score.ts` (10 critères × 10 pts).
- Server action `assign-reviewer.ts` (round-robin + escalation 48h cron).

### Sprint KB-14 — Multi-format (PDF + OG + newsletter) — 4 dj

**Livrables** :

- `pnpm add @react-pdf/renderer`.
- Worker `knowledge-pdf-generate.ts` (queue concurrency=1).
- Endpoint `/api/internal/kb/[id]/pdf/route.ts` (async 202 + URL).
- `opengraph-image.tsx` par type (5 templates).
- Worker `knowledge-newsletter-digest.ts` (idempotency key entryId × digestId).

### Sprint KB-15 — Import tooling (`_AUDIT/*.md` + Markdown Git + Notion) — 4 dj

**Pré-requis** : décision §4.12 (Notion V1 ou V1.5).

**Livrables** :

- `pnpm add prosemirror-markdown` (+ `@notionhq/client` si Notion V1).
- Importers `src/server/importers/{knowledge-audit-md,knowledge-markdown-git,knowledge-notion}.ts`.
- Migration `kb_08_import_batch/migration.sql` (`KnowledgeImportBatch`).
- Wizard UI `/connaissances/imports/page.tsx` + `[batchId]/page.tsx`.
- Server actions `import-batch.ts`, `rollback-import-batch.ts`.
- E2E `import-md.spec.ts`.

### Sprint KB-16 — Templates + snippets + slash command + TOC + readability — 3 dj

**Livrables** :

- Templates Tiptap dans `src/content/knowledge/templates/*.ts` (déjà esquissés KB-1, finalisés ici).
- Snippets bibliothèque `src/content/knowledge/snippets.ts`.
- Tiptap extension custom `EditorSlashMenu.tsx` + commands.
- `src/lib/knowledge/tiptap-toc.ts` (extraction TOC depuis JSON).
- `src/lib/knowledge/readability-fr.ts` (Flesch-Kincaid FR).
- Composant public `EntryToc.tsx` (sticky desktop / collapsible mobile).

---

## 6. PHASE 5 — Polish + tests prod (14 dj)

### Sprint KB-17 — Notifications multi-canal + reviewer assignment + scheduled publish + preview tokens — 4 dj

### Sprint KB-18 — Annotations team + bookmarks client (étendus) + series/collections + pinned/featured — 3 dj

### Sprint KB-19 — RGPD review + retention purge + backup/DR + DR drill — 3 dj

**Livrables** :

- Extension `pii-redaction.ts` avec `detectPii()` (variant retourne matches).
- Intégration PII scan bloquant dans `publish.ts`.
- Worker `knowledge-retention-purge.ts` (extension cron existant).
- Worker `knowledge-broken-links.ts` (détection liens cassés cron weekly).
- Scripts `backup-knowledge.sh` + `restore-knowledge-test.sh` (DR drill mensuel).
- Endpoint `/api/internal/kb/export-full/route.ts` (OWNER + HMAC + rate-limit 1/jour).
- Mise à jour `src/content/legal.ts` + `src/content/subprocessors.ts` si Voyage AI V1.5 confirmé.

### Sprint KB-20 — Tests E2E complets + LHCI gate + Sentry events + Plausible goals + doc sync — 4 dj

**Livrables** :

- Suite E2E complète (9 specs `@kb`).
- `lighthouserc.json` étendu 12 URLs KB pivot.
- Sentry custom events (6+).
- Plausible goals (7).
- Doc sync : `AGENTS.md` + `Design.md` + ajout skill `axionia-knowledge` dans `.claude/skills/`.
- `docs/knowledge/{editorial-style-guide,runbook-prod,api-internal}.md`.

**🚦 BORNE V1 — Production ready** : 81 dj cumulés. Le système peut être lancé en prod publique avec confiance.

---

## 7. PHASE 6 — V1.5 (IA, 18 dj)

### Sprint KB-21 — pgvector + embeddings + recherche hybride FTS + cosine — 5 dj

**Livrables** :

- Migration `kb_10_pgvector_embeddings/migration.sql` (`CREATE EXTENSION vector;` + `KnowledgeEmbedding` table + index HNSW).
- Worker `knowledge-embedding-reindex.ts` (Voyage AI batch).
- `src/lib/knowledge/embeddings.ts` (wrapper Voyage AI + refus dur `confidentiality IN ('confidential','secret')`).
- `src/lib/knowledge/search-hybrid.ts` (RRF FTS + cosine).
- Bench hybrid vs FTS pure.

### Sprint KB-22 — RAG endpoint + auto-suggestions admin + auto-tagging IA — 5 dj

**Livrables** :

- Endpoint `/api/internal/kb/rag/route.ts` (HMAC + RRF + Claude Haiku 4.5 prompt caching).
- Composant admin `RelatedEntriesSuggest.tsx` (embeddings cosine top-3).
- Server action `suggest-tags.ts` (Claude Haiku call cached).

### Sprint KB-23 — Auto-traduction FR→EN assistée + alt text IA vision — 4 dj

### Sprint KB-24 — ePub export + plagiarism check + brand voice check — 4 dj

**🚦 BORNE V1.5** : 99 dj cumulés.

---

## 8. PHASE 7 — V2+ (hors chiffrage)

- Chatbot public alimenté par RAG KB.
- Multi-tenant (client rédige dans son espace).
- Syndication (Substack, LinkedIn carrousel, X thread).
- Paywall / monétisation.
- Vidéo / podcast embarqués.
- Auto-génération autonome d'entrées par IA (vs assistance V1.5).

---

## 9. CRITÈRES DE SUCCÈS V1 (production-ready)

- [ ] Tous les contenus existants (`Article`, `CaseStudy`, `FAQ`, `HelpArticle`, Glossaire hardcode, Guide-IA hardcode) migrés sans perte.
- [ ] Toutes les URLs publiques pré-existantes répondent 200 avec mêmes contenus.
- [ ] Hub `/ressources/` indexé Search Console + sitemap-index étendu.
- [ ] Admin `/connaissances/` permet CRUD complet + workflow + versionning + audit log.
- [ ] Pipeline éditorial fonctionnel (calendrier + assignations + health dashboard).
- [ ] Asset library opérationnelle (upload + sharp + EXIF strip).
- [ ] WCAG 2.2 AA validé sur 6 routes pivot (axe-core + manuel).
- [ ] Tests E2E ≥ 9 scénarios verts.
- [ ] LHCI gate vert sur 6 routes (LCP ≤ 1800, INP ≤ 100, CLS = 0, First Load JS ≤ 75 KB gz).
- [ ] DR drill réussi (restore KB-only).
- [ ] PII scan bloquant publication intégré.
- [ ] Coût mensuel additionnel = €0.

---

## 10. STRATÉGIE DE ROLLOUT — résumé

1. **Migration data Phase 2** = expand-backfill-contract strict. Jamais destructive en une étape.
2. **Routes publiques préservées** Phase 2 : zéro 301 sur anciennes URLs.
3. **Feature flag** `KB_BACKEND_UNIFIED` env var pour rollback chirurgical route par route.
4. **Canary** : `/ressources/` derrière `noindex` 7j avant indexation publique (sitemap + IndexNow).
5. **Communication interne** : Will valide chaque sprint via `SPRINT-N-REPORT.md`.
6. **Communication externe** : aucune annonce avant V1 borne. À V1 : `/blog/` article + newsletter + page presse update.

---

## 11. DEMANDE USER — Phase B autopilot

> _« Puis, dès que je t'ai donné mes décisions sur les STOP & ASK, enchaîne en autopilot KB-1 + KB-2 (expand-only, pas le contract) + KB-3 sur une branche feature/kb-foundations. ARRÊT après KB-3 même si tu pourrais continuer. Ne touche pas main. Ne déploie pas en prod. »_

**Plan autopilot Phase B (post décisions Will)** :

| Étape | Sprint           | Branche                  | Commit               | Notes                                                                 |
| ----- | ---------------- | ------------------------ | -------------------- | --------------------------------------------------------------------- |
| 1     | KB-1             | `feature/kb-foundations` | 1+ commits atomiques | Schéma + SSOT. `pnpm prisma migrate dev` local seulement.             |
| 2     | KB-2 expand-only | `feature/kb-foundations` | 1+ commits           | Script import legacy. **Pas de contract sur les tables `articles*`**. |
| 3     | KB-3             | `feature/kb-foundations` | 1+ commits           | Admin core CRUD + Tiptap extensions + E2E.                            |
| 4     | STOP             | —                        | —                    | Phase B autopilot terminée. Will révise + tranche KB-4.               |

**Garde-fous Phase B autopilot** :

- `pnpm typecheck` + `pnpm lint` + `pnpm test` verts avant chaque commit.
- Aucun push (Will pushe lui-même après revue).
- Aucun `git checkout main`, aucun `git merge`, aucun `git rebase --onto main`.
- Aucun `pnpm db:migrate:deploy`, aucun appel à Coolify API, aucun `vercel`, aucun déploiement.
- Si pré-requis bloquant (volume Coolify pour KB-3 minor, dépendances pnpm add à confirmer), STOP & ASK Will au lieu d'autopiloter aveugle.
- Rapport final `_AUDIT/KNOWLEDGE-BASE-2026/SPRINT-1-REPORT.md`, `SPRINT-2-REPORT.md`, `SPRINT-3-REPORT.md` (1 par sprint livré).

---

**Fin 04-PLAN-EXECUTION.** Prochaine étape : Will tranche les 5 décisions top-level SYNTHESIS §3 et signale `GO BUILD KB-SPRINT-1`.
