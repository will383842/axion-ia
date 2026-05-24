# A2 — AEO (JSON-LD) | Score 81/100

| Sous-dim                   | Score | Verdict                                                                                  | path:line                              |
| -------------------------- | ----- | ---------------------------------------------------------------------------------------- | -------------------------------------- |
| 1. JSON-LD graph @context  | 95    | `@graph` unique layout-level + per-page schemas séparé. Zéro redondance                  | JsonLdGraph.tsx:68                     |
| 2. FAQPage                 | 85    | 12 Q/R, speakable actif, itemCount/numberOfItems manquant                                | page.tsx:275-281, seo.ts:716-737       |
| 3. Speakable               | 90    | 4 cssSelector multi-fallback, data-faq-q/a appliquées au FaqAccordion HTML réel          | seo.ts:722-724, FaqAccordion.tsx:50,53 |
| 4. Service x5              | 75    | 5 Service émis, mais serviceType ≠ pricing.ts tiers + pas @id refs vers Organization     | page.tsx:314-327                       |
| 5. AggregateRating         | 0     | **Absent (décision Will)** — retrait volontaire n<5 testimonials                         | page.tsx:329-334                       |
| 6. Review x4               | 0     | **Absent** corrélé AggregateRating — CASE_STUDIES.testimonialQuote pas émis JSON-LD      | page.tsx:335                           |
| 7. Organization parent     | 95    | layout-level Organization @id réutilisé, sameAs Wikidata-safe, legalName + alternateName | layout.tsx:178, seo.ts:387-404         |
| 8. VideoObject             | 80    | Structure robuste mais VIDEO_TESTIMONIALS=[] + uploadDate dynamique (stale)              | page.tsx:353-363                       |
| 9. WebSite + SearchAction  | 100   | WebSite JSON-LD + potentialAction SearchAction (sitelinks searchbox)                     | seo.ts:448-474                         |
| 10. AI Overviews readiness | 82    | Intro hero courte, FAQ <200w, dates ISO BUILD_DATE                                       | seo.ts:27-47, page.tsx:384             |

## Inventaire JSON-LD émis sur la home (exhaustif)

| #   | Type                                | path:line        | Helper                     | @id                                 |
| --- | ----------------------------------- | ---------------- | -------------------------- | ----------------------------------- |
| 1   | Organization                        | layout.tsx:178   | buildOrganizationJsonLd()  | ✅ #organization                    |
| 2   | WebSite                             | layout.tsx:179   | buildWebsiteJsonLd()       | ✅ #website                         |
| 3   | FAQPage (12 Q/R)                    | page.tsx:288     | buildFaqSpeakableJsonLd()  | ❌                                  |
| 4   | Service ×5                          | page.tsx:314-327 | hardcoded array            | ❌ (provider string au lieu de @id) |
| 5   | ProfessionalService (LocalBusiness) | page.tsx:293     | buildLocalBusinessJsonLd() | ❌                                  |
| 6   | BreadcrumbList (1-item)             | page.tsx:338-349 | hardcoded                  | ✅ ${leafUrl}#breadcrumb            |
| 7   | VideoObject ×n (conditional)        | page.tsx:353-363 | hardcoded loop             | ❌                                  |

## Forces (top 3)

1. **Consolidation @graph layout-level** = architecture SEO 2026 moderne, ~300ms parsing économisés
2. **Speakable multi-sélecteur + data-faq-q/a alignment** — voix Google Assistant/Alexa lectible
3. **BUILD_DATE freshness signal E2E** cohérent sitemap + dateModified + Service JSON-LD

## P0

1. **Service x5 sans @id refs vers Organization** (page.tsx:314-327) — fragmente knowledge graph LLMs. Remplacer `provider: { @type, name, url }` par `provider: { "@id": "#organization" }` — 10min — +8 AEO pts
2. **VideoObject uploadDate dynamique** (page.tsx:359) — `new Date().toISOString().slice(0,10)` au runtime = stale signal. Ajouter `datePublished` à `VideoTestimonial` interface — 20min — +5 AEO pts (conditionnel actuellement [])

## P1

1. AggregateRating + Review absent = 0 AEO signal "proof" — réactiver quand ≥5 testimonialQuote avec datePublished — 1h — +12 AEO pts
2. FAQPage `numberOfItems` field manquant (validator Google compliance) — 5min
3. BreadcrumbList home 1-item self-ref (corrélé A4 P0-1) — soit retirer soit position 0 — 2min
4. Service `serviceType` ≠ pricing.ts TIERS (mismatch mapping) — aligner via serviceTypeMap — 20min

## P2

1. LocalBusiness description 60-80w avec différenciateurs concrets — 10min
2. FAQ answers >250w (Perplexity prefers <150w direct answers) — flagger pour rewrite
3. Person.worksFor Organization déjà correct ✓
4. sameAs LinkedIn réel ✓ (Will validated)

## Centralisation opportunities

- `buildServicesJsonLd(locale, services[])` factory avec pricing.ts tiers (DRY) — 45min
- `FAQ_HOME_IDS` export depuis transversal.ts (réutilisable /faq + sitemap) — 10min
- VideoTestimonial.datePublished field requis — 20min
