/**
 * La clé `salutation` du payload de l'e-mail de devis — fonction PURE, partagée
 * par l'envoi (`sendDevisAction`) et le renvoi (`envoyerDevisEmailAction`).
 *
 * Règle : civilité ET nom de famille fiables → `{ civilite, nomFamille }` ;
 * sinon prénom → `{ prenom }` ; sinon `{}` (le gabarit rend « Bonjour, »).
 * `undefined` (clé à omettre) seulement si `clientNom` est vide.
 * ⛔ Jamais `contactNom` découpé, jamais de civilité devinée.
 */
import { nettoyerNomPropre, normaliserCivilite } from "@/lib/email/salutation";

export interface EntreeSalutationPayload {
  readonly clientNom: string;
  readonly contactCivilite?: unknown;
  readonly contactPrenom?: unknown;
  readonly contactNomFamille?: unknown;
}

export type SalutationPayload =
  | { readonly civilite: "madame" | "monsieur"; readonly nomFamille: string }
  | { readonly prenom: string }
  | Record<string, never>;

export function salutationPourPayload(e: EntreeSalutationPayload): SalutationPayload | undefined {
  if (e.clientNom.trim() === "") return undefined;
  const civilite = normaliserCivilite(e.contactCivilite);
  const nomFamille = nettoyerNomPropre(e.contactNomFamille, { particules: true });
  if (civilite && nomFamille) return { civilite, nomFamille };
  const prenom = nettoyerNomPropre(e.contactPrenom);
  if (prenom) return { prenom };
  return {};
}
