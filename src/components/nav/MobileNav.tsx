"use client";
// use-client: Sheet (Radix Dialog) needs portals + focus trap + animation
// states. Refactored from a custom div drawer per A11Y-003 / NAV-008
// (focus trap absent + backdrop click no-op).

import { useEffect, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { BRAND } from "@/lib/brand";

interface MobileNavProps {
  children: React.ReactNode;
}

/**
 * Tiroir mobile = Radix Sheet (côté droit). Radix fournit : piège à focus, Échap,
 * fermeture au clic sur le fond, `aria-modal`, retour du focus au bouton ☰ à la
 * fermeture, et `aria-expanded` sur le déclencheur.
 *
 * Refonte en-tête/pied du 2026-11-11 : on y ajoute `inert` sur le FOND (tous les
 * enfants de `<body>` sauf le portail du tiroir). Radix pose déjà `aria-hidden`
 * sur ces nœuds ; `inert` les retire aussi de la recherche dans la page et de toute
 * interaction, y compris pour les technologies d'assistance qui ignorent
 * `aria-hidden`. Il est retiré AVANT que Radix rende le focus au bouton ☰ : un
 * bouton encore `inert` ne pourrait pas le recevoir.
 */
export function MobileNav({ children }: MobileNavProps) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const contenu = useRef<HTMLDivElement>(null);

  // Le portail Radix se monte un rendu APRÈS le passage de `open` à vrai : un
  // `useEffect([open])` ne trouverait pas encore le tiroir (mesuré au navigateur,
  // 2026-11-11 : zéro nœud rendu inerte). On s'accroche donc aux rappels de Radix :
  // `onOpenAutoFocus` (le tiroir est monté) et `onCloseAutoFocus` (appelé AVANT que
  // Radix rende le focus au bouton ☰, qui ne doit plus être inerte à ce moment-là).
  const fondInerte = useRef<HTMLElement[]>([]);
  const libererFond = () => {
    for (const el of fondInerte.current) el.removeAttribute("inert");
    fondInerte.current = [];
  };
  const rendreFondInerte = () => {
    const tiroir = contenu.current;
    if (!tiroir) return;
    libererFond();
    fondInerte.current = Array.from(document.body.children).filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement && !el.contains(tiroir) && !el.hasAttribute("inert"),
    );
    for (const el of fondInerte.current) el.setAttribute("inert", "");
  };
  // Filets : fermeture sans rappel (navigation) et démontage du composant.
  useEffect(() => {
    if (!open) libererFond();
  }, [open]);
  useEffect(() => libererFond, []);

  // Fermeture automatique du drawer dès qu'on sélectionne un lien : les enfants
  // (liens) sont rendus côté serveur → impossible d'y brancher un onClick
  // individuel. On capte le clic par délégation (bubbling) sur le contenu du
  // Sheet : tout clic issu d'un `<a>` (souris ou clavier via Enter) referme le
  // drawer. Corrige « le menu reste ouvert après un clic » (Will 2026-07-10).
  const closeOnLinkClick = (e: React.MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest("a")) setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {/* Aucune classe de visibilité ici : c'est le conteneur `nav:hidden` du
            Header qui décide. Un `xl:hidden` posé sur ce bouton le cachait dès
            1280 px alors que la nav horizontale n'apparaissait qu'à 1440 : entre
            les deux, l'en-tête n'affichait plus que le logo (2026-10-16). */}
        <button
          type="button"
          aria-label={t("openMenu")}
          // Posé sur la barre TERRACOTTA : contour et icône ivoire (`mocha-fg` sur
          // terracotta : 5,24:1) ; le tiroir qu'il ouvre reste clair.
          className="border-mocha-fg text-mocha-fg hover:bg-terracotta-deep focus-visible:ring-mocha-fg focus-visible:ring-offset-terracotta inline-flex h-11 w-11 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent
        ref={contenu}
        side="right"
        onClick={closeOnLinkClick}
        onOpenAutoFocus={rendreFondInerte}
        onCloseAutoFocus={libererFond}
        className="bg-bg flex w-full max-w-sm flex-col gap-0 overflow-hidden border-l-0 p-0 sm:max-w-sm"
      >
        <SheetTitle className="sr-only">Menu</SheetTitle>
        <SheetDescription className="sr-only">{`${BRAND.name} navigation`}</SheetDescription>
        {/* Bandeau de marque — `pr-14` réserve la place du bouton fermeture (X)
            positionné en absolu par SheetContent en haut à droite. */}
        <div className="flex min-h-16 items-center px-4 pr-14">
          <span
            className="text-fg text-xl leading-none font-medium tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Axion
            <span aria-hidden="true" className="text-fg/70 mx-0.5">
              -
            </span>
            <span className="text-terracotta italic" style={{ fontFamily: "var(--font-serif)" }}>
              IA
            </span>
          </span>
        </div>
        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto px-4 pb-8">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
