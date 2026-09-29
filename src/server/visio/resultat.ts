/**
 * Forme commune des réponses des fonctions de l'enregistreur. Les routes la
 * traduisent en `Response` ; les fonctions restent testables sans HTTP.
 */

export interface Resultat {
  readonly statut: number;
  readonly corps: Readonly<Record<string, unknown>>;
}

export function ok(corps: Readonly<Record<string, unknown>> = { ok: true }): Resultat {
  return { statut: 200, corps };
}

/** Une erreur : un code stable pour l'extension, un message en français pour Will. */
export function echec(
  statut: number,
  erreur: string,
  message: string,
  extra: Readonly<Record<string, unknown>> = {},
): Resultat {
  return { statut, corps: { erreur, message, ...extra } };
}
