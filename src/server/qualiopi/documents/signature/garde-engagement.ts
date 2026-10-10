/**
 * Qui peut engager l'organisme par sa signature — la garde UNIQUE (S6a, c).
 *
 * 🔴 Avant ce module, cinq actions recopiaient `role !== "super_admin" &&
 * role !== "admin"`. Les listes coïncidaient avec la matrice, et c'est
 * exactement ainsi qu'une recopie survit jusqu'au jour où la matrice bouge
 * sans elle. La matrice (`HABILITATIONS.contresigner`) est désormais la seule
 * source ; les rôles admis restent les mêmes (verrou : `socle-signature.spec.ts`).
 */

import { peutEngager } from "@/server/auth/habilitations";

export const ACTE_SIGNATURE_ORGANISME = "contresigner" as const;

/** Ce rôle peut-il signer au nom de l'organisme ? Refus par défaut. */
export function peutSignerPourOrganisme(role: string | null | undefined): boolean {
  return peutEngager(role, ACTE_SIGNATURE_ORGANISME);
}
