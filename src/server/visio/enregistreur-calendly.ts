/**
 * La réponse à la question « enregistrement » du formulaire Calendly (PR 5).
 *
 * ## Ce module n'a PAS de liste blanche (anti-doublon D1)
 *
 * Quels rendez-vous sont enregistrables : `estRendezVousDuDossier`
 * (`./liste-blanche-types.ts`, PR 4) — type « Discutons… » ET jamais un
 * rendez-vous lié à une candidature. La garde
 * `__tests__/l-enregistreur-n-a-pas-sa-propre-liste-blanche.spec.ts` rougit si
 * une liste blanche, une création de rencontre ou une liste du jour réapparaît
 * ici ou ailleurs dans l'enregistreur.
 *
 * ## Ce qui est lu, et seulement cela (anti-doublon A1)
 *
 * Les réponses au formulaire sont lues par le lecteur UNIQUE de la console
 * (`reponsesFormulaire`, `features/admin-rendezvous/a-venir.ts`). Aucune lecture
 * du dossier client.
 */

import { reponsesFormulaire } from "@/features/admin-rendezvous/a-venir";
import { normaliserNomDeType } from "./liste-blanche-types";

/** La réponse à la question Calendly sur l'enregistrement, telle quelle, ou `null`. */
export function reponseEnregistrementCalendly(rawPayload: unknown): string | null {
  const r = reponsesFormulaire(rawPayload).find((qa) =>
    normaliserNomDeType(qa.question).includes("enregistr"),
  );
  return r ? r.reponse : null;
}

/** Vrai si la réponse est un refus (« Non », « non merci »…). */
export function estUnNon(reponse: string | null): boolean {
  if (reponse === null) return false;
  return /^non\b/.test(normaliserNomDeType(reponse));
}
