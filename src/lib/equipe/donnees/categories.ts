/**
 * Catégories et statuts des fiches collaborateurs (`TeamMember`).
 *
 * Ce sont des chaînes validées ici, pas des énumérations Postgres : ajouter une catégorie est une PR de
 * code sans migration, et aucune valeur d'énumération neuve n'a à traverser les deux conteneurs.
 */

export const TEAM_CATEGORIES = [
  { slug: "direction", singulier: "Direction", pluriel: "Direction", ordre: 10 },
  {
    slug: "apporteur",
    singulier: "Apporteur d'affaires",
    pluriel: "Apporteurs d'affaires",
    ordre: 20,
  },
  { slug: "developpeur", singulier: "Développeur", pluriel: "Développeurs", ordre: 30 },
  { slug: "specialiste_ia", singulier: "Spécialiste IA", pluriel: "Spécialistes IA", ordre: 40 },
  { slug: "partenaire", singulier: "Partenaire", pluriel: "Partenaires", ordre: 50 },
  { slug: "autres", singulier: "Autre", pluriel: "Autres", ordre: 60 },
] as const;

export type TeamCategory = (typeof TEAM_CATEGORIES)[number]["slug"];

export const TEAM_CATEGORY_SLUGS: readonly TeamCategory[] = TEAM_CATEGORIES.map((c) => c.slug);

export function estCategorieEquipe(valeur: unknown): valeur is TeamCategory {
  return typeof valeur === "string" && (TEAM_CATEGORY_SLUGS as readonly string[]).includes(valeur);
}

/** brouillon (créé à la main) | a_valider (créé par questionnaire) | publie | retire. */
export const TEAM_STATUSES = ["brouillon", "a_valider", "publie", "retire"] as const;
export type TeamStatus = (typeof TEAM_STATUSES)[number];

export function estStatutEquipe(valeur: unknown): valeur is TeamStatus {
  return typeof valeur === "string" && (TEAM_STATUSES as readonly string[]).includes(valeur);
}

/** `photoKind` : « reelle » exige en plus le consentement photo ; sinon avatar. */
export const TEAM_PHOTO_KINDS = ["reelle", "avatar"] as const;
export type TeamPhotoKind = (typeof TEAM_PHOTO_KINDS)[number];

/** Statuts d'une réponse de questionnaire (`TeamQuestionnaireSubmission.status`). */
export const TEAM_SUBMISSION_STATUSES = ["recue", "appliquee", "refusee"] as const;
export type TeamSubmissionStatus = (typeof TEAM_SUBMISSION_STATUSES)[number];

/**
 * Slugs que `TeamMember.slug` ne peut jamais prendre (routes et pages existantes). S'y ajoutent, côté
 * application et en transaction : les slugs de catégorie, ceux d'AuthorProfile et `previousSlugs`.
 */
export const TEAM_SLUGS_RESERVES: readonly string[] = [
  "williams",
  "questionnaire",
  "retrait",
  "carte",
];

export function estSlugReserve(slug: string): boolean {
  const s = slug.trim().toLowerCase();
  return TEAM_SLUGS_RESERVES.includes(s) || (TEAM_CATEGORY_SLUGS as readonly string[]).includes(s);
}
