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
import { searchSite } from "@/lib/search/site-search";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const meta = await buildProductMetadata({
    locale,
    path: "/recherche",
    title:
      locale === "fr"
        ? "Recherche · articles, villes, services IA · Axion-IA"
        : "Search · AI articles, cities, services · Axion-IA",
    description:
      locale === "fr"
        ? "Cherchez partout sur Axion-IA : articles, villes, services et base de connaissances."
        : "Search across Axion-IA: articles, cities, services and knowledge base.",
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

  // Recherche CROSS-CONTENT (2026-06-21) — `searchSite` agrège KB (FTS) + articles
  // content-gen (tier-1) + villes pSEO + services/métiers. Le visiteur peut chercher
  // une ville, un mot, un métier ou tout besoin. Filtre audience `public` côté KB,
  // tier-1 côté articles ; villes/services statiques. Fail-open par source.
  const trimmed = q?.trim() ?? "";
  const searchResults = trimmed
    ? await searchSite({ query: trimmed, locale: loc, limit: 20 })
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
            ? "Cherchez partout sur Axion-IA : articles, villes, services et base de connaissances. Tapez un mot-clé, une ville ou un métier."
            : "Search across Axion-IA: articles, cities, services and knowledge base. Type a keyword, a city or a profession."
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
                isFr
                  ? "Ex : Grenoble, formation IA, audit, RAG…"
                  : "e.g. Grenoble, AI training, audit, RAG…"
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
            <div className="mt-10 space-y-8">
              <p className="text-fg-muted text-sm">
                {isFr
                  ? `${searchResults.total} résultat${searchResults.total > 1 ? "s" : ""} pour « ${trimmed} »`
                  : `${searchResults.total} result${searchResults.total > 1 ? "s" : ""} for "${trimmed}"`}
              </p>

              {searchResults.total === 0 ? (
                <div className="space-y-4">
                  <p className="text-fg-soft text-base">
                    {isFr ? "Aucun résultat. Essayez aussi :" : "No results. Try also:"}
                  </p>
                  <ul className="space-y-2 text-base">
                    {["/blog", "/faq", "/glossaire", "/centre-aide"].map((href) => (
                      <li key={href}>
                        <Link className="text-primary hover:underline" href={href as never}>
                          → {href.replace("/", "")}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Articles (content-gen tier-1) */}
                  {searchResults.articles.length > 0 ? (
                    <section>
                      <h2 className="text-fg mb-3 text-sm font-semibold tracking-[0.14em] uppercase">
                        {isFr ? "Articles" : "Articles"}
                      </h2>
                      <ul className="divide-border divide-y">
                        {searchResults.articles.map((a) => (
                          <li key={a.slug} className="py-3">
                            <Link
                              href={`/blog/${a.slug}` as never}
                              className="text-fg hover:text-primary text-base font-medium"
                            >
                              {a.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {/* Villes (pages locales) */}
                  {searchResults.villes.length > 0 ? (
                    <section>
                      <h2 className="text-fg mb-3 text-sm font-semibold tracking-[0.14em] uppercase">
                        {isFr ? "Villes" : "Cities"}
                      </h2>
                      <ul className="flex flex-wrap gap-2">
                        {searchResults.villes.map((v) => (
                          <li key={v.slug}>
                            <Link
                              href={`/implantations/${v.region}/${v.slug}` as never}
                              className="border-border bg-bg text-fg hover:border-primary inline-flex rounded-full border px-3 py-1.5 text-sm"
                            >
                              {v.nameFr}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {/* Services / métiers */}
                  {searchResults.services.length > 0 ? (
                    <section>
                      <h2 className="text-fg mb-3 text-sm font-semibold tracking-[0.14em] uppercase">
                        {isFr ? "Services" : "Services"}
                      </h2>
                      <ul className="flex flex-wrap gap-2">
                        {searchResults.services.map((s) => (
                          <li key={s.href}>
                            <Link
                              href={s.href as never}
                              className="border-border bg-bg text-fg hover:border-primary inline-flex rounded-full border px-3 py-1.5 text-sm"
                            >
                              {s.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  {/* Base de connaissances (KB FTS) */}
                  {searchResults.kb.length > 0 ? (
                    <section>
                      <h2 className="text-fg mb-3 text-sm font-semibold tracking-[0.14em] uppercase">
                        {isFr ? "Base de connaissances" : "Knowledge base"}
                      </h2>
                      <ul className="divide-border divide-y">
                        {searchResults.kb.map((hit) => (
                          <li key={hit.translationId} className="py-4">
                            <Link
                              href={`/connaissances/${hit.slug}` as never}
                              className="block focus-visible:outline-none"
                            >
                              <p className="text-fg-muted mb-1 text-xs tracking-[0.16em] uppercase">
                                {String(hit.type).replaceAll("_", " ")}
                              </p>
                              <h3 className="text-fg hover:text-primary text-lg font-semibold">
                                {hit.title}
                              </h3>
                              {hit.excerpt ? (
                                <p className="text-fg-soft mt-2 line-clamp-3 text-sm leading-relaxed">
                                  {hit.excerpt}
                                </p>
                              ) : null}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}
                </div>
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
