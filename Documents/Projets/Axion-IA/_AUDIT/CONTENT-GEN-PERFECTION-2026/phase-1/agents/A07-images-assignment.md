# A07 — Images : Assignation, Alt, Variants, Fallback

**Agent** : A07  
**Commit audité** : `2b98a7067d7eae701dec42a2c5d6e859364e0e64`  
**Date audit** : 2026-05-21  
**Mode** : AUDIT-ONLY STRICT — 0 modification de code  
**Score final** : **21/40**

---

## Mission

Auditer comment les images sont assignées aux articles depuis l'image-bank, la qualité des alt, les variants servis (AVIF+WebP+LQIP), et la doctrine « jamais d'IA générative ».

---

## Méthode

1. Lecture exhaustive de `src/server/content-gen/` — generators, providers, types, images/
2. Lecture de `src/server/image-bank/` — services (import, enrich, seo, jsonld, translation, watermark)
3. Lecture de `prisma/schema.prisma` — modèles Article, ImageAsset, ImageAssetTranslation
4. Lecture de `prisma/seeds/image-bank/seed-images.ts`
5. Lecture de `src/components/visual/Illustration.tsx`, `src/components/ui/ImageBankPicture.tsx`, `src/components/galerie/GalleryGrid.tsx`
6. Lecture de `src/app/[locale]/galerie/[slug]/page.tsx`
7. Lecture des 4 routes sitemaps images (services / T1 / T2 / T3-T4)
8. Grep exhaustif `dall-e|midjourney|stable.diffusion|imagen|openai.*image` dans tout le code source
9. Grep `isAiGenerated|aiGenerated|ai_generated` dans `src/`
10. Grep `figcaption` dans `src/app/`
11. Grep `ImageBankPicture` — usage effectif dans les templates de pages
12. Vérification `public/images/` — présence physique des fichiers

---

## État observé

### Q1 — Comment un article reçoit une image ?

**Deux pipelines distincts, NON connectés à la DB image-bank :**

**Pipeline A — Unsplash (content-gen)** :  
- `generators/landing-ville.ts` : commentaire « 4. Unsplash hero image (free only, doctrine v3) » dans le JSDoc, mais l'implémentation **n'appelle pas le provider Unsplash** — aucune ligne `routerGenerate({ role: "stock_image" })` dans le corps de la fonction (retour direct sans `heroImage`).  
- `generators/blog-from-keywords.ts` : **0 appel image** — aucune référence Unsplash ni heroImage dans le code.  
- `generators/blog-article.ts` : **0 appel image**.  
- `generators/guide-pilier.ts` : **0 appel image**.  
- `generators/types.ts:51` : `readonly heroImage?: UnsplashSelectedPhoto` — champ défini dans le type output mais **jamais populé** par les generators actuels.  
- `generators/blog-from-rss.ts:47,66` : `heroImageUrl?: string` accepté en input (depuis le flux RSS) et passé à `imageUrl`, mais le provider Unsplash n'est pas appelé.  

**Conclusion Pipeline A** : le provider Unsplash (`role: "stock_image"`) est implémenté mais **jamais déclenché** par les generators actuels. `heroImage` reste `undefined` dans tous les `GeneratorOutput`. Le publish worker (`content-publish-worker.ts`) ne lit pas non plus `heroImage` depuis `outputJsonRaw` — aucun champ image n'est persisté en DB sur `Article`.

**Pipeline B — Image-bank (galerie publique)** :  
- La DB `ImageAsset` est **indépendante** du pipeline content-gen.  
- 133 images seedées via `prisma/seeds/image-bank/seed-images.ts`.  
- 135 WebP + 133 AVIF présents physiquement dans `public/images/`.  
- Aucune FK `imageId` dans le modèle `Article` (schema ligne 874–955).  
- `Article.featuredImage` (ligne 881) = `String?` URL libre, **non FK** vers `ImageAsset`.  

**Conclusion** : il n'existe **aucun mapping algorithmique** topic → image-bank. Les articles générés n'ont aucune image assignée automatiquement depuis la banque.

### Q2 — Algorithme d'assignation

**ABSENT.** Pas de `assignImage`, `imageSelector`, cosine sur embeddings, ni lookup `keywordsPrimary`. Les seules assignations observées sont :

- **Galerie publique** (`/galerie/[slug]`) : chaque image a sa propre page de détail — ce n'est pas une assignation d'image à un article.
- **Sitemaps villes** : mapping slug-based `axion-ia-{ville.slug}-formation-ia-banniere` → calculé statiquement dans les route handlers, pas en DB.
- **Composant `Illustration`** : utilisé sur les pages marketing statiques (a-propos, guide-ia, etc.) avec `src` omis → mode placeholder. Aucun `src` réel passé sur aucune `Illustration` dans les pages scannées.
- **`ImageBankPicture`** : composant défini (`src/components/ui/ImageBankPicture.tsx`) mais **0 usage** dans les templates de pages (grep exhaustif confirme 0 import en dehors de sa propre définition).

### Q3 — Fallback si image-bank vide

**Pas de fallback pour les articles** : le content-gen ne tente pas d'assigner une image, donc il n'y a pas de logique de fallback non plus. Le modèle `Article` n'a pas de champ `status: pending_image`. Pour les pages marketing statiques, `Illustration` affiche un `IllustrationPlaceholder` branded (fond ivoire + grille terracotta).

### Q4 — Doctrine 0 IA générative

**Résultat grep `dall-e|midjourney|stable.diffusion|imagen|openai.*image`** dans `src/` :

- `src/components/sections/ToolLogo.tsx:148` : SVG icon Midjourney (logo vectoriel pour la page stack-ia, pas une image générée).
- `src/content/keywords/g2-interventions.ts:2022` : mention de Midjourney/DALL-E dans le texte d'une FAQ (description des outils marché).
- `src/content/stack-ia-details.ts:119,122,133,141,144,155,571,584,595,599,617` : Midjourney et DALL-E mentionnés comme **outils concurrents** décrits dans la page stack-ia.
- `src/content/stack-ia.ts:222,226,238,242,564-599` : idem.
- `src/content/keywords/g4-aeo.ts:1026` : mention Midjourney dans une FAQ AI Act.
- `src/server/content-gen/providers/provider-router.ts:104` : `image: [openaiProvider]` — commentaire `V1 = OpenAI image (V2 = gpt_image + fallback Unsplash)`. L'`openaiProvider.generate()` renvoie immédiatement une erreur `ProviderError` pour `role !== "text" && role !== "rerank"` (ligne 107-113). Donc **aucune image n'est générée par OpenAI**.
- `src/server/content-gen/lib/config-reader.ts:22` : `gpt_image: { model: "gpt-image-1", enabled: false, monthlyCapUsd: 0 }` — **désactivé hardcodé**.
- `src/server/image-bank/services/image-seo-enrichment.service.ts:260` : `image.sourceType === "ai_generated"` — seulement pour adapter le prompt Claude Vision (déclarer si l'image EST AI-generated, pas pour générer).
- `_AUDIT/gpt-image-prompts.md` : document d'audit archivé (prompts candidats pour Will), **pas du code actif**.

**Conclusion** : 0 image générée par IA dans le code actif. La doctrine est respectée.

**CEPENDANT** : le seed `seed-images.ts:909` contient `const isAiGenerated = entry.isAiGenerated !== undefined ? entry.isAiGenerated : !isLogo` — soit **les 126 images non-logo sont seedées avec `isAiGenerated: true`** (car `!isLogo = true`). C'est manifestement **une erreur de logique** de seed : les images importées par Will sont des créations originales, pas des images IA. Le champ DB risque d'être trompeur.

### Q5 — Alt rédactionnel

**Image-bank** : alt généré par Claude Sonnet 4.6 Vision via `ImageSeoEnrichmentService` :
- Contrainte système : `ALT : 30-125 char, factuel, pas commercial`
- Validation hard dans `enrichAndSave()` + `image-attribute-validator.service.ts:102` : `alt.length >= 30 && alt.length <= 125`
- Pleonasm check : `isPleonasm(r.alt)` → throw si pleonastique
- Traduction : `image-translation.service.ts:186-189` enforce également les limites

**Composant `Illustration` (pages marketing)** : alt passé manuellement en prop, longueurs observées :
- `"Illustration éditoriale d'un atelier d'architecte symbolisant la précision opérationnelle d'Axion-IA."` = 102 chars ✅
- `"Illustration éditoriale d'une collection d'objets opérationnels symbolisant les cas concrets clients Axion-IA."` = 112 chars ✅

**GalleryGrid** : `alt={t.alt ?? t.title ?? ""}` — fallback sur title si alt absent ⚠️ (alt vide possible si image non enrichie)

**Articles générés** : pas d'alt car pas d'image assignée.

### Q6 — Longueur alt < 125 chars

**Image-bank** : contrainte enforced hard (30-125). ✅  
**Pages marketing** : alts manuels observés tous < 125. ✅  
**Articles** : N/A (pas d'image).

### Q7 — Variants AVIF + WebP + LQIP + thumbnail

**Image-bank (upload admin via `image-import.service.ts`)** :
- WebP : 4 variants sm/md/lg/xl (640/960/1200/1920px)
- AVIF : 2 variants md/lg (960/1200px)
- OG : 1200×630 WebP
- Thumbnail : 300px WebP
- LQIP : 20px JPEG blur base64 (≤ 1 KB)
- Strip EXIF GPS (RGPD) ✅

**Images seedées (`public/images/`)** :
- Pattern observé : `{slug}.webp`, `{slug}.avif`, `{slug}-thumb.webp`
- Ni `-sm.webp`, ni `-md.webp` variants  — le pipeline Sharp `auto-convert-worker` est prévu mais non confirmé exécuté
- `ImageBankPicture.tsx` référence `{slug}-md.webp`, `{slug}-sm.webp` → 404 probable sur les images seedées ⚠️

**Content-gen `image-optimizer.ts`** : 3 widths × 3 formats (AVIF/WebP/JPG) dans `public/illustrations/generated/content-gen/{photoId}/` — fonctionnel si appelé, mais **jamais appelé** par les generators actuels.

### Q8 — `<Image/>` next/image vs `<img/>` raw

- **`GalleryGrid.tsx`** : `import Image from "next/image"` → `<Image fill>` ✅  
- **`galerie/[slug]/page.tsx`** : `import Image from "next/image"` ✅  
- **`Illustration.tsx`** : `import Image from "next/image"` ✅  
- **`ImageBankPicture.tsx`** : utilise `<picture>/<source>/<img>` raw — **composant 'use client'** qui implémente manuellement AVIF+WebP srcset. Le `<img>` interne est un fallback dans un `<picture>`, ce qui est conforme HTML5 standard ⚠️ (pas de next/image, mais pattern valide)
- **`ImageUploadDropzone.tsx:89`** : `<img src={previewUrl}>` raw — preview admin uniquement, non public ✅
- **`AuthorByline.tsx:49`** : `<img>` raw — photo auteur. P2 mineur.

### Q9 — Loading lazy sauf hero

- **`GalleryGrid.tsx:83-84`** : `priority={idx === 0}` + `{...(idx === 0 ? { fetchPriority: "high" } : {})}` ✅  
- **`galerie/[slug]/page.tsx:187`** : `fetchPriority="high"` sur l'image hero ✅  
- **`ImageBankPicture.tsx:120-122`** : `loading={priority ? 'eager' : 'lazy'}` + `fetchPriority={priority ? 'high' : 'auto'}` ✅  
- **`Illustration.tsx:94`** : passe `priority` à `<Image>` ✅

### Q10 — srcset + sizes cohérents

- **`GalleryGrid.tsx:80`** : `sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"` ✅  
- **`galerie/[slug]/page.tsx:185`** : `sizes="(min-width: 1024px) 66vw, 100vw"` ✅  
- **`ImageBankPicture.tsx:112-113`** : `srcSet="{slug}.webp 1920w, {slug}-md.webp 768w, {slug}-sm.webp 384w"` + `sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px"` — **valide si variants existent** (mais `-md.webp`/`-sm.webp` absents pour les images seedées)

### Q11 — EXIF / IPTC / XMP embed

**EXIF strip** : `image-import.service.ts:92` — `withMetadata({ orientation: 1 })` strip EXIF GPS (RGPD) ✅  
**IPTC embed** : `image-seo.service.ts:295` — `const iptc = 5; // assumé OK si import a réussi` — **ASSUMED, pas vérifié réellement** ⚠️. Sharp `.withMetadata()` préserve les metadata existantes mais ne les écrit pas. Il n'y a pas de code d'injection IPTC/XMP copyright dans `image-import.service.ts`.  
**Conclusion** : EXIF GPS strippé ✅, mais IPTC/XMP copyright non embeddé réellement — c'est une hypothèse dans le score SEO.

### Q12 — Licence CC BY 4.0 + Copyright `Axion-IA OÜ`

- `constants.ts:54-57` : `DEFAULT_LICENSE_TYPE = "cc-by-4.0"`, `DEFAULT_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"`, `DEFAULT_COPYRIGHT_HOLDER = "Axion-IA"` (**sans OÜ** !)  
- `seed-images.ts:923-925` : `licenseType: "cc-by-4.0"`, `copyrightHolder: "Axion-IA OÜ"` ✅ dans le seed  
- **Divergence** : `DEFAULT_COPYRIGHT_HOLDER = "Axion-IA"` ≠ `"Axion-IA OÜ"` requis. Les images créées via admin upload utilisent la constante `DEFAULT_COPYRIGHT_HOLDER` (sans OÜ).  
- `WATERMARK_DEFAULT_TEXT_FN` : `© ${year} Axion-IA — CC BY 4.0` — watermark sans OÜ.

### Q13 — Piliers : ≥ 3 images dans template

**Pages marketing statiques** : `a-propos` = 2 `Illustration` slots (APROPOS-02-mid + APROPOS-03-closing), toutes en mode **placeholder** (pas de `src`). `guide-ia` = 2 slots idem. **0 image réelle** affichée sur aucune page marketing statique car `public/illustrations/` n'existe pas.

**Articles générés** : 0 image.

**Galerie** : chaque image est une page dédiée — non applicable.

### Q14 — Captions `<figcaption/>`

- **`galerie/[slug]/page.tsx:199`** : `{tr.caption && <figcaption>}` ✅  
- **`ImageBankPicture.tsx:129-134`** : `{caption && <figcaption data-speakable="true">}` ✅  
- **`Illustration.tsx:98-101`** : `{figcaption ? <figcaption>}` ✅  
- **Articles générés** : 0 figcaption (pas d'image).

### Q15 — Sitemap images conforme Google spec 1.1

4 sitemaps images actifs, tous référencés dans `sitemap-index.xml` :  
1. `/sitemap-images-services.xml` : 79 images sur 20+ pages services — `<image:loc>`, `<image:title>`, `<image:caption>`, `<image:license>` ✅ conforme spec 1.1  
2. `/sitemap-images-villes-t1.xml` : 40 villes ≥ 100K hab — slug pattern `axion-ia-{ville.slug}-formation-ia-banniere` — **38 images manquantes** (seules Paris + Lyon existantes confirmées)  
3. `/sitemap-images-villes-t2.xml` : 83 villes 50K–100K — template Sharp auto (script à exécuter)  
4. `/sitemap-images-villes-t3-t4.xml` : 2034 villes — images génériques existantes ✅  
5. `/sitemaps/images-fr.xml` + `/sitemaps/images-en.xml` : DB-driven (ImageAsset published) — force-dynamic ✅  

**Problème** : les sitemaps T1/T2 référencent des images qui n'existent pas encore (`axion-ia-{ville.slug}-formation-ia-banniere` pour 38 villes T1 non importées). Google verra des `<image:loc>` avec 404 → penalization potentielle.

### Q16 — JSON-LD ImageObject

**Galerie publique** : `image-jsonld-graph.service.ts` + `image-seo.service.ts` produisent un JSON-LD `@graph` complet :
- `@type: "ImageObject"` ✅
- `contentUrl`, `url`, `name`, `alternateName` (alt), `caption`, `description` ✅
- `width/height` en `QuantitativeValue` ✅
- `license`, `copyrightHolder`, `copyrightNotice`, `creditText` ✅
- `speakable: SpeakableSpecification` ✅
- `abstract` = aiSummary ✅
- `thumbnail: ImageObject` ✅
- `isBasedOn` si AI-generated ✅
- `accessibilityFeature/Hazard/Control` (WCAG 2.2) ✅

**ImageBankPicture.tsx** : microdata `itemScope itemType="https://schema.org/ImageObject"` ✅

**Articles générés** : 0 ImageObject (pas d'image).

### Q17 — Pages ville : image typique de la ville

**T1 (≥ 100K)** : pattern slug `axion-ia-{ville.slug}-formation-ia-banniere` prévu mais non importé (38/40 manquantes).  
**T2 (50K–100K)** : script `generate-city-images-tier2.ts` génère via Sharp + overlay SVG (terracotta + nom ville) — **pas d'IA générative**, template pur Sharp ✅. Script non exécuté en prod.  
**T3/T4** : 2 images génériques réutilisées — pas de personnalisation par ville.

### Q18 — 73 images importées ?

**Réalité** : 133 images seedées (non 73). `public/images/` contient 135 WebP et 133 AVIF. Le seed `seed-images.ts:901` déclare `133 ImageAssets`. `llms.txt` mentionne 72 visuels. La discordance (`73`, `72`, `133`) suggère que les comptes ont évolué entre la décision initiale (73 images) et la seed finale (133). Les images **sont physiquement présentes** dans `public/images/` — **l'import est FAIT** pour les images seedées, pas pour les villes T1.

---

## Findings

### Tableau P0 / P1 / P2

| ID | Sévérité | Fichier:Ligne | Description |
|----|----------|---------------|-------------|
| F-01 | **P0** | `generators/landing-ville.ts`, `generators/blog-article.ts`, `generators/blog-from-keywords.ts` | **Assignation image absente** : aucun generator ne peuple `heroImage`. Tous les articles générés sont publiés sans image. `GeneratorOutput.heroImage` reste `undefined`. |
| F-02 | **P0** | `content-publish-worker.ts` | **Aucun champ image persisté** en DB sur Article. `Article.featuredImage` jamais alimenté par le pipeline content-gen. Image = champ mort. |
| F-03 | **P0** | `prisma/seeds/image-bank/seed-images.ts:909` | **Bug logique seed** : `isAiGenerated = !isLogo` → les 126 images non-logo sont marquées `isAiGenerated: true` en DB alors qu'elles sont des créations Will. Contredit la doctrine 0 IA générative. |
| F-04 | **P1** | `src/server/image-bank/constants.ts:57` | `DEFAULT_COPYRIGHT_HOLDER = "Axion-IA"` sans OÜ — diverge de l'entité juridique requise. Les images créées via admin upload ont le mauvais copyright holder. |
| F-05 | **P1** | `src/app/sitemap-images-villes-t1.xml/route.ts` | 38/40 images T1 manquantes physiquement (`public/images/axion-ia-{ville}-formation-ia-banniere.webp`) mais référencées dans le sitemap → 404 pour Google. |
| F-06 | **P1** | `src/server/image-bank/services/image-seo.service.ts:295` | IPTC score `= 5` **assumé** — pas d'embed IPTC/XMP réel dans le pipeline Sharp. Copyright non embeddé dans les bytes de l'image. |
| F-07 | **P1** | `src/components/ui/ImageBankPicture.tsx` (0 usage) | `ImageBankPicture` défini mais **jamais utilisé** dans aucune page. Les images de la banque ne sont affichées nulle part hors galerie et articles (galerie). |
| F-08 | **P1** | `public/illustrations/` (absent) | Répertoire inexistant — toutes les `Illustration` sur pages marketing sont en mode **placeholder** (fond terracotta) — aucune vraie image ne s'affiche sur les pages stratégiques. |
| F-09 | **P1** | `src/components/galerie/GalleryGrid.tsx:77` | `alt={t.alt ?? t.title ?? ""}` — peut être chaîne vide si image non encore enrichie (enrich worker async). |
| F-10 | **P2** | `src/server/content-gen/providers/provider-router.ts:104` | `image: [openaiProvider]` route déclarée mais `openaiProvider.generate()` rejette immédiatement `role !== "text"`. Route morte. |
| F-11 | **P2** | `ImageBankPicture.tsx:112-113` | `srcSet` référence `-md.webp` et `-sm.webp` qui n'existent pas pour les images slug-based (seuls `.webp`, `.avif`, `-thumb.webp` générés par le script auto-convert). |
| F-12 | **P2** | `src/components/knowledge/public/AuthorByline.tsx:49` | `<img>` raw (non next/image) pour la photo auteur — pas de lazy loading, pas d'optimisation. |

---

## Scoring /40

### Assignation algorithme /12

| Critère | Score | Justification |
|---------|-------|---------------|
| Mapping topic → image-bank | 0/4 | Totalement absent. Aucun generator ne peuple `heroImage`. |
| Fallback strategy documenté | 0/2 | Pas de fallback (pas de tentative d'assignation du tout). |
| Provider Unsplash opérationnel | 2/3 | Provider Unsplash implémenté correctement (critique CGU, rate-limit, dedup premium), mais **jamais appelé**. |
| Image-bank DB opérationnelle | 2/3 | 133 images seedées, DB opérationnelle, galerie publique fonctionnelle. |

**Sous-total** : **4/12**

### Doctrine 0 IA générative respectée /8

| Critère | Score | Justification |
|---------|-------|---------------|
| 0 DALL-E / Midjourney / SD dans code actif | 8/8 | DALL-E/Midjourney mentionnés uniquement dans contenu éditorial (descriptions outils). `gpt_image` désactivé (`enabled: false`). Aucune image générée par IA en prod. |
| Mais : seed bug `isAiGenerated=true` sur 126 images | -2 | Bug grave : fausses déclarations DB. **Déduction appliquée sur F-03.** |

**Sous-total** : **6/8**

### Alt qualité (<125, rédactionnel) /8

| Critère | Score | Justification |
|---------|-------|---------------|
| Contrainte 30-125 chars enforced image-bank | 4/4 | Validation hard + pleonasm check dans enrich + translation services. ✅ |
| Alt rédactionnel (Claude Vision) | 2/2 | Alt généré par Claude Sonnet 4.6 Vision (factuel, sobre, non commercial). |
| Fallback `t.alt ?? t.title ?? ""` | 0/1 | Alt vide possible si image non enrichie. |
| Alt articles générés | 0/1 | Pas d'image → pas d'alt. |

**Sous-total** : **6/8**

### Variants + LQIP + EXIF /6

| Critère | Score | Justification |
|---------|-------|---------------|
| Pipeline Sharp admin upload (WebP+AVIF+LQIP+thumb+OG) | 2/2 | `image-import.service.ts` : 4 WebP + 2 AVIF + OG + thumb + LQIP. Complet. ✅ |
| Images seedées — variants présents | 1/2 | `.webp`, `.avif`, `-thumb.webp` présents. `-md.webp`/`-sm.webp` absents pour la plupart (auto-convert worker non confirmé). |
| EXIF GPS strip (RGPD) | 1/1 | `.withMetadata({ orientation: 1 })` ✅ |
| IPTC/XMP copyright embed | 0/1 | Non implémenté réellement (assumé dans le score SEO). |

**Sous-total** : **4/6**

### Sitemap images + JSON-LD ImageObject /4

| Critère | Score | Justification |
|---------|-------|---------------|
| 4 sitemaps Google Image 1.1 actifs | 2/2 | `xmlns:image`, `<image:loc>`, `<image:title>`, `<image:caption>`, `<image:license>` ✅ |
| JSON-LD ImageObject complet | 1/1 | Graph 6-entités sur galerie, speakable, abstract, thumbnail, WCAG accessibility. ✅ |
| Sitemaps T1 (38 images 404) | -1 | 38/40 images T1 référencées mais absentes → pénalité potentielle Google. |

**Sous-total** : **2/4**

### Fallback strategy /2

| Critère | Score | Justification |
|---------|-------|---------------|
| Fallback pour articles sans image | 0/1 | Aucune logique de fallback. |
| Placeholder branded (pages marketing) | 1/1 | `IllustrationPlaceholder` on-brand pour les pages statiques. |

**Sous-total** : **1/2**

---

## Score final : 21/40 (52.5%) — 🟠 SPRINT CORRECTIF

---

## Délégations

| # | Délégation | Priorité |
|---|-----------|---------|
| D1 | Connecter l'assignation image au pipeline content-gen — implémenter `selectImageFromBank(topic, ville)` qui cherche par `module` + `targetCity` + `keywordsPrimary` dans `ImageAsset` DB | P0 |
| D2 | Corriger le bug seed : `isAiGenerated = !isLogo` → `isAiGenerated = entry.isAiGenerated ?? false` | P0 |
| D3 | Importer les 38 images villes T1 manquantes OU désactiver le sitemap T1 pour les villes sans image | P0 (SEO) |
| D4 | Corriger `DEFAULT_COPYRIGHT_HOLDER = "Axion-IA OÜ"` dans `constants.ts` | P1 |
| D5 | Implémenter l'embed IPTC/XMP copyright réel dans le pipeline Sharp (`withIccProfile` + `withMetadata` enrichi) | P1 |
| D6 | Créer `public/illustrations/` avec les images des pages marketing OU câbler des `<Illustration src="...">` depuis la banque | P1 |
| D7 | Exécuter le script `generate-city-images-tier2.ts` pour les 83 villes T2 | P1 |
| D8 | Câbler `ImageBankPicture` dans au moins les templates de pages services (ex. `/audit`, `/interventions`) | P2 |
| D9 | Corriger `alt={t.alt ?? t.title ?? ""}` → ajouter `status: pending_enrich` gate avant publication galerie | P2 |

---

## UNKNOWNs

- U1 : `Article.featuredImage` (String?) — champ existant mais jamais peuplé par le pipeline. Prévu pour une assignation manuelle admin ? V2 automatique ?
- U2 : Le provider `role: "image"` dans `ROLE_TO_PROVIDERS` pointe vers `openaiProvider` qui rejette ce role. Est-ce une implémentation future pour le pipeline image (gpt-image-1) ou une dead route à supprimer ?
- U3 : `public/illustrations/generated/content-gen/` — le pipeline `image-optimizer.ts` écrit dans ce dossier mais il n'existe pas encore en prod. Jamais alimenté.
- U4 : Le seed déclare 133 images mais `llms.txt` dit 72 visuels. Le delta (~61) correspond probablement aux variants non comptés dans les visuels "distincts". Compter confirmé : 133 slugs uniques en DB.
- U5 : `enrich-seeded-images.mts` (mentionné dans `image-bank.service.ts:128`) — script de relance enrichissement. Non audité. Les 133 images seedées ont-elles toutes été enrichies via Claude Vision ?

---

## Références

- `axionia/src/server/content-gen/generators/types.ts:51` — `heroImage?: UnsplashSelectedPhoto`
- `axionia/src/server/content-gen/generators/landing-ville.ts` — 0 appel stock_image
- `axionia/src/server/content-gen/providers/provider-router.ts:104` — `image: [openaiProvider]`
- `axionia/src/server/content-gen/providers/unsplash.ts` — provider implémenté, non appelé
- `axionia/src/server/content-gen/providers/openai.ts:107-113` — rejet `role !== "text"`
- `axionia/src/server/content-gen/lib/config-reader.ts:22` — `gpt_image: { enabled: false }`
- `axionia/src/server/content-gen/images/image-optimizer.ts` — pipeline AVIF/WebP, jamais appelé
- `axionia/src/server/queue/workers/content-publish-worker.ts` — 0 champ image dans Article
- `axionia/prisma/schema.prisma:881` — `featuredImage String?` (non FK)
- `axionia/prisma/seeds/image-bank/seed-images.ts:909` — bug `isAiGenerated = !isLogo`
- `axionia/src/server/image-bank/services/image-import.service.ts` — pipeline Sharp complet
- `axionia/src/server/image-bank/services/image-seo-enrichment.service.ts` — Claude Vision ALT
- `axionia/src/server/image-bank/services/image-seo.service.ts` — JSON-LD ImageObject
- `axionia/src/server/image-bank/constants.ts:57` — `DEFAULT_COPYRIGHT_HOLDER = "Axion-IA"` (sans OÜ)
- `axionia/src/components/ui/ImageBankPicture.tsx` — 0 usage dans pages
- `axionia/src/components/visual/Illustration.tsx` — toutes en mode placeholder
- `axionia/src/app/[locale]/galerie/[slug]/page.tsx:199` — figcaption conditionnel ✅
- `axionia/src/app/sitemap-images-services.xml/route.ts` — 79 images services ✅
- `axionia/src/app/sitemap-images-villes-t1.xml/route.ts` — 38/40 images T1 manquantes
- `axionia/public/images/` — 135 WebP + 133 AVIF présents (images seedées ✅)
