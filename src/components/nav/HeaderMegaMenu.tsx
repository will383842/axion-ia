"use client";
// use-client: shell générique mega-menu (hover-intent timers, focus trap, listeners click/Esc) — incompatible RSC.
// Shell générique pour les mega-menus du header (Interventions, Implantations,
// + futurs). Mutualise : hover-intent (100/200 ms), fermeture Esc + clic
// extérieur, gestion focus (Tab in/out), styling trigger + panel cohérent
// avec NavLink (text-[17px] font-semibold tracking-tight), ARIA correct
// (aria-haspopup, aria-expanded, role=region).
//
// Le contenu du panel est libre : passé via render-prop `children({ close })`.
// Chaque consommateur appelle `close()` sur ses items pour fermer le panel
// au clic. Cela évite un Context React (overkill pour ce cas) et garde le
// flow data → contenu explicite.
//
// Doctrine garde-fous : WCAG 2.2 AA, hover-intent 150-250 ms, fermeture
// sur Esc, Tab navigable, fermeture en cliquant ailleurs (ADR 0005).

import * as React from "react";
import { Link } from "@/i18n/navigation";

const HOVER_OPEN_DELAY_MS = 100;
const HOVER_CLOSE_DELAY_MS = 200;

export interface HeaderMegaMenuProps {
  /** Texte du déclencheur (ex « Interventions », « Implantations »). */
  triggerLabel: string;
  /** URL de la page hub liée — le déclencheur reste un Link cliquable
   *  (pas juste un button) pour SEO + a11y. */
  triggerHref: string;
  /** Identifiant analytics du déclencheur (ex `header_megamenu_trigger`). */
  triggerTrackingId: string;
  /** aria-label du panel — typiquement la même valeur que triggerLabel. */
  panelLabel: string;
  /** Largeur du panel. Défaut `w-[min(720px,90vw)]` (3 colonnes confortables). */
  panelWidth?: string;
  /** Sens d'ouverture. `right` = ancré à droite du trigger (s'ouvre à gauche),
   *  `left` = ancré à gauche du trigger (s'ouvre à droite). Choisir selon
   *  la position du trigger dans la nav (gauche du CTA central → `left`,
   *  droite du CTA central → `right`). */
  panelAlign?: "left" | "right";
  /** Contenu du panel — render-prop. `close()` permet aux items de fermer
   *  le menu au clic. */
  children: (ctx: { close: () => void }) => React.ReactNode;
}

export function HeaderMegaMenu({
  triggerLabel,
  triggerHref,
  triggerTrackingId,
  panelLabel,
  panelWidth = "w-[min(720px,90vw)]",
  panelAlign = "right",
  children,
}: HeaderMegaMenuProps): React.ReactNode {
  const [open, setOpen] = React.useState(false);
  const openTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const cancelTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = undefined;
    closeTimer.current = undefined;
  };

  const handleEnter = () => {
    cancelTimers();
    openTimer.current = setTimeout(() => setOpen(true), HOVER_OPEN_DELAY_MS);
  };

  const handleLeave = () => {
    cancelTimers();
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY_MS);
  };

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  React.useEffect(() => () => cancelTimers(), []);

  const close = React.useCallback(() => setOpen(false), []);
  const alignClass = panelAlign === "right" ? "right-0 origin-top-right" : "left-0 origin-top-left";

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      ref={wrapperRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={() => {
        cancelTimers();
        setOpen(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          cancelTimers();
          setOpen(false);
        }
      }}
      className="relative"
    >
      {/* `hover:text-mocha` retiré (2026-07-31) : le mocha sombre sur l'en-tête
          terracotta ne donne que 2,84:1, contre 4,5 exigés en AA. Même
          correction que dans `NavLink`, pour que tous les items du header se
          comportent pareil au survol. Le retour visuel reste assuré par
          l'ouverture du panneau et l'anneau de focus. */}
      <Link
        href={triggerHref as never}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="text-mocha-fg focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta inline-flex items-center gap-1.5 rounded-sm px-1 text-[17px] font-semibold tracking-tight transition focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        data-cta-tracking={triggerTrackingId}
      >
        {triggerLabel}
        <span
          aria-hidden="true"
          className={`text-mocha-fg/70 inline-block text-[10px] transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </Link>

      {/* 🔴 Audit a11y/UX 2026-07-26 : ce panneau reste DANS LE DOM quand il est
          ferme (opacity-0 + pointer-events-none, pas `hidden`, pour conserver la
          transition). Un element `absolute` compte dans le scrollWidth du document :
          ancre a gauche d'un declencheur situe dans la moitie droite du header, ses
          720 px depassaient de 223 px a 1440 — soit une barre de defilement
          horizontale sur TOUT le site, menu ouvert ou non. `max-w` borne le panneau
          a la fenetre ; l'alignement a droite (cf. HeaderResourcesMenu) evite le
          debordement a la source. */}
      <div
        role="region"
        aria-label={panelLabel}
        className={`bg-paper text-fg shadow-card border-border-strong/40 absolute top-full ${alignClass} z-50 mt-3 ${panelWidth} max-w-[calc(100vw-2rem)] rounded-2xl border transition duration-150 ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        }`}
      >
        {children({ close })}
      </div>
    </div>
  );
}
