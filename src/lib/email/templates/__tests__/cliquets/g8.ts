/**
 * Cliquet du groupe G8 — candidats (lot S1).
 *
 * `gabarits` : les noms du groupe (partition du plan §2.3, vérifiée par
 * `chassis-regles.spec.tsx`). `dettes` : l'état RÉEL mesuré le 2026-11-17, règle par
 * règle. Le test exige l'égalité des ensembles : une nouvelle violation rougit, et un
 * gabarit devenu conforme rougit tant qu'il reste listé. Les listes ne font que
 * diminuer : la fiche de migration du groupe n'édite que ce fichier.
 */
export const GROUPE_G8 = {
  gabarits: ["candidature-recue", "candidature-reponse", "candidature-entretien-rappel"] as const,
  dettes: {
    nonMigre: ["candidature-recue", "candidature-reponse", "candidature-entretien-rappel"],
    salutationHorsOuverture: [
      "candidature-recue",
      "candidature-reponse",
      "candidature-entretien-rappel",
    ],
    salutationNomComplet: ["candidature-recue"],
    signatureDansLeCorps: [],
    repondezDansLeCorps: [],
    delaiEnDur: [],
    valeurTechnique: [],
    vocabulaire: [],
  },
  exceptionsDurees: [] as { gabarit: string; constante: string }[],
} as const;
