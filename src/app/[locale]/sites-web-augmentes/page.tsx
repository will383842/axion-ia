/**
 * Hub vertical — Sites web augmentes par l'IA (ServiceSector: sites_web_augmentes).
 * B.3 P1.5 2026-05-21.
 *
 * Page hub legere : H1 + description + CTA /interventions + JSON-LD Service.
 * La page /codage-developpement couvre l'offre complete — cette route cible
 * specifiquement le keyword "sites web IA" / "agence site web intelligence
 * artificielle" pour enrichir la couverture SEO de la verticale.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, Globe, Sparkles, Zap } from "lucide-react";
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
    title: isFr ? "Sites web augmentes par l'IA | Axion-IA" : "AI-augmented websites | Axion-IA",
    description: isFr
      ? "Axion-IA concoit et augmente vos sites web avec l'intelligence artificielle : chatbot RAG, search semantique, personnalisation, generation de contenu. TPE/PME/ETI."
      : "Axion-IA builds and augments your websites with artificial intelligence: RAG chatbot, semantic search, personalisation, content generation. SMB/enterprise.",
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
      label: isFr ? "Sites web augmentes" : "AI-augmented websites",
    },
  ];

  const serviceJsonLd = buildServiceJsonLd({
    locale: loc,
    name: isFr ? "Sites web augmentes par l'IA" : "AI-augmented websites",
    description: isFr
      ? "Conception et augmentation de sites web par l'intelligence artificielle : chatbot RAG, search semantique, personnalisation automatique, generation de contenu editorial."
      : "Design and augmentation of websites with artificial intelligence: RAG chatbot, semantic search, automatic personalisation, editorial content generation.",
    path: "/sites-web-augmentes",
    serviceType: isFr ? "Sites web augmentes IA" : "AI-augmented websites",
  });

  const features = isFr
    ? [
        {
          icon: Sparkles,
          title: "Chatbot RAG integre",
          description:
            "Deploiement d'un assistant conversationnel ancre sur vos contenus et documents internes. Reponses precises, hallucinations elimininees.",
        },
        {
          icon: Globe,
          title: "Search semantique",
          description:
            "Remplacez la recherche plein-texte par une recherche vectorielle qui comprend l'intention de vos visiteurs.",
        },
        {
          icon: Zap,
          title: "Generation de contenu automatique",
          description:
            "Pipeline de generation editoriale (blog, fiches produits, FAQ) conforme HCU 2024 et AI Act 2026.",
        },
        {
          icon: ArrowRight,
          title: "Personnalisation dynamique",
          description:
            "Adaptation temps reel du contenu et des CTA selon le profil et le comportement de chaque visiteur.",
        },
      ]
    : [
        {
          icon: Sparkles,
          title: "Integrated RAG chatbot",
          description:
            "Deploy a conversational assistant grounded in your content and internal documents. Accurate answers, hallucinations eliminated.",
        },
        {
          icon: Globe,
          title: "Semantic search",
          description:
            "Replace full-text search with vector search that understands your visitors' intent.",
        },
        {
          icon: Zap,
          title: "Automated content generation",
          description:
            "Editorial generation pipeline (blog, product pages, FAQ) compliant with HCU 2024 and AI Act 2026.",
        },
        {
          icon: ArrowRight,
          title: "Dynamic personalisation",
          description:
            "Real-time adaptation of content and CTAs based on each visitor's profile and behaviour.",
        },
      ];

  return (
    <>
      <JsonLd data={serviceJsonLd} />

      <Section className="bg-gradient-to-b from-white to-[#faf8f3] pt-16 pb-12">
        <Container>
          <Breadcrumbs items={breadcrumbItems} />
          <div className="mt-8 max-w-3xl">
            <h1 className="mb-4 text-4xl font-bold text-gray-900">
              {isFr ? "Sites web augmentes par l'IA" : "AI-augmented websites"}
            </h1>
            <p className="mb-8 text-xl text-gray-600">
              {isFr
                ? "Axion-IA integre l'intelligence artificielle dans vos sites web existants ou concoit des plateformes IA-natives. Chatbot RAG, search semantique, generation de contenu, personnalisation : transformez votre site en moteur de croissance."
                : "Axion-IA integrates artificial intelligence into your existing websites or designs AI-native platforms. RAG chatbot, semantic search, content generation, personalisation: turn your website into a growth engine."}
            </p>
            <Cta href="/interventions" variant="primary" className="inline-flex items-center gap-2">
              {isFr ? "Discuter de votre projet" : "Discuss your project"}
            </Cta>
          </div>
        </Container>
      </Section>

      <Section className="bg-[#faf8f3] py-16">
        <Container>
          <h2 className="mb-10 text-2xl font-semibold text-gray-900">
            {isFr ? "Ce que nous apportons a votre site" : "What we bring to your website"}
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#c24a1b]/10">
                  <f.icon className="h-5 w-5 text-[#c24a1b]" />
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-gray-900">{f.title}</h3>
                  <p className="text-sm text-gray-600">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </Section>

      <Section className="bg-white py-16">
        <Container>
          <div className="max-w-2xl">
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">
              {isFr ? "Pret a augmenter votre site web ?" : "Ready to augment your website?"}
            </h2>
            <p className="mb-6 text-gray-600">
              {isFr
                ? "Nos interventions demarrent par un audit rapide (2h) pour identifier les 3 points d'augmentation IA a plus fort ROI sur votre site."
                : "Our engagements start with a quick audit (2h) to identify the 3 highest-ROI AI augmentation points on your site."}
            </p>
            <Cta href="/interventions" variant="primary">
              {isFr ? "Demander un audit rapide" : "Request a quick audit"}
            </Cta>
          </div>
        </Container>
      </Section>
    </>
  );
}
