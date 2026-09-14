/**
 * LECTURE du questionnaire de positionnement — la seule traduction du JSON
 * `Questionnaire.reponses` vers ce qu'on montre.
 *
 * 🔴 Constats C2-03 / I10-02 (audit initial Qualiopi, 2026-09-14). Le portail
 * (`PositionnementPortailForm`) écrit attentes, tâche visée, fonction, outils,
 * niveau par objectif et « besoin d'adaptation » oui/non. AUCUN écran ni export
 * de la console ne relisait ces réponses : la fiche session n'en montrait que
 * « Répondu » et une date, et le dossier d'audit présentait aux indicateurs 4 et
 * 8 le gabarit VIERGE. L'absence de besoin d'adaptation doit pourtant être
 * « documentée via le positionnement » (indicateur 10).
 *
 * 🔑 L'écran de session et la pièce nominative du dossier lisent CETTE fonction.
 * Deux lectures du même JSON finiraient par dire deux choses différentes.
 *
 * ⚠️ Module PUR : aucun import. Il ne doit rien inventer — une question qui n'a
 * pas été posée se lit `null` (« Non renseigné », ou « Non posée » pour une
 * saisie par l'organisme), jamais « non ».
 */

/** Échelle du portail — identique à la grille d'évaluation (1..3). */
export const LIBELLES_NIVEAU_POSITIONNEMENT: Readonly<Record<1 | 2 | 3, string>> = {
  1: "Je découvre",
  2: "Quelques notions",
  3: "Je maîtrise",
};

export interface NiveauDeclare {
  readonly objectif: string;
  /** `null` quand la valeur est absente ou hors barème. */
  readonly niveau: 1 | 2 | 3 | null;
  readonly libelle: string;
}

export interface PositionnementLu {
  readonly fonction: string | null;
  readonly secteur: string | null;
  readonly outilsUtilises: string | null;
  readonly frequenceUsage: string | null;
  readonly attentes: string | null;
  readonly tacheVisee: string | null;
  readonly niveaux: readonly NiveauDeclare[];
  /**
   * `true` / `false` : la stagiaire a répondu (case cochée ou non).
   * `null` : la question n'a PAS été posée — typiquement une saisie par
   * l'organisme. Ne jamais la lire comme « aucun besoin ».
   */
  readonly besoinAdaptation: boolean | null;
  readonly detailAdaptation: string | null;
  /** Réponses saisies par l'organisme à la place du ou de la stagiaire. */
  readonly saisieAdmin: boolean;
}

function texte(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const t = valeur.trim();
  return t === "" ? null : t;
}

function niveauDeclare(objectif: string, valeur: unknown): NiveauDeclare {
  if (valeur === 1 || valeur === 2 || valeur === 3) {
    return { objectif, niveau: valeur, libelle: LIBELLES_NIVEAU_POSITIONNEMENT[valeur] };
  }
  if (valeur === null || valeur === undefined || valeur === "") {
    return { objectif, niveau: null, libelle: "Non renseigné" };
  }
  // Une valeur hors barème se DIT : la faire disparaître laisserait croire que
  // l'objectif n'a pas été évalué.
  return { objectif, niveau: null, libelle: `Valeur hors barème (${String(valeur)})` };
}

export function lirePositionnement(reponses: unknown): PositionnementLu {
  const r: Record<string, unknown> =
    typeof reponses === "object" && reponses !== null && !Array.isArray(reponses)
      ? (reponses as Record<string, unknown>)
      : {};

  const brutsNiveaux = r["niveauParObjectif"];
  const niveaux =
    typeof brutsNiveaux === "object" && brutsNiveaux !== null && !Array.isArray(brutsNiveaux)
      ? Object.entries(brutsNiveaux as Record<string, unknown>)
          .filter(([objectif]) => objectif.trim() !== "")
          .map(([objectif, valeur]) => niveauDeclare(objectif, valeur))
      : [];

  const besoin = r["besoinAdaptation"];
  const saisieAdmin = r["saisie_admin"] === true;

  return {
    fonction: texte(r["fonction"]),
    secteur: texte(r["secteur"]),
    outilsUtilises: texte(r["outilsUtilises"]),
    frequenceUsage: texte(r["frequenceUsage"]),
    attentes: texte(r["attentes"]),
    tacheVisee: texte(r["tacheVisee"]),
    niveaux,
    // Même règle que l'indicateur 10 (PR 1083) : la saisie par l'organisme ne
    // pose pas la question. Un booléen qui s'y trouverait n'est pas la réponse
    // du bénéficiaire, et ne doit jamais s'afficher comme telle.
    besoinAdaptation: saisieAdmin ? null : typeof besoin === "boolean" ? besoin : null,
    detailAdaptation: saisieAdmin ? null : texte(r["detailAdaptation"]),
    saisieAdmin,
  };
}

/**
 * « Oui » / « Non » / « Non renseigné » / « Non posée (saisie par l'organisme) »
 * — le même mot à l'écran et sur la pièce.
 */
export function libelleBesoinAdaptation(besoin: boolean | null, saisieAdmin = false): string {
  if (saisieAdmin) return "Non posée (saisie par l'organisme)";
  if (besoin === null) return "Non renseigné";
  return besoin ? "Oui" : "Non";
}

/**
 * Situe la réponse par rapport au début de la session. Un instant égal au début
 * compte « avant », comme dans la règle de l'indicateur 10.
 */
export function chronologieReponse(reponduAt: Date, debutSession: Date): string {
  return reponduAt.getTime() <= debutSession.getTime()
    ? "avant le début de la session"
    : "après le début de la session";
}

/** Date et heure de Paris : ce que l'auditrice compare au début de la session. */
export function formaterInstantParis(instant: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  }).format(instant);
}
