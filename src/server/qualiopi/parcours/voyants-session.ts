/**
 * QNC L12 — les voyants d'UNE session pour l'écran (lecture seule).
 *
 * Même calcul que l'alerte : `chargerTracesVoyants` puis `construireVoyants`.
 * Une session d'essai n'a pas de traces chargées et rend quatorze `sans_objet`.
 * Ne lève jamais : une lecture en échec rend `null` (le panneau n'est qu'un confort
 * de lecture, la fiche ne tombe pas avec).
 */

import { prisma } from "@/lib/prisma";
import { chargerTracesVoyants } from "./charger-traces-voyants";
import { construireVoyants, type Voyant } from "./voyants-indicateurs";

export async function lireVoyantsSession(
  sessionId: string,
  maintenant: Date = new Date(),
): Promise<ReadonlyArray<Voyant> | null> {
  try {
    const s = await prisma.trainingSession.findUnique({
      where: { id: sessionId },
      select: { dateDebut: true, dateFin: true, estTestInterne: true, statut: true },
    });
    if (s === null || s.statut === "annulee" || s.statut === "reportee") return null;
    const traces = (await chargerTracesVoyants([sessionId], maintenant)).get(sessionId);
    return construireVoyants(traces, {
      dateDebut: s.dateDebut,
      dateFin: s.dateFin,
      estTestInterne: s.estTestInterne,
      maintenant,
    });
  } catch {
    return null;
  }
}
