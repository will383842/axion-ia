/**
 * Catalogue des pistes de l'outil d'audit (`maquettes-v2/donnees.js`, `D.pistes`) : libellé, facilité par défaut
 * (1 à 3) et risque par défaut. L'écran en a besoin pour classer les priorités EXACTEMENT comme l'outil.
 * Un catalogue plus précis (celui du déroulé d'un client) peut arriver dans les événements : voir `vue.ts`.
 */
export interface PisteCatalogue {
  readonly nom: string;
  readonly faisa: number;
  readonly risque: string;
}

export const CATALOGUE_PISTES: Readonly<Record<string, PisteCatalogue>> = {
  bons: {
    nom: "Bons d'intervention sur tablette, saisis une seule fois",
    faisa: 2,
    risque: "moyen",
  },
  sms: {
    nom: "SMS automatiques aux clients : créneau et heure de passage",
    faisa: 3,
    risque: "faible",
  },
  contrats: { nom: "Relances automatiques des contrats d'entretien", faisa: 3, risque: "faible" },
  impayes: {
    nom: "Relances des factures en retard préparées automatiquement",
    faisa: 3,
    risque: "faible",
  },
  mails: { nom: "Tri des mails et fiche client créée automatiquement", faisa: 2, risque: "moyen" },
  cr: {
    nom: "Comptes rendus de visite préparés par l'IA à partir d'une note vocale",
    faisa: 2,
    risque: "moyen",
  },
  planning: { nom: "Proposition automatique du planning de la semaine", faisa: 1, risque: "moyen" },
  suivi: { nom: "Tableau de suivi du mois qui se remplit seul", faisa: 2, risque: "faible" },
};
