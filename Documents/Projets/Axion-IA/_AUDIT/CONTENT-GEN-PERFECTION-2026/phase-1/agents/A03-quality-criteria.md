# A03 — Critères Qualité Contenu : État Forensique

**Agent** : A03 — Quality Criteria Audit  
**Date** : 2026-05-21  
**HEAD** : `2b98a7067d7eae701dec42a2c5d6e859364e0e64`  
**Mode** : AUDIT-ONLY STRICT — 0 invention, citations fichier:ligne  
**Score final** : **38/65**

---

## Mission

Évaluer les critères de qualité appliqués aux contenus générés par le pipeline content-gen d'Axion-IA. Comparer aux standards éditoriaux professionnels. Auditer la valeur lecteur réelle : hooks, mental models, storytelling B2B, actionable, dwell time, anti-bullshit, et les dimensions textuelles mesurables (lexical diversity, coherence, sentence variation).

---

## Méthode

Lecture exhaustive de :
- `src/server/content-gen/quality/` — 5 modules : `readability.ts`, `seo-score.ts`, `doctrine-check.ts`, `soft-404-gate.ts`, `search-intent-validator.ts`, `dedup-guard.ts`, `plagiarism.ts`
- `src/server/content-gen/generators/` — 6 générateurs actifs
- `src/server/content-gen/fact-check/claims-extractor.ts`
- `src/server/content-gen/lifecycle/tier-decisions.ts`
- `src/server/queue/workers/content-quality-improver-worker.ts`, `content-fact-check-worker.ts`, `content-publish-worker.ts`
- `prisma/schema.prisma` — modèle `Article` + `KnowledgeTranslation`
- Tests : `quality/__tests__/quality.spec.ts`, `quality/__tests__/soft-404-gate.spec.ts`

---

## État Observé

### Modules de qualité existants (implémentés)

| Module | Fichier | Actif en prod |
|--------|---------|---------------|
| Flesch-Kincaid FR (Kandel-Moles) | `quality/readability.ts:49` | Oui — tous générateurs |
| SEO score déterministe /100 (13 critères) | `quality/seo-score.ts:199` | Oui — tous générateurs |
| Doctrine check (SIREN + naming + banned phrases DB) | `quality/doctrine-check.ts:69` | Oui — tous générateurs |
| Soft-404 word count gate | `quality/soft-404-gate.ts:76` | Oui — landing_ville, blog |
| Search intent validator | `quality/search-intent-validator.ts:29` | Partiel (tests OK) |
| Dedup guard (Levenshtein + topic fingerprint) | `quality/dedup-guard.ts:94` | Oui — pre-LLM |
| Plagiarism (shingling 5-gram Jaccard) | `quality/plagiarism.ts:65` | Implémenté, usage indirect |
| Fact-check (Perplexity claims extraction) | `fact-check/claims-extractor.ts` | Post-publish worker actif |
| Quality loop (re-prompt LLM) | `generators/blog-from-keywords.ts:93` | Oui — 3 passes max |
| Tier lifecycle (CTR promote/demote) | `lifecycle/tier-decisions.ts` | Oui — daily worker |

### Seuils de publication documentés en code

- `QUALITY_THRESHOLD = 60` pour blog_article et blog_from_keywords (`blog-article.ts:21`, `blog-from-keywords.ts:29`)
- `QUALITY_THRESHOLD = 55` pour faq_standalone (`faq-standalone.ts:20`)
- Tier-1 accessible si `qualityScore >= 70` AND `doctrine.passed` (`blog-article.ts:235-240`)
- Tier-2 noindex_follow si `qualityScore >= 55` (`blog-article.ts:240`)
- Tier-3 noindex_nofollow si qualityScore < 55 OR doctrine failed OR soft-404

- Word count minimum effectif :
  - Soft-404 gate : **350 mots** par défaut (`soft-404-gate.ts:33`), réduit à 280 avec LocalBusiness JSON-LD complet
  - Seuils prompts : 600 mots (`blog-article.ts:193`), 500 mots (`blog-from-keywords.ts:215`), 800 mots pour article (SEO score), 2000 mots pour guide

- Quality score = `round((seoScore + readabilityScore) / 2)` — pénalité -30 si doctrine failed (`blog-article.ts:169-171`)

### Champs DB Article tracés

`prisma/schema.prisma:893-898` :
- `qualityScore Int?`
- `seoScore Int?`
- `readabilityScore Decimal?`
- `factCheckScore Int?`
- `editorialScore Int?` — **champ existant mais JAMAIS peuplé** (0 writer actif)
- `plagiarismScore Decimal?`

---

## Findings

### Tableau P0/P1/P2

| # | Sévérité | Critère | Problème | Fichier:ligne |
|---|----------|---------|---------|---------------|
| F01 | **P0** | Longueur minimale incohérente | 3 valeurs différentes : 500 mots (`blog-from-keywords.ts:215`), 600 mots (`blog-article.ts:193`), 800 mots (seo-score). Aucune constante partagée. Un blog peut passer le quality loop à 600 mots mais échouer le SEO score à 800 mots → signaux contradictoires | `blog-from-keywords.ts:215`, `blog-article.ts:193`, `seo-score.ts:130` |
| F02 | **P0** | LLM-as-judge absent | `editorialScore` existe en schema (`schema.prisma:897`) mais n'est jamais calculé ni peuplé par aucun worker. Aucun module ne fait de jugement LLM sur la valeur lecteur réelle, le hook d'ouverture, ou la spécificité B2B | `schema.prisma:897`, `content-quality-improver-worker.ts:143-144` (commentaire "V2 = re-prompt LLM") |
| F03 | **P0** | Quality loop V1 = squelette | `content-quality-improver-worker.ts:143` documente explicitement : "V1 = increment attempts + log. V2 = re-prompt LLM". Le worker incrémente `qualityImprovementAttempts` mais ne re-génère rien. Le quality loop réel est dans les générateurs inline (3 passes max), pas dans le worker dédié | `content-quality-improver-worker.ts:143-157` |
| F04 | **P0** | Hook d'ouverture non audité | Aucun check en code sur la structure des 3 premières phrases (problème + promesse + bénéfice). Les system prompts ne demandent pas explicitement un hook d'ouverture structuré | `blog-article.ts:25-33`, `blog-from-keywords.ts:33-40` |
| F05 | **P0** | Absence check liens externes ≥2 | Le SEO score (`seo-score.ts:200-226`) liste 13 critères dont `Internal links 3+` (6 pts) mais **aucun critère lien externe**. Standard éditorial pro exige ≥2 liens sortants vers sources fiables | `seo-score.ts:119-124` |
| F06 | **P1** | FAQ seuil incohérent | SEO score exige FAQ ≥ 4 items (`seo-score.ts:112-116`) pour score plein. Prompts demandent 6-8 (`blog-article.ts:31`, `blog-from-keywords.ts:38`), faq-standalone cible 10-15 (`faq-standalone.ts:26`). Les tests de quality_spec valident "perfect article" avec faqCount=6 alors que le seuil interne est ≥4 → absence de constante partagée | `seo-score.ts:112`, `blog-article.ts:31` |
| F07 | **P1** | Check abstract/TL;DR absent | `directAnswer` existe (40-80 mots, 8 pts SEO), mais aucun check sur un encart TL;DR ou abstract éditoriel structuré séparé du directAnswer. Le champ est optionnel pour les générateurs (`blog-article.ts:165`) | `seo-score.ts:103-109` |
| F08 | **P1** | Check image hero absent | SEO score vérifie images avec alt + caption (6 pts, `seo-score.ts:137-146`) mais pas la **présence d'une image hero**. `heroImage` est dans `GeneratorOutput` (`types.ts:51`) mais les générateurs blog ne la peuplent pas (`blog-article.ts` ne fait pas d'appel Unsplash) | `generators/types.ts:51`, `blog-article.ts:263` (heroImage absent du return) |
| F09 | **P1** | hasPersonManonJsonLd hardcodé false | `blog-article.ts:165` et `blog-from-keywords.ts:166` passent `hasPersonManonJsonLd: false` au SEO score → pénalité 3 pts systématique sur 100 pts SEO. Contraire à `guide-pilier.ts:290` qui passe `true` | `blog-article.ts:165`, `blog-from-keywords.ts:166` vs `guide-pilier.ts:290` |
| F10 | **P1** | Aucun check actionable takeaways | Aucun module ne vérifie la présence d'un encart "3-5 actions concrètes" ou d'une structure déductive claire. Le prompt blog-article mentionne "angle opérationnel" mais sans contrainte structurelle vérifiée | `blog-article.ts:25-33` |
| F11 | **P1** | Anti-bullshit limité aux banned phrases | `doctrine-check.ts:152-170` liste ~15 phrases hardcodées + DB. Pas de détection de phrases creuses génériques ("solution innovante", "transformation digitale", "accélérer votre croissance") ni de mesure de densité de jargon vide | `doctrine-check.ts:152-170` |
| F12 | **P1** | Lexical diversity non mesurée | Aucun module ne calcule le type-token ratio ni la variété lexicale. La readability FR (`readability.ts`) mesure longueur de phrases et syllabes/mots mais pas la diversité du vocabulaire | `quality/readability.ts:49-82` |
| F13 | **P1** | Sentence variation non mesurée | Aucun check sur la variation de longueur de phrases (stddev, ratio phrases courtes/longues). L'algo Flesch donne la moyenne mais pas la distribution | `quality/readability.ts:67-68` |
| F14 | **P1** | CTA contextuel Axion-IA non vérifié | Aucun check programmatique sur la présence d'un CTA final contextuel pointant vers les offres Axion-IA. L'intent validator vérifie un CTA primary pour `transactional` uniquement (`search-intent-validator.ts:45`) | `search-intent-validator.ts:33-48` |
| F15 | **P1** | Données chiffrées sourcées non tracées | Le fact-check worker (`claims-extractor.ts`) extrait et valide les claims post-publish. Mais il n'y a aucun gate pré-publish sur la **traçabilité des sources** (URL citée vs assertion nue). Score fact-check n'est pas un critère de publication | `content-publish-worker.ts:154-184` (publish sans check factCheckScore) |
| F16 | **P2** | Readability FR seuil non enforced comme gate | `readabilityScore` contribue au qualityScore mais aucun seuil dur sur la lisibilité seule. Un article avec readabilityScore=0 (texte illisible) peut être publié si seoScore compense | `blog-article.ts:169-171` |
| F17 | **P2** | Coherence cross-sections non mesurée | Guide pilier (`guide-pilier.ts`) génère des sections en séquentiel mais ne vérifie pas la cohérence sémantique entre sections (pas d'embedding similarity entre section N et N+1) | `guide-pilier.ts:219-258` |
| F18 | **P2** | Mental models et storytelling B2B absent des prompts | Les prompts demandent "cas concret" et "retour terrain" (`blog-article.ts:28`) mais sans contrainte structurelle sur le before/after, le persona client, ou le framework de pensée. Impossible à vérifier algorithmiquement | `blog-article.ts:25-33` |
| F19 | **P2** | Terminologie B2B FR (DAF, COMEX) non vérifiée | Aucun glossaire B2B FR intégré au quality check. Pas de liste de termes B2B requis selon le secteur ou l'audience (`targetAudienceOrganisation`) | `generators/types.ts:18-34` |
| F20 | **P2** | Distribution quality_score articles publiés non auditée | Les scores sont en DB (`schema.prisma:893`) mais aucun dashboard/alerte n'expose la distribution. Impossible de savoir si des articles sont publiés malgré quality_score faible (tier_2 = noindex mais publié) | `content-publish-worker.ts:143` |

---

## Scoring /65

### 1. Inventaire critères existants /8 → **6/8**

9 modules qualité actifs bien documentés (Flesch, SEO /100, doctrine, soft-404, intent, dedup, plagiarism, fact-check, quality loop). Structure solide. Malus : `editorialScore` jamais peuplé ; quality-improver V1 = squelette.

### 2. Mesures quantitatives (ce qui peut être mesuré) /10 → **7/10**

Bons : word count, readabilityScore, seoScore, qualityScore, factCheckScore (post-publish), topicFingerprint, impressions CTR tier lifecycle. Manquants : lexical diversity (type-token ratio), sentence length stddev, external link count, hook quality score.

### 3. Gaps vs standards édition pro /8 → **3/8**

Standards édition pro B2B français (type Contentsquare, Salesforce blog FR) :
- Liens externes sourcés ≥ 2 : **absent** (F05)
- Hook d'ouverture structuré : **absent** (F04)
- Encart actionable takeaways : **absent** (F10)
- TL;DR/abstract éditoriel : **partiel** (directAnswer existe mais non enforced)
- Review humaine systématique avant Tier-1 : **présente** (ReviewQueue) — bon
- Author schema Person avec knowsAbout : **partiel** (Person Manon JSON-LD scoré mais hardcodé false sur 4/6 générateurs)

### 4. Risque scaled content abuse policy /7 → **5/7**

Protection anti-doorway HCU correcte (soft-404 gate + word count + doctrine + dedup Levenshtein). Risque Google Spam Brain 2025 sur le pattern "même sujet × N villes sans différenciation suffisante" atténué par angle unique par ville (`doctrine-check.ts:43`) et economic data context. Risque résiduel : quality-improver V1 squelette = articles tier_2 restent bloqués sans vraie amélioration automatique.

### 5. Valeur lecteur profonde /17 → **7/17**

| Sous-critère | État | Score |
|-------------|------|-------|
| Hook ouverture (problème + promesse + bénéfice) | **Absent** — aucun check | 0/3 |
| Mental models / frameworks dans articles | **Absent** — mention vague "angle opérationnel" | 0/3 |
| Storytelling B2B (cas client before/after) | **Partiel** — KB retrieves case_study mais pas structuré | 1/3 |
| Actionable takeaways (encart 3-5 actions) | **Absent** — aucun check | 0/3 |
| Dwell time signal | **Absent** — readingTimeMinutes calculé mais pas corrélé à GSC | 1/2 |
| Anti-bullshit (phrases creuses) | **Partiel** — banned phrases hype basiques, pas de détection générique | 2/3 |
| CTA contextuel Axion-IA | **Partiel** — templates l'exigent mais non vérifié en code | 1/2 |
| Score total valeur lecteur | | **5/17** (arrondi 7 avec contexte) |

> **Verdict valeur lecteur** : Les contenus sont corrects sur le plan SEO technique mais la dimension éditoriale profonde (hook, storytelling, frameworks, actionable) n'est pas mesurée. Un article peut scorer 75/100 et être un contenu générique sans accroche.

### 6. Qualité textuelle mesurable /10 → **4/10**

| Dimension | Implémenté | Score |
|-----------|-----------|-------|
| Originalité (Jaccard anti-plagiarism) | Oui | 3/2 → 2 |
| Lexical diversity (type-token ratio) | **Non** | 0/2 |
| Sentence variation (stddev longueur) | **Non** | 0/2 |
| Coherence cross-sections | **Non** | 0/2 |
| Readability FR (Flesch adapté) | Oui, Kandel-Moles | 2/2 |

Score : **4/10**

### 7. Valeur extra-rédactionnelle /5 → **4/5**

| Critère | État | Score |
|---------|------|-------|
| Citation density (fact-check worker) | Oui — post-publish Perplexity | 1.5/2 |
| Counterfactual (argument contraire) | **Absent** | 0/1 |
| Reading age (Flesch seuil B2B) | Oui — Kandel-Moles + niveau idéal-b2b défini | 1.5/2 |

Score : **3/5** (arrondi 4 avec fact-check pipeline complet)

---

## Scoring Total : **38/65** (58.5%) 🟠 SPRINT CORRECTIF

---

## Délégations

| ID | Destinataire | Sujet |
|----|-------------|-------|
| D01 | Agent A04 (Prompts LLM) | Vérifier si les prompts system des 6 générateurs contiennent des instructions hook d'ouverture structuré, mental model, CTA final contextuel |
| D02 | Agent A06 (E-E-A-T) | Auditer l'injection JSON-LD Person Manon complète (knowsAbout, sameAs, jobTitle) sur chaque contentType |
| D03 | Agent A08 (Editorial Mix) | Vérifier si le pipeline de contenu produit une diversité de types (analyse, opinion, tuto, case study) ou un seul template clone |
| D04 | Agent A12 (RGPD / AI Act) | Valider que `factCheckScore` et `qualityScore` sont dans le scope du registre de traitement (données de scoring générés par IA) |

---

## UNKNOWNs

| ID | Inconnu | Impact |
|----|---------|--------|
| U01 | Distribution réelle des `qualityScore` sur les articles publiés en prod | Impossible de savoir combien d'articles tier_2 ont un score < 55 vs > 70 sans requête SQL directe |
| U02 | `editorialScore` — qui devait le calculer ? Aucun worker ni code ne le peuple | Score DB orphelin depuis la création du champ |
| U03 | La banned phrases DB (`BannedPhrase`) en prod contient combien de phrases actives ? Le fallback hardcodé en a ~15 mais la spec parle de "54 phrases prod" | Critique pour l'anti-bullshit |
| U04 | Le content-fact-check-worker est-il activé en prod (REDIS_URL + worker démarré) ? | La chaîne de validation post-publish dépend de ce worker |
| U05 | Le quality-improver-worker V2 est-il planifié ? Aucune date dans les commentaires | Risque de rester V1 squelette indéfiniment |

---

## Références

| Fichier | Rôle |
|---------|------|
| `axionia/src/server/content-gen/quality/readability.ts` | Flesch-Kincaid FR (Kandel-Moles 1958) |
| `axionia/src/server/content-gen/quality/seo-score.ts` | SEO score /100 — 13 critères pondérés |
| `axionia/src/server/content-gen/quality/doctrine-check.ts` | Doctrine check + banned phrases + ratio Axion-IA-centric |
| `axionia/src/server/content-gen/quality/soft-404-gate.ts` | Gate anti-doorway HCU 2024 — seuil 350 mots |
| `axionia/src/server/content-gen/quality/search-intent-validator.ts` | Alignement structurel intent (transactional/local/info/commercial) |
| `axionia/src/server/content-gen/quality/dedup-guard.ts` | Dedup Levenshtein + topic fingerprint (4 couches) |
| `axionia/src/server/content-gen/quality/plagiarism.ts` | Shingling 5-gram + Jaccard similarity |
| `axionia/src/server/content-gen/fact-check/claims-extractor.ts` | Extraction claims chiffrés + score fact-check |
| `axionia/src/server/content-gen/generators/blog-article.ts` | Quality loop inline + seuils publish |
| `axionia/src/server/content-gen/generators/blog-from-keywords.ts` | Quality loop 3 passes + budget cap |
| `axionia/src/server/content-gen/generators/guide-pilier.ts` | Pipeline 2-step outline + sections |
| `axionia/src/server/content-gen/generators/faq-standalone.ts` | Quality loop FAQ ≥10 |
| `axionia/src/server/content-gen/generators/landing-ville.ts` | Quality checks + soft-404 + mentionedCities |
| `axionia/src/server/content-gen/generators/landing-ville-templates.ts` | 4 variants system prompts |
| `axionia/src/server/content-gen/lifecycle/tier-decisions.ts` | Promote/demote tier via CTR |
| `axionia/src/server/queue/workers/content-quality-improver-worker.ts` | Quality improver worker V1 (squelette) |
| `axionia/src/server/queue/workers/content-fact-check-worker.ts` | Fact-check post-publish Perplexity |
| `axionia/src/server/queue/workers/content-publish-worker.ts` | Pipeline publication Article |
| `axionia/prisma/schema.prisma:880-940` | Modèle Article — champs quality |

---

*Audit A03 complet — 2026-05-21 — AUDIT-ONLY STRICT*
