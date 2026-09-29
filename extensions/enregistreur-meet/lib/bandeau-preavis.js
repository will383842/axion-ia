// Le BANDEAU du préavis (décision de Will du 29/09) — fonction PURE.
//
// Un client ACTIF dont le préavis court ne s'enregistre pas : le site le dit
// dans la liste du jour (`preavis`) et refuse `POST sessions` (409
// `client_actif_preavis_en_cours`). Le panneau l'annonce AVANT le démarrage,
// avec la date, et désactive « Démarrer » : Will prend ses notes à la main.

/**
 * Le texte du bandeau pour cette rencontre, ou `null` si elle n'est pas concernée.
 * @param {{ preavis?: { finLe: string | null } | null } | null | undefined} rencontre
 */
export function bandeauPreavis(rencontre) {
  const p = rencontre?.preavis;
  if (!p) return null;
  if (!p.finLe) {
    return "Pas d'enregistrement pour ce client : le préavis aux clients actifs n'est pas encore envoyé. Notes à la main.";
  }
  const date = new Date(p.finLe).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  return `Pas d'enregistrement pour ce client avant le ${date} : notes à la main.`;
}
