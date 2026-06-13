/**
 * Console admin — requêtes & agrégats coaching 1-to-1 (2026-06-13).
 *
 * Vue transverse (toutes séances, tous formateurs) — réservée aux admins
 * (les pages appellent `requireAdminRead`). Dashboards : gains de temps,
 * optimisations par type / par métier, conformité AFEST.
 */

import { prisma } from "@/lib/prisma";

/** Liste de toutes les séances (avec formateur + compteurs) pour la console. */
export async function listAllSessions() {
  return prisma.coachingSession.findMany({
    orderBy: { dateSeance: "desc" },
    take: 500,
    select: {
      id: true,
      interventionSlug: true,
      dateSeance: true,
      statut: true,
      beneficiaireNom: true,
      beneficiaireEntreprise: true,
      trainer: { select: { id: true, prenom: true, nom: true } },
      _count: { select: { optimisations: true, comptesRendus: true, journaux: true } },
    },
  });
}

/** Détail d'une séance (lecture admin, tous champs). */
export async function getSessionAdmin(sessionId: string) {
  return prisma.coachingSession.findUnique({
    where: { id: sessionId },
    include: {
      trainer: { select: { prenom: true, nom: true, email: true } },
      cartographie: true,
      plan: true,
      optimisations: { orderBy: [{ priorite: "asc" }, { createdAt: "asc" }] },
      comptesRendus: { orderBy: { dateSeance: "desc" } },
      journaux: { orderBy: { dateEntree: "desc" } },
    },
  });
}

export interface CoachingDashboard {
  totalSessions: number;
  byStatut: Record<string, number>;
  totalOptimisations: number;
  optimisationsRetenues: number;
  optimisationsByType: Array<{ type: string; count: number }>;
  /** Gain de temps hebdo cumulé estimé (somme des plans), en heures. */
  gainTempsHSemaineTotal: number;
  /** Gain estimé par métier (interventionSlug). */
  gainByMetier: Array<{ slug: string; sessions: number; gainH: number }>;
  /** Conformité AFEST sur les séances réalisées. */
  afest: {
    realisees: number;
    avecCartographie: number;
    avecPlan: number;
    avecCompteRendu: number;
    completes: number; // cartographie + plan + ≥1 CR
  };
}

export async function getCoachingDashboard(): Promise<CoachingDashboard> {
  const sessions = await prisma.coachingSession.findMany({
    select: {
      interventionSlug: true,
      statut: true,
      plan: { select: { gainTempsHSemaine: true } },
      cartographie: { select: { id: true } },
      _count: { select: { optimisations: true, comptesRendus: true } },
    },
  });

  const byStatut: Record<string, number> = {};
  const gainByMetierMap = new Map<string, { sessions: number; gainH: number }>();
  let gainTempsHSemaineTotal = 0;
  const afest = {
    realisees: 0,
    avecCartographie: 0,
    avecPlan: 0,
    avecCompteRendu: 0,
    completes: 0,
  };

  for (const s of sessions) {
    byStatut[s.statut] = (byStatut[s.statut] ?? 0) + 1;
    const gainH = s.plan?.gainTempsHSemaine != null ? Number(s.plan.gainTempsHSemaine) : 0;
    gainTempsHSemaineTotal += gainH;
    const m = gainByMetierMap.get(s.interventionSlug) ?? { sessions: 0, gainH: 0 };
    m.sessions += 1;
    m.gainH += gainH;
    gainByMetierMap.set(s.interventionSlug, m);

    if (s.statut === "realisee") {
      afest.realisees += 1;
      const hasCarto = !!s.cartographie;
      const hasPlan = !!s.plan;
      const hasCr = s._count.comptesRendus > 0;
      if (hasCarto) afest.avecCartographie += 1;
      if (hasPlan) afest.avecPlan += 1;
      if (hasCr) afest.avecCompteRendu += 1;
      if (hasCarto && hasPlan && hasCr) afest.completes += 1;
    }
  }

  const grouped = await prisma.optimisationProposee.groupBy({
    by: ["type"],
    _count: { _all: true },
  });
  const optimisationsByType = grouped
    .map((g) => ({ type: g.type as string, count: g._count._all }))
    .sort((a, b) => b.count - a.count);
  const totalOptimisations = optimisationsByType.reduce((acc, g) => acc + g.count, 0);

  const optimisationsRetenues = await prisma.optimisationProposee.count({
    where: { retenue: true },
  });

  return {
    totalSessions: sessions.length,
    byStatut,
    totalOptimisations,
    optimisationsRetenues,
    optimisationsByType,
    gainTempsHSemaineTotal,
    gainByMetier: Array.from(gainByMetierMap.entries())
      .map(([slug, v]) => ({ slug, sessions: v.sessions, gainH: v.gainH }))
      .sort((a, b) => b.gainH - a.gainH),
    afest,
  };
}

/** Liste des formateurs (comptes) pour la gestion admin. */
export async function listFormateurs() {
  return prisma.trainer.findMany({
    orderBy: [{ actif: "desc" }, { nom: "asc" }],
    select: {
      id: true,
      prenom: true,
      nom: true,
      email: true,
      statut: true,
      region: true,
      actif: true,
      lastFormateurLoginAt: true,
      _count: { select: { coachingSessions: true } },
    },
  });
}
