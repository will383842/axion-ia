/**
 * Qualiopi — Registre des indicateurs officiels du référentiel national qualité,
 * en DEUX grilles (AGENT B — T12 ; réforme du 2026-10-02).
 *
 * Module PUR : aucune dépendance Prisma, Redis ou I/O.
 *
 * ## Deux grilles, choisies par la DATE, sans transition
 *
 *   - `INDICATEURS_RNQ` (= `GRILLE_RNQ_V9`) : les 32 indicateurs de l'annexe
 *     « en vigueur du 01/01/2021 au 01/11/2026 » (décret n° 2019-565), avec les
 *     libellés courts du doc verbatim INDICATEURS_OFFICIELS_V9_VERBATIM.md
 *     (2026-06-05, grille canonique). Elle juge un audit tenu jusqu'au
 *     31/10/2026.
 *   - `INDICATEURS_RNQ_2026` (= `GRILLE_RNQ_2026`) : les 33 indicateurs de
 *     l'annexe modifiée par le décret n° 2026-728 du 1er août 2026 (JORF du
 *     4 août 2026, art. 2 : « entre en vigueur le 1er novembre 2026 », aucune
 *     disposition transitoire). Elle juge un audit tenu à partir du 01/11/2026.
 *
 * Source des nouvelles rédactions : `_AUDIT/QUALIOPI-AUDIT-INITIAL-2026-10-01/
 * REFORME-01-11-2026-SOURCES.md` (texte lu sur Légifrance le 02/10/2026). Les
 * colonnes de catégories cochées sont identiques entre les deux tableaux pour
 * les indicateurs 1 à 32 : la grille 2026 est donc DÉRIVÉE de la V9 (mêmes
 * critères, mêmes conditionnels, mêmes super-indicateurs), seuls les libellés
 * modifiés et la ligne 33 diffèrent. `choisirReferentiel` décide laquelle
 * s'applique : la date d'audit configurée si elle existe, sinon le jour.
 *
 * Répartition critères : C1:1-3 / C2:4-8 / C3:9-16 / C4:17-20 / C5:21-22
 *                        C6:23-29 / C7:30-32 (+33 dans la grille 2026).
 *
 * Super-indicateurs (NC majeure = échec certification) — 17, dont 7 et 16 qui ne
 * sont applicables que si l'OF est certifiant. La ligne qui suit porte une
 * balise lisible par machine, et c'est ELLE que la garde relit :
 *
 * @superIndicateurs 4,5,6,7,10,11,14,15,16,20,21,22,26,27,29,31,32
 *
 * La règle, et non la liste, fait foi : est super TOUT indicateur HORS de la
 * liste graduable du RNQ V9 (08/01/2024) = {1,2,3,8,9,12,13,17,18,19,23,24,25,
 * 28,30}. C'est ainsi que `indicateurs-registre.spec.ts` le vérifie, et c'est
 * `en-tete-super-indicateurs.spec.ts` qui empêche la liste ci-dessus de
 * diverger à nouveau du code.
 *
 * ⚠️ Jusqu'au 2026-08-23 cet en-tête annonçait « 1,2,4,5,9,11,12,21,23,26,27,
 * 30,31,32 » — une liste de 14 qui se trompait DANS LES DEUX SENS : elle disait
 * super six indicateurs graduables (1,2,9,12,23,30) et, bien plus grave, elle
 * passait sous silence SEPT indicateurs (6,10,14,15,20,22,29) dont une seule
 * non-conformité fait échouer la certification.
 *
 * La liste des super-indicateurs est INCHANGÉE par la réforme : elle vient de
 * l'art. 5 de l'arrêté du 6 juin 2019, que le décret 2026-728 ne modifie pas.
 * Le 33 n'en fait pas partie.
 *
 * Conditionnels :
 *   "cert"  → 3, 7, 16 (formations certifiantes RNCP/RS)
 *   "app"   → 13, 14, 15, 20, 29, et 33 dans la grille 2026 (apprentissage/CFA — colonnes AFC/CBC/VAE VIDES
 *             dans la liste officielle Acuria « CERT PPS LIAI QUA 1 V3 »)
 *   "afest" → 28 (AFEST) — depuis le 2026-08-10, ce conditionnel n'est plus
 *             JAMAIS activé par le coaching 1-to-1 (conseil, hors Qualiopi —
 *             décision 2026-07-17) : seul le type d'action `alternance_afest`
 *             déclaré sur une Formation le rend applicable.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export type TypeActionQualiopi =
  | "classique"
  | "certifiante"
  | "foad"
  | "alternance_afest"
  | "sous_traitance"
  | "cpf"
  | "opco"
  | "handicap";

export type ConditionnelType = "cert" | "app" | "afest";

export interface IndicateurRNQ {
  /** Numéro officiel (1–32, 1–33 dans la grille 2026) */
  readonly numero: number;
  /** Critère de rattachement (1–7) */
  readonly critere: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Libellé court officiel RNQ V9 (verbatim canonique) */
  readonly libelleOfficiel: string;
  /**
   * Vrai si NC = NC majeure obligatoire (échec certification), même en cas de
   * non-respect partiel. Faux = indicateur graduable (NC mineure possible).
   *
   * Source : liste graduable du RNQ V9 (08/01/2024) = {1,2,3,8,9,12,13,17,18,
   * 19,23,24,25,28,30} ; tout le reste est à NC majeure. Vérifié par
   * `indicateurs-registre.spec.ts`.
   *
   * 7 et 16 (conditionnels « cert ») portent super=true : quand ils sont
   * applicables (OF certifiant), ils sont à NC majeure ; sinon ils sont filtrés
   * par `applicablesNums`, donc leur valeur n'est pas lue.
   */
  readonly super: boolean;
  /** Conditionnel selon le type d'action exercée. undefined = tronc commun. */
  readonly conditionnel?: ConditionnelType;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les 7 critères — intitulés officiels (décret n° 2019-564, art. R.6316-1 ;
// guide de lecture RNQ V9). SOURCE UNIQUE : l'écran « mode auditeur » et
// l'export Markdown du manifeste les lisent ici, jamais une copie.
//
// 🔴 2026-09-30 — l'écran recopiait ses propres intitulés, et celui du
// critère 6 était faux (« Inscription et veille des sous-traitants et
// formateurs occasionnels »), devant le certificateur.
// ─────────────────────────────────────────────────────────────────────────────

export type NumeroCritere = IndicateurRNQ["critere"];

export const CRITERES_RNQ: Readonly<Record<NumeroCritere, string>> = {
  1: "Les conditions d'information du public sur les prestations proposées, les délais pour y accéder et les résultats obtenus",
  2: "L'identification précise des objectifs des prestations proposées et l'adaptation de ces prestations aux publics bénéficiaires, lors de la conception des prestations",
  3: "L'adaptation aux publics bénéficiaires des prestations et des modalités d'accueil, d'accompagnement, de suivi et d'évaluation mises en œuvre",
  4: "L'adéquation des moyens pédagogiques, techniques et d'encadrement aux prestations mises en œuvre",
  5: "La qualification et le développement des connaissances et compétences des personnels chargés de mettre en œuvre les prestations",
  6: "L'inscription et l'investissement du prestataire dans son environnement professionnel",
  7: "Le recueil et la prise en compte des appréciations et des réclamations formulées par les parties prenantes aux prestations délivrées",
};

/** « Critère N — intitulé officiel » (repli « Critère N » hors 1–7). */
export function libelleCritere(numero: number): string {
  const intitule = (CRITERES_RNQ as Record<number, string | undefined>)[numero];
  return intitule === undefined ? `Critère ${numero}` : `Critère ${numero} — ${intitule}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Les 32 indicateurs — grille V9 (audit tenu jusqu'au 31/10/2026)
// ─────────────────────────────────────────────────────────────────────────────

export const INDICATEURS_RNQ: readonly IndicateurRNQ[] = [
  // Critère 1 — Information du public
  {
    numero: 1,
    critere: 1,
    libelleOfficiel:
      "Information accessible au public, détaillée et vérifiable sur les prestations",
    super: false,
  },
  {
    numero: 2,
    critere: 1,
    libelleOfficiel: "Indicateurs de résultats adaptés à la nature des prestations",
    super: false,
  },
  {
    numero: 3,
    critere: 1,
    libelleOfficiel: "Taux d'obtention des certifications préparées",
    super: false,
    conditionnel: "cert",
  },

  // Critère 2 — Objectifs et adaptation des prestations
  {
    numero: 4,
    critere: 2,
    libelleOfficiel:
      "Analyse du besoin du bénéficiaire en lien avec l'entreprise et/ou le financeur",
    super: true,
  },
  {
    numero: 5,
    critere: 2,
    libelleOfficiel: "Objectifs opérationnels et évaluables de la prestation",
    super: true,
  },
  {
    numero: 6,
    critere: 2,
    libelleOfficiel: "Contenus et modalités adaptés aux objectifs et publics",
    super: true,
  },
  {
    numero: 7,
    critere: 2,
    libelleOfficiel: "Adéquation des contenus aux exigences de la certification visée",
    super: true,
    conditionnel: "cert",
  },
  {
    numero: 8,
    critere: 2,
    libelleOfficiel: "Positionnement et évaluation des acquis à l'entrée",
    super: false,
  },

  // Critère 3 — Accueil, accompagnement, suivi, évaluation
  {
    numero: 9,
    critere: 3,
    libelleOfficiel: "Information sur les conditions de déroulement",
    super: false,
  },
  {
    numero: 10,
    critere: 3,
    libelleOfficiel:
      "Mise en œuvre et adaptation de la prestation, de l'accompagnement et du suivi aux publics",
    super: true,
  },
  {
    numero: 11,
    critere: 3,
    libelleOfficiel: "Évaluation de l'atteinte des objectifs",
    super: true,
  },
  {
    numero: 12,
    critere: 3,
    libelleOfficiel:
      "Mesures favorisant l'engagement des bénéficiaires et prévenant les ruptures de parcours",
    super: false,
  },
  {
    numero: 13,
    critere: 3,
    libelleOfficiel:
      "Alternance : missions anticipées avec l'entreprise et l'apprenant, coordination et progressivité des apprentissages",
    super: false,
    conditionnel: "app",
  },
  {
    numero: 14,
    critere: 3,
    libelleOfficiel:
      "Accompagnement socio-professionnel, éducatif et relatif à l'exercice de la citoyenneté (CFA)",
    super: true,
    conditionnel: "app",
  },
  {
    numero: 15,
    critere: 3,
    libelleOfficiel:
      "Information des apprentis sur leurs droits et devoirs et sur les règles de santé et de sécurité (CFA)",
    super: true,
    conditionnel: "app",
  },
  {
    numero: 16,
    critere: 3,
    libelleOfficiel:
      "Conditions de présentation à la certification conformes aux exigences du certificateur",
    super: true,
    conditionnel: "cert",
  },

  // Critère 4 — Adéquation des moyens
  {
    numero: 17,
    critere: 4,
    libelleOfficiel: "Moyens humains et techniques adaptés et environnement approprié",
    super: false,
  },
  {
    numero: 18,
    critere: 4,
    libelleOfficiel: "Mobilisation et coordination des intervenants internes et/ou externes",
    super: false,
  },
  {
    numero: 19,
    critere: 4,
    libelleOfficiel:
      "Ressources pédagogiques mises à disposition et appropriées par le bénéficiaire",
    super: false,
  },
  {
    numero: 20,
    critere: 4,
    // Apprentissage/CFA uniquement (personnels dédiés à l'accompagnement des
    // apprentis) → NON applicable en action de formation continue (AFC).
    // Réf. liste officielle Acuria « CERT PPS LIAI QUA 1 V3 » : colonne AFC vide.
    libelleOfficiel:
      "Personnels dédiés : appui à la mobilité, référent handicap, conseil de perfectionnement (CFA)",
    super: true,
    conditionnel: "app",
  },

  // Critère 5 — Qualification du personnel
  {
    numero: 21,
    critere: 5,
    libelleOfficiel: "Détermination, mobilisation et évaluation des compétences des intervenants",
    super: true,
  },
  {
    numero: 22,
    critere: 5,
    libelleOfficiel: "Entretien et développement des compétences des salariés",
    super: true,
  },

  // Critère 6 — Environnement professionnel
  {
    numero: 23,
    critere: 6,
    libelleOfficiel: "Veille légale et réglementaire",
    super: false,
  },
  {
    numero: 24,
    critere: 6,
    libelleOfficiel: "Veille sur les évolutions des compétences, des métiers et des emplois",
    super: false,
  },
  {
    numero: 25,
    critere: 6,
    libelleOfficiel: "Veille sur les innovations pédagogiques et technologiques",
    super: false,
  },
  {
    numero: 26,
    critere: 6,
    libelleOfficiel:
      "Expertise, outils et réseaux mobilisés pour accueillir, accompagner ou orienter les publics en situation de handicap",
    super: true,
  },
  {
    numero: 27,
    critere: 6,
    libelleOfficiel: "Conformité au référentiel en cas de sous-traitance ou de portage salarial",
    super: true,
  },
  {
    numero: 28,
    critere: 6,
    libelleOfficiel:
      "Formation en situation de travail : mobilisation du réseau de partenaires socio-économiques",
    super: false,
    conditionnel: "afest",
  },
  {
    numero: 29,
    critere: 6,
    // Apprentissage/CFA uniquement (insertion professionnelle des apprentis) → NON
    // applicable en action de formation continue (AFC).
    // Réf. liste officielle Acuria « CERT PPS LIAI QUA 1 V3 » : colonne AFC vide.
    libelleOfficiel: "Insertion professionnelle ou poursuite d'études des apprentis (CFA)",
    super: true,
    conditionnel: "app",
  },

  // Critère 7 — Appréciations et amélioration continue
  {
    numero: 30,
    critere: 7,
    libelleOfficiel: "Recueil des appréciations des parties prenantes",
    super: false,
  },
  {
    numero: 31,
    critere: 7,
    libelleOfficiel: "Traitement des réclamations, difficultés et aléas",
    super: true,
  },
  {
    numero: 32,
    critere: 7,
    libelleOfficiel:
      "Mesures d'amélioration à partir de l'analyse des appréciations et des réclamations",
    super: true,
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Les 33 indicateurs — grille du décret n° 2026-728 (audit à partir du 01/11/2026)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Libellés des indicateurs dont la rédaction change au 1er novembre 2026.
 *
 * 🔑 Ce sont les mots du texte officiel tels que les relève
 * `REFORME-01-11-2026-SOURCES.md` (§2.1, lu sur Légifrance le 02/10/2026), sans
 * paraphrase. Quand le fichier source élide le début de la phrase (« … »), le
 * début est celui du libellé court V9, qui reprend les premiers mots de
 * l'ancienne rédaction, inchangés.
 *
 * ⚠️ Pour 15 et 20 (apprentissage seulement, non applicables à l'organisme), le
 * fichier source ne relève qu'un RÉSUMÉ des ajouts, pas la phrase intégrale :
 * leurs libellés reprennent ce résumé et les expressions qu'il cite entre
 * guillemets. À remplacer par la phrase intégrale si elle est relevée.
 */
const LIBELLES_MODIFIES_2026: Readonly<Record<number, string>> = {
  1: "Information accessible au public, détaillée et vérifiable sur les prestations proposées : prérequis, objectifs, type de reconnaissance de la formation délivrée, durée, modalités pédagogiques et de financements, délais d'accès, tarifs, contacts, méthodes mobilisées et modalités d'évaluation, accessibilité aux personnes en situation de handicap. Sa communication ne comporte aucune mention de nature à induire le public en erreur, notamment sur les conditions d'accès, le contenu, les modalités pédagogiques, le financement des formations, les droits ou l'absence de droits de poursuite d'études conférés par la formation préparée.",
  2: "Indicateurs de résultats adaptés à la nature des prestations mises en œuvre et des publics accueillis en précisant de manière transparente leurs modalités de calcul ou en s'appuyant sur des dispositifs existants.",
  3: "Taux d'obtention des certifications préparées ; équivalences, passerelles, suites de parcours, en particulier les poursuites d'études, et les débouchés.",
  7: "Le prestataire s'assure de l'adéquation du ou des contenus de la prestation aux exigences de la certification visée et peut prouver sa capacité à assurer cette certification, y compris en qualité d'organisme habilité.",
  12: "Mesures favorisant l'engagement des bénéficiaires et prévenant les ruptures de parcours. Il s'assure de la prévention et du traitement de toute situation de violence, dont les violences sexistes et sexuelles, de harcèlement ou de discrimination dans le cadre de leur formation.",
  14: "Accompagnement socio-professionnel, éducatif et relatif à l'exercice de la citoyenneté (CFA). Il dispose d'une procédure de traitement sans délai des situations de rupture liées à des difficultés, violences ou discriminations subies par l'apprenant en formation ou dans l'entreprise d'accueil.",
  15: "Information des apprentis sur leurs droits et devoirs et sur les règles de santé et de sécurité, « de manière renforcée lorsqu'ils sont mineurs » ; information sur les dispositifs de prévention et de signalement des violences, du harcèlement et des discriminations, coordonnées du médiateur de l'apprentissage, signalement des dysfonctionnements à l'inspection du travail (CFA)",
  19: "Ressources pédagogiques mises à disposition et appropriées par le bénéficiaire. Lorsque des modules pédagogiques sont réalisés à distance, le prestataire vérifie l'effectivité de leur suivi par les apprenants. Au-delà d'un nombre d'intervenants par formation, fixé par arrêté du ministre chargé de la formation professionnelle, le prestataire dispose d'un référent pédagogique par formation chargé d'assurer la coordination pédagogique entre les intervenants.",
  20: "Personnels dédiés : appui à la mobilité, référent handicap, conseil de perfectionnement ; qualité du pilotage, participation des apprentis, formateurs et entreprises à la gouvernance ; supervision renforcée lorsque la part d'heures assurées par des intervenants permanents passe sous un seuil fixé par arrêté (CFA)",
  27: "Lorsque le prestataire fait appel à la sous-traitance ou au portage salarial, il s'assure du respect de la conformité au présent référentiel et en assure la traçabilité dans les contrats de sous-traitance.",
  30: "Recueil des appréciations des parties prenantes : bénéficiaires, financeurs (le cas échéant), équipes pédagogiques et entreprises concernées",
  31: "Traitement des difficultés rencontrées par les parties prenantes, des réclamations exprimées par ces dernières ainsi que des aléas survenus en cours de prestation",
  32: "Le prestataire met en place une démarche d'amélioration continue à partir de l'analyse des appréciations et des réclamations, ainsi qu'une analyse des risques sur la qualité des formations délivrées.",
};

/**
 * Indicateur 33 — ajouté par le décret 2026-728.
 *
 * Une seule case cochée au tableau officiel : la colonne 4° (apprentissage).
 * Il porte donc le conditionnel `app`, et son motif de non-applicabilité vient
 * du MÊME mécanisme que 13/14/15/20/29. Pas super-indicateur : l'art. 5 de
 * l'arrêté du 6 juin 2019 (liste des NC majeures) n'est pas modifié et ne le
 * cite pas.
 *
 * Critère 7 : DÉDUCTION, le fichier source ne relève pas le critère de
 * rattachement. Le 33 suit le 32 dans la numérotation continue, et le critère 7
 * (recueil et prise en compte des appréciations) est le dernier ; son objet
 * (évaluation des enseignements par les apprenants, amélioration continue)
 * est celui du critère 7.
 */
const INDICATEUR_33: IndicateurRNQ = {
  numero: 33,
  critere: 7,
  libelleOfficiel:
    "Le prestataire met en place un dispositif d'évaluation des contenus et des enseignements par les apprenants, distinct du recueil général de satisfaction, dont les résultats sont partagés avec les équipes pédagogiques et donnent lieu à la formalisation d'une démarche d'amélioration continue, dont il mesure périodiquement l'efficacité.",
  super: false,
  conditionnel: "app",
};

/**
 * La grille du 1er novembre 2026 : DÉRIVÉE de la V9 (critère, super,
 * conditionnel inchangés pour 1 à 32), libellés modifiés substitués, 33 ajouté.
 */
export const INDICATEURS_RNQ_2026: readonly IndicateurRNQ[] = [
  ...INDICATEURS_RNQ.map((ind) => {
    const libelle = LIBELLES_MODIFIES_2026[ind.numero];
    return libelle === undefined ? ind : { ...ind, libelleOfficiel: libelle };
  }),
  INDICATEUR_33,
];

// ─────────────────────────────────────────────────────────────────────────────
// Choix de la grille par la DATE
// ─────────────────────────────────────────────────────────────────────────────

export type IdGrilleRNQ = "rnq-v9" | "rnq-2026";

export interface GrilleRNQ {
  readonly id: IdGrilleRNQ;
  /** Étiquette machine portée par `manifeste.json` (`meta.version`). */
  readonly version: string;
  /** Intitulé lisible : quel texte, en vigueur depuis/jusqu'à quand. */
  readonly intitule: string;
  readonly indicateurs: readonly IndicateurRNQ[];
}

/**
 * Premier jour où un audit se juge sur la grille 2026 (décret n° 2026-728,
 * art. 2). Jour calendaire de Paris, au format ISO.
 */
export const JOUR_ENTREE_EN_VIGUEUR_RNQ_2026 = "2026-11-01";

export const GRILLE_RNQ_V9: GrilleRNQ = {
  id: "rnq-v9",
  version: "RNQ-V9",
  intitule:
    "Référentiel national qualité, version en vigueur jusqu'au 31 octobre 2026 (décret n° 2019-565, 32 indicateurs)",
  indicateurs: INDICATEURS_RNQ,
};

export const GRILLE_RNQ_2026: GrilleRNQ = {
  id: "rnq-2026",
  version: "RNQ-2026-728",
  intitule:
    "Référentiel national qualité modifié par le décret n° 2026-728 du 1er août 2026, en vigueur à partir du 1er novembre 2026 (33 indicateurs)",
  indicateurs: INDICATEURS_RNQ_2026,
};

/** Jour calendaire de PARIS (« AAAA-MM-JJ ») — jamais le fuseau du conteneur. */
export function jourParisIso(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Vrai pour un « AAAA-MM-JJ » qui désigne un jour qui existe. */
export function estJourIsoValide(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T12:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** La grille qui juge un audit tenu ce jour-là (« AAAA-MM-JJ »). */
export function grillePourJour(jourIso: string): GrilleRNQ {
  // Comparaison lexicographique : exacte sur le format ISO à largeur fixe.
  return jourIso >= JOUR_ENTREE_EN_VIGUEUR_RNQ_2026 ? GRILLE_RNQ_2026 : GRILLE_RNQ_V9;
}

export function grilleParId(id: IdGrilleRNQ): GrilleRNQ {
  return id === "rnq-2026" ? GRILLE_RNQ_2026 : GRILLE_RNQ_V9;
}

/** Ce que la console déclare appliquer : la grille, et le jour qui l'a choisie. */
export interface ReferentielApplique {
  readonly grille: IdGrilleRNQ;
  readonly version: string;
  readonly intitule: string;
  readonly nbIndicateurs: number;
  /** Jour (« AAAA-MM-JJ ») qui a choisi la grille. */
  readonly jourReference: string;
  /** D'où vient ce jour : la date d'audit configurée, ou le jour même. */
  readonly origine: "date_audit" | "date_du_jour";
}

/**
 * Choisit la grille appliquée par le Mode auditeur, le manifeste et le ZIP.
 *
 * Une date d'audit configurée (`date_audit_referentiel`, « AAAA-MM-JJ ») choisit
 * la grille ; sinon c'est le jour de Paris. Une valeur illisible est ignorée
 * (le schéma de configuration la refuse déjà à l'écriture).
 */
export function choisirReferentiel(
  dateAuditConfiguree: string | null | undefined,
  maintenant: Date,
): ReferentielApplique {
  const dateAudit = (dateAuditConfiguree ?? "").trim();
  const origine = estJourIsoValide(dateAudit) ? "date_audit" : "date_du_jour";
  const jourReference = origine === "date_audit" ? dateAudit : jourParisIso(maintenant);
  const grille = grillePourJour(jourReference);
  return {
    grille: grille.id,
    version: grille.version,
    intitule: grille.intitule,
    nbIndicateurs: grille.indicateurs.length,
    jourReference,
    origine,
  };
}

/** « JJ/MM/AAAA » d'un « AAAA-MM-JJ ». */
function jourFr(jourIso: string): string {
  const [a, m, j] = jourIso.split("-");
  return `${j}/${m}/${a}`;
}

/**
 * La phrase d'en-tête : quelle grille, et pourquoi elle. Lue par l'écran du Mode
 * auditeur ET par le manifeste remis, jamais réécrite de son côté.
 */
export function libelleReferentielApplique(r: ReferentielApplique): string {
  const pourquoi =
    r.origine === "date_audit"
      ? `grille appliquée pour un audit tenu le ${jourFr(r.jourReference)} (date d'audit configurée)`
      : `grille en vigueur le ${jourFr(r.jourReference)} (date du jour : aucune date d'audit n'est configurée)`;
  return `${r.intitule} — ${pourquoi}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : indicateurs applicables selon les types d'action exercées
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retourne la liste des numéros d'indicateurs applicables pour les
 * `typesAction` déclarés par l'OF.
 *
 * - Tronc commun (conditionnel undefined) : toujours applicables.
 * - "cert"  : applicable si "certifiante" ∈ typesAction.
 * - "app"   : APPRENTISSAGE/CFA (off.13/14/15/20/29). Axion-IA n'exerce pas
 *             l'apprentissage → jamais applicable (découplé de l'AFEST). Ne PAS
 *             le rattacher à "alternance_afest" : ce sont des indicateurs apprenti
 *             (citoyenneté/droits/insertion/personnels dédiés apprentis), distincts
 *             de l'AFEST (off.28). Cf. liste officielle Acuria CERT PPS LIAI QUA 1 V3.
 * - "afest" : applicable si "alternance_afest" ∈ typesAction (off.28) — types
 *             DÉCLARÉS sur les Formation uniquement ; le coaching 1-to-1
 *             (conseil) n'alimente plus jamais cette liste (2026-08-10).
 *
 * `indicateurs` : la grille lue (V9 par défaut ; le moteur de conformité passe
 * celle que `choisirReferentiel` a retenue).
 *
 * Retourne les numéros triés ascendants.
 */
export function indicateursApplicables(
  typesAction: string[],
  indicateurs: readonly IndicateurRNQ[] = INDICATEURS_RNQ,
): number[] {
  const hasCert = typesAction.includes("certifiante");
  // "app" = apprentissage (CFA) : aucun type d'action correspondant chez Axion-IA.
  const hasApp = typesAction.includes("apprentissage");
  const hasAfest = typesAction.includes("alternance_afest");

  return indicateurs
    .filter((ind) => {
      if (ind.conditionnel === undefined) return true;
      if (ind.conditionnel === "cert") return hasCert;
      if (ind.conditionnel === "app") return hasApp;
      if (ind.conditionnel === "afest") return hasAfest;
      return false;
    })
    .map((ind) => ind.numero)
    .sort((a, b) => a - b);
}

// ─────────────────────────────────────────────────────────────────────────────
// Motif de non-applicabilité — dérivé du MÊME champ que l'applicabilité
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Le motif dit pourquoi un indicateur conditionnel est hors périmètre.
 *
 * 🔑 Il est indexé par `ConditionnelType` — le champ même que lit
 * `indicateursApplicables` — et non par numéro d'indicateur : un motif écrit
 * en face d'un numéro diverge de la règle dès qu'un indicateur change de
 * condition. Ici, un indicateur ne peut être « non applicable » que par sa
 * condition, et c'est cette condition qui parle.
 *
 * `Record<ConditionnelType, …>` : une condition ajoutée sans motif ne compile pas.
 */
export const MOTIFS_NON_APPLICABLE: Readonly<Record<ConditionnelType, string>> = {
  cert: "Aucune formation ne prépare une certification inscrite au RNCP ou au répertoire spécifique (RS).",
  app: "L'organisme n'est pas un CFA et ne délivre pas d'action en apprentissage ou en alternance.",
  afest: "Aucune action de formation en situation de travail (AFEST) ni en alternance.",
};

/**
 * Motif de non-applicabilité de l'indicateur `numero`, ou `null` s'il relève
 * du tronc commun (jamais hors périmètre, donc jamais de motif).
 */
export function motifNonApplicable(numero: number): string | null {
  // La grille 2026 contient la V9 (mêmes conditionnels pour 1 à 32) plus le 33 :
  // la lire suffit pour les deux grilles.
  const ind = INDICATEURS_RNQ_2026.find((i) => i.numero === numero);
  if (ind === undefined || ind.conditionnel === undefined) return null;
  return MOTIFS_NON_APPLICABLE[ind.conditionnel];
}

/**
 * Retourne vrai si l'indicateur `numero` est super-indicateur en tenant
 * compte des types d'action (off.7 et off.16 deviennent super si certifiant).
 */
export function estSuperIndicateur(numero: number, typesAction: string[]): boolean {
  // Super-indicateurs identiques dans les deux grilles (art. 5 de l'arrêté du
  // 6 juin 2019, non modifié) ; le 33 n'en est pas un.
  const ind = INDICATEURS_RNQ_2026.find((i) => i.numero === numero);
  if (ind === undefined) return false;
  if (ind.super) return true;
  // Super conditionnel : off.7 et off.16 si certifiant
  if ((numero === 7 || numero === 16) && typesAction.includes("certifiante")) return true;
  return false;
}
