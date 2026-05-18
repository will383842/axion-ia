// Sprint S+2 City Domination — Hub canonique 4e verticale `un-a-un`.
// Décision Will Option A 2026-05-18.
//
// Page landing hub (≠ pages par-ville × 2150 SSG) — présente l'offre
// d'accompagnement 1-to-1 dirigeant globalement. Tarif d'entrée 990 € HT.
//
// Phase 1 V1 : page essentielle (hero + pricing + CTA) — peut être enrichie
// Sprint S+3 avec témoignages dirigeants, méthodologie détaillée, FAQ
// approfondie.

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildServiceJsonLd } from "@/lib/seo";
import { UN_A_UN_TIERS, formatPrice, getEntryTier } from "@/content/pricing";

interface Props {
  params: Promise<{ locale: string }>;
}

export const revalidate = 86400;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: isFr ? "/un-a-un" : "/one-to-one",
    title: isFr
      ? "Accompagnement IA 1-to-1 dirigeant · Axion-IA"
      : "1-to-1 AI coaching for executives · Axion-IA",
    description: isFr
      ? "Journée 1-to-1 avec le dirigeant pour structurer l'entreprise autour de l'IA et chiffrer précisément les gains d'implémentation. 990 € HT, sur site."
      : "1-on-1 day with the executive to structure the company around AI and quantify implementation gains precisely. €990 ex. VAT, on site.",
    alternates: { fr: "/un-a-un", en: "/one-to-one" },
  });
}

export default async function UnAUnHubPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";
  const entryTier = getEntryTier(UN_A_UN_TIERS);
  const formattedPrice = formatPrice(entryTier, isFr ? "fr" : "en");
  const path = isFr ? "/un-a-un" : "/one-to-one";

  const serviceJsonLd = buildServiceJsonLd({
    locale,
    path,
    name: isFr ? "Accompagnement IA 1-to-1 dirigeant" : "1-to-1 AI coaching for executives",
    description: isFr
      ? "Journée 1-to-1 avec le dirigeant pour structurer l'entreprise autour de l'IA et chiffrer les gains d'implémentation. Format intervention 990 € HT, sur site, partout en France métropolitaine."
      : "1-on-1 day with the executive to structure the company around AI and quantify implementation gains. Intervention format €990 ex. VAT, on site, anywhere in metropolitan France.",
    serviceType: isFr ? "Coaching dirigeant IA" : "Executive AI coaching",
    priceEur: entryTier.priceFlat ?? 990,
  });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs
          items={[{ href: path, label: isFr ? "Accompagnement 1-to-1" : "1-to-1 coaching" }]}
        />
      </Container>

      <Section
        titleAs="h1"
        eyebrow={isFr ? "Accompagnement IA 1-to-1 (dirigeant)" : "1-to-1 AI coaching (executive)"}
        title={isFr ? "Journée 1-to-1" : "1-to-1 day"}
        titleEm={isFr ? "avec le dirigeant" : "with the executive"}
        description={
          isFr
            ? "Une journée sur site, en tête-à-tête avec le dirigeant, pour cartographier les leviers IA, prioriser les gains rapides et chiffrer un plan d'implémentation 90 jours. Sans engagement, sans plan sur-mesure préfabriqué."
            : "A day on site, one-on-one with the executive, to map AI leverage points, prioritize quick wins, and quantify a 90-day implementation plan. No commitment, no pre-built bespoke plan."
        }
      >
        <Container className="text-fg max-w-3xl">
          <p data-aeo="tldr" className="tldr-answer mb-6 text-lg leading-relaxed">
            {isFr
              ? `Axion-IA propose une journée d'accompagnement 1-to-1 avec le dirigeant (TPE, PME, ETI, grande entreprise) à ${formattedPrice}. Sur site, en France métropolitaine. Livrable : feuille de route 90 jours chiffrée + identification des 3 chantiers IA prioritaires.`
              : `Axion-IA offers a 1-on-1 day with the executive (micro/SMB/mid-cap/enterprise) at ${formattedPrice}. On site, anywhere in metropolitan France. Deliverable: costed 90-day roadmap + identification of 3 priority AI projects.`}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Cta href="/contact" variant="primary" size="lg" shape="pill">
              {isFr ? "Réserver une journée" : "Book a day"}
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href={"/interventions" as never} variant="ghost" size="lg" shape="pill">
              {isFr ? "Voir les autres interventions" : "See other sessions"}
            </Cta>
          </div>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "Pour qui ?" : "Who for?"}
        title={isFr ? "Dirigeants concernés" : "Executives targeted"}
        tone="sand"
      >
        <Container className="text-fg max-w-3xl space-y-5 text-lg leading-relaxed">
          <p>
            {isFr
              ? "Dirigeant·e de TPE, PME, ETI ou grande entreprise qui veut sortir du brouillard IA, arrêter d'écouter des consultants en costume qui parlent buzzwords, et mesurer concrètement ce que l'IA peut apporter à son business — sans déléguer la décision aux équipes IT."
              : "Executive of a micro, SMB, mid-cap or enterprise company who wants to clear the AI fog, stop listening to suit-wearing consultants speaking buzzwords, and measure concretely what AI can bring to the business — without delegating the decision to the IT teams."}
          </p>
        </Container>
      </Section>

      <Section
        eyebrow={isFr ? "Format" : "Format"}
        title={isFr ? "Comment ça se passe" : "How it works"}
      >
        <Container className="max-w-3xl">
          <ol className="text-fg list-decimal space-y-4 pl-6 text-lg leading-relaxed">
            <li>
              <strong>{isFr ? "Préparation" : "Preparation"}</strong>{" "}
              {isFr
                ? "(15 min en visio, gratuit). Cadrage du contexte et des enjeux dirigeant — ce que vous voulez résoudre concrètement."
                : "(15 min remote, free). Context and executive stakes scoping — what you want to solve concretely."}
            </li>
            <li>
              <strong>{isFr ? "Journée sur site" : "On-site day"}</strong>{" "}
              {isFr
                ? "(~7 h). Cartographie des processus, identification des 3 chantiers IA prioritaires, chiffrage gains et investissement."
                : "(~7 h). Process mapping, identification of 3 priority AI projects, gain and investment quantification."}
            </li>
            <li>
              <strong>{isFr ? "Livrable" : "Deliverable"}</strong>{" "}
              {isFr
                ? "(remis sous 5 jours ouvrés). Feuille de route 90 jours chiffrée — vous gardez la main, libre d'implémenter avec votre équipe, un autre prestataire ou Axion-IA."
                : "(delivered within 5 business days). Costed 90-day roadmap — you keep control, free to implement with your team, another provider or Axion-IA."}
            </li>
          </ol>
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "Prêt à clarifier votre IA ?" : "Ready to clarify your AI?"}
        description={
          isFr
            ? `${formattedPrice}, sans engagement, partout en France métropolitaine. Réservation directe via le formulaire de contact.`
            : `${formattedPrice}, no commitment, anywhere in metropolitan France. Direct booking via the contact form.`
        }
        cta={
          <Cta href="/contact" size="lg">
            {isFr ? "Réserver une journée 1-to-1" : "Book a 1-on-1 day"}
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={serviceJsonLd} />
    </>
  );
}
