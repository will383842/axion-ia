/**
 * Le TYPE d'un rendez-vous, en mots, pour la carte de l'onglet Rendez-vous.
 * Une seule table, indexée par l'énumération `RencontreType` : un type ajouté
 * au schéma fait échouer la compilation ici plutôt que s'afficher en blanc.
 */

import type { RencontreType } from "../../../prisma/generated/client";

export const LIBELLE_TYPE_RENDEZ_VOUS = {
  visio: "Visio",
  telephone: "Téléphone",
  presentiel: "Sur place",
  inconnu: "Type non renseigné",
} as const satisfies Record<RencontreType, string>;
