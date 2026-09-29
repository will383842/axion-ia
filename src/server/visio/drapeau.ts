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
 * (`visio-annonce.ts` pour la règle, `preavis-clients-actifs.ts` pour la
 * lecture ; 409 `client_actif_preavis_en_cours`).
 * Garde : `le-drapeau-ne-lit-que-ses-deux-variables.spec.ts`.
 *
 * `effectif` passe par `modeEffectif` (`./ouverture.ts`, PR 8, anti-doublon
 * D2) : `ouvert` n'est effectif que si la notice publique annonce
 * l'enregistrement (`ANNONCE_VISIO_ACTIVE`, `visio-annonce.ts`) ; sinon il vaut
 * `pilote`. Aucune règle d'ouverture n'est recodée ici (garde
 * `le-drapeau-ouvert-attend-la-notice-publique.spec.ts`). La dictée annoncée
 * (`DICTEE_ANNONCEE`) n'est PAS déclarée ici : sa source unique est
 * `src/server/visio/visio-annonce.ts`.
 *
 * Module PUR : lu par les routes, la console et le worker.
 */

import { modeEffectif } from "./ouverture";

export type ModeEnregistrement = "ferme" | "pilote" | "ouvert";

export const VARIABLE_PILOTE = "ENREGISTREMENT_VISIO_PILOTE";
export const VARIABLE_OUVERT = "ENREGISTREMENT_VISIO_OUVERT";

export interface LectureDrapeau {
  /** Ce que disent les variables. */
  readonly demande: ModeEnregistrement;
  /** Ce qui s'applique réellement : `modeEffectif` (notice publique, `ouverture.ts`). */
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
  const { mode, motif } = modeEffectif(demande);
  return { demande, effectif: mode, motif };
}

/** Raccourci : le mode qui s'applique maintenant. */
export function modeEnregistrement(env: Env = process.env): ModeEnregistrement {
  return lireDrapeauEnregistrement(env).effectif;
}
