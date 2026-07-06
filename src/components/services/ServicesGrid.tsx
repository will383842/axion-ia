import * as React from "react";
import { ArrowUpRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { SERVICES, serviceOfficial, serviceNavShort, type ServiceDef } from "@/content/services";
import {
  SERVICE_VISUAL,
  ACCENT_CLASSES,
  type ServiceVisual,
  type AccentClasses,
} from "@/content/services-visual";
import { FadeInOnView } from "@/components/motion/FadeInOnView";

// ─────────────────────────────────────────────────────────────────────────────
// Grille UNIQUE des 5 services Axion-IA — LA source du visuel « nos activités ».
//
// Avant ce composant, la grille était réimplémentée à la main sur ≥ 3 pages
// (home, visibilité, presse) avec 3 jeux d'icônes divergents, 2 schémas de
// couleurs et 3 largeurs/hauteurs différentes. Ici : une seule source pour
//   • la LARGEUR (colonnes responsive) — plus décidée page par page ;
//   • la HAUTEUR (cartes égales, `h-full`, padding) ;
//   • l'ICÔNE + la COULEUR d'accent (via `services-visual.ts`) ;
//   • le hover / focus / a11y.
// Le CONTENU (tagline, prix, blurb, CTA) reste injecté par la page via
// `renderBody` : le composant possède le contenant, la page possède le texte.
//
// Server component, zéro JS client (hors `FadeInOnView` opt-in). Budget Web
// Vitals : cartes à hauteur stable → 0 CLS, cibles tactiles ≥ 44 px.
// ─────────────────────────────────────────────────────────────────────────────

export type ServicesGridVariant = "showcase" | "compact" | "strip";

type HrefProp = React.ComponentProps<typeof Link>["href"];

export interface ServiceCardContext {
  service: ServiceDef;
  visual: ServiceVisual;
  accent: AccentClasses;
  index: number;
  isFr: boolean;
}

interface ServicesGridProps {
  variant: ServicesGridVariant;
  isFr: boolean;
  /** Contenu injecté sous le titre de chaque carte (texte propre à la page). */
  renderBody?: (ctx: ServiceCardContext) => React.ReactNode;
  /** Libellé accessible du lien (défaut : nom officiel du service). */
  cardAriaLabel?: (ctx: ServiceCardContext) => string;
  className?: string;
}

/** Colonnes responsive par variante — LARGEUR centralisée ici, plus dans les pages. */
const GRID_CLASS: Record<ServicesGridVariant, string> = {
  // 5 activités : 2 col mobile → 3 tablette → 5 desktop (dominance visuelle home).
  showcase: "grid gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4 lg:grid-cols-5",
  // 1 col mobile → 2 → 5 desktop (bandeau « inclus avec tous nos services »).
  compact: "xs:grid-cols-2 grid grid-cols-1 gap-5 lg:grid-cols-5",
  // 5 activités : 2 col mobile → 5 dès md (strip presse compacte).
  strip: "grid grid-cols-2 gap-4 md:grid-cols-5",
};

/** Coquille commune du lien-carte (bordure/hover/focus/accent) par variante. */
function cardShellClass(variant: ServicesGridVariant, accent: AccentClasses): string {
  const base =
    "group relative flex h-full w-full flex-col overflow-hidden rounded-2xl transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none";
  switch (variant) {
    case "showcase":
      return cn(
        base,
        "border-border bg-paper hover:shadow-elevated border-2 p-6 duration-300 hover:-translate-y-1 md:p-7",
        accent.hoverBorder,
        accent.ring,
      );
    case "compact":
      return cn(
        base,
        "bg-bg shadow-subtle hover:shadow-elevated gap-3 p-6 duration-200 hover:-translate-y-1",
        accent.ring,
      );
    case "strip":
      return cn(
        base,
        "border-border bg-paper border p-5 duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)]",
        accent.hoverBorder,
        accent.ring,
      );
  }
}

/** Puce d'icône (taille/forme par variante) — couleur d'accent du service. */
function ChipIcon({
  variant,
  visual,
  accent,
}: {
  variant: ServicesGridVariant;
  visual: ServiceVisual;
  accent: AccentClasses;
}) {
  const Icon = visual.Icon;
  const shape =
    variant === "showcase"
      ? "h-14 w-14 rounded-full group-hover:scale-110"
      : variant === "compact"
        ? "h-12 w-12 rounded-2xl"
        : "h-12 w-12 rounded-xl";
  const iconSize = variant === "showcase" ? "h-7 w-7" : "h-6 w-6";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center transition-colors duration-300",
        shape,
        accent.chip,
        accent.chipHover,
      )}
    >
      <Icon className={iconSize} aria-hidden="true" />
    </span>
  );
}

export function ServicesGrid({
  variant,
  isFr,
  renderBody,
  cardAriaLabel,
  className,
}: ServicesGridProps) {
  return (
    <ul role="list" className={cn(GRID_CLASS[variant], className)}>
      {SERVICES.map((service, index) => {
        const visual = SERVICE_VISUAL[service.id];
        const accent = ACCENT_CLASSES[visual.accent];
        const official = serviceOfficial(service, isFr);
        const ctx: ServiceCardContext = { service, visual, accent, index, isFr };
        const body = renderBody?.(ctx);

        const card = (
          <Link
            href={service.href as HrefProp}
            aria-label={cardAriaLabel?.(ctx) ?? official}
            className={cardShellClass(variant, accent)}
          >
            {/* Liseré d'accent supérieur (showcase + strip). */}
            {variant !== "compact" ? (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-0 top-0 origin-left",
                  variant === "showcase"
                    ? "h-1.5"
                    : "h-1 scale-x-0 transition-transform duration-200 group-hover:scale-x-100",
                  accent.stripe,
                )}
              />
            ) : null}

            {variant === "strip" ? (
              <>
                {/* Rangée puce + numéro d'ordre. */}
                <span className="mb-4 flex items-center justify-between">
                  <ChipIcon variant={variant} visual={visual} accent={accent} />
                  <span className="text-fg-muted font-serif text-2xl leading-none font-semibold tabular-nums opacity-30 select-none">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </span>
                <span className="text-fg flex items-start justify-between gap-2 text-base leading-tight font-semibold">
                  {official}
                  <ArrowUpRight
                    className={cn(
                      "text-fg-muted mt-0.5 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5",
                      accent.textHover,
                    )}
                    aria-hidden="true"
                  />
                </span>
                {body}
              </>
            ) : variant === "showcase" ? (
              <>
                <span className="mb-6">
                  <ChipIcon variant={variant} visual={visual} accent={accent} />
                </span>
                {/* Titre XL serif = élément le plus visible de la carte. */}
                <h3
                  className="text-fg text-[clamp(1.75rem,2.5vw,2.5rem)] leading-[1.02] font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {serviceNavShort(service, isFr)}
                </h3>
                {body}
              </>
            ) : (
              <>
                <ChipIcon variant={variant} visual={visual} accent={accent} />
                <span className="text-fg text-sm font-semibold tracking-tight">{official}</span>
                {body}
              </>
            )}
          </Link>
        );

        // Showcase : fade-in décalé (parité home). a11y : <li> parent direct de <ul>.
        return (
          <li key={service.id} className={variant === "compact" ? undefined : "h-full"}>
            {variant === "showcase" ? <FadeInOnView delay={index * 80}>{card}</FadeInOnView> : card}
          </li>
        );
      })}
    </ul>
  );
}
