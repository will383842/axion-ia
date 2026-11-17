/**
 * Cliquet du groupe G3 — droits et réclamations (lot S1).
 *
 * `gabarits` : les noms du groupe (partition du plan §2.3, vérifiée par
 * `chassis-regles.spec.tsx`). `dettes` : l'état RÉEL mesuré le 2026-11-17, règle par
 * règle. Le test exige l'égalité des ensembles : une nouvelle violation rougit, et un
 * gabarit devenu conforme rougit tant qu'il reste listé. Les listes ne font que
 * diminuer : la fiche de migration du groupe n'édite que ce fichier.
 */
export const GROUPE_G3 = {
  gabarits: [
    "gdpr-export-link",
    "rgpd-demande-recue",
    "rgpd-effacement-confirme",
    "reclamation-accuse",
    "reclamation-reponse",
  ] as const,
  dettes: {
    nonMigre: [
      "gdpr-export-link",
      "rgpd-demande-recue",
      "rgpd-effacement-confirme",
      "reclamation-accuse",
      "reclamation-reponse",
    ],
    salutationHorsOuverture: [
      "rgpd-demande-recue",
      "rgpd-effacement-confirme",
      "reclamation-accuse",
      "reclamation-reponse",
    ],
    salutationNomComplet: [],
    signatureDansLeCorps: [],
    repondezDansLeCorps: [],
    delaiEnDur: ["gdpr-export-link", "reclamation-accuse"],
    valeurTechnique: [],
    vocabulaire: [],
  },
  exceptionsDurees: [] as { gabarit: string; constante: string }[],
} as const;
