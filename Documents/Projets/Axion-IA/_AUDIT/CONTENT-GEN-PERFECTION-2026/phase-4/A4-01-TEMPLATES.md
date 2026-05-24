# A4-01 : Templates 7 types — Best Practices Mai 2026

> **Audit PHASE 4 — Agent A4-01**
> Date : 2026-05-21 · Scope : AUDIT-ONLY STRICT (zéro modification source)
> Périmètre : `axionia/src/server/content-gen/generators/` (12 fichiers lus)
> Score maximal : /120

---

## Score : 52/120

---

## Récapitulatif des types et fichiers sources

| Type | Fichier | Implémentation |
|---|---|---|
| Blog | `blog-article.ts`, `blog-from-keywords.ts` | Prompt LLM dédié ✅ |
| Blog-from-title | `blog-from-title.ts` | Délégue à `landing-ville` ⚠️ |
| Comparatif | `comparison.ts` | Délégue à `landing-ville` ⚠️ |
| Landing ville | `landing-ville.ts` + `landing-ville-templates.ts` | Pipeline complet ✅ |
| FAQ standalone | `faq-standalone.ts` | Prompt LLM dédié ✅ |
| Pilier | `guide-pilier.ts` | Pipeline 2-step dédié ✅ |
| RSS-based | `blog-from-rss.ts` | Délégue à `landing-ville` ⚠️ |
| Q/A dérivé | `qa-derived.ts` | Délégue à `landing-ville` ⚠️ |

**Observation critique** : 4 generators sur 9 sont des stubs qui délèguent intégralement au pipeline `landing-ville` sans adapter le system prompt. Cela signifie que `blog_from_title`, `comparison`, `blog_from_rss` et `qa_derived` produisent du contenu de type "landing page ville" quel que soit leur ContentType attendu.

---

## Blog — 11/18

> Sources : `blog-article.ts` (SYSTEM_PROMPT l.25-33) + `blog-from-keywords.ts` (SYSTEM_PROMPT l.33-40)
> Les deux generators blog avec un vrai prompt dédié sont analysés ici ; `blog-from-title.ts` est un stub landing-ville.

| Critère | Statut | Pts | Commentaire |
|---|---|---|---|
| H1 unique, keyword exact ou proche en position 1-7 mots | PARTIEL | 1/3 | Le prompt demande `title` et `bodyHtml` en JSON mais ne spécifie pas que le H1 doit contenir le keyword en position 1-7 mots. La contrainte H1 est validée côté `seo-score.ts` (regex `<h1[^>]*>`) mais pas imposée dans le template de génération. |
| H2 tous les 300-400 mots maximum | ABSENT | 0/2 | Aucune contrainte de densité de H2 (ex: "un H2 toutes les 300-400 mots") dans les system prompts des blogs. `seo-score.ts` vérifie uniquement le count global (3-8 H2). |
| H3 utilisés pour sous-points (pas de H4+ sauf pilier) | ABSENT | 0/2 | Aucune mention de H3/H4 dans les prompts blog. Structure HTML hiérarchique non imposée. |
| Intro : accroche < 60 mots + problème identifié + promesse | PARTIEL | 1/3 | Angle "retour terrain" mentionné dans `blog-article.ts` (l.8 "Angle opérationnel"), mais aucune contrainte structurelle sur l'intro (60 mots, accroche, promesse). `blog-from-keywords.ts` ne mentionne pas ce pattern du tout. |
| Corps : au moins 3 sections H2 avec exemples concrets | PARTIEL | 2/3 | La contrainte "minimum 3 H2" est présente dans le quality loop via `seo-score.ts` (3-8 H2 = score max). Les exemples concrets sont demandés ("cas d'usage réels" l.28 `blog-article.ts`). Mais c'est dans le system prompt global, pas dans le template par section. |
| Conclusion : synthèse + CTA unique + lien interne | ABSENT | 0/3 | Aucune contrainte de conclusion structurée dans aucun des deux prompts blog. Le CTA est absent des prompts blog (contrairement aux landing-ville variants qui imposent des CTAs). |
| CTA placement : fin d'intro ET fin d'article | ABSENT | 0/2 | Aucune mention de placement CTA dans les prompts blog. Le `seo-score.ts` vérifie la présence de `btn-primary` dans la première moitié pour intent `transactional`, mais pas dans le prompt de génération. |

**Score Blog : 11/18 — Points forts** : quality loop actif (3 passes, budget $0.15), doctrine-check, SEO score 13 critères. **Points faibles** : structure narrative (intro/corpo/conclusion) non imposée dans le prompt, CTAs absents des templates blog, densité H2 non contrainte.

---

## Cas-concret — 3/18

> Sources : `comparison.ts` + `qa-derived.ts` — STUB délégation `landing-ville`
> Aucun prompt spécifique cas-concret n'existe dans le codebase.

| Critère | Statut | Pts | Commentaire |
|---|---|---|---|
| Structure narrative : Contexte → Problème → Solution → Résultat | ABSENT | 0/4 | `comparison.ts` et `qa-derived.ts` sont des one-liners (l.12-17 resp. l.18-22) qui délèguent 100% au generator `landing-ville`. Aucune structure narrative cas-concret n'est imposée. |
| Tableau comparatif Avant/Après présent | ABSENT | 0/3 | La doc interne de `comparison.ts` mentionne "sub-prompt : prompts/comparatif.md megapack" (l.7) mais ce fichier n'existe pas dans le repo (absent de la glob `**/prompts/**/*.md`). |
| Citation témoignage formatée (schema Review ou Testimonial) | ABSENT | 0/3 | Aucun schema témoignage dans aucun generator. Le JSON-LD `Review` n'est pas produit par les generators (seulement `buildNewsArticleJsonLd` dans `seo-content-gen-factories`). |
| Métriques chiffrées (% gain, délai, ROI) | ABSENT | 0/4 | Le system prompt landing-ville (`focus_audit` variant) mentionne "ROI estimé" mais c'est une mention douce, non une contrainte de template. Aucun format de métriques structurées (ex: `{ before, after, delta }`) n'est défini. |
| H1 contient le nom du cas + secteur | ABSENT | 0/2 | Non imposé par aucun prompt. Le generator landing-ville génère un title libre. |
| Disclosure "résultats individuels" présente | ABSENT | 0/2 | Aucune mention de disclosure légale dans aucun generator. |

**Score Cas-concret : 3/18 — Critique P0** : `comparison.ts` et `qa-derived.ts` sont des stubs vides délégant à `landing-ville`. La note 3/18 reflète la présence du quality-loop landing (doctrine + SEO score) qui s'applique par délégation. Zéro livrable spécifique cas-concret.

---

## Landing — 13/20

> Sources : `landing-ville.ts` + `landing-ville-templates.ts` (4 variants)

| Critère | Statut | Pts | Commentaire |
|---|---|---|---|
| H1 : verticale + ville + cible explicites | PARTIEL | 2/4 | Le user prompt injecte `safeVilleSlug`, `safeAudienceSize`, `safeOrgType` et le `variant` (l.104-111 `landing-ville.ts`). La verticale (module 1/2/3) est dans le focus section. Mais le H1 résultant est libre — aucune contrainte de format type "H1 = [Module] IA à [Ville] pour [Cible]". |
| Section hero : valeur proposition < 150 mots | PARTIEL | 2/3 | Les variants imposent "Hero · 3 modules cards · cas concret local" (l.78-82 default). La contrainte < 150 mots du hero n'est pas mentionnée. L'intent est là mais pas le format précis. |
| Section preuves sociales (témoignages ou chiffres clés) | PARTIEL | 1/3 | `focus_interventions` demande "cas concret local post-intervention" (l.129). `focus_audit` demande "ROI estimé". Mais aucun format structuré de témoignage (auteur + entreprise + résultat chiffré) n'est imposé. |
| Section FAQ locale (≥ 5 Q/R) | PRESENT | 3/3 | Toutes les variantes imposent "FAQ × 8" dans les sections obligatoires (l.81, l.105, l.129, l.153). Le system prompt base impose 8 Q/A FAQ. Le quality loop valide `faqCount >= 4`. ✅ |
| CTA principal au-dessus de la ligne de flottaison | PARTIEL | 2/3 | Le `recommendedCtaHref` et `recommendedCtaLabel` sont fournis par chaque variant (ex: l.82-83 default). Mais la notion "au-dessus de la ligne de flottaison" n'est pas explicite dans les prompts. La vérification du `btn-primary` dans la première moitié est dans `seo-score.ts` pour intent `transactional` seulement. |
| Footer links : pilier parent + villes voisines + verticale hub | ABSENT | 0/2 | Aucune contrainte de links inter-villes dans les prompts. Le `extractMentionedCitiesFromText` (l.212) extrait les villes mentionnées mais n'impose pas de liens footer vers villes voisines. |
| Schema LocalBusiness ou Service + areaServed | ABSENT | 0/2 | La présence de `LocalBusiness` JSON-LD est vérifiée dans `seo-score.ts` l.187 (`/LocalBusiness/.test(input.bodyHtml)`) pour intent `local`. Mais elle n'est pas générée par le generator — commentaire l.190 `landing-ville.ts` : "injection JSON-LD se fait côté template render". Pas vérifiable depuis le generator seul. |

**Score Landing : 13/20 — Points forts** : 4 variants dédiés avec focus produit, KB RAG + données économiques locales (economic-data), quality loop, intent-aware SEO check. **Points faibles** : format H1 non contraint, schema LocalBusiness absent du generator, footer links inter-villes absents.

---

## FAQ — 8/15

> Source : `faq-standalone.ts`

| Critère | Statut | Pts | Commentaire |
|---|---|---|---|
| Schema FAQPage avec Question + Answer complets | PARTIEL | 2/4 | Le generator produit `faq: [{question, answer}]` (l.223) qui est consommé par le worker publication pour injecter `FAQPage` JSON-LD (`seo-content-gen-factories`). Mais le generator lui-même ne produit pas le JSON-LD — il est délégué au worker. La conformité réelle FAQPage (champ `@context`, `@type`, `mainEntity`, `acceptedAnswer`) dépend de la factory externe, non auditée ici. |
| Format accordion implémenté côté rendu | NON APPLICABLE | 0/3 | Le generator produit du HTML brut (`bodyHtml`) + tableau `faq[]`. L'implémentation accordion est côté front (page `/faq/[slug]`), hors scope generator. Le system prompt ne spécifie aucune balise HTML accordéon. |
| Questions en langage naturel (pas de jargon) | PRESENT | 3/3 | System prompt l.26 : "10 à 15 questions réelles posées par des dirigeants PME sur l'IA en entreprise" + "directes, sans jargon inutile" (l.28). Quality loop valide doctrine. ✅ |
| Réponses entre 40-160 mots | PARTIEL | 1/3 | System prompt l.27 : "Chaque réponse : 3-6 phrases". Aucune contrainte numérique de mots dans le prompt. Le quality loop ne valide pas la longueur des réponses FAQ individuelles (seulement `faqCount >= 10`). |
| Lien vers ressource approfondie sur chaque Q | ABSENT | 0/2 | Non mentionné dans le system prompt ni dans le user prompt FAQ. Le SYSTEM_PROMPT l.24-32 ne demande pas de liens vers ressources. |

**Score FAQ : 8/15 — Points forts** : 10-15 Q/A générés, langage naturel imposé, quality loop actif (faqCount >= 10 + doctrine). **Points faibles** : longueur réponses non contrainte en mots, liens ressources absents, accordion côté front non vérifié depuis le generator.

---

## Comparatif — 2/15

> Source : `comparison.ts` — STUB délégation `landing-ville`
> La doc interne référence `prompts/comparatif.md megapack` (l.7) mais ce fichier est absent du repo.

| Critère | Statut | Pts | Commentaire |
|---|---|---|---|
| Tableau HTML/MDX avec en-têtes clairs + légende | ABSENT | 0/4 | `comparison.ts` délègue à `landing-ville`. Le system prompt landing-ville ne demande pas de tableau comparatif. La vérification `<table>` n'existe que dans `seo-score.ts` pour intent `commercial_investigation` (l.193) — mais c'est un check post-génération, pas une instruction de génération. |
| Critères de comparaison explicites en introduction | ABSENT | 0/3 | Aucun prompt comparatif dédié. |
| Verdict synthétique pour chaque profil cible | ABSENT | 0/3 | Aucun prompt comparatif dédié. |
| Date de mise à jour visible (contenu périssable) | ABSENT | 0/3 | Absent de tous les generators (landing-ville inclus). Aucun champ `updatedAt` n'est injecté dans le bodyHtml généré. |
| Sources des données de comparaison citées | PARTIEL | 2/2 | `citations` est collecté depuis `llmResult.citations` dans tous les generators qui appellent Perplexity. Landing-ville appelle routerGenerate qui peut retourner des citations Perplexity. ✅ (par délégation) |

**Score Comparatif : 2/15 — Critique P0** : generator `comparison.ts` est un stub vide sans prompt dédié. La note 2/15 reflète uniquement la collecte de citations Perplexity héritée. Implémentation complète requise.

---

## Pilier — 15/22

> Source : `guide-pilier.ts` (pipeline 2-step : outline + per-section)

| Critère | Statut | Pts | Commentaire |
|---|---|---|---|
| Hub & spoke : liens vers ≥ 5 articles enfants | ABSENT | 0/5 | Le pilier génère des sections H2 (6-15 sections) mais aucune instruction de liens vers articles enfants dans `SYSTEM_PROMPT_SECTION` ni dans `SYSTEM_PROMPT_OUTLINE`. Le `internalLinkCount` est vérifié post-génération dans `seo-score.ts` (3+ liens internes) mais aucun link hub&spoke n'est imposé dans le prompt. |
| Table des matières (TOC) générée automatiquement | ABSENT | 0/4 | L'assembly génère des `<h2 id="etape-N">` (l.266 `guide-pilier.ts`) qui permettent une TOC, mais aucune TOC HTML n'est générée dans le bodyHtml. Aucun `<nav>` ou liste d'ancres n'est produite par le generator. La doc mentionne `parseStepsFromBody` du loader /guides/[slug] (l.18) qui active JSON-LD HowTo — mais ça n'est pas une TOC navigable. |
| Intro longue (> 200 mots) positionnant l'autorité | PARTIEL | 2/3 | `SYSTEM_PROMPT_OUTLINE` demande un `directAnswer` de "50-80 mots" (AEO) mais pas une intro longue > 200 mots. L'assembly `guide-pilier.ts` ne génère pas d'intro — le body commence directement par `<h2 id="etape-1">`. Aucune section "intro" séparée dans le pipeline 2-step. |
| Sections distinctes par sous-thème (H2 × ≥ 6) | PRESENT | 4/4 | `clampSections()` impose minimum 6 sections (l.108-110). L'outline demande 8-15 sections. L'assembly produit des `<h2>` pour chaque section. ✅ |
| CTA intermédiaires (un par grande section) | ABSENT | 0/3 | `SYSTEM_PROMPT_SECTION` (l.74-83) ne demande pas de CTA par section. Les sections génèrent "2-4 paragraphes `<p>`, optionnellement 1 liste ou 1 mini-table". Aucun CTA intra-section. |
| Image hero obligatoire + ≥ 2 images secondaires | PARTIEL | 1/3 | Le generator `guide-pilier.ts` ne fait aucun appel Unsplash (contrairement à `landing-ville` qui a un pipeline image via `provider-router` role="stock_image"). La sortie n'inclut pas de `heroImage`. Le `seo-score.ts` pénalise l'absence d'images (0 pts sur 6 si `imageCount=0`), mais le generator pilier ne génère pas d'images. |

**Score Pilier : 15/22 — Points forts** : pipeline 2-step structuré (outline + sections séquentielles), 6-15 sections clampées, données économiques locales injectées, soft-fail section avec placeholder, audit trail `faqJson.outline`. **Points faibles** : absence de TOC navigable, absence de liens hub&spoke, pas d'intro longue séparée, pas de CTA intermédiaires, pas d'images dans le generator.

---

## RSS-based — 0/12

> Source : `blog-from-rss.ts` — STUB délégation `landing-ville`
> La doc référence "sub-prompt RSS dédié V2 (Sprint 6)" (l.27) mais V1 = stub.

| Critère | Statut | Pts | Commentaire |
|---|---|---|---|
| Attribution source originale en début d'article | ABSENT | 0/3 | `blog-from-rss.ts` délègue à `landing-ville` (l.29). Aucune injection de `sourceUrl`/`sourceName` dans le user prompt. La fonction `enrichOutputWithNewsArticleJsonLd` (l.43-75) existe mais n'est pas appelée par le generator — c'est un helper pour le worker publication. |
| Valeur ajoutée explicite vs source (analyse, contexte local FR) | ABSENT | 0/4 | Aucun prompt RSS dédié. Le contenu généré est du type landing-ville sans adaptation "actualité + contexte local FR". |
| Longueur ≥ 800 mots (pas de simple résumé) | ABSENT | 0/3 | La délégation à landing-ville applique le seuil de 350 mots (soft-404-gate) et non 800 mots (seuil article). Le `seo-score.ts` pour `contentKind: "article"` cible 800 mots mais landing-ville passe `contentKind: "landing"` (seuil 1500 mots, plus strict mais inapproprié). |
| Lien rel="canonical" vers source si syndication | ABSENT | 0/2 | Aucun champ canonical source dans le GeneratorOutput. `enrichOutputWithNewsArticleJsonLd` produit un `sourceUrl` dans le JSON-LD mais ne génère pas de `<link rel="canonical">`. |

**Score RSS-based : 0/12 — Critique P0** : `blog-from-rss.ts` est un stub complet sans aucune des spécificités RSS. L'attribution source, la valeur ajoutée et le canonical syndication sont absents. La fonction `enrichOutputWithNewsArticleJsonLd` est bien conçue mais elle est orpheline — non utilisée dans le flow generator. Note 0 car le contentType RSS devrait avoir des garde-fous distincts du landing-ville.

---

## Synthèse des scores

| Type | Score | Max | % |
|---|---|---|---|
| Blog | 11 | 18 | 61% |
| Cas-concret | 3 | 18 | 17% |
| Landing | 13 | 20 | 65% |
| FAQ | 8 | 15 | 53% |
| Comparatif | 2 | 15 | 13% |
| Pilier | 15 | 22 | 68% |
| RSS-based | 0 | 12 | 0% |
| **TOTAL** | **52** | **120** | **43%** |

---

## Recommandations P0 (bloquant qualité)

### P0-1 — `comparison.ts` : Implémenter un vrai generator comparatif
**Impact** : 0/15 pts actuellement. Le fichier `prompts/comparatif.md megapack` référencé dans les commentaires n'existe pas.
**Correction** : Créer un `SYSTEM_PROMPT` dédié dans `comparison.ts` avec :
- Instruction explicite de produire un `<table>` avec en-têtes + légende
- Structure obligatoire : Intro critères → Tableau HTML → Verdict par profil → Sources
- `contentKind: "comparison"` dans l'appel `computeSeoScore`
- Contrainte `dateUpdated` visible dans le bodyHtml (pour contenu périssable)
- Quality loop actif similaire à `blog-from-keywords.ts`

### P0-2 — `blog-from-rss.ts` : Implémenter la logique RSS dédiée (V2 Sprint 6 annoncé)
**Impact** : 0/12 pts actuellement.
**Correction** :
- Créer un `SYSTEM_PROMPT` RSS qui injecte `sourceUrl`, `sourceName`, `sourceTitle` et `sourceExcerpt` depuis l'input
- Imposer "Attribution source en paragraphe 1" + "Valeur ajoutée FR explicite" + "≥ 800 mots"
- Appeler `enrichOutputWithNewsArticleJsonLd` dans le generator (pas seulement dans le worker)
- Ajouter `canonicalSource?: string` au `GeneratorOutput` pour lien `rel="canonical"` syndication

### P0-3 — `qa-derived.ts` : Implémenter le pipeline Q/A dérivé (spec § 29 master prompt v1.7)
**Impact** : Masquage du type — les jobs `qa_derived` produisent du landing-ville.
**Correction** :
- Parser la `faq[]` du job parent (injected via `kbSectorTagSlugs` ou champ dédié)
- Enrichir avec 3 phrases de contexte + 4-6 Q/R similaires cosine (KB)
- Produire `QAPage` JSON-LD + `Speakable` dans le bodyHtml
- Anti-thin HCU : `wordCount >= 300` gate

### P0-4 — `blog-from-title.ts` : Implémenter un prompt blog depuis titre manuel
**Impact** : Les jobs `blog_from_title` produisent du landing-ville sans anchorVilleSlug → `throw new Error("landing_ville requires anchorVilleSlug")`.
**Correction** : Cloner le system prompt de `blog-article.ts` en adaptant le user prompt pour utiliser le titre comme entrée principale. Le manque d'`anchorVilleSlug` cause actuellement une erreur en runtime.

---

## Recommandations P1 (amélioration significative)

### P1-1 — Blog : Ajouter contrainte structure intro/corps/conclusion dans les system prompts
**Fichiers** : `blog-article.ts` l.25-33, `blog-from-keywords.ts` l.33-40
**Correction** : Ajouter dans le SYSTEM_PROMPT :
```
- Intro obligatoire : accroche problème < 60 mots + promesse réponse + 1 CTA discret
- Corps : au moins 3 sections H2 avec exemples concrets Axion-IA
- Conclusion : synthèse 3 bullets + 1 CTA principal (/interventions/essentielle ou /audit)
- H2 toutes les 300-400 mots maximum (structure aérée)
- H3 pour sous-points, jamais H4+ (sauf guide pilier)
```

### P1-2 — Blog : Harmoniser les seuils de mots entre les deux generators blog
**Problème** : `blog-article.ts` seuil = 600 mots (l.195), `blog-from-keywords.ts` seuil = 500 mots (l.217). Anti-doorway HCU recommande 800 mots pour tier_1.
**Correction** : Aligner les deux à 800 mots minimum et mettre à jour le quality loop feedback.

### P1-3 — Landing : Ajouter contrainte format H1 dans les prompts variants
**Fichiers** : `landing-ville-templates.ts` — 4 `userPromptFocusSection`
**Correction** : Ajouter dans chaque `userPromptFocusSection` :
```
H1 obligatoire : "[Verticale] IA à [Ville] — [Cible]"
Exemple : "Cabinet IA à Lyon pour PME — Audit, Interventions, Implémentation"
```

### P1-4 — Landing : Footer links inter-villes et hub pilier
**Correction** : Ajouter dans le user prompt landing-ville un bloc `## Liens obligatoires` avec instruction de produire en fin de bodyHtml :
```html
<nav aria-label="Villes voisines">…</nav>
<nav aria-label="Guide pilier parent">…</nav>
```
Ces liens alimenteraient le maillage interne hub&spoke manquant.

### P1-5 — Pilier : Générer une TOC navigable dans l'assembly
**Fichier** : `guide-pilier.ts` l.263-268
**Correction** : Avant `assembledBody`, générer un bloc HTML TOC :
```typescript
const tocHtml = `<nav aria-label="Sommaire" class="guide-toc"><ol>${
  sections.map(s => `<li><a href="#etape-${s.position}">${s.title}</a></li>`).join('\n')
}</ol></nav>`;
const assembledBody = tocHtml + '\n\n' + sections.map(…).join('\n\n');
```

### P1-6 — Pilier : Ajouter CTA intermédiaires dans `SYSTEM_PROMPT_SECTION`
**Fichier** : `guide-pilier.ts` l.74-83
**Correction** : Ajouter instruction dans `SYSTEM_PROMPT_SECTION` :
```
Optionnel : si la section traite d'un service Axion-IA (audit/intervention/implémentation),
inclure 1 CTA discret en fin de section (ex: <a href="/audit" class="link-cta">Demander un audit IA</a>).
Maximum 1 CTA par section.
```

### P1-7 — Pilier : Appeler l'image pipeline (Unsplash) pour heroImage
**Fichier** : `guide-pilier.ts` — le GeneratorOutput inclut `heroImage?: UnsplashSelectedPhoto` mais guide-pilier ne l'appelle jamais.
**Correction** : Après l'assembly, appeler `routerGenerate` avec `role: "stock_image"` pour récupérer une image hero, identique au pattern landing-ville.

### P1-8 — Pilier : Ajouter liens hub&spoke dans l'outline step 1
**Correction** : Ajouter dans `outlineUserPrompt` :
```
Inclure dans le JSON outline un champ "childArticles": [
  { "title": "...", "suggestedSlug": "..." }
] avec ≥ 5 articles enfants suggérés (sujets sous-thèmes du pilier).
```
Ces liens alimenteraient le maillage interne et seraient consommés par le worker publication.

### P1-9 — FAQ : Contraindre la longueur des réponses individuelles (40-160 mots)
**Fichier** : `faq-standalone.ts` SYSTEM_PROMPT l.24-32
**Correction** : Remplacer "3-6 phrases" par "40-160 mots (2-5 phrases)". Ajouter dans le quality loop un check :
```typescript
const answerWordCounts = parsed.faq.map(f => f.a.split(/\s+/).length);
const offTarget = answerWordCounts.filter(n => n < 40 || n > 160).length;
if (offTarget > 3) issues.push(`${offTarget} réponses hors cible 40-160 mots`);
```

### P1-10 — FAQ : Ajouter instruction de lien vers ressource approfondie
**Fichier** : `faq-standalone.ts` SYSTEM_PROMPT
**Correction** : Ajouter :
```
Chaque réponse doit se terminer par 1 lien contextuel vers une ressource Axion-IA
(ex: /guides/[slug], /audit, /interventions/essentielle) selon le sujet de la question.
```

---

## Recommandations P2 (polish)

### P2-1 — Factorisation SYSTEM_PROMPT : éliminer les doublons blog
**Problème** : `blog-article.ts` et `blog-from-keywords.ts` ont des SYSTEM_PROMPTs quasi-identiques (90% identiques) avec uniquement la différence des seuils (600 vs 500 mots) et la mention "Angle opérationnel".
**Correction** : Extraire un `BLOG_BASE_SYSTEM_PROMPT` dans `shared/blog-base-prompt.ts` et surcharger seulement les variantes.

### P2-2 — Comparatif : Ajouter `dateUpdated` dans GeneratorOutput
**Correction** : Ajouter `readonly dateGenerated: string` dans `GeneratorOutput` (types.ts) initialisé à `new Date().toISOString()`. Injecter dans le bodyHtml comme `<time datetime="...">Données mises à jour le ...</time>`.

### P2-3 — Landing : Ajout disclosure "résultats individuels" dans variants
**Correction** : Ajouter dans chaque `userPromptFocusSection` une instruction de fin :
```
Note légale obligatoire en bas de page (small) : "Les résultats présentés sont des exemples. Les résultats individuels varient selon le contexte et la taille de l'entreprise."
```

### P2-4 — Tous generators : Standardiser la structure des quality loop feedbacks
**Problème** : Le feedback quality loop diffère entre `blog-article.ts`, `blog-from-keywords.ts` et `faq-standalone.ts`. Certains messages sont tronqués (ex: blog-article n'a pas de log `quality_loop_budget_cap_reached`).
**Correction** : Créer `shared/quality-loop.ts` avec une fonction `buildQualityFeedback(scores, issues)` commune.

### P2-5 — Pilier : Ajouter intro séparée (> 200 mots) avant la première section
**Fichier** : `guide-pilier.ts` — pipeline 2-step
**Correction** : Ajouter un step 1.5 "intro generation" après l'outline (system prompt ciblé sur autorité de sujet + 200-300 mots + keyword principal 2x) et prepend au body assemblé.

### P2-6 — RSS : Typer l'input RSS (sourceUrl, sourceName, sourceExcerpt)
**Problème** : `GeneratorBaseInput` ne contient aucun champ RSS-specific. Une fois l'implémentation V2 faite, un type étendu `RssGeneratorInput extends GeneratorBaseInput` est nécessaire.
**Correction** : Ajouter dans `types.ts` :
```typescript
export interface RssGeneratorInput extends GeneratorBaseInput {
  readonly sourceUrl: string;
  readonly sourceName: string;
  readonly sourceTitle?: string;
  readonly sourceExcerpt?: string;
  readonly sourcePublishedAt?: string;
}
```

---

## Observations transversales

### 1. Pattern stubs — 4 generators sur 9 sont inutilisables pour leur type cible
`blog-from-title`, `comparison`, `blog-from-rss`, `qa-derived` délèguent à `landing-ville`. En production, tout job de type `comparison` génère du contenu landing-ville inapproprié. L'absence de `anchorVilleSlug` causerait même un throw pour `blog-from-title` et `qa-derived` (l.34 `landing-ville.ts`).

### 2. Longueurs hardcodées vs dynamiques
Les seuils de qualité sont hardcodés dans chaque generator :
- `blog-article.ts` : MIN 600 mots
- `blog-from-keywords.ts` : MIN 500 mots
- `guide-pilier.ts` : cible 250-450 mots/section
- `faq-standalone.ts` : 10-15 Q/A
Une constante partagée `shared/content-thresholds.ts` éviterait les divergences.

### 3. Templates identiques non factorisés
`blog-article.ts` et `blog-from-keywords.ts` partagent ~90% de leur SYSTEM_PROMPT, la totalité de leur quality loop et leur structure de return. Candidats à une classe abstraite ou factory partagée.

### 4. Absence de prompts centralisés
La doc (`README.md` l.106, `comparison.ts` l.7, `blog-from-rss.ts` l.7) référence des fichiers `prompts/landing-ville.md`, `prompts/comparatif.md`, `prompts/blog-article.md` qui n'existent pas dans le repo. Ces prompts "megapack" sont externalisés dans `.claude/skills/axionia-content-generator/` mais non versionnnés avec le code — risque de divergence prompt/code.

### 5. Indexation trop pessimiste pour le pilier
`guide-pilier.ts` l.319-320 : indexationTier max = `tier_2_noindex_follow` même pour un guide de 2000+ mots avec score ≥ 70. Un guide pilier long-form mérite `tier_1_indexable` — c'est le contenu le plus précieux du site.

---

*Audit généré le 2026-05-21 — Agent A4-01 — Mode AUDIT-ONLY STRICT (0 commit, 0 modification source)*
