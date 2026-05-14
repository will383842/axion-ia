# PROMPT — CERTIFICATION FINALE KB V1 AXION-IA — 2026

> # 🚫🚫🚫 AUDIT-ONLY STRICT — ZÉRO ÉCRITURE — ZÉRO FIX 🚫🚫🚫
>
> **Ce prompt déclenche une certification post-implémentation. Tu n'écris RIEN d'autre que des fichiers `.md` dans `_AUDIT/CERTIFICATION-KB-V1-2026/`.**
>
> - ❌ AUCUN code applicatif modifié, ajouté, supprimé.
> - ❌ AUCUNE migration Prisma écrite ou appliquée.
> - ❌ AUCUN `pnpm add`, `pnpm install`, `pnpm remove`, `pnpm update`.
> - ❌ AUCUN nouveau fichier `.ts`, `.tsx`, `.js`, `.sql`, `.env`, `.yaml`, `.json` (sauf `.md` dans le dossier de sortie).
> - ❌ AUCUN `git add`, `git commit`, `git push`, `git tag`, `git stash`, `git reset`.
> - ❌ AUCUN appel POST/PUT/DELETE à un service externe (Stripe, Coolify, Cloudflare, Hetzner, Sentry, Telegram, Resend, Anthropic, Zoho).
> - ❌ AUCUN appel POST aux Server Actions du projet.
> - ❌ AUCUN `pnpm dev`, `pnpm build` brut, `pnpm db:*`, `prisma migrate *`.
> - ❌ AUCUN « fix tant que j'y suis » même pour une typo.
>
> **Outputs autorisés** : fichiers Markdown dans `_AUDIT/CERTIFICATION-KB-V1-2026/`. Point.
>
> **Lecture autorisée** : tout le code livré, schema.prisma, tests, configs, mémoires `_AUDIT/*.md`, prompts master, env.example, docs, scripts.
>
> **Requêtes externes autorisées** : uniquement `GET` HEAD/READ sur surfaces publiques live (`https://axion-ia.com/sitemap.xml`, `/ressources/`, `/blog/[slug]`, etc.) pour smoke tests passifs. Aucune action mutante.
>
> Si tu es tenté de fixer un truc « petit » pendant l'audit : NON. Tu le notes P0/P1/P2 dans `99-FINDINGS-CONSOLIDATED.md` et tu continues.

---

**Cible** : Axion-IA Knowledge Factory V1 (livraison sprints KB-1 → KB-20 + KB-12.5 pgvector)
**Référence amont** : `axionia/_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` (V4, source de vérité de la cible)
**Référence parallèle** : `axionia/_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` (factory amont qui alimente la KB)
**Prérequis** : tous les sprints KB-1 à KB-20 mergés sur `main`, CI verte, dernier deploy Coolify finished, prod live `https://axion-ia.com`
**Date prompt** : à utiliser **après merge complet V1**
**Mode** : **AUDIT-ONLY STRICT + multi-agents parallèles**
**Profondeur** : _certification industrielle_ — chaque sprint vérifié, chaque safeguard testé en lecture, chaque dimension scorée
**Output racine** : `_AUDIT/CERTIFICATION-KB-V1-2026/` (créer si absent)

---

## 0. CONTRAT D'EXÉCUTION

Tu es **l'auditeur senior fin-de-cycle** mandaté par Will (`williamsjullin@gmail.com`). Mission : certifier que la KB V1 Axion-IA est **complète, parfaite, sans erreur, prête pour mise en exploitation publique à grand volume (100 entrées/jour automatiques)**.

### 0.1 Périmètre temporel de l'audit

- **In scope** : tout ce qui a été livré dans les sprints KB-1 à KB-20 + KB-12.5 (pgvector promu V1), tel que défini dans `PROMPT-KNOWLEDGE-BASE-2026.md` V4.
- **Out of scope** : V1.5 (KB-21 à KB-24 — RAG, auto-amélioration, traduction, chatbot) et V2+. Ces points sont mentionnés comme « hooks d'extension prêts » uniquement, jamais audités sur le fond.

### 0.2 Critères de certification GO PROD

Pour passer en **GO PROD** (volume 100/jour automatique enclenché), la KB doit cocher **les 30 critères ci-dessous**. Tout fail = `CONDITIONAL GO` (avec liste P0 à fixer) ou `NO-GO` (si > 5 P0 ou 1 P0-critique).

| #   | Critère                                                                                                                               | Vérification                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Tous les sprints KB-1 → KB-20 + KB-12.5 livrés                                                                                        | Présence des 21 `SPRINT-N-REPORT.md` dans `_AUDIT/KNOWLEDGE-BASE-2026/` |
| 2   | CI verte sur `main`                                                                                                                   | `gh run list --branch main --limit 1` = success                         |
| 3   | `pnpm typecheck` passe sans erreur ni warning                                                                                         | Re-run en lecture                                                       |
| 4   | `pnpm lint` passe sans erreur                                                                                                         | Re-run en lecture                                                       |
| 5   | `pnpm test` 100% verts                                                                                                                | Re-run en lecture                                                       |
| 6   | `pnpm e2e:kb` ≥ 9 scénarios verts                                                                                                     | Re-run en lecture                                                       |
| 7   | Lighthouse CI ≥ budgets `AGENTS.md` sur 6 routes pivot                                                                                | Re-run en lecture                                                       |
| 8   | Schéma Prisma cohérent + migrations idempotentes                                                                                      | Audit Agent 1                                                           |
| 9   | SSOT `knowledge-base.ts` complet + helpers typés                                                                                      | Audit Agent 2                                                           |
| 10  | Admin `/connaissances/` opérationnel (viewer + monitoring + DR)                                                                       | Audit Agent 3                                                           |
| 11  | Surfaces publiques préservées (toutes URLs `/blog`, `/cas-concrets`, `/centre-aide`, `/faq`, `/glossaire`, `/guide-ia` répondent 200) | Smoke tests live + Agent 4                                              |
| 12  | Hub `/ressources/` indexable + RSS + JSON Feed + llms.txt                                                                             | Smoke tests + Agent 4                                                   |
| 13  | Recherche FTS + pgvector hybride fonctionnelle                                                                                        | Audit Agent 5                                                           |
| 14  | API ingest `/api/internal/kb/ingest` sécurisée (HMAC + Zod + idempotency + rate limit + circuit breaker)                              | Audit Agent 6                                                           |
| 15  | Auto SEO/AEO/GEO (meta titles, descriptions, JSON-LD, OG, AEO bloc, GEO entités) sur ≥ 95% des entrées                                | Audit Agent 7                                                           |
| 16  | Quality gates auto + dedup pgvector + PII scan bloquant                                                                               | Audit Agent 8                                                           |
| 17  | Web Vitals respectent budgets sur 6 routes pivot                                                                                      | Audit Agent 9 + smoke tests                                             |
| 18  | WCAG 2.2 AA validé (axe-core CI + revue manuelle 3 pages)                                                                             | Audit Agent 10                                                          |
| 19  | E-E-A-T (author bio, reviewed-by, fact-checked, citations) présents sur ≥ 90% entrées publiques                                       | Audit Agent 10                                                          |
| 20  | Sécurité contenu (XSS Tiptap sanitization, SSRF whitelist, CSP nonce, rate limit feedback)                                            | Audit Agent 11                                                          |
| 21  | Secrets jamais commités (env vars `KB_INGEST_SECRET`, `KB_AUTO_PUBLISH`, etc.)                                                        | Audit Agent 11                                                          |
| 22  | RGPD : `pii-redaction.ts` bloquant + retention purge cron + audit log immuable                                                        | Audit Agent 12                                                          |
| 23  | Backup/DR KB-specific + DR drill réussi sur staging                                                                                   | Audit Agent 12                                                          |
| 24  | Sentry events `kb.*` configurés + Plausible goals                                                                                     | Audit Agent 14                                                          |
| 25  | Dashboard `/connaissances/sante` opérationnel (volume, qualité, dedup, alertes)                                                       | Audit Agent 3 + 14                                                      |
| 26  | Kill switch `KB_AUTO_PUBLISH` testé en staging                                                                                        | Audit Agent 6 + 8                                                       |
| 27  | Bouton DR massif « dépublier entre T1 et T2 » testé                                                                                   | Audit Agent 6                                                           |
| 28  | Doctrine respectée : mot « formation » BANNI partout, naming Axion-IA, FR-only V1                                                     | Audit Agent 15                                                          |
| 29  | Infrastructure : CPX32 sous 75% RAM/disk, plan upgrade CPX42 documenté                                                                | Audit Agent 16                                                          |
| 30  | Coût IA mensuel réel ≤ €30/mois (vs estimé €25)                                                                                       | Audit Agent 16                                                          |

### 0.3 Ce que tu fais

1. **Reality check** (Phase 0.5) : valider que tous les sprints KB-1 à KB-20 sont réellement mergés et que les `SPRINT-N-REPORT.md` existent.
2. **16 agents parallèles** : un agent par dimension de certification.
3. **Smoke tests live read-only** : GET sur prod pour valider que les surfaces fonctionnent réellement.
4. **Consolidation findings** : tri P0 (bloquant GO PROD) / P1 (à fixer J+30) / P2 (à fixer J+90) / P3 (V1.5+).
5. **Synthèse + verdict** : GO PROD / CONDITIONAL GO PROD / NO-GO PROD avec score `/400`.
6. **STOP & ASK final** : aucune action mutante prise, tu remets le dossier à Will pour décision.

### 0.4 Ce que tu ne fais PAS

- ❌ Aucun fix. Si tu identifies un bug, tu le notes P0/P1/P2. Will lancera un sprint correctif après.
- ❌ Aucune mise à jour de dépendance.
- ❌ Aucune migration.
- ❌ Aucun commit, push, PR.
- ❌ Aucun `pnpm add/install/remove/update`.
- ❌ Aucun appel POST/PUT/DELETE.
- ❌ Aucun « petit nettoyage tant que j'y suis ».

---

## 1. PHASE 0.5 — REALITY CHECK (obligatoire, < 30 min, avant tout agent)

Tu commences **seul, sans parallélisme**. Produis `_AUDIT/CERTIFICATION-KB-V1-2026/00-REALITY-CHECK.md`.

### 1.1 Inventaire des sprints livrés

- Lister les fichiers `_AUDIT/KNOWLEDGE-BASE-2026/SPRINT-*-REPORT.md` présents.
- Pour chacun : date livraison, commit hash référencé, statut (✅ vert / ⚠️ partiel / ❌ échec).
- Sprint manquant ou en échec → **NO-GO immédiat** + arrêt de l'audit + STOP & ASK Will.

### 1.2 État Git

- Branche `main` propre.
- Pas de tag manquant pour le release V1.
- Pas de commit non pushé.
- CI verte sur le dernier commit `main`.

### 1.3 État Coolify / prod

- Dernier deploy `finished` (via API Coolify GET read-only).
- Healthcheck `/api/healthz` répond 200.
- Sentry pas en mode dégradé.

### 1.4 État DB

- Migrations `prisma migrate status` à jour (lecture seule).
- Tables `Knowledge*` présentes : `KnowledgeEntry`, `KnowledgeVersion`, `KnowledgeTranslation`, `KnowledgeTag`, `KnowledgeTagOnEntry`, `KnowledgeRelation`, `KnowledgeAsset`, `KnowledgeSlugHistory`, `KnowledgeBookmark`, `KnowledgeFeedback`, `KnowledgeEmbedding`, `KnowledgeImportBatch`.
- Extension `pgvector` installée (`SELECT * FROM pg_extension WHERE extname = 'vector'`).
- Indexes GIN FTS présents.

### 1.5 Verdict reality check

À la fin :

- **GO** : tous les sprints livrés, CI verte, prod up, DB cohérente → on lance les 16 agents.
- **NO-GO** : sprint manquant, CI rouge, prod down, DB désynchronisée → STOP, on n'audite rien tant que ce n'est pas réglé.

---

## 2. PHASE 1 — 16 AGENTS PARALLÈLES

Tu lances **16 agents** en parallèle, chacun produit un livrable `.md` dédié. Aucun agent n'écrit de code.

Pour chaque agent :

- **Mission** (3-5 lignes)
- **Inputs** (fichiers + tables à lire)
- **Output** (chemin + structure)
- **Critères de succès** (5-10 points)
- **Anti-patterns** (3-5 pièges)
- **Findings format** : `[P0/P1/P2/P3] - [titre court] - [détail technique] - [chemin:ligne] - [action recommandée]`

### Agent 1 — Schéma Prisma + migrations

- Output : `01-SCHEMA-MIGRATIONS.md`.
- Vérifie cohérence des modèles `Knowledge*` avec le prompt master §11.
- Vérifie : types des colonnes, contraintes, FK, cascades, `@@index`, `@@unique`.
- Vérifie : migrations idempotentes (`prisma migrate diff` sur staging mental).
- Vérifie : aucune migration destructive sans deprecation window.
- Vérifie : `KnowledgeSlugHistory` correctement indexée (`oldLocale`, `oldType`, `oldSlug`).
- Vérifie : `KnowledgeEmbedding` avec colonne `vector(1536)` + index `ivfflat` ou `hnsw`.
- Anti-pattern : `Json` columns sans index si requêtable ; FK sans `onDelete` explicite ; oubli `createdAt`/`updatedAt`.

### Agent 2 — SSOT `src/content/knowledge-base.ts` + sous-modules

- Output : `02-SSOT.md`.
- Vérifie présence + cohérence : `types.ts`, `domains.ts`, `audiences.ts`, `confidentialities.ts`, `statuses.ts`, `relation-kinds.ts`, `templates/*.ts`, `snippets.ts`, `quality-thresholds.ts`, `review-windows.ts`, `routes.ts`.
- Vérifie : tous les 28 types KB V4 présents (`article` → `metier_brief`) avec mappings labels FR/EN, JSON-LD type, route URL FR/EN.
- Vérifie : `KB_AUDIENCES` + `KB_CONFIDENTIALITIES` distincts et utilisés correctement.
- Vérifie : `quality-thresholds.ts` valeurs raisonnables (pas tous à 50, pas tous à 90).
- Vérifie : zéro string magique hardcodée dans les composants (`grep` rapide).
- Anti-pattern : enums dupliqués entre Prisma et TS ; libellés UI dans le SSOT (ils vont dans i18n).

### Agent 3 — Admin `/fr/<adminPrefix>/connaissances/`

- Output : `03-ADMIN.md`.
- Vérifie : pages présentes — liste, `nouvelle`, `[id]`, `apercu`, `calendrier`, `sante`, `medias`, `imports`, `etiquettes`, `auteurs`, `files-attente-revue`, `parametres`.
- Vérifie : permissions RBAC respectées (rôle `OWNER`/`EDITOR`/`REVIEWER`/`READER`).
- Vérifie : viewer minimal V4 (pas d'éditeur Tiptap lourd inutile à 100/jour, juste override manuel).
- Vérifie : dashboard `sante` affiche bien volume horaire/quotidien + taux quality fail + dedup + alertes.
- Vérifie : bouton DR massif « dépublier entre T1 et T2 » présent et protégé (confirmation + role check).
- Vérifie : kill switch `KB_AUTO_PUBLISH` togglable depuis `/parametres` (lecture env var, pas écriture côté UI).
- Vérifie : aucune action critique nécessite `psql` ou édition manuelle DB.
- Anti-pattern : admin sans audit log sur les actions DR ; bouton dépublication sans confirmation ; UI qui charge tout en client-side.

### Agent 4 — Surfaces publiques

- Output : `04-PUBLIC-SURFACES.md`.
- Smoke tests `GET` live :
  - `https://axion-ia.com/sitemap.xml` → 200 + contient sitemap-knowledge
  - `https://axion-ia.com/fr/ressources/` → 200 + facettes
  - `https://axion-ia.com/fr/ressources/feed.xml` → 200 + RSS valide
  - `https://axion-ia.com/fr/ressources/feed.json` → 200 + JSON Feed valide
  - `https://axion-ia.com/llms.txt` → 200 + contient entrées KB
  - `https://axion-ia.com/fr/blog/` → 200 (préservation URL legacy)
  - `https://axion-ia.com/fr/cas-concrets/` → 200
  - `https://axion-ia.com/fr/centre-aide/` → 200
  - `https://axion-ia.com/fr/faq/` → 200
  - `https://axion-ia.com/fr/glossaire/` → 200
  - `https://axion-ia.com/fr/guide-ia/` → 200
- Vérifie : JSON-LD valide par type (utiliser Schema.org validator mentalement).
- Vérifie : hreflang structure FR-only (EN désactivé V1 mais structure prête).
- Vérifie : canonical URL strict, pas de cluster cannibale.
- Vérifie : entrées récentes ingérées factory apparaissent dans sitemap + RSS.
- Anti-pattern : 301 redirect chain sur anciennes URLs ; `og:image` qui pointe vers localhost ; balises meta `noindex` oubliées en prod sur page non-noindex.

### Agent 5 — Recherche FTS + pgvector

- Output : `05-SEARCH.md`.
- Vérifie : indexes GIN sur `tsvector` FR (et structure EN prête).
- Vérifie : extension pgvector installée + indexes `ivfflat`/`hnsw` performants.
- Vérifie : `src/lib/knowledge/search-fts.ts` utilise correctement `to_tsvector('french', ...)` + `unaccent` + `pg_trgm`.
- Vérifie : `search-hybrid.ts` combine FTS + cosine via RRF.
- Vérifie : facettes (`type`, `domain`, `tags`, `audience`, dateRange) opérationnelles.
- Vérifie : ranking inclut boost `pinned`, `helpfulCount`, fraîcheur.
- Smoke test `GET /api/internal/kb/search?q=test&type=article` → 200 + résultats triés.
- Vérifie : `LIMIT` strict, pas de full-scan.
- Anti-pattern : FTS sans `unaccent` ; embedding inclut `confidentiality='secret'` ; recharger toute la table sur search.

### Agent 6 — API ingest + safeguards

- Output : `06-API-INGEST-SAFEGUARDS.md`.
- Vérifie : endpoint `/api/internal/kb/ingest` présent + HMAC SHA-256 vérifiée.
- Vérifie : Zod schema strict + `idempotency-key` obligatoire.
- Vérifie : rate limit Redis bucket 200/min/factory + burst 500.
- Vérifie : circuit breaker actif à 50% erreurs/min.
- Vérifie : queue BullMQ `knowledge-ingest` concurrency 4 + retry 3 exponential + dead-letter queue.
- Vérifie : audit log immuable `source.factoryId/promptId/modelUsed/cost`.
- Vérifie : kill switch `KB_AUTO_PUBLISH=false` env var fonctionnel (publications bloquées, queue continue).
- Vérifie : volume gate (> 150/heure → bascule `audience='team'`).
- Vérifie : quality fail rate gate (> 20% batch → revue manuelle).
- Vérifie : dedup match rate gate (> 30% → alerte).
- Vérifie : bouton DR massif `unpublish-between(t1, t2)` transactionnel + log.
- Smoke test simulé (sans appel POST réel) : lire le code de la handler + tests unitaires.
- Anti-pattern : endpoint sans HMAC ; idempotency-key optionnelle ; queue sans retry ; circuit breaker absent ; audit log effaçable.

### Agent 7 — Auto SEO/AEO/GEO

- Output : `07-SEO-AEO-GEO.md`.
- Vérifie sur 20 entrées récentes échantillonnées :
  - Meta title 50-60 chars + suffixe « — Axion-IA »
  - Meta description 140-160 chars + bénéfice + CTA implicite
  - JSON-LD valide par type (`Article`, `FAQPage`, `HowTo`, `DefinedTerm`, `TechArticle`, etc.)
  - Open Graph image générée dynamiquement par type
  - AEO bloc « Réponse directe » 50-80 mots en haut
  - GEO entités auto-taggées (`villes[]`, `secteurs[]`, `metiers[]`, `outils[]`)
  - `areasServed` JSON-LD si applicable
  - Canonical strict
  - hreflang structure FR active (EN désactivé V1)
- Vérifie : sitemap-knowledge auto-injecté
- Vérifie : IndexNow ping auto au publish
- Anti-pattern : meta title dupliqué entre entrées ; JSON-LD invalide (mauvais types) ; AEO bloc absent ; GEO entités hardcodées.

### Agent 8 — Quality gates + dedup + PII

- Output : `08-QUALITY-DEDUP-PII.md`.
- Vérifie : `src/lib/knowledge/quality-gates.ts` implémente heuristiques bloquantes :
  - Mot « formation » présent → REJECT (lint check + runtime)
  - Body < 300 mots (sauf `faq`, `glossary_term`) → REJECT
  - Aucun H2 → REJECT
  - ≥ 5 fautes FR → REJECT
  - Liens non-https → REJECT
  - Embeds non whitelistés → REJECT
- Vérifie : LLM scoring Claude Haiku 4.5 cached, seuils par type, échec → `audience='team'` + alerte Telegram.
- Vérifie : `src/lib/knowledge/dedup-pgvector.ts` calcule cosine sur `title + excerpt + 500 premiers mots body`, seuil ≥ 0.92 REJECT, 0.85-0.92 flag `dedup_warning`.
- Vérifie : `pii-redaction.ts` en mode bloquant strict (email/téléphone/RIB/IBAN/SIREN clients).
- Vérifie : whitelist PII propre (URL site, contact@axion-ia.com).
- Smoke test : lire `tests/integration/knowledge/quality-gates.test.ts` + `dedup-pgvector.test.ts` + `pii-scan-bloquant.test.ts` → tous verts.
- Anti-pattern : seuil quality unique pour tous les types ; dedup sur title seul ; PII whitelist trop large.

### Agent 9 — Web Vitals + perf

- Output : `09-WEB-VITALS.md`.
- Vérifie LHCI sur 6 routes pivot :
  - `/fr/` (homepage)
  - `/fr/ressources/` (hub)
  - `/fr/blog/[slug-pivot]`
  - `/fr/cas-concrets/[slug-pivot]`
  - `/fr/centre-aide/[slug-pivot]`
  - `/fr/glossaire/[slug-pivot]`
- Budgets `AGENTS.md` : LCP ≤ 1800 p75, INP ≤ 100 p75, CLS = 0, TBT ≤ 150, First Load JS ≤ 75 KB gz.
- Smoke test CrUX p75 via Search Console (lecture seule).
- Vérifie : ISR `revalidate: 3600` + on-demand revalidate au publish.
- Vérifie : Tiptap JSON rendu SSR pur côté public (pas d'hydratation lourde).
- Vérifie : images via `<Image>` next + variantes responsive sharp.
- Vérifie : bundle splitting par route group.
- Anti-pattern : importer Tiptap éditeur en public ; charger l'éditeur dans `mes-ressources/` ; pas de `loading.tsx`.

### Agent 10 — WCAG 2.2 AA + E-E-A-T

- Output : `10-A11Y-EEAT.md`.
- Vérifie axe-core CI sur 6 routes pivot : zéro erreur AA.
- Revue manuelle 3 pages : tab order, focus visible, skip-links, `aria-live` autosave, `aria-current` facettes, `lang` correct, contrast ≥ 4.5:1 body / ≥ 3:1 large.
- Vérifie alt text bloquant publication (lecture du code `quality-gates.ts` + tests).
- Vérifie sur 10 entrées récentes :
  - Bloc auteur (avatar + bio + lien profil)
  - `lastReviewedAt` affiché
  - `reviewedBy` distinct de `author` si pair-review
  - Citations sources en bas
  - Bouton « comment citer cette page » (BibTeX + APA + permalink)
- Vérifie pages auteur `/fr/equipe/[slug]` si présentes.
- Anti-pattern : alt text auto-publié sans review humaine V1 (à 100/jour pas grave si on a alt text suggéré par IA vision, mais doit être présent) ; cacher `lastReviewedAt` ; faux badges fact-checked.

### Agent 11 — Sécurité

- Output : `11-SECURITY.md`.
- Vérifie : sanitization Tiptap SSR (whitelist nodes/marks, jamais `dangerouslySetInnerHTML` brut).
- Vérifie : SSRF protection sur embeds (whitelist YouTube/Vimeo/Loom).
- Vérifie : CSP nonce strict (mémoire `axionia_session_2026-05-09_sprint_24`).
- Vérifie : HMAC sur endpoint `/api/internal/kb/ingest`.
- Vérifie : rate limit `kb_helpful` (1 vote/IP/entrée/24h).
- Vérifie : rate limit FTS public (60/IP/min).
- Vérifie : rate limit bulk import admin (5/min).
- Vérifie : secrets jamais commités — grep `KB_INGEST_SECRET`, `KB_AUTO_PUBLISH`, etc. dans le repo, doivent être absents (en `.env` seulement).
- Vérifie : `tests/integration/knowledge/tiptap-sanitize.test.ts` couvre injections XSS.
- Anti-pattern : `dangerouslySetInnerHTML` ; CSP avec `unsafe-inline` ; secret en clair dans un commit.

### Agent 12 — RGPD + retention + backup/DR

- Output : `12-RGPD-DR.md`.
- Vérifie : `pii-redaction.ts` en mode bloquant à la publication + à l'export GDPR.
- Vérifie : cron `knowledge-retention-purge.ts` actif (BullMQ) + `expiresAt` honoré.
- Vérifie : audit log immuable des publications automatiques (`source.factoryId`).
- Vérifie : audit log des accès `confidentiality='secret'`.
- Vérifie : DPA Hetzner + DPA Cloudflare papier signés (lecture mémoire `axionia_session_2026-05-09_sprint_24_1` + checklist cutover).
- Vérifie : `scripts/backup-knowledge.sh` quotidien.
- Vérifie : `scripts/restore-knowledge-test.sh` testé mensuellement (lecture dernier log DR drill).
- Vérifie : export GDPR full-KB endpoint `/api/internal/kb/export-full` protégé OWNER + rate-limited 1/jour.
- Vérifie : `legal/sous-processeurs` mise à jour si embeddings Anthropic (Voyage AI).
- Anti-pattern : export CSV sans masquage PII ; backup non testé ; DPA absents.

### Agent 13 — Tests E2E + intégration

- Output : `13-TESTS.md`.
- Vérifie présence + verdict des tests :
  - Unit (Vitest) : ≥ 30 sur server actions, ≥ 15 sur SSOT helpers, ≥ 10 sur rendu Tiptap.
  - Intégration (Vitest + DB test) : ≥ 10 sur workflow states + versions + relations + slug history + quality score + PII scan + Tiptap sanitize + import batch + migration legacy.
  - E2E (Playwright) sous `tests/e2e/knowledge/` : ≥ 9 scénarios (creation-publication, workflow-review, recherche-fts, surface-client, import-md, permissions-rbac, accessibility-axe, scheduled-publish, slug-redirect-301).
- Vérifie : couverture critique ≥ 80% sur `src/lib/knowledge/*` et `src/server/actions/knowledge/*`.
- Vérifie : LHCI gate dans CI.
- Vérifie : axe-core CI gate.
- Vérifie : aucun test `skip()` ou `xtest()` résiduel.
- Anti-pattern : tests qui dépendent du wall-clock ; E2E qui partent en boucle infinie ; skip non motivé.

### Agent 14 — Observabilité

- Output : `14-OBSERVABILITY.md`.
- Vérifie Sentry custom events configurés :
  - `kb.ingest.received`, `kb.ingest.rejected`
  - `kb.publish.success`, `kb.publish.failed`
  - `kb.dedup.match`, `kb.quality.fail`, `kb.pii.blocked`
  - `kb.volume.anomaly`
- Vérifie Plausible goals :
  - `kb_view`, `kb_search`, `kb_helpful_up`, `kb_helpful_down`
- Vérifie dashboard `/connaissances/sante` montre temps-réel :
  - Volume horaire/quotidien
  - Taux quality fail
  - Taux dedup match
  - Latence p95 ingest → publish
  - Top entrées par vues / helpful
- Vérifie alertes Telegram volume anormal (test passif sur les logs).
- Vérifie runbook prod : « comment dépublier en urgence », « comment toggler kill switch », « comment restaurer une version », « comment investigate dedup match anormal ».
- Anti-pattern : Sentry sans contexte ; dashboard qui interroge DB sans cache ; runbook absent.

### Agent 15 — Doctrine + cohérence

- Output : `15-DOCTRINE-COHERENCE.md`.
- Vérifie mot « formation » BANNI partout :
  - `grep -i 'formation\|training' src/` + i18n messages → zéro occurrence dans copy public.
  - `scripts/check-knowledge-banned-words.ts` actif en CI.
  - Aucune entrée KB publiée avec « formation » dans title/excerpt/body/metaTitle/metaDescription.
- Vérifie naming Axion-IA partout (jamais « agence/studio/atelier » sauf en comparatif concurrent).
- Vérifie FR-only V1 (sitemap EN désactivé, mais structure préservée pour V2).
- Vérifie 28 types KB V4 présents et utilisés.
- Vérifie alignement avec `axionia-core` + `_DECISIONS-FINALES.md` (mémoires).
- Vérifie cohérence avec `PROMPT-CONTENT-GENERATOR-MASTER-2026.md` (interface contractuelle ingest).
- Anti-pattern : utilisation du mot « formation » même dans un commentaire de code ; type KB non documenté dans SSOT ; doctrine contredite par un sprint.

### Agent 16 — Infrastructure + coûts

- Output : `16-INFRA-COST.md`.
- Vérifie CPX32 :
  - RAM utilisée < 75% (lecture Hetzner Cloud API GET read-only)
  - Disk utilisé < 70%
  - IOPS < 80% limite
- Vérifie pgvector :
  - Taille embeddings table
  - Performance des indexes (`EXPLAIN ANALYZE` mental sur requête de référence)
- Vérifie coût mensuel IA réel :
  - Anthropic Voyage AI embeddings : consommation × prix
  - Claude Haiku quality scoring × prix
  - Claude Haiku auto-SEO × prix
  - Total ≤ €30/mois (vs estimé €25)
- Vérifie projection 12 mois :
  - Disk projeté < 80% CPX32 → OK V1, sinon upgrade CPX42 anticipé.
- Vérifie plan upgrade CPX42 documenté (script `scripts/migrate-to-cpx42.sh` ou runbook).
- Vérifie Cloudflare Cache Rules + Hit Ratio (Cloudflare API GET read-only).
- Anti-pattern : pgvector sans index ; coût IA non monitoré ; upgrade VPS non préparé ; cache Cloudflare désactivé sur surfaces KB.

---

## 3. PHASE 2 — SMOKE TESTS LIVE READ-ONLY (10-15 min, après les agents)

Tu effectues les smoke tests suivants en lecture seule sur prod. Output : `97-SMOKE-TESTS-LIVE.md`.

### 3.1 Surfaces publiques

| Test                                   | Méthode     | Attendu                          | Statut |
| -------------------------------------- | ----------- | -------------------------------- | ------ |
| `GET https://axion-ia.com/sitemap.xml` | curl HEAD   | 200 + `<urlset>` + entrées KB    | ⬜     |
| `GET .../fr/ressources/`               | curl HEAD   | 200 + facettes                   | ⬜     |
| `GET .../fr/ressources/feed.xml`       | curl GET 1k | 200 + RSS valide                 | ⬜     |
| `GET .../fr/ressources/feed.json`      | curl GET 1k | 200 + JSON Feed                  | ⬜     |
| `GET .../llms.txt`                     | curl GET 5k | 200 + lignes KB                  | ⬜     |
| `GET .../fr/blog/[pivot]`              | curl HEAD   | 200 + JSON-LD `Article`          | ⬜     |
| `GET .../fr/cas-concrets/[pivot]`      | curl HEAD   | 200 + JSON-LD `CaseStudy`/custom | ⬜     |
| `GET .../fr/centre-aide/[pivot]`       | curl HEAD   | 200 + JSON-LD `TechArticle`      | ⬜     |
| `GET .../fr/faq`                       | curl HEAD   | 200 + JSON-LD `FAQPage`          | ⬜     |
| `GET .../fr/glossaire/[pivot]`         | curl HEAD   | 200 + JSON-LD `DefinedTerm`      | ⬜     |
| `GET .../fr/guide-ia/[pivot]`          | curl HEAD   | 200 + JSON-LD `HowTo`            | ⬜     |

### 3.2 Surfaces admin (sans login, attendu 401/redirect)

| Test                                           | Attendu                  |
| ---------------------------------------------- | ------------------------ |
| `GET .../fr/<adminPrefix>/connaissances/`      | 401 ou redirect `/login` |
| `GET .../fr/<adminPrefix>/connaissances/sante` | 401 ou redirect          |

### 3.3 API surfaces

| Test                                                                     | Attendu            |
| ------------------------------------------------------------------------ | ------------------ |
| `GET .../api/healthz`                                                    | 200 + `{ok: true}` |
| `GET .../api/internal/kb/search?q=ia&type=article` (avec auth si requis) | 200 + résultats    |
| `POST .../api/internal/kb/ingest` sans signature HMAC                    | 401                |
| `POST .../api/internal/kb/ingest` avec mauvaise signature                | 401                |

### 3.4 Anomalies à signaler

- Toute route 5xx → P0
- Toute route 404 inattendue → P0
- Tout JSON-LD invalide → P1
- Tout `og:image` pointant ailleurs que `axion-ia.com` → P1
- Tout temps de réponse > 2s → P2

---

## 4. PHASE 3 — SYNTHÈSE + VERDICT

Output : `_AUDIT/CERTIFICATION-KB-V1-2026/SYNTHESIS.md` + `99-FINDINGS-CONSOLIDATED.md`.

### 4.1 `SYNTHESIS.md`

- **TL;DR 1 page max** : verdict GO PROD / CONDITIONAL GO PROD / NO-GO PROD.
- **Score `/400`** détaillé (voir §5).
- **Top 10 findings P0** (bloquants GO PROD).
- **Top 10 quick wins** P1 réalisables < 1 dj.
- **Décisions ouvertes** restantes (à valider par Will).
- **Recommandation cutover** : prêt à activer `KB_AUTO_PUBLISH=true` ou pas encore.

### 4.2 `99-FINDINGS-CONSOLIDATED.md`

Table consolidée tous agents :

| ID    | Priorité | Agent | Titre                     | Détail                       | Chemin:ligne                              | Action recommandée                                      | Effort |
| ----- | -------- | ----- | ------------------------- | ---------------------------- | ----------------------------------------- | ------------------------------------------------------- | ------ |
| F-001 | P0       | 11    | XSS via mark `<a>` Tiptap | Aucune sanitization sur href | `src/lib/knowledge/tiptap-sanitize.ts:42` | Whitelist `href` strict, refuser `javascript:`, `data:` | 0.5 dj |
| ...   | ...      | ...   | ...                       | ...                          | ...                                       | ...                                                     | ...    |

Tri : P0 d'abord, P1, P2, P3.

### 4.3 Verdict

- **GO PROD** : score ≥ 360/400, 0 P0, ≤ 5 P1 acceptables.
- **CONDITIONAL GO PROD** : score 300-359, 0 P0, > 5 P1 (correctifs à faire J+30 avant activation `KB_AUTO_PUBLISH=true`).
- **NO-GO PROD** : score < 300 OU ≥ 1 P0. Sprint correctif obligatoire avant cutover.

---

## 5. CRITÈRES DE SCORING `/400`

40 dimensions × `/10` = `/400`.

| #   | Dimension                                                 | Pondération |
| --- | --------------------------------------------------------- | ----------- |
| 1   | Schéma Prisma cohérent + migrations idempotentes          | /10         |
| 2   | SSOT complet + helpers typés                              | /10         |
| 3   | Admin viewer + monitoring + DR opérationnels              | /10         |
| 4   | URLs publiques préservées (zéro 301 sur anciennes)        | /10         |
| 5   | Hub `/ressources/` + RSS + JSON Feed + llms.txt           | /10         |
| 6   | Surface client `/mes-ressources/`                         | /10         |
| 7   | Recherche FTS FR                                          | /10         |
| 8   | Recherche hybride pgvector + cosine RRF                   | /10         |
| 9   | API ingest HMAC + Zod + idempotency + rate limit          | /10         |
| 10  | Circuit breaker + retry + dead-letter queue               | /10         |
| 11  | Auto meta titles + descriptions                           | /10         |
| 12  | Auto JSON-LD par type                                     | /10         |
| 13  | Auto Open Graph image dynamique                           | /10         |
| 14  | Auto AEO bloc « Réponse directe »                         | /10         |
| 15  | Auto GEO entités tagging                                  | /10         |
| 16  | Quality gates heuristiques bloquantes                     | /10         |
| 17  | Quality gates LLM scoring                                 | /10         |
| 18  | Dedup pgvector cosine bloquant                            | /10         |
| 19  | PII scan bloquant                                         | /10         |
| 20  | Pipeline médias + sharp AVIF/WebP + EXIF strip            | /10         |
| 21  | Slug history + redirects 301                              | /10         |
| 22  | Web Vitals respectent budgets sur 6 routes pivot          | /10         |
| 23  | WCAG 2.2 AA validé (axe-core CI + revue manuelle)         | /10         |
| 24  | E-E-A-T (auteur, reviewed-by, fact-checked, citations)    | /10         |
| 25  | Sécurité contenu (XSS Tiptap, SSRF, CSP)                  | /10         |
| 26  | Secrets jamais commités                                   | /10         |
| 27  | RGPD : retention purge cron + audit log immuable          | /10         |
| 28  | Backup/DR KB + DR drill réussi                            | /10         |
| 29  | Tests unit ≥ 30 + intégration ≥ 10 + E2E ≥ 9 verts        | /10         |
| 30  | LHCI CI gate vert                                         | /10         |
| 31  | Sentry events `kb.*` configurés                           | /10         |
| 32  | Plausible goals configurés                                | /10         |
| 33  | Dashboard `/connaissances/sante` opérationnel             | /10         |
| 34  | Kill switch `KB_AUTO_PUBLISH` testé                       | /10         |
| 35  | DR massif « unpublish-between » testé                     | /10         |
| 36  | Doctrine « formation » BANNI tenue partout                | /10         |
| 37  | Doctrine naming Axion-IA tenue                            | /10         |
| 38  | Doctrine FR-only V1 + architecture multilingue préservée  | /10         |
| 39  | Infrastructure CPX32 sous seuils + plan upgrade documenté | /10         |
| 40  | Coût IA réel ≤ €30/mois                                   | /10         |

---

## 6. LIVRABLES OBLIGATOIRES

Sous `_AUDIT/CERTIFICATION-KB-V1-2026/` :

1. `00-REALITY-CHECK.md`
2. `01-SCHEMA-MIGRATIONS.md`
3. `02-SSOT.md`
4. `03-ADMIN.md`
5. `04-PUBLIC-SURFACES.md`
6. `05-SEARCH.md`
7. `06-API-INGEST-SAFEGUARDS.md`
8. `07-SEO-AEO-GEO.md`
9. `08-QUALITY-DEDUP-PII.md`
10. `09-WEB-VITALS.md`
11. `10-A11Y-EEAT.md`
12. `11-SECURITY.md`
13. `12-RGPD-DR.md`
14. `13-TESTS.md`
15. `14-OBSERVABILITY.md`
16. `15-DOCTRINE-COHERENCE.md`
17. `16-INFRA-COST.md`
18. `97-SMOKE-TESTS-LIVE.md`
19. `99-FINDINGS-CONSOLIDATED.md`
20. `SYNTHESIS.md` (TL;DR + scoring /400 + verdict)

Chaque fichier porte un header standard :

```markdown
# [TITRE] — Certification KB V1 Axion-IA — 2026

> Prompt : `_AUDIT/PROMPT-KB-V1-FINAL-CERTIFICATION-2026.md`
> Agent : N — [nom]
> Date : YYYY-MM-DD
> Statut : DRAFT (AUDIT-ONLY)
> Verdict partiel : GO / CONDITIONAL / NO-GO
```

---

## 7. ANTI-PATTERNS DE L'AUDIT (à éviter à tout prix)

1. **Fixer un truc « petit » en passant** : NON. Tu notes P0/P1/P2 et tu continues.
2. **Tester en mode mutant** (POST/PUT/DELETE) : NON. Read-only strict.
3. **Lancer `pnpm dev`/`build`/`db:migrate`** : NON.
4. **Présupposer le bon fonctionnement** sans lire le code : NON. Lit-le.
5. **Smoke tests destructifs** (créer une vraie entrée, supprimer) : NON.
6. **Modifier le prompt master V4** en cours d'audit : NON.
7. **Confondre P0 et P1** (P0 = bloque GO PROD, P1 = à fixer J+30).
8. **Oublier un agent** : tu produis les 16 livrables même si la dimension semble OK.
9. **Mauvais formats de findings** : utiliser le format imposé `[Pn] - titre - détail - chemin:ligne - action - effort`.
10. **Synthèse complaisante** : tu rapportes honnêtement, même si ça donne NO-GO. Pas de cadeau.

---

## 8. PHRASE D'INVOCATION

Pour lancer la certification :

> Lance le prompt `axionia/_AUDIT/PROMPT-KB-V1-FINAL-CERTIFICATION-2026.md` en mode AUDIT-ONLY STRICT. Fais d'abord la Phase 0.5 reality check seul, puis lance les 16 agents en parallèle, puis les smoke tests live read-only, puis la synthèse + verdict /400. Rien d'autre. Aucune écriture hors `_AUDIT/CERTIFICATION-KB-V1-2026/`. Stoppe avec un STOP & ASK final pour Will avec le verdict GO PROD / CONDITIONAL / NO-GO.

---

## 9. SORTIE ATTENDUE — RÉCAPITULATIF TL;DR (à Will, en fin d'audit)

Ton dernier message à Will doit contenir :

1. **Verdict** : GO PROD / CONDITIONAL GO PROD / NO-GO PROD.
2. **Score** : `XXX/400`.
3. **Liste des 20 fichiers** produits sous `_AUDIT/CERTIFICATION-KB-V1-2026/` (chemins cliquables).
4. **Top 5 findings P0** (s'il y en a — sinon dire « 0 P0 »).
5. **Top 5 findings P1** prioritaires (à fixer J+30).
6. **Recommandation cutover** : prêt pour `KB_AUTO_PUBLISH=true` (= activer factory automatique) ou pré-requis à débloquer.
7. **Sprints correctifs proposés** : si CONDITIONAL ou NO-GO, lister les sprints à lancer (effort en demi-journées).
8. **Aucune** invitation à corriger toi-même. Will lance les correctifs.

---

## 10. ANNEXES — LECTURES OBLIGATOIRES AVANT DÉMARRAGE

L'agent qui lance ce prompt **doit avoir lu** :

- `axionia/_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` (V4 — source de vérité de la cible)
- `axionia/_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` (interface factory amont)
- `axionia/_AUDIT/SESSION-2026-05-13-KNOWLEDGE-BASE-CREATION.md` (historique décisions)
- `axionia/_AUDIT/KNOWLEDGE-BASE-2026/SPRINT-*-REPORT.md` (tous les 21 reports)
- `axionia/AGENTS.md` (budgets Web Vitals)
- `axionia/Design.md` (doctrine éditoriale)
- `axionia/CLAUDE.md` (vivant, journal de bord)
- `axionia/prisma/schema.prisma` (modèles `Knowledge*` finaux)
- `axionia/src/content/knowledge-base.ts` + `knowledge/*.ts` (SSOT)
- `axionia/src/lib/pii-redaction.ts` (helper RGPD)

Memo mémoire utile (auto-memory, `~/.claude/projects/.../memory/`) :

- `axionia_session_2026-05-13_kb_creation` (V3 + pivot V4)
- `axionia_doctrine_code_ssot`
- `axionia_naming_cabinet` (mot « formation » banni)
- `axionia_hosting_hetzner` (CPX32 + Cloudflare Free)
- `axionia_cicd_github_actions_coolify` (auto-deploy)
- `axionia_session_2026-05-09_sprint_24_1` (PII redaction + DPA)
- `axionia_session_2026-05-09_cloudflare_phase5` (Cache Rules)
- `axionia_session_2026-05-13_seo_email_stack` (IndexNow helper, Clarity)

---

**Fin du prompt.** Ce fichier est **lecture seule** côté agent. Aucune modification autorisée pendant exécution. Si tu as une suggestion d'amélioration, tu la notes dans `SYNTHESIS.md` section « Améliorations du prompt pour V2 ».
