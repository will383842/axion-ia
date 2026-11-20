/**
 * Contenu (payload) de l'e-mail `devis-envoi` — PUR, partagé par l'envoi (`sendDevisAction`) et
 * l'aperçu de l'assistant (`apercuEmailDevisAction`). Une seule source : ce que l'on montre est
 * ce que l'on envoie.
 *
 * Ce qui est modifiable : l'objet et un message personnel. Le corps du gabarit ne l'est pas.
 * ⛔ Rien de ce que voit le client ne contient les mots du financement ni de la certification.
 */
import { z } from "zod";

import { salutationPourPayload } from "@/server/qualiopi/crm/salutation-payload";

import {
  nomPourSalutationDevis,
  payloadDevisEnvoi,
  type ClientPourSalutationDevis,
} from "./email-devis-envoi";
import type { VueFormules } from "./vue-formules";

export const OBJET_MAX = 300;
export const MESSAGE_MAX = 4000;
/** Entrée brute (action serveur) : jamais d'erreur 500 sur une valeur non textuelle ou trop longue. */
export const objetEntreeSchema = z
  .string({ message: "L'objet doit être un texte." })
  .max(OBJET_MAX, `L'objet dépasse ${OBJET_MAX} caractères.`)
  .optional();
export const messageEntreeSchema = z
  .string({ message: "Le message doit être un texte." })
  .max(MESSAGE_MAX, `Le message dépasse ${MESSAGE_MAX} caractères.`)
  .optional();

/** Clé du payload par laquelle `sendDevisAction` marque l'objet CHOISI par le fondateur. */
export const CLE_SUJET_CHOISI = "sujetChoisi";

export interface EntreeContenuEmailDevis {
  readonly devis: {
    readonly numero: string;
    readonly montantTotalHtCents: number;
    readonly dateValidite: Date;
  };
  readonly client: ClientPourSalutationDevis;
  readonly formules?: VueFormules | undefined;
  /** Absent : l'e-mail est garé (le lien naît à l'envoi) ou montré en aperçu. */
  readonly signatureUrl?: string | undefined;
  readonly sujet?: string | undefined;
  readonly message?: string | undefined;
}

export type ContenuEmailDevis =
  | {
      readonly ok: true;
      readonly payload: Record<string, unknown>;
      /** Objet validé et nettoyé ; absent = l'objet du gabarit. */
      readonly sujet: string | undefined;
    }
  | { readonly ok: false; readonly error: string };

// Mots du financement et de la certification. « financier » (directeur financier…) reste permis.
// « financee(s) » : « financé » écrit sans accent (après normalisation, « finances » reste permis).
// « pris(e)(s) en charge » : toutes les formes de la prise en charge.
const MOTS_INTERDITS =
  /qualiopi|opco|\bcpf\b|\bpris(?:e|es|s)?\s+en\s+charge|financement|\bfinance\s+par\b|\bfinancees?\b/;
// « financé(e)(s) » : testé AVEC l'accent (sans lui, « finances » du directeur financier serait pris).
const FINANCE_ACCENTUE = /\bfinanc\u00e9(?:e|s|es)?(?![\p{L}])/u;

/** Minuscules, sans accents ni diacritiques : « FINANCÉ » et « financé » se valent. */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function contientMotInterdit(texte: string): boolean {
  return (
    MOTS_INTERDITS.test(normaliser(texte)) ||
    FINANCE_ACCENTUE.test(texte.normalize("NFC").toLowerCase())
  );
}

const eurHt = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export function contenuEmailDevis(e: EntreeContenuEmailDevis): ContenuEmailDevis {
  const sujet = e.sujet?.trim();
  if (sujet !== undefined && sujet !== "") {
    if (sujet.length > OBJET_MAX)
      return { ok: false, error: `L'objet dépasse ${OBJET_MAX} caractères.` };
    if (/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(sujet)) {
      return {
        ok: false,
        error: "L'objet tient sur une seule ligne, sans caractère de contrôle ni de format.",
      };
    }
    if (contientMotInterdit(sujet)) {
      return { ok: false, error: "L'objet contient un mot qui n'a pas sa place dans un devis." };
    }
  }
  const message = e.message?.trim();
  if (message !== undefined && message !== "") {
    if (message.length > MESSAGE_MAX) {
      return { ok: false, error: `Le message dépasse ${MESSAGE_MAX} caractères.` };
    }
    if (contientMotInterdit(message)) {
      return { ok: false, error: "Le message contient un mot qui n'a pas sa place dans un devis." };
    }
  }

  const clientNom = nomPourSalutationDevis(e.client);
  const payload = payloadDevisEnvoi({
    clientNom,
    salutation: salutationPourPayload({
      clientNom,
      contactCivilite: e.client.contactCivilite,
      contactPrenom: e.client.contactPrenom,
      contactNomFamille: e.client.contactNomFamille,
    }),
    numero: e.devis.numero,
    montantTotalHtCents: e.devis.montantTotalHtCents,
    montantLabel: `${eurHt(e.devis.montantTotalHtCents)} HT`,
    dateValiditeLabel: e.devis.dateValidite.toLocaleDateString("fr-FR"),
    formules: e.formules,
    ...(e.signatureUrl !== undefined ? { signatureUrl: e.signatureUrl } : {}),
    ...(message !== undefined && message !== "" ? { messagePersonnalise: message } : {}),
  });
  return { ok: true, payload, sujet: sujet === "" ? undefined : sujet };
}
