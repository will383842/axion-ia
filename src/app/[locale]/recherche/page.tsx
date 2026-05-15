import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { buildProductMetadata } from "@/lib/seo";
import { searchKnowledge } from "@/lib/knowledge/search-fts";

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
    title: locale === "fr" ? "Recherche · Axion-IA" : "Search · Axion-IA",
    description:
      locale === "fr"
        ? "Recherche full-text sur la base de connaissances Axion-IA (KB V4)."
        : "Full-text search across Axion-IA knowledge base (KB V4).",
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

  // P0-11 audit E2E NAV+CTA 2026-05-15 — branchement moteur KB-7 FTS Postgres
  // (`searchKnowledge`). Portée V1 limitée à `knowledge_*` (KB V4 publique :
  // articles, méthodologies, comparatifs, playbooks, glossaire). Marketing
  // pages + pSEO villes seront indexées en V1.5 (RRF FTS + pgvector).
  // Filtre audience `public` appliqué côté SQL — aucune fuite KB team/internal.
  const trimmed = q?.trim() ?? "";
  const searchResults = trimmed
    ? await searchKnowledge({
        query: trimmed,
        locale: loc,
        limit: 20,
      })
    : null;

  const breadcrumbItems = [{ href: "/recherche", label: isFr ? "Recherche" : "Search" }];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Recherche" : "Search"}
        title={isFr ? "Trouver dans la" : "Search the"}
        titleEm={isFr ? "base de connaissances" : "knowledge base"}
        description={
          isFr
            ? "Recherche full-text sur la base de connaissances Axion-IA (articles, méthodologies, comparatifs, playbooks). L'extension cross-content (marketing, villes pSEO) arrive en V1.5."
            : "Full-text search across the Axion-IA knowledge base (articles, methodologies, comparisons, playbooks). Cross-content (marketing, city pSEO) coming in V1.5."
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
              className="bg-primary text-primary-fg cta-lift focus-visible:ring-primary inline-flex h-11 items-center gap-2 rounded-sm px-5 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {isFr ? "Rechercher" : "Search"} →
            </button>
          </form>

          {searchResults ? (
            <div className="mt-10 space-y-4">
              <p className="text-fg-muted text-sm">
                {isFr
                  ? `${searchResults.total} résultat${searchResults.total > 1 ? "s" : ""} pour « ${trimmed} »`
                  : `${searchResults.total} result${searchResults.total > 1 ? "s" : ""} for "${trimmed}"`}
              </p>
              {searchResults.hits.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-fg-soft text-base">
                    {isFr
                      ? "Aucun résultat dans la base de connaissances. Essayez aussi :"
                      : "No results in the knowledge base. Try also:"}
                  </p>
                  <ul className="space-y-2 text-base">
                    <li>
                      <Link className="text-primary hover:underline" href="/blog">
                        → Blog
                      </Link>
                    </li>
                    <li>
                      <Link className="text-primary hover:underline" href="/faq">
                        → FAQ
                      </Link>
                    </li>
                    <li>
                      <Link className="text-primary hover:underline" href="/glossaire">
                        → {isFr ? "Glossaire" : "Glossary"}
                      </Link>
                    </li>
                    <li>
                      <Link className="text-primary hover:underline" href="/centre-aide">
                        → {isFr ? "Centre d'aide" : "Help center"}
                      </Link>
                    </li>
                  </ul>
                </div>
              ) : (
                <ul className="divide-border divide-y">
                  {searchResults.hits.map((hit) => (
                    <li key={hit.translationId} className="py-4">
                      <Link
                        href={`/connaissances/${hit.slug}` as never}
                        className="block focus-visible:outline-none"
                      >
                        <p className="text-fg-muted mb-1 text-xs tracking-[0.16em] uppercase">
                          {String(hit.type).replaceAll("_", " ")}
                        </p>
                        <h2 className="text-fg group-hover:text-primary text-lg font-semibold">
                          {hit.title}
                        </h2>
                        {hit.excerpt ? (
                          <p className="text-fg-soft mt-2 line-clamp-3 text-sm leading-relaxed">
                            {hit.excerpt}
                          </p>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}

          <div className="mt-12">
            <Cta href="/contact" variant="outline">
              {isFr ? "Pas trouvé ? Contact direct" : "Not found? Direct contact"} →
            </Cta>
          </div>
        </Container>
      </Section>
    </>
  );
}
