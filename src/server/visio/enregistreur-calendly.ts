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
 * ⚠️ INTERFACE LOCALE À LA PR 5. La liste blanche de référence est
 * `src/server/visio/liste-blanche-types.ts`, livrée par la PR 4 (pas encore
 * fusionnée quand cette PR a été écrite). Au rebase, `estTypeEnregistrable`
 * devient un appel à ce module ; les tests de cette PR restent valables.
 *
 * ## Ce qui est lu, et seulement cela
 *
 * La personne qui a réservé (nom déclaré), l'entreprise DÉCLARÉE et la réponse
 * à la question sur l'enregistrement. Aucune lecture du dossier client.
 */

import { estAppelApporteur } from "@/server/calendly/appel-apporteur";
import { reponsesDuPayload } from "@/server/calendly/report";

/** Mot du nom du type d'événement qui désigne « Discutons de votre projet IA ». */
export const MOT_CLE_TYPE_ENREGISTRABLE = "discutons";

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/** Vrai si ce type de rendez-vous Calendly est enregistrable. */
export function estTypeEnregistrable(nomTypeEvenement: string | null | undefined): boolean {
  if (!nomTypeEvenement) return false;
  if (estAppelApporteur(nomTypeEvenement)) return false;
  return normaliser(nomTypeEvenement).includes(MOT_CLE_TYPE_ENREGISTRABLE);
}

/** Vrai si le nom du type désigne un entretien de candidat. */
export function estTypeEntretien(nomTypeEvenement: string | null | undefined): boolean {
  if (!nomTypeEvenement) return false;
  const n = normaliser(nomTypeEvenement);
  return n.includes("entretien") || n.includes("candidat");
}

/** La réponse à la question Calendly sur l'enregistrement, telle quelle, ou `null`. */
export function reponseEnregistrementCalendly(rawPayload: unknown): string | null {
  for (const qa of reponsesDuPayload(rawPayload)) {
    if (normaliser(qa.question).includes("enregistr")) return qa.reponse.trim();
  }
  return null;
}

/** Vrai si la réponse est un refus (« Non », « non merci »…). */
export function estUnNon(reponse: string | null): boolean {
  if (reponse === null) return false;
  return /^non\b/.test(normaliser(reponse));
}

/** L'entreprise déclarée dans le formulaire (jamais la « ville de l'entreprise »). */
export function entrepriseDeclaree(rawPayload: unknown): string | null {
  for (const qa of reponsesDuPayload(rawPayload)) {
    const q = normaliser(qa.question);
    if (q.includes("ville")) continue;
    if (q.includes("entreprise") || q.includes("societe") || q.includes("organisation")) {
      return qa.reponse.trim().slice(0, 200);
    }
  }
  return null;
}
