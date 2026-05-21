/**
 * Page /transparence — Hub IA Act EU 2026 (méta-cert AGENT 20 P0-2).
 *
 * Consolide la doctrine éparse :
 *  - `/equipe/manon` — persona éditoriale IA disclosed (portrait IA, AI Act art. 50)
 *  - `/politique-confidentialite` §IA générative — base légale + droits RGPD art. 21
 *  - `/sous-processeurs` — liste exhaustive providers IA + DPA + cadre transfert
 *
 * Classification AI Act EU 2024/1689 :
 *  - Art. 50 (transparency) — applicable : factory de contenu éditorial IA-assisté
 *  - Art. 52 (high-risk) — NON applicable : marketing B2B ≠ système haut-risque
 *  - Art. 53 (general-purpose AI) — downstream user (consommateur de GPT-4o, Claude,
 *    Perplexity Sonar) — listés sur /sous-processeurs avec DPA + SCC
 *  - Art. 26 (FRIA) — NON applicable
 *
 * Pas de DB, full server component, ISR statique 1j. Cf. ADR 0024.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Sparkles, ShieldCheck, FileText, Users } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";

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
    path: isFr ? "/transparence" : "/transparency",
    title: isFr
      ? "Transparence IA — AI Act EU art. 50 · Axion-IA"
      : "AI transparency — EU AI Act art. 50 · Axion-IA",
    description: isFr
      ? "Contenus éditoriaux IA-assistés Axion-IA : politique de transparence conforme AI Act EU 2024/1689, persona Manon, sous-processeurs IA, droits RGPD."
      : "Axion-IA AI-assisted editorial content: transparency policy under EU AI Act 2024/1689, Manon persona, AI sub-processors, GDPR rights.",
    alternates: { fr: "/transparence", en: "/transparency" },
  });
}

export default async function TransparencePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const isFr = locale === "fr";

  const breadcrumbItems = [
    {
      href: isFr ? "/transparence" : "/transparency",
      label: isFr ? "Transparence IA" : "AI transparency",
    },
  ];

  const headline = isFr ? "Transparence IA générative" : "Generative AI transparency";
  const tagline = isFr
    ? "Conforme à l'article 50 du Règlement européen sur l'IA (AI Act 2024/1689)."
    : "Compliant with article 50 of the EU AI Act (Regulation 2024/1689).";

  const sections = [
    {
      icon: Sparkles,
      title: isFr ? "Contenus IA-assistés" : "AI-assisted content",
      body: isFr
        ? "Une partie des contenus éditoriaux du site (articles signés Manon, fiches villes, FAQ, guides) est rédigée avec l'assistance de modèles d'IA générative (OpenAI GPT-4o, Anthropic Claude Sonnet 4.6, Perplexity Sonar pour le fact-checking). Chaque contenu est ensuite supervisé par l'équipe Axion-IA avant publication — relecture éditoriale, vérification factuelle, alignement doctrine."
        : "Part of the site's editorial content (articles signed by Manon, city pages, FAQs, guides) is drafted with the assistance of generative AI models (OpenAI GPT-4o, Anthropic Claude Sonnet 4.6, Perplexity Sonar for fact-checking). Each content piece is then supervised by the Axion-IA team prior to publication — editorial review, factual verification, doctrine alignment.",
      links: [
        {
          href: "/equipe/manon",
          label: isFr
            ? "Persona Manon (portrait IA disclosed)"
            : "Manon persona (AI-disclosed portrait)",
        },
      ],
    },
    {
      icon: Users,
      title: isFr ? "Sous-processeurs IA" : "AI sub-processors",
      body: isFr
        ? "OpenAI, Anthropic, Perplexity sont listés exhaustivement sur la page sous-processeurs, avec leur finalité, la catégorie de données traitées (jamais de PII visiteur — helper `pii-safe` + hard gate code), la localisation des serveurs, le statut du DPA et le cadre de transfert international (Clauses Contractuelles Types + Data Privacy Framework le cas échéant)."
        : "OpenAI, Anthropic, Perplexity are listed exhaustively on the sub-processors page, with their purpose, the category of data processed (never visitor PII — `pii-safe` helper + code-level hard gate), server location, DPA status and international transfer framework (Standard Contractual Clauses + Data Privacy Framework where applicable).",
      links: [
        {
          href: "/sous-processeurs",
          label: isFr ? "Liste complète des sous-processeurs" : "Full sub-processors list",
        },
      ],
    },
    {
      icon: ShieldCheck,
      title: isFr ? "Classification AI Act" : "AI Act classification",
      body: isFr
        ? "Axion-IA opère un usage marketing B2B de l'IA générative — pas un système à haut risque au sens de l'art. 52 AI Act EU. Position downstream user de modèles à usage général (art. 53). Aucune décision automatisée affectant des droits fondamentaux (art. 26 FRIA non applicable). Documentation complète : ADR 0024."
        : "Axion-IA operates a B2B marketing use of generative AI — not a high-risk system under EU AI Act art. 52. Downstream user position of general-purpose AI models (art. 53). No automated decision-making affecting fundamental rights (art. 26 FRIA not applicable). Full documentation: ADR 0024.",
      links: [],
    },
    {
      icon: FileText,
      title: isFr ? "Vos droits RGPD" : "Your GDPR rights",
      body: isFr
        ? "Vous pouvez vous opposer à tout traitement de vos données par un modèle IA (RGPD art. 21) en écrivant à contact@axion-ia.com. Les prompts envoyés aux modèles ne contiennent aucune donnée personnelle de visiteur. Droits d'accès, rectification, effacement, opposition, portabilité, limitation garantis — autorité de contrôle compétente : CNIL (France)."
        : "You may object to any processing of your data by an AI model (GDPR art. 21) by writing to contact@axion-ia.com. Prompts sent to models contain no visitor personal data. Rights of access, rectification, erasure, objection, portability, restriction guaranteed — competent supervisory authority: CNIL (France).",
      links: [
        {
          href: "/politique-confidentialite",
          label: isFr ? "Politique de confidentialité complète" : "Full privacy policy",
        },
        {
          href: "/mes-donnees",
          label: isFr ? "Self-service mes données" : "My data self-service",
        },
      ],
    },
  ];

  const url = `${SITE_URL}/${locale}/${isFr ? "transparence" : "transparency"}`;
  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${url}#webpage`,
    url,
    name: headline,
    description: tagline,
    inLanguage: isFr ? "fr-FR" : "en-US",
    isPartOf: { "@id": `${SITE_URL}/#website` },
    about: {
      "@type": "Thing",
      name: "EU AI Act 2024/1689 transparency",
    },
  };

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section
        titleAs="h1"
        eyebrow={isFr ? "AI Act EU art. 50" : "EU AI Act art. 50"}
        title={headline}
        description={tagline}
      />

      <Section>
        <Container className="grid max-w-4xl gap-8 sm:gap-10">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <article key={s.title} className="flex gap-5 sm:gap-6">
                <Icon
                  aria-hidden="true"
                  className="text-terracotta mt-1 h-6 w-6 shrink-0"
                  strokeWidth={1.75}
                />
                <div className="flex flex-col gap-3">
                  <h2 className="text-fg text-xl font-semibold tracking-tight sm:text-2xl">
                    {s.title}
                  </h2>
                  <p className="text-fg-soft text-[15px] leading-relaxed sm:text-base">{s.body}</p>
                  {s.links.length > 0 ? (
                    <ul className="mt-1 flex flex-col gap-1.5">
                      {s.links.map((l) => (
                        <li key={l.href}>
                          <Link
                            href={l.href as never}
                            className="text-terracotta-deep hover:text-terracotta focus-visible:ring-terracotta text-sm font-medium underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                          >
                            {l.label} →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </article>
            );
          })}
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "Une question sur notre usage de l'IA ?" : "A question about our AI usage?"}
        description={
          isFr
            ? "L'équipe Axion-IA répond directement — pas de filtre IA, pas de service client externalisé."
            : "The Axion-IA team replies directly — no AI filter, no outsourced customer service."
        }
        cta={
          <Cta href="/contact" size="lg">
            Contact →
          </Cta>
        }
      />

      <JsonLd data={webPageJsonLd} />
    </>
  );
}
