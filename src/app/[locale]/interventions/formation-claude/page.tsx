import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { MessageSquare, FolderKanban, TerminalSquare } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { ProductPageTemplate } from "@/components/sections/ProductPageTemplate";
import { DetailHeroSchema } from "@/components/sections/DetailHeroSchema";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { getIntervention } from "@/content/interventions";
import { buildProductMetadata, buildServiceJsonLd, buildFaqJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const intervention = getIntervention("formation-claude");
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
  const intervention = getIntervention("formation-claude");
  const copy = intervention[loc];
  const path = loc === "fr" ? intervention.pathFr : intervention.pathEn;
  const jsonLd = [
    buildServiceJsonLd({
      locale: loc,
      path,
      name: copy.title,
      description: copy.answer,
      serviceType: "Claude (Anthropic) tool-specific training",
    }),
    buildFaqJsonLd({ items: copy.faqs }),
  ];
  const isFr = loc === "fr";
  const breadcrumbItems = [
    {
      href: "/interventions",
      label: isFr ? "Interventions entreprise" : "Corporate AI sessions",
    },
    { href: "/interventions/formation-claude", label: copy.title },
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
          ? "Schéma : journée type Formation Claude — matin Chat, midi Cowork (Projects), après-midi Code (CLI)."
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
        ctaPrimaryHref="/contact?intervention=formation-claude"
        ctaSecondaryHref="/interventions/essentielle"
        heroSchema={heroSchema}
        jsonLd={jsonLd}
      />
    </>
  );
}
