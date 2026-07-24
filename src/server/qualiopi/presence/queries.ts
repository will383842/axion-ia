/**
 * Qualiopi — Lectures serveur pour l'émargement et les créneaux de présence.
 *
 * Stub-safe (try/catch → [] / null). Jamais de `*OrThrow`.
 * Ces fonctions sont exclusivement appelées depuis des Server Components.
 */

import { prisma } from "@/lib/prisma";
import type { PresenceCreneau } from "../../../../prisma/generated/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types composés
// ─────────────────────────────────────────────────────────────────────────────

export interface SessionEmargementRow {
  session: {
    id: string;
    numero: string;
    titreSession: string | null;
    dateDebut: Date;
    dateFin: Date;
    dureeReelleHeures: number | null;
    modalite: string;
    statut: string;
    formationId: string;
    nbParticipantsPrevus: number;
    nbParticipantsReels: number | null;
  };
  enrollments: Array<{
    id: string;
    traineeId: string;
    statut: string;
    tauxPresencePct: number | null;
    emargementSigneAt: Date | null;
    trainee: {
      nom: string;
      prenom: string;
      email: string;
    };
  }>;
  creneaux: PresenceCreneau[];
  /**
   * Journées RÉELLEMENT animées (décision D14), ordonnées.
   *
   * Tableau vide = la session n'en déclare aucune et retombe sur
   * `dateDebut..dateFin` — ce qui n'est correct que si les journées se suivent.
   */
  jours: Array<{
    date: string;
    heureDebut: string;
    heureFin: string;
    /** Faux tant que ce sont les horaires PROPOSÉS à la création de la session. */
    horairesConfirmes: boolean;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectures
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Charge une session avec ses enrollments (stagiaire inclus) et tous les
 * créneaux de présence. Utilisé par la page d'émargement.
 * Stub-safe → null.
 */
export async function getSessionEmargement(
  sessionId: string,
): Promise<SessionEmargementRow | null> {
  try {
    const session = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: {
        enrollments: {
          // 🔴 OUBLI O3 DU PLAN — dissocier le filtre de LECTURE de celui
          // d'ÉCRITURE.
          //
          // Filtrer les abandons et exclus ici faisait DISPARAÎTRE de la grille
          // les créneaux et les signatures déjà apposés. C'est le cas le plus
          // fréquent en formation collective : quelqu'un suit deux jours sur
          // trois puis abandonne. Ces heures ont été réellement suivies, elles
          // sont facturables à l'OPCO, et leur preuve existe — la masquer revient
          // à s'en priver.
          //
          // On garde donc en lecture toute inscription qui a DÉJÀ un créneau,
          // quel que soit son statut. Le filtre d'écriture, lui, reste : on ne
          // crée pas de nouveaux créneaux pour quelqu'un qui a abandonné.
          where: {
            OR: [{ statut: { notIn: ["abandon", "exclu"] } }, { presences: { some: {} } }],
          },
          include: {
            trainee: {
              select: { nom: true, prenom: true, email: true },
            },
          },
          orderBy: [{ trainee: { nom: "asc" } }, { trainee: { prenom: "asc" } }],
        },
        jours: {
          select: { date: true, heureDebut: true, heureFin: true, horairesConfirmes: true },
          orderBy: { date: "asc" },
        },
      },
    });

    if (!session) return null;

    const creneaux = await prisma.presenceCreneau.findMany({
      where: { enrollmentId: { in: session.enrollments.map((e) => e.id) } },
      orderBy: [{ date: "asc" }, { demiJournee: "asc" }],
    });

    return {
      session: {
        id: session.id,
        numero: session.numero,
        titreSession: session.titreSession,
        dateDebut: session.dateDebut,
        dateFin: session.dateFin,
        dureeReelleHeures: session.dureeReelleHeures,
        modalite: session.modalite,
        statut: session.statut,
        formationId: session.formationId,
        nbParticipantsPrevus: session.nbParticipantsPrevus,
        nbParticipantsReels: session.nbParticipantsReels,
      },
      enrollments: session.enrollments.map((e) => ({
        id: e.id,
        traineeId: e.traineeId,
        statut: e.statut,
        tauxPresencePct: e.tauxPresencePct,
        emargementSigneAt: e.emargementSigneAt,
        trainee: {
          nom: e.trainee.nom,
          prenom: e.trainee.prenom,
          email: e.trainee.email,
        },
      })),
      creneaux,
      // `@db.Date` stocké à minuit UTC → `YYYY-MM-DD` sans conversion de fuseau.
      // Passer par `toLocaleDateString` décalerait la date d'un jour.
      jours: session.jours.map((j) => ({
        date: j.date.toISOString().slice(0, 10),
        heureDebut: j.heureDebut,
        heureFin: j.heureFin,
        horairesConfirmes: j.horairesConfirmes,
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Liste enrichie des sessions pour la page liste admin.
 * Charge le nombre d'inscrits + taux de présence moyen.
 * Stub-safe → [].
 */
export interface SessionListRow {
  id: string;
  numero: string;
  titreSession: string | null;
  formationId: string;
  dateDebut: Date;
  dateFin: Date;
  modalite: string;
  statut: string;
  nbInscrits: number;
  tauxPresenceMoyen: number | null;
}

export async function listSessionsForAdmin(): Promise<SessionListRow[]> {
  try {
    const sessions = await prisma.trainingSession.findMany({
      orderBy: { dateDebut: "desc" },
      include: {
        _count: { select: { enrollments: true } },
        enrollments: {
          select: { tauxPresencePct: true, statut: true },
          where: { statut: { notIn: ["abandon", "exclu"] } },
        },
      },
    });

    return sessions.map((s) => {
      const tauxValues = s.enrollments
        .map((e) => e.tauxPresencePct)
        .filter((v): v is number => v !== null);
      const tauxMoyen =
        tauxValues.length > 0
          ? Math.round(tauxValues.reduce((a, b) => a + b, 0) / tauxValues.length)
          : null;

      return {
        id: s.id,
        numero: s.numero,
        titreSession: s.titreSession,
        formationId: s.formationId,
        dateDebut: s.dateDebut,
        dateFin: s.dateFin,
        modalite: s.modalite,
        statut: s.statut,
        nbInscrits: s._count.enrollments,
        tauxPresenceMoyen: tauxMoyen,
      };
    });
  } catch {
    return [];
  }
}
