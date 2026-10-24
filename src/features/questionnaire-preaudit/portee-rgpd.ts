/**
 * Qui est retrouvé par l'export (art. 15) et l'effacement (art. 17) — module PUR (2026-10-24).
 *
 * Un prospect est retrouvé par la réservation Calendly dont il est le titulaire OU par l'adresse
 * à laquelle Will a envoyé le lien (empreinte, utile sans réservation). Seules les réponses du
 * DIRIGEANT (`mode = "main"`) lui sont rendues ou effacées sur sa demande : celles d'un salarié
 * ou du référent informatique sont les leurs, jamais livrées au dirigeant. Elles s'effacent à la
 * demande de la personne, par le code `membre` que la console affiche à côté de la réponse
 * (`eraseQuestionnairePreauditMembre`).
 */

export function envoisDuDirigeant(email: string, empreinte: string | null) {
  return {
    mode: "main",
    questionnaire: {
      OR: [
        { rencontre: { calendlyEvent: { inviteeEmail: email } } },
        ...(empreinte === null ? [] : [{ destinataireHash: empreinte }]),
      ],
    },
  };
}

export function questionnairesDuDirigeant(email: string, empreinte: string | null) {
  return envoisDuDirigeant(email, empreinte).questionnaire;
}
