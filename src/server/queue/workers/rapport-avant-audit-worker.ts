// Rapport avant audit — worker (2026-11-02). File `rapport-avant-audit`, CONCURRENCE 1.
//
// Charge `{ rapportId }` et RIEN d'autre : jamais une réponse, un nom ou un extrait de base dans
// `job.data` (Redis, Sentry, journaux). Le worker relit tout en base (`traiterRapport`) ; l'état
// fait foi en base, la file n'est qu'un réveil. Le traitement ne finit jamais en échec BullMQ :
// l'échec est écrit sur la ligne (`statut = erreur`), lisible par Will.
//
// SIGTERM : l'appel d'IA suivant est refusé et la ligne en cours repasse `en_attente`, SANS
// erreur ; au démarrage, les lancements en suspens sont remis en file (`lancementsEnSuspens`).
// Patron : `kit-import-worker.ts`.

import { Worker } from "bullmq";

import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { enqueueRapportAvantAudit, RAPPORT_AVANT_AUDIT_QUEUE_NAME } from "@/server/queue/queues";
import { lancementsEnSuspens, remettreEnAttente } from "@/features/rapport-avant-audit/persistance";
import { depsParDefaut, traiterRapport } from "@/features/rapport-avant-audit/traitement";

export type RapportAvantAuditJobData = { rapportId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** La table n'existe pas encore (fenêtre app/worker) : rien à faire, on le dit. */
const estTableAbsente = (e: unknown): boolean => {
  const code = (e as { code?: unknown } | null)?.code;
  return code === "P2021" || code === "P2022";
};

let arret = false;
let courant: string | null = null;

/** Au démarrage : remet en file les lancements en attente ou abandonnés. Jamais bloquant. */
export async function reprendreRapportsEnSuspens(): Promise<number> {
  try {
    const ids = await lancementsEnSuspens();
    for (const id of ids) await enqueueRapportAvantAudit(id, { reprise: true });
    if (ids.length > 0) console.warn(`[rapport-avant-audit] ${ids.length} lancement(s) repris`);
    return ids.length;
  } catch (e) {
    if (!estTableAbsente(e)) {
      console.error(`[rapport-avant-audit] reprise impossible : ${(e as Error).name}`);
    }
    return 0;
  }
}

export function startRapportAvantAuditWorker(): Worker<RapportAvantAuditJobData, void, string> {
  const worker = new Worker<RapportAvantAuditJobData, void, string>(
    RAPPORT_AVANT_AUDIT_QUEUE_NAME,
    async (job) => {
      const { rapportId } = job.data;
      if (typeof rapportId !== "string" || !UUID.test(rapportId)) return;
      courant = rapportId;
      try {
        const issue = await traiterRapport(
          rapportId,
          depsParDefaut(() => arret),
        );
        // Un identifiant et une issue : jamais un contenu.
        console.log(`[rapport-avant-audit] rapport=${rapportId} issue=${issue}`);
      } catch (e) {
        const err = e instanceof Error ? e : new Error("erreur inconnue");
        if (estTableAbsente(err)) {
          console.warn(`[rapport-avant-audit] table absente : rapport=${rapportId} ignoré`);
          return;
        }
        // Le NOM seulement : jamais un message qui pourrait porter une réponse.
        console.error(`[rapport-avant-audit] rapport=${rapportId} : ${err.name}`);
        captureWorkerError("rapport-avant-audit", RAPPORT_AVANT_AUDIT_QUEUE_NAME, job, err);
      } finally {
        courant = null;
      }
    },
    {
      connection: getBullConnectionOrThrow(),
      concurrency: 1,
      // Un rapport dure plusieurs minutes : le verrou est renouvelé tant que le processus vit.
      lockDuration: 120_000,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[rapport-avant-audit-worker] failed: job=${job?.id}: ${err.name}`);
    captureWorkerError("rapport-avant-audit", RAPPORT_AVANT_AUDIT_QUEUE_NAME, job, err);
  });

  process.once("SIGTERM", () => {
    arret = true;
    const id = courant;
    if (id !== null) void remettreEnAttente(id).catch(() => undefined);
  });

  void reprendreRapportsEnSuspens();
  return worker;
}
