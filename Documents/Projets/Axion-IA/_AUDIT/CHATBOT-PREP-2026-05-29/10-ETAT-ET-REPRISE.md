# 10 — État & reprise d'implémentation (journal de bord reprenable)

> **CE FICHIER EST LA MÉMOIRE DE L'AUTOPILOT.** Il survit à une fermeture de Claude Code.
> **POINT D'ENTRÉE :** sur la phrase déclencheuse de Will, exécuter d'abord `12-DEMARRAGE-AUTOPILOT.md` (Phase 0 contexte/évolution → Phase 1 réconciliation réalité⇄journal → Phase 2 pré-flight → Phase 3 reprise). NE PAS se fier aux statuts ci-dessous sans les avoir re-vérifiés contre le code réel (Phase 1).
> **À chaque session :** (1) `12` (réconciliation) → (2) `09` (pré-flight) → (3) reprendre la 1ʳᵉ tâche réellement incomplète → (4) à la fin de chaque tâche, **mettre à jour le statut + cocher le protocole §C + commit**.
> **Statuts :** ⬜ à faire · 🟦 en cours · ✅ done (vérifiée) · 🟥 bloquée · ⏭️ skippée (justifier).
> Date de création : 2026-05-29. Dernière mise à jour : 2026-05-29 (création, 0 tâche démarrée).

---

## A. Tableau de bord global

| MVP | Branche | Tâches | Statut | PR |
|---|---|---|---|---|
| MVP 1 — Socle RAG | `feat/chatbot-schema` → `feat/chatbot-rag-core` | T-01 → T-09 | ⬜ 0/9 | — |
| MVP 2 — Conversion & robustesse | `feat/chatbot-tools` | T-10 → T-16 | ⬜ 0/7 | — |
| MVP 3 — Industrialisation | `feat/chatbot-admin-console` + `feat/chatbot-eval` | T-17 → T-25 | ⬜ 0/9 | — |
| MVP 4 — Charge & coût | `feat/chatbot-scale` | T-26 → T-32 | ⬜ 0/7 | — |

**Prochaine action :** T-01 (créer la branche + schéma `chat_*`).

---

## B. Règles de reprise (résilience fermeture)
1. Le **commit git** est la vérité du code ; CE fichier est la vérité de **l'avancement**. Garder les deux synchrones (commit + maj statut dans le même geste).
2. Une tâche n'est `✅ done` que si **tout son protocole §C est coché** ET commitée.
3. Si une session s'interrompt en 🟦 : la session suivante relit la tâche, re-vérifie §C depuis le début (idempotent), termine.
4. Toute décision/écart pris en cours est consigné en §E (sinon il est perdu).
5. Ce fichier est **versionné** (commité) → l'historique git = journal d'audit de l'implémentation.

---

## C. Protocole de vérification PAR TÂCHE (gate obligatoire, « zéro erreur, zéro oubli »)

> À cocher pour CHAQUE tâche T-xx avant de la passer `✅`. C'est le cœur de l'exigence « chaque avancement parfait, fonctionnel et opérationnel ».

```
[ ] V1  typecheck :  pnpm typecheck  → 0 erreur
[ ] V2  lint :       pnpm lint       → 0 erreur (warnings justifiés)
[ ] V3  tests ciblés : pnpm test <fichier(s) de la tâche>  → 100% verts
[ ] V4  tests globaux non régressés : pnpm test → ≥ baseline PF-6 (aucun test cassé)
[ ] V5  CROISEMENT audit : les chemins/refs touchés correspondent à doc 02/05 (pas d'invention)
[ ] V6  REVUE ADVERSARIALE : relire le diff en cherchant activement le bug/oubli (pas juste "ça compile")
[ ] V7  SMOKE runtime (si applicable) : route répond / composant rend / worker démarre (preuve concrète)
[ ] V8  DoD partielle : cocher l'item de doc 07 §3 que la tâche fait avancer
[ ] V9  CLOISONNEMENT : aucun fichier hors périmètre doc 05 §1.2 modifié ; stub.invalid intact
[ ] V10 COMMIT atomique : git commit feat(chatbot): … + maj statut dans CE fichier
```

**Tests systématiquement écrits AVEC le code** (pas après) : chaque service/route/worker livré avec son test Vitest. Pas de tâche `done` sans test associé.

---

## D. Détail des tâches

> Format : **T-xx — Titre** · *Objectif* · Fichiers · **Croisements & tests spécifiques** · Statut.
> `09 §1` = décisions verrouillées · refs doc 03/05 pour le détail technique.

### MVP 1 — Socle RAG (branche `feat/chatbot-schema` puis `feat/chatbot-rag-core`)

**T-01 — Schéma `chat_*` + migration core** · Statut : ⬜
- *Objectif :* ajouter les 8 modèles (doc 03 ADR-CB-03) au `schema.prisma`, migration additive `chatbot_core` (sans vector/tsvector).
- Fichiers : `prisma/schema.prisma`, `prisma/migrations/<ts>_chatbot_core/`.
- Croisements & tests : `pnpm prisma validate` ✔ ; `pnpm prisma migrate dev` applique sur DB fraîche sans drift ✔ ; `pnpm prisma migrate status` = up to date ✔ ; **cross-check** : `tenant_id` présent sur TOUTES les tables `chat_*` ; relations vers `Submission` correctes ; snake_case `@@map` conforme. Test : `prisma/__tests__` génération client OK.

**T-02 — Migration FTS chatbot (vector/HNSW/tsvector)** · Statut : ⬜
- *Objectif :* SQL raw `migrations_fts/<ts>_chatbot_fts.sql` : colonnes `vector(1024)` sur `chat_kb_chunks`/`chat_semantic_cache`, index HNSW cosine, `tsvector` fr_unaccent + GIN.
- Fichiers : `prisma/migrations_fts/<ts>_chatbot_fts.sql`.
- Croisements & tests : appliquer sur DB locale (`psql -f`) sans erreur ✔ ; `\d chat_kb_chunks` montre `embedding`, `tsv`, index hnsw + gin ✔ ; **cross-check** : dimension 1024 alignée `embeddings.ts:23` ; config `fr_unaccent` identique à `0002_fts_setup.sql`.

**T-03 — Seed tenant `axion-ia` + ProviderConfig chatbot** · Statut : ⬜
- *Objectif :* seed du tenant unique + cap coût (D-LLM).
- Fichiers : `prisma/seeds/…chatbot.ts`.
- Tests : seed idempotent (re-run sans doublon) ✔ ; tenant lisible via `tenant.ts`.

**T-04 — Câbler Voyage réel dans `embeddings.ts`** · Statut : ⬜ *(dépend `VOYAGE_API_KEY` — sinon 🟥 bloquée-secret, garder stub)*
- *Objectif :* remplacer le stub par l'appel Voyage `voyage-3-lite`, garder fallback OpenAI 1536.
- Fichiers : `src/lib/knowledge/embeddings.ts` (modif).
- Croisements & tests : test unitaire mock HTTP (dimension 1024, refus confidentialité conservé `embeddings.ts:60`) ✔ ; **cross-check** : ne casse pas l'usage KB existant (test KB embeddings).

**T-05 — Ingestion + chunking + seed knowledge** · Statut : ⬜
- *Objectif :* `chatbot-ingest-worker` : lire `KnowledgeEntry`+KbFacts+pages services → chunk 300–600 tok overlap 15% + contextualisation → embeddings → `chat_kb_chunks` + tsvector ; versioning v1.
- Fichiers : `src/server/chatbot/ingestion/*`, `workers/chatbot-ingest-worker.ts`, `queues.ts` (+queue), `worker.ts` (+spread env-gated).
- Croisements & tests : test chunker (tailles/overlap) ✔ ; exclusion `confidentiality ∈ {confidential,secret}` ✔ ; worker enqueue/consume mock ✔ ; **cross-check** : patron BullMQ conforme `queues.ts:33-38` ; FR-only.

**T-06 — Retrieval hybride (pgvector + FTS)** · Statut : ⬜
- *Objectif :* `hybrid-search.ts` : cosine pgvector + `searchKnowledge` FTS, fusion (RRF), filtre `tenant_id`, top-k 20.
- Fichiers : `src/server/chatbot/retrieval/hybrid-search.ts`.
- Croisements & tests : test ranking sur jeu fixture ✔ ; **test isolation tenant** (R-TENANT) : un chunk d'un autre tenant n'est JAMAIS retourné ✔ ; `$queryRaw` paramétré (pas d'injection SQL) ✔.

**T-07 — Génération streamée + citations (route SSE)** · Statut : ⬜
- *Objectif :* `POST /api/chatbot/message` SSE (gabarit `content-gen/jobs/[id]/stream`), prompt = system (brand-voice) + 5 chunks + historique, via `provider-router` stream + prompt caching, cite les sources.
- Fichiers : `src/app/api/chatbot/message/route.ts`, `src/server/chatbot/generation/*`, `orchestrator.ts`.
- Croisements & tests : `runtime="nodejs"` ✔ ; headers `text/event-stream` ✔ ; smoke `curl -N` reçoit des tokens ✔ ; **cross-check** : réponse uniquement depuis chunks (R-HALL) ; persiste `chat_messages` (latence, modèle, coût, sources).

**T-08 — Widget bulle minimal (île idle, CLS 0)** · Statut : ⬜
- *Objectif :* bulle bas-droite, montée `requestIdleCallback`, hook SSE, mention « vous dialoguez avec une IA ».
- Fichiers : `src/components/chatbot/*`, montage dans le layout public (dynamic ssr:false), `messages/fr.json` (+clés), `package.json` (+bucket size-limit widget).
- Croisements & tests : Playwright ouverture+stream ✔ ; **CLS=0** (pas de reflow) ✔ ; `pnpm bundle:check` widget hors First Load ✔ ; `pnpm lhci` non dégradé (R-WV) ✔ ; WCAG : clavier/focus/aria (doc 08 §3).

**T-09 — Intégration MVP 1 + PR** · Statut : ⬜
- *Objectif :* gate d'intégration MVP 1.
- Tests : suite complète `pnpm test` ✔ ; Playwright E2E « poser une question → réponse citée streamée » ✔ ; `typecheck`/`lint`/`bundle`/`lhci` verts ✔ ; **DoD** : items « répond juste / cite sources / widget streame / CLS 0 / hors First Load » cochés (doc 07). Ouvrir PR (NE PAS merger — D-PROD).

### MVP 2 — Conversion & robustesse (`feat/chatbot-tools`)
- **T-10** Reranking Voyage + repli sans rerank · tests : ordre top-5, fallback si 503 ✔
- **T-11** Seuil de confiance → escalade directe · tests : score < seuil ⇒ pas de génération, escalade ✔
- **T-12** Registre des tools + schémas Zod + injection `tenant_id` serveur · tests : validation Zod, refus payload invalide ✔
- **T-13** `qualifier_prospect` + `chercher_ressource` · tests : maj profil, ressource depuis Article/CaseStudy ✔
- **T-14** `escalader_question` (ChatEscalation + email worker + Telegram) · tests E2E escalade de bout en bout ✔
- **T-15** `proposer_rdv` → Calendly · tests : renvoie lien `/appel`, pas de création serveur ✔
- **T-16** Mode dégradé + circuit breakers + états d'erreur widget · tests : timeout/affluence/panne ⇒ jamais d'erreur brute, saisie non perdue ✔ ; **PR**.

### MVP 3 — Industrialisation (`feat/chatbot-admin-console` + `feat/chatbot-eval`)
- **T-17** `capturer_lead` idempotent → `Submission` · tests : retry ⇒ pas de doublon (`chat_action_idempotency`) ✔ ; consentement RGPD requis ✔
- **T-18** Classification d'intention (modèle léger) · tests : intents fixtures ✔
- **T-19** Console admin : section + nav + RBAC guards (tenants/knowledge/conversations/escalades) · tests : `requireAdmin*`, noindex hérité ✔
- **T-20** Console : prompt versionné + rollback · tests : activer/rollback `chat_prompt_versions` ✔
- **T-21** Console : coûts (cost-cap) + réglages (seuils/curseur/RGPD) · tests : cap atteint ⇒ mode éco ✔
- **T-22** Funnel Plausible + Sentry request-id + métriques DB · tests : events émis, latence persistée ✔
- **T-23** RGPD : étendre gdpr-export/erase + retention-purge à `chat_*` · tests : export/erase/purge conversations ✔
- **T-24** Jeu d'éval ~50 Q/R (doc 11) + harnais de scoring · tests : éval rejouable, score calculé ✔
- **T-25** Intégration MVP 3 + **DoD majeure** + PR (c'est l'étape d'activation canary côté Will) · ✔

### MVP 4 — Charge & coût (`feat/chatbot-scale`)
- **T-26** Cache sémantique (lookup cosine ≥ seuil + version) · tests : hit/miss, isolation tenant ✔
- **T-27** Invalidation cache par version de knowledge · tests : ré-ingestion ⇒ ancien cache ignoré ✔
- **T-28** Token-bucket + backpressure LLM (file « forte affluence ») · tests : pas de 429 brut, message d'attente ✔
- **T-29** Turnstile + rate-limit session/IP + bannissement · tests : abus ⇒ throttle ✔
- **T-30** Garde-fous coût (cap tenant + alertes 80/100% + mode éco) · tests : cascade cost-cap ✔
- **T-31** Contexte long (résumé worker) · tests : au-delà de N messages ⇒ résumé ✔
- **T-32** Tests de charge k6 (cible D-CONCUR) + rapport latence/429/file · **DoD complète** + PR ✔

---

## E. Journal des décisions & écarts pris en cours (append-only)
> *(vide au démarrage — chaque écart/choix non trivial pris pendant l'implémentation est ajouté ici avec date + raison)*
- 2026-05-29 — Création des docs 09/10/11. Décisions verrouillées = défauts recommandés (doc 09 §1). Aucune tâche démarrée.

---

## F. Questions ouvertes / blocages en attente de Will (append-only)
> *(vide au démarrage — l'autopilot écrit ici toute question §5-A ou blocage §5-B/C/G non contournable)*
- (aucune)

---

## G. Pré-requis Will avant lancement réel de l'autopilot
> État vérifié le 2026-05-29 (clés `axionia/.env.local`, valeurs masquées).
- [x] **Décisions verrouillées = défauts** (doc 09 §1) — Will a dit « fais ça ». Palier LLM = mix (modifiable).
- [x] **`VOYAGE_API_KEY` PRÉSENTE** en local ✅ (mais `embeddings.ts` encore stub → T-04 doit câbler l'appel réel ; non bloqué par un secret).
- [x] Clés présentes en local : `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `TURNSTILE_SECRET_KEY`, `ADMIN_URL_PREFIX`.
- [x] **`AUTH_SECRET`** (Auth.js v5, ≠ `NEXTAUTH_SECRET`) présent local + prod ✅ ; **`IP_HASH_SALT`** présent prod + **ajouté en local le 2026-05-29** ✅ → pré-requis MVP 3 RGPD/console **levé**.
- [ ] Optionnel : `GEMINI_API_KEY` (sinon classification sur Haiku) / `OPENROUTER_API_KEY`.
- [ ] **Lancer Docker Desktop + `pnpm db:up`** (action GUI Windows, non automatisable) — pré-requis MVP 1.
- [ ] Valider le jeu d'éval (doc 11) — surtout les **prix/prestations** `⚠️FACT` (vérité-terrain).
- [ ] Plus tard (avant activation prod, MVP 3) : DPA fournisseurs IA (Q-DPA) + feu vert `CHATBOT_ENABLED=true`.

*Fin du fichier d'état & reprise.*
