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
  /qualiopi|opco|\bcpf\b|\bc\s?p\s?f\b|\bpris(?:e|es|s)?\s+en\s+charge|financement|\bfinance\s+par\b|\bfinancees?\b|\bcertifi(?:e|ee|es|ees|cation|cations|ant|ante|antes|ants)\b/;
// « financé(e)(s) » : testé AVEC l'accent (sans lui, « finances » du directeur financier serait pris).
const FINANCE_ACCENTUE = /\bfinanc\u00e9(?:e|s|es)?(?![\p{L}])/u;

const INVISIBLES = /[\p{Cf}\p{Default_Ignorable_Code_Point}]/gu;

/**
 * Minuscules, sans accents, sans caractère invisible (soft hyphen, espace de largeur nulle…),
 * formes de compatibilité repliées (« ＯＰＣＯ », « ﬁ »), tirets et points lus comme des espaces.
 */
function normaliser(texte: string): string {
  return texte
    .normalize("NFKC")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(INVISIBLES, "")
    .toLowerCase()
    .replace(/[-\u2010\u2011\u2012\u2013\u2014\u2212.]/gu, " ");
}

export function contientMotInterdit(texte: string): boolean {
  const compat = texte.normalize("NFKC").replace(INVISIBLES, "").normalize("NFC").toLowerCase();
  return MOTS_INTERDITS.test(normaliser(texte)) || FINANCE_ACCENTUE.test(compat);
}

/**
 * Validation PURE de l'objet et du message personnel (aucune écriture, aucun accès base) : appelée
 * par l'envoi AVANT toute numérotation, et par `contenuEmailDevis`. `null` = valide.
 */
export function erreurObjetEtMessage(
  sujetBrut: string | undefined,
  messageBrut: string | undefined,
): string | null {
  const sujet = sujetBrut?.trim();
  if (sujet !== undefined && sujet !== "") {
    if (sujet.length > OBJET_MAX) return `L'objet dépasse ${OBJET_MAX} caractères.`;
    if (/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(sujet)) {
      return "L'objet tient sur une seule ligne, sans caractère de contrôle ni de format.";
    }
    if (contientMotInterdit(sujet)) {
      return "L'objet contient un mot qui n'a pas sa place dans un devis.";
    }
  }
  const message = messageBrut?.trim();
  if (message !== undefined && message !== "") {
    if (message.length > MESSAGE_MAX) return `Le message dépasse ${MESSAGE_MAX} caractères.`;
    if (/[\p{Cf}\u2028\u2029]/u.test(message)) {
      return "Le message ne doit pas contenir de caractère de format invisible.";
    }
    if (contientMotInterdit(message)) {
      return "Le message contient un mot qui n'a pas sa place dans un devis.";
    }
  }
  return null;
}

const eurHt = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export function contenuEmailDevis(e: EntreeContenuEmailDevis): ContenuEmailDevis {
  const erreur = erreurObjetEtMessage(e.sujet, e.message);
  if (erreur !== null) return { ok: false, error: erreur };
  const sujet = e.sujet?.trim();
  const message = e.message?.trim();

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
