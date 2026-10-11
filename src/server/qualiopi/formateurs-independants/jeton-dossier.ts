/**
 * Formateurs indépendants — le LIEN PERSONNEL du dossier en ligne (lot L5, 05 E7, 08 §4 E1).
 *
 *     https://axion-ia.com/formateur/dossier/<trainerId>/<expireA>.<signature>
 *
 * Instance de la fabrique commune (FAC-4) : domaine et dérivation de clé PROPRES aux
 * formateurs (jamais ceux des apporteurs), échéance de 30 jours SIGNÉE, et la version
 * d'accès de la fiche (`Trainer.accesVersion`) dans la charge : l'incrémenter (envoi du
 * dossier, activation, fin) révoque tous les liens déjà envoyés. Rien n'est stocké.
 *
 * Module serveur léger : ni Prisma, ni `next/headers` (le worker peut l'importer).
 */

import { fabriqueLienSigne } from "@/lib/security/lien-signe";
import { SITE_URL } from "@/lib/site-url";

/** Durée de vie d'un lien du dossier (08c E1). */
export const DUREE_LIEN_DOSSIER_JOURS = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** `<secondes epoch>.<43 caractères base64url>` : la forme à échéance de la fabrique. */
const JETON = /^\d{1,15}\.[A-Za-z0-9_-]{43}$/;

const LIEN = fabriqueLienSigne({
  domaine: "formateur-dossier",
  version: 1,
  cle: "axion-formateur-dossier",
});

function versionValide(v: number): boolean {
  return Number.isInteger(v) && v >= 0;
}

/** Le jeton du dossier à cette version d'accès, valable 30 jours depuis `maintenant`. */
export function jetonDossierFormateur(
  trainerId: string,
  accesVersion: number,
  maintenant: Date,
): string | null {
  const id = trainerId.toLowerCase();
  if (!UUID.test(id) || !versionValide(accesVersion)) return null;
  const expireA = Math.floor(maintenant.getTime() / 1000) + DUREE_LIEN_DOSSIER_JOURS * 24 * 3600;
  return LIEN.signer(`${id}:${accesVersion}`, { expireA });
}

/**
 * Le lien est-il BIEN FORMÉ ? À tester AVANT toute requête : un identifiant tronqué fait
 * lever Prisma sur une colonne `@db.Uuid`.
 */
export function lienDossierFormateurBienForme(trainerId: string, jeton: string): boolean {
  return UUID.test(trainerId.toLowerCase()) && JETON.test(jeton);
}

/** Le jeton est-il celui de ce dossier, à sa version d'accès courante, non échu ? */
export function jetonDossierFormateurValide(
  trainerId: string,
  accesVersion: number,
  jeton: string,
  maintenant: Date,
): boolean {
  const id = trainerId.toLowerCase();
  if (!lienDossierFormateurBienForme(id, jeton) || !versionValide(accesVersion)) return false;
  return LIEN.verifier(`${id}:${accesVersion}`, jeton, {
    maintenant: Math.floor(maintenant.getTime() / 1000),
  });
}

/** L'URL complète, pour le bouton de l'e-mail (F5, F8, F12, F14). */
export function urlDossierFormateur(
  trainerId: string,
  accesVersion: number,
  maintenant: Date,
): string | null {
  const jeton = jetonDossierFormateur(trainerId, accesVersion, maintenant);
  if (jeton === null) return null;
  return `${SITE_URL.replace(/\/+$/, "")}/formateur/dossier/${trainerId.toLowerCase()}/${jeton}`;
}
