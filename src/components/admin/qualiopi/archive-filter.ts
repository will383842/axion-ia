/**
 * Admin — Qualiopi · Filtrage des lignes archivées dans les listes.
 *
 * POURQUOI
 * --------
 * Les listes `qualiopi/formations` et `qualiopi/offres` affichaient TOUTES les
 * lignes d'un bloc, archives comprises : 57 formations (22 vivantes + 35
 * archivées) et 67 offres (26 actives + 41 inactives). C'est ce qui donnait
 * l'impression d'un référentiel encombré alors que la base est saine.
 *
 * Décision Will (2026-07-24) : les archives sont **masquées de l'interface**,
 * sans onglet ni compteur — la console ne montre que le travail courant.
 *
 * Elles ne sont PAS supprimées de la base, pour deux raisons :
 *
 *   1. Elles portent l'historique légal (sessions, conventions, attestations,
 *      factures — conservation 5 ans). `Formation` est d'ailleurs protégée par
 *      `onDelete: Restrict` côté `TrainingSession`.
 *   2. La numérotation `AXI-FORM-YYYY-NNN` est allouée par `count() + 1`
 *      (`allocateFormationNumero`). Supprimer des lignes fait RECULER le
 *      compteur : avec 57 formations numérotées 001→057, en retirer 34 ferait
 *      viser `…-024`, déjà pris → violation d'unicité. Et `withNumberRetry`
 *      recalcule le même `count()` à chaque tentative → plus AUCUNE formation
 *      créable. Toute suppression exigerait de passer d'abord la numérotation
 *      en `max(numero) + 1`.
 *
 * Échappatoire volontairement NON exposée dans l'interface : `?vue=toutes` (ou
 * `?vue=archivees`) reste accepté sur ces deux pages. Une formation archivée
 * peut encore porter une session en cours (cas réel `AXI-FORM-2026-018`) ; on ne
 * veut pas la rendre définitivement inatteignable depuis la console.
 */

/** Vue demandée. `actives` est le défaut — et le seul état atteignable par clic. */
export type ArchiveFilter = "actives" | "archivees" | "toutes";

/** Nom du paramètre d'URL (non exposé dans l'interface). */
export const ARCHIVE_FILTER_PARAM = "vue";

/**
 * Normalise le paramètre d'URL. Toute valeur inattendue — absente, vide, casse
 * différente, forgée à la main, ou dupliquée (`?vue=a&vue=b` → tableau) —
 * retombe sur `actives` : la vue par défaut n'expose jamais les archives.
 */
export function parseArchiveFilter(raw: string | string[] | undefined): ArchiveFilter {
  const v = typeof raw === "string" ? raw : undefined;
  return v === "archivees" || v === "toutes" ? v : "actives";
}

/**
 * Applique la vue à une liste déjà séparée en vivantes / archivées.
 * Générique : sert aux formations comme aux offres.
 */
export function applyArchiveFilter<T>(
  vue: ArchiveFilter,
  vivantes: ReadonlyArray<T>,
  archivees: ReadonlyArray<T>,
): ReadonlyArray<T> {
  if (vue === "archivees") return archivees;
  if (vue === "toutes") return [...vivantes, ...archivees];
  return vivantes;
}
