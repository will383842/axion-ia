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
 * Même doctrine que `server/visio/questionnaire-en-ligne/jeton.ts` : clé dérivée
 * d'`AUTH_SECRET` avec séparation de domaine ; sans secret EN PRODUCTION, aucun lien
 * n'est fabriqué ni valide.
 *
 * Module serveur léger : `node:crypto` et `SITE_URL` — ni Prisma, ni `next/headers`.
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { SITE_URL } from "@/lib/site-url";

const DOMAINE = "apporteur-dossier:v1:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const JETON = /^[A-Za-z0-9_-]{43}$/;

function cle(): Buffer | null {
  const secret = process.env["AUTH_SECRET"];
  if (secret && secret.length > 0) {
    return createHash("sha256").update(`axion-apporteur-dossier|${secret}`).digest();
  }
  if (process.env.NODE_ENV === "production") return null;
  return createHash("sha256").update("axion-apporteur-dossier|dev").digest();
}

function signer(k: Buffer, id: string, version: number): string {
  return createHmac("sha256", k).update(`${DOMAINE}${id}:${version}`).digest("base64url");
}

/** Le jeton d'un dossier à sa version de lien, ou `null`. */
export function jetonDossier(apporteurId: string, versionLien: number): string | null {
  const id = apporteurId.toLowerCase();
  if (!UUID.test(id) || !Number.isInteger(versionLien) || versionLien < 1) return null;
  const k = cle();
  return k === null ? null : signer(k, id, versionLien);
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
  const attendu = jetonDossier(id, versionLien);
  if (attendu === null) return false;
  const a = Buffer.from(attendu, "utf8");
  const b = Buffer.from(jeton, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
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
