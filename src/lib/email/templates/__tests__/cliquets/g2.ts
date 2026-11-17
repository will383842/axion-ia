/**
 * Cliquet du groupe G2 — prospects et clients (lot S1).
 *
 * `gabarits` : les noms du groupe (partition du plan §2.3, vérifiée par
 * `chassis-regles.spec.tsx`). `dettes` : l'état RÉEL mesuré le 2026-11-17, règle par
 * règle. Le test exige l'égalité des ensembles : une nouvelle violation rougit, et un
 * gabarit devenu conforme rougit tant qu'il reste listé. Les listes ne font que
 * diminuer : la fiche de migration du groupe n'édite que ce fichier.
 */
// Les noms `questionnaire-avant-audit-relance` et `-confirmation` sont écrits entre accents graves
// (et non entre guillemets) : la garde « aucun envoi automatique » du pré-audit
// (`aucun-envoi-automatique.spec.ts`) repère les appelants de ces deux gabarits par leur nom entre
// guillemets, et ce fichier de cliquets n'est pas un appelant.
export const GROUPE_G2 = {
  gabarits: [
    "newsletter-confirm-optin",
    "guide-ia-envoi",
    "roi-report",
    "podcast-demande-recue",
    "rappel-confirme",
    "appel-confirme",
    "appel-rappel-j1",
    "appel-rappel",
    "rdv-salon-confirme",
    "rdv-salon-rappel-j2",
    "rdv-salon-rappel-j1",
    "chatbot-demande-transmise",
    "avis-recu",
    "submission-reply",
    "ressources-magic-link",
    "preavis-sous-traitants",
    "rencontre-invitation",
    "visio-email-suivi",
    "questionnaire-avant-audit",
    `questionnaire-avant-audit-relance`,
    "questionnaire-relance-equipe",
    `questionnaire-avant-audit-confirmation`,
    "recueil-besoin",
  ] as const,
  dettes: {
    nonMigre: [
      "newsletter-confirm-optin",
      "guide-ia-envoi",
      "roi-report",
      "podcast-demande-recue",
      "rappel-confirme",
      "appel-confirme",
      "appel-rappel-j1",
      "appel-rappel",
      "rdv-salon-confirme",
      "rdv-salon-rappel-j2",
      "rdv-salon-rappel-j1",
      "chatbot-demande-transmise",
      "avis-recu",
      "submission-reply",
      "ressources-magic-link",
      "preavis-sous-traitants",
      "rencontre-invitation",
      "visio-email-suivi",
      "questionnaire-avant-audit",
      `questionnaire-avant-audit-relance`,
      "questionnaire-relance-equipe",
      `questionnaire-avant-audit-confirmation`,
      "recueil-besoin",
    ],
    salutationHorsOuverture: [
      "roi-report",
      "podcast-demande-recue",
      "rappel-confirme",
      "appel-confirme",
      "appel-rappel-j1",
      "appel-rappel",
      "rdv-salon-confirme",
      "rdv-salon-rappel-j2",
      "rdv-salon-rappel-j1",
      "chatbot-demande-transmise",
      "avis-recu",
      "submission-reply",
      "ressources-magic-link",
      "preavis-sous-traitants",
      "visio-email-suivi",
      "questionnaire-avant-audit",
      `questionnaire-avant-audit-relance`,
      "questionnaire-relance-equipe",
      `questionnaire-avant-audit-confirmation`,
      "recueil-besoin",
    ],
    salutationNomComplet: [
      "roi-report",
      "podcast-demande-recue",
      "avis-recu",
      "ressources-magic-link",
      "recueil-besoin",
    ],
    signatureDansLeCorps: [
      "questionnaire-relance-equipe",
      `questionnaire-avant-audit-confirmation`,
    ],
    repondezDansLeCorps: ["rdv-salon-confirme", "rdv-salon-rappel-j2", "rdv-salon-rappel-j1"],
    delaiEnDur: ["roi-report", "rappel-confirme", "chatbot-demande-transmise"],
    valeurTechnique: [],
    vocabulaire: ["newsletter-confirm-optin"],
  },
  exceptionsDurees: [] as { gabarit: string; constante: string }[],
} as const;
