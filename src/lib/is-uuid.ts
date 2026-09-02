/**
 * Un identifiant a-t-il la forme d'un UUID ?
 *
 * 2026-09-02 — audit UI de la console : `/kb-readonly/<slug>` (et donc
 * `/connaissances/<slug>/apercu`) plantait en erreur serveur (React #441,
 * bandeau « incident signalé ») parce que l'action `getEntryAction` valide
 * `z.string().uuid()` et lève une ZodError sur un slug. Un identifiant mal
 * formé est un 404, pas un incident. Colonne Prisma `@db.Uuid` : Postgres
 * rejetterait de toute façon la valeur.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
