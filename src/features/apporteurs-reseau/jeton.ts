/**
 * Le LIEN PERSONNEL du dossier d'un apporteur du réseau (démarrage manuel, 2026-10-05).
 *
 *     https://axion-ia.com/apporteur/dossier/<apporteurId>/<jeton>
 *
 * `jeton = base64url(HMAC-SHA256(clé, "apporteur-dossier:v1:" + id + ":" + versionLien))`.
 * Rien n'est stocké (garde `aucun-lien-personnel-n-est-stocke-en-clair`) : le serveur
 * recalcule le jeton et le compare à temps constant. Incrémenter `versionLien`
 * révoque tous les liens déjà envoyés.
 *
 * Signature et vérification déléguées à la fabrique commune `@/lib/security/lien-signe`
 * (FAC-4) : clé dérivée d'`AUTH_SECRET` avec séparation de domaine ; sans secret EN
 * PRODUCTION, aucun lien n'est fabriqué ni valide.
 *
 * Module serveur léger : `node:crypto` (via la fabrique) et `SITE_URL` — ni Prisma, ni
 * `next/headers`.
 */

import { fabriqueLienSigne } from "@/lib/security/lien-signe";
import { SITE_URL } from "@/lib/site-url";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const JETON = /^[A-Za-z0-9_-]{43}$/;

/**
 * Domaine `apporteur-dossier:v1:` et clé `sha256("axion-apporteur-dossier|" + AUTH_SECRET)` :
 * EXACTEMENT ceux d'avant FAC-4. Les changer casse tous les liens déjà envoyés
 * (garde : `le-jeton-apporteur-passe-par-la-fabrique.spec.ts`, 20 jetons figés).
 */
const LIEN = fabriqueLienSigne({
  domaine: "apporteur-dossier",
  version: 1,
  cle: "axion-apporteur-dossier",
});

/** Le jeton d'un dossier à sa version de lien, ou `null`. */
export function jetonDossier(apporteurId: string, versionLien: number): string | null {
  const id = apporteurId.toLowerCase();
  if (!UUID.test(id) || !Number.isInteger(versionLien) || versionLien < 1) return null;
  return LIEN.signer(`${id}:${versionLien}`);
}

/**
 * Le lien est-il BIEN FORMÉ (UUID + jeton de 43 caractères base64url) ? À tester AVANT
 * toute requête : un identifiant tronqué fait lever Prisma sur une colonne `@db.Uuid`.
 */
export function lienDossierBienForme(apporteurId: string, jeton: string): boolean {
  return UUID.test(apporteurId.toLowerCase()) && JETON.test(jeton);
}

/** Le jeton est-il celui de ce dossier, à sa version courante ? Temps constant. */
export function jetonDossierValide(
  apporteurId: string,
  versionLien: number,
  jeton: string,
): boolean {
  const id = apporteurId.toLowerCase();
  if (!UUID.test(id) || !JETON.test(jeton)) return false;
  if (!Number.isInteger(versionLien) || versionLien < 1) return false;
  return LIEN.verifier(`${id}:${versionLien}`, jeton);
}

/** L'URL complète, pour le bouton de l'e-mail. */
export function urlDossier(apporteurId: string, versionLien: number): string | null {
  const jeton = jetonDossier(apporteurId, versionLien);
  if (jeton === null) return null;
  return `${SITE_URL.replace(/\/+$/, "")}/apporteur/dossier/${apporteurId.toLowerCase()}/${jeton}`;
}

/**
 * Lien D'EXEMPLE pour l'aperçu de la console (dossier pas encore ouvert) : même forme que
 * le vrai, mais ni l'identifiant ni le jeton ne sont valides (jamais de jeton fabriqué).
 */
/** L'identifiant du lien d'exemple : la page du dossier le reconnaît et montre un écran d'aperçu. */
export const ID_DOSSIER_EXEMPLE = "00000000-0000-4000-8000-000000000000";

export function urlDossierExemple(): string {
  return `${SITE_URL.replace(/\/+$/, "")}/apporteur/dossier/${ID_DOSSIER_EXEMPLE}/${"x".repeat(43)}`;
}
