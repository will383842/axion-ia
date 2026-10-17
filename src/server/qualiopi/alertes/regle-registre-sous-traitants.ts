/**
 * Alertes du registre des sous-traitants indépendants — Qualiopi ind. 27 (audit du
 * 16/10 : registre vide, aucune méthode de contrôle).
 *
 *   - `sous_traitant_registre_piece_expiree` (critique) : une pièce EXIGÉE est expirée ;
 *   - `sous_traitant_registre_piece_a_echeance` (important) : une pièce exigée tombe
 *     sous 30 jours ;
 *   - `sous_traitant_registre_controle_en_retard` (important) : un contrôle de la
 *     méthode (`registre-sous-traitants/controles.config.ts`) n'a pas été fait à temps ;
 *   - `sous_traitant_registre_correction_echue` (important) : le plan de correction
 *     d'un écart MINEUR a passé son échéance (J+15 par défaut, réglage) sans être corrigé.
 *
 * Une alerte par code et par formateur, sur les lignes ACTIVES seulement (le plan de
 * correction échu, lui, se suit aussi sous suspension). L'attestation
 * URSSAF garde ses propres alertes (`vigilance_urssaf_*`) : le registre ne les double
 * pas. Toutes se referment seules quand la cause disparaît.
 *
 * 🔴 ÉTEINTE tant que `formateurs.alertes_registre_sous_traitants` est coupé : rien
 * n'est lu au-delà du réglage. Les règles, le calcul et la lecture sont ceux de l'écran
 * et de l'export : une seule vérité.
 */

import { interrupteurAllume } from "@/server/qualiopi/formateurs-independants/interrupteur-allume";
import { lireRegistre } from "@/server/qualiopi/formateurs-independants/registre-sous-traitants/lecture";
import {
  candidatsAlertesRegistre,
  type CandidatAlerteRegistre,
} from "@/server/qualiopi/formateurs-independants/registre-sous-traitants/regles";

import type { AlerteCandidate } from "./evaluateur";

/** Le code d'alerte de chaque sorte — littéral, lu par le verrou du catalogue. */
function enAlerte(c: CandidatAlerteRegistre): AlerteCandidate {
  const { sorte, ...reste } = c;
  switch (sorte) {
    case "piece_expiree":
      return { ...reste, code: "sous_traitant_registre_piece_expiree" };
    case "piece_a_echeance":
      return { ...reste, code: "sous_traitant_registre_piece_a_echeance" };
    case "controle_en_retard":
      return { ...reste, code: "sous_traitant_registre_controle_en_retard" };
    case "correction_echue":
      return { ...reste, code: "sous_traitant_registre_correction_echue" };
  }
}

export async function regleRegistreSousTraitants(now: Date): Promise<AlerteCandidate[]> {
  if (!(await interrupteurAllume("alertes_registre_sous_traitants"))) return [];
  const lignes = await lireRegistre(now);
  return candidatsAlertesRegistre(
    lignes.map((l) => ({
      trainerId: l.trainerId,
      libelle: l.raisonSociale,
      statut: l.statut,
      pieces: l.pieces,
      controles: l.controles,
      correctionsEchues: l.correctionsEchues,
    })),
  ).map(enAlerte);
}
