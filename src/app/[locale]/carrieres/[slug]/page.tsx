// Page détail d'une offre /carrieres/[slug] — niveau /audit. Server Component.
// JobPosting + breadcrumb + WebPage/speakable ; corps HTML sanitizé (anti VIS-01) ;
// noindex si draft/pourvue/expirée/non-tier1 ; offres suggérées ; CTA postuler.

import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Cta } from "@/components/marketing/Cta";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { buildProductMetadata, buildWebPageJsonLd } from "@/lib/seo";
import { buildJobPostingJsonLd } from "@/lib/seo/job-posting";
import { CAREER_VERTICALS } from "@/content/careers/categories";
import { EMPLOYER_BRAND } from "@/content/careers/employer-brand";
import { careerImage } from "@/content/careers/careers-images";
import { UnsplashCredit } from "@/components/media/UnsplashCredit";
import { sanitizeContentGenHtml } from "@/server/content-gen/shared/html-sanitizer";
import {
  getJobOfferBySlug,
  isJobOfferIndexable,
  listIndexableJobOfferSlugs,
  listSuggestedOffers,
} from "@/lib/careers/job-offers";
import type { JobOffer } from "../../../../../prisma/generated/client";

export const revalidate = 3600;

const WORKMODE_LABELS: Record<string, { fr: string; en: string }> = {
  on_site: { fr: "Sur site", en: "On-site" },
  hybrid: { fr: "Hybride", en: "Hybrid" },
  remote: { fr: "Remote", en: "Remote" },
};

interface PerkItem {
  labelFr?: string;
  labelEn?: string;
  icon?: string;
}

/** Offre clôturée = non publiée, pourvue OU expirée (Date.now isolé hors render). */
function isOfferClosed(o: Pick<JobOffer, "status" | "filledAt" | "validThrough">): boolean {
  if (o.status !== "published") return true;
  if (o.filledAt) return true;
  if (o.validThrough && o.validThrough.getTime() < Date.now()) return true;
  return false;
}

function salaryLabel(o: JobOffer, isFr: boolean): string | null {
  if (o.isCommission) return isFr ? "Commission déplafonnée" : "Uncapped commission";
  if (!o.salaryVisible) return null; // masqué → on n'affiche RIEN (jamais de mention vague, directive UE 2023/970)
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

export async function generateStaticParams() {
  const slugs = await listIndexableJobOfferSlugs();
  // FR-only : on ne pré-rend que le FR (EN désactivé → 301 vers FR au runtime).
  return slugs.map((slug) => ({ locale: "fr", slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const offer = await getJobOfferBySlug(slug);
  if (!offer) return { robots: { index: false, follow: false }, alternates: {} };

  const isFr = locale === "fr";
  // FR-only : EN désactivé → noindex explicite (ceinture + bretelles avec le 301).
  if (!isFr) {
    return {
      ...buildProductMetadata({
        locale: locale as Locale,
        path: `/carrieres/${slug}`,
        title: offer.metaTitle ?? `${offer.titleEn} · Axion-IA.com`,
        description: (offer.metaDescription ?? offer.summaryEn).slice(0, 160),
      }),
      robots: { index: false, follow: true },
    };
  }
  const base = buildProductMetadata({
    locale: locale as Locale,
    path: `/carrieres/${slug}`,
    title: offer.metaTitle ?? `${isFr ? offer.titleFr : offer.titleEn} · Axion-IA.com`,
    description: (offer.metaDescription ?? (isFr ? offer.summaryFr : offer.summaryEn)).slice(
      0,
      160,
    ),
    ...(offer.ogImagePath ? { ogImage: offer.ogImagePath } : {}),
  });
  if (!isJobOfferIndexable(offer)) {
    return { ...base, robots: { index: false, follow: true } };
  }
  return base;
}

export default async function JobOfferDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const offer = await getJobOfferBySlug(slug);
  if (!offer) notFound();

  const title = isFr ? offer.titleFr : offer.titleEn;
  const summary = isFr ? offer.summaryFr : offer.summaryEn;
  const bodyHtml = sanitizeContentGenHtml(isFr ? offer.bodyFr : offer.bodyEn);
  const sal = salaryLabel(offer, isFr);
  const applyHref = `/carrieres/${offer.slug}/postuler`;
  const isClosed = isOfferClosed(offer);

  const perks: PerkItem[] = Array.isArray(offer.perks) ? (offer.perks as PerkItem[]) : [];
  const suggested = await listSuggestedOffers(offer, 4);
  // Zone d'emploi multi-villes (postes itinérants/territoriaux).
  const jobCities = Array.isArray(offer.jobLocations)
    ? (offer.jobLocations as Array<{ city?: string }>)
        .map((l) => l.city)
        .filter((c): c is string => Boolean(c))
    : [];
  const img = careerImage(offer.slug);

  const jobPosting = buildJobPostingJsonLd(offer, loc);
  const webPage = buildWebPageJsonLd({
    locale: loc,
    path: `/carrieres/${offer.slug}`,
    name: title,
    speakable: { selectors: ["h1", "[data-speakable]"] },
  });

  return (
    <>
      {jobPosting ? <JsonLd data={jobPosting} scriptId="jsonld-jobposting" /> : null}
      <JsonLd data={webPage} scriptId="jsonld-webpage" />

      <Section tone="halo-warm">
        <Container>
          <Breadcrumbs
            items={[
              { href: "/carrieres", label: isFr ? "Carrières" : "Careers" },
              { href: applyHref.replace("/postuler", ""), label: title },
            ]}
          />

          {isClosed ? (
            <p className="bg-sand text-fg-muted mt-6 rounded-lg px-4 py-3 text-sm">
              {offer.filledAt
                ? isFr
                  ? "Cette offre est pourvue. Merci de votre intérêt — d'autres postes vous attendent."
                  : "This position has been filled. Thanks for your interest — other roles are open."
                : isFr
                  ? "Cette offre est clôturée."
                  : "This position is closed."}
            </p>
          ) : null}

          <div className="mt-6 grid items-start gap-8 lg:grid-cols-[1fr_0.85fr] lg:gap-12">
            {/* Colonne gauche — texte */}
            <div>
              <p className="text-terracotta text-sm font-semibold tracking-wide uppercase">
                {WORKMODE_LABELS[offer.workMode]?.[isFr ? "fr" : "en"]}
                {offer.city ? ` · ${offer.city}` : ""}
              </p>
              <h1 className="mt-2 font-serif text-4xl font-semibold sm:text-5xl">{title}</h1>

              <div className="text-fg-muted mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {offer.contractLabel ? <span>📄 {offer.contractLabel}</span> : null}
                {sal ? <span>💶 {sal}</span> : null}
                {offer.teamName ? <span>👥 {offer.teamName}</span> : null}
                {offer.startDate ? (
                  <span>
                    🗓️ {isFr ? "Dès" : "From"} {offer.startDate.toISOString().slice(0, 10)}
                  </span>
                ) : null}
              </div>

              {/* En bref — direct answer AEO / speakable */}
              <p data-speakable className="mt-5 text-lg">
                {summary}
              </p>

              {!isClosed ? (
                <div className="mt-6">
                  <Cta href={applyHref} track="career-apply-hero">
                    {isFr ? "Postuler" : "Apply"}
                  </Cta>
                </div>
              ) : null}
            </div>

            {/* Colonne droite — photo */}
            <div>
              <div className="border-border shadow-card relative aspect-[4/3] overflow-hidden rounded-3xl border">
                <Image
                  src={img.url}
                  alt={img.alt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 40vw"
                  className="object-cover"
                />
              </div>
              <UnsplashCredit
                photographerName={img.byName}
                photographerUrl={img.byUrl}
                className="text-right"
              />
            </div>
          </div>
        </Container>
      </Section>

      <Section>
        <Container>
          <div className="grid gap-10 lg:grid-cols-[1fr_18rem]">
            <article
              className={[
                "prose prose-lg prose-neutral max-w-none",
                // H2 : titres de section terracotta serif, bien détachés (anti gros-bloc).
                "[&_h2]:text-terracotta-deep [&_h2]:mt-14 [&_h2]:mb-5 [&_h2]:font-serif [&_h2]:text-3xl [&_h2]:leading-tight [&_h2]:font-semibold sm:[&_h2]:text-4xl",
                // H3 : sous-titres serif noir.
                "[&_h3]:text-fg [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:font-serif [&_h3]:text-xl [&_h3]:font-semibold",
                // Listes : puces terracotta, aérées.
                // Listes : puces terracotta, à puces explicites + aérées (sans dépendre de prose).
                "[&_li]:marker:text-terracotta [&_ul]:my-5 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5",
                // Paragraphes : espacés (mb-5), lisibles, gris doux ; gras en noir franc.
                "[&_p]:text-fg-soft [&_strong]:text-fg [&_p]:mb-5 [&_p]:leading-relaxed [&_strong]:font-semibold",
              ].join(" ")}
              // Corps riche déjà sanitizé (whitelist) — anti VIS-01 (jamais affiché en texte).
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />

            <aside className="space-y-6">
              {perks.length > 0 ? (
                <div className="border-border rounded-2xl border p-5">
                  <h2 className="font-serif text-lg font-semibold">
                    {isFr ? "Ce qu'on offre" : "What we offer"}
                  </h2>
                  <ul className="mt-3 space-y-2 text-sm" role="list">
                    {perks.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <span aria-hidden>{p.icon ?? "✅"}</span>
                        <span>{(isFr ? p.labelFr : p.labelEn) ?? p.labelFr ?? p.labelEn}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {!isClosed ? (
                <div className="border-terracotta/30 bg-terracotta/5 rounded-2xl border p-5">
                  <p className="text-sm">
                    {isFr
                      ? "Prêt·e à nous rejoindre ? La candidature prend quelques minutes."
                      : "Ready to join? Applying takes a few minutes."}
                  </p>
                  <div className="mt-3">
                    <Cta href={applyHref} track="career-apply-aside">
                      {isFr ? "Postuler maintenant" : "Apply now"}
                    </Cta>
                  </div>
                </div>
              ) : null}

              <div className="border-border rounded-2xl border p-5">
                <h2 className="font-serif text-lg font-semibold">
                  {isFr ? "Nos expertises IA" : "Our AI expertise"}
                </h2>
                <ul className="mt-3 space-y-1.5 text-sm" role="list">
                  {CAREER_VERTICALS.map((v) => (
                    <li key={v.href}>
                      <Link
                        href={v.href}
                        className="text-terracotta hover:text-terracotta-deep inline-flex items-center gap-1 underline underline-offset-2"
                      >
                        {isFr ? v.fr : v.en} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border-border rounded-2xl border p-5">
                <h2 className="font-serif text-lg font-semibold">
                  {isFr ? "Qui est Axion-IA.com ?" : "Who is Axion-IA.com?"}
                </h2>
                <p className="text-fg-muted mt-2 text-sm">
                  {isFr ? EMPLOYER_BRAND.shortAboutFr : EMPLOYER_BRAND.shortAboutEn}
                </p>
                <Link
                  href="/carrieres"
                  className="text-terracotta mt-2 inline-block text-sm underline"
                >
                  {isFr ? "Découvrir l'entreprise →" : "Discover the company →"}
                </Link>
              </div>
            </aside>
          </div>
        </Container>
      </Section>

      {/* Où ce poste est ouvert — multi-villes (sous l'offre, plus dans le hero) */}
      {jobCities.length > 0 ? (
        <Section tone="sand">
          <Container>
            <h2 className="font-serif text-2xl font-semibold sm:text-3xl">
              {isFr ? "Où ce poste est ouvert" : "Where this role is open"}
            </h2>
            <p className="text-fg-muted mt-2 max-w-2xl">
              {isFr
                ? "Poste itinérant, organisé par secteurs : tu interviens chez nos clients partout en France — dans ces villes et leurs alentours."
                : "Itinerant role, organised by sector: you work at our clients across France — in these cities and surroundings."}
            </p>
            <ul className="mt-5 flex flex-wrap gap-2" role="list">
              {jobCities.map((c) => (
                <li
                  key={c}
                  className="border-border text-fg-muted bg-paper rounded-full border px-3 py-1 text-sm"
                >
                  {c}
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* Accompagnement — formation + intégration en 2 parties (tous les postes) */}
      <Section tone="halo-cool">
        <Container>
          <div className="mx-auto max-w-3xl">
            <h2 className="font-serif text-2xl font-semibold sm:text-3xl">
              {isFr ? EMPLOYER_BRAND.onboardingTitleFr : EMPLOYER_BRAND.onboardingTitleEn}
            </h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="border-border bg-paper shadow-subtle rounded-2xl border p-6">
                <h3 className="font-serif text-lg font-semibold">
                  {isFr ? EMPLOYER_BRAND.formationLabelFr : EMPLOYER_BRAND.formationLabelEn}
                </h3>
                <p className="text-fg-soft mt-2 leading-relaxed">
                  {isFr ? EMPLOYER_BRAND.formationFr : EMPLOYER_BRAND.formationEn}
                </p>
              </div>
              <div className="border-border bg-paper shadow-subtle rounded-2xl border p-6">
                <h3 className="font-serif text-lg font-semibold">
                  {isFr ? EMPLOYER_BRAND.integrationLabelFr : EMPLOYER_BRAND.integrationLabelEn}
                </h3>
                <p className="text-fg-soft mt-2 leading-relaxed">
                  {isFr ? EMPLOYER_BRAND.integrationFr : EMPLOYER_BRAND.integrationEn}
                </p>
              </div>
            </div>
            {offer.category === "conseil" ? (
              <p className="border-terracotta text-fg-soft mt-5 border-l-4 pl-4 leading-relaxed">
                {isFr ? EMPLOYER_BRAND.formateurOnboardingFr : EMPLOYER_BRAND.formateurOnboardingEn}
              </p>
            ) : null}
          </div>
        </Container>
      </Section>

      {suggested.length >= 2 ? (
        <Section tone="sand">
          <Container>
            <h2 className="font-serif text-2xl font-semibold">
              {isFr ? "D'autres offres qui pourraient te plaire" : "Other roles you might like"}
            </h2>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2" role="list">
              {suggested.map((s) => {
                const sImg = careerImage(s.slug);
                return (
                  <li key={s.id}>
                    <Link
                      href={`/carrieres/${s.slug}`}
                      className="border-border hover:border-terracotta shadow-subtle hover:shadow-card flex items-center gap-4 rounded-xl border bg-white p-3 transition"
                    >
                      <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={sImg.url}
                          alt={sImg.alt}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-medium">{isFr ? s.titleFr : s.titleEn}</h3>
                        <p className="text-fg-muted mt-0.5 text-xs">
                          {s.city ?? WORKMODE_LABELS[s.workMode]?.[isFr ? "fr" : "en"]}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Container>
        </Section>
      ) : null}

      {!isClosed ? (
        <StickyMobileCta
          href={applyHref}
          label={isFr ? "Postuler" : "Apply"}
          track="career-apply-sticky"
        />
      ) : null}
    </>
  );
}
