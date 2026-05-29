# 05 — Plan d'implémentation & cloisonnement (Phase 5)

> Arborescence cible, fichiers à créer vs modifier, spec des tools/RAG, observabilité, tests, déploiement réversible, amorçage knowledge, roadmap MVP mappée CI/CD. **Aucun code n'est écrit ici** — c'est le plan d'exécution de la conversation suivante.
> Date : 2026-05-29. Patron : module `image-bank` (doc 02 §6).

---

## 1. Plan de cloisonnement des fichiers

### 1.1 Arborescence cible (à CRÉER)

```
axionia/
├── prisma/
│   ├── schema.prisma                          # [MODIFIER] +8 modèles chat_* (ADR-CB-03) + enums
│   ├── migrations/<ts>_chatbot_core/          # [CRÉER] tables chat_* (sans vector/tsv)
│   └── migrations_fts/
│       └── <ts>_chatbot_fts.sql               # [CRÉER] colonnes vector(1024)+HNSW + tsvector+GIN sur chat_kb_chunks/chat_semantic_cache
│
├── src/server/chatbot/                        # [CRÉER] cœur cloisonné (≈ image-bank)
│   ├── constants.ts                           # seuils défaut, modèles, cache tags, budgets
│   ├── types.ts                               # types I/O (Intent, RetrievedChunk, ChatTurn…)
│   ├── orchestrator.ts                        # pipeline temps réel (B2 cahier) — canal-agnostique
│   ├── retrieval/
│   │   ├── hybrid-search.ts                   # pgvector cosine + FTS (réutilise searchKnowledge)
│   │   ├── rerank.ts                          # Voyage rerank-2.5-lite (rôle provider) + repli
│   │   └── confidence.ts                      # seuil de confiance → escalade
│   ├── semantic-cache/
│   │   ├── lookup.ts                          # cosine top-1 ≥ seuil + version check
│   │   └── invalidate.ts                      # invalidation par version de knowledge
│   ├── generation/
│   │   ├── generate-stream.ts                 # appel provider-router stream + prompt caching
│   │   └── system-prompt.ts                   # assemble prompt versionné + brand-voice + chunks
│   ├── context/
│   │   └── summarize.ts                       # contexte long (résumé modèle léger)
│   ├── tools/
│   │   ├── registry.ts                        # registre des 5 tools (schémas JSON + dispatch)
│   │   ├── qualifier-prospect.ts
│   │   ├── capturer-lead.ts                   # → Submission, idempotent
│   │   ├── proposer-rdv.ts                    # → Calendly
│   │   ├── chercher-ressource.ts              # → Article/CaseStudy
│   │   └── escalader-question.ts              # → ChatEscalation + email + Telegram
│   ├── ingestion/
│   │   ├── chunker.ts                         # 300–600 tokens, overlap ~15%, contextualisation
│   │   └── seed-sources.ts                    # KnowledgeEntry/KbFact/pages services → chunks
│   ├── tenant.ts                              # résolution clé tenant → tenant_id (serveur)
│   ├── rate-limit.ts                          # token-bucket LLM + backpressure (réutilise lib/rate-limit)
│   ├── security/
│   │   ├── prompt-guard.ts                    # anti-injection/jailbreak (doc 08)
│   │   └── output-guard.ts                    # anti-exfiltration / cloisonnement contexte
│   ├── feature-flag.ts                        # CHATBOT_ENABLED + par tenant/page (≈ knowledge/feature-flag)
│   ├── kill-switch.ts                         # ≈ knowledge/kill-switch
│   └── eval/
│       └── dataset.ts                         # ~50 Q/R de référence (FR)
│
├── src/server/queue/
│   ├── queues.ts                              # [MODIFIER] +queues chatbot-ingest, chatbot-summary, chatbot-escalation
│   ├── worker.ts                              # [MODIFIER] +spread startChatbot*Worker (env-gated CHATBOT_ENABLED)
│   └── workers/
│       ├── chatbot-ingest-worker.ts           # [CRÉER] chunking + embeddings → chat_kb_chunks
│       ├── chatbot-summary-worker.ts          # [CRÉER] résumés contexte long
│       └── chatbot-escalation-worker.ts       # [CRÉER] email escalade (ou réutiliser queue emails)
│
├── src/app/api/chatbot/                       # [CRÉER] API publique widget
│   ├── message/route.ts                       # POST SSE (runtime=nodejs) — flux principal
│   ├── feedback/route.ts                      # POST pouce ↑/↓
│   ├── session/route.ts                       # création/reprise session (persistance serveur)
│   └── health/route.ts                        # ou étendre /api/healthz
│
├── src/app/[locale]/(admin)/[adminPrefix]/chatbot/   # [CRÉER] console (ADR-CB-07)
│   ├── page.tsx                               # dashboard métriques
│   ├── tenants/…                              # tenants (clé/domaine/réglages/budget)
│   ├── knowledge/…                            # chunks + ré-ingestion + périmés
│   ├── conversations/…                        # historique + sources + feedback
│   ├── escalades/…                            # trous KB → "créer document"
│   ├── prompt/…                               # versioning + rollback
│   ├── cache/…                                # seuil/TTL/vider/hits
│   ├── eval/…                                 # lancer éval + scores
│   ├── couts/…                                # cost-cap par tenant
│   └── reglages/…                             # seuils, curseur conversion, escalade, RGPD
│
├── src/features/admin-chatbot/                # [CRÉER] Server Actions (RBAC guards)
│   └── actions.ts                             # upsertTenant, ingestKnowledge, listConversations, rollbackPrompt…
│
├── src/components/chatbot/                     # [CRÉER] widget public
│   ├── ChatbotWidget.tsx                      # île montée à l'idle (dynamic ssr:false)
│   ├── ChatBubble.tsx · ChatPanel.tsx · MessageList.tsx · Composer.tsx
│   ├── Suggestions.tsx · SourceCitations.tsx · TypingIndicator.tsx
│   └── useChatStream.ts                       # hook SSE + reconnexion (Last-Event-ID)
├── src/components/admin/chatbot/               # [CRÉER] composants console
│
├── src/lib/
│   └── knowledge/embeddings.ts                # [MODIFIER] câbler Voyage réel (lever le stub) — partagé KB+chatbot
│
└── src/server/content-gen/providers/
    ├── gemini.ts                              # [DIFFÉRÉ — non MVP] provider Gemini (décision « sans Gemini » 2026-05-29)
    └── (rôle rerank Voyage)                   # [MODIFIER] activer rerank
```

### 1.2 Fichiers EXISTANTS à modifier (chemin + raison)

| Fichier | Modification | Raison |
|---|---|---|
| `prisma/schema.prisma` | +8 modèles `chat_*` + relations Submission | ADR-CB-03 |
| `prisma/migrations_fts/` | +SQL vector/HNSW/tsvector chatbot | Prisma ne gère pas vector/tsvector |
| `src/server/queue/queues.ts` | +queues + helpers enqueue + crons (purge cache, périmés) | Patron BullMQ |
| `src/server/queue/worker.ts` | +spread workers chatbot (env-gated) | Activation réversible |
| `src/lib/knowledge/embeddings.ts` | Remplacer stub par appel Voyage réel | ADR-CB-04 (partagé) |
| `src/lib/admin-nav.ts` | +entrée(s) menu chatbot | SSOT navigation |
| `src/server/content-gen/providers/provider-router.ts` | +candidat rerank (Voyage) ; Gemini différé (non-MVP) | ADR-CB-02 |
| `prisma/seeds/` | +seed tenant `axion-ia` + ProviderConfig (voyage, cap chatbot) | MVP single-tenant + cost-cap |
| `src/app/api/gdpr-export/route.ts` + `gdpr-erase` | +`chat_conversations`/`chat_messages` | RGPD (REQ-060) |
| `src/server/queue/workers/retention-purge-worker.ts` | +rétention conversations chatbot | RGPD purge |
| `.github/workflows/deploy-coolify.yml` (lhci) | éventuel : URL avec widget pour gate Web Vitals | REQ-087 |
| `package.json` (size-limit) | +bucket dédié au chunk widget | Budget JS widget |
| `messages/fr.json` | +clés i18n widget (FR-only) | i18n |

> ⚠️ **Ne PAS toucher** au contrat `stub.invalid` (prisma.ts/redis.ts/Dockerfile/workflow). Les routes `/api/chatbot/*` sont dynamiques (non SSG) → pas d'impact stub. Si une page widget devient SSG, ajouter un early-exit stub.

---

## 2. Spécification des 5 tools

Format : schéma JSON (validé Zod côté serveur), `tenant_id` **injecté serveur**.

```jsonc
// qualifier_prospect
{ "type_structure":"tpe|pme|eti|ecole|association|autre",
  "secteur":"string", "besoin":"string",
  "maturite_ia":"debutant|intermediaire|avance",
  "urgence":"faible|moyenne|forte" }

// capturer_lead  (idempotent : cle = sha256(conversationId+"capturer_lead"+payload))
{ "nom":"string", "email":"string(email)", "telephone":"string?",
  "structure":"string?", "besoin_resume":"string",
  "consentement_rgpd":"boolean(true requis)" }
// → Submission { type:"contact"|"quote_request", source:"chatbot", tenant_id, ipHash }
//   pré-check chat_action_idempotency.cle ; si présent → renvoyer resultat mémorisé

// proposer_rdv
{ "type_rdv":"decouverte|audit|formation" }
// → URL Calendly / /appel (PAS de création serveur)

// chercher_ressource
{ "sujet":"string", "type":"article|cas_client" }
// → { titre, url, extrait } depuis Article/CaseStudy

// escalader_question
{ "question":"string", "contexte_conversation":"string", "contact_email":"string(email)?" }
// → ChatEscalation + enqueue email équipe (queue emails) + notify() Telegram
```

**Idempotence `capturer_lead`** : avant création, lookup `chat_action_idempotency` ; à la création, insert atomique de la clé + résultat. Un retry renvoie le résultat mémorisé (pas de doublon Submission). (REQ-031/035)

---

## 3. Pipeline RAG mappé BullMQ

| Étape | Sync/Async | Mécanisme |
|---|---|---|
| Ingestion knowledge | **Async** | `chatbot-ingest-worker` : chunking → embeddings Voyage → upsert `chat_kb_chunks` + tsvector → bump version → invalidation cache |
| Résumé contexte long | **Async** | `chatbot-summary-worker` déclenché au-delà de N messages |
| Escalade email | **Async** | queue `emails` (réutilisée) ou `chatbot-escalation-worker` |
| Retrieval + rerank + génération | **Sync** (requête) | orchestrateur dans le route handler SSE |
| Cache sémantique lookup/write | **Sync** | pgvector cosine |
| Purge périmés / cache TTL | **Cron** | `bootRepeatableJobs` (≈ retention-purge) |

---

## 4. Multi-tenant, sécurité, RGPD, anti-abus (plan)
- **Multi-tenant** : `tenant.ts` résout la clé → `tenant_id`, filtre **toutes** les requêtes. MVP : tenant `axion-ia` seedé.
- **Anti-abus** : Turnstile sur ouverture de session + rate-limit sliding-window par IP/session (`lib/rate-limit.ts`), bannissement temporaire Redis.
- **CORS** : limité au `domaine` du tenant (en-tête `Origin` vérifié) (REQ-061).
- **RGPD** : consentement explicite avant `capturer_lead` ; IP hashées (`ip-hash.ts`) ; conservation configurable (`reglages`) + purge (retention worker) ; export/effacement étendus ; **DPA** Anthropic/OpenAI/Voyage (action Will, doc 07).
- **Sécurité IA & AI Act** : doc 08.

---

## 5. Observabilité & SLO
- **Sentry** : `captureWorkerError` pour workers ; `request-id` propagé dans les logs de l'orchestrateur (REQ-070).
- **Plausible funnel** (`trackFunnel`) : `Chat Started / Qualified / RDV / Lead / Escalated` (REQ-071).
- **Métriques DB** : latence 1er token & totale (`chat_messages.latence_ms`), coût (`cout_estime` + `CostLedger`), hit cache (`served_from_cache`), taux escalade, feedback.
- **Budgets latence mesurables** : 1er token < 1,5 s, réponse < 6 s. Vérifiés par k6 (charge) + assertions Vitest sur le chemin cache/retrieval. Sous charge : token-bucket évite les 429.

---

## 6. Stratégie de tests (mappée sur les gates CI existants)
- **Vitest (unit/intégration)** : retrieval hybride (ranking), idempotence `capturer_lead`, régulation token-bucket, seuil de confiance → escalade, invalidation cache par version, anti-injection (`prompt-guard`), schémas Zod tools. Mock PrismaClient (non affecté par le stub build).
- **Playwright (E2E)** : ouverture widget, streaming token-par-token, reconnexion, escalade de bout en bout, capture lead avec consentement, CLS 0 (pas de reflow).
- **k6 (charge)** : montée à 200 conversations, latence 1er token, taux 429, profondeur file (REQ-059).
- **Éval** : dataset ~50 Q/R → script Vitest scorant exactitude/citation/0-invention/escalade, lancé à chaque modif knowledge/prompt (couplé versioning).
- **Gates CI** : `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm bundle:check` (bucket widget), `pnpm lhci` (Web Vitals widget). Tout dans le pipeline existant.

---

## 7. Déploiement sûr & réversibilité
- **Feature flag** `CHATBOT_ENABLED` (env) + flag **par tenant** (`ChatTenant.actif`) + **par page** (`reglages.pages`). Pattern `knowledge/feature-flag.ts`.
- **Kill-switch** `chatbot/kill-switch.ts` (env `CHATBOT_KILL_SWITCH` + DB) : coupe l'orchestrateur → le widget affiche le mode dégradé (laisser un contact).
- **Rollout canary** : activer le widget sur une page (ex. `/audit`) avant généralisation via `reglages.pages`.
- **Rollback** : knowledge (`KnowledgeVersion` + bump version chunks) et prompt (`chat_prompt_versions.actif`) réversibles en 1 clic console. Workers env-gated → désactivables sans redeploy code.

---

## 8. Sauvegardes & reprise (DR)
- Backup quotidien Postgres (inclut `chat_*`) via Coolify → Backblaze B2 (existant). Tester une **restauration** sur un environnement de staging.
- Rétention RGPD configurable (env `RETENTION_CHAT_*_MONTHS`) + purge worker. Conversations anonymisées à l'effacement.

---

## 9. Amorçage du knowledge (RAG seed) — plan concret
1. **Inventaire des sources** : `KnowledgeEntry` (publiées, audience publique) + KbFacts (`audits.ts`, `un-a-un.ts`, `sites-web-augmentes.ts`, `interventions-formations.ts`, `implementations.ts`) + textes des pages services canoniques.
2. **Structuration par intentions / documents auto-suffisants** (pas le site entier, cahier §8).
3. **Chunking** 300–600 tokens + overlap 15 % + **phrase de contextualisation** (catégorie/module/cible).
4. **Embeddings** Voyage → `chat_kb_chunks` + `tsvector` fr_unaccent.
5. **Versioning** initial v1 ; ré-ingestion idempotente (clé de source).
6. **Garde-fou confidentialité** : exclure `confidentiality ∈ {confidential, secret}` (réutilise `embeddings.ts`).
7. Exécuté par `chatbot-ingest-worker` (commande admin « relancer l'ingestion »).

---

## 10. Jeu d'évaluation (~50 Q/R)
- Structuré par intention (prestations, tarifs, formation, projet, hors-sujet, question sans réponse→escalade).
- Chaque item : question + réponse attendue + sources attendues + comportement attendu (réponse vs escalade).
- Couplé au versioning : éval rejouée à chaque modif knowledge/prompt ; si exactitude baisse → rollback (console). Intégré en CI (job optionnel, non bloquant au début).

---

## 11. Roadmap MVP mappée CI/CD réel

> Branches `feat/chatbot-*` → PR → gates (test/lint/typecheck/bundle/lhci) → merge `main` → GH Actions build → GHCR → Coolify pull → `prisma migrate deploy`. Flag `CHATBOT_ENABLED=false` jusqu'à activation.

| MVP | Contenu | Effort indicatif | Gate clé |
|---|---|---|---|
| **MVP 1 — Socle RAG** | Schéma `chat_*` + migrations FTS ; embeddings Voyage réel ; ingestion+seed ; retrieval hybride ; génération streamée + citations ; widget bulle minimal (SSE) ; flag off | ~10–15 j | migrate deploy + SSE 200 + CLS 0 |
| **MVP 2 — Conversion & robustesse** | rerank + seuil confiance ; tools qualifier/proposer_rdv/escalader (+email/Telegram) ; mode dégradé + circuit breakers ; états d'erreur widget | ~8–12 j | escalade E2E |
| **MVP 3 — Industrialisation** | capturer_lead idempotent → Submission ; classification d'intention ; console admin complète ; versioning+rollback prompt ; éval ~50 Q/R ; Sentry+Plausible funnel | ~12–18 j | éval ≥ seuil + console |
| **MVP 4 — Charge & coût** | cache sémantique + invalidation ; token-bucket/backpressure ; Turnstile+rate-limit ; cost-cap tenant ; tests k6 ≥200 ; contexte long | ~8–12 j | k6 ≥200 + cost-cap |
| **Phase ultérieure** | multi-tenant réel (Ulixai) ; bundle widget CDN standalone ; multilingue ; WhatsApp/voix ; live handoff ; circuit breaker Redis ; container chatbot dédié si scale | — | — |

**Première action d'implémentation recommandée** (à ne PAS faire ici) : créer la branche `feat/chatbot-schema`, ajouter les 8 modèles `chat_*` au `schema.prisma`, générer la migration `migrations/<ts>_chatbot_core` + le SQL `migrations_fts/<ts>_chatbot_fts.sql` (vector/HNSW/tsvector), seeder le tenant `axion-ia` — c'est le socle dont tout le reste dépend (MVP 1).

*Fin du plan d'implémentation.*
