import * as React from "react";
import { Download, Palette as PaletteIcon, FileText, Image as ImageIcon, Type } from "lucide-react";

// Section « Images presse » — identité de marque téléchargeable, DISTINCTE de la
// banque d'images éditoriale (/galerie). Regroupe les assets `PressMediaAsset`
// (kit média géré en admin) par usage : logos, nuancier charte couleur, documents.
//
// Le NUANCIER affiche la charte couleur officielle. La COULEUR du swatch vient des
// classes Tailwind (→ tokens CSS de globals.css, zéro dérive). Le code HEX est
// affiché comme information destinée aux journalistes/maquettistes (c'est la
// raison d'être d'une charte) — valeurs miroir de globals.css (SSOT couleurs).
//
// Server component, zéro JS client. Cibles ≥ 44px, grille mobile-first.

interface PressImageItem {
  id: string;
  kind: string; // enum DB (logo, wordmark, photo, brand_book, graphic_charter, color_charter, boilerplate)
  fileUrl: string | null;
  format: string;
  title: string;
  description: string;
}

interface PressImagesProps {
  items: ReadonlyArray<PressImageItem>;
  labels: {
    download: string;
    comingSoon: string;
    logosTitle: string;
    paletteTitle: string;
    paletteNote: string;
    documentsTitle: string;
  };
}

/**
 * Charte couleur officielle Axion-IA — miroir des tokens `globals.css` (SSOT).
 * `className` pilote la couleur réelle du swatch (token CSS) ; `hex` est l'info
 * affichée. Direction « ivoire chaud + sand + mocha + terracotta » (ADR 0002).
 */
const BRAND_PALETTE: ReadonlyArray<{
  name: string;
  hex: string;
  className: string;
  ring?: boolean;
}> = [
  { name: "Terracotta", hex: "#C24A1B", className: "bg-terracotta" },
  { name: "Mocha", hex: "#2A2520", className: "bg-mocha" },
  { name: "Bleu éditorial", hex: "#1A4DD9", className: "bg-primary" },
  { name: "Sauge", hex: "#5E6C54", className: "bg-sage" },
  { name: "Sable", hex: "#F0E9DA", className: "bg-sand", ring: true },
  { name: "Ivoire", hex: "#FAF8F3", className: "bg-canvas", ring: true },
  { name: "Anthracite", hex: "#1A1815", className: "bg-fg" },
];

const KIND_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  logo: PaletteIcon,
  wordmark: Type,
  photo: ImageIcon,
  brand_book: FileText,
  "brand-book": FileText,
  graphic_charter: FileText,
  color_charter: PaletteIcon,
  boilerplate: FileText,
};

const LOGO_KINDS = new Set(["logo", "wordmark"]);
const DOC_KINDS = new Set(["brand_book", "brand-book", "graphic_charter", "boilerplate", "photo"]);

function DownloadCard({
  item,
  labels,
}: {
  item: PressImageItem;
  labels: PressImagesProps["labels"];
}) {
  const Icon = KIND_ICON[item.kind] ?? FileText;
  const isAvailable = item.fileUrl !== null;
  return (
    <li className="border-border bg-paper flex flex-col rounded-xl border p-6 transition hover:shadow-[var(--shadow-subtle)]">
      <div className="bg-terracotta-soft text-terracotta-deep mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-fg text-base leading-tight font-semibold">{item.title}</h4>
        <span className="border-border-strong text-fg-muted shrink-0 rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase">
          {item.format}
        </span>
      </div>
      <p className="text-fg-soft mt-3 mb-6 flex-1 text-sm leading-relaxed">{item.description}</p>
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
}

export function PressImages({ items, labels }: PressImagesProps) {
  const logos = items.filter((i) => LOGO_KINDS.has(i.kind));
  const documents = items.filter((i) => DOC_KINDS.has(i.kind));
  const colorCharter = items.find((i) => i.kind === "color_charter" && i.fileUrl);

  return (
    <div className="space-y-12">
      {/* LOGOS */}
      {logos.length > 0 ? (
        <div>
          <h3 className="text-fg-muted mb-5 text-xs font-semibold tracking-wider uppercase">
            {labels.logosTitle}
          </h3>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {logos.map((item) => (
              <DownloadCard key={item.id} item={item} labels={labels} />
            ))}
          </ul>
        </div>
      ) : null}

      {/* NUANCIER CHARTE COULEUR */}
      <div>
        <h3 className="text-fg-muted mb-5 text-xs font-semibold tracking-wider uppercase">
          {labels.paletteTitle}
        </h3>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {BRAND_PALETTE.map((c) => (
            <li
              key={c.hex}
              className="border-border bg-paper flex flex-col overflow-hidden rounded-xl border"
            >
              <span
                className={`${c.className} block h-16 w-full ${c.ring ? "ring-border ring-1 ring-inset" : ""}`}
                aria-hidden="true"
              />
              <span className="px-3 py-2">
                <span className="text-fg block text-xs font-semibold">{c.name}</span>
                <span className="text-fg-muted block font-mono text-[11px] tracking-tight tabular-nums">
                  {c.hex}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <p className="text-fg-soft max-w-2xl text-sm leading-relaxed">{labels.paletteNote}</p>
          {colorCharter ? (
            <a
              href={colorCharter.fileUrl ?? "#"}
              download
              rel="noopener"
              className="border-border-strong text-fg hover:border-terracotta hover:text-terracotta focus-visible:ring-terracotta inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {colorCharter.title}
            </a>
          ) : null}
        </div>
      </div>

      {/* DOCUMENTS (brand book, charte graphique, boilerplate, photos) */}
      {documents.length > 0 ? (
        <div>
          <h3 className="text-fg-muted mb-5 text-xs font-semibold tracking-wider uppercase">
            {labels.documentsTitle}
          </h3>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {documents.map((item) => (
              <DownloadCard key={item.id} item={item} labels={labels} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
