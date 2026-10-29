/**
 * Relance d'un devis envoyé (lot B9) : le sujet et le corps du BROUILLON, rien d'autre.
 *
 * Module pur (aucune base, aucun envoi). Le brouillon est garé « à valider » par l'action
 * (`actions-relance-devis.ts`) ; il ne part qu'après relecture de Will.
 * Le nom du gabarit vit ici : `enqueueEmail` n'est JAMAIS appelé par ce lot — seul le garage
 * « à valider » l'est ; l'envoi suit la validation de Will, dans la boîte existante.
 * Aucun montant : le devis a déjà été envoyé avec son prix, la relance n'en reparle pas.
 */

/** Nom du gabarit d'e-mail (registre des gabarits d'outbox). */
export const TEMPLATE_RELANCE_DEVIS = "relance-devis-client";

/** Type de l'entité visée dans l'outbox (même valeur que l'envoi du devis, `facturation-emails.ts`). */
export const ENTITE_DEVIS = "Devis";

export const ERREUR_CONTACT_ABSENT = "Ajoutez l'e-mail du contact dans Modifier la fiche.";

export interface EntreeRelanceDevis {
  readonly numero: string;
  readonly envoyeLe: Date | null;
  readonly raisonSociale: string;
  /** `client.contactEmail` : le seul destinataire possible. */
  readonly contactEmail: string | null | undefined;
}

export type SortieRelanceDevis =
  | {
      readonly ok: true;
      readonly destinataire: string;
      readonly sujet: string;
      readonly payload: {
        readonly destinataireNom: string;
        readonly numero: string;
        readonly dateEnvoi: string;
      };
    }
  | { readonly ok: false; readonly erreur: string };

function dateFr(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(d);
}

export function sujetRelanceDevis(numero: string): string {
  return `Devis ${numero} : un point ?`;
}

export function construireRelanceDevis(e: EntreeRelanceDevis): SortieRelanceDevis {
  const destinataire = (e.contactEmail ?? "").trim();
  if (destinataire === "" || !destinataire.includes("@")) {
    return { ok: false, erreur: ERREUR_CONTACT_ABSENT };
  }
  return {
    ok: true,
    destinataire,
    sujet: sujetRelanceDevis(e.numero),
    payload: {
      destinataireNom: e.raisonSociale,
      numero: e.numero,
      dateEnvoi: e.envoyeLe ? dateFr(e.envoyeLe) : "",
    },
  };
}
