import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Code2, Globe, Layers, Sparkles, Zap } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata, buildServiceJsonLd } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: "/codage-developpement",
    title: isFr
      ? "Plateformes web & digital augmentées par l'IA | Axion-IA"
      : "AI-augmented web & digital platforms | Axion-IA",
    description: isFr
      ? "Axion-IA conçoit des plateformes web sur mesure IA-natives ou augmente vos applications existantes. Toute stack moderne. Agents, automatisations, chatbot RAG, search sémantique."
      : "Axion-IA builds AI-native custom web platforms or augments your existing applications. Any modern stack. Agents, automations, RAG chatbot, semantic search.",
  });
}

export default async function CodageDeveloppementHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumbItems = [
    {
      href: "/codage-developpement" as const,
      label: isFr ? "Web & Digital IA" : "Web & Digital AI",
    },
  ];

  const offers = isFr
    ? [
        {
          icon: Layers,
          tag: "Nouvelle plateforme",
          title: "Plateforme sur mesure IA-native",
          description:
            "On conçoit et développe votre plateforme de A à Z avec l'IA intégrée dès la conception : agents autonomes, automatisations métier, search sémantique, chatbot. Toute stack — on s'adapte à votre contexte.",
          href: "/codage-developpement/web-digital",
          cta: "En savoir plus",
          accent: true,
        },
        {
          icon: Zap,
          tag: "Plateforme existante",
          title: "Augmentation IA sans refonte",
          description:
            "Votre plateforme fonctionne — on y greffe les briques IA qui manquent : chatbot RAG, recherche sémantique, personnalisation, agents. Zéro downtime, toute stack avec API.",
          href: "/codage-developpement/web-digital",
          cta: "En savoir plus",
          accent: false,
        },
      ]
    : [
        {
          icon: Layers,
          tag: "New platform",
          title: "AI-native custom platform",
          description:
            "We design and build your platform from scratch with AI integrated from day one: autonomous agents, business automations, semantic search, chatbot. Any stack — we adapt to your context.",
          href: "/codage-developpement/web-digital",
          cta: "Learn more",
          accent: true,
        },
        {
          icon: Zap,
          tag: "Existing platform",
          title: "AI augmentation without rebuild",
          description:
            "Your platform works — we graft the missing AI bricks onto it: RAG chatbot, semantic search, personalization, agents. Zero downtime, any API-enabled stack.",
          href: "/codage-developpement/web-digital",
          cta: "Learn more",
          accent: false,
        },
      ];

  const features = isFr
    ? [
        { icon: Code2, label: "Toute stack moderne — on s'adapte" },
        { icon: Globe, label: "RGPD natif · hébergement EU" },
        { icon: Sparkles, label: "IA intégrée dès le 1er sprint" },
        { icon: ArrowRight, label: "Forfait fixe · devis ferme 48 h" },
      ]
    : [
        { icon: Code2, label: "Any modern stack — we adapt" },
        { icon: Globe, label: "GDPR native · EU hosting" },
        { icon: Sparkles, label: "AI from the 1st sprint" },
        { icon: ArrowRight, label: "Fixed fee · firm quote 48 h" },
      ];

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/codage-developpement",
    name: isFr
      ? "Plateformes web & digital augmentées par l'IA · Axion-IA"
      : "AI-augmented web & digital platforms · Axion-IA",
    description: isFr
      ? "Conception de plateformes web sur mesure IA-natives et augmentation de plateformes existantes. Agents, automatisations, chatbot RAG, search sémantique. Toute stack moderne."
      : "AI-native custom web platform design and augmentation of existing platforms. Agents, automations, RAG chatbot, semantic search. Any modern stack.",
    serviceType: "AI web platform development",
  });

  return (
    <>
      <JsonLd data={serviceJsonLd} />

      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO */}
      <section className="bg-halo-warm text-fg relative overflow-hidden pt-12 pb-20 sm:pt-14 sm:pb-24 lg:pt-16 lg:pb-28">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border-strong) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            maskImage: "radial-gradient(ellipse at center, white 20%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, white 20%, transparent 75%)",
            opacity: 0.18,
          }}
        />
        <Container className="relative max-w-3xl">
          <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
            <span
              aria-hidden="true"
              className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
            />
            {isFr ? "Web & Digital · augmentés par l'IA" : "Web & Digital · AI-augmented"}
          </p>

          <h1 className="display-editorial text-fg mt-5">
            {isFr ? "Des plateformes web qui" : "Web platforms that"}
            <span
              className="text-terracotta mx-2 italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "pensent et agissent." : "think and act."}
            </span>
          </h1>

          <p className="text-fg-soft mt-6 text-lg leading-relaxed sm:text-xl">
            {isFr
              ? "On construit votre plateforme sur mesure avec l'IA intégrée dès la conception — ou on augmente ce que vous avez déjà. Agents autonomes, automatisations, chatbot RAG, search sémantique. Toute stack, on s'adapte."
              : "We build your custom platform with AI integrated from day one — or we augment what you already have. Autonomous agents, automations, RAG chatbot, semantic search. Any stack, we adapt."}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Cta href="/contact" size="lg" track="codage-hub-hero-primary">
              {isFr ? "Décrire mon projet · devis 48 h" : "Describe my project · quote 48 h"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/audit" variant="outline" size="lg" track="codage-hub-hero-audit">
              {isFr ? "Commencer par un audit" : "Start with an audit"}
            </Cta>
          </div>
        </Container>
      </section>

      {/* RÉASSURANCE */}
      <section className="bg-paper border-border border-y py-8">
        <Container>
          <ul className="grid grid-cols-2 gap-x-8 gap-y-5 lg:grid-cols-4">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.label} className="flex items-center gap-3">
                  <span className="bg-terracotta-soft text-terracotta-deep flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span className="text-fg text-sm leading-snug font-medium">{f.label}</span>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* DEUX OFFRES */}
      <Section
        eyebrow={isFr ? "Deux approches" : "Two approaches"}
        title={isFr ? "Nouvelle plateforme ou" : "New platform or"}
        titleEm={isFr ? "existante" : "existing"}
        description={
          isFr
            ? "Dans les deux cas, l'IA est au cœur — pas en option."
            : "In both cases, AI is at the core — not an option."
        }
      >
        <ul className="grid gap-6 md:grid-cols-2">
          {offers.map((offer) => {
            const Icon = offer.icon;
            return (
              <li
                key={offer.title}
                className={
                  offer.accent
                    ? "border-terracotta bg-paper ring-terracotta/20 flex flex-col gap-5 rounded-2xl border-2 p-8 ring-4"
                    : "border-border bg-paper flex flex-col gap-5 rounded-2xl border p-8"
                }
              >
                <div className="flex items-start gap-4">
                  <span
                    className={
                      offer.accent
                        ? "bg-terracotta-soft text-terracotta-deep flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                        : "bg-fg/5 text-fg-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                    }
                  >
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-fg-muted text-[11px] font-semibold tracking-[0.16em] uppercase">
                      {offer.tag}
                    </p>
                    <h2
                      className={
                        offer.accent
                          ? "text-terracotta-deep mt-1 text-2xl leading-tight font-medium"
                          : "text-fg mt-1 text-2xl leading-tight font-medium"
                      }
                      style={{ fontFamily: "var(--font-serif)" }}
                    >
                      {offer.title}
                    </h2>
                  </div>
                </div>
                <p className="text-fg-soft text-base leading-relaxed">{offer.description}</p>
                <div className="mt-auto">
                  <Cta
                    href={offer.href as never}
                    size="sm"
                    variant={offer.accent ? "primary" : "outline"}
                    track={offer.accent ? "codage-hub-new" : "codage-hub-existing"}
                  >
                    {offer.cta}
                    <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                  </Cta>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* CTA FINAL */}
      <section className="bg-mocha-rich py-16 sm:py-20">
        <Container className="max-w-2xl text-center">
          <p className="text-mocha-fg/60 mb-4 text-[12px] font-semibold tracking-[0.18em] uppercase">
            {isFr ? "Prêt à démarrer" : "Ready to start"}
          </p>
          <h2
            className="text-mocha-fg text-3xl leading-tight font-medium sm:text-4xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? "Dites-nous ce que vous voulez" : "Tell us what you want"}
            <span className="text-terracotta-soft mx-2 italic">
              {isFr ? "construire." : "to build."}
            </span>
          </h2>
          <p className="text-mocha-fg/70 mt-4 text-base leading-relaxed">
            {isFr
              ? "Devis ferme en 48 h. Forfait fixe. Vous êtes propriétaire du code."
              : "Firm quote in 48 h. Fixed fee. You own the code."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Cta href="/contact" size="lg" track="codage-hub-final">
              {isFr ? "Décrire mon projet" : "Describe my project"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href="/codage-developpement/web-digital"
              size="lg"
              variant="outline"
              track="codage-hub-detail"
            >
              {isFr ? "Voir le détail Web & Digital" : "See Web & Digital details"}
            </Cta>
          </div>
        </Container>
      </section>
    </>
  );
}
