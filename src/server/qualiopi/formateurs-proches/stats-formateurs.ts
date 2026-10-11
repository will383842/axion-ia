/**
 * Statistiques internes des formateurs pour l'encadré « formateurs proches »
 * (lot L15c ; W6 C9, D-W6-3, D-W6-4, D-W6-8).
 *
 * - Une formation compte quand la session est RÉALISÉE et que le formateur en
 *   est le principal (clé de la session) ou y figure comme `principal` ou
 *   `co_formateur`. Un `assistant` ou un `tuteur_afest` ne compte pas.
 * - La satisfaction est la note « à chaud » (1 à 5) des stagiaires de ces
 *   sessions ; chaque animateur la reçoit. Affichée à partir de 5 avis, le
 *   seuil des indicateurs Qualiopi — en dessous, rien (jamais « 0 »).
 * - Un refus de mission n'entre dans AUCUN chiffre (R4) : seules les sessions
 *   réalisées sont lues.
 *
 * - Fenêtre : les 36 derniers mois (sessions commencées depuis), pour borner
 *   la lecture et parler de l'activité récente.
 * - ≠ compteur de la fiche formateur (`whereSessionsDuFormateur`, tous rôles,
 *   depuis l'origine) : l'écart est voulu et le libellé de l'encadré le dit.
 *
 * Deux requêtes au total, quel que soit le nombre de formateurs. Usage
 * interne seulement : jamais montré aux formateurs.
 */

import { SEUIL_FIABILITE } from "@/server/qualiopi/indicateurs/calcul";

import type { StatsFormateur } from "./classer";

export interface SessionLue {
  readonly id: string;
  readonly dateDebut: Date;
  readonly formateurPrincipalId: string | null;
  readonly animateurs: ReadonlyArray<{ readonly trainerId: string; readonly role: string }>;
}

export const FENETRE_STATS_MOIS = 36;

const ROLES_QUI_ANIMENT: ReadonlySet<string> = new Set(["principal", "co_formateur"]);

/** Les formateurs (parmi `ids`) qui ont animé la session. */
export function animateursDe(session: SessionLue, ids: ReadonlySet<string>): Set<string> {
  const out = new Set<string>();
  if (session.formateurPrincipalId && ids.has(session.formateurPrincipalId)) {
    out.add(session.formateurPrincipalId);
  }
  for (const a of session.animateurs) {
    if (ids.has(a.trainerId) && ROLES_QUI_ANIMENT.has(a.role)) out.add(a.trainerId);
  }
  return out;
}

/** Agrégation PURE : sessions réalisées et notes par session → stats par formateur. */
export function agregerStats(
  trainerIds: ReadonlyArray<string>,
  sessions: ReadonlyArray<SessionLue>,
  notesParSession: ReadonlyMap<string, ReadonlyArray<number>>,
): Map<string, StatsFormateur> {
  const ids = new Set(trainerIds);
  const acc = new Map<string, { n: number; notes: number[]; derniere: Date | null }>(
    trainerIds.map((id) => [id, { n: 0, notes: [], derniere: null }]),
  );
  for (const s of sessions) {
    const notes = notesParSession.get(s.id) ?? [];
    for (const t of animateursDe(s, ids)) {
      const a = acc.get(t)!;
      a.n += 1;
      a.notes.push(...notes);
      if (!a.derniere || s.dateDebut > a.derniere) a.derniere = s.dateDebut;
    }
  }
  return new Map(
    [...acc].map(([id, a]) => [
      id,
      {
        formationsRealisees: a.n,
        satisfaction:
          a.notes.length >= SEUIL_FIABILITE
            ? {
                moyenne:
                  Math.round((a.notes.reduce((x, y) => x + y, 0) / a.notes.length) * 10) / 10,
                avis: a.notes.length,
              }
            : null,
        derniereFormation: a.derniere,
      },
    ]),
  );
}

/** Le strict nécessaire du client Prisma. */
export interface LecteurStats {
  trainingSession: {
    findMany(args: unknown): Promise<
      Array<{
        id: string;
        dateDebut: Date;
        formateurPrincipalId: string | null;
        sessionFormateurs: Array<{ trainerId: string; role: string }>;
      }>
    >;
  };
  questionnaire: {
    findMany(
      args: unknown,
    ): Promise<Array<{ noteGlobale: number | null; enrollment: { sessionId: string } }>>;
  };
}

export async function statsFormateurs(
  db: LecteurStats,
  trainerIds: ReadonlyArray<string>,
  maintenant: Date,
): Promise<Map<string, StatsFormateur>> {
  if (trainerIds.length === 0) return new Map();
  const ids = [...trainerIds];
  const depuis = new Date(maintenant);
  depuis.setUTCMonth(depuis.getUTCMonth() - FENETRE_STATS_MOIS);
  const brutes = await db.trainingSession.findMany({
    where: {
      statut: "realisee",
      dateDebut: { gte: depuis },
      OR: [
        { formateurPrincipalId: { in: ids } },
        {
          sessionFormateurs: {
            some: { trainerId: { in: ids }, role: { in: [...ROLES_QUI_ANIMENT] } },
          },
        },
      ],
    },
    select: {
      id: true,
      dateDebut: true,
      formateurPrincipalId: true,
      sessionFormateurs: { select: { trainerId: true, role: true } },
    },
  });
  const sessions: SessionLue[] = brutes.map((s) => ({
    id: s.id,
    dateDebut: s.dateDebut,
    formateurPrincipalId: s.formateurPrincipalId,
    animateurs: s.sessionFormateurs,
  }));
  const notes = new Map<string, number[]>();
  if (sessions.length > 0) {
    const qs = await db.questionnaire.findMany({
      where: {
        type: "satisfaction_chaud",
        reponduAt: { not: null },
        noteGlobale: { not: null },
        enrollment: { sessionId: { in: sessions.map((s) => s.id) } },
      },
      select: { noteGlobale: true, enrollment: { select: { sessionId: true } } },
    });
    for (const q of qs) {
      if (q.noteGlobale === null) continue;
      const l = notes.get(q.enrollment.sessionId) ?? [];
      l.push(q.noteGlobale);
      notes.set(q.enrollment.sessionId, l);
    }
  }
  return agregerStats(ids, sessions, notes);
}
