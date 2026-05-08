import * as React from "react";
import { Calendar } from "lucide-react";

export type PressReleaseTag = "launch" | "partnership" | "study" | "product" | "milestone";

interface PressReleaseCard {
  slug: string;
  publishedAt: string;
  tag: PressReleaseTag;
  title: string;
  dek: string;
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
          className="border-border bg-paper hover:border-terracotta-soft flex flex-col rounded-xl border p-7 transition hover:shadow-[var(--shadow-subtle)]"
        >
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
            {release.title}
          </h3>
          <p className="text-fg-soft flex-1 text-sm leading-relaxed">{release.dek}</p>
          <p className="text-fg-muted mt-6 text-xs italic">— {labels.read} (Q3 2026)</p>
        </li>
      ))}
    </ul>
  );
}
