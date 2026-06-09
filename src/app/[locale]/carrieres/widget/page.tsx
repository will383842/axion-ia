// Route d'embed du widget offres d'emploi — `/[locale]/carrieres/widget`.
//
// Page minimale (layout nu, cf. ./layout.tsx) rendue dans un <iframe>. Pilotée
// par query-params : `variant` (compact|large), `count` (1–12), `theme`
// (light|dark). CSP `frame-ancestors *` + pas de X-Frame-Options sur ce chemin
// (cf. src/lib/csp.ts `isEmbedPath` + src/proxy.ts + next.config.ts).
//
// Stub-safe au build : `listPublishedJobOffers` renvoie [] sous stub.invalid →
// widget rendu vide, repeuplé par ISR revalidate=3600.

import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/seo";
import { listPublishedJobOffers } from "@/lib/careers/job-offers";
import { resolveWidgetCity } from "@/lib/careers/city-widget";
import {
  OffersWidget,
  clampOffersCount,
  type OffersWidgetTheme,
  type OffersWidgetVariant,
} from "@/components/careers/OffersWidget";
import { EmbedAutoResize } from "@/components/careers/EmbedAutoResize";

export const revalidate = 3600;

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function parseVariant(raw: string | undefined): OffersWidgetVariant {
  return raw === "compact" ? "compact" : "large";
}

function parseTheme(raw: string | undefined): OffersWidgetTheme {
  return raw === "dark" ? "dark" : "light";
}

interface WidgetPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ variant?: string; count?: string; theme?: string; city?: string }>;
}

export default async function WidgetEmbedPage({ params, searchParams }: WidgetPageProps) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const sp = await searchParams;
  const variant = parseVariant(sp.variant);
  const theme = parseTheme(sp.theme);
  const count = clampOffersCount(sp.count);
  const city = resolveWidgetCity(sp.city);

  const offers = await listPublishedJobOffers();

  return (
    <div className="axion-offers-embed-shell p-2 sm:p-3">
      <OffersWidget
        locale={locale}
        offers={offers}
        variant={variant}
        count={count}
        theme={theme}
        city={city}
        baseUrl={SITE_URL}
      />
      <EmbedAutoResize />
    </div>
  );
}
