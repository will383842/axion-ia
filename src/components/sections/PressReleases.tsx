import * as React from "react";
import Image from "next/image";
import { Calendar, Download } from "lucide-react";

import { Link } from "@/i18n/navigation";

export type PressReleaseTag = "launch" | "partnership" | "study" | "product" | "milestone";
export type PressReleaseAudience = "GENERAL" | "FOUNDER";

interface PressReleaseCard {
  slug: string;
  publishedAt: string;
  tag: PressReleaseTag;
  title: string;
  dek: string;
  /** URL du PDF téléchargeable ou `null` (legacy texte). */
  pdfUrl: string | null;
  region: string | null;
  departement: string | null;
  sector: string | null;
  audience: PressReleaseAudience;
}

/** Option de filtre (valeur = slug SSOT / enum ; "" = « tous »). */
interface FilterOption {
  value: string;
  label: string;
}

/** Valeurs actives des filtres (lues depuis l'URL). */
interface ActiveFilters {
  region: string;
  sector: string;
  audience: string;
}

interface PressReleasesProps {
  releases: ReadonlyArray<PressReleaseCard>;
  locale: "fr" | "en";
  /** Localized labels for tags + CTA + filtres. */
  labels: {
    tagLaunch: string;
    tagPartnership: string;
    tagStudy: string;
    tagProduct: string;
    tagMilestone: string;
    /** "Lire le communiqué" / "Read the release" */
    read: string;
    /** "Aucun communiqué" / "No release" */
    empty: string;
    /** "Télécharger le PDF" / "Download PDF" */
    downloadPdf: string;
    /** "Filtrer" / "Filter" */
    filterTitle: string;
    /** "Région" / "Region" */
    filterRegion: string;
    /** "Secteur" / "Sector" */
    filterSector: string;
    /** "Audience" / "Audience" */
    filterAudience: string;
    /** "Toutes les régions" / "All regions" */
    filterAllRegions: string;
    /** "Tous les secteurs" / "All sectors" */
    filterAllSectors: string;
    /** "Toutes" / "All" (audience) */
    filterAllAudiences: string;
    /** "Appliquer" / "Apply" */
    filterApply: string;
    /** "Réinitialiser" / "Reset" */
    filterReset: string;
  };
  /** Options de filtre (issues des SSOTs côté serveur). */
  filterOptions: {
    regions: ReadonlyArray<FilterOption>;
    sectors: ReadonlyArray<FilterOption>;
    audiences: ReadonlyArray<FilterOption>;
  };
  /** Filtres actifs (depuis searchParams). */
  active: ActiveFilters;
  /** Au moins un filtre est-il appliqué ? (affiche « Réinitialiser »). */
  hasActiveFilter: boolean;
  /** Chemin de la page (pour l'action GET du form), ex. "/presse#communiques". */
  formAction: string;
}

import { fmtDate } from "@/lib/intl";

function formatDate(iso: string, locale: "fr" | "en"): string {
  return fmtDate(iso, locale);
}

const selectClass =
  "border-border bg-paper text-fg focus-visible:ring-terracotta min-h-[44px] w-full rounded-lg border px-3 text-sm transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";

// Visuel de carte par catégorie (2026-07-14) — remplace l'image-texte OG
// (`/api/og?title=…`, qui affichait juste le titre sur fond de marque, « trop
// texte » selon Will) par de vraies photos de la banque d'images interne. Une
// image curée par tag ; décoratif (alt="" car le titre est dans le <h3>), donc
// pas de champ image par communiqué requis (zéro migration).
const TAG_IMAGE: Record<PressReleaseTag, string> = {
  launch: "/images/axion-ia-intervention-ia-france-toutes-regions-photo-banniere.webp",
  partnership:
    "/images/axion-ia-equipe-1to1-tous-profils-manager-rh-marketing-ops-photo-banniere.webp",
  study: "/images/axion-ia-graphique-adoption-ia-72-pourcent-2024-mckinsey-dataviz.webp",
  product:
    "/images/axion-ia-automatisation-ia-benefices-concrets-mesurables-durables-banniere.webp",
  milestone: "/images/axion-ia-audit-ia-levier-croissance-mesurable-cartographie-roi-banniere.webp",
};

// Press release cards — éditorial v3, structure card + tag pill terracotta-soft.
// Filtre facetté « ciblage média » (2026-06-24) : Server Component pur, pas de
// client JS. Le <form method="GET"> recharge la page avec les query params ;
// la requête DB est re-filtrée côté serveur (cf. getPublishedPressReleases).
export function PressReleases({
  releases,
  locale,
  labels,
  filterOptions,
  active,
  hasActiveFilter,
  formAction,
}: PressReleasesProps) {
  const tagLabel: Record<PressReleaseTag, string> = {
    launch: labels.tagLaunch,
    partnership: labels.tagPartnership,
    study: labels.tagStudy,
    product: labels.tagProduct,
    milestone: labels.tagMilestone,
  };

  return (
    <div className="flex flex-col gap-8">
      {/* FILTRE — form GET (zéro client JS). Anchor #communiques pour revenir
          à la grille après soumission. */}
      <form
        method="GET"
        action={formAction}
        className="border-border bg-paper rounded-xl border p-5 sm:p-6"
        aria-label={labels.filterTitle}
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-fg-soft text-xs font-semibold tracking-wide uppercase">
              {labels.filterRegion}
            </span>
            <select name="region" defaultValue={active.region} className={selectClass}>
              <option value="">{labels.filterAllRegions}</option>
              {filterOptions.regions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-fg-soft text-xs font-semibold tracking-wide uppercase">
              {labels.filterSector}
            </span>
            <select name="sector" defaultValue={active.sector} className={selectClass}>
              <option value="">{labels.filterAllSectors}</option>
              {filterOptions.sectors.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-fg-soft text-xs font-semibold tracking-wide uppercase">
              {labels.filterAudience}
            </span>
            <select name="audience" defaultValue={active.audience} className={selectClass}>
              <option value="">{labels.filterAllAudiences}</option>
              {filterOptions.audiences.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="border-terracotta bg-terracotta text-paper hover:bg-terracotta-deep focus-visible:ring-terracotta inline-flex min-h-[44px] items-center justify-center rounded-full border px-5 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {labels.filterApply}
          </button>
          {hasActiveFilter ? (
            <Link
              href={formAction as never}
              className="text-fg-soft hover:text-terracotta-deep text-sm font-medium underline transition"
            >
              {labels.filterReset}
            </Link>
          ) : null}
        </div>
      </form>

      {releases.length === 0 ? (
        <p className="text-fg-soft text-base leading-relaxed">{labels.empty}</p>
      ) : (
        <ul className="grid gap-6 lg:grid-cols-3">
          {releases.map((release) => (
            <li
              key={release.slug}
              className="border-border bg-paper hover:border-terracotta-soft flex flex-col overflow-hidden rounded-xl border transition hover:shadow-[var(--shadow-subtle)]"
            >
              {/* Visuel — vraie photo de la banque d'images interne, choisie par
                  catégorie (TAG_IMAGE). Optimisée par next/image (WebP/AVIF).
                  Décoratif → alt vide (le titre est dans le <h3>). */}
              <Link
                href={`/presse/${release.slug}` as never}
                aria-hidden="true"
                tabIndex={-1}
                className="bg-sand relative block aspect-[1200/630] overflow-hidden"
              >
                <Image
                  src={TAG_IMAGE[release.tag]}
                  alt=""
                  fill
                  loading="lazy"
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition-transform duration-300 hover:scale-[1.02]"
                />
              </Link>
              <div className="flex flex-1 flex-col p-7">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <span className="bg-terracotta-soft text-terracotta-deep rounded-full px-3 py-1 text-[11px] font-semibold tracking-wider uppercase">
                    {tagLabel[release.tag]}
                  </span>
                  <time
                    dateTime={release.publishedAt}
                    className="text-fg-muted inline-flex items-center gap-1.5 text-xs"
                  >
                    <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                    {formatDate(release.publishedAt, locale)}
                  </time>
                </div>
                <h3
                  className="text-fg mb-3 text-xl leading-snug font-medium"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  <Link
                    href={`/presse/${release.slug}` as never}
                    className="hover:text-terracotta-deep transition"
                  >
                    {release.title}
                  </Link>
                </h3>
                <p className="text-fg-soft flex-1 text-sm leading-relaxed">{release.dek}</p>
                {release.pdfUrl ? (
                  <a
                    href={release.pdfUrl}
                    target="_blank"
                    rel="noopener"
                    className="text-terracotta-deep hover:text-terracotta mt-6 inline-flex items-center gap-2 text-sm font-semibold transition"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    {labels.downloadPdf}
                  </a>
                ) : (
                  <p className="text-fg-muted mt-6 text-xs italic">— {labels.read}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
