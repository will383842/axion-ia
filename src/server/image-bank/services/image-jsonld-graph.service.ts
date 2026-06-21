/**
 * image-jsonld-graph.service.ts — GAP-12 perfection 2026
 *
 * Construit le JSON-LD `@graph` chained sur chaque page image-bank :
 *   - Organization (Axion-IA)
 *   - WebSite (search action)
 *   - WebPage (mainEntity = image)
 *   - BreadcrumbList
 *   - ImageObject (la pièce maîtresse, §6 prompt v1.1)
 *   - Subject (Service | Course | Event | Article — selon module métier)
 *
 * Émet UN SEUL <script type="application/ld+json"> avec @graph racine.
 * Pas de scripts JSON-LD isolés multiples.
 *
 * @see axionia/_AUDIT/PROMPT-IMAGE-BANK-AUDIT-AUTOPILOT-2026.md §2.6 + §6
 */

import type { ImageAsset, ImageAssetTranslation } from "../../../../prisma/generated/client";
import { buildImageObjectJsonLd } from "./image-seo.service";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";

const SITE_NAME = "Axion-IA";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://axion-ia.com";
const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

// ──────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────

type SchemaOrgNode = Record<string, unknown> & { "@type": string; "@id"?: string };

export type ImageDetailGraphArgs = {
  image: ImageAsset;
  translation: ImageAssetTranslation;
  locale: "fr" | "en";
  cdnUrl: string;
  pageUrl: string;
  breadcrumb: { name: string; url: string }[];
  // Wikidata Q-id (optionnel, cf. inputs-will-required B7)
  wikidataQid?: string;
};

export type GalleryHubGraphArgs = {
  locale: "fr" | "en";
  pageUrl: string;
  hubModule?: "interventions" | "audits" | "implementations" | null;
  totalImages: number;
  images: Pick<ImageAsset, "id" | "slug" | "width" | "height">[];
  breadcrumb: { name: string; url: string }[];
};

// ──────────────────────────────────────────────────────────
// Building blocks (per node)
// ──────────────────────────────────────────────────────────

function buildOrganization(args: { wikidataQid?: string; inLanguage: string }): SchemaOrgNode {
  // LinkedIn vanity URL utilise le slug officiel `axion-ia` (avec tiret).
  // X/Twitter ne supportant pas les tirets dans les handles, on conserve
  // la graphie camelCase `AxionIA` — exception documentée vs doctrine
  // brand "Axion-IA" (cf. mémoire axionia_naming_brand_vs_project 2026-05-08).
  // STOP & ASK : si le handle X officiel devient `@axionia` ou `@axion_ia`,
  // mettre à jour ici + dans image-seo-enrichment.service.ts User-Agent.
  const sameAs: string[] = ["https://www.linkedin.com/company/axion-ia", "https://x.com/AxionIA"];
  if (args.wikidataQid) sameAs.push(`https://www.wikidata.org/wiki/${args.wikidataQid}`);

  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE_NAME,
    legalName: "Axion-IA SAS",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/logo.png`,
      width: 512,
      height: 512,
    },
    description:
      args.inLanguage === "fr-FR"
        ? "Cabinet IA opérationnel B2B — audits, interventions, implémentations Claude pour PME et ETI."
        : "Operational AI consultancy B2B — audits, interventions, AI implementations for SMEs and mid-market companies.",
    sameAs,
    foundingDate: "2024",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "contact@axion-ia.com",
      areaServed: "FR",
      availableLanguage: ["fr-FR", "en-US"],
    },
    knowsAbout: [
      "Intelligence Artificielle",
      "Audit IA",
      "Claude Anthropic",
      "Operational AI consulting",
      "Automatisation no-code",
      "ChatGPT enterprise",
    ],
    areaServed: { "@type": "Country", name: "France" },
    address: {
      "@type": "PostalAddress",
      addressCountry: "FR",
      addressLocality: "Paris",
    },
  };
}

function buildWebSite(args: { inLanguage: string }): SchemaOrgNode {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { "@id": ORG_ID },
    inLanguage: ["fr-FR", "en-US"],
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/${args.inLanguage === "fr-FR" ? "fr" : "en"}/recherche?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

function buildWebPage(args: {
  pageUrl: string;
  pageName: string;
  pageDescription: string;
  inLanguage: string;
  imageId: string;
  breadcrumbId: string;
  datePublished?: Date | null;
  dateModified?: Date | null;
}): SchemaOrgNode {
  return {
    "@type": "WebPage",
    "@id": `${args.pageUrl}#webpage`,
    url: args.pageUrl,
    name: args.pageName,
    description: args.pageDescription,
    isPartOf: { "@id": WEBSITE_ID },
    primaryImageOfPage: { "@id": args.imageId },
    inLanguage: args.inLanguage,
    breadcrumb: { "@id": args.breadcrumbId },
    mainEntity: { "@id": args.imageId },
    // E-E-A-T : autorité + éditeur rattachés à l'entité Organization canonique
    // (`/#organization`) → consolide le graphe et la confiance (qui publie ?).
    author: { "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    // Speakable au niveau WebPage (cible privilégiée de Google pour la voix /
    // AEO) — selectors alignés sur le DOM réel de la page détail.
    speakable: buildSpeakableSpecification({
      selectors: ["h1", "figcaption", ".image-description", ".image-about"],
    }),
    ...(args.datePublished ? { datePublished: args.datePublished.toISOString() } : {}),
    ...(args.dateModified ? { dateModified: args.dateModified.toISOString() } : {}),
  };
}

function buildBreadcrumb(args: {
  pageUrl: string;
  items: { name: string; url: string }[];
}): SchemaOrgNode {
  return {
    "@type": "BreadcrumbList",
    "@id": `${args.pageUrl}#breadcrumb`,
    itemListElement: args.items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

function buildSubjectEntity(args: {
  image: ImageAsset;
  translation: ImageAssetTranslation;
  pageUrl: string;
  inLanguage: string;
}): SchemaOrgNode | null {
  const subjectType = args.image.subjectOfType ?? "Service";
  const subjectUrl = args.image.subjectOfUrl;
  if (!subjectUrl) return null;

  const baseEntity = {
    "@id": `${subjectUrl}#${subjectType.toLowerCase()}`,
    name: args.translation.title ?? "",
    description: args.translation.aiSummary ?? args.translation.caption ?? "",
    url: subjectUrl,
    inLanguage: args.inLanguage,
    image: { "@id": `${args.pageUrl}#image` },
  };

  switch (subjectType) {
    case "Service":
      return {
        "@type": "Service",
        ...baseEntity,
        serviceType:
          args.image.module === "audits"
            ? "AI audit"
            : args.image.module === "implementations"
              ? "AI implementation"
              : "AI intervention",
        provider: { "@id": ORG_ID },
        areaServed: args.image.targetCity
          ? { "@type": "City", name: args.image.targetCity }
          : { "@type": "Country", name: "France" },
      };

    case "Course":
      return {
        "@type": "Course",
        ...baseEntity,
        provider: { "@id": ORG_ID },
        offers: {
          "@type": "Offer",
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
        },
      };

    case "Event":
      return {
        "@type": "Event",
        ...baseEntity,
        organizer: { "@id": ORG_ID },
        location: args.image.targetCity
          ? { "@type": "Place", name: args.image.targetCity }
          : { "@type": "VirtualLocation", name: "Online" },
        eventAttendanceMode: "https://schema.org/MixedEventAttendanceMode",
      };

    case "Article":
    default:
      return {
        "@type": "Article",
        ...baseEntity,
        author: { "@id": ORG_ID },
        publisher: { "@id": ORG_ID },
      };
  }
}

// ──────────────────────────────────────────────────────────
// Graphs publics
// ──────────────────────────────────────────────────────────

/**
 * Page détail image `/[locale]/galerie/[slug]` — @graph 6 entités.
 */
export function buildImageDetailGraph(args: ImageDetailGraphArgs): {
  "@context": string;
  "@graph": SchemaOrgNode[];
} {
  const inLanguage = args.locale === "fr" ? "fr-FR" : "en-US";

  const imageObject = buildImageObjectJsonLd({
    image: args.image,
    translation: args.translation,
    locale: args.locale,
    cdnUrl: args.cdnUrl,
    pageUrl: args.pageUrl,
  });

  const nodes: SchemaOrgNode[] = [
    buildOrganization({
      ...(args.wikidataQid ? { wikidataQid: args.wikidataQid } : {}),
      inLanguage,
    }),
    buildWebSite({ inLanguage }),
    buildWebPage({
      pageUrl: args.pageUrl,
      pageName: args.translation.metaTitle ?? args.translation.title ?? "",
      pageDescription: args.translation.metaDescription ?? args.translation.caption ?? "",
      inLanguage,
      imageId: `${args.pageUrl}#image`,
      breadcrumbId: `${args.pageUrl}#breadcrumb`,
      datePublished: args.image.publishedAt,
      dateModified: args.image.updatedAt,
    }),
    buildBreadcrumb({ pageUrl: args.pageUrl, items: args.breadcrumb }),
    imageObject as unknown as SchemaOrgNode,
  ];

  const subject = buildSubjectEntity({
    image: args.image,
    translation: args.translation,
    pageUrl: args.pageUrl,
    inLanguage,
  });
  if (subject) nodes.push(subject);

  return {
    "@context": "https://schema.org",
    "@graph": nodes,
  };
}

/**
 * Page hub `/[locale]/galerie/{module}/` — @graph CollectionPage + ItemList.
 */
export function buildGalleryHubGraph(args: GalleryHubGraphArgs): {
  "@context": string;
  "@graph": SchemaOrgNode[];
} {
  const inLanguage = args.locale === "fr" ? "fr-FR" : "en-US";

  const itemListElement = args.images.slice(0, 24).map((img, idx) => ({
    "@type": "ListItem",
    position: idx + 1,
    item: {
      "@type": "ImageObject",
      "@id": `${SITE_URL}/${args.locale}/galerie/${img.slug}#image`,
      url: `${SITE_URL}/${args.locale}/galerie/${img.slug}`,
      // P0 2026-06-14 — Fix : l'ancien `/image-bank/{id}/image-md.webp` renvoyait
      // 404 (variant non servie) → Google Images recevait des contentUrl mortes.
      // On aligne sur l'URL publique servie en 200 (idem détail + sitemap-images).
      contentUrl: `${SITE_URL}/images/${img.slug}.webp`,
      width: img.width,
      height: img.height,
    },
  }));

  const moduleLabel =
    args.hubModule === "audits"
      ? args.locale === "fr"
        ? "Audits IA"
        : "AI Audits"
      : args.hubModule === "implementations"
        ? args.locale === "fr"
          ? "Implémentations IA"
          : "AI Implementations"
        : args.hubModule === "interventions"
          ? args.locale === "fr"
            ? "Interventions & Formations"
            : "Interventions & Training"
          : args.locale === "fr"
            ? "Banque d'images"
            : "Image bank";

  return {
    "@context": "https://schema.org",
    "@graph": [
      buildOrganization({ inLanguage }),
      buildWebSite({ inLanguage }),
      buildWebPage({
        pageUrl: args.pageUrl,
        pageName: moduleLabel,
        pageDescription:
          args.locale === "fr"
            ? `Banque d'images ${moduleLabel} d'Axion-IA — ${args.totalImages} images sous licence CC BY 4.0.`
            : `${moduleLabel} image bank by Axion-IA — ${args.totalImages} CC BY 4.0 licensed images.`,
        inLanguage,
        imageId: `${args.pageUrl}#collection`,
        breadcrumbId: `${args.pageUrl}#breadcrumb`,
      }),
      buildBreadcrumb({ pageUrl: args.pageUrl, items: args.breadcrumb }),
      {
        "@type": "CollectionPage",
        "@id": `${args.pageUrl}#collection`,
        url: args.pageUrl,
        name: moduleLabel,
        inLanguage,
        about: args.hubModule
          ? {
              "@type": "Service",
              "@id": `${SITE_URL}/${args.locale}/${args.hubModule}#service`,
              name: moduleLabel,
              provider: { "@id": ORG_ID },
            }
          : { "@id": ORG_ID },
        mainEntity: { "@id": `${args.pageUrl}#itemlist` },
      },
      {
        "@type": "ItemList",
        "@id": `${args.pageUrl}#itemlist`,
        numberOfItems: args.totalImages,
        itemListElement,
      },
    ],
  };
}
