# 06 — PUBLIC SURFACE — Knowledge Base 2026 — Phase A

> Prompt : `_AUDIT/PROMPT-KNOWLEDGE-BASE-2026.md` (sections Agent 6 §274, §10 backend unifié, §12.4 mapping URL)
> Agent : 6 — Surface publique SEO / AEO / GEO
> Date : 2026-05-13
> Statut : DRAFT (Phase A — 🚫 AUDIT-ONLY, aucune écriture code)
> Référence : HEAD `main` (commit `95bba36`, audit aligné à `00-REALITY-CHECK.md`)
> Doctrine : code = SSOT (mémoire `axionia_doctrine_code_ssot`)
> Contraintes intouchables : terracotta + logo + naming Axion-IA + canonical FR + Hetzner CPX32

---

## 0. TL;DR

- **URLs publiques actuelles 100 % préservées** : `/blog`, `/cas-concrets`, `/centre-aide`, `/faq`, `/glossaire`, `/guide-ia` continuent d'exister à l'identique et passent à lire `KnowledgeEntry WHERE type IN (...)` après KB-6 (zéro redirection 301, zéro casse SEO).
- **Hub agrégateur nouveau** : `/fr/ressources/` (recommandation forte vs `/savoir/`, `/kb/`, `/library/`) + `/en/resources/` parity stricte.
- **Slug EN canonique recommandé** : `resources` (Wikipedia EN, MDN, Anthropic docs, AWS Cloud), pas `library` (réservé code library) pas `kb` (jargon interne).
- **Catch-all canonical** pour types sans URL dédiée (`methodology`, `doctrine`, `tool_card`, etc. en `audience='public'`) : `/fr/ressources/[type]/[slug]` — résout SSOT §12.4 `null` types.
- **Facettes cross-type** : `/fr/ressources/tag/[tag]` + `/fr/ressources/auteur/[slug]` (E-E-A-T renforcé).
- **JSON-LD** : 1 helper SSOT par type (réutilisation maximale de `src/lib/seo.ts` existant — 11 factories déjà disponibles, on n'en ajoute que 3 : `DefinedTerm`, `CaseStudy` typed, `WebPage type=KnowledgeAuthor`).
- **Sitemap** : extension `src/app/sitemap.ts` ajoute 1 ID statique `knowledge` + chunking auto à 1 000 URLs (alignement pattern villes existant). Pas de fichier neuf.
- **IndexNow** : `pingIndexNow(urls, "kb:<type>:<id>")` depuis `publish.ts` / `unpublish.ts` / `update.ts` server actions — helper centralisé déjà existant (`src/lib/indexnow.ts`).
- **llms.txt + llms-full.txt** : extension des handlers `src/app/llms.txt/route.ts` et `src/app/llms-full.txt/route.ts` pour énumérer les `KnowledgeEntry WHERE audience='public' AND status='published'` avec excerpt + URL + lastModified.

---

## 1. ARBORESCENCE PUBLIQUE CIBLE (V1)

### 1.1 URLs PRÉSERVÉES (lecture KnowledgeEntry, zéro 301)

| URL FR                                       | URL EN                             | Lecture DB                                                                         | JSON-LD principal                                 | Sitemap sub-id            |
| -------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------- |
| `/fr/blog` (hub)                             | `/en/blog`                         | `KnowledgeEntry WHERE type='article' AND audience='public' AND status='published'` | `WebSite` (parent) + `CollectionPage`             | `blog` (existant)         |
| `/fr/blog/[slug]`                            | `/en/blog/[slug]`                  | `KnowledgeEntry WHERE type='article' AND slug=:slug`                               | `Article` (`buildArticleJsonLd`)                  | idem                      |
| `/fr/blog/auteur/[slug]`                     | `/en/blog/author/[slug]`           | `KnowledgeEntry WHERE type='article' AND authorId=:id`                             | `CollectionPage` + `Person` (`buildPersonJsonLd`) | idem                      |
| `/fr/blog/categorie/[slug]`                  | `/en/blog/category/[slug]`         | `KnowledgeEntry WHERE type='article' AND categoryId=:id`                           | `CollectionPage`                                  | idem                      |
| `/fr/blog/secteur/[slug]`                    | `/en/blog/sector/[slug]`           | facette tag `sector:<slug>`                                                        | `CollectionPage`                                  | idem                      |
| `/fr/blog/service/[slug]`                    | `/en/blog/service/[slug]`          | facette tag `service:<slug>`                                                       | `CollectionPage`                                  | idem                      |
| `/fr/blog/tag/[slug]`                        | `/en/blog/tag/[slug]`              | facette tag `<slug>`                                                               | `CollectionPage`                                  | idem                      |
| `/fr/blog/taille/[slug]`                     | `/en/blog/size/[slug]`             | facette tag `size:<slug>`                                                          | `CollectionPage`                                  | idem                      |
| `/fr/blog/feed.xml`                          | `/en/blog/feed.xml`                | RSS Atom `type='article'`                                                          | —                                                 | —                         |
| `/fr/cas-concrets` (hub)                     | `/en/case-studies`                 | `KnowledgeEntry WHERE type='case_study'`                                           | `CollectionPage`                                  | `cas-concrets` (existant) |
| `/fr/cas-concrets/[slug]`                    | `/en/case-studies/[slug]`          | `KnowledgeEntry WHERE type='case_study' AND slug=:slug`                            | `Article` + `Review` (si témoignage consent)      | idem                      |
| `/fr/cas-concrets/secteur/[slug]`            | `/en/case-studies/industry/[slug]` | facette tag `sector:<slug>`                                                        | `CollectionPage`                                  | idem                      |
| `/fr/cas-concrets/feed.xml`                  | `/en/case-studies/feed.xml`        | RSS Atom `type='case_study'`                                                       | —                                                 | —                         |
| `/fr/centre-aide` (hub)                      | `/en/help`                         | `KnowledgeEntry WHERE type='help_article'`                                         | `CollectionPage`                                  | `help` (existant)         |
| `/fr/centre-aide/[slug]`                     | `/en/help/[slug]`                  | `KnowledgeEntry WHERE type='help_article'`                                         | `Article` + `HowTo` (si steps)                    | idem                      |
| `/fr/centre-aide/categorie/[slug]`           | `/en/help/category/[slug]`         | filter categoryId                                                                  | `CollectionPage`                                  | idem                      |
| `/fr/faq` (hub)                              | `/en/faq`                          | `KnowledgeEntry WHERE type='faq'` agg.                                             | `FAQPage` (`buildFaqSpeakableJsonLd`)             | `help` (existant)         |
| `/fr/faq/[slug]`                             | `/en/faq/[slug]`                   | `KnowledgeEntry WHERE type='faq' AND slug=:slug`                                   | `QAPage` (`buildQAPageJsonLd`)                    | idem                      |
| `/fr/faq/feed.xml`                           | `/en/faq/feed.xml`                 | RSS Atom `type='faq'`                                                              | —                                                 | —                         |
| `/fr/glossaire` (hub)                        | `/en/glossary`                     | `KnowledgeEntry WHERE type='glossary_term'`                                        | `CollectionPage` + `DefinedTermSet`               | `knowledge` (NOUVEAU)     |
| `/fr/glossaire/[slug]`                       | `/en/glossary/[slug]`              | `KnowledgeEntry WHERE type='glossary_term' AND slug=:slug`                         | `DefinedTerm` (NOUVEAU helper)                    | idem                      |
| `/fr/glossaire/categorie/[slug]`             | `/en/glossary/category/[slug]`     | filter categoryId                                                                  | `CollectionPage`                                  | idem                      |
| `/fr/guide-ia` (hub)                         | `/en/ai-guide`                     | `KnowledgeEntry WHERE type='guide'`                                                | `CollectionPage` + `Book` ou `HowTo` selon nature | idem                      |
| `/fr/guide-ia/[slug]` (NOUVEAU si chapitres) | `/en/ai-guide/[slug]`              | détail guide                                                                       | `HowTo` (`buildHowToJsonLd`) ou `Article`         | idem                      |

**Note migration `/fr/glossaire`** : la const `TERMS` hardcodée (~20 entrées dans la page actuelle) est extraite vers DB en KB-2 (script `scripts/import-knowledge-from-legacy-source.ts`). La page bascule en lecture DB sans changer son rendu visuel.

**Note migration `/fr/guide-ia`** : V1 actuel = page unique hardcodée. Le scope V1 garde la page existante telle quelle ; les chapitres deviennent des `KnowledgeEntry type='guide'` en V1.5 (route `[slug]` activée alors).

### 1.2 HUB AGRÉGATEUR (NOUVEAU)

| URL FR                         | URL EN                        | Contenu                                                                                                                                                                                                            | JSON-LD                                         |
| ------------------------------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `/fr/ressources`               | `/en/resources`               | Liste cross-type publiée (tous `type IN KB_TYPES WHERE audience='public'`), filtres facettés (type, domain, tag, locale), recherche FTS, RSS global                                                                | `CollectionPage` + `WebSite` + `BreadcrumbList` |
| `/fr/ressources/[type]/[slug]` | `/en/resources/[type]/[slug]` | **Catch-all canonical** pour entrées sans URL dédiée par type (mapping §12.4 = `null` : `methodology`, `doctrine`, `tool_card`, `competitor_card`, `commercial_doc`, `onboarding_step` quand `audience='public'`). | Article ou helper spécifique au `type`          |
| `/fr/ressources/tag/[tag]`     | `/en/resources/tag/[tag]`     | Liste cross-type filtrée par tag (ex. `region:75`, `service:audit`)                                                                                                                                                | `CollectionPage` + `BreadcrumbList`             |
| `/fr/ressources/auteur/[slug]` | `/en/resources/author/[slug]` | Page auteur cross-type (E-E-A-T). Lit `KnowledgeAuthor` joint `KnowledgeEntry`                                                                                                                                     | `ProfilePage` + `Person` (`buildPersonJsonLd`)  |
| `/fr/ressources/feed.xml`      | `/en/resources/feed.xml`      | RSS Atom + JSON Feed cross-type publié                                                                                                                                                                             | —                                               |

**Décision pourquoi `/ressources/`** :

- Mot français standard (Wikipedia, Le Monde, Le Figaro emploient « ressources »).
- Court (10 caractères), URL-safe sans accent (la doctrine i18n FR autorise `ressources` plat sans `é`).
- Évite confusion `/blog` (sous-ensemble) et `/kb` (jargon interne).
- Parité EN `/resources/` 1:1 (terme universel anglais).

**Alternatives écartées** :

- `/savoir/` : trop académique, faible volume recherche.
- `/base-de-connaissance/` : trop long, pas idiomatique web.
- `/kb/` : jargon B2B interne, exclut visiteurs non-tech.
- `/library/` : EN trop ambigu (code library), FR `/bibliotheque/` trop éditorial.

### 1.3 ROUTES NON KB (préservées hors scope)

`/fr/audit`, `/fr/interventions`, `/fr/implementation`, `/fr/methodologie`, `/fr/comparaisons`, `/fr/stack-ia`, `/fr/implantations/*`, `/fr/presse`, `/fr/contact`, etc. → aucune migration, aucun impact.

`/fr/recherche` → étendu cross-type KB en KB-7 (Agent 5 spec) mais le path est préservé.

---

## 2. SEO TEMPLATES (par type)

### 2.1 Formule title canonique

```
${title} · ${typeLabel} · Axion-IA
```

Avec `typeLabel` extrait d'un SSOT `src/content/knowledge/labels.ts` (à créer en KB-2) :

| `type` enum (DB stable) | `typeLabel.fr` (UI)  | `typeLabel.en` (UI)  |
| ----------------------- | -------------------- | -------------------- |
| `article`               | « Article »          | « Article »          |
| `case_study`            | « Cas concret »      | « Case study »       |
| `help_article`          | « Centre d'aide »    | « Help center »      |
| `faq`                   | « FAQ »              | « FAQ »              |
| `glossary_term`         | « Glossaire »        | « Glossary »         |
| `guide`                 | « Guide IA »         | « AI guide »         |
| `methodology`           | « Méthodologie »     | « Methodology »      |
| `doctrine`              | « Doctrine »         | « Doctrine »         |
| `tool_card`             | « Fiche outil »      | « Tool sheet »       |
| `competitor_card`       | « Fiche comparatif » | « Comparison sheet » |
| `commercial_doc`        | « Document »         | « Document »         |
| `onboarding_step`       | « Étape onboarding » | « Onboarding step »  |

**Cap longueur title** : 60 caractères visibles SERP Google desktop (60 max recommandé). Si `${title}` + suffixe > 60, tronquer `${title}` côté template (helper `truncateTitle(title, 60 - suffixLen)` côté SSOT).

**Pattern à réutiliser** : `buildProductMetadata` (existant `src/lib/seo.ts` lignes 40-91). Il faut ajouter un helper KB dérivé `buildKbMetadata({ entry, locale })` qui appelle `buildProductMetadata` avec `title`, `description`, `path`, `alternates` calculés depuis `KnowledgeEntry` + `KnowledgeRoute` SSOT §12.4.

### 2.2 Meta description

- Length cible : **140-160 caractères** (Google SERP desktop = 160, mobile = 130).
- Source de vérité : champ `KnowledgeEntry.excerpt` (rendu pur, sans HTML) OU `KnowledgeEntry.metaDescription` (override admin si l'auteur a affiné).
- Validation : Zod schema (KB Sprint KB-3) `min(140).max(160)` warning + Vitest test colocalisé bloque la PR si publishing entrée hors range.
- Anti-pattern : **NE PAS** générer auto à partir des N premiers caractères du body → coupe au milieu d'une phrase, anti-SEO.

### 2.3 OpenGraph (image dynamique server-side)

- Fichier dédié `src/app/[locale]/blog/[slug]/opengraph-image.tsx` (existant pattern Next 16) + créer équivalents pour chaque route détail KB :
  - `app/[locale]/cas-concrets/[slug]/opengraph-image.tsx`
  - `app/[locale]/centre-aide/[slug]/opengraph-image.tsx`
  - `app/[locale]/faq/[slug]/opengraph-image.tsx`
  - `app/[locale]/glossaire/[slug]/opengraph-image.tsx`
  - `app/[locale]/guide-ia/[slug]/opengraph-image.tsx` (V1.5)
  - `app/[locale]/ressources/[type]/[slug]/opengraph-image.tsx`
- Tous générés **server-side** via `ImageResponse` (`next/og`), pas client-side.
- Fallback : si pas de cover image custom → template visuel partagé `KbOgTemplate` (terracotta + titleEm + typeLabel + author avatar tiny) avec `KnowledgeEntry.title`, `typeLabel`, `KnowledgeAuthor.name`.
- Cover image override : si `KnowledgeEntry.coverImageId` non null → utiliser variante `cover` 1200×630 (Sprint KB-11 pipeline `sharp`).
- Dimensions : 1200×630 strict (Twitter Card + Facebook + LinkedIn). Pas de variantes square — un seul format.
- Twitter card : `summary_large_image` (déjà default `buildProductMetadata`).

### 2.4 Canonical URL

- **Toujours absolue** : `${SITE_URL}/${locale}${path}` (`SITE_URL` SSOT `src/lib/seo.ts`).
- Source : `KnowledgeRoute SSOT (src/content/knowledge/routes.ts)` §12.4 + `KnowledgeEntry.slug`.
- Catch-all : pour `type` mappé à `null` (methodology, doctrine, etc.), canonical = `/fr/ressources/[type]/[slug]`.
- Préservation URLs legacy : `KnowledgeSlugHistory` (Sprint KB-12) trace les anciens slugs `articles.slug` → redirige `301` vers slug courant. Pas de duplicate canonical.

### 2.5 Hreflang

- `alternates.languages` : `fr`, `en`, `x-default` (= FR canonique).
- Si `KnowledgeEntry` n'a **pas** de translation EN (`KnowledgeTranslation.locale='en'` absente) : **ne pas émettre** hreflang `en` (Google guideline : hreflang doit pointer vers contenu réellement traduit, pas vers FR avec banner « not translated »). Le helper `buildKbMetadata` doit checker présence translation EN avant émission.
- Pattern existant : `buildProductMetadata` (seo.ts L57-64) émet `fr` + `en` + `x-default` systématiquement → KB doit override conditionnellement.

---

## 3. AEO — JSON-LD FACTORIES PAR TYPE

### 3.1 Mapping `type` → JSON-LD principal

| `type`                     | Schema.org `@type`                                      | Helper SSOT                                     | Statut helper               |
| -------------------------- | ------------------------------------------------------- | ----------------------------------------------- | --------------------------- |
| `article`                  | `Article`                                               | `buildArticleJsonLd`                            | ✅ existant (`seo.ts` L464) |
| `case_study`               | `Article` + `Review` (si témoignage)                    | `buildArticleJsonLd` + `buildReviewJsonLd`      | ✅ existants                |
| `help_article`             | `Article` + `HowTo` (si `kind='howto'`)                 | `buildArticleJsonLd` + `buildHowToJsonLd`       | ✅ existants                |
| `faq`                      | `FAQPage` (hub) + `QAPage` (détail)                     | `buildFaqSpeakableJsonLd` + `buildQAPageJsonLd` | ✅ existants                |
| `glossary_term`            | `DefinedTerm` (+ `DefinedTermSet` au niveau hub)        | `buildDefinedTermJsonLd`                        | ❌ **À CRÉER KB-7**         |
| `guide`                    | `HowTo` (long-form actionable) ou `Article` (théorique) | `buildHowToJsonLd` ou `buildArticleJsonLd`      | ✅ existants                |
| `methodology`              | `HowTo`                                                 | `buildHowToJsonLd`                              | ✅ existant                 |
| `doctrine`                 | `Article` + `CreativeWork`                              | `buildArticleJsonLd`                            | ✅ existant                 |
| `tool_card` (public)       | `Product`                                               | `buildProductJsonLd`                            | ✅ existant                 |
| `competitor_card` (public) | `Product` + comparatif                                  | `buildProductJsonLd`                            | ✅ existant                 |
| `commercial_doc` (public)  | `Article` (CGV, mentions, etc.)                         | `buildArticleJsonLd`                            | ✅ existant                 |
| `onboarding_step` (public) | `HowTo` step                                            | `buildHowToJsonLd`                              | ✅ existant                 |

**Helpers à créer (KB-7)** :

1. `buildDefinedTermJsonLd({ locale, path, termName, description, inDefinedTermSet, partOfSpeech? })` → émet :
   ```json
   {
     "@context": "https://schema.org",
     "@type": "DefinedTerm",
     "name": "RAG",
     "description": "Retrieval-Augmented Generation...",
     "inDefinedTermSet": "https://axion-ia.com/fr/glossaire",
     "url": "https://axion-ia.com/fr/glossaire/rag",
     "termCode": "RAG",
     "inLanguage": "fr"
   }
   ```
2. `buildDefinedTermSetJsonLd({ locale, path, name, hasDefinedTerm: [...] })` → émet le set hub `/glossaire`.
3. (Optionnel V1.5) `buildCaseStudyJsonLd` — extension `Article` avec extension semantique typed sector + size + metric + clientName si consent.

### 3.2 Champs OBLIGATOIRES par JSON-LD KB

Tout JSON-LD KB doit inclure :

- `dateModified` (ISO 8601) — source `KnowledgeEntry.updatedAt` ; signal fraîcheur AI Overviews 2026.
- `datePublished` (ISO 8601) — source `KnowledgeEntry.publishedAt`.
- `author` typed `Person` — source `KnowledgeAuthor` joint. Helper `buildPersonJsonLd` existant.
- `publisher` typed `Organization` — SSOT singleton `Axion-IA` (mémoire `axionia_aeo_geo_perfection_2026-05-07` retire Webflow → editorial Anthropic Inc).
- `inLanguage` — `fr` ou `en` strict (pas `fr-FR`).
- `mainEntityOfPage` typed `WebPage` avec `@id` = canonical URL.

### 3.3 reviewedBy & structuralReview (E-E-A-T)

- Champ `KnowledgeEntry.reviewedById` (existant Sprint KB-4) → ajouter au JSON-LD :
  ```json
  "reviewedBy": { "@type": "Person", "name": "...", "url": "..." }
  ```
  Reviewer distinct de l'author. Signal E-E-A-T (Expertise + Authoritativeness).
- Date `KnowledgeEntry.lastReviewedAt` → champ JSON-LD `dateModified` si plus récent que `updatedAt`, OU custom property `lastReviewedAt`.

### 3.4 Multiple JSON-LD séparés (anti-pattern critique)

- **Jamais** concaténer plusieurs `@type` dans un seul `<script type="application/ld+json">` array sauf en `@graph`.
- **Toujours** émettre N balises `<script>` séparées : 1 par schema. Pattern composant `<JsonLd>` existant (`src/components/marketing/JsonLd.tsx`).
- Exemple page `/fr/blog/[slug]` :
  ```
  <JsonLd data={buildBreadcrumbJsonLd(...)} />
  <JsonLd data={buildArticleJsonLd(...)} />
  <JsonLd data={buildPersonJsonLd(...)} />
  ```
- Pour FAQ aggrégate sur la même page (un guide qui inclut une FAQ section) : 1 `<JsonLd>` `Article` + 1 `<JsonLd>` `FAQPage`, jamais fusionnés.

### 3.5 Speakable (AEO voice 2026)

- FAQ et glossary terms publics : intégrer `SpeakableSpecification` via `buildFaqSpeakableJsonLd` (existant L526).
- Sélecteur CSS standardisé : `[data-faq-q],[data-faq-a]` pour FAQ ; `[data-term-name],[data-term-def]` pour glossary.
- Voice-first AI agents (Alexa, Google Assistant, Siri) lisent à voix haute → utile pour requêtes type « Axion-IA, qu'est-ce que RAG ? ».

---

## 4. GEO — GÉOCONTEXTUALISATION + MAILLAGE pSEO

### 4.1 Tags `region:<code>` et `areasServed`

- Toute `KnowledgeEntry` peut porter des tags géocontextualisés :
  - `region:75` (Paris), `region:69` (Lyon), `region:13` (Marseille), etc. — code INSEE 2 chiffres pour Top 10 villes, code AdministrativeArea slug (`ile-de-france`, `auvergne-rhone-alpes`) pour régions.
  - `region:france` pour entrées multi-région nationales.
- Champ optionnel `KnowledgeEntry.areasServed` (JSON `{ type: "City"|"AdministrativeArea"|"Country", name, url? }`) — calque la signature de `buildServiceJsonLd.areasServed` (existant `seo.ts` L117-121).
- Auto-injection : helper `buildKbAreasServed(entry)` calcule `areasServed` depuis tags `region:*` + retombe sur `buildServiceAreasServed(locale)` (signature existante) si entrée sans tag explicite et `type IN ('case_study', 'methodology')`.

### 4.2 Maillage interne vers pSEO villes

- Page entrée KB taguée `region:75` (Paris) → bas de page composant `<RelatedCityCoverage city="paris" services={['audit','interventions','implementation']} />` qui rend 3 liens vers `/fr/audit/par-ville/paris`, `/fr/interventions/par-ville/paris`, `/fr/implementation/par-ville/paris` (URLs existantes, mémoire `axionia_pseo_villes_livre_2026-05-08`).
- Page entrée KB taguée `region:ile-de-france` → composant `<RelatedRegionLink region="ile-de-france" />` vers `/fr/implantations/ile-de-france`.
- Inversement : page ville (Paris) lit `KnowledgeEntry WHERE tags @> '["region:75"]' AND audience='public' AND status='published'` et affiche un bloc « Ressources pour Paris » (Top 5 entrées triées par `publishedAt DESC`).
- Bénéfice GEO 2026 : Google AI Overviews / Perplexity citent les ressources géo-pertinentes en réponse à « audit IA Paris », « formation IA Lyon ».
- Volume cible V1 : ~10 % des entrées portent un tag région (= 100-200 entrées géo sur 1 000-2 000 entrées totales).

### 4.3 `region:` tag — convention slug

- SSOT `src/content/regions.ts` (existant) liste les régions indexable.
- Tag KB = `region:${region.slug}` (ex. `region:ile-de-france`) pour régions ou `region:${ville.slug}` (ex. `region:paris`, `region:lyon`) pour villes.
- Validation Zod (KB-3) : tag matchant `^region:[a-z0-9-]+$` → vérifie existence dans SSOT au save.
- Anti-pattern : tags freetext `Paris` ou `PARIS` ou `paris` (case-insensitive collision). Normalisation au save.

---

## 5. SITEMAP — EXTENSION `src/app/sitemap.ts`

### 5.1 Stratégie : 1 sub-sitemap statique `knowledge` + chunking auto

Pattern : aligne sur `villes-<region>(-<chunk>)` existant (mémoire reality check §5.2 sitemap.ts L171-193).

```ts
// AJOUT (KB-7) — sitemap.ts ligne ~70
type StaticSitemapId =
  | "pages"
  | "blog"
  | "help"
  | "cas-concrets"
  | "comparaisons"
  | "implementation"
  | "implantations"
  | "services-villes-audit"
  | "services-villes-interventions"
  | "services-villes-implementation"
  | "knowledge"; // ← NOUVEAU

// Et un builder dédié :
async function buildKnowledgeSitemap(now: Date): Promise<MetadataRoute.Sitemap> {
  // Lit `KnowledgeEntry` WHERE audience='public' AND status='published'
  // Exclut types DÉJÀ sitemappés par les sub-sitemaps spécialisés (blog, cas-concrets, help, faq) :
  const entries = await prisma.knowledgeEntry.findMany({
    where: {
      audience: "public",
      status: "published",
      type: {
        in: [
          "glossary_term",
          "guide",
          "methodology",
          "doctrine",
          "tool_card",
          "competitor_card",
          "commercial_doc",
        ],
      }, // catch-all + dédiés non couverts
    },
    include: { translations: true, route: true },
  });
  // Émet 1 entry FR + 1 entry EN par KnowledgeEntry, avec alternates languages
  // Réutilise `buildDynamic` helper existant.
}
```

### 5.2 Chunking auto à 1 000 URLs

- Si `KnowledgeEntry` cross-type publié > 500 entrées (1 000 URLs FR+EN), splitter en `knowledge-1.xml`, `knowledge-2.xml`, ... (pattern villes existant).
- Volume cible V1 : ~500-1 000 entrées publiques toutes types → 1-2 sub-sitemaps.
- Lecture DB au build time (sitemap ISR `revalidate: 3600`) → reliance sur Postgres Coolify (OK, ~50 ms query). En V1.5, cache Redis 1h pour économiser query répétée.

### 5.3 Sub-sitemaps existants (alimentés depuis KB après KB-6)

Aucun changement structurel — les sub-sitemaps `blog`, `help`, `cas-concrets` existants continuent d'émettre les URLs. Mais leurs sources (`getAllBlogSlugs`, `getAllCaseStudySlugs`, etc. dans `src/content/transversal.ts` / `case-studies.ts` / `blog/`) doivent basculer en KB-6 vers lecture `KnowledgeEntry` au lieu de la SSOT hardcodée actuelle.

### 5.4 Préservation `sitemap-index.xml`

- Route existante `src/app/sitemap-index.xml/route.ts` consomme `generateSitemaps()` (existante).
- Ajout statique `"knowledge"` à `staticIds` (L199-210) → automatiquement listé dans index racine `/sitemap-index.xml` ET exposé à `/sitemap/knowledge.xml`.
- Zéro nouvelle route file.

### 5.5 Préservation `robots.ts`

- Aucun changement nécessaire : `robots.ts` pointe sur `/sitemap-index.xml` (qui auto-découvre `/sitemap/knowledge.xml` via index).

---

## 6. INDEXNOW — PINGS PAR PUBLISH

### 6.1 Helper existant

`src/lib/indexnow.ts` (déjà créé 2026-05-13, mémoire `axionia_session_2026-05-13_seo_email_stack`) :

```ts
pingIndexNow(urls: ReadonlyArray<string>, context?: string): void
```

- Fire-and-forget, log Sentry/console si échec, jamais throw.
- Validation host (URLs hors `axion-ia.com` filtrées, code 422 IndexNow évité).
- Payload `urlList` (pas `urls` — bug fix 2026-05-13).
- No-op safe si `INDEXNOW_KEY` absent (dev/preview).

### 6.2 Points d'invocation dans KB

| Server action                                                                             | Context label               | URLs à pinger                                              |
| ----------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------- |
| `publishEntryAction(id)`                                                                  | `kb:publish:<id>`           | URL canonique FR + URL canonique EN si translation publiée |
| `unpublishEntryAction(id)`                                                                | `kb:unpublish:<id>`         | mêmes URLs (Bing/Yandex notent la dé-publication)          |
| `updateEntryAction(id)` (si déjà publié)                                                  | `kb:update:<id>`            | mêmes URLs                                                 |
| `rescheduleEntryAction(id)` (`scheduled` → `published` ou inverse)                        | `kb:reschedule:<id>`        | mêmes URLs                                                 |
| Cron `scheduledPublishWorker` (BullMQ) — publie une entrée `scheduled` arrivée à échéance | `kb:scheduled-publish:<id>` | mêmes URLs                                                 |

### 6.3 Pattern de ping (à respecter)

```ts
// Dans publishEntryAction.ts (Sprint KB-4)
import { pingIndexNow } from "@/lib/indexnow";
import { SITE_URL } from "@/lib/seo";
import { buildKbCanonicalUrl } from "@/lib/knowledge/routes";

// après commit DB :
const urls = [
  buildKbCanonicalUrl(entry, "fr"),
  entry.translations.some((t) => t.locale === "en") ? buildKbCanonicalUrl(entry, "en") : null,
].filter(Boolean) as string[];
pingIndexNow(urls, `kb:publish:${entry.id}`);
```

### 6.4 Anti-patterns IndexNow

- ❌ Ping depuis `componentDidMount` ou `useEffect` (client) — IndexNow doit être server-side.
- ❌ Ping en bulk sur dépublication massive sans throttle — IndexNow rate-limit ~10K URLs/jour/host.
- ❌ Ping d'URLs `noindex` ou `audience IN ('team', 'will_only')` — pollue le crawl budget de Bing.
- ❌ Ping avant que la page soit réellement servable (race condition publish → ping → Bing 404).

---

## 7. llms.txt + llms-full.txt — EXTENSION

### 7.1 État actuel

- `src/app/llms.txt/route.ts` (existant, edge runtime) — listing high-level des 4 modules Axion-IA, ~25 lignes.
- `src/app/llms-full.txt/route.ts` (existant, edge runtime) — contenu verbose avec FAQ + cas concrets + méthodologie + engagement, ~100 lignes.

### 7.2 Extension cible V1

#### llms.txt enrichi (haut niveau)

Ajouter section après « ## Modules » :

```
## Ressources

- [Articles & analyses](${SITE_URL}/fr/blog) — ${nbArticles} articles publiés.
- [Cas concrets clients](${SITE_URL}/fr/cas-concrets) — ${nbCaseStudies} cas.
- [Centre d'aide](${SITE_URL}/fr/centre-aide) — ${nbHelpArticles} fiches.
- [Glossaire IA](${SITE_URL}/fr/glossaire) — ${nbGlossaryTerms} termes définis.
- [Guide IA entreprise](${SITE_URL}/fr/guide-ia) — 40 pages.
- [FAQ](${SITE_URL}/fr/faq) — ${nbFaqs} questions/réponses.
- [Hub Ressources](${SITE_URL}/fr/ressources) — recherche cross-type.
```

Compteurs calculés en cold-start via `prisma.knowledgeEntry.groupBy({ by: ['type'], where: { audience: 'public', status: 'published' } })`.

#### llms-full.txt enrichi (deep content)

Ajouter section après « ## Cas concrets » :

```
## Glossaire IA

${glossaryBlock}     // Top 50 termes les + consultés, format : "### LLM\n${definition}"

## Articles récents

${articlesBlock}     // Top 30 articles publiés récemment, format : "### Title\n> ${excerpt}\n\nURL: ${url}"

## Centre d'aide — extraits

${helpBlock}         // Top 20 aides les + consultées
```

### 7.3 Cron de régénération + IndexNow

- Cron quotidien (BullMQ worker `llmsRegenWorker`) → recalcule llms.txt et llms-full.txt si volume `KnowledgeEntry` a changé > 5 % depuis dernière régen (sinon skip).
- Après régen : `pingIndexNow([${SITE_URL}/llms.txt, ${SITE_URL}/llms-full.txt], 'kb:llms-regen')`.
- Cache HTTP existant `public, max-age=3600, stale-while-revalidate=86400` (déjà OK).
- Spec llmstxt.org : pas de format obligatoire JSON-LD, contenu en Markdown lisible LLM.

### 7.4 Anti-patterns llms.txt

- ❌ Inclure entrées `audience='team'` ou `audience='will_only'` ou `confidentiality IN ('confidential','secret')` — leak vers AI crawlers.
- ❌ Régénérer à chaque request (edge route force-static interdit en Next 16 — déjà documenté seo.ts).
- ❌ Embedder du HTML brut dans llms.txt — c'est du **Markdown only**.
- ❌ Lister des URLs `noindex` ou en `status='draft'`.

---

## 8. ANTI-PATTERNS (consolidé Agent 6)

### 8.1 OpenGraph

- ❌ Génération **côté client** (`useEffect` qui POST `/api/og`) — l'image doit exister avant que le crawler parse `<meta og:image>`. Toujours `opengraph-image.tsx` server-side.
- ❌ `og:image` pointant vers `localhost:3000` ou domaine de dev (bug détecté `axionia_bugs_seo_preexistants_2026-05-09`). Helper `SITE_URL` SSOT obligatoire.
- ❌ Image > 5 MB — LinkedIn rejette le preview. Cap 1 MB recommandé (sharp output webp/jpeg q=80).
- ❌ Dimensions ≠ 1200×630 — Twitter/LinkedIn affichent une carte tronquée.
- ❌ Texte sur image > 30 % de la surface — Facebook rejette en preview boost organique (legacy rule, encore observé).

### 8.2 JSON-LD

- ❌ Plusieurs schemas **contradictoires** sur même page : `Article` qui dit `datePublished: 2024-01-01` + `WebPage` qui dit `datePublished: 2025-01-01` — Google détecte et déclasse en rich-results test.
- ❌ JSON-LD `@graph` avec doublons : 2x `Organization` (1 dans Article, 1 dans WebPage) — fusion `@graph` recommandée OU choisir un seul SSOT (seo.ts pattern existant émet 1 `Organization` au layout level, jamais en page-level pour éviter doublon).
- ❌ `dateModified` < `datePublished` — incohérent, Google ignore le `dateModified` du coup.
- ❌ `author` typed `string` (« Will ») au lieu de `{ @type: Person, name: 'Will', url: '...' }` — perte E-E-A-T.
- ❌ `publisher` sans `logo.url` — Google rejette le rich result.
- ❌ `Article` sans `image` — Google AI Overviews skip pour citation.
- ❌ `FAQPage` aggrégate avec > 50 Q/A — Google cap utile 10-15.
- ❌ JSON-LD invalide → bloque rich-results entier de la page (pas de fallback graceful).

### 8.3 URLs et facettes

- ❌ Slug avec accents, espaces, majuscules — toujours normaliser kebab-case ASCII (script slug `slugify` côté admin form).
- ❌ Pagination `?page=2` non canonicalized — émettre `<link rel="canonical" href="/fr/blog">` sur page 2-N (sauf si contenu unique).
- ❌ Facettes infinies indexables (`?author=x&category=y&tag=z`) — bloquer `noindex` sur toute combinaison ≥ 2 facettes.
- ❌ Trailing slash incohérent (`/blog` vs `/blog/`) — convention Next 16 = sans trailing slash, canonical strict.

### 8.4 Hreflang

- ❌ Hreflang `en` pointant vers FR si EN non traduit — Google considère contenu dupliqué.
- ❌ Hreflang `en-US` / `fr-FR` au lieu de `en` / `fr` — incohérent avec `routing.locales` (`['fr', 'en']`).
- ❌ `x-default` manquant — Google ne sait pas quel locale servir par défaut.
- ❌ Hreflang `self-reference` manquant — chaque page doit pointer vers elle-même + ses alternates.

### 8.5 Sitemap

- ❌ Inclure URLs `audience='client'` ou `'team'` — leak privé.
- ❌ Inclure URLs `status='draft'` — Google crawl + indexation indésirables.
- ❌ `lastmod` faux (`now()` constant pour toutes URLs) — Google détecte « gameable signal », ignore. Toujours `KnowledgeEntry.publishedAt` ou `updatedAt`.
- ❌ Sub-sitemap > 50 000 URLs (hard limit) ou > 50 MB (hard limit). Chunking 1 000 URLs déjà conservateur.
- ❌ Régénérer sitemap synchronement par-request (édition admin → wait sitemap rebuild). Cron + ISR.

### 8.6 IndexNow

- ❌ Ping `localhost` ou domaine staging — IndexNow refuse 403.
- ❌ Ping > 10 000 URLs/jour — rate-limit Bing/Yandex.
- ❌ Re-ping de la même URL > 1×/24h — flag spam, IP throttled.
- ❌ Oublier de ping après `unpublish` — Bing garde l'URL en index avec contenu obsolète.

### 8.7 llms.txt

- ❌ Inclure secrets (token API, env vars) dans llms-full.txt — leak vers AI crawlers indexant.
- ❌ Format JSON ou YAML au lieu de Markdown — spec llmstxt.org = Markdown only.
- ❌ Volume llms-full.txt > 1 MB — certains crawlers tronquent. Splitter par section si dépasse.

---

## 9. STOP & ASK OUVERTS (à trancher Will avant Phase B)

### 9.1 Nom du hub agrégateur

> **Recommandation forte Agent 6** : `/ressources/`.
>
> Alternatives évaluées (rejetées) :
>
> - `/savoir/` — trop académique, faible volume recherche FR, EN equivalent `/knowledge/` redondant avec brand.
> - `/base-de-connaissance/` — long (23 chars), pas idiomatique web.
> - `/kb/` — jargon B2B-interne, exclut visiteurs non-tech.
> - `/library/` — EN ambigu (code library), FR `/bibliotheque/` trop éditorial vintage.
> - `/centre-ressources/` — long, redondant avec `/centre-aide/`.
>
> **Q1 — Will : valides-tu `/ressources/` (FR) + `/resources/` (EN) ?**

### 9.2 Slug EN du hub

> **Recommandation forte Agent 6** : `/resources/`.
>
> Alternatives :
>
> - `/library/` — réservé au sens « code library » dans la culture dev.
> - `/kb/` — jargon B2B.
> - `/knowledge/` — verbeux, parity bizarre avec `/ressources/`.
>
> **Q2 — Will : valides-tu `/resources/` ou souhaites-tu un alias différent (ex. /library) ?**

### 9.3 Séparation `/resources` vs `/library` vs `/kb`

> Question structurelle : doit-on en V1 prévoir une **séparation surface publique** (`/ressources/` = articles + cas + glossaire + guide + FAQ visibles au grand public) **vs surface client connectée** (`/mes-ressources/` Agent 7) ?
>
> **Recommandation Agent 6** : OUI — 2 surfaces distinctes.
>
> - `/fr/ressources/` = surface publique (audience='public').
> - `/fr/mes-ressources/` = surface client connectée (audience IN ('public','client'), login NextAuth requis, Agent 7).
>
> Pas de `/library/` séparé en V1. V1.5 pourrait introduire `/fr/bibliotheque/` pour content premium (`audience='client_paid_only'` futur) si Will valide un palier payant — hors scope V1.
>
> **Q3 — Will : confirmes-tu la double surface ressources publique + mes-ressources client SANS troisième niveau bibliothèque payante en V1 ?**

### 9.4 Préservation `/centre-aide/` côté URL ou bascule vers `/aide/`

> Question secondaire : l'URL legacy `/centre-aide/` (12 caractères) est-elle préservée stricto sensu ou bascule-t-on vers `/aide/` plus court ? Reality check §10.1 dit URLs **conservées** — recommandation Agent 6 = conserver `/centre-aide/`.
>
> **Q4 — Will : confirmes-tu zéro changement URL `/centre-aide/` (pas de raccourci vers `/aide/`) ?**

### 9.5 Catch-all `/ressources/[type]/[slug]` vs URL dédiée par type

> SSOT §12.4 mappe 6 types à `null` (methodology, doctrine, tool_card, competitor_card, commercial_doc, onboarding_step). En catch-all `/ressources/[type]/[slug]`.
>
> Alternative : créer une URL dédiée par type (ex. `/methodologie/[slug]`, `/outils/[slug]`, `/doctrine/[slug]`). Effort +6 routes mais SEO/clarté URL gagnés.
>
> **Recommandation Agent 6** : catch-all V1, dédiées V1.5 si volume entrées par type justifie (seuil ~20 entrées/type).
>
> **Q5 — Will : confirmes-tu catch-all V1 puis upgrade vers URLs dédiées V1.5 sur seuil de volume ?**

### 9.6 Slug FR pour `/ressources/auteur/[slug]` vs alias `/auteur/[slug]` au top-level

> Page auteur cross-type proposée à `/ressources/auteur/[slug]` (verbose mais cohérent hub).
>
> Alternative : page auteur global top-level `/fr/auteur/[slug]` (URL plus courte, partageable). Combine articles + cas + glossaire + guides du même auteur.
>
> **Recommandation Agent 6** : top-level `/fr/auteur/[slug]` + `/en/author/[slug]` (E-E-A-T plus fort, URL plus courte, citée par AI Overviews comme « page auteur officielle » plus volontiers).
>
> Conséquence : déprécier `/fr/blog/auteur/[slug]` legacy → 301 vers `/fr/auteur/[slug]`.
>
> **Q6 — Will : préfères-tu `/fr/auteur/[slug]` top-level OU rester sur sous-route `/fr/ressources/auteur/[slug]` ?**

### 9.7 `DefinedTerm` JSON-LD : `inDefinedTermSet` valeur

> Glossaire JSON-LD requiert champ `inDefinedTermSet` pointant vers le hub.
>
> Option A : `inDefinedTermSet: "https://axion-ia.com/fr/glossaire"` (URL).
> Option B : `inDefinedTermSet: { "@type": "DefinedTermSet", "name": "Glossaire IA Axion-IA", "url": "..." }` (typed inline).
>
> **Recommandation Agent 6** : Option B (Google docs préfère typed nested objects).
>
> **Q7 — Will : OK Option B ?**

### 9.8 Volume initial glossaire après migration

> La const hardcodée `TERMS` dans `/glossaire/page.tsx` actuelle = ~20 termes (audit visuel lecture 80 lignes).
>
> Le prompt prévoit potentiellement plus en V1 (100-200 termes cible IA full).
>
> **Q8 — Will : tu valides un objectif chiffré de ~100 termes glossaire publiés V1 fin Sprint KB-19 ?**

### 9.9 Auto-promotion sitemap pour types non-dédiés

> Une entrée `type='methodology' audience='public' status='published'` doit-elle apparaître :
> (a) seulement dans `/sitemap/knowledge.xml` (recommandation Agent 6),
> OU (b) aussi dans `/sitemap/pages.xml` (élargi cross-template) ?
>
> **Recommandation Agent 6** : (a) seulement, pour homogénéité par template.
>
> **Q9 — Will : OK (a) ?**

### 9.10 Cron llms.txt — fréquence

> Quotidien (recommandation), hebdomadaire, ou on-demand-only (régénéré sur publish event direct) ?
>
> **Recommandation Agent 6** : on-demand-only via event `kb.published` consommé par worker BullMQ → throttle 5 min (évite ping IndexNow trop fréquent). Cron quotidien fallback safety net.
>
> **Q10 — Will : OK pattern event-driven + cron safety daily ?**

---

## 10. RÉSUMÉ POUR LE PARENT

### 10.1 Livrables conceptuels Agent 6 (Phase B → KB-7 + KB-9 + KB-18)

| Sprint cible               | Livrable                                                                                                 | Effort estimé |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------- |
| KB-7 (FTS + AEO factories) | Helper `buildDefinedTermJsonLd` + `buildDefinedTermSetJsonLd` + extension `src/lib/seo.ts`               | 0.5 dj        |
| KB-7                       | `src/content/knowledge/labels.ts` SSOT typeLabels + `src/content/knowledge/routes.ts` SSOT mapping §12.4 | 0.5 dj        |
| KB-7                       | Extension `src/app/sitemap.ts` ID `knowledge` + builder + chunking                                       | 1 dj          |
| KB-7                       | Wrapper `buildKbMetadata({ entry, locale })`                                                             | 0.5 dj        |
| KB-9 (RGPD/governance)     | Hook `pingIndexNow` dans publish/unpublish/update server actions                                         | 0.5 dj        |
| KB-15 (multi-format)       | Extension llms.txt + llms-full.txt + worker `llmsRegenWorker`                                            | 1 dj          |
| KB-18                      | Page hub `/fr/ressources/` + `/fr/ressources/[type]/[slug]` catch-all + facettes tag + auteur            | 3 dj          |
| KB-18                      | `opengraph-image.tsx` template KB partagé (réutilisé par 6 routes)                                       | 1 dj          |
| Total                      |                                                                                                          | **8 dj**      |

### 10.2 Points de cohérence avec autres Agents

- Agent 1 (data model) : `KnowledgeEntry.areasServed` + `tags` champs requis.
- Agent 2 (SSOT) : `labels.ts`, `routes.ts`, `kbTypeLabels` côté i18n mono-fichier namespacé.
- Agent 3 (Admin UI) : éditeur émet preview meta-description (140-160 cap) live.
- Agent 4 (server actions) : appelle `pingIndexNow` + `revalidatePath` systématique.
- Agent 7 (client surface) : `/mes-ressources/` reuse `buildKbMetadata` avec `robots: { index: false, follow: false }`.
- Agent 11 (perf) : ISR `revalidate: 3600` sur pages KB publiques + on-demand `revalidatePath` sur publish.
- Agent 12 (a11y / E-E-A-T) : composant auteur visible + reviewedBy + datesModified.
- Agent 15 (multi-format) : RSS Atom + JSON Feed par type, llms.txt extension.

### 10.3 Verdict GO ✅

L'arborescence cible est cohérente avec les surfaces existantes (zéro 301), réutilise massivement `src/lib/seo.ts` (11 factories existantes + 2-3 à créer), s'aligne au pattern sitemap chunking villes existant, exploite le helper IndexNow centralisé créé 2026-05-13. **Aucun blocage technique** côté SEO/AEO/GEO. Les 10 STOP & ASK ouverts sont des choix de naming/scope V1, pas des contraintes architecturales.

---

**Fin Agent 6 — surface publique SEO/AEO/GEO.**
