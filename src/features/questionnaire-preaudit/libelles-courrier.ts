// Mots simples des courriers du questionnaire avant audit (journal du suivi, fil des échanges).
// Extrait de QuestionnairePreaudit.tsx le 25/10/2026 pour que la fiche client les réutilise.

/** Ce que Will lit dans le journal du suivi (nature technique → mots simples). */
export const LIBELLE_NATURE: Readonly<Record<string, string>> = {
  invitation: "Premier e-mail",
  relance_1: "Rappel 1",
  relance_2: "Rappel 2",
  relance_3: "Rappel 3",
  confirmation_dirigeant: "Confirmation au dirigeant",
  confirmation_collaborateur: "Confirmation à un collaborateur",
  telegram_invitation: "Telegram : premier e-mail envoyé",
  telegram_reponse: "Telegram : réponse reçue",
  telegram_relance: "Telegram : rappel envoyé",
  telegram_arret: "Telegram : rappels arrêtés",
  telegram_retenu: "Telegram : e-mail en attente de votre validation",
  essai: "Test",
};
export const LIBELLE_STATUT: Readonly<Record<string, string>> = {
  prevu: "prévu",
  en_cours: "en cours",
  envoye: "envoyé",
  retenu: "en attente de votre validation",
  annule: "annulé",
  echec: "en erreur",
  journal: "enregistré",
};
