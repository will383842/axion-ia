/**
 * Les emplacements de la fiche client, tous vides (lot 0). Les tests de la page simulent
 * `fiche/emplacements` avec cet objet : les fonctions async rendent `null`, les composants
 * déplacés (`ActionsDeLaPersonne`, `OngletDevisFactures`, `RelanceDevis`) sont les vrais.
 * Seul le lot 0 modifie ce fichier.
 */

import { ActionsDeLaPersonne } from "@/components/admin/dossier-client/fiche/ActionsDeLaPersonne";
import { OngletDevisFactures } from "@/components/admin/dossier-client/fiche/OngletDevisFactures";
import { RelanceDevis } from "@/components/admin/dossier-client/fiche/RelanceDevis";

export const emplacementsVides = {
  enTeteFiche: async () => null,
  EN_TETE_REMPLACE_LE_BANDEAU: false,
  compteursOnglets: async () => ({}),
  ongletActivite: async () => null,
  ONGLET_ACTIVITE_PRET: false,
  resumeTaches: async () => null,
  resumeNotes: async () => null,
  resumePrestations: async () => null,
  personnesDecision: async () => null,
  questionnaireEnBref: async () => null,
  archivageFiche: async () => null,
  ActionsDeLaPersonne,
  OngletDevisFactures,
  RelanceDevis,
};
