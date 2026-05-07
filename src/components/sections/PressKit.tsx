import * as React from "react";
import { Download, FileText, Image as ImageIcon, Palette, Type, FileCode } from "lucide-react";

interface PressKitItem {
  id: string;
  kind: "logo" | "wordmark" | "photo" | "brand-book" | "boilerplate";
  fileUrl: string | null;
  format: string;
  title: string;
  description: string;
}

interface PressKitProps {
  items: ReadonlyArray<PressKitItem>;
  /** Localized label for download/disabled CTA. */
  labels: {
    /** "Télécharger" / "Download" */
    download: string;
    /** "Bientôt disponible" / "Coming soon" — used when fileUrl is null. */
    comingSoon: string;
  };
}

const kindIcon: Record<PressKitItem["kind"], React.ComponentType<{ className?: string }>> = {
  logo: Palette,
  wordmark: Type,
  photo: ImageIcon,
  "brand-book": FileText,
  boilerplate: FileCode,
};

// Press kit grid — éditorial v3, cards en bg-paper sur surface sand.
// Boutons disabled quand fileUrl null (Phase 1 placeholders). Pas de hex hardcodé.
export function PressKit({ items, labels }: PressKitProps) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const Icon = kindIcon[item.kind];
        const isAvailable = item.fileUrl !== null;
        return (
          <li
            key={item.id}
            className="border-border bg-paper flex flex-col rounded-xl border p-6 transition hover:shadow-[var(--shadow-subtle)]"
          >
            <div className="bg-terracotta-soft text-terracotta-deep mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-fg text-base leading-tight font-semibold">{item.title}</h3>
              <span className="border-border-strong text-fg-muted shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
                {item.format}
              </span>
            </div>
            <p className="text-fg-soft mt-3 mb-6 flex-1 text-sm leading-relaxed">
              {item.description}
            </p>
            {isAvailable ? (
              <a
                href={item.fileUrl ?? "#"}
                download
                rel="noopener"
                className="border-border-strong text-fg hover:border-terracotta hover:text-terracotta focus-visible:ring-terracotta inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {labels.download}
              </a>
            ) : (
              <button
                type="button"
                disabled
                aria-disabled="true"
                className="border-border text-fg-muted inline-flex min-h-[44px] cursor-not-allowed items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium opacity-70"
              >
                {labels.comingSoon}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
