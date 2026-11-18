/**
 * Assistant de devis — lignes et catalogue (fiche E05). PUR, client-safe.
 * Port de la logique de `DevisForm` (sélection d'une offre, références, total nul).
 * Les prix du catalogue arrivent en CENTIMES, résolus par la page serveur : aucun import de
 * `pricing.ts`. Aucun taux de TVA n'est transmis avec une ligne.
 */
import { totauxLignes } from "./calculs";
import type { LigneAssistant } from "./types";

export interface OffreCatalogue {
  /** Vrai `tier_id` pricing.ts ; `null` pour les offres du catalogue V2. */
  tierId: string | null;
  code: string;
  titreFr: string;
  /** Centimes HT ; `null` = aucun montant ferme (on ne pré-remplit rien). */
  prixHtCents: number | null;
  noteDevisFr: string;
}

/** 190000 → « 1900 » ; 139050 → « 1390,50 ». Arithmétique entière, pas de flottant. */
function centsEnSaisie(cents: number): string {
  const euros = Math.trunc(cents / 100);
  const reste = cents % 100;
  return reste === 0 ? String(euros) : `${euros},${String(reste).padStart(2, "0")}`;
}

/** Saisie manuelle du libellé : elle prend la main sur l'offre. */
export function saisirLibelle(l: LigneAssistant, valeur: string): LigneAssistant {
  return { ...l, libelle: valeur, designationDepuisOffre: false };
}

/**
 * Choix d'une offre ("" = aucune). Deux gardes à ne pas simplifier :
 *  - jamais de 0 recollé sur un chiffrage existant quand l'offre n'a pas de prix ferme ;
 *  - le libellé n'est remplacé que s'il est vide OU hérité d'une offre.
 */
export function appliquerOffre(
  l: LigneAssistant,
  offres: readonly OffreCatalogue[],
  code: string,
): { ligne: LigneAssistant; sansPrixFerme: boolean } {
  const offre = offres.find((o) => o.code === code);
  const { offreTierId: _ancien, ...sansTier } = l;
  if (offre === undefined) {
    return {
      ligne: { ...sansTier, offreCode: "", designationDepuisOffre: false },
      sansPrixFerme: false,
    };
  }
  const reprendreLeTitre = l.libelle.trim() === "" || l.designationDepuisOffre;
  return {
    ligne: {
      ...sansTier,
      offreCode: offre.code,
      ...(offre.tierId !== null ? { offreTierId: offre.tierId } : {}),
      libelle: reprendreLeTitre ? offre.titreFr : l.libelle,
      designationDepuisOffre: reprendreLeTitre,
      prixEur: offre.prixHtCents !== null ? centsEnSaisie(offre.prixHtCents) : l.prixEur,
    },
    sansPrixFerme: offre.prixHtCents === null,
  };
}

export function noteDeLOffre(offres: readonly OffreCatalogue[], code: string): string | null {
  return offres.find((o) => o.code === code)?.noteDevisFr ?? null;
}

/**
 * Références à joindre à la ligne : `offreCode` identifie TOUTES les offres, `offreTierId`
 * n'existe que pour les offres anciennes qui ont un vrai tier.
 */
export function referencesOffre(
  l: LigneAssistant,
  offres: readonly OffreCatalogue[],
): { offreCode?: string; offreTierId?: string } {
  if (l.offreCode === "") return {};
  const tierId = offres.find((o) => o.code === l.offreCode)?.tierId ?? null;
  return { offreCode: l.offreCode, ...(tierId !== null ? { offreTierId: tierId } : {}) };
}

/** Une ligne offerte à 0 reste légitime ; un devis dont le TOTAL est nul, non. */
export function controlerTotalLignes(lignes: readonly LigneAssistant[]): string | null {
  // Le HT d'une ligne ne dépend pas du taux de TVA : le paramètre n'intervient pas ici.
  const ht = totauxLignes(lignes, 0).htCents;
  return ht > 0
    ? null
    : "Le total du devis est nul : chiffrez au moins une ligne (une offre sans prix ferme ne pré-remplit aucun montant).";
}
