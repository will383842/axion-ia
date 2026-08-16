import * as React from "react";
import { ArrowUpRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  SERVICES,
  SERVICE_BY_ID,
  serviceOfficial,
  serviceNavShort,
  type ServiceDef,
  type ServiceId,
} from "@/content/services";
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

/**
 * Item de grille. Par défaut la grille rend les 5 `SERVICES` dans l'ordre SSOT.
 * Une page peut fournir ses propres items (ex. pages VILLE : ordre différent,
 * href propre `/interventions`, titre ville-spécifique, tracking analytics) tout
 * en conservant le VISUEL partagé (icône + couleur) résolu par `serviceId`.
 */
export interface ServiceGridItem {
  /** Clé de visuel (icône + accent) ET de nom par défaut. */
  serviceId: ServiceId;
  /** Cible du lien — défaut : href SSOT du service. */
  href?: string;
  /** Titre affiché — défaut : navShort (showcase) / nom officiel (autres). */
  title?: React.ReactNode;
  /** Attributs `data-*` posés sur le lien (tracking, ex. data-source-ville). */
  data?: Record<`data-${string}`, string | undefined>;
  /** Clé React — défaut : serviceId. */
  key?: string;
}

export interface ServiceCardContext {
  service: ServiceDef;
  visual: ServiceVisual;
  accent: AccentClasses;
  index: number;
  isFr: boolean;
  /** Item résolu de la carte (utile pour un renderBody piloté par les données). */
  item: ServiceGridItem;
}

interface ServicesGridProps {
  variant: ServicesGridVariant;
  isFr: boolean;
  /**
   * Items custom (ordre / href / titre / tracking). Défaut : les 5 `SERVICES`
   * dans l'ordre SSOT. Le visuel reste toujours résolu depuis `services-visual.ts`.
   */
  items?: ReadonlyArray<ServiceGridItem>;
  /** Contenu injecté sous le titre de chaque carte (texte propre à la page). */
  renderBody?: (ctx: ServiceCardContext) => React.ReactNode;
  /** Libellé accessible du lien (défaut : titre / nom officiel du service). */
  cardAriaLabel?: (ctx: ServiceCardContext) => string;
  className?: string;
}

/** Items par défaut = les 5 services SSOT dans l'ordre canonique. */
const DEFAULT_ITEMS: ReadonlyArray<ServiceGridItem> = SERVICES.map((s) => ({ serviceId: s.id }));

/** Colonnes responsive par variante — LARGEUR centralisée ici, plus dans les pages. */
const GRID_CLASS: Record<ServicesGridVariant, string> = {
  // 5 activités : 1 col mobile → 2 (md=768) → 3 (lg=992), layout 3+2. Fond teinté.
  // ⚠️ NE PAS remettre `sm:` ici : dans ce projet le breakpoint `sm` est mal
  // ordonné dans la cascade et ÉCRASE md/lg (vérifié en live 2026-07-07 : avec
  // `sm:grid-cols-2` la grille restait bloquée à 2 colonnes même à 2133px de large).
  // Utiliser uniquement md/lg/xl (breakpoints sûrs). Cf. mémoire tailwind-sm-breakpoint.
  showcase: "grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3",
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
      // Fond TEINTÉ par service (« fond de couleur » vs blanc) → contraste fort
      // entre les 5 blocs. Définition par ombre + liseré d'accent (pas de bordure
      // sable qui salirait la teinte). Le liseré supérieur reste rendu en JSX.
      return cn(
        base,
        "shadow-subtle hover:shadow-elevated p-7 duration-300 hover:-translate-y-1 md:p-8",
        accent.surface,
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
  // Showcase : puce PLEINE (fond accent, icône ivoire) — ressort sur la carte
  // teintée. Autres variantes : puce douce qui se remplit au survol.
  const chipColor = variant === "showcase" ? accent.chipSolid : cn(accent.chip, accent.chipHover);
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center transition-colors duration-300",
        shape,
        chipColor,
      )}
    >
      <Icon className={iconSize} aria-hidden="true" />
    </span>
  );
}

export function ServicesGrid({
  variant,
  isFr,
  items,
  renderBody,
  cardAriaLabel,
  className,
}: ServicesGridProps) {
  const resolved = items ?? DEFAULT_ITEMS;
  // Showcase 5 services : rangée 3 (haut) + 2 (bas) qui remplissent toute la
  // largeur. Grille 6 colonnes au lg → les 3 premières cartes prennent 2 colonnes,
  // les 2 dernières 3 colonnes (pas de "trou" à droite sur la 2e ligne ; cartes du
  // bas plus larges / rectangulaires). md reste 2 colonnes (tablette).
  const isShowcase5 = variant === "showcase" && resolved.length === 5;
  const ulClass = isShowcase5
    ? "grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-6"
    : GRID_CLASS[variant];
  return (
    <ul role="list" className={cn(ulClass, className)}>
      {resolved.map((item, index) => {
        const service = SERVICE_BY_ID[item.serviceId];
        const visual = SERVICE_VISUAL[item.serviceId];
        const accent = ACCENT_CLASSES[visual.accent];
        const official = serviceOfficial(service, isFr);
        // Nom affiché : override d'item, sinon navShort (showcase) / officiel.
        const displayName =
          item.title ?? (variant === "showcase" ? serviceNavShort(service, isFr) : official);
        const href = item.href ?? service.href;
        const ctx: ServiceCardContext = { service, visual, accent, index, isFr, item };
        const body = renderBody?.(ctx);
        // GEO-122 (audit GEO/AEO 2026-08-14) — WCAG 2.5.3 « Label in Name ».
        // La carte portait un `aria-label` reduit au seul nom du service, plus
        // COURT que son texte visible : un utilisateur qui dicte « ouvre <titre
        // visible> » ne matchait pas le nom accessible. On pointe desormais le
        // titre VISIBLE via `aria-labelledby` — le nom accessible devient, par
        // construction, exactement le libelle affiche.
        //
        // `cardAriaLabel` reste prioritaire : c'est un libelle choisi
        // explicitement par l'appelant, pas une troncature accidentelle.
        const titleId = `svc-${variant}-${item.serviceId}-${index}`;
        const nameProps = cardAriaLabel
          ? { "aria-label": cardAriaLabel(ctx) }
          : { "aria-labelledby": titleId };

        const card = (
          <Link
            href={href as HrefProp}
            {...nameProps}
            className={cardShellClass(variant, accent)}
            {...item.data}
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
                <span
                  id={titleId}
                  className="text-fg flex items-start justify-between gap-2 text-base leading-tight font-semibold"
                >
                  {displayName}
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
                  id={titleId}
                  className="text-fg text-[clamp(1.75rem,2.5vw,2.5rem)] leading-[1.02] font-semibold tracking-tight"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  {displayName}
                </h3>
                {body}
              </>
            ) : (
              <>
                <ChipIcon variant={variant} visual={visual} accent={accent} />
                <span id={titleId} className="text-fg text-sm font-semibold tracking-tight">
                  {displayName}
                </span>
                {body}
              </>
            )}
          </Link>
        );

        // Showcase : fade-in décalé (parité home). a11y : <li> parent direct de <ul>.
        // Span asymétrique showcase-5 : 3 cartes span 2 puis 2 cartes span 3 (lg).
        const showcaseSpan = isShowcase5
          ? index < 3
            ? "lg:col-span-2"
            : "lg:col-span-3"
          : undefined;
        return (
          <li
            key={item.key ?? item.serviceId}
            className={cn(variant === "compact" ? undefined : "h-full", showcaseSpan)}
          >
            {variant === "showcase" ? <FadeInOnView delay={index * 80}>{card}</FadeInOnView> : card}
          </li>
        );
      })}
    </ul>
  );
}
