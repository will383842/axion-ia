/**
 * Qualiopi — ce que le rattrapage des autofactures ÉCRIT quand il échoue, et
 * quand l'alerte doit le dire.
 *
 * Module PUR (aucune lecture, aucun import lourd) : il est partagé par le cron
 * (`autofacture-rattrapage.ts`), qui écrit la trace, et par le moteur d'alertes
 * (`alertes/evaluateur.ts`), qui la lit. Une constante recopiée des deux côtés
 * divergerait au premier renommage, et l'alerte se tairait pour toujours sur un
 * journal qu'elle ne sait plus nommer.
 *
 * ── LES DEUX FAMILLES D'ÉCHEC ────────────────────────────────────────────────
 *
 *   · REFUS MÉTIER ATTENDU — la fiche du formateur est incomplète (SIRET, TVA,
 *     adresse, mandat). Il se répète à chaque passage, c'est voulu : il ne se
 *     rattrape que par une saisie. L'alerte `autofacture_a_emettre` en porte
 *     déjà la liste complète. Rien n'est journalisé ici.
 *   · ÉCHEC NON COUVERT — le relevé est éligible, et pourtant rien ne sort :
 *     panne technique (numéro, PDF, écriture, exception), ou anomalie du relevé
 *     lui-même (aucune ligne d'honoraires, montant incohérent). Aucune autre
 *     surface ne le voit. Chaque passage laisse une ligne de journal, et
 *     l'alerte se lève quand l'échec SE RÉPÈTE.
 *
 * ⚠️ « Se répète » et non « a eu lieu une fois » : un Redis indisponible pendant
 * une minute fait échouer un passage, et le suivant émet. Alerter sur ce bruit
 * apprendrait à ignorer l'alerte. Deux passages horaires ratés, c'est une panne.
 */

/** Action de journal d'un échec non couvert du rattrapage (`adminUserId: null`). */
export const ACTION_JOURNAL_ECHEC_RATTRAPAGE_AUTOFACTURE = "qualiopi.autofacture.rattrapage.echec";

/** Fenêtre dans laquelle on compte les échecs. Le cron est horaire. */
export const FENETRE_ECHECS_RATTRAPAGE_MS = 24 * 60 * 60_000;

/** À partir de combien d'échecs dans la fenêtre l'alerte se lève. */
export const SEUIL_ECHECS_RATTRAPAGE = 2;

/** Les codes d'échec que le cron JOURNALISE (jamais `ineligible`). */
export type CodeEchecRattrapage = "sans_lignes" | "montant_incoherent" | "technique";

/** Longueur maximale du détail technique conservé au journal. */
export const LONGUEUR_DETAIL_ECHEC = 300;

export interface JournalEchecRattrapage {
  readonly targetId: string | null;
  readonly createdAt: Date;
  readonly changes: unknown;
}

export interface EchecRepete {
  readonly nombre: number;
  readonly dernierAt: Date;
  readonly code: CodeEchecRattrapage | null;
  readonly motif: string | null;
}

/**
 * L'échec répété d'un relevé, ou `null` s'il n'y a pas lieu d'alerter.
 *
 * 🔑 Borné par la fenêtre ET par le seuil. Les lignes hors fenêtre ne comptent
 * pas : un relevé qui a échoué la semaine dernière, puis a été corrigé et
 * n'échoue plus, ne doit pas rester signalé.
 */
export function echecRepeteRattrapage(
  journaux: readonly JournalEchecRattrapage[],
  statementId: string,
  now: Date,
): EchecRepete | null {
  const depuis = now.getTime() - FENETRE_ECHECS_RATTRAPAGE_MS;
  const siens = journaux
    .filter((j) => j.targetId === statementId && j.createdAt.getTime() >= depuis)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  if (siens.length < SEUIL_ECHECS_RATTRAPAGE) return null;
  const dernier = siens[0] as JournalEchecRattrapage;
  const changes = (dernier.changes ?? {}) as { code?: unknown; motif?: unknown };
  const code =
    changes.code === "sans_lignes" ||
    changes.code === "montant_incoherent" ||
    changes.code === "technique"
      ? changes.code
      : null;
  return {
    nombre: siens.length,
    dernierAt: dernier.createdAt,
    code,
    motif: typeof changes.motif === "string" && changes.motif !== "" ? changes.motif : null,
  };
}
