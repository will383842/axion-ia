/**
 * Chantier QNC, lot L08 — LE SEUIL DE RÉUSSITE UNIQUE. Module PUR (ni Prisma, ni horloge).
 *
 * ## Ce que le lot corrige
 *
 * Le seuil de réussite se lisait au moment de l'évaluation, dans le réglage
 * `seuil_reussite_pct`. Changer le réglage en cours de route changeait donc le
 * verdict d'une session déjà commencée : deux stagiaires de la même session
 * pouvaient être jugés selon deux seuils. Pour l'auditeur (ind. 11), le critère
 * de réussite annoncé au stagiaire doit être celui qui lui est appliqué.
 *
 * Le seuil est donc FIGÉ dans la session au moment de sa création. Il vit dans
 * `TrainingSession.formationSnapshot` (clé `seuilReussitePct`) : le snapshot
 * légal existe déjà pour la même raison, et aucune migration n'est nécessaire.
 * Les évaluations passées ne sont jamais recalculées : leur `reussite` est déjà
 * écrite en base.
 *
 * ## Règle « aucun objectif non acquis »
 *
 * Un score moyen de 78 % peut cacher un objectif noté « non acquis » (1/3).
 * Quand la règle est active, la réussite exige le seuil ET aucun objectif noté 1.
 * Un objectif laissé sans note n'est pas un « non acquis » (F22) : il est signalé
 * ailleurs, jamais compté comme un échec.
 */

export const SEUIL_REUSSITE_DEFAUT_PCT = 70;

export type SourceSeuil = "session" | "reglage" | "defaut";

function estSeuilValide(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 100;
}

/** Le seuil figé dans le snapshot d'une session, ou `null` (session antérieure au lot). */
export function lireSeuilFige(snapshot: unknown): number | null {
  if (snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) return null;
  const v = (snapshot as { seuilReussitePct?: unknown }).seuilReussitePct;
  return estSeuilValide(v) ? v : null;
}

/**
 * Pose le seuil dans le snapshot d'une session qui se crée. Ne modifie pas
 * l'argument. Un seuil déjà figé n'est jamais écrasé.
 */
export function figerSeuilDansSnapshot<T extends object>(
  snapshot: T,
  seuilPct: number,
): T & { seuilReussitePct: number } {
  if (lireSeuilFige(snapshot) !== null) return snapshot as T & { seuilReussitePct: number };
  const pct = estSeuilValide(seuilPct) ? seuilPct : SEUIL_REUSSITE_DEFAUT_PCT;
  return { ...snapshot, seuilReussitePct: pct };
}

/** Le seuil qui s'applique : la session d'abord, puis le réglage, puis 70 %. */
export function resoudreSeuil(entree: { snapshot: unknown; reglagePct: number }): {
  pct: number;
  source: SourceSeuil;
} {
  const fige = lireSeuilFige(entree.snapshot);
  if (fige !== null) return { pct: fige, source: "session" };
  if (estSeuilValide(entree.reglagePct)) return { pct: entree.reglagePct, source: "reglage" };
  return { pct: SEUIL_REUSSITE_DEFAUT_PCT, source: "defaut" };
}

export interface VerdictReussite {
  reussite: boolean;
  /** Libellés des objectifs notés « non acquis » (note 1), dans l'ordre de saisie. */
  objectifsNonAcquis: string[];
}

export function verdictReussite(entree: {
  scorePct: number;
  competences: ReadonlyArray<{ libelle: string; note?: 1 | 2 | 3 }>;
  seuilPct: number;
  /** La règle « aucun objectif non acquis » s'applique-t-elle ? */
  aucunNonAcquis: boolean;
}): VerdictReussite {
  const objectifsNonAcquis = entree.aucunNonAcquis
    ? entree.competences.filter((c) => c.note === 1).map((c) => c.libelle)
    : [];
  const reussite = entree.scorePct >= entree.seuilPct && objectifsNonAcquis.length === 0;
  return { reussite, objectifsNonAcquis };
}
