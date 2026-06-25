# 02 — AUDIT QUALITÉ DU CONTENU GÉNÉRÉ

**Échantillon** : 8 articles publiés tirés de la **vraie base de données** (33 articles publiés au total, **tous FR, tous `tier_1_indexable`, 0 actualité**). Aucune landing page / pilier / communiqué publié dans la base au moment de l'audit → audit centré sur les types présents (articles blog, comparatif, FAQ-standalone, cas concret). `templateVariant` = **null sur les 8** (la route se dérive du slug, cf. 07).

Mesures relevées directement sur `ArticleTranslation.body` stocké.

| slug                                   | title (car) | metaTitle | metaDesc | mots body | H2    | H3  | directAnswer | FAQ | liens int | hero+alt |
| -------------------------------------- | ----------- | --------- | -------- | --------- | ----- | --- | ------------ | --- | --------- | -------- |
| questions-audit-ia-pme                 | 31          | 47        | 132      | **185**   | **2** | 0   | 24w          | 10  | 3         | ✅       |
| cas-concret-ia-logistique-lyon         | 50          | 35        | 114      | 896       | 6     | 19  | 24w          | 10  | 3         | ✅       |
| definition-fine-tuning-ia              | 28          | 50        | 119      | 833       | 7     | 2   | 29w          | 8   | 6         | ✅       |
| calculateur-roi-assistant-ia           | 51          | 42        | 144      | 649       | 5     | 10  | 31w          | 8   | 3         | ✅       |
| copilot-vs-chatgpt-pour-pme-comparatif | 49          | 40        | 126      | 634       | 8     | 7   | 24w          | 8   | **1**     | ✅       |
| logiciel-ia-gestion-stock              | 60          | 33        | 122      | 989       | 8     | 12  | 30w          | 8   | **1**     | ✅       |
| deployer-agent-ia-pme-guide            | 51          | 44        | 139      | 492       | 7     | 12  | 26w          | 8   | 2         | ✅       |
| automatiser-service-client-ia          | 56          | 36        | 107      | 1033      | 7     | 18  | 24w          | 8   | 3         | ✅       |

---

## 2.1 — Structure Hn

```
[Critère: Hn] [Score: 7/10]
Problème: Aucun <h1> dans le body (H1=0 partout) — PAR DESIGN (le sanitizer FORBID h1, le H1 est
posé au niveau page = le titre). Crédité correctement par le scorer (hasPageH1). NON un bug.
Mais : la section "Sources" (appendSourcesSection) est émise en <h2> → 1 H2 sur N est toujours
"Sources", ce qui gonfle artificiellement le compte de H2 et place un H2 non-éditorial en fin.
Exemple (copilot-vs): H2 = [Méthodologie, Tarification, Transparence, Lock-in, Support FR, ROI,
Conclusion, Sources] → "Sources" et "Conclusion" sont 2/8 H2 non porteurs de mots-clés.
```

```
[Contenu: questions-audit-ia-pme] [Critère: Hn] [Score: 3/10]
Problème: SEULEMENT 2 H2 ("Comprendre l'audit IA en PME" + "Sources") pour un article intitulé
"Questions sur l'audit IA en PME". Les questions vivent dans l'accordéon FAQ (10 items) hors body
→ corps de 185 mots seulement. Sous la densité de titres recommandée (3-8 H2).
Impact: structure pauvre, peu de surface d'ancrage SEO/AEO, body thin.
```

```
[Critère: H2 question-form / bénéfice] [Score: 6/10]
Problème: les H2 sont souvent des SYNTAGMES NOMINAUX et non des questions/bénéfices.
Exemple (copilot-vs): "Méthodologie d'implémentation", "Tarification", "Transparence et conformité".
Bon contre-exemple (automatiser-service-client): "Le défi des services clients traditionnels"
(problème nommé d'abord ✅). Incohérence d'un article à l'autre.
```

- H3 orphelins / sauts de niveau : **non détectés** sur l'échantillon (H3 toujours sous des H2).

## 2.2 — Métadonnées SEO

```
[Critère: metaTitle] [Score: 5/10] — PATTERN RÉCURRENT
Problème: metaTitle SYSTÉMATIQUEMENT trop court : 47,35,50,42,40,33,44,36 caractères (cible 50-60).
6/8 sont < 50, certains à 33-36. Gaspille la largeur SERP, mot-clé sous-exploité.
Exemple: "logiciel-ia-gestion-stock" → metaTitle 33 car (title 60 car pourtant correct).
```

```
[Critère: metaDescription] [Score: 5/10] — PATTERN RÉCURRENT
Problème: metaDescription SYSTÉMATIQUEMENT trop courte : 132,114,119,144,126,122,139,107 (cible 140-160).
6/8 < 140. + opener répétitif "Découvrez comment…" sur ≥3 articles (tic de gabarit).
Exemple: "automatiser-service-client-ia" → 107 car, "Découvrez comment l'IA peut améliorer…".
Impact: snippets SERP tronqués/sous-optimisés, CTR perdu, manque de différenciation.
```

- **Slug** : ✅ propre, kebab-case, cohérent avec le H1, déterministe (`slugify` SSOT). Bon.
- **Title** : longueurs 28-60, globalement OK ; 2 titres courts (28, 31).
- **Canonical / OG / robots / hreflang / sitemap** : gérés au niveau **page** (`lib/seo.ts`), voir 04 + 07. og:image dérive du `featuredImage` (fallback OK) ; colonnes `ArticleTranslation.ogImage/ogImageAlt` **dormantes** (NULL sur les 33) → voir 07.

## 2.3 — Schema.org & données structurées

```
[Critère: Schema.org] [Score: 7/10]
Constat: le JSON-LD n'est PAS dans le body (body has @type = false sur tout l'échantillon) → injecté
au niveau <head> par la page (bonne pratique). Builders présents dans lib/seo.ts (BlogPosting/Article,
FAQPage, BreadcrumbList, Person Manon, ImageObject). FAQ stockée (faqJson 8-10 items) → alimente FAQPage.
Détail des types réellement émis par type de page + validité : voir 04_AUDIT_FRONTEND (4.1).
```

## 2.4 — Breadcrumbs

Rendu + cohérence schema↔visuel : voir **04_AUDIT_FRONTEND** (4.1) et **07_AUDIT_COHERENCE** (7.1).

## 2.5 — AEO (Answer Engine Optimization)

```
[Critère: AEO] [Score: 7.5/10] — POINT FORT
✅ Réponse directe answer-first présente : chaque section démarre par <p data-aeo="answer"> (aeoMarks
5-8 par article). directAnswer (snippet 0) présent partout + keyTakeaway + 8-10 FAQ réelles.
Exemple (automatiser-service-client): "<h2>Le défi…</h2><p data-aeo=\"answer\">Les services clients
traditionnels peinent souvent à gérer des volumes importants…".
⚠️ FAIBLESSE: directAnswer SYSTÉMATIQUEMENT trop court — 24-31 mots (cible AEO 40-80). Le snippet 0
est sous-développé → capte moins bien la position 0 / l'AI Overview.
```

## 2.6 — GEO (Generative Engine Optimization)

```
[Critère: GEO] [Score: 7/10]
✅ Entités nommées claires (Axion-IA répété, ville pour le local ex "logistique-lyon"), ton factuel,
définitions <dfn>/glossary-term présentes (1-3 par article), paragraphes courts, liens externes
d'autorité (4-8 par article via appendSourcesSection).
⚠️ "Sources" en fin = bon pour la vérifiabilité, mais les chiffres datés/sourcés dans le CORPS sont
inégaux selon l'article. Cohérence inter-contenus des entités : voir 07.
```

## 2.7 — Réponse au problème métier

```
[Critère: Métier] [Score: 6.5/10]
✅ Bon: "automatiser-service-client-ia" nomme le problème AVANT la solution ("Le défi des services
clients traditionnels"). Bénéfices métier exprimés (réduire coûts, satisfaction).
⚠️ Incohérent: "copilot-vs" entre directement dans "Méthodologie d'implémentation" sans cadrer la
douleur métier. Le problème concret n'est pas systématiquement nommé dans les 50 premiers mots.
⚠️ Artefact: certains body RÉPÈTENT le titre en texte brut en tête de corps avant le 1er <h2>
(ex: "Copilot vs ChatGPT pour PME : Comparatif Axion-IA<h2>…") → titre affiché 2× (H1 page + texte).
```

---

## SYNTHÈSE QUALITÉ CONTENU (échantillon)

| Critère      | Score /10 | Verdict                                                                         |
| ------------ | --------- | ------------------------------------------------------------------------------- |
| Structure Hn | 6.5       | H1 page-level OK ; "Sources" en H2 ; 1 article 2-H2 thin ; H2 peu question-form |
| Métadonnées  | 5         | **metaTitle & metaDesc systématiquement trop courts** (pattern fort)            |
| Schema.org   | 7         | head-injected, FAQPage alimenté (détail 04)                                     |
| AEO          | 7.5       | answer-first ✅ mais **directAnswer 24-31w < 40-80**                            |
| GEO          | 7         | entités/dfn/sources OK                                                          |
| Métier       | 6.5       | problème-avant-solution incohérent ; titre dupliqué en tête de body             |

**Patterns récurrents qualité** : (1) **metaTitle/metaDescription chroniquement trop courts** ; (2) **directAnswer trop court** ; (3) liens internes faibles sur certains articles (1) ; (4) "Sources" toujours en H2 ; (5) titre dupliqué en tête de body sur certains contenus.
