/**
 * Le DRAPEAU de l'enregistrement des visios : `ferme | pilote | ouvert`
 * (chantier visio, ADR 0054 ; PR 5).
 *
 * ## Lu à l'EXÉCUTION, jamais au build
 *
 * Deux variables, `"true" | "false"`, absentes par défaut :
 *   · `ENREGISTREMENT_VISIO_PILOTE` — seules les rencontres du client fictif
 *     (`Rencontre.estTestInterne`) sont enregistrables ;
 *   · `ENREGISTREMENT_VISIO_OUVERT` — les rencontres de la liste blanche.
 *
 * Aucune des deux posée (ou une valeur mal saisie) : `ferme`, et toutes les
 * routes de l'enregistreur répondent 503. Rien à poser pour que la PR soit sûre.
 *
 * Les routes sont `force-dynamic` : `drapeau-runtime-jamais-fige-au-build`
 * reste vert (un drapeau lu par une route figée au build aurait DEUX valeurs).
 *
 * ## Ce fichier ne lit QUE ces deux variables (décision de Will du 29/09)
 *
 * L'ouverture n'attend plus le préavis aux clients actifs : `ouvert` est
 * `ouvert`, sans date. Le préavis protège les seuls clients ACTIFS (règle B3),
 * rencontre par rencontre, dans les routes `sessions` et `accord`
 * (`preavis-clients-actifs.ts`, 409 `client_actif_preavis_en_cours`).
 * Garde : `le-drapeau-ne-lit-que-ses-deux-variables.spec.ts`.
 *
 * `effectif` existe pour la PR 8 : elle y branchera `modeEffectif` (la notice
 * publique doit annoncer l'enregistrement avant que `ouvert` s'applique). Ici,
 * `effectif` vaut `demande`. La dictée annoncée (`DICTEE_ANNONCEE`) n'est PAS
 * déclarée ici : sa source unique est `src/content/visio-annonce.ts` (PR 8).
 *
 * Module PUR : lu par les routes, la console et le worker.
 */

export type ModeEnregistrement = "ferme" | "pilote" | "ouvert";

export const VARIABLE_PILOTE = "ENREGISTREMENT_VISIO_PILOTE";
export const VARIABLE_OUVERT = "ENREGISTREMENT_VISIO_OUVERT";

export interface LectureDrapeau {
  /** Ce que disent les variables. */
  readonly demande: ModeEnregistrement;
  /** Ce qui s'applique réellement (la PR 8 y branchera la notice publique). */
  readonly effectif: ModeEnregistrement;
  /** Pourquoi `effectif` diffère de `demande`, en français, ou `null`. */
  readonly motif: string | null;
}

type Env = Readonly<Record<string, string | undefined>>;

/** Lit le drapeau. L'argument ne sert qu'aux tests. */
export function lireDrapeauEnregistrement(env: Env = process.env): LectureDrapeau {
  const demande: ModeEnregistrement =
    env[VARIABLE_OUVERT] === "true"
      ? "ouvert"
      : env[VARIABLE_PILOTE] === "true"
        ? "pilote"
        : "ferme";
  return { demande, effectif: demande, motif: null };
}

/** Raccourci : le mode qui s'applique maintenant. */
export function modeEnregistrement(env: Env = process.env): ModeEnregistrement {
  return lireDrapeauEnregistrement(env).effectif;
}
