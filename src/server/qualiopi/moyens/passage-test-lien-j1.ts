/**
 * 🔴 CHANTIER QNC, LOT L07 — PASSAGE QUOTIDIEN « TEST DU LIEN DE VISIO À J-1 ».
 *
 * Éteint (`qualiopi.moyens.actif`), le passage ne lit rien d'autre que
 * l'interrupteur. En `essai`, seules les sessions `estTestInterne` sont testées.
 *
 * Une session distancielle PLANIFIÉE dont le début tombe demain (jour de Paris)
 * voit son lien Zoom testé ; le résultat est écrit au journal. Un test réussi
 * le jour même n'est pas refait ; un échec est retenté au passage suivant.
 * Aucune donnée personnelle dans les compteurs rendus ni dans les logs.
 */

import type { ClientJournal } from "@/server/journal/journaliser";
import { journaliser } from "@/server/journal/journaliser";
import { testLienDuAujourdhui } from "@/server/qualiopi/moyens/moyens-regles";
import { testerLienVisio, type Requeteur } from "@/server/qualiopi/moyens/test-lien-visio";
import { ACTION_TEST_LIEN } from "@/server/qualiopi/moyens/verification-moyens";
import { estActifPour, type EtatInterrupteur } from "@/server/qualiopi/socle/interrupteurs";

const HORIZON_MS = 60 * 60 * 60 * 1000;
const FENETRE_REUSSITE_MS = 20 * 60 * 60 * 1000;

export interface SessionATester {
  id: string;
  dateDebut: Date;
  lieuVisioUrl: string | null;
  estTestInterne: boolean;
}

export interface DepsPassageJ1 extends ClientJournal {
  trainingSession: {
    findMany(args: Record<string, unknown>): Promise<SessionATester[]>;
  };
  activityLog: ClientJournal["activityLog"] & {
    findFirst(args: Record<string, unknown>): Promise<unknown>;
  };
}

export interface BilanJ1 {
  allume: boolean;
  testees: number;
  reussis: number;
  alertes: number;
}

export async function passerTestLienJ1(
  deps: DepsPassageJ1,
  etat: EtatInterrupteur,
  maintenant: Date,
  requeteur?: Requeteur,
): Promise<BilanJ1> {
  const bilan: BilanJ1 = { allume: etat !== "eteint", testees: 0, reussis: 0, alertes: 0 };
  if (etat === "eteint") return bilan;

  const candidates = await deps.trainingSession.findMany({
    where: {
      statut: "planifiee",
      modalite: "distanciel",
      dateDebut: { gt: maintenant, lte: new Date(maintenant.getTime() + HORIZON_MS) },
    },
    select: { id: true, dateDebut: true, lieuVisioUrl: true, estTestInterne: true },
  });

  for (const s of candidates) {
    if (!estActifPour(etat, s) || !testLienDuAujourdhui(s.dateDebut, maintenant)) continue;
    const deja = await deps.activityLog.findFirst({
      where: {
        action: ACTION_TEST_LIEN,
        targetId: s.id,
        createdAt: { gte: new Date(maintenant.getTime() - FENETRE_REUSSITE_MS) },
        changes: { path: ["ok"], equals: true },
      },
      select: { id: true },
    });
    if (deja) continue;

    const r = await testerLienVisio(s.lieuVisioUrl, requeteur);
    bilan.testees++;
    if (r.ok) bilan.reussis++;
    else bilan.alertes++;
    await journaliser(
      deps,
      {
        action: ACTION_TEST_LIEN,
        targetType: "TrainingSession",
        targetId: s.id,
        changes: {
          ok: r.ok,
          ...(r.ok ? { statut: r.statut } : { raison: r.raison }),
          testeLe: maintenant.toISOString(),
        },
        session: null,
      },
      { exiger: true },
    );
  }
  return bilan;
}
