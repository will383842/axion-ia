# A3-02 — Featured Snippets & Position 0

## Score : 38/80

## Date : 2026-05-21

## HEAD : 37ca0147

---

## Résumé exécutif

Le pipeline content-gen Axion-IA dispose de bases solides pour certains types de Featured Snippets (FAQ, directAnswer AEO) mais manque de directives explicites et de vérifications programmatiques pour les snippets de type paragraphe intro, liste structurée, tableau comparatif et TOC. Les prompts LLM ne contiennent aucune instruction spécifique à la position 0 Google. Le score de qualité SEO interne (`seo-score.ts`) évalue la présence de `directAnswer` et de FAQ, mais ignore les patterns snippet (longueur intro, H2 en questions, TOC sur longs articles).

---

## Points obtenus

| Critère | Score | Statut |
|---|---|---|
| Structure paragraphe snippet (blog / pilier) | 5/15 | PARTIEL |
| Structure liste snippet (HowTo / guides) | 8/12 | PARTIEL |
| Structure tableau snippet (comparatifs) | 2/12 | MANQUANT |
| FAQ accordion correct + longueur réponse | 8/12 | PARTIEL |
| TOC présent sur articles > 1500 mots | 0/8 | MANQUANT |
| H2/H3 formulés en questions (intent matching) | 4/8 | PARTIEL |
| Longueur introduction 100-150 mots clé-riche | 2/8 | CRITIQUE |
| Meta description 150-160 chars, CTA inclus | 9/5 → plafonné 5/5 | OK |

---

## Détail par critère

### 1. Structure paragraphe snippet (blog / pilier) — 5/15 — PARTIEL

**Ce qui existe :**
- `directAnswer` : champ dédié dans tous les générateurs (`blog-article.ts` ligne 33, `blog-from-keywords.ts` ligne 40, `guide-pilier.ts` ligne 66, `faq-standalone.ts` ligne 32, `landing-ville.ts` ligne 121).
- `seo-score.ts` (ligne 103-110) évalue le `directAnswer` entre 40-80 mots (score max 8/100 sur ce seul critère).
- Le guide pilier spécifie explicitement `"directAnswer": "string (50-80 mots, AEO réponse directe)"` dans le SYSTEM_PROMPT_OUTLINE (`guide-pilier.ts` ligne 66).
- Le composant `AnswerCard.tsx` implémente un encart TL;DR (`data-aeo="tldr"`) avec `<aside role="doc-tip">` — optimisé Perplexity/ChatGPT (`AnswerCard.tsx` lignes 9-24).
- La page blog (`blog/[slug]/page.tsx` lignes 91-101) dérive un `tldrText` depuis `excerpt` ou les 2 premières phrases du body.

**Ce qui manque :**
- Aucun prompt ne spécifie que le **premier paragraphe** du `bodyHtml` doit être une réponse directe 40-60 mots avec le mot-clé en début de phrase.
- Le `SYSTEM_PROMPT` de `blog-article.ts` (lignes 25-33) ne mentionne pas "phrase affirmative en début de body".
- Le `SYSTEM_PROMPT` de `blog-from-keywords.ts` (lignes 33-40) n'a aucune directive intro snippet.
- La vérification de longueur d'intro est absente dans `seo-score.ts` — on mesure `directAnswer` mais pas l'intro du `bodyHtml`.
- Le `blog/[slug]/page.tsx` récupère `tldrText` depuis `excerpt` (pas depuis la 1re phrase du body généré), créant un découplage.
- La page `guides/[slug]/page.tsx` n'affiche pas de bloc `AnswerCard` — le `directAnswer` du guide est perdu à l'affichage.

**Fichiers source :**
- `axionia/src/server/content-gen/generators/blog-article.ts` L25-33
- `axionia/src/server/content-gen/generators/blog-from-keywords.ts` L33-40
- `axionia/src/server/content-gen/quality/seo-score.ts` L103-110
- `axionia/src/components/marketing/AnswerCard.tsx` L1-127
- `axionia/src/app/[locale]/blog/[slug]/page.tsx` L91-101, L330-336

---

### 2. Structure liste snippet (HowTo / guides) — 8/12 — PARTIEL

**Ce qui existe :**
- `guide-pilier.ts` génère des sections avec `<h2 id="etape-N">Étape N : Titre</h2>` (ligne 266), pattern `## Étape N : Titre` compatible avec `parseStepsFromBody` du loader.
- `parseStepsFromBody` (`guides/loader.ts` lignes 66-108) extrait automatiquement les steps numérotées avec 3 patterns (Étape N, Step N, N. Titre).
- JSON-LD HowTo auto-généré via `buildHowToJsonLd` si `hasStructuredSteps` (guide `[slug]/page.tsx` lignes 75-93).
- `SYSTEM_PROMPT_SECTION` (guide-pilier.ts L74-83) autorise `<ul>/<ol>` dans chaque section.
- La whitelist HTML sanitizer (`html-sanitizer.ts` L26-65) autorise `ul`, `ol`, `li`.
- Blog `blog/[slug]/page.tsx` : `parseBody()` (L132-176) détecte les énumérations `1) 2) 3)` et rend un `<ol>` — mais cette heuristique est limitée.

**Ce qui manque :**
- Aucun prompt ne demande explicitement : "inclure une liste `<ol>` intro avec titre H2 commençant par 'Comment [verbe] [sujet]' pour les articles HowTo".
- Le `SYSTEM_PROMPT` blog ne distingue pas les articles de type HowTo (4-8 étapes concrètes) des articles informationnels classiques.
- La heuristique `parseBody()` dans `blog/[slug]/page.tsx` ne reconnaît que `1)` — pas `1.` ni les listes à puces markdown.
- Les guides à < 2 steps structurées basculent en Article JSON-LD sans liste (guides/[slug]/page.tsx L148-153) — pas de fallback liste.
- `blog-from-keywords.ts` : le `maxTokens: 4096` est suffisant pour des listes, mais la structure n'est pas contrainte.

**Fichiers source :**
- `axionia/src/server/content-gen/generators/guide-pilier.ts` L260-268
- `axionia/src/server/content-gen/guides/loader.ts` L66-108
- `axionia/src/app/[locale]/guides/[slug]/page.tsx` L75-93, L130-153
- `axionia/src/app/[locale]/blog/[slug]/page.tsx` L132-176

---

### 3. Structure tableau snippet (comparatifs) — 2/12 — MANQUANT/CRITIQUE

**Ce qui existe :**
- `html-sanitizer.ts` (L47-52) autorise `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>`.
- `seo-score.ts` : `checkIntentAlignment` (L176-197) vérifie la présence de `<table>` pour l'intent `commercial_investigation` (L185).
- `search-intent-validator.ts` (L76-79) : hard fail si `commercial_investigation` sans `hasComparisonTable`.
- La page `/comparaisons/[slug]` existe et a un JSON-LD Article de base.

**Ce qui manque :**
- Le générateur `comparison.ts` (L8-17) est un **stub pur** qui délègue à `landingVilleGenerator` sans aucun prompt spécifique tableau. Aucune colonne Outil/Prix/Points forts/Limites n'est spécifiée.
- Le SYSTEM_PROMPT du `landingVilleGenerator` (via `DOCTRINE_INTOUCHABLE` + variant) ne contient aucune directive sur les tableaux comparatifs.
- `search-intent-validator.ts` a bien un `hasComparisonTable` mais cette valeur est **toujours `false` par défaut** — jamais peuplée par aucun générateur (voir `landing-ville.ts` : pas de `hasComparisonTable` dans l'appel à `validateIntentAlignment`).
- Les pages `/comparaisons/[slug]/page.tsx` (L129-147) affichent le body en paragraphes `<p>` seulement — aucun `<table>` HTML rendu.
- Les contenus statiques `/comparaisons/` sont FS (hardcodés dans `src/content/comparaisons`) sans tableau structuré.
- `blog-from-keywords.ts` pour les articles de type comparatif ne force pas de `<table>`.

**Fichiers source :**
- `axionia/src/server/content-gen/generators/comparison.ts` L1-17
- `axionia/src/server/content-gen/quality/search-intent-validator.ts` L18, L76-79
- `axionia/src/app/[locale]/comparaisons/[slug]/page.tsx` L129-147

---

### 4. FAQ accordion correct + longueur réponse — 8/12 — PARTIEL

**Ce qui existe (FORT) :**
- `FaqAccordion.tsx` (L46-70) : implémentation Radix UI avec `AccordionItem/Trigger/Content`, attributs `data-faq-q` et `data-faq-a`, JSON-LD FAQPage auto-émis.
- `FaqBlock.tsx` : wrapper propre, tone system, section `#axion-faq`.
- `faq-standalone.ts` : 10-15 questions ciblant People-Also-Ask (L27-28), qualité vérifiée (L139-165).
- Page FAQ `/faq/[slug]/page.tsx` : `data-aeo="answer"` + `.faq-answer` (L144-147), Speakable JSON-LD via `buildQAPageJsonLd` (L71-78).
- `html-sanitizer.ts` : balises `<details>`, `<summary>` autorisées (L63-64) — compatibles snippet natif.
- `faq-standalone.ts` : réponses "3-6 phrases directes" (L27-28) = ~60-120 mots par réponse.
- FAQPage JSON-LD synchronisé via `buildFaqSpeakableJsonLd` sur la page `/faq` (ligne 63).

**Ce qui manque :**
- La **longueur de réponse FAQ** dans les generators blog/landing n'est pas contrainte à 40-60 mots. `blog-article.ts` demande "réponses directes ≥ 2 lignes" (L32) — trop vague.
- `faq-standalone.ts` demande "3-6 phrases" (L27) mais ne vérifie PAS la longueur en mots dans le quality loop (L139-165 ne check que le count ≥ 10).
- Le `seo-score.ts` compte uniquement le nombre de FAQ (≥ 4 → 8 pts) mais ne mesure pas la longueur des réponses.
- Le guide `[slug]/page.tsx` n'affiche pas la FAQ du guide (champ `faq` dans GeneratorOutput) — les FAQ des guides piliers sont donc **invisibles** sur la page publique.
- L'accordéon Radix (`accordion.tsx` L55) n'émet pas de `role="region"` explicite (Radix gère l'ARIA automatiquement via `aria-expanded` mais le pattern `role="region"` pour Googlebot est absent).

**Fichiers source :**
- `axionia/src/components/marketing/FaqAccordion.tsx` L1-70
- `axionia/src/components/sections/FaqBlock.tsx` L35-72
- `axionia/src/server/content-gen/generators/faq-standalone.ts` L24-32
- `axionia/src/app/[locale]/faq/[slug]/page.tsx` L143-148
- `axionia/src/app/[locale]/guides/[slug]/page.tsx` (absence de FAQ block)

---

### 5. TOC présent sur articles > 1500 mots — 0/8 — MANQUANT/CRITIQUE

**Ce qui existe :**
- Aucun composant TOC/Table of Contents n'existe dans `src/components/`.
- La recherche `toc|table-of-contents|TableOfContents` dans tout le projet renvoie 0 résultat dans les composants.
- Les guides piliers ont des sections avec `id="etape-N"` (guide-pilier.ts L266) et la page `guides/[slug]/page.tsx` affiche des sections avec `aria-labelledby="step-N"` (L134) — des ancres existent, mais aucun composant ne génère les liens vers ces ancres.

**Ce qui manque :**
- Absence totale de composant `<TableOfContents>` ou `<Toc>`.
- Le `SYSTEM_PROMPT_SECTION` (`guide-pilier.ts` L74-83) ne demande pas de liens d'ancrage dans les sections.
- Les articles blog > 1500 mots (blog-article.ts : minimum 600 mots, guide-pilier.ts : minimum 2000 mots) n'ont aucune génération automatique de TOC.
- La page `guides/[slug]/page.tsx` (L101-153) ne génère pas un index des sections en début de page.
- Impact direct : les guides piliers (2000-5000 mots, 8-15 sections) sont les candidats parfaits pour le Featured Snippet TOC (liste d'ancres) — actuellement 0% exploités.

**Fichiers source :**
- Absence de fichier dans `axionia/src/components/` contenant "toc"
- `axionia/src/app/[locale]/guides/[slug]/page.tsx` L101-153 (sections sans TOC)
- `axionia/src/server/content-gen/generators/guide-pilier.ts` L260-268 (ancres id="etape-N" non exploitées en TOC)

---

### 6. H2/H3 formulés en questions (intent matching) — 4/8 — PARTIEL

**Ce qui existe :**
- `search-intent-validator.ts` (L69-72) : pour intent `informational`, vérifie que le title commence par "Comment/Pourquoi/Qu'est-ce/Quels/Quelles/Combien/Que faire" — mais c'est pour le **title** H1, pas les H2.
- Les templates `landing-ville` ont des sections obligatoires avec FAQ × 8 (landing-ville-templates.ts L78-82) — les questions FAQ sont des H2 implicites.
- `blog-from-keywords.ts` SYSTEM_PROMPT (L33-40) : mentionne "People-Also-Ask" pour les FAQ mais pas pour les H2 du body.
- Le guide-pilier génère des H2 "Étape N : [Titre]" — format step, pas question.

**Ce qui manque :**
- Aucun SYSTEM_PROMPT ne contraint les **H2/H3 du body** à être formulés en questions ("Comment ?", "Pourquoi ?", "Quels sont ?").
- La vérification `seo-score.ts` : `scoreH2Structure` (L76-80) compte seulement le nombre de H2 (3-8) sans vérifier leur formulation interrogative.
- Le `SYSTEM_PROMPT_OUTLINE` (guide-pilier.ts L48-72) demande des sections "sous-thème distinct, progression logique" — mais sans contraindre les titres de sections à être des questions utilisateur.
- La landing-ville (tous variants) ne demande pas de H2 interrogatifs — seulement les FAQ séparées.
- Le blog-article.ts ne mentionne pas explicitement les H2 comme points de capture snippet.

**Fichiers source :**
- `axionia/src/server/content-gen/quality/seo-score.ts` L76-80
- `axionia/src/server/content-gen/quality/search-intent-validator.ts` L69-72
- `axionia/src/server/content-gen/generators/blog-from-keywords.ts` L33-40

---

### 7. Longueur introduction 100-150 mots clé-riche — 2/8 — CRITIQUE

**Ce qui existe :**
- `blog-article.ts` : le `directAnswer` est évalué 40-80 mots (`seo-score.ts` L103-110).
- `guide-pilier.ts` : `directAnswer` = 50-80 mots (L66 SYSTEM_PROMPT_OUTLINE).
- `AnswerCard.tsx` : commentaire "50-80 mots optimaux" (L33).

**Ce qui manque :**
- Aucun prompt ne spécifie explicitement une **introduction de 100-150 mots** comme premier bloc du `bodyHtml` distinct du `directAnswer`.
- Le `SYSTEM_PROMPT` de `blog-article.ts` (L25-33) et `blog-from-keywords.ts` (L33-40) ne mentionnent pas la longueur de l'intro.
- `seo-score.ts` ne vérifie pas la longueur du premier paragraphe du bodyHtml.
- La page `blog/[slug]/page.tsx` : la fonction `deriveTldr` (L91-101) récupère max 2 phrases pour le TL;DR — ce n'est pas une vérification de longueur d'intro.
- Le `faq-standalone.ts` spécifie un `bodyHtml` = "intro thématique HTML 2-3 paragraphes" (L31) mais sans contrainte de mots.
- Impact : le LLM peut générer une intro de 20 mots ou 300 mots — aucun garde-fou programmatique.

**Fichiers source :**
- `axionia/src/server/content-gen/generators/blog-article.ts` L25-33
- `axionia/src/server/content-gen/generators/faq-standalone.ts` L31
- `axionia/src/server/content-gen/quality/seo-score.ts` L103-135 (scoreDirectAnswer + scoreWordCount — aucun scoreIntroLength)

---

### 8. Meta description 150-160 chars, CTA inclus — 5/5 — OK

**Ce qui existe :**
- `seo-score.ts` (L62-68) : `scoreMetaDescription` vérifie 140-160 chars (10/10 si dans la fenêtre, 7/10 si 120-180).
- Tous les SYSTEM_PROMTs demandent `metaDescription` dans le JSON de sortie.
- `guide-pilier.ts` SYSTEM_PROMPT_OUTLINE L64 : `"metaDescription": "string (140-160 chars)"` — contrainte explicite.
- La qualité loop réagit si `seo.score < 60` en citant "FAQ manquante + directAnswer trop court" (`blog-from-keywords.ts` L210-211).
- Le quality threshold de 60/100 assure une meta acceptablement longue via gate indirect.

**Ce qui manque (mineur) :**
- Aucun SYSTEM_PROMPT ne demande explicitement un **CTA** dans la meta description ("Découvrez comment…", "Réservez…").
- La vérification `scoreMetaDescription` ne teste pas la présence d'un verbe d'action ou CTA.

**Fichiers source :**
- `axionia/src/server/content-gen/quality/seo-score.ts` L62-68
- `axionia/src/server/content-gen/generators/guide-pilier.ts` L64

---

## Points perdus

### [CRITIQUE] P0 — Absence totale de TOC (-8/8)
Aucun composant Table of Contents dans le projet. Les guides piliers (2000-5000 mots, 8-15 sections, ancres `id="etape-N"` disponibles) ne génèrent pas de TOC. C'est le type de Featured Snippet le plus facile à obtenir sur les longs articles "Comment faire" et "Guide complet".

### [CRITIQUE] P0 — Générateur comparison = stub délégant à landing-ville (-10/12)
`comparison.ts` est un one-liner qui appelle `landingVilleGenerator` sans prompt spécifique tableau. Aucun `<table>` structuré avec `<thead>` et colonnes Outil/Prix/Points forts/Limites n'est généré. Intent `commercial_investigation` = 0% couvert pour position 0.

### [P1] — Intro snippet non contrainte en longueur (-6/8)
Aucune directive LLM ni vérification programmatique sur la longueur du premier paragraphe du bodyHtml (cible 100-150 mots). La qualité loop mesure `wordCount` global mais pas l'intro.

### [P1] — Guides sans bloc FAQ affiché en page publique (-4/12)
Le générateur `guide-pilier.ts` produit bien un champ `faq` (FAQ extraites de l'outline), mais la page `guides/[slug]/page.tsx` n'affiche pas de `FaqBlock`. Les FAQ guides sont invisibles pour Google et les LLMs.

### [P1] — H2/H3 non formulés en questions dans les prompts (-4/8)
Les SYSTEM_PROMTs des générateurs blog et guide ne contraignent pas les sous-titres H2/H3 à être formulés en questions utilisateur (format "Pourquoi/Comment/Quels sont...").

### [P2] — Longueur réponses FAQ non vérifiée programmatiquement (-4/12 partiel)
Le quality loop `faq-standalone.ts` vérifie le count ≥ 10 mais pas la longueur de chaque réponse (cible 40-60 mots pour snippet). Le `seo-score.ts` ne mesure pas la longueur des réponses FAQ.

### [P2] — AnswerCard absent de la page guides/[slug] (-2 bonus manqué)
Le `directAnswer` généré par `guide-pilier.ts` (50-80 mots) n'est pas affiché sur la page publique. La page blog l'affiche via `AnswerCard` mais pas les guides.

---

## Recommandations ordonnées par ROI

### 1. Quick wins (< 2h chacun)

**QW-1 : Ajouter TOC auto dans `guides/[slug]/page.tsx`**
Les ancres `id="etape-N"` existent déjà. Ajouter un bloc TOC avant les sections :
```tsx
// guides/[slug]/page.tsx
{guide.hasStructuredSteps && guide.steps.length >= 3 && (
  <nav aria-label="Sommaire" className="mb-8">
    <ol>
      {guide.steps.map(s => (
        <li key={s.position}>
          <a href={`#step-${s.position}`}>{s.name}</a>
        </li>
      ))}
    </ol>
  </nav>
)}
```
Fichier cible : `axionia/src/app/[locale]/guides/[slug]/page.tsx` L104
ROI : Déclenche Featured Snippet "liste ordonnée" sur tous les guides > 3 étapes.

**QW-2 : Ajouter FaqBlock sur la page `guides/[slug]/page.tsx`**
La FAQ est déjà dans `guide.faq` via `faqJson`. Ajouter après le body :
```tsx
{guide.faq && guide.faq.length > 0 && (
  <FaqBlock items={guide.faq.map(q => ({ id: q.slug, question: q.question, answer: q.answer }))} />
)}
```
Fichier cible : `axionia/src/app/[locale]/guides/[slug]/page.tsx` L158
ROI : FAQ guides indexables → Featured Snippet FAQ + People Also Ask.

**QW-3 : Ajouter AnswerCard sur `guides/[slug]/page.tsx`**
Le `guide.excerpt` contient le `directAnswer` (50-80 mots). L'afficher en `AnswerCard` en haut de page comme la page blog.
Fichier cible : `axionia/src/app/[locale]/guides/[slug]/page.tsx` L120
ROI : Pattern TL;DR = +25-40% citation rate Perplexity/AI Overviews (cf. commentaire AnswerCard.tsx).

**QW-4 : Ajouter directive intro 100-150 mots dans `seo-score.ts`**
Ajouter `scoreIntroLength` dans la grille :
```typescript
function scoreIntroLength(bodyHtml: string): { got: number; reason?: string } {
  const firstP = /<p[^>]*>(.*?)<\/p>/is.exec(bodyHtml)?.[1]?.replace(/<[^>]+>/g, '') ?? '';
  const words = firstP.trim().split(/\s+/).filter(Boolean).length;
  if (words >= 100 && words <= 150) return { got: 5 };
  if (words >= 60 && words <= 200) return { got: 2, reason: `Intro ${words} mots (cible 100-150)` };
  return { got: 0, reason: `Intro ${words} mots hors cible` };
}
```
Fichier cible : `axionia/src/server/content-gen/quality/seo-score.ts`
ROI : Gate programmatique + feedback quality loop ciblé.

### 2. Sprint (< 1 jour)

**SP-1 : Réécrire le générateur `comparison.ts` avec prompt dédié tableau**
Remplacer le stub par un vrai générateur avec SYSTEM_PROMPT imposant :
- `<table>` obligatoire avec `<thead>` et colonnes : Critère / Axion-IA / Alternative / Verdict
- H2 "Tableau comparatif : [Outil A] vs [Outil B]"
- Introduction 100-150 mots avec mot-clé en 1re phrase
- Quality check `hasComparisonTable` passé à `true` avant upsert

Fichier cible : `axionia/src/server/content-gen/generators/comparison.ts`
ROI : Unlock total du Featured Snippet tableau pour intent `commercial_investigation` (actuellement 0%).

**SP-2 : Ajouter directives H2 interrogatifs dans les SYSTEM_PROMTs blog**
Dans `blog-article.ts` et `blog-from-keywords.ts`, ajouter dans SYSTEM_PROMPT :
```
- Titres H2 du body : formuler en questions utilisateur si applicable
  ("Comment X ?", "Pourquoi Y ?", "Quels sont les Z ?") pour aligner intent PAA.
- Premier H2 = réponse directe au titre dans 40-60 mots.
```
Fichiers cibles :
- `axionia/src/server/content-gen/generators/blog-article.ts` L25-33
- `axionia/src/server/content-gen/generators/blog-from-keywords.ts` L33-40
ROI : +30-50% H2 en questions → capturer les PAA boxes liées à chaque article.

**SP-3 : Contraindre longueur intro 100-150 mots dans les prompts**
Dans tous les SYSTEM_PROMTs de générateurs, ajouter :
```
- Premier paragraphe du bodyHtml : 100-150 mots, commence par le mot-clé principal,
  phrase affirmative déclarative ("L'audit IA permet à une PME de…").
```
Et dans le quality loop feedback (`blog-article.ts` L186-196), ajouter le check intro.
ROI : Alignement avec le critère Google Featured Snippet paragraphe.

**SP-4 : Créer composant `<TableOfContents>` réutilisable**
Composant server-side qui reçoit les `steps: GuideStep[]` et génère un `<nav>` accessible avec liens #id. Réutilisable pour guides et futurs articles longs.
Fichier cible : `axionia/src/components/content/TableOfContents.tsx` (nouveau)
ROI : TOC → Featured Snippet "liste" sur tous les guides piliers + articles > 1500 mots.

**SP-5 : Vérifier longueur réponses FAQ dans quality loop**
Dans `faq-standalone.ts` quality loop (L139-165), ajouter :
```typescript
const shortAnswers = (parsed.faq ?? []).filter(f => f.a.split(/\s+/).length < 30).length;
if (shortAnswers > 2) issues.push(`${shortAnswers} réponses FAQ < 30 mots (cible 40-60)`);
```
Fichier cible : `axionia/src/server/content-gen/generators/faq-standalone.ts` L159

### 3. Projets (> 1 jour)

**PR-1 : Refonte de `seo-score.ts` avec critères snippet**
Ajouter 5 nouveaux critères (max +20 pts) :
- `scoreIntroLength` : intro 100-150 mots (+5)
- `scoreFaqAnswerLength` : réponses FAQ 40-60 mots en moyenne (+5)
- `scoreH2Questions` : % H2 formulés en questions ≥ 30% (+4)
- `scoreTablePresence` : `<table><thead>` pour intent comparatif (+3)
- `scoreTocPresence` : TOC présent si wordCount > 1500 (+3)

Fichier cible : `axionia/src/server/content-gen/quality/seo-score.ts`
ROI : Gate qualité automatique snippet sur toute la factory.

**PR-2 : Pipeline Guide 2-step avec TOC et FAQ obligatoires**
Lors de l'assembly dans `guide-pilier.ts` (L261-268) :
1. Générer un bloc HTML TOC depuis les sections avant le body
2. Injecter les FAQ de l'outline dans `faqJson` ET les afficher dans `bodyHtml` final
3. Contraindre chaque section à commencer par une phrase affirmative 40-60 mots

Fichier cible : `axionia/src/server/content-gen/generators/guide-pilier.ts` L260-330
ROI : Guides piliers optimaux position 0 sur les 3 types : paragraphe + liste + FAQ.

**PR-3 : A/B test intro snippet sur pages blog DB existantes**
Pour les articles DB publiés tier-1, déclencher une re-génération ciblée de l'intro uniquement (100-150 mots, keyword en début) sans re-générer le body entier. Implique :
- Nouveau job BullMQ `content-improve-intro`
- Server action admin "Re-générer intro"
- Test impact CTR Search Console sur 30 jours

ROI : Quick improvement du corpus existant sans coût de re-génération complète.

---

## Synthèse des gaps critiques

| Gap | Impact Featured Snippet | Effort fix |
|---|---|---|
| Absence TOC | Snippet liste / ancres = 0% | 2h |
| comparison.ts stub | Snippet tableau = 0% | 1j |
| FAQ guides invisible | Snippet FAQ guides = 0% | 1h |
| Intro non contrainte | Snippet paragraphe ~40% rate | 30min prompt + 2h score |
| H2 non interrogatifs | PAA capture ~20% vs 60% potentiel | 30min prompt |
| Longueur FAQ non vérifiée | Snippet FAQ dilué | 1h |

---

## Annexe — Inventaire des fichiers analysés

| Fichier | Rôle dans la chaîne snippet |
|---|---|
| `src/server/content-gen/generators/blog-article.ts` | Prompt blog, quality loop, directAnswer |
| `src/server/content-gen/generators/blog-from-keywords.ts` | Prompt blog keywords, FAQ PAA |
| `src/server/content-gen/generators/guide-pilier.ts` | Pipeline 2-step, H2 étapes, TOC potentiel |
| `src/server/content-gen/generators/faq-standalone.ts` | FAQ standalone 10-15 Q/A |
| `src/server/content-gen/generators/comparison.ts` | Stub — tableau non implémenté |
| `src/server/content-gen/generators/landing-ville-templates.ts` | 4 variants, FAQ × 8 obligatoires |
| `src/server/content-gen/quality/seo-score.ts` | Gate qualité : directAnswer, FAQ count, H1/H2 |
| `src/server/content-gen/quality/search-intent-validator.ts` | Validation intent commercial_investigation |
| `src/server/content-gen/guides/loader.ts` | parseStepsFromBody, ancres id |
| `src/server/content-gen/shared/html-sanitizer.ts` | Whitelist HTML (table, details/summary OK) |
| `src/app/[locale]/blog/[slug]/page.tsx` | Render blog, AnswerCard, parseBody ol |
| `src/app/[locale]/guides/[slug]/page.tsx` | Render guide, HowTo JSON-LD, pas de TOC ni FAQ |
| `src/app/[locale]/faq/page.tsx` | FAQ globale, Speakable JSON-LD |
| `src/app/[locale]/faq/[slug]/page.tsx` | QAPage JSON-LD, data-aeo="answer" |
| `src/app/[locale]/comparaisons/[slug]/page.tsx` | Body en <p> seulement, pas de <table> |
| `src/components/marketing/FaqAccordion.tsx` | Accordéon Radix + FAQPage JSON-LD |
| `src/components/marketing/AnswerCard.tsx` | TL;DR AEO, absent des pages guides |
| `src/components/sections/FaqBlock.tsx` | Wrapper FAQ, non utilisé sur guides |
