/**
 * Formateurs indépendants — REGISTRE DES GESTES HUMAINS (lot S0-bis).
 *
 * Tout ce que l'outil ne fait pas seul dans le parcours d'un formateur
 * indépendant : qui le fait, à quel rythme, et pourquoi c'est un humain — la
 * loi, un choix de Will, ou un automatisme qui n'existe pas encore.
 *
 * 🔑 Ce registre alimente la tuile « À faire maintenant » (champ `rubrique`).
 * Un geste qui n'y figure pas n'apparaît nulle part : il est oublié.
 *
 * 🔴 Verrouillé par `gestes-humains.spec.ts` : toute Server Action de la
 * console qui fait passer une étape à un formateur indépendant doit être
 * rattachée ici à un geste (champ `actions`).
 */

/** Pourquoi ce geste reste humain. */
export type RaisonGeste =
  /** Un texte impose une décision ou une signature humaine. */
  | "loi"
  /** Will a décidé de garder la main. */
  | "choix_de_will"
  /** L'automatisme n'existe pas (encore) : le geste humain le remplace. */
  | "faute_d_automatisme";

/** Rôle qui pose le geste — libellé lisible, pas une liste d'autorisation. */
export type QuiGeste =
  "Will" | "Will ou responsable qualité" | "Will ou administrateur" | "orchestrateur technique";

/** Rubrique de la tuile « À faire maintenant ». */
export type RubriqueAFaire =
  | "candidats"
  | "echanges"
  | "pieces"
  | "signatures"
  | "habilitations"
  | "presence"
  | "rendez_vous"
  | "remuneration"
  | "reglages";

export interface GesteHumain {
  readonly id: string;
  readonly geste: string;
  readonly qui: QuiGeste;
  readonly frequence: string;
  readonly raison: RaisonGeste;
  readonly rubrique: RubriqueAFaire;
  /** Un automatisme pourrait-il le remplacer un jour ? */
  readonly automatisable: boolean;
  /** Server Actions de la console qui portent ce geste (noms exportés). */
  readonly actions?: ReadonlyArray<string>;
}

export const GESTES_HUMAINS: ReadonlyArray<GesteHumain> = [
  {
    id: "choisir_formateur",
    geste: "Choisir le formateur d'une formation",
    qui: "Will",
    frequence: "à chaque formation",
    raison: "choix_de_will",
    rubrique: "candidats",
    automatisable: false,
  },
  {
    id: "issue_echange",
    geste: "Noter l'issue de l'échange : retenu, non retenu ou absent",
    qui: "Will",
    frequence: "après chaque échange",
    raison: "choix_de_will",
    rubrique: "echanges",
    automatisable: false,
  },
  {
    id: "feu_orange_ancien_salarie",
    geste: "Trancher le feu orange « ancien salarié depuis moins de 12 mois »",
    qui: "Will ou responsable qualité",
    frequence: "rare",
    raison: "loi",
    rubrique: "candidats",
    automatisable: false,
  },
  {
    id: "valider_attestation_urssaf",
    geste: "Valider l'attestation de vigilance URSSAF",
    qui: "Will",
    frequence: "tous les 6 mois",
    raison: "loi",
    rubrique: "pieces",
    automatisable: false,
  },
  {
    id: "valider_pieces",
    geste: "Valider le CV, l'attestation RC pro et le récépissé de déclaration",
    qui: "Will ou responsable qualité",
    frequence: "une fois, puis à chaque renouvellement",
    raison: "faute_d_automatisme",
    rubrique: "pieces",
    automatisable: true,
    actions: ["verifyTrainerSousTraitantAction", "updateTrainerSousTraitancePiecesAction"],
  },
  {
    id: "contresigner_contrat",
    geste: "Contresigner le contrat-cadre et cocher les habilitations",
    qui: "Will ou administrateur",
    frequence: "une fois par formateur",
    raison: "loi",
    rubrique: "signatures",
    automatisable: false,
    actions: ["setTrainerActifAction"],
  },
  {
    id: "habilitations_nouvelle_formation",
    geste: "Habiliter un formateur sur une nouvelle formation",
    qui: "Will ou responsable qualité",
    frequence: "à chaque nouvelle formation",
    raison: "choix_de_will",
    rubrique: "habilitations",
    automatisable: false,
    actions: ["setTrainerHabilitationsAction"],
  },
  {
    id: "contresigner_lettres",
    geste: "Contresigner les lettres de mission, par lot",
    qui: "Will ou administrateur",
    frequence: "par lot de missions",
    raison: "loi",
    rubrique: "signatures",
    automatisable: false,
  },
  {
    id: "feuille_presence_papier",
    geste: "Reporter une feuille de présence papier",
    qui: "Will ou responsable qualité",
    frequence: "quand l'émargement n'a pas été fait en ligne",
    raison: "faute_d_automatisme",
    rubrique: "presence",
    automatisable: false,
  },
  {
    id: "convention_hors_outil",
    geste: "Enregistrer une convention signée hors de l'outil",
    qui: "Will ou administrateur",
    frequence: "rare",
    raison: "faute_d_automatisme",
    rubrique: "signatures",
    automatisable: false,
  },
  {
    id: "rendez_vous_a_verifier",
    geste: "Vérifier un rendez-vous marqué « à vérifier »",
    qui: "Will",
    frequence: "au fil de l'eau",
    raison: "faute_d_automatisme",
    rubrique: "rendez_vous",
    automatisable: true,
  },
  {
    id: "accord_hors_outil",
    geste: "Consigner un accord obtenu hors de l'outil",
    qui: "Will",
    frequence: "rare",
    raison: "faute_d_automatisme",
    rubrique: "signatures",
    automatisable: false,
  },
  {
    id: "faire_avancer_releve",
    geste: "Faire avancer un relevé de rémunération et son autofacture",
    qui: "Will ou administrateur",
    frequence: "chaque mois",
    raison: "choix_de_will",
    rubrique: "remuneration",
    automatisable: true,
    actions: [
      "transitionStatementAction",
      "emettreAutofactureAction",
      "transmettreAutofactureAction",
      "contesterAutofactureAction",
    ],
  },
  {
    id: "allumer_interrupteur",
    geste: "Allumer ou couper un interrupteur du parcours",
    qui: "orchestrateur technique",
    frequence: "à chaque ouverture d'une étape",
    raison: "choix_de_will",
    rubrique: "reglages",
    automatisable: false,
  },
  {
    id: "valider_texte",
    geste: "Valider un texte d'e-mail envoyé aux formateurs",
    qui: "Will",
    frequence: "à chaque texte nouveau ou modifié",
    raison: "choix_de_will",
    rubrique: "reglages",
    automatisable: false,
  },
];

/** Les noms d'actions rattachés au registre. */
export function actionsDuRegistre(): ReadonlySet<string> {
  return new Set(GESTES_HUMAINS.flatMap((g) => g.actions ?? []));
}
