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
