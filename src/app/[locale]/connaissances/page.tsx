/**
 * Hub `/fr/connaissances` — KB V4 publique.
 *
 * P1-18 audit E2E NAV+CTA 2026-05-15 — expose les KnowledgeEntry triple-
 * filtrés public (status=published + audience=public + confidentiality=public).
 * Toute lecture passe par `fetchPublicKbList` — jamais `prisma.knowledgeEntry`
 * direct (anti-leak drafts).
 *
 * FR-only (doctrine v1.2 KB V1 — FR uniquement).
 * ISR Next 16 revalidate=3600.
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Cta } from "@/components/marketing/Cta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Link } from "@/i18n/navigation";
import { SITE_URL, buildProductMetadata } from "@/lib/seo";
import { fetchPublicKbList } from "@/lib/knowledge/public-fetch";

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  if (locale !== "fr") return { robots: { index: false, follow: false } };
  return buildProductMetadata({
    locale,
    path: "/connaissances",
    title: "Connaissances IA · Knowledge Base · Axion-IA",
    description:
      "Base de connaissances Axion-IA — articles, méthodologies, comparatifs, playbooks et études de cas IA opérationnels pour dirigeants de PME et ETI.",
    alternates: { fr: "/connaissances", en: "/connaissances" },
  });
}

function formatPublishedAt(date: Date | null): string | undefined {
  if (!date) return undefined;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatReadingTime(minutes: number | null): string | undefined {
  if (!minutes || minutes < 1) return undefined;
  return `${minutes} min de lecture`;
}

export default async function ConnaissancesHub({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  if (locale !== "fr") notFound();
  setRequestLocale(locale);

  const items = await fetchPublicKbList({ take: 48 });

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE_URL}/fr/connaissances#collection`,
    name: "Connaissances IA — Axion-IA",
    url: `${SITE_URL}/fr/connaissances`,
    inLanguage: "fr-FR",
    isPartOf: { "@id": `${SITE_URL}/fr#website` },
    description:
      "Base de connaissances Axion-IA — articles, méthodologies, comparatifs, playbooks et études de cas IA opérationnels.",
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["[data-aeo='kb-intro']"],
    },
    hasPart: items.slice(0, 12).map((item) => ({
      "@type": "Article",
      headline: item.title,
      url: `${SITE_URL}/fr/connaissances/${item.slug}`,
      ...(item.publishedAt ? { datePublished: item.publishedAt.toISOString() } : {}),
    })),
  };

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Base de connaissances IA · Axion-IA",
    numberOfItems: items.length,
    itemListElement: items.slice(0, 100).map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.title,
      url: `${SITE_URL}/fr/connaissances/${item.slug}`,
    })),
  };

  return (
    <>
      <Section tone="paper" className="pt-8 lg:pt-12">
        <Container>
          <Breadcrumbs items={[{ href: "/connaissances", label: "Connaissances" }]} />
        </Container>
      </Section>

      <Section tone="paper" className="pt-6 pb-16 lg:pt-10 lg:pb-24">
        <Container>
          <div className="max-w-3xl">
            <p className="text-fg-muted mb-6 text-[13px] font-medium tracking-[0.16em] uppercase">
              <span className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle" />
              Knowledge Base · IA opérationnelle
            </p>
            <h1 className="display-editorial text-fg">
              Connaissances{" "}
              <em className="italic-editorial text-terracotta not-italic">
                <span className="italic">IA opérationnelles</span>
              </em>
            </h1>
            <p
              data-aeo="kb-intro"
              className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
            >
              Articles, méthodologies, comparatifs, playbooks et études de cas pour dirigeants de
              PME et ETI. Mise à jour continue par l&apos;équipe Axion-IA.
            </p>
          </div>

          {items.length === 0 ? (
            <p className="text-fg-soft mt-12 text-base">
              Aucun article publié pour le moment. Les premiers contenus arrivent prochainement.
            </p>
          ) : (
            <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const publishedStr = formatPublishedAt(item.publishedAt);
                const readingStr = formatReadingTime(item.readingTime);
                return (
                  <li key={item.slug}>
                    <ArticleCard
                      href={`/connaissances/${item.slug}`}
                      title={item.title}
                      excerpt={item.excerpt ?? ""}
                      {...(publishedStr ? { publishedAt: publishedStr } : {})}
                      {...(readingStr ? { readingTime: readingStr } : {})}
                    />
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-16 flex flex-wrap items-center gap-4 text-sm">
            <Link
              href="/recherche"
              className="text-fg-soft hover:text-fg inline-flex items-center gap-1 underline"
            >
              Rechercher dans la base <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </Container>
      </Section>

      <CtaBlock
        title="Besoin d'aller plus loin"
        titleEm="qu'un article"
        description="Réservez un audit IA flash terrain ou une intervention sur mesure."
        cta={
          <Cta href="/reserver" size="lg">
            Réserver →
          </Cta>
        }
        tone="dark"
      />

      <JsonLd data={collectionJsonLd} />
      <JsonLd
        data={itemListJsonLd}
        strategy="afterInteractive"
        scriptId="jsonld-connaissances-itemlist"
      />
    </>
  );
}
