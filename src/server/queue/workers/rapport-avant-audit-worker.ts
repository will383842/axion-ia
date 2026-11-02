// Rapport avant audit — worker (2026-11-02). File `rapport-avant-audit`, CONCURRENCE 1.
//
// Charge `{ rapportId }` et RIEN d'autre : jamais une réponse, un nom ou un extrait de base dans
// `job.data` (Redis, Sentry, journaux). Le worker relit tout en base (`traiterRapport`) ; l'état
// fait foi en base, la file n'est qu'un réveil. Le traitement ne finit jamais en échec BullMQ :
// l'échec est écrit sur la ligne (`statut = erreur`), lisible par Will.
//
// SIGTERM : le drapeau `arret` SEUL. L'appel d'IA déjà parti va au bout ; le suivant est refusé
// et c'est `traiterRapport` (qui tient le jeton de la prise) qui remet la ligne `en_attente`, SANS
// erreur. Le gestionnaire ne touche jamais la base : il effacerait un rapport en train de finir.
// Au démarrage PUIS toutes les 10 minutes, les lancements en suspens (en attente, ou en cours
// sans nouvelles depuis 30 min : plantage) sont remis en file (`lancementsEnSuspens`).
// Patron : `kit-import-worker.ts`.

import { Worker } from "bullmq";

import { getBullConnectionOrThrow } from "../connection";
import { captureWorkerError } from "@/server/queue/lib/sentry-worker";
import { enqueueRapportAvantAudit, RAPPORT_AVANT_AUDIT_QUEUE_NAME } from "@/server/queue/queues";
import { lancementsEnSuspens } from "@/features/rapport-avant-audit/persistance";
import { depsParDefaut, traiterRapport } from "@/features/rapport-avant-audit/traitement";

export type RapportAvantAuditJobData = { rapportId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** La table n'existe pas encore (fenêtre app/worker) : rien à faire, on le dit. */
const estTableAbsente = (e: unknown): boolean => {
  const code = (e as { code?: unknown } | null)?.code;
  return code === "P2021" || code === "P2022";
};

let arret = false;

/** Intervalle du balayage des lancements en suspens. */
export const BALAYAGE_SUSPENS_MS = 10 * 60_000;

/** Vrai une fois SIGTERM reçu (lu par le traitement avant chaque appel d'IA). */
export function arretDemande(): boolean {
  return arret;
}

/**
 * Gestionnaire de SIGTERM : lève le drapeau et arrête le balayage. RIEN d'autre — surtout pas
 * d'écriture en base (voir l'en-tête).
 */
export function surArret(balayage: ReturnType<typeof setInterval> | null): void {
  arret = true;
  if (balayage !== null) clearInterval(balayage);
}

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
      try {
        const issue = await traiterRapport(rapportId, depsParDefaut(arretDemande));
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

  // Balayage répété : un plantage (conteneur tué sans SIGTERM) ne bloque jamais une fiche.
  const balayage = setInterval(() => {
    if (!arret) void reprendreRapportsEnSuspens();
  }, BALAYAGE_SUSPENS_MS);
  balayage.unref?.();
  worker.on("closed", () => clearInterval(balayage));

  process.once("SIGTERM", () => surArret(balayage));

  void reprendreRapportsEnSuspens();
  return worker;
}
