/**
 * Lot OPCO A8 — jetons des réponses en un clic (« Oui, c'est déposé », etc.).
 *
 * 32 octets aléatoires en base64url (43 caractères) : aucun identifiant
 * devinable dans l'adresse. La base n'en garde que l'EMPREINTE
 * (`hacherToken`, la même que les questionnaires et le portail) ; le clair ne
 * vit que dans l'e-mail.
 */

import { randomBytes } from "node:crypto";
import { hacherToken } from "@/server/qualiopi/tokens/hacher-token";

export const FORME_JETON = /^[A-Za-z0-9_-]{43}$/;

export function nouveauJeton(): { clair: string; hash: string } {
  const clair = randomBytes(32).toString("base64url");
  return { clair, hash: hacherToken(clair) };
}

/** Empreinte d'un jeton reçu, ou `null` s'il n'a pas la forme attendue (aucune requête). */
export function empreinteSiValide(clair: string): string | null {
  return FORME_JETON.test(clair) ? hacherToken(clair) : null;
}
