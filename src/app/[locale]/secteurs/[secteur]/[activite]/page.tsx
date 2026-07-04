import type { Metadata } from "next";
import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";

import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { FinancingBadges } from "@/components/qualiopi/FinancingBadges";
import { isQualiopiPublicDisclosureEnabled } from "@/server/qualiopi/config/flag";
import { CLIENT_SECTORS, getClientSector } from "@/content/sectors";
import { SERVICE_DEFS, getServiceDef } from "@/content/knowledge/services";
import {
  getSectorPainContext,
  type Secteur,
  type Verticale,
} from "@/server/content-gen/kb/sector-pain-matrix";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
} from "@/lib/seo";

// ============================================================================
// Croisé /secteurs/[secteur]/[activite] — Phase 3 (2026-06-21). 50 pages =
// 10 secteurs × 5 activités. Chaque page déroule UN combo pain-matrix complet
// (douleur, avant/après, bénéfice chiffré, objection/réponse, KPI, lexique
// métier) → contenu hand-authored unique par page (anti-doorway HCU : ce n'est
// PAS un gabarit ville-swap). Filet de sécurité : si le combo était absent, la
// page passe noindex,follow (jamais le cas avec la couverture 50/50).
// ============================================================================

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string; secteur: string; activite: string }>;
}

export function generateStaticParams(): Array<{ secteur: string; activite: string }> {
  const out: Array<{ secteur: string; activite: string }> = [];
  for (const sector of CLIENT_SECTORS) {
    for (const svc of SERVICE_DEFS) {
      out.push({ secteur: sector.slug, activite: svc.slug });
    }
  }
  return out;
}

function resolve(secteur: string, activite: string) {
  const sector = getClientSector(secteur);
  const service = getServiceDef(activite);
  if (!sector || !service) return null;
  const verticale = service.verticales[0] as Verticale;
  const pain = getSectorPainContext(sector.slug as Secteur, verticale);
  return { sector, service, verticale, pain };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, secteur, activite } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const r = resolve(secteur, activite);
  if (!r) return {};
  const isFr = locale === "fr";
  const title = isFr
    ? `${r.service.labelFr} pour ${r.sector.labelFr} · Axion-IA`
    : `${r.service.labelFr} for ${r.sector.labelFr} · Axion-IA`;
  const base = buildProductMetadata({
    locale,
    path: `/secteurs/${r.sector.slug}/${r.service.slug}`,
    title,
    description: r.pain
      ? r.pain.benefitMeasured
      : isFr
        ? `${r.service.labelFr} pour ${r.sector.fullFr}.`
        : `${r.service.labelFr} for ${r.sector.fullFr}.`,
  });
  return {
    ...base,
    title: { absolute: title },
    // Filet anti-doorway : sans contenu pain dédié, on ne demande pas l'index.
    ...(r.pain ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function SecteurActivite({ params }: Props) {
  const { locale, secteur, activite } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const r = resolve(secteur, activite);
  if (!r) notFound();
  const { sector, service, pain, verticale } = r;

  // Le financement OPCO / France Travail ne concerne QUE les prestations de
  // formation (interventions collectives + 1-to-1/AFEST), pas les audits /
  // implémentations / sites web. Gaté aussi sur la Phase B (flag) pour ne pas
  // rendre de section vide avant la certification.
  const showFinancing =
    isQualiopiPublicDisclosureEnabled() &&
    (verticale === "interventions_formations" || verticale === "un_a_un");

  const breadcrumbItems = [
    { href: "/secteurs", label: isFr ? "Secteurs" : "Sectors" },
    { href: `/secteurs/${sector.slug}`, label: sector.labelFr },
    { href: `/secteurs/${sector.slug}/${service.slug}`, label: service.labelFr },
  ];

  const breadcrumbJsonLd = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Secteurs" : "Sectors", href: "/secteurs" },
      { name: sector.labelFr, href: `/secteurs/${sector.slug}` },
      { name: service.labelFr, href: `/secteurs/${sector.slug}/${service.slug}` },
    ],
  });

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: `/secteurs/${sector.slug}/${service.slug}`,
    name: isFr
      ? `${service.labelFr} pour ${sector.labelFr}`
      : `${service.labelFr} for ${sector.labelFr}`,
    description: pain
      ? pain.painStatement
      : isFr
        ? `${service.labelFr} pour ${sector.fullFr}.`
        : `${service.labelFr} for ${sector.fullFr}.`,
    serviceType: service.labelFr,
  });

  const faqJsonLd = pain
    ? buildFaqJsonLd({ items: [{ question: pain.objection, answer: pain.objectionReply }] })
    : null;

  // Activités sœurs (même secteur) pour le maillage interne.
  const siblings = SERVICE_DEFS.filter((s) => s.slug !== service.slug);

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section
        tone="halo-warm"
        titleAs="h1"
        eyebrow={`${sector.emoji} ${sector.labelFr} · ${service.labelFr}`}
        title={
          isFr
            ? `${service.labelFr} pour ${sector.labelFr}`
            : `${service.labelFr} for ${sector.labelFr}`
        }
        description={pain ? pain.painStatement : undefined}
      />

      {pain ? (
        <>
          <Section tone="canvas" titleAs="h2" title={isFr ? "Le constat" : "The situation"}>
            <p className="text-fg-soft max-w-3xl" data-answer>
              {pain.beforeScenario}
            </p>
          </Section>

          <Section tone="sand" titleAs="h2" title={isFr ? "Ce qui change" : "What changes"}>
            <p className="text-fg max-w-3xl font-medium" data-answer>
              {pain.afterScenario}
            </p>
            <div className="border-border mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="border-border rounded-2xl border p-5">
                <p className="text-fg-soft text-xs tracking-wide uppercase">
                  {isFr ? "Bénéfice mesurable" : "Measurable benefit"}
                </p>
                <p className="text-fg mt-1 font-semibold">{pain.benefitMeasured}</p>
              </div>
              <div className="border-border rounded-2xl border p-5">
                <p className="text-fg-soft text-xs tracking-wide uppercase">
                  {isFr ? "Indicateur suivi" : "Tracked KPI"}
                </p>
                <p className="text-fg mt-1 font-semibold">{pain.kpiLabel}</p>
                <p className="text-fg-soft mt-2 text-sm">{pain.typicalBudgetSignal}</p>
              </div>
            </div>
          </Section>

          <Section
            tone="canvas"
            titleAs="h2"
            title={isFr ? "On parle votre langue" : "We speak your language"}
          >
            <ul className="flex flex-wrap gap-2" role="list">
              {pain.sectorLexicon.map((term) => (
                <li
                  key={term}
                  className="border-border bg-paper rounded-full border px-3 py-1 text-sm"
                >
                  {term}
                </li>
              ))}
            </ul>
          </Section>

          <Section
            tone="sand"
            titleAs="h2"
            title={isFr ? "Votre objection, notre réponse" : "Your objection, our answer"}
          >
            <p className="text-fg font-semibold" data-faq-q>
              {pain.objection}
            </p>
            <p className="text-fg-soft mt-1 max-w-3xl" data-faq-a data-answer>
              {pain.objectionReply}
            </p>
          </Section>
        </>
      ) : null}

      {/* Financement OPCO / France Travail — HORS du bloc `pain` : l'éligibilité
          au financement ne dépend pas de l'existence d'une entrée pain-matrix
          (sinon l'encart ne rend sur AUCUNE page formation, cf. combos sans pain
          rendus en noindex). Gaté Phase B + verticale formation via showFinancing. */}
      {showFinancing ? (
        <Section
          tone="canvas"
          titleAs="h2"
          title={isFr ? "Financer cette formation" : "Funding this training"}
        >
          <FinancingBadges seed={`${sector.slug}-${service.slug}`} className="max-w-3xl" />
        </Section>
      ) : null}

      <Section tone="canvas" titleAs="h2" title={isFr ? "Aller plus loin" : "Go further"}>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/${loc}/appel`}
            className="bg-terracotta rounded-full px-5 py-2.5 font-semibold text-white hover:opacity-90"
          >
            {isFr ? "Réserver un appel" : "Book a call"}
          </Link>
          <Link
            href={`/${loc}${service.pageHref}`}
            className="border-border hover:bg-paper rounded-full border px-5 py-2.5 font-semibold"
          >
            {service.labelFr}
          </Link>
          <Link
            href={`/${loc}/secteurs/${sector.slug}`}
            className="border-border hover:bg-paper rounded-full border px-5 py-2.5 font-semibold"
          >
            {isFr ? `← ${sector.labelFr}` : `← ${sector.labelFr}`}
          </Link>
        </div>

        {/* Maillage : les autres activités pour ce secteur */}
        <div className="mt-8">
          <p className="text-fg-soft mb-3 text-sm font-medium">
            {isFr
              ? `Autres solutions IA pour ${sector.labelFr} :`
              : `Other AI solutions for ${sector.labelFr}:`}
          </p>
          <ul className="flex flex-wrap gap-2" role="list">
            {siblings.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/${loc}/secteurs/${sector.slug}/${s.slug}`}
                  className="text-terracotta text-sm underline-offset-4 hover:underline"
                >
                  {s.labelFr}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <StickyMobileCta
        href="/appel"
        label={isFr ? "Réserver un appel" : "Book a call"}
        track={`secteur-${sector.slug}-${service.slug}-sticky-call`}
        threshold={500}
      />

      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={serviceJsonLd} />
      {faqJsonLd ? (
        <JsonLd
          data={faqJsonLd}
          strategy="afterInteractive"
          scriptId="jsonld-secteur-activite-faq"
        />
      ) : null}
    </>
  );
}
