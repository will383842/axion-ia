// Garde-fous de coût (T-30, REQ-074) — cap mensuel par tenant + alertes + mode éco.
//
// On somme le coût LLM du mois (chat_messages.cout_estime) pour le tenant, et :
//   - à 80 % du cap → alerte Telegram (une fois / mois) ;
//   - à 100 %+      → MODE ÉCO : on cesse les appels LLM (chemin RAG/explication),
//     les chemins déterministes (catalogue/RDV) + le cache continuent (gratuits),
//     les questions ouvertes basculent vers un échange (RDV) au lieu d'un appel LLM.
//
// Le calcul est caché en Redis (TTL court) pour ne pas agréger la DB à chaque tour.
// Fail-soft : si Redis/DB indisponible, on NE bloque PAS (spend=0 → pas de mode éco).

import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { sendTelegram } from "@/lib/telegram";

const SPEND_CACHE_TTL_SEC = 60;

/** Début du mois courant (UTC). */
function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function monthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${now.getUTCMonth() + 1}`;
}

/** Coût LLM cumulé du mois pour un tenant (USD). Caché 60 s. Fail-soft → 0. */
export async function getMonthlySpend(tenantId: string): Promise<number> {
  const cacheKey = `chatbot:spend:${tenantId}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null && cached !== undefined) return Number(cached);
  } catch {
    /* fail-soft */
  }
  let spend = 0;
  try {
    const agg = await prisma.chatMessage.aggregate({
      _sum: { coutEstime: true },
      where: { createdAt: { gte: monthStart() }, conversation: { tenantId } },
    });
    spend = Number(agg._sum.coutEstime ?? 0);
  } catch {
    return 0; // fail-soft : pas de blocage si la DB hoquette
  }
  try {
    await redis.set(cacheKey, String(spend), "EX", SPEND_CACHE_TTL_SEC);
  } catch {
    /* fail-soft */
  }
  return spend;
}

export interface CostCapStatus {
  readonly spend: number;
  readonly cap: number;
  readonly ratio: number;
  /** true si le cap est atteint → mode éco (plus d'appels LLM). */
  readonly ecoMode: boolean;
}

/** Évalue l'état du cap pour un tenant (spend caché). */
export async function evaluateCostCap(tenantId: string, capUsd: number): Promise<CostCapStatus> {
  const spend = await getMonthlySpend(tenantId);
  const cap = capUsd > 0 ? capUsd : Infinity;
  const ratio = cap === Infinity ? 0 : spend / cap;
  return { spend, cap: capUsd, ratio, ecoMode: ratio >= 1 };
}

/** Envoie une alerte Telegram UNE fois par seuil et par mois (dédup Redis). */
async function alertOnce(tenantId: string, threshold: "80" | "100", body: string): Promise<void> {
  const key = `chatbot:costalert:${tenantId}:${monthKey()}:${threshold}`;
  try {
    const res = await redis.set(key, "1", "EX", 60 * 60 * 24 * 40, "NX");
    if (res === "OK") {
      await sendTelegram({ tag: "MONITORING", body, silent: false });
    }
  } catch {
    /* fail-soft */
  }
}

/** Déclenche les alertes 80 % / 100 % si les seuils sont franchis (best-effort). */
export async function maybeAlertCostThreshold(
  status: CostCapStatus,
  tenantId: string,
): Promise<void> {
  if (status.cap <= 0) return;
  if (status.ratio >= 1) {
    await alertOnce(
      tenantId,
      "100",
      `🚨 Chatbot : cap coût mensuel ATTEINT (${status.spend.toFixed(2)} / ${status.cap} USD) — mode éco activé (plus d'appels LLM).`,
    );
  } else if (status.ratio >= 0.8) {
    await alertOnce(
      tenantId,
      "80",
      `⚠️ Chatbot : 80 % du cap coût mensuel (${status.spend.toFixed(2)} / ${status.cap} USD).`,
    );
  }
}
