# Knowledge Base V4 — Sprints KB-13 → KB-20 livrés (2026-05-14)

> Branche : `feature/kb-foundations`
> Commits Sprint V4 (KB-13 → KB-20) : `7e067cb`, `cc0de98`, `64fa576`, `0127081`, `40299d6`, `0855282`, `27c5638`, suivi du présent commit KB-20.
> Tests : **241/241 verts** (vitest, hors integration DB).
> Typecheck : ✅ — `pnpm typecheck` clean.
> Lints : ✅ — anti-siren + anti-hex + use-client clean.

---

## Récap par sprint

### KB-13 V4 — Ingest API HMAC + quality gates + dedup

- Endpoint POST `/api/internal/kb/ingest` HMAC-SHA256 + UUID v4 idempotency
- Pipeline 6 gates : banned-words → PII → alt-text → heuristic → dedup pgvector ≥ 0.92 → source tracking
- `KnowledgeIngestRequest` (queued/team_review/published/rejected/failed)
- Auto-publish (`KB_AUTO_PUBLISH=true`) ou team_review (default V1)
- Tests : 57 (pii 9 + hmac 7 + gates 9 + banned 9 + locale 8 + embeddings 15)

### KB-14 V4 — Auto-SEO/AEO/GEO LLM cached

- `KnowledgeSeoCache` (unique translationId × provider × providerVersion)
- Stub V1 déterministe → V2 wire OpenAI/Claude ; coût 0 stub V1
- `generateSeoMeta` ≤ 60 / ≤ 158 chars
- `extractFaqQA` pattern Q/R + fallback titre ? (limite 5 QA)
- `detectGeoEntities` 13 régions + 14 top villes FR + fallback country FR
- `refreshSeoCacheForTranslation` upsert idempotent + copie metaTitle/Desc vides
- Wire ingest.ts post-création (non-bloquant en erreur)
- Tests : 16

### KB-15 V4 — Import Markdown audit_md + markdown_git

- CLI `scripts/import-knowledge-from-markdown.ts` (dry-run par défaut, --commit explicite)
- Front-matter YAML simple sans dépendance
- MD → HTML safe (escape, neutralise `javascript:`)
- 3 gates obligatoires + `KnowledgeImportBatch` tracé
- Status import : "draft" (jamais auto-publish)
- Tests : 15 (parseFrontMatter, markdownToHtml, markdownToPlainText)

### KB-16 V4 — Templates + snippets + TOC + readability

- 18 templates HTML par KbType (avec minWordCount adapté)
- 10 snippets éditeur (`/callout-info`, `/quote-client`, `/steps-3`, `/cta-audit`…)
- `generateToc` + `injectHeadingIds` (slugify accents-aware)
- `computeReadability` Flesch FR (Kandel/Moles 1958)
- Tests : 20

### KB-17 V4 — Safeguards anti-dérive

- `KnowledgeAuditLog` append-only hash-chainé SHA-256
- 13 event kinds tracés (`ingest_accepted/rejected`, `publish`, `delete`, `kill_switch_engaged`…)
- `verifyAuditChain` forensique
- Kill switch env `KB_INGEST_KILL_SWITCH=true` → 503 Retry-After 300
- Wire dans /api/internal/kb/ingest et action ingest
- Tests : 7 kill-switch

### KB-18 — Annotations team + Collections éditoriales

- `KnowledgeAnnotation` (review_comment, seo_suggestion, factual_check, typo, content_request)
- Workflow open → resolved | wont_fix avec resolvedAt + resolvedById
- `KnowledgeCollection` + `KnowledgeCollectionItem` (position unique)
- Visibility public | unlisted | team avec guard viewerCanSeeTeam
- Actions : create/resolveAnnotation, createCollection, addItem/removeItem/publishCollection
- UI admin annotations + page publique `/collections/[slug]` : V2 (deferred)

### KB-19 V4 — RGPD + retention

- `retention-policy.ts` : soft-delete expired + purge ingest > 90j + keep N versions (default 20)
- `rgpd-export.ts` : exportKbDataForUserId + exportKbDataForEmail + eraseKbDataForEmail
- Cron `scripts/kb-retention-cron.ts` (dry-run par défaut)
- Audit log JAMAIS purgé (legal hold ≥ 5 ans)

### KB-20 — Tests cross-validation + doc finale

- `kb-coverage.test.ts` cross-validation 28 KbType ↔ KB_TYPE_META ↔ KB_TYPE_TO_JSONLD ↔ DEFAULT_REVIEW_WINDOW_MONTHS ↔ DEFAULT_QUALITY_THRESHOLDS ↔ DEFAULT_MIN_WORD_COUNT ↔ templates
- Tests : 8
- Bilan total tests `src/{lib,content}/knowledge/` : **241/241 verts**

---

## Migrations DB livrées

```
prisma/migrations/
├── 20260514010000_kb_v4_add_factory_types/         (12 types V4)
├── 20260514020000_kb_v4_pgvector_embeddings/       (vector(1024) HNSW)
├── 20260514030000_kb_v4_source_tracking/           (source_* cols)
├── 20260514040000_kb_v4_ingest_requests/           (idempotency table)
├── 20260514050000_kb_v4_seo_cache/                 (auto SEO cache)
├── 20260514060000_kb_v4_audit_log/                 (append-only hash chain)
└── 20260514070000_kb_v4_annotations_collections/   (review + curation)
```

⚠️ **Non encore appliquées en prod** : `pnpm prisma migrate deploy` requis sur Hetzner après merge sur main + déploiement Coolify.

---

## Fichiers de code livrés (résumé)

```
src/lib/knowledge/
├── hmac.ts + test                       (KB-13)
├── pii-scan.ts + test                   (KB-13 — registry_id pas siren)
├── quality-gates.ts + test              (KB-13)
├── banned-words.ts + test               (déjà KB-1 amendement V4)
├── embeddings.ts + test                 (déjà KB-12.5 V4)
├── dedup-check.ts                       (déjà KB-12.5 V4)
├── locale-policy.ts + test              (déjà KB-1 V4)
├── seo-generator.ts + test              (KB-14)
├── markdown-import.ts + test            (KB-15)
├── toc-generator.ts                     (KB-16)
├── readability.ts                       (KB-16) + toc-readability.test
├── audit-log.ts                         (KB-17)
├── kill-switch.ts + test                (KB-17)
├── retention-policy.ts                  (KB-19)
├── rgpd-export.ts                       (KB-19)
└── kb-coverage.test.ts                  (KB-20)

src/content/knowledge/
├── editor-templates.ts + test           (KB-16)
└── editor-snippets.ts                   (KB-16)

src/server/actions/knowledge/
├── ingest.ts                            (KB-13 wiring + KB-14 SEO + KB-17 audit)
├── seo-cache.ts                         (KB-14)
├── annotations.ts                       (KB-18)
└── collections.ts                       (KB-18)

src/app/api/internal/kb/ingest/route.ts  (KB-13 + KB-17 kill switch)

scripts/
├── import-knowledge-from-markdown.ts    (KB-15)
└── kb-retention-cron.ts                 (KB-19)
```

---

## Décisions documentées

1. **Embeddings stub V1** : `embeddings.ts` génère un vecteur déterministe SHA-256-based. Voyage AI réel sera wiré quand `VOYAGE_API_KEY` env sera fournie. Migration vector(1024) HNSW déjà en place.
2. **SEO/AEO/GEO stub V1** : provider="stub" / version="v1". V2 wire OpenAI/Claude via `KB_SEO_PROVIDER` env.
3. **Auto-publish OFF V1** : `KB_AUTO_PUBLISH=true` requis pour activer publish factory direct. Default = team_review (audience=team, status=draft).
4. **Banned word « formation »** : gate runtime + CI check `pnpm anti-siren:check` étendu pourrait être ajouté V2. Pour l'instant : `checkTranslationBannedWords` côté ingest.
5. **PII renamed siren → registry_id** : doctrine `pnpm anti-siren:check` interdit le mot « siren » dans le code, donc nommage neutralisé.
6. **Audit log legal hold** : JAMAIS purgé (rétention ≥ 5 ans, hash-chain SHA-256 pour intégrité). Versions translations : purge > 20 dernières (best-effort).
7. **DR massif** : runbook ops dédié (snapshot Hetzner CPX32 + WAL replay), reporté Sprint Ops séparé.
8. **Slash command UI Tiptap + admin annotations** : data layer prêt (snippets + actions), UI Sprint KB-16/KB-18 V2 (deferred).

---

## Restant pour mise en production publique du KB Factory V1

| Tâche                                                   | Owner                | Statut              |
| ------------------------------------------------------- | -------------------- | ------------------- |
| `pnpm prisma migrate deploy` prod Hetzner               | Will (manuel)        | ⏳ après merge main |
| Configurer `KB_INGEST_SECRET` (32+ chars) Coolify env   | Will                 | ⏳                  |
| Configurer `KB_AUTO_PUBLISH=false` (default V1)         | Will                 | ⏳                  |
| Configurer `KB_LOCALE=fr_only`                          | Will                 | ⏳                  |
| Configurer `VOYAGE_API_KEY` (V2 embeddings réels)       | Will                 | optionnel V1        |
| Scheduler `kb-retention-cron.ts` quotidien 03:00 UTC    | Will (Coolify cron)  | ⏳                  |
| UI admin `/connaissances/` review queue annotations     | Sprint admin dédié   | ⏳ V1.5             |
| Page publique `/collections/[slug]`                     | Sprint front dédié   | ⏳ V1.5             |
| Wire Sentry break-glass sur kill_switch_engaged         | Sprint observabilité | ⏳                  |
| LHCI smoke `/ressources/` + `/ressources/[type]/[slug]` | Sprint CI            | ⏳                  |

---

## Validation autopilot session 2026-05-14

✅ 8 commits atomiques sur `feature/kb-foundations` :

- `7e067cb` feat(kb): sprint kb-13 v4 — ingest api hmac + quality gates + dedup pipeline
- `cc0de98` feat(kb): sprint kb-14 v4 — auto-seo/aeo/geo llm cached
- `64fa576` feat(kb): sprint kb-15 v4 — import markdown audit_md + markdown_git
- `0127081` feat(kb): sprint kb-16 v4 — templates + snippets + toc + readability
- `40299d6` feat(kb): sprint kb-17 v4 — safeguards anti-dérive (kill switch + audit immuable)
- `0855282` feat(kb): sprint kb-18 — annotations team + collections éditoriales
- `27c5638` feat(kb): sprint kb-19 v4 — rgpd export + retention policy + cron
- (commit KB-20 final ci-après — tests cross-validation + ce report)

✅ main JAMAIS touchée. Branch feature autonome.
✅ Tests verts 241/241. Typecheck OK. Anti-siren OK.

🛑 **Pas de push sur GitHub ni de merge automatique** : décision Will (commits sur feature/ seulement, push/merge manuel).
