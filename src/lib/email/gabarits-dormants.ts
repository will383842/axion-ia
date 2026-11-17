/**
 * Gabarits d'e-mail EN SOMMEIL : inscrits (`types.ts`, `templates/index.tsx`,
 * aperçu, politique de l'outbox) mais qu'AUCUN code n'émet aujourd'hui.
 *
 * Pourquoi cette liste existe : un gabarit sans émetteur se « rebranche » vite, par
 * un simple `enqueueEmail("payment-link", …)`. Or chacun a une raison de dormir
 * (page inexistante, affirmation fausse, circuit non décidé). `gabarits-dormants.spec.ts`
 * rougit si un fichier de code, hors gabarits, aperçu, `types.ts`, `outbox-policy.ts`,
 * cite l'un de ces noms : on doit alors lever le sommeil ICI, avec une décision,
 * pas par accident.
 *
 * Un nom qui n'est plus dormant (un émetteur légitime est ajouté après décision)
 * se retire de cette liste dans la même PR.
 */

export interface GabaritDormant {
  /** Nom du gabarit tel qu'inscrit dans `EmailJobName`. */
  readonly nom: string;
  /** Pourquoi il ne doit pas être branché tel quel. */
  readonly motif: string;
}

export const GABARITS_DORMANTS: readonly GabaritDormant[] = [
  {
    nom: "payment-link",
    motif: "Aucun circuit ne génère de lien de paiement à envoyer par e-mail.",
  },
  {
    nom: "payment-receipt",
    motif:
      "Le reçu de paiement renvoie vers une page qui n'existe pas (audit des e-mails, §7) : à corriger avant tout branchement.",
  },
  {
    nom: "payment-failed",
    motif: "Aucun circuit de relance d'un paiement échoué n'est décidé.",
  },
  {
    nom: "cancellation-confirmed-by-user",
    motif: "Aucun parcours d'annulation par l'utilisateur n'existe qui l'émettrait.",
  },
  {
    nom: "force-majeure-notice",
    motif: "Texte juridique non validé : il ne part qu'après décision du fondateur.",
  },
  {
    nom: "rgpd-effacement-confirme",
    motif:
      "Il affirmerait un effacement qui n'a pas eu lieu : un effacement se confirme seulement après coup, par un circuit validé.",
  },
] as const;

export const NOMS_GABARITS_DORMANTS: readonly string[] = GABARITS_DORMANTS.map((g) => g.nom);
