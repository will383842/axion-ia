/**
 * `/glossaire/[slug]` : fiche d'un terme du glossaire de référence (décision du 18/11/2026).
 *
 * Contenu statique rendu côté serveur (aucun JavaScript client ajouté) :
 *   - définition citable en tête (`data-aeo="glossary-definition"`), puis comment ça marche,
 *     exemple en PME française, limite, termes liés, pages de la base de connaissances et offre ;
 *   - JSON-LD `DefinedTerm` (dans le `DefinedTermSet` du hub) et `BreadcrumbList` (composant
 *     `Breadcrumbs`) ; date de mise à jour visible et reprise dans le JSON-LD ;
 *   - `noindex` seulement si la fiche tombe sous le seuil de substance (`isGlossaryTermIndexable`),
 *     SSOT partagé avec le sitemap ;
 *   - ISR 1 h, `dynamicParams = false`, `notFound()` si le slug est inconnu.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { routing, STATIC_LOCALES } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { AnswerCard } from "@/components/marketing/AnswerCard";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import { FAQ_GLOBAL } from "@/content/transversal";
import {
  GLOSSARY_CATEGORY_LABELS,
  GLOSSARY_FAQ_LINKS,
  GLOSSARY_OFFERS,
  GLOSSARY_UPDATED_ISO,
  getGlossaryTermBySlug,
  getRelatedGlossaryTerms,
  isGlossaryTermIndexable,
  listGlossaryTermSlugs,
} from "@/content/glossary-extension";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

export const revalidate = 3600;

/** Anti soft-404 : tout slug hors liste répond 404 sans tentative ISR. */
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = listGlossaryTermSlugs();
  return slugs.flatMap((slug) => STATIC_LOCALES.map((locale) => ({ locale, slug })));
}

function dateLisible(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const term = getGlossaryTermBySlug(slug);
  if (!term) return {};

  const description =
    term.definition.length > 160
      ? `${term.definition.slice(0, 157).trim()}…`
      : term.definition;

  const meta = await buildProductMetadata({
    locale,
    path: `/glossaire/${slug}`,
    title: `${term.term} : définition simple et exemple · Axion-IA`,
    description,
    alternates: { fr: `/glossaire/${slug}`, en: `/glossary/${slug}` },
  });

  // Filet anti contenu mince : une fiche ajoutée trop courte ne part jamais en `index`.
  if (!isGlossaryTermIndexable(slug)) {
    return {
      ...meta,
      robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
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

  const related = getRelatedGlossaryTerms(slug, 5);
  const offre = GLOSSARY_OFFERS[term.offre];
  const categorie = GLOSSARY_CATEGORY_LABELS[term.category];
  const urlHub = `${SITE_URL}/${locale}/glossaire`;
  const urlTerme = `${urlHub}/${slug}`;

  const faqLiees = (GLOSSARY_FAQ_LINKS[slug] ?? [])
    .map((id) => FAQ_GLOBAL.find((f) => f.id === id))
    .filter((f): f is NonNullable<typeof f> => Boolean(f))
    .map((f) => ({ id: f.id, question: f.fr.question }));

  const definedTermJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    "@id": `${urlTerme}#term`,
    termCode: term.slug,
    name: term.term,
    description: term.definition,
    alternateName: [...term.aliases],
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      "@id": `${urlHub}#glossaire`,
      name: "Glossaire de l'IA en entreprise · Axion-IA",
      url: urlHub,
    },
    url: urlTerme,
    inLanguage: "fr",
    subjectOf: {
      "@type": "WebPage",
      "@id": urlTerme,
      url: urlTerme,
      isPartOf: { "@type": "WebSite", "@id": `${SITE_URL}/#website` },
      dateModified: GLOSSARY_UPDATED_ISO,
      speakable: buildSpeakableSpecification({
        selectors: ['[data-aeo="glossary-definition"]'],
      }),
    },
  } as const;

  const breadcrumbItems = [
    { href: "/glossaire", label: "Glossaire" },
    { href: `/glossaire/${slug}`, label: term.term },
  ];

  return (
    <>
      <link rel="alternate" type="text/markdown" href={`/api/markdown/glossaire/${slug}`} />
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      <Section
        titleAs="h1"
        eyebrow={`Glossaire IA · ${categorie}`}
        title={term.term}
        titleEm="· définition"
        description={
          <>
            Mis à jour le{" "}
            <time dateTime={GLOSSARY_UPDATED_ISO}>{dateLisible(GLOSSARY_UPDATED_ISO)}</time>
          </>
        }
      >
        <Container className="mt-8 max-w-3xl">
          <div data-aeo="glossary-definition">
            <AnswerCard locale="fr" question={`Qu'est-ce que ${term.term} ?`}>
              {term.definition}
            </AnswerCard>
          </div>
        </Container>
      </Section>

      <Section eyebrow="Comment ça marche">
        <Container className="max-w-3xl">
          <p className="text-fg text-base leading-relaxed">{term.fonctionnement}</p>
        </Container>
      </Section>

      <Section eyebrow="Exemple dans une PME">
        <Container className="max-w-3xl">
          <p className="border-border bg-halo-warm border-l-terracotta text-fg rounded-xl border-l-4 px-5 py-4 text-base leading-relaxed">
            {term.exemple}
          </p>
        </Container>
      </Section>

      <Section eyebrow="Erreur fréquente ou limite">
        <Container className="max-w-3xl">
          <p className="text-fg text-base leading-relaxed">{term.limite}</p>
        </Container>
      </Section>

      {term.aliases.length > 0 ? (
        <Section eyebrow="Aussi appelé">
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
        <Section eyebrow="Termes liés">
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
                      {r.definition.length > 110
                        ? `${r.definition.slice(0, 107).trim()}…`
                        : r.definition}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {faqLiees.length > 0 ? (
        <Section eyebrow="Pour aller plus loin">
          <Container className="max-w-3xl">
            <ul className="space-y-2">
              {faqLiees.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/${locale}/faq/${f.id}`}
                    className="text-fg hover:text-primary text-base underline-offset-4 hover:underline"
                  >
                    {f.question}
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      <Section>
        <Container className="max-w-3xl">
          <p className="text-fg-soft text-base leading-relaxed">
            {offre.texte}{" "}
            <Link
              href={`/${locale}${offre.href}`}
              className="text-primary underline underline-offset-4"
            >
              {offre.lien}
            </Link>
            .
          </p>
          <div className="mt-6">
            <Cta href="/glossaire" variant="ghost" size="lg">
              <ArrowRight className="h-4 w-4 rotate-180" aria-hidden="true" />
              Retour au glossaire
            </Cta>
          </div>
        </Container>
      </Section>

      <JsonLd data={definedTermJsonLd} />
    </>
  );
}
