/**
 * Formateurs indépendants — les deux GARANTIES d'un virement de mission (lot D, M6).
 *
 * 🔴 Aucun paiement sans contrat-cadre SIGNÉ (pièce non annulée, signature non
 * révoquée : `lireContratCadreSigne`) ni sans SIREN ACTIF confirmé par le
 * registre (`entrepriseActiveAuPaiement`, même règle qu'à la signature du
 * contrat). Contrôlé côté serveur, au clic « Virement fait » ; une lecture en
 * échec vaut refus. Les relevés MENSUELS ne passent jamais ici.
 */

import {
  entrepriseActiveAuPaiement,
  entrepriseActiveConfirmeeEnBase,
  type ClientEntrepriseActive,
} from "@/server/qualiopi/documents/signature/contrat-cadre-signature";
import {
  lireContratCadreSigne,
  type ClientContratCadre,
} from "@/server/qualiopi/formateurs-independants/contrat-cadre-en-vigueur";

export type MotifGarantiePaiement = "contrat_cadre_absent" | "siren_non_confirme";

export const LIBELLE_GARANTIE_PAIEMENT: Record<MotifGarantiePaiement, string> = {
  contrat_cadre_absent:
    "Aucun contrat-cadre signé pour ce formateur : le virement est refusé tant qu'il n'est pas signé des deux parties.",
  siren_non_confirme:
    "Le registre ne confirme pas un SIREN actif et un établissement ouvert pour ce formateur : virement refusé. Relancez le contrôle depuis sa fiche.",
};

/** `[]` : le virement peut partir. `adminId` : l'auteur de la ligne de contrôle éventuelle. */
export async function garantiesPaiementMission(
  trainerId: string,
  maintenant: Date,
  adminId: string | null,
): Promise<MotifGarantiePaiement[]> {
  const contrat = await lireContratCadreSigne(trainerId).catch(() => null);
  if (contrat === null) return ["contrat_cadre_absent"];
  const actif = await entrepriseActiveAuPaiement(trainerId, maintenant, adminId).catch(() => false);
  return actif ? [] : ["siren_non_confirme"];
}

/**
 * Chantier C4 (défaut 5) — les deux garanties RELUES dans la transaction du
 * virement, sous verrou (comme l'IBAN), sans appel réseau : un contrat-cadre
 * annulé ou un SIREN passé au rouge entre la garde et l'écriture refusent le
 * paiement. Lecture en échec : refus.
 */
export async function garantiesPaiementMissionSousVerrou(
  tx: ClientContratCadre & ClientEntrepriseActive,
  trainerId: string,
  maintenant: Date,
): Promise<MotifGarantiePaiement[]> {
  const contrat = await lireContratCadreSigne(trainerId, tx).catch(() => null);
  if (contrat === null) return ["contrat_cadre_absent"];
  const actif = await entrepriseActiveConfirmeeEnBase(tx, trainerId, maintenant).catch(() => false);
  return actif ? [] : ["siren_non_confirme"];
}
