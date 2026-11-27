/**
 * Les trois consentements, SÉPARÉS, des fiches collaborateurs : publication, photo, lien LinkedIn.
 *
 * Règle : un texte déjà proposé à quelqu'un n'est JAMAIS modifié. Un changement = une nouvelle version
 * (`v2`…) ajoutée ici ; l'ancienne reste, car la preuve d'un accord renvoie à la version exacte acceptée
 * (colonnes `*_consent_version` de `team_members` et registre `ConsentEvent`).
 *
 * ⚠️ Textes de première version : à relire et valider avant la première mise en service d'un questionnaire
 * ou d'une publication (aucun écran ne les affiche encore).
 */

export const TEAM_CONSENT_KINDS = ["publication", "photo", "linkedin"] as const;
export type TeamConsentKind = (typeof TEAM_CONSENT_KINDS)[number];

export interface TeamConsentVersion {
  readonly version: string;
  /** Référence de formulaire écrite dans `ConsentEvent.formRef`. */
  readonly formRef: string;
  readonly texte: string;
}

export const TEAM_CONSENT_VERSIONS = {
  publication: {
    v1: {
      version: "team-publication-v1",
      formRef: "team-profile-publication",
      texte:
        "J'accepte qu'une page publique à mon nom (mon prénom seulement) soit publiée sur le site d'Axion IA, avec les réponses que j'ai données dans ce questionnaire. Je pourrai la relire avant sa mise en ligne. Je peux demander son retrait ou l'effacement de mes données à tout moment, et elle sera retirée sans délai.",
    },
  },
  photo: {
    v1: {
      version: "team-photo-v1",
      formRef: "team-profile-photo",
      texte:
        "J'accepte que ma photo soit affichée sur ma page publique. Sans cet accord, un avatar est affiché à la place. Je peux retirer cet accord à tout moment.",
    },
  },
  linkedin: {
    v1: {
      version: "team-linkedin-v1",
      formRef: "team-profile-linkedin",
      texte:
        "J'accepte que le lien vers mon profil LinkedIn soit affiché sur ma page publique. Je peux retirer cet accord à tout moment.",
    },
  },
} as const satisfies Record<TeamConsentKind, Record<string, TeamConsentVersion>>;

/** Version proposée aux nouvelles personnes, par consentement. */
export const TEAM_CONSENT_VERSION_COURANTE: Record<TeamConsentKind, TeamConsentVersion> = {
  publication: TEAM_CONSENT_VERSIONS.publication.v1,
  photo: TEAM_CONSENT_VERSIONS.photo.v1,
  linkedin: TEAM_CONSENT_VERSIONS.linkedin.v1,
};

/** Retrouve le texte exact d'une version enregistrée (preuve), ou `null` si elle est inconnue. */
export function texteConsentementParVersion(kind: TeamConsentKind, version: string): string | null {
  const versions = TEAM_CONSENT_VERSIONS[kind] as Record<string, TeamConsentVersion>;
  for (const v of Object.values(versions)) if (v.version === version) return v.texte;
  return null;
}
