import * as React from "react";
import Image from "next/image";
import { Calendar, Download } from "lucide-react";

import { Link } from "@/i18n/navigation";

export type PressReleaseTag = "launch" | "partnership" | "study" | "product" | "milestone";

interface PressReleaseCard {
  slug: string;
  publishedAt: string;
  tag: PressReleaseTag;
  title: string;
  dek: string;
  /** URL du PDF téléchargeable ou `null` (legacy texte). */
  pdfUrl: string | null;
}

interface PressReleasesProps {
  releases: ReadonlyArray<PressReleaseCard>;
  locale: "fr" | "en";
  /** Localized labels for tags + CTA. */
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
  };
}

import { fmtDate } from "@/lib/intl";

function formatDate(iso: string, locale: "fr" | "en"): string {
  return fmtDate(iso, locale);
}

// Press release cards — éditorial v3, structure card + tag pill terracotta-soft.
// Pas de page détail [slug] dans Phase 1 (texte affiché inline) — Phase 2 ajoute
// `/presse/[slug]` et permet d'activer les liens.
export function PressReleases({ releases, locale, labels }: PressReleasesProps) {
  if (releases.length === 0) {
    return <p className="text-fg-soft text-base leading-relaxed">{labels.empty}</p>;
  }

  const tagLabel: Record<PressReleaseTag, string> = {
    launch: labels.tagLaunch,
    partnership: labels.tagPartnership,
    study: labels.tagStudy,
    product: labels.tagProduct,
    milestone: labels.tagMilestone,
  };

  return (
    <ul className="grid gap-6 lg:grid-cols-3">
      {releases.map((release) => (
        <li
          key={release.slug}
          className="border-border bg-paper hover:border-terracotta-soft flex flex-col overflow-hidden rounded-xl border transition hover:shadow-[var(--shadow-subtle)]"
        >
          {/* Visuel — image OG brandée (texte du titre sur fond marque), unique
              par communiqué. `unoptimized` : route dynamique, pas d'optimisation
              next/image (et build stub safe). Décoratif → alt vide (titre en h3). */}
          <Link
            href={`/presse/${release.slug}` as never}
            aria-hidden="true"
            tabIndex={-1}
            className="bg-sand relative block aspect-[1200/630] overflow-hidden"
          >
            <Image
              src={`/api/og?title=${encodeURIComponent(release.title)}`}
              alt=""
              fill
              unoptimized
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
  );
}
