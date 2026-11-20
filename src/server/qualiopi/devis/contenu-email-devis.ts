/**
 * Contenu (payload) de l'e-mail `devis-envoi` — PUR, partagé par l'envoi (`sendDevisAction`) et
 * l'aperçu de l'assistant (`apercuEmailDevisAction`). Une seule source : ce que l'on montre est
 * ce que l'on envoie.
 *
 * Ce qui est modifiable : l'objet et un message personnel. Le corps du gabarit ne l'est pas.
 * ⛔ Rien de ce que voit le client ne contient les mots du financement ni de la certification.
 */
import { salutationPourPayload } from "@/server/qualiopi/crm/salutation-payload";

import {
  nomPourSalutationDevis,
  payloadDevisEnvoi,
  type ClientPourSalutationDevis,
} from "./email-devis-envoi";
import type { VueFormules } from "./vue-formules";

export const OBJET_MAX = 300;
export const MESSAGE_MAX = 4000;

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

const MOTS_INTERDITS = /qualiopi|opco|financ|prise\s+en\s+charge|\bcpf\b/;

/** Minuscules, sans accents ni diacritiques : « FINANCÉ » et « financé » se valent. */
function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function contientMotInterdit(texte: string): boolean {
  return MOTS_INTERDITS.test(normaliser(texte));
}

const eurHt = (cents: number): string =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(cents / 100);

export function contenuEmailDevis(e: EntreeContenuEmailDevis): ContenuEmailDevis {
  const sujet = e.sujet?.trim();
  if (sujet !== undefined && sujet !== "") {
    if (sujet.length > OBJET_MAX)
      return { ok: false, error: `L'objet dépasse ${OBJET_MAX} caractères.` };
    if (/[\r\n]/.test(sujet)) return { ok: false, error: "L'objet tient sur une seule ligne." };
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
