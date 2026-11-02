/**
 * Interrupteur du bouton « Lancer l'analyse complète » : `RAPPORT_AVANT_AUDIT_ENABLED`.
 * ABSENT = ÉTEINT ; seule la valeur exacte "true" l'allume (convention du dépôt).
 *
 * Il ne commande QUE le lancement : les rapports déjà faits restent lisibles et téléchargeables
 * par le super-administrateur, interrupteur éteint.
 *
 * Une seule règle, celle de `config.ts` (lue aussi par l'action de lancement et le worker) :
 * ré-exportée ici, jamais recopiée.
 */

export { rapportAvantAuditActif } from "../config";
