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
import { CLIENT_SECTORS, getClientSector } from "@/content/sectors";
import { SERVICE_DEFS } from "@/content/knowledge/services";
import {
  getSectorPainContext,
  type Secteur,
  type Verticale,
} from "@/server/content-gen/kb/sector-pain-matrix";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildItemListJsonLd,
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  SITE_URL,
} from "@/lib/seo";

// ============================================================================
// Pilier /secteurs/[secteur] — Phase 3 (2026-06-21). Déroule les 5 activités
// Axion-IA pour CE secteur, chacune contextualisée par la pain-matrix (douleur,
// bénéfice chiffré, lexique métier). Contenu UNIQUE par combo secteur×activité
// (hand-authored 50/50) → anti-doorway HCU. Maillage : hub ↔ pilier ↔ croisé ↔
// pages services. Filet de sécurité : si un combo manquait, la page serait
// noindex (jamais le cas avec la couverture 50/50).
// ============================================================================

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string; secteur: string }>;
}

export function generateStaticParams(): Array<{ secteur: string }> {
  return CLIENT_SECTORS.map((s) => ({ secteur: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, secteur } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const sector = getClientSector(secteur);
  if (!sector) return {};
  const isFr = locale === "fr";
  const title = isFr
    ? `IA pour ${sector.labelFr} · cas d'usage & ROI · Axion-IA`
    : `AI for ${sector.labelFr} · use cases & ROI · Axion-IA`;
  return {
    ...buildProductMetadata({
      locale,
      path: `/secteurs/${sector.slug}`,
      title,
      description: isFr
        ? `Intelligence artificielle pour ${sector.fullFr} : audit, formation, implémentation, accompagnement 1-to-1 et sites web augmentés. Cas d'usage concrets, bénéfices chiffrés et feuille de route adaptée au secteur.`
        : `Artificial intelligence for ${sector.fullFr}: audit, training, implementation, 1-to-1 support and AI-augmented websites. Concrete use cases, quantified benefits and a sector roadmap.`,
    }),
    title: { absolute: title },
  };
}

export default async function SecteurPilier({ params }: Props) {
  const { locale, secteur } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const sector = getClientSector(secteur);
  if (!sector) notFound();

  // Les 5 activités contextualisées par la pain-matrix pour ce secteur.
  const activities = SERVICE_DEFS.map((svc) => {
    const verticale = svc.verticales[0] as Verticale;
    const pain = getSectorPainContext(sector.slug as Secteur, verticale);
    return { svc, verticale, pain };
  }).filter((a) => a.pain !== undefined);

  const breadcrumbItems = [
    { href: "/secteurs", label: isFr ? "Secteurs" : "Sectors" },
    { href: `/secteurs/${sector.slug}`, label: sector.labelFr },
  ];

  const breadcrumbJsonLd = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Secteurs" : "Sectors", href: "/secteurs" },
      { name: sector.labelFr, href: `/secteurs/${sector.slug}` },
    ],
  });

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: `/secteurs/${sector.slug}`,
    name: isFr
      ? `Intelligence artificielle pour ${sector.labelFr}`
      : `Artificial intelligence for ${sector.labelFr}`,
    description: isFr
      ? `Solutions IA pour ${sector.fullFr} : audit, formation, implémentation, 1-to-1, sites web augmentés.`
      : `AI solutions for ${sector.fullFr}: audit, training, implementation, 1-to-1, AI-augmented websites.`,
    serviceType: `AI consulting for ${sector.labelFr}`,
  });

  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: `/secteurs/${sector.slug}`,
    name: isFr ? `Solutions IA pour ${sector.labelFr}` : `AI solutions for ${sector.labelFr}`,
    items: activities.map((a, idx) => ({
      position: idx + 1,
      name: `${a.svc.labelFr} · ${sector.labelFr}`,
      url: `${SITE_URL}/${loc}/secteurs/${sector.slug}/${a.svc.slug}`,
      description: a.pain!.benefitMeasured,
    })),
  });

  const faqItems = activities.map((a) => ({
    question: a.pain!.objection,
    answer: a.pain!.objectionReply,
  }));
  const faqJsonLd = buildFaqJsonLd({ items: faqItems });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section
        tone="halo-warm"
        titleAs="h1"
        eyebrow={`${sector.emoji} ${isFr ? "Secteur" : "Sector"} · ${sector.labelFr}`}
        title={
          isFr
            ? `L'IA pour ${sector.labelFr}, sans jargon ni promesses creuses.`
            : `AI for ${sector.labelFr}, without jargon or empty promises.`
        }
        description={
          isFr
            ? `Pour ${sector.fullFr}, on part de vos contraintes réelles et de votre vocabulaire métier. Voici les 5 façons dont Axion-IA vous fait gagner du temps et de l'argent — chacune avec un gain concret et chiffré.`
            : `For ${sector.fullFr}, we start from your real constraints and trade vocabulary. Here are the 5 ways Axion-IA saves you time and money — each with a concrete, quantified gain.`
        }
      />

      {/* Les 5 activités — h2 de section, h3 par activité */}
      <Section
        tone="canvas"
        titleAs="h2"
        title={
          isFr ? `5 solutions IA pour ${sector.labelFr}` : `5 AI solutions for ${sector.labelFr}`
        }
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {activities.map(({ svc, pain }) => (
            <article
              key={svc.slug}
              className="border-border flex flex-col gap-3 rounded-2xl border p-6"
            >
              <h3 className="text-fg text-lg font-semibold">{svc.labelFr}</h3>
              <p className="text-fg-soft text-sm" data-answer>
                {pain!.painStatement}
              </p>
              <p className="text-fg text-sm font-medium">{pain!.benefitMeasured}</p>
              <div className="mt-auto flex flex-wrap gap-3 pt-2">
                <Link
                  href={`/${loc}/secteurs/${sector.slug}/${svc.slug}`}
                  className="text-terracotta text-sm font-semibold underline-offset-4 hover:underline"
                >
                  {isFr ? "Voir le cas d'usage →" : "See the use case →"}
                </Link>
                <Link
                  href={`/${loc}${svc.pageHref}`}
                  className="text-fg-soft text-sm underline-offset-4 hover:underline"
                >
                  {svc.labelFr}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* FAQ — objections sectorielles (Speakable via data-faq-q/a) */}
      <Section
        tone="sand"
        titleAs="h2"
        title={isFr ? "Vos objections, nos réponses" : "Your objections, our answers"}
      >
        <dl className="flex flex-col gap-5">
          {faqItems.map((f, i) => (
            <div key={i} className="border-border border-b pb-4">
              <dt className="text-fg font-semibold" data-faq-q>
                {f.question}
              </dt>
              <dd className="text-fg-soft mt-1 text-sm" data-faq-a data-answer>
                {f.answer}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section tone="canvas" titleAs="h2" title={isFr ? "Par où commencer ?" : "Where to start?"}>
        <p className="text-fg-soft max-w-2xl">
          {isFr
            ? "Le plus simple : un appel de cadrage. On regarde votre contexte, on identifie le gisement de temps le plus rapide à récupérer, et on vous dit honnêtement par quelle activité commencer."
            : "The simplest: a scoping call. We look at your context, identify the fastest time saving, and honestly tell you which activity to start with."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/${loc}/appel`}
            className="bg-terracotta rounded-full px-5 py-2.5 font-semibold text-white hover:opacity-90"
          >
            {isFr ? "Réserver un appel" : "Book a call"}
          </Link>
          <Link
            href={`/${loc}/secteurs`}
            className="border-border hover:bg-paper rounded-full border px-5 py-2.5 font-semibold"
          >
            {isFr ? "← Tous les secteurs" : "← All sectors"}
          </Link>
        </div>
      </Section>

      <StickyMobileCta
        href="/appel"
        label={isFr ? "Réserver un appel" : "Book a call"}
        track={`secteur-${sector.slug}-sticky-call`}
        threshold={500}
      />

      <JsonLd data={breadcrumbJsonLd} />
      <JsonLd data={serviceJsonLd} />
      <JsonLd
        data={itemListJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-secteur-itemlist"
      />
      <JsonLd data={faqJsonLd} strategy="afterInteractive" scriptId="jsonld-secteur-faq" />
    </>
  );
}
