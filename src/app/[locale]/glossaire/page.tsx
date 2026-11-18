import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata, SITE_URL } from "@/lib/seo";
import { buildSpeakableSpecification } from "@/lib/seo/speakable-universal";
import {
  ALL_GLOSSARY_TERMS_EXTENDED,
  GLOSSARY_CATEGORY_LABELS,
  GLOSSARY_UPDATED_ISO,
  type GlossaryCategory,
} from "@/content/glossary-extension";

interface Props {
  params: Promise<{ locale: string }>;
}

// Contenu statique rendu côté serveur : aucune lecture de base, aucun JavaScript client ajouté.
export const revalidate = 3600;

/** Ordre d'affichage des familles : du plus général au plus spécialisé. */
const ORDRE_CATEGORIES: readonly GlossaryCategory[] = [
  "foundational",
  "models",
  "rag",
  "agents",
  "usages",
  "security",
  "gouvernance",
  "evaluation",
  "infra",
  "visibilite",
];

const NB_TERMES = ALL_GLOSSARY_TERMS_EXTENDED.length;

function dateLisible(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/glossaire",
    title: `Glossaire de l'IA en entreprise : ${NB_TERMES} termes expliqués simplement · Axion-IA`,
    description: `Le vocabulaire de l'IA en entreprise défini en clair : agent IA, RAG, MCP, AI Act, GEO… ${NB_TERMES} termes avec des exemples de PME françaises.`,
    alternates: { fr: "/glossaire", en: "/glossary" },
  });
}

export default async function GlossaryPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const urlHub = `${SITE_URL}/${locale}/glossaire`;
  const termes = ALL_GLOSSARY_TERMS_EXTENDED;

  const groupes = ORDRE_CATEGORIES.map((cat) => ({
    cat,
    termes: termes.filter((t) => t.category === cat),
  })).filter((g) => g.termes.length > 0);

  const definedTermSetJsonLd = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": `${urlHub}#glossaire`,
    name: "Glossaire de l'IA en entreprise · Axion-IA",
    description:
      "Le vocabulaire de l'intelligence artificielle en entreprise, défini en clair, avec des exemples de PME françaises.",
    inLanguage: "fr",
    url: urlHub,
    dateModified: GLOSSARY_UPDATED_ISO,
    publisher: { "@id": `${SITE_URL}/#organization` },
    speakable: buildSpeakableSpecification({
      selectors: ["[data-aeo='glossary-intro']"],
    }),
    hasDefinedTerm: termes.map((t) => ({
      "@type": "DefinedTerm",
      "@id": `${urlHub}/${t.slug}#term`,
      termCode: t.slug,
      name: t.term,
      description: t.definition,
      url: `${urlHub}/${t.slug}`,
      inDefinedTermSet: urlHub,
    })),
  } as const;

  const breadcrumbItems = [{ href: "/glossaire", label: "Glossaire" }];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow="Glossaire"
        title="Le vocabulaire de l'IA en entreprise,"
        titleEm="expliqué simplement"
        description={
          <span data-aeo="glossary-intro">
            {`${NB_TERMES} termes pour parler d'IA sans jargon : chaque fiche donne une définition claire, explique comment ça marche, montre un exemple dans une PME française et rappelle les limites.`}
          </span>
        }
      >
        <Container className="mt-8 max-w-2xl">
          <p className="text-fg-soft text-sm">
            {`${NB_TERMES} termes · mis à jour le `}
            <time dateTime={GLOSSARY_UPDATED_ISO}>{dateLisible(GLOSSARY_UPDATED_ISO)}</time>
          </p>
          <nav aria-label="Familles de termes" className="mt-5">
            <ul className="flex flex-wrap gap-2">
              {groupes.map((g) => (
                <li key={g.cat}>
                  <a
                    href={`#famille-${g.cat}`}
                    className="border-border text-fg-soft hover:text-primary inline-flex rounded-full border px-3 py-1 text-sm"
                  >
                    {GLOSSARY_CATEGORY_LABELS[g.cat]}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="mt-7 flex flex-wrap items-center gap-4">
            <Cta href="/journee-ia" size="lg">
              Découvrir La Journée IA
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Cta>
            <Cta href="/guide-ia" variant="outline" size="lg">
              Lire le guide IA
            </Cta>
          </div>
        </Container>
      </Section>
      {groupes.map((g) => (
        <Section key={g.cat} eyebrow={GLOSSARY_CATEGORY_LABELS[g.cat]}>
          <Container className="max-w-3xl">
            <h2 id={`famille-${g.cat}`} className="sr-only">
              {GLOSSARY_CATEGORY_LABELS[g.cat]}
            </h2>
            <dl className="border-border divide-border space-y-0 divide-y border-y">
              {g.termes.map((t) => (
                <div
                  key={t.slug}
                  id={t.slug}
                  className="grid scroll-mt-24 gap-1 py-4 sm:grid-cols-[12rem_1fr] sm:gap-4"
                >
                  <dt className="text-sm font-semibold">
                    <Link
                      href={{ pathname: "/glossaire/[slug]", params: { slug: t.slug } }}
                      className="text-fg hover:text-primary"
                    >
                      {t.term}
                    </Link>
                  </dt>
                  <dd className="text-fg-soft text-base leading-relaxed">{t.definition}</dd>
                </div>
              ))}
            </dl>
          </Container>
        </Section>
      ))}
      <JsonLd data={definedTermSetJsonLd} />
    </>
  );
}
