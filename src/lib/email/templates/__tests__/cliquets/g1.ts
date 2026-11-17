/**
 * Cliquet du groupe G1 — accusés client (lot S1).
 *
 * `gabarits` : les noms du groupe (partition du plan §2.3, vérifiée par
 * `chassis-regles.spec.tsx`). `dettes` : l'état RÉEL mesuré le 2026-11-17, règle par
 * règle. Le test exige l'égalité des ensembles : une nouvelle violation rougit, et un
 * gabarit devenu conforme rougit tant qu'il reste listé. Les listes ne font que
 * diminuer : la fiche de migration du groupe n'édite que ce fichier.
 */
export const GROUPE_G1 = {
  gabarits: [
    "audit-confirmed",
    "implementation-confirmed",
    "contact-confirmed",
    "quote-request-received",
  ] as const,
  dettes: {
    nonMigre: [
      "audit-confirmed",
      "implementation-confirmed",
      "contact-confirmed",
      "quote-request-received",
    ],
    salutationHorsOuverture: [
      "audit-confirmed",
      "implementation-confirmed",
      "contact-confirmed",
      "quote-request-received",
    ],
    salutationNomComplet: [],
    signatureDansLeCorps: [],
    repondezDansLeCorps: [],
    delaiEnDur: ["audit-confirmed", "implementation-confirmed", "contact-confirmed"],
    valeurTechnique: [
      "audit-confirmed",
      "implementation-confirmed",
      "contact-confirmed",
      "quote-request-received",
    ],
    vocabulaire: ["implementation-confirmed"],
  },
  exceptionsDurees: [] as { gabarit: string; constante: string }[],
} as const;
