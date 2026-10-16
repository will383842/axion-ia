/**
 * Formateurs indépendants — LE JOUR OÙ TOUT ÉTAIT COMPLET pour un mois de mission
 * (vérification 2, V2-A-5).
 *
 * Lettre de mission v3 : « s'ils sont remis plus tard, le délai court à partir de leur
 * remise ». Les pièces dues par le formateur sont ses feuilles contresignées du mois et,
 * pour le DERNIER mois de la session, son bilan de fin de formation (ou la décision de
 * le payer quand même). Le jour où la dernière de ces pièces est arrivée fait courir le
 * délai de 30 jours ; le jour où Axion clique pour émettre l'autofacture, jamais.
 *
 * Lu à l'émission seulement. Lecture en échec, ou aucune feuille du mois : `null`, et
 * l'émission garde la règle de la date de la pièce (rien d'inventé).
 *
 * Sans `server-only` : appelé aussi depuis le worker (sous `tsx`).
 */

import { ajouterJours, jourDeColonneDate, jourParis, type JourCivil } from "../argent/dates";
import { PARAMETRES_ARGENT_FORMATEURS } from "../argent/parametres";

/** Pur : le plus tard des jours de remise ; `null` sans aucune feuille du mois. */
export function jourOuToutEtaitComplet(e: {
  /** Instants des contresignatures du formateur sur ce mois de la session. */
  readonly feuilles: ReadonlyArray<Date>;
  /** Bilan (ou « payer quand même ») — seulement si le mois est le dernier de la session. */
  readonly bilan: Date | null;
}): JourCivil | null {
  if (e.feuilles.length === 0) return null;
  const jours = [...e.feuilles, ...(e.bilan ? [e.bilan] : [])].map((d) => jourParis(d)).sort();
  return jours.at(-1)!;
}

/** Le strict nécessaire d'un client Prisma. */
export interface ClientJourComplet {
  trainerStatement: { findUnique(a: unknown): Promise<unknown> };
  emargementContresignature: { findMany(a: unknown): Promise<Array<{ signeAt: Date }>> };
  bilanFinFormation: {
    findUnique(
      a: unknown,
    ): Promise<{ termineAt: Date | null; payerQuandMemeAt: Date | null } | null>;
  };
}

/**
 * La date limite au plus tard d'un relevé de mission : le jour où tout était complet
 * + 30 jours. `null` si elle ne se lit pas (l'appelant garde sa règle).
 */
export async function echeanceDuJourComplet(
  db: ClientJourComplet,
  statementId: string,
): Promise<JourCivil | null> {
  try {
    const r = (await db.trainerStatement.findUnique({
      where: { id: statementId },
      select: {
        trainerId: true,
        sessionId: true,
        periodeYear: true,
        periodeMonth: true,
        session: { select: { jours: { select: { date: true } } } },
      },
    })) as {
      trainerId: string;
      sessionId: string | null;
      periodeYear: number;
      periodeMonth: number;
      session: { jours: Array<{ date: Date }> } | null;
    } | null;
    if (r === null || r.sessionId === null) return null;
    const debut = new Date(Date.UTC(r.periodeYear, r.periodeMonth - 1, 1));
    const fin = new Date(Date.UTC(r.periodeYear, r.periodeMonth, 1));
    const feuilles = await db.emargementContresignature.findMany({
      where: {
        trainerId: r.trainerId,
        sessionId: r.sessionId,
        revokedAt: null,
        date: { gte: debut, lt: fin },
      },
      select: { signeAt: true },
    });
    const mois = `${r.periodeYear}-${String(r.periodeMonth).padStart(2, "0")}`;
    const derniereJournee = (r.session?.jours ?? [])
      .map((j) => jourDeColonneDate(j.date))
      .sort()
      .at(-1);
    let bilan: Date | null = null;
    if (derniereJournee !== undefined && derniereJournee.slice(0, 7) === mois) {
      const b = await db.bilanFinFormation.findUnique({
        where: { sessionId_trainerId: { sessionId: r.sessionId, trainerId: r.trainerId } },
        select: { termineAt: true, payerQuandMemeAt: true },
      });
      bilan = b?.termineAt ?? b?.payerQuandMemeAt ?? null;
    }
    const jour = jourOuToutEtaitComplet({ feuilles: feuilles.map((f) => f.signeAt), bilan });
    return jour === null
      ? null
      : ajouterJours(jour, PARAMETRES_ARGENT_FORMATEURS.delaiPaiementJours);
  } catch {
    return null;
  }
}
