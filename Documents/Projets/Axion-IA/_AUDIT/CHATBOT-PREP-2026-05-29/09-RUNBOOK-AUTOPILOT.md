# 09 — Runbook autopilot (décisions verrouillées · pré-flight · env vars · conduite en cas de blocage)

> **But :** rendre l'implémentation exécutable en autonomie (autopilot) sans re-décider l'architecture ni re-poser les questions. À lire AVANT chaque session d'implémentation, avec `10-ETAT-ET-REPRISE.md`.
> **Règle d'or :** ce document + `10` + `11` sont la **source de vérité de l'autopilot**. En cas de doute, ne pas inventer → suivre §5 « conduite en cas de blocage ».
> Date : 2026-05-29.

---

## 1. Décisions VERROUILLÉES (défauts recommandés appliqués)

> Will peut écraser n'importe quelle ligne ; tant qu'elle n'est pas écrasée, **l'autopilot applique la valeur ci-dessous sans re-demander**.

| Réf | Décision verrouillée | Valeur appliquée | Écrasable par Will |
|---|---|---|---|
| D-STACK | Stack | **Module monorepo Node/TS** (`src/server/chatbot/**`), pas de repo séparé, pas de Laravel | oui |
| D-TENANT | Multi-tenant | **MVP single-tenant** `axion-ia` (colonnes `tenant_id` présentes, 1 seul tenant seedé) | oui |
| D-WIDGET | Widget | **Île React montée à l'idle** (`next/dynamic ssr:false`), hors First Load JS, CLS 0 | oui |
| D-LLM | Palier LLM | **Haiku/Sonnet SANS Gemini** (décision Will 2026-05-29) : classification/résumé → Haiku 4.5 ; génération → Haiku 4.5 ; Sonnet réservé cas complexes. Gemini écarté (1 sous-traitant Google de moins ; ajoutable plus tard via le router si le volume l'exige). Cap ~150 $/mois | oui |
| D-EMB | Embeddings | **Voyage `voyage-3-lite` (1024)** managé ; fallback OpenAI 1536 si clé Voyage absente | oui |
| D-RERANK | Reranking | **Voyage `rerank-2.5-lite`** ; repli sans rerank (retrieval hybride seul) si indispo | oui |
| D-RDV | RDV | **Calendly existant** (`/appel`), pas de cal.com | oui |
| D-CRM | Leads | **`Submission` interne** (type `contact`/`quote_request`, source `chatbot`) | oui |
| D-ANALYTICS | Funnel | **Plausible** (`trackFunnel`), pas de GA4/GTM | oui |
| D-CONCUR | Cible charge | **Cache agressif + scale vertical accepté** ; cible validée k6 au MVP 4 ; pas d'autoscaling horizontal | oui |
| D-SEUILS | Seuils départ | confiance RAG = **0,35** (cosine rerank normalisé) ; cache sémantique = **0,92** ; curseur conversion = **medium** ; ajustés à l'éval | oui |
| D-MVP1 | Périmètre MVP 1 | **Socle RAG pur** (retrieval + génération + citations + widget minimal), sans tools | oui |
| D-PROD | Activation prod | **JAMAIS en autopilot** : merge `main` / deploy / `CHATBOT_ENABLED=true` = feu vert Will explicite | NON (mur dur) |

**Convention de modèles (à reconfirmer prix au jour J, doc 06) :**
- classification/intention : `claude-haiku-4-5` (Gemini écarté au MVP)
- génération : `claude-haiku-4-5` (défaut), `claude-sonnet-4-6` (cas complexes)
- embeddings : `voyage-3-lite` (1024) · rerank : `rerank-2.5-lite`

---

## 2. Pré-flight checklist (à exécuter au début de CHAQUE session avant de coder)

> Si une case ❌ : NE PAS coder « à l'aveugle ». Traiter selon §5.

```
[ ] PF-1  git : sur la bonne branche feat/chatbot-* ; git pull --rebase ; pas de WIP étranger non commité
           → git status && git branch --show-current
[ ] PF-2  Lire 10-ETAT-ET-REPRISE.md → identifier la prochaine tâche "à faire" (statut)
[ ] PF-3  Docker dev up (Postgres+Redis) :  pnpm db:up   (⚠️ nécessite Docker Desktop lancé — action Will si éteint)
           → docker ps  doit montrer postgres + redis healthy
[ ] PF-4  Env local présent : .env.local avec DATABASE_URL, DIRECT_URL, REDIS_URL, AUTH_SECRET (Auth.js v5), IP_HASH_SALT
           (+ VOYAGE_API_KEY si dispo ; sinon embeddings = stub, OK pour build/tests unitaires)
[ ] PF-5  Dépendances : pnpm install (lockfile inchangé sauf si on ajoute une dep décidée)
[ ] PF-6  Baseline verte AVANT de commencer :  pnpm typecheck && pnpm test (noter le nombre de tests passants)
[ ] PF-7  Prisma en phase :  pnpm prisma migrate status  → "Database schema is up to date" (sinon migrate deploy)
[ ] PF-8  Confirmer décisions §1 inchangées (Will n'a rien écrasé depuis la dernière session)
```

**Toujours partir d'une baseline verte.** Si la baseline est déjà rouge avant toute modif → la réparer ou signaler AVANT d'ajouter du code (sinon on ne saura pas qui a cassé quoi).

---

## 3. Inventaire des variables d'environnement & secrets

> À préparer dans **Coolify** (runtime prod) et `.env.local` (dev). « Existant » = déjà en place pour le site.

### 3.1 Réutilisées (existantes — ne pas recréer)
| Var | Rôle | Source |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` | Postgres (pooled / direct migrations) | existant |
| `REDIS_URL` | Redis (BullMQ + rate-limit + token-bucket) | existant |
| `ANTHROPIC_API_KEY` | Claude Haiku/Sonnet (génération) | existant |
| `OPENAI_API_KEY` | Fallback embeddings 1536 + GPT | existant |
| `TURNSTILE_SECRET_KEY` + clé site publique | Anti-bot widget | ✅ présent en local |
| `SENTRY_DSN` | Observabilité | existant (prod ; optionnel en local) |
| `AUTH_SECRET` (⚠️ Auth.js v5, **pas** `NEXTAUTH_SECRET`) | Auth admin (console) | ✅ présent local + prod (Coolify) |
| `IP_HASH_SALT` | Hash IP RGPD (≥32 chars) | ✅ présent prod (Coolify) + **ajouté en local le 2026-05-29** |
| `ADMIN_URL_PREFIX` | Préfixe admin secret | ✅ présent en local |
| `BULLMQ_DISABLED` | Toggle build/dev sans Redis | existant |
| Plausible domain | Funnel analytics | existant |

### 3.2 NOUVELLES (à créer — chatbot)
| Var | Rôle | Défaut / valeur | Qui |
|---|---|---|---|
| `CHATBOT_ENABLED` | Feature flag global | `false` jusqu'à activation | Will (prod) |
| `CHATBOT_KILL_SWITCH` | Kill-switch d'urgence | `false` | Will |
| `VOYAGE_API_KEY` | Embeddings + rerank Voyage | **✅ PRÉSENTE dans `axionia/.env.local`** (prod : à mettre dans Coolify) — mais `embeddings.ts` reste en stub V1 tant que T-04 n'a pas câblé l'appel réel | OK local |
| `GEMINI_API_KEY` | **Non utilisé au MVP** (décision « sans Gemini » 2026-05-29) — classification sur Haiku | non requis | — |
| `OPENROUTER_API_KEY` | Agrégateur fallback (optionnel) | absente — optionnel | Will (optionnel) |
| `CHATBOT_DEFAULT_TENANT` | Clé tenant par défaut | `axion-ia` | autopilot |
| `RETENTION_CHAT_CONVERSATIONS_MONTHS` | Purge RGPD conversations | `12` | autopilot |
| `RETENTION_CHAT_ESCALATIONS_MONTHS` | Purge escalades traitées | `24` | autopilot |
| `CHATBOT_COST_CAP_USD_MONTH` | Cap mensuel tenant chatbot | `150` | Will (ajustable) |

> ⚠️ Si `VOYAGE_API_KEY` absente : `embeddings.ts` reste en **stub déterministe** → le code build et les tests unitaires passent, mais **la pertinence du retrieval n'est pas réelle**. L'éval (doc 11) ne sera significative qu'avec la vraie clé. C'est un **mur §5-B**.

---

## 4. Séquence d'exécution macro (renvoie au détail dans `10-ETAT-ET-REPRISE.md`)

```
MVP 1 (socle RAG)          → branche feat/chatbot-schema puis feat/chatbot-rag-core
MVP 2 (conversion/robust.) → feat/chatbot-tools
MVP 3 (industrialisation)  → feat/chatbot-admin-console  + feat/chatbot-eval
MVP 4 (charge/coût)        → feat/chatbot-scale
```
Chaque MVP : suivre les tâches T-xx de `10`, **chaque tâche close par le Protocole de vérification (doc 10 §C)**, commit atomique, PR en fin de MVP. **Jamais de merge `main`/deploy en autopilot (D-PROD).**

---

## 5. Conduite en cas de blocage (NE PAS INVENTER)

| Code | Situation | Action autopilot |
|---|---|---|
| **§5-A** | Décision §1 ambiguë / non couverte | S'arrêter, écrire la question dans `10` (section « Questions ouvertes »), continuer une autre tâche non bloquée si possible |
| **§5-B** | Secret manquant (`VOYAGE_API_KEY`…) | Continuer en stub/fallback, **marquer la tâche `bloquée-secret`** dans `10`, ne pas la cocher « done » |
| **§5-C** | Docker/DB indispo (PF-3 ❌) | S'arrêter sur tout ce qui exige la DB ; basculer sur tâches « code + tests unitaires mock » ; signaler à Will (action manuelle GUI) |
| **§5-D** | Baseline rouge avant modif (PF-6 ❌) | Diagnostiquer la cause ; si étrangère au chatbot → signaler, ne pas masquer |
| **§5-E** | Un test/gate échoue après modif | **Réparer la cause racine**, jamais désactiver/skipper le test pour « passer ». 3 échecs successifs → s'arrêter + consigner dans `10` |
| **§5-F** | Web Vitals/bundle dégradés (R-WV) | STOP & ASK Will + ADR (règle AGENTS.md) ; ne pas merger |
| **§5-G** | Drift Prisma détecté | S'arrêter, ne pas `migrate reset` en autopilot (perte de données) ; consigner + demander |
| **§5-H** | Besoin de fait factuel (prix/presta exact) | Ne jamais inventer → marquer `à-valider-Will` dans `11`/`10` |

**Principe :** un blocage se **consigne et se contourne**, il ne se devine pas. Mieux vaut une tâche `bloquée` honnête qu'une tâche `done` fausse.

---

## 6. Garde-fous d'autopilot (anti-dérive)
- **Cloisonnement strict** : ne toucher qu'aux fichiers listés doc 05 §1.2. Ne PAS modifier `prisma.ts`/`redis.ts`/`Dockerfile`/workflow (`stub.invalid`).
- **Migrations additives uniquement** (jamais destructif sur tables existantes).
- **Commits atomiques** par tâche, message conventionnel (`feat(chatbot): …`), co-author Claude.
- **Aucune dépendance** ajoutée hors de celles décidées (Voyage SDK/HTTP). **Pas de SDK Gemini** (écarté au MVP). Toute nouvelle dep → noter dans `10` + impact `size-limit`.
- **FR-only** partout (knowledge, prompts, UI widget) — règle absolue dépôt.
- **Pas de secrets en clair** dans le code/commits.
- **Pas de push `main`, pas de deploy, pas d'activation prod.**

*Fin du runbook autopilot.*
