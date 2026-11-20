// GEO V1-07 — journal structuré + alerte quand le signalement d'une page
// publiée à Bing (IndexNow ou API de soumission d'URL de Bing) échoue.
//
// Avant : un refus (le 403 de `api.indexnow.org`, en place depuis le 2026-08-11)
// n'était qu'une ligne `console.error` noyée ; personne n'était prévenu.
//
// Ce module ne fait QUE classer, journaliser et alerter. Le repli sur l'autre
// porte vit dans `signalerAuxMoteurs` (`@/lib/indexnow`), qui appelle ce module.
//
// Canal d'alerte : celui déjà utilisé par le site (`sendTelegram`, étiquette
// MONITORING). Rien de nouveau n'est créé.
//
// Anti-bruit : au plus UNE alerte par heure et par couple (moteur, type
// d'erreur). Le journal, lui, n'est jamais étouffé. Verrou Redis `SET NX EX`,
// avec repli en mémoire si Redis est indisponible. ⚠️ Ce repli est propre à chaque
// processus : site et worker étant deux conteneurs, Redis en panne peut laisser
// passer jusqu'à 2 alertes par heure et par type (pas de rafale pour autant).
//
// Aucune alerte au build : stubs Prisma/Redis (`stub.invalid`),
// `BULLMQ_DISABLED=true`, phase de build Next. Le journal reste émis.
import { sendTelegram } from "@/lib/telegram";

export type TypeErreurSignalement = "refus-4xx" | "erreur-5xx" | "timeout" | "reseau";
export type MoteurSignalement = "indexnow" | "bing";

export interface EchecSignalement {
  readonly moteur: MoteurSignalement;
  readonly type: TypeErreurSignalement;
  /** Code HTTP, `null` pour un timeout ou une panne réseau. */
  readonly statut: number | null;
  readonly detail: string;
  readonly nbUrls: number;
  readonly contexte: string;
  /** Ce qui a été fait de l'autre côté, en une phrase (pour l'alerte). */
  readonly repli: string;
}

export const FENETRE_ANTI_BRUIT_SEC = 3600;

/** Classe une erreur : par code HTTP s'il y en a un, sinon timeout ou réseau. */
export function classerErreur(statut: number | null, erreur?: unknown): TypeErreurSignalement {
  if (statut != null) return statut >= 500 ? "erreur-5xx" : "refus-4xx";
  const nom = erreur instanceof Error ? erreur.name : "";
  if (nom === "TimeoutError" || nom === "AbortError") return "timeout";
  return "reseau";
}

/** Vrai quand on ne doit PAS alerter : build, stubs, BullMQ coupé. */
export function alerteInhibee(): boolean {
  const env = process.env;
  return (
    env["BULLMQ_DISABLED"] === "true" ||
    env["NEXT_PHASE"] === "phase-production-build" ||
    (env["REDIS_URL"] ?? "").includes("stub.invalid") ||
    (env["DATABASE_URL"] ?? "").includes("stub.invalid")
  );
}

const vusEnMemoire = new Map<string, number>();

export function reinitialiserAntiBruit(): void {
  vusEnMemoire.clear();
}

/** Vrai si cette clé n'a pas déjà alerté dans la fenêtre (et la réserve). */
async function reserverCreneau(cle: string): Promise<boolean> {
  try {
    const { redis } = await import("@/lib/redis");
    const ok = await redis.set(cle, "1", "EX", FENETRE_ANTI_BRUIT_SEC, "NX");
    return ok === "OK";
  } catch {
    const maintenant = Date.now();
    const dernier = vusEnMemoire.get(cle);
    if (dernier != null && maintenant - dernier < FENETRE_ANTI_BRUIT_SEC * 1000) return false;
    vusEnMemoire.set(cle, maintenant);
    return true;
  }
}

function corpsAlerte(e: EchecSignalement): string {
  const code = e.statut != null ? `HTTP ${e.statut}` : e.type;
  return (
    `*[⚠️ SIGNALEMENT BING EN ÉCHEC]* ${e.moteur} — ${e.type} (${code}), ` +
    `${e.nbUrls} url(s), contexte « ${e.contexte} ».\n` +
    `Détail : ${e.detail.slice(0, 200)}.\n` +
    `Repli : ${e.repli}.\n` +
    `Une alerte au plus par heure et par type d'erreur.`
  );
}

/**
 * Journalise (toujours) puis alerte (au plus une fois par heure et par couple
 * moteur × type, jamais au build). Ne throw jamais.
 */
export async function alerterEchecSignalement(
  e: EchecSignalement,
): Promise<"envoyee" | "etouffee" | "inactive"> {
  // Journal structuré : une ligne JSON, filtrable par `evenement`.
  console.error(
    "[signalement-moteur] " +
      JSON.stringify({
        evenement: "signalement-moteur",
        moteur: e.moteur,
        type: e.type,
        statut: e.statut,
        nbUrls: e.nbUrls,
        contexte: e.contexte,
        repli: e.repli,
        detail: e.detail.slice(0, 200),
      }),
  );
  try {
    if (alerteInhibee()) return "inactive";
    if (!(await reserverCreneau(`alerte:signalement-moteur:${e.moteur}:${e.type}`))) {
      return "etouffee";
    }
    await sendTelegram({ tag: "MONITORING", body: corpsAlerte(e) });
    return "envoyee";
  } catch {
    // Une alerte ne doit jamais faire échouer une publication.
    return "inactive";
  }
}
