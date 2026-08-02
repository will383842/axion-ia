/**
 * Date (ou période) de RÉALISATION de la prestation portée par une facture.
 *
 * ## Pourquoi cette mention, et pourquoi elle ne peut pas être la date d'émission
 *
 * L'article 242 nonies A de l'annexe II au CGI impose la date de réalisation de
 * la prestation dès lors qu'elle diffère de la date d'émission. Aucun des
 * producteurs de facture ne la calculait : le gabarit retombait sur
 * `dateEmission`, si bien qu'une facture émise le lendemain de la session
 * affirmait que la prestation avait eu lieu ce jour-là.
 *
 * 🔴 Constaté sur AXI-FACT-2026-001 : « Date de réalisation : 01/08/2026 » pour
 * une journée tenue le 31/07 — en contradiction avec la convention,
 * l'émargement et l'attestation du MÊME dossier. Deux pièces qui se
 * contredisent sur la date d'exécution, c'est ce qu'un contrôle relève en
 * premier, et ce qui fait douter de la réalité de l'action.
 *
 * La source est la SESSION, jamais l'horloge : c'est elle qui porte les dates
 * de l'action, et c'est elle que recoupent les autres pièces.
 */

/**
 * Format court fr-FR, ou `null` si ce n'est pas une date exploitable.
 *
 * ⚠️ Défensif à dessein. Le schéma déclare `dateDebut`/`dateFin` NOT NULL, mais
 * un appelant qui restreint son `select` — ou un `Invalid Date` venu d'un import
 * — ferait ici lever `toLocaleDateString`, et l'exception remonterait jusqu'à
 * faire ÉCHOUER L'ÉMISSION DE LA FACTURE. Aucune mention accessoire ne justifie
 * de faire tomber la pièce entière : on l'omet, le gabarit retombe sur la date
 * d'émission, et la facture sort.
 */
function jour(d: unknown): string | null {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("fr-FR");
}

/**
 * « 31/07/2026 » pour une session d'un jour, « du 31/07/2026 au 02/08/2026 »
 * sinon. `undefined` quand la facture n'est rattachée à aucune session (facture
 * libre) ou que les dates sont inexploitables : le gabarit retombe alors sur la
 * date d'émission — on n'invente pas une date d'exécution qu'on ne connaît pas.
 */
export function periodePrestationSession(
  session: { dateDebut?: Date | null; dateFin?: Date | null } | null | undefined,
): string | undefined {
  if (!session) return undefined;
  const debut = jour(session.dateDebut);
  const fin = jour(session.dateFin);
  if (debut === null || fin === null) return undefined;
  return debut === fin ? debut : `du ${debut} au ${fin}`;
}
