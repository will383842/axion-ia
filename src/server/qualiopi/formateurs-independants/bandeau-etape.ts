/**
 * Bandeau d'étape de la fiche d'un formateur indépendant (lot F, W-10) : l'étape calculée
 * (`etapeFormateurIndependant`), et, quand la main est à l'équipe, le bouton qui mène à
 * l'écran « Vérifier et contresigner ». Pur.
 */

import type { Etape } from "./etape-parcours-independant";

export interface BandeauEtape {
  readonly libelle: string;
  readonly ton: "ok" | "warn" | "neutral";
  readonly lien: { readonly libelle: string; readonly href: string } | null;
}

/** `urlFiche` = l'adresse de la fiche (`…/qualiopi/formateurs/<id>`). */
export function bandeauEtape(etape: Etape, urlFiche: string): BandeauEtape {
  const aVerifier = etape.onglet === "a_verifier";
  return {
    libelle: etape.libelle,
    ton: aVerifier ? "warn" : etape.onglet === "actifs" ? "ok" : "neutral",
    lien: aVerifier ? { libelle: "Vérifier et contresigner", href: `${urlFiche}/verifier` } : null,
  };
}
