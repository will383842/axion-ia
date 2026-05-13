import type { Metadata, Viewport } from "next";
import { Manrope, Inconsolata, Fraunces } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { SkipToContent } from "@/components/a11y/SkipToContent";
import { Header } from "@/components/nav/Header";
import { Footer } from "@/components/nav/Footer";
import { WebVitals } from "@/components/analytics/WebVitals";
import { Plausible } from "@/components/analytics/Plausible";
import { Clarity } from "@/components/analytics/Clarity";
import { SITE_URL, buildOrganizationJsonLd, buildWebsiteJsonLd } from "@/lib/seo";
import { env } from "@/env";
import type { Locale } from "@/i18n/routing";
import "../globals.css";

// Manrope — sans-serif éditorial pour body / eyebrow / h1-h6.
// Doctrine v3 Editorial Premium Light : ADR 0002 (pivot v3) + ADR 0004
// (typo baseline 18/15 v3.1). Trimmed à 2 weights (400 + 600) — couvre
// l'ensemble des usages, économise ~50 KB woff2 vs un chargement 4-weights.
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

// Fraunces = serif éditorial premium (style Anthropic/Mistral).
// Loaded latin only, italic for emphasis on display headings.
//
// P-105 — la `variable` next/font expose désormais `--font-fraunces` (et non
// plus `--font-serif`). Raison : `globals.css` exposait `--font-serif:
// var(--font-serif), …` ce qui auto-référençait la variable et empêchait la
// cascade des fallbacks intermédiaires. Le renommage casse l'auto-ref :
// next/font écrit `--font-fraunces` puis globals.css chaîne via
// `--font-serif: var(--font-fraunces), "Iowan Old Style", …`.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

// Pre-render every supported locale at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

// Viewport SSOT — audit perfection SEO 2026-05-12. Next 16 sépare
// `viewport` (size, colors, scale) de `metadata` (title, OG, etc.). Déclaré
// au root layout pour s'appliquer à toutes pages :
//   - themeColor : signature visuelle terracotta sur iOS Safari status bar +
//     Chrome Android URL bar + PWA splash. Doit matcher --color-terracotta
//     défini dans globals.css. Next exige une string littérale ici (pas de
//     CSS var possible), donc le hex est duppliqué intentionnellement.
//   - colorScheme "light" : Axion-IA est light-only (charte ivoire/sand) — on
//     bloque le dark auto pour préserver l'identité éditoriale
//   - width device-width + initialScale 1 : mobile-first standard
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#c24a1b", // hex-ok: signature terracotta SSOT, dupliquée de globals.css --color-terracotta
  colorScheme: "light",
};

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
      default: isFr
        ? "Axion-IA — Cabinet IA opérationnel"
        : "Axion-IA — Operational AI consultancy",
      template: "%s · Axion-IA",
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
      siteName: "Axion-IA",
    },
    twitter: { card: "summary_large_image" },
    robots: { index: true, follow: true },
    // D3 cert 2026-05-08 — verification meta GSC + Bing Webmaster Tools.
    // En prod 2026-05-13 : GSC vérifié par DNS TXT, Bing par Import OAuth GSC
    // → ces meta restent ici en fallback si on bascule en méthode meta tag.
    // Build conditionnel : meta absente si env vars non définies (dev/preview).
    ...(env.GOOGLE_SITE_VERIFICATION || env.BING_SITE_VERIFICATION
      ? {
          verification: {
            ...(env.GOOGLE_SITE_VERIFICATION ? { google: env.GOOGLE_SITE_VERIFICATION } : {}),
            ...(env.BING_SITE_VERIFICATION
              ? { other: { "msvalidate.01": env.BING_SITE_VERIFICATION } }
              : {}),
          },
        }
      : {}),
  };
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Required so Server Components can use `getTranslations()` synchronously.
  setRequestLocale(locale);
  const messages = await getMessages();

  // JSON-LD: Organization + WebSite (axionia-seo-aeo). Built via factories
  // in `lib/seo.ts` so the same Organization entity is reused on landing
  // pages (régions, villes, IA tools) without copy-paste drift.
  // vatID (EE-VAT) + registrikood (Estonia commercial registry) sourced
  // depuis env.ts — passés en optional. Si non définis, JSON-LD sans ces
  // champs (validateur Google n'exige pas, mais signal E-E-A-T plus fort
  // quand présents pour LLMs disambiguation Wikidata).
  // Build conditionnel pour exactOptionalPropertyTypes — on n'assigne la
  // prop que si la valeur est definie (Sprint 15 fix typecheck strict).
  const organizationJsonLdInput: {
    locale: Locale;
    vatID?: string;
    registrikood?: string;
  } = { locale: locale as Locale };
  if (env.COMPANY_VAT_NUMBER) organizationJsonLdInput.vatID = env.COMPANY_VAT_NUMBER;
  if (env.COMPANY_REGISTRATION_NUMBER)
    organizationJsonLdInput.registrikood = env.COMPANY_REGISTRATION_NUMBER;
  const organizationJsonLd = buildOrganizationJsonLd(organizationJsonLdInput);
  const websiteJsonLd = buildWebsiteJsonLd({ locale: locale as Locale });

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
          {/* P-304 — WebVitals dépend de `useLocale()` next-intl, doit donc
              être enfant du provider sinon prerender throw. */}
          <WebVitals />
          {/* Plausible Analytics self-hosted (Sprint 23 / M11) — no-op si
              NEXT_PUBLIC_PLAUSIBLE_DOMAIN absent. afterInteractive donc
              n'impacte pas LCP. */}
          <Plausible />
          {/* Microsoft Clarity (2026-05-13) — heatmaps + session replay gratuits.
              Complète Plausible : Plausible = quoi/combien, Clarity = comment.
              No-op si NEXT_PUBLIC_CLARITY_PROJECT_ID absent. afterInteractive. */}
          <Clarity />
        </NextIntlClientProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        {/* Speculation Rules — P-013 cible Top 15 stratégiques en `eager` +
            fallback `moderate` sur le reste du locale. Avant ce patch, `eager`
            tournait sur 4 562 SSG → consommation bandwidth Cloudflare massive
            sans valeur (la grande majorité des SSG = pages secondaires).
            Désormais : eager seulement sur les pages que 80 % des visiteurs
            visitent, moderate (hover/viewport) sur le reste.
            Browsers sans support ignorent silencieusement.
            Production-only : `next dev` sature Turbopack si on `eager`. */}
        {process.env.NODE_ENV === "production" && (
          <script
            type="speculationrules"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                prerender: [
                  {
                    source: "document",
                    where: {
                      href_matches: [
                        `/${locale}`,
                        `/${locale}/interventions`,
                        `/${locale}/interventions/*`,
                        `/${locale}/audit`,
                        `/${locale}/audit/*`,
                        `/${locale}/implementation`,
                        `/${locale}/cas-concrets`,
                        `/${locale}/methodologie`,
                        `/${locale}/comparaisons`,
                        `/${locale}/stack-ia`,
                        `/${locale}/implantations`,
                        `/${locale}/implantations/ile-de-france`,
                        `/${locale}/implantations/ile-de-france/paris`,
                        `/${locale}/reserver`,
                        `/${locale}/contact`,
                      ],
                    },
                    eagerness: "moderate",
                  },
                ],
                prefetch: [
                  {
                    source: "document",
                    where: {
                      href_matches: [
                        `/${locale}`,
                        `/${locale}/interventions`,
                        `/${locale}/interventions/*`,
                        `/${locale}/audit`,
                        `/${locale}/audit/*`,
                        `/${locale}/implementation`,
                        `/${locale}/cas-concrets`,
                        `/${locale}/methodologie`,
                        `/${locale}/comparaisons`,
                        `/${locale}/stack-ia`,
                        `/${locale}/implantations`,
                        `/${locale}/implantations/ile-de-france`,
                        `/${locale}/implantations/ile-de-france/paris`,
                        `/${locale}/reserver`,
                        `/${locale}/contact`,
                      ],
                    },
                    eagerness: "eager",
                  },
                  {
                    source: "document",
                    where: { href_matches: `/${locale}/*` },
                    eagerness: "moderate",
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
