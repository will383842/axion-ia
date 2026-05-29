# 01 — Matrice d'exigences (Phase 1)

> Extraction numérotée des exigences des deux cahiers (v3.0 + addendum v3.1).
> Tag `[INDÉP]` = indépendant de la stack (reste valable) · `[STACK]` = dépendant de la stack (à réconcilier avec Next.js — voir doc 03/04).
> Colonne « État dépôt » : ce que l'audit (doc 02) a déjà trouvé.
> Date : 2026-05-29.

---

## A. Fonctionnel & cadrage

| ID | Exigence | Tag | Source | État dépôt |
|---|---|---|---|---|
| REQ-001 | Chatbot **textuel** (pas de voix) sur axion-ia.com | INDÉP | v3.0 §1.3, §2 | À créer |
| REQ-002 | Double mission : **vitrine de compétence** + **conversion non-intrusive** en prospect | INDÉP | v3.0 §1.1 | À créer |
| REQ-003 | **Multi-tenant** réutilisable (Ulixai, etc.), données isolées par `tenant_id` | INDÉP | v3.0 §6 | À créer (MVP single-tenant) |
| REQ-004 | Personas : dirigeant TPE/PME, ETI, école/asso, concurrent | INDÉP | v3.0 §3 | KB existante couvre TPE/PME/ETI |
| REQ-005 | Cas d'usage : prestations, prix sans inventer, formation, projet, escalade, recadrage hors-sujet | INDÉP | v3.0 §3 | KB facts existants |
| REQ-006 | **FR uniquement** (multilingue = phase ultérieure) — et règle dépôt EN désactivé | INDÉP | v3.0 §2 + AGENTS.md | EN désactivé (proxy 301) |
| REQ-007 | Objectifs : exactitude ≥ 95 %, 0 hallucination, conversion ≥ 15 %, uptime 99,5 % | INDÉP | v3.0 §1.2 | À mesurer |

## B. Architecture RAG & pipeline

| ID | Exigence | Tag | Source | État dépôt |
|---|---|---|---|---|
| REQ-010 | Architecture **RAG + tool use** : retrieval → rerank → génération à partir des seuls passages | INDÉP | v3.0 §4 | Partiel (FTS oui, rerank non) |
| REQ-011 | **Retrieval hybride** pgvector + plein-texte, filtré métadonnées + `tenant_id`, top-k 20 | STACK | v3.0 §10.3 | pgvector + FTS FR présents, fusion à câbler |
| REQ-012 | **Reranking** (Cohere/Voyage) → top 5 ; repli sans rerank possible | STACK | v3.0 §10.4, §17 | Rôle `rerank` enum présent, off |
| REQ-013 | **Classification d'intention** (modèle léger type Haiku) → filtre retrieval | STACK | v3.0 §10.2 | provider-router réutilisable |
| REQ-014 | **Génération streamée** (SSE), prompt = system + 5 chunks + historique + outils | STACK | v3.0 §10.7 | Pattern SSE existant |
| REQ-015 | **Vérification de confiance** : score < seuil → escalade directe (pas de réponse inventée) | INDÉP | v3.0 §10.5, §16 | À créer |
| REQ-016 | **Chunking sémantique** 300–600 tokens, chevauchement ~15 %, contextualisation | INDÉP | v3.0 §9 | À créer (KB facts à chunker) |
| REQ-017 | **Embeddings** voyage-3 / text-embedding-3 ; ingestion **asynchrone** (queue) | STACK | v3.0 §9 | embeddings.ts (Voyage stub) + BullMQ |
| REQ-018 | **Versioning knowledge** par document + rollback ; périmés (>6 mois) signalés | INDÉP | v3.0 §8, §19 | `KnowledgeVersion` existe |
| REQ-019 | **Gestion contexte long** : N derniers messages + résumé régénéré (modèle léger) | INDÉP | v3.0 §12 | À créer |
| REQ-020 | Amorçage KB depuis sources prioritaires (prestations/tarifs/FAQ critiques) | INDÉP | v3.0 §8 | KB facts + pages services existants |

## C. Cache sémantique

| ID | Exigence | Tag | Source | État dépôt |
|---|---|---|---|---|
| REQ-025 | **Cache sémantique** : question proche (similarité ≥ seuil) → réponse sans appel LLM | INDÉP | v3.0 §11 | À créer |
| REQ-026 | **Invalidation auto** du cache quand le knowledge sous-jacent change | INDÉP | v3.0 §11 | À créer |
| REQ-027 | Réglable par tenant (activation, seuil, TTL), comptage des hits | INDÉP | v3.0 §11, §24 | À créer |

## D. Tool use (5 outils)

| ID | Exigence | Tag | Source | État dépôt |
|---|---|---|---|---|
| REQ-030 | **`qualifier_prospect`** — capte type_structure, secteur, besoin, maturité_ia, urgence (sans interrogatoire) | INDÉP | v3.0 §14 | À créer |
| REQ-031 | **`capturer_lead`** — crée un lead **après consentement RGPD explicite**, **idempotent** | INDÉP | v3.0 §14 | Cible = `Submission` interne |
| REQ-032 | **`proposer_rdv`** — renvoie lien RDV (type découverte/audit/formation) | STACK | v3.0 §14 | Cible = **Calendly**, pas cal.com |
| REQ-033 | **`chercher_ressource`** — renvoie article/cas client pertinent | INDÉP | v3.0 §14 | `Article`/`CaseStudy` existants |
| REQ-034 | **`escalader_question`** — info manquante/score bas → escalade + **email équipe** + entrée trou de KB. Ne jamais inventer | INDÉP | v3.0 §14, §16 | Email worker + Telegram + Submission |
| REQ-035 | `tenant_id` injecté **côté serveur** (jamais depuis le widget) ; clé d'idempotence pour `capturer_lead` | INDÉP | v3.0 §14 | À créer |

## E. System prompt & garde-fous anti-hallucination

| ID | Exigence | Tag | Source | État dépôt |
|---|---|---|---|---|
| REQ-040 | **System prompt versionné par tenant**, mis en cache (stable) | STACK | v3.0 §15 | prompt caching Anthropic présent |
| REQ-041 | Règles : répondre **uniquement** depuis le contexte ; **citer les sources** ; ne jamais inventer prix/presta/délai | INDÉP | v3.0 §15, §16 | brand-voice + fact-check réutilisables |
| REQ-042 | Ton **professionnel, pédagogue, chaleureux, vouvoiement, jamais insistant** ; curseur conversion réglable | INDÉP | v3.0 §15 | `brand-voice.ts` (persona Manon) |
| REQ-043 | 4 couches anti-hallucination (prompt + seuil RAG + escalade structurée + observabilité) | INDÉP | v3.0 §16 | À assembler |

## F. Robustesse, charge, concurrence

| ID | Exigence | Tag | Source | État dépôt |
|---|---|---|---|---|
| REQ-050 | **Service stateless**, état en DB (conversations) + Redis (cache, locks) | STACK | v3.0 §7.1 | Pattern compatible |
| REQ-051 | **Scalabilité horizontale + autoscaling** + health checks `/health` `/ready` | STACK | v3.0 §7.2 | `/api/healthz` existe ; autoscaling ⚠️ CPX32 |
| REQ-052 | **Pooling DB** (PgBouncer) | STACK | v3.0 §7.3 | `DATABASE_URL` pooled + `DIRECT_URL` |
| REQ-053 | **Files & workers** supervisés (Horizon) pour ingestion/résumés/rejeu/emails | STACK | v3.0 §7.4 | **BullMQ** (remplace Horizon) |
| REQ-054 | **Gestion SSE sous charge** : plafond/instance, fermeture propre, **reconnexion auto** widget | STACK | v3.0 §7.5, §21 | Pattern SSE existant |
| REQ-055 | **Circuit breakers** sur services aval (LLM, reranker, CRM) | INDÉP | v3.0 §7.6 | `provider-router` circuit breaker présent |
| REQ-056 | **Régulation API LLM** : token-bucket + backpressure + file « forte affluence » (jamais 429 brut) | INDÉP | v3.0 §7.7 | limiter worker + retry réutilisables |
| REQ-057 | **Cible ≥ 200 conversations simultanées** sans dégradation, validée par tests de charge | STACK | v3.0 §7.9, §20 | ⚠️ à valider (CPX32) |
| REQ-058 | **Mode dégradé** : timeout/lenteur, rate-limit, panne reranker/embeddings/CRM/cal → jamais d'erreur brute | INDÉP | v3.0 §17 | fail-soft patterns existants |
| REQ-059 | **Tests de charge** (k6) : latence 1er token, taux d'erreur, taux 429, profondeur file | INDÉP | v3.0 §20 | À créer |

## G. Sécurité, RGPD, anti-abus, IA

| ID | Exigence | Tag | Source | État dépôt |
|---|---|---|---|---|
| REQ-060 | **RGPD** : consentement explicite avant capture, mention traitement, conservation configurable + purge, **DPA** fournisseurs IA + non-rétention, droit à l'effacement, **hébergement UE** | INDÉP | v3.0 §18 | gdpr-export/erase + retention-purge + Hetzner UE |
| REQ-061 | **Sécurité** : clés API serveur-only, HTTPS, **CORS limité au domaine du tenant**, anti-injection de prompt, system prompt durci | INDÉP | v3.0 §18 | À créer (CORS chatbot) |
| REQ-062 | **Anti-abus** : rate-limit par session/IP, **Turnstile**, bannissement temporaire | INDÉP | v3.0 §18 | `rate-limit.ts` + Turnstile présents |
| REQ-063 | **Anti-injection / jailbreak / exfiltration** (system prompt, données autres tenants, secrets) | INDÉP | (implicite §18 + brief) | À concevoir (doc 08) |
| REQ-064 | **Transparence EU AI Act** : informer qu'on dialogue avec une IA, traçabilité, garde-fous documentés | INDÉP | contexte dépôt + AI Act | `AiContentDisclaimer` + provenance réutilisables |
| REQ-065 | IP hashées (SHA-256 salée) | INDÉP | (dépôt) | `ip-hash.ts` (`IP_HASH_SALT`) |

## H. Observabilité, pilotage, coût, éval

| ID | Exigence | Tag | Source | État dépôt |
|---|---|---|---|---|
| REQ-070 | **Sentry** (erreurs, latences, alertes), uptime, **logs structurés request-id**, métriques de charge | STACK | v3.0 §19 | Sentry câblé |
| REQ-071 | **Analytics funnel** (conversation démarrée, qualif, RDV, lead, escalade) | STACK | v3.0 §23 | **Plausible** (PAS GA4) → divergence |
| REQ-072 | **Console admin** complète multi-tenant : tenants, knowledge, conversations, leads, escalades, prompt, cache, éval, métriques, coûts, réglages | STACK | v3.0 §24 | Admin Next maison (réutiliser) |
| REQ-073 | **Éval** : ~50 Q/R de référence, lancée à chaque modif knowledge/prompt, couplée au versioning | INDÉP | v3.0 §25 | À créer |
| REQ-074 | **Garde-fous de coût** : plafond quotidien/mensuel par tenant, alerte, mode économie, budget tokens/réponse | INDÉP | v3.0 §26 | `cost-tracker` + cost-cap présents |
| REQ-075 | **KPIs** : exactitude, hallucination(0), conversion, escalade+délai, pertinence retrieval, latence, satisfaction, concurrence/429, hit cache, coût/conversation | INDÉP | v3.0 §27 | À instrumenter |
| REQ-076 | **Sauvegardes** : backup quotidien Postgres (knowledge+conversations) + restauration testée | INDÉP | v3.0 §19 | Coolify→B2 (étendre) |
| REQ-077 | **Versioning/rollback** knowledge + system prompt (par tenant), 1 clic | INDÉP | v3.0 §19 | `KnowledgeVersion` + à créer prompt |

## I. Frontend / widget

| ID | Exigence | Tag | Source | État dépôt |
|---|---|---|---|---|
| REQ-080 | **Bulle flottante** bas-droite, ouvrable/fermable, badge notif | STACK | v3.0 §21 + brief | À créer |
| REQ-081 | Bundle autonome **CDN Cloudflare**, **async/différé**, zéro impact SEO/perf | STACK | v3.0 §5.2, §21 | Web Vitals gates strictes |
| REQ-082 | Accueil proactif contextualisé selon la page ; chips de suggestions ; sources citées ; pouce ↑/↓ ; indicateur frappe ; persistance session serveur | STACK | v3.0 §21 + brief | À créer |
| REQ-083 | **Streaming token-par-token** ; reconnexion auto | STACK | v3.0 §21 | SSE pattern |
| REQ-084 | **États d'erreur** : perte connexion (bandeau+reconnexion), IA indispo/affluence (repli+contact), envoi échoué (sans perte de saisie) | INDÉP | v3.0 §21 | À créer |
| REQ-085 | **Accessibilité WCAG AA** : clavier, focus visible, ARIA, contrastes, `prefers-reduced-motion` | INDÉP | v3.0 §21 | Design system existant |
| REQ-086 | **Responsive** : plein écran mobile, bulle desktop, zones tactiles | STACK | v3.0 §21 + brief | À créer |
| REQ-087 | **CLS = 0** (la bulle ne provoque jamais de reflow) | STACK | AGENTS.md + brief | Gate LHCI |

## J. Évolutivité & roadmap

| ID | Exigence | Tag | Source | État dépôt |
|---|---|---|---|---|
| REQ-090 | **Couche d'abstraction fournisseur LLM** (Anthropic/OpenAI/Gemini/DeepSeek/Groq/OpenRouter) | INDÉP | addendum §3, §4.4 | `IProvider`+router (étendre Gemini/OpenRouter) |
| REQ-091 | Stratégie **cheap-first + fallback** + cache sémantique + prompt caching | INDÉP | addendum §2.3 | router + caching présents |
| REQ-092 | Ajout facile : tool, provider/modèle, tenant, source de knowledge | INDÉP | brief méthodo | Conception modulaire |
| REQ-093 | Canaux futurs : multilingue, WhatsApp/Messenger, voix, **live handoff** humain | INDÉP | v3.0 §29 | Hors MVP, prévoir extensibilité |
| REQ-094 | **Déploiement découplé** (cahier veut repo séparé) | STACK | v3.0 §5 | ❌ à confronter au monorepo (doc 03) |
| REQ-095 | **Feature flag d'activation + kill-switch + canary + rollback** | INDÉP | brief Phase 5 | Patterns flags/kill-switch présents |

## K. Critères de recette (§30 v3.0) — synthèse

REQ-100 … REQ-118 reprennent la checklist §30 : exactitude ≥95 %/0 invention, 5 outils OK + idempotence, escalade email+entrée, lead visible, RDV de bout en bout, widget streame+erreurs+responsive+CDN+WCAG AA, RGPD (consentement/purge/effacement/UE/DPA), mode dégradé, tests de charge ≥200, stateless/scalable, cache sémantique invalidé, isolation multi-tenant, anti-abus, Sentry+request-id+backups, rollback knowledge+prompt, garde-fous coût, console complète, latence 1er token <1,5 s sous charge. → Détail dans `07-RISQUES-ET-QUESTIONS-WILL.md` (DoD adaptée).

---

## L. Contradictions, ambiguïtés & trous des cahiers

| # | Problème | Type | Résolution proposée |
|---|---|---|---|
| C-01 | Stack **Laravel/Filament/Horizon/Octane** vs réalité Next.js/BullMQ | Contradiction (l'addendum la signale) | Réconcilier en Option A Node/TS (doc 03) |
| C-02 | **Axion CRM Pro** présenté comme app Laravel à appeler par API | Hypothèse fausse | CRM = `Submission`/`SubmissionReply` interne (doc 02 §7) |
| C-03 | **cal.com** comme outil RDV | Hypothèse partielle | Calendly Embed JS existant (doc 02 §7) |
| C-04 | **GA4/GTM** comme analytics | Hypothèse fausse | Plausible/Clarity (doc 02 §7) — décision Will si GA4 souhaité |
| C-05 | **Auto-hébergement** embeddings + reranking sur Hetzner | Hypothèse irréaliste sur 8 GB | API managée Voyage (doc 03) |
| C-06 | **Repo séparé / découplage total** (§5) vs monorepo + build GH Actions/Coolify | Contradiction opérationnelle | Module cloisonné monorepo à la `image-bank` (doc 03, STOP&ASK) |
| C-07 | **Autoscaling horizontal** sur un VPS unique CPX32 8 GB | Ambiguïté capacité | Scale vertical + container dédié ; horizontal = phase ultérieure (doc 07) |
| C-08 | Schéma SQL §13 (`kb_documents`, `kb_chunks`) **double** la KB V4 existante (`KnowledgeEntry`/`KnowledgeEmbedding`) | Redondance | RAG s'amorce sur KB existante + table `chat_kb_chunks` dédiée (doc 03) |
| C-09 | Embeddings **1024-dim** (§13) vs `Article.embedding` **1536-dim** existant | Ambiguïté dimension | Aligner sur **1024 voyage-3-lite** (cohérent `KnowledgeEmbedding`) (doc 03) |
| C-10 | **DPA** avec fournisseurs IA + non-rétention | Trou (juridique) | Action Will : signer/vérifier DPA Anthropic/OpenAI/Voyage (doc 07) |
| C-11 | **Multi-tenant** dès le départ vs un seul site réel (Axion-IA) | Sur-spécification MVP | `tenant_id` partout mais MVP single-tenant seedé (doc 03, STOP&ASK) |
| C-12 | « 1er token < 1,5 s » avec rerank + classification + retrieval en chaîne | Tension latence/qualité | Cache sémantique + cheap-first + rerank optionnel (doc 03/08) |
| C-13 | Transparence IA (« dialogue avec une IA ») non explicitée dans le widget v3.0 | Trou (AI Act) | Mention obligatoire en en-tête widget (doc 08) |

*Fin de la matrice d'exigences.*
