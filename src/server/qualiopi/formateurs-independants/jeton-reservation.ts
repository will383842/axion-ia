/**
 * Formateurs indépendants — le JETON de la page de réservation de l'échange (lot B, M25).
 *
 *     /fr/appel/formateur-independant?depuis=fa-<candidature>&j=<candidature>.<exp>.<sig>
 *
 * Porté par les liens de F1 (invitation) et de F7 (absent) : il permet de proposer
 * d'office le nom et l'adresse de la candidature dans le formulaire de réservation du
 * site, comme le jeton de la page vidéo des apporteurs. Il ne porte RIEN de personnel :
 * l'identifiant de la candidature, une échéance signée (30 jours), une signature.
 *
 * Instance de la fabrique commune (FAC-4), domaine et clé PROPRES. Rien n'est stocké.
 * Module neutre (ni Prisma, ni Next) : le worker l'importe pour F1.
 */

import { lienDuSite } from "@/lib/calendly/lien-du-site";
import { fabriqueLienSigne } from "@/lib/security/lien-signe";

export const DUREE_JETON_RESERVATION_JOURS = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FORME = /^([0-9a-f-]{36})\.(\d{1,15}\.[A-Za-z0-9_-]{43})$/;

const LIEN = fabriqueLienSigne({
  domaine: "formateur-reservation",
  version: 1,
  cle: "axion-formateur-reservation",
});

/** Le jeton d'une candidature, valable 30 jours, ou `null` (secret absent, id invalide). */
export function jetonReservationFormateur(candidatureId: string, maintenant: Date): string | null {
  const id = candidatureId.toLowerCase();
  if (!UUID.test(id)) return null;
  const expireA =
    Math.floor(maintenant.getTime() / 1000) + DUREE_JETON_RESERVATION_JOURS * 24 * 3600;
  const signe = LIEN.signer(id, { expireA });
  return signe === null ? null : `${id}.${signe}`;
}

/** La candidature désignée par un jeton VALIDE (forme, signature, échéance), ou `null`. */
export function candidatureDuJetonReservation(valeur: unknown, maintenant: Date): string | null {
  if (typeof valeur !== "string" || valeur.length > 200) return null;
  const m = FORME.exec(valeur);
  if (!m) return null;
  const id = m[1]!;
  if (!UUID.test(id)) return null;
  return LIEN.verifier(id, m[2]!, { maintenant: Math.floor(maintenant.getTime() / 1000) })
    ? id
    : null;
}

/**
 * Le lien de F1 / F7 : la page de réservation du site, marquée pour le rattachement
 * (`fa-<id>`) et porteuse du jeton de préremplissage (absent si le secret manque).
 */
export function lienEchangeFormateur(candidatureId: string, maintenant: Date = new Date()): string {
  return lienDuSite("formateur", {
    depuis: `fa-${candidatureId}`,
    jeton: jetonReservationFormateur(candidatureId, maintenant) ?? undefined,
  });
}
