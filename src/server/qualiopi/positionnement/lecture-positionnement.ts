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
 * Trois formes RÉELLES existent en base (relectures de la PR 1090) :
 *   1. portail depuis le 2026-08-20 : `portail.ts` retire `detailAdaptation`
 *      du JSON, sans y laisser de marqueur, et le chiffre sur la fiche stagiaire ;
 *   2. portail du 2026-07-26 au 2026-08-20 : le détail y est encore EN CLAIR ;
 *   3. saisie console (`QuestionnairesSection`) : `objectifs_atteints`,
 *      `points_forts`, `axes_amelioration`, `commentaire`, `saisie_admin: true`.
 *
 * 🔴 La précision d'un besoin d'adaptation est une donnée de santé (RGPD art. 9) :
 * lecture réservée au super-administrateur et journalisée (`portail.ts`). Ce
 * module n'en restitue JAMAIS le contenu, ni en clair ni déchiffré.
 *
 * 🔑 RÈGLE DE PROVENANCE. Une précision n'est attribuée au questionnaire que si
 * la RÉPONSE elle-même en garde la trace (forme 2). La colonne chiffrée de la
 * fiche stagiaire ne décide rien ici : elle est aussi écrite par la déclaration
 * de handicap du portail et par la console, jamais remise à zéro, et peut venir
 * d'une session antérieure. Elle se signale À PART, par une mention neutre
 * (`MENTION_PRECISION_FICHE_STAGIAIRE`), jamais au nom du questionnaire — et
 * UNIQUEMENT à l'écran de la console : jamais sur une pièce du dossier d'audit,
 * qui révélerait sans nécessité l'existence d'un détail de santé.
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

/** Libellé de la ligne « Précision », quand la réponse atteste qu'une précision a été saisie. */
export const PRECISION_DANS_LA_REPONSE =
  "Précision fournie dans la réponse — non reproduite ici (donnée de santé)";

/**
 * Mention NEUTRE, affichée hors des réponses, quand la fiche stagiaire porte un
 * détail chiffré : elle n'affirme rien au nom du questionnaire. Écran de la
 * console SEULEMENT — jamais sur une pièce ni dans le ZIP du dossier d'audit.
 */
export const MENTION_PRECISION_FICHE_STAGIAIRE =
  "Une précision sur les besoins d'adaptation peut figurer sur la fiche du stagiaire (consultation réservée au super-administrateur).";

export interface NiveauDeclare {
  readonly objectif: string;
  /** `null` quand la valeur est absente ou hors barème. */
  readonly niveau: 1 | 2 | 3 | null;
  readonly libelle: string;
}

/** Les quatre champs qu'écrit le formulaire de saisie de la console. */
export interface ContenuSaisiParOrganisme {
  readonly objectifsAtteints: string | null;
  readonly pointsForts: string | null;
  readonly axesAmelioration: string | null;
  readonly commentaire: string | null;
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
  /**
   * La RÉPONSE atteste qu'une précision a été saisie (détail encore présent
   * dans le JSON, réponses antérieures au 2026-08-20). Jamais son contenu.
   * `false` ne veut PAS dire « aucune précision » : depuis le 2026-08-20, le
   * détail est retiré de la réponse sans marqueur.
   */
  readonly precisionDansLaReponse: boolean;
  /** Réponses saisies par l'organisme à la place du ou de la stagiaire. */
  readonly saisieAdmin: boolean;
  /** Ce que l'organisme a saisi (tous `null` pour une réponse du portail). */
  readonly saisieOrganisme: ContenuSaisiParOrganisme;
}

function texte(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  const t = valeur.trim();
  return t === "" ? null : t;
}

function objet(reponses: unknown): Record<string, unknown> {
  return typeof reponses === "object" && reponses !== null && !Array.isArray(reponses)
    ? (reponses as Record<string, unknown>)
    : {};
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

/**
 * Saisie par l'organisme et non réponse du stagiaire. Même critère que la règle
 * de l'indicateur 10 (PR 1083) : `saisie_admin: true`.
 */
export function estSaisieOrganisme(reponses: unknown): boolean {
  return objet(reponses)["saisie_admin"] === true;
}

export function lirePositionnement(reponses: unknown): PositionnementLu {
  const r = objet(reponses);

  const brutsNiveaux = r["niveauParObjectif"];
  const niveaux =
    typeof brutsNiveaux === "object" && brutsNiveaux !== null && !Array.isArray(brutsNiveaux)
      ? Object.entries(brutsNiveaux as Record<string, unknown>)
          .filter(([objectif]) => objectif.trim() !== "")
          .map(([objectif, valeur]) => niveauDeclare(objectif, valeur))
      : [];

  const besoin = r["besoinAdaptation"];
  const saisieAdmin = estSaisieOrganisme(r);
  // Même règle que l'indicateur 10 (PR 1083) : la saisie par l'organisme ne
  // pose pas la question. Un booléen qui s'y trouverait n'est pas la réponse
  // du bénéficiaire, et ne doit jamais s'afficher comme telle.
  const besoinAdaptation = saisieAdmin ? null : typeof besoin === "boolean" ? besoin : null;

  // 🔴 Seule la PRÉSENCE du détail est lue : sa valeur ne sort pas d'ici.
  const detailBrut = r["detailAdaptation"];
  const detailEnClairPresent = typeof detailBrut === "string" && detailBrut.trim() !== "";

  return {
    fonction: texte(r["fonction"]),
    secteur: texte(r["secteur"]),
    outilsUtilises: texte(r["outilsUtilises"]),
    frequenceUsage: texte(r["frequenceUsage"]),
    attentes: texte(r["attentes"]),
    tacheVisee: texte(r["tacheVisee"]),
    niveaux,
    besoinAdaptation,
    precisionDansLaReponse: besoinAdaptation === true && detailEnClairPresent,
    saisieAdmin,
    saisieOrganisme: {
      objectifsAtteints: texte(r["objectifs_atteints"]),
      pointsForts: texte(r["points_forts"]),
      axesAmelioration: texte(r["axes_amelioration"]),
      commentaire: texte(r["commentaire"]),
    },
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
 * La réponse précède-t-elle le début de la session ? Un instant égal au début
 * compte « avant », comme dans la règle de l'indicateur 10 (PR 1083).
 */
export function reponseAvantDebut(reponduAt: Date, debutSession: Date): boolean {
  return reponduAt.getTime() <= debutSession.getTime();
}

/** Situe la réponse par rapport au début de la session (même prédicat). */
export function chronologieReponse(reponduAt: Date, debutSession: Date): string {
  return reponseAvantDebut(reponduAt, debutSession)
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
