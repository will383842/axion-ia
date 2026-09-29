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
 * ## `ouvert` attend la fin du préavis
 *
 * Le préavis aux clients actifs (décision B3, PR 1) fixe la date d'ouverture :
 * tant que `PREAVIS_SOUS_TRAITANTS` vaut `null`, ou que sa fin n'est pas
 * atteinte, `ouvert` se comporte comme `pilote`. La PR 8 pose la date réelle
 * d'envoi relevée dans `email_outbox`. Test
 * `avant-la-pr8-ouvert-vaut-pilote.spec.ts`.
 *
 * Module PUR : lu par les routes, la console et le worker.
 */

export type ModeEnregistrement = "ferme" | "pilote" | "ouvert";

/** Posé par la PR 8 : `{ envoyeLe, finLe }` en ISO 8601. `null` = pas de préavis envoyé. */
export const PREAVIS_SOUS_TRAITANTS: { readonly envoyeLe: string; readonly finLe: string } | null =
  null;

/** La dictée après l'appel (B5) n'est pas encore annoncée aux clients (PR 7-8). */
export const DICTEE_ANNONCEE = false;

export const VARIABLE_PILOTE = "ENREGISTREMENT_VISIO_PILOTE";
export const VARIABLE_OUVERT = "ENREGISTREMENT_VISIO_OUVERT";

export interface LectureDrapeau {
  /** Ce que disent les variables. */
  readonly demande: ModeEnregistrement;
  /** Ce qui s'applique réellement (`ouvert` avant la fin du préavis → `pilote`). */
  readonly effectif: ModeEnregistrement;
  /** Pourquoi `effectif` diffère de `demande`, en français, ou `null`. */
  readonly motif: string | null;
}

type Env = Readonly<Record<string, string | undefined>>;
type Preavis = { readonly envoyeLe: string; readonly finLe: string } | null;

/** Lit le drapeau. Les arguments ne servent qu'aux tests. */
export function lireDrapeauEnregistrement(
  env: Env = process.env,
  maintenant: Date = new Date(),
  preavis: Preavis = PREAVIS_SOUS_TRAITANTS,
): LectureDrapeau {
  const demande: ModeEnregistrement =
    env[VARIABLE_OUVERT] === "true"
      ? "ouvert"
      : env[VARIABLE_PILOTE] === "true"
        ? "pilote"
        : "ferme";

  if (demande !== "ouvert") return { demande, effectif: demande, motif: null };

  if (preavis === null) {
    return {
      demande,
      effectif: "pilote",
      motif:
        "Le préavis aux clients n'a pas encore été envoyé : l'enregistrement reste limité au rendez-vous de test.",
    };
  }
  const fin = Date.parse(preavis.finLe);
  if (!Number.isFinite(fin) || maintenant.getTime() < fin) {
    return {
      demande,
      effectif: "pilote",
      motif: `Le préavis aux clients court jusqu'au ${preavis.finLe.slice(0, 10)} : l'enregistrement reste limité au rendez-vous de test.`,
    };
  }
  return { demande, effectif: "ouvert", motif: null };
}

/** Raccourci : le mode qui s'applique maintenant. */
export function modeEnregistrement(
  env: Env = process.env,
  maintenant: Date = new Date(),
): ModeEnregistrement {
  return lireDrapeauEnregistrement(env, maintenant).effectif;
}
