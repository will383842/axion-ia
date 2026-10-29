/**
 * Tour France IA : les paramètres d'adresse des pages de la console.
 *
 * Module PUR : une valeur venue de l'adresse n'est jamais crue sur parole.
 */

/** Une clé de ville de l'adresse : courte, sans caractère de contrôle ; sinon on l'ignore. */
export function villeDeLAdresse(v: string | undefined): string | null {
  if (v === undefined || v.length === 0 || v.length > 100) return null;
  return /^[\p{L}\p{N}?\- ]+$/u.test(v) ? v : null;
}
