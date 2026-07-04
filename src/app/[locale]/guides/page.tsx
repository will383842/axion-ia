/**
 * Hub `/guides` — Sprint S+3 P0-7 (audit 18-TYPE-7-COMPARAISONS-GUIDES §8).
 *
 * Liste les Articles `templateVariant="guide-pilier"` publiés via la factory
 * content-gen (`src/server/content-gen/generators/guide-pilier.ts`, pipeline
 * 2-step outline+sections). Avant ce hub, les guides factory restaient
 * orphelins (drainage SEO inutile) car aucune page liste n'agrégeait leurs
 * URLs et `/guides` n'était pas dans `routing.pathnames`.
 *
 * Décisions de design :
 *  - Pas de page détail dédiée `/guides/[slug]` séparée — `loadGuideForView`
 *    rend déjà `src/app/[locale]/guides/[slug]/page.tsx` (HowTo JSON-LD si
 *    steps fiables). Cf. NOTE Batch 3.A audit 2026-05-15.
 *  - FR uniquement V1 (doctrine v1.2 — contenus content-gen FR-only).
 *  - Empty state premium : aucun "404", message éditorial + lien `/blog`
 *    (les guides individuels apparaissent aussi côté `/blog/[slug]` via
 *    leur templateVariant `guide-pilier`).
 *  - ISR `revalidate=3600` : nouveau guide publié visible sous 1h sans
 *    redéploiement.
 *  - JSON-LD `CollectionPage` + `ItemList` + `BreadcrumbList` + Speakable
 *    `[data-aeo="guides-hub-intro"]` (AEO 2026 : Google AI Overviews +
 *    Perplexity + Claude.ai picks the speakable selector for spoken answers).
 *  - EN miroir via routing.ts pathnames → `proxy.ts` redirige 301 vers FR
 *    tant que `EN_LOCALE_ENABLED!=true` (cf. AGENTS.md).
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { BookOpenText, Compass, Sparkles, ArrowRight } from "lucide-react";
import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { Cta } from "@/components/marketing/Cta";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import {
  buildProductMetadata,
  buildItemListJsonLd,
  buildCollectionPageJsonLd,
  SITE_URL,
} from "@/lib/seo";
import { loadGuidesIndexForView } from "@/server/content-gen/guides/loader";

// ISR pure : revalidate=3600 → nouveaux guides visibles sous 1h.
// `force-dynamic` annulerait silencieusement `revalidate`, donc NE PAS le set.
export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  return buildProductMetadata({
    locale,
    path: "/guides",
    title:
      locale === "fr"
        ? "Guides IA opérationnelle · piliers Axion-IA"
        : "Operational AI guides · Axion-IA pillars",
    description:
      locale === "fr"
        ? "Guides piliers Axion-IA : étapes claires, exemples concrets, repères ROI pour cadrer vos chantiers IA en PME et ETI."
        : "Axion-IA pillar guides: clear steps, concrete examples, ROI benchmarks to scope your AI initiatives for SMBs and mid-market.",
  });
}

export default async function GuidesHubPage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;
  const isFr = loc === "fr";

  // Doctrine v1.2 : contenus content-gen FR-only V1. EN locale relève de proxy
  // 301 (cf. AGENTS.md EN_LOCALE_DISABLED). On rend une coquille minimale en EN
  // pour que les Link typed-routes valident et que le hreflang ne soit pas une
  // 404. La 301 proxy gère le reste.
  const guides = isFr ? await loadGuidesIndexForView("fr", { limit: 50 }) : [];

  const hubUrl = `${SITE_URL}/${locale}/guides`;

  const itemListJsonLd = buildItemListJsonLd({
    locale: loc,
    path: "/guides",
    name: isFr ? "Guides piliers Axion-IA" : "Axion-IA pillar guides",
    items: guides.map((g, idx) => ({
      position: idx + 1,
      name: g.title,
      url: `${SITE_URL}/${locale}/guides/${g.slug}`,
      description: g.excerpt || g.title,
    })),
  });

  // CollectionPage + BreadcrumbList + Speakable AEO 2026 — single @graph
  // pour réduire le coût de parsing côté Google/LLMs (1 seul block JSON-LD
  // par page hub vs 3 blocks séparés).
  const collectionGraph = {
    "@context": "https://schema.org",
    "@graph": [
      buildCollectionPageJsonLd({
        locale: loc,
        path: "/guides",
        id: `${hubUrl}#collectionpage`,
        name: isFr ? "Guides piliers Axion-IA" : "Axion-IA pillar guides",
        inLanguage: locale,
        isPartOf: { "@type": "WebSite", name: "Axion-IA", url: SITE_URL },
        speakable: { selectors: ['[data-aeo="guides-hub-intro"]'] },
      }),
      {
        "@type": "BreadcrumbList",
        "@id": `${hubUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: isFr ? "Accueil" : "Home",
            item: `${SITE_URL}/${locale}`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: isFr ? "Guides" : "Guides",
            item: hubUrl,
          },
        ],
      },
    ],
  } as const;

  const breadcrumbItems = [{ href: "/guides", label: isFr ? "Guides" : "Guides" }];

  return (
    <>
      <JsonLd data={collectionGraph} />
      {guides.length > 0 && <JsonLd data={itemListJsonLd} />}

      <Container className="border-border border-b py-3">
        <Breadcrumbs items={breadcrumbItems} />
      </Container>

      {/* HERO sobre — pas de schema 2-col (les guides n'ont pas de hero image
          générique cohérente comme /comparaisons). Eyebrow + h1 + intro + pills. */}
      <section className="bg-halo-warm text-fg relative pt-12 pb-16 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24">
        <Container>
          <div className="max-w-3xl">
            <p className="text-fg-muted text-[13px] font-medium tracking-[0.16em] uppercase">
              <span
                aria-hidden="true"
                className="bg-terracotta mr-3 inline-block h-1.5 w-1.5 rounded-full align-middle"
              />
              {isFr ? "Guides piliers" : "Pillar guides"}
            </p>
            <h1 className="display-editorial text-fg mt-5">
              {isFr ? "Guides IA " : "Operational AI "}
              <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
                {isFr ? "opérationnelle" : "guides"}
              </span>
            </h1>
            <p
              className="text-fg-soft mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
              data-aeo="guides-hub-intro"
            >
              {isFr
                ? "Méthodes éprouvées en cabinet : étapes claires, exemples concrets, repères ROI. Pour cadrer un chantier IA sans dépendre d'un fournisseur ni d'un effet de mode."
                : "Field-tested methods: clear steps, concrete examples, ROI benchmarks. To scope an AI initiative without vendor lock-in or hype."}
            </p>

            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2.5">
              {[
                {
                  icon: BookOpenText,
                  label: isFr ? "Étapes structurées" : "Structured steps",
                },
                { icon: Compass, label: isFr ? "Repères ROI" : "ROI benchmarks" },
                { icon: Sparkles, label: isFr ? "Maintenu trimestriel" : "Quarterly maintenance" },
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
          </div>
        </Container>
      </section>

      <Section id="guides">
        <Container>
          {guides.length === 0 ? (
            // Empty state premium UX — pas de "404", message éditorial sobre +
            // lien /blog (les premiers guides apparaîtront aussi côté /blog via
            // templateVariant=guide-pilier). ISR 1h → publication review-queue
            // → approve fait apparaître automatiquement sans redéploiement.
            <div className="border-border bg-cream/30 mx-auto max-w-2xl rounded-lg border border-dashed p-10 text-center">
              <Sparkles
                aria-hidden="true"
                className="text-terracotta mx-auto h-6 w-6"
                strokeWidth={1.8}
              />
              <h2 className="text-fg mt-4 text-2xl font-medium">
                {isFr ? "Bientôt disponible" : "Coming soon"}
              </h2>
              <p className="text-fg-soft mt-3 leading-relaxed">
                {isFr
                  ? "Nos premiers guides piliers sont en rédaction. En attendant, nos analyses et retours terrain sont publiés sur le blog."
                  : "Our first pillar guides are being written. In the meantime, our analyses and field reports are on the blog."}
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Cta href="/blog" size="lg">
                  {isFr ? "Voir le blog" : "Read the blog"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta href="/comparaisons" variant="outline" size="lg">
                  {isFr ? "Comparaisons IA" : "AI comparisons"}
                </Cta>
              </div>
            </div>
          ) : (
            <ul className="xs:grid-cols-2 grid grid-cols-1 gap-6 md:grid-cols-3">
              {guides.map((g) => (
                <li key={g.slug}>
                  <ArticleCard
                    href={`/guides/${g.slug}`}
                    title={g.title}
                    excerpt={
                      g.excerpt || (isFr ? "Guide pilier Axion-IA." : "Axion-IA pillar guide.")
                    }
                    publishedAt={g.publishedAt.toISOString().slice(0, 10)}
                    readingTime={
                      isFr
                        ? `${g.readingTimeMinutes} min de lecture`
                        : `${g.readingTimeMinutes} min read`
                    }
                    compact
                    {...(g.featuredImage ? { imageUrl: g.featuredImage } : {})}
                    {...(g.featuredImageAlt ? { imageAlt: g.featuredImageAlt } : {})}
                  />
                </li>
              ))}
            </ul>
          )}
        </Container>
      </Section>

      <CtaBlock
        title={isFr ? "Besoin d'un cadrage personnalisé ?" : "Need tailored scoping?"}
        description={
          isFr
            ? "Un guide pose les repères. Le format collectif (1 journée) Axion-IA pose le plan d'action sur vos données réelles."
            : "A guide sets the benchmarks. The Axion-IA group format sets the action plan on your real data."
        }
        cta={
          <Cta href="/formations" size="lg">
            {isFr ? "Voir nos formations" : "See our trainings"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Cta>
        }
        tone="dark"
      />
    </>
  );
}
