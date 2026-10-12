/**
 * Lot E (M14) — version de session de l'espace formateur, séparée de `accesVersion`.
 */

/**
 * Version de SESSION de l'espace formateur (session de l'espace et jeton de mission).
 *
 * 0 tant que la collaboration n'est pas close ; la date de clôture (en secondes)
 * ensuite. La clôture d'une fin la change donc, ce qui fait tomber toute session et
 * tout lien de mission émis avant, et une reconnexion en lecture seule signe la
 * nouvelle.
 *
 * 🔴 Ce n'est PAS `Trainer.accesVersion`. Ce compteur révoque les liens du DOSSIER, et
 * il bouge pendant la collaboration : envoi du dossier (`dossier.ts`), renvoi du lien
 * (`envois-dossier.ts`), mise à niveau (`mise-a-niveau.ts`). Le lire ici déconnectait
 * un formateur ACTIF qui renvoyait son dossier et éteignait ses propositions de
 * mission en cours. Pure, sans migration.
 */
export function versionSessionFormateur(t: {
  readonly finCollaborationAt: Date | null | undefined;
}): number {
  return t.finCollaborationAt == null ? 0 : Math.floor(t.finCollaborationAt.getTime() / 1000);
}
