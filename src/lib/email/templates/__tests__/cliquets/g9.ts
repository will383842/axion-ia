/**
 * Cliquet du groupe G9 — interne (lot S1).
 *
 * `gabarits` : les noms du groupe (partition du plan §2.3, vérifiée par
 * `chassis-regles.spec.tsx`). `dettes` : l'état RÉEL mesuré le 2026-11-17, règle par
 * règle. Le test exige l'égalité des ensembles : une nouvelle violation rougit, et un
 * gabarit devenu conforme rougit tant qu'il reste listé. Les listes ne font que
 * diminuer : la fiche de migration du groupe n'édite que ce fichier.
 */
export const GROUPE_G9 = {
  gabarits: [
    "qualiopi-alerte-interne",
    "candidature-commercial-recap",
    "devis-signe-a-contresigner",
    "alerte-demande-client",
    "recap-demandes-clients",
    "questionnaire-reponses-recues",
    "apporteur-declaration-recue",
  ] as const,
  dettes: {
    nonMigre: [
      "qualiopi-alerte-interne",
      "candidature-commercial-recap",
      "devis-signe-a-contresigner",
      "alerte-demande-client",
      "recap-demandes-clients",
      "questionnaire-reponses-recues",
      "apporteur-declaration-recue",
    ],
    salutationHorsOuverture: ["candidature-commercial-recap"],
    salutationNomComplet: [],
    signatureDansLeCorps: [],
    repondezDansLeCorps: [],
    delaiEnDur: [],
    valeurTechnique: ["candidature-commercial-recap"],
    vocabulaire: [],
  },
  exceptionsDurees: [] as { gabarit: string; constante: string }[],
} as const;
