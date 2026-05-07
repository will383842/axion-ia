import type { Metadata } from "next";
import type { Locale } from "@/i18n/routing";

export const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";

interface ProductSeoInput {
  locale: Locale;
  /** Localized pathname WITHOUT locale prefix, e.g. /interventions/essentielle. */
  path: string;
  title: string;
  description: string;
  /** Optional alternate path per-locale; defaults to `path`. */
  alternates?: Partial<Record<Locale, string>>;
}

export function buildProductMetadata({
  locale,
  path,
  title,
  description,
  alternates,
}: ProductSeoInput): Metadata {
  const fr = alternates?.fr ?? path;
  const en = alternates?.en ?? path;
  return {
    title,
    description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: {
        fr: `/fr${fr}`,
        en: `/en${en}`,
        "x-default": `/fr${fr}`,
      },
    },
    openGraph: {
      type: "website",
      locale: locale === "fr" ? "fr_FR" : "en_US",
      url: `${SITE_URL}/${locale}${path}`,
      title,
      description,
      siteName: "AxionIA",
    },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: true, follow: true },
  };
}

interface ServiceJsonLdInput {
  locale: Locale;
  path: string;
  name: string;
  description: string;
  /** Price in EUR HT. Omit for "on-quote" services. */
  priceEur?: number;
  serviceType?: string;
  area?: string;
}

export function buildServiceJsonLd({
  locale,
  path,
  name,
  description,
  priceEur,
  serviceType,
  area,
}: ServiceJsonLdInput) {
  const url = `${SITE_URL}/${locale}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name,
    description,
    url,
    provider: {
      "@type": "Organization",
      name: "AxionIA",
      url: SITE_URL,
    },
    ...(serviceType ? { serviceType } : {}),
    ...(area ? { areaServed: area } : {}),
    ...(typeof priceEur === "number"
      ? {
          offers: {
            "@type": "Offer",
            price: priceEur.toString(),
            priceCurrency: "EUR",
            availability: "https://schema.org/InStock",
            url,
          },
        }
      : {}),
  } as const;
}

interface FaqJsonLdInput {
  items: ReadonlyArray<{ question: string; answer: string }>;
}

export function buildFaqJsonLd({ items }: FaqJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  } as const;
}

interface BreadcrumbJsonLdInput {
  locale: Locale;
  items: ReadonlyArray<{ name: string; href: string }>;
}

export function buildBreadcrumbJsonLd({ locale, items }: BreadcrumbJsonLdInput) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, idx) => ({
      "@type": "ListItem",
      position: idx + 1,
      name: item.name,
      item: `${SITE_URL}/${locale}${item.href === "/" ? "" : item.href}`,
    })),
  } as const;
}

interface OrganizationJsonLdInput {
  locale: Locale;
  /** Override default contact email. Defaults to `presse@axion-ia.com`. */
  contactEmail?: string;
  /** Override default contact type label. Defaults to FR/EN customer service. */
  contactType?: string;
  /** Estonian VAT number, e.g. `EE-XXXXXXXXX`. Will fournit plus tard. */
  vatID?: string;
  /** Estonian commercial registry code (registrikood). Will fournit plus tard. */
  registrikood?: string;
}

// Layout-level Organization JSON-LD — single source of truth for AEO/GEO 2026
// (Claude.ai / Perplexity / SGE / Bing Copilot citations).
//
// Strategy : maximize the number of stable identifying fields so that LLM
// answer engines unambiguously identify "AxionIA" the entity (vs other
// AI consultancies). `sameAs` provides external corroboration, `foundingLocation`
// + `areaServed` ground geography, `contactPoint` makes it actionable.
//
// `vatID` + `identifier (registrikood)` are optional — once Will transmits the
// Estonia legal references, pass them in from the call site without rewriting
// this helper.
export function buildOrganizationJsonLd({
  locale,
  contactEmail = "presse@axion-ia.com",
  contactType,
  vatID,
  registrikood,
}: OrganizationJsonLdInput) {
  const isFr = locale === "fr";
  const resolvedContactType = contactType ?? (isFr ? "Service client" : "Customer service");
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AxionIA",
    legalName: "AxionIA OÜ",
    url: SITE_URL,
    logo: `${SITE_URL}/opengraph-image`,
    description: isFr
      ? "Cabinet IA opérationnel B2B — interventions, audits et implémentation IA pour entreprises."
      : "Operational B2B AI consultancy — on-site AI sessions, audits and implementation for companies.",
    sameAs: ["https://www.linkedin.com/company/axion-ia", "https://www.facebook.com/axionia"],
    foundingDate: "2024",
    foundingLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressCountry: "EE",
        addressLocality: "Tallinn",
      },
    },
    areaServed: ["FR", "EU"],
    knowsLanguage: ["fr", "en"],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: resolvedContactType,
      email: contactEmail,
      availableLanguage: ["French", "English"],
    },
    ...(vatID ? { vatID } : {}),
    ...(registrikood
      ? {
          identifier: {
            "@type": "PropertyValue",
            propertyID: "registrikood",
            value: registrikood,
          },
        }
      : {}),
  } as const;
}

interface WebsiteJsonLdInput {
  locale: Locale;
}

// WebSite JSON-LD with SearchAction — pairs with `/recherche` (FR) / `/search`
// (EN) and gives Google a sitelinks search box on the SERP.
export function buildWebsiteJsonLd({ locale }: WebsiteJsonLdInput) {
  const isFr = locale === "fr";
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AxionIA",
    url: `${SITE_URL}/${locale}`,
    inLanguage: locale,
    description: isFr
      ? "Cabinet IA opérationnel — interventions, audits et implémentation IA."
      : "Operational AI consultancy — on-site sessions, audits and implementation.",
    publisher: {
      "@type": "Organization",
      name: "AxionIA",
      url: SITE_URL,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/${locale}/${isFr ? "recherche" : "search"}?q={query}`,
      },
      "query-input": "required name=query",
    },
  } as const;
}

interface PersonJsonLdInput {
  locale: Locale;
  /** Slug of the person under `/a-propos` or `/blog/auteur/[slug]`. Defaults to "will". */
  slug?: string;
  /** Override default name. */
  name?: string;
  /** Override default jobTitle. */
  jobTitle?: string;
  /** Optional avatar absolute URL. Defaults to OG image. */
  image?: string;
  /** Override default LinkedIn / X profile URLs. */
  sameAs?: ReadonlyArray<string>;
}

// Person JSON-LD — E-E-A-T 2026 signal (Experience-Expertise-Authoritativeness-
// Trust). Critical for AEO/GEO : LLM answer engines need a named human author
// to attribute claims to. Without a Person schema, AxionIA is a faceless
// `Organization` and gets cited less often in answer-mode SERPs.
//
// Used at /a-propos page-level + /blog/auteur/[slug] for blog post bylines.
export function buildPersonJsonLd({
  locale,
  slug = "will",
  name = "Will",
  jobTitle,
  image,
  sameAs = ["https://www.linkedin.com/in/will-axion-ia"],
}: PersonJsonLdInput) {
  const isFr = locale === "fr";
  const resolvedJobTitle =
    jobTitle ?? (isFr ? "Fondateur · lead consultant IA" : "Founder · lead AI consultant");
  const resolvedImage = image ?? `${SITE_URL}/opengraph-image`;
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    jobTitle: resolvedJobTitle,
    url: `${SITE_URL}/${locale}/${isFr ? "a-propos" : "about"}#${slug}`,
    image: resolvedImage,
    sameAs,
    worksFor: {
      "@type": "Organization",
      name: "AxionIA",
      legalName: "AxionIA OÜ",
      url: SITE_URL,
    },
    knowsAbout: [
      isFr ? "Intelligence artificielle opérationnelle" : "Operational AI",
      isFr ? "Audit IA d'entreprise" : "Enterprise AI audits",
      isFr ? "Implémentation IA" : "AI implementation",
      isFr ? "Automatisation processus métier" : "Business process automation",
      "Retrieval-Augmented Generation (RAG)",
      isFr ? "Modèles de langage de grande taille (LLM)" : "Large Language Models (LLM)",
    ],
    knowsLanguage: ["fr", "en"],
  } as const;
}

interface ArticleJsonLdInput {
  locale: Locale;
  /** Path WITHOUT locale prefix, e.g. `/blog/3-quick-wins-2026`. */
  path: string;
  headline: string;
  description: string;
  /** ISO date string. */
  datePublished: string;
  /** ISO date string. Falls back to `datePublished`. */
  dateModified?: string;
  /** Article body (full text) — used for `articleBody` AEO signal. */
  articleBody?: string;
  /** Author slug — defaults to "will". */
  authorSlug?: string;
  /** Author display name — defaults to "Will". */
  authorName?: string;
  /** Image absolute URL. Defaults to OG dynamic. */
  image?: string;
  /** Tags / keywords. */
  keywords?: ReadonlyArray<string>;
  /** Article section (category). */
  articleSection?: string;
  /** Word count for AEO depth signal. */
  wordCount?: number;
}

// Article JSON-LD — full AEO/GEO 2026 spec :
// - `dateModified` distinct from `datePublished` (Google + LLMs valorisent l'écart
//   pour comprendre la fraîcheur ; sans dateModified = signal faible).
// - `author` typed as Person (vs string) → E-E-A-T.
// - `publisher` Organization avec logo (requis Google for AMP-style cards).
// - `image`, `articleBody`, `wordCount`, `keywords`, `articleSection` →
//   richesse maximale pour citations.
// - `mainEntityOfPage` → Google AI Overviews / SGE l'utilise pour ancrer
//   la citation sur l'URL canonique.
export function buildArticleJsonLd({
  locale,
  path,
  headline,
  description,
  datePublished,
  dateModified,
  articleBody,
  authorSlug = "will",
  authorName = "Will",
  image,
  keywords,
  articleSection,
  wordCount,
}: ArticleJsonLdInput) {
  const isFr = locale === "fr";
  const url = `${SITE_URL}/${locale}${path}`;
  const resolvedImage = image ?? `${SITE_URL}/api/og?title=${encodeURIComponent(headline)}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    description,
    image: resolvedImage,
    datePublished,
    dateModified: dateModified ?? datePublished,
    author: {
      "@type": "Person",
      name: authorName,
      url: `${SITE_URL}/${locale}/${isFr ? "a-propos" : "about"}#${authorSlug}`,
    },
    publisher: {
      "@type": "Organization",
      name: "AxionIA",
      legalName: "AxionIA OÜ",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/opengraph-image`,
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    inLanguage: locale,
    ...(articleBody ? { articleBody } : {}),
    ...(keywords && keywords.length ? { keywords: keywords.join(", ") } : {}),
    ...(articleSection ? { articleSection } : {}),
    ...(typeof wordCount === "number" ? { wordCount } : {}),
  } as const;
}

interface FaqSpeakableInput {
  items: ReadonlyArray<{ question: string; answer: string }>;
  /** CSS selector to scope Speakable extraction. Defaults to `[itemprop='text']`. */
  speakableSelector?: string;
}

// FAQPage JSON-LD enriched with `speakable` — Google Assistant + Alexa + Bixby
// + voice-first AI agents read these aloud as answer snippets. AEO 2026 :
// every FAQ section is a potential voice citation node.
//
// Why a separate factory (vs amending `buildFaqJsonLd`) : Speakable adds
// a `speakable` property at the FAQPage level that not every caller wants
// (some FAQs are too long to be spoken). Opt-in only.
export function buildFaqSpeakableJsonLd({
  items,
  speakableSelector = "[itemprop='text']",
}: FaqSpeakableInput) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: [speakableSelector],
    },
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  } as const;
}

interface LocalBusinessJsonLdInput {
  locale: Locale;
  /** Path WITHOUT locale prefix, e.g. `/implantations/ile-de-france/paris`. */
  path: string;
  /** Localised name, e.g. "Cabinet IA opérationnel à Paris". */
  name: string;
  /** Localised description (40-80 words for SGE/Perplexity citation). */
  description: string;
  /** Area served — admin region or city. */
  areaServed: { type: "Place" | "AdministrativeArea" | "City"; name: string };
  /** Optional postal address (city-level pages). */
  address?: { city: string; region?: string; country?: string; postalCode?: string };
  /** Optional geo coordinates. */
  geo?: { latitude: number; longitude: number };
  /** Optional price range (e.g. "€€€"). */
  priceRange?: string;
  /** Optional opening hours (e.g. ["Mo-Fr 09:00-18:00"]). */
  openingHours?: ReadonlyArray<string>;
}

// LocalBusiness JSON-LD — required for «#1 ville/région» strategy.
// Each city/region landing page (Sprint 15) emits this so Google Maps,
// Google AI Overviews local pack, and Apple Maps surface AxionIA as the
// AI consultancy for that geography. Available NOW so Will can wire it
// when he creates the pages.
export function buildLocalBusinessJsonLd({
  locale,
  path,
  name,
  description,
  areaServed,
  address,
  geo,
  priceRange = "€€€",
  openingHours = ["Mo-Fr 09:00-18:00"],
}: LocalBusinessJsonLdInput) {
  const url = `${SITE_URL}/${locale}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name,
    description,
    url,
    image: `${SITE_URL}/opengraph-image`,
    parentOrganization: {
      "@type": "Organization",
      name: "AxionIA",
      legalName: "AxionIA OÜ",
      url: SITE_URL,
    },
    areaServed: {
      "@type": areaServed.type,
      name: areaServed.name,
    },
    knowsLanguage: ["fr", "en"],
    priceRange,
    ...(address
      ? {
          address: {
            "@type": "PostalAddress",
            addressLocality: address.city,
            ...(address.region ? { addressRegion: address.region } : {}),
            ...(address.postalCode ? { postalCode: address.postalCode } : {}),
            addressCountry: address.country ?? "FR",
          },
        }
      : {}),
    ...(geo
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: geo.latitude,
            longitude: geo.longitude,
          },
        }
      : {}),
    ...(openingHours.length ? { openingHoursSpecification: openingHours } : {}),
  } as const;
}

interface PlaceJsonLdInput {
  locale: Locale;
  /** Path WITHOUT locale prefix. */
  path: string;
  name: string;
  geo: { latitude: number; longitude: number };
  /** Parent administrative area (region for a city, country for a region). */
  containedInPlace?: { name: string; url?: string };
  /** Population for differentiation (anti-doorway pages). */
  population?: number;
}

// Place JSON-LD — paired with LocalBusiness for city/region pages. Useful
// for Google Maps + Wikipedia-style entity reconciliation by AI Overviews.
export function buildPlaceJsonLd({
  locale,
  path,
  name,
  geo,
  containedInPlace,
  population,
}: PlaceJsonLdInput) {
  const url = `${SITE_URL}/${locale}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "Place",
    name,
    url,
    geo: {
      "@type": "GeoCoordinates",
      latitude: geo.latitude,
      longitude: geo.longitude,
    },
    ...(containedInPlace
      ? {
          containedInPlace: {
            "@type": "Place",
            name: containedInPlace.name,
            ...(containedInPlace.url ? { url: containedInPlace.url } : {}),
          },
        }
      : {}),
    ...(typeof population === "number"
      ? {
          additionalProperty: {
            "@type": "PropertyValue",
            propertyID: "population",
            value: population,
          },
        }
      : {}),
  } as const;
}

interface ItemListJsonLdInput {
  locale: Locale;
  /** Path WITHOUT locale prefix. */
  path: string;
  /** ItemList name (e.g. "Stack IA AxionIA"). */
  name: string;
  items: ReadonlyArray<{ url: string; name: string; position: number; description?: string }>;
}

// ItemList JSON-LD — used for /stack-ia (catalogue), /implantations (régions),
// region pages (top villes), city listings. AEO/GEO : LLMs use ItemList
// to enumerate options when answering "what AI tools / cities does AxionIA cover?".
export function buildItemListJsonLd({ locale, path, name, items }: ItemListJsonLdInput) {
  const url = `${SITE_URL}/${locale}${path}`;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    url,
    numberOfItems: items.length,
    itemListElement: items.map((item) => ({
      "@type": "ListItem",
      position: item.position,
      name: item.name,
      url: item.url,
      ...(item.description ? { description: item.description } : {}),
    })),
  } as const;
}
