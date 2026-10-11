/**
 * Formateurs indépendants — les accès en base du passage du paiement par mission
 * (lot L12c). Le calcul vit dans `passage-mission.ts` (pur) ; ici on lit et on
 * écrit, rien d'autre.
 *
 * Sans `server-only` : appelé par le worker (sous `tsx`). Prisma est chargé
 * PARESSEUSEMENT.
 */

import type { TvaRegimeHonoraires } from "@/server/qualiopi/remuneration/calcul";
import { prendreVerrousRemuneration } from "@/server/qualiopi/remuneration/verrou-remuneration";
import { journaliser } from "@/server/journal/journaliser";

import { jourDeColonneDate, jourParis } from "../argent/dates";
import { lireDateBascule, premiereJourneeSession, uniqueHistoriqueRetire } from "./lecture-passage";
import type { CandidatMission, DepsPassage, IssueEcriture, MoisAEcrire } from "./passage-mission";

/** Statuts d'une sollicitation dont les conditions financières font foi. */
const MISSIONS_ACCEPTEES = ["acceptee", "accord_hors_outil", "desistee"] as const;

/** Midi UTC du jour civil : le jour de Paris est le même en toute saison. */
export function instantDuJour(jour: string): Date {
  return new Date(`${jour}T12:00:00Z`);
}

async function client() {
  const { prisma } = await import("@/lib/prisma");
  return prisma;
}

/**
 * Les couples (indépendant, session) d'une session commencée à `D` ou après,
 * pour lesquels le formateur a contresigné au moins une demi-journée.
 */
export async function lireCandidats(dateBascule: string): Promise<CandidatMission[]> {
  const prisma = await client();
  // Fenêtre large d'un jour : le jour de Paris tranche ensuite.
  const depuis = new Date(`${dateBascule}T00:00:00Z`);
  depuis.setUTCDate(depuis.getUTCDate() - 1);
  const sessions = await prisma.trainingSession.findMany({
    where: { dateDebut: { gte: depuis } },
    select: {
      id: true,
      dateDebut: true,
      jours: { select: { date: true, heureDebut: true, heureFin: true, trainerId: true } },
      sessionFormateurs: { select: { trainerId: true, role: true } },
    },
  });
  if (sessions.length === 0) return [];
  const ids = sessions.map((s) => s.id);
  const [signatures, missions] = await Promise.all([
    prisma.emargementContresignature.findMany({
      where: {
        sessionId: { in: ids },
        revokedAt: null,
        trainer: { statut: "sous_traitant" },
      },
      select: { sessionId: true, trainerId: true, date: true, demiJournee: true },
    }),
    prisma.missionFormateur.findMany({
      where: {
        sessionId: { in: ids },
        statut: { in: [...MISSIONS_ACCEPTEES] },
        tarifHtCents: { not: null },
        regimeTvaFige: { not: null },
      },
      orderBy: { solliciteAt: "desc" },
      select: {
        sessionId: true,
        trainerId: true,
        tarifHtCents: true,
        forfaitDeplacementParJourHtCents: true,
        regimeTvaFige: true,
      },
    }),
  ]);

  const out: CandidatMission[] = [];
  for (const s of sessions) {
    const premiereJournee = premiereJourneeSession(s);
    const parFormateur = new Map<string, typeof signatures>();
    for (const sig of signatures) {
      if (sig.sessionId !== s.id) continue;
      parFormateur.set(sig.trainerId, [...(parFormateur.get(sig.trainerId) ?? []), sig]);
    }
    for (const [trainerId, sigs] of parFormateur) {
      // La plus récente des sollicitations acceptées, à prix figé.
      const m = missions.find((x) => x.sessionId === s.id && x.trainerId === trainerId);
      // Affecté à la session (principal ou co-formateur) : les journées sans
      // formateur désigné lui reviennent aussi.
      const affecte = s.sessionFormateurs.some((sf) => sf.trainerId === trainerId);
      out.push({
        trainerId,
        sessionId: s.id,
        premiereJournee,
        conditions:
          m && m.tarifHtCents !== null && m.regimeTvaFige !== null
            ? {
                tarifJourneeHtCents: m.tarifHtCents,
                forfaitDeplacementParJourHtCents: m.forfaitDeplacementParJourHtCents,
                regimeTva: m.regimeTvaFige as TvaRegimeHonoraires,
              }
            : null,
        contresignatures: sigs.map((x) => ({
          jour: jourDeColonneDate(x.date),
          demiJournee: x.demiJournee,
        })),
        journeesPrevues: s.jours
          .filter((j) => j.trainerId === trainerId || (j.trainerId === null && affecte))
          .map((j) => ({
            jour: jourDeColonneDate(j.date),
            heureDebut: j.heureDebut,
            heureFin: j.heureFin,
          })),
        // ⚠️ La condition suspensive du financeur (PR OPCO encore ouverte) n'est
        // pas encore lisible : faute de mieux, on ne paie que ce qui est signé.
        conditionFinanceurEnAttente: false,
      });
    }
  }
  return out;
}

const OCCUPANTS = ["brouillon", "a_valider", "valide", "facture_recue", "paye"] as const;

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof client>>["$transaction"]>[0]>[0];

/** Écrit UN mois sous verrous ; idempotent. */
export async function ecrireMoisMission(m: MoisAEcrire, maintenant: Date): Promise<IssueEcriture> {
  const prisma = await client();
  return prisma.$transaction((tx) => ecrireMoisDansTransaction(tx, m, maintenant), {
    timeout: 30_000,
    maxWait: 10_000,
  });
}

/** Le corps de `ecrireMoisMission`, dans la transaction de l'appelant. */
export async function ecrireMoisDansTransaction(
  tx: Tx,
  m: MoisAEcrire,
  maintenant: Date,
): Promise<IssueEcriture> {
  const [annee, mois] = m.releve.mois.split("-").map(Number) as [number, number];
  await prendreVerrousRemuneration(tx, {
    periodes: [{ year: annee, month: mois }],
    trainerIds: [m.trainerId],
  });

  // 1. Le premier moteur qui écrit revendique ; l'autre s'abstient.
  await tx.$executeRawUnsafe(
    `INSERT INTO "revendications_paiement" ("id", "trainer_id", "session_id", "regime", "source")
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, 'par_mission', 'passage_mission')
         ON CONFLICT ("trainer_id", "session_id") DO NOTHING`,
    m.trainerId,
    m.sessionId,
  );
  const rev = await tx.revendicationPaiement.findUnique({
    where: { trainerId_sessionId: { trainerId: m.trainerId, sessionId: m.sessionId } },
    select: { regime: true },
  });
  if (rev?.regime !== "par_mission") return "revendique_par_le_mensuel";

  // 2. Propriétaire en conflit : une ligne mensuelle vivante, tous mois confondus.
  const mensuelle = await tx.trainerFeeLine.count({
    where: {
      trainerId: m.trainerId,
      sessionId: m.sessionId,
      origine: "releve_mensuel",
      statut: { not: "annule" },
    },
  });
  if (mensuelle > 0) return "conflit_ligne_mensuelle";

  // 3. Déjà écrit ce mois (un relevé vivant, hors avoir) : rien.
  const existant = await tx.trainerStatement.findFirst({
    where: {
      trainerId: m.trainerId,
      sessionId: m.sessionId,
      origine: "passage_mission",
      periodeYear: annee,
      periodeMonth: mois,
      avoirDeId: null,
      organismeSousTraitantId: null,
      statut: { in: [...OCCUPANTS] },
    },
    select: { id: true },
  });
  if (existant) {
    // Des demi-journées signées APRÈS l'écriture du relevé ne sont pas payées en
    // silence : on le signale (complément à traiter par avoir et réémission).
    const ecrites = await tx.trainerFeeLine.aggregate({
      where: { statementId: existant.id, objet: "animation", statut: { not: "annule" } },
      _sum: { demiJournees: true },
    });
    const aPayer = m.releve.lignes.find((l) => l.objet === "animation")?.demiJournees ?? 0;
    return aPayer > (ecrites._sum.demiJournees ?? 0) ? "complement_a_traiter" : "deja_ecrit";
  }

  const releve = await tx.trainerStatement.create({
    data: {
      trainerId: m.trainerId,
      periodeYear: annee,
      periodeMonth: mois,
      statut: "a_valider",
      origine: "passage_mission",
      sessionId: m.sessionId,
      tvaRegime: m.regimeTva,
      totalHtCents: m.releve.totalHtCents,
      tvaCents: m.releve.tvaCents,
      totalTtcCents: m.releve.totalTtcCents,
      echeanceAt: instantDuJour(m.releve.echeance),
    },
    select: { id: true },
  });
  await tx.trainerFeeLine.createMany({
    data: m.releve.lignes.map((l) => ({
      trainerId: m.trainerId,
      prestationType: "formation_collective" as const,
      sessionId: m.sessionId,
      model: "taux_journalier" as const,
      nature: "honoraire_du" as const,
      tauxSnapshotCents: l.objet === "animation" ? m.tarifJourneeHtCents : null,
      montantHtCents: l.montantHtCents,
      statut: "calcule" as const,
      periodeYear: annee,
      periodeMonth: mois,
      statementId: releve.id,
      origine: "passage_mission" as const,
      objet: l.objet,
      demiJournees: l.demiJournees ?? null,
      journeesDeplacement: l.journeesDeplacement ?? null,
      calculatedAt: maintenant,
    })),
  });
  await journaliser(
    tx,
    {
      action: "qualiopi.remuneration.releve_mission_ecrit",
      targetType: "TrainerStatement",
      targetId: releve.id,
      changes: {
        mois: m.releve.mois,
        totalHtCents: m.releve.totalHtCents,
        echeance: m.releve.echeance,
        sansEcart: m.sansEcart,
      },
      session: null,
    },
    { exiger: true },
  );
  return "ecrit";
}

/** Les dépendances réelles du passage. */
export async function depsPassageReelles(): Promise<DepsPassage> {
  const prisma = await client();
  return {
    dateBascule: () => lireDateBascule(prisma),
    uniqueHistoriqueRetire: () => uniqueHistoriqueRetire(prisma),
    candidats: lireCandidats,
    ecrireMois: ecrireMoisMission,
  };
}
