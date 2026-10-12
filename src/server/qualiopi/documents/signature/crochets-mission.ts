/**
 * Crochets du parcours formateur appelés APRÈS une signature (S6a, a ; branchés
 * par le lot L11c).
 *
 * `apresSignature` est le seul endroit où une signature produit ses effets ;
 * les lots de la lettre de mission (ADR 0066 étape 10) s'y branchent ICI, et
 * nulle part ailleurs :
 *
 *   - `lettreDue` : une pièce engageante vient d'être intégralement signée.
 *     Chaque mission ACCEPTÉE de la session est réévaluée par le moteur
 *     (`moteur-mission.ts`), qui émet la lettre si elle est due.
 *   - `reevaluerMission` : une lettre de mission a reçu une signature ; sa
 *     mission est réévaluée.
 *
 * 🔑 Interrupteurs `formateurs.lettre_auto` et `formateurs.lettre_v2` coupés :
 * le moteur ne lit rien et ne fait rien (comportement d'avant L11c).
 *
 * ⚠️ Un crochet ne lève jamais vers son appelant : `apresSignature` encapsule.
 */

import { prisma } from "@/lib/prisma";
import {
  moteurAllume,
  reevaluerMission as reevaluer,
  reevaluerMissionsDeLaSession,
} from "@/server/qualiopi/formateurs-independants/moteur-mission";

export async function lettreDue(documentGenereId: string): Promise<void> {
  if (!(await moteurAllume())) return;
  const piece = await prisma.documentGenere.findUnique({
    where: { id: documentGenereId },
    select: { sessionId: true },
  });
  if (piece?.sessionId == null) return;
  await reevaluerMissionsDeLaSession(piece.sessionId, "convention", new Date());
}

export async function reevaluerMission(documentGenereId: string): Promise<void> {
  if (!(await moteurAllume())) return;
  const mission = await prisma.missionFormateur.findFirst({
    where: { lettreMissionId: documentGenereId },
    select: { id: true },
  });
  if (mission === null) return;
  await reevaluer(mission.id, "signature_lettre", new Date());
}
