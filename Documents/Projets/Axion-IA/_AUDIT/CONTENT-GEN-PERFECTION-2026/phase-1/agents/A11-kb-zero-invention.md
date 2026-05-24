# A11 — KB : ZÉRO INVENTION ENFORCEMENT

**Agent** : A11 — Knowledge Base & Hallucination Control
**Audit HEAD** : `2b98a7067d7eae701dec42a2c5d6e859364e0e64`
**Date** : 2026-05-21
**Mode** : AUDIT-ONLY STRICT — 0 invention, chaque affirmation citée fichier:ligne
**Scoring** : /60

---

## Mission

Auditer l'exhaustivité de la KB 3 couches (villes + sectorielles + globale), la mécanique d'injection RAG dans les prompts, les contrôles d'hallucination existants, le fact-checking automatique post-génération, et la couverture Wikidata/KG pour l'entité Axion-IA.

---

## Méthode

Lecture de 22 fichiers source + 5 requêtes grep ciblées sur les patterns critiques. Périmètre :
- `src/content/villes/economic-data/` (39+1 fichiers hors index/types)
- `src/content/villes/copy/` (39 fichiers hors types)
- `src/content/knowledge/sector-entries/` (6 secteurs + index + types)
- `src/server/content-gen/kb-client.ts`, `kb-feeder.ts`, `kb-health.ts`
- `src/server/content-gen/providers/anthropic.ts`, `provider-router.ts`
- `src/server/content-gen/generators/blog-article.ts`, `landing-ville.ts`, `landing-ville-templates.ts`
- `src/server/content-gen/quality/doctrine-check.ts`
- `src/server/content-gen/fact-check/claims-extractor.ts`
- `src/server/queue/workers/content-fact-check-worker.ts`
- `prisma/schema.prisma` (modèles `KnowledgeEntry`, `Article`, `CostLedger`)
- `src/lib/seo.ts` (JSON-LD Organization + Person)
- `src/server/image-bank/services/image-jsonld-graph.service.ts`

---

## État observé

### Couche 1 — KB villes économique (`economic-data/`)

**39 fichiers villes** + `index.ts` + `types.ts` = 41 fichiers.
Source : `src/content/villes/economic-data/` (ls confirmé 2026-05-21).

Chaque fichier exporte une constante `VILLE_ECONOMIC_DATA: VilleEconomicData`. Le type impose :
- `source: string` (URL vérifiable) sur chaque `VilleSecteurDominant`, `VillePoleCompetitivite`, `VilleDistances`
- `verifiedOn: string` (date ISO)

Exemple Paris (`economic-data/paris.ts:29`) :
```ts
source: "https://www.insee.fr/fr/statistiques/2011101?geo=COM-75056",
verifiedOn: "2026-05-18",
```

Le contrat est posé dans l'en-tête de `types.ts:9` : *"CONTRAT ABSOLU : aucune invention. Chaque entrée a un champ `source` vérifiable"*.

**Volume tokens estimé** : 39 villes × ~1 500 tokens moyens = ~58 500 tokens bruts (données structurées TS). En contexte LLM via RAG, seul l'excerpt (<280 chars) est envoyé → ~10-15 tokens/chunk.

### Couche 2 — KB sectorielle (`knowledge/sector-entries/`)

**6 fichiers actifs** : `commerce-logistique.ts`, `conseil-finance.ts`, `doctrines-cross.ts`, `industrie.ts`, `it-cyber.ts`, `sante-agro.ts` + `index.ts` + `types.ts`.

Le type `SectorKbEntry` (`types.ts:28-47`) impose :
- `sources: ReadonlyArray<string>` (≥ 1 URL vérifiable, hard required)
- `lastReviewedOn: string`
- `reviewedBy: string`

Contrat inscrit en `types.ts:7` : *"CONTRAT ABSOLU : aucune invention. Chaque entrée doit avoir ≥ 1 source URL vérifiable dans `sources`."*

Exemple `conseil-finance.ts:100-106` : 4 sources URL (Légifrance, EBA, ACPR, EUR-Lex).

**Mapping 5 verticales Axion-IA vs secteurs KB** :
| Verticale Axion-IA | Couverture secteur KB |
|---|---|
| Interventions | doctrines-cross.ts (partiel) |
| Audits | conseil-finance + it-cyber + industrie (partiel) |
| Implémentations | it-cyber + industrie (partiel) |
| 1-to-1 | **ABSENT** — aucun fichier dédié |
| Web & Digital IA | **ABSENT** — aucun fichier dédié |

→ **2 verticales sur 5 sans coverage KB sectorielle** : `1-to-1` et `Web & Digital IA / codage`.

### Couche 3 — KB globale entité (`kb/global/`)

**Inexistante** : aucun répertoire `kb/global/`, aucun fichier `axionia-entity.ts`. Confirmé par `find` et `grep`.

L'entité Axion-IA est partiellement définie dans `src/lib/seo.ts` (JSON-LD Organization, `seo.ts:375-420`) mais :
- Pas de fichier KB canonique standalone
- `sameAs` = `["https://www.linkedin.com/company/axion-ia", "https://www.facebook.com/axionia"]` (`seo.ts:395`)
- **Wikidata absent** : `seo.ts:395` ne contient aucune URL wikidata.org
- La mention Wikidata est uniquement dans image-bank : `image-jsonld-graph.service.ts:40` (`wikidataQid?: string` optionnel non renseigné en prod)

### Injection KB dans prompts — RAG

**kb-client.ts** (`kb-client.ts:51-83`) implémente un `retrieve()` FTS/vector/hybrid via `searchKnowledge()` (FTS Postgres tsvector + trigram). Mode `hybrid` V1 = FTS only (Voyage AI embedding requis mais non activé tant que `VOYAGE_API_KEY` absent).

**Injection dans blog-article** (`blog-article.ts:71-86`) : top 8 chunks RAG → formatés `[type] title\nexcerpt` → injectés dans `userPrompt` sous `## Sources internes Axion-IA`. Le contexte est injecté dans le **user prompt**, pas le system prompt → **pas caché par prompt caching** (P1, voir findings).

**Injection dans landing-ville** (`landing-ville.ts:55-84`) : top 8 chunks RAG + `localEconomicContext` (données economic-data). La mention `## Contexte économique local — {ville} (données vérifiées)` est explicite sur l'origine sourcée (`landing-ville.ts:79`).

**landing-ville : Perplexity data step** décrit dans le commentaire `landing-ville.ts:6` ("2. Optional Perplexity data récente") mais **non implémenté** : le code saute directement à LLM text generation (`landing-ville.ts:123`). Étape TODO/stub.

### Prompt caching Anthropic

**Activé** dans `anthropic.ts:173-179` :
```ts
system: [{ type: "text", text: req.systemPrompt, cache_control: { type: "ephemeral" } }]
```
TTL 5 min Anthropic. `cacheReadInputTokens` et `cacheCreationInputTokens` trackés dans la réponse (`anthropic.ts:192-193`).

**Cache hit rate observable** : `cacheReadInputTokens` retourné dans `GenerationResponse` (`IProvider.ts:61`) mais **non persisté** dans `CostLedger` (schéma `schema.prisma:3040-3053` ne stocke pas `cacheReadInputTokens`). Pas de métrique dashboard. **Cache hit rate = 0 % mesurable actuellement** (P1).

**Périmètre caching** : uniquement le system prompt est caché (invariant). Le user prompt (incluant le contexte KB) n'est pas caché. Pour un gain maximal, le KB context de grande taille devrait être caché aussi → architecture améliorable V2.

### Hallucination control — mécanisme existant

**doctrine-check.ts** (`quality/doctrine-check.ts`) vérifie :
1. Anti-SIREN regex (`doctrine-check.ts:30`)
2. Naming brand Axion-IA strict (`doctrine-check.ts:31`)
3. Banned phrases DB (54 phrases prod, fallback hardcodé 15 phrases) (`doctrine-check.ts:118-170`)
4. Ratio AxionIA-centric ≥ 95 % heuristique (`doctrine-check.ts:49-63`)

**Absent dans le system prompt** : aucune instruction explicite de type *"N'invente pas de chiffres sans source"* ou *"Marque [NÉCESSITE VÉRIFICATION] si tu n'es pas certain"*. Le `SYSTEM_PROMPT` de `blog-article.ts:25-33` interdit des prix en dur et certains patterns mais n'interdit pas l'invention de statistiques génériques.

**`DOCTRINE_INTOUCHABLE`** (landing-ville-templates.ts:53-61) = doctrine éditoriale Axion-IA-centric, ne contient pas de clause anti-hallucination chiffrée.

**Marker `[NÉCESSITE VÉRIFICATION]`** : **absent** de tout fichier src/. Grep confirme 0 occurrence.

### Fact-checking automatique

**claims-extractor.ts** (Sprint 12.5 V2) : extrait jusqu'à 30 claims par article (%, €, ratios, attributions, dates+stats) via 5 regex. Fonction pure, testée (`__tests__/` présent). Score `computeFactCheckScore()` = (validated - refuted)/total, normalisé 0-100.

**content-fact-check-worker.ts** : worker BullMQ post-publish :
1. Lookup Article + traduction FR
2. `extractClaims(body)` → liste claims
3. Si 0 claim → score=100
4. Sinon : 1 call Perplexity Sonar `role="data"`, `searchRecencyMonths: 36` (`content-fact-check-worker.ts:126`)
5. Parse verdicts → `computeFactCheckScore` → `Article.factCheckScore` UPDATE

**`Article.factCheckScore`** (Int?) persisté en DB (`schema.prisma:896`). Field `kbChunkIds` (`schema.prisma:905`) trace les IDs KB utilisés (audit trail RAG).

**Activation** : worker démarré dans `worker.ts:62` (`startFactCheckWorker()`). Kill-switch `kill_switch.active` configurable admin (`content-fact-check-worker.ts:84`).

**Table `KbFact`** : **absente** du schéma Prisma. Grep `KbFact` → 0 résultat. La vérification est faite dynamiquement via Perplexity à chaque article, pas depuis une table de facts pré-vérifiés persistés.

### Scores hallucination observables (sans DB live)

**Anti-fabrication watchwords** : patterns *"selon une étude récente"*, *"il est prouvé que"*, *"certains experts affirment"* → **absents** de toutes vérifications doctrinaires code. Uniquement le fallback `bannedPhrases` DB détecte le marketing-hype (révolutionnaire, incroyable, le meilleur) mais pas les formulations pseudo-sourcées.

**Date freshness** : Perplexity `searchRecencyMonths: 36` côté fact-check worker → claims sur données >36 mois seront marqués `unclear` (pas `stale_source` explicite). Aucun mécanisme de flag `stale_source` dans le code.

**NER (Named Entity Recognition)** : **absent**. Pas de vérification que les entités nommées citées (entreprises, institutions) existent réellement.

**Cross-KB consistency** : **absente**. Aucun mécanisme vérifiant que si la KB ville dit X chiffre, l'article généré ne cite pas Y différent.

### Wikidata + KG entity

`seo.ts:395` : `sameAs: ["https://www.linkedin.com/company/axion-ia", "https://www.facebook.com/axionia"]` — **Wikidata absent**.

`image-jsonld-graph.service.ts:40` : `wikidataQid?: string` — champ prévu mais non renseigné.

`src/content/keywords/i-geo.ts:282` note : *"GEO: page entité. JSON-LD Organization + speakable + sameAs (Wikidata, LinkedIn). Réponse directe §1."* → intent documenté mais non implémenté.

Aucun Q-ID Wikidata Axion-IA trouvé nulle part dans le code.

**Author Will Jullin** : `seo.ts:498` — `sameAs: ["https://www.linkedin.com/in/will-axion-ia"]`. LinkedIn présent. Wikidata absent.

### UI admin édition KB

**Lecture seule** : `/content-gen/kb-readonly` (`KbReadonlyV2.tsx`) — affiche les 25 dernières entries publiées + répartition par type. **Pas d'édition inline**.

**Ingest externe** : `/content-gen/settings/kb-ingest` + Server Action `ingestKbFromUrl()` — permet d'ingérer une URL externe. C'est la seule interface d'écriture admin.

**Édition directe d'une entry KB** : **absente** — pas de form CRUD KB dans admin. Edition = commit code (sector-entries/*.ts) → seed Prisma.

### Zod schema sur KB

`SectorKbEntry` et `VilleEconomicData` sont des **interfaces TypeScript** pures, pas des schémas Zod. Validation = compilation TypeScript uniquement. Aucun `z.object()` ni `safeParse()` trouvé sur ces types. En production, si un import est mal typé, l'erreur est silencieuse au runtime.

---

## Findings

### Tableau P0/P1/P2

| ID | Sévérité | Titre | Fichier:ligne | Impact |
|---|---|---|---|---|
| F1 | **P0** | System prompt ne contient aucune clause anti-hallucination chiffrée | `blog-article.ts:25-33`, `landing-ville-templates.ts:53-61` | LLM libre d'inventer des statistiques, chiffres de marché, % sans source |
| F2 | **P0** | Marker `[NÉCESSITE VÉRIFICATION]` absent de tous les prompts ET de la review pipeline | grep 0 résultat | Aucun signal d'alerte sur claims non sourcés dans le contenu généré |
| F3 | **P0** | Anti-fabrication watchwords absents du doctrine-check | `quality/doctrine-check.ts` entier | Formules pseudo-sourcées ("selon une étude récente") non bloquées |
| F4 | **P0** | KB globale `kb/global/axionia-entity.ts` inexistante | `/` | Entité Axion-IA sans source canonique KB = dépendance aux JSON-LD éparpillés |
| F5 | **P0** | 2 verticales sur 5 sans KB sectorielle (1-to-1, Web & Digital IA) | `src/content/knowledge/sector-entries/` | Content-gen aveugle sur 40 % du portefeuille produit |
| F6 | **P1** | Perplexity data pre-call sur landing-ville = stub commentaire uniquement | `landing-ville.ts:6` | Pas d'enrichissement données récentes avant génération |
| F7 | **P1** | Cache hit rate non persisté (cacheReadInputTokens non stocké en CostLedger) | `anthropic.ts:250`, `schema.prisma:3040` | Impossible de mesurer ROI prompt caching ni optimiser TTL |
| F8 | **P1** | KB context injecté dans user prompt (non caché) | `blog-article.ts:83-86` | 8 chunks × ~150 tokens rechargés à chaque call vs system prompt caché |
| F9 | **P1** | Table `KbFact` absente — vérification dynamique uniquement | `schema.prisma` entier | Pas de référentiel pré-vérifié : tout claim doit être re-vérifié live par Perplexity |
| F10 | **P1** | Stale_source non flaggé : données >36 mois classées `unclear` seulement | `content-fact-check-worker.ts:126` | Pas de distinction entre "introuvable" et "obsolète" |
| F11 | **P1** | NER absent : entités nommées non vérifiées | grep 0 résultat | LLM peut citer des entreprises/institutions inexistantes |
| F12 | **P1** | Cross-KB consistency absente | grep 0 résultat | Inconsistance possible entre KB ville et article généré |
| F13 | **P1** | Wikidata Q-ID Axion-IA absent de `seo.ts:395` | `seo.ts:395` | Knowledge Graph Google non alimenté — pénalité AEO/GEO citations |
| F14 | **P1** | Zod schema absent sur `SectorKbEntry` et `VilleEconomicData` | `sector-entries/types.ts`, `economic-data/types.ts` | Erreurs de saisie silencieuses en runtime |
| F15 | **P2** | Admin KB = lecture seule + ingest URL uniquement (0 form CRUD) | `KbReadonlyV2.tsx`, `kb-ingest-external.ts` | Will ne peut pas corriger une entry KB sans commit code |
| F16 | **P2** | KB versioning : modification sector-entry ne retrigger pas la régénération d'articles | aucun fichier trouvé | Articles obsolètes si KB mise à jour |
| F17 | **P2** | Author Will Jullin : LinkedIn OK, Wikidata absent, nom stub ("will-axion-ia" vs vrai nom) | `seo.ts:498` | E-E-A-T Person schema incomplet |
| F18 | **P2** | Facebook sameAs déprécié AEO : `facebook.com/axionia` non vérifié | `seo.ts:395` | Risque lien cassé ou mauvaise entité dans Knowledge Graph |

---

## Scoring /60

| Critère | Points max | Score | Justification |
|---|---|---|---|
| KB exhaustivité 3 couches (villes + verticals + global) | /15 | **7/15** | Couche 1 villes V3 excellente (39 fichiers, sources obligatoires, verifiedOn). Couche 2 sectorielle partielle (6/8 secteurs estimés, 2 verticales absentes). Couche 3 globale = 0 (axionia-entity.ts inexistant). |
| Injection prompt + caching | /10 | **6/10** | RAG FTS opérationnel, kb-client.ts, kbChunks injectés. Prompt caching activé sur system prompt (`cache_control: ephemeral`). Malus : contexte KB dans user prompt non caché, Perplexity pre-call landing-ville = stub, cache hit rate non mesurable. |
| Hallucination control mécanisme existant | /10 | **3/10** | doctrine-check.ts couvre naming/SIREN/ratio AxionIA-centric/banned-phrases. Mais 0 clause anti-hallucination chiffrée dans system prompt, 0 marker `[NÉCESSITE VÉRIFICATION]`, 0 watchword sur pseudo-sources. Le contrôle est éditorial (doorway/naming) pas factuel. |
| Fact-checking automatique (claim extraction + source verif + KbFact) | /12 | **7/12** | claims-extractor.ts fonctionnel (5 patterns, max 30 claims, testé). content-fact-check-worker.ts actif (BullMQ, Perplexity Sonar, `searchRecencyMonths:36`). `Article.factCheckScore` persisté. Malus : table KbFact absente, stale_source non distingué, NER absent, cross-KB consistency absente. |
| Score hallucination réel mesuré (sans DB live) | /8 | **2/8** | `Article.factCheckScore` calculé mais non visible (DB inaccessible en audit statique). Aucun log d'audit claims exporté. Statistiquement : avec 0 clause anti-hallucination dans system prompt ET mode RAG FTS (pas vector), un LLM injecte souvent ses propres statistiques génériques. Score estimé par proxy : risque élevé non mesuré = score bas. |
| Wikidata + KG entity AxionIA | /3 | **0/3** | Aucun Q-ID Wikidata dans `seo.ts`, dans KB globale (inexistante), ni dans l'admin JSON-LD. `image-jsonld-graph.service.ts:40` prévu mais non renseigné. |
| Tooling admin éditer KB | /2 | **1/2** | Admin KB-readonly + ingest externe URL OK. Mais 0 form CRUD KB = Will ne peut pas éditer une entry sans commit. |

**TOTAL : 26/60 — 43 % — ROUGE NO-GO**

---

## Délégations

| Agent destination | Sujet | Priorité |
|---|---|---|
| A4 (SEO/AEO/GEO) | Wikidata Q-ID Axion-IA création + `sameAs` propagation | P0 |
| A1 (pipeline chain) | Ajouter clause anti-hallucination chiffrée dans SYSTEM_PROMPT de tous les generators | P0 |
| A1 (pipeline chain) | Implémenter Perplexity data pre-call landing-ville.ts step 2 | P1 |
| A7 (quality) | Ajouter watchwords anti-fabrication dans doctrine-check.ts | P0 |
| A13 (KB) | Créer `kb/global/axionia-entity.ts` + KB sectorielles 1-to-1 et Web & Digital IA | P0/P1 |

---

## UNKNOWNs

- **U1** : `factCheckScore` distribution en prod (DB inaccessible) — quel % d'articles ont score < 70 ?
- **U2** : Volume actuel `KnowledgeEntry` published en prod — la KB est-elle ≥ 50 entries (hard gate) ou en bypass mode ?
- **U3** : `VOYAGE_API_KEY` activé en prod ? Si non, mode hybrid = FTS only → moins précis.
- **U4** : `KB_BYPASS` env var = true ou false en prod Coolify ?
- **U5** : Wikidata Q-ID Axion-IA existe-t-il déjà (créé manuellement) ? Non trouvable statiquement.
- **U6** : Domaine `axionai.fr` (concurrent homonyme signalé mémoire) — risque confusion entité dans Knowledge Graph ?

---

## Références

| Fichier | Lignes clés | Sujet |
|---|---|---|
| `src/server/content-gen/kb-client.ts` | 1-84 | RAG retrieve FTS/vector/hybrid |
| `src/server/content-gen/kb-feeder.ts` | 76-152 | Publish KB via HMAC |
| `src/server/content-gen/kb-health.ts` | 125-131 | Hard gate ≥50 entries |
| `src/server/content-gen/providers/anthropic.ts` | 173-179 | `cache_control: {type:"ephemeral"}` |
| `src/server/content-gen/providers/anthropic.ts` | 192-193 | `cacheReadInputTokens` tracké |
| `src/server/content-gen/generators/blog-article.ts` | 25-33 | SYSTEM_PROMPT (pas d'anti-hallucination) |
| `src/server/content-gen/generators/blog-article.ts` | 71-86 | KB RAG → user prompt |
| `src/server/content-gen/generators/landing-ville.ts` | 38-84 | RAG + economic context |
| `src/server/content-gen/generators/landing-ville-templates.ts` | 53-61 | DOCTRINE_INTOUCHABLE |
| `src/server/content-gen/quality/doctrine-check.ts` | 30-63 | Checks doctrine (SIREN, naming, ratio) |
| `src/server/content-gen/quality/doctrine-check.ts` | 118-170 | Banned phrases fallback 15 items |
| `src/server/content-gen/fact-check/claims-extractor.ts` | 30-36 | 5 regex patterns claims |
| `src/server/content-gen/fact-check/claims-extractor.ts` | 92-98 | `computeFactCheckScore` |
| `src/server/queue/workers/content-fact-check-worker.ts` | 39-46 | Perplexity system prompt fact-check |
| `src/server/queue/workers/content-fact-check-worker.ts` | 79-148 | Pipeline complet fact-check |
| `src/content/villes/economic-data/paris.ts` | 1-17 | Contrat zéro invention + sources INSEE |
| `src/content/villes/economic-data/types.ts` | 1-11 | Contrat source obligatoire |
| `src/content/knowledge/sector-entries/types.ts` | 7-47 | `SectorKbEntry` + contrat sources |
| `src/content/knowledge/sector-entries/conseil-finance.ts` | 100-106 | Sources URL légifrance/EBA/ACPR |
| `src/content/knowledge/sector-entries/doctrines-cross.ts` | 1-7 | Contrat zéro invention |
| `prisma/schema.prisma` | 896, 904-905 | `factCheckScore`, `kbChunkIds` |
| `prisma/schema.prisma` | 1941-2040 | `KnowledgeEntry` model (pas `KbFact`) |
| `src/lib/seo.ts` | 395 | `sameAs` LinkedIn+Facebook (Wikidata absent) |
| `src/lib/seo.ts` | 498 | `buildPersonJsonLd` Will LinkedIn |
| `src/server/image-bank/services/image-jsonld-graph.service.ts` | 40 | `wikidataQid?: string` (optionnel, vide) |
