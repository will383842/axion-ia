import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { TimelineBlock } from "@/components/sections/TimelineBlock";
import { TeamGrid } from "@/components/sections/TeamGrid";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { ABOUT_TIMELINE, ABOUT_TEAM } from "@/content/transversal";
import { buildProductMetadata, buildBreadcrumbJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/a-propos",
    title:
      locale === "fr"
        ? "À propos · cabinet IA opérationnel · AxionIA"
        : "About · operational AI consultancy · AxionIA",
    description:
      locale === "fr"
        ? "AxionIA OÜ — cabinet IA opérationnel pour entreprises. Mission, équipe, valeurs, parcours."
        : "AxionIA OÜ — operational AI consultancy for companies. Mission, team, values, timeline.",
    alternates: { fr: "/a-propos", en: "/about" },
  });
}

export default async function About({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "À propos" : "About", href: "/a-propos" },
    ],
  });

  return (
    <>
      <Section
        eyebrow={isFr ? "À propos" : "About"}
        title={
          isFr
            ? "Cabinet IA opérationnel · OÜ estonienne"
            : "Operational AI consultancy · Estonian OÜ"
        }
        description={
          isFr
            ? "AxionIA accompagne les entreprises dans l'identification, la démonstration et l'implémentation d'usages IA générant un ROI mesurable. Société estonienne, hébergement UE."
            : "AxionIA helps companies identify, demonstrate and implement AI use cases generating measurable ROI. Estonian company, EU hosting."
        }
      />

      <Section eyebrow={isFr ? "Parcours" : "Timeline"}>
        <Container className="max-w-3xl">
          <TimelineBlock
            events={ABOUT_TIMELINE.map((e) => ({
              id: e.id,
              date: e.date,
              title: e[loc].title,
              description: e[loc].description,
            }))}
          />
        </Container>
      </Section>

      <Section eyebrow={isFr ? "Équipe" : "Team"}>
        <TeamGrid
          members={ABOUT_TEAM.map((m) => ({
            id: m.id,
            name: m[loc].name,
            role: m[loc].role,
            bio: m[loc].bio,
          }))}
        />
      </Section>

      <Section eyebrow={isFr ? "Valeurs" : "Values"}>
        <Container className="text-fg max-w-3xl space-y-6 text-lg leading-relaxed">
          <p>
            <strong>{isFr ? "Opérationnel d'abord." : "Operational first."}</strong>{" "}
            {isFr
              ? "Aucune intervention sans démonstration sur vos données réelles."
              : "No engagement without a live demo on your real data."}
          </p>
          <p>
            <strong>{isFr ? "ROI mesurable." : "Measurable ROI."}</strong>{" "}
            {isFr
              ? "Plan d'action chiffré 90 jours, support post-livraison inclus."
              : "Costed 90-day action plan, post-delivery support included."}
          </p>
          <p>
            <strong>{isFr ? "Souveraineté." : "Sovereignty."}</strong>{" "}
            {isFr
              ? "Hébergement UE par défaut, modèles open-source quand pertinent."
              : "EU hosting by default, open-source models when relevant."}
          </p>
        </Container>
      </Section>

      <CtaBlock
        eyebrow={isFr ? "Démarrer" : "Start"}
        title={
          isFr ? "Démarrons par une intervention concrète" : "Let's start with a concrete session"
        }
        description={
          isFr
            ? "L'Essentielle 490 € est conçue pour démarrer vite, sans pré-requis IA."
            : "The Essential €490 is designed to start fast, with no AI prerequisites."
        }
        cta={
          <Cta href="/interventions/essentielle" size="lg">
            {isFr ? "Voir l'Essentielle" : "See the Essential"} →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={breadcrumb} />
    </>
  );
}
