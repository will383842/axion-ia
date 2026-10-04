/**
 * Worker BullMQ — import MENSUEL de la table IDCC → OPCO (INT-T60-A).
 *
 * Le 20 de chaque mois à 06:00 heure de Paris, télécharge la Table SIRET-OPCO
 * (SIRO) du mois sur data.gouv.fr, la lit EN FLUX et remplace le millésime de
 * `idcc_opco` dans une transaction (`financements/idcc-import.ts`). France
 * compétences publie le fichier du mois M vers la fin du mois M+3 (2026-06 le
 * 2026-09-24) : un passage le 20 prend le dernier paru ; un passage qui
 * retrouve le millésime en place n'écrit rien (import idempotent).
 *
 * Tout refus (réseau, HTTP ≠ 200, page HTML, fichier vide ou tronqué, libellé
 * OPCO inconnu) est journalisé et laisse la table INTACTE.
 *
 * 🔴 `AGENTS.md` — le WORKER atterrit ~50 min avant l'app, et c'est l'app qui
 * migre : ce code peut tourner sur une base sans `idcc_opco`. Le passage le
 * vérifie AVANT de télécharger, et rattrape encore `P2021` au cas où : log,
 * sortie propre, jamais de plantage. Charge du job : un horodatage, rien d'autre.
 *
 * Interrupteur : `IDCC_OPCO_IMPORT_ENABLED` (défaut ACTIF en production, COUPÉ
 * en test sauf "true" explicite — même modèle que le suivi entreprise A8).
 *
 * Marqueur de déploiement (`grep` dans le conteneur du worker) :
 * `opco-siro-import-worker`.
 */

import { Worker, type Job } from "bullmq";

import type {
  BaseIdccOpco,
  DependancesSiro,
  RessourceSiro,
  StatistiquesLectureSiro,
} from "@/server/qualiopi/financements/idcc-import";
import type { OpcoSiroImportJobData } from "@/server/queue/types";

export const OPCO_SIRO_IMPORT_QUEUE_NAME = "opco-siro-import";
const PREFIXE = "[opco-siro-import-worker]";

/** L'interrupteur, lu à chaque passage (jamais figé au build). */
export function importSiroActif(env: NodeJS.ProcessEnv = process.env): boolean {
  const brut = env["IDCC_OPCO_IMPORT_ENABLED"];
  if (brut === "false") return false;
  if (env["NODE_ENV"] === "test" || env["VITEST"] !== undefined) return brut === "true";
  return true;
}

/** Erreur Prisma ou Postgres « table inexistante » (fenêtre app/worker). */
export function estTableAbsente(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { code, message } = err as { code?: unknown; message?: unknown };
  if (code === "P2021" || code === "42P01") return true;
  return typeof message === "string" && /relation "idcc_opco\w*" does not exist/.test(message);
}

export interface DependancesPassageSiro {
  readonly db: BaseIdccOpco;
  readonly fetch: DependancesSiro["fetch"];
  /** Les deux tables sont-elles posées ? (lecture d'`information_schema`) */
  readonly tableDisponible: () => Promise<boolean>;
  readonly env?: NodeJS.ProcessEnv;
  readonly maintenant?: Date;
  readonly delaiApiMs?: number;
  readonly delaiFichierMs?: number;
}

export type IssuePassageSiro =
  | { readonly statut: "coupe" }
  | { readonly statut: "table_absente" }
  | { readonly statut: "refuse"; readonly motif: string }
  | {
      readonly statut: "deja_importe" | "importe";
      readonly lignes: number;
      readonly changements: number;
      readonly ressource: RessourceSiro;
      readonly statistiques: StatistiquesLectureSiro;
    };

/** Un passage complet, réseau et base INJECTÉS (testable sans réseau). */
export async function executerImportSiro(deps: DependancesPassageSiro): Promise<IssuePassageSiro> {
  if (!importSiroActif(deps.env)) {
    console.log(`${PREFIXE} coupé (IDCC_OPCO_IMPORT_ENABLED)`);
    return { statut: "coupe" };
  }
  if (!(await deps.tableDisponible())) {
    console.warn(`${PREFIXE} table idcc_opco absente (migration à venir), passage suivant`);
    return { statut: "table_absente" };
  }
  const {
    importerSiroDuMois,
    FichierIdccOpcoRefuse,
    ImportIdccOpcoRefuse,
    TelechargementSiroRefuse,
  } = await import("@/server/qualiopi/financements/idcc-import");
  try {
    const r = await importerSiroDuMois(deps.db, {
      fetch: deps.fetch,
      ...(deps.maintenant ? { maintenant: deps.maintenant } : {}),
      ...(deps.delaiApiMs !== undefined ? { delaiApiMs: deps.delaiApiMs } : {}),
      ...(deps.delaiFichierMs !== undefined ? { delaiFichierMs: deps.delaiFichierMs } : {}),
    });
    const changements = r.statut === "importe" ? r.changements : 0;
    const s = r.statistiques;
    console.log(
      `${PREFIXE} ${r.ressource.titre} (${r.ressource.url}) : ` +
        (r.statut === "importe"
          ? `${r.lignes} couple(s) importé(s), ${changements} changement(s) journalisé(s)` +
            (r.premierImport ? " — premier import" : "")
          : `millésime déjà en place (${r.lignes} couple(s)), rien écrit`) +
        ` ; ${s.lignes} ligne(s) lue(s), ${s.lignesSansCouple} sans IDCC ou OPCO, ` +
        `${s.lignesEchappement} sur valeur d'échappement, ${s.lignesInvalides} invalide(s)`,
    );
    return {
      statut: r.statut,
      lignes: r.lignes,
      changements,
      ressource: r.ressource,
      statistiques: s,
    };
  } catch (err) {
    if (estTableAbsente(err)) {
      console.warn(`${PREFIXE} table idcc_opco absente (migration à venir), passage suivant`);
      return { statut: "table_absente" };
    }
    if (
      err instanceof FichierIdccOpcoRefuse ||
      err instanceof ImportIdccOpcoRefuse ||
      err instanceof TelechargementSiroRefuse
    ) {
      console.error(`${PREFIXE} import REFUSÉ, table intacte : ${err.message}`);
      return { statut: "refuse", motif: err.message };
    }
    throw err;
  }
}

async function processJob(_job: Job<OpcoSiroImportJobData>): Promise<void> {
  // Import PARESSEUX : Prisma n'est chargé que dans le worker, au passage.
  const { prisma } = await import("@/lib/prisma");
  await executerImportSiro({
    db: prisma,
    fetch: (url, init) => fetch(url, init),
    tableDisponible: async () => {
      if (process.env["DATABASE_URL"]?.includes("stub.invalid")) return false;
      const lignes = await prisma.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n
        FROM information_schema.tables
        WHERE table_name IN ('idcc_opco', 'idcc_opco_changements')`;
      return lignes[0]?.n === 2;
    },
  });
}

let workerInstance: Worker<OpcoSiroImportJobData> | null = null;

export function startOpcoSiroImportWorker(): Worker<OpcoSiroImportJobData> {
  if (workerInstance) return workerInstance;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL not set — opco-siro-import-worker cannot start");

  workerInstance = new Worker<OpcoSiroImportJobData>(OPCO_SIRO_IMPORT_QUEUE_NAME, processJob, {
    connection: { url: redisUrl },
    concurrency: 1,
    // Téléchargement et lecture de 109 Mo : le verrou doit tenir le passage.
    lockDuration: 20 * 60_000,
    removeOnComplete: { count: 12 },
    removeOnFail: { count: 24 },
  });

  workerInstance.on("failed", (job, err) => {
    console.error(`${PREFIXE} job ${job?.id} en échec :`, err);
  });

  return workerInstance;
}
