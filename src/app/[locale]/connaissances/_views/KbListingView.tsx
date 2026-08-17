/**
 * Vue partagée du hub `/fr/connaissances` — page 1 et pages suivantes.
 *
 * POURQUOI CE FICHIER EXISTE (2026-08-16, audit GEO/AEO, GEO-088)
 *
 * Le hub listait `take: 48` fiches. Mesuré en production le 2026-08-16, à
 * l'unité : **507 fiches déclarées dans `sitemap-knowledge.xml`, 48 liées
 * depuis le hub**. 459 pages étaient donc annoncées à Google sans qu'aucun lien
 * interne n'y mène — des orphelines au sens strict.
 *
 * Déclarer une URL dans un sitemap sans jamais y mener est le pire des deux
 * mondes : le moteur la découvre, la met en file, et n'y trouve aucun signal
 * d'importance. Le sitemap dit « ces pages comptent », l'architecture dit le
 * contraire.
 *
 * La pagination par CHEMIN est reprise de `/blog` (mêmes règles canoniques,
 * même 404 franc hors bornes, même 308 de `page/1` vers le hub). Les `prev`/
 * `next` forment une chaîne : un robot qui part de `/connaissances` atteint les
 * 11 pages, donc les 507 fiches.
 *
 * FR-only (doctrine v1.2 KB V1).
 */

import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { routing } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { CtaBlock } from "@/components/sections/CtaBlock";
import { Cta } from "@/components/marketing/Cta";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Link } from "@/i18n/navigation";
import { SITE_URL, buildProductMetadata, buildCollectionPageJsonLd } from "@/lib/seo";
import { countPublicKbEntries, fetchPublicKbList } from "@/lib/knowledge/public-fetch";

/** Fiches par page. Inchangé : c'est ce que la page 1 montrait déjà. */
export const KB_PAR_PAGE = 48;

/** Chemin canonique d'une page du hub (page 1 = `/connaissances`). */
export function kbPagePath(page: number): string {
  return page > 1 ? `/connaissances/page/${page}` : "/connaissances";
}

export async function buildKbListingMetadata(locale: string, page: number): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) return {};
  if (locale !== "fr") return { robots: { index: false, follow: false } };

  const suffixe = page > 1 ? ` — page ${page}` : "";
  return buildProductMetadata({
    locale,
    path: kbPagePath(page),
    title: `Connaissances IA · Knowledge Base · Axion-IA${suffixe}`,
    description:
      "Base de connaissances Axion-IA — articles, méthodologies, comparatifs, playbooks et études de cas IA opérationnels pour dirigeants de PME et ETI.",
    alternates: { fr: kbPagePath(page), en: kbPagePath(page) },
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

interface KbListingViewProps {
  locale: string;
  /** Page demandée, ≥ 1. La validation du format d'URL appartient à la route. */
  page: number;
}

export async function KbListingView({ locale, page }: KbListingViewProps) {
  if (!hasLocale(routing.locales, locale)) notFound();
  if (locale !== "fr") notFound();
  setRequestLocale(locale);

  const total = await countPublicKbEntries();
  const totalPages = Math.max(1, Math.ceil(total / KB_PAR_PAGE));

  // Une page hors bornes est un 404 FRANC, jamais un clamp vers la dernière —
  // sinon `/connaissances/page/900` deviendrait un alias indexable de la
  // dernière page, et on aurait remplacé 459 orphelines par une infinité de
  // doublons.
  //
  // 🔴 SAUF AU BUILD, et c'est indissociable du pré-rendu. Le build tourne sous
  // les URLs stub (ADR 0026) : `countPublicKbEntries()` rend 0, `totalPages`
  // vaut 1, et chaque page ≥ 2 partirait en `notFound()`. On figerait ainsi des
  // **404 STATIQUES** là où il y avait des 200 dynamiques — strictement pire
  // que le défaut corrigé. Piège déjà payé sur `/blog` (GEO-061).
  //
  // Au build on laisse donc passer et on rend la coquille vide. Elle est
  // repeuplée par l'ISR, et surtout **immédiatement** par le job de chauffe
  // post-déploiement, qui revalide puis purge ces chemins.
  const auBuildStub = process.env.DATABASE_URL?.includes("stub.invalid") ?? false;
  if (page > totalPages && !auBuildStub) notFound();

  const items = await fetchPublicKbList({
    take: KB_PAR_PAGE,
    skip: (page - 1) * KB_PAR_PAGE,
  });

  const aPrecedent = page > 1;
  const aSuivant = page < totalPages;
  const cheminCourant = kbPagePath(page);

  const collectionJsonLd = buildCollectionPageJsonLd({
    locale: "fr",
    path: cheminCourant,
    // `@id` page-aware : deux pages du hub ne doivent pas revendiquer la même
    // entité — même règle que `/blog`.
    id: `${SITE_URL}/fr${cheminCourant}#collection`,
    name: page > 1 ? `Connaissances IA — Axion-IA (page ${page})` : "Connaissances IA — Axion-IA",
    inLanguage: "fr-FR",
    isPartOf: { "@id": `${SITE_URL}/fr#website` },
    description:
      "Base de connaissances Axion-IA — articles, méthodologies, comparatifs, playbooks et études de cas IA opérationnels.",
    speakable: { selectors: ["[data-aeo='kb-intro']"] },
    hasPart: items.slice(0, 12).map((item) => ({
      "@type": "Article",
      headline: item.title,
      url: `${SITE_URL}/fr/connaissances/${item.slug}`,
      ...(item.publishedAt ? { datePublished: item.publishedAt.toISOString() } : {}),
    })),
  });

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Base de connaissances IA · Axion-IA",
    numberOfItems: items.length,
    // La position est ABSOLUE dans la collection, pas relative à la page :
    // repartir de 1 à chaque page dirait au moteur que la fiche 49 est la
    // première de la base.
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: (page - 1) * KB_PAR_PAGE + i + 1,
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
          {aPrecedent ? <link rel="prev" href={`/${locale}${kbPagePath(page - 1)}`} /> : null}
          {aSuivant ? <link rel="next" href={`/${locale}${kbPagePath(page + 1)}`} /> : null}

          {/* Eyebrow → pastille centrée sur la page, au-dessus du contenu. */}
          <HeroBadge className="mb-8 sm:mb-10">
            <span
              aria-hidden="true"
              className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
            />
            Knowledge Base · IA opérationnelle
          </HeroBadge>
          <div className="max-w-3xl">
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
            <ul className="xs:grid-cols-2 mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
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

          {totalPages > 1 ? (
            <nav
              aria-label="Pagination des connaissances"
              className="mt-10 flex items-center justify-between"
            >
              {aPrecedent ? (
                <Cta href={kbPagePath(page - 1) as never} variant="outline" size="md">
                  ← Précédent
                </Cta>
              ) : (
                <span />
              )}
              <span className="text-fg-muted text-sm tabular-nums">
                Page {page} sur {totalPages}
              </span>
              {aSuivant ? (
                <Cta href={kbPagePath(page + 1) as never} variant="outline" size="md">
                  Suivant →
                </Cta>
              ) : (
                <span />
              )}
            </nav>
          ) : null}

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
          <Cta href="/appel" size="lg">
            Réserver un appel →
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
