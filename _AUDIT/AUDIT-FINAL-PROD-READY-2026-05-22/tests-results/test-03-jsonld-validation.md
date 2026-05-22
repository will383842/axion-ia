# Test 03 — JSON-LD validation
## Date : 2026-05-22

## Builders JSON-LD trouvés dans src/lib/seo.ts
102:export function buildProductMetadata({
209:export function buildServiceJsonLd({
299:export function buildFaqJsonLd({ items, speakable = true }: FaqJsonLdInput) {
330:export function buildBreadcrumbJsonLd({ locale, items }: BreadcrumbJsonLdInput) {
375:export function buildOrganizationJsonLd({
438:export function buildWebsiteJsonLd({ locale }: WebsiteJsonLdInput) {
498:export function buildPersonJsonLd({
610:export function buildArticleJsonLd({
706:export function buildFaqSpeakableJsonLd({
771:export function buildLocalBusinessJsonLd({
850:export function buildPlaceJsonLd({
902:export function buildItemListJsonLd({ locale, path, name, items }: ItemListJsonLdInput) {
943:export function buildProductJsonLd({
1005:export function buildHowToJsonLd({
1097:export function buildCourseJsonLd(input: CourseJsonLdInput) {
1174:export function buildReviewJsonLd({
1219:export function buildAggregateRatingJsonLd({
1263:export function buildDatasetJsonLd({
1327:export function buildImageObjectJsonLd({
1364:export function buildQAPageJsonLd({

## Schemas référencés (grep schema.org partout)
src/lib/seo/ville-service-jsonld.ts:175:      "@type": "PostalAddress",
src/lib/seo/ville-service-jsonld.ts:182:      "@type": "GeoCoordinates",
src/lib/seo/ville-service-jsonld.ts:188:      "@type": "Organization",
src/lib/seo/ville-service-jsonld.ts:196:        "@type": "OpeningHoursSpecification",
src/lib/seo/ville-service-jsonld.ts:202:    areaServed: { "@type": "City", name: ville.nameFr },
src/lib/seo/ville-service-jsonld.ts:235:      "@type": "FAQPage",
src/lib/seo/ville-service-jsonld.ts:237:        "@type": "SpeakableSpecification",
src/lib/seo/ville-service-jsonld.ts:241:        "@type": "Question",
src/lib/seo/ville-service-jsonld.ts:245:          "@type": "Answer",
src/lib/seo/ville-service-jsonld.ts:281:    "@type": "Person",
src/lib/seo/ville-service-jsonld.ts:285:      "@type": "Organization",
src/lib/seo/ville-service-jsonld.ts:306:    "@type": "WebPage",
src/lib/seo/ville-service-jsonld.ts:322:      { "@type": "City", name: ville.nameFr },
src/lib/seo/ville-service-jsonld.ts:323:      { "@type": "Service", name: isFr ? serviceNameFr : serviceNameEn },
src/lib/seo/ville-service-jsonld.ts:328:      "@type": "SpeakableSpecification",
src/lib/seo/ville-service-jsonld.ts:333:      "@type": "ReserveAction",
src/lib/seo/ville-service-jsonld.ts:335:        "@type": "EntryPoint",
src/lib/seo/ville-service-jsonld.ts:339:        "@type": "Reservation",
src/lib/seo-content-gen-factories.test.ts:30:      "@type": "SpeakableSpecification",
src/lib/seo-content-gen-factories.test.ts:108:      "@type": "CreativeWork",
src/lib/seo-content-gen-factories.ts:54:    "@type": "Person",
src/lib/seo-content-gen-factories.ts:61:      "@type": "ImageObject",
src/lib/seo-content-gen-factories.ts:153:    mainEntityOfPage: { "@type": "WebPage", "@id": url },
src/lib/seo-content-gen-factories.ts:177:            "@type": "ImageObject",
src/lib/seo-content-gen-factories.ts:199:      "@type": "SpeakableSpecification",
src/lib/seo-content-gen-factories.ts:239:      "@type": "CreativeWork",
src/lib/seo-content-gen-factories.ts:285:    "@type": "QAPage",
src/lib/seo-content-gen-factories.ts:292:      "@type": "Question",
src/lib/seo-content-gen-factories.ts:295:        "@type": "Answer",
src/lib/seo-content-gen-factories.ts:301:        ? { isPartOf: { "@type": "WebPage", url: input.parentArticleUrl } }
src/lib/seo-content-gen-factories.ts:307:      "@type": "SpeakableSpecification",
src/lib/seo-content-gen-factories.ts:342:    "@type": "HowTo",
src/lib/seo-content-gen-factories.ts:356:            "@type": "MonetaryAmount",
src/lib/seo-content-gen-factories.ts:363:      ? { tool: input.tool.map((name) => ({ "@type": "HowToTool", name })) }
src/lib/seo-content-gen-factories.ts:366:      ? { supply: input.supply.map((name) => ({ "@type": "HowToSupply", name })) }
src/lib/seo-content-gen-factories.ts:369:      "@type": "HowToStep",
src/lib/seo-content-gen-factories.ts:385:    "@type": "SpeakableSpecification",
src/lib/seo-content-gen-factories.ts:405:    "@type": "CreativeWork",
src/lib/seo.ts:249:    "@type": "Service",
src/lib/seo.ts:259:      "@type": "Organization",

## legalName société française D7
src/lib/seo.ts:151:      siteName: "Axion-IA",
src/lib/seo.ts:201:   * Canaux de service géolocalisés — top métropoles où Axion-IA délivre la
src/lib/seo.ts:260:      name: "Axion-IA",
src/lib/seo.ts:292:   * à `[data-faq-q],[data-faq-a]` — convention site Axion-IA pour marquer les
src/lib/seo.ts:302:  // "Axion-IA, comment ça se passe une formation IA ?" via vocal. Sans
src/lib/seo.ts:368:// answer engines unambiguously identify "Axion-IA" the entity (vs other
src/lib/seo.ts:388:    name: "Axion-IA",
src/lib/seo.ts:389:    legalName: "Axion-IA",
src/lib/seo.ts:444:    name: "Axion-IA",
src/lib/seo.ts:452:      name: "Axion-IA",

## aiGenerated/additionalType AIGeneratedContent (AI Act)
src/lib/seo-content-gen-factories.test.ts:128:  it("émet aiGenerated:true + additionalType (P0-5 AI Act art. 50 — deadline 2026-08-02)", () => {
src/lib/seo-content-gen-factories.test.ts:137:    expect(out["aiGenerated"]).toBe(true);
src/lib/seo-content-gen-factories.test.ts:138:    expect(out["additionalType"]).toBe("https://schema.org/AIGeneratedContent");
src/lib/seo-content-gen-factories.test.ts:144:  it("émet aiGenerated:true sur les 4 variants (Article/BlogPosting/TechArticle/NewsArticle)", () => {
src/lib/seo-content-gen-factories.test.ts:159:    expect(article["aiGenerated"]).toBe(true);
src/lib/seo-content-gen-factories.test.ts:160:    expect(news["aiGenerated"]).toBe(true);
src/lib/seo-content-gen-factories.test.ts:194:  it("émet aiGenerated: true + additionalType AIGeneratedContent (P0-5 AI Act art. 50)", () => {
src/lib/seo-content-gen-factories.test.ts:204:    expect(out["aiGenerated"]).toBe(true);
src/lib/seo-content-gen-factories.test.ts:205:    expect(out["additionalType"]).toBe("https://schema.org/AIGeneratedContent");
src/lib/seo-content-gen-factories.ts:75:    // Schema.org draft 2026 (AIGeneratedContent).
src/lib/seo-content-gen-factories.ts:76:    aiGenerated: true,
src/lib/seo-content-gen-factories.ts:77:    additionalType: "https://schema.org/AIGeneratedContent",
src/lib/seo-content-gen-factories.ts:128: * elle-même `aiGenerated=true` (AuthorProfile.aiGenerated) et le disclaimer
src/lib/seo-content-gen-factories.ts:163:    // ajout du flag machine-readable `aiGenerated: true` + `additionalType`
src/lib/seo-content-gen-factories.ts:164:    // forward-compat Schema.org draft 2026 (AIGeneratedContent), au-delà du
src/lib/seo-content-gen-factories.ts:169:    aiGenerated: true,
src/lib/seo-content-gen-factories.ts:170:    additionalType: "https://schema.org/AIGeneratedContent",
src/app/sitemap-images-services.xml/route.ts:47:  <!-- CC BY 4.0 — © 2026 Axion-IA — aiGenerated:true (AI Act art. 50) -->
src/app/[locale]/(admin)/[adminPrefix]/content-gen/author/manon/_v2/AuthorManonV2.tsx:14:  aiGenerated: boolean;
src/app/[locale]/(admin)/[adminPrefix]/content-gen/author/manon/_v2/AuthorManonV2.tsx:44:      aiGenerated: formData.get("aiGenerated") === "on",
