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
import { Illustration } from "@/components/visual/Illustration";
import { ABOUT_TIMELINE, ABOUT_TEAM } from "@/content/transversal";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, buildPersonJsonLd } from "@/lib/seo";

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

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/a-propos", label: isFr ? "À propos" : "About" }];

  // Person JSON-LD — E-E-A-T 2026 (Will fondateur identifié auprès des
  // answer engines : Google AI Overviews + Claude.ai + Perplexity + Bing
  // Copilot citent davantage les sources qui exposent un humain identifié
  // qu'une Organization faceless).
  const personJsonLd = buildPersonJsonLd({ locale: loc });

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "À propos" : "About"}
        title={isFr ? "Cabinet IA" : "Operational AI"}
        titleEm={isFr ? "opérationnel" : "consultancy"}
        description={
          isFr
            ? "AxionIA accompagne les entreprises dans l'identification, la démonstration et l'implémentation d'usages IA générant un ROI mesurable. Hébergement UE."
            : "AxionIA helps companies identify, demonstrate and implement AI use cases generating measurable ROI. EU hosting."
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
        <Container className="max-w-5xl">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-14">
            <div className="text-fg space-y-6 text-lg leading-relaxed">
              <p>
                <strong>{isFr ? "Opérationnel d'abord." : "Operational first."}</strong>{" "}
                {isFr
                  ? "Aucune intervention sans démonstration sur vos données réelles."
                  : "No engagement without a live demo on your real data."}
              </p>
              <p>
                <strong>{isFr ? "ROI mesurable." : "Measurable ROI."}</strong>{" "}
                {isFr
                  ? "Plan d'action chiffré priorisé, support post-livraison inclus."
                  : "Costed prioritised action plan, post-delivery support included."}
              </p>
              <p>
                <strong>{isFr ? "Souveraineté." : "Sovereignty."}</strong>{" "}
                {isFr
                  ? "Hébergement UE par défaut, modèles open-source quand pertinent."
                  : "EU hosting by default, open-source models when relevant."}
              </p>
            </div>
            <Illustration
              slot="APROPOS-02-mid"
              aspectRatio="1:1"
              filenameTarget="public/illustrations/a-propos-mid-1.avif"
              caption={
                isFr
                  ? "Atelier d'architecte — précision, traces de craie, plan ouvert"
                  : "Architect's workshop — precision, chalk traces, open blueprint"
              }
              alt={
                isFr
                  ? "Illustration éditoriale d'un atelier d'architecte symbolisant la précision opérationnelle d'AxionIA."
                  : "Editorial illustration of an architect's workshop symbolizing AxionIA's operational precision."
              }
            />
          </div>
        </Container>
      </Section>

      <Section tone="canvas">
        <Container className="max-w-3xl">
          <Illustration
            slot="APROPOS-03-closing"
            aspectRatio="16:9"
            filenameTarget="public/illustrations/a-propos-closing.avif"
            caption={
              isFr
                ? "Cabinet IA opérationnel — vue éditoriale d'un système en marche"
                : "Operational AI consultancy — editorial view of a system at work"
            }
            alt={
              isFr
                ? "Illustration éditoriale d'un cabinet IA opérationnel en activité — vue d'ensemble du système AxionIA."
                : "Editorial illustration of an operational AI consultancy at work — overview of the AxionIA system."
            }
          />
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

      <JsonLd data={personJsonLd} />
    </>
  );
}
