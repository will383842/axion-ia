/**
 * Lot E (M14) — version de session de l'espace formateur, séparée de `accesVersion`.
 */

import { createHash } from "node:crypto";

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

/**
 * Lot E (M14), relecture — GARDE COMMUNE de toute écriture du formateur, par sa session
 * de l'espace comme par le lien de sa mission : `false` dès que la collaboration est
 * close, ou que la version signée n'est plus celle de la fiche.
 *
 * 🔴 Un jeton SANS version (signé avant ce lot) n'est donc refusé que par la date de
 * fin — c'est elle qui ferme les liens de proposition émis avant le déploiement, encore
 * valables jusqu'à 90 jours. Aucun lien de mission n'est émis après une clôture : ce
 * refus ne coupe aucun usage légitime.
 *
 * Seules la lecture des honoraires et du dossier, et le téléchargement de ses pièces,
 * restent ouverts après la fin, par la session de LECTURE de l'espace : elles n'appellent pas
 * cette garde. Inventaire et preuve : `inventaire-actions-apres-fin.spec.ts`.
 */
export function ecritureFormateurPermise(
  versionSignee: number | undefined,
  t: { readonly finCollaborationAt: Date | null | undefined },
): boolean {
  if (t.finCollaborationAt != null) return false;
  return versionSignee === undefined || versionSignee === versionSessionFormateur(t);
}

/**
 * Lot C4 — EMPREINTE de l'adresse e-mail portée par la session de l'espace : quand la
 * console change l'adresse d'un indépendant, toute session ouverte sous l'ancienne
 * tombe (garde de `server/formateur/guard.ts`). Sans migration : rien n'est stocké.
 *
 * Insensible à la casse (la colonne est `citext`) ; 16 caractères hexadécimaux, qui ne
 * révèlent pas l'adresse à qui lit son propre cookie.
 */
export function empreinteSessionFormateur(email: string): string {
  return createHash("sha256")
    .update(`session-formateur:${email.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 16);
}
