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
 *
 * JSON-LD : WebPage (publisher Organization + datePublished + dateModified
 * BUILD_DATE + speakable h1/FAQ) + FAQPage (via FaqAccordion). Lien retour
 * symétrique vers /charte-editoriale.
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
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { buildProductMetadata, BUILD_DATE, SITE_URL } from "@/lib/seo";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";

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
      icon: Sparkles,
      title: isFr ? "Persona Manon — détail éditorial" : "Manon persona — editorial detail",
      body: isFr
        ? "Manon est une persona éditoriale assistée par IA (et non une personne physique), explicitement présentée comme telle sur sa fiche /equipe/manon (portrait IA disclosed, doctrine v2.1). Sa voix est codifiée en SSOT versionné dans le repo : ton consultatif, accessible mais rigoureux, première personne du pluriel privilégiée. Sources prioritaires : INSEE, DARES, BPI France, France Num, ANSSI, CNIL, AI Act EUR-Lex. Vocabulaire canonique : « IA » (pas « AI »), « Machine Learning (ML) ». Mots interdits : « révolutionner », « disruptif », « next-gen », « game-changer », « magique », « révolutionnaire », « garanti ». Aucun prix en dur, aucun délai chiffré, aucun numéro de téléphone — contact@axion-ia.com uniquement. Cette persona est injectée dans le system prompt de chacun des 9 générateurs (blog-article, blog-from-keywords, blog-from-title, blog-from-rss, comparison, faq-standalone, guide-pilier, landing-ville, qa-derived) et fait l'objet d'un test de couverture vitest qui interdit toute régression silencieuse."
        : "Manon is an AI-assisted editorial persona (not a physical person), explicitly disclosed on her /equipe/manon profile (AI-disclosed portrait, doctrine v2.1). Her voice is codified in a versioned SSOT in the repository: consultative tone, accessible yet rigorous, first-person plural preferred. Priority sources: INSEE, DARES, BPI France, France Num, ANSSI, CNIL, AI Act EUR-Lex. Canonical vocabulary: « IA » (not « AI »), « Machine Learning (ML) ». Forbidden words: « revolutionize », « disruptive », « next-gen », « game-changer », « magical », « guaranteed ». No hardcoded prices, no quantified delays, no phone number — contact@axion-ia.com only. This persona is injected into the system prompt of each of the 9 generators and is covered by a vitest test that prevents silent regressions.",
      links: [
        {
          href: "/equipe/manon",
          label: isFr ? "Fiche Manon complète" : "Full Manon profile",
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

  // FAQ AEO (conformité IA Act / RGPD) — questions idéales pour citation IA :
  // « mes données dans un LLM ? », « AI Act ? », « droits RGPD ? » → /mes-donnees.
  const faqItems = isFr
    ? [
        {
          id: "donnees-llm",
          question: "Mes données vont-elles dans un LLM ?",
          answer:
            "Non. Les prompts envoyés aux modèles d'IA ne contiennent aucune donnée personnelle de visiteur — un helper « pii-safe » et un hard gate au niveau du code l'interdisent. Aucune saisie de formulaire n'est utilisée pour entraîner un modèle.",
        },
        {
          id: "ai-act",
          question: "Êtes-vous concernés par l'AI Act ?",
          answer:
            "Oui, au titre de l'article 50 (transparence) : nos contenus éditoriaux IA-assistés sont divulgués comme tels. Nous ne sommes pas un système à haut risque (art. 52) et opérons en downstream user de modèles à usage général (art. 53). Détail : ADR 0024.",
        },
        {
          id: "droits-rgpd",
          question: "Comment exercer mes droits RGPD ?",
          answer:
            "Via notre self-service « mes données » ou en écrivant à contact@axion-ia.com. Vous disposez des droits d'accès, rectification, effacement, opposition, portabilité et limitation. Autorité de contrôle compétente : la CNIL (France).",
        },
        {
          id: "supervision-humaine",
          question: "Les contenus IA sont-ils relus par un humain ?",
          answer:
            "Oui. Chaque contenu IA-assisté (persona Manon) est supervisé par l'équipe Axion-IA avant publication : relecture éditoriale, vérification factuelle et alignement avec notre charte éditoriale.",
        },
      ]
    : [
        {
          id: "donnees-llm",
          question: "Does my data go into an LLM?",
          answer:
            "No. Prompts sent to AI models contain no visitor personal data — a « pii-safe » helper and a code-level hard gate prevent it. No form submission is used to train a model.",
        },
        {
          id: "ai-act",
          question: "Are you subject to the EU AI Act?",
          answer:
            "Yes, under article 50 (transparency): our AI-assisted editorial content is disclosed as such. We are not a high-risk system (art. 52) and operate as a downstream user of general-purpose models (art. 53). Details: ADR 0024.",
        },
        {
          id: "droits-rgpd",
          question: "How do I exercise my GDPR rights?",
          answer:
            "Via our « my data » self-service or by writing to contact@axion-ia.com. You have rights of access, rectification, erasure, objection, portability and restriction. Competent supervisory authority: the CNIL (France).",
        },
        {
          id: "supervision-humaine",
          question: "Is AI content reviewed by a human?",
          answer:
            "Yes. Every AI-assisted content piece (Manon persona) is supervised by the Axion-IA team before publication: editorial review, factual verification and alignment with our editorial policy.",
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
    // Aligné sur /charte-editoriale : publisher Organization + dates (freshness
    // AEO). datePublished = création du hub (ADR 0024) ; dateModified = BUILD_DATE.
    publisher: { "@id": `${SITE_URL}/#organization` },
    datePublished: "2026-05-18",
    dateModified: BUILD_DATE,
    about: {
      "@type": "Thing",
      name: "EU AI Act 2024/1689 transparency",
    },
    // Speakable AEO — cible le H1 (toujours présent) + les questions FAQ
    // (sélecteur data-faq-q émis par FaqAccordion). Voice assistants + Perplexity.
    speakable: buildSpeakableSpecification({
      selectors: ["h1", "[data-faq-q]"],
    }),
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

      {/* FAQ AEO — FaqAccordion injecte buildFaqJsonLd (FAQPage + Speakable) */}
      <Section
        eyebrow={isFr ? "Questions fréquentes" : "Frequent questions"}
        title={isFr ? "FAQ — transparence & conformité" : "FAQ — transparency & compliance"}
        tone="sand"
      >
        <Container className="max-w-4xl">
          <FaqAccordion items={faqItems} className="mx-auto max-w-3xl" />
          <p className="text-fg-muted mt-10 text-sm">
            <Link
              href="/charte-editoriale"
              className="text-terracotta-deep hover:text-terracotta underline underline-offset-4"
            >
              {isFr ? "→ Consulter notre charte éditoriale" : "→ Read our editorial policy"}
            </Link>
          </p>
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
