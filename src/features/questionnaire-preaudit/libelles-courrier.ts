// Mots simples des courriers du questionnaire avant audit (journal du suivi, fil des échanges).
// Extrait de QuestionnairePreaudit.tsx le 25/10/2026 pour que la fiche client les réutilise.

/** Ce que Will lit dans le journal du suivi (nature technique → mots simples). */
export const LIBELLE_NATURE: Readonly<Record<string, string>> = {
  invitation: "Invitation",
  relance_1: "Relance 1",
  relance_2: "Relance 2",
  relance_3: "Relance 3",
  confirmation_dirigeant: "Confirmation au dirigeant",
  confirmation_collaborateur: "Confirmation à un collaborateur",
  telegram_invitation: "Telegram : invitation partie",
  telegram_reponse: "Telegram : réponse reçue",
  telegram_relance: "Telegram : relance partie",
  telegram_arret: "Telegram : relances arrêtées",
  telegram_retenu: "Telegram : e-mail retenu",
  essai: "Essai",
};
export const LIBELLE_STATUT: Readonly<Record<string, string>> = {
  prevu: "prévu",
  en_cours: "en cours",
  envoye: "parti",
  retenu: "retenu",
  annule: "annulé",
  echec: "échec",
  journal: "noté",
};
