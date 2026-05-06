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
