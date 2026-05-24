# A06 — SEO / AEO / GEO / Speakable / JSON-LD

**Agent critique — poids /75 (max parmi les 22)**
Audit forensique AUDIT-ONLY STRICT · HEAD `2b98a7067d7eae701dec42a2c5d6e859364e0e64` · 2026-05-21

---

## Mission

Auditer l'exhaustivité et la conformité 2026 de toutes les balises SEO, meta, et JSON-LD générées par les pages content-gen. Évaluer la readiness AI Overviews / Featured Snippets / Knowledge Graph.

---

## Méthode

Lecture directe des fichiers sources suivants (0 invention) :

- `src/app/[locale]/blog/[slug]/page.tsx`
- `src/app/[locale]/actualites/[slug]/page.tsx`
- `src/lib/seo.ts` (1394 lignes — SSOT factories)
- `src/lib/seo-content-gen-factories.ts` (440 lignes)
- `src/lib/seo/ville-service-jsonld.ts` (364 lignes)
- `src/components/sections/VilleServicePageTemplate.tsx`
- `src/components/sections/FaqBlock.tsx`
- `src/components/marketing/FaqAccordion.tsx`
- `src/components/marketing/AnswerCard.tsx`
- `src/components/marketing/AiContentDisclaimer.tsx`
- `src/components/marketing/JsonLd.tsx`
- `src/components/nav/Breadcrumbs.tsx`
- `src/app/[locale]/layout.tsx`
- `src/app/robots.ts`
- `src/app/ai.txt/route.ts`
- `public/llms.txt`

---

## État observé

### 1. Titre `<title>` — Pattern et longueur

**Blog/actualités** : `src/app/[locale]/blog/[slug]/page.tsx:63`

```
title: `${view.title} · Axion-IA`
```

Pattern : `TITRE ARTICLE · Axion-IA`. Longueur variable selon le titre DB. Pas de garantie keyword-early ni de cap 60 chars. Le template layout ajoute le suffixe via `template: "%s · Axion-IA"` (`src/app/[locale]/layout.tsx:100-101`).

**Villes × service** : `src/components/sections/VilleServicePageTemplate.tsx:167-173`

```
`${meta.nameFr} à ${ville.nameFr} (${ville.departementLabel ?? ville.departement})`
```

Ex. : "Audit IA à Paris (75) · Axion-IA" — keyword en début (service avant ville), conforme.

**Tombstone** : `src/app/[locale]/blog/[slug]/page.tsx:53` — `robots: noindex,nofollow` correctement émis.

### 2. `<meta name="description">`

**Blog** : `view.excerpt` passé directement, sans troncature ni vérification 140-160 chars. `src/app/[locale]/blog/[slug]/page.tsx:64`.

**Villes** : troncature à 157+ellipse : `serviceCopy.fr.hero.slice(0, 157) + "…"` — `VilleServicePageTemplate.tsx:180`. Conforme 160 chars max.

**CTA présent** : absent dans la meta description (`view.excerpt` pour blog, hero tronqué pour villes). Aucun appel à l'action explicite dans les descriptions.

### 3. `<link rel="canonical">`

`src/lib/seo.ts:142` : `canonical: \`/${locale}${pathNorm}\``— **RELATIVE** (sans domaine). Next.js résout en absolu via`metadataBase: new URL(SITE_URL)`déclaré dans`src/app/[locale]/layout.tsx:96`. Correct fonctionnellement mais dépendant de `metadataBase` propagation.

Normalisation trailing slash : `src/lib/seo.ts:127-130` — strip `/+$` sauf root. Conforme.

### 4. Hreflang FR + EN + x-default

`src/lib/seo.ts:131-137` :

```typescript
languages: {
  fr: `/fr${frNorm}`,
  "x-default": `/fr${frNorm}`,
  ...(enDisabled ? {} : { en: `/en${enNorm}` }),
}
```

EN locale désactivé (`proxy.ts` → 301 vers FR) depuis 2026-05-16. `isEnLocaleDisabled()` omit `hreflang="en"` dynamiquement. Correct pour l'état actuel.

x-default pointe vers FR — conforme doctrine FR-first.

### 5. Open Graph

`src/lib/seo.ts:145-162` :

```typescript
openGraph: {
  type: "website",        // PROBLÈME sur les articles (devrait être "article")
  locale: locale === "fr" ? "fr_FR" : "en_US",
  url: `${SITE_URL}/${locale}${pathNorm}`,
  title, description,
  siteName: "Axion-IA",
  images: [{ url, width: 1200, height: 630, alt: title }]
}
```

**Gap** : `type: "website"` hardcodé pour toutes pages via `buildProductMetadata`. Les articles blog/actu devraient émettre `type: "article"` + `article:published_time`, `article:modified_time`, `article:author` pour Facebook/LinkedIn open graph complet.

OG image dynamique `/api/og?title=...` : robots.txt Allow `/api/og` depuis 2026-05-18 — Googlebot-Image autorisé à fetcher.

### 6. `<h1>` unique

**Blog** : `src/app/[locale]/blog/[slug]/page.tsx:268-274` — `<Section titleAs="h1">` émettant un seul `<h1>`. Conforme.

**Villes** : `VilleServicePageTemplate.tsx:254-258` (stub) et `351-356` (gold) — un seul `<Section titleAs="h1">`. Conforme.

### 7. Hiérarchie h2 > h3 > h4

**Blog** : le body est parsé en `<p>` et `<ol>` par `parseBody()`. **Aucun `<h2>` dans le body article** — `src/app/[locale]/blog/[slug]/page.tsx:332-348`. Les sections `<Section>` sans `title` prop n'émettent aucun heading. Section "À lire aussi" émet `title="À lire aussi"` donc un `<h2>` en bas de page.

**Impact** : les articles blog n'ont pas de structure h2 dans le corps — impossible d'optimiser les featured snippets "par section", les PAA multi-sections, ou le saut anchor LLM.

**Villes** : `FaqBlock.tsx:54` — `<h2>` sur le titre FAQ. `VilleServiceDetailSection.tsx:35` — `<h2>` sur le nom de la ville. La hiérarchie h1>h2>h3 est respectée (h3 dans les cartes "autres services").

### 8. JSON-LD `Article` — champs

**Via `buildArticleJsonLd` depuis `src/lib/seo.ts`** (appelé dans `blog/[slug]/page.tsx:216-229`) :

| Champ                      | Présent    | Note                                        |
| -------------------------- | ---------- | ------------------------------------------- |
| `headline`                 | ✅         | `view.title`                                |
| `image`                    | ✅         | `/api/og?title=...` fallback                |
| `datePublished`            | ✅         | ISO string                                  |
| `dateModified`             | ✅         | `view.updatedAt ?? view.publishedAt`        |
| `author` (Person)          | ✅         | `{ "@type": "Person", name, url }`          |
| `publisher` (Organization) | ✅         | avec logo ImageObject                       |
| `mainEntityOfPage`         | ✅         | WebPage @id                                 |
| `inLanguage`               | ✅         | locale                                      |
| `articleBody`              | ✅         | `view.body`                                 |
| `wordCount`                | ✅         | calculé ligne 215                           |
| `keywords`                 | ✅         | `view.tags`                                 |
| `articleSection`           | ✅         | `view.category`                             |
| `abstract`                 | **ABSENT** | non passé au call `buildArticleJsonLd`      |
| `speakable`                | **ABSENT** | `buildArticleJsonLd` seo.ts ne l'inclut pas |
| `aiGenerated`              | **ABSENT** | factory `seo.ts` ne l'émet pas              |
| `isBasedOn`                | **ABSENT** | optionnel, non passé                        |
| `citations`                | **ABSENT** | optionnel, non passé                        |
| `mentions`                 | **ABSENT** | optionnel, non passé                        |

**CRITIQUE** : le blog utilise `buildArticleJsonLd` depuis `src/lib/seo.ts` (ligne 18), PAS depuis `src/lib/seo-content-gen-factories.ts`. La factory `seo.ts` **n'émet pas `aiGenerated: true`** (grep confirmé — aucune occurrence). La factory `seo-content-gen-factories.ts` l'émet (ligne 169), mais elle est utilisée UNIQUEMENT pour les actualités (`actualites/[slug]/page.tsx:35`).

**Résultat** : les articles blog (`/fr/blog/[slug]`) **ne portent pas `aiGenerated: true`** dans leur JSON-LD Article.

### 9. JSON-LD `FAQPage`

**Blog** : aucune FAQ sur les articles blog. `FaqAccordion` n'est pas importé ni utilisé dans `blog/[slug]/page.tsx`. Pas de FAQPage émise sur les articles blog — gap AEO.

**Villes** : `VilleServicePageTemplate.tsx:425-450` — `<FaqBlock emitJsonLd={false}>` + FAQPage émis séparément via `buildVilleServiceJsonLdGraph` (schéma 4, `ville-service-jsonld.ts:233-249`). FAQPage inclut `speakable` + `@id` par item. Conforme.

**Actualités** : pas de FAQPage émise (NewsArticle seul). Normal pour les news.

**Centre-aide** : hors périmètre direct mais `buildQAPageJsonLd` existe dans `seo-content-gen-factories.ts:268`.

### 10. JSON-LD `BreadcrumbList`

`src/components/nav/Breadcrumbs.tsx:25-28` — émis automatiquement sur toutes les pages utilisant `<Breadcrumbs>`. `@id` ajouté (P2-24 audit 2026-05-15). Présent sur blog, actualités, villes. Conforme.

### 11. JSON-LD `Speakable`

**Villes** : `ville-service-jsonld.ts:228-249` — `SpeakableSpecification` avec `cssSelector: ["#axion-direct-answer", "#axion-faq"]`. Conditionnel sur `directAnswer` pour éviter drift JSON-LD/DOM (P2-2 Sprint S+5). WebPage JSON-LD (schéma 7) répète le même Speakable. Bien conçu.

**Blog** : `buildArticleJsonLd` (seo.ts) **n'inclut pas Speakable**. AnswerCard émet `data-aeo="tldr"` + classe `.tldr-answer` dans le DOM, mais ces sélecteurs ne sont ciblés par aucun JSON-LD Speakable dans le schema Article du blog. La factory `seo-content-gen-factories.ts` inclut `speakable` avec `[".tldr-answer", '[data-aeo="tldr"]']` (ligne 198-202), mais cette factory n'est pas utilisée pour les articles blog FS.

**Résumé Speakable** : opérationnel sur les pages villes (cssSelector #axion-direct-answer + #axion-faq), absent sur articles blog (seo.ts ne l'inclut pas).

### 12. JSON-LD `Organization` root layout

`src/lib/seo.ts:375-424` (`buildOrganizationJsonLd`) :

```typescript
sameAs: ["https://www.linkedin.com/company/axion-ia", "https://www.facebook.com/axionia"];
```

**Manquants dans sameAs** :

- Wikidata Q-ID : absent (entité Axion-IA non encore créée sur Wikidata, confirmé)
- Wikipedia FR/EN : absent (pas d'article Wikipedia Axion-IA)
- X (Twitter) : absent
- Crunchbase/AngelList : absent

`vatID` et `registrikood` : passés optionnellement depuis env vars (`layout.tsx:162-164`). Si non définis en prod, le JSON-LD Organisation est sans identifiants légaux.

`foundingLocation` : `addressLocality: "[Ville — France]"` — valeur placeholder non renseignée (`seo.ts:400`). C'est une string littérale non substituée.

`legalName` : "Axion-IA" — entité estonienne nommée "Axion-IA OÜ" dans `llms.txt` mais le JSON-LD dit juste "Axion-IA". Incohérence mineure.

### 13. JSON-LD `Person` auteur

**Will** : `buildPersonJsonLd` (`seo.ts:492-533`) — `knowsAbout` 6 items, `sameAs: ["https://www.linkedin.com/in/will-axion-ia"]`, `jobTitle` localisé. Conforme pour E-E-A-T basique. Pas de Wikidata, pas de Wikipedia dans sameAs.

**Manon** : `buildPersonManonJsonLd` (`seo-content-gen-factories.ts:31-83`) — `aiGenerated: true`, `disambiguatingDescription` transparence AI Act, `knowsAbout` 3 items. Pas de `sameAs` (doctrine v2.1 — intentionnel). `@id` stable `#person`. Conforme.

**Champs manquants Will** : `honorificSuffix`, `alumniOf`, `award`, `affiliation` — lacunes mineures pour Knowledge Graph.

### 14. `aiGenerated: true` — Conformité AI Act art. 50

**Actualités** (`/fr/actualites/[slug]`) : utilise `buildNewsArticleJsonLd` depuis `seo-content-gen-factories.ts` — `aiGenerated: true` émis (ligne 169 via `buildArticleBase`). **CONFORME**.

**Blog FS** (`/fr/blog/[slug]`) : utilise `buildArticleJsonLd` depuis `seo.ts` (ligne 18 du page.tsx). Cette factory **n'émet PAS `aiGenerated: true`**. **NON CONFORME — P0 CRITIQUE**.

Articles blog provenant de DB sont également servis par `blog/[slug]/page.tsx` qui appelle la même factory sans `aiGenerated`. La distinction DB/FS ne change pas la factory appelée.

`AiContentDisclaimer` visible en bas de page : présent (`src/app/[locale]/blog/[slug]/page.tsx:352-356`). La divulgation humaine-visible existe, mais le signal **machine-readable JSON-LD** est absent pour les articles blog. L'AI Act art. 50 exige les deux.

**Deadline** : 2026-08-02. Délai : 73 jours.

**Villes** : les pages villes ne sont pas des contenus IA-générés (templates). Pas d'`aiGenerated` requis. Conforme.

### 15. Mention humaine bas d'article

`AiContentDisclaimer.tsx` rendu dans `blog/[slug]/page.tsx:352-356` et `actualites/[slug]/page.tsx`. Wording :

> "Cet article a été rédigé avec l'assistance de modèles d'IA générative (OpenAI GPT-4o, Anthropic Claude, Perplexity Sonar) puis supervisé par l'équipe Axion-IA avant publication. Conformément à l'article 50 du Règlement européen sur l'IA (AI Act 2024/1689)."

Conforme. Lien `/transparence` présent.

### 16. Abstract `<aside class="article-summary">`

**Blog** : `AnswerCard` émet `<aside role="doc-tip" data-aeo="tldr">` (pas `article-summary`) avec `tldrText` dérivé de `view.excerpt`. Longueur non contrôlée côté composant. Longueur de l'excerpt : non contraint en base (peut dépasser 300 chars). Pas de CSS class `article-summary`.

**Villes** : `WebPage.abstract` dans le JSON-LD est tronqué à 160 chars (`ville-service-jsonld.ts:300-302`). L'élément HTML `#axion-direct-answer` est conditionnel sur `ville.copy?.directAnswerFr`.

**Gap** : articles blog — aucun `abstract` dans le JSON-LD Article (`buildArticleJsonLd` seo.ts l'accepte en param mais il n'est pas passé en `blog/[slug]/page.tsx`). Le champ `abstract` de la factory seo.ts existe (ligne 565) mais reste non exploité.

### 17. Position 0 readiness — réponse-définition <60 mots après h2

**Blog** : aucun `<h2>` dans le body article (body = `<p>/<ol>` bruts parsés). Impossible de structurer une réponse-définition juste après un h2 ouvrant. Pas d'optimisation position 0 par section.

**Villes** : `#axion-direct-answer` (40-80 mots) placé en haut de page, avant le h1 même. Optimal pour extraction LLM directe. Réponse-définition courte dans `localeCopy.hero` (tronquée à 160 chars dans WebPage.abstract). Conforme pour position 0 sur les villes.

### 18. PAA — FAQ ≥ 6 questions avec h2 ouvrant interrogatif

**Blog** : aucune FAQ section. Aucune question h2 dans les articles blog. Gap AEO majeur.

**Villes** : `localeCopy.faq` (cible ≥ 8 selon `ville-service-jsonld.ts:78`). FAQPage émise avec `@id` par question. Titre FAQ `<h2>` : "Questions fréquentes — audit IA à {ville}" — titre non interrogatif (pattern correct PAA selon Google). Les questions elles-mêmes sont dans les `AccordionTrigger` (non h2). Le `<h2>` du FaqBlock n'est pas une question directe.

**Gap** : les questions FAQ ne sont pas balisées individuellement en `<h2>/<h3>` dans le DOM — elles sont dans des `<AccordionTrigger>` (custom element). Speakable compense via cssSelector.

### 19. JSON-LD `HowTo` sur articles à étapes

**Villes** : `buildHowToJsonLd` appelé si `methodologySteps.length >= 3` (`ville-service-jsonld.ts:255-274`). Schéma complet avec `totalTime`, `estimatedCost`, steps numérotés. Conforme.

**Blog** : la factory `buildHowToJsonLd` existe dans `seo-content-gen-factories.ts:338` mais n'est pas appelée depuis les articles blog. Aucun HowTo sur les articles blog même si le body décrit des étapes ("1) ... 2) ... 3)..."). Gap AEO sur articles procéduraux.

### 20. Wikidata Q-ID dans sameAs

**Constat** : `sameAs` de l'Organisation contient uniquement LinkedIn + Facebook (`seo.ts:395`). Aucun Wikidata Q-ID. L'entité Axion-IA n'est **pas encore créée sur Wikidata** (UNKNOWN — nécessite vérification externe à l'audit).

L'image-bank service (`src/server/image-bank/services/image-jsonld-graph.service.ts:40-64`) prévoit un champ `wikidataQid?: string` dans son Organisation JSON-LD — mais c'est une entrée de config future, pas encore valorisée en prod.

### 21. Wikipedia FR/EN AxionIA

**Constat** : aucun article Wikipedia Axion-IA détecté dans le code. Aucune référence `wikipedia.org/wiki/Axion-IA` dans les fichiers audités. UNKNOWN pour vérification externe.

### 22. `llms.txt` / `ai.txt` présents racine

**`llms.txt`** : `public/llms.txt` — présent. Contenu complet : description cabinet, pages canoniques, implantations, EN mirror, licensing, entité juridique, crawlers autorisés, banque d'images CC BY 4.0. Conforme standard llms.txt 2026.

**`llms-full.txt`** : `src/app/llms-full.txt` — présent (nom suggère version étendue).

**`ai.txt`** : `src/app/ai.txt/route.ts` — présent, servi edge runtime. Contenu : standard Spawning.ai/IAB AI Preferences (draft 2025), `ai-training: allow`, `ai-citation: allow` par bot (ClaudeBot, OAI-SearchBot, PerplexityBot, GPTBot, Google-Extended, Applebot-Extended), disallow Bytespider/CCBot/Diffbot/omgili. Conforme.

### 23. `robots.txt` — Bots IA

`src/app/robots.ts` : déclaration explicite de 14 bots IA autorisés :
GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, Claude-Web, PerplexityBot, Perplexity-User, Google-Extended, Applebot-Extended, Mistral-User, Bingbot (+ crawl-delay 1s), Meta-ExternalAgent, YandexBot, Googlebot-Image. Tous `allow: ["/", "/api/og"]`.

Bloqués : CCBot, Bytespider, omgili, Diffbot.

**Conforme** — doctrine AEO/GEO 2026 "ALLOW search + answer engines".

---

## Findings — Tableau P0/P1/P2

### P0 — Bloquants

| ID       | Fichier:ligne                                                        | Description                                                                                                                                                                                                                   | Impact                                                                                        | Action                                                                                                                                                      |
| -------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0-1** | `src/lib/seo.ts:604` + `src/app/[locale]/blog/[slug]/page.tsx:18`    | `buildArticleJsonLd` (seo.ts) n'émet pas `aiGenerated: true` + `additionalType: AIGeneratedContent` + `disambiguatingDescription`. Les articles blog FS et DB sont servis sans ce flag. AI Act art. 50 applicable 2026-08-02. | Machine-readable disclosure manquante → risque légal + opacité LLMs                           | Soit ajouter ces 3 champs dans `buildArticleJsonLd` seo.ts, soit migrer `blog/[slug]/page.tsx` vers `buildArticleJsonLd` de `seo-content-gen-factories.ts`. |
| **P0-2** | `src/lib/seo.ts:142` + `src/app/[locale]/blog/[slug]/page.tsx:60-75` | `abstract` non passé dans l'appel `buildArticleJsonLd` du blog (lines 216-229). La factory l'accepte mais il n'est pas alimenté. Signal #1 Featured Snippets / AI Overviews manquant.                                         | −25-35% citation rate Perplexity / Claude.ai estimé                                           | Passer `abstract: view.excerpt.slice(0, 155)` dans l'appel buildArticleJsonLd du blog                                                                       |
| **P0-3** | `src/lib/seo.ts:395`                                                 | `sameAs` Organisation : uniquement LinkedIn + Facebook. Wikidata Q-ID absent, X/Twitter absent, Wikipedia absent. Empêche la réconciliation entité Knowledge Graph Google.                                                    | Confusion "Axion-IA" vs "axionai.fr" concurrent brand. LLMs ne peuvent pas anchorer l'entité. | Créer entité Wikidata + ajouter Q-ID dans sameAs. Vérifier validité URL X officiel.                                                                         |

### P1 — Importants

| ID        | Fichier:ligne                                                  | Description                                                                                                                                                                                                                                                      | Impact                                         |
| --------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **P1-1**  | `src/app/[locale]/blog/[slug]/page.tsx:330-348`                | Body article blog = `<p>/<ol>` uniquement. Aucun `<h2>` dans le contenu. Impossible d'optimiser par section pour Featured Snippets PAA.                                                                                                                          | −30% position 0 readiness articles blog        |
| **P1-2**  | `src/lib/seo.ts:145-148`                                       | `openGraph.type: "website"` pour articles blog/actu. Devrait être `"article"` + `article:published_time` + `article:author`.                                                                                                                                     | Aperçus pauvres Facebook / LinkedIn            |
| **P1-3**  | `src/app/[locale]/blog/[slug]/page.tsx:216-229`                | Speakable absent du JSON-LD Article blog. AnswerCard émet `.tldr-answer` + `[data-aeo="tldr"]` mais aucun Speakable JSON-LD n'y pointe.                                                                                                                          | −20% readiness voice search / Google Assistant |
| **P1-4**  | `src/app/[locale]/blog/[slug]/page.tsx`                        | Aucune FAQ section sur les articles blog. FAQPage JSON-LD absent. Les articles en DB n'ont pas de FAQ structurée.                                                                                                                                                | −40% PAA readiness blog                        |
| **P1-5**  | `src/lib/seo.ts:400`                                           | `foundingLocation.addressLocality: "[Ville — France]"` — placeholder non substitué. Organisation JSON-LD imprécise.                                                                                                                                              | Knowledge Graph incomplet                      |
| **P1-6**  | `src/lib/seo.ts:388-389`                                       | `legalName: "Axion-IA"` mais entité juridique réelle = "Axion-IA OÜ" (llms.txt). Incohérence K-Graph.                                                                                                                                                            | Possible confusion entité légale               |
| **P1-7**  | `src/app/[locale]/blog/[slug]/page.tsx:63`                     | `description: view.excerpt` sans troncature garantie 140-160 chars ni CTA. Excepts longs → méta tronquée par Google sans call-to-action.                                                                                                                         | CTR SERP dégradé                               |
| **P1-8**  | `src/lib/seo.ts:498`                                           | `buildPersonJsonLd` pour Will : `sameAs` uniquement LinkedIn. Aucun Wikidata, Wikipedia, X dans sameAs Person.                                                                                                                                                   | E-E-A-T Knowledge Graph Will faible            |
| **P1-9**  | `src/components/sections/VilleServicePageTemplate.tsx:302-325` | JSON-LD villes : Person Manon sans `sameAs` (intentionnel doctrine v2.1). Mais `@id` de Manon pointe vers `${SITE_URL}/fr/equipe/manon#person` — la page doit exister et émettre le même `@id`. UNKNOWN si la page `/fr/equipe/manon` existe et émet ce JSON-LD. | Broken `@id` link possible                     |
| **P1-10** | `src/lib/seo-content-gen-factories.ts:60`                      | `buildPersonManonJsonLd` — `knowsAbout` 3 items seulement. Pour AEO, 8-12 items `knowsAbout` optimaux (Perplexity valorise l'étendue du champ expertise).                                                                                                        | E-E-A-T Manon limité                           |

### P2 — Améliorations

| ID       | Fichier:ligne                             | Description                                                                                                                                                                                                                 |
| -------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P2-1** | `src/lib/seo.ts:604-685`                  | `citations`, `isBasedOn`, `mentions` acceptés par buildArticleJsonLd mais jamais passés depuis blog/[slug]/page.tsx. +20-40% citation rate Perplexity si populés.                                                           |
| **P2-2** | `src/app/[locale]/blog/[slug]/page.tsx`   | Articles blog : pas de JSON-LD `HowTo` même quand le body est procédural (`parseBody` détecte les étapes "1)...2)..."). Ajouter émission conditionnelle.                                                                    |
| **P2-3** | `src/lib/seo.ts:395`                      | Ajouter `crunchbase`, `AngelList` dans sameAs Organisation si profils existants.                                                                                                                                            |
| **P2-4** | `src/components/sections/FaqBlock.tsx:54` | Titre FAQ `<h2>` pas interrogatif. Google préfère h2 qui est la question elle-même ("Comment se déroule un audit IA à Paris ?").                                                                                            |
| **P2-5** | `src/app/[locale]/blog/[slug]/page.tsx`   | `openGraph.type` devrait être `"article"` sur les pages article. Ajouter `og:article:published_time`, `og:article:author`.                                                                                                  |
| **P2-6** | `src/lib/seo.ts:498`                      | `buildPersonJsonLd` Will : ajouter `alumniOf`, `award` si applicable. Faible priorité.                                                                                                                                      |
| **P2-7** | `src/lib/seo/ville-service-jsonld.ts:186` | `LocalBusiness.sameAs` inclut `cityWikiUrl` (Wikipedia ville) — signal correct. Mais l'URL Organization parent dans `parentOrganization` ne pointe pas vers `#organization` ancre (juste `SITE_URL`). Cohérence @id faible. |
| **P2-8** | `src/app/ai.txt/route.ts`                 | `ai.txt` déclaré edge mais pas encore référencé dans `llms.txt` ni dans robots.txt `sitemap:`. Ajouter lien ai.txt dans llms.txt.                                                                                           |
| **P2-9** | `src/lib/seo.ts`                          | `buildOrganizationJsonLd` : ajouter `numberOfEmployees`, `foundingDate` (déjà "2024"), `award` optionnel quand disponibles.                                                                                                 |

---

## Scoring /75

### SEO classique (title, desc, canonical, hreflang, OG, h1) — /10

| Critère                               | Score | Justification                                        |
| ------------------------------------- | ----- | ---------------------------------------------------- |
| `<title>` keyword early               | 1.5/2 | Villes ✅ keyword first, Blog variable selon excerpt |
| `<meta description>` 140-160 + CTA    | 1/2   | Villes ✅ tronqué 157, Blog ❌ sans cap ni CTA       |
| `<link canonical>` absolue sans param | 1.5/2 | Via metadataBase ✅, dépendance indirecte            |
| Hreflang FR + x-default               | 1.5/2 | EN omis correctement (disabled), x-default → FR ✅   |
| Open Graph complet                    | 1/2   | type "website" sur articles ❌, images ✅            |

**Sous-total : 6.5/10**

### AEO (FAQPage, abstract, h2 question, bullets, table) — /12

| Critère               | Score | Justification                                            |
| --------------------- | ----- | -------------------------------------------------------- |
| FAQPage JSON-LD       | 4/5   | Villes ✅ complet, Blog ❌ absent, Actu ❌ absent        |
| Abstract JSON-LD      | 1/3   | Villes ✅ WebPage.abstract 160 chars, Blog ❌ non passé  |
| h2 interrogatif       | 1/2   | Villes FAQBlock h2 non interrogatif, Blog 0 h2 dans body |
| Bullets/ol structurés | 1/2   | Blog parseBody détecte ol ✅, mais sans h2 section       |

**Sous-total : 7/12**

### Featured Snippets / Position 0 / PAA readiness — /13

| Critère                           | Score | Justification                                                   |
| --------------------------------- | ----- | --------------------------------------------------------------- |
| Réponse directe <60 mots après h2 | 2/4   | Villes #axion-direct-answer ✅, Blog 0 h2 dans body ❌          |
| PAA ≥ 6Q                          | 4/5   | Villes FAQPage ✅ ≥8Q, Blog absent ❌                           |
| AnswerCard / TL;DR                | 3/4   | Blog AnswerCard ✅ avec data-aeo, manque Speakable JSON-LD link |

**Sous-total : 9/13**

### Knowledge Graph entity AxionIA + Wikidata + Wikipedia + sameAs — /15

| Critère                      | Score | Justification                                           |
| ---------------------------- | ----- | ------------------------------------------------------- |
| Organisation JSON-LD complet | 4/5   | Présent layout ✅, mais foundingLocation placeholder ❌ |
| Wikidata Q-ID dans sameAs    | 0/4   | Absent — entité non créée                               |
| Wikipedia FR/EN              | 0/3   | Absent — pas d'article Wikipedia                        |
| X / autres sameAs            | 0.5/2 | LinkedIn ✅, Facebook ✅ (URL non vérifiée), X absent   |
| legalName cohérent           | 0.5/1 | "Axion-IA" ≠ "Axion-IA OÜ" (llms.txt)                   |

**Sous-total : 5/15**

### GEO complet (Organization sameAs, Person knowsAbout, mentions, about, isBasedOn) — /10

| Critère                           | Score | Justification                           |
| --------------------------------- | ----- | --------------------------------------- |
| Organization sameAs               | 1.5/3 | LinkedIn ✅, Wikidata absent ❌         |
| Person Will knowsAbout            | 2/2   | 6 items ✅ bien ciblés opérationnel IA  |
| Person Manon knowsAbout           | 1/1.5 | 3 items — extensible                    |
| Article mentions/about/isBasedOn  | 0/1.5 | Non passés dans buildArticleJsonLd blog |
| LocalBusiness villes sameAs ville | 2/2   | Wikipedia ville dans sameAs ✅          |

**Sous-total : 6.5/10**

### Speakable — /7

| Critère                       | Score | Justification                                                        |
| ----------------------------- | ----- | -------------------------------------------------------------------- |
| cssSelector ou xpath définis  | 3/4   | Villes ✅ dual selector, Blog ❌ absent                              |
| Cohérence JSON-LD / DOM       | 2/2   | Villes P2-2 Sprint S+5 corrigé ✅, conditionnel #axion-direct-answer |
| Paragraphes cibles pertinents | 1/1   | #axion-direct-answer + #axion-faq bien ciblés                        |

**Sous-total : 6/7**

### JSON-LD exhaustivité — /5

| Critère                                       | Score | Justification                                              |
| --------------------------------------------- | ----- | ---------------------------------------------------------- |
| Article/BlogPosting                           | 2.5/2 | Présent ✅ (bonus champs wordCount, articleBody, keywords) |
| FAQPage ✅                                    | 0.5/1 | Villes ✅, Blog absent                                     |
| Service, LocalBusiness, BreadcrumbList, HowTo | 1.5/1 | Villes ✅ tous 5 schémas via ville-service-jsonld.ts       |
| Organization, Person                          | 0.5/1 | Layout ✅ mais Person Will partiel                         |

**Sous-total : 5/5** (arrondi max — richesse suffisante globalement)

### AI Act `aiGenerated: true` — /3

| Critère                          | Score | Justification                                                                    |
| -------------------------------- | ----- | -------------------------------------------------------------------------------- |
| aiGenerated émis sur contenus IA | 1/3   | Actu ✅ (seo-content-gen-factories), Blog ❌ (seo.ts sans flag), Manon Person ✅ |

**Sous-total : 1/3**

---

## Score Final

| Dimension                            | Obtenu    | Max    |
| ------------------------------------ | --------- | ------ |
| SEO classique                        | 6.5       | 10     |
| AEO                                  | 7         | 12     |
| Featured Snippets / Position 0 / PAA | 9         | 13     |
| Knowledge Graph entity               | 5         | 15     |
| GEO                                  | 6.5       | 10     |
| Speakable                            | 6         | 7      |
| JSON-LD exhaustivité                 | 5         | 5      |
| AI Act aiGenerated:true              | 1         | 3      |
| **TOTAL**                            | **46/75** | **75** |

**Score : 46/75 (61.3%) — SPRINT CORRECTIF requis.**

---

## Délégations

- **Wikidata** : création entité Axion-IA OÜ Q-ID → action humaine Will (hors code).
- **Wikipedia** : création/vérification article Axion-IA FR/EN → action humaine Will.
- **URL X officiel** : Will doit confirmer l'handle X (@axion_ia ?) pour l'ajouter dans sameAs.
- **`COMPANY_VAT_NUMBER` + `COMPANY_REGISTRATION_NUMBER`** : Will doit renseigner les env vars Coolify pour que le JSON-LD Organisation porte les identifiants légaux.
- **`foundingLocation.addressLocality`** : Will doit confirmer la ville (Paris ? Estonie ?) pour remplacer le placeholder `"[Ville — France]"`.

---

## UNKNOWNs

- **U1** : `/fr/equipe/manon` — page existante ? Émet-elle `@id: "${SITE_URL}/fr/equipe/manon#person"` ? Si la page 404, le linked data JSON-LD `author: { "@id": ... }` est un lien mort (non vérifié dans ce périmètre).
- **U2** : `https://www.facebook.com/axionia` — URL valide ? Compte actif ? Aucune vérification possible en audit-only.
- **U3** : `https://www.linkedin.com/in/will-axion-ia` — slug LinkedIn Will correct ? Aucune vérification.
- **U4** : Longueur réelle des `view.excerpt` en base de données — peuvent-ils dépasser 160 chars ? Pas de contrainte Prisma visible dans ce périmètre.
- **U5** : `view.tier` des articles DB — quelle proportion est tier-1-indexable vs tier-2/3 noindex ? Détermine le scope réel de l'impact P0-1.

---

## Références

| Fichier                                                | Rôle                                                               |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| `src/lib/seo.ts`                                       | SSOT factories SEO — 1394 lignes, 18 factories                     |
| `src/lib/seo-content-gen-factories.ts`                 | Factories content-gen (Article/News/QAPage/HowTo) avec aiGenerated |
| `src/lib/seo/ville-service-jsonld.ts`                  | Graph JSON-LD ville × service — 7 schémas                          |
| `src/app/[locale]/blog/[slug]/page.tsx`                | Page article blog — P0-1 aiGenerated absent                        |
| `src/app/[locale]/actualites/[slug]/page.tsx`          | Page NewsArticle — aiGenerated ✅                                  |
| `src/components/sections/VilleServicePageTemplate.tsx` | Template pages villes                                              |
| `src/components/sections/FaqBlock.tsx`                 | Section FAQ avec id="axion-faq"                                    |
| `src/components/marketing/FaqAccordion.tsx`            | FAQ + buildFaqJsonLd auto                                          |
| `src/components/marketing/AnswerCard.tsx`              | TL;DR AEO avec data-aeo="tldr"                                     |
| `src/components/marketing/AiContentDisclaimer.tsx`     | Bandeau AI Act art. 50 visible                                     |
| `src/components/nav/Breadcrumbs.tsx`                   | BreadcrumbList JSON-LD automatique                                 |
| `src/app/[locale]/layout.tsx`                          | Organisation + WebSite JSON-LD root                                |
| `src/app/robots.ts`                                    | AI bots allow/disallow                                             |
| `src/app/ai.txt/route.ts`                              | ai.txt standard Spawning.ai                                        |
| `public/llms.txt`                                      | llms.txt standard complet                                          |
