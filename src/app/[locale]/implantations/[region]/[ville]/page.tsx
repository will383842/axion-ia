/**
 * Page ville — La Journée IA à {Ville} (refonte SEO/GEO du 2026-11-11).
 *
 * Route : `/[locale]/implantations/[region]/[ville]`.
 *
 * Une seule offre : La Journée IA. La page ne vend plus « 5 services » : h1, « En bref »,
 * déroulé, contexte local, garantie, FAQ et CTA parlent tous de la Journée IA, avec les
 * textes communs de `@/content/journee-ia-commun` (prix = jeton, garantie mot pour mot).
 * Tous les textes locaux viennent de `@/content/villes/journee-ia-locale` (testés sur
 * toutes les villes : longueurs, unicité, mots interdits).
 *
 * Aucune fausse présence locale : pas de `LocalBusiness`, pas d'adresse, et le texte dit
 * que nous n'avons pas de bureau dans la ville — nous venons dans les locaux du client.
 * Le JSON-LD (Service Journée IA localisé + BreadcrumbList + WebPage) est émis EN LIGNE,
 * dans le HTML servi (il était `afterInteractive`, donc absent du HTML).
 *
 * Anti-doorway HCU 2024 : villes sans `ville.copy` → stub `noindex` + absence du sitemap
 * (`buildImplantationsSitemap` filtre sur `getIndexableVilles`). Règle inchangée.
 */

import { EncartEnVideo } from "@/components/videos/EncartEnVideo";
import { THEME_GENERIQUE_VILLES } from "@/server/videos/encarts";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowUpRight, MapPin, Building2 } from "lucide-react";

import { routing, type Locale } from "@/i18n/routing";
import { Section } from "@/components/layout/Section";
import { Container } from "@/components/layout/Container";
import { HeroBadge } from "@/components/marketing/HeroBadge";
import { Cta } from "@/components/marketing/Cta";
import { ArticleCard } from "@/components/marketing/ArticleCard";
import { JsonLdGraph } from "@/components/marketing/JsonLdGraph";
import { Illustration } from "@/components/visual/Illustration";
import { Breadcrumbs } from "@/components/nav/Breadcrumbs";
import { Link } from "@/i18n/navigation";
import { getBlogArticlesByVille } from "@/server/content-gen/blog/get-articles-by-ville";
import { hasVilleHeroImage } from "@/content/villes/hero-images-map";
import { fmtPopulation } from "@/lib/intl";

import { getRegion } from "@/content/regions";
import { type Ville, isVilleIndexable } from "@/content/villes";
import { villesPrerenduesAuBuild } from "@/content/villes/prerendu";
import { resolveVilleWithCopy } from "@/content/villes/resolve-with-copy";
import {
  aVille,
  CHEMIN_JOURNEE_IA,
  DATE_MAJ_IMPLANTATIONS,
  ancresJourneeIa,
  depuisVille,
  descriptionVille,
  enBrefVille,
  enRegion,
  faqVille,
  h1Ville,
  libelleDepartement,
  lienRendezVous,
  secteursLisibles,
  titreVille,
  wikidataVilleUrl,
} from "@/content/villes/journee-ia-locale";
import { buildProductMetadata } from "@/lib/seo";
import { buildJourneeIaVilleJsonLd } from "@/lib/seo/ville-service-jsonld";

import type { VilleContext } from "@/components/services/types";
import { VilleCommunesProches } from "@/components/ville/VilleCommunesProches";
import { VilleFaqGeolocalisee } from "@/components/ville/VilleFaqGeolocalisee";

interface Props {
  params: Promise<{ locale: string; region: string; ville: string }>;
}

export function generateStaticParams(): Array<{ region: string; ville: string }> {
  // 2026-05-27 — Build T3 batch saturait le disk GH Actions runner (No space left
  // on device). On limite generateStaticParams aux villes pop ≥ 100k (= T1+T2 ~40
  // villes seulement). Toutes les autres villes (T3 + T4) sont rendues en ISR
  // on-demand au 1er hit (`dynamicParams=true` + revalidate=86400 = recache 24h).
  // Trade-off : 1er hit T3 = ~500ms latence, mais build SSG passe de 17 629 à
  // ~13 500 routes (économie ~5 GB disk + 8 min build).
  // Les villes T3 restent indexables (sitemap.xml + meta tags OK), elles sont
  // juste pas pré-rendues au build — Google les crawle = ISR génère = cachée.
  //
  // 2026-08-16 (GEO-118) — le critère vit dans `@/content/villes/prerendu` parce
  // qu'il a un SECOND consommateur : le job `warm` du déploiement doit revalider
  // exactement ces pages-là, et pas d'autres (cf. l'en-tête de ce module). Deux
  // endroits qui décrivent le même ensemble finissent par diverger — c'est le
  // défaut même que GEO-118 constate.
  return villesPrerenduesAuBuild().map((v) => ({
    region: v.region,
    ville: v.slug,
  }));
}

// P1-13 (audit re-run 2026-05-15) — ISR sur pages villes pSEO (~2150 routes).
// dynamicParams=true : génère à la volée toute ville pas dans generateStaticParams.
export const revalidate = 86400;
export const dynamicParams = true;

/**
 * Secteurs de la ville, tels que les données les portent : d'abord les secteurs INSEE
 * vérifiés (`economicData`), sinon ceux de la fiche rédigée. Rien n'est inventé.
 */
function secteursDeLaVille(ville: Ville): ReadonlyArray<string> {
  const verifies = ville.economicData?.topSectorsNaf?.map((s) => s.label) ?? [];
  return secteursLisibles(verifies.length > 0 ? verifies : (ville.copy?.topSectorsNaf ?? []));
}

/** Date de première publication des pages villes (`WebPage.datePublished`). */
const DATE_PUBLICATION_VILLES = "2026-05-26";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, region: regionSlug, ville: villeSlug } = await params;
  // P0 2026-06-14 — un slug ville/région introuvable force `noindex,nofollow` (pas de
  // villes fantômes indexées), cohérent avec le notFound() de la page.
  const NOT_FOUND_META: Metadata = { robots: { index: false, follow: false } };
  if (!hasLocale(routing.locales, locale)) return NOT_FOUND_META;
  const ville = await resolveVilleWithCopy(villeSlug);
  if (!ville || ville.region !== regionSlug) return NOT_FOUND_META;
  const region = getRegion(regionSlug);
  if (!region) return NOT_FOUND_META;

  // Title ≤ 60 (marque comprise, servi tel quel) et description ≤ 155, uniques par ville :
  // un seul helper, testé sur toutes les villes.
  const meta = await buildProductMetadata({
    locale,
    path: `/implantations/${region.slug}/${ville.slug}`,
    title: titreVille(ville),
    description: descriptionVille(ville),
    alternates: {
      fr: `/implantations/${region.slug}/${ville.slug}`,
      en: `/locations/${region.slug}/${ville.slug}`,
    },
  });
  // Phasing indexation (Will 2026-05-28) — inchangé : une ville n'est `index:true` que si
  // elle a un contenu rédigé ET qu'elle est dans la cohorte indexable du jour. Sinon
  // `noindex, follow` (hors sitemap), cohérent avec `getIndexableVilles()`.
  if (!ville.copy || !isVilleIndexable(ville.slug)) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

export default async function VillePage({ params }: Props) {
  const { locale, region: regionSlug, ville: villeSlug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const ville = await resolveVilleWithCopy(villeSlug);
  if (!ville || ville.region !== regionSlug) notFound();
  const region = getRegion(regionSlug);
  if (!region) notFound();
  setRequestLocale(locale);
  const loc = locale as Locale;

  const breadcrumbItems = [
    { href: "/implantations", label: "Implantations" },
    { href: `/implantations/${region.slug}`, label: region.nameFr },
    { href: `/implantations/${region.slug}/${ville.slug}`, label: ville.nameFr },
  ];

  // ─── Pages sans contenu rédigé : stub minimal noindex (anti-doorway HCU 2024) ───
  if (!ville.copy) {
    return <VilleStub ville={ville} region={region} breadcrumbItems={breadcrumbItems} />;
  }

  const path = `/implantations/${region.slug}/${ville.slug}`;
  const titre = titreVille(ville);
  const description = descriptionVille(ville);
  const secteurs = secteursDeLaVille(ville);
  const enBref = enBrefVille(ville, region, secteurs);
  const faq = faqVille(ville);
  const [ancre1, ancre2] = ancresJourneeIa(ville.slug);

  const villeContext: VilleContext = {
    name: ville.nameFr,
    region: region.nameFr,
    regionSlug: region.slug,
    villeSlug: ville.slug,
    inseeCode: ville.inseeCode,
    population: ville.population,
  };

  // P2 maillage ville (2026-06-21) — articles tier-1 ancrés sur cette ville. Fail-open
  // (`[]` au build stub.invalid) ; section rendue UNIQUEMENT s'il y a des articles.
  const villeArticles = await getBlogArticlesByVille(ville.slug, loc, 3);

  // Photo de la ville quand elle existe (58 villes) ; sinon pas d'image (pas d'illustration
  // générique qui prétendrait représenter la ville).
  const aUnePhoto = hasVilleHeroImage(ville.slug);

  const jsonLd = buildJourneeIaVilleJsonLd({
    path,
    titre,
    description,
    ville,
    region,
    wikidataUrl: wikidataVilleUrl(ville.nameFr),
    filAriane: [
      { name: "Accueil", href: "/" },
      { name: "Implantations", href: "/implantations" },
      { name: region.nameFr, href: `/implantations/${region.slug}` },
      { name: ville.nameFr, href: path },
    ],
    speakable: ["#ville-hub-hero", "[data-en-bref]"],
    datePublished: DATE_PUBLICATION_VILLES,
    dateModified: DATE_MAJ_IMPLANTATIONS,
  });

  return (
    <>
      {/* JSON-LD EN LIGNE (dans le HTML servi) : Service Journée IA localisé à la ville,
          BreadcrumbList, WebPage. La FAQPage est émise par `VilleFaqGeolocalisee`. */}
      <JsonLdGraph schemas={jsonLd} />

      <Container>
        <div className="pt-6 pb-2">
          <Breadcrumbs items={breadcrumbItems} emitJsonLd={false} />
        </div>
      </Container>

      {/* ── Hero ── */}
      <section
        aria-labelledby="ville-hub-hero"
        className="bg-halo-warm relative overflow-hidden pt-8 pb-16 sm:pt-12 sm:pb-20 lg:pt-16 lg:pb-24"
      >
        <Container>
          <HeroBadge className="mb-8 sm:mb-10">
            <span
              aria-hidden="true"
              className="bg-terracotta inline-block h-1.5 w-1.5 rounded-full"
            />
            {`La Journée IA · ${ville.nameFr}`}
          </HeroBadge>
          <div
            className={
              aUnePhoto
                ? "grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14 xl:gap-16"
                : "mx-auto max-w-3xl"
            }
          >
            <div className="max-w-2xl">
              <h1
                id="ville-hub-hero"
                className="text-fg text-[clamp(2rem,4vw,3.5rem)] leading-[1.06] font-semibold tracking-tight"
              >
                {h1Ville(ville)}
              </h1>
              <p className="text-fg-soft mt-6 text-lg leading-relaxed sm:text-xl">
                {`Une journée chez vous, ${aVille(ville.nameFr)}, comme partout en France : le matin, nous chiffrons vos plus gros gains ; l’après-midi, nous formons vos équipes sur leurs propres dossiers.`}
              </p>
              <div className="text-fg-muted mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4" aria-hidden="true" />
                  {fmtPopulation(ville.population, "fr")} habitants
                </span>
                <span className="inline-flex items-center gap-2">
                  <Building2 className="h-4 w-4" aria-hidden="true" />
                  {libelleDepartement(ville)} · {region.nameFr}
                </span>
              </div>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Cta
                  href={lienRendezVous(depuisVille(ville.slug, "haut")) as never}
                  variant="primary"
                  size="lg"
                  shape="pill"
                  track="ville_cta_diagnostic"
                  data-source-ville={ville.slug}
                >
                  Réserver le diagnostic gratuit
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Cta>
                <Cta
                  href={CHEMIN_JOURNEE_IA}
                  variant="ghost"
                  size="lg"
                  shape="pill"
                  track="ville_cta_journee_ia"
                  data-source-ville={ville.slug}
                >
                  Découvrir la Journée IA
                </Cta>
              </div>
            </div>
            {aUnePhoto ? (
              <div className="hidden lg:block">
                <Illustration
                  slot="VILLE-01-hero"
                  src={`/villes-hero/${ville.slug}.avif`}
                  aspectRatio="1:1"
                  filenameTarget={`public/villes-hero/${ville.slug}.avif`}
                  alt={`Vue de ${ville.nameFr}`}
                  caption={ville.nameFr}
                  priority
                />
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      {/* ── En bref : propre à la ville, textes communs pour l'offre ── */}
      <section
        aria-labelledby="ville-en-bref"
        className="bg-paper border-border border-t py-14 sm:py-16 lg:py-20"
      >
        <Container>
          <div className="mx-auto max-w-3xl">
            <p className="text-terracotta mb-4 text-sm font-bold tracking-[0.2em] uppercase">
              En bref
            </p>
            <h2
              id="ville-en-bref"
              className="text-fg text-[clamp(1.75rem,3.2vw,2.5rem)] leading-tight font-semibold tracking-tight"
            >
              {`La Journée IA ${aVille(ville.nameFr)}, en bref`}
            </h2>
            <div
              data-en-bref
              className="text-fg-soft mt-6 space-y-4 text-base leading-relaxed sm:text-lg"
            >
              {enBref.map((p) => (
                <p key={p.slice(0, 32)}>{p}</p>
              ))}
            </div>
            <p className="mt-6 text-base">
              <Link
                href={CHEMIN_JOURNEE_IA}
                data-cta-tracking="ville_en_bref_journee_ia"
                data-source-ville={ville.slug}
                className="text-terracotta font-semibold underline-offset-4 hover:underline"
              >
                Voir {ancre1}
              </Link>
            </p>
          </div>
        </Container>
      </section>

      {/* ── Le déroulé ── */}
      <Section
        eyebrow="Le déroulé"
        title="Une journée,"
        titleEm="trois temps"
        description={`Le même déroulé ${aVille(ville.nameFr)} que partout en France.`}
        tone="sand"
      >
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              titre: "Le matin : l’audit",
              texte:
                "2 à 4 h d’audit dans vos locaux : nous cartographions l’entreprise service par service, faisons le point avec vous sur vos priorités et chiffrons vos plus gros gains, en heures et en euros.",
            },
            {
              titre: "L’après-midi : la formation",
              texte:
                "4 heures de formation de vos équipes sur leurs propres dossiers, avec une attestation par participant.",
            },
            {
              titre: "Ensuite : le rapport",
              texte:
                "Rapport chiffré sous 3 jours ouvrés : vos gains, les tâches à automatiser classées par rentabilité et votre plan d’action sur 90 jours.",
            },
          ].map((etape, i) => (
            <li
              key={etape.titre}
              className="bg-paper border-border shadow-subtle flex h-full flex-col rounded-2xl border p-6"
            >
              <span className="text-terracotta text-sm font-bold tabular-nums">{`0${i + 1}`}</span>
              <h3
                className="text-fg mt-2 text-xl leading-tight font-semibold"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {etape.titre}
              </h3>
              <p className="text-fg-soft mt-3 text-[15px] leading-relaxed">{etape.texte}</p>
            </li>
          ))}
        </ol>
        <p className="text-fg-soft mt-8 text-center text-base">
          <Link
            href={CHEMIN_JOURNEE_IA}
            data-cta-tracking="ville_deroule_journee_ia"
            data-source-ville={ville.slug}
            className="text-terracotta font-semibold underline-offset-4 hover:underline"
          >
            {ancre2.charAt(0).toUpperCase() + ancre2.slice(1)}
          </Link>
          {" · "}
          <Link
            href={`/implantations/${region.slug}` as never}
            data-cta-tracking="ville_deroule_region"
            data-source-ville={ville.slug}
            className="text-fg font-semibold underline-offset-4 hover:underline"
          >
            {`La Journée IA ${enRegion(region)}`}
          </Link>
        </p>
      </Section>

      {/* ── FAQ courte, cohérente avec le texte visible (FAQPage en ligne) ── */}
      <VilleFaqGeolocalisee villeContext={villeContext} faqs={faq} isFr />

      {/* ── Communes voisines (liens vers des pages indexables seulement) ── */}
      <VilleCommunesProches ville={ville} isFr />

      {/* Encart « En vidéo » (ADR 0070) : lecture mise en cache par processus (jamais une requête
          par page), rien tant qu'aucune vidéo n'est publiée. */}
      <EncartEnVideo theme={THEME_GENERIQUE_VILLES} />

      {villeArticles.length > 0 ? (
        <Section eyebrow="Ressources" title={`À lire avant votre Journée IA`}>
          <Container>
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {villeArticles.map((a) => (
                <li key={a.id}>
                  <ArticleCard
                    href={a.slug.startsWith("guide-") ? `/guides/${a.slug}` : `/blog/${a.slug}`}
                    title={a.title}
                    excerpt={a.excerpt ?? ""}
                    {...(a.publishedAt
                      ? { publishedAt: a.publishedAt.toISOString().slice(0, 10) }
                      : {})}
                  />
                </li>
              ))}
            </ul>
          </Container>
        </Section>
      ) : null}

      {/* ── CTA final ── */}
      <section
        aria-labelledby="ville-cta-final"
        className="bg-terracotta text-paper py-14 sm:py-16 lg:py-20"
      >
        <Container>
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
            <h2
              id="ville-cta-final"
              className="text-paper text-[clamp(1.75rem,3.5vw,2.75rem)] leading-tight font-semibold tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              {`Votre Journée IA ${aVille(ville.nameFr)} commence par 45 minutes gratuites`}
            </h2>
            <p className="text-paper/85 text-base leading-relaxed sm:text-lg">
              Diagnostic IA gratuit de 45 minutes, en visio ou par téléphone : une première tâche
              chiffrée, et la date de votre journée fixée ensemble.
            </p>
            <Link
              href={lienRendezVous(depuisVille(ville.slug, "bas")) as never}
              data-cta-tracking="ville_cta_final_diagnostic"
              data-source-ville={ville.slug}
              className="bg-paper text-terracotta cta-lift focus-visible:ring-paper inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-base font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Réserver le diagnostic gratuit
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}

// ===========================================================================
// Stub minimal pour les villes sans contenu rédigé : `noindex` + hors sitemap
// (anti-doorway HCU 2024). Il parle aussi de la Journée IA, sans contexte local.
// ===========================================================================
interface VilleStubProps {
  ville: Ville;
  region: { slug: string; nameFr: string };
  breadcrumbItems: ReadonlyArray<{ href: string; label: string }>;
}
function VilleStub({ ville, region, breadcrumbItems }: VilleStubProps) {
  return (
    <Section
      titleAs="h1"
      eyebrow={`Implantations · ${region.nameFr}`}
      title={h1Ville(ville)}
      description={`Nous menons la Journée IA dans les locaux de votre entreprise ${aVille(ville.nameFr)} (${libelleDepartement(ville)}), comme partout en France : audit le matin, formation de vos équipes l’après-midi, rapport chiffré sous 3 jours ouvrés.`}
    >
      <div className="mb-8">
        <Breadcrumbs items={breadcrumbItems} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Cta
          href={lienRendezVous(depuisVille(ville.slug, "haut")) as never}
          variant="primary"
          size="lg"
          shape="pill"
          track="ville_stub_diagnostic"
          data-source-ville={ville.slug}
        >
          Réserver le diagnostic gratuit
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Cta>
        <Cta
          href={CHEMIN_JOURNEE_IA}
          variant="ghost"
          size="lg"
          shape="pill"
          track="ville_stub_journee_ia"
        >
          Découvrir la Journée IA
        </Cta>
        <Cta
          href={`/implantations/${region.slug}` as never}
          variant="ghost"
          size="lg"
          shape="pill"
          track="ville_stub_back_region"
        >
          {`La Journée IA ${enRegion(region)}`}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Cta>
      </div>
    </Section>
  );
}
