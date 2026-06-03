import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, BookText, Mic, RefreshCw, Quote } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, SITE_URL, BUILD_DATE } from "@/lib/seo";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import { getGlossaryTerms } from "@/lib/knowledge/readers";

interface Props {
  params: Promise<{ locale: string }>;
}

// ISR 1h (P1 audit KB 2026-05-29) — aligné /connaissances et /ressources.
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/glossaire",
    title:
      locale === "fr"
        ? "Glossaire IA · termes essentiels · Axion-IA"
        : "AI glossary · essential terms · Axion-IA",
    description:
      locale === "fr"
        ? "Glossaire IA Axion-IA : LLM, RAG, fine-tuning, agents, MCP, vectorisation, hallucination, prompt engineering."
        : "Axion-IA AI glossary: LLM, RAG, fine-tuning, agents, MCP, vectorization, hallucination, prompt engineering.",
    alternates: { fr: "/glossaire", en: "/glossary" },
  });
}

// KB-6.2 : 12 termes hardcode déplacés en SSOT `src/lib/knowledge/legacy-mapping-glossary-hardcode.ts`
// Lecture via `getGlossaryTerms()` qui choisit DB ou hardcode selon `KB_BACKEND_UNIFIED_GLOSSARY`.

export default async function GlossaryPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // KB-6.2 : lecture via reader unifié (DB si KB_BACKEND_UNIFIED_GLOSSARY=1,
  // sinon SSOT hardcode GLOSSARY_TERMS_HARDCODE — comportement identique).
  // Fallback hardcode TERMS const ci-dessus retiré : suffit le SSOT lib.
  const terms = await getGlossaryTerms();

  const definedTermSetJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: isFr ? "Glossaire IA Axion-IA" : "Axion-IA AI glossary",
    inLanguage: locale,
    url: `${SITE_URL}/${locale}/glossaire`,
    // DefinedTermSet ⊂ CreativeWork → dateModified valide (signal de fraîcheur AEO/GEO).
    dateModified: BUILD_DATE,
    speakable: buildSpeakableSpecification({
      selectors: ["[data-aeo='glossary-intro']"],
    }),
    hasDefinedTerm: terms.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      description: t[loc],
      inDefinedTermSet: `${SITE_URL}/${locale}/glossaire`,
    })),
  } as const;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: isFr
      ? `Glossaire IA — ${terms.length} termes essentiels · Axion-IA`
      : `AI glossary — ${terms.length} essential terms · Axion-IA`,
    numberOfItems: terms.length,
    itemListElement: terms.slice(0, 100).map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: isFr ? t.term : t.term,
      url: `${SITE_URL}/${loc}/glossaire/${t.slug}`,
    })),
  };

  // Breadcrumb visuel + JSON-LD intégré (composant unique). L'item "Accueil"
  // est ajouté automatiquement par le composant.
  const breadcrumbItems = [{ href: "/glossaire", label: isFr ? "Glossaire" : "Glossary" }];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Glossaire" : "Glossary"}
        title={isFr ? "Termes IA" : "Essential AI"}
        titleEm={isFr ? "essentiels" : "terms"}
        description={
          <span data-aeo="glossary-intro">
            {isFr
              ? `${terms.length} termes pour parler IA en réunion sans se tromper. Définitions courtes, sourcées, citables par les LLMs. MAJ à chaque évolution majeure.`
              : `${terms.length} terms to discuss AI in meetings without errors. Short, sourced, LLM-citable definitions. Updated on each major evolution.`}
          </span>
        }
      >
        <Container className="mt-8 max-w-2xl">
          <ul className="flex flex-wrap gap-x-5 gap-y-2.5">
            {[
              { icon: BookText, label: isFr ? `${terms.length} termes` : `${terms.length} terms` },
              { icon: Mic, label: isFr ? "AEO citable" : "AEO citable" },
              { icon: Quote, label: isFr ? "Sources vérifiées" : "Verified sources" },
              { icon: RefreshCw, label: isFr ? "MAJ continue" : "Continuous updates" },
            ].map((pill) => {
              const Icon = pill.icon;
              return (
                <li
                  key={pill.label}
                  className="text-fg-soft inline-flex items-center gap-2 text-sm"
                >
                  <Icon aria-hidden="true" className="text-terracotta h-4 w-4" strokeWidth={2} />
                  <span>{pill.label}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Cta href="/guide-ia" size="lg">
              {isFr ? "Lire le guide IA 40 pages" : "Read the 40-page AI guide"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta href="/audit" variant="outline" size="lg">
              {isFr ? "Demander un audit" : "Request an audit"}
            </Cta>
          </div>
        </Container>
      </Section>
      <Section>
        <Container className="max-w-3xl">
          <dl className="border-border divide-border space-y-0 divide-y border-y">
            {terms.map((t) => (
              <div key={t.slug} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4">
                <dt className="font-mono text-sm font-semibold">
                  <Link
                    href={{ pathname: "/glossaire/[slug]", params: { slug: t.slug } }}
                    className="text-fg hover:text-primary"
                  >
                    {t.term}
                  </Link>
                </dt>
                <dd className="text-fg-soft text-base leading-relaxed">{t[loc]}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </Section>
      <JsonLd data={definedTermSetJsonLd} />
      <JsonLd
        data={itemListJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-glossaire-itemlist"
      />
    </>
  );
}
