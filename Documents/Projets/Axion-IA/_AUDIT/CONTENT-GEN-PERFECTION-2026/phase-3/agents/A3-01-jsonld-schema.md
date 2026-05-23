# A3-01 — JSON-LD Schema Coverage
## Score : 67/100
## Date : 2026-05-21
## HEAD : 37ca0147

---

## Points obtenus

- [OK] BlogPosting/Article via `buildArticleBase` — champs principaux présents — +10 pts (max 15)
- [PARTIEL] CaseStudy/Article — `aiGenerated` OK, mais `subjectOf`/`contentLocation`/`audience` absents — +5 pts (max 10)
- [OK] FAQPage présent sur pages FAQ dédiées, service, landing, homepage — +9 pts (max 12)
- [OK] HowTo sur guides et pages ville×service (conditionnel `methodologySteps ≥ 3`) — +6 pts (max 8)
- [PARTIEL] Product/Service sur landing verticales — `buildServiceJsonLd` couvre interventions/audit/implementation/un-a-un + `buildProductJsonLd` sur /stack-ia, mais `aggregateRating` absent — +7 pts (max 10)
- [OK] Person — `buildPersonJsonLd` (Will, /a-propos) + `buildPersonManonJsonLd` (Manon, factories content-gen) avec doctrine v2.1 — +7 pts (max 8)
- [PARTIEL] Organization.sameAs — LinkedIn + Facebook présents, Wikidata ABSENT sauf image-bank conditionnel — +5 pts (max 10)
- [PARTIEL] BreadcrumbList — composant `<Breadcrumbs>` quasi-universel (~80+ pages), homepage SANS breadcrumb (normal) mais plusieurs pages landing sans breadcrumbs — +6 pts (max 8)
- [PARTIEL] SpeakableSpecification — présent dans buildFaqJsonLd, buildFaqSpeakableJsonLd, buildArticleBase, ville×service; drift signalé Phase A corrigé P2-2; sélecteurs `[data-faq-q],[data-faq-a]` non nécessairement implémentés dans les composants FaqAccordion — +6 pts (max 10)
- [PARTIEL] ImageObject licence CC — image-bank complet avec `license`, `acquireLicensePage`, `copyrightHolder`, `creditText`; `buildImageObjectJsonLd` global (lib/seo.ts:1329) sans `creator`/`acquireLicensePage` par défaut — +3 pts (max 5)
- [OK] DefinedTerm glossaire — présent avec `termCode`, `inDefinedTermSet`, `subjectOf`, Speakable, `alternateName` — +3 pts (max 4)

**TOTAL : 67/100**

---

## Points perdus

- [P0] Organization.sameAs manque Wikidata URL — 5 pts perdus — impact : LLMs (Perplexity, Claude.ai, Bing Copilot) ne peuvent pas désambiguïser "Axion-IA" comme entité Knowledge Graph stable ; Google AI Overviews source de vérité externe manquante ; fichier source : `src/lib/seo.ts:395`
- [P1] BlogPosting manque `isAccessibleForFree`, `abstract` optionnel non passé par la page `/blog/[slug]/page.tsx`, `isBasedOn` et `mentions` jamais passés depuis les call sites FS — 5 pts perdus — impact : richesse AEO/GEO réduite ; les articles FS (BLOG_POSTS) sont moins citables Perplexity
- [P1] CaseStudy : `subjectOf`, `contentLocation`, `audience` absents du call site (`/cas-concrets/[slug]/page.tsx:80-91`) — 5 pts perdus — impact : cas concrets non liés aux entités Service/City dans le graphe de connaissance ; faible signal AEO "résultats obtenus à Paris/Lyon"
- [P1] FAQPage : les Question dans `buildFaqJsonLd` (seo.ts:309-313) et `buildFaqSpeakableJsonLd` (seo.ts:711-714) n'ont pas d'`@id` stable — 3 pts perdus — impact : impossible de lier une Question individuelle depuis d'autres pages (crosslink Knowledge Graph) ; Google ne peut pas citer une Q précise avec URL anchor
- [P1] `aiGenerated: true` non propagé sur guides (`/guides/[slug]/page.tsx:76-94`) ni sur actualités (`/actualites/[slug]/page.tsx:210-225`) — le flag est présent dans la factory `buildArticleBase` pour blog+newsArticle, mais les guides utilisent `buildArticleJsonLd` (factories) qui l'injecte via `buildArticleBase` — VÉRIFICATION : la factory injecte bien `aiGenerated:true` (ligne 169 de `seo-content-gen-factories.ts`) ; par contre la page `/guides/[slug]` utilise `buildArticleJsonLd` de `seo-content-gen-factories.ts` (OK), mais `buildHowToJsonLd` des factories ne comporte PAS `aiGenerated` — 2 pts perdus
- [P1] `buildServiceJsonLd` (seo.ts) et `buildProductJsonLd` (seo.ts) n'ont pas d'`aggregateRating` — aucune page /interventions ni /audit n'émet ce schéma — 3 pts perdus — impact : absence étoiles SERP Google sur pages services
- [P2] `buildFaqJsonLd` (appelé sur pages service/intervention) ne passe pas d'`@id` à la FAQPage elle-même — impossible de relier ce schéma depuis d'autres pages — 1 pt perdu
- [P2] `buildOrganizationJsonLd` : `addressLocality` = `"[Ville — France]"` (placeholder non renseigné, seo.ts:402) — adresse réelle manquante — pas de score Local SEO Pack — 1 pt perdu
- [P2] HowTo dans les guides : `buildHowToJsonLd` de `seo-content-gen-factories.ts` utilise `estimatedCostUsd` (ligne 353) au lieu de EUR — incohérence avec domaine FR — 0 pt perdu mais anomalie
- [P3] Person Manon (factories) sans `sameAs` (doctrine v2.1 correcte) mais sans `url` canonique `/equipe/manon` — l'`@id` est bien défini (`${SITE_URL}/fr/equipe/manon#person`) mais pas de `url` distinct — mineur

---

## Détail par schéma

### 1. BlogPosting / Article

**Fichier source principal :** `src/lib/seo-content-gen-factories.ts` — fonction `buildArticleBase` (ligne 138)
**Call site blog FS :** `src/lib/seo.ts` — fonction `buildArticleJsonLd` (ligne 604)
**Call site blog DB :** `src/app/[locale]/blog/[slug]/page.tsx` (ligne 220-237)

**Champs présents (factories v1.7) :**
- `@context`, `@type`, `@id` (ligne 149) — OK
- `headline`, `description`, `url` — OK (lignes 150-152)
- `mainEntityOfPage` (ligne 153) — OK
- `inLanguage` (ligne 154) — OK (`fr-FR` / `en-US`)
- `datePublished`, `dateModified` (lignes 155-156) — OK
- `author` via `@id` ref Manon (ligne 158) — OK
- `creator` via `@id` ref Manon (ligne 161) — OK (AI Act art. 50)
- `aiGenerated: true` (ligne 169) — OK
- `additionalType: "https://schema.org/AIGeneratedContent"` (ligne 170) — OK
- `disambiguatingDescription` (ligne 171) — OK
- `usageInfo` (ligne 172) — OK
- `publisher` via `@id` ref Organization (ligne 173) — OK
- `image` (ImageObject conditionnel, ligne 174-181) — OK si imageUrl fourni
- `articleSection`, `keywords`, `wordCount`, `timeRequired` — conditionnels OK
- `citation` array (ligne 190-192) — conditionnel, OK si fourni
- `speakable` avec cssSelector `[".tldr-answer", '[data-aeo="tldr"]', ...]` (ligne 198-201) — OK

**Champs manquants par rapport au périmètre 2026 :**
- `isAccessibleForFree` — non présent dans la factory ni dans les call sites
- `abstract` — présent dans l'interface `ArticleJsonLdInput` de `lib/seo.ts` (ligne 565) mais ABSENT de l'interface `ArticleJsonLdInput` de `seo-content-gen-factories.ts` (ligne 89-118) — les articles DB n'émettent pas `abstract`
- `isBasedOn` — présent dans `lib/seo.ts:buildArticleJsonLd` (lignes 578-582) mais ABSENT de `seo-content-gen-factories.ts:buildArticleBase` et non passé depuis les call sites DB
- `mentions` — idem, présent dans `lib/seo.ts:buildArticleJsonLd` (lignes 588-592) mais ABSENT de `seo-content-gen-factories.ts`

**Note FS (lib/seo.ts) :** La factory `buildArticleJsonLd` de `lib/seo.ts` supporte `abstract`, `isBasedOn`, `mentions` mais la page `/blog/[slug]/page.tsx` (ligne 221-234) appelle la factory avec spread sans passer ces champs. Aucun article FS ne passe `isBasedOn` ni `mentions`.

**Score partiel BlogPosting : 10/15**

---

### 2. CaseStudy / Article

**Fichier source :** `src/app/[locale]/cas-concrets/[slug]/page.tsx` (ligne 79-91)
**Factory utilisée :** `buildArticleJsonLd` de `lib/seo.ts` (pas de la factories content-gen)

**Champs présents :**
- `@type: "Article"`, `headline`, `description`, `image`, `datePublished` (fixe `"2026-05-01"`) — OK
- `articleSection` = industrie — OK (ligne 86)
- `keywords` = industrie + taille — partiel
- `aiGenerated: true` (spread explicite, ligne 89) — OK (QW-1)
- `additionalType: "https://schema.org/AIGeneratedContent"` (ligne 90) — OK
- `author` Person + `publisher` Organization avec logo — OK (via buildArticleJsonLd)
- `mainEntityOfPage` WebPage — OK
- `inLanguage` — OK

**Champs manquants :**
- `dateModified` — non passé, fallback sur `datePublished` (fixe 2026-05-01, risque de staleness)
- `subjectOf` — non émis ; devrait pointer le Service audité ou implémenté
- `contentLocation` — non émis ; pour GEO signal géographique (ville du cas)
- `audience` — non émis ; pourtant les cas concrets ont `cs.size` (taille entreprise)
- `articleBody` — non passé (les champs `copy.context` + `copy.problem` + `copy.solution` sont disponibles)
- `abstract` — non passé alors que `copy.excerpt` serait idéal
- `wordCount` — non passé
- `isBasedOn`, `mentions` — non passés

**Score partiel CaseStudy : 5/10**

---

### 3. FAQPage

**Fichier source 1 :** `src/lib/seo.ts` — `buildFaqJsonLd` (ligne 299) et `buildFaqSpeakableJsonLd` (ligne 700)
**Présence pages :**
- `/faq/page.tsx` — `buildFaqSpeakableJsonLd` — OK
- `/faq/[slug]/page.tsx` — `buildQAPageJsonLd` (QAPage, non FAQPage) — OK (schéma adapté)
- Homepage `[locale]/page.tsx` — `buildFaqSpeakableJsonLd` — OK
- Interventions (/essentielle, /approfondie, /gagner-du-temps, /intervention-claude) — `buildFaqJsonLd` — OK
- Implementation (/agents, /no-code, /documents, etc.) — `buildFaqJsonLd` — OK
- /stack-ia/[tool] — `buildFaqSpeakableJsonLd` — OK
- Villes×service (via `buildVilleServiceJsonLdGraph`) — FAQPage dans le graph — OK
- /audit, /codage-developpement — `buildFaqJsonLd` — OK
- /presse — `buildFaqSpeakableJsonLd` — OK
- /roi — `buildFaqJsonLd` — OK

**Couverture estimée :** Très bonne (~90% des pages avec sections FAQ)

**Anomalies :**
- `buildFaqJsonLd` (seo.ts:309) et `buildFaqSpeakableJsonLd` (seo.ts:711) : les `Question` n'ont pas d'`@id` stable (format `url#faq-N`). La factory ville×service (`ville-service-jsonld.ts:241`) ajoute bien `"@id": \`${url}#faq-${idx + 1}\`` — c'est la seule factory qui le fait.
- `[data-faq-q],[data-faq-a]` sélecteurs Speakable : présence dans HTML non vérifiée dans les composants `FaqAccordion`/`InterventionFaqList` — risque de drift

**Score partiel FAQPage : 9/12**

---

### 4. HowTo (guides étape)

**Fichier source 1 :** `src/lib/seo.ts` — `buildHowToJsonLd` (ligne 998)
**Fichier source 2 :** `src/lib/seo-content-gen-factories.ts` — `buildHowToJsonLd` (ligne 338)
**Fichier source 3 :** `src/lib/seo/ville-service-jsonld.ts` — dans `buildVilleServiceJsonLdGraph` (ligne 255-274)

**Présence pages :**
- `/guides/[slug]/page.tsx` : HowTo si `guide.hasStructuredSteps` (ligne 75-86), sinon fallback Article — OK
- Pages ville×service : HowTo conditionnel si `methodologySteps.length >= 3` — OK
- `/methodologie/page.tsx` : non vérifié (potentielle lacune)
- `/interventions/[slug]` : PAS de HowTo — gap

**Champs présents (factories) :**
- `@type: "HowTo"`, `@id`, `name`, `description`, `url`, `inLanguage` — OK
- `datePublished`, `dateModified` — OK dans seo-content-gen-factories.ts
- `author` + `publisher` (seo-content-gen-factories.ts:350-351) — OK
- `totalTime` (conditionnel) — OK
- `estimatedCost` (conditionnel) — présent mais en USD dans factories (ligne 354: `"currency": "USD"`)
- `step` avec `@type: "HowToStep"`, `position`, `name`, `text` — OK

**Anomalie mineure :** `seo-content-gen-factories.ts:354` utilise `estimatedCostUsd` et `"currency": "USD"` alors que le domaine est FR (EUR). La factory de `seo.ts` utilise correctement EUR.

**Score partiel HowTo : 6/8**

---

### 5. Product / Service sur landing verticales

**Fichier source :** `src/lib/seo.ts` — `buildServiceJsonLd` (ligne 209) et `buildProductJsonLd` (ligne 936)

**buildServiceJsonLd — Champs présents :**
- `@type: "Service"`, `name`, `description`, `url` — OK
- `dateModified` — OK (BUILD_DATE default)
- `provider` Organization — OK
- `serviceType` (conditionnel) — OK
- `areaServed` (auto-injection France si non défini) — OK
- `availableChannel` (conditionnel) — OK
- `offers` avec Offer (conditionnel sur `priceEur`) — OK sur pages avec prix

**buildServiceJsonLd — Champs manquants :**
- `aggregateRating` / `AggregateRating` — ABSENT sur toutes les pages service
- `@id` stable — absent (empêche les liens cross-page)
- `hasOfferCatalog` — absent (les différents tiers d'intervention non liés)
- `brand` — absent sur services Axion-IA

**buildProductJsonLd (/stack-ia) — Champs présents :**
- `@type: "Product"`, `name`, `description`, `url`, `brand`, `category` — OK
- `offers` conditionnel — OK

**buildProductJsonLd — Champs manquants :**
- `aggregateRating` — ABSENT (zéro étoile SERP sur /stack-ia/[tool])
- `review` — ABSENT

**Score partiel Product/Service : 7/10**

---

### 6. Person (auteur)

**Fichier source 1 :** `src/lib/seo.ts` — `buildPersonJsonLd` (ligne 492)
**Fichier source 2 :** `src/lib/seo-content-gen-factories.ts` — `buildPersonManonJsonLd` (ligne 31)
**Call sites :** `/a-propos/page.tsx:58`, ville×service graph (inline Person Manon ligne 279-293 de `ville-service-jsonld.ts`)

**buildPersonJsonLd (Will) — Champs présents :**
- `@type: "Person"`, `name`, `jobTitle`, `url`, `image`, `sameAs`, `worksFor`, `knowsAbout`, `knowsLanguage` — OK
- Garde-fou anti-persona (throw si slug="manon") — OK

**buildPersonManonJsonLd — Champs présents :**
- `@type: "Person"`, `@id`, `name`, `givenName`, `jobTitle`, `url` — OK
- `image` ImageObject avec caption — OK
- `description`, `disambiguatingDescription` — OK (AI Act art. 50)
- `aiGenerated: true`, `additionalType` — OK
- `knowsAbout`, `knowsLanguage`, `worksFor` — OK
- Pas de `sameAs` (doctrine v2.1) — correct

**Anomalies mineures :**
- Person Manon inline dans `ville-service-jsonld.ts` (ligne 279-293) : version simplifiée sans `@id`, `image`, `disambiguatingDescription` — incohérence avec `buildPersonManonJsonLd`
- `buildPersonJsonLd` : LinkedIn URL = `"https://www.linkedin.com/in/will-axion-ia"` — vérifier si ce profil existe réellement
- `affiliation` non émis (équivalent de `worksFor` — redondant mais certains crawlers le préfèrent)

**Score partiel Person : 7/8**

---

### 7. Organization — sameAs + adresse

**Fichier source principal :** `src/lib/seo.ts` — `buildOrganizationJsonLd` (ligne 375)
**Appelé dans :** `src/app/[locale]/layout.tsx` (ligne 165) — émis sur TOUTES les pages

**Champs présents :**
- `@context`, `@id`, `@type: "Organization"`, `name`, `legalName`, `url`, `logo` — OK
- `description` (bilingue) — OK
- `sameAs: ["https://www.linkedin.com/company/axion-ia", "https://www.facebook.com/axionia"]` — PARTIEL
- `foundingDate: "2024"` — OK
- `foundingLocation` avec PostalAddress FR — OK (mais `addressLocality: "[Ville — France]"` = PLACEHOLDER non renseigné, ligne 402)
- `areaServed: ["FR", "EU"]` — OK
- `knowsLanguage` — OK
- `contactPoint` avec email, type, langue — OK
- `vatID` (conditionnel via env) — OK
- `registrationNumber` (conditionnel via env) — OK

**Champs manquants :**
- `sameAs` Wikidata — ABSENT (seo.ts:395 — seulement LinkedIn + Facebook). Présent UNIQUEMENT dans `image-jsonld-graph.service.ts` conditionnel sur `wikidataQid` (ligne 64)
- `sameAs` Twitter/X — ABSENT du layout Organization (présent dans image-jsonld-graph.service.ts:63)
- `numberOfEmployees` — ABSENT (peut être vague : `{"@type":"QuantitativeValue", "minValue": 1, "maxValue": 5}`)
- `address` réelle — placeholder `"[Ville — France]"` non renseigné
- `email` direct sur l'Organization (contactPoint seulement)

**Score partiel Organization : 5/10**

---

### 8. BreadcrumbList — couverture pages

**Fichier source :** `src/components/nav/Breadcrumbs.tsx` + `src/lib/seo.ts:buildBreadcrumbJsonLd` (ligne 330)

**Mécanisme :** Le composant `<Breadcrumbs>` émet automatiquement un `<script type="application/ld+json">` (ligne 53-56 de Breadcrumbs.tsx). Toute page qui importe `<Breadcrumbs>` génère un BreadcrumbList.

**Couverture vérifiée (grep Breadcrumbs) :**
- Blog [slug], Cas concrets [slug] — OK
- FAQ (page + [slug]) — OK
- Glossaire [slug] — OK
- Interventions (page + sous-pages) — OK
- Audit (page + demande) — OK
- Implementation (page + sous-pages) — OK
- Guides [slug] — OK
- Actualités [slug] — OK
- A-propos — OK
- Implantations (région + ville) — OK
- Centre-aide ([slug]) — OK
- Stack-ia ([tool]) — OK

**Pages SANS Breadcrumbs vérifiées :**
- Homepage (`/[locale]/page.tsx`) — PAS de breadcrumbs (normal, c'est la racine)
- Reserver, Contact, Mentions légales — non vérifiés

**Propriétés BreadcrumbList :**
- `@type: "BreadcrumbList"`, `@id` (leaf + `#breadcrumb`) — OK (patch P2-24, ligne 342)
- `itemListElement` avec `ListItem` + `position` + `name` + `item` (URL absolue) — OK
- `Home` auto-ajouté par le composant — OK

**Score partiel BreadcrumbList : 6/8**

---

### 9. SpeakableSpecification

**Fichier source :** Multiple (seo.ts + seo-content-gen-factories.ts + ville-service-jsonld.ts)

**Implémentations :**

1. `buildFaqJsonLd` (seo.ts:314-320) : `cssSelector: ["[data-faq-q],[data-faq-a]"]` — implémenté si les composants portent ces attributs data
2. `buildFaqSpeakableJsonLd` (seo.ts:706-710) : `cssSelector: ["[itemprop='text']"]` — sélecteur générique
3. `buildArticleBase` (seo-content-gen-factories.ts:198-201) : `cssSelector: [".tldr-answer", '[data-aeo="tldr"]', ".faq-answer", '[data-aeo="answer"]']` — OK
4. `buildQAPageJsonLd` (seo-content-gen-factories.ts:306-308) : `cssSelector` customisable, défaut 4 sélecteurs — OK
5. Ville×service (`ville-service-jsonld.ts:236-239`) : `cssSelector: ["#axion-direct-answer", "#axion-faq"]` — conditionnel sur `directAnswer` (fix P2-2 Sprint S+5)
6. Glossaire [slug] : Speakable dans le `subjectOf.WebPage` avec `cssSelector: ['[data-aeo="glossary-definition"]']` — OK
7. `buildHowToJsonLd` (seo.ts + factories) : PAS de Speakable — gap mineur

**Drift signalé Phase A (QW-2) :** Corrigé par patch P2-2 dans `ville-service-jsonld.ts` — le sélecteur `#axion-direct-answer` n'est émis que si `directAnswer` existe. Confirmé ligne 228-231.

**Risque résiduel :** `[data-faq-q]` et `[data-faq-a]` : la validation que ces attributs existent réellement dans les composants `FaqAccordion`, `InterventionFaqList`, `FaqBlock` n'est pas couverte ici (audit front-end hors périmètre A3-01). Si absents, le Speakable est un faux signal.

**Score partiel SpeakableSpecification : 6/10**

---

### 10. ImageObject licence CC

**Fichier source 1 :** `src/lib/seo.ts` — `buildImageObjectJsonLd` (ligne 1319)
**Fichier source 2 :** `src/server/image-bank/services/image-seo.service.ts` — `generateImageObjectJsonLd` (ligne 45)

**buildImageObjectJsonLd (lib/seo.ts) :**
- `@type: "ImageObject"`, `contentUrl`, `url` — OK
- `caption` (conditionnel) — OK
- `width`, `height` (conditionnels) — OK
- `uploadDate` (conditionnel) — OK
- `license` (conditionnel) — OK si passé
- **MANQUANTS** : `creator`, `acquireLicensePage`, `copyrightHolder`, `creditText` non présents dans cette factory simplifiée

**image-seo.service.ts (image-bank) :**
- `license: image.licenseUrl || DEFAULT_LICENSE_URL` (CC BY 4.0) — OK (ligne 100)
- `acquireLicensePage: pageUrl` — OK (ligne 101)
- `creditText: image.copyrightHolder || DEFAULT_CREDIT_TEXT` — OK (ligne 102)
- `creator` avec `@type: "Organization"` / `SoftwareApplication` — OK (lignes 88-94)
- `copyrightHolder` — OK (ligne 94-97)
- `thumbnail` ImageObject — OK (conditionnel ligne 117)

**Score partiel ImageObject : 3/5**

---

### 11. DefinedTerm glossaire

**Fichier source :** `src/app/[locale]/glossaire/[slug]/page.tsx` (ligne 140-173)

**Champs présents :**
- `@context`, `@type: "DefinedTerm"`, `@id` (ligne 143) — OK
- `termCode` (slug stable) — OK
- `name` (terme) — OK
- `description` (définition FR/EN) — OK
- `alternateName` (aliases array) — OK
- `inDefinedTermSet` avec `@type: "DefinedTermSet"`, `@id`, `name`, `url` — OK
- `url` canonique — OK
- `inLanguage` — OK
- `subjectOf` WebPage avec `@id`, `isPartOf` WebSite, `datePublished`, `dateModified`, Speakable — OK (AEO 2026)

**Champs manquants :**
- `sameAs` vers Wikipedia/Wikidata pour les termes techniques reconnus (ex: "RAG" → Wikipedia) — absent
- `associatedMedia` — absent (pas critique pour V1)

**Score partiel DefinedTerm : 3/4**

---

## Recommandations ordonnées par ROI

### 1. Quick wins (< 2h)

**QW-A : Wikidata dans Organization.sameAs** (ROI maximal, 5 pts récupérables)
Fichier : `src/lib/seo.ts` ligne 395
Action : Dès que l'entrée Wikidata Axion-IA est créée, ajouter `"https://www.wikidata.org/wiki/QXXXXXXX"` dans le tableau `sameAs`. Pour l'heure, ajouter Twitter/X `"https://x.com/AxionIA"` (présent dans image-bank mais absent du layout).
Effort : 5 min de code + création Wikidata Q-item (action humaine Will).

**QW-B : addressLocality réel dans Organization** (Local SEO)
Fichier : `src/lib/seo.ts` ligne 402
Action : Remplacer `"[Ville — France]"` par la ville d'enregistrement légale (ex. "Paris"). Si WeWork Paris, utiliser "Paris 75001".
Effort : 2 min.

**QW-C : @id stable pour Questions FAQPage dans buildFaqJsonLd/buildFaqSpeakableJsonLd**
Fichier : `src/lib/seo.ts` lignes 309-313 et 711-714
Action : Ajouter un paramètre `pageUrl` optionnel aux factories ; si fourni, émettre `"@id": \`${pageUrl}#faq-${idx+1}\``. Alternativement, aligner sur le pattern de `ville-service-jsonld.ts` qui le fait déjà.
Effort : 30 min.

**QW-D : isAccessibleForFree sur BlogPosting/Article**
Fichier : `src/lib/seo-content-gen-factories.ts` dans `buildArticleBase`
Action : Ajouter `isAccessibleForFree: true` (tous les articles Axion-IA sont gratuits). Champ AEO Google 2026.
Effort : 5 min.

---

### 2. Sprint (< 1 jour)

**S-A : abstract dans buildArticleBase** (AEO boost majeur)
Fichier : `src/lib/seo-content-gen-factories.ts`
Action : Ajouter `abstract` dans l'interface `ArticleJsonLdInput` (seo-content-gen-factories.ts:89) + dans `buildArticleBase` (conditionnel si fourni, sinon dériver de `description.slice(0, 160)`). Passer `abstract` depuis les call sites blog (`excerpt` → abstract).
Effort : 2h (interface + propagation call sites + tests).

**S-B : subjectOf + contentLocation + audience sur CaseStudy**
Fichier : `src/app/[locale]/cas-concrets/[slug]/page.tsx`
Action : Après le spread `buildArticleJsonLd`, ajouter :
```json
{
  "subjectOf": {"@type": "Service", "name": "...", "url": "..."},
  "contentLocation": {"@type": "City", "name": "..."},
  "audience": {"@type": "BusinessAudience", "audienceType": "PME"}
}
```
Nécessite d'ajouter ces champs au type `CaseStudy` FS ou de les dériver de `cs.industry`/`cs.size`.
Effort : 3-4h.

**S-C : aiGenerated sur HowTo (factories)**
Fichier : `src/lib/seo-content-gen-factories.ts` — `buildHowToJsonLd` ligne 338
Action : Ajouter `aiGenerated: true` + `additionalType: "https://schema.org/AIGeneratedContent"` dans le retour de la factory. AI Act art. 50 cohérence.
Effort : 15 min.

**S-D : Corriger estimatedCostUsd → EUR dans factories**
Fichier : `src/lib/seo-content-gen-factories.ts` ligne 353-360
Action : Renommer `estimatedCostUsd` en `estimatedCostEur`, changer `"currency": "USD"` → `"currency": "EUR"`.
Effort : 20 min + mise à jour types consommateurs.

---

### 3. Projet (> 1 jour)

**P-A : aggregateRating sur Services** (étoiles SERP = CTR +15-30%)
Logique : Collecter les testimonials existants (déjà en DB), calculer rating moyen, émettre `AggregateRating` sur pages `/interventions`, `/audit`, `/implementation`. Nécessite un composant ou une route API qui compte les reviews DB.
Effort : 1-2 jours.

**P-B : abstract + isBasedOn + mentions propagés depuis le pipeline content-gen**
Action : Modifier `ArticleJobOutput` (server/content-gen) pour que le générateur LLM produise un champ `abstract` (40-60 mots) + `sources[]` (devenant `isBasedOn`) + `mentions[]` (entités citées). Ces champs sont déjà supportés dans `lib/seo.ts:buildArticleJsonLd` mais pas encore alimentés depuis la DB. Modifier `content-publish-worker.ts` pour les persister.
Effort : 2-3 jours (pipeline LLM + DB schema + worker + UI admin).

**P-C : Wikidata Axion-IA + Person Will LinkedIn validation**
Action humaine : Créer l'entrée Wikidata Q-item pour Axion-IA (conformité Knowledge Graph Google). Vérifier que `https://www.linkedin.com/in/will-axion-ia` est le bon LinkedIn de Will (slug personnalisé correct).
Effort : 2h humain (Will).

**P-D : data-faq-q / data-faq-a dans composants FAQ**
Fichiers : `src/components/sections/FaqBlock.tsx` (et autres composants FAQ)
Action : Ajouter `data-faq-q` sur les éléments `<dt>` question et `data-faq-a` sur les `<dd>` réponse pour que les SpeakableSpecification des buildFaqJsonLd matchent réellement le DOM.
Effort : 1h par composant (2-3 composants à auditer).

---

## Résumé exécutif

Le système JSON-LD d'Axion-IA est techniquement solide (67/100) et couvre l'essentiel des schémas critiques pour 2026. Les factories `seo.ts` et `seo-content-gen-factories.ts` sont bien architecturées avec une séparation claire contenu-gen vs pages statiques.

**Gaps critiques identifiés :**
1. **Wikidata absent** de Organization.sameAs — 5 pts perdus, impact Knowledge Graph majeur
2. **BlogPosting sans abstract/isBasedOn/mentions** au niveau des call sites — les factories supportent ces champs mais ils ne sont jamais alimentés
3. **CaseStudy sans subjectOf/contentLocation/audience** — cas concrets pas liés géographiquement ni au service dans le graphe
4. **aggregateRating absent** sur tous les services — 0 étoile SERP sur les landing pages de services
5. **FAQPage Question sans @id** stable sur les factories seo.ts (sauf ville×service) — pas de crosslink

**Points forts :**
- `aiGenerated: true` propagé correctement sur blog, cas-concrets, Manon Person
- SpeakableSpecification bien outillé, drift P2-2 corrigé
- DefinedTerm glossaire complet et AEO-ready
- HowTo opérationnel sur guides et pages ville×service
- BreadcrumbList quasi-universel via composant partagé `<Breadcrumbs>`
- ImageObject image-bank complet avec CC licence, creator, acquireLicensePage
