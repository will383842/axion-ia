/**
 * Qualiopi — Registre des 32 indicateurs officiels RNQ V9 (AGENT B — T12).
 *
 * Module PUR : aucune dépendance Prisma, Redis ou I/O.
 * Libellés EXACTS issus du doc verbatim :
 *   INDICATEURS_OFFICIELS_V9_VERBATIM.md (2026-06-05, grille canonique).
 *
 * Répartition critères : C1:1-3 / C2:4-8 / C3:9-16 / C4:17-20 / C5:21-22
 *                        C6:23-29 / C7:30-32. Total = 32.
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
 * Conditionnels :
 *   "cert"  → 3, 7, 16 (formations certifiantes RNCP/RS)
 *   "app"   → 13, 14, 15, 20, 29 (apprentissage/CFA — colonnes AFC/CBC/VAE VIDES
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
  /** Numéro officiel (1–32) */
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
// Les 32 indicateurs — grille canonique
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
 * Retourne les numéros triés ascendants.
 */
export function indicateursApplicables(typesAction: string[]): number[] {
  const hasCert = typesAction.includes("certifiante");
  // "app" = apprentissage (CFA) : aucun type d'action correspondant chez Axion-IA.
  const hasApp = typesAction.includes("apprentissage");
  const hasAfest = typesAction.includes("alternance_afest");

  return INDICATEURS_RNQ.filter((ind) => {
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
  afest: "Aucune action de formation en situation de travail (AFEST).",
};

/**
 * Motif de non-applicabilité de l'indicateur `numero`, ou `null` s'il relève
 * du tronc commun (jamais hors périmètre, donc jamais de motif).
 */
export function motifNonApplicable(numero: number): string | null {
  const ind = INDICATEURS_RNQ.find((i) => i.numero === numero);
  if (ind === undefined || ind.conditionnel === undefined) return null;
  return MOTIFS_NON_APPLICABLE[ind.conditionnel];
}

/**
 * Retourne vrai si l'indicateur `numero` est super-indicateur en tenant
 * compte des types d'action (off.7 et off.16 deviennent super si certifiant).
 */
export function estSuperIndicateur(numero: number, typesAction: string[]): boolean {
  const ind = INDICATEURS_RNQ.find((i) => i.numero === numero);
  if (ind === undefined) return false;
  if (ind.super) return true;
  // Super conditionnel : off.7 et off.16 si certifiant
  if ((numero === 7 || numero === 16) && typesAction.includes("certifiante")) return true;
  return false;
}
