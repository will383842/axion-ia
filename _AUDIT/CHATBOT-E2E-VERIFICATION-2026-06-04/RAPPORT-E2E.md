# RAPPORT E2E — vérification end-to-end chatbot Axion-IA

Date : 2026-06-04 · Worktree `axionia-chatbot-fix` · branche `feat/chatbot-core` · baseline `eb161f18` → HEAD `607814ef`.
Méthode : **exécution réelle** (driver Node direct important le handler de route SSE + DB/Redis docker réels). Zéro mock dans le chemin runtime. Budget LLM consommé : **0,00 USD** (aucune clé LLM présente → tout joué en chemin déterministe ou mode dégradé ; aucun appel facturable émis).

---

## §1.0 GATE SECRETS & INFRA

**Secrets** (présence seule, jamais en clair) : `DATABASE_URL`, `REDIS_URL`, `VOYAGE_API_KEY`, `ANTHROPIC_API_KEY`, `TURNSTILE_*`, `TELEGRAM_*`, `NEXT_PUBLIC_CHATBOT_ENABLED` — **tous absents de l'environnement** au départ (seuls `.env.*.example` existaient). Conforme à l'hypothèse §1.0 (« secrets absents = cas nominal »).

**Action** : création d'un `.env` LOCAL (gitignored) avec DB/Redis docker dev + clés de test Turnstile + `CHATBOT_ENABLED=true` + `IP_HASH_SALT`. Clés LLM laissées vides → `⛔ BLOQUÉ-SECRET`.

**Gate serveur réel de la route SSE** (le prompt demandait de le trouver) :
```
src/app/api/chatbot/message/route.ts:156
  if (process.env.CHATBOT_ENABLED !== "true") return jsonError("chatbot_disabled", 503);
```
→ lu **directement depuis `process.env`**, PAS dans le schéma Zod `env.ts`. Confirmé.

**Infra réelle levée** (Docker Desktop démarré) :
```
--- PREUVE INFRA ---
$ docker exec axion-ia-postgres psql -U axion_ia -d axion_ia_dev -t -c "SELECT extname FROM pg_extension;"
 plpgsql / citext / pg_trgm / unaccent / uuid-ossp / vector
$ docker exec axion-ia-redis redis-cli ping
PONG
HEAD: ba4c7818
```

**vitest integration ne chargeait PAS `.env`** → corrigé : `vitest.integration.setup.ts` (loader zéro-dépendance) + `setupFiles`. Sans ça, secrets présents paraîtraient absents (faux négatif §1.0 point 4).

---

## §1 PRÉ-FLIGHT

```
--- PREUVE BASELINE ---
$ git branch --show-current → feat/chatbot-core   (git status propre hors _AUDIT/)
$ pnpm prisma:generate → ✔ Generated Prisma Client (v5.22.0)
$ pnpm exec prisma migrate deploy → Applied 20260604190000_chatbot_prospect_profile ; All migrations applied
$ psql … chatbot_fts.sql → embedding/tsv/index « already exists » (idempotent OK)
$ pnpm typecheck → exit 0
$ pnpm lint → exit 1 (2 erreurs PRÉ-EXISTANTES HORS périmètre : scripts/curate-sites-web-unsplash.mjs, SitesWebCtaBlock.tsx ; 0 erreur dans le périmètre chatbot)
HEAD: eb161f18
```

**pgvector & FTS prouvés** :
```
--- PREUVE T-02 ---
$ psql … "SELECT column_name,udt_name FROM information_schema.columns WHERE table_name='chat_kb_chunks' AND column_name IN ('embedding','tsv')"
 embedding | vector
 tsv       | tsvector
$ psql … "SELECT indexname FROM pg_indexes WHERE tablename='chat_kb_chunks'"
 chat_kb_chunks_embedding_hnsw_idx ; chat_kb_chunks_tsv_gin_idx (+ pkey, uniques)
HEAD: ba4c7818
```

**KB réellement peuplée** :
```
--- PREUVE T-05 ---
$ psql … "SELECT count(*) total, count(embedding) with_embedding FROM chat_kb_chunks"
 total=595 | with_embedding=595 | actifs=595
HEAD: ba4c7818
```

**Harnais LIVE créé** (driver Node direct, méthode privilégiée §1) : `tests/integration/chatbot/drive-conversation.ts` importe le `POST` de la route, forge un `NextRequest`, consomme le `ReadableStream` SSE.
```
--- PREUVE HARNAIS (smoke) ---
$ pnpm exec vitest run --config vitest.integration.config.ts tests/integration/chatbot/smoke.test.ts
✓ RDV → stream SSE /fr/appel + persistance DB (convo + 2 messages)
✓ kill-switch CHATBOT_ENABLED!=true → 503 chatbot_disabled
Test Files 1 passed | Tests 2 passed
HEAD: ba4c7818
```

---

## PHASE 1 — Socle data & RAG

**T-06 retrieval hybride réel** (FTS sans clé Voyage) :
```
--- PREUVE T-06 ---
$ pnpm exec vitest run --config vitest.integration.config.ts tests/integration/chatbot/retrieval.test.ts
✓ FTS trouve des chunks pertinents (« formation ») sans clé Voyage
✓ isolation tenant : tenant bidon → 0 chunk
✓ charabia sans clé Voyage → 0 (PAS de pollution stub-vecteur)
Test Files 1 passed | Tests 3 passed
HEAD: b0270cf1
```
Défaut **D-1** trouvé puis fixé (cf. FIXES-APPLIQUES). Avant fix : charabia → **8** voisins du vecteur-stub. Après : **0**.

**T-07 SSE + persistance** : prouvé par smoke + toutes les conversations (events `session→message→[cards|rdv|escalate]→done`, persistance `chat_messages`). Génération RAG **narrative** = Anthropic → `⛔ BLOQUÉ-SECRET` (câblage `generate-stream.ts` → `provider-router` anthropic, `stream:true`, prouvé ; `anthropic.ts:126` throw si clé absente → mode dégradé déclenché, cf. T-16).

---

## PHASE 2 — Conversion & robustesse

```
--- PREUVE T-16 / T-11 (mode dégradé + confiance, 0 LLM, 0 €) ---
S19 « explique-moi en détail votre méthodologie » →
  SSE: status=200, events=[session → message → rdv → escalate → done]
  texte = repli propre (« Je n'ai pas cette information sous la main… court échange ? »)
  AUCUN event type:"error", AUCUN delta LLM
HEAD: 607814ef  (transcript : CONVERSATIONS-REELLES.md)
```

```
--- PREUVE T-17 (lead idempotent, source=chatbot, concurrence) ---
$ pnpm exec vitest run --config vitest.integration.config.ts tests/integration/chatbot/robustness.test.ts
✓ S8 consent requis + Submission source=chatbot
✓ S9 idempotence séquentielle → 1 Submission
✓ S9.bis idempotence sous CONCURRENCE réelle (Promise.all) → 1 Submission, [false,true]
✓ Isolation session ; ✓ anti-abus 429 (Redis réel) ; ✓ UTF-8 intègre SSE+DB
Test Files 1 passed | Tests 6 passed
HEAD: 7e504815
```

---

## PHASE 3 — Console admin & RGPD

Console : données réelles (counts DB via `getChatbotDashboardStats`), RBAC (`auth()` + `requireAdminRead/Write`), noindex (layout `robots:{index:false}`).
```
--- PREUVE T-20 / T-25 / T-23 ---
$ pnpm exec vitest run --config vitest.integration.config.ts tests/integration/chatbot/admin-rgpd.test.ts
✓ T-20 prompt versionné create→activate→rollback ; getActivePromptContent reflète ; 1 seul actif
✓ T-25 update confidenceThreshold=0.99 → getDefaultTenant().settings.confidenceThreshold=0.99 (restauré)
✓ T-23 RGPD export retrouve convo+2 messages ; erase supprime (cascade messages) sur données de TEST
Test Files 1 passed | Tests 3 passed
HEAD: 7e504815
```
**T-18 classification** : classifieur **déterministe par mots-clés** (`classifyIntent` interne à `slot-filling.ts`), pas un modèle dédié — explicitement noté. Couvre rdv/lead/comparaison/explication/recherche_offre/hors_sujet (validé par conversations).

---

## PHASE 4 — Charge & coût

```
--- PREUVE T-30 (cost-guard, DB+Redis réels) ---
$ pnpm exec vitest run --config vitest.integration.config.ts tests/integration/chatbot/cost-guard.test.ts
✓ getMonthlySpend somme réellement cout_estime (≥ 5 USD injectés)
✓ cap 1 USD → ecoMode=true ; cap 1e6 → ecoMode=false
Test Files 1 passed | Tests 2 passed
HEAD: ad4b6ef3
```
- **T-28 token-bucket** : unit (3) + backpressure orchestrateur (acquireLlmSlot=false → RDV).
- **T-29 anti-abus** : prouvé réel (rate-limit 429 Redis, cf. robustness).
- **T-26/T-27 cache** : SQL cosine + isolation + invalidation (unit 7) ; **hit sémantique réel = Voyage ⛔**. Défaut **D-3** fixé (cache no-op si embedding stub).
- **T-31 résumé long** : déclenchement câblé ; résumé = LLM ⛔.
- **T-32 k6** : script présent, **non exécuté** (k6 absent) → ⛔ BLOQUÉ-INFRA.

---

## PHASE 5 — Sécurité & cœur vendeur

```
--- PREUVE T-39 / prompt-guard (corpus 8 attaques, route réelle) ---
$ pnpm exec vitest run --config vitest.integration.config.ts tests/integration/chatbot/security.test.ts
✓ 8/8 injections déviées : status 200, déflexion polie, 0 delta LLM, 0 fuite (system prompt/API key/process.env)
✓ output-guard : prix hors SSOT (12345 €) + URL inconnue rejetés
✓ output-guard : 690 € (SSOT) + /fr/appel acceptés
✓ XSS : <script> traité sans erreur (widget = nœud texte React)
Test Files 1 passed | Tests 11 passed
HEAD: 593c9fb0
```
**T-33/34/35 catalogue & offres** : conversations prouvent offres réelles par vertical, prix SSOT, urlFR ∈ routes connues (output-guard vert sur CHAQUE réponse). **T-38 confirm-avant-lien** : « Souhaitez-vous les liens ? » avant tout envoi.

---

## PHASE 6 — Conversations réelles + 6.bis robustesse

12 scénarios capturés (transcripts complets : `CONVERSATIONS-REELLES.md`). Déterministes (0 €) joués pleinement ; RAG-narratifs joués en **mode dégradé déterministe** (preuve d'absence de crash) — génération narrative réelle = ⛔ secret.
```
--- PREUVE conversations (suite) ---
$ pnpm exec vitest run --config vitest.integration.config.ts tests/integration/chatbot/conversations.test.ts
✓ 9/9 (S2 sites-web, S3 audit ETI, S5 prix SSOT, S6 hors-scope, S7 injection, S11 RDV, S12 multi-tours, S14 cross-sell, S19 dégradé)
HEAD: 607814ef
```
6.bis : UTF-8 ✅, isolation session ✅, idempotence concurrente ✅, PII hash IP ✅, XSS ✅. Injection via contenu KB : défense en profondeur (KB délimité « CONTEXTE seule source autorisée » + output-guard) ; bypass génératif réel = ⛔ secret.

---

## PHASE 7 — Croisements plateforme

```
--- PREUVE PLATEFORME ---
proxy matcher (src/proxy.ts:165) = /((?!api/|…  → /api/chatbot/* EXCLU du middleware i18n (pas de 301/307)
CSP (src/lib/csp.ts:136) connect-src 'self' … → SSE same-origin autorisé ; route émet X-Accel-Buffering:no
widget : next/dynamic ssr:false + requestIdleCallback + chunk "chatbot-widget" ; size-limit ≤ 30 KB gz (package.json:260)
kill-switch : 503 prouvé (smoke) ; widget null si NEXT_PUBLIC_CHATBOT_ENABLED!=true
HEAD: 607814ef
```
- **`pnpm build` complet** : NON exécuté (~25 min, 17 629 routes — hors budget temps). Build-safety établie statiquement : route `force-dynamic`/`runtime nodejs` (non-SSG), widget `ssr:false`, prisma/redis stub-aware, typecheck vert.
- **`pnpm lhci`** : NON exécuté (serveur live requis). Config Lighthouse + size-limit présentes.

---

## Suites de tests — état final

```
--- PREUVE SUITE UNITAIRE CHATBOT ---
$ pnpm exec vitest run src/server/chatbot src/components/chatbot src/app/api/chatbot
Test Files 32 passed | Tests 222 passed
HEAD: 607814ef

--- PREUVE SUITE INTEGRATION CHATBOT ---
$ pnpm exec vitest run --config vitest.integration.config.ts (tests/integration/chatbot/**)
8 fichiers chatbot passed | 49 tests passed
(1 échec PRÉ-EXISTANT HORS chatbot : tests/integration/server-actions.test.ts « getInterventionPriceCents » — assertion prix stale 245000≠49000, hors périmètre §0.5, non corrigé — cf. RESTE-A-FAIRE)
HEAD: 607814ef
```
