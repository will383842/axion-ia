/**
 * Hub vertical — Sites web augmentés par l'IA.
 * P0 refonte 2026-05-22 : ajout areasServed + FAQ + HowTo + ItemList +
 * LocalCoverageSection + LocalGeoFaqSection + CTA /contact.
 * Miroir structurel de /codage-developpement (SSOT patterns).
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Globe, Sparkles, Zap, ShieldCheck } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { Cta } from "@/components/marketing/Cta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { LocalCoverageSection } from "@/components/sections/LocalCoverageSection";
import { LocalGeoFaqSection } from "@/components/sections/LocalGeoFaqSection";
import {
  buildProductMetadata,
  buildServiceJsonLd,
  buildFaqJsonLd,
  buildHowToJsonLd,
  buildItemListJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { buildServiceAreasServed } from "@/lib/service-coverage";

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isFr = locale === "fr";
  return buildProductMetadata({
    locale,
    path: "/sites-web-augmentes",
    title: isFr
      ? "Sites web augmentés par l'IA · chatbot RAG · search sémantique | Axion-IA"
      : "AI-augmented websites · RAG chatbot · semantic search | Axion-IA",
    description: isFr
      ? "Axion-IA intègre l'IA dans votre site web : chatbot RAG ancré sur vos contenus, search sémantique, personnalisation temps réel, génération éditoriale. TPE/PME/ETI, toute stack."
      : "Axion-IA integrates AI into your website: RAG chatbot grounded in your content, semantic search, real-time personalisation, editorial generation. SMB/enterprise, any stack.",
    alternates: { fr: "/sites-web-augmentes", en: "/sites-web-augmentes" },
  });
}

export default async function SitesWebAugmentesHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const breadcrumbItems = [
    {
      href: "/sites-web-augmentes" as const,
      label: isFr ? "Sites web augmentés IA" : "AI-augmented websites",
    },
  ];

  const features = isFr
    ? [
        { icon: Globe, label: "Toute stack existante — on s'intègre" },
        { icon: ShieldCheck, label: "RGPD natif · hébergement EU" },
        { icon: Sparkles, label: "Chatbot RAG formé sur vos données" },
        { icon: ArrowRight, label: "Forfait fixe · devis ferme 48 h" },
      ]
    : [
        { icon: Globe, label: "Any existing stack — we integrate" },
        { icon: ShieldCheck, label: "GDPR native · EU hosting" },
        { icon: Sparkles, label: "RAG chatbot trained on your data" },
        { icon: ArrowRight, label: "Fixed fee · firm quote 48 h" },
      ];

  const offers = isFr
    ? [
        {
          icon: Sparkles,
          tag: "IA conversationnelle",
          title: "Chatbot RAG intégré",
          description:
            "Déploiement d'un assistant conversationnel ancré sur vos contenus et documents internes. Réponses précises sur votre base de connaissance, hallucinations éliminées. Connexion à votre CMS ou base documentaire.",
          accent: true,
        },
        {
          icon: Globe,
          tag: "Découvrabilité",
          title: "Search sémantique",
          description:
            "Remplacez la recherche plein-texte par une recherche vectorielle qui comprend l'intention de vos visiteurs. Résultats pertinents même avec des formulations floues ou des synonymes.",
          accent: false,
        },
        {
          icon: Zap,
          tag: "Contenu & personnalisation",
          title: "Génération & personnalisation",
          description:
            "Pipeline de génération éditoriale (blog, fiches, FAQ) conforme HCU 2024 et AI Act 2026. Adaptation temps réel du contenu et des CTA selon le profil et le comportement de chaque visiteur.",
          accent: false,
        },
      ]
    : [
        {
          icon: Sparkles,
          tag: "Conversational AI",
          title: "Integrated RAG chatbot",
          description:
            "Deploy a conversational assistant grounded in your content and internal documents. Accurate answers from your knowledge base, hallucinations eliminated. Connect to your CMS or document repository.",
          accent: true,
        },
        {
          icon: Globe,
          tag: "Discoverability",
          title: "Semantic search",
          description:
            "Replace full-text search with vector search that understands your visitors' intent. Relevant results even with vague formulations or synonyms.",
          accent: false,
        },
        {
          icon: Zap,
          tag: "Content & personalisation",
          title: "Generation & personalisation",
          description:
            "Editorial generation pipeline (blog, product pages, FAQ) compliant with HCU 2024 and AI Act 2026. Real-time content and CTA adaptation based on each visitor's profile and behaviour.",
          accent: false,
        },
      ];

  const faqs = isFr
    ? [
        {
          id: "q-site-existant",
          question: "Peut-on augmenter un site existant sans le refondre ?",
          answer:
            "Oui, dans la grande majorité des cas. On greffe les briques IA sur votre site via une API ou un widget : chatbot RAG, search sémantique, génération de contenu. Aucune refonte technique nécessaire si votre CMS expose une API ou un flux de données.",
        },
        {
          id: "q-stack",
          question: "Avec quels CMS et stacks travaillez-vous ?",
          answer:
            "WordPress, Webflow, Shopify, Next.js, Nuxt, Gatsby, Laravel, Django, Symfony, Vue, React — toute stack exposant une API REST, GraphQL ou un flux de contenu. On s'adapte à votre environnement existant, pas l'inverse.",
        },
        {
          id: "q-rag",
          question: "Comment fonctionne le chatbot RAG sur mon site ?",
          answer:
            "On indexe vos pages, documents et données dans une base vectorielle hébergée en UE. Le chatbot interroge cette base pour répondre précisément à chaque question, en citant ses sources. Résultat : zéro hallucination sur votre périmètre, réponses fidèles à votre contenu.",
        },
        {
          id: "q-donnees",
          question: "Mes données restent-elles confidentielles ?",
          answer:
            "Oui. Toute la chaîne IA est hébergée en UE (Hetzner Frankfurt), conforme RGPD. Vos données ne transitent jamais par des serveurs américains sans DPA signé. Vous gardez la propriété complète de vos contenus et modèles.",
        },
        {
          id: "q-delai",
          question: "Combien de temps pour augmenter mon site ?",
          answer:
            "Un chatbot RAG opérationnel sur votre site : 2 à 3 semaines. Search sémantique : 1 semaine si votre contenu est déjà structuré. Génération éditoriale complète : 3 à 5 semaines. Devis ferme 48 h, forfait fixe sans dépassement.",
        },
      ]
    : [
        {
          id: "q-existing-site",
          question: "Can you augment an existing site without rebuilding it?",
          answer:
            "Yes, in the vast majority of cases. We graft AI bricks onto your site via an API or widget: RAG chatbot, semantic search, content generation. No technical rebuild needed if your CMS exposes an API or data feed.",
        },
        {
          id: "q-stack",
          question: "Which CMS and stacks do you work with?",
          answer:
            "WordPress, Webflow, Shopify, Next.js, Nuxt, Gatsby, Laravel, Django, Symfony, Vue, React — any stack exposing a REST API, GraphQL or content feed. We adapt to your existing environment, not the other way around.",
        },
        {
          id: "q-rag",
          question: "How does the RAG chatbot work on my site?",
          answer:
            "We index your pages, documents and data into an EU-hosted vector database. The chatbot queries this base to answer each question precisely, citing its sources. Result: zero hallucinations within your scope, answers faithful to your content.",
        },
        {
          id: "q-data",
          question: "Does my data remain confidential?",
          answer:
            "Yes. The entire AI chain is hosted in the EU (Hetzner Frankfurt), GDPR compliant. Your data never transits through US servers without a signed DPA. You retain full ownership of your content and models.",
        },
        {
          id: "q-timeline",
          question: "How long to augment my site?",
          answer:
            "A RAG chatbot live on your site: 2 to 3 weeks. Semantic search: 1 week if your content is already structured. Full editorial generation: 3 to 5 weeks. Firm quote 48 h, fixed fee with no overruns.",
        },
      ];

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    path: "/sites-web-augmentes",
    name: isFr ? "Sites web augmentés par l'IA · Axion-IA" : "AI-augmented websites · Axion-IA",
    description: isFr
      ? "Intégration de l'intelligence artificielle dans les sites web existants ou conception de sites IA-natifs : chatbot RAG, search sémantique, personnalisation, génération éditoriale."
      : "Integration of artificial intelligence into existing websites or design of AI-native sites: RAG chatbot, semantic search, personalisation, editorial generation.",
    serviceType: isFr ? "Sites web augmentés IA" : "AI-augmented websites",
    areasServed: buildServiceAreasServed(loc),
  });

  const faqJsonLd = buildFaqJsonLd({ items: faqs });

  const howToJsonLd = buildHowToJsonLd({
    locale: loc,
    path: "/sites-web-augmentes",
    name: isFr
      ? "Comment augmenter son site web avec l'intelligence artificielle"
      : "How to augment your website with artificial intelligence",
    description: isFr
      ? "Les 4 étapes d'Axion-IA pour intégrer l'IA dans votre site web existant ou en IA-native."
      : "Axion-IA's 4 steps to integrate AI into your existing website or build AI-native.",
    totalTime: "P3W",
    steps: isFr
      ? [
          {
            name: "Audit rapide de votre site",
            text: "2 h pour identifier les 3 points d'augmentation IA à plus fort ROI : chatbot, search, génération, personnalisation.",
          },
          {
            name: "Choix des briques IA",
            text: "Sélection des modules selon votre priorité business, votre stack et votre budget. Devis ferme 48 h.",
          },
          {
            name: "Intégration par sprints",
            text: "Sprints de 1 semaine, démos hebdomadaires. Zéro downtime sur votre site en production.",
          },
          {
            name: "Formation et transfert",
            text: "Formation de vos équipes, documentation complète, ownership total du code et des données.",
          },
        ]
      : [
          {
            name: "Quick audit of your site",
            text: "2 h to identify the 3 highest-ROI AI augmentation points: chatbot, search, generation, personalisation.",
          },
          {
            name: "AI bricks selection",
            text: "Module selection based on your business priority, stack and budget. Firm quote 48 h.",
          },
          {
            name: "Sprint-based integration",
            text: "1-week sprints, weekly demos. Zero downtime on your live site.",
          },
          {
            name: "Training and handover",
            text: "Team training, full documentation, complete ownership of code and data.",
          },
        ],
  });

  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/sites-web-augmentes",
    name: isFr
      ? "Services d'augmentation IA pour sites web — Axion-IA"
      : "AI augmentation services for websites — Axion-IA",
    items: [
      {
        position: 1,
        name: isFr ? "Chatbot RAG intégré" : "Integrated RAG chatbot",
        url: `${SITE_URL}/${loc}/sites-web-augmentes`,
        description: isFr
          ? "Assistant conversationnel ancré sur vos contenus, zéro hallucination, hébergé UE."
          : "Conversational assistant grounded in your content, zero hallucination, EU-hosted.",
      },
      {
        position: 2,
        name: isFr ? "Search sémantique" : "Semantic search",
        url: `${SITE_URL}/${loc}/sites-web-augmentes`,
        description: isFr
          ? "Recherche vectorielle comprenant l'intention des visiteurs, résultats pertinents."
          : "Vector search understanding visitor intent, relevant results.",
      },
      {
        position: 3,
        name: isFr
          ? "Génération & personnalisation éditoriale"
          : "Editorial generation & personalisation",
        url: `${SITE_URL}/${loc}/sites-web-augmentes`,
        description: isFr
          ? "Pipeline de génération conforme HCU 2024 + AI Act, personnalisation temps réel."
          : "HCU 2024 + AI Act compliant generation pipeline, real-time personalisation.",
      },
    ],
  });

  return (
    <>
      <JsonLd data={serviceJsonLd} />
      <JsonLd
        data={faqJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-sites-web-augmentes-faq"
      />
      <JsonLd
        data={howToJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-sites-web-augmentes-howto"
      />
      <JsonLd
        data={itemListJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-sites-web-augmentes-itemlist"
      />

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
            {isFr ? "Sites web · augmentés par l'IA" : "Websites · AI-augmented"}
          </p>

          <h1 className="display-editorial text-fg mt-5">
            {isFr ? "Votre site web qui" : "Your website that"}
            <span
              className="text-terracotta mx-2 italic"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {isFr ? "comprend et répond." : "understands and responds."}
            </span>
          </h1>

          <p className="text-fg-soft mt-6 text-lg leading-relaxed sm:text-xl">
            {isFr
              ? "On intègre l'intelligence artificielle dans votre site web existant — ou on conçoit une expérience IA-native. Chatbot RAG, search sémantique, génération éditoriale, personnalisation. Votre stack, votre hébergement, vos données."
              : "We integrate artificial intelligence into your existing website — or design an AI-native experience. RAG chatbot, semantic search, editorial generation, personalisation. Your stack, your hosting, your data."}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Cta href="/contact" size="lg" track="sites-web-augmentes-hero-primary">
              {isFr ? "Décrire mon projet · devis 48 h" : "Describe my project · quote 48 h"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta href="/audit" variant="outline" size="lg" track="sites-web-augmentes-hero-audit">
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

      {/* TROIS OFFRES */}
      <Section
        eyebrow={isFr ? "3 modules IA" : "3 AI modules"}
        title={isFr ? "Ce qu'on intègre" : "What we integrate"}
        titleEm={isFr ? "dans votre site" : "into your site"}
        description={
          isFr
            ? "Chaque module est déployable seul ou combiné. On choisit ensemble selon votre priorité."
            : "Each module can be deployed standalone or combined. We choose together based on your priority."
        }
      >
        <ul className="grid gap-6 md:grid-cols-3">
          {offers.map((offer) => {
            const Icon = offer.icon;
            return (
              <li
                key={offer.title}
                className={
                  offer.accent
                    ? "border-terracotta bg-paper ring-terracotta/20 flex flex-col gap-4 rounded-2xl border-2 p-8 ring-4"
                    : "border-border bg-paper flex flex-col gap-4 rounded-2xl border p-8"
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
              </li>
            );
          })}
        </ul>
      </Section>

      {/* COUVERTURE NATIONALE */}
      <LocalCoverageSection
        isFr={isFr}
        serviceLabelFr="L'augmentation web IA"
        serviceLabelEn="AI web augmentation"
        serviceSlug="codage-developpement"
        tone="sand"
      />

      {/* FAQ GÉOLOCALISÉE */}
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

      {/* CTA FINAL */}
      <section className="bg-mocha-rich py-16 sm:py-20">
        <Container className="max-w-2xl text-center">
          <p className="text-mocha-fg/60 mb-4 text-[12px] font-semibold tracking-[0.18em] uppercase">
            {isFr ? "Prêt à augmenter votre site" : "Ready to augment your site"}
          </p>
          <h2
            className="text-mocha-fg text-3xl leading-tight font-medium sm:text-4xl"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {isFr ? (
              <>
                Démarrez par <span className="italic">un audit de 2 h.</span>
              </>
            ) : (
              <>
                Start with <span className="italic">a 2-hour audit.</span>
              </>
            )}
          </h2>
          <p className="text-mocha-fg/70 mt-4 text-base leading-relaxed">
            {isFr
              ? "On identifie les 3 points d'augmentation IA à plus fort ROI sur votre site. Devis ferme 48 h, sans engagement."
              : "We identify the 3 highest-ROI AI augmentation points on your site. Firm quote 48 h, no commitment."}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Cta
              href="/contact"
              size="lg"
              className="bg-paper text-fg hover:bg-paper/90"
              track="sites-web-augmentes-cta-contact"
            >
              {isFr ? "Décrire mon projet" : "Describe my project"}
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Cta>
            <Cta
              href="/audit"
              variant="outline"
              size="lg"
              className="border-mocha-fg/30 text-mocha-fg hover:bg-mocha-fg/10"
              track="sites-web-augmentes-cta-audit"
            >
              {isFr ? "Voir les niveaux d'audit" : "See audit levels"}
            </Cta>
          </div>
        </Container>
      </section>
    </>
  );
}
