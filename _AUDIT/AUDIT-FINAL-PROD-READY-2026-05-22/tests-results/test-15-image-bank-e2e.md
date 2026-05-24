# Test 15 — Image bank pipeline E2E (code review)

## Date : 2026-05-22

## Structure image-bank

src/server/image-bank/constants.ts
src/server/image-bank/data/service-sitemap-data.ts
src/server/image-bank/services/image-attribute-validator.service.ts
src/server/image-bank/services/image-bank.service.ts
src/server/image-bank/services/image-country-detector.service.ts
src/server/image-bank/services/image-import.service.ts
src/server/image-bank/services/image-jsonld-graph.service.ts
src/server/image-bank/services/image-seo-enrichment.service.ts
src/server/image-bank/services/image-seo.service.ts
src/server/image-bank/services/image-taxonomy-detector.service.ts
src/server/image-bank/services/image-translation.service.ts
src/server/image-bank/services/image-watermark.service.ts
src/server/image-bank/taxonomy.ts
src/server/image-bank/types.ts
src/server/image-bank/utils/paths.ts
src/server/image-bank/utils/pleonasm.ts
src/server/image-bank/utils/slug.ts
src/server/image-bank/utils/villes-sitemap.ts
src/server/image-bank/utils/xml.ts

## Sharp variants AVIF/WebP/LQIP/thumbnail

src/server/image-bank/constants.ts:67:/** WebP variants (sm/md/lg/xl widths). lg = LCP cible. \*/
src/server/image-bank/constants.ts:75:/** AVIF variants (md/lg uniquement V1 — Safari 16.4+ universal). _/
src/server/image-bank/constants.ts:76:export const AVIF_VARIANTS = [
src/server/image-bank/constants.ts:82:export const LQIP_WIDTH = 20;
src/server/image-bank/constants.ts:83:export const LQIP_BLUR = 3;
src/server/image-bank/constants.ts:84:export const LQIP_JPEG_QUALITY = 30;
src/server/image-bank/constants.ts:98:export const AVIF_QUALITY = 55;
src/server/image-bank/constants.ts:99:export const AVIF_EFFORT = 6;
src/server/image-bank/constants.ts:101:/\*\* File size budget LCP (lg WebP). _/
src/server/image-bank/constants.ts:120:/** Préfixe DB pour les chemins de variants (cohérent avec public/). \*/
src/server/image-bank/constants.ts:126:export const VARIANTS_QUEUE_NAME = "image-bank-variants";
src/server/image-bank/constants.ts:127:/** Queue de conversion slug-based PNG/JPG → WebP/AVIF (public/images/). _/
src/server/image-bank/services/image-bank.service.ts:33: thumbnailPath?: string;
src/server/image-bank/services/image-import.service.ts:3:// Sharp pipeline : original → variants WebP + AVIF + LQIP + thumbnail.
src/server/image-bank/services/image-import.service.ts:12:// Voir spec détaillée : `references/responsive-variants.md`.
src/server/image-bank/services/image-import.service.ts:22: AVIF_EFFORT,
src/server/image-bank/services/image-import.service.ts:23: AVIF_QUALITY,
src/server/image-bank/services/image-import.service.ts:24: AVIF_VARIANTS,
src/server/image-bank/services/image-import.service.ts:25: LQIP_BLUR,
src/server/image-bank/services/image-import.service.ts:26: LQIP_JPEG_QUALITY,
src/server/image-bank/services/image-import.service.ts:27: LQIP_WIDTH,
src/server/image-bank/services/image-import.service.ts:44: _ Pipeline complet : validation → SHA-256 → variants → LQIP → return paths.
src/server/image-bank/services/image-import.service.ts:74: // sur tous les variants via `withMetadata({ orientation: 1 })` qui re-écrit
src/server/image-bank/services/image-import.service.ts:83: // 4) Variants WebP — boucle sm/md/lg/xl (skip si > source width)
src/server/image-bank/services/image-import.service.ts:109: // 6) AVIF — md/lg (qualité 55 = visuellement équivalent à WebP 80, mais plus léger)
src/server/image-bank/services/image-import.service.ts:111: for (const v of AVIF_VARIANTS) {
src/server/image-bank/services/image-import.service.ts:116: .avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT })
src/server/image-bank/services/image-import.service.ts:125: // `og.webp` à côté des autres variants pour servir `og:image` direct.
src/server/image-bank/services/image-import.service.ts:138: // 7) LQIP : 20w blur jpeg base64 (≤ 1 KB inline)
src/server/image-bank/services/image-import.service.ts:140: .resize({ width: LQIP_WIDTH, withoutEnlargement: true })

## EXIF/XMP/IPTC embed

src/server/image-bank/services/image-seo.service.ts:295: const iptc = 5; // assumé OK si import a réussi (Sharp `.withMetadata()`)
src/server/image-bank/services/image-seo.service.ts:308: iptc,
src/server/image-bank/services/image-seo.service.ts:324: iptc,
src/server/image-bank/types.ts:128: iptc: number;

## Watermark on-the-fly

src/server/image-bank/constants.ts:30:/** Segment URL téléchargement watermarké par locale. \*/
src/server/image-bank/constants.ts:170:/** `--color-mocha` (Design.md v3) — couleur watermark fixe. _/
src/server/image-bank/constants.ts:178:/\*\* Download watermark rate-limit. _/
src/server/image-bank/services/image-watermark.service.ts:1:// Template : src/server/image-bank/services/image-watermark.service.ts
src/server/image-bank/services/image-watermark.service.ts:27: _ Applique un watermark texte SVG sur l'image source.
src/server/image-bank/services/image-watermark.service.ts:35: throw new Error("[image-watermark] Image sans dimensions");
src/server/image-bank/utils/paths.ts:51:/\*\* URL absolue du téléchargement watermarké. _/

## License CC BY 4.0 default

src/server/image-bank/constants.ts:54:export const DEFAULT\*LICENSE_TYPE = "cc-by-4.0";
src/server/image-bank/constants.ts:58:/\*\* Credit text (CC BY 4.0 attribution short form). \_/
src/server/image-bank/constants.ts:174:export const WATERMARK_DEFAULT_TEXT_FN = (year: number) => `© ${year} Axion-IA — CC BY 4.0`;
src/server/image-bank/services/image-jsonld-graph.service.ts:343: ? `Banque d'images ${moduleLabel} d'Axion-IA — ${args.totalImages} images sous licence CC BY 4.0.`
src/server/image-bank/services/image-jsonld-graph.service.ts:344: : `${moduleLabel} image bank by Axion-IA — ${args.totalImages} CC BY 4.0 licensed images.`,
src/server/image-bank/services/image-seo.service.ts:335: (image.licenseType ?? DEFAULT_LICENSE_TYPE).toUpperCase().replace("CC-BY-4.0", "CC BY 4.0") ||
src/server/image-bank/services/image-seo.service.ts:336: "CC BY 4.0";
src/server/image-bank/utils/villes-sitemap.ts:96: <!-- CC BY 4.0 — © 2026 Axion-IA -->
prisma/schema.prisma:3313:// - License par défaut CC BY 4.0 (enum éditable admin)
prisma/schema.prisma:3383: // License (CC BY 4.0 par défaut)
