/**
 * Échéances de mesure d'un contenu publié (conception § 7.2) : J3 et J7 pour l'indexation,
 * J7, J28 et J90 pour Search Console. Module PUR (ni base, ni réseau).
 */

export const ECHEANCES = [
  { code: "j3", jours: 3 },
  { code: "j7", jours: 7 },
  { code: "j28", jours: 28 },
  { code: "j90", jours: 90 },
] as const;
export type CodeEcheance = (typeof ECHEANCES)[number]["code"];

const JOUR_MS = 86_400_000;

/** Écart toléré pour qu'une inspection d'URL compte encore comme l'indexation « à J3 / J7 ». */
export const TOLERANCE_INDEXATION_JOURS = 2;

export const jourUtc = (d: Date): Date =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

export const ajouterJours = (d: Date, n: number): Date => new Date(d.getTime() + n * JOUR_MS);

/** Échéances échues et pas encore mesurées, de la plus proche à la plus lointaine. */
export function echeancesDues(
  publieLe: Date,
  dejaMesurees: ReadonlySet<string>,
  maintenant: Date,
): CodeEcheance[] {
  const aujourdhui = jourUtc(maintenant).getTime();
  const pub = jourUtc(publieLe);
  return ECHEANCES.filter(
    (e) => !dejaMesurees.has(e.code) && ajouterJours(pub, e.jours).getTime() <= aujourdhui,
  ).map((e) => e.code);
}

export const joursDe = (code: CodeEcheance): number =>
  ECHEANCES.find((e) => e.code === code)?.jours ?? 0;

/**
 * Fenêtre Search Console d'une échéance : du jour de publication (inclus) à `publication + N`
 * (exclu). La tâche n'écrit la ligne qu'une fois TOUS les jours de la fenêtre collectés
 * (journal `gsc_import_runs`) : Search Console a ~3 jours de retard, la mesure attend donc.
 */
export function fenetreGsc(code: CodeEcheance, publieLe: Date): { debut: Date; finExclue: Date } {
  const debut = jourUtc(publieLe);
  return { debut, finExclue: ajouterJours(debut, joursDe(code)) };
}

/**
 * L'indexation ne se lit qu'à J3 et J7. La rotation n'écrit une ligne d'inspection que quand un
 * champ change : la ligne la plus récente avant l'échéance (+ tolérance) donne l'état EN VIGUEUR à
 * l'échéance, même si elle date de plusieurs jours avant. Une ligne postérieure ne dit rien de J3.
 */
export function indexationMesurable(
  code: CodeEcheance,
  publieLe: Date,
  inspecteLe: Date | null,
): boolean {
  if ((code !== "j3" && code !== "j7") || !inspecteLe) return false;
  const echeance = ajouterJours(jourUtc(publieLe), joursDe(code));
  const ecart = (jourUtc(inspecteLe).getTime() - echeance.getTime()) / JOUR_MS;
  return ecart <= TOLERANCE_INDEXATION_JOURS;
}
