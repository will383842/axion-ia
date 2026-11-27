/**
 * Les LIENS SIGNÉS du changement d'IBAN (plan `docs/plans/apporteurs-changement-iban-2026-11-25.md`, §2.2 points 3 et 4).
 *
 *     https://axion-ia.com/apporteur/dossier/compte/<idDemande>/<signature>
 *
 * - domaine PROPRE `apporteur-compte` (jamais celui du lien personnel `apporteur-dossier`) ;
 * - charge `<idDemande>:<apporteurId>:<action>`, **sans `versionLien`** : couper le lien personnel
 *   (opposition, validation) ne coupe pas le lien « Bloquer » ;
 * - **ne contient jamais le jeton personnel** de l'espace ;
 * - « confirmer » porte une échéance signée de 24 h (celle de la demande) ; « bloquer » n'en porte
 *   aucune : il reste valable tant que la demande n'est pas décidée (l'état se lit en base).
 *
 * Module serveur léger (`node:crypto` via la fabrique) : ni Prisma, ni `next/headers`.
 */

import { fabriqueLienSigne } from "@/lib/security/lien-signe";
import { SITE_URL } from "@/lib/site-url";

import { echeanceConfirmation } from "./changement-iban-regles";

const LIEN = fabriqueLienSigne({
  domaine: "apporteur-compte",
  version: 1,
  cle: "axion-apporteur-compte",
});

const charge = (demandeId: string, apporteurId: string, action: "confirmer" | "bloquer") =>
  `${demandeId.toLowerCase()}:${apporteurId.toLowerCase()}:${action}`;

function url(demandeId: string, signature: string | null): string | null {
  if (signature === null) return null;
  return `${SITE_URL.replace(/\/+$/, "")}/apporteur/dossier/compte/${demandeId.toLowerCase()}/${signature}`;
}

/** Le lien « Je confirme » (échéance : 24 h après la demande), ou `null` sans secret en production. */
export function lienConfirmerDemande(
  demandeId: string,
  apporteurId: string,
  demandeeAt: Date,
): string | null {
  const expireA = Math.floor(echeanceConfirmation(demandeeAt).getTime() / 1000);
  return url(demandeId, LIEN.signer(charge(demandeId, apporteurId, "confirmer"), { expireA }));
}

/** Le lien « Bloquer cette demande » (sans échéance). */
export function lienBloquerDemande(demandeId: string, apporteurId: string): string | null {
  return url(demandeId, LIEN.signer(charge(demandeId, apporteurId, "bloquer")));
}

/** `maintenantSecondes` : seulement pour les tests (secondes epoch). */
export function signatureConfirmerValide(
  demandeId: string,
  apporteurId: string,
  signature: string,
  maintenantSecondes?: number,
): boolean {
  return LIEN.verifier(charge(demandeId, apporteurId, "confirmer"), signature, {
    ...(maintenantSecondes !== undefined ? { maintenant: maintenantSecondes } : {}),
  });
}

export function signatureBloquerValide(
  demandeId: string,
  apporteurId: string,
  signature: string,
): boolean {
  return LIEN.verifier(charge(demandeId, apporteurId, "bloquer"), signature);
}
