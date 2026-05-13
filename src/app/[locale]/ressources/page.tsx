// KB-8 — Hub `/ressources/` (FR) + `/resources/` (EN parity).
//
// Affiche les entries publiques cross-type, triées par publishedAt desc.
// Lien RSS dans <head> via metadata.types.

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { buildProductMetadata } from "@/lib/seo";
import { listPublicEntriesForFeed } from "@/server/exporters/knowledge-rss";
import { getKbTypeMeta } from "@/content/knowledge/types";

interface Props {
  params: Promise<{ locale: string }>;
}

// KB-8 fix : ISR cache 1h. `dynamic = "force-dynamic"` retiré (contradictoire
// avec revalidate, force-dynamic override ISR).
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const meta = buildProductMetadata({
    locale,
    path: "/ressources",
    title: locale === "fr" ? "Ressources · cabinet IA Axion-IA" : "Resources · Axion-IA",
    description:
      locale === "fr"
        ? "Articles, FAQ, cas concrets, glossaire IA, guides — toutes les ressources Axion-IA en un endroit."
        : "Articles, FAQ, case studies, AI glossary, guides — all Axion-IA resources in one place.",
  });
  return {
    ...meta,
    alternates: {
      ...meta.alternates,
      types: {
        "application/rss+xml": `/${locale}/ressources/feed.xml`,
        "application/feed+json": `/${locale}/ressources/feed.json`,
      },
    },
  };
}

export default async function RessourcesHubPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  const entries = await listPublicEntriesForFeed(loc);
  const breadcrumbItems = [{ href: "/ressources", label: isFr ? "Ressources" : "Resources" }];

  return (
    <>
      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>
      <Section
        titleAs="h1"
        eyebrow={isFr ? "Ressources" : "Resources"}
        title={isFr ? "Toutes nos" : "All our"}
        titleEm={isFr ? "ressources" : "resources"}
        description={
          isFr
            ? `${entries.length} ressources publiques : articles, FAQ, cas concrets, glossaire IA, guides. Mises à jour en continu.`
            : `${entries.length} public resources: articles, FAQ, case studies, AI glossary, guides. Continuously updated.`
        }
      >
        <Container className="max-w-3xl">
          <ul className="divide-border border-border divide-y border-y">
            {entries.length === 0 ? (
              <li className="text-fg-soft py-8 text-center">
                {isFr ? "Aucune ressource publiée pour l'instant." : "No resources published yet."}
              </li>
            ) : (
              entries.map((e) => (
                <li key={e.entryId} className="py-4">
                  <a href={`/${locale}${e.url}`} className="group block">
                    <div className="text-fg-soft mb-1 inline-flex items-center gap-2 text-xs tracking-wide uppercase">
                      <span>{getKbTypeMeta(e.type).labelFr}</span>
                      {e.publishedAt ? <span aria-hidden="true">·</span> : null}
                      {e.publishedAt ? (
                        <time dateTime={e.publishedAt.toISOString()}>
                          {e.publishedAt.toISOString().slice(0, 10)}
                        </time>
                      ) : null}
                    </div>
                    <h2 className="text-fg group-hover:text-primary text-lg font-semibold">
                      {e.title}
                    </h2>
                    {e.excerpt ? (
                      <p className="text-fg-soft mt-1 line-clamp-2 text-sm">{e.excerpt}</p>
                    ) : null}
                  </a>
                </li>
              ))
            )}
          </ul>
        </Container>
      </Section>
    </>
  );
}
