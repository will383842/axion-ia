/**
 * Console « Chaîne éditoriale » (C14) : lectures SEULES. Chaque source échoue isolément en
 * « indisponible » (table absente P2021 ou panne), jamais en 0. Aucune écriture.
 */

import { prisma } from "@/lib/prisma";
import {
  construireVueChaine,
  type LigneCout,
  type LigneRefus,
  type Source,
  type VueChaine,
} from "./vue-console";

const MAX_LIGNES = 5000;
const JOUR_MS = 86_400_000;

const TRONQUE = "tronque";

/** Une lecture bornée qui atteint la borne n'est plus un compte exact : « indisponible », jamais un faux chiffre. */
function borner<T>(rows: ReadonlyArray<T>): ReadonlyArray<T> {
  if (rows.length > MAX_LIGNES) throw new Error(TRONQUE);
  return rows;
}

async function lire<T>(f: () => Promise<T>): Promise<Source<T>> {
  try {
    return { etat: "ok", valeur: await f() };
  } catch (e) {
    if ((e as Error | null)?.message === TRONQUE) {
      return {
        etat: "indisponible",
        raison: `Plus de ${MAX_LIGNES} lignes sur la période : réduire la période.`,
      };
    }
    const absente = (e as { code?: string } | null)?.code === "P2021";
    return {
      etat: "indisponible",
      raison: absente ? "La table n'existe pas encore." : "Lecture impossible.",
    };
  }
}

function parStatut(rows: ReadonlyArray<{ statut: string }>): Record<string, number> {
  const compte: Record<string, number> = {};
  for (const r of rows) compte[r.statut] = (compte[r.statut] ?? 0) + 1;
  return compte;
}

export async function lireVueChaine(periodeJours = 30): Promise<VueChaine> {
  const maintenant = new Date();
  const depuis = new Date(maintenant.getTime() - periodeJours * JOUR_MS);
  const huitSemaines = new Date(maintenant.getTime() - 8 * 7 * JOUR_MS);
  const vide = (raison: string) => ({ etat: "indisponible", raison }) as const;

  // Contrat de build (AGENTS.md) : sous l'URL stub, aucune requête ne part.
  if (process.env.DATABASE_URL?.includes("stub.invalid")) {
    const r = vide("Base indisponible.");
    return construireVueChaine({
      maintenant,
      periodeJours,
      besoins: r,
      briefs: r,
      briefsAvecFaits: r,
      jobsLies: r,
      refus: r,
      couts: r,
      nbResultats: r,
      nbPropositions: r,
    });
  }

  const besoins = await lire(async () =>
    parStatut(
      borner(
        await prisma.contenuBesoin.findMany({
          where: { createdAt: { gte: depuis } },
          select: { statut: true },
          take: MAX_LIGNES + 1,
        }),
      ),
    ),
  );
  const briefs = await lire(async () =>
    parStatut(
      borner(
        await prisma.contenuBrief.findMany({
          where: { createdAt: { gte: depuis } },
          select: { statut: true },
          take: MAX_LIGNES + 1,
        }),
      ),
    ),
  );
  const briefsAvecFaits = await lire(async () => {
    const rows = await prisma.contenuFait.findMany({
      // Même population que « Briefs » : on filtre sur la date du BRIEF, pas du fait.
      where: { briefId: { not: null }, brief: { createdAt: { gte: depuis } } },
      distinct: ["briefId"],
      select: { briefId: true },
      take: MAX_LIGNES + 1,
    });
    return borner(rows).length;
  });
  let statutParJob: Record<string, string> = {};
  const jobsLies = await lire(async () => {
    const liens = await prisma.contenuBrief.findMany({
      where: { createdAt: { gte: depuis }, jobId: { not: null } },
      select: { jobId: true },
      take: MAX_LIGNES + 1,
    });
    const ids = borner(liens)
      .map((l) => l.jobId)
      .filter((j): j is string => j !== null);
    const jobs = await prisma.contentGenJob.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
    });
    statutParJob = Object.fromEntries(jobs.map((j) => [j.id, j.status]));
    const compte: Record<string, number> = {};
    for (const j of jobs) compte[j.status] = (compte[j.status] ?? 0) + 1;
    return compte;
  });
  const refus = await lire<ReadonlyArray<LigneRefus>>(async () =>
    borner(
      await prisma.contenuRefus.findMany({
        where: { createdAt: { gte: huitSemaines } },
        select: { role: true, code: true, createdAt: true, briefId: true, jobId: true },
        orderBy: { createdAt: "desc" },
        take: MAX_LIGNES + 1,
      }),
    ),
  );
  const couts = await lire<ReadonlyArray<LigneCout>>(async () => {
    const rows = await prisma.costLedger.findMany({
      where: { timestamp: { gte: depuis }, role: { not: null } },
      select: { jobId: true, role: true, costUsd: true },
      take: MAX_LIGNES + 1,
    });
    return borner(rows).map((r) => ({ jobId: r.jobId, role: r.role, costUsd: Number(r.costUsd) }));
  });
  const nbResultats = await lire(() => prisma.contenuResultat.count());
  const nbPropositions = await lire(() => prisma.contenuProposition.count());

  return construireVueChaine({
    maintenant,
    periodeJours,
    besoins,
    briefs,
    briefsAvecFaits,
    jobsLies,
    statutParJob,
    refus,
    couts,
    nbResultats,
    nbPropositions,
  });
}
