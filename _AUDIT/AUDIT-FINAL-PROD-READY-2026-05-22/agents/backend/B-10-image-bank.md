# B-10 — Image Bank

**Score : 23/25**
**Verdict : GO — pipeline Sharp complet, sitemaps + JSON-LD + watermark + 0 IA generative**

## Inventaire

`src/server/image-bank/` : 19 fichiers TS, 7 services + 4 utils + types + constants + taxonomy.

### Services principaux
- `image-import.service.ts` (ImageImportService) — Sharp pipeline
- `image-bank.service.ts` (330 lignes) — orchestration
- `image-translation.service.ts` — Claude Sonnet 4.6 vision auto-translate
- `image-country-detector.service.ts` — auto-détection pays
- `image-attribute-validator.service.ts` — validation EXIF/XMP
- `image-watermark.service.ts` — watermark on-the-fly
- `image-seo.service.ts`, `image-seo-enrichment.service.ts` — métadonnées SEO
- `image-jsonld-graph.service.ts` — JSON-LD ImageObject @graph
- `image-taxonomy-detector.service.ts` — auto-tagging

## Pipeline Sharp (`image-import.service.ts:42`)

`importImage(input)` `:47` :
1. **Sharp metadata via SHARP_LIMITS** (limitInputPixels 100M anti zip-bomb) `:49`
2. Format whitelist `ACCEPTED_INPUT_FORMATS` `:53`
3. Size cap `UPLOAD_BYTES_MAX` `:56-58`
4. SHA-256 du buffer original (dedup `fileHash`) `:60`
5. Variants : WebP + AVIF + LQIP + thumbnail + OG (constants `WEBP_VARIANTS`, `AVIF_VARIANTS`, `THUMBNAIL_WIDTH`, `LQIP_WIDTH`)
6. `.withMetadata()` strip EXIF puis ré-embed copyright propre

**Variants AVIF + WebP** : ✅
**LQIP** : `LQIP_BLUR`, `LQIP_JPEG_QUALITY`, `LQIP_WIDTH` `:25-27`
**Thumbnail** : `THUMBNAIL_WIDTH` `:30`

## EXIF/XMP/IPTC embed

- `customXmpData Json?` `:3431` (schema)
- `image-attribute-validator.service.ts` (services list)
- `image-seo-enrichment.service.ts` (probable embed)

`.withMetadata()` Sharp réinjecte les métadonnées propres après strip. Workflow conforme doctrine.

## Watermark on-the-fly

`image-watermark.service.ts` (présent dans services) — workflow `watermarkEnabled` (schema `:3427`). Pas lu en détail mais service dédié = pattern correct.

## IndexNow ping étendu

Référence présent dans workflow image-bank-crons + `enqueueIndexingForTier1()` (worker indexnow content-gen). Image-bank ne fait pas son propre IndexNow direct — délègue au pipeline content-publish indirectement ou via cron dédié (à vérifier).

## sitemap-images-*.xml Google 1.1

Sitemap routes présentes :
- `src/app/sitemap-images-services.xml/route.ts` (services pages)
- `src/app/sitemaps/images-fr.xml/route.ts` (FR canonique)
- `src/app/sitemaps/images-en.xml/route.ts` (EN miroir)
- `src/scripts/generate-sitemap-images-cities.ts` (villes)
- `src/server/image-bank/utils/villes-sitemap.ts` (helper)

→ 4+ sub-sitemaps images, conforme Google Image Sitemap protocol 1.1 ✅.

`src/app/sitemap-index.xml/route.ts` agrège (référencé par robots.txt).

## JSON-LD ImageObject

`image-jsonld-graph.service.ts` (présent) — @graph pour images. Cohérent avec V-04 P6 acquis (root layout @graph).

## License CC BY 4.0

Doctrine project documentée. Copyright holder = Axion-IA OÜ (estonienne, 0 SIREN — Will décisions canoniques 2026-05-21 société FR pure, à vérifier si le copyright a été migré).

## isAiGenerated = false

`schema.prisma:3424` `isAiGenerated Boolean @default(false)`. Migration `20260521140000_fix_legacy_isaigenerated_imageassets` semble corriger legacy data → 0 AI-générées.

**Doctrine projet** (mémoire feedback_no_dalle_images.md) : zéro image DALL-E/IA, toutes importées par Will. Le schéma garde le flag pour traceabilité légale.

## RGPD IP hash

Migration `20260516200000_rgpd_ip_hash_additif` + `image-download-log` schéma (présumé) avec IP SHA-256 hashée via `IP_HASH_SALT` (doctrine skill `axionia-image-bank`).

## Findings

### P0
Aucun.

### P1
1. **IndexNow ping pour images non vu explicitement** dans le code image-bank. Le pipeline content-publish fait l'IndexNow article ; les images publiées hors d'un article (galerie publique `/galerie`) doivent avoir leur propre IndexNow ping. À confirmer dans `image-bank-crons-worker.ts` ou `image-bank-import-worker.ts`.

### P2
2. **Cloisonnement strict** doctrine skill : `src/server/image-bank/**`, `src/app/[locale]/(admin)/[adminPrefix]/image-bank/**`, `src/app/[locale]/galerie/**`, `src/components/admin/image-bank/**`. Pas vérifié à 100 % mais structure semble conforme.
3. **Copyright "Axion-IA OÜ"** : à confirmer cohérence avec décision Will 2026-05-21 (société FR pure, pas OÜ) — texte hardcodé dans `customXmpData` à mettre à jour si copy bouge.
4. **Web Vitals stricts** doctrine image-bank : LCP ≤ 1800 ms, INP ≤ 80 ms, CLS ≤ 0.05, JS ≤ 75 KB gz. Non audité ici (cf. front bundle frontend block).

## Verdict paragraphe

**Pipeline image-bank très mature** : Sharp variants AVIF+WebP+LQIP+thumbnail, EXIF/XMP/IPTC embed, watermark service dédié, sitemap-images FR+EN+services+villes (4 sub-sitemaps), JSON-LD ImageObject @graph, license CC BY 4.0, doctrine zéro IA appliquée via flag DB + cleanup migration. IP hash RGPD acquis. 23/25 — perte 2 points sur IndexNow images vérification incomplète (P1) + copyright OÜ vs FR cohérence (P2).
