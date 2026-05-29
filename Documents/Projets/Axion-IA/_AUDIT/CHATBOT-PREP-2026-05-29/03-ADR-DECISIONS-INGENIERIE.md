# 03 — ADR : décisions d'ingénierie (Phase 3)

> Décisions tranchées, fondées sur l'audit du code réel (doc 02). Chaque ADR : décision + justification + alternatives écartées.
> Date : 2026-05-29. Statut : **proposé** (validation Will sur les STOP & ASK du doc 07).

---

## ADR-CB-01 — Stack du service chatbot : **Option A (tout Node/TS), module cloisonné dans le monorepo Next.js**

### Décision
Le chatbot est un **module TypeScript cloisonné dans le dépôt `axionia/` existant**, calqué sur le patron `image-bank` :
- Orchestration RAG + tool use + streaming : **route handlers Next.js** (`src/app/api/chatbot/**`, `runtime = "nodejs"`).
- Logique métier : `src/server/chatbot/**` (services purs).
- Asynchrone (ingestion, embeddings, résumés, escalades) : **workers BullMQ** `chatbot-*-worker.ts`.
- **Pas** de repo séparé. **Pas** de Laravel. **Pas** de service Node dédié (Hono/Fastify) au MVP.

### Justification (faits doc 02)
1. **La quasi-totalité de l'infra exigée existe déjà dans le monorepo** et est réutilisable : couche provider-agnostic (`IProvider`+`provider-router`+circuit breaker+retry, doc 02 §3.1), cost-cap (`cost-tracker`, §3.3), pgvector + HNSW (§2.1), FTS FR (§2.2), BullMQ (§4), admin RBAC/2FA (§5), brand-voice (§3.6), RGPD (§7), AI Act (§7), Turnstile + rate-limit (§4.2), Sentry + notifications (§7), pattern SSE (§1.6). Un repo séparé **dupliquerait tout cela**.
2. **Le CRM « Laravel » n'existe pas** (doc 02 §7, C-02) : aucune raison de cohérence Laravel. Les leads vivent dans `Submission` interne (même DB Postgres).
3. **Le pipeline build (GH Actions → GHCR → Coolify)** est monorepo (ADR 0026). Un repo séparé exigerait un second pipeline, une seconde image, une seconde DB ou un cross-DB — surcoût opérationnel injustifié pour un VPS unique.
4. **Node/TS** = meilleur streaming concurrent (addendum §1.1), alignement langage/types avec le front, écosystème IA mûr.

### Sur le « découplage total / repo séparé » (v3.0 §5, REQ-094)
**Écarté pour le MVP**, mais l'**isolation logique** est préservée par le cloisonnement strict (à la `image-bank`) : un dossier `chatbot/` autonome, des tables préfixées `chat_*`, un kill-switch et un feature flag dédiés. On obtient l'**isolation des pannes** et la **maintenabilité indépendante** voulues par §5, sans le coût d'un repo/déploiement séparé. → *Pour Ulixai (multi-tenant réel), le widget deviendra un bundle standalone servi par CDN (ADR-CB-08), mais le service reste dans le monorepo.*

### Alternatives écartées
- **B — Tout Laravel + Octane + Filament** : aucun Laravel dans le dépôt, dupliquerait toute l'infra TS, Octane ajoute une complexité d'exploitation (addendum §1.1) pour rien.
- **C — Hybride (service Node + admin Filament)** : Filament implique Laravel → deux stacks à maintenir pour un admin déjà fourni par le Next existant.
- **A-bis — Service Node dédié (Hono/Fastify) dans le monorepo** : valable si on vise un vrai découplage de déploiement, mais MVP = surcoût (second container, second build, duplication des accès Prisma/Redis). **Réservé à une phase « scale »** si les tests de charge l'exigent (un container `chatbot` dédié réutilisant le même code — voir R-CONC doc 07).

---

## ADR-CB-02 — Couche d'abstraction LLM : **étendre `IProvider`/`provider-router` existant**

### Décision
Réutiliser tel quel `IProvider` + `provider-router` + `withRetry` + `cost-tracker` (doc 02 §3). **Ajouter** au besoin :
- ~~un provider Gemini~~ **différé (décision Will 2026-05-29 : sans Gemini au MVP)** — la couche le supporterait, mais on évite un sous-traitant Google ; ajoutable plus tard ;
- optionnellement un **provider OpenRouter** comme agrégateur de fallback (REQ-091) ;
- activer le **rôle `rerank`** (déjà dans l'enum, off) via Voyage rerank.
- **Routage cheap-first** : classification/résumé → Claude **Haiku 4.5** ; génération → Claude Haiku/Sonnet selon complexité ; fallback géré par le router. (Gemini écarté au MVP.)
- **Prompt caching** Anthropic (`cache_control: ephemeral`) sur le system prompt stable (existant, §3.2).
- **Cache sémantique** en amont (ADR-CB-05) : zéro appel LLM sur question proche.

### Justification
Le router fait déjà fallback + circuit breaker + cost-cap. Y brancher le chatbot = ajouter des appels `generate({role:"text", preferredProvider, stream:true, …})`. L'addendum §3 exige une couche provider-agnostic — **elle existe**.
⚠️ **Circuit breaker in-memory** (§3.4) : pour le multi-instance, migrer l'état en **Redis partagé** (déjà identifié « V2 » dans le code). Pré-requis si on passe à plusieurs instances (R-CONC).

### Alternatives écartées
- **Vercel AI SDK** : non installé (doc 02 §1.1), redondant avec le router maison, ajouterait une dépendance et un second modèle mental. Le streaming SSE maison suffit.
- **Réécrire une couche provider** : gaspillage, l'existante est testée et instrumentée (cost-cap + Telegram).

---

## ADR-CB-03 — Modèle de données : **Prisma (cohérent dépôt), tables `chat_*`, RAG amorcé sur la KB existante**

### Décision
Définir les tables chatbot en **Prisma** (snake_case `@@map`, `Unsupported("vector(1024)")`, index HNSW + GIN via `migrations_fts`), **pas** en SQL brut §13. Réutiliser la KB V4 (`KnowledgeEntry`/`KnowledgeTranslation`/`KnowledgeEmbedding`/`KnowledgeVersion`) comme **source d'amorçage**, et créer une table de **chunks RAG dédiée** au chatbot pour le chunking 300–600 tokens.

#### Schéma Prisma proposé (illustratif — à écrire en implémentation, pas maintenant)
```prisma
// Tenant (MVP : un seul "axion-ia" seedé ; conçu multi-tenant)
model ChatTenant {
  id        String   @id @default(uuid()) @db.Uuid
  cle       String   @unique                  // clé transmise par le widget
  nom       String
  domaine   String?                           // CORS (ex. axion-ia.com)
  reglages  Json?                             // seuils, ton, budget, curseur conversion
  actif     Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  @@map("chat_tenants")
}

// Chunks RAG vectorisés (amorcés depuis KnowledgeEntry/KbFact/pages services)
model ChatKbChunk {
  id           String   @id @default(uuid()) @db.Uuid
  tenantId     String   @map("tenant_id") @db.Uuid
  sourceType   String   @map("source_type")   // knowledge_entry | kb_fact | service_page | article
  sourceRef    String   @map("source_ref")    // id/slug de la source
  categorie    String                          // prestations|tarifs|faq|methodo|cas|...
  priorite     String   @default("moyenne")
  contenu      String   @db.Text
  contexte     String?  @db.Text               // phrase de contextualisation (cahier §9)
  embedding    Unsupported("vector(1024)")?
  tsv          Unsupported("tsvector")?        // FTS fr_unaccent (via migrations_fts)
  version      Int      @default(1)
  actif        Boolean  @default(true)
  createdAt    DateTime @default(now()) @map("created_at")
  @@index([tenantId, categorie])
  @@map("chat_kb_chunks")
  // INDEX HNSW + GIN ajoutés en migrations_fts (Prisma ne gère pas vector/tsvector)
}

model ChatSemanticCache {
  id                String   @id @default(uuid()) @db.Uuid
  tenantId          String   @map("tenant_id") @db.Uuid
  question          String   @db.Text
  questionEmbedding Unsupported("vector(1024)")?
  reponse           String   @db.Text
  sources           Json?
  valideJusqu       DateTime? @map("valide_jusqu")
  hits              Int      @default(0)
  knowledgeVersion  Int      @map("knowledge_version") // pour invalidation
  createdAt         DateTime @default(now()) @map("created_at")
  @@map("chat_semantic_cache")
}

model ChatPromptVersion {
  id        String   @id @default(uuid()) @db.Uuid
  tenantId  String   @map("tenant_id") @db.Uuid
  contenu   String   @db.Text
  version   Int
  actif     Boolean  @default(false)
  note      String?
  createdAt DateTime @default(now()) @map("created_at")
  @@unique([tenantId, version])
  @@map("chat_prompt_versions")
}

model ChatConversation {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  sessionUuid String   @map("session_uuid") @db.Uuid
  persona     String?
  statut      String   @default("active")
  pageContext String?  @map("page_context")   // page d'origine (accueil proactif)
  submissionId String? @map("submission_id")  // lien lead capturé (Submission interne)
  resume      String?  @db.Text               // contexte long résumé
  ipHash      String?  @map("ip_hash")         // SHA-256 salée
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  messages    ChatMessage[]
  @@index([tenantId, statut])
  @@map("chat_conversations")
}

model ChatMessage {
  id             String   @id @default(uuid()) @db.Uuid
  conversationId String   @map("conversation_id") @db.Uuid
  conversation   ChatConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           String                            // user | assistant | system
  contenu        String   @db.Text
  sources        Json?                             // chunks cités
  toolCalls      Json?    @map("tool_calls")
  feedback       Int?                              // pouce +1/-1
  latenceMs      Int?     @map("latence_ms")
  modele         String?
  coutEstime     Decimal? @map("cout_estime") @db.Decimal(10,5)
  servedFromCache Boolean @default(false) @map("served_from_cache")
  createdAt      DateTime @default(now()) @map("created_at")
  @@index([conversationId, createdAt])
  @@map("chat_messages")
}

model ChatEscalation {
  id             String   @id @default(uuid()) @db.Uuid
  tenantId       String   @map("tenant_id") @db.Uuid
  conversationId String?  @map("conversation_id") @db.Uuid
  question       String   @db.Text
  contexte       String?  @db.Text
  contactEmail   String?  @map("contact_email")
  statut         String   @default("ouverte")
  emailEnvoye    Boolean  @default(false) @map("email_envoye")
  submissionId   String?  @map("submission_id")  // si converti en lead
  createdAt      DateTime @default(now()) @map("created_at")
  @@map("chat_escalations")
}

model ChatActionIdempotency {
  cle       String   @id              // hash(conversationId + outil + payload)
  resultat  Json?
  createdAt DateTime @default(now()) @map("created_at")
  @@map("chat_action_idempotency")
}
```

### Justification
- Tables `chat_*` → cloisonnement clair, kill-switch/feature-flag faciles, RGPD/purge ciblés.
- **`chat_kb_chunks` séparé** plutôt que `knowledge_embeddings` réutilisé directement : `KnowledgeEmbedding` est 1:1 avec `KnowledgeTranslation` (document-level, **à vérifier** doc 02 §9), or le RAG veut des chunks 300–600 tokens (REQ-016, C-08). Une table dédiée garde le module autonome **tout en s'amorçant** sur la KB.
- **Dimension 1024** (voyage-3-lite) alignée sur `KnowledgeEmbedding` (résout C-09).
- `tenant_id` partout (REQ-003) ; MVP seede un tenant `axion-ia`.
- Lead = lien vers `Submission` interne (pas de table `leads` séparée → cohérence CRM).

### Alternatives écartées
- **SQL brut §13** : casse la cohérence Prisma/migrations/typage du dépôt.
- **Réutiliser `knowledge_embeddings` pour les chunks chatbot** : couplerait le chatbot à la KB éditoriale (granularité document, invalidation croisée) — perte de cloisonnement.
- **Embeddings 1536 (OpenAI)** : possible mais romprait l'alignement 1024 de la KB et le code `embeddings.ts` ; coût Voyage < OpenAI (doc 06).

---

## ADR-CB-04 — Embeddings & reranking : **API managée Voyage AI, PAS d'auto-hébergement**

### Décision
- **Embeddings** : Voyage AI **`voyage-3-lite`** (1024-dim) — câbler la vraie API dans `src/lib/knowledge/embeddings.ts` (aujourd'hui stub, doc 02 §3.5). Variable `VOYAGE_API_KEY`.
- **Reranking** : Voyage **`rerank-2.5-lite`** via le rôle `rerank` du router (activation). **Repli sans rerank** (retrieval hybride seul) si indisponible (REQ-012, §17).

### Justification
- Le VPS est un **CPX32 8 GB partagé** (doc 02 §1.5) : héberger un modèle d'embedding (e5/bge-m3) + un cross-encoder reranker saturerait la RAM/CPU déjà consommée par Postgres+Redis+Next+workers. L'addendum §2.2 (auto-hébergement) est **irréaliste sur cette machine** (C-05).
- Voyage offre **200 M tokens gratuits** par compte sur `voyage-3-lite` et `rerank-2.5-lite` (doc 06) → coût quasi nul au démarrage, et le code attend déjà `voyage-3-lite`.
- Pas de GPU → pas d'inférence locale performante.

### Alternatives écartées
- **Auto-hébergé Hetzner** : RAM/CPU insuffisants (verdict capacité doc 02 §1.5).
- **OpenAI text-embedding-3-large (1536)** : romprait l'alignement 1024 + plus cher (doc 06) ; gardé en **fallback** possible (le code dedup existe).
- **Cohere embed/rerank** : viable, mais Voyage gratuit jusqu'à 200 M tokens et déjà attendu par le code.

---

## ADR-CB-05 — Cache sémantique : **Postgres pgvector + invalidation par version de knowledge**

### Décision
`chat_semantic_cache` (pgvector 1024). Avant tout appel LLM : embed la question → recherche cosine top-1 ; si similarité ≥ seuil (réglable par tenant) et `valide_jusqu` non expiré et `knowledge_version` courante → **renvoyer la réponse en cache** (REQ-025). Invalidation : à chaque ré-ingestion de knowledge, incrémenter une version → les entrées de cache d'une version antérieure sont ignorées/purgées (REQ-026). Hits comptés (REQ-027). Réglages (activation/seuil/TTL) dans `ChatTenant.reglages`.

### Justification
pgvector déjà actif → pas de service vectoriel externe. L'invalidation par version évite des réponses périmées (cohérence garantie §11). Gain massif de latence + coût sous charge (addendum §2.3).

### Alternatives écartées
- **Cache Redis (clé exacte)** : ne capte pas la similarité sémantique (questions reformulées manquées).
- **Service de cache sémantique externe** : surcoût, pgvector suffit.

---

## ADR-CB-06 — Streaming & concurrence : **SSE route handler Node runtime, état en DB+Redis (stateless)**

### Décision
- Streaming via **route handler `runtime="nodejs"`** + `ReadableStream` + `text/event-stream` (gabarit `content-gen/jobs/[id]/stream`, doc 02 §1.6), relayant le flux token du provider.
- **Stateless** : état conversation en `chat_*` (DB), locks/token-bucket/cache en Redis (REQ-050).
- **Token-bucket + backpressure** : limiter le débit LLM sous le palier du tier ; au plafond → file courte + message « forte affluence », jamais de 429 brut (REQ-056). Réutiliser le pattern `limiter` worker + `rate-limit.ts`.
- **Health checks** : étendre `/api/healthz` (REQ-051).
- **Reconnexion auto** widget (Last-Event-ID / replay du dernier message) (REQ-054).

### Justification & limites
Node tient des centaines de SSE ouvertes (event loop). Le goulot réel = rate limits LLM + Postgres + CPU (doc 02 §8). Mitigé par cache sémantique + token-bucket + cheap-first.
⚠️ **Autoscaling horizontal (REQ-051/057) sur un VPS unique CPX32 = non disponible.** MVP = **mono-instance + scale vertical** ; le « 200 simultanés » sera validé par k6 (REQ-059) et, si besoin, un **container `chatbot` dédié** (réutilisant le code) sera ajouté. → R-CONC + STOP&ASK budget (doc 07).

### Alternatives écartées
- **Edge runtime** : pas d'accès Prisma/Redis Node, timeouts → inadapté au RAG stateful.
- **WebSocket** : SSE suffit pour du streaming unidirectionnel et traverse mieux les proxies (Caddy/Cloudflare).

---

## ADR-CB-07 — Console admin : **nouvelle section dans l'admin Next existant**

### Décision
Section `(admin)/[adminPrefix]/chatbot/**` + Server Actions `src/features/admin-chatbot/` (guards `requireAdminRead/Write/Publish/Delete`), entrée(s) dans `admin-nav.ts` (groupe `content` ou nouveau groupe `chatbot`). Modules : tenants, knowledge (réutilise la KB), conversations, leads (→ `Submission`), escalades, prompt (versioning/rollback), cache sémantique, éval, métriques (charge/concurrence/429/hit cache), coûts (cost-cap), réglages. noindex hérité du layout admin.

### Justification
L'admin maison est mature (doc 02 §5) ; **Filament impliquerait Laravel** (écarté ADR-CB-01). Réutilise RBAC, 2FA, scaffolds, `activityLog`.

### Alternatives écartées
- **Filament v4 (v3.0 §24)** : pas de Laravel. **Refine/React admin séparé** : duplique l'admin existant.

---

## ADR-CB-08 — Widget : **bulle bas-droite, île React montée à l'idle (MVP), bundle standalone CDN (multi-site)**

### Décision (MVP)
Widget = **composant React monté tardivement** (`next/dynamic({ ssr:false })` + déclenchement `requestIdleCallback`/première interaction/scroll), **hors First Load JS** des routes (chunk async séparé). Bulle `position: fixed` bas-droite (jamais de reflow → **CLS = 0**, REQ-087), **plein écran sur mobile** / bulle desktop (REQ-086). Streaming token-par-token (ADR-CB-06), chips de suggestions, sources citées, pouce ↑/↓, indicateur de frappe, persistance session serveur, reconnexion auto (REQ-082/083), états d'erreur sans perte de saisie (REQ-084), **mention « vous dialoguez avec une IA »** en en-tête (REQ-064, doc 08), WCAG AA (REQ-085).

### Décision (multi-site / Ulixai — phase ultérieure)
Bundle **standalone** (build séparé) injecté par `<script async>` servi par **CDN Cloudflare**, transmettant la clé de tenant (REQ-081). Réutilise le même service.

### Justification
MVP en île React = un seul déploiement, réutilise le design system (WCAG, tokens) et évite un second pipeline de build. Le respect des budgets Web Vitals tient à : chargement différé (pas dans le First Load), chunk isolé (gate `size-limit` sur un bucket dédié au widget), positionnement fixe (CLS 0), `prefers-reduced-motion`.
→ **STOP & ASK Q-WIDGET (doc 07)** : île React MVP vs bundle standalone d'emblée.

### Alternatives écartées
- **Bundle externe d'emblée** : surcoût build/CDN non justifié tant qu'il n'y a qu'un site (Axion-IA).
- **Composant dans le First Load** : violerait les gates Web Vitals (75 KB gz).

---

## ADR-CB-09 — Intégrations : réutiliser l'existant (Calendly, Submission, email worker, Plausible, Telegram)

### Décision
- **`capturer_lead`** → crée un `Submission` (type `contact` ou `quote_request`, source `chatbot`, `tenant_id`, `ipHash`), **idempotent** via `chat_action_idempotency` (REQ-031). Notifie via hub `notify()` (Telegram) + email.
- **`escalader_question`** → `ChatEscalation` + email équipe (worker `emails` + template React) + `notify()` ; remonte le trou de KB dans la console (REQ-034).
- **`proposer_rdv`** → renvoie le lien **Calendly** / page `/appel` (PAS cal.com) (REQ-032, C-03).
- **`chercher_ressource`** → requête `Article`/`CaseStudy` existants (REQ-033).
- **Analytics funnel** → `trackFunnel()` **Plausible** (PAS GA4) : `Chat Started`, `Chat Qualified`, `Chat RDV`, `Chat Lead`, `Chat Escalated` (REQ-071, C-04). → STOP&ASK si Will veut aussi GA4.
- **RGPD** : étendre `gdpr-export`/`gdpr-erase`/`retention-purge` pour `chat_conversations`/`chat_messages` (REQ-060) ; consentement explicite avant `capturer_lead` ; IP hashées.

### Alternatives écartées
- **Axion CRM Pro externe** : n'existe pas (C-02). **cal.com** : Calendly existant (C-03). **GA4/GTM** : Plausible en place (C-04).

---

## ADR-CB-10 — Évolutivité & canaux futurs

### Décision
- **Nouvel outil** : ajouter un schéma JSON + un handler dans le registre de tools (`src/server/chatbot/tools/`), injection serveur du `tenant_id`.
- **Nouveau provider/modèle** : implémenter `IProvider` + seed `ProviderConfig` (router gère le reste).
- **Nouveau tenant** : insérer `ChatTenant` (clé/domaine/réglages) ; aucun code.
- **Nouvelle source de knowledge** : ajouter un connecteur d'ingestion (worker) → `chat_kb_chunks`.
- **Canaux futurs** (multilingue/WhatsApp/Messenger/voix/live handoff, REQ-093) : isoler la **logique conversationnelle** (orchestrateur RAG+tools) de l'**adaptateur de canal** (widget SSE aujourd'hui). Un nouveau canal = un nouvel adaptateur consommant le même orchestrateur.

### Justification
Le découplage orchestrateur ↔ canal évite de réécrire le cœur (REQ-092).

---

## Récapitulatif des décisions

| ADR | Sujet | Décision |
|---|---|---|
| CB-01 | Stack | Node/TS, module monorepo cloisonné (pas Laravel, pas repo séparé) |
| CB-02 | Couche LLM | Étendre `IProvider`/router existant (Haiku/Sonnet ; +OpenRouter fallback optionnel ; rerank ; **Gemini différé, non-MVP**) |
| CB-03 | Données | Prisma `chat_*`, RAG amorcé sur KB, chunks dédiés, vector(1024) |
| CB-04 | Embeddings/rerank | Voyage managé (voyage-3-lite + rerank-2.5-lite), pas d'auto-hébergement |
| CB-05 | Cache sémantique | pgvector + invalidation par version |
| CB-06 | Streaming/concurrence | SSE Node runtime, stateless DB+Redis, token-bucket ; mono-instance MVP |
| CB-07 | Console admin | Section dans l'admin Next existant (pas Filament) |
| CB-08 | Widget | Île React idle (MVP) → bundle CDN standalone (multi-site) |
| CB-09 | Intégrations | Calendly + Submission + email worker + Plausible + Telegram (réutiliser) |
| CB-10 | Évolutivité | Orchestrateur ↔ adaptateur de canal découplés |

*Fin des ADR.*
