// Server Component — placeholder visuel éditorial pour les emplacements
// d'illustrations Sprint Visual Rhythm 2026 en attente de génération
// GPT-image. Affiche un cadre stylé palette Axion-IA avec slot ID + ratio +
// filename target — Will substitue par l'image réelle quand elle est
// générée et droppée dans `public/illustrations/`.
//
// Doctrine : pas de lorem ipsum gris générique. On garde la palette brand
// (sand + terracotta soft + border) pour que les pages restent on-brand
// même en mode placeholder.

import type { ReactNode } from "react";
import { ImageIcon } from "lucide-react";

export interface IllustrationPlaceholderProps {
  /** ID du prompt GPT-image (ex "METHO-01-hero"). Affiché dans le placeholder. */
  slot: string;
  /** Aspect ratio souhaité — détermine la hauteur calculée du placeholder. */
  aspectRatio: "16:9" | "4:5" | "1:1" | "1200x630";
  /** Filename cible (ex `public/illustrations/methodologie-hero.avif`). */
  filenameTarget: string;
  /** Description courte du sujet (ex "Schéma éditorial cabinet IA"). */
  caption: string;
  /** Texte alternatif a11y. Défaut : `Placeholder illustration ${slot}`. */
  ariaLabel?: string;
  className?: string;
}

const ratioToPaddingTop: Record<IllustrationPlaceholderProps["aspectRatio"], string> = {
  "16:9": "56.25%",
  "4:5": "125%",
  "1:1": "100%",
  "1200x630": "52.5%",
};

export function IllustrationPlaceholder({
  slot,
  aspectRatio,
  filenameTarget,
  caption,
  ariaLabel,
  className,
}: IllustrationPlaceholderProps): ReactNode {
  return (
    <figure
      role="img"
      aria-label={ariaLabel ?? `Placeholder illustration ${slot}`}
      className={
        className ??
        "border-terracotta/30 bg-halo-warm shadow-subtle relative w-full overflow-hidden rounded-2xl border-2 border-dashed"
      }
    >
      {/* Hauteur réservée par aspect ratio — évite layout shift quand
          l'image réelle remplacera le placeholder. */}
      <div style={{ paddingTop: ratioToPaddingTop[aspectRatio] }} />

      {/* Décor — grille subtile + halo terracotta, palette brand */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--color-border-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border-strong) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse at center, white 20%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, white 20%, transparent 70%)",
          opacity: 0.18,
        }}
      />

      {/* Contenu central — slot ID + caption + filename cible */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center sm:gap-3 sm:p-6">
        <span className="bg-terracotta-soft text-terracotta-deep flex h-11 w-11 items-center justify-center rounded-xl sm:h-12 sm:w-12">
          <ImageIcon aria-hidden="true" className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.25} />
        </span>
        <p
          className="text-terracotta-deep text-[11px] font-semibold tracking-[0.18em] uppercase sm:text-[12px]"
          style={{ fontFamily: "var(--font-manrope), system-ui, sans-serif" }}
        >
          {slot}
        </p>
        <p
          className="text-fg max-w-md text-[14px] leading-snug font-medium tracking-tight italic sm:text-[15px]"
          style={{ fontFamily: "var(--font-serif), serif" }}
        >
          {caption}
        </p>
        <p className="text-fg-muted/80 max-w-md font-mono text-[10px] leading-snug break-all sm:text-[11px]">
          {filenameTarget}
        </p>
        <p className="text-fg-muted/70 mt-1 text-[9.5px] tracking-[0.16em] uppercase sm:text-[10px]">
          {aspectRatio} · placeholder
        </p>
      </div>

      {/* Coin terracotta signature */}
      <span
        aria-hidden="true"
        className="bg-terracotta absolute top-3 right-3 inline-block h-1.5 w-1.5 rounded-full sm:top-4 sm:right-4"
      />
    </figure>
  );
}
