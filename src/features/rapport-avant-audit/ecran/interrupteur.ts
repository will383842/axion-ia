/**
 * Interrupteur du bouton « Lancer l'analyse complète » : `RAPPORT_AVANT_AUDIT_ENABLED`.
 * ABSENT = ÉTEINT ; seule la valeur exacte "true" l'allume (convention du dépôt).
 *
 * Il ne commande QUE le lancement : les rapports déjà faits restent lisibles et téléchargeables
 * par le super-administrateur, interrupteur éteint.
 */

type Env = Readonly<Record<string, string | undefined>>;

export const rapportAvantAuditActif = (env: Env = process.env): boolean =>
  env["RAPPORT_AVANT_AUDIT_ENABLED"] === "true";
