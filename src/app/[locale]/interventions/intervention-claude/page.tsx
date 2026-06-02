import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { MessageSquare, FolderKanban, TerminalSquare } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { FormationContactBand } from "@/components/services/formation/FormationContactBand";
import { FormationSubPageExtras } from "@/components/services/formation/FormationSubPageExtras";
import { DetailHeroSchema } from "@/components/sections/DetailHeroSchema";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { getIntervention } from "@/content/interventions";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildFaqJsonLd,
  buildImageGraphJsonLd,
} from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const intervention = getIntervention("intervention-claude");
  const c = intervention[locale as Locale];
  return buildProductMetadata({
    locale,
    path: locale === "fr" ? intervention.pathFr : intervention.pathEn,
    title: c.metaSeo.title,
    description: c.metaSeo.description,
    alternates: { fr: intervention.pathFr, en: intervention.pathEn },
  });
}

export default async function FormationClaude({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const intervention = getIntervention("intervention-claude");
  const copy = intervention[loc];
  const path = loc === "fr" ? intervention.pathFr : intervention.pathEn;
  const isFr = loc === "fr";
  // ImageObject @graph — Sprint AEO Phase 5 2026-05-28 (Will). Photo équipe
  // + portrait fondateur pour exposition Google Images + AI Overviews sur
  // requêtes « formation Claude Anthropic », « maîtriser Claude Code CLI entreprise ».
  const imagesJsonLd = buildImageGraphJsonLd({
    locale: loc,
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        name: isFr
          ? "Équipe Axion-IA — formation Claude (Anthropic) pour entreprises"
          : "Axion-IA team — Claude (Anthropic) training for companies",
        alt: isFr
          ? "Équipe Axion-IA en journée de formation Claude — cabinet IA opérationnel français accompagnant TPE et PME sur les 3 surfaces Claude (chat, Projects/Cowork, Code CLI), bibliothèque de prompts métier."
          : "Axion-IA team in Claude training day — French operational AI consultancy supporting small businesses and SMEs on Claude's 3 surfaces (chat, Projects/Cowork, Code CLI), business prompt library.",
        width: 1961,
        height: 802,
        encodingFormat: "image/avif",
      },
      {
        src: "/illustrations/home-founder-william.avif",
        name: isFr
          ? "William — Fondateur Axion-IA, formateur Claude Anthropic"
          : "William — Axion-IA founder, Claude Anthropic trainer",
        alt: isFr
          ? "Portrait de William, fondateur d'Axion-IA. Anime personnellement les formations Claude pour équipes TPE et PME — prompts experts, Projects multi-documents, Claude Code pour équipes tech."
          : "Portrait of William, Axion-IA founder. Personally runs Claude trainings for small business and SME teams — expert prompts, multi-document Projects, Claude Code for tech teams.",
        width: 800,
        height: 1000,
        encodingFormat: "image/avif",
      },
    ],
  });
  const jsonLd = [
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: "Claude (Anthropic) tool-specific training",
    }),
    buildFaqJsonLd({ items: copy.faqs }),
    imagesJsonLd,
  ];
  const breadcrumbItems = [
    {
      href: "/interventions",
      label: isFr ? "Interventions entreprise" : "Corporate AI sessions",
    },
    { href: "/interventions/intervention-claude", label: copy.title },
  ];
  const heroSchema = (
    <DetailHeroSchema
      eyebrow={isFr ? "Une journée type" : "A typical day"}
      title={isFr ? "Maîtriser Claude en 3 volets" : "Master Claude in 3 tracks"}
      accent="orange"
      blocks={[
        {
          icon: MessageSquare,
          prefix: isFr ? "Matin" : "Morning",
          label: isFr ? "Chat" : "Chat",
          detail: isFr
            ? "Rédaction, analyse, synthèse — prompts longs structurés, system prompts."
            : "Writing, analysis, synthesis — long structured prompts, system prompts.",
        },
        {
          icon: FolderKanban,
          prefix: isFr ? "Midi" : "Noon",
          label: isFr ? "Cowork" : "Cowork",
          detail: isFr
            ? "Projects, fichiers attachés, mémoire de projet, workflows multi-documents."
            : "Projects, file attachments, project memory, multi-document workflows.",
        },
        {
          icon: TerminalSquare,
          prefix: isFr ? "Après-midi" : "Afternoon",
          label: isFr ? "Code (CLI)" : "Code (CLI)",
          detail: isFr
            ? "Claude Code CLI : génération, refactoring, intégration git — pour équipes tech."
            : "Claude Code CLI: generation, refactoring, git integration — for tech teams.",
        },
      ]}
      ariaLabel={
        isFr
          ? "Schéma : journée type Intervention Claude — matin Chat, midi Cowork (Projects), après-midi Code (CLI)."
          : "Diagram: typical Claude Training day — morning Chat, noon Cowork (Projects), afternoon Code (CLI)."
      }
    />
  );

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <ProductPageTemplate
        isFr={isFr}
        accent="orange"
        copy={copy}
        ctaPrimaryHref="/reserver?intervention=intervention-claude"
        ctaSecondaryHref="/interventions/essentielle"
        heroSchema={heroSchema}
        midBand={<FormationContactBand isFr={isFr} />}
        jsonLd={jsonLd}
      />
      <FormationSubPageExtras isFr={isFr} slug="intervention-claude" />
    </>
  );
}
