// Press image bank section (Sprint M? — axionia-image-bank skill v1.0).
//
// Promeut la banque d'images Axion-IA depuis l'espace presse :
// - Lien interne sitewide vers `/galerie` (boost autorité topique galerie + maillage)
// - Pattern emprunté à `PressKit` (cards en bg-paper sur surface sand)
// - Pas de hex hardcodé (palette tokens v3 Design.md)
// - WCAG 2.2 AA : focus visible, contrast ≥ 4.5:1
//
// Le composant reste purement présentationnel — pas de fetch DB. Les vignettes
// affichées sont les illustrations héros existantes du site (placeholders Phase 1)
// jusqu'à ce que Sprint 1 de la banque d'images livre les vraies entries DB.

import * as React from "react";
import { ArrowRight, Camera, Image as ImageIcon, ScanLine } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface PressImageBankCategory {
  id: string;
  title: string;
  description: string;
  iconKind: "camera" | "image" | "scanline";
}

interface PressImageBankProps {
  /** Localized labels (FR/EN). */
  labels: {
    /** "Voir la banque d'images" / "View the image bank" — primary CTA. */
    primaryCta: string;
    /** "Licence CC BY 4.0 — usage libre avec attribution" / equivalent EN. */
    licenseNote: string;
    /** Cards à afficher (3-4 catégories). */
    categories: ReadonlyArray<PressImageBankCategory>;
  };
}

const iconMap: Record<
  PressImageBankCategory["iconKind"],
  React.ComponentType<{ className?: string }>
> = {
  camera: Camera,
  image: ImageIcon,
  scanline: ScanLine,
};

export function PressImageBank({ labels }: PressImageBankProps) {
  return (
    <div className="flex flex-col gap-10">
      {/* Cards catégories */}
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {labels.categories.map((cat) => {
          const Icon = iconMap[cat.iconKind];
          return (
            <li
              key={cat.id}
              className="border-border bg-paper flex flex-col rounded-xl border p-6 transition hover:shadow-[var(--shadow-subtle)]"
            >
              <div className="bg-terracotta-soft text-terracotta-deep mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-fg mb-2 text-base leading-tight font-semibold">{cat.title}</h3>
              <p className="text-fg-soft flex-1 text-sm leading-relaxed">{cat.description}</p>
            </li>
          );
        })}
      </ul>

      {/* CTA bandeau */}
      <div className="border-border-strong bg-paper flex flex-col items-start gap-4 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <p className="text-fg-soft max-w-xl text-sm leading-relaxed">{labels.licenseNote}</p>
        <Link
          href="/galerie"
          className="border-terracotta bg-terracotta text-paper hover:bg-terracotta-deep focus-visible:ring-terracotta inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full border px-5 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {labels.primaryCta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
