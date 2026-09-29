/**
 * Ce que l'enregistreur lit d'un rendez-vous Calendly (PR 5).
 *
 * ## Liste blanche
 *
 * Seuls les rendez-vous « Discutons de votre projet IA » sont enregistrables
 * (PA-9 : ni les échanges apporteurs, ni les entretiens de candidats, ni les
 * formations). La règle repose sur le NOM du type d'événement, seule clé que
 * porte un `scheduled_event` Calendly (même raison que `appel-apporteur.ts`).
 *
 * ⚠️ INTERFACE LOCALE À LA PR 5 (anti-doublon D1). La liste blanche de
 * référence est `src/server/visio/liste-blanche-types.ts`, livrée par la PR 4
 * (#1225, pas encore fusionnée). La règle ci-dessous est ALIGNÉE mot pour mot
 * sur la sienne (début du nom normalisé « discutons de votre projet », jamais
 * un apporteur) ; au rebase sur une `main` qui la contient, `estTypeEnregistrable`
 * et `estTypeEntretien` disparaissent au profit de `estRendezVousDuDossier`.
 *
 * ## Ce qui est lu, et seulement cela (anti-doublon A1)
 *
 * Les réponses au formulaire sont lues par le lecteur UNIQUE de la console
 * (`reponsesFormulaire` et `entrepriseEtBesoin`, `features/admin-rendezvous/a-venir.ts`) :
 * l'entreprise déclarée est donc celle que la carte « à venir » affiche, par la
 * même règle. Aucune lecture du dossier client.
 */

import { reponsesFormulaire } from "@/features/admin-rendezvous/a-venir";
import { estAppelApporteur } from "@/server/calendly/appel-apporteur";

/** Début du nom (normalisé) de « Discutons de votre projet IA » — même valeur que la PR 4. */
export const DEBUT_TYPE_ENREGISTRABLE = "discutons de votre projet";

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Vrai si ce type de rendez-vous Calendly est enregistrable. */
export function estTypeEnregistrable(nomTypeEvenement: string | null | undefined): boolean {
  if (!nomTypeEvenement || nomTypeEvenement.trim() === "") return false;
  if (estAppelApporteur(nomTypeEvenement)) return false;
  return normaliser(nomTypeEvenement).startsWith(DEBUT_TYPE_ENREGISTRABLE);
}

/** Vrai si le nom du type désigne un entretien de candidat. */
export function estTypeEntretien(nomTypeEvenement: string | null | undefined): boolean {
  if (!nomTypeEvenement) return false;
  const n = normaliser(nomTypeEvenement);
  return n.includes("entretien") || n.includes("candidat");
}

/** La réponse à la question Calendly sur l'enregistrement, telle quelle, ou `null`. */
export function reponseEnregistrementCalendly(rawPayload: unknown): string | null {
  const r = reponsesFormulaire(rawPayload).find((qa) =>
    normaliser(qa.question).includes("enregistr"),
  );
  return r ? r.reponse : null;
}

/** Vrai si la réponse est un refus (« Non », « non merci »…). */
export function estUnNon(reponse: string | null): boolean {
  if (reponse === null) return false;
  return /^non\b/.test(normaliser(reponse));
}
