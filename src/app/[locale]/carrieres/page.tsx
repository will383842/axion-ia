// Hub /carrieres — liste des offres publiées (DB-piloté, ISR). Server Component
// pur (0 JS : filtres par query-param server-side → INP préservé). Niveau /audit.

import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Cta } from "@/components/marketing/Cta";
import { buildProductMetadata, buildItemListJsonLd, SITE_URL } from "@/lib/seo";
import { listPublishedJobOffers } from "@/lib/careers/job-offers";
import type { JobOffer } from "../../../../prisma/generated/client";

export const revalidate = 3600;

const CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  tech: { fr: "Tech", en: "Tech" },
  commercial: { fr: "Commercial", en: "Sales" },
  marketing: { fr: "Marketing", en: "Marketing" },
  operations: { fr: "Opérations", en: "Operations" },
  design: { fr: "Design", en: "Design" },
  support: { fr: "Support", en: "Support" },
  autre: { fr: "Autre", en: "Other" },
};
const WORKMODE_LABELS: Record<string, { fr: string; en: string }> = {
  on_site: { fr: "Sur site", en: "On-site" },
  hybrid: { fr: "Hybride", en: "Hybrid" },
  remote: { fr: "Remote", en: "Remote" },
};

function isNew(datePosted: Date): boolean {
  return Date.now() - datePosted.getTime() < 14 * 24 * 3600 * 1000;
}

function salaryLabel(o: JobOffer, isFr: boolean): string | null {
  if (o.isCommission) return isFr ? "Commission déplafonnée" : "Uncapped commission";
  if (!o.salaryVisible) return isFr ? "Rémunération selon profil" : "Salary based on profile";
  if (o.salaryMin == null && o.salaryMax == null) return null;
  const k = (n: number) => `${Math.round(n / 1000)}k`;
  const per =
    o.salaryPeriod === "YEAR"
      ? isFr
        ? "/an"
        : "/yr"
      : o.salaryPeriod === "MONTH"
        ? isFr
          ? "/mois"
          : "/mo"
        : "/h";
  const range =
    o.salaryMin != null && o.salaryMax != null
      ? `${k(o.salaryMin)}–${k(o.salaryMax)}`
      : k((o.salaryMin ?? o.salaryMax) as number);
  return `${range} ${o.salaryCurrency} ${per}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  const base = buildProductMetadata({
    locale: locale as Locale,
    path: "/carrieres",
    title: isFr ? "Carrières · rejoindre Axion-IA" : "Careers · join Axion-IA",
    description: isFr
      ? "Rejoignez Axion-IA, le cabinet IA opérationnel. Découvrez nos offres d'emploi et postulez en quelques minutes — sur site, hybride ou remote, partout en France."
      : "Join Axion-IA, the operational AI firm. Browse our open positions and apply in minutes — on-site, hybrid or remote across France.",
  });
  const offers = await listPublishedJobOffers();
  if (offers.length === 0) return { ...base, robots: { index: false, follow: true } };
  return base;
}

export default async function CarrieresHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ category?: string; workMode?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const sp = await searchParams;

  const all = await listPublishedJobOffers();
  const offers = all.filter(
    (o) =>
      (!sp.category || o.category === sp.category) &&
      (!sp.workMode || o.workMode === sp.workMode),
  );

  const itemList = buildItemListJsonLd({
    locale: loc,
    path: "/carrieres",
    name: isFr ? "Offres d'emploi Axion-IA" : "Axion-IA job openings",
    items: offers.map((o, i) => ({
      url: `${SITE_URL}/${loc}/carrieres/${o.slug}`,
      name: isFr ? o.titleFr : o.titleEn,
      position: i + 1,
      description: isFr ? o.summaryFr : o.summaryEn,
    })),
  });

  const activeCategories = Array.from(new Set(all.map((o) => o.category)));

  return (
    <>
      {offers.length > 0 ? <JsonLd data={itemList} /> : null}

      <Section tone="paper">
        <Container>
          <Breadcrumbs items={[{ href: "/carrieres", label: isFr ? "Carrières" : "Careers" }]} />
          <p className="text-terracotta mt-6 text-sm font-semibold tracking-wide uppercase">
            {isFr ? "Rejoindre l'aventure" : "Join the adventure"}
          </p>
          <h1 className="font-serif mt-2 text-4xl font-semibold sm:text-5xl">
            {isFr ? (
              <>
                Construisons l&apos;IA opérationnelle, <em className="text-terracotta italic">ensemble</em>
              </>
            ) : (
              <>
                Let&apos;s build operational AI, <em className="text-terracotta italic">together</em>
              </>
            )}
          </h1>
          <p
            data-speakable
            className="text-fg-muted mt-4 max-w-2xl text-lg"
          >
            {isFr
              ? "Axion-IA recrute partout en France. Des missions concrètes, une équipe qui avance, et un process de candidature simple — quelques minutes suffisent, CV optionnel."
              : "Axion-IA is hiring across France. Real-world missions, a team that moves fast, and a simple application — a few minutes, CV optional."}
          </p>
        </Container>
      </Section>

      <Section>
        <Container>
          {/* Filtres catégorie — liens server-side (0 JS, INP préservé) */}
          {activeCategories.length > 1 ? (
            <nav
              aria-label={isFr ? "Filtrer par catégorie" : "Filter by category"}
              className="mb-8 flex flex-wrap gap-2"
            >
              <Link
                href="/carrieres"
                className={`rounded-full border px-4 py-1.5 text-sm ${!sp.category ? "border-terracotta bg-terracotta/10 font-medium" : "border-border"}`}
              >
                {isFr ? "Toutes" : "All"}
              </Link>
              {activeCategories.map((c) => (
                <Link
                  key={c}
                  href={`/carrieres?category=${c}`}
                  className={`rounded-full border px-4 py-1.5 text-sm ${sp.category === c ? "border-terracotta bg-terracotta/10 font-medium" : "border-border"}`}
                >
                  {CATEGORY_LABELS[c]?.[isFr ? "fr" : "en"] ?? c}
                </Link>
              ))}
            </nav>
          ) : null}

          {offers.length === 0 ? (
            <div className="border-border rounded-2xl border border-dashed p-12 text-center">
              <p className="text-fg-muted text-lg">
                {isFr
                  ? "Pas d'offre ouverte en ce moment — mais on grandit vite."
                  : "No open position right now — but we're growing fast."}
              </p>
              <div className="mt-6">
                <Cta href="/contact" track="careers-empty-contact">
                  {isFr ? "Candidature spontanée" : "Spontaneous application"}
                </Cta>
              </div>
            </div>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {offers.map((o) => {
                const sal = salaryLabel(o, isFr);
                return (
                  <li key={o.id}>
                    <Link
                      href={`/carrieres/${o.slug}`}
                      className="border-border hover:border-terracotta group flex h-full flex-col rounded-2xl border p-6 transition-colors"
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="bg-sand text-fg-muted rounded-full px-2.5 py-0.5 text-xs font-medium">
                          {CATEGORY_LABELS[o.category]?.[isFr ? "fr" : "en"] ?? o.category}
                        </span>
                        {isNew(o.datePosted) ? (
                          <span className="bg-terracotta/15 text-terracotta rounded-full px-2.5 py-0.5 text-xs font-semibold">
                            {isFr ? "Nouveau" : "New"}
                          </span>
                        ) : null}
                      </div>
                      <h2 className="font-serif text-xl font-semibold group-hover:underline">
                        {isFr ? o.titleFr : o.titleEn}
                      </h2>
                      <p className="text-fg-muted mt-2 line-clamp-3 text-sm">
                        {isFr ? o.summaryFr : o.summaryEn}
                      </p>
                      <div className="text-fg-muted mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span>📍 {o.city ?? WORKMODE_LABELS[o.workMode]?.[isFr ? "fr" : "en"]}</span>
                        {o.contractLabel ? <span>📄 {o.contractLabel}</span> : null}
                        {sal ? <span>💶 {sal}</span> : null}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Container>
      </Section>
    </>
  );
}
