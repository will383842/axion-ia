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
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildFaqJsonLd,
  buildHowToJsonLd,
  buildItemListJsonLd,
  buildImageGraphJsonLd,
} from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";
// Sprint uniformisation 2026-05-24 (Will) — alignement template /implementation.
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { StickyMobileCta } from "@/components/marketing/StickyMobileCta";
import { ServiceHero } from "@/components/sections/ServiceHero";

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
    alternates: { fr: "/codage-developpement", en: "/codage-developpement" },
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

  const faqs = isFr
    ? [
        {
          id: "q-build-ou-augment",
          question:
            "Comment choisir entre une nouvelle plateforme et l'augmentation de l'existant ?",
          answer:
            "Si votre plateforme actuelle a plus de 5 ans, est difficile à faire évoluer ou ne supporte pas d'API, repartir sur une base IA-native est souvent plus rentable à 18 mois. Si elle fonctionne bien et expose une API, l'augmentation est plus rapide et moins coûteuse. On vous aide à trancher lors du premier appel.",
        },
        {
          id: "q-stack",
          question: "Vous travaillez avec quelle stack technique ?",
          answer:
            "On maîtrise Next.js, Laravel, Django, Rails, Symfony, Vue, React, Angular, Postgres, MySQL, MongoDB et toute stack exposant une API REST ou GraphQL. On s'adapte à votre environnement existant — pas l'inverse.",
        },
        {
          id: "q-ia-dans-plateforme",
          question: "Qu'est-ce que ça veut dire concrètement une plateforme IA-native ?",
          answer:
            "L'IA n'est pas un module ajouté en fin de projet. Elle est intégrée dès la conception : agents autonomes capables d'agir, automatisations des processus métier répétitifs, search sémantique, chatbot RAG formé sur vos données. Résultat : une plateforme qui fait des choses sans qu'un humain ait à les déclencher.",
        },
        {
          id: "q-delai-cout",
          question: "Combien de temps et quel budget prévoir ?",
          answer:
            "Un chatbot RAG greffé sur une plateforme existante : 3 semaines, à partir de 2 000 €. Une plateforme sur mesure complète avec IA intégrée : 6 à 12 semaines, devis sur mesure selon périmètre. Toujours en forfait fixe — pas de régie, pas de dépassement.",
        },
        {
          id: "q-proprio",
          question: "Qui est propriétaire du code et des données ?",
          answer:
            "Vous. Intégralement. Code source, bases de données, modèles IA, configurations — tout est livré dans votre infrastructure. Aucun abonnement mensuel imposé. Si vous nous quittez, la plateforme continue de fonctionner.",
        },
      ]
    : [
        {
          id: "q-build-or-augment",
          question: "How do I choose between a new platform and augmenting the existing one?",
          answer:
            "If your current platform is over 5 years old, hard to evolve or doesn't support an API, an AI-native rebuild is often more cost-effective at 18 months. If it works well and exposes an API, augmentation is faster and cheaper. We help you decide on the first call.",
        },
        {
          id: "q-stack",
          question: "Which tech stack do you work with?",
          answer:
            "We master Next.js, Laravel, Django, Rails, Symfony, Vue, React, Angular, Postgres, MySQL, MongoDB and any stack exposing a REST or GraphQL API. We adapt to your existing environment — not the other way around.",
        },
        {
          id: "q-ai-native",
          question: "What does AI-native platform actually mean?",
          answer:
            "AI is not a module added at the end of the project. It is integrated from day one: autonomous agents capable of acting, automation of repetitive business processes, semantic search, RAG chatbot trained on your data. Result: a platform that does things without a human having to trigger them.",
        },
        {
          id: "q-time-cost",
          question: "How long and what budget should I plan for?",
          answer:
            "A RAG chatbot grafted onto an existing platform: 3 weeks, from €2,000. A complete custom platform with integrated AI: 6 to 12 weeks, custom quote based on scope. Always fixed fee — no time-and-materials, no overruns.",
        },
        {
          id: "q-owner",
          question: "Who owns the code and data?",
          answer:
            "You do. Entirely. Source code, databases, AI models, configurations — everything delivered into your infrastructure. No imposed monthly subscription. If you leave us, the platform keeps running.",
        },
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
    areasServed: buildServiceAreasServed(loc),
  });

  const faqJsonLd = buildFaqJsonLd({ items: faqs });

  const howToJsonLd = buildHowToJsonLd({
    locale: loc,
    path: "/codage-developpement",
    name: isFr
      ? "Comment lancer un projet de plateforme web augmentée par l'IA"
      : "How to launch an AI-augmented web platform project",
    description: isFr
      ? "Les 5 étapes d'Axion-IA pour construire ou augmenter une plateforme web avec l'IA intégrée."
      : "Axion-IA's 5 steps to build or augment a web platform with integrated AI.",
    totalTime: "P6W",
    steps: isFr
      ? [
          {
            name: "Décrire votre besoin",
            text: "Formulaire ou appel rapide. On creuse le contexte, la stack existante et les objectifs.",
          },
          {
            name: "Devis ferme sous 48 h",
            text: "Périmètre précis, modules IA choisis, prix fixe, délai garanti. Sans engagement avant signature.",
          },
          {
            name: "Cadrage technique",
            text: "Validation de la stack, connexion aux APIs existantes, alignement avec vos équipes.",
          },
          {
            name: "Build par sprints",
            text: "Sprints de 1-2 semaines, démos hebdomadaires, validation continue. Pas de tunnel.",
          },
          {
            name: "Livraison + formation incluse",
            text: "Code livré dans votre infra, formation de vos équipes, documentation complète. C'est à vous.",
          },
        ]
      : [
          {
            name: "Describe your need",
            text: "Form or quick call. We dig into context, existing stack and objectives.",
          },
          {
            name: "Firm quote within 48 h",
            text: "Precise scope, chosen AI modules, fixed price, guaranteed timeline. No commitment before signing.",
          },
          {
            name: "Technical framing",
            text: "Stack validation, API connections, alignment with your teams.",
          },
          {
            name: "Sprint-based build",
            text: "1-2 week sprints, weekly demos, continuous validation. No black box.",
          },
          {
            name: "Delivery + included training",
            text: "Code delivered into your infra, team training, full documentation. It's yours.",
          },
        ],
  });

  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/codage-developpement",
    name: isFr
      ? "Services web & digital augmentés par l'IA — Axion-IA"
      : "AI-augmented web & digital services — Axion-IA",
    items: [
      {
        position: 1,
        name: isFr ? "Plateforme sur mesure IA-native" : "AI-native custom platform",
        url: `${isFr ? "/fr" : "/en"}/codage-developpement/web-digital`,
        description: isFr
          ? "Conception et développement d'une plateforme web sur mesure avec l'IA intégrée dès la conception."
          : "Design and development of a custom web platform with AI integrated from day one.",
      },
      {
        position: 2,
        name: isFr
          ? "Augmentation IA de plateforme existante"
          : "AI augmentation of existing platform",
        url: `${isFr ? "/fr" : "/en"}/codage-developpement/web-digital`,
        description: isFr
          ? "Intégration de briques IA (chatbot RAG, search sémantique, agents) sur votre plateforme existante sans refonte."
          : "Integration of AI bricks (RAG chatbot, semantic search, agents) onto your existing platform without a rebuild.",
      },
    ],
  });

  // ImageObject @graph — Sprint AEO Phase 4 2026-05-28 (Will). Photo équipe
  // + portrait fondateur pour exposition Google Images + AI Overviews sur
  // requêtes « développement plateforme IA », « SaaS native IA »,
  // « agents IA conversationnels développeur France ».
  const codageImagesJsonLd = buildImageGraphJsonLd({
    locale: loc,
    images: [
      {
        src: "/illustrations/home-bandeau-team.avif",
        name: isFr
          ? "Équipe Axion-IA — développement plateformes IA et SaaS native IA"
          : "Axion-IA team — AI platform and AI-native SaaS development",
        alt: isFr
          ? "Équipe Axion-IA en session de développement plateforme IA — Next.js, agents IA conversationnels, RAG, intégrations CRM/ERP pour TPE, PME, ETI et grandes entreprises françaises. Mode full-remote ou hybride."
          : "Axion-IA team in AI platform development session — Next.js, conversational AI agents, RAG, CRM/ERP integrations for French SMEs, mid-caps and large enterprises. Full-remote or hybrid mode.",
        width: 1961,
        height: 802,
        encodingFormat: "image/avif",
      },
      {
        src: "/illustrations/home-founder-william.avif",
        name: isFr
          ? "William — Fondateur Axion-IA et architecte plateformes IA"
          : "William — Axion-IA founder and AI platform architect",
        alt: isFr
          ? "Portrait de William, fondateur d'Axion-IA. Pilote le développement de plateformes IA et SaaS native IA pour dirigeants TPE, PME, ETI et grandes entreprises françaises — code, revues, démos hebdo en visio, kick-off sur site."
          : "Portrait of William, Axion-IA founder. Drives AI platform and AI-native SaaS development for French SME, mid-cap and large enterprise executives — code, reviews, weekly video demos, on-site kick-off.",
        width: 800,
        height: 1000,
        encodingFormat: "image/avif",
      },
    ],
  });

  return (
    <>
      {/* V-04 P1 (Sprint Correctif suite 2026-05-22) — Service inline (SEO racine
          critique), 3 schemas secondaires différés afterInteractive (-200 à
          -350 ms TBT, page lourde 4 schemas). */}
      <JsonLd data={serviceJsonLd} />
      <JsonLd data={codageImagesJsonLd} />
      <JsonLd
        data={faqJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-codage-developpement-faq"
      />
      <JsonLd
        data={howToJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-codage-developpement-howto"
      />
      <JsonLd
        data={itemListJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-codage-developpement-itemlist"
      />

      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO 2 colonnes — Sprint Uniformisation héros 2026-05-24 (Will) */}
      <ServiceHero
        eyebrow={isFr ? "Module 3B · Web & Digital IA" : "Module 3B · Web & Digital AI"}
        title={isFr ? "Des plateformes web qui" : "Web platforms that"}
        titleEm={isFr ? "pensent et agissent" : "think and act"}
        description={
          isFr
            ? "On construit votre plateforme sur mesure avec l'IA intégrée dès la conception — ou on augmente ce que vous avez déjà. Agents autonomes, automatisations, chatbot RAG, search sémantique. Toute stack, on s'adapte."
            : "We build your custom platform with AI integrated from day one — or we augment what you already have. Autonomous agents, automations, RAG chatbot, semantic search. Any stack, we adapt."
        }
        ctas={
          <>
            <Cta href="/contact" size="lg" track="codage-hub-hero-primary">
              {isFr ? "Décrire mon projet · devis 48 h" : "Describe my project · quote 48 h"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/audit" variant="outline" size="lg" track="codage-hub-hero-audit">
              {isFr ? "Commencer par un audit" : "Start with an audit"}
            </Cta>
          </>
        }
        schemaCenterLabel={isFr ? "Votre plateforme" : "Your platform"}
        schemaAriaLabel={
          isFr
            ? "Schéma : votre plateforme au centre, entourée des 8 couches IA modulaires (chatbot RAG, search sémantique, agents autonomes, automatisations, génération contenu, vision IA, recommandation, analytics)."
            : "Diagram: your platform at the center, surrounded by 8 modular AI layers (RAG chatbot, semantic search, autonomous agents, automations, content generation, AI vision, recommendation, analytics)."
        }
        schemaNodes={[
          {
            label: isFr ? "Chatbot RAG" : "RAG chatbot",
            benefit: isFr ? "Vos docs en assistant" : "Your docs as assistant",
            accent: "terracotta",
          },
          {
            label: isFr ? "Search sémantique" : "Semantic search",
            benefit: isFr ? "Trouver par sens" : "Find by meaning",
            accent: "primary",
          },
          {
            label: isFr ? "Agents IA" : "AI agents",
            benefit: isFr ? "Workflows autonomes" : "Autonomous workflows",
            accent: "sage",
          },
          {
            label: "Automatisations",
            benefit: isFr ? "Make, n8n, Zapier" : "Make, n8n, Zapier",
            accent: "mocha",
          },
          {
            label: isFr ? "Génération" : "Generation",
            benefit: isFr ? "Texte, image, code" : "Text, image, code",
            accent: "terracotta",
          },
          {
            label: "Vision IA",
            benefit: isFr ? "OCR, classification" : "OCR, classification",
            accent: "primary",
          },
          {
            label: "Recommandation",
            benefit: isFr ? "Cross-sell, perso" : "Cross-sell, perso",
            accent: "sage",
          },
          {
            label: "Analytics",
            benefit: isFr ? "Insights live" : "Live insights",
            accent: "mocha",
          },
        ]}
      />

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

      {/* MÉTHODOLOGIE — 4 étapes (Sprint uniformisation 2026-05-24) */}
      <Section
        eyebrow={isFr ? "Méthodologie" : "Methodology"}
        title={isFr ? "Du brief à la production" : "From brief to production"}
        titleEm={isFr ? "en 4 étapes" : "in 4 steps"}
      >
        <Container>
          <ProcessSteps
            orientation="horizontal"
            steps={[
              {
                id: "step-1-cadrage",
                title: isFr ? "Cadrage 48 h" : "48-h scoping",
                description: isFr
                  ? "Devis ferme sous 48 h après brief : périmètre, stack, intégrations IA, planning et prix forfaitaire fixé d'avance."
                  : "Firm quote within 48 h after brief: scope, stack, AI integrations, timeline and fixed flat fee set in advance.",
              },
              {
                id: "step-2-conception",
                title: isFr ? "Conception" : "Design",
                description: isFr
                  ? "Maquettes UX/UI + architecture technique + cahier des charges IA (modèles, RAG, agents). Validation client avant tout build."
                  : "UX/UI mockups + technical architecture + AI specs (models, RAG, agents). Client validation before any build.",
              },
              {
                id: "step-3-build",
                title: isFr ? "Build & intégration IA" : "Build & AI integration",
                description: isFr
                  ? "Développement Next.js / Astro / framework choisi + intégration des couches IA (chatbot RAG, search sémantique, automatisations, agents)."
                  : "Next.js / Astro / chosen framework development + AI layers integration (RAG chatbot, semantic search, automations, agents).",
              },
              {
                id: "step-4-livraison",
                title: isFr ? "Livraison & passation" : "Delivery & handover",
                description: isFr
                  ? "Mise en production, tests UX, formation équipe interne. Vous êtes propriétaire du code (Git, hébergement). Support 30 j inclus."
                  : "Production deployment, UX tests, internal team training. You own the code (Git, hosting). 30-day support included.",
              },
            ]}
          />
        </Container>
      </Section>

      {/* COUVERTURE NATIONALE */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="Le développement web & digital IA"
        serviceLabelEn="AI web & digital development"
        serviceSlug="codage-developpement"
        tone="sand"
      />

      {/* FAQ GÉOLOCALISÉE GEO */}
      <LocalGeoFaqSection isFr={isFr} service="codage-developpement" tone="paper" />

      {/* FAQ AEO */}
      <Section
        tone="paper"
        eyebrow={isFr ? "Vos questions" : "Your questions"}
        title={isFr ? "Réponses" : "Straight"}
        titleEm={isFr ? "directes" : "answers"}
      >
        <FaqAccordion items={faqs} className="mx-auto max-w-3xl" />
      </Section>

      {/* CTA FINAL — composant centralise CtaBlock (Sprint uniformisation) */}
      <CtaBlock
        eyebrow={isFr ? "Prêt à démarrer" : "Ready to start"}
        title={isFr ? "Dites-nous ce que vous voulez" : "Tell us what you want"}
        titleEm={isFr ? "construire" : "to build"}
        titleTail="."
        description={
          isFr
            ? "Devis ferme en 48 h. Forfait fixe. Vous êtes propriétaire du code."
            : "Firm quote in 48 h. Fixed fee. You own the code."
        }
        cta={
          <div className="flex flex-wrap justify-center gap-4">
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
        }
      />

      {/* CTA mobile sticky (Sprint uniformisation) */}
      <StickyMobileCta
        href="/contact"
        label={isFr ? "Décrire mon projet" : "Describe my project"}
        track="codage-developpement-sticky-mobile"
      />
    </>
  );
}
