import type { Metadata } from "next";
import { Manrope, Inconsolata, Fraunces } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { SkipToContent } from "@/components/a11y/SkipToContent";
import { Header } from "@/components/nav/Header";
import { Footer } from "@/components/nav/Footer";
import { WebVitals } from "@/components/analytics/WebVitals";
import "../globals.css";

// Manrope = open-source substitute for proprietary WF Visual Sans Variable
// (Webflow). ADR 0001-design-direction-webflow.md.
// Trimmed to 2 weights (regular + semibold) — covers body, eyebrow, h1-h6.
// Saves ~50 KB woff2 vs the previous 4-weight load (cf. PERF-005).
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
  weight: ["400", "600"],
});

const inconsolata = Inconsolata({
  subsets: ["latin"],
  variable: "--font-inconsolata",
  display: "swap",
});

// Fraunces = serif éditorial premium (style Anthropic/Mistral). Variable axes
// `opsz` (optical size) + `SOFT` activés pour rendu raffiné aux grandes tailles.
// Loaded latin only, italic for emphasis on display headings.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

const SITE_URL = process.env["NEXT_PUBLIC_SITE_URL"] ?? "https://axion-ia.com";

// Pre-render every supported locale at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: Pick<LocaleLayoutProps, "params">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: isFr ? "AxionIA — Cabinet IA opérationnel" : "AxionIA — Operational AI consultancy",
      template: "%s · AxionIA",
    },
    description: isFr
      ? "Cabinet IA opérationnel · interventions, audit et implémentation IA pour entreprises."
      : "Operational AI consultancy · on-site AI sessions, audits and implementation for companies.",
    alternates: {
      canonical: `/${locale}`,
      languages: {
        fr: "/fr",
        en: "/en",
        "x-default": "/fr",
      },
    },
    openGraph: {
      type: "website",
      locale: isFr ? "fr_FR" : "en_US",
      url: `${SITE_URL}/${locale}`,
      siteName: "AxionIA",
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Required so Server Components can use `getTranslations()` synchronously.
  setRequestLocale(locale);
  const messages = await getMessages();

  // JSON-LD: Organization + WebSite (axionia-seo-aeo).
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AxionIA",
    url: SITE_URL,
    legalName: "AxionIA OÜ",
  } as const;
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AxionIA",
    url: `${SITE_URL}/${locale}`,
    inLanguage: locale,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/${locale}/recherche?q={query}`,
      "query-input": "required name=query",
    },
  } as const;

  return (
    <html
      lang={locale}
      dir="ltr"
      className={`${manrope.variable} ${inconsolata.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="bg-bg text-fg flex min-h-full flex-col font-sans">
        <SkipToContent />
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </NextIntlClientProvider>
        <WebVitals />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {/* Speculation Rules — eager prefetch + moderate prerender on hover/
            viewport. PERF-010/NAV-015. Browsers without support ignore the
            script silently (Safari fallback ↔ Chrome/Edge gain).
            Production-only: in `next dev`, eager prefetching saturates the
            single dev server (Turbopack recompiles each route) and stalls
            the user's actual click behind speculative requests. */}
        {process.env.NODE_ENV === "production" && (
          <script
            type="speculationrules"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                prerender: [
                  {
                    source: "document",
                    where: { href_matches: `/${locale}/*` },
                    eagerness: "moderate",
                  },
                ],
                prefetch: [
                  {
                    source: "document",
                    where: { href_matches: `/${locale}/*` },
                    eagerness: "eager",
                  },
                ],
              }),
            }}
          />
        )}
      </body>
    </html>
  );
}
