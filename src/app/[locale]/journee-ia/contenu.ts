// La Journée IA — TOUT le texte de la page, en un seul endroit (fiche V5-03).
//
// Même principe que `tour-france-ia/contenu.ts` : les composants ne portent
// aucun texte visible, ils le reçoivent d'ici, et le test des mots interdits
// (`__tests__/contenu.spec.ts`) lit CE fichier. Aucun montant n'est écrit :
// le prix est un jeton (`JETON_PRIX`) que la page remplace par la valeur lue
// dans `pricing.ts`. Texte repris mot pour mot du plan V5 (section 2).

/** Le jeton que la page remplace par le prix lu dans `pricing.ts`. */
export const JETON_PRIX = "{{PRIX}}";

/** Le seul libellé de bouton de la page, utilisé en haut et en bas. */
export const LIBELLE_CTA = "Prendre rendez-vous";

/** La garantie, mot pour mot. */
export const GARANTIE =
  "À la fin de la journée, vous recevez votre rapport complet : vos gains chiffrés, les tâches à automatiser classées par rentabilité, et votre plan d’action sur 90 jours. Si les gains identifiés ne dépassent pas 3 fois le prix de la journée, nous vous remboursons, sans discussion, sous 30 jours.";

export const CONTENU = {
  accroche: {
    surtitre: "La Journée IA, dans votre entreprise",
    titre: "En une journée, vous savez par où commencer avec l’IA.",
    // Mots mis en terracotta dans le titre.
    titreAccent: "par où commencer",
    phrase:
      "Nous venons chez vous, nous chiffrons avec vos équipes le temps perdu sur les tâches qui reviennent, et nous les formons sur leurs propres dossiers.",
    cta: LIBELLE_CTA,
    microTexte:
      "Rendez-vous gratuit de 45 minutes, en visio ou par téléphone, sans engagement.",
  },
  questions: {
    titre: "Les questions que vous vous posez",
    cartes: [
      "Par où commencer, sans y passer des mois ?",
      "Est-ce que ça vaut le coup chez nous ?",
      "Mes équipes vont-elles suivre ?",
    ],
  },
  deroule: {
    titre: "Votre journée, étape par étape",
    etapes: [
      {
        moment: "Le matin, 2 à 4 heures",
        texte:
          "Nous regardons, service par service, ce qui prend du temps, et nous le chiffrons avec vos heures.",
      },
      {
        moment: "L’après-midi, 4 heures",
        texte:
          "Vos équipes apprennent sur leurs vrais dossiers : ce qu’on confie à l’IA, et ce qu’on garde.",
      },
      {
        moment: "En fin de journée",
        texte:
          "Nous validons avec vous les gains chiffrés et les premières priorités.",
      },
    ],
  },
  livrables: {
    titre: "Ce que vous repartez avec",
    elements: [
      {
        titre: "Votre rapport complet",
        legende:
          "vos gains chiffrés et les tâches à automatiser, classées par rentabilité",
      },
      {
        titre: "Un plan d’action sur 90 jours",
        legende: "ce qui rapporte le plus, en premier",
      },
      { titre: "Une attestation", legende: "pour chaque personne formée" },
    ],
    // Le jeton est remplacé par le prix lu dans pricing.ts.
    derniereLigne: `${JETON_PRIX} la journée, dans vos locaux.`,
  },
  intervenant: {
    titre: "Qui intervient, et notre garantie",
    presentation: "Williams Jullin, fondateur d’Axion-IA, mène la journée.",
    declaration:
      "Organisme de formation déclaré sous le n° 84381100438. Cet enregistrement ne vaut pas agrément de l’État.",
    garantie: GARANTIE,
    condition:
      "Condition : votre équipe est disponible pendant la journée et nous fournit les chiffres demandés.",
  },
  rendezVous: {
    titre: "Questions et rendez-vous",
    faq: [
      {
        question: "Faut-il connaître l’IA ?",
        reponse: "Non. Nous parlons de votre quotidien, pas de technique.",
      },
      {
        question: "Que faut-il préparer ?",
        reponse: "Un court questionnaire. Rien à installer.",
      },
      {
        question: "Où intervenez-vous ?",
        reponse: "Partout en France, dans vos locaux.",
      },
    ],
    titreFinal: "Commençons par 45 minutes, gratuitement.",
    phrase: "Nous regardons ensemble une première tâche à chiffrer.",
    cta: LIBELLE_CTA,
  },
} as const;
