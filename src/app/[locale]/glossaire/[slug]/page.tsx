/**
 * Sprint S+4-A 2026-05-18 — `/glossaire/[slug]` détail d'un terme glossaire.
 *
 * Audit source : `_AUDIT/CONTENT-GEN-DEEP-AUDIT-2026-05-18/22-TYPE-11-GLOSSAIRE.md`
 * Gap P1-19 : index `/glossaire` existait (12 termes hardcode) mais AUCUNE
 * page détail → impossible de linker un terme depuis un article, pas de
 * JSON-LD `DefinedTerm`, pas de mesh interne, pas d'AEO citable au niveau terme.
 *
 * Doctrine ce fichier (cohérence `/centre-aide/[slug]/page.tsx` P0-5) :
 *   - ISR `revalidate=3600` + `dynamicParams=false` (anti soft-404 SSG)
 *   - `generateStaticParams` pour tous les slugs glossaire (60 au 2026-05-18)
 *   - Metadata bilingue (FR canonique + EN miroir 301 via proxy.ts AGENTS.md)
 *   - JSON-LD `DefinedTerm` (termCode + name + description + inDefinedTermSet)
 *   - JSON-LD `BreadcrumbList` (Home → Glossaire → Terme)
 *   - JSON-LD `WebPage` + `Speakable` cssSelector `[data-aeo="glossary-definition"]`
 *   - Anti-doorway HCU : `robots: noindex` auto si définition < 80 mots
 *   - `notFound()` si slug inconnu
 *   - Mesh : 3-5 termes liés via `relatedSlugs[]` + lien CTA `/blog`
 *   - Réutilisation `<Container>`, `<Breadcrumbs>`, `<JsonLd>`, `<AnswerCard>`,
 *     `<AiContentDisclaimer>` (doctrine V1)
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BookText, Tag, ArrowRight, Quote, Lightbulb } from "lucide-react";
import { routing, STATIC_LOCALES, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { AiContentDisclaimer } from "@/components/marketing/AiContentDisclaimer";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, SITE_URL, SITE_EDITORIAL_DATE } from "@/lib/seo";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import {
  ALL_GLOSSARY_TERMS_EXTENDED,
  getGlossaryTermBySlug,
  getRelatedGlossaryTerms,
  isGlossaryTermIndexable,
  listGlossaryTermSlugs,
} from "@/content/glossary-extension";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

/**
 * ISR 1h — terme glossaire évolue rarement, mais on veut pouvoir corriger une
 * définition sans full rebuild de 60 pages.
 */
export const revalidate = 3600;

/**
 * Audit indexation 2026-05-18 — anti soft-404 SSG : slugs hardcode connus,
 * tout slug hors liste → notFound() immédiat sans tentative ISR.
 */
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = listGlossaryTermSlugs();
  return slugs.flatMap((slug) => STATIC_LOCALES.map((locale) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const term = getGlossaryTermBySlug(slug);
  if (!term) return {};
  const isFr = locale === "fr";
  const description = isFr ? term.fr : term.en;

  // Build une description SEO-safe ≤ 160 chars (Google SERP cap).
  const metaDescription =
    description.length > 160 ? `${description.slice(0, 157).trim()}…` : description;

  // Anti-doorway HCU 2024 + AEO 2026 : noindex si définition < 80 mots cumulés
  // (FR + EN + examples). SSOT partagé avec le sitemap (`isGlossaryTermIndexable`)
  // pour qu'un terme thin ne soit JAMAIS sitemappé tout en étant `noindex` (audit
  // indexation 2026-06-17 — fin de l'incohérence sitemap↔page).
  const thin = !isGlossaryTermIndexable(slug);

  const meta = buildProductMetadata({
    locale,
    path: `/glossaire/${slug}`,
    title: isFr
      ? `${term.term} · définition IA · Axion-IA`
      : `${term.term} · AI definition · Axion-IA`,
    description: metaDescription,
    alternates: { fr: `/glossaire/${slug}`, en: `/glossary/${slug}` },
  });

  if (thin) {
    // Override robots.noindex sans casser les autres metadata produites.
    return {
      ...meta,
      robots: {
        index: false,
        follow: true,
        googleBot: { index: false, follow: true },
      },
    };
  }
  return meta;
}

export default async function GlossaryTermPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const term = getGlossaryTermBySlug(slug);
  if (!term) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";
  const definition = isFr ? term.fr : term.en;

  // Compute related (3-5 termes) via mesh interne pré-validé par les tests.
  const related = getRelatedGlossaryTerms(slug, 5);

  // JSON-LD DefinedTerm (Schema.org canonical glossary type).
  // `termCode` = slug stable (jamais renommé rétroactivement, doctrine slug-history).
  // `inDefinedTermSet` boucle vers le hub glossaire (signal AEO/GEO 2026 :
  // permet à Perplexity/Claude.ai/SGE de comprendre la structure ontologique).
  const definedTermJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "@id": `${SITE_URL}/${locale}/glossaire/${slug}#term`,
    termCode: term.slug,
    name: term.term,
    description: definition,
    alternateName: [...term.aliases],
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      "@id": `${SITE_URL}/${locale}/glossaire`,
      name: isFr ? "Glossaire IA Axion-IA" : "Axion-IA AI glossary",
      url: `${SITE_URL}/${locale}/glossaire`,
    },
    url: `${SITE_URL}/${locale}/glossaire/${slug}`,
    inLanguage: locale,
    // AEO 2026 : `subjectOf` pointe vers la page WebPage pour citation LLM.
    subjectOf: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/${locale}/glossaire/${slug}`,
      url: `${SITE_URL}/${locale}/glossaire/${slug}`,
      isPartOf: {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
      },
      datePublished: SITE_EDITORIAL_DATE,
      dateModified: SITE_EDITORIAL_DATE,
      // Speakable cssSelector pour Google Assistant + Alexa.
      speakable: buildSpeakableSpecification({
        selectors: ['[data-aeo="glossary-definition"]'],
      }),
    },
  } as const;

  // Breadcrumb visuel + JSON-LD (le composant Breadcrumbs ajoute auto l'item Home).
  const breadcrumbItems = [
    { href: "/glossaire", label: isFr ? "Glossaire" : "Glossary" },
    { href: `/glossaire/${slug}`, label: term.term },
  ];

  // Category label (FR-first car prod 2026-05-16 EN désactivé).
  const categoryLabelFr: Record<typeof term.category, string> = {
    foundational: "Fondamentaux",
    agents: "Agents & orchestration",
    rag: "RAG & connaissance",
    models: "Modèles",
    infra: "Infrastructure",
    security: "Sécurité & conformité",
    evaluation: "Évaluation",
  };
  const categoryLabelEn: Record<typeof term.category, string> = {
    foundational: "Foundational",
    agents: "Agents & orchestration",
    rag: "RAG & knowledge",
    models: "Models",
    infra: "Infrastructure",
    security: "Security & compliance",
    evaluation: "Evaluation",
  };
  const categoryLabel = isFr ? categoryLabelFr[term.category] : categoryLabelEn[term.category];

  return (
    <>
      {/* P1-17 alternate format markdown brut pour LLM ingestion (cohérence centre-aide). */}
      <link rel="alternate" type="text/markdown" href={`/api/markdown/glossaire/${slug}`} />
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section
        titleAs="h1"
        eyebrow={isFr ? "Glossaire IA" : "AI glossary"}
        title={term.term}
        titleEm={isFr ? "· définition" : "· definition"}
        description={
          isFr
            ? "Définition courte, sourcée, citable par les LLMs."
            : "Short, sourced, LLM-citable definition."
        }
      >
        <Container className="mt-8 max-w-2xl">
          <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
            <li className="text-fg-soft inline-flex items-center gap-2 text-sm">
              <Tag aria-hidden="true" className="text-terracotta h-4 w-4" strokeWidth={2} />
              <span>{categoryLabel}</span>
            </li>
            <li className="text-fg-soft inline-flex items-center gap-2 text-sm">
              <BookText aria-hidden="true" className="text-terracotta h-4 w-4" strokeWidth={2} />
              <span>
                {ALL_GLOSSARY_TERMS_EXTENDED.length} {isFr ? "termes" : "terms"}
              </span>
            </li>
            <li className="text-fg-soft inline-flex items-center gap-2 text-sm">
              <Quote aria-hidden="true" className="text-terracotta h-4 w-4" strokeWidth={2} />
              <span>{isFr ? "AEO citable" : "AEO citable"}</span>
            </li>
          </ul>
        </Container>
      </Section>

      {/* Canonical Answer (TL;DR) pour LLMs — definition wrappée pour Speakable. */}
      <Section>
        <Container className="max-w-3xl">
          <div data-aeo="glossary-definition">
            <AnswerCard
              locale={loc}
              question={isFr ? `Qu'est-ce que ${term.term} ?` : `What is ${term.term}?`}
            >
              {definition}
            </AnswerCard>
          </div>
        </Container>
      </Section>

      {term.examples.length > 0 ? (
        <Section eyebrow={isFr ? "En pratique" : "In practice"}>
          <Container className="max-w-3xl">
            <ul className="space-y-4">
              {term.examples.map((ex, i) => (
                <li
                  key={`ex-${i}`}
                  className="border-border bg-halo-warm border-l-terracotta rounded-xl border-l-4 px-5 py-4"
                >
                  <div className="flex items-start gap-3">
                    <Lightbulb
                      aria-hidden="true"
                      className="text-terracotta mt-0.5 h-5 w-5 flex-shrink-0"
                      strokeWidth={2}
                    />
                    <p className="text-fg text-base leading-relaxed">{ex}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {term.aliases.length > 0 ? (
        <Section eyebrow={isFr ? "Aussi appelé" : "Also known as"}>
          <Container className="max-w-3xl">
            <ul className="flex flex-wrap gap-2">
              {term.aliases.map((a) => (
                <li
                  key={a}
                  className="border-border text-fg-soft inline-flex items-center rounded-full border px-3 py-1 text-sm"
                >
                  {a}
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {related.length > 0 ? (
        <Section eyebrow={isFr ? "Termes liés" : "Related terms"}>
          <Container className="max-w-3xl">
            <ul className="border-border divide-border divide-y border-y">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/${locale}/glossaire/${r.slug}`}
                    className="text-fg hover:text-primary block py-4 text-base font-medium"
                  >
                    {r.term} →{" "}
                    <span className="text-fg-soft text-sm font-normal">
                      {isFr ? r.fr.slice(0, 100) : r.en.slice(0, 100)}…
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Cta href={`/blog/tag/${term.category}`} variant="outline" size="lg">
                {isFr
                  ? `Articles sur ${categoryLabel.toLowerCase()}`
                  : `Articles about ${categoryLabel.toLowerCase()}`}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Cta>
              <Cta href="/glossaire" variant="ghost" size="lg">
                {isFr ? "← Retour au glossaire" : "← Back to glossary"}
              </Cta>
            </div>
          </Container>
        </Section>
      ) : null}

      <Section>
        <Container className="max-w-3xl">
          <AiContentDisclaimer locale={loc} />
        </Container>
      </Section>

      <CtaBlock
        title={
          isFr
            ? "Besoin d'aller plus loin sur l'IA opérationnelle ?"
            : "Want to go deeper on operational AI?"
        }
        description={
          isFr
            ? "Notre guide 40 pages traite chaque concept du glossaire avec des cas concrets."
            : "Our 40-page guide covers every glossary concept with concrete cases."
        }
        cta={
          <Cta href="/guide-ia" size="lg">
            {isFr ? "Lire le guide IA" : "Read the AI guide"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Cta>
        }
      />

      <JsonLd data={definedTermJsonLd} />
    </>
  );
}
