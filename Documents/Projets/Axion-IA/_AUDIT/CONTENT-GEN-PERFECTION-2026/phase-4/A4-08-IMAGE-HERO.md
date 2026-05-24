# A4-08 : Image Hero Pertinence & Conformité

## Score : 39/70

**Date audit** : 2026-05-21
**Auditeur** : Agent A4-08 — lecture seule, 0 commit
**Fichiers principaux lus** :
- `axionia/src/server/content-gen/images/assign-hero-image.ts`
- `axionia/src/server/content-gen/images/__tests__/assign-hero-image.spec.ts`
- `axionia/src/server/content-gen/images/image-optimizer.ts`
- `axionia/src/server/content-gen/providers/unsplash.ts`
- `axionia/src/server/content-gen/providers/provider-router.ts`
- `axionia/src/server/content-gen/providers/openai.ts`
- `axionia/src/server/queue/workers/content-gen-worker.ts`
- `axionia/prisma/schema.prisma` (tables ImageAsset, ImageAssetTranslation)
- `axionia/prisma/seeds/image-bank/seed-images.ts`
- `axionia/src/server/image-bank/services/image-seo.service.ts`
- `axionia/src/server/image-bank/services/image-translation.service.ts`
- `axionia/src/server/image-bank/services/image-seo-enrichment.service.ts`
- `axionia/src/server/image-bank/constants.ts`

---

## ⚠️ VÉRIFICATION RÈGLE ABSOLUE : 0 image IA générée

### Résultat : CONFORME ✅ (avec 1 zone grise à documenter)

**Grep exhaustif** sur `axionia/src/**/*.ts` pour les patterns : `dall-e`, `dalle`, `openai.images`, `midjourney`, `generateImage`, `imageGeneration`, `stable-diffusion`, `flux`, `leonardo`

**Résultats** :

| Pattern | Fichiers touchés | Verdict |
|---|---|---|
| `dall-e` | `stack-ia.ts`, `stack-ia-details.ts`, `g2-interventions.ts` | Contenu éditorial (description d'outils client) — BENIN ✅ |
| `dalle` | aucun match hors stack-ia | BENIN ✅ |
| `midjourney` | `stack-ia.ts`, `stack-ia-details.ts`, `g4-aeo.ts` | Contenu éditorial — BENIN ✅ |
| `openai.images.*` | **AUCUN** | ✅ |
| `generateImage` | **AUCUN** | ✅ |
| `imageGeneration` | `image-seo.service.ts` — méthode `generateImageObjectJsonLd()` | Nom de méthode JSON-LD, 0 génération d'image — BENIN ✅ |
| `stable-diffusion` | **AUCUN** | ✅ |
| `flux` | `seed-images.ts` lignes 525,531,534,661,664,701,704 | Keyword métier ("flux facturation IA", "flux données IA") — BENIN ✅ |
| `leonardo` | **AUCUN** | ✅ |

**Zone grise — provider-router.ts ligne 104** :
```typescript
image: [openaiProvider], // V1 = OpenAI image (V2 = gpt_image + fallback Unsplash)
```
Le rôle `"image"` est déclaré dans `ROLE_TO_PROVIDERS` avec `openaiProvider`. CEPENDANT :
- `openaiProvider.generate()` reject immédiatement si `req.role !== "text" && req.role !== "rerank"` avec l'erreur `"OpenAI provider V1 supports text/rerank only (got 'image')"` — la génération d'image via OpenAI est donc **verrouillée en dur** en V1.
- Aucun appel `client.images.generate()` (DALL-E API) n'existe dans tout le codebase.
- Le commentaire "V2 = gpt_image" est une intention future, pas du code actif.

**Verdict RÈGLE ABSOLUE** : **CONFORME ✅** — 0 appel à une API de génération d'images IA dans le code actif. La doctrine `[[feedback_no_dalle_images]]` est respectée partout.

---

## Module assignHeroImage — Score : 18/25

### Architecture générale

Le module `assign-hero-image.ts` est le point d'entrée unique pour l'attribution d'image hero. Il est appelé exclusivement depuis `content-gen-worker.ts` (ligne 300) après la génération textuelle, pour tous les `contentType` sauf `blog_from_rss` (qui conserve la hero RSS si présente).

### Logique de sélection : PAR VERTICALE + SUJET + CIBLE ✅

L'algorithme de scoring est multi-critères :

| Signal | Points | Implémenté |
|---|---|---|
| `module` match (verticale) | +10 | ✅ |
| `targetCity` match (anchorVilleSlug) | +5 | ✅ |
| `targetRegion` match | +5 | ✅ |
| `keywordsPrimary` overlap tokens | +3 | ✅ |
| `targetSector` match (kbSectorTagSlugs) | +2 | ✅ |
| `isFeatured` boost | +0.5 | ✅ |

### Source des images : table Prisma `ImageAsset` ✅

Filtre dur DB :
```typescript
{ isActive: true, isAiGenerated: false, deletedAt: null }
```
Le flag `isAiGenerated: false` est un garde STRICT : aucune image marquée IA ne peut être retournée, même si elle match parfaitement.

### Fallback si aucune image pertinente ✅

Deux cas de `null` silencieux :
1. `candidates.length === 0` → null
2. `best.score <= 0` → null (aucun match meaningful)
3. DB unavailable (build SSG, ECONNREFUSED) → null (catch silencieux)

Le worker logue `hero_image_pending` et l'article est publié avec `Article.featuredImage = null`. Will assigne manuellement via admin.

### PROBLÈME CRITIQUE [P1] : Mismatch entre VERTICAL_TO_IMAGE_MODULE et valeurs réelles en seed

**Le mapping dans assign-hero-image.ts** :
```typescript
const VERTICAL_TO_IMAGE_MODULE: Record<string, string> = {
  audits: "audit",
  interventions_formations: "interventions-formations",
  implementations: "implementation",
  un_a_un: "coaching-1-to-1",
  sites_web_augmentes: "codage-developpement",
};
```

**Les valeurs réelles dans seed-images.ts** :
| VERTICAL_TO_IMAGE_MODULE mappe vers... | Valeur réelle dans seed | Nb images | Impact |
|---|---|---|---|
| `"audit"` | `"audits"` (17 entrées) | 17 | MISMATCH ❌ |
| `"interventions-formations"` | `"interventions"` (15 entrées) | 15 | MISMATCH ❌ |
| `"implementation"` | `"implementations"` (65 entrées) | 65 | MISMATCH ❌ |
| `"coaching-1-to-1"` | `"un-a-un"` (8 entrées) | 8 | MISMATCH ❌ |
| `"codage-developpement"` | absent du seed | 0 | MISMATCH ❌ |

**Conséquence** : pour toutes les verticales, le filtre `where["module"] = imageModule` DB va retourner **0 résultats** puisque les slugs de module ne correspondent pas. Le fallback `candidates.length === 0` déclenche un `null` systématique → tous les articles auront `featuredImage = null`.

**Note** : Le test `assign-hero-image.spec.ts` mocke Prisma et utilise les valeurs du mapping (ex: `module: "audit"` dans le mock), donc le test passe sans détecter le mismatch avec les données réelles.

### Score pertinence — Seuil minimum ✅

Le seuil `best.score <= 0` est correct : si aucun signal positif, l'image est rejetée plutôt que de servir une image sans rapport.

### Attribution logguée ✅

Le worker logue `hero_image_assigned` avec `assetId`, `slug`, `width`, `height` — audit trail complet.

### Score module : 18/25 (malus −7 pour le mismatch P1 bloquant)

---

## Images par type de contenu — Score : 9/20

L'attribution hero est centralisée dans le **worker** (pas dans les générateurs). Les générateurs eux-mêmes ne gèrent pas l'image hero — c'est une décision d'architecture correcte pour la séparation des responsabilités. L'image est attachée au job dans `persistedOutput.heroImageAssetId`.

**Analyse par type de contenu** :

| Type | Hero attendue | Hero réelle | Images secondaires | Score |
|---|---|---|---|---|
| `blog_article` | ≥ 1 | 1 via worker (si match) | Non (générateur n'injecte pas) | 1.5/3 |
| `blog_from_rss` | hero RSS source OU hero Axion-IA | hero RSS si présente, sinon null | Non | 1/2 |
| `landing_ville` | ≥ 1 hero + ≥ 1 image section | 1 via worker (si match) | Non — landing-ville generator renvoie 0 image secondaire | 1.5/3 |
| `faq_standalone` | facultative | null systématique (worker conditionné `!resolvedKeyword`) | N/A | 1/2 |
| `comparison` | hero + pas d'images comparatif | null systématique | N/A | 1/3 |
| `guide_pilier` | ≥ 1 hero + ≥ 2 secondaires + 1/H2 | 1 via worker max (si match) | 0 images secondaires ni par H2 | 1.5/4 |
| `blog_from_keywords` | ≥ 1 hero | 1 via worker (si match) | Non | 1.5/3 |

**Observations critiques** :

1. **[P2] Images secondaires absentes** : Aucun générateur n'injecte d'images secondaires dans le `bodyHtml`. Les sections, H2, et blocs visuels ne reçoivent pas d'images de la banque. La spec demande ≥ 2 images secondaires pour `guide_pilier` et ≥ 1 image section pour `landing_ville`.

2. **[P2] Condition hero trop restrictive** : `const hero = heroFromRss || !resolvedKeyword ? null : await assignHeroImage(...)` — si `resolvedKeyword` est null (pas sélectionné par le keyword-selector), l'image hero n'est jamais tentée, même pour des types où elle est critiques (`guide_pilier`, `landing_ville`).

3. **[P3] FAQ et comparison** : hero non tentée (falls through `!resolvedKeyword` guard en pratique).

4. **RSS** : Le `blog_from_rss` délègue entièrement à `landingVilleGenerator` (pas de hero RSS injectée par le generator). La hero RSS est gérée uniquement par `enrichOutputWithNewsArticleJsonLd` (JSON-LD NewsArticle), pas comme image hero DB. Conforme à la doctrine.

**Score images par type** : 9/20

---

## Alt text audit — Score : 12/15

### Architecture alt text image-bank ✅

Le alt text est géré à deux niveaux :

**Niveau 1 — Image-bank (source)** :
- `ImageAssetTranslation.alt` (champ DB) : 30-125 caractères (constante `ALT_LENGTH_MIN=30`, `ALT_LENGTH_MAX=125`)
- Généré par Claude Sonnet 4.6 vision via `image-seo-enrichment.service.ts` ET `image-translation.service.ts`
- Validation stricte : longueur, pléonasmes, superlatives, keyword-stuffing, anglicismes dans FR
- **Bilingue FR + EN** : `ImageAssetTranslation` par `languageCode` — une entrée FR, une entrée EN

**Niveau 2 — assign-hero-image (consommateur)** :
```typescript
const alt = c.translations[0]?.alt ?? c.translations[0]?.title ?? c.slug.replace(/-/g, " ");
```

### Analyse détaillée

**Contient le keyword ciblé ?** — Partiel ⚠️

La génération du alt text dans `image-seo-enrichment.service.ts` est basée sur la **vision de l'image** via Claude (description factuelle). Elle n'injecte pas systématiquement le `primaryKeyword` de l'article. L'overlap keyword est utilisé pour le *scoring* de sélection (+3 pts sur `keywordsPrimary`), mais pas pour générer le alt text à la volée.

Conséquence : le alt text décrit l'image factuellement (correct SEO 2026), mais peut ne pas contenir le keyword de l'article cible. C'est la **bonne pratique** (alt descriptif, pas keyword-stuffed), mais cela limite le signal SEO keyword-image.

**Décrit l'image, pas juste le keyword** ✅

Le prompt `image-translation.service.ts` est explicite :
```
ALT TEXT (30-125 caractères) décrit factuellement ce qui est SUR l'image (humains, objets, lieu)
— pas une opinion ni un message commercial.
```
Bonne pratique Google 2026 respectée.

**Longueur 80-150 caractères recommandés** — Non optimal ⚠️

La contrainte implémentée est 30-125 caractères (constants), pas 80-150. La borne inférieure (30) est trop basse pour un alt text SEO efficace. La borne supérieure (125) est correcte.

**Alt text bilingue FR et EN** ✅

Architecture correcte : `ImageAssetTranslation` × `languageCode`. Le `image-translation.service.ts` génère la traduction EN via Claude vision. Le scoring image-bank valide FR (20 pts) + EN (15 pts) séparément.

**Le alt EN est-il traduit ou copié ?** ✅

Traduit par Claude Sonnet 4.6 via `image-translation.service.ts`, avec instructions spécifiques :
- Anti-anglicismes et ton sobre conservés
- Slug ASCII anglais adapté
- Prompt différencié FR/EN (pas un copier-coller)

**LACUNE : alt EN non retourné par assignHeroImage** [P2]

`AssignedHeroImage.alt` est un champ unique (FR uniquement) :
```typescript
translations: { where: { languageCode: "fr" }, ... take: 1 }
```
Quand le contenu est publié EN (locale EN activée à terme), le worker utilise toujours le alt FR. Le alt EN de l'`ImageAssetTranslation` est ignoré par le pipeline content-gen.

**figcaption pour images secondaires** — Non applicable en V1

Aucune image secondaire n'est injectée dans le `bodyHtml` par les générateurs (voir section précédente). La question de figcaption est donc théorique en l'état.

**Score alt text** : 12/15

---

## Recommandations

### [P1] Mismatch VERTICAL_TO_IMAGE_MODULE vs valeurs réelles seed/DB
**Impact** : BLOQUANT pour la production — 0 image hero assignée pour toutes les verticales.

Le mapping dans `assign-hero-image.ts` utilise des slugs (`"audit"`, `"interventions-formations"`, `"implementation"`, `"coaching-1-to-1"`) qui ne correspondent pas aux valeurs dans la seed (`"audits"`, `"interventions"`, `"implementations"`, `"un-a-un"`).

**Fix requis** : aligner le mapping avec les valeurs réelles. Choix à trancher :
- Option A : Mettre à jour le mapping dans `assign-hero-image.ts` pour correspondre au seed
- Option B : Mettre à jour les modules dans le seed pour correspondre au mapping

**Note** : La `ImageAssetTranslation` (schema Prisma) utilise un champ `imageId` + `languageCode` sans contrainte sur les valeurs de `module`. Les deux options sont viables.

**Exemple Option A (si seed est la référence)** :
```typescript
const VERTICAL_TO_IMAGE_MODULE: Record<string, string> = {
  audits: "audits",                        // était "audit"
  interventions_formations: "interventions", // était "interventions-formations"
  implementations: "implementations",       // était "implementation"
  un_a_un: "un-a-un",                      // était "coaching-1-to-1"
  sites_web_augmentes: "codage-developpement", // seed absent = 0 images
};
```

### [P1] Test unitaire ne détecte pas le mismatch
Les specs mockent Prisma avec les valeurs du mapping (pas les valeurs DB réelles). Ajouter un test d'intégration (ou un test de snapshot des valeurs de module en seed) pour détecter ce genre de drift.

### [P2] Images secondaires absentes des générateurs
`guide_pilier` et `landing_ville` devraient injecter 1-3 images depuis l'image-bank dans le `bodyHtml` (via `<figure><img>` avec `data-image-asset-id`). Aucun générateur ne le fait en V1. Impact SEO : pages avec 0 image secondaire, pas de signal `srcset` AVIF/WebP pour Google Images.

### [P2] Condition hero trop restrictive sur resolvedKeyword
```typescript
const hero = heroFromRss || !resolvedKeyword ? null : await assignHeroImage(...)
```
Si `resolvedKeyword` est null (keyword-selector ne retourne rien), la hero n'est jamais tentée. Pour `guide_pilier` et `landing_ville`, le `primaryKeyword` devrait toujours être défini (le generateur les requiert). Refactorer pour appeler `assignHeroImage` sans `primaryKeyword` si nécessaire, en se basant uniquement sur la verticale + ville.

### [P2] alt EN absent du retour assignHeroImage
`AssignedHeroImage` n'expose qu'un `alt` FR. Ajouter `altEn?: string` en sélectionnant aussi la traduction EN dans la query (quand locale EN sera réactivée).

### [P2] Borne inférieure alt text trop basse (30 vs 80 recommandé)
`ALT_LENGTH_MIN = 30` dans `constants.ts`. La recommandation SEO 2026 (et le brief audit) est 80-150 caractères. Relever à 60 minimum pour le contenu content-gen (image-bank peut conserver 30 pour les logos/graphiques).

### [P3] image-optimizer.ts dépend de Unsplash (legacy)
`image-optimizer.ts` commence par "Fetch image source (Unsplash regular URL)" dans son docstring (ligne 7). Ce fichier est un vestige du pipeline Unsplash de Sprint 1 — il n'est plus appelé par `assign-hero-image.ts` (qui utilise uniquement les chemins déjà stockés dans `ImageAsset.filePath`). Clarifier ou supprimer pour éviter confusion doctrine.

### [P3] Limite `take: 100` dans assignHeroImage
Si la banque dépasse 100 images (173 en seed actuel), les images les moins récentes ne sont jamais candidats. Augmenter à 500 ou implémenter un pré-filtre DB sur `module` + `targetCity` avant le scoring JS.

---

## Tableau récapitulatif des scores

| Critère | Score | Max |
|---|---|---|
| RÈGLE ABSOLUE : 0 image IA générée | CONFORME ✅ | — |
| Module assignHeroImage | 18 | 25 |
| Images par type de contenu | 9 | 20 |
| Alt text audit | 12 | 15 |
| **TOTAL** | **39** | **70** |

**Verdict** : 🟠 **SPRINT CORRECTIF** — Le P1 mismatch module/seed est un bloquant absolu (0 hero assignée en production). Les P2 sont significatifs pour le SEO Google Images. La règle absolue 0 image IA est strictement respectée.
