# PROMPT AUDIT EXPLICATIF — Comment le content-gen fonctionne en profondeur
## AxionIA — Mécaniques internes génération : sources, titres, volumes par ville, France générale, conformité Google/IA 2026

**Date création** : 2026-05-23
**Type** : Audit forensique EXPLICATIF (comprendre comment ça marche)
**Mode** : **AUDIT-ONLY strict** — zéro modif code, zéro commit
**Effort estimé** : 6-8h autopilot
**Modèle recommandé** : Sonnet 4.6
**Demandé par Will** : 2026-05-23 — "comment sont générés les contenus, à partir de mots-clés ou autre ? comment les titres ? combien d'articles par ville et comment calculé ? metaTitle/metaDescription conformes Google/IA ? articles France générale ?"

---

## 0. MISSION

Produire un **document explicatif exhaustif** qui répond précisément aux 6 questions Will sur le fonctionnement du système content-gen AxionIA actuel.

### Questions Will explicites à répondre

1. **Comment sont générés les contenus** ? Pour chaque des 7 types (`blog_pillar`, `landing_ville`, `blog_from_keywords`, `blog_from_title`, `blog_from_rss`, `qa_derived`, `comparison`) :
   - Quelle est la source de départ (mot-clé ? titre ? RSS ? Q/R ? autre) ?
   - Quel algorithme de sélection ?
   - Quelle longueur ? Quelle structure ?

2. **Comment les titres sont générés** ?
   - H1 = mot-clé brut ? variation ? réécriture LLM ?
   - Le keyword principal apparaît-il dans le H1 ?
   - Quelle créativité tolérée (1-1 vs réécriture sémantique) ?

3. **Combien d'articles par ville** ?
   - Formule mathématique appliquée
   - Distribution par tier population (Paris vs ville 5000 hab)
   - Distribution par cible (tpe/pme/eti)
   - Cibles 39 villes pilote vs 2100 villes (si Sprint Perfection 2026 livré)

4. **MetaTitle / MetaDescription conformes** ?
   - Google Search Central best practices (mai 2026)
   - Longueur metaTitle ≤ 60 chars / metaDescription ≤ 155 chars
   - Keyword présence
   - Optimisation CTR

5. **Articles France générale** (non ville-spécifique) ?
   - Existe-t-il des articles avec `anchorVilleSlug=null` ?
   - Distribution villes vs France générale
   - Pour quels types de contenu ?

6. **Conformité IA (AI Overviews / SGE / ChatGPT / Perplexity) mai 2026** ?
   - Best practices respectées ?
   - Structure factuelle, sources, paragraphes ouverts ?

**Sortie principale** : `COMMENT-CONTENT-GEN-FONCTIONNE.md` (rapport explicatif complet, ~800-1200 lignes lisible Will).

---

## 1. CONTEXTE PROJET

### Décisions Will canoniques FIGÉES (ne pas re-demander)
- D-W1-5, D-P5-1-6, D1-D5, D7 société française pure
- Exclusions Will : Wikidata, DPA, CF WAF, toggle auto/manuel publication

### Mode AUDIT-ONLY
- ❌ Aucun commit, push, modif code, création données
- ✅ Lecture exhaustive code source
- ✅ Queries DB lecture pour statistiques observées
- ✅ Échantillonnage articles publiés via curl
- ✅ Création fichiers UNIQUEMENT dans `_AUDIT/AUDIT-COMMENT-CONTENT-GEN-FONCTIONNE-2026-05-23/`

---

## 2. FICHIERS À LIRE EN PREMIER

### Code source — Generators (LIRE INTÉGRALEMENT chaque fichier)
1. `src/server/content-gen/generators/blog-pillar.ts`
2. `src/server/content-gen/generators/landing-ville-generator.ts`
3. `src/server/content-gen/generators/blog-from-keywords.ts`
4. `src/server/content-gen/generators/blog-from-title.ts`
5. `src/server/content-gen/generators/blog-from-rss.ts`
6. `src/server/content-gen/generators/qa-derived.ts`
7. `src/server/content-gen/generators/comparison.ts`
8. `src/server/content-gen/generators/blog-article.ts` (base si existe)
9. `src/server/content-gen/generators/types.ts` (GeneratorBaseInput)

### Code source — Sélection sources
10. `src/server/content-gen/keyword-selector.ts` (sélection keyword atomique)
11. `src/server/content-gen/rss-fetcher.ts` ou équivalent
12. `src/server/content-gen/brand/brand-voice.ts`
13. `src/server/content-gen/admin/coverage.ts` (création campagne, calcul jobs)

### Code source — Workers orchestration
14. `src/server/queue/workers/content-gen-orchestrator-worker.ts` (calcul volumes)
15. `src/server/queue/workers/content-gen-worker.ts`
16. `src/server/queue/workers/content-publish-worker.ts`

### Code source — SEO meta + JSON-LD
17. `src/lib/seo.ts` (buildArticleJsonLd, buildMetaTitle, buildMetaDescription)
18. `src/lib/slug.ts`
19. `src/lib/brand.ts`

### Schema DB
20. `prisma/schema.prisma` (modèles `Article`, `ContentGenJob`, `CoverageCampaign`, `Keyword`)

### Seeds keywords (pour comprendre les sources)
21. `src/content/keywords/master.ts`
22. `src/content/keywords/types.ts`
23. `src/content/keywords/g1-audit.ts` à `g8-audiences-manquantes.ts` (~17 fichiers)

### Mémoires Claude
24. `axionia_keywords_747seeds_2026-05-20.md`
25. `axionia_decisions_will_final_2026-05-21.md`
26. `axionia_p4_decisions_canoniques_2026-05-21.md`
27. `axionia_bug5_generators_phase_abc_2026-05-21.md`
28. `axionia_content_gen_p1_5_livre_2026-05-21.md`
29. Verdicts audits content-gen précédents (phase-1 à 5)

---

## 3. SPAWN 23 SOUS-AGENTS PARALLÈLES

Chaque agent produit un rapport `agents/<bloc>/<numéro>-<nom>.md`. Score `/50` honnête.

---

### 🔹 BLOC A — Sources de génération (5 agents)

#### A-01 — Sources mots-clés (/50)
- Comment `selectKeyword()` choisit le keyword ?
- Lock atomique Postgres `FOR UPDATE SKIP LOCKED` (acquis P1.5 B.5)
- Filtres : verticale, searchIntent, isLongTail, isLocal, cityIds, clusterId
- Rotation équitable : `usageCount` + `lastUsedAt` (LRU-like)
- Mapping module → vertical (cf. seed-keywords.ts) :
  - `audit` → `audits`
  - `interventions-formations` → `interventions_formations`
  - `implementation` → `implementations`
  - `coaching-1-to-1` → `un_a_un`
  - `codage-developpement` → `sites_web_augmentes`
- Y a-t-il fallback si DB unavailable ? Round-robin in-memory ?
- Documenter EXACTEMENT le flux

#### A-02 — Sources RSS feeds (/50)
- Quels flux RSS sont configurés ? Table `RssSource` ?
- Cron fetch fréquence ?
- Filtres relevance (mots-clés cible, langue, recency) ?
- Comment `blog-from-rss` reçoit l'entrée RSS ?
- Champs `rssSourceName / rssItemTitle / rssItemSummary / rssItemLink` (acquis BUG-5)

#### A-03 — Sources titres imposés (blog-from-title) (/50)
- Comment Will fournit un titre ? Via admin UI ?
- Stockage : champ `inputPayload.titleForced` ?
- Validation longueur, format ?
- Le titre est-il modifié par l'IA ou conservé strictement ?
- Quelle quality_loop ? 3 passes (D2 P4 si pilier-équivalent) ?

#### A-04 — Sources comparatifs (comparison) (/50)
- Comment les paires à comparer sont sélectionnées ?
- Liste partenaires (acquis P3 sprint si livré) ? Table `Partners` ?
- Comparatifs auto-générés OU manuels Will ?
- Format obligatoire : `<table>` HTML (BUG-5 commit `8b3f470`)
- Hard gate post-loop : throw si table absente

#### A-05 — Sources questions Q/R (qa-derived) (/50)
- D'où viennent les questions ?
- Generated depuis keywords AEO (`g4-aeo.ts`) ?
- Format conversationnel (voice search intent) ?
- 1 LLM call pour Q/R (acquis BUG-5)
- `buildQABodyHtml` avec QAPage JSON-LD + Speakable embarqué

---

### 🔹 BLOC B — 7 types de contenu (7 agents)

#### B-01 — blog_pillar (/50)
- Source : mot-clé via `selectKeyword()` avec `isLongTail=false` probable
- Longueur cible : ~2500-3500 mots
- Structure attendue : H1 + intro + 8-12 H2 + TOC + FAQ + conclusion
- 3 itérations qualité (D2 P4)
- LLM-judge seuil 6.0/60 (D1 P4)
- Hero image obligatoire (≥3 piliers selon brief Will original)

#### B-02 — landing_ville (/50)
- Source : `selectKeyword({ vertical, cityId })` géolocalisé
- Structure : H1 ville + intro + sections services × cible + témoignages + LocalBusiness JSON-LD
- 3 itérations qualité (D2 P4)
- Section "Villes proches" via `getNearbyVillesExtended()` (acquis P3 QW-10)
- Image hero locale ou verticale

#### B-03 — blog_from_keywords (/50)
- Source : `selectKeyword()` standard, sans contrainte ville
- Longueur : ~1000-1500 mots
- 2 itérations qualité (D2 P4)
- H1 doit contenir keyword (P1-2 P4 si livré)

#### B-04 — blog_from_title (/50)
- Source : titre fourni Will via admin
- 2 itérations qualité
- Quality loop 3 passes (acquis BUG-5 Phase A)
- Tier_1 si score ≥ 70

#### B-05 — blog_from_rss (/50)
- Source : RSS feed item (cf. A-02)
- ⚠️ **PAS de mention "Source :"** (exigence Will explicite 2026-05-22)
- Similarité SimHash < 0.50 vs source
- Tier_2 max (acquis BUG-5 Phase A)

#### B-06 — qa_derived (/50)
- Source : question (cf. A-05)
- 1 LLM call (pas de génération longue)
- QAPage JSON-LD + Speakable
- Tier_2 + anti-thin HCU ≥ 300 mots

#### B-07 — comparison (/50)
- Source : paire à comparer (cf. A-04)
- `<table>` obligatoire (hard gate)
- Quality ≥ 75 → tier_1
- LongueurCible : ~1500-2500 mots

---

### 🔹 BLOC C — Génération titre + metaTitle + metaDescription (3 agents)

#### C-01 — Génération H1/titre (/50)
**Question critique** : comment le H1 est construit ?

Vérifications :
- H1 = mot-clé brut directement ? Ex : "audit IA Paris" → H1 = "Audit IA Paris" ?
- OU réécriture LLM pour bénéfice/contexte ? Ex : "audit IA Paris" → H1 = "Auditer son IA à Paris : guide complet 2026" ?
- Le keyword apparaît-il systématiquement dans le H1 ? (P1-2 P4 instruction prompt)
- Validation post-LLM : keyword in H1 sinon `needs_review` ?
- Pour blog_from_title : H1 = titre forcé Will (acquis BUG-5)
- Documenter le pattern par type

#### C-02 — metaTitle (/50)
**Conformité Google Search Central** :
- ≤ 60 chars (best practice 2026, 50-60 idéal)
- Keyword principal inclus (acquis P1-3 P4 si livré)
- Brand "Axion-IA" suffix ?
- Unique par URL
- Pas de duplication entre articles

Vérifications :
- Échantillonner 10 articles via curl
- Mesurer longueur metaTitle
- Vérifier keyword présence
- Détecter doublons

```sql
-- Vérifier doublons en DB
SELECT meta_title, COUNT(*) FROM articles GROUP BY meta_title HAVING COUNT(*) > 1;
```

#### C-03 — metaDescription (/50)
**Conformité Google Search Central** :
- ≤ 155 chars (best practice 2026, 140-155 idéal)
- Phrase complète avec CTA implicite
- Keyword inclus mais naturel
- Unique par URL

Vérifications :
- Échantillonner 10 articles
- Mesurer longueur
- Détecter doublons

---

### 🔹 BLOC D — Calcul volumes par ville (3 agents)

#### D-01 — Combien d'articles par ville (formule) (/50)
**Question critique Will** : comment ce nombre est calculé ?

Lire dans `src/server/content-gen/admin/coverage.ts` :
- `createCampaign(input)` → comment input.totalTargetCount est ventilé entre villes ?
- Distribution par ville :
  - Si `anchorVilleSlugs.length === 1` : 100% de totalTargetCount pour cette ville
  - Si `anchorVilleSlugs.length > 1` : divisé équitablement ? ou pondéré ?
- Algorithme distribution `typeDistribution × villes × cibles`
- Si Sprint Campaign Controls livré : `cityProcessingMode = sequential` vs `parallel` affecte calcul ?

Exemple calcul attendu :
```
Campagne PME audits :
  totalTargetCount = 50
  anchorVilleSlugs = ["paris", "lyon", "marseille"]
  typeDistribution = { blog_pillar: 20%, landing_ville: 40%, blog_from_keywords: 40% }
  audienceMix = { pme: 100% }

  → 50 articles répartis :
    Paris : 17 articles (10 landing_ville + 7 blog_from_keywords + ... etc.)
    Lyon : 17 articles
    Marseille : 16 articles
```

Vérifier la formule réelle dans le code.

#### D-02 — Distribution par tier population (/50)
**Question Will potentielle** : Paris reçoit-elle plus d'articles que la dernière ville 5000 hab ?

Lire si Sprint Perfection 2026 (Cities DB 2100) livré :
- Modèle `City` avec `populationTier` (1=>100k, 2=20k-100k, 3=10k-20k, 4=5k-10k)
- Algorithme pondère-t-il par populationTier ?
- Logique attendue : Tier 1 reçoit 10x plus que Tier 4 (raisonnable pour ROI)

Si pas pondéré : noter dans rapport.

#### D-03 — Distribution cibles tpe/pme/eti par ville (/50)
- `audienceMix` JSON sur `CoverageCampaign`
- Comment Will configure : 100% PME ou 60/30/10 (PME/ETI/TPE) ?
- Distribution validation : somme = 100% obligatoire (server action validation)
- Application à la génération : keyword filtré par cible ?

---

### 🔹 BLOC E — Articles France générale (2 agents)

#### E-01 — Articles non-ville-spécifique (/50)
**Question critique Will** : "Y a-t-il des articles aussi généraux qui concernent toute la France et pas uniquement sur ville ?"

Vérifications :
```sql
-- Articles sans anchorVilleSlug
SELECT COUNT(*) FROM articles WHERE anchor_ville_slug IS NULL;
-- Et par content_type
SELECT content_type, COUNT(*) FROM articles WHERE anchor_ville_slug IS NULL GROUP BY content_type;
```

Lire les generators :
- `blog_pillar`, `blog_from_keywords`, `blog_from_title`, `blog_from_rss`, `qa_derived`, `comparison` : ces types acceptent-ils `anchorVilleSlug=null` (article national général) ?
- `landing_ville` exige-t-il `anchorVilleSlug` non-null obligatoire ?

Si seuls les piliers et keywords-based peuvent être nationaux, documenter.

#### E-02 — Distribution villes vs France générale (/50)
- Sur les ~X articles publiés actuellement :
  - Combien sont ville-spécifiques ?
  - Combien sont France générale ?
- Recommandation : ratio idéal pour SEO ?
  - Trop villes = pas d'autorité nationale
  - Trop national = pas de Local Pack
  - Best practice 2026 : ~50/50 ? À documenter selon contexte AxionIA.

---

### 🔹 BLOC F — Conformité Google / IA 2026 (3 agents)

#### F-01 — Conformité Google Search Central 2026 (/50)
**Best practices mai 2026** :
- metaTitle 50-60 chars
- metaDescription 140-155 chars
- H1 unique par page
- Heading hierarchy logique H1 → H2 → H3 (pas H1 → H4)
- URL slug court hyphenated lowercase sans accents
- Schema.org JSON-LD valide
- Mobile-first (LCP ≤ 2500ms mobile)
- INP ≤ 200ms (remplace FID en 2024)
- CLS ≤ 0.1

Vérifications par échantillonnage 10 articles :
- curl + parse `<title>`, `<meta>`, `<h1>`, JSON-LD

#### F-02 — Conformité AI Overviews / SGE 2026 (/50)
**Best practices mai 2026** :
- Paragraphe ouverture 40-60 mots (extractable AI Overview)
- Réponse factuelle directe dès le premier paragraphe
- ≥ 2 sources externes autorité (acquis P3 sprint si livré)
- Structure : qu'est-ce que / pourquoi / comment / quand
- `aiGenerated: true` JSON-LD (acquis P1.5)
- `SpeakableSpecification` (acquis P3 QW-1)
- Pas de paywall (les bots IA ne peuvent pas lire)
- HTTPS partout

Vérifications :
- Échantillonner 10 articles
- Parser premier paragraphe (longueur 40-60 mots ?)
- Compter sources externes (≥ 2 ?)
- Vérifier JSON-LD speakable présent

#### F-03 — Conformité Voice Search + Featured Snippets (/50)
**Best practices mai 2026** :
- Featured Snippet : paragraphe 40-60 mots formaté + data-aeo="tldr"
- Liste à puces 5-8 items pour questions "comment faire X étapes"
- Tableau pour questions "comparer X vs Y"
- Voice search : phrases courtes max 15 mots, ton conversationnel
- Questions naturelles en H2/H3 ("Comment faire un audit IA ?")

Vérifications :
- Échantillonner 5 articles `qa_derived` + 5 `comparison`
- Vérifier structure attendue
- Mesurer longueur paragraphes voice

---

### 🔹 G — Cross-cutting + Recommandations (1 agent)

#### G-01 — Synthèse + recommandations (/50)
- Synthèse claire des 22 agents précédents
- Cohérence inter-agents
- Top 5 forces du système actuel
- Top 5 améliorations possibles (P0/P1/P2 priorisées)
- Recommandations Will avec effort estimé

**TOTAL : 23 agents × 50 pts = 1150 pts → normalisé /1000**

---

## 4. TESTS FONCTIONNELS RÉELS OBLIGATOIRES

### Test 1 — Échantillonnage 20 articles publiés
```sql
SELECT id, slug, content_type, anchor_ville_slug, meta_title, meta_description, h1, word_count, anchor_ville_slug
FROM articles
WHERE publish_status='published'
ORDER BY created_at DESC
LIMIT 20;
```

Pour chaque article : analyser metaTitle/metaDescription longueurs + keyword présence + heading hierarchy.

### Test 2 — Statistiques articles par type
```sql
SELECT content_type, COUNT(*) AS total,
  SUM(CASE WHEN anchor_ville_slug IS NOT NULL THEN 1 ELSE 0 END) AS ville_specifique,
  SUM(CASE WHEN anchor_ville_slug IS NULL THEN 1 ELSE 0 END) AS france_generale
FROM articles
WHERE publish_status='published'
GROUP BY content_type;
```

### Test 3 — Statistiques par ville
```sql
SELECT anchor_ville_slug, content_type, COUNT(*)
FROM articles
WHERE publish_status='published' AND anchor_ville_slug IS NOT NULL
GROUP BY anchor_ville_slug, content_type
ORDER BY anchor_ville_slug, content_type;
```

Quelle ville en a le plus ? Distribution par tier ?

### Test 4 — Curl 5 articles + parse HTML
```powershell
foreach ($slug in @("slug1", "slug2", ...)) {
  $html = curl -s "https://axion-ia.com/fr/blog/$slug"
  $title = ($html | Select-String -Pattern '<title>(.+?)</title>').Matches.Groups[1].Value
  $desc = ($html | Select-String -Pattern 'name="description" content="(.+?)"').Matches.Groups[1].Value
  $h1 = ($html | Select-String -Pattern '<h1[^>]*>(.+?)</h1>').Matches.Groups[1].Value
  Write-Host "Slug: $slug | Title length: $($title.Length) | Desc length: $($desc.Length) | H1: $h1"
}
```

### Test 5 — Vérification heading hierarchy
Pour 5 articles : extraire tous les `<h1>`, `<h2>`, `<h3>`. Vérifier qu'il n'y a qu'un seul H1 et que la hiérarchie est logique.

### Test 6 — Doublons metaTitle / metaDescription
```sql
SELECT meta_title, COUNT(*) FROM articles WHERE publish_status='published' GROUP BY meta_title HAVING COUNT(*) > 1;
SELECT meta_description, COUNT(*) FROM articles WHERE publish_status='published' GROUP BY meta_description HAVING COUNT(*) > 1;
```

Si > 0 doublon : red flag SEO.

### Test 7 — Premier paragraphe length (AI Overview)
Pour 5 articles : extraire le premier paragraphe du body et mesurer longueur en mots. Idéal 40-60 mots pour AI Overview.

### Test 8 — Sources externes count
Pour 5 articles : compter `<a href="https://"` (hors axion-ia.com).
Cible : ≥ 2 par article.

---

## 5. ZONES INTERDITES

- ❌ Aucun commit, push, modif code
- ❌ Aucune création article test
- ✅ Lecture exhaustive code
- ✅ Queries DB lecture seule
- ✅ Curl HTTP pour échantillonnage articles

---

## 6. LIVRABLES OBLIGATOIRES

### Structure
```
_AUDIT/AUDIT-COMMENT-CONTENT-GEN-FONCTIONNE-2026-05-23/
├── COMMENT-CONTENT-GEN-FONCTIONNE.md          ⭐ DOCUMENT EXPLICATIF PRINCIPAL (~800-1200 lignes)
├── DOC-FLUX-GENERATION-PAR-TYPE.md            (1 section par type)
├── CALCUL-VOLUMES-PAR-VILLE.md                (formule + tableaux + exemples)
├── ARTICLES-FRANCE-GENERAUX.md                (réponse spécifique question 5 Will)
├── CONFORMITE-GOOGLE-IA-2026.md               (réponse spécifique question 4+6 Will)
├── ROADMAP-AMELIORATIONS.md                   (top 10 améliorations priorisées)
└── agents/
    ├── A-01-sources-mots-cles.md
    ├── A-02-sources-rss.md
    ├── A-03-titres-imposes.md
    ├── A-04-comparatifs.md
    ├── A-05-questions-qa.md
    ├── B-01-blog-pillar.md
    ├── B-02-landing-ville.md
    ├── B-03-blog-from-keywords.md
    ├── B-04-blog-from-title.md
    ├── B-05-blog-from-rss.md
    ├── B-06-qa-derived.md
    ├── B-07-comparison.md
    ├── C-01-h1-titre.md
    ├── C-02-meta-title.md
    ├── C-03-meta-description.md
    ├── D-01-formule-articles-par-ville.md
    ├── D-02-distribution-tier-population.md
    ├── D-03-distribution-cibles.md
    ├── E-01-articles-france-generaux.md
    ├── E-02-distribution-villes-vs-france.md
    ├── F-01-conformite-google.md
    ├── F-02-conformite-ai-overviews.md
    ├── F-03-conformite-voice-featured-snippets.md
    └── G-01-synthese-recommandations.md
```

### Format `COMMENT-CONTENT-GEN-FONCTIONNE.md`

```markdown
# Comment fonctionne le content-gen AxionIA — Document explicatif complet
## Date : YYYY-MM-DD
## Audité : Claude Sonnet 4.6 — AUDIT-ONLY

---

## RÉSUMÉ EXÉCUTIF (pour Will, 1 page)

Le système content-gen AxionIA fonctionne en **5 étapes** :
1. **Sélection source** (mot-clé / RSS / titre / Q/R / paire comparée) selon le type contenu
2. **Génération LLM** Claude Sonnet 4.6 avec SYSTEM_PROMPT adapté par type
3. **Quality loop** LLM-judge Opus 4.7 reviewer (D1 seuil 6.0/60)
4. **Boucle improve** (D2 : 3 itérations pilier+landing, 2 autres types)
5. **Publication** auto si score ≥ seuil, sinon `needs_review`

---

## QUESTION 1 — Comment les contenus sont-ils générés ?

### Vue d'ensemble : 7 types et leurs sources
| Type | Source principale | Algorithme sélection |
|------|-------------------|----------------------|
| blog_pillar | Mot-clé Keyword DB | selectKeyword() avec isLongTail=false |
| landing_ville | Mot-clé + ville | selectKeyword({ vertical, cityId }) |
| blog_from_keywords | Mot-clé Keyword DB | selectKeyword() standard |
| blog_from_title | Titre Will admin | Champ inputPayload.titleForced |
| blog_from_rss | Item RSS | rss-fetcher fetch + filtrage |
| qa_derived | Question | g4-aeo.ts keywords AEO |
| comparison | Paire entités | Comparatifs g5 partenaires/concurrents |

### Détails par type
<paragraphes détaillés issus des agents B-01 à B-07>

---

## QUESTION 2 — Comment les titres (H1) sont-ils générés ?

<paragraphe synthèse agent C-01>

Pour résumer :
- blog_from_title : H1 = titre Will forcé
- Autres types : H1 généré par LLM à partir du keyword, avec créativité (bénéfice + contexte ajoutés)
- Le keyword principal apparaît dans le H1 dans XX% des articles (audit échantillonnage)

---

## QUESTION 3 — Combien d'articles par ville ?

### Formule actuelle
<code calcul + exemple concret>

### Distribution par tier population
<tableau + recommandation>

---

## QUESTION 4 — MetaTitle / MetaDescription conformes ?

### Statistiques observées (échantillon 20 articles)
| Métrique | Observé | Cible Google |
|----------|---------|--------------|
| Longueur metaTitle moyenne | XX chars | 50-60 |
| Longueur metaDescription moyenne | XX chars | 140-155 |
| % keyword in metaTitle | XX% | 100% |
| Doublons metaTitle DB | XX | 0 |
| Doublons metaDescription DB | XX | 0 |

### Verdict conformité : ✅ / ⚠️ / ❌

---

## QUESTION 5 — Articles France générale (non-ville) ?

### Statistiques
| Type | Total | Ville-spécifique | France générale |
|------|-------|------------------|------------------|
| blog_pillar | XX | XX | XX |
| landing_ville | XX | XX (100%) | 0 (impossible) |
| blog_from_keywords | XX | XX | XX |
| ... |

### Verdict : ✅ Articles France existent / ⚠️ Très peu / ❌ Aucun

### Recommandation
<paragraphe>

---

## QUESTION 6 — Conformité IA 2026 ?

### AI Overviews / SGE
<échantillonnage + verdict>

### Voice search + Featured Snippets
<échantillonnage + verdict>

### Verdict global : ✅ / ⚠️ / ❌

---

## TOP 10 AMÉLIORATIONS RECOMMANDÉES

1. P0 ... (effort, gain)
2. P0 ...
3. P1 ...
... (top 10)
```

### Mémoire
Slug : `axionia_audit_comment_content_gen_fonctionne_2026-05-23`

### MEMORY.md
```
- [📖 AxionIA Audit explicatif content-gen LIVRÉ 2026-05-23 — comment fonctionne](axionia_audit_comment_content_gen_fonctionne_2026-05-23.md) — Document explicatif Will : sources 7 types, génération titres, formule volumes par ville, articles France générale, conformité Google+AI Overviews 2026. 23 sous-agents + 8 tests fonctionnels.
```

---

## 7. STOP & ASK FINAL

```
✅ Audit explicatif content-gen livré.

📖 Document principal : COMMENT-CONTENT-GEN-FONCTIONNE.md (~XXX lignes)

📊 Réponses aux 6 questions Will :
1. Génération contenus : <synthèse 1 ligne>
2. Génération titres : <synthèse 1 ligne>
3. Articles par ville : formule = <formule>
4. MetaTitle/Description conforme : ✅/⚠️/❌
5. Articles France générale : XX articles (XX%)
6. Conformité IA 2026 : ✅/⚠️/❌

🚀 Top 3 améliorations recommandées :
1. ... (effort, gain pts)
2. ...
3. ...

📋 Choix Will :
[A] Lecture document + décision
[B] Sprint corrigeant les 3 P0 prioritaires
[C] Continuer pipeline audits finaux
```

---

## 8. PHRASE DE LANCEMENT (AUTOPILOT TOTAL)

```
AUTOPILOT TOTAL. Ne pose AUCUNE question intermédiaire. Lance l'audit explicatif décrit dans `_AUDIT/PROMPT-AUDIT-COMMENT-CONTENT-GEN-FONCTIONNE-2026-05-23.md`. Mode AUDIT-ONLY strict : zéro commit, zéro modif code, zéro création données test. Décisions Will canoniques figées (D-W1-5 + D-P5-1-6 + D1-D5 + D7) — NE PAS re-demander. Exclusions absolues : Wikidata, DPA, CF WAF, toggle auto/manuel publication. Lire EN PREMIER les 7 generators src/server/content-gen/generators/*.ts + keyword-selector + coverage admin + orchestrator worker + seo.ts + schema.prisma + 17 fichiers seeds keywords + 5 mémoires Claude pertinentes. Spawn 23 sous-agents parallèles : Bloc A 5 agents (sources mots-clés/RSS/titres/comparatifs/Q-R), Bloc B 7 agents (1 par type contenu), Bloc C 3 agents (H1/metaTitle/metaDescription), Bloc D 3 agents (formule articles par ville/tier population/distribution cibles), Bloc E 2 agents (articles France générale, distribution villes vs France), Bloc F 3 agents (conformité Google+AI Overviews+Voice/Featured), Bloc G 1 agent (synthèse). Exécuter TOUS les 8 tests fonctionnels obligatoires (échantillonnage 20 articles DB, stats articles par type, stats par ville, curl 5 articles parse HTML meta+H1, heading hierarchy, doublons meta, premier paragraphe length AI Overview, sources externes count). Self-troubleshoot. Score `/1000` HONNÊTE pas gonflé. Produis 6 livrables principaux (COMMENT-CONTENT-GEN-FONCTIONNE.md document explicatif Will + DOC-FLUX-GENERATION-PAR-TYPE.md + CALCUL-VOLUMES-PAR-VILLE.md + ARTICLES-FRANCE-GENERAUX.md + CONFORMITE-GOOGLE-IA-2026.md + ROADMAP-AMELIORATIONS.md) + 23 rapports agents dans `_AUDIT/AUDIT-COMMENT-CONTENT-GEN-FONCTIONNE-2026-05-23/`. Mémoire axionia_audit_comment_content_gen_fonctionne_2026-05-23 + MEMORY.md update. STOP & ASK Will UNIQUEMENT à la livraison finale avec réponses synthétisées aux 6 questions + 3 options [A/B/C]. Go.
```

---

*Audit explicatif content-gen — 6-8h Sonnet 4.6 autopilot — AUDIT-ONLY — Document Will 6 questions*
