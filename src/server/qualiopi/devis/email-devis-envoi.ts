/**
 * Contenu de l'e-mail `devis-envoi` — PUR, partagé par l'envoi initial et le renvoi.
 *
 * ⛔ Ne déclenche AUCUN envoi : il construit le contenu que l'appelant (un clic admin)
 * confie à `enqueueEmail`, qui reste garé « À valider » (outbox-policy). Le lot 3 n'ajoute
 * aucun point d'envoi.
 */
import { salutation } from "@/lib/email/salutation";

import type { VueFormules } from "./vue-formules";

export interface EntreePayloadDevisEnvoi {
  readonly clientNom: string;
  readonly numero: string;
  readonly montantTotalHtCents: number;
  readonly montantLabel: string;
  readonly dateValiditeLabel: string;
  readonly formules?: VueFormules | undefined;
  /** Devis porteur d'une offre : aucun montant unique annoncé, même si `formules` est illisible. */
  readonly devisAFormules?: boolean | undefined;
  readonly signatureUrl?: string | null | undefined;
  readonly messagePersonnalise?: string | undefined;
}

export function payloadDevisEnvoi(e: EntreePayloadDevisEnvoi): Record<string, unknown> {
  const nb = e.formules?.formules.length ?? 0;
  const deuxFormules = nb >= 2;
  // Devis à formules (une OU plusieurs) : le total du devis ne dit pas ce que le client paiera.
  // À deux formules il vaut 0 ; à UNE formule abonnement il ne couvre que la mise en service et
  // sous-annoncerait le prix. Aucun montant unique n'est donc jamais annoncé dès que `formules`
  // est présent.
  const annonceMontant =
    e.formules === undefined && e.devisAFormules !== true && e.montantTotalHtCents > 0;
  return {
    clientNom: e.clientNom,
    numero: e.numero,
    ...(annonceMontant ? { montantLabel: e.montantLabel } : {}),
    dateValiditeLabel: e.dateValiditeLabel,
    ...(deuxFormules && e.formules
      ? { nbFormules: nb, libellesFormules: e.formules.formules.map((f) => f.titre) }
      : {}),
    ...(e.signatureUrl ? { signatureUrl: e.signatureUrl } : {}),
    ...(e.messagePersonnalise !== undefined ? { messagePersonnalise: e.messagePersonnalise } : {}),
  };
}

/**
 * Les formules telles qu'elles ont été figées dans la pièce envoyée
 * (`DocumentGenere.metadata.renderData.data.formules`). Le renvoi relit la pièce, pas
 * l'offre vivante : l'e-mail décrit exactement le PDF joint.
 */
export function formulesDepuisMetadata(metadata: unknown): VueFormules | undefined {
  if (typeof metadata !== "object" || metadata === null) return undefined;
  const rd = (metadata as Record<string, unknown>)["renderData"];
  if (typeof rd !== "object" || rd === null) return undefined;
  const data = (rd as Record<string, unknown>)["data"];
  if (typeof data !== "object" || data === null) return undefined;
  const f = (data as Record<string, unknown>)["formules"];
  if (typeof f !== "object" || f === null || !Array.isArray((f as VueFormules).formules)) {
    return undefined;
  }
  return f as VueFormules;
}

/** Ce que `nomPourSalutationDevis` sait lire d'un client. Les champs fiables n'existent pas encore. */
export interface ClientPourSalutationDevis {
  readonly raisonSociale?: string | null | undefined;
  /** Nom complet en un seul champ : volontairement IGNORÉ (on ne le découpe jamais). */
  readonly contactNom?: string | null | undefined;
  /** Futurs champs : optionnels, non exigés. */
  readonly contactCivilite?: unknown;
  readonly contactPrenom?: unknown;
  readonly contactNomFamille?: unknown;
}

/**
 * Ce que le gabarit `devis-envoi` écrit après « Bonjour » : « Monsieur Dupont », « Léa » ou "".
 * Le gabarit rend « Bonjour <clientNom>, » si non vide, sinon « Bonjour, ».
 * ⛔ Jamais la raison sociale, jamais le nom complet, jamais `contactNom` découpé, jamais de civilité devinée.
 */
export function nomPourSalutationDevis(client: ClientPourSalutationDevis): string {
  const s = salutation(
    {
      civilite: client.contactCivilite,
      prenom: client.contactPrenom,
      nomFamille: client.contactNomFamille,
    },
    "fr",
  );
  const m = /^Bonjour (.+),$/.exec(s);
  return m?.[1] ?? "";
}
