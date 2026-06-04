# MATRICE DE RÉALITÉ — chatbot Axion-IA (vérification E2E 2026-06-04)

Worktree `axionia-chatbot-fix`, branche `feat/chatbot-core`, HEAD `607814ef` (baseline `eb161f18`).
Infra de test : **Postgres 16 + pgvector réel** (docker `axion-ia-postgres`, host 5433) + **Redis 7 réel** (host 6381). 595 chunks KB réellement embeddés (session antérieure). `VOYAGE_API_KEY` + `ANTHROPIC_API_KEY` **absentes** → briques LLM-dépendantes = `⛔ BLOQUÉ-SECRET` (câblage prouvé, exécution réelle impossible sans clés).

Légende statut : ✅ PROD-READY PROUVÉ · 🟡 OK avec réserve · 🔴 CASSÉ→FIXÉ→REVÉRIFIÉ · ⛔ BLOQUÉ-SECRET/INFRA.

| T | Intitulé | Fichier(s) réel(s) | Implé. | Sans mock runtime | Testé réel (preuve) | Console admin | Défaut → fix | Statut |
|---|----------|--------------------|--------|-------------------|---------------------|---------------|--------------|--------|
| T-01 | Schéma DB chat_* + submission.source + prospect_profile | `prisma/schema.prisma`, migr. `20260603220000_chatbot_core`, `20260604190000_chatbot_prospect_profile` | oui | oui | `prisma migrate deploy` OK ; 8 tables `chat_*` présentes ; `submission.source` + `chat_conversations.prospect_profile` (colonne JSONB, pas table) | n/a | — | ✅ |
| T-02 | pgvector + FTS (HNSW + tsvector GIN) | `prisma/migrations_fts/20260603220500_chatbot_fts.sql` | oui | oui | `psql` : `embedding vector(1024)` + `tsv tsvector` + index `chat_kb_chunks_embedding_hnsw_idx` + `..._tsv_gin_idx` réels | n/a | — | ✅ |
| T-03 | Tenant single + isolation tenant_id | `src/server/chatbot/tenant.ts` | oui | oui | tenant `axion-ia` seedé ; retrieval filtré `tenant_id` (tenant bidon → 0 chunk, test `retrieval.test.ts`) | lecture réglages | — | ✅ |
| T-04 | Embeddings réels Voyage voyage-3-lite 1024 | `src/lib/knowledge/embeddings.ts` | oui | **stub sans clé** | câblage Voyage réel prouvé (`embedWithVoyage`, dim 1024, throw si HTTP err) ; appel réel impossible sans clé | n/a | stub utilisé par retrieval/cache → neutralisé (D-1/D-3) | ⛔ BLOQUÉ-SECRET |
| T-05 | Ingestion (chunker + worker BullMQ) | `ingestion/{chunker,ingest,seed-sources}.ts`, `queue/workers/chatbot-ingest-worker.ts` | oui | oui (chunking) ; embed=Voyage | 595 chunks réellement insérés en DB (tous embeddés) ; chunker unit 5 tests | bouton ingestion (action) | (ré)embedding live = ⛔ secret | 🟡 (données présentes ; ré-ingest live BLOQUÉ-SECRET) |
| T-06 | Retrieval hybride pgvector+FTS RRF | `src/server/chatbot/retrieval/hybrid-search.ts` | oui | **🔴→✅** | `retrieval.test.ts` : FTS réel trouve chunks pertinents, isolation tenant, charabia→0 | n/a | **D-1** : stub-vecteur polluait (charabia→8) → repli FTS-seul si stub | 🔴→FIXÉ→REVÉRIFIÉ (vol. vectoriel = ⛔ secret) |
| T-07 | Génération SSE streamée + persistance | `src/app/api/chatbot/message/route.ts`, `generation/generate-stream.ts`, `orchestrator.ts` | oui | oui (flux/persist) ; LLM=Anthropic | `smoke.test.ts` : stream SSE réel (`session→message→…→done`), persistance `chat_messages` (user+assistant) ; génération narrative = Anthropic | dashboard lit messages/coût | génération RAG narrative = ⛔ secret | 🟡 (flux+persist ✅ ; génération LLM ⛔) |
| T-08 | Widget île idle ssr:false HORS First Load | `src/components/chatbot/{ChatWidgetMount,ChatWidget}.tsx` | oui | oui | `next/dynamic ssr:false` + `requestIdleCallback` + `webpackChunkName:"chatbot-widget"` ; size-limit ≤ 30 KB gz configuré ; XSS-safe (nœud texte React, 0 `dangerouslySetInnerHTML`) | n/a | — | 🟡 (code ✅ ; CLS/size mesurés Lighthouse = non exécuté ici) |
| T-09 | useChatStream / SSE client | `src/components/chatbot/{useChatStream,sse}.ts` | oui | oui | unit `sse.test.ts` (13) + `useChatStream.test.tsx` verts | n/a | — | ✅ (unit) |
| T-10 | Rerank Voyage + repli RRF | `src/server/chatbot/retrieval/rerank.ts` | oui | oui (repli) ; rerank=Voyage | unit `rerank.test.ts` (repli testé) ; rerank réel = Voyage | n/a | — | 🟡 (repli ✅ ; rerank live ⛔) |
| T-11 | Seuil de confiance → escalade sans LLM | `src/server/chatbot/retrieval/confidence.ts` | oui | oui | conversations S20/S19 : faible confiance → escalade + RDV, 0 LLM (transcripts) ; unit confidence (4) | n/a | — | ✅ |
| T-12 | Registry tools + Zod | `src/server/chatbot/tools/registry.ts` | oui | oui | unit `registry.test.ts` (7) ; **NON câblé au runtime** (importé seulement par son test) | n/a | tool-calling LLM absent | 🟡 (unit ✅ ; non invoqué runtime) |
| T-13 | qualifier_prospect / chercher_ressource | `tools/{qualifier-prospect,chercher-ressource}.ts` | oui | oui | unit verts ; `chercher_ressource` renvoie null (0 article publié dev) ; **NON câblés runtime** (pas de tool-calling) | n/a | non invoqués en conversation | 🟡 (unit ✅ ; non câblés) |
| T-14 | Escalade → ChatEscalation + email + Telegram | `tools/escalader-question.ts`, route SSE | oui | oui (record+enqueue) ; Telegram=secret | escalade câblée dans la route (effet de bord post-`done`) ; unit (3) ; Telegram/SMTP = secrets absents | liste/résolution escalades | envoi Telegram/email = ⛔ secret | 🟡 (record+câblage ✅ ; envoi ⛔) |
| T-15 | proposer_rdv (lien, 0 création serveur) | `tools/proposer-rdv.ts` ; orch. constante `/fr/appel` | oui | oui | conversations S11 : lien `/fr/appel`, aucune création serveur ; unit (3) | n/a | tool non câblé (orch. utilise constante équivalente) | ✅ |
| T-16 | Mode dégradé / circuit breaker | `resilience/circuit-breaker.ts`, orch., generate-stream | oui | oui | S19 : Anthropic throw (pas de clé) → repli RDV+escalade, **0 erreur brute** (transcript) ; unit CB (6) | n/a | — | ✅ |
| T-17 | capturer_lead idempotent → Submission source=chatbot | `tools/capturer-lead.ts`, `api/chatbot/lead/route.ts` | oui | oui | `robustness.test.ts` : consent requis, source=chatbot, idempotence séquentielle ET concurrente (race→1) | conversations (hasLead) | — | ✅ |
| T-18 | Classification intention | `catalog/slot-filling.ts` (`classifyIntent` interne) | oui | oui | classifieur **déterministe mots-clés** (pas modèle) ; conversations couvrent rdv/lead/offre/explication/hors_sujet ; option LLM `CHATBOT_LLM_CLASSIFIER` off | n/a | déterministe (noté) | ✅ (déterministe) |
| T-19 | Dashboard admin données réelles | `(admin)/.../chatbot/page.tsx`, `features/admin-chatbot/actions.ts` | oui | oui | `getChatbotDashboardStats` = counts DB réels ; auth() + noindex (layout `robots:index:false`) | oui | — | ✅ |
| T-20 | Prompt versionné + rollback runtime | `generation/prompt-version.ts` | oui | oui | `admin-rgpd.test.ts` : create→activate→rollback, `getActivePromptContent` reflète, invariant 1 actif | page prompt | — | ✅ |
| T-21 | Escalades console (résolution) | `actions.ts` (`resolveEscalationAction`), pages escalades | oui | oui | action câblée : update statut + ActivityLog + revalidate (RBAC requireAdminWrite) | oui | — | 🟡 (fonction ✅ ; action via session admin = guard testé unitairement) |
| T-22 | Observabilité (Plausible/Sentry/coût) | route, `chat_messages` (latence/tokens/coût) | oui | oui | persistance latence+coût+modèle prouvée (`persistTurn`) ; Plausible/Sentry = câblage front | dashboard coût | events front non exécutés ici | 🟡 |
| T-23 | RGPD export + erase + purge chat_* | `lib/rgpd-export-chat.ts`, `lib/rgpd-erase.ts`, `workers/retention-purge-worker.ts` | oui | oui | `admin-rgpd.test.ts` : export retrouve convo+messages, erase supprime (cascade), sur données de TEST | n/a | — | ✅ |
| T-24 | Éval (dataset + scoring) | `eval/dataset.ts` | oui | oui (dataset) ; scoring LLM=secret | unit `dataset.test.ts` (6) ; dataset = INTENT_EVAL + GUARD_EVAL ; scoring génératif = Anthropic | n/a | scoring live ⛔ ; couverture à étendre (P1) | 🟡 |
| T-25 | Réglages tenant éditables répercutés | `actions.ts` (`updateChatbotSettingsAction`), `tenant.ts` mergeSettings | oui | oui | `admin-rgpd.test.ts` : update `confidenceThreshold` → `getDefaultTenant` reflète | page réglages | — | ✅ |
| T-26 | Cache sémantique (hit/miss, isolation) | `semantic-cache/cache.ts` | oui | **🔴→✅** | unit (7) ; SQL cosine + isolation tenant + version ; hit sémantique réel = Voyage | n/a | **D-3** : stub-embedding → faux-hit possible → cache no-op si stub | 🔴→FIXÉ (hit sémantique live ⛔) |
| T-27 | Invalidation cache (version knowledge) | `semantic-cache/cache.ts` (`invalidateStaleCache`) | oui | oui | logique version + DELETE prouvée (code + unit) | n/a | — | 🟡 (unit ✅ ; cycle live ⛔ secret) |
| T-28 | Token-bucket / backpressure | `resilience/token-bucket.ts`, orch. | oui | oui | unit (3) ; backpressure orch. (acquireLlmSlot false → RDV) | n/a | — | ✅ (unit + orch.) |
| T-29 | Bannissement / anti-abus | `security/ban.ts`, `lib/rate-limit.ts`, route | oui | oui | `robustness.test.ts` : >20 msg/min même IP → 429 (Redis réel), pas d'erreur brute ; unit ban (5) | n/a | — | ✅ |
| T-30 | Garde-fous coût (cap → mode éco + alertes) | `cost/cost-guard.ts` | oui | oui (cap) ; alerte Telegram=secret | `cost-guard.test.ts` : spend réel DB, cap → ecoMode true/false (Redis réel) ; alerte Telegram ⛔ | dashboard coût | — | ✅ (alerte Telegram ⛔) |
| T-31 | Contexte long (résumé worker) | `context/summarize.ts`, route | oui | oui (déclenchement) ; résumé=LLM | unit (5, best-effort null si LLM down) ; déclenchement `shouldSummarize` câblé | n/a | résumé live = ⛔ secret | 🟡 |
| T-32 | Charge k6 | `scripts/load-test-chatbot.k6.js` | oui | oui | script présent ; **k6 non exécuté** (binaire absent / hors budget) | n/a | — | ⛔ BLOQUÉ-INFRA (k6) |
| T-33 | Catalogue offres typé | `src/content/offers-catalog.ts` | oui | oui | conversations : offres réelles par vertical, prix SSOT, urlFR valides (output-guard vert) | n/a | — | ✅ |
| T-34 | Résolveur offre→URL FR canonique | `src/lib/offer-url.ts`, output-guard | oui | oui | toutes urlFR des cartes ∈ routes connues (output-guard `isKnownFrUrl`) | n/a | — | ✅ |
| T-35 | rechercher_offres multi-facettes | `tools/rechercher-offres.ts` | oui | oui | conversations S2/S3/S5/S12/S14 : filtres vertical/prix/effectif/format déterministes | n/a | — | ✅ |
| T-36 | Repli / cross-sell | `catalog/repli.ts` | oui | oui | S3 (1200 sal. → repli audit + RDV) ; unit repli | n/a | couverture catalogue effectif (P2) | 🟡 |
| T-37 | Slot-filling multi-tours | `catalog/slot-filling.ts` | oui | oui | S12 : slots accumulés (vertical→format→effectif) ; **D-2** raffinement ; unit (slot) | n/a | **D-2** : « plutôt … » classé decline → fixé | 🔴→FIXÉ→REVÉRIFIÉ |
| T-38 | Confirmation-avant-lien | `catalog/link-flow.ts`, orch. | oui | oui | unit link-flow (10) ; conversations : « Souhaitez-vous les liens ? » avant envoi | page réglages (confirmBeforeLinks) | — | ✅ |
| T-39 | Output-guard zéro-hallucination | `security/output-guard.ts` | oui | oui | `security.test.ts` : prix hors SSOT + URL inconnue rejetés ; appliqué à CHAQUE conversation (0 violation) | n/a | — | ✅ |
| SEC | Prompt-guard injection/exfil/jailbreak | `security/prompt-guard.ts`, route | oui | oui | `security.test.ts` : 8 attaques déviées (0 delta LLM, 0 fuite) ; unit (4) | n/a | — | ✅ |
| SEC | Isolation session | route (`isNewSession` serveur), DB | oui | oui | `robustness.test.ts` : 2 sessions = états slots séparés ; sessionUuid v4 = capacité secrète | n/a | — | ✅ |
| SEC | PII (hash IP RGPD) | route (`hashIp` SHA-256 + `IP_HASH_SALT`) | oui | oui | `ipHash` persisté (jamais IP claire) ; salt requis | n/a | — | ✅ |
| SEC | XSS rendu widget | `components/chatbot/ChatWidget.tsx` | oui | oui | 0 `dangerouslySetInnerHTML`/`innerHTML` ; texte = nœud React échappé ; href = catalogue interne | n/a | — | ✅ |
| PLAT | Route ↔ proxy/i18n | `src/proxy.ts` | oui | oui | matcher `/((?!api/|…` exclut tout `/api/` → `/api/chatbot/*` intact | n/a | — | ✅ |
| PLAT | CSP SSE | `src/lib/csp.ts` | oui | oui | `connect-src 'self'` autorise SSE same-origin ; `X-Accel-Buffering:no` (route) | n/a | — | ✅ |
| PLAT | Kill-switch | route (`CHATBOT_ENABLED`), mount (`NEXT_PUBLIC_CHATBOT_ENABLED`) | oui | oui | `smoke.test.ts` : `CHATBOT_ENABLED!=true` → 503 ; widget null si flag off | n/a | — | ✅ |
| PLAT | Build stub-aware | route `force-dynamic`, widget `ssr:false`, prisma/redis stub-aware | oui | oui | typecheck vert ; route non-SSG ; **`next build` complet non exécuté** (~25 min/17k routes, hors budget) | n/a | — | 🟡 (statique ✅ ; build complet non lancé) |
| PLAT | Web Vitals widget (Lighthouse) | `lighthouserc.json`, size-limit | oui | oui | size-limit ≤ 30 KB gz configuré ; **`pnpm lhci` non exécuté** (serveur live requis) | n/a | — | 🟡 (config ✅ ; mesure non lancée) |

## Récap chiffré

- **✅ PROD-READY PROUVÉ** : 22
- **🟡 OK avec réserve** : 16 (majorité = volet LLM/mesure live ⛔, ou tool-calling non câblé)
- **🔴→FIXÉ→REVÉRIFIÉ** : 3 (D-1 retrieval, D-2 slot-refinement, D-3 cache)
- **⛔ BLOQUÉ-SECRET/INFRA** : T-04 (Voyage), T-32 (k6) explicites ; volets LLM des 🟡 = BLOQUÉ-SECRET (Anthropic/Voyage)

Aucune ligne ✅ sans preuve d'exécution réelle (cf. `RAPPORT-E2E.md`). Aucune brique LLM-dépendante marquée ✅.
