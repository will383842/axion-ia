import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, ShieldCheck, Building2, Calendar, Globe2 } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { TimelineBlock } from "@/components/sections/TimelineBlock";
import { TeamGrid } from "@/components/sections/TeamGrid";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { AboutHeroSchema } from "@/components/sections/AboutHeroSchema";
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

      {/* HERO 2-col custom — texte à gauche, AboutHeroSchema à droite */}
      <section className="bg-halo-warm text-fg relative py-20 sm:py-24 lg:py-28">
        <Container className="relative">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16">
            <div className="max-w-xl">
              <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
                />
                {isFr ? "À propos" : "About"}
              </p>
              <h1 className="display-editorial text-fg mt-5">
                {isFr ? "Cabinet IA " : "Operational AI "}
                <span
                  className="text-terracotta italic"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {isFr ? "opérationnel" : "consultancy"}
                </span>
              </h1>
              <p className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl">
                {isFr
                  ? "AxionIA accompagne les entreprises dans l'identification, la démonstration et l'implémentation d'usages IA générant un ROI mesurable. Hébergement UE, méthode documentée, livrables actionnables."
                  : "AxionIA helps companies identify, demonstrate and implement AI use cases generating measurable ROI. EU hosting, documented method, actionable deliverables."}
              </p>
              {/* Pills réassurance */}
              <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5">
                {[
                  { icon: Building2, label: "AxionIA OÜ · Tallinn" },
                  { icon: ShieldCheck, label: isFr ? "Hébergement UE" : "EU hosting" },
                  { icon: Calendar, label: isFr ? "Fondé 2024" : "Founded 2024" },
                  { icon: Globe2, label: isFr ? "FR · EN · UE" : "FR · EN · EU" },
                ].map((pill) => {
                  const Icon = pill.icon;
                  return (
                    <li
                      key={pill.label}
                      className="text-fg-soft inline-flex items-center gap-2 text-sm"
                    >
                      <Icon
                        aria-hidden="true"
                        className="text-terracotta h-4 w-4"
                        strokeWidth={2}
                      />
                      <span>{pill.label}</span>
                    </li>
                  );
                })}
              </ul>
              {/* CTAs hero */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Cta href="/interventions/essentielle" size="lg">
                  {isFr ? "Voir l'Essentielle 490 €" : "See the Essential €490"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta href="/audit" variant="outline" size="lg">
                  {isFr ? "Demander un audit" : "Request an audit"}
                </Cta>
              </div>
            </div>
            <AboutHeroSchema
              isFr={isFr}
              className="hero-schema"
              ariaLabel={
                isFr
                  ? "Schéma : doctrine AxionIA en 3 piliers — opérationnel d'abord, ROI mesurable, souveraineté UE."
                  : "Diagram: AxionIA doctrine in 3 pillars — operational first, measurable ROI, EU sovereignty."
              }
            />
          </div>
        </Container>
      </section>

      {/* Pillar copy — pourquoi AxionIA */}
      <Section eyebrow={isFr ? "Pourquoi AxionIA" : "Why AxionIA"} tone="paper">
        <Container className="max-w-3xl">
          <p className="text-fg-soft text-lg leading-relaxed">
            {isFr
              ? "Le marché de l'IA d'entreprise en 2026 est saturé de promesses non tenues. Pilotes qui ne passent jamais en production. Démos époustouflantes sur des données fabriquées. Factures longues comme un bras pour des outils sans ROI mesurable. AxionIA prend le contre-pied : aucune intervention sans démonstration sur vos données réelles, aucun devis sans plan d'action chiffré priorisé, aucun déploiement sans support post-livraison. Cabinet IA opérationnel signifie : on travaille dans vos process, pas à côté. Tallinn, Estonie : siège choisi pour la stabilité juridique UE et l'agilité fiscale, opérations 100 % à distance pour la France et l'UE."
              : "The enterprise AI market in 2026 is saturated with broken promises. Pilots that never reach production. Stunning demos on fabricated data. Long invoices for tools without measurable ROI. AxionIA takes the opposite stance: no engagement without a live demo on your real data, no quote without a costed prioritised action plan, no deployment without post-delivery support. Operational AI consultancy means: we work inside your processes, not next to them. Tallinn, Estonia: HQ chosen for EU legal stability and fiscal agility, 100% remote operations for France and the EU."}
          </p>
        </Container>
      </Section>

      {/* Proof — chiffres clés */}
      <Section eyebrow={isFr ? "Repères" : "Key figures"} tone="sand">
        <Container>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                figure: "2024",
                label: isFr ? "Création OÜ" : "OÜ founded",
                detail: isFr
                  ? "Société estonienne fondée à Tallinn."
                  : "Estonian company founded in Tallinn.",
              },
              {
                figure: "100 %",
                label: isFr ? "Hébergement UE" : "EU hosting",
                detail: isFr
                  ? "Données stockées sur Hetzner Frankfurt."
                  : "Data hosted on Hetzner Frankfurt.",
              },
              {
                figure: "48 h",
                label: isFr ? "Réponse devis" : "Quote reply",
                detail: isFr
                  ? "Sous 48 heures ouvrées, par un humain."
                  : "Within 48 business hours, by a human.",
              },
              {
                figure: "30 j",
                label: isFr ? "Support inclus" : "Support included",
                detail: isFr
                  ? "Maintenance corrective post-livraison incluse."
                  : "Post-delivery corrective maintenance included.",
              },
            ].map((stat) => (
              <div
                key={stat.figure}
                className="border-border bg-paper shadow-subtle rounded-2xl border p-6"
              >
                <p
                  className="text-terracotta text-4xl leading-none font-medium tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {stat.figure}
                </p>
                <p className="text-fg mt-3 text-sm font-semibold tracking-tight">{stat.label}</p>
                <p className="text-fg-soft mt-1.5 text-sm leading-snug">{stat.detail}</p>
              </div>
            ))}
          </div>
        </Container>
      </Section>

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
