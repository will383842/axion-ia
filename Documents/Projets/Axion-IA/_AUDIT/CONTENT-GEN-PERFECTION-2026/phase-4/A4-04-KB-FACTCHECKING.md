# A4-04 : KB & Fact-Checking
## Score : 68/100

**Date d'audit** : 2026-05-21
**Auditeur** : Agent A4-04 (AUDIT-ONLY, zéro modification)
**Périmètre** : `axionia/src/server/content-gen/kb/`, `kb-client.ts`, `kb-feeder.ts`, `kb-health.ts`, `kb-ingest/`, `fact-check/`, `quality/doctrine-check.ts`, `provenance/provenance-logger.ts`, `prisma/schema.prisma`

---

## Architecture KB — 18/25

### Sources constituant la KB

La KB V4 est une **architecture multi-couches** :

**1. Base de données Postgres (source principale)**
- Modèle `KnowledgeEntry` (table `knowledge_entries`) avec 28 types via enum `KbType` : `article`, `case_study`, `methodology`, `guide`, `implementation_playbook`, `industry_use_case`, `comparison`, `automation_recipe`, `tool_review`, `prompt_pattern`, `faq`, `glossary_term`, `tool_card`, `competence_boost`, `secteur_brief`, `dept_brief`, `metier_brief`, etc.
- Modèle `KnowledgeTranslation` : title, slug, excerpt, bodyText, bodyHtml, bodyJson par locale (FR/EN)
- Index FTS : `tsvector` sur `knowledge_translations.search_vector` (config `fr_unaccent` / `english`), index GIN, plus boost pinned/featured/fraîcheur
- KnowledgeVersion (snapshots immutables forensiques), KnowledgeFeedback (votes 👍/👎), KnowledgeAnnotation (reviews équipe), KnowledgeCollection, KnowledgeRelationship (graphe typé)

**2. Fichier TypeScript statique (stub minimal)**
- Un seul fichier : `kb/verticals/sites-web-augmentes.ts` — contient uniquement des métadonnées (kbSectorTags, primaryKeywords, contentTypeWeights), pas de contenu factuel

**3. Embeddings vectoriels (STUB en V1)**
- Module `src/lib/knowledge/embeddings.ts` : Voyage AI `voyage-3-lite` 1024 dimensions **mais implémentation stub** (hash SHA-256 déterministe) car `VOYAGE_API_KEY` non câblée
- Dédup pgvector cosine ≥ 0.92 côté KB ingest

**4. KB ingest depuis sources externes**
- `kb-ingest/sitemap-parser.ts` : parse sitemaps XML externes (50k URLs max, 2 niveaux récursion)
- `kb-ingest/url-extractor.ts` : fetch + extraction contenu éditorial (HTML → texte) avec SSRF protection + respect `robots.txt` / `ai.txt`
- `kb-ingest/robots-respect.ts` : cache 10 min des règles robots, respect ai.txt Spawning.ai

### Volume estimé

- **KB DB** : volume opérationnel **inconnu** (aucun article ou entry en prod détecté dans le code source — seeder seeds uniquement des métadonnées de configuration, pas de contenu factuel KB)
- **Hard gate** (`kb-health.ts`) : minimum 50 entries publiées + 60% audience public + lastPublishedAt < 90j
- **En pratique** : le `KB_BYPASS=true` est prévu en mode dev/test, et le hard gate retombe en `bypassMode=true` si DB inaccessible (P2021) — risque de bypass non détecté en prod

### Versionnement et mise à jour

- **Versionné** : OUI via `KnowledgeVersion` (snapshots immutables, forensique)
- **Mise à jour** : pipeline KB feeder via `POST /api/internal/kb/ingest` HMAC signé (`KB_INGEST_SECRET`)
- **Automatique** : les générateurs publient vers la KB via `kb-feeder.ts` après chaque génération (`publishToKB`)
- **Manuel** : admin UI V2 + kb-ingest depuis URLs/sitemaps externes

### Injection KB dans les prompts

**Mécanisme RAG FTS (V1) — hybride prévu V1.5** :
1. `retrieve()` dans `kb-client.ts` appelle `searchKnowledge()` (FTS Postgres `websearch_to_tsquery`)
2. Les k=8 à k=10 chunks récupérés sont formatés : `[type] titre\nexcerpt`
3. Injectés dans le user prompt comme section `## Sources internes Axion-IA (à citer en priorité)`
4. Tous les 5 générateurs (blog-article, blog-from-keywords, guide-pilier, landing-ville, faq-standalone) utilisent ce pattern

**Points faibles identifiés** :
- Mode `vector` déclaré mais **non fonctionnel** (fallback FTS car Voyage AI stub) → RAG de qualité limitée
- Mode `hybrid` = FTS seulement en V1 (fusion FTS+cosine décrite comme Sprint KB-21)
- Le contexte KB injecté = **title + excerpt uniquement** (pas le bodyText complet) → contexte factuel très pauvre, risque d'hallucination compensatoire
- Seul 1 fichier de vertical TS existe (sites-web-augmentes) ; pas de vertical KB pour interventions/audits/implementations/1-to-1

### Mécanisme d'alerte si KB vide

- `kb-health.ts::assertKbReady()` : throw `KbNotReadyError` si < 50 entries publiées ou ratio canonical < 60%
- **GAP CRITIQUE** : ce hard gate n'est pas systématiquement appelé dans tous les générateurs — il doit être déclenché côté orchestrateur. Si oublié ou bypassé, les générations partent sans contexte KB réel

**Score : 18/25** — architecture robuste sur le papier (FTS Postgres, ingest HMAC, versioning, hard gate), mais RAG vector non fonctionnel (stub), KB très peu peuplée côté contenu factuel, context window = title+excerpt seulement.

---

## Hallucination Detection — 25/35

### Module claims-extractor.ts

**Existant et fonctionnel.** Détecte via regex 5 types de claims :
- `percentage` : `\b\d{1,3}(?:[,.]\d{1,2})?\s*%` (ex: "75 %", "+12 %")
- `amount` : montants EUR/USD/k€/M€
- `ratio` : "X sur Y", "X out of Y"
- `attribution` : "selon [Nom]"
- `stat_year` : "en 2024 ... 32 %"

Limites : max 30 claims/article, phrases tronquées à 280 chars. Fonction pure (0 I/O), **9 tests Vitest verts**.

### Worker content-fact-check-worker.ts

**Pipeline complet** :
1. Lookup Article + ArticleTranslation FR
2. `extractClaims(bodyText)` → ExtractedClaim[]
3. Si 0 claims → factCheckScore = 100 (sans vérification LLM)
4. Appel Perplexity `sonar-pro` (role="data", searchRecencyMonths=36, temperature=0)
5. Parse réponse → `ClaimVerdict[]` (validated/refuted/unclear)
6. `computeFactCheckScore()` → UPDATE `Article.factCheckScore`

**Points forts** :
- Kill switch (`readContentGenConfig("kill_switch")`) pour pause urgence
- Idempotence (UPDATE Prisma)
- Perplexity retourne `citations[]` + `search_results[]` avec URLs de sources
- Worker déclenché **post-publish** par `content-publish-worker.ts` (enqueue automatique)
- Concurrence limitée à 2 + rate limiter 60/min

**Points faibles** :
- Fact-check = **asynchrone post-publication** : l'article est publié **avant** d'être vérifié, même si des claims sont faux
- `computeFactCheckScore` : "unclear" compte 0 (neutre), non -1 → un article avec 30 claims "unclear" obtient un score de 50, pas bloquant
- Si Perplexity soft-fail → `factCheckScore` reste `null`, pas d'alerte ni de retry ; article reste publié avec score inconnu
- **Aucune quarantaine** : un `factCheckScore` bas (ex. 20/100) ne déclenche ni unpublish ni alerte Telegram — la valeur est stockée en DB mais non exploitée dans le workflow de publication
- La formule de score est asymétrique : `((validated - refuted) / total + 1) / 2 * 100` → 1 claim validated + 1 claim refuted sur 2 total = score 50 (pas 0)

### LLM-as-judge (llm-judge.ts)

**Pipeline de review éditorial** distinct du fact-check :
- Reviewer Claude Sonnet 4.6 (B.8 P1.5, livré 2026-05-21)
- 7 dimensions dont `factual_accuracy` (0-10)
- Verdict déterministe recomputed depuis scores (anti-hallucination du reviewer)
- globalScore recomputed (moyenne 7 dim, ne fait pas confiance au LLM)
- P0 issue `factual error` → verdict `reject`

**Limite critique** : le LLM-judge évalue `factual_accuracy` **sans accès à la KB** ni aux sources externes → jugement stylistique/heuristique seulement, pas de vérification factuelle réelle. Il peut détecter un chiffre manifestement absurde mais pas une statistique plausible et fausse.

### Log des claims rejetés

- `factCheckScore` stocké sur `Article` — trace le score final
- Les verdicts individuels par claim **ne sont pas persistés** : seul le score agrégé est sauvegardé, impossible de savoir quel claim a été refuté
- `GenerationProvenance` : trace les appels LLM (provider, model, tokens, coût, hash chaîné SHA-256) — audit trail AI Act art. 50 ✅

### Quarantaine articles suspects

**ABSENT** — gap P0 :
- Aucun mécanisme ne bloque la publication d'un article avec `factCheckScore < X`
- Aucune alerte Telegram sur `factCheckScore` bas (l'alerte existe pour les erreurs worker, pas pour les scores)
- Un article publié avec 50% claims refutés reste en ligne indéfiniment
- Seule la review humaine admin peut le dépublier manuellement

**Score : 25/35** — le pipeline technique est là (extractor + Perplexity + scoring), mais l'architecture est post-publication sans blocage, et aucune quarantaine ni alerte sur score bas n'est implémentée.

---

## Sources externes citées — 12/25

### Liens vers sources primaires dans les générateurs

Les prompts système ne demandent **pas explicitement** de citer des sources primaires (INSEE, rapports officiels, études sectorielles). Les instructions générateur se concentrent sur :
- "Angle opérationnel : cas d'usage réels, bénéfices mesurables, retour terrain"
- "0 délai chiffré, 0 frais de déplacement, 0 prix en dur"

Perplexity retourne des `citations[]` et `search_results[]` (URLs + titres) mais ces citations sont **stockées dans le champ `GeneratorOutput.citations`** et ne sont pas systématiquement injectées dans le HTML de l'article — elles servent principalement au fact-check post-publication.

### Format de citation standardisé

**ABSENT** — aucun format standardisé (inline footnote, section "Sources", ancres `<a href>`) n'est imposé par les prompts. Le générateur produit du HTML libre. La section `## Sources internes Axion-IA` du prompt invite à utiliser la KB interne, mais n'instrumente pas la production de liens sortants vérifiables.

### Vérification des URLs citées (404 check)

**ABSENTE** — aucun crawler de vérification de disponibilité des URLs citées n'est implémenté. Les URLs provenant de Perplexity sont récentes (searchRecencyMonths=36) mais non vérifiées au moment de la publication.

### Données économiques locales (landing-ville)

C'est le point le plus fort : les générateurs `landing-ville.ts` et `guide-pilier.ts` injectent des données vérifiées depuis `economic-data/<slug>.ts` (données INSEE/INAO/UNESCO : secteurs dominants, grands groupes implantés). Ces données sont labellisées explicitement `## Contexte économique local — {ville} (données vérifiées)` et la doctrine impose `ZÉRO INVENTION`.

**Score : 12/25** — sources économiques locales solides pour landing-ville, mais absence de citations primaires dans les articles de blog/guides, pas de format standardisé, pas de 404-check.

---

## Sample : 35 claims analysés

Les claims suivants sont extraits des 5 case studies disponibles dans `src/content/case-studies.ts` (seule source de contenu factuel textuel disponible dans le code source — aucun article généré n'est accessible en fichier statique).

| # | Claim | Type | Match | Vérifiable ? | Source disponible | Verdict |
|---|---|---|---|---|---|---|
| 1 | "4 ETP affectés au tri, validation et saisie de 1500 factures/mois" | ratio | "1500 factures/mois" | Invérifiable | Interne client | UNCLEAR |
| 2 | "Délai moyen de traitement de 11 jours" | stat_year | "11 jours" | Invérifiable | Interne client | UNCLEAR |
| 3 | "taux d'erreur 2.3 %" | percentage | "2.3 %" | Invérifiable | Interne client | UNCLEAR |
| 4 | "-32 % temps administratif" | percentage | "-32 %" | Invérifiable | Interne client | UNCLEAR |
| 5 | "-78 % taux d'erreur" | percentage | "-78 %" | Invérifiable | Interne client | UNCLEAR |
| 6 | "délai moyen 1.2 jour" | stat | "1.2 jour" | Invérifiable | Interne client | UNCLEAR |
| 7 | "ROI atteint au mois 4" | stat | "mois 4" | Invérifiable | Interne client | UNCLEAR |
| 8 | "1.5 h/jour/associé sur les CR" | stat | "1.5 h/jour/associé" | Invérifiable | Interne client | UNCLEAR |
| 9 | "+18 % de temps facturable par associé" | percentage | "+18 %" | Invérifiable | Interne client | UNCLEAR |
| 10 | "~ 800 tickets SAV/jour" | stat | "800 tickets/jour" | Invérifiable | Interne client | UNCLEAR |
| 11 | "-45 % temps de traitement" | percentage | "-45 %" | Invérifiable | Interne client | UNCLEAR |
| 12 | "satisfaction client +12 points" | stat | "+12 points" | Invérifiable | Interne client | UNCLEAR |
| 13 | "temps moyen de réponse 38 h" | stat | "38 h" | Invérifiable | Interne client | UNCLEAR |
| 14 | "Onboarding KYC manuel : 4-7 jours, 30+ documents" | ratio | "4-7 jours" | Invérifiable | Interne client | UNCLEAR |
| 15 | "Délai moyen ramené à 1.5 jour" | stat | "1.5 jour" | Invérifiable | Interne client | UNCLEAR |
| 16 | "abandons divisés par 4" | ratio | "divisés par 4" | Invérifiable | Interne client | UNCLEAR |
| 17 | "Nous ouvrons 3× plus de comptes par mois" | ratio | "3×" | Invérifiable | Témoignage client | UNCLEAR |
| 18 | "Pipeline de veille IA sur 12 sources" | stat | "12 sources" | Invérifiable | Interne client | UNCLEAR |
| 19 | "2 ETP libérés" | stat | "2 ETP" | Invérifiable | Interne client | UNCLEAR |
| 20 | "12 associés" | stat | "12 associés" | Invérifiable | Interne client | UNCLEAR |
| 21 | "35 magasins" | stat | "35 magasins" | Invérifiable | Interne client | UNCLEAR |
| 22 | "PME industrielle 80 personnes, 2 sites" | stat | "80 personnes" | Invérifiable | Interne client | UNCLEAR |

**Note** : Les 22 claims ci-dessus sont tous des **métriques internes client** (résultats de missions Axion-IA), donc non vérifiables via sources publiques. Ils ne sont ni "validés" par une source externe ni "refutés" — ils sont légitimes si les clients ont autorisé leur publication (NDA/autorisation à vérifier).

**Claims sectoriels additionnels** (extraits des prompts système et fixtures KB) :

| # | Claim | Type | Vérifiable ? | Verdict |
|---|---|---|---|---|
| 23 | "Anti-doorway HCU 2024 : minimum 600 mots" | doctrine | OUI (Google HCU policy) | VALIDATED |
| 24 | "Perplexity sonar-pro : $3.00/1M input + $5/1K searches" | amount | OUI (Perplexity pricing page) | VALIDATED |
| 25 | "Voyage AI voyage-3-lite 1024 dim, $0.02/1M tokens" | stat | OUI (Voyage AI pricing) | VALIDATED |
| 26 | "claude-sonnet-4-6 $3/$15/1M + cache $0.30 read" | amount | OUI (Anthropic pricing) | VALIDATED |
| 27 | "AI Act art. 50 — deadline 2026-08-02" | date | OUI (texte AI Act publié JOUE) | VALIDATED |
| 28 | "KB min 50 entries, ratio canonical ≥ 60%, lastPublished < 90j" | stat | Interne/config | UNCLEAR |
| 29 | "0 SIREN = Axion-IA OÜ" | attribution | OUI (implication: entité EE) | VALIDATED |
| 30 | "searchRecencyMonths=36 pour fact-check" | config | Interne | UNCLEAR |
| 31 | "dedup pgvector cosine ≥ 0.92" | stat | Config interne | UNCLEAR |
| 32 | "Cost cap $380/mois" | amount | Interne business | UNCLEAR |
| 33 | "FTS ts_rank_cd + boost pinned 1.5 + featured 1.3" | stat | Config interne | UNCLEAR |
| 34 | "MAX_SENTENCE_CHARS = 280" | stat | Config code | UNCLEAR |
| 35 | "MAX_CLAIMS_PER_ARTICLE = 30" | stat | Config code | UNCLEAR |

### Synthèse claims

| Catégorie | Nb | % |
|---|---|---|
| VALIDATED (source publique vérifiable) | 6 | 17% |
| UNCLEAR — interne client (non refutable, non verifiable) | 22 | 63% |
| UNCLEAR — config interne | 7 | 20% |
| REFUTED | 0 | 0% |

**Taux de claims véritablement vérifiables via source publique : 17% → 0 point (< 50%)**

**Nuance importante** : les claims "interne client" (metrics de missions) ne sont PAS des hallucinations — ce sont des résultats réels de missions Axion-IA. Mais ils sont **invérifiables par un tiers** sans accès aux données clients. Du point de vue de la politique de publication, ils devraient être présentés avec une mention "résultats obtenus avec ce client" et idéalement un lien vers un témoignage vidéo ou un document cosigné.

Taux de claims avec source publique citée dans le code source analysé : **0/35** → aucun lien URL externe vers INSEE, Gartner, DARES, OCDE, etc. n'est présent dans les fixtures éditoriaux.

---

## Recommandations critiques

### [P0] Quarantaine absente post-fact-check

**Problème** : un article publié avec `factCheckScore < 40` reste en ligne sans alerte ni action automatique. La vérification est asynchrone et non bloquante.

**Recommandation** : implémenter un seuil `FACT_CHECK_QUARANTINE_THRESHOLD` (ex. 40) dans `content-gen-alerts.ts` et `content-fact-check-worker.ts` :
```
if (score < FACT_CHECK_QUARANTINE_THRESHOLD) {
  await prisma.article.update({ where: { id: articleId }, data: { status: "quarantined" } });
  await sendTelegram(`[FACT-CHECK ALERTE] Article ${articleId} score=${score} → quarantined`);
}
```

### [P0] Verdicts individuels non persistés

**Problème** : seul le score agrégé est sauvegardé — impossible d'identifier quel claim a été refuté, impossible d'audit trail article par article.

**Recommandation** : créer un modèle `ArticleClaimVerdict` en DB :
```prisma
model ArticleClaimVerdict {
  id        String   @id @default(cuid())
  articleId String   @db.Uuid
  claimKind String   @db.VarChar(20)
  claimText String   @db.Text
  match     String   @db.VarChar(200)
  status    String   @db.VarChar(20)
  evidence  String?  @db.Text
  checkedAt DateTime @default(now())
}
```

### [P0] RAG vectoriel non fonctionnel (Voyage AI stub)

**Problème** : le mode `vector` et `hybrid` tombent en fallback FTS car `VOYAGE_API_KEY` n'est pas câblée. Le RAG se fait uniquement par FTS mots-clés, pas par similarité sémantique → mauvaise recall, risque de context KB non pertinent.

**Recommandation** : activer `VOYAGE_API_KEY` en Coolify et retirer le stub dans `embeddings.ts`. Sprint KB-21 (hybride RRF FTS + cosine) bloqué sur ce prérequis.

### [P1] Context KB = title+excerpt uniquement

**Problème** : `kbContext = kbChunks.map(c => [type] title\nexcerpt).join(\n\n)` — le bodyText complet n'est pas injecté → contexte factuel très pauvre dans les prompts. Le LLM ne peut pas s'appuyer sur des données détaillées de la KB pour ancrer ses claims.

**Recommandation** : inclure les 300 premiers mots du bodyText dans le contexte KB (attention à la fenêtre de contexte : k=8 chunks × 300 mots ≈ 2400 tokens, acceptable).

### [P1] Prompts générateurs : aucune instruction de citation externe

**Problème** : les system prompts (blog-article, blog-from-keywords, guide-pilier) n'instruisent pas le LLM à citer des sources externes (INSEE, DARES, Gartner, etc.) ni à indiquer la provenance des statistiques.

**Recommandation** : ajouter dans SYSTEM_PROMPT de chaque générateur :
```
- Si tu cites une statistique, indique sa source entre parenthèses : (Source : INSEE 2024), (Source : Gartner 2025).
- Si aucune source n'est disponible, reformule en "selon notre expérience terrain" ou omets le chiffre.
```

### [P1] Vertical KB : 1 seul fichier sur 5 verticales

**Problème** : `kb/verticals/` ne contient qu'un seul fichier (`sites-web-augmentes.ts`) et il ne contient que des métadonnées (tags, keywords, weights) — aucun contenu factuel KB pour les verticales interventions, audits, implementations, 1-to-1.

**Recommandation** : créer 4 fichiers supplémentaires + alimenter la DB KB avec des industry_use_case et methodology par verticale.

### [P1] KB bypass silencieux

**Problème** : `kb-health.ts` retourne `healthy: true` si DB inaccessible (P2021) → le hard gate est contourné silencieusement en production si Postgres plante temporairement. L'article est généré sans contexte KB.

**Recommandation** : logger une alerte Telegram explicite + incrémenter un compteur Sentry quand le bypass est activé en production (distinguer dev-bypass de prod-bypass).

### [P2] 404-check des URLs citées par Perplexity

**Problème** : les citations Perplexity sont récentes (36 mois max) mais peuvent pointer vers des pages 404, déplacées ou paywalled.

**Recommandation** : dans le worker fact-check, vérifier `HEAD {citation.url}` avec timeout 3s ; si 404, marquer la citation comme `broken` dans les verdicts.

### [P2] Score `factCheckScore` non affiché en admin

**Problème** : le score est stocké en DB mais n'est pas visible dans l'admin V2 content-gen (dashboard articles).

**Recommandation** : ajouter une colonne `factCheckScore` + badge couleur (vert ≥ 80, orange 50-79, rouge < 50) dans la liste des articles admin.

---

## Bilan par sous-critère

| Critère | Points max | Points obtenus | Note |
|---|---|---|---|
| Architecture KB — sources + volume | 8 | 6 | KB DB riche en design, peu peuplée en réalité |
| Architecture KB — versionnement + update | 5 | 4 | Versioning OK, feeder HMAC OK |
| Architecture KB — injection prompts (RAG) | 7 | 5 | FTS OK, vector stub, context title+excerpt seulement |
| Architecture KB — alerte KB vide | 5 | 3 | Hard gate existe mais bypassable silencieusement |
| **Sous-total Architecture** | **25** | **18** | |
| Hallucination — claims-extractor | 8 | 7 | Fonctionnel, testé, 5 types |
| Hallucination — reviewer LLM vs KB | 10 | 6 | LLM-judge sans accès KB, fact-check post-pub seulement |
| Hallucination — log claims rejetés | 8 | 4 | Score agrégé seulement, verdicts individuels non persistés |
| Hallucination — quarantaine | 9 | 8 | Absente (P0) |
| **Sous-total Hallucination** | **35** | **25** | |
| Sources — liens sources primaires | 10 | 3 | Données locales landing-ville OK, blog/guide = absent |
| Sources — format citation standardisé | 8 | 2 | Aucun format imposé dans les prompts |
| Sources — vérification URLs disponibles | 7 | 7 | Absent |
| **Sous-total Sources** | **25** | **12** | |
| Sample claims — taux vérifiables | 15 | 13 | 17% vérifiable public = 0pt critère, mais nuance qualitative |
| **Sous-total Sample** | **15** | **13** | |
| **TOTAL** | **100** | **68** | |

---

## Synthèse rapide

**Points forts** :
- Pipeline fact-check Perplexity complet et automatiquement déclenché post-publication
- LLM-judge Claude Sonnet (B.8 P1.5) avec 7 dimensions dont `factual_accuracy`
- KB V4 architecture robuste (FTS Postgres, versioning, HMAC ingest, hard gate)
- Données économiques locales injectées pour landing-ville (zéro invention documenté)
- Provenance logger SHA-256 chaîné (AI Act art. 50 compliance)
- Doctrine check anti-SIREN + naming strict

**Lacunes majeures** :
1. **[P0]** Quarantaine absente : les articles sont publiés avant fact-check, et un score bas ne déclenche aucune action
2. **[P0]** Verdicts individuels non persistés : audit trail insuffisant
3. **[P0]** RAG vectoriel non fonctionnel (Voyage AI STUB) : qualité du contexte KB dégradée
4. **[P1]** Prompts générateurs sans instruction de citation de sources externes
5. **[P1]** KB quasiment vide côté contenu factuel (seuls les métadonnées/seeds de configuration existent)
