/**
 * Barre collante du bas d'écran, mobile seulement (lot L1, 2026-09-25).
 *
 * Elle ramène au formulaire du haut (`#recevoir`) une fois qu'on l'a dépassé,
 * et s'efface dès qu'un formulaire du guide est à l'écran : on ne montre
 * jamais deux fois le même appel au même endroit.
 *
 * Contraintes tenues :
 *   · CLS = 0 : `position: fixed`, hors du flux ; elle glisse (transform), elle
 *     ne pousse rien ;
 *   · rendue par le SERVEUR, cachée et `inert` : sans JS elle n'apparaît jamais
 *     et ne capte pas le focus ;
 *   · poids : le seul JS est l'observateur (`ObservateurBarreGuide`), qui
 *     bascule deux attributs — le balisage et ses classes ne partent pas dans
 *     le paquet client (mesuré : la barre entière en client pesait ~0,7 Ko
 *     brotli, dont l'essentiel en chaînes de classes).
 */

import { ObservateurBarreGuide } from "./ObservateurBarreGuide";
import { ID_BARRE_GUIDE } from "./attribut-formulaire";

interface BarreGuideCollanteProps {
  libelle: string;
  cta: string;
  /** Ancre du formulaire visé. */
  cible: string;
}

export function BarreGuideCollante({ libelle, cta, cible }: BarreGuideCollanteProps) {
  return (
    <>
      <div
        id={ID_BARRE_GUIDE}
        data-visible="false"
        inert
        className="border-border bg-paper/95 pointer-events-none fixed inset-x-0 bottom-0 z-30 translate-y-full border-t px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgb(0_0_0/0.06)] backdrop-blur transition-transform duration-200 data-[visible=true]:pointer-events-auto data-[visible=true]:translate-y-0 md:hidden"
      >
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <p className="text-fg min-w-0 flex-1 truncate text-sm font-semibold">{libelle}</p>
          <a
            href={`#${cible}`}
            className="bg-terracotta text-mocha-fg hover:bg-terracotta-deep inline-flex h-11 shrink-0 items-center rounded-full px-5 text-sm font-semibold"
          >
            {cta}
          </a>
        </div>
      </div>
      <ObservateurBarreGuide />
    </>
  );
}
