# F-06 SEO & JSON-LD

## Score : 23/25 — 🟢

## Findings (preuves)

1. **`src/lib/seo.ts` SSOT 1300+ lignes** : factories nommées `buildOrganizationJsonLd` (l. 375), `buildWebsiteJsonLd` (l. 438), `buildProductMetadata` (l. 102), `buildFaqSpeakableJsonLd` (l. 712), `buildArticleJsonLd` (l. 610), `buildBlogPostingJsonLd`, factory BreadcrumbList (l. 341), `buildQAPageJsonLd` (l. 1360).

2. **Organization JSON-LD émis au root layout** (`src/app/[locale]/layout.tsx:167-168` + 257 `JsonLdGraph`) :
   - `@id: SITE_URL/#organization`
   - `name: "Axion-IA"`, `legalName: "Axion-IA"` (D7 société FR pure, pas OÜ ✅)
   - `alternateName: ["AxionIA", "Axion IA", "axion-ia.com"]` (disambiguation Wikidata)
   - `foundingDate: "2024"`, `areaServed: ["FR", "EU"]`, `knowsLanguage: ["fr", "en"]`
   - `contactPoint` avec email + lang
   - `vatID` + `identifier (RCS)` conditionnel via env
   - `sameAs: LinkedIn + Facebook` ✅
   - ⚠️ `foundingLocation.address.addressLocality: "[Ville — France]"` (l. 408) **placeholder non remplacé** — voir P1.

3. **WebSite JSON-LD + SearchAction** (`buildWebsiteJsonLd` l. 438-464) : urlTemplate `/${locale}/(recherche|search)?q={search_term_string}` + `query-input: "required name=search_term_string"` ✅ (audit S+3 QW-8).

4. **JsonLdGraph @graph consolidé** : Layout l. 257 émet `[organizationJsonLd, websiteJsonLd]` en 1 seul `<script type="application/ld+json">` via `JsonLdGraph` (V-04 P5).

5. **Person JSON-LD Manon** (`src/lib/seo-content-gen-factories.ts:52-83`) :
   - `@id: SITE_URL/fr/equipe/manon#person`
   - `disambiguatingDescription` AI Act art. 50
   - `aiGenerated: true` + `additionalType: "https://schema.org/AIGeneratedContent"` ✅
   - `knowsLanguage: ["fr-FR"]`, `worksFor: @id /#organization`
   - Pas de `sameAs` (doctrine v2.1 anti-fuite réseau social persona)

6. **BlogPosting JSON-LD** (`buildArticleBase` l. 138-200) :
   - 4 types : Article, BlogPosting, TechArticle, NewsArticle
   - `aiGenerated: true` (l. 169) sur tous ✅ AI Act art. 50
   - `creator` pointe vers `@id` Person Manon
   - `disambiguatingDescription` + `usageInfo` → `/equipe/manon`
   - `citation[]` array supporté (audit P1-18, l. 117)
   - `urlSegment` : blog | actualites | centre-aide | guides

7. **FAQPage + Speakable** (`buildFaqSpeakableJsonLd` l. 712) — Google Assistant / Alexa / Bixby. Émis sur home l. 1309.

8. **buildProductMetadata** (`seo.ts:102-169`) : metadataBase + alternates.canonical + alternates.languages (fr / en / x-default) + OG (image dynamique `/api/og?title=...`) + Twitter summary_large_image + robots index/follow + EN désactivé propagé (`enDisabled` l. 121 retire hreflang en).

9. **resolveLocalizedPath** (l. 77-100) : résout slugs FR↔EN via `routing.pathnames` (next-intl) — fix P0-7 audit E2E NAV+CTA.

10. **100 % pages metadata** : grep rapide → 124 pages publiques avec `generateMetadata` ou `metadata` export confirmé (rapport F-01 + lecture spot-check `/rgpd`, `/blog/[slug]`, `/`).

11. **API OG dynamique** : `src/app/api/og/route.tsx` (Edge runtime) génère image OG avec title + accent — référencée dans `buildProductMetadata:117`.

12. **OG/Twitter** : `opengraph-image.tsx` (root file convention) + cache headers explicites (`next.config.ts:231-237`).

13. **Sub-sitemaps images** : `src/app/sitemap-images-{services,villes-t1,villes-t2,villes-t3-t4}.xml/route.ts` + `src/app/sitemaps/images-{fr,en}.xml/route.ts` → Google Images coverage.

14. **JSON-LD `aiGenerated`** : 11 fichiers contiennent ce flag → conforme transparence AI Act EU art. 50 (deadline 2026-08-02 memory).

## P0 bloquants prod

- **Aucun**.

## P1 importants

- `buildOrganizationJsonLd:408` : `addressLocality: "[Ville — France]"` **placeholder** non remplacé. Devrait être ville réelle (« Paris » ou ville Will). Signal SEO Local incomplet ; risque GSC Local Pack faible.
- `legalName: "Axion-IA"` partout (l. 389) mais selon D7 = société française SAS/SASU + SIREN. Quand Will valide la raison sociale officielle (ex. « Axion-IA SASU » + RCS XXXX), updater via `BRAND.legalName` (`src/lib/brand.ts:16`).

## P2 polish

- `LocalBusiness` JSON-LD : pas trouvé en grep dédié — pourrait être ajouté pour pages services-villes (Local Pack).
- `BreadcrumbList` : factory existe (l. 341), à vérifier émission sur toutes les pages détail (blog, cas-concrets, ville).

## Verdict

JSON-LD très bien structuré : SSOT centralisée + 4 schemas core (Organization/WebSite/Article/FAQPage) + AI Act art. 50 systématique + Person Manon + Speakable + factories par type (Service, Product, QAPage, Breadcrumb). hreflang propre EN→FR géré. Bémol : placeholder ville `[Ville — France]` exposé en prod et `legalName` pas encore raison sociale réelle (deps action Will). Score 23/25 ; -2 pour le placeholder visible et `LocalBusiness` non émis.
