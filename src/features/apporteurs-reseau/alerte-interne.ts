/**
 * Réseau d'apporteurs — alerte INTERNE (Williams, console), partagée par le passage quotidien et
 * la validation par le dirigeant. Aucun `server-only` : tourne aussi dans le WORKER.
 */

import { destinataireAlertesInternes } from "@/lib/destinataires-internes";
import { enqueueEmail } from "@/server/queue/queues";

import { dejaEnvoye } from "./commissions";
import { signalerErreurReseau } from "./signaler";

/**
 * Alerte INTERNE (Williams, console), une seule fois par `jobId`. Jamais l'apporteur. Ne lève pas.
 * Rend vrai si l'alerte part maintenant.
 */
export async function alerteInterne(a: {
  jobId: string;
  code: string;
  titre: string;
  message: string;
  cibleType: string;
  cibleId: string;
  niveau?: "important" | "critique";
  /** Page de la console à ouvrir (défaut : les entreprises) ; doit commencer par `apporteurs`. */
  chemin?: string;
  maintenant: Date;
}): Promise<boolean> {
  try {
    if (await dejaEnvoye(a.jobId)) return false;
    const r = await enqueueEmail(
      "qualiopi-alerte-interne",
      destinataireAlertesInternes(),
      "fr",
      {
        niveau: a.niveau ?? "important",
        code: a.code,
        titre: a.titre,
        message: a.message,
        cibleType: a.cibleType,
        cibleId: a.cibleId,
        rubrique: "apporteurs",
        chemin: a.chemin ?? "apporteurs/entreprises",
        createdAt: a.maintenant.toLocaleDateString("fr-FR"),
      },
      { jobId: a.jobId, entityType: a.cibleType, entityId: a.cibleId },
    );
    return r.enqueued === true;
  } catch (err) {
    signalerErreurReseau(`alerte interne ${a.code}`, err);
    return false;
  }
}
