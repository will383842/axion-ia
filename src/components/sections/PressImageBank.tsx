import * as React from "react";
import Image from "next/image";
import { ArrowRight, Camera, Image as ImageIcon, ScanLine } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface PressImageBankCategory {
  id: string;
  title: string;
  description: string;
  iconKind: "camera" | "image" | "scanline";
  /** URL d'aperçu optionnel — image représentative de la catégorie. */
  previewUrl?: string;
  previewAlt?: string;
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
              className="border-border bg-paper flex flex-col overflow-hidden rounded-xl border transition hover:shadow-[var(--shadow-subtle)]"
            >
              {/* Aperçu image si disponible */}
              {cat.previewUrl ? (
                <div className="bg-sand relative aspect-[16/9] overflow-hidden">
                  <Image
                    src={cat.previewUrl}
                    alt={cat.previewAlt ?? cat.title}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="bg-terracotta-soft flex aspect-[16/9] items-center justify-center">
                  <Icon className="text-terracotta-deep h-10 w-10" aria-hidden="true" />
                </div>
              )}
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-fg mb-2 text-base leading-tight font-semibold">{cat.title}</h3>
                <p className="text-fg-soft flex-1 text-sm leading-relaxed">{cat.description}</p>
              </div>
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
