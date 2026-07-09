// Planning unifié — couche de lecture (read-only, appelée depuis les RSC).
//
// Union des sources (formation collective + coaching 1-to-1) normalisée en
// `PlanningEvent`. Le regroupement par jour se fait en Europe/Paris via
// `expandEventDayKeys` : une formation multi-jours apparaît sur chaque case.
//
// Requête FENÊTRÉE : on ne lit que les prestations chevauchant le mois affiché
// (± 1 jour de marge pour absorber les bords de fuseau), jamais toute la table.
//
// Build-safety (ADR 0026) : au build, `prisma` est un Proxy stub qui renvoie []
// → ces fonctions renvoient une Map vide, sans connexion DB.

import { prisma } from "@/lib/prisma";
import { formatLieu } from "@/server/qualiopi/lieu/format-lieu";
import { expandEventDayKeys } from "./expand";
import { findConflicts, type ConflictTarget } from "./conflicts";
import type { PlanningEvent, PlanningFilters, PlanningStatut } from "./types";

const MAX_FETCH = 2000;

/** Statuts existant sur `CoachingSessionStatut` (pas de `en_cours`). */
const COACHING_STATUTS = new Set<PlanningStatut>(["planifiee", "realisee", "annulee", "reportee"]);

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Bornes UTC du mois, élargies d'un jour de chaque côté (bords de fuseau). */
function monthBounds(year: number, month: number): { from: Date; to: Date } {
  const from = new Date(Date.UTC(year, month - 1, 1));
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(Date.UTC(year, month, 1));
  to.setUTCDate(to.getUTCDate() + 1);
  return { from, to };
}

function nomComplet(t: { prenom: string; nom: string } | null): string | null {
  if (t === null) return null;
  const s = `${t.prenom} ${t.nom}`.trim();
  return s.length > 0 ? s : null;
}

async function fetchFormations(
  from: Date,
  to: Date,
  filters: PlanningFilters,
): Promise<PlanningEvent[]> {
  try {
    const rows = await prisma.trainingSession.findMany({
      where: {
        dateDebut: { lte: to },
        dateFin: { gte: from },
        ...(filters.statut !== undefined ? { statut: filters.statut } : {}),
        ...(filters.trainerId !== undefined ? { formateurPrincipalId: filters.trainerId } : {}),
      },
      select: {
        id: true,
        titreSession: true,
        dateDebut: true,
        dateFin: true,
        statut: true,
        lieuType: true,
        lieuIntitule: true,
        lieuAdresse: true,
        lieuCodePostal: true,
        lieuVille: true,
        lieuSalle: true,
        lieuVisioUrl: true,
        formateurPrincipal: { select: { nom: true, prenom: true } },
        client: { select: { raisonSociale: true } },
      },
      orderBy: { dateDebut: "asc" },
      take: MAX_FETCH,
    });

    return rows.map((r) => ({
      key: `formation:${r.id}`,
      type: "formation" as const,
      id: r.id,
      titre: r.titreSession,
      debut: r.dateDebut,
      fin: r.dateFin,
      statut: r.statut as PlanningStatut,
      formateurNom: nomComplet(r.formateurPrincipal),
      clientNom: r.client?.raisonSociale ?? null,
      lieu: formatLieu(r),
    }));
  } catch {
    return [];
  }
}

async function fetchCoachings(
  from: Date,
  to: Date,
  filters: PlanningFilters,
): Promise<PlanningEvent[]> {
  // Un statut propre aux formations (`en_cours`) ne peut pas exister en coaching.
  if (filters.statut !== undefined && !COACHING_STATUTS.has(filters.statut)) return [];

  try {
    const rows = await prisma.coachingSession.findMany({
      where: {
        OR: [{ dateSeance: { gte: from, lte: to } }, { dateSeanceFin: { gte: from, lte: to } }],
        ...(filters.statut !== undefined
          ? { statut: filters.statut as "planifiee" | "realisee" | "annulee" | "reportee" }
          : {}),
        ...(filters.trainerId !== undefined ? { trainerId: filters.trainerId } : {}),
      },
      select: {
        id: true,
        interventionSlug: true,
        dateSeance: true,
        dateSeanceFin: true,
        statut: true,
        beneficiaireNom: true,
        beneficiaireEntreprise: true,
        lieuType: true,
        lieuIntitule: true,
        lieuAdresse: true,
        lieuCodePostal: true,
        lieuVille: true,
        lieuSalle: true,
        lieuVisioUrl: true,
        trainer: { select: { nom: true, prenom: true } },
      },
      orderBy: { dateSeance: "asc" },
      take: MAX_FETCH,
    });

    return rows.map((r) => ({
      key: `coaching:${r.id}`,
      type: "coaching" as const,
      id: r.id,
      titre: r.interventionSlug,
      debut: r.dateSeance,
      fin: r.dateSeanceFin,
      statut: r.statut as PlanningStatut,
      formateurNom: nomComplet(r.trainer),
      clientNom: r.beneficiaireEntreprise ?? r.beneficiaireNom ?? null,
      lieu: formatLieu(r),
    }));
  } catch {
    return [];
  }
}

/** Tri intra-jour : par heure de début, puis par titre (déterministe). */
function sortWithinDay(arr: PlanningEvent[]): void {
  arr.sort((a, b) => {
    const d = a.debut.getTime() - b.debut.getTime();
    return d !== 0 ? d : a.titre.localeCompare(b.titre, "fr");
  });
}

/**
 * Événements du mois, regroupés par clé jour « YYYY-MM-DD » (Europe/Paris).
 * Seules les cases DU mois demandé sont retournées (une formation à cheval sur
 * deux mois n'apparaît que sur les jours du mois affiché).
 */
export async function getPlanningMonth(
  year: number,
  month: number,
  filters: PlanningFilters = {},
): Promise<Map<string, PlanningEvent[]>> {
  const { from, to } = monthBounds(year, month);
  const [formations, coachings] = await Promise.all([
    fetchFormations(from, to, filters),
    fetchCoachings(from, to, filters),
  ]);

  let events = [...formations, ...coachings];
  if (filters.type !== undefined) events = events.filter((e) => e.type === filters.type);

  const prefix = `${year}-${pad2(month)}`;
  const byDay = new Map<string, PlanningEvent[]>();

  for (const e of events) {
    for (const dayKey of expandEventDayKeys(e.debut, e.fin)) {
      if (!dayKey.startsWith(prefix)) continue;
      const arr = byDay.get(dayKey);
      if (arr === undefined) byDay.set(dayKey, [e]);
      else arr.push(e);
    }
  }

  for (const arr of byDay.values()) sortWithinDay(arr);
  return byDay;
}

/**
 * Autres prestations du formateur qui CHEVAUCHENT `cible`.
 *
 * Rien n'empêchait jusqu'ici d'affecter un formateur à deux prestations
 * simultanées : la garde `isTrainerHabilite` ne vérifie que l'habilitation,
 * jamais la disponibilité. Cette lecture alimente l'alerte de la fiche 360°.
 *
 * Fenêtre : la durée de la cible ± 1 jour (une prestation qui déborde la veille
 * ou le lendemain doit être vue). Retourne [] si la cible est annulée/reportée.
 */
export async function getTrainerConflicts(
  trainerId: string,
  cible: ConflictTarget,
): Promise<PlanningEvent[]> {
  const from = new Date(cible.debut);
  from.setUTCDate(from.getUTCDate() - 1);
  const to = new Date(cible.fin ?? cible.debut);
  to.setUTCDate(to.getUTCDate() + 1);

  const [formations, coachings] = await Promise.all([
    fetchFormations(from, to, { trainerId }),
    fetchCoachings(from, to, { trainerId }),
  ]);

  return findConflicts(cible, [...formations, ...coachings]);
}
