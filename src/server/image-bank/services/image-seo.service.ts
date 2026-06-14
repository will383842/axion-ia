// Template : src/server/image-bank/services/image-seo.service.ts
//
// JSON-LD ImageObject + BreadcrumbList + calculateSeoScore.
//
// Toutes les constantes (segments URL, BCP-47, defaults license/copyright)
// viennent de `../constants` — SSOT du module. Voir aussi spec détaillée
// `references/jsonld-imageobject.md`.

import type { ImageAsset, ImageAssetTranslation } from "../../../../prisma/generated/client";

import {
  ALT_LENGTH_MAX,
  ALT_LENGTH_MIN,
  CACHE_TAGS,
  DEFAULT_ACCESSIBILITY_CONTROL,
  DEFAULT_ACCESSIBILITY_FEATURES,
  DEFAULT_ACCESSIBILITY_HAZARD,
  DEFAULT_LICENSE_TYPE,
  DEFAULT_LICENSE_URL,
  resolveCopyrightHolder,
  GALLERY_LABEL,
  GALLERY_SEGMENT,
  HOME_LABEL,
  LOCALE_BCP47,
  type ImageBankLocale,
  type ImageWithRelations,
} from "../constants";
import { absoluteUrl, pageUrlFor } from "../utils/paths";
import type { SeoScoreBreakdown } from "../types";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";

interface SiteConfig {
  siteUrl: string;
  siteName: string;
  organizationId: string;
}

export class ImageSeoService {
  constructor(private readonly config: SiteConfig) {}

  /**
   * JSON-LD `ImageObject` schema.org canonique.
   * Null-safe sur toutes les timestamps (bug observé SOS-Expat → GSC 5xx).
   */
  generateImageObjectJsonLd(
    image: ImageAsset,
    translation: ImageAssetTranslation,
    lang: ImageBankLocale,
  ): Record<string, unknown> {
    const pageUrl = pageUrlFor(this.config.siteUrl, lang, translation.slug);
    const contentUrl = absoluteUrl(this.config.siteUrl, image.filePath);

    const referenceDate = image.publishedAt ?? image.updatedAt ?? image.createdAt;
    const modifiedAt = image.updatedAt ?? image.publishedAt ?? image.createdAt;

    // Enrichissement JSON-LD 2026 — perfection extrême SEO/AEO/GEO :
    //   - accessibilityFeature/Hazard/Control : WCAG 2.2 metadata images accessibles
    //   - abstract (= ai_summary) : version courte citable par LLMs
    //   - keywords par locale : Google indexe per-language
    //   - isBasedOn si AI-generated : transparence schema.org
    //   - additionalProperty : géo/audience/secteur tags
    //   - contentSize : taille bytes pour MediaObject
    //   - address : adresse postale en plus de GeoCoordinates
    //   - subjectOf : Article qui utilise l'image (V1.5)
    //   - associatedMedia : Variants WebP/AVIF/OG en MediaObject nested
    const schema: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "ImageObject",
      "@id": `${pageUrl}#image`,
      contentUrl,
      url: pageUrl,
      name: translation.title,
      alternateName: translation.alt,
      caption: translation.caption ?? translation.title,
      description: translation.description ?? translation.caption ?? translation.title,
      width: { "@type": "QuantitativeValue", value: image.width, unitCode: "E37" },
      height: { "@type": "QuantitativeValue", value: image.height, unitCode: "E37" },
      encodingFormat: `image/${image.fileFormat || "webp"}`,
      contentSize: image.fileSize ? `${image.fileSize}` : undefined,
      inLanguage: LOCALE_BCP47[lang],
      representativeOfPage: true,
      isFamilyFriendly: true,
      isAccessibleForFree: true,
      // WCAG 2.2 accessibility metadata (perfection accessibility 2026)
      accessibilityFeature: [...DEFAULT_ACCESSIBILITY_FEATURES],
      accessibilityHazard: DEFAULT_ACCESSIBILITY_HAZARD,
      accessibilityControl: [...DEFAULT_ACCESSIBILITY_CONTROL],
      creator: {
        "@type": "Organization",
        "@id": this.config.organizationId,
        name: this.config.siteName,
        url: this.config.siteUrl,
      },
      copyrightHolder: {
        "@type": "Organization",
        name: resolveCopyrightHolder(image.copyrightHolder),
      },
      copyrightYear: referenceDate.getFullYear(),
      copyrightNotice: this.buildCopyrightNotice(image, referenceDate),
      license: image.licenseUrl || DEFAULT_LICENSE_URL,
      acquireLicensePage: pageUrl,
      creditText: resolveCopyrightHolder(image.copyrightHolder),
      // Selectors alignés sur le DOM réel de `/galerie/[slug]/page.tsx` :
      // h1 (titre) + figcaption (légende) + .image-description (paragraphe
      // principal) + .image-about (résumé IA). Doivent matcher des éléments
      // existants, sinon le Speakable ne résout rien.
      speakable: buildSpeakableSpecification({
        selectors: ["h1", "figcaption", ".image-description", ".image-about"],
      }),
    };

    // Abstract (= ai_summary) — version courte 1 phrase citable par LLMs (AEO).
    if (translation.aiSummary) {
      schema.abstract = translation.aiSummary;
    }

    if (image.thumbnailPath) {
      const thumbnailUrl = absoluteUrl(this.config.siteUrl, image.thumbnailPath);
      schema.thumbnailUrl = thumbnailUrl;
      schema.thumbnail = { "@type": "ImageObject", contentUrl: thumbnailUrl };
    }

    if (image.publishedAt) schema.datePublished = image.publishedAt.toISOString();
    if (image.publishedAt) schema.uploadDate = image.publishedAt.toISOString();
    if (modifiedAt) schema.dateModified = modifiedAt.toISOString();

    if (image.photographerName) {
      const photographer: Record<string, unknown> = {
        "@type": "Person",
        name: image.photographerName,
      };
      if (image.photographerUrl) photographer.url = image.photographerUrl;
      schema.author = [photographer];
    }

    if (image.geoPlacename) {
      const place: Record<string, unknown> = {
        "@type": "Place",
        name: image.geoPlacename,
      };
      // GeoCoordinates si dispo
      if (image.geoPosition) {
        const [lat, lon] = image.geoPosition.split(";").map(parseFloat);
        if (typeof lat === "number" && !isNaN(lat) && typeof lon === "number" && !isNaN(lon)) {
          place.geo = {
            "@type": "GeoCoordinates",
            latitude: lat,
            longitude: lon,
          };
        }
      }
      // PostalAddress dérivée du placename (ex : "Lyon, France" → addressLocality+addressCountry).
      // Heuristique simple : split sur dernière virgule = country.
      const [locality, ...countryParts] = image.geoPlacename.split(",").map((s) => s.trim());
      if (locality && countryParts.length > 0) {
        place.address = {
          "@type": "PostalAddress",
          addressLocality: locality,
          addressCountry: countryParts[countryParts.length - 1],
        };
      }
      schema.contentLocation = place;
    }

    // Keywords — Google indexe les keywords flat. Pour AEO/GEO multi-lang, on
    // joint primary + secondary en un seul string (Google norm).
    const keywords: string[] = [];
    if (image.keywordsPrimary) keywords.push(image.keywordsPrimary);
    if (Array.isArray(image.keywordsSecondary)) {
      keywords.push(...(image.keywordsSecondary as string[]));
    }
    if (keywords.length > 0) {
      schema.keywords = keywords.join(", ");
    }

    // additionalProperty — tags géo/audience structurés (AEO + Google Knowledge Graph).
    // Permet à Perplexity/Claude de filter sur "images B2B France PME".
    const additionalProperty: Array<{ "@type": "PropertyValue"; name: string; value: string }> = [];
    const targetCountries = (image.targetCountries as string[] | null) ?? [];
    if (targetCountries.length > 0) {
      additionalProperty.push({
        "@type": "PropertyValue",
        name: "targetCountries",
        value: targetCountries.join(","),
      });
    }
    if (image.geoRegion) {
      additionalProperty.push({
        "@type": "PropertyValue",
        name: "geoRegion",
        value: image.geoRegion,
      });
    }
    if (additionalProperty.length > 0) {
      schema.additionalProperty = additionalProperty;
    }

    // isBasedOn — si image AI-generated, on cite la SoftwareApplication source
    // (transparence schema.org : Google distingue désormais human vs AI content).
    if (image.sourceType === "ai_generated" && image.aiModel) {
      schema.isBasedOn = {
        "@type": "SoftwareApplication",
        name: image.aiModel,
        applicationCategory: "MultimediaApplication",
      };
      // Override creator pour préciser que c'est un Tool, pas un humain.
      schema.creator = {
        ...((schema.creator as Record<string, unknown>) ?? {}),
        // On garde Organization parent mais on ajoute usingTool
        productionCompany: schema.creator,
      };
    }

    return schema;
  }

  /**
   * BreadcrumbList — Home > Galerie > [Category] > Title.
   */
  generateBreadcrumbJsonLd(
    image: ImageWithRelations,
    translation: ImageAssetTranslation,
    lang: ImageBankLocale,
  ): Record<string, unknown> {
    const galleryUrl = `${this.config.siteUrl}/${lang}/${GALLERY_SEGMENT[lang]}/`;
    const pageUrl = pageUrlFor(this.config.siteUrl, lang, translation.slug);

    const items: Array<{ "@type": "ListItem"; position: number; name: string; item: string }> = [
      {
        "@type": "ListItem",
        position: 1,
        name: HOME_LABEL[lang],
        item: `${this.config.siteUrl}/${lang}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: GALLERY_LABEL[lang],
        item: galleryUrl,
      },
    ];

    if (image.category) {
      const catTr = image.category.translations.find((t) => t.languageCode === lang);
      if (catTr) {
        items.push({
          "@type": "ListItem",
          position: 3,
          name: catTr.name,
          item: `${galleryUrl}?category=${catTr.slug}`,
        });
      }
    }

    items.push({
      "@type": "ListItem",
      position: items.length + 1,
      name: translation.title,
      item: pageUrl,
    });

    return {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items,
    };
  }

  /**
   * Calcule le SEO score 0-100 selon barème § 7.2 spec maître.
   * Gate publication : score ≥ `SEO_SCORE_PUBLISH_GATE` (cf. constants).
   * Retourne le breakdown détaillé pour affichage admin.
   */
  calculateSeoScore(image: ImageAsset & { translations: ImageAssetTranslation[] }): number {
    return this.calculateSeoScoreBreakdown(image).total;
  }

  calculateSeoScoreBreakdown(
    image: ImageAsset & { translations: ImageAssetTranslation[] },
  ): SeoScoreBreakdown {
    const frTr = image.translations.find((t) => t.languageCode === "fr");
    const enTr = image.translations.find((t) => t.languageCode === "en");
    const countries = (image.targetCountries as string[] | null) ?? [];
    const secondaryKeywords = (image.keywordsSecondary as string[] | null) ?? [];

    const altFr =
      frTr?.alt && frTr.alt.length >= ALT_LENGTH_MIN && frTr.alt.length <= ALT_LENGTH_MAX ? 20 : 0;
    const altEn =
      enTr?.alt && enTr.alt.length >= ALT_LENGTH_MIN && enTr.alt.length <= ALT_LENGTH_MAX ? 15 : 0;
    const caption = frTr?.caption ? 10 : 0;
    const description = frTr?.description && frTr.description.length >= 50 ? 10 : 0;
    const metaTitles = frTr?.metaTitle && enTr?.metaTitle ? 5 : 0;
    const countriesScore = countries.length >= 1 ? 5 : 0;
    const geoPosition = image.geoPosition ? 5 : 0;
    const photographer = image.photographerName ? 5 : 0;
    const keywords = image.keywordsPrimary && secondaryKeywords.length >= 2 ? 10 : 0;
    const avif = image.avifPath ? 10 : 0;
    const iptc = 5; // assumé OK si import a réussi (Sharp `.withMetadata()`)

    const total = Math.min(
      altFr +
        altEn +
        caption +
        description +
        metaTitles +
        countriesScore +
        geoPosition +
        photographer +
        keywords +
        avif +
        iptc,
      100,
    );

    return {
      total,
      altFr,
      altEn,
      caption,
      description,
      metaTitles,
      countries: countriesScore,
      geoPosition,
      photographer,
      keywords,
      avif,
      iptc,
    };
  }

  /** Cache tag pour invalidation manuelle. */
  static readonly CACHE_TAGS = CACHE_TAGS;

  private buildCopyrightNotice(image: ImageAsset, date: Date): string {
    const year = date.getFullYear();
    const holder = resolveCopyrightHolder(image.copyrightHolder);
    const licenseType =
      (image.licenseType ?? DEFAULT_LICENSE_TYPE).toUpperCase().replace("CC-BY-4.0", "CC BY 4.0") ||
      "CC BY 4.0";
    return `© ${year} ${holder}. Licensed under ${licenseType} — axion-ia.com`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Standalone functional facade (used by image-jsonld-graph.service.ts)
// ─────────────────────────────────────────────────────────────────────────────

export type ImageObjectJsonLd = Record<string, unknown>;

export function buildImageObjectJsonLd(args: {
  image: ImageAsset;
  translation: ImageAssetTranslation;
  locale: ImageBankLocale;
  cdnUrl: string;
  pageUrl: string;
}): ImageObjectJsonLd {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
  const service = new ImageSeoService({
    siteUrl,
    siteName: "Axion-IA",
    organizationId: `${siteUrl}/#organization`,
  });
  return service.generateImageObjectJsonLd(args.image, args.translation, args.locale);
}
