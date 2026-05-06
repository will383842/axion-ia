import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { JsonLd } from "@/components/marketing/JsonLd";
import { buildProductMetadata, buildBreadcrumbJsonLd, SITE_URL } from "@/lib/seo";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const meta = buildProductMetadata({
    locale,
    path: "/recherche",
    title: locale === "fr" ? "Recherche · AxionIA" : "Search · AxionIA",
    description:
      locale === "fr"
        ? "Recherche full-text sur le contenu AxionIA — interventions, audit, blog, FAQ, aide."
        : "Full-text search across AxionIA content — sessions, audit, blog, FAQ, help.",
    alternates: { fr: "/recherche", en: "/search" },
  });
  return { ...meta, robots: { index: false, follow: true } };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { q } = await searchParams;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // SearchAction Schema — Sprint 15 wires Postgres FTS for actual results.
  const searchActionJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: `${SITE_URL}/${locale}`,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/${locale}/recherche?q={query}`,
      "query-input": "required name=query",
    },
  } as const;

  const breadcrumb = buildBreadcrumbJsonLd({
    locale: loc,
    items: [
      { name: isFr ? "Accueil" : "Home", href: "/" },
      { name: isFr ? "Recherche" : "Search", href: "/recherche" },
    ],
  });

  return (
    <>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Recherche" : "Search"}
        title={isFr ? "Trouver dans AxionIA" : "Search AxionIA"}
        description={
          isFr
            ? "Recherche cross-content (blog, FAQ, aide, cas concrets, glossaire). Sprint 15 connecte Postgres FTS — pour l'instant le moteur est en cours de construction."
            : "Cross-content search (blog, FAQ, help, case studies, glossary). Sprint 15 wires Postgres FTS — engine under construction for now."
        }
      />
      <Section>
        <Container className="max-w-2xl">
          <form action={`/${locale}/recherche`} method="GET" className="flex flex-wrap gap-3">
            <label className="sr-only" htmlFor="q">
              {isFr ? "Mot-clé" : "Keyword"}
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={q}
              placeholder={
                isFr ? "Ex : RAG, audit, ROI, calendrier…" : "e.g. RAG, audit, ROI, calendar…"
              }
              className="border-border bg-bg text-fg focus-visible:border-primary focus-visible:ring-primary/20 flex h-11 flex-1 rounded-sm border px-3 py-2 text-base focus-visible:ring-4 focus-visible:outline-none"
            />
            <button
              type="submit"
              className="bg-primary text-primary-fg cta-translate focus-visible:ring-primary inline-flex h-11 items-center gap-2 rounded-sm px-5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {isFr ? "Rechercher" : "Search"} →
            </button>
          </form>

          {q ? (
            <div className="mt-10 space-y-4">
              <p className="text-base text-gray-700">
                {isFr
                  ? `Résultats pour « ${q} » — moteur Sprint 15. En attendant, essayez :`
                  : `Results for "${q}" — Sprint 15 engine. Meanwhile, try:`}
              </p>
              <ul className="space-y-2 text-base">
                <li>
                  <a className="text-primary hover:underline" href={`/${locale}/blog`}>
                    → Blog
                  </a>
                </li>
                <li>
                  <a className="text-primary hover:underline" href={`/${locale}/faq`}>
                    → FAQ
                  </a>
                </li>
                <li>
                  <a className="text-primary hover:underline" href={`/${locale}/glossaire`}>
                    → {isFr ? "Glossaire" : "Glossary"}
                  </a>
                </li>
                <li>
                  <a className="text-primary hover:underline" href={`/${locale}/centre-aide`}>
                    → {isFr ? "Centre d'aide" : "Help center"}
                  </a>
                </li>
              </ul>
            </div>
          ) : null}

          <div className="mt-12">
            <Cta href="/contact" variant="outline">
              {isFr ? "Pas trouvé ? Contact direct" : "Not found? Direct contact"} →
            </Cta>
          </div>
        </Container>
      </Section>
      <JsonLd data={searchActionJsonLd} />
      <JsonLd data={breadcrumb} />
    </>
  );
}
