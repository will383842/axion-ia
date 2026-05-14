# 🔍 PROMPT — VÉRIFICATION FINALE AVANT CODAGE — Content Generator Axion-IA

> **Master prompt d'audit pré-implémentation** en mode 🚫 AUDIT-ONLY strict. Vérifie en profondeur que TOUT est prêt à 100 % avant que Sprint 1 du content-generator soit lancé. Identifie les bloqueurs P0 / P1 / P2 résiduels et produit un plan correctif si nécessaire.

**Auteur** : Claude Opus 4.7 + Will  
**Date** : 2026-05-14  
**Statut** : 🟢 Prêt à exécution  
**Mode** : 🚫 **AUDIT-ONLY strict** — aucune modification fichier hors `_AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/`  
**Périmètre** : tout le système content-generator V1 (master prompt v2.4 + skill + seeds + plan Sprint 1)  
**Cible** : score ≥ 180/200 = 🟢 GO PROD-READY immédiat. 150-179 = 🟡 NEAR-GO + sprint correctif S0. < 150 = 🔴 NO-GO.

---

## 📑 Sommaire

0. [Contrat d'exécution](#0-contrat-dexécution)
1. [Périmètre — fichiers à auditer](#1-périmètre)
2. [Méthodologie — 8 agents parallèles](#2-méthodologie)
3. [Axe 1 — Master prompt cohérence interne](#axe-1)
4. [Axe 2 — Architecture & DB Prisma](#axe-2)
5. [Axe 3 — Providers IA + Quality + Generators](#axe-3)
6. [Axe 4 — SEO/AEO/GEO 2026 perfection](#axe-4)
7. [Axe 5 — Admin UI + Cockpit géo + Mode autopilote](#axe-5)
8. [Axe 6 — Plan Sprint 1 Day-by-Day faisabilité](#axe-6)
9. [Axe 7 — Skill packagé + 10 seeds pré-remplis](#axe-7)
10. [Axe 8 — Sécurité + RGPD + observabilité](#axe-8)
11. [Livrables](#11-livrables)
12. [Scoring /200 + verdict](#12-scoring)
13. [Plan correctif si NEAR-GO / NO-GO](#13-plan-correctif)
14. [Phrase d'invocation](#14-invocation)

---

## 0. Contrat d'exécution

### 0.1 Mode

🚫 **AUDIT-ONLY strict**. AUCUNE modification de fichier existant. AUCUNE écriture de code applicatif. AUCUN appel à une API externe. Seules écritures autorisées : dans `_AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/` exclusivement.

### 0.2 Doctrine

- **Citations obligatoires** : chaque finding doit citer `path/to/file.md:line` ou `path/to/file.md § X.Y`. Aucune affirmation sans source.
- **Pass B croisement** : aucun P0 final sans ≥ 2 sources indépendantes (2 agents différents OU 1 agent + 1 fichier).
- **Idempotence** : si le dossier `_AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/` existe déjà avec des livrables → skip + signale dans manifest.
- **Anti-hallucination** : si un fichier mentionné n'existe pas → écris `[FICHIER ABSENT — non créé encore]`. Ne pas inventer.
- **Doctrine intouchable** : ne pas remettre en question les décisions Will actées (Manon persona transparente, Unsplash uniquement, FR-only, INSEE 4 catégories, 4 templates landings villes, etc.).

### 0.3 Garde-fous

- **Kill-switch agents** : 90 min max par agent. Si timeout → marker `[TIMEOUT — finding partiel]` dans output.
- **Aucune commande Bash** sauf `pnpm content-gen:isolation-check` (lecture seule).
- **Aucun secret loggué** : redaction regex final avant écriture des livrables.

### 0.4 Pré-requis

Avant lancement, vérifier la présence de ces fichiers (sinon STOP immédiat) :

- `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` (v2.4 attendue)
- `_AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md`
- `_AUDIT/SPRINT-1-DAY-BY-DAY.md`
- `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md`
- `_AUDIT/SEEDS-PREPARATION-GUIDE.md`
- `_AUDIT/seeds-templates/` (10 fichiers)
- `.claude/skills/axionia-content-generator/` (16 fichiers)

Si un fichier manque → écrire dans `_AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/00-PRE-REQUIS-KO.md` + STOP global.

---

## 1. Périmètre — fichiers à auditer (32 fichiers)

### Bloc A — Spec master + plan (5 fichiers)

1. `_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md` (~50 000 mots, 29 sections + annexes)
2. `_AUDIT/PROMPT-CONTENT-FACTORY-SPEC.md` (data model)
3. `_AUDIT/SPRINT-1-DAY-BY-DAY.md` (timeline horaire)
4. `_AUDIT/SEEDS-PREPARATION-GUIDE.md`
5. `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md`

### Bloc B — Skill Claude Code (16 fichiers)

6. `.claude/skills/axionia-content-generator/SKILL.md`
7. `.claude/skills/axionia-content-generator/README.md`
8. `.claude/skills/axionia-content-generator/auto-pilot.md`
9-14. `.claude/skills/axionia-content-generator/prompts/*.md` (6 sub-prompts)
15-17. `.claude/skills/axionia-content-generator/checklists/*.md` (3 checklists)
18-20. `.claude/skills/axionia-content-generator/references/*.md` (3 références)
21. `.claude/skills/axionia-content-generator/templates/landing-ville-template.tsx.md`

### Bloc C — Seeds pré-remplis (10 fichiers)

22-31. `_AUDIT/seeds-templates/*.{md,json,csv}` :
- `manon-profile.md`
- `rss-sources.json`
- `coverage-distribution-profiles.json`
- `audience-mix-profiles.json`
- `banned-phrases.json`
- `keyword-templates.csv`
- `blog-titles.csv`
- `unsplash-search-queries.json`
- `synonym-groups.json`
- `external-references.json`

### Bloc D — Existant repo à corréler (read-only)

32. `prisma/schema.prisma` (vérifier compat avec migrations content-gen prévues)
- `src/content/{pricing,regions,interventions,interventions-taxonomy,audit-taxonomy,implementation,villes/data,villes/copy,case-studies,comparaisons,stack-ia,blog/posts,transversal,legal,automatisations}.ts` (SSOT à respecter)
- `src/lib/seo.ts` (extension prévue)
- `src/app/[locale]/(admin)/[adminPrefix]/` (admin existant — extension prévue)
- `src/server/queue/` (BullMQ existant — workers à ajouter)
- `src/env.ts` (Zod schema à étendre)
- `package.json` (deps à installer)

---

## 2. Méthodologie — 8 agents parallèles

Chaque agent reçoit un périmètre dédié, produit 1 fichier JSON structuré dans `_AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/agents/` + 1 résumé Markdown.

| Agent | Périmètre | Output JSON | Output MD |
|---|---|---|---|
| **AGT-VC1** | Master prompt cohérence interne (sommaire, numérotation, versions, doctrine, contradictions internes) | `agt-vc1-coherence.json` | `agt-vc1-coherence-summary.md` |
| **AGT-VC2** | Architecture & DB Prisma (16+ tables + enums, FK, migrations, seeds idempotents, sub-folders shared/types/constants v2.3) | `agt-vc2-architecture.json` | `agt-vc2-architecture-summary.md` |
| **AGT-VC3** | Providers IA + Quality + Generators (5 providers, 6 quality modules, 9 generators + 4 landings villes, sub-prompts cohérence) | `agt-vc3-pipeline.json` | `agt-vc3-pipeline-summary.md` |
| **AGT-VC4** | SEO/AEO/GEO 2026 (32 head + 14 OG + 7 TW + 4 Geo + 24 JSON-LD + Featured Snippet + llms.txt + IndexNow + Indexing API V1 + sitemap perfection v2.4 + crawl budget v2.3) | `agt-vc4-seo.json` | `agt-vc4-seo-summary.md` |
| **AGT-VC5** | Admin UI + Cockpit géo + Mode autopilote (12 sections, 30 réglages, kanban, similarity monitor, onboarding wizard, défauts Q1-Q13, critères STOP durci) | `agt-vc5-admin.json` | `agt-vc5-admin-summary.md` |
| **AGT-VC6** | Plan Sprint 1 Day-by-Day faisabilité (30 commits, DAG dépendances, charge 40j, gates, ordre fichiers, dépendances inter-agents) | `agt-vc6-plan.json` | `agt-vc6-plan-summary.md` |
| **AGT-VC7** | Skill packagé + 10 seeds pré-remplis (cohérence v2.4, complétude, validation possible Will, déclencheurs SKILL.md, invocations) | `agt-vc7-skill-seeds.json` | `agt-vc7-skill-seeds-summary.md` |
| **AGT-VC8** | Sécurité + RGPD + observabilité (CSP nonce, PII redaction, DPA Hetzner/CF, robots.txt 2026, Sentry+Plausible+Telegram, secrets jamais en clair, helper pii-redaction réutilisé) | `agt-vc8-securite.json` | `agt-vc8-securite-summary.md` |

### Format JSON commun par agent

```json
{
  "agent": "AGT-VC1",
  "scope": "Master prompt cohérence interne",
  "executedAt": "2026-05-14T15:00:00Z",
  "filesAudited": ["_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md"],
  "findings": [
    {
      "id": "VC1-001",
      "severity": "P0" | "P1" | "P2" | "INFO",
      "title": "Description courte 1 ligne",
      "description": "Description détaillée 2-5 lignes",
      "source": "_AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md:1247",
      "expected": "Comportement attendu",
      "actual": "Comportement actuel",
      "fix": "Action corrective proposée (1-3 phrases)",
      "estimatedFixEffort": "5 min" | "1 h" | "1 j" | "blocage Sprint 1"
    }
  ],
  "score": 0-100,
  "passBPaths": ["agt-vc2:V2-014"],
  "verdict": "GO" | "NEAR_GO" | "NO_GO"
}
```

### Pass B croisement

Après les 8 agents :
- Agent principal lit les 8 JSON
- Tout P0 doit être confirmé par ≥ 2 agents OU par ≥ 1 agent + citation directe d'un fichier
- Si P0 non corroboré → rétrograde en P1
- Si P1 corroboré par 2 agents → reste P1 (ne devient pas P0 automatique)

---

## 3. Axe 1 — Master prompt cohérence interne (AGT-VC1)

### Checklist détaillée

#### 3.1 Versionnage cohérent

- [ ] Header `Date :` mentionne la dernière version (v2.4 attendue, ou plus récente)
- [ ] Chaque section v1.x / v2.x / v2.4 mentionne explicitement sa version d'introduction
- [ ] Aucune section n'utilise `(v1.0 acté)` puis plus loin `(révision v2.4)` sans clarté
- [ ] La phrase d'invocation § 23 + § 24.6 référence la dernière version

#### 3.2 Sommaire à jour

- [ ] Sommaire § 0 inclut TOUTES les sections numérotées (1 → 30)
- [ ] Aucune section orpheline (existante mais pas listée dans le sommaire)
- [ ] Aucune entrée fantôme (listée mais inexistante)

#### 3.3 Numérotation Q1 → Q13bis cohérente

- [ ] Section § 20 STOP & ASK liste Q1 à Q13bis dans l'ordre
- [ ] Section § 24.2 (défauts autopilote) référence toutes les questions
- [ ] Aucun double Q (Q12bis présent, Q13 unique)
- [ ] Si Q12bis marqué OBSOLÈTE v2.0 → cohérent dans § 20 et § 24.2

#### 3.4 Contradictions doctrine v1.x → v2.4

Vérifier les paires potentielles :
- FR-only v1.2 vs anciennes mentions « parity FR/EN »
- Manon persona v2.0 vs anciennes mentions sameAs LinkedIn
- Unsplash only v2.0 vs anciennes mentions gpt-image-1 primaire
- 4 landings/ville v2.1 vs anciennes mentions « 1 landing par ville »
- Keywords dynamiques v2.1 vs anciennes mentions « 500 keywords statiques »
- Indexing API V1 v2.4 vs anciennes mentions « V2 »

Toute contradiction non résolue = **P0**.

#### 3.5 Sections 25-30 (v1.7 et après) ancrées dans l'architecture

- [ ] § 25 Campagnes de couverture référencé dans § 4.1 architecture ?
- [ ] § 26 SearchIntent référencé dans § 5.1 Prisma (enum) + § 9.7 + § 26.3 ?
- [ ] § 27 Boucle qualité référencée dans § 17 Sprint breakdown ?
- [ ] § 28 RSS NewsArticle référencé dans § 6.2.3 ?
- [ ] § 29 Q/R post-process référencé dans § 6 + § 17 Sprint 2 ?
- [ ] § 30 (si existe — Stratégie ARA) référencé dans § 15 cockpit géo ?

#### 3.6 Scoring /200 cohérent avec checklist EXIT

- [ ] § 19.1 grille scoring 11 catégories
- [ ] § 22 checklist EXIT V1 + sections v1.7/v1.8/v1.9
- [ ] Chaque item EXIT correspond à au moins 1 critère scoring
- [ ] Total pondéré = 200

#### 3.7 Phrases d'invocation cohérentes

- [ ] § 23 invocation standard mentionne "v2.4" ou dernière version
- [ ] § 24.6 invocation autopilote mentionne v2.4
- [ ] SKILL.md (skill) mentionne v2.4
- [ ] auto-pilot.md mentionne v2.4

→ Si désalignement → P1.

---

## 4. Axe 2 — Architecture & DB Prisma (AGT-VC2)

### Checklist détaillée

#### 4.1 Tables Prisma exhaustives

Vérifier que TOUTES ces tables sont déclarées dans § 5.1 (ou patches v1.7-v2.4) :

| Table | Section | Statut attendu |
|---|---|---|
| `ContentGenConfig` | § 5.1 | ✅ |
| `ProviderConfig` | § 5.1 | ✅ |
| `ContentTemplate` | § 5.1 (étendu v1.4) | ✅ avec `variant`, `expansionMode`, progress counters |
| `ContentGenJob` | § 5.1 (étendu v1.7 + v1.8) | ✅ avec campaignId, searchIntent, anchorVilleSlug, qualityImprovementAttempts |
| `GenerationLog` | § 5.1 | ✅ |
| `ContentMetric` | § 5.1 | ✅ |
| `CostLedger` | § 5.1 | ✅ |
| `ReviewQueue` | § 5.1 | ✅ |
| `KbDocument` | § 5.1 (read-only) | ✅ commentaire alimenté externe |
| `KbChunk` | § 5.1 (read-only) | ✅ |
| `RssSource` | § 5.1 | ✅ |
| `RssItem` | § 5.1 | ✅ |
| `AuthorProfile` | § 12.1bis + v2.0 + v2.2 | ✅ avec `isPersona`, `personaDisclaimer` |
| `BannedPhrase` | § 12.1 + § 12.5 | ✅ |
| `CoverageCampaign` | § 25.2 v1.7 | ✅ |
| `CoverageDistributionProfile` | § 25.2 v1.7 | ✅ |
| `AudienceMixProfile` | § 25.2 v1.7 | ✅ |
| `ExternalReference` | § 9bis.5bis v2.2 | ✅ avec `trustTier` |
| `ContentCitation` | § 9bis.5bis v2.2 | ✅ |
| Extension `FAQ` (slug, parentArticleId, ...) | § 29.2 v1.7 | ✅ |
| Extension `Article` (isNews, indexationTier, qualityScore, ...) | § 5.1 + § 28.2 | ✅ |

Toute table manquante = **P0**.

#### 4.2 Enums déclarés

- `ContentType` (9 valeurs)
- `ContentGenJobStatus` (12 valeurs incl. quality_improving v1.7)
- `LogLevel`
- `IndexationTier` (3 valeurs)
- `Locale` (fr, en — v1.3 enum explicite)
- `ExpansionMode` (8 valeurs v1.4)
- `ProviderKey` (5 valeurs)
- `ProviderRole`
- `ReviewStatus`
- `KbSource`
- `CoverageStatus` (7 valeurs v1.7)
- `CoverageScope` (4 valeurs)
- `CompanySize` (4 valeurs INSEE strict)
- `OrganisationType` (12 valeurs)
- `SearchIntent` (5 valeurs)
- `TrustTier` (5 valeurs v2.2)

Tout enum manquant = **P0**.

#### 4.3 Sub-folders v2.3

Vérifier mention dans § 4.1bis :
- [ ] `src/server/content-gen/shared/` (6 fichiers : slug-builder, date-formatter, text-utils, html-sanitizer, geo-utils, retry-policy)
- [ ] `src/server/content-gen/types/` (5 fichiers : generation, content, seo, kb, index)
- [ ] `src/server/content-gen/constants/` (6 fichiers : kb, cost, quality, timeouts, crawl, doctrine)
- [ ] `src/server/content-gen/logger.ts`

#### 4.4 Cloisonnement strict — script isolation-check

- [ ] § 4.1bis liste 9 dossiers DÉDIÉS
- [ ] Script `pnpm content-gen:isolation-check` mentionné dans § 18.1 livrables Sprint 1
- [ ] Règles d'import explicites (content-gen consommateur, jamais consommé sauf db/env/seo/i18n/SSOT)

#### 4.5 Migrations cohérentes

- [ ] Migration unique Sprint 1 `add_content_gen_core`
- [ ] Migration Sprint 2 `add_rss_pipeline` ou intégrée à core
- [ ] Aucune migration destructive (DROP / ALTER NOT NULL sans default)
- [ ] Extension `pgvector` mentionnée explicitement

#### 4.6 Seeds cohérents avec tables

Pour chaque table Prisma → seed correspondant existe-t-il ?

- `ProviderConfig` → `provider-config.ts` seed ✅
- `ContentTemplate` → `content-templates.ts` seed (9 types + 6 variantes landing) ✅
- `CoverageDistributionProfile` → seed (3 profils) ✅ via `coverage-distribution-profiles.json`
- `AudienceMixProfile` → seed (4 profils) ✅ via `audience-mix-profiles.json`
- `AuthorProfile[slug=manon]` → seed via `manon-profile.md` ✅
- `BannedPhrase` → seed via `banned-phrases.json` (52 phrases) ✅
- `RssSource` → seed via `rss-sources.json` (15 sources) ✅
- `ExternalReference` → seed via `external-references.json` (56 sources) ✅

Tout seed manquant = **P1**.

---

## 5. Axe 3 — Providers IA + Quality + Generators (AGT-VC3)

### Checklist détaillée

#### 5.1 Providers

- [ ] 4 providers production actifs : OpenAI, Anthropic, Perplexity, Unsplash
- [ ] `gpt-image-1` retiré v2.0 (Unsplash uniquement)
- [ ] Interface `IProvider.ts` mentionnée
- [ ] Circuit breaker shared Redis spec'd § 9.11.6
- [ ] Cost tracking par appel dans `CostLedger`
- [ ] Kill switch global testé
- [ ] Fallback chain : OpenAI text → Claude fallback. Anthropic long-form → OpenAI fallback. Perplexity → skip (pas de fallback). Unsplash → IllustrationPlaceholder.

#### 5.2 Quality modules

- [ ] `dedup-guard.ts` 4 couches v1.7 (Levenshtein 0.85 + topic fingerprint + cosine 0.85 + time decay 12 mois)
- [ ] `plagiarism.ts` shingling 5-gram Jaccard
- [ ] `doctrine-check.ts` (anti-SIREN, naming, banned phrases)
- [ ] `seo-score.ts` scoring déterministe /100 + bandes tier strict
- [ ] `readability.ts` Flesch FR
- [ ] `search-intent-validator.ts` v1.7 (alignement slug/meta/CTA/JSON-LD par intent)
- [ ] **Nouveau v2.1** : compteur termes techniques sans définition + qualityScore -10 pts si > 3/1000 mots audience non-tech

#### 5.3 Generators 9 types + 4 sub-types landings villes

- [ ] `landing-ville.ts` avec 4 variantes (default + secteur-industrie + comptable + juridique + taille-tpe + grande)
- [ ] `landing-audit-par-ville.ts` v2.1
- [ ] `landing-interventions-par-ville.ts` v2.1
- [ ] `landing-implementation-par-ville.ts` v2.1
- [ ] `blog-from-title.ts`
- [ ] `blog-from-keywords.ts`
- [ ] `blog-from-rss.ts` v1.7 (NewsArticle JSON-LD)
- [ ] `blog-from-pillar.ts`
- [ ] `comparison.ts`
- [ ] `guide-pilier.ts` (pipeline 2 étapes avec STOP outline)
- [ ] `qa-derived.ts` v1.7 (post-process auto enrichissement contextuel)
- [ ] `faq-standalone.ts`

#### 5.4 Sub-prompts skill cohérents

Pour chacun des 6 sub-prompts skill :
- [ ] SLO p50 / p95 explicite en haut
- [ ] searchIntent input obligatoire mentionné
- [ ] Ancrage géographique (`anchorVilleSlug` / `anchorDepartementCode`) mentionné
- [ ] Post-process Q/R auto mentionné (sauf qa-derived qui EST le post-process)
- [ ] Éligibilité boucle qualité mentionnée
- [ ] Doctrine langage accessible v2.1 référencée
- [ ] Schémas Zod output complets

---

## 6. Axe 4 — SEO/AEO/GEO 2026 perfection (AGT-VC4)

### Checklist détaillée 100+ items

**Toujours référencer la spec § 9.7 + § 9bis + § 26.**

#### 6.1 Head HTML (32 items § 9.7.1)

(Lister chaque item + vérifier présent dans le master prompt + dans le template TSX)

#### 6.2 Open Graph (14 items § 9.7.2)

#### 6.3 Twitter Cards (7 items § 9.7.3)

#### 6.4 Geo meta (4 items § 9.7.4)

#### 6.5 Hiérarchie headings (§ 9.7.5)

- 1 H1 strict
- 3-8 H2
- H3 enfants directs
- rare H4
- 0 H5+

#### 6.6 Semantic HTML5 (§ 9.7.6)

#### 6.7 WCAG 2.2 AA (§ 9.7.7)

#### 6.8 JSON-LD 24+ schemas (§ 9.7.8 + v2.2 + v2.3)

- Article (avec wordCount, thumbnailUrl, contentLocation, audience, copyrightHolder v2.3)
- BlogPosting / TechArticle / NewsArticle
- FAQPage + Speakable
- QAPage v1.7
- HowTo + HowToStep
- LocalBusiness + Service (GeoCircle 50 km v2.3)
- Place + Organization + ContactPoint v2.3 + OfferCatalog v2.3
- Person (Manon persona transparente v2.0)
- BreadcrumbList
- ItemList
- WebPage + Speakable
- ImageObject
- Review + AggregateRating v2.2
- Course v2.2
- WebSite + SearchAction

#### 6.9 Featured Snippet 3 formats (§ 9.6.1bis v2.2)

#### 6.10 Speakable validation Playwright (§ 9bis.11.B)

#### 6.11 llms.txt YAML Anthropic 2026 (§ 9.6.2 + § 9bis.11.C)

#### 6.12 IndexNow + Google Indexing API V1 (§ 9bis.1 v2.4)

#### 6.13 Sitemap perfection (§ 9bis.2 + nouveau v2.4)

- sitemap-index.xml référence tous les enfants
- sitemap-blog.xml chunked 1 000
- sitemap-villes.xml chunked
- sitemap-news.xml séparé v1.7 (Google News extension)
- sitemap-faq.xml v1.7
- sitemap-guides.xml
- sitemap-comparaisons.xml
- sitemap-static.xml (pages éditoriales)
- lastmod précis seconde
- changefreq dynamique
- priority dynamique (1.0 piliers, 0.9 landings, 0.8 guides, etc.) v2.3
- image extension `<image:image>`
- tier-1 only strict (§ 9bis.1)

#### 6.14 Crawl budget optimization (§ 9bis.9bis v2.3)

#### 6.15 hreflang FR-only v1.2 (§ 9bis.4)

#### 6.16 Canonical strict + Header Link (§ 9bis.3)

#### 6.17 6 signaux anti-AI-detection (§ 9.6.6)

#### 6.18 SearchIntent alignment (§ 26)

#### 6.19 robots.txt 2026 différencié (§ 9bis.9bis v2.3)

#### 6.20 GBP V2 reporté OK ?

→ Score axe 4 : 100/100 cible.

---

## 7. Axe 5 — Admin UI + Cockpit géo + Mode autopilote (AGT-VC5)

### Checklist détaillée

#### 7.1 12 sections admin v1.7+v2.x

- `/content-gen/` dashboard
- `/settings/{providers,batches,policies,banned-phrases,llms-txt,coverage-distribution,audience-mix,search-intent-distribution,quality-loop,qa-policies,kill-switch}` (10 sous-pages)
- `/author/manon/` (v2.0)
- `/templates/`
- `/landing-variants/` v2.1
- `/jobs/[id]/` avec timeline SSE
- `/queue/`
- `/review-queue/[id]/`
- `/geo/` cockpit (wireframe § 12.1quater)
- `/geo/batches/{new,[id]}/`
- `/geo/[villeSlug]/generate/`
- `/kb-readonly/[id]/` (read-only strict)
- `/rss/`
- `/costs/`
- `/coverage/{new,[id]}/`
- `/similarity-monitor/`
- `/publications-status/` (kanban 5 colonnes)
- `/publications/`
- `/orchestrator/`
- `/aeo-tests/` (V2)
- `/external-references/` v2.2

#### 7.2 Onboarding wizard 5 étapes (§ 12.1ter v1.9)

#### 7.3 Cockpit géo wireframe (§ 12.1quater)

- 4 zones
- 5 modes coloriage
- Side-panel ville drawer
- SSE realtime
- Vue villes oubliées (gris)

#### 7.4 Job detail timeline SSE (§ 12.1quinquies)

#### 7.5 Alertes Telegram explicites (§ 12.3bis)

#### 7.6 Hard rule pilotage 30 réglages (§ 12.5)

#### 7.7 Mode autopilote § 24

- 13 STOP & ASK avec défauts
- Q13 Manon seul gate humain (réduit à 2 inputs v2.0)
- 8 critères STOP durci
- Log autopilote `_AUDIT/CONTENT-GEN-V1-AUTOPILOT-LOG.md`
- Phrase invocation autopilote (§ 24.6)

---

## 8. Axe 6 — Plan Sprint 1 Day-by-Day faisabilité (AGT-VC6)

### Checklist détaillée

#### 8.1 `SPRINT-1-DAY-BY-DAY.md` exhaustif

- 7 jours détaillés
- 30 commits Conventional ordonnés
- DAG dépendances inter-agents (AGT-A → B/E/F)
- Gates fin de jour
- Critères STOP durci

#### 8.2 Cohérence avec § 17 Sprint breakdown

- Sprint 1 → 40j cumulés total V1
- Sprint 2 inclut hook post-process Q/R auto v1.7
- Sprint 5 inclut Google Indexing API V1 v2.4
- Sprint 5 inclut NewsArticle pipeline 2

#### 8.3 Faisabilité réelle

- 30 commits / 7j = 4-5 commits / jour : réaliste ?
- Charge AGT-A (DB) Day 1-3 : faisable ?
- Test live OpenAI Day 1 : faisable (clé Will fournie) ?
- pnpm verify:all Day 6 : tous les modules testables ?

#### 8.4 Préreq Sprint 1

- 4 clés API actives
- Q13 Manon fourni (2 inputs : Option visuelle + bio validée)
- KB ≥ 300 chunks atteint (signal depuis session KB séparée)
- Git push origin/main OK
- Coolify API token valide

#### 8.5 Verrous techniques connus

- `prerender-manifest` corrompu Next 16 Windows (mémoire `[[axionia_dev_500_prerender_manifest]]`) — fix documenté ?
- Bug sitemap.xml 404 existant (mémoire `[[axionia_bugs_seo_preexistants_2026-05-09]]`) — adressé dans Sprint 1 ?
- Bug og:image localhost (idem) — adressé ?

→ Si verrous non adressés → **P0**.

---

## 9. Axe 7 — Skill packagé + 10 seeds pré-remplis (AGT-VC7)

### Checklist détaillée

#### 9.1 SKILL.md frontmatter

- `name: axionia-content-generator` ✅
- `description:` riche en triggers
- Mention v2.4
- Sibling `axionia-connaissances` mentionné

#### 9.2 Cohérence 16 fichiers skill

- Tous les fichiers existent
- Versions cohérentes (pas d'oubli v1.x dans certains, v2.4 dans d'autres)
- Liens internes valides (références entre fichiers du skill)

#### 9.3 10 seeds pré-remplis exhaustifs

Pour chacun des 10 fichiers seeds :
- [ ] `_meta` block présent avec version, totaux, ingestSprint
- [ ] `_validation.willActions` liste claire
- [ ] Pas de valeurs `<TODO>` ou placeholders non remplis (sauf Q13 Manon — accepté)
- [ ] Cohérence avec doctrine v2.4

#### 9.4 Seeds critiques pour Sprint 1

- `manon-profile.md` : Q13 attendu de Will (3 options visuelles + bio)
- `keyword-templates.csv` : ~80 templates dynamiques v2.1 (pas ~500 statiques v2.0)
- `external-references.json` : 56 sources curées trustTier v2.2
- `banned-phrases.json` : 52 phrases severity block/warning/info
- `coverage-distribution-profiles.json` : 4 profils somme = 100%
- `audience-mix-profiles.json` : 4 profils matrice 4x12 somme = 100%

---

## 10. Axe 8 — Sécurité + RGPD + observabilité (AGT-VC8)

### Checklist détaillée

#### 10.1 Sécurité

- [ ] CSP nonce respecté (§ 0.5)
- [ ] HTML sanitize DOMPurify avant DB insert (§ 0.5)
- [ ] Aucun secret en clair commité (`src/env.ts` Zod schema)
- [ ] Anti-SIREN check existant réutilisé
- [ ] Robots.txt 2026 différencié (§ 9bis.9bis v2.3)
- [ ] RBAC admin (super_admin V1)
- [ ] CSRF protégé (Server Actions Next 16)

#### 10.2 RGPD

- [ ] PII redaction dans prompts (helper `pii-redaction.ts` existant réutilisé)
- [ ] Pas de PII client (booking, submission) dans prompts LLM
- [ ] Cas concrets anonymisés (secteur + taille + ville, jamais nom)
- [ ] DPA Hetzner + Cloudflare déjà signés (mémoire infra)
- [ ] Conservation prompts/logs : durée définie ?
- [ ] Droit oubli appliqué (V2 — mécanisme `Article.deletedAt` ?)

#### 10.3 Observabilité

- [ ] Sentry config existante réutilisée
- [ ] Plausible events `content_gen_*`
- [ ] Telegram alertes 13 événements (§ 13.3)
- [ ] Logger centralisé v2.3 (§ 4.1bis sub-folders)
- [ ] SLO p50/p95 mesurés (§ 9.11.11)
- [ ] Cost cap respecté

---

## 11. Livrables

Arborescence cible :

```
_AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/
├── MANIFEST.md                              ← liste agents lancés + timestamps + résultats
├── 00-PRE-REQUIS-CHECK.md                  ← validation pré-requis avant lancement
├── agents/
│   ├── agt-vc1-coherence.json
│   ├── agt-vc1-coherence-summary.md
│   ├── agt-vc2-architecture.json
│   ├── agt-vc2-architecture-summary.md
│   ├── agt-vc3-pipeline.json
│   ├── agt-vc3-pipeline-summary.md
│   ├── agt-vc4-seo.json
│   ├── agt-vc4-seo-summary.md
│   ├── agt-vc5-admin.json
│   ├── agt-vc5-admin-summary.md
│   ├── agt-vc6-plan.json
│   ├── agt-vc6-plan-summary.md
│   ├── agt-vc7-skill-seeds.json
│   ├── agt-vc7-skill-seeds-summary.md
│   ├── agt-vc8-securite.json
│   └── agt-vc8-securite-summary.md
├── SYNTHESE-FINALE.md                       ← scoring /200 + verdict GO/NEAR-GO/NO-GO
├── PLAN-CORRECTIF.md                        ← si NEAR-GO / NO-GO : actions à faire avant Sprint 1
└── WHAT-TO-DO-NOW.md                        ← prochaine étape concrète Will (≤ 200 mots)
```

---

## 12. Scoring /200 + verdict

### 12.1 Grille de scoring

| Catégorie | Poids | Mesure |
|---|---|---|
| **Cohérence master prompt** (AGT-VC1) | 20 | Versionnage + sommaire + numérotation Q + contradictions internes |
| **Architecture & DB Prisma** (AGT-VC2) | 25 | 21 tables + 16 enums + sub-folders v2.3 + cloisonnement isolation-check + migrations safe + seeds cohérents |
| **Pipeline content-gen** (AGT-VC3) | 25 | 4 providers + 6 quality modules + 9 generators + 4 sub-templates landings villes + sub-prompts complets |
| **SEO/AEO/GEO 2026** (AGT-VC4) | 30 | 100+ items : head + OG + Twitter + Geo + JSON-LD 24+ + Featured Snippet + sitemap perfection + Indexing API V1 + crawl budget |
| **Admin UI + autopilote** (AGT-VC5) | 25 | 12 sections + onboarding + cockpit + kanban + similarity monitor + 30 réglages éditables + mode autopilote opérationnel |
| **Plan Sprint 1 faisabilité** (AGT-VC6) | 20 | Timeline horaire + DAG + 30 commits + gates + pré-requis explicites + verrous techniques adressés |
| **Skill + 10 seeds** (AGT-VC7) | 20 | 16 fichiers cohérents v2.4 + 10 seeds pré-remplis + validation Will simple |
| **Sécurité + RGPD + observabilité** (AGT-VC8) | 15 | CSP + PII redaction + secrets jamais en clair + Sentry/Plausible/Telegram + RGPD compliant |
| **Cohérence transverse** (Pass B croisement) | 20 | Aucun P0 sans 2 sources + aucune contradiction inter-agents |

**Total : 200**

### 12.2 Seuils verdict

- **≥ 180/200** : 🟢 **GO PROD-READY** — Sprint 1 peut être lancé en autopilote immédiatement (après Q13 Manon + 4 clés API + KB ready).
- **150-179/200** : 🟡 **NEAR-GO** — Sprint correctif S0 préalable (1-3 jours). Liste P0/P1 dans `PLAN-CORRECTIF.md`.
- **< 150/200** : 🔴 **NO-GO** — refonte nécessaire. Liste détaillée dans `PLAN-CORRECTIF.md` + recommandation explicite.

### 12.3 Format `SYNTHESE-FINALE.md`

```markdown
# Synthèse finale — Vérification pré-implémentation

**Date** : 2026-MM-DD HH:MM
**Score global** : 183 / 200
**Verdict** : 🟢 GO PROD-READY

## Score par catégorie

| Catégorie | Poids | Score | % |
|---|---|---|---|
| Cohérence master | 20 | 18 | 90% |
| Architecture & DB | 25 | 24 | 96% |
| Pipeline content-gen | 25 | 23 | 92% |
| SEO/AEO/GEO 2026 | 30 | 28 | 93% |
| Admin UI + autopilote | 25 | 24 | 96% |
| Plan Sprint 1 | 20 | 18 | 90% |
| Skill + seeds | 20 | 19 | 95% |
| Sécurité + RGPD | 15 | 14 | 93% |
| Cohérence transverse | 20 | 15 | 75% |
| **Total** | **200** | **183** | **91.5%** |

## Top 3 P0 résiduels (s'il y en a)

(liste si verdict ≠ GO ou si quelques P0 mineurs identifiés)

## Top 5 P1 à fixer avant Sprint 1

...

## Recommandations next steps

→ Voir `WHAT-TO-DO-NOW.md`
```

---

## 13. Plan correctif si NEAR-GO / NO-GO

Format `PLAN-CORRECTIF.md` :

```markdown
# Plan correctif Sprint S0 — Pré-implémentation

**Verdict** : 🟡 NEAR-GO score 168/200
**Sprint correctif** : S0 (1-3 jours dev)
**Bloqueurs P0** : 2

## P0-1 — [Titre court]

- **Description** :
- **Source** (path:line) :
- **Impact si non corrigé** :
- **Fix proposé** :
- **Effort estimé** :
- **Validation** : <comment vérifier après fix>

## P0-2 — ...

## P1 importants (8 items)

(liste courte avec effort estimé chacun)

## P2 cosmétiques (peuvent attendre Sprint 6.1 ou V2)

(liste optionnelle)

## Re-lancement de la vérification

Après application des fixes P0 et P1 critiques :
1. Re-lancer ce prompt `PROMPT-PRE-IMPLEMENTATION-VERIFICATION-2026.md`
2. Vérifier score ≥ 180/200
3. Si OK → lancer Sprint 1 autopilote
```

---

## 14. Phrase d'invocation

Pour lancer la vérification dans une nouvelle session Claude Code :

```
Lis _AUDIT/PROMPT-PRE-IMPLEMENTATION-VERIFICATION-2026.md en intégralité.

Mode : 🚫 AUDIT-ONLY strict (zéro modification fichier hors _AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/).

Étape 1 — Phase 0 reality-check § 0.4 :
  Vérifie présence des fichiers pré-requis. Si KO → écris _AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/00-PRE-REQUIS-KO.md + STOP.

Étape 2 — Lance les 8 agents parallèles § 2 :
  AGT-VC1 à AGT-VC8 selon scopes définis § 3 → § 10.
  Chaque agent produit 1 JSON + 1 MD summary dans _AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/agents/.
  Citations path:line obligatoires.

Étape 3 — Pass B croisement § 2 :
  Lis les 8 JSON. Aucun P0 final sans ≥ 2 sources.
  Rétrograde les P0 non corroborés en P1.

Étape 4 — Synthèse finale § 12 :
  Produis _AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/SYNTHESE-FINALE.md :
    - Scoring /200 par catégorie
    - Verdict GO / NEAR-GO / NO-GO
    - Top 3 P0 et top 5 P1 résiduels

Étape 5 — Plan correctif § 13 (si NEAR-GO ou NO-GO) :
  Produis _AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/PLAN-CORRECTIF.md.

Étape 6 — WHAT-TO-DO-NOW :
  Produis _AUDIT/VERIFICATION-FINALE-AVANT-CODAGE/WHAT-TO-DO-NOW.md (≤ 200 mots — prochaine étape concrète Will).

Doctrine : citations obligatoires, no-hallucination strict, idempotence (skip si dossier livrables existe déjà — sauf si Will demande --force).

Cible : verdict 🟢 GO PROD-READY score ≥ 180/200.
```

---

## 📌 Annexes

### A. Décisions Will actées (à respecter pendant l'audit — ne pas remettre en question)

- FR-only V1 (v1.2)
- Manon = persona éditoriale fictive transparente (v2.0 Option A)
- Unsplash uniquement (v2.0 — pas de gpt-image-1 V1)
- INSEE strict 4 catégories (TPE/PME/ETI/grande-entreprise)
- 4 landings villes systématiques par ville (v2.1 — générale + audit + interventions + impl)
- Parcours bout-en-bout obligatoire (Audit → Formation → Implémentation) dans les 4 templates
- Keywords templates dynamiques (v2.1 — pas de discrimination ville-par-ville)
- Pages Q/R `/fr/faq/[slug]` post-process auto (v1.7)
- Cocon `Coverage Campaigns` (v1.7)
- Boucle qualité auto (v1.7)
- NewsArticle pour RSS (v1.7)
- Egalité qualité absolue villes (v2.1)
- Google Indexing API V1 (v2.4)
- GBP doctrine V1 avec adresse domiciliation FR (v2.4 si Will confirme option b)

### B. Mémoires reliées

- `[[axionia_prompt_content_generator_master]]` — historique v1.0 → v2.4
- `[[axionia_prompt_content_factory_spec]]` — data model acté
- `[[axionia_prompt_knowledge_base]]` — KB séparée
- `[[axionia_session_2026-05-13_content_generator_skill]]` — session de création skill
- `[[axionia_pseo_industrialisation_decision]]` — ordre villes
- `[[axionia_pseo_villes_livre_2026-05-08]]` — pSEO villes foundation
- `[[axionia_doctrine_code_ssot]]` — code SSOT
- `[[axionia_bugs_seo_preexistants_2026-05-09]]` — bugs sitemap pré-existants à corriger Sprint 1
- `[[axionia_dev_500_prerender_manifest]]` — bug Next 16 Windows à connaître

### C. Phrase d'invocation autopilote post-vérification (si GO)

Une fois score ≥ 180/200 atteint :

```
Skill : axionia-content-generator (mode AUTOPILOTE)
[Lis SKILL.md auto-pilot.md master prompt et déclenche Sprint 1 Day 1.]
```

(cf. § 24.6 master prompt + `auto-pilot.md` skill.)

---

**FIN — PROMPT-PRE-IMPLEMENTATION-VERIFICATION-2026.md**

Statut : 🟢 Prêt à exécution. Lancer en mode AUDIT-ONLY dans nouvelle session Claude Code pour valider que TOUT est prêt avant Sprint 1.
