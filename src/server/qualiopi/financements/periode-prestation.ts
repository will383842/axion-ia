/**
 * Qualiopi — Date (ou période) de réalisation de la prestation facturée.
 *
 * Mention obligatoire dès qu'elle diffère de la date d'émission
 * (art. 242 nonies A CGI) — c'est-à-dire presque toujours, une facture partant
 * après la formation.
 *
 * 🔴 Aucun émetteur ne la transmettait : le gabarit retombait sur son défaut, la
 * date d'émission. La première facture réelle (`AXI-FACT-2026-001`) déclarait
 * ainsi une prestation exécutée le 01/08 pour une formation tenue le 31/07.
 *
 * Logique PURE — la lecture en base vit chez l'appelant.
 */

/** Format des dates sur les pièces (fr-FR, comme le reste des gabarits). */
function jour(d: Date): string {
  return d.toLocaleDateString("fr-FR");
}

/**
 * Rend « 31/07/2026 » pour une session d'un jour, « du 31/07/2026 au
 * 02/08/2026 » sinon, et `null` quand les dates sont inconnues (facture libre
 * sans session rattachée) — l'appelant omet alors la ligne.
 */
export function periodePrestationSession(
  dateDebut: Date | string | null | undefined,
  dateFin: Date | string | null | undefined,
): string | null {
  if (dateDebut == null) return null;
  const debut = new Date(dateDebut);
  if (Number.isNaN(debut.getTime())) return null;

  const fin = dateFin != null ? new Date(dateFin) : debut;
  if (Number.isNaN(fin.getTime())) return jour(debut);

  const debutFr = jour(debut);
  const finFr = jour(fin);
  return debutFr === finFr ? debutFr : `du ${debutFr} au ${finFr}`;
}
