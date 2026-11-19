"use client";
// use-client: bouton de divulgation (état ouvert/fermé, Échap, clic extérieur, intention de survol) ; le panneau est rendu côté serveur et passé en `children`.
/**
 * Méga-menu « Nos prestations » — refonte en-tête/pied du 2026-11-11.
 *
 * Modèle « disclosure » (WAI-ARIA APG) et NON `role="menu"` : un `<button>` qui
 * porte `aria-expanded` + `aria-controls`, et un panneau de liens ordinaires.
 * L'ordre de tabulation reste celui du document : bouton → liens du panneau →
 * onglet suivant.
 *
 * Comportement (C3 § 1.5) :
 *   - ouverture au clic (et au clavier, c'est un bouton) ; au survol de la souris
 *     avec 150 ms d'intention, pour ne pas ouvrir au simple passage du curseur ;
 *   - fermeture par Échap (le focus revient sur le bouton), par clic extérieur, à la
 *     sortie du focus, et au clic sur un lien du panneau ;
 *   - panneau fermé = attribut `hidden` : hors de l'ordre de tabulation, et il ne
 *     compte pas dans la largeur du document (le panneau `absolute` toujours monté
 *     de l'ancien méga-menu avait déjà fait déborder le site, audit 2026-07-26).
 *
 * Le contenu (liens, descriptions, prix de la Journée IA lu dans `pricing.ts`) est
 * rendu par le composant serveur `Header` : rien de tout cela n'entre dans le
 * bundle client.
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const INTENTION_SURVOL_MS = 150;
// Fermeture plus lente que l'ouverture : laisse le temps de traverser le vide
// entre le bouton et le panneau (doublé d'un pont invisible, `before:` du panneau).
const DELAI_FERMETURE_MS = 350;

interface HeaderPrestationsMenuProps {
  label: string;
  panelLabel: string;
  children: ReactNode;
}

export function HeaderPrestationsMenu({ label, panelLabel, children }: HeaderPrestationsMenuProps) {
  const [open, setOpen] = useState(false);
  const panneauId = useId();
  const zone = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const panneau = useRef<HTMLDivElement>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Ouvert par le survol ? Alors le clic qui suit (souris déjà sur le bouton) le
  // GARDE ouvert au lieu de le refermer — sans quoi survoler puis cliquer fermerait
  // le menu que l'on vient de voir s'ouvrir.
  const ouvertParSurvol = useRef(false);

  // Stables (refs et `setOpen` seulement) : utilisables dans les effets.
  const annuler = useCallback(() => {
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = undefined;
  }, []);
  const planifier = useCallback(
    (ouvrir: boolean) => {
      annuler();
      minuteur.current = setTimeout(
        () => {
          ouvertParSurvol.current = ouvrir;
          setOpen(ouvrir);
        },
        ouvrir ? INTENTION_SURVOL_MS : DELAI_FERMETURE_MS,
      );
    },
    [annuler],
  );

  useEffect(() => {
    if (!open) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      bouton.current?.focus();
    };
    const surClicExterieur = (e: PointerEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) setOpen(false);
    };
    // Délégation : les liens sont rendus côté serveur, on ne peut pas leur brancher
    // un `onClick` un par un.
    const surClicLien = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a")) setOpen(false);
    };
    const p = panneau.current;
    document.addEventListener("keydown", surTouche);
    document.addEventListener("pointerdown", surClicExterieur);
    p?.addEventListener("click", surClicLien);
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.removeEventListener("pointerdown", surClicExterieur);
      p?.removeEventListener("click", surClicLien);
    };
  }, [open]);

  // Survol (souris seulement, avec intention) et sortie du focus, branchés sur la
  // zone par `addEventListener` : la zone n'est pas un élément interactif, ce sont
  // le bouton et les liens qui le sont.
  useEffect(() => {
    const z = zone.current;
    if (!z) return;
    const surEntree = (e: PointerEvent) => {
      if (e.pointerType === "mouse") planifier(true);
    };
    const surSortie = (e: PointerEvent) => {
      if (e.pointerType === "mouse") planifier(false);
    };
    const surPerteFocus = (e: FocusEvent) => {
      if (!z.contains(e.relatedTarget as Node | null)) {
        annuler();
        setOpen(false);
      }
    };
    z.addEventListener("pointerenter", surEntree);
    z.addEventListener("pointerleave", surSortie);
    z.addEventListener("focusout", surPerteFocus);
    return () => {
      z.removeEventListener("pointerenter", surEntree);
      z.removeEventListener("pointerleave", surSortie);
      z.removeEventListener("focusout", surPerteFocus);
      annuler();
    };
  }, [annuler, planifier]);

  return (
    <div ref={zone}>
      <button
        ref={bouton}
        type="button"
        aria-expanded={open}
        aria-controls={panneauId}
        onClick={() => {
          annuler();
          if (open && ouvertParSurvol.current) {
            ouvertParSurvol.current = false;
            return;
          }
          ouvertParSurvol.current = false;
          setOpen(!open);
        }}
        className={cn(
          "text-mocha-fg focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta relative inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-base font-semibold tracking-tight whitespace-nowrap focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          "after:bg-mocha-fg after:absolute after:inset-x-3 after:bottom-1.5 after:h-0.5 after:origin-left after:transition-transform motion-reduce:after:transition-none",
          open ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100",
        )}
      >
        {label}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "h-4 w-4 transition-transform motion-reduce:transition-none",
            open && "rotate-180",
          )}
        />
      </button>
      {/* Le BOUTON est sur la barre terracotta (texte `mocha-fg`) ; le PANNEAU reste
          sur fond clair (`paper`, textes sombres), comme l'ancien méga-menu.
          Positionné par rapport à la RANGÉE du header (le conteneur `relative` le
          plus proche) : centré sous la barre, comme dans la maquette. */}
      <div
        ref={panneau}
        id={panneauId}
        role="region"
        aria-label={panelLabel}
        hidden={!open}
        className="bg-paper border-border shadow-card absolute top-full left-1/2 z-50 w-[min(40rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border text-left before:absolute before:inset-x-0 before:-top-5 before:h-5"
      >
        <div className="overflow-hidden rounded-[inherit]">{children}</div>
      </div>
    </div>
  );
}
