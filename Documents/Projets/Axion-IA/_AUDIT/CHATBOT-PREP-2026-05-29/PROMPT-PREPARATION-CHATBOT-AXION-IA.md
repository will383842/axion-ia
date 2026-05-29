# PROMPT — Préparation à l'implémentation d'un chatbot pour Axion-IA

> **Mode d'emploi :** ouvre une **nouvelle conversation Claude Code** à la racine du projet
> (`C:\Users\willi\Documents\Projets\Axion-IA`) et **colle l'intégralité du bloc ci-dessous**
> (de `<role>` jusqu'à la fin). Ce prompt ne déclenche **aucune** écriture de code applicatif :
> il produit uniquement un **dossier de préparation** (audit + décision d'architecture + cahier
> adapté à la vraie stack + plan d'implémentation prêt à exécuter). L'implémentation se fera dans
> une conversation ultérieure, à partir des livrables produits ici.

---

<role>
Tu es un **architecte full-stack senior spécialiste des chatbots IA conversationnels** (RAG +
tool use), expert à la fois du **frontend** (widgets embarquables, streaming SSE, React/Next.js,
Web Vitals) et du **backend** (orchestration LLM, pgvector, files d'attente, haute concurrence,
RGPD), et expert de l'**intégration de nouvelles capacités dans des stacks existantes** sans les
casser. Tu raisonnes en ingénieur : tes recommandations s'appuient sur des **faits vérifiés dans
le code réel**, pas sur des suppositions. Tu connais les meilleures pratiques de mai 2026 pour le
RAG, le tool use, le streaming, le cache sémantique et la maîtrise des coûts LLM.
</role>

<mission>
Préparer **de bout en bout** l'implémentation future d'un chatbot conversationnel textuel pour
**axion-ia.com** (réutilisable sur d'autres services type Ulixai — multi-tenant), en t'appuyant
sur les deux cahiers des charges fournis ET sur un **audit en profondeur du dépôt réel**.

Ta mission a quatre volets :
1. **Auditer et analyser en profondeur** les deux fichiers de spécification fournis.
2. **Auditer le dépôt Axion-IA réel** pour confirmer ou infirmer toutes les hypothèses des cahiers
   (notamment la stack, qui est supposée Laravel dans le v3.0 mais qui est en réalité Next.js).
3. **Trancher les décisions d'ingénierie** que seul le code réel permet de trancher (stack du
   service chatbot, intégration, modèle de données, coût).
4. **Produire un dossier de préparation complet et prêt à exécuter** : cahier des charges adapté à
   la vraie stack, modèle de données, plan de cloisonnement des fichiers, plan d'implémentation
   par phases, estimation de coût, registre des risques, et liste des décisions à valider par Will.
</mission>

<contrainte_absolue>
⛔ **TU N'IMPLÉMENTES RIEN.** Aucune ligne de code applicatif, aucune migration exécutée, aucun
fichier source du chatbot créé, aucune dépendance installée, aucune commande de build/déploiement.

Tu produis **uniquement des documents de préparation** (fichiers `.md`, éventuellement des
schémas/diagrammes/extraits illustratifs *dans* ces docs). Les extraits de code dans les docs sont
permis **à titre d'illustration de conception** (ex. proposition de schéma Prisma, signature de
tool, arborescence de fichiers) — mais ils restent dans les `.md`, jamais dans `src/`.

Le seul résultat attendu est un **dossier de préparation** que Will (ou une future conversation)
pourra lire puis exécuter pas à pas. Si tu es tenté d'écrire du code « pour gagner du temps » :
**arrête-toi**, c'est hors périmètre.

À la fin, **liste explicitement ce qui reste à faire en phase d'implémentation** (la conversation
suivante), sans le faire.
</contrainte_absolue>

<fichiers_a_auditer>
Lis et analyse **en profondeur, intégralement** ces deux fichiers (ce sont les cahiers des charges
sources, à challenger et adapter) :

1. `C:\Users\willi\Downloads\files (13)\Cahier_Chatbot_Axion-IA_v3.0.md`
   — Cahier des charges complet (cadrage, architecture RAG+tool use, multi-tenant, haute
   concurrence, données/pipelines, intelligence, robustesse, frontend/backend, pilotage, roadmap
   MVP, critères de recette). **Suppose une stack Laravel 12 / Filament.**

2. `C:\Users\willi\Downloads\files (13)\Cahier_Chatbot_Axion-IA_v3.1_Addendum_Stack_et_Couts.md`
   — Addendum : remet en cause le choix Laravel (le site est en Next.js), propose des options de
   stack (A Node/TS · B Laravel · C hybride), une architecture au coût minimal, et **te confie
   explicitement un brief de vérification (sa section 4) que tu dois exécuter sur le vrai code**.

**Traite la section 4 de l'addendum comme ta checklist de départ**, mais va au-delà.
</fichiers_a_auditer>

<contexte_depot_reel>
Voici ce que tu sais déjà du dépôt (À VÉRIFIER toi-même dans le code, ne fais pas une confiance
aveugle — ces notes peuvent avoir bougé) :

- **Racine projet :** `C:\Users\willi\Documents\Projets\Axion-IA`. Le **code applicatif réel vit
  dans le sous-dossier `axionia/`** (c'est là qu'est `package.json`). Il y a aussi `_AUDIT/`,
  `infra/`, `AxionIA_Dossier_FINAL_ABSOLU_v10.1/`, `Wireframes-Briefs-AxionIA/`.
- **Stack réelle (confirmée dans `axionia/package.json`) :** Next.js **16.2.6** (App Router),
  React **19.2.4**, Prisma **5.22**, `@anthropic-ai/sdk` **0.40**, `openai` **4.104**, BullMQ
  **5.76**, ioredis **5.10**, next-intl **4.11**. Gestionnaire de paquets : **pnpm**. → La stack
  est **TypeScript/Node**, PAS Laravel. Le cahier v3.0 doit donc être réconcilié avec la réalité.
- **Base de données :** PostgreSQL via Prisma (`axionia/prisma/schema.prisma`, migrations,
  `migrations_fts` pour le full-text search FR). Vérifie si **pgvector** est déjà présent/activé.
- **Files d'attente :** BullMQ + Redis, workers sous `axionia/src/server/queue/workers/*`
  (déjà ~15 workers : content-gen, indexing, indexnow, fact-check, etc.). Pattern worker établi.
- **Admin existant :** back-office sous `axionia/src/app/[locale]/(admin)/[adminPrefix]/...`
  (RBAC, 2FA, pages Filament-like maison en React/Next). → La console du chatbot devra **s'insérer
  dans cet admin existant**, pas réinventer un back-office.
- **LLM déjà câblé :** providers OpenAI + Anthropic utilisés par le pipeline `content-gen`
  (`axionia/src/server/content-gen/*`). Cherche une éventuelle couche d'abstraction provider à
  réutiliser/étendre.
- **Module exemplaire à imiter — la « banque d'images » :** `axionia/src/server/image-bank/*` +
  workers `image-bank-*-worker.ts` + admin `image-bank/**` + skill `axionia-image-bank`. C'est un
  **module auto-suffisant, cloisonné, multi-locale, avec workers + admin + JSON-LD + RGPD**. Sers-
  t'en comme **patron architectural** pour cloisonner le module chatbot de la même manière.
- **Build & déploiement (ADR 0026 — voir `AGENTS.md`) :** build Docker **externalisé sur GitHub
  Actions** → push GHCR → Coolify fait `pull`. Magic string **`stub.invalid`** : au build, Prisma
  et Redis sont stubés (pas de DB/Redis dispo en CI). **Contrat à respecter** : toute page/route
  SSG faisant un appel DB au build doit gérer le stub. Hébergement runtime : VPS Hetzner (Coolify).
- **i18n — RÈGLE ABSOLUE :** le locale **EN est désactivé** (proxy 301 EN→FR depuis 2026-05-16).
  **NE RIEN produire en anglais.** FR canonique uniquement. Si un type force `{fr,en}`, `en` =
  copie miroir de `fr`. Schémas LLM = **FR-only**. (Vaut aussi pour le knowledge du chatbot.)
- **Budget Web Vitals (strict, voir `AGENTS.md`) :** LCP ≤ 1800 ms p75, INP ≤ 100 ms p75, CLS = 0,
  First Load JS ≤ 75 KB gz/route (exception `/reserver` : 110 KB). **Le widget chatbot ne doit
  PAS dégrader ces seuils** → chargement async/différé, bundle hors First Load, servi par CDN. Tout
  patch qui dégrade = STOP & ASK Will + ADR. Lighthouse CI + size-limit gate les PR.
- **CRM :** « Axion CRM Pro » est mentionné comme étant en Laravel dans les cahiers. **Vérifie où
  il vit réellement, s'il existe dans ce dépôt ou ailleurs, et comment l'appeler depuis Node.**
- **Cal.com / Calendly :** une intégration Calendly existe déjà (page `/appel`, widget). Vérifie
  l'existant avant de proposer cal.com.
- **Voix de marque & garde-fous existants :** le dépôt a une infra **brand-voice**
  (`brand-voice-drift-monitor` worker, phrases bannies, ton) et un pipeline `content-fact-check`.
  Le system prompt + le ton du chatbot doivent **réutiliser/étendre** cette voix de marque, pas la
  redéfinir. Cherche aussi `feature-flags.ts` et tout concept de **kill-switch** (déjà présents)
  pour un déploiement réversible.
- **Knowledge existant à amorcer :** `axionia/src/lib/knowledge/*` et les KB facts (villes,
  services) existent déjà. La base de connaissances du chatbot doit s'**amorcer** sur ces actifs
  + les pages services canoniques (`/audit`, `/interventions`, `/implementation`, `/un-a-un`,
  `/sites-web-augmentes`) plutôt que repartir de zéro.
- **Tests :** le dépôt utilise **Vitest** (unit/intégration) et **Playwright** (E2E). Le module
  chatbot doit s'inscrire dans cette infra de test, pas en créer une parallèle.
- **Conformité IA :** Axion-IA tient à la conformité **EU AI Act**. Un chatbot est un système d'IA
  déployé → obligation de **transparence** (informer l'utilisateur qu'il dialogue avec une IA),
  traçabilité, et garde-fous documentés. À traiter explicitement.
</contexte_depot_reel>

<methodologie>
Procède par phases. Annonce chaque phase. Utilise des sous-agents en parallèle quand tu explores
plusieurs sous-systèmes indépendants (audit du code). Utilise la recherche web pour les **prix LLM
de mai 2026** (ils bougent vite — l'addendum le signale).

### Phase 1 — Lecture & extraction des exigences (cahiers)
- Lis intégralement les deux cahiers.
- Produis une **matrice d'exigences** numérotée (REQ-001…) couvrant : fonctionnel, RAG/pipeline,
  tool use (5 outils), multi-tenant, haute concurrence, cache sémantique, RGPD/sécurité/anti-abus,
  observabilité, console admin, éval, garde-fous de coût, critères de recette (section 30).
- Marque chaque exigence : `[indépendante de la stack]` ou `[dépendante de la stack]`.
- Relève **contradictions internes, ambiguïtés, hypothèses non vérifiées et trous** des cahiers.

### Phase 2 — Audit en profondeur du dépôt réel
Exécute le **brief de vérification (addendum §4)** sur le vrai code, et au-delà :
- **Stack & build :** confirme versions, structure `axionia/`, conventions, le contrat
  `stub.invalid`, le pipeline GH Actions → GHCR → Coolify, les budgets Web Vitals et leurs gates.
- **Données :** pgvector présent ? sinon, impact (extension à activer, migration). Inventaire des
  modèles Prisma existants ; où loger les tables chatbot (schéma/namespace, préfixe).
- **LLM :** repère la couche provider existante (`content-gen`), évalue sa réutilisabilité pour
  une **abstraction provider-agnostic** (Anthropic/OpenAI/Gemini/DeepSeek/Groq/OpenRouter).
- **Files & workers :** patron BullMQ existant → comment y brancher l'ingestion, les résumés, le
  rejeu d'actions, les emails d'escalade, les pushs GA4.
- **Admin :** anatomie de l'admin existant (`(admin)/[adminPrefix]`), RBAC, 2FA → comment insérer
  les modules console du chatbot (tenants, knowledge, conversations, leads, escalades, prompt,
  cache, éval, métriques, coûts, réglages) **sans dupliquer** un back-office.
- **Module patron :** dissèque `image-bank` (cloisonnement, workers, admin, JSON-LD, RGPD, tests,
  skill) comme **gabarit** pour le module chatbot.
- **CRM / Calendly / email / Sentry / Cloudflare / GA4-GTM :** état réel des intégrations.
- **Concurrence & streaming :** comment Next.js 16 sur Coolify gère le SSE/streaming ; contraintes
  (proxy, timeouts, edge vs node runtime) ; faisabilité « ≥ 200 conversations simultanées ».
- **Hébergement :** capacités réelles du VPS Hetzner (le CPX42 a déjà saturé au build SSG — cf.
  ADR 0026) → l'auto-hébergement d'embeddings/reranking open-source (addendum §2.2) est-il
  réaliste sur cette machine, ou faut-il une API managée ?

Sortie : un **rapport d'audit** factuel, chaque affirmation reliée à un fichier:ligne.

### Phase 3 — Décisions d'ingénierie (ADR)
Tranche, **argumenté par les faits de la Phase 2**, et rédige un ou plusieurs ADR :
- **Stack du service chatbot** : option A (tout Node/TS) / B (Laravel) / C (hybride). Recommande
  et justifie. Précise notamment : **service Next.js intégré (route handlers)** vs **service Node
  dédié (Hono/Fastify) dans le monorepo** vs **app séparée** ; et le degré de découplage réaliste
  vs le « découplage total » exigé par le v3.0 §5 (le cahier veut un repo séparé — confronte ça à
  la réalité monorepo + build GH Actions + Coolify).
- **Couche d'abstraction LLM** provider-agnostic : design, providers cibles, stratégie cheap-first
  + fallback (OpenRouter ?), prompt caching, cache sémantique.
- **Modèle de données** : Prisma (cohérent avec l'existant) vs SQL brut du cahier §13. Propose le
  **schéma Prisma adapté** (tenants, kb_documents, kb_document_versions, kb_chunks+vector,
  semantic_cache, prompt_versions, conversations, messages, escalations, action_idempotency),
  avec pgvector, index HNSW + GIN tsvector, et `tenant_id` partout. **FR-only** dans les contenus.
- **Embeddings & reranking** : auto-hébergé Hetzner vs API managée — tranché selon capacité VPS.
- **Streaming/concurrence** : mécanisme retenu (SSE via route handler Node runtime, token-bucket,
  backpressure, circuit breakers, health checks), et où vit l'état (DB + Redis, stateless).
- **Console admin** : insertion dans l'admin Next existant (pas de Filament).
- **Widget (frontend)** : **bulle flottante en bas à droite** de toutes les pages
  (ouvrable/fermable, badge/pastille de notification, accueil proactif contextualisé selon la page,
  chips de suggestions cliquables, indicateur de frappe, streaming token-par-token, affichage des
  sources citées, pouce ↑/↓, persistance de session côté serveur, reconnexion auto). **Plein écran
  sur mobile, bulle sur desktop.** Bundle autonome chargé en **async/différé**, servi par CDN
  Cloudflare, **hors budget First Load JS** des routes — démontre comment on respecte les Web
  Vitals (CLS = 0 : la bulle ne doit jamais provoquer de reflow). Précise **comment on l'injecte**
  dans le Next.js existant (composant monté tardivement vs `<script>` externe), et comment on évite
  tout impact SEO/perf. Traite les **états d'erreur** (perte connexion, IA indisponible/forte
  affluence, envoi échoué sans perte de saisie) et l'**accessibilité WCAG AA** (clavier, focus
  visible, ARIA, contrastes, `prefers-reduced-motion`).
- **Sécurité IA & robustesse du RAG** : défense **anti-injection de prompt / jailbreak**,
  cloisonnement strict du contexte (le bot ne répond que depuis les chunks récupérés), prévention
  d'**exfiltration** (system prompt, données d'autres tenants, secrets), modération des entrées,
  et **transparence EU AI Act** (mention « vous dialoguez avec une IA »). Garde-fous
  anti-hallucination des cahiers (seuil de confiance + citation des sources + escalade).
- **Évolutivité** : comment ajouter un nouvel outil, un nouveau provider/modèle, un nouveau tenant,
  une nouvelle source de knowledge, et préparer les **canaux futurs** (multilingue, WhatsApp/
  Messenger, voix, live handoff — phase ultérieure des cahiers) **sans réécrire** le cœur.
- Pour chaque décision : **alternatives écartées + pourquoi**.

### Phase 4 — Cahier des charges adapté (v4.0)
Produis une **version 4.0 du cahier**, recréée pour la stack réelle (Next.js/TS/Prisma/BullMQ/
Coolify), qui **remplace les hypothèses Laravel/Filament** par les choix de la Phase 3, tout en
conservant intacts les concepts indépendants de la stack. Garde la structure du v3.0 (Parties A→H)
pour comparabilité, et ajoute une **table de correspondance** « section v3.0 → décision/section
v4.0 » et la liste précise des sections **modifiées / recréées / supprimées / ajoutées**
(c'est le livrable du brief addendum §4.6 : « liste des sections du v3.0 à ajuster »).

### Phase 5 — Dossier de préparation à l'implémentation
- **Plan de cloisonnement des fichiers** : arborescence cible complète du module chatbot
  (`src/server/chatbot/**`, `src/app/[locale]/.../chatbot` widget+API, admin, workers, lib,
  tests…), calquée sur le patron `image-bank`. Liste **fichiers à créer** vs **fichiers existants
  à modifier** (avec le chemin exact et la raison) — **sans les écrire**.
- **Spécification des 5 tools** (schémas JSON, idempotence de `capturer_lead`, injection serveur du
  `tenant_id`).
- **Spécification du pipeline RAG** (ingestion + exécution temps réel) mappée sur BullMQ.
- **Plan multi-tenant, sécurité, RGPD, anti-abus** (Turnstile, rate limiting, CORS, DPA, purge),
  + **sécurité IA** (anti-injection/jailbreak, anti-exfiltration, isolation tenant) et
  **conformité EU AI Act** (transparence, traçabilité, documentation des garde-fous).
- **Plan d'observabilité & SLO** (Sentry, logs request-id, métriques de charge, GA4/GTM funnel,
  KPIs §27) avec les **budgets de latence mesurables** : 1ᵉʳ token < 1,5 s, réponse < 6 s,
  y compris sous charge — et comment on les vérifie.
- **Stratégie de tests** : réutiliser **Vitest** (unit/intégration : retrieval, tools, idempotence,
  régulation) + **Playwright** (E2E widget/streaming/escalade) + tests de charge (k6) + le jeu
  d'éval. Mappe sur les gates CI existants.
- **Déploiement sûr & réversibilité** : **feature flag** d'activation (par tenant/par page),
  **kill-switch**, rollout canary, plan de rollback knowledge + prompt — en s'appuyant sur
  `feature-flags.ts` / kill-switch existants.
- **Sauvegardes & reprise (DR)** : backup quotidien PostgreSQL (knowledge + conversations),
  procédure de restauration testée, rétention RGPD configurable + purge — cohérent avec l'existant.
- **Amorçage du knowledge (RAG)** : plan concret pour **seed** la base de connaissances depuis les
  actifs existants (`src/lib/knowledge`, KB facts, pages services canoniques) → chunking
  sémantique, contextualisation, embeddings, upsert pgvector, versioning. Ne pas verser le site
  entier ; structurer par intentions/documents auto-suffisants (cahier §8-9).
- **Jeu d'évaluation** : structure du dataset ~50 Q/R + comment le coupler au versioning/CI.
- **Roadmap par phases MVP 1→4** (reprends §29 du v3.0) **mappée sur le CI/CD réel** (branches,
  PR, GH Actions, Coolify, gates Lighthouse/size-limit) et estimée en effort.
- **Estimation de coût mensuel** aux prix de mai 2026 (utilise WebSearch, cite les sources et la
  date, applique le facteur 3-5× prod de l'addendum §2.4), pour démarrage + production 200 simult.
- **Registre des risques** (techniques, coût, RGPD, perf/Web Vitals, build/stub, concurrence) avec
  mitigation.
- **Checklist « definition of done »** dérivée du §30 v3.0, adaptée.
- **STOP & ASK — décisions à trancher par Will** : liste numérotée des questions ouvertes
  (ex. découplage repo séparé ou monorepo, cal.com vs Calendly existant, embeddings auto-héb. vs
  API, palier LLM payant, périmètre MVP 1, où vit le CRM…). Ne devine pas ces réponses : pose-les.

### Phase 6 — Livrables (fichiers à écrire)
Écris les `.md` ci-dessous dans
`C:\Users\willi\Documents\Projets\Axion-IA\_AUDIT\CHATBOT-PREP-2026-05-29\` :
1. `00-SYNTHESE-ET-DECISIONS.md` — résumé exécutif + recommandation de stack tranchée + top
   décisions + questions STOP & ASK (le « verdict » à lire en premier).
2. `01-MATRICE-EXIGENCES.md` — Phase 1.
3. `02-AUDIT-DEPOT-REEL.md` — Phase 2 (avec références fichier:ligne).
4. `03-ADR-DECISIONS-INGENIERIE.md` — Phase 3.
5. `04-CAHIER-CHATBOT-v4.0.md` — Phase 4 (cahier recréé, stack réelle).
6. `05-PLAN-IMPLEMENTATION-ET-CLOISONNEMENT.md` — Phase 5 (arborescence, fichiers à créer/modifier,
   roadmap MVP mappée CI/CD, eval, observabilité).
7. `06-ESTIMATION-COUT.md` — Phase 5 (coûts, prix sourcés + datés).
8. `07-RISQUES-ET-QUESTIONS-WILL.md` — registre des risques + STOP & ASK + DoD.
9. `08-SECURITE-AIACT-EVOLUTIVITE.md` — sécurité IA (anti-injection/jailbreak/exfiltration),
   conformité EU AI Act & transparence, accessibilité WCAG AA du widget, stratégie de tests,
   déploiement réversible (feature flag/kill-switch/canary), backup/DR, et **plan d'évolutivité**
   (ajout tool/provider/tenant/source, canaux futurs multilingue/WhatsApp/voix/handoff).

Inclus au moins **un diagramme d'architecture** (ASCII ou Mermaid) du flux complet
visiteur → widget bulle → service → RAG/tools → réponse streamée, dans `04` ou `05`.

Ne modifie **aucun** autre fichier du dépôt. Ne touche pas aux deux cahiers sources (tu en
produis une **v4.0** dérivée, tu ne les écrases pas).
</methodologie>

<barre_qualite>
- **Fondé sur les faits :** chaque affirmation sur le code = référence `fichier:ligne`. Pas de
  supposition présentée comme un fait. Si tu n'as pas vérifié, écris « à vérifier » explicitement.
- **Décisions tranchées :** l'addendum exige une recommandation de stack **tranchée et argumentée**
  (§4.6), pas un comparatif tiède. Choisis, justifie, assume — tout en isolant clairement ce qui
  relève d'une décision business à remonter à Will.
- **Respect des contrats du dépôt :** FR-only (zéro EN), budgets Web Vitals, contrat `stub.invalid`,
  pipeline GH Actions/Coolify, cloisonnement à la `image-bank`, admin existant réutilisé.
- **Coût réaliste :** « gratuit » ≠ « 200 simultanés » (addendum §2.1). Prix datés et sourcés,
  facteur prod 3-5× appliqué.
- **Prêt à exécuter :** un développeur (ou la prochaine conversation Claude Code) doit pouvoir
  ouvrir le dossier et démarrer le MVP 1 sans avoir à re-décider l'architecture.
- **Exhaustif mais lisible :** structure claire, tables, numérotation, pas de remplissage.
</barre_qualite>

<rappel_final>
Tu **prépares**, tu **n'implémentes pas**. Le succès = un dossier de préparation complet,
factuel, tranché et actionnable dans `_AUDIT/CHATBOT-PREP-2026-05-29/`, qui permettra de lancer
l'implémentation proprement dans une conversation suivante. Termine par un court récapitulatif des
fichiers produits et de la **toute première action d'implémentation** recommandée (sans la faire).
</rappel_final>
```
```

---

### Notes pour Will (hors prompt — ne pas coller)

- Le bloc à copier va de `<role>` jusqu'au dernier ` ``` ` après `</rappel_final>`. Tu peux aussi
  simplement dire à la nouvelle conversation : *« Lis et exécute
  `_AUDIT/CHATBOT-PREP-2026-05-29/PROMPT-PREPARATION-CHATBOT-AXION-IA.md` »* — le fichier est dans
  le dépôt, donc Claude Code le trouvera directement.
- Le prompt est volontairement **« préparation only »** : il interdit toute écriture de code et ne
  produit que 8 fichiers `.md` d'audit/décision/plan. L'implémentation réelle sera une 2ᵉ conv.
- Il intègre tout le contexte Axion-IA : vraie stack (Next 16 / Prisma / BullMQ / Coolify), règle
  FR-only, budgets Web Vitals, contrat `stub.invalid`, patron `image-bank`, admin existant.
