/**
 * Relance d'un devis envoyé (lot B9) : le sujet et le corps du BROUILLON, rien d'autre.
 *
 * Module pur (aucune base, aucun envoi). Le brouillon est garé « à valider » par l'action
 * (`actions-relance-devis.ts`) ; il ne part qu'après relecture de Will.
 * Le nom du gabarit vit ici : `enqueueEmail` n'est JAMAIS appelé par ce lot — seul le garage
 * « à valider » l'est ; l'envoi suit la validation de Will, dans la boîte existante.
 * Aucun montant : le devis a déjà été envoyé avec son prix, la relance n'en reparle pas.
 */

import { salutationPourPayload, type SalutationPayload } from "@/lib/email/salutation";

/** Nom du gabarit d'e-mail (registre des gabarits d'outbox). */
export const TEMPLATE_RELANCE_DEVIS = "relance-devis-client";

/** Type de l'entité visée dans l'outbox (même valeur que l'envoi du devis, `facturation-emails.ts`). */
export const ENTITE_DEVIS = "Devis";

/** Messages scellés de retour (module pur : un fichier « use server » ne peut pas les exporter). */
export const MESSAGE_RELANCE_PRETE =
  "Une relance est déjà prête pour ce devis : relisez-la dans les e-mails à valider.";
export const MESSAGE_RELANCE_GAREE =
  "Relance préparée : elle attend votre relecture dans les e-mails à valider. Rien n'est envoyé.";
export const ERREUR_GARAGE = "La relance n'a pas pu être préparée. Rien n'a été envoyé. Réessayez.";
export const ERREUR_DEVIS_INTROUVABLE = "Ce devis n'est pas un devis envoyé de ce client.";
export const ERREUR_DEVIS_PERIME =
  "La date de validité de ce devis est dépassée : relancer un devis périmé n'a pas de sens.";
export const ERREUR_DEVIS_REMIS_MAIN_PROPRE =
  "Ce devis a été remis en main propre : aucun e-mail n'est parti, une relance par e-mail serait trompeuse. Contactez le client directement.";

/** Clé d'idempotence du brouillon : un seul par devis. */
export const jobIdRelanceDevis = (devisId: string): string => `relance-devis:${devisId}`;

export const ERREUR_PDF_ABSENT = "Le PDF du devis est absent : renvoyez le devis depuis sa fiche.";
export const ERREUR_FORMULES_SANS_PIECE =
  "Ce devis à formules n'a pas de pièce signable : renvoyez le devis depuis sa fiche.";
export const ERREUR_EMAIL_DEVIS_EN_ATTENTE =
  "Un e-mail de ce devis attend déjà dans les e-mails à valider.";
export const MESSAGE_RELANCE_GAREE_SANS_LIEN =
  "Relance préparée sans bouton de signature (devis sans pièce signable) : le PDF sera joint. Elle attend votre relecture dans les e-mails à valider. Rien n'est envoyé.";

/**
 * Clé du marqueur « le lien naît à l'envoi » (copie de `CLE_MARQUEUR` de `lien-a-l-envoi.ts`, qui
 * tire prisma : ce module reste pur ; l'égalité est verrouillée par un test).
 */
export const CLE_MARQUEUR_LIEN = "lienSignatureALEnvoi";

export const ERREUR_CONTACT_ABSENT = "Ajoutez l'e-mail du contact dans Modifier la fiche.";

export interface EntreeRelanceDevis {
  readonly numero: string;
  readonly envoyeLe: Date | null;
  readonly raisonSociale: string;
  /** Nom du contact ; à défaut la raison sociale (comme l'envoi du devis). */
  readonly contactNom?: string | null;
  /** `client.contactEmail` : le seul destinataire possible. */
  readonly contactEmail: string | null | undefined;
  /** Identité structurée du contact : « Bonjour Monsieur Dupont, ». */
  readonly contactCivilite?: string | null;
  readonly contactPrenom?: string | null;
  readonly contactNomFamille?: string | null;
  readonly devisId?: string;
  /** Pièce signable du devis (nulle : devis classique). */
  readonly documentGenereId?: string | null;
  /** Clé R2 du PDF du devis. */
  readonly fichierPdfUrl?: string | null;
  /** Devis à formules (`offre` non nulle). */
  readonly aFormules?: boolean;
}

export interface MarqueurRelance {
  readonly v: 1;
  readonly nature: "devis-renvoi";
  readonly documentGenereId: string;
  readonly partie: "client";
  readonly devisId: string;
}

export type SortieRelanceDevis =
  | {
      readonly ok: true;
      readonly destinataire: string;
      readonly sujet: string;
      readonly payload: {
        readonly destinataireNom: string;
        readonly salutation?: SalutationPayload;
        readonly numero: string;
        readonly dateEnvoi: string;
        readonly pieceJointe: true;
        readonly lienSignatureALEnvoi?: MarqueurRelance;
      };
      /** PDF du devis, même pièce jointe que le premier envoi. */
      readonly attachments: ReadonlyArray<{ filename: string; r2Key: string }>;
      /** Vrai : le bouton de signature naîtra à l'approbation. */
      readonly avecLien: boolean;
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
  const pdf = (e.fichierPdfUrl ?? "").trim();
  if (pdf === "") return { ok: false, erreur: ERREUR_PDF_ABSENT };
  const piece = (e.documentGenereId ?? "").trim();
  // Un devis à formules n'est jamais relancé sans bouton.
  if (piece === "" && e.aFormules === true) {
    return { ok: false, erreur: ERREUR_FORMULES_SANS_PIECE };
  }
  const avecLien = piece !== "" && !!e.devisId;
  const salutation = salutationPourPayload({
    clientNom: e.raisonSociale,
    contactCivilite: e.contactCivilite,
    contactPrenom: e.contactPrenom,
    contactNomFamille: e.contactNomFamille,
  });
  return {
    ok: true,
    destinataire,
    sujet: sujetRelanceDevis(e.numero),
    // ⛔ Ni lien, ni jeton dans cette charge : le lien naît à l'approbation (`lien-a-l-envoi.ts`).
    payload: {
      destinataireNom: (e.contactNom ?? "").trim() || e.raisonSociale,
      ...(salutation !== undefined ? { salutation } : {}),
      numero: e.numero,
      dateEnvoi: e.envoyeLe ? dateFr(e.envoyeLe) : "",
      pieceJointe: true,
      ...(avecLien
        ? {
            [CLE_MARQUEUR_LIEN]: {
              v: 1 as const,
              nature: "devis-renvoi" as const,
              documentGenereId: piece,
              partie: "client" as const,
              devisId: e.devisId as string,
            },
          }
        : {}),
    },
    attachments: [{ filename: `${e.numero}.pdf`, r2Key: pdf }],
    avecLien,
  };
}
