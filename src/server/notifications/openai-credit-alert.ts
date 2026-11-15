/**
 * Alerte « crédit OpenAI épuisé » pour les appels d'EMBEDDINGS.
 *
 * Le texte s'arrête déjà via le kill switch du `quota-guard` ; les embeddings,
 * eux, échouaient en silence (fail-soft). Ce module détecte la même famille
 * d'erreurs (classifieur partagé) et prévient le fondateur dans le salon
 * « Technique » (catégorie MONITORING_ALERT → groupe system → TELEGRAM_CHAT_ID).
 *
 * Anti-doublon : au plus UNE alerte par 6 h, par Redis (clé de dédup du hub) ET
 * par mémoire de processus (si Redis est absent, le hub laisse passer) :
 * au plus une alerte par 6 h, par processus si Redis est absent.
 * Fail-open : ne lève jamais, ne contient aucune clé ni donnée personnelle.
 */

import { notify } from "@/server/notifications";
import { isOpenAiQuotaError, type OpenAiErrorFields } from "./openai-quota-error";

export const CREDIT_ALERT_TTL_SEC = 6 * 60 * 60;
export const CREDIT_ALERT_DEDUP_KEY = "openai-credit-epuise-embeddings";

export const CREDIT_ALERT_TEXT =
  "Crédit OpenAI épuisé : la recherche du site (embeddings) ne fonctionne plus.\n" +
  "À faire : recharger le crédit sur platform.openai.com (Billing).\n" +
  "Ce que ça bloque : la recherche sémantique du chatbot (il se rabat sur une recherche " +
  "par mots-clés) et son cache de réponses, l'ajout de nouveaux contenus à sa base, " +
  "la détection de doublons sémantiques des nouveaux articles et le calcul des " +
  "vecteurs des articles. L'écriture des textes n'est pas concernée par cette alerte.";

let dernierEnvoiMs = 0;

/** Échec d'envoi : prochain essai dans 5 min au plus tôt (et non à chaque requête). */
function reporterRessai(): void {
  dernierEnvoiMs = Date.now() - CREDIT_ALERT_TTL_SEC * 1000 + 5 * 60 * 1000;
}

/** Test uniquement. */
export function __resetCreditAlertMemory(): void {
  dernierEnvoiMs = 0;
}

export interface OpenAiHttpError extends OpenAiErrorFields {
  readonly status?: number | undefined;
}

/**
 * Extrait {type, code, message} d'un corps JSON d'erreur OpenAI
 * (`{ error: { type, code, message } }`) ; texte brut accepté en repli.
 */
export function parseOpenAiErrorBody(status: number, bodyText: string): OpenAiHttpError {
  try {
    const parsed = JSON.parse(bodyText) as { error?: OpenAiErrorFields };
    const e = parsed.error;
    if (e && typeof e === "object") {
      return { status, type: e.type, code: e.code, message: e.message ?? bodyText };
    }
  } catch {
    // corps non JSON
  }
  return { status, message: bodyText };
}

/**
 * Si l'erreur est un crédit épuisé / facturation refusée, envoie l'alerte
 * (anti-doublon 6 h). @returns true si une alerte vient d'être émise.
 */
export async function alerterSiCreditOpenAiEpuise(err: OpenAiHttpError): Promise<boolean> {
  try {
    // 402 = paiement requis ; sinon on exige un signe explicite de quota/billing.
    if (!(err.status === 402 || isOpenAiQuotaError(err))) return false;

    const now = Date.now();
    if (dernierEnvoiMs > 0 && now - dernierEnvoiMs < CREDIT_ALERT_TTL_SEC * 1000) return false;
    dernierEnvoiMs = now;

    const res = await notify({
      category: "MONITORING_ALERT",
      severity: "error",
      payload: { kind: "OPENAI_CREDIT_EPUISE", details: { legacyBody: CREDIT_ALERT_TEXT } },
      dedupKey: CREDIT_ALERT_DEDUP_KEY,
      dedupTtlSec: CREDIT_ALERT_TTL_SEC,
      sync: true,
      force: true,
    } as Parameters<typeof notify>[0]);
    if (!res.ok) reporterRessai(); // échec d'envoi : réessai différé (pas à chaque requête)
    return res.ok && res.deduped !== true;
  } catch {
    reporterRessai();
    return false;
  }
}
