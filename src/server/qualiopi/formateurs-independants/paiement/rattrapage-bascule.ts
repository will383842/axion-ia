/**
 * Formateurs indépendants — RATTRAPAGE À L'ALLUMAGE DU PAIEMENT PAR MISSION
 * (lot L12e, ADR 0066 v2 (e), 09-RELECTURE-ARGENT points 1 et 3).
 *
 * Avant de donner une date à `formateurs.passage_paiement`, chaque couple
 * (formateur INDÉPENDANT, session commencée AVANT la bascule) doit appartenir au
 * relevé mensuel — même sans ligne encore écrite (S19b : le run de septembre
 * lancé après la bascule doit encore payer les 22-23/09). Ce service :
 *   1. dresse la LISTE NOMINATIVE (aperçu, rien n'est écrit) ;
 *   2. sur confirmation, inscrit les revendications manquantes (`releve_mensuel`,
 *      source `rattrapage_console`), en ajout seul, idempotent ;
 *   3. rend la liste APRÈS, à comparer ligne à ligne avec l'aperçu.
 *
 * Service sans écran (l'écran viendra avec la console de bascule) ; il exige
 * l'acte `remunerer_formateur` chez l'appelant. Sans `server-only` (testable,
 * appelable par un script). Rien n'est supprimé, rien n'est modifié.
 */

import { premiereJourneeSession } from "./lecture-passage";

export interface CoupleARevendiquer {
  readonly trainerId: string;
  readonly sessionId: string;
  readonly premiereJournee: string;
  /** Déjà revendiqué : par qui. `null` = à revendiquer. */
  readonly regimeActuel: "releve_mensuel" | "par_mission" | null;
}

export interface ApercuRattrapage {
  readonly dateBascule: string;
  readonly couples: ReadonlyArray<CoupleARevendiquer>;
  /** À inscrire maintenant. */
  readonly aRevendiquer: number;
  /** 🔴 Déjà revendiqués PAR MISSION alors qu'ils précèdent la bascule : à trancher. */
  readonly conflits: ReadonlyArray<CoupleARevendiquer>;
}

/**
 * Pure : à partir des couples lus (indépendant, session, première journée) et des
 * revendications existantes, ce qu'il faut inscrire. Seules les sessions
 * commencées AVANT la bascule sont concernées.
 */
export function apercuRattrapage(
  dateBascule: string,
  couples: ReadonlyArray<{ trainerId: string; sessionId: string; premiereJournee: string }>,
  revendications: ReadonlyArray<{
    trainerId: string;
    sessionId: string;
    regime: "releve_mensuel" | "par_mission";
  }>,
): ApercuRattrapage {
  const existantes = new Map(
    revendications.map((r) => [`${r.trainerId}|${r.sessionId}`, r.regime]),
  );
  const vus = new Set<string>();
  const out: CoupleARevendiquer[] = [];
  for (const c of couples) {
    if (c.premiereJournee >= dateBascule) continue;
    const cle = `${c.trainerId}|${c.sessionId}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push({ ...c, regimeActuel: existantes.get(cle) ?? null });
  }
  out.sort((a, b) =>
    a.premiereJournee === b.premiereJournee
      ? `${a.trainerId}|${a.sessionId}` < `${b.trainerId}|${b.sessionId}`
        ? -1
        : 1
      : a.premiereJournee < b.premiereJournee
        ? -1
        : 1,
  );
  return {
    dateBascule,
    couples: out,
    aRevendiquer: out.filter((c) => c.regimeActuel === null).length,
    conflits: out.filter((c) => c.regimeActuel === "par_mission"),
  };
}

/** Le strict nécessaire d'un client Prisma (ou d'une transaction). */
export interface ClientRattrapage {
  trainingSession: {
    findMany(a: unknown): Promise<
      Array<{
        id: string;
        dateDebut: Date;
        jours: Array<{ date: Date }>;
        sessionFormateurs: Array<{ trainerId: string; trainer: { statut: string } }>;
      }>
    >;
  };
  trainerFeeLine: {
    findMany(a: unknown): Promise<Array<{ trainerId: string; sessionId: string | null }>>;
  };
  trainer: { findMany(a: unknown): Promise<Array<{ id: string }>> };
  revendicationPaiement: {
    findMany(
      a: unknown,
    ): Promise<
      Array<{ trainerId: string; sessionId: string; regime: "releve_mensuel" | "par_mission" }>
    >;
  };
  $executeRawUnsafe(sql: string, ...v: unknown[]): Promise<number>;
}

/**
 * Lecture : toute session commencée avant la bascule (fenêtre `depuis` → `D`)
 * et chacun de ses indépendants — affectés (vivants) ou porteurs d'une ligne
 * mensuelle non annulée (un formateur retiré garde ses lignes).
 */
export async function lireApercuRattrapage(
  db: ClientRattrapage,
  dateBascule: string,
  depuis: Date,
): Promise<ApercuRattrapage> {
  const fin = new Date(`${dateBascule}T00:00:00Z`);
  fin.setUTCDate(fin.getUTCDate() + 1);
  const sessions = await db.trainingSession.findMany({
    where: { dateDebut: { gte: depuis, lt: fin } },
    select: {
      id: true,
      dateDebut: true,
      jours: { select: { date: true } },
      sessionFormateurs: { select: { trainerId: true, trainer: { select: { statut: true } } } },
    },
  });
  const ids = sessions.map((s) => s.id);
  const [lignes, revendications] = ids.length
    ? await Promise.all([
        db.trainerFeeLine.findMany({
          where: { sessionId: { in: ids }, statut: { not: "annule" }, origine: "releve_mensuel" },
          select: { trainerId: true, sessionId: true },
        }),
        db.revendicationPaiement.findMany({
          where: { sessionId: { in: ids } },
          select: { trainerId: true, sessionId: true, regime: true },
        }),
      ])
    : [[], []];
  const porteurs = [...new Set(lignes.map((l) => l.trainerId))];
  const independants = new Set(
    (porteurs.length
      ? await db.trainer.findMany({
          where: { id: { in: porteurs }, statut: "sous_traitant" },
          select: { id: true },
        })
      : []
    ).map((t) => t.id),
  );
  const couples: Array<{ trainerId: string; sessionId: string; premiereJournee: string }> = [];
  for (const s of sessions) {
    const premiereJournee = premiereJourneeSession(s);
    for (const sf of s.sessionFormateurs) {
      if (sf.trainer.statut === "sous_traitant")
        couples.push({ trainerId: sf.trainerId, sessionId: s.id, premiereJournee });
    }
    for (const l of lignes) {
      if (l.sessionId === s.id && independants.has(l.trainerId))
        couples.push({ trainerId: l.trainerId, sessionId: s.id, premiereJournee });
    }
  }
  return apercuRattrapage(dateBascule, couples, revendications);
}

/**
 * Inscrit les revendications manquantes de l'aperçu (`releve_mensuel`), en ajout
 * seul ; un couple déjà revendiqué n'est jamais réécrit. Rend le nombre inscrit.
 */
export async function inscrireRattrapage(
  db: Pick<ClientRattrapage, "$executeRawUnsafe">,
  apercu: ApercuRattrapage,
): Promise<number> {
  let n = 0;
  for (const c of apercu.couples) {
    if (c.regimeActuel !== null) continue;
    n += await db.$executeRawUnsafe(
      `INSERT INTO "revendications_paiement" ("id", "trainer_id", "session_id", "regime", "source")
       VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'releve_mensuel', 'rattrapage_console')
       ON CONFLICT ("trainer_id", "session_id") DO NOTHING`,
      c.trainerId,
      c.sessionId,
    );
  }
  return n;
}
