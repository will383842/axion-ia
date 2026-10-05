// Le filtre et l'étiquette « type de rendez-vous » des écrans console (2026-10-04).
//
// Chantier « Types de rendez-vous », lot L3. Un seul endroit pour :
//   · lire le filtre de l'URL (`?type=`, et l'ancien `?public=` en alias) ;
//   · dire si un rendez-vous passe ce filtre ;
//   · compter les rendez-vous par type (compteurs des onglets) ;
//   · la teinte d'identité de chaque type (pastille, agenda).
// Module PUR : aucun accès base, testable seul.

import {
  LIBELLES_TYPE_RENDEZ_VOUS,
  TYPES_RENDEZ_VOUS,
  estTypeRendezVous,
  type TypeRendezVous,
} from "@/server/calendly/type-rendez-vous";
import type { PublicRdv } from "./types";

/** Les libellés affichés — ceux du module de classement, une seule source. */
export const LIBELLE_TYPE_RDV: Readonly<Record<TypeRendezVous, string>> = LIBELLES_TYPE_RENDEZ_VOUS;

/**
 * Teinte d'identité par type (`--color-admin-id-<teinte>`), `null` = discret.
 *
 * Apporteur reste violet (sa pastille depuis le 19/09). Les autres évitent le
 * teal (visio) et le terracotta (blocages de l'agenda) ; bleu = la couleur des
 * réservations dans l'agenda, prise par l'échange projet, le type historique.
 * « Autre » n'a pas de couleur : il ne doit pas attirer l'œil.
 */
export const TEINTE_TYPE_RDV: Readonly<Record<TypeRendezVous, string | null>> = {
  diagnostic: "or",
  echange_projet: "bleu",
  apporteur: "violet",
  salon: "magenta",
  autre: null,
};

/** Les types proposés en onglet, dans l'ordre d'affichage (« Autre » à part). */
export const TYPES_FILTRABLES: readonly TypeRendezVous[] = [
  "diagnostic",
  "echange_projet",
  "apporteur",
  "salon",
];

/**
 * Le filtre demandé par l'URL. `?type=` d'abord ; à défaut l'ancien `?public=`
 * (`clients`, `apporteurs`), pour que les liens déjà partagés filtrent encore.
 * Toute autre valeur : aucun filtre.
 */
export function lireFiltreType(
  type: string | undefined,
  publicAncien: string | undefined,
): PublicRdv | undefined {
  if (estTypeRendezVous(type)) return type;
  if (publicAncien === "clients" || publicAncien === "apporteurs") return publicAncien;
  return undefined;
}

/** Vrai si un rendez-vous de ce type passe le filtre (pas de filtre = tout passe). */
export function passeLeFiltre(type: TypeRendezVous, filtre: PublicRdv | undefined): boolean {
  if (!filtre) return true;
  if (filtre === "apporteurs") return type === "apporteur";
  if (filtre === "clients")
    return type === "diagnostic" || type === "echange_projet" || type === "autre";
  return type === filtre;
}

/** Le décompte par type, tous types présents (zéro compris). */
export function compterParType(
  rows: ReadonlyArray<{ readonly typeRendezVous: TypeRendezVous }>,
): Record<TypeRendezVous, number> {
  const compte = Object.fromEntries(TYPES_RENDEZ_VOUS.map((t) => [t, 0])) as Record<
    TypeRendezVous,
    number
  >;
  for (const r of rows) compte[r.typeRendezVous] += 1;
  return compte;
}

/**
 * L'onglet « Autre » (lot L5b) : visible dès qu'il existe au moins un
 * rendez-vous de ce type, ou quand il est le filtre actif. Sans lui, un
 * rendez-vous non classé n'aurait aucun onglet pour le montrer.
 */
export function ongletAutreVisible(
  filtre: PublicRdv | undefined,
  typesPresents: Iterable<TypeRendezVous>,
): boolean {
  if (filtre === "autre") return true;
  for (const t of typesPresents) if (t === "autre") return true;
  return false;
}
