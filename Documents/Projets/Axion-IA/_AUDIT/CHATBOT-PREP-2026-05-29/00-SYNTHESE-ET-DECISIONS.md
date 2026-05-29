# 00 — Synthèse & décisions (À LIRE EN PREMIER)

> **Dossier de préparation** à l'implémentation d'un chatbot conversationnel (RAG + tool use) pour **axion-ia.com**, réutilisable (multi-tenant, type Ulixai).
> **Périmètre de ce dossier : préparation uniquement.** Aucun code applicatif écrit, aucune migration exécutée, aucune dépendance installée. 8 livrables `.md` produits.
> Date : 2026-05-29.

---

## 1. Le verdict en une phrase

Le cahier v3.0 suppose une stack **Laravel/Filament** et un **CRM externe** ; le dépôt réel est **Next.js 16 / TypeScript / Prisma / pgvector / BullMQ**, et **80 % de l'infrastructure exigée par le cahier existe déjà** (couche LLM provider-agnostic, pgvector + HNSW, FTS FR, cost-cap, workers, admin RBAC/2FA, brand-voice, RGPD, AI Act, Turnstile, Sentry, streaming SSE). → Le chatbot doit être un **module TypeScript cloisonné dans le monorepo** (calqué sur `image-bank`) qui **réutilise** ces briques, **pas** un service Laravel dans un repo séparé.

## 2. Recommandation de stack — tranchée

**Option A (tout Node/TS), module cloisonné dans le dépôt `axionia/`** (ADR-CB-01) :
- Orchestration RAG + tool use + streaming → **route handlers Next.js** (`runtime="nodejs"`).
- Métier → `src/server/chatbot/**` ; asynchrone → **workers BullMQ** ; console → **admin Next existant** (pas Filament) ; widget → **île React montée à l'idle** (hors First Load JS, CLS 0).
- **Écartés** : Laravel+Octane+Filament (aucun Laravel dans le dépôt), repo séparé (duplique tout, second pipeline), Vercel AI SDK (router maison déjà présent), auto-hébergement embeddings/reranking (VPS CPX32 8 GB insuffisant).

## 3. Faits décisifs de l'audit (doc 02)

| Hypothèse cahier | Réalité (fichier:ligne) | Conséquence |
|---|---|---|
| Laravel 12 / Filament | Next.js 16.2.6 / Prisma 5.22 (`package.json:138,101`) | Cahier réconcilié → v4.0 (doc 04) |
| pgvector à activer | **Déjà actif** (`migrations/...kb_v4_pgvector_embeddings:5,33`) | Pas de migration d'activation |
| Couche provider à créer | **`IProvider`+router+cost-cap+caching** (`content-gen/providers/`) | À étendre, pas créer |
| Axion CRM Pro (Laravel) | **Inexistant** — `Submission`/`SubmissionReply` interne (`schema.prisma:621,708`) | `capturer_lead` → Submission |
| cal.com | **Calendly Embed JS** + Booking interne | `proposer_rdv` → Calendly |
| GA4 / GTM | **Plausible + Clarity** (`lib/tracking.ts`) | Funnel sur Plausible |
| Embeddings auto-hébergés | VPS **CPX32 8 GB partagé** | **API Voyage managée** |
| FTS hybride à construire | **FTS FR fonctionnel** (`search-fts.ts:59`), fusion vectorielle non câblée | Câbler le volet cosine |
| Streaming à concevoir | **Pattern SSE existant** (`content-gen/jobs/[id]/stream:60`) | Réutiliser le gabarit |

## 4. Top décisions (détail doc 03)

1. **Stack** : Node/TS module monorepo cloisonné (pas Laravel, pas repo séparé).
2. **LLM** : étendre `IProvider`/router (cheap-first : **Haiku 4.5** pour le volume → **Sonnet** pour les cas complexes, **sans Gemini** — décision Will 2026-05-29 ; +OpenRouter fallback optionnel ; prompt caching ; cache sémantique).
3. **Données** : Prisma `chat_*` (8 modèles), vector(1024) + HNSW + GIN via `migrations_fts` ; RAG **amorcé** sur la KB existante via une table de chunks dédiée `chat_kb_chunks`.
4. **Embeddings/rerank** : Voyage `voyage-3-lite` + `rerank-2.5-lite` (managé, 200 M tokens gratuits) ; câbler la vraie clé dans `embeddings.ts` (aujourd'hui stub).
5. **Cache sémantique** : pgvector + invalidation par version de knowledge.
6. **Concurrence** : SSE Node, stateless (DB+Redis), token-bucket/backpressure ; **mono-instance + scale vertical** (autoscaling horizontal indisponible sur 1 VPS) → cible 200 simultanés à **valider par k6** (R-CONC).
7. **Console** : section dans l'admin Next existant (RBAC/2FA réutilisés).
8. **Widget** : bulle bas-droite, île React idle, CLS 0, plein écran mobile, transparence IA en en-tête, WCAG AA.
9. **Intégrations** : Calendly + Submission + email worker + Plausible + Telegram (tout existant).
10. **Réversibilité** : feature flag `CHATBOT_ENABLED` + kill-switch + canary + rollback knowledge/prompt.

## 5. Coût (doc 06, prix mai 2026 sourcés)
- Démarrage : **≈ 6–50 $/mois** (selon palier LLM ; embeddings Voyage gratuits sous 200 M).
- Production ~30 K réponses/mois, **mix retenu (Haiku/Sonnet, sans Gemini)** : **≈ 140–205 $/mois**.
- Infra marginale ≈ 0 (Hetzner/Postgres/Redis/Cloudflare/Sentry/Plausible existants).
- Garde-fous : cost-cap par tenant + mode économie (réutilise `cost-tracker`).

## 6. Questions STOP & ASK (détail doc 07) — à trancher par Will
- **Q-STACK** : valider module monorepo (pas repo séparé) ? → reco *oui*.
- **Q-TENANT** : MVP single-tenant puis multi-tenant, ou multi-tenant d'emblée ? → reco *single-tenant*.
- **Q-WIDGET** : île React (MVP) ou bundle CDN d'emblée ? → reco *île React* (bundle si Ulixai imminent).
- **Q-LLM** : palier qualité/coût (cheap-first / mix / qualité) ? → reco *mix*.
- **Q-EMB** : confirmer Voyage (clé à fournir) ? → reco *oui*.
- **Q-RDV / Q-CRM / Q-ANALYTICS** : confirmer Calendly / Submission / Plausible (pas cal.com/CRM externe/GA4) ? → reco *oui*.
- **Q-DPA** : signer/vérifier DPA + non-rétention (Anthropic/OpenAI/Voyage) avant prod.
- **Q-CONCUR** : budget scaling pour 200 simultanés (scale vertical / container dédié) ou plafonner la cible ?
- **Q-SEUILS / Q-MVP1** : seuils de départ et périmètre exact MVP 1.

## 7. Les 8 livrables de ce dossier
| Fichier | Contenu |
|---|---|
| `00-SYNTHESE-ET-DECISIONS.md` | Ce document (verdict + décisions + STOP&ASK). |
| `01-MATRICE-EXIGENCES.md` | Exigences numérotées REQ-001… + tags stack + contradictions des cahiers. |
| `02-AUDIT-DEPOT-REEL.md` | Audit factuel du code (références fichier:ligne). |
| `03-ADR-DECISIONS-INGENIERIE.md` | 10 ADR tranchés + alternatives écartées + schéma Prisma proposé. |
| `04-CAHIER-CHATBOT-v4.0.md` | Cahier recréé (stack réelle) + table de correspondance v3.0→v4.0 + **diagramme Mermaid**. |
| `05-PLAN-IMPLEMENTATION-ET-CLOISONNEMENT.md` | Arborescence, fichiers à créer/modifier, tools, RAG/BullMQ, tests, roadmap MVP mappée CI/CD, seed knowledge. |
| `06-ESTIMATION-COUT.md` | Coûts mensuels, prix sourcés/datés (mai 2026). |
| `07-RISQUES-ET-QUESTIONS-WILL.md` | Registre des risques + STOP&ASK + Definition of Done. |
| `08-SECURITE-AIACT-EVOLUTIVITE.md` | Sécurité IA (anti-injection/exfiltration), EU AI Act, WCAG AA, tests, réversibilité, DR, évolutivité. |
| `09-RUNBOOK-AUTOPILOT.md` | Décisions verrouillées (défauts) + pré-flight checklist + inventaire env vars/secrets + conduite en cas de blocage (autopilot). |
| `10-ETAT-ET-REPRISE.md` | **Journal de bord reprenable** : 32 tâches T-01→T-32 par MVP + protocole de vérification par tâche + tableau de bord + reprise après fermeture. |
| `11-JEU-EVAL-50QR.md` | Jeu d'évaluation ~50 Q/R (brouillon) + grille de scoring + valeurs factuelles à valider par Will. |
| `12-DEMARRAGE-AUTOPILOT.md` | **POINT D'ENTRÉE** : ce que déclenche la phrase « lance l'implémentation du chatbot et vérifie ce qui a déjà été implémenté » — Phase 0 (contexte/évolution) → 1 (réconciliation réalité⇄code) → 2 (pré-flight) → 3 (reprise). |

> **Pour lancer l'autopilot (phrase déclencheuse de Will) :** « *lance l'implémentation du chatbot et vérifie ce qui a déjà été implémenté* » → exécuter `12` (Phases 0→3) qui revalide le contexte, vérifie l'état réel du code, resynchronise `10`, puis reprend à la 1ʳᵉ tâche incomplète. `10` survit à une fermeture de Claude Code.

## 8. Ce qui reste à faire en phase d'implémentation (conversation suivante — NON fait ici)
1. Trancher les STOP & ASK (§6) + fournir la clé Voyage + statut DPA.
2. **MVP 1** : créer `feat/chatbot-schema` → 8 modèles `chat_*` + migration `chatbot_core` + `migrations_fts` (vector/HNSW/tsvector) + seed tenant `axion-ia`.
3. Câbler Voyage réel dans `embeddings.ts` ; ingestion+seed knowledge ; retrieval hybride ; génération streamée + citations ; widget bulle minimal (flag off).
4. MVP 2→4 : tools+escalade, console admin, cache sémantique, token-bucket, cost-cap, k6, éval (doc 05 §11).
5. Tests (Vitest/Playwright/k6/éval) + gates CI (lhci/size-limit) + activation canary.

## 9. Première action d'implémentation recommandée (à NE PAS faire ici)
> Créer la branche `feat/chatbot-schema` et ajouter les 8 modèles `chat_*` au `schema.prisma`, puis générer la migration `migrations/<ts>_chatbot_core` + le SQL `migrations_fts/<ts>_chatbot_fts.sql` (vector(1024)/HNSW/tsvector) et seeder le tenant `axion-ia`. C'est le socle dont dépend tout le reste (MVP 1).

*Fin de la synthèse.*
