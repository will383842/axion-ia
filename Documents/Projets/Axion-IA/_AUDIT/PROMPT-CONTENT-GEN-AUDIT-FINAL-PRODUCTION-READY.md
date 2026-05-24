# 🔒 PROMPT AUDIT FINAL PRODUCTION-READY — Content Generator Axion-IA

> À coller verbatim dans une nouvelle conversation Claude Code après que tous
> les sprints V1+V2 (et éventuels Pass B fixes) soient committés sur `main`.
>
> **Mode strict** : AUDIT-ONLY total. Zéro édition fichier. Zéro commit.
> Zéro push. Production un seul artefact final : le rapport verdict.
>
> **Objectif** : croiser SPEC ↔ CODE ↔ FRONTEND ↔ BACKEND ↔ DATA ↔ UX pour
> identifier TOUT oubli, TOUTE rupture wire, TOUTE incohérence, TOUTE casse,
> TOUT scenario utilisateur cassé, AVANT de déployer prod.

---

```
Skill : axionia-content-generator (mode 🔒 AUDIT FINAL PRODUCTION-READY V2)

Tu es l'auditeur production-readiness indépendant du content generator
Axion-IA. Will a livré V1 (Sprints 1-6) + Pass B fixes + V2 (Sprints 7-12)
dans plusieurs sessions parallèles. Tu dois croiser ce qui était PRÉVU dans
le master prompt v1.7+ avec ce qui est RÉELLEMENT IMPLÉMENTÉ dans le code
pour identifier tout oubli, toute rupture, toute incohérence.

⛔ MODE AUDIT-ONLY STRICT — RÈGLES ABSOLUES :
- Tu N'ÉCRIS aucun code (Edit/Write INTERDITS sur le code source)
- Tu NE COMMITES rien
- Tu NE PUSHES rien
- Tu NE FAIS aucun appel API IA externe (OpenAI/Anthropic/Voyage/Perplexity)
- Tu N'EXÉCUTES aucun migrate / seed / restart de service
- Tu LIS le code statiquement + lances UNIQUEMENT les guards CI read-only
- Si bug détecté → NOTER dans rapport, NE PAS fix
- Si question Will → STOP & ASK clair, attendre réponse
- Si paradoxe (« petit fix tant qu'on y est ») → REFUSER, noter dans rapport
- Seul livrable autorisé : 1 fichier rapport final unique

╔═══════════════════════════════════════════════════════════════════════╗
║                     LECTURE OBLIGATOIRE (8 fichiers)                  ║
╚═══════════════════════════════════════════════════════════════════════╝

Lis dans l'ordre, intégralement, AVANT de commencer le moindre audit.
Tu DOIS pouvoir citer les sections § du master prompt à chaque finding.

1. .claude/skills/axionia-content-generator/SKILL.md
2. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md (5180+ lignes v1.7+)
   → Section par section :
     • § 0 contrat d'exécution
     • § 1 contexte + doctrine intouchable
     • § 2.1 reality-check briques pré-existantes
     • § 3 scope V1/V2/V3
     • § 4 architecture cible + § 4.1bis cloisonnement
     • § 5 modèle Prisma (16 models + 16 enums minimum)
     • § 5.1bis inventaire complet tables/enums
     • § 6 specs par type contenu (9 ContentType)
     • § 6.1 landings villes 4 templates dédiés
     • § 6.1.A parcours client bout-en-bout
     • § 6.1.B keywords services × villes
     • § 6.1.C pipeline 1 ville = 4 jobs landing_ville //
     • § 6.2-6.6 autres types
     • § 7 providers IA + routing + circuit breaker
     • § 8 système d'images Unsplash
     • § 9 SEO/AEO/GEO + § 9.7 checklist 60+ items
     • § 9bis indexation perfection 2026 (8 sous-sections)
     • § 9.8 auteur Manon doctrine v2.1
     • § 9.9 templates HTML gold standard par type
     • § 9.10 mobile-first + Web Vitals 2026
     • § 9.11 extrême rapidité génération
     • § 10 anti-plagiat 3 couches + score qualité
     • § 11 KB consumer + alimentation + mapping § 11.0
     • § 12 console admin 30 réglages + § 12.1 arborescence 12 sections
     • § 12.1bis AuthorProfile + § 12.1ter onboarding + § 12.1quater
       cockpit géo + § 12.1quinquies job timeline + § 12.3bis 16 alertes
     • § 13 queue + scheduling + monitoring
     • § 14 publication + validation workflow
     • § 15 cockpit géographique
     • § 16 méthodologie 8 agents parallèles
     • § 17 sprint breakdown (S1→S6 V1)
     • § 18 livrables exhaustifs (4 sous-sections)
     • § 19 scoring /200 + gates par sprint
     • § 20 STOP & ASK (13 questions)
     • § 21 contraintes intouchables
     • § 22 checklist EXIT V1
     • § 23 phrase d'invocation reprise
     • § 24 mode autopilote
     • § 25 campagnes de couverture (5 sous-sections)
     • § 26 intention de recherche (4 sous-sections)
     • § 27 boucle qualité (4 sous-sections)
     • § 28 pipeline RSS (3 sous-sections)
     • § 29 Q/R post-process (6 sous-sections)
     • Annexes A-E

3. _AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md (data model acté Will 2026-05-08)
4. _AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md (journal Sprints livrés)
5. _AUDIT/CONTENT-GEN-V1-AUDIT-COMPLET-2026-05-14.md (audit V1 post-correctifs)
6. docs/adr/0021-content-gen-v1-skeleton-vs-deep-impl.md (ADR squelette)
7. docs/content-gen/EXIT-V1-CHECKLIST.md (checklist 80+ items)
8. axionia/AGENTS.md + axionia/CLAUDE.md (budgets Web Vitals + admin FR)

Tu DOIS produire à la fin un tableau « ce qui était prévu § X.Y » ↔ « ce
qui est codé fichier:ligne » ↔ « écart ».

╔═══════════════════════════════════════════════════════════════════════╗
║                  PHASE 0 — SETUP AUDIT (read-only)                    ║
╚═══════════════════════════════════════════════════════════════════════╝

```bash
git status                                # working tree clean ou WIP ?
git log --oneline -30                     # historique sprints
git tag -l "v*-content-gen" | sort -V     # tous tags content-gen
git rev-parse HEAD                        # commit SHA1
git ls-remote --tags origin | grep content-gen
```

Note : branche / commit / tag le plus récent / sprints livrés.

╔═══════════════════════════════════════════════════════════════════════╗
║   PHASE 1 — SPEC COVERAGE master prompt ↔ code (le plus important)   ║
╚═══════════════════════════════════════════════════════════════════════╝

🎯 OBJECTIF DE CETTE PHASE : pour CHAQUE § du master prompt qui décrit
une feature, vérifier si elle est CODÉE / PARTIELLE / MANQUANTE / SKELETON.

────────────────────────────────────────────────────────────────────────
1.1 — Prisma schema (§ 5 + § 5.1bis)
────────────────────────────────────────────────────────────────────────

Liste exhaustive des 16+ models prévus :
- ContentGenJob, ContentGenConfig, ContentTemplate, AuthorProfile,
  BannedPhrase, CoverageDistributionProfile, AudienceMixProfile,
  CoverageCampaign, ProviderConfig, GenerationLog, ReviewQueue,
  WebVitalSample, CostLedger, ContentMetric, ExternalReference,
  ContentCitation

V2 potentiels (selon livraison) :
- RssSource, RssItem, SimilarityPair, ContentGenBatch, KeywordTracking,
  ContentEmbedding (pgvector)

Pour CHAQUE model :
- [ ] Présent dans `prisma/schema.prisma` ?
- [ ] Tous les champs spec présents ? (cf. § 5.1 listing détaillé)
- [ ] FK vers Article / FAQ / KnowledgeEntry correctes ?
- [ ] Indexes performants (@@index sur status+createdAt, contentType+status, etc.) ?
- [ ] @@map ↔ snake_case respecté ?
- [ ] Migration correspondante dans `prisma/migrations/` ?

Liste exhaustive des 16+ enums prévus :
- ContentType (9 valeurs), ContentGenJobStatus (12), LogLevel (4),
  IndexationTier (3), ExpansionMode (8), ProviderKey (5), ProviderRole (5),
  ReviewStatus (5), CoverageStatus (7), CoverageScope (4), OrganisationType
  (12), SearchIntent (5), TrustTier (5), WebVitalMetric (6), WebVitalRating
  (3), CompanySize (4 ou 5)

Pour CHAQUE enum :
- [ ] Présent dans schema ?
- [ ] Toutes les valeurs spec présentes ?
- [ ] Reflété dans constantes UI (STATUSES, CONTENT_TYPES, SCOPES, etc.) ?

→ SORTIE : tableau models × champs présents/manquants × ÉCART.

────────────────────────────────────────────────────────────────────────
1.2 — 9 ContentType + leurs generators (§ 6)
────────────────────────────────────────────────────────────────────────

Pour CHAQUE des 9 types (landing_ville, blog_article, blog_from_title,
blog_from_keywords, blog_from_rss, comparison, guide_pilier, qa_derived,
faq_standalone) :

- [ ] Generator présent dans `src/server/content-gen/generators/<type>.ts` ?
- [ ] System prompt distinct (PAS un délégué landing-ville sans personnalisation) ?
- [ ] User prompt template avec variables structurées ?
- [ ] Output schema Zod typé ?
- [ ] Mapping vers KbType dans `kb-feeder.ts` ?
- [ ] Sub-prompt megapack référencé (`.claude/skills/.../prompts/<type>.md`) ?
- [ ] Tests unitaires `__tests__/<type>.spec.ts` ?
- [ ] Template par défaut seedé dans `prisma/seeds/content-gen/templates.ts` ?
- [ ] Sanitize HTML appliqué ? Quality checks appelés ?
- [ ] Cas particulier landing_ville : 4 templates dédiés ville (§ 6.1) ?
- [ ] Cas particulier guide_pilier : pipeline 2 étapes outline STOP ?
- [ ] Cas particulier qa_derived : post-process auto via worker
      content-qa-extract-worker ?
- [ ] Cas particulier blog_from_rss : NewsArticle JSON-LD + citation source ?
- [ ] Cas particulier comparison : table compare matrix + verdict ?

→ SORTIE : matrice 9 types × 14 critères × ✅/⚠️/❌.

────────────────────────────────────────────────────────────────────────
1.3 — 5 Providers + router (§ 7)
────────────────────────────────────────────────────────────────────────

Pour OpenAI / Anthropic / Perplexity / Unsplash / Voyage :
- [ ] Implémentation réelle (pas stub) dans `src/server/content-gen/providers/` ?
- [ ] Streaming (OpenAI), prompt caching (Anthropic), citations (Perplexity),
      free-only filter (Unsplash), embeddings live (Voyage) ?
- [ ] Cost tracking via CostLedger ?
- [ ] Toggle enabled depuis admin ?
- [ ] Modèle par défaut éditable ?
- [ ] Cap mensuel respecté + auto-kill si dépassé ?
- [ ] Rate-limit (BullMQ limiter) configuré ?
- [ ] Fallback chain (OpenAI → Anthropic) ?
- [ ] Tests `__tests__/<provider>.spec.ts` ?
- [ ] Circuit breaker (5 fails / 30s → open 60s) wired dans router ?
- [ ] Multi-modèles compétition V2 (Sprint 11) si livré ?

→ SORTIE : matrice 5 providers × 11 critères × ✅/⚠️/❌.

────────────────────────────────────────────────────────────────────────
1.4 — Workers BullMQ (§ 13 + § 25.3 + § 27 + § 28 + § 29)
────────────────────────────────────────────────────────────────────────

Liste exhaustive des workers prévus master prompt :

| Worker | Spec § | Cron | Présent ? | Fonctionnel ? |
|--------|--------|------|-----------|---------------|
| content-gen-worker | § 13.1 | event | | |
| content-orchestrator-worker | § 25.3 | 15min | | |
| content-publish-worker | § 14.1 | event | | |
| content-quality-improver-worker | § 27.2 | event | | |
| content-rss-fetch-worker | § 28 | hourly | | |
| content-similarity-monitor-worker | § 25.5 | daily 04:30 | | |
| content-news-lifecycle-worker | § 28.1 | daily 05:00 | | |
| content-indexnow-worker | § 9bis.1 | event | | |
| content-google-indexing-worker | § 9bis.1 | event | | |
| content-qa-extract-worker | § 29 | event | | |
| tier-lifecycle-worker (V2) | § 13.2 | mensuel 15 06:00 | | |
| qa-promotion-worker (V2) | § 13.2 | hebdo mer 03:00 | | |
| aeo-tester-worker (V2) | § 13.2 | hebdo lun 04:00 | | |
| link-checker-worker (V2) | § 13.2 | daily 02:00 | | |
| internal-linking-worker (V2) | § 13.2 | mensuel 01 05:00 | | |
| search-console-worker (V2) | § 13.2 | daily 04:00 | | |
| sitemap-worker (V2) | § 13.2 | hebdo dim 23:00 | | |

Pour CHAQUE worker :
- [ ] Fichier présent `src/server/queue/workers/<name>.ts` ?
- [ ] startXxxWorker() + stopXxxWorker() exportés ?
- [ ] Wired dans `src/server/queue/worker.ts` main() workers[] ?
- [ ] Queue correspondante exportée dans `queues.ts` ?
- [ ] Si cron : repeat configuré dans `bootRepeatableJobs()` ?
- [ ] Si event : au moins un caller identifiable (Server Action ou autre worker) ?
- [ ] REDIS_URL check + fallback sain ?
- [ ] Kill-switch check (au minimum content-gen + orchestrator) ?
- [ ] Logs GenerationLog ?
- [ ] Telegram alert sur erreur critique ?

→ SORTIE : tableau worker × 10 critères × ✅/⚠️/❌.

────────────────────────────────────────────────────────────────────────
1.5 — Console admin 12+ sections (§ 12.1)
────────────────────────────────────────────────────────────────────────

Arborescence prévue § 12.1 (toutes les pages doivent exister) :

```
/[adminPrefix]/content-gen/
├── page.tsx ✅                          ← Dashboard
├── settings/
│   ├── page.tsx                         ← Index 11 sous-pages
│   ├── providers/page.tsx
│   ├── batches/page.tsx
│   ├── policies/page.tsx
│   ├── banned-phrases/page.tsx
│   ├── llms-txt/page.tsx
│   ├── coverage-distribution/page.tsx
│   ├── audience-mix/page.tsx
│   ├── search-intent-distribution/page.tsx
│   ├── quality-loop/page.tsx
│   ├── qa-policies/page.tsx
│   └── kill-switch/page.tsx
├── author/manon/page.tsx
├── templates/{page.tsx, new/page.tsx, [id]/page.tsx}
├── landing-variants/{page.tsx, [variant]/page.tsx}
├── jobs/{page.tsx, [id]/page.tsx}
├── queue/page.tsx
├── review-queue/{page.tsx, [id]/page.tsx}
├── geo/{page.tsx, history/page.tsx, batches/{page.tsx, new/page.tsx,
│       [id]/page.tsx}, [villeSlug]/generate/page.tsx}
├── kb-readonly/{page.tsx, [id]/page.tsx}
├── rss/{page.tsx, new/page.tsx, [id]/page.tsx}
├── costs/page.tsx
├── publications/page.tsx
├── publications-status/page.tsx
├── coverage/{page.tsx, new/page.tsx, [id]/page.tsx}
├── similarity-monitor/page.tsx
├── orchestrator/page.tsx
└── onboarding/page.tsx
```

V2 additions § 3.2 (si Sprints 7-12 livrés) :
- /content-gen/keyword-tracking/page.tsx (Sprint 12 KeywordTracker)
- /content-gen/quality/page.tsx (Sprint 12 QualityDashboard avancé)
- /content-gen/web-vitals/page.tsx (V2 dashboard Web Vitals)
- /content-gen/projection-cout/page.tsx (V2 projection coût)
- /content-gen/aeo-tests/page.tsx (V2 AEO 50 prompts × 5 LLMs)
- /content-gen/multi-models/page.tsx (V2 compétition multi-modèles)

Pour CHAQUE page :
- [ ] Fichier `page.tsx` présent ?
- [ ] `export const dynamic = "force-dynamic"` ?
- [ ] Auth check `redirect("/login")` si !session ?
- [ ] Lit la bonne Server Action ou Prisma direct ?
- [ ] Forms avec name= cohérent avec Server Action params ?
- [ ] Server Actions inline (`"use server"`) bien câblées ?
- [ ] Liens internes pointent vers routes existantes ?
- [ ] Loading.tsx ou not-found.tsx présent si pertinent ?

→ SORTIE : matrice page × 8 critères × ✅/⚠️/❌.

────────────────────────────────────────────────────────────────────────
1.6 — Routes publiques content-gen
────────────────────────────────────────────────────────────────────────

Routes publiques prévues qui CONSOMMENT content-gen :
- /fr/blog/[slug] (lit Article DB-driven post-Sprint 8 V2)
- /fr/actualites/[slug] (lit Article isNews=true)
- /fr/faq/[slug] (lit FAQ rows Q/R post-process)
- /fr/equipe/[slug] (lit AuthorProfile — Pass B fix V1.0.1)
- /llms.txt (lit ContentGenConfig.llms_txt)
- /sitemap.xml + sitemap-index.xml + sub-sitemaps (Article publishedAt
  + indexationTier tier-1)
- /api/rum (collect WebVitalSample)
- /api/internal/kb/ingest (HMAC ingest)
- /api/content-gen/jobs/[id]/stream (SSE V1.5+)
- /api/content-gen/geo-events (SSE V1.5+)

Pour CHAQUE route :
- [ ] Fichier présent ?
- [ ] generateMetadata() émet titre + description + canonical ?
- [ ] JSON-LD injecté approprié (Article/NewsArticle/QAPage/Person) ?
- [ ] Robots/noindex respecte IndexationTier ?
- [ ] ISR Next 16 ou force-dynamic selon V2 ?
- [ ] hreflang FR-FR + x-default ?

→ SORTIE : matrice route × 6 critères.

────────────────────────────────────────────────────────────────────────
1.7 — 30 réglages éditables admin (§ 12.5)
────────────────────────────────────────────────────────────────────────

Liste exhaustive § 12.5 :
1. Toggle provider ON/OFF
2. Cost cap mensuel par provider
3. Modèle text default
4. Modèle text override per-job
5. Batch size jour
6. Workers concurrency
7. Skip villes copy existante
8. Auto-publish RSS si score ≥ X
9. Plagiat seuils Jaccard
10. Retention tier-3 jours
11. Phrases interdites (table BannedPhrase)
12. llms.txt content
13. Ordre custom villes
14. Variantes landing actives
15. Variant override par ville
16. Profil Manon (table AuthorProfile)
17. Sources RSS (table RssSource ou ContentGenConfig V1)
18. System prompt par template
19. Perplexity toggle per-template
20. Kill switch global
21. Distribution couverture (5 types %)
22. Mix audiences (taille × organisation %)
23. Distribution intention recherche %
24. Création/suivi campagnes de couverture
25. Boucle qualité (toggle + seuils)
26. Toggle Q/R post-process auto
27. Surveillance similarité (cron + table)
28. Dashboard kanban publication
29. (V2) KeywordTracker config
30. (V2) QualityDashboard seuils

Pour CHAQUE réglage :
- [ ] Page admin existe pour éditer ?
- [ ] Server Action update existe et passe validation Zod/runtime ?
- [ ] Stockage cohérent (ContentGenConfig key/value OR table dédiée) ?
- [ ] Lecture par les workers / generators effective (pas hardcodé) ?

→ SORTIE : tableau 30 réglages × 4 critères.

────────────────────────────────────────────────────────────────────────
1.8 — 10 factories JSON-LD (§ 9)
────────────────────────────────────────────────────────────────────────

Vérifier `src/lib/seo-content-gen-factories.ts` :
- buildPersonManonJsonLd
- buildArticleJsonLd
- buildBlogPostingJsonLd
- buildTechArticleJsonLd
- buildNewsArticleJsonLd
- buildQAPageJsonLd
- buildHowToJsonLd
- buildSpeakableJsonLd
- buildCitationJsonLd
- buildIndexNowPayload

Pour CHAQUE factory :
- [ ] Exportée + signature TS correcte ?
- [ ] Tests unitaires couvrant @context + @type + champs requis Schema.org ?
- [ ] Au moins un usage downstream identifié (page publique ou worker) ?
- [ ] Guards (ex. buildPersonManonJsonLd throw si slug !== "manon") ?

→ SORTIE : tableau 10 factories × 4 critères.

────────────────────────────────────────────────────────────────────────
1.9 — 6 modules quality (§ 10)
────────────────────────────────────────────────────────────────────────

Vérifier `src/server/content-gen/quality/` :
- plagiarism (shingling 5-gram Jaccard)
- doctrine-check (anti-SIREN + naming + banned + ratio AxionIA-centric)
- readability (Flesch-Kincaid FR)
- seo-score (déterministe + checklist § 10.2)
- dedup-guard (4 couches v1.7 pre-IA)
- search-intent-validator (cohérence intent ↔ structure)

V2 additions :
- embeddings-dedup (cosine pgvector < 0.85, Sprint 11)
- fact-check (Perplexity validation claims, Sprint 12)

Pour CHAQUE module :
- [ ] Fichier présent ?
- [ ] Appelé par tous les generators relevants ?
- [ ] Tests unitaires couvrent cas passants + bloquants ?
- [ ] Seuils configurables admin (pas hardcodé) ?

→ SORTIE : tableau 8 modules × 4 critères.

────────────────────────────────────────────────────────────────────────
1.10 — Campagnes de couverture (§ 25)
────────────────────────────────────────────────────────────────────────

- [ ] Table CoverageCampaign présente avec tous les champs § 25.2 ?
- [ ] 3 pipelines distincts (1 landings villes, 2 RSS, 3 campagnes) ?
- [ ] Sample weighted distribution implémenté correctement ?
- [ ] anti-doublon 4 couches durcies (§ 25.5) ?
- [ ] Multi-campagnes parallèles supportées ?
- [ ] Pause/Resume/Cancel workflow fonctionnel ?
- [ ] Burndown chart données disponibles côté UI ?

────────────────────────────────────────────────────────────────────────
1.11 — Intention de recherche (§ 26)
────────────────────────────────────────────────────────────────────────

- [ ] 5 intentions enum SearchIntent ?
- [ ] Distribution % éditable admin ?
- [ ] Influence sur artefacts (CTAs, FAQ structure, etc.) § 26.2 ?
- [ ] Validator post-gen vérifie cohérence intent ↔ content ?

────────────────────────────────────────────────────────────────────────
1.12 — Boucle qualité (§ 27)
────────────────────────────────────────────────────────────────────────

- [ ] Worker content-quality-improver présent ?
- [ ] Settings admin (toggle + seuils + max passages + cost cap) ?
- [ ] V1 = increment counter / V2 = LLM re-prompt sections ciblées ?
- [ ] Stats agrégées admin /quality-loop ?

────────────────────────────────────────────────────────────────────────
1.13 — Pipeline RSS (§ 28)
────────────────────────────────────────────────────────────────────────

- [ ] V1 storage ContentGenConfig.rss_sources OR V2 tables RssSource +
      RssItem dédiées ?
- [ ] Worker rss-fetch cron hourly ?
- [ ] Parser XML (regex V1 ou fast-xml-parser V2) ?
- [ ] Dedup hash(url+title) ?
- [ ] Enqueue blog_from_rss ?
- [ ] NewsArticle JSON-LD wired post-publish ?
- [ ] News-lifecycle archive > 90j + demote < CTR (V2) ?

────────────────────────────────────────────────────────────────────────
1.14 — Q/R post-process (§ 29)
────────────────────────────────────────────────────────────────────────

- [ ] Worker content-qa-extract présent ?
- [ ] Trigger automatique post-publish d'un FAQ generator ?
- [ ] Extension table FAQ avec Q/R structurées ?
- [ ] Route Next 16 `/fr/faq/[slug]` ?
- [ ] Sitemap-faq.xml dédié ?
- [ ] Promotion tier-1 si CTR > seuil (V2) ?

╔═══════════════════════════════════════════════════════════════════════╗
║      PHASE 2 — FRONTEND ↔ BACKEND wire audit exhaustif (2 h)         ║
╚═══════════════════════════════════════════════════════════════════════╝

🎯 OBJECTIF : pour CHAQUE élément UI interactif, vérifier qu'il déclenche
bien la bonne Server Action / API / mutation, avec les bons paramètres,
et que le résultat est correctement reflété côté UI (revalidatePath OK,
redirect OK, toast OK).

────────────────────────────────────────────────────────────────────────
2.1 — Inventaire EXHAUSTIF forms content-gen
────────────────────────────────────────────────────────────────────────

Pour CHAQUE `<form action={xxx}>` ou `<form onSubmit={xxx}>` dans
`src/app/[locale]/(admin)/[adminPrefix]/content-gen/**/*.tsx` :

| Page | Form action | Server Action ciblée | name= inputs | Cohérence ? |
|------|------------|---------------------|--------------|-------------|

Vérifier :
- [ ] Action existe dans le module Server Action référencé
- [ ] `name=` de chaque input correspond aux clés lues par
      `formData.get(...)` côté action
- [ ] Types coercés correctement (Number(...) pour numbers, === "on"
      pour booleans, JSON.parse pour JSON)
- [ ] Validation Zod côté action couvre tous les inputs
- [ ] revalidatePath() cible une route existante post-mutation
- [ ] redirect() cible une route existante
- [ ] Cas erreur géré (try/catch ou error.tsx)
- [ ] Loading state visible (button disabled ou skeleton)

────────────────────────────────────────────────────────────────────────
2.2 — Inventaire EXHAUSTIF buttons + Server Actions inline
────────────────────────────────────────────────────────────────────────

Pour CHAQUE `<form action={async () => { "use server"; ... }}>` :
- [ ] Server Action inline correctement typée
- [ ] Appel à une fonction du module ciblée correct
- [ ] Pas de fuite client (use server dans Server Component OK)
- [ ] Confirmation modal pour actions destructives (delete, kill switch,
      cancel campaign) ?

────────────────────────────────────────────────────────────────────────
2.3 — Inventaire EXHAUSTIF Server Actions ↔ pages caller
────────────────────────────────────────────────────────────────────────

Pour CHAQUE export dans `src/server/actions/content-gen/*.ts` :
- [ ] Au moins un caller identifiable dans `src/app/.../content-gen/`
      ou autre Server Action / worker
- [ ] Si aucun caller → dead code (à noter)
- [ ] requireAdmin() en première ligne (sauf utilities lecture par worker
      documentées)
- [ ] Validation runtime des inputs (Zod ou checks manuels)
- [ ] revalidatePath ciblé correct
- [ ] Throw clair en cas d'erreur (message FR pour Will)

────────────────────────────────────────────────────────────────────────
2.4 — Inventaire EXHAUSTIF des hrefs (routes admin + publiques)
────────────────────────────────────────────────────────────────────────

Pour CHAQUE `<a href=...>` / `<Link href=...>` / `redirect(...)` dans
`src/app/.../content-gen/` :
- [ ] La route cible existe sur le filesystem ?
- [ ] Le pattern `${base}/...` génère bien une URL valide ?
- [ ] Pas de typo (ex. `/coverage` au lieu de `/coverages`)
- [ ] Liens contextuels cohérents (ex. depuis /jobs/[id], lien retour
      pointe bien vers /jobs)
- [ ] Breadcrumbs cohérents si présents

Méthode :
```bash
grep -rE 'href=["{`]/fr/\$' src/app/[locale]/(admin)/[adminPrefix]/content-gen/
grep -rE 'redirect\(["{`]' src/app/[locale]/(admin)/[adminPrefix]/content-gen/
```

→ Lister TOUS les hrefs + verify chaque cible existe.

────────────────────────────────────────────────────────────────────────
2.5 — Nav admin layout : entrée content-gen
────────────────────────────────────────────────────────────────────────

Vérifier `src/app/[locale]/(admin)/[adminPrefix]/layout.tsx` :
- [ ] Entrée "Générateur contenus" présente dans buildNav()
- [ ] Icône cohérente (🧠 ou autre)
- [ ] Groupe "content"
- [ ] Lien actif quand sur une route content-gen

Et `AdminCommandPalette.tsx` :
- [ ] Items content-gen présents pour Cmd+K rapide ?

────────────────────────────────────────────────────────────────────────
2.6 — Toasts / feedback utilisateur post-action
────────────────────────────────────────────────────────────────────────

Pour CHAQUE Server Action mutation :
- [ ] Feedback visuel post-success (toast sonner ou autre) ?
- [ ] Message erreur clair si throw ?
- [ ] Loading indicator pendant l'action (button disabled, spinner) ?
- [ ] Confirmation modale pour actions destructives (Radix Dialog) ?

╔═══════════════════════════════════════════════════════════════════════╗
║      PHASE 3 — ROUTES INVENTORY + Server Actions completeness         ║
╚═══════════════════════════════════════════════════════════════════════╝

────────────────────────────────────────────────────────────────────────
3.1 — Liste TOUTES les pages livrées
────────────────────────────────────────────────────────────────────────

```bash
find src/app/[locale]/(admin)/[adminPrefix]/content-gen -name "page.tsx" | sort
find src/app/[locale]/equipe -name "page.tsx" | sort
find src/app/[locale]/blog -name "page.tsx" | sort
find src/app/[locale]/actualites -name "page.tsx" 2>/dev/null | sort
find src/app/[locale]/faq -name "page.tsx" | sort
find src/app/api -path "*content-gen*" -name "route.ts" | sort
```

Tableau :
| Route | Fichier | Type (page/route) | Generates static ? | Auth required ? |

Vérifier qu'on a bien TOUTES les routes prévues + pas de route orpheline
non documentée.

────────────────────────────────────────────────────────────────────────
3.2 — Server Actions completeness
────────────────────────────────────────────────────────────────────────

```bash
ls src/server/actions/content-gen/
```

Modules attendus minimum :
- _auth.ts, _settings.ts
- author.ts, banned-phrases.ts, coverage.ts, dashboard.ts, distribution.ts,
  geo.ts, jobs.ts, kill-switch.ts, policies.ts, providers.ts, review.ts,
  rss.ts, templates.ts

V2 potentiels : keyword-tracking.ts, quality-dashboard.ts, multi-models.ts

Pour CHAQUE module :
- [ ] Fichier présent
- [ ] Toutes les fonctions CRUD attendues exportées
- [ ] Si table Prisma dédiée → CRUD complet (list, get, create, update,
      delete)
- [ ] Si config ContentGenConfig → get + set

────────────────────────────────────────────────────────────────────────
3.3 — API routes content-gen
────────────────────────────────────────────────────────────────────────

Routes API attendues :
- /api/internal/kb/ingest (HMAC HMAC-SHA256)
- /api/rum (collect WebVitalSample)
- /api/content-gen/jobs/[id]/stream (SSE V1.5+)
- /api/content-gen/geo-events (SSE V1.5+)
- /api/content-gen/health (V2 health check pour Coolify)

╔═══════════════════════════════════════════════════════════════════════╗
║          PHASE 4 — DATA COMPLETENESS + edge cases (1 h)               ║
╚═══════════════════════════════════════════════════════════════════════╝

────────────────────────────────────────────────────────────────────────
4.1 — Seeds idempotents
────────────────────────────────────────────────────────────────────────

```bash
ls prisma/seeds/content-gen/
```

Seeds attendus minimum (§ 5.3) :
- ProviderConfig (5 rows : openai/anthropic/perplexity/unsplash/voyage)
- AuthorProfile (1 row : manon)
- CoverageDistributionProfile (≥ 3 templates : équilibré, industriel,
  tertiaire)
- AudienceMixProfile (≥ 4 templates : mixte, industriel-régional,
  tertiaire-urbain, public-parapublic)
- BannedPhrase (≥ 10 phrases interdites doctrine)
- ContentGenConfig defaults (kill_switch=false, batches, policies, etc.)
- ContentTemplate stubs (≥ 1 par contentType = 9 templates min)

Pour CHAQUE seed :
- [ ] Fichier présent
- [ ] Idempotent (upsert ou skip si existe)
- [ ] Lancé par `prisma/seeds/content-gen/index.ts` orchestrator

────────────────────────────────────────────────────────────────────────
4.2 — Champs Prisma orphelins (dead schema)
────────────────────────────────────────────────────────────────────────

Pour CHAQUE champ optionnel dans models content-gen :
- [ ] Au moins une lecture identifiable (page admin ou worker) ?
- [ ] Au moins une écriture identifiable (Server Action ou worker) ?
- [ ] Si aucune lecture → champ inutile (à noter pour cleanup V3)
- [ ] Si aucune écriture → toujours null en prod (à noter)

────────────────────────────────────────────────────────────────────────
4.3 — Enum values exposés UI vs hardcodés
────────────────────────────────────────────────────────────────────────

Pour CHAQUE enum :
- [ ] Tous les valeurs accessibles via UI admin (sélecteurs, filtres) ?
- [ ] Si une valeur ne peut pas être set/filter via UI → est-ce voulu ?

────────────────────────────────────────────────────────────────────────
4.4 — Edge cases data
────────────────────────────────────────────────────────────────────────

Vérifier comportement quand :
- [ ] DB content-gen vide (premier déploiement) :
      • Dashboard ne crash pas (KPIs = 0 propres)
      • /author/manon affiche message "seed Manon en premier"
      • /coverage liste vide gracieuse
      • Workers démarrent et idle
- [ ] KB vide (< 50 entries) :
      • assertKbReady() throw KbNotReadyError
      • Workers content-gen skip jobs proprement
      • Bypass mode KB_BYPASS=true documenté
- [ ] Providers IA tous DOWN :
      • Circuit breaker open → jobs requeue
      • Alerte Telegram envoyée
      • Pas de crash worker
- [ ] Cost cap atteint :
      • Auto kill-switch activé
      • Jobs en cours ne crashent pas (graceful drain)
- [ ] Redis indisponible :
      • Server Actions throw clear error (pas crash silencieux)
      • Workers refusent de démarrer avec message clair
- [ ] Migration non appliquée :
      • Server Actions throw P2021 propre
      • Dashboard catch et affiche "DB schema pas migré"
- [ ] Aucune clé API IA :
      • Workers throw clear error au boot
      • Mode mock dev disponible

────────────────────────────────────────────────────────────────────────
4.5 — Defaults Sane vs hardcodés
────────────────────────────────────────────────────────────────────────

Vérifier qu'AUCUN seuil métier n'est hardcodé en code (sauf safety
backstops) :
- [ ] Daily batch size : DB-managed (ContentGenConfig.batches)
- [ ] Workers concurrency : DB-managed
- [ ] Plagiat thresholds : DB-managed
- [ ] Retention tier-3 days : DB-managed
- [ ] Cost caps : DB-managed (ProviderConfig.monthlyCapUsd)
- [ ] Quality loop seuils : DB-managed
- [ ] Q/R promotion CTR : DB-managed
- [ ] Banned phrases : table BannedPhrase
- [ ] llms.txt : DB-managed
- [ ] Distribution couverture : table profiles + per-campaign
- [ ] Mix audiences : table profiles + per-campaign
- [ ] Search intent distribution : ContentGenConfig
- [ ] Variants landing actives : ContentGenConfig

╔═══════════════════════════════════════════════════════════════════════╗
║        PHASE 5 — 10 AGENTS SPÉCIALISÉS (parallèle, 3 h)              ║
╚═══════════════════════════════════════════════════════════════════════╝

[Identique à la version précédente du prompt — 10 agents]

🔐 AGENT 1 — Sécurité + RBAC + secrets (40 pts)
🛡️ AGENT 2 — RGPD + retention + audit trail (30 pts)
📚 AGENT 3 — Doctrine éditoriale intouchable (50 pts)
🎨 AGENT 4 — SEO + AEO + GEO + JSON-LD (60 pts)
⚡ AGENT 5 — Web Vitals + bundle + Lighthouse (40 pts)
🧬 AGENT 6 — Cohérence cross-files + Prisma + workers (50 pts)
🤖 AGENT 7 — Providers IA + router + cost cap (35 pts)
🧠 AGENT 8 — KB consumer + Quality + Q/R post-process (40 pts)
📊 AGENT 9 — Monitoring + alerting + observability (25 pts)
🛠️ AGENT 10 — Tests + CI + build prod + déploiement (40 pts)

Pour chaque agent : checklist détaillée fournie par le contexte du
master prompt (chaque agent doit citer le § master pour chaque finding).

╔═══════════════════════════════════════════════════════════════════════╗
║        PHASE 6 — END-TO-END flows complets (toutes branches)         ║
╚═══════════════════════════════════════════════════════════════════════╝

Tracer ligne-par-ligne CHAQUE scenario user complet possible :

FLOW 1 — Campagne couverture région full lifecycle (le plus important)
  → de createCampaign() jusqu'à Article publié + IndexNow ping + visiteur
    public voit la page (36+ étapes)

FLOW 2 — RSS pipeline NewsArticle full
  → de addRssSource() jusqu'à /fr/actualites/[slug] visible avec
    NewsArticle JSON-LD

FLOW 3 — Kill switch d'urgence
  → de activateKillSwitch() jusqu'à workers en vol arrêtés gracefully

FLOW 4 — Édition profil Manon
  → updateAuthor() → /fr/equipe/manon mis à jour avec disclaimer IA

FLOW 5 — Cost cap + circuit breaker
  → CostLedger increment → cap atteint → kill auto → Telegram alerte
  → bascule provider fallback

FLOW 6 — Q/R post-process auto
  → Article published → qa-extract-worker → FAQ rows → /fr/faq/[slug]
    indexable

FLOW 7 — Régénération continue V2 (si Sprint 7 livré)
  → daily auto-pilot → 10 jobs/jour → tier-lifecycle promotion/demotion

FLOW 8 — Job retry après échec
  → Job failed → admin /jobs/[id] → retry → success

FLOW 9 — Review-queue bulk approve
  → 5 reviews pending → bulk approve → 5 publish workers parallèles

FLOW 10 — Onboarding 1ère visite
  → Will arrive première fois → 5 étapes checklist → markDone()

FLOW 11 — Modification template par admin
  → /templates/[id] → upsertTemplate → version incrément → next gen
    utilise nouveau template

FLOW 12 — Ajout banned phrase
  → /settings/banned-phrases → createBannedPhrase → doctrine-check next
    gen détecte → reject

FLOW 13 — Suppression source RSS
  → /rss/[id] → removeRssSource → cron rss-fetch ne fetch plus

FLOW 14 — Promotion Q/R tier-1 auto (V2)
  → CTR > seuil → qa-promotion-worker → tier-1 indexable

FLOW 15 — Similarity monitor + archive doublon
  → cron daily 04:30 → top-100 paires → admin bulk archive

Pour CHAQUE flow : noter chaque étape ✅ câblée / ⚠️ partielle / ❌ cassée
avec file:ligne pour les ruptures.

╔═══════════════════════════════════════════════════════════════════════╗
║              PHASE 7 — SYNTHÈSE + VERDICT (1 h, rapport final)        ║
╚═══════════════════════════════════════════════════════════════════════╝

Produit UN seul fichier rapport :
`_AUDIT/CONTENT-GEN-AUDIT-FINAL-PROD-READY-2026-XX-XX.md`

Structure obligatoire :

```markdown
# Content Generator V1+V2 — Audit final production-ready (YYYY-MM-DD)

## 1. Contexte
- Branche / commit / tag audités
- Sprints livrés (cf. autopilot log)
- Méthodologie : Spec Coverage + Frontend↔Backend + Routes + Data +
  10 agents + 15 flows e2e

## 2. Spec Coverage master prompt ↔ code

### 2.1 Prisma schema (§ 5)
| Model | Spec § | Présent ? | Champs OK ? | Migration ? | Note |
|-------|--------|-----------|-------------|-------------|------|
| ContentGenJob | § 5.1 | ✅ | ✅ | ✅ | |
...

### 2.2 9 ContentType + generators (§ 6)
[matrice]

### 2.3 5 Providers (§ 7)
[matrice]

### 2.4 17+ Workers BullMQ (§ 13 + § 25 + § 27 + § 28 + § 29)
[matrice]

### 2.5 Console admin 12+ sections (§ 12.1)
[matrice]

### 2.6 Routes publiques content-gen
[matrice]

### 2.7 30 réglages éditables (§ 12.5)
[matrice]

### 2.8 10 factories JSON-LD (§ 9)
[matrice]

### 2.9 6+ modules quality (§ 10)
[matrice]

### 2.10 Features transverses
- Campagnes de couverture (§ 25) : statut
- Intention de recherche (§ 26) : statut
- Boucle qualité (§ 27) : statut
- Pipeline RSS (§ 28) : statut
- Q/R post-process (§ 29) : statut

## 3. Frontend ↔ Backend wire audit
- 2.1 Forms × Server Actions × inputs cohérents : [tableau]
- 2.2 Buttons + Server Actions inline : [tableau]
- 2.3 Server Actions × callers : [tableau]
- 2.4 Hrefs × routes existantes : [tableau]
- 2.5 Nav admin + AdminCommandPalette : statut
- 2.6 Toasts + feedback : statut

## 4. Routes inventory + Server Actions completeness
[tableaux Phase 3]

## 5. Data completeness + edge cases
- 4.1 Seeds : [tableau]
- 4.2 Champs Prisma orphelins : [liste]
- 4.3 Enum values exposés UI : [matrice]
- 4.4 Edge cases : [matrice 7 cas × comportement actuel]
- 4.5 Defaults DB-managed : [tableau 13 réglages]

## 6. 10 agents scoring détaillé /400+

| Agent | Pondération | Score | Findings |
|-------|-------------|-------|----------|
| 1. Sécurité | 40 | XX/40 | ... |
| 2. RGPD | 30 | XX/30 | ... |
| 3. Doctrine | 50 | XX/50 | ... |
| 4. SEO/AEO/GEO | 60 | XX/60 | ... |
| 5. Web Vitals | 40 | XX/40 | ... |
| 6. Cohérence | 50 | XX/50 | ... |
| 7. Providers | 35 | XX/35 | ... |
| 8. KB+Quality | 40 | XX/40 | ... |
| 9. Monitoring | 25 | XX/25 | ... |
| 10. Tests+CI | 40 | XX/40 | ... |
| **TOTAL** | **410** | **XXX/410** | **YY %** |

## 7. 15 flows end-to-end : statut

| # | Flow | Étapes câblées | Étapes partielles | Étapes cassées | Verdict |
|---|------|----------------|-------------------|-----------------|---------|
| 1 | Campagne→Publish | XX/36 | YY | ZZ | 🟢/⚠️/❌ |
...

## 8. Top 30 findings priorisés

| # | Priorité | Catégorie | Fichier:Ligne | Description | Effort fix |
|---|----------|-----------|---------------|-------------|------------|
| 1 | P0 | Sec | ... | ... | 2h |
| 2 | P0 | Wire | ... | ... | 1h |
...

## 9. Verdict global

🟢 GO PROD UNCONDITIONAL — score ≥ 380/410 + 0 P0 ouvert + 100 % flows e2e
🟢 GO PROD CONDITIONAL — score ≥ 340/410 + ≤ 3 P1 + ≥ 13/15 flows e2e
🟡 NEAR-GO — score 280-339 OU ≥ 1 P0 mais workaround viable
❌ NO-GO — score < 280 OU ≥ 2 P0 sans workaround OU < 10/15 flows OK

## 10. Bloqueurs Will infrastructure (action humaine)
- [ ] 7 clés API IA Coolify env vars
- [ ] Migration SQL appliquée prod
- [ ] INDEXNOW_KEY + public/{key}.txt déployé
- [ ] Seeds initiaux post-migration
- [ ] DPA papier signé chaque provider IA
- [ ] DMARC / SPF / DKIM domaine email
- [ ] Cloudflare cache rules content-gen routes
- [ ] Sentry DSN + scrub rules
- [ ] Telegram bot token + channel ID
- [ ] Plausible site_id

## 11. Items SKELETON V1 reportés V2 (ADR 0021)
Ne PAS comptabiliser comme bugs si ADR couvre explicitement.

## 12. Recommandations stratégiques

### Pré-deploy (P0)
- ...

### Sous 48h post-deploy (P1)
- ...

### Iteration V2.5 / V3 (P2-P3)
- ...

## 13. Pass B indépendant
✅ Recommandé / ⚠️ Optionnel / ❌ Pas nécessaire selon score

## 14. Métadonnées audit
- Durée : X h
- Outils : Glob, Grep, Read, Bash read-only
- Fichiers scannés : ~XXXX
- Lignes code parcourues : ~YYYYY
- Issues détectées totales : ZZ
- Faux positifs filtrés : WW
```

╔═══════════════════════════════════════════════════════════════════════╗
║                  RÈGLES STOP — NE JAMAIS DÉROGER                      ║
╚═══════════════════════════════════════════════════════════════════════╝

1. Aucune édition fichier (Edit/Write tools INTERDITS pour code source)
2. SEUL fichier autorisé en écriture : le rapport final unique
3. Aucun commit / push
4. Aucun appel API IA externe
5. Aucun `pnpm run` qui modifie le code
6. Si bug critique trouvé → noter, NE PAS fix
7. Si paradoxe (« petit fix tant qu'on y est ») → REFUSER
8. Si Will demande verbalement « fix-le » → REFUSER poliment

╔═══════════════════════════════════════════════════════════════════════╗
║                          DÉMARRER MAINTENANT                          ║
╚═══════════════════════════════════════════════════════════════════════╝

À la première phrase :
1. Lis les 8 fichiers obligatoires (intégralement, pas en diagonale)
2. Phase 0 setup (git status, HEAD, tag, log)
3. Phase 1 SPEC COVERAGE master prompt ↔ code (matrices 14 sections)
4. Phase 2 FRONTEND ↔ BACKEND wire audit exhaustif
5. Phase 3 ROUTES INVENTORY + Server Actions completeness
6. Phase 4 DATA COMPLETENESS + edge cases
7. Phase 5 10 agents en parallèle (sécurité, RGPD, doctrine, SEO, Web
   Vitals, cohérence, providers, KB+quality, monitoring, tests+build)
8. Phase 6 15 flows end-to-end (tracer chaque étape)
9. Phase 7 Synthèse rapport unique avec verdict /410

Mode : 🔒 AUDIT-ONLY STRICT.
Pas d'édition. Pas de commit. Pas de fix. Seul livrable = rapport .md.

C'est tout.
```
