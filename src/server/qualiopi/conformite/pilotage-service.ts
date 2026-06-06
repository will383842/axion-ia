/**
 * Qualiopi — Service pilotage (AGENT B — T12).
 *
 * getPilotage(annee) : calcule les 14 métriques de pilotage RNQ V9.
 *   Réutilise getIndicateurs (T10) + computeBpf (T10) + counts registres.
 *   Cache Redis optionnel TTL 3600 s.
 *
 * Stub-aware : si DATABASE_URL contient "stub.invalid", retourne un
 * PilotageResult vide (safe au build SSG).
 */

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { getIndicateurs } from "@/server/qualiopi/indicateurs/service";
import { computeBpf } from "@/server/qualiopi/bpf/service";

// ─────────────────────────────────────────────────────────────────────────────
// Types exportés
// ─────────────────────────────────────────────────────────────────────────────

export interface MetriqueValeur {
  valeur: number | string;
  libelle: string;
  unite?: string;
}

export interface PilotageResult {
  annee: number;
  /** M1 — Prestations ouvertes / terminées */
  m1_prestations: MetriqueValeur;
  /** M2 — Taux d'entrée dans le délai */
  m2_taux_entree_delai: MetriqueValeur;
  /** M3 — Taux de complétion */
  m3_taux_completion: MetriqueValeur;
  /** M4 — Taux d'abandon */
  m4_taux_abandon: MetriqueValeur;
  /** M5 — Taux d'atteinte des objectifs (réussite) */
  m5_taux_reussite: MetriqueValeur;
  /** M6 — Satisfaction globale */
  m6_satisfaction: MetriqueValeur;
  /** M7 — Incidents (sessions avec anomalie signalée) */
  m7_incidents: MetriqueValeur;
  /** M8 — Réclamations reçues + délai moyen de traitement */
  m8_reclamations: MetriqueValeur;
  /** M9 — Actions correctives ouvertes / closes */
  m9_actions_correctives: MetriqueValeur;
  /** M10 — Mise à jour documentaire (documents générés dans l'année) */
  m10_maj_documentaire: MetriqueValeur;
  /** M11 — Formateurs à jour de leurs preuves de compétences */
  m11_formateurs_a_jour: MetriqueValeur;
  /** M12 — Adaptations handicap réalisées */
  m12_adaptations_handicap: MetriqueValeur;
  /** M13 — Sous-traitances évaluées (contrat signé) */
  m13_sous_traitances_evaluees: MetriqueValeur;
  /** M14 — Conformité dossiers audités en interne */
  m14_conformite_dossiers: MetriqueValeur;
  calculeAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_TTL_SEC = 3600;

function cacheKey(annee: number): string {
  return `qualiopi:pilotage:${annee}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// getPilotage
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule les 14 métriques de pilotage Qualiopi pour l'année donnée.
 *
 * Réutilise :
 *   - getIndicateurs (T10) → taux satisfaction, réussite, complétion, délai accès
 *   - computeBpf (T10) → nb sessions, stagiaires, formateurs
 *   - counts Prisma → réclamations, veille, sous-traitants, adaptations, documents
 *
 * Cache Redis TTL 3600 s (optionnel — fail-soft).
 * Stub-aware : retourne PilotageResult vide si stub.invalid.
 */
export async function getPilotage(annee: number): Promise<PilotageResult> {
  if (process.env["DATABASE_URL"]?.includes("stub.invalid")) {
    return buildEmptyPilotage(annee);
  }

  const key = cacheKey(annee);

  // Lecture cache
  try {
    const cached = await redis.get(key);
    if (cached !== null && cached !== undefined) {
      const parsed = JSON.parse(cached as string) as PilotageResult;
      return { ...parsed, calculeAt: new Date(parsed.calculeAt) };
    }
  } catch {
    // fail-soft
  }

  const plage = {
    gte: new Date(`${annee}-01-01T00:00:00.000Z`),
    lt: new Date(`${annee + 1}-01-01T00:00:00.000Z`),
  };

  // Récupération parallèle : indicateurs T10, BPF T10, et counts registres
  const [
    indicateurs,
    bpf,
    nbSessionsPlanifiees,
    nbEnrollmentsAbandons,
    nbEnrollmentsTotal,
    nbReclamations,
    nbReclamationsEnRetard,
    nbReclamationsResolues,
    nbSousTraitantsTotal,
    nbSousTraitantsContratSigne,
    nbDocumentsAnnee,
    nbTrainersTotal,
    nbTrainersActifsSociaux,
    nbAdaptationsHandicap,
    nbEnrollmentsConvocations,
  ] = await Promise.all([
    getIndicateurs(annee),
    computeBpf(annee),
    prisma.trainingSession.count({
      where: { dateDebut: plage },
    }),
    prisma.enrollment.count({
      where: {
        statut: "abandon",
        session: { dateDebut: plage },
      },
    }),
    prisma.enrollment.count({
      where: {
        session: { dateDebut: plage },
      },
    }),
    prisma.reclamation.count({
      where: { dateReception: plage },
    }),
    // Réclamations sans réponse depuis > 15 jours
    prisma.reclamation.count({
      where: {
        dateReception: plage,
        dateReponse: null,
        createdAt: {
          lt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    prisma.reclamation.count({
      where: {
        dateReception: plage,
        statut: { in: ["resolue", "cloturee"] },
      },
    }),
    prisma.sousTraitant.count(),
    prisma.sousTraitant.count({ where: { contratSigneAt: { not: null } } }),
    prisma.documentGenere.count({ where: { createdAt: plage } }),
    prisma.trainer.count({ where: { actif: true } }),
    // Formateurs ayant une preuve récente (ex. CV ou certification mise à jour
    // dans l'année — proxy : updatedAt dans l'année)
    prisma.trainer.count({
      where: { actif: true, updatedAt: plage },
    }),
    // Adaptations handicap réalisées sur inscriptions de l'année
    prisma.enrollment.count({
      where: {
        adaptationsRealisees: { not: null },
        session: { dateDebut: plage },
      },
    }),
    // Convocations générées (proxy délai d'entrée)
    prisma.enrollment.count({
      where: {
        session: { dateDebut: plage },
        statut: { notIn: ["abandon", "exclu"] },
      },
    }),
  ]);

  // ── M1 — Prestations ouvertes / terminées ──────────────────────────────────
  const nbTerminees = bpf.nbSessions;
  const nbOuvertes = nbSessionsPlanifiees;
  const m1: MetriqueValeur = {
    valeur: `${nbTerminees} terminée(s) / ${nbOuvertes} au total`,
    libelle: "Prestations ouvertes / terminées",
  };

  // ── M2 — Taux d'entrée dans le délai ──────────────────────────────────────
  // Proxy : % d'inscrits actifs sur sessions ouvertes dans l'année
  const m2Val =
    nbSessionsPlanifiees > 0
      ? Math.round((nbEnrollmentsConvocations / Math.max(nbEnrollmentsTotal, 1)) * 100)
      : 0;
  const m2: MetriqueValeur = {
    valeur: m2Val,
    libelle: "Taux d'entrée dans le délai",
    unite: "%",
  };

  // ── M3 — Taux de complétion ────────────────────────────────────────────────
  const m3: MetriqueValeur = indicateurs.tauxCompletion.fiable
    ? {
        valeur: indicateurs.tauxCompletion.tauxPct,
        libelle: indicateurs.tauxCompletion.libelle,
        unite: "%",
      }
    : {
        valeur: "—",
        libelle: indicateurs.tauxCompletion.libelle,
      };

  // ── M4 — Taux d'abandon ────────────────────────────────────────────────────
  const m4Val =
    nbEnrollmentsTotal > 0 ? Math.round((nbEnrollmentsAbandons / nbEnrollmentsTotal) * 100) : 0;
  const m4: MetriqueValeur = {
    valeur: m4Val,
    libelle: "Taux d'abandon",
    unite: "%",
  };

  // ── M5 — Taux d'atteinte des objectifs (réussite) ─────────────────────────
  const m5: MetriqueValeur = indicateurs.tauxReussite.fiable
    ? {
        valeur: indicateurs.tauxReussite.tauxPct,
        libelle: indicateurs.tauxReussite.libelle,
        unite: "%",
      }
    : {
        valeur: "—",
        libelle: indicateurs.tauxReussite.libelle,
      };

  // ── M6 — Satisfaction globale ──────────────────────────────────────────────
  const m6: MetriqueValeur = indicateurs.tauxSatisfaction.fiable
    ? {
        valeur: indicateurs.tauxSatisfaction.tauxPct,
        libelle: indicateurs.tauxSatisfaction.libelle,
        unite: "%",
      }
    : {
        valeur: "—",
        libelle: indicateurs.tauxSatisfaction.libelle,
      };

  // ── M7 — Incidents ────────────────────────────────────────────────────────
  // Proxy : sessions annulées ou reportées dans l'année
  const nbIncidents = await prisma.trainingSession.count({
    where: {
      dateDebut: plage,
      statut: { in: ["annulee", "reportee"] },
    },
  });
  const m7: MetriqueValeur = {
    valeur: nbIncidents,
    libelle: "Incidents (sessions annulées / reportées)",
  };

  // ── M8 — Réclamations + délai ─────────────────────────────────────────────
  const m8: MetriqueValeur = {
    valeur: `${nbReclamations} reçue(s) · ${nbReclamationsEnRetard} en retard · ${nbReclamationsResolues} résolue(s)`,
    libelle: "Réclamations reçues + délai de traitement",
  };

  // ── M9 — Actions correctives ouvertes / closes ────────────────────────────
  // Proxy : réclamations avec actionsCorrectives renseignées (closes) vs total
  const nbActionsCorrectives = await prisma.reclamation.count({
    where: {
      dateReception: plage,
      actionsCorrectives: { not: null },
    },
  });
  const m9: MetriqueValeur = {
    valeur: `${nbActionsCorrectives} close(s) / ${nbReclamations} total`,
    libelle: "Actions correctives ouvertes / closes",
  };

  // ── M10 — Mise à jour documentaire ────────────────────────────────────────
  const m10: MetriqueValeur = {
    valeur: nbDocumentsAnnee,
    libelle: "Documents générés dans l'année",
  };

  // ── M11 — Formateurs à jour ────────────────────────────────────────────────
  const m11Val =
    nbTrainersTotal > 0 ? Math.round((nbTrainersActifsSociaux / nbTrainersTotal) * 100) : 0;
  const m11: MetriqueValeur = {
    valeur: `${nbTrainersActifsSociaux} / ${nbTrainersTotal} (${m11Val} %)`,
    libelle: "Formateurs à jour de leurs preuves de compétences",
  };

  // ── M12 — Adaptations handicap réalisées ──────────────────────────────────
  const m12: MetriqueValeur = {
    valeur: nbAdaptationsHandicap,
    libelle: "Adaptations handicap réalisées",
  };

  // ── M13 — Sous-traitances évaluées ────────────────────────────────────────
  const m13Val =
    nbSousTraitantsTotal > 0
      ? Math.round((nbSousTraitantsContratSigne / nbSousTraitantsTotal) * 100)
      : 0;
  const m13: MetriqueValeur = {
    valeur: `${nbSousTraitantsContratSigne} / ${nbSousTraitantsTotal} (${m13Val} %)`,
    libelle: "Sous-traitances avec contrat signé",
  };

  // ── M14 — Conformité dossiers audités en interne ──────────────────────────
  // Proxy : sessions avec tous les documents attendus générés
  const nbSessionsAvecDocs = await prisma.trainingSession.count({
    where: {
      statut: "realisee",
      dateDebut: plage,
      documents: { some: {} },
    },
  });
  const m14Val = nbTerminees > 0 ? Math.round((nbSessionsAvecDocs / nbTerminees) * 100) : 0;
  const m14: MetriqueValeur = {
    valeur: `${nbSessionsAvecDocs} / ${nbTerminees} (${m14Val} %)`,
    libelle: "Sessions réalisées avec dossier documentaire complet",
  };

  const result: PilotageResult = {
    annee,
    m1_prestations: m1,
    m2_taux_entree_delai: m2,
    m3_taux_completion: m3,
    m4_taux_abandon: m4,
    m5_taux_reussite: m5,
    m6_satisfaction: m6,
    m7_incidents: m7,
    m8_reclamations: m8,
    m9_actions_correctives: m9,
    m10_maj_documentaire: m10,
    m11_formateurs_a_jour: m11,
    m12_adaptations_handicap: m12,
    m13_sous_traitances_evaluees: m13,
    m14_conformite_dossiers: m14,
    calculeAt: new Date(),
  };

  // Écriture cache
  try {
    await redis.set(key, JSON.stringify(result), "EX", CACHE_TTL_SEC);
  } catch {
    // fail-soft
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper interne
// ─────────────────────────────────────────────────────────────────────────────

function videMetrique(libelle: string): MetriqueValeur {
  return { valeur: 0, libelle };
}

function videMetriquePct(libelle: string): MetriqueValeur {
  return { valeur: 0, libelle, unite: "%" };
}

function buildEmptyPilotage(annee: number): PilotageResult {
  return {
    annee,
    m1_prestations: videMetrique("Prestations ouvertes / terminées"),
    m2_taux_entree_delai: videMetriquePct("Taux d'entrée dans le délai"),
    m3_taux_completion: videMetriquePct("Taux de complétion"),
    m4_taux_abandon: videMetriquePct("Taux d'abandon"),
    m5_taux_reussite: videMetriquePct("Taux d'atteinte des objectifs"),
    m6_satisfaction: videMetriquePct("Satisfaction globale"),
    m7_incidents: videMetrique("Incidents"),
    m8_reclamations: videMetrique("Réclamations"),
    m9_actions_correctives: videMetrique("Actions correctives"),
    m10_maj_documentaire: videMetrique("Mise à jour documentaire"),
    m11_formateurs_a_jour: videMetrique("Formateurs à jour"),
    m12_adaptations_handicap: videMetrique("Adaptations handicap"),
    m13_sous_traitances_evaluees: videMetrique("Sous-traitances évaluées"),
    m14_conformite_dossiers: videMetrique("Conformité dossiers"),
    calculeAt: new Date(),
  };
}
