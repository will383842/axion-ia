/**
 * ART. 15 / ART. 17 EN UNE ACTION SUR LES DEUX SYSTÈMES (lot L4, plan §2.8.2).
 *
 * Le self-service RGPD du site (export, effacement) s'exécute D'ABORD
 * localement, puis prévient le CRM par ce canal — même signature HMAC que la
 * synchro sortante (`emit.ts`), même secret, même fenêtre d'horodatage.
 *
 * ── Règle cardinale : NON-BLOQUANT ──────────────────────────────────────────
 * Un CRM injoignable, lent, ou qui répond 503 (canal fermé — l'état NORMAL tant
 * que la bascule finale n'a pas eu lieu) ne doit JAMAIS faire échouer
 * l'opération locale. Une personne qui exerce son droit à l'effacement doit
 * l'obtenir sur le site, que le second système réponde ou non ; lui renvoyer une
 * erreur parce qu'un CRM inerte n'a pas répondu serait une régression de droit.
 *
 * Ce module ne lève donc jamais : il rend un compte rendu, que l'appelant
 * journalise et — pour l'export — fusionne sous la clé `crm` de l'export remis.
 *
 * 🔴 Corollaire à connaître : tant que le canal est fermé, l'effacement est
 * LOCAL SEULEMENT. Ce n'est pas un trou, c'est une conséquence du séquencement
 * (aucune donnée n'a encore été transmise au CRM tant que `CRM_SYNC_ENABLED`
 * est à OFF — il n'y a donc rien à y effacer). Le compte rendu le dit
 * explicitement plutôt que de laisser croire à un succès bi-système.
 */

import { crmSyncSecret, crmSyncUrl, isCrmSyncEnabled, CRM_SYNC_TIMEOUT_MS } from "./config";
import { signBody } from "./emit";

export type CrmGdprAction = "export" | "erase";

export type CrmGdprOutcome =
  /** Le CRM a traité la demande. `result` est son corps de réponse. */
  | { status: "ok"; result: unknown }
  /** Canal fermé (503) ou drapeau à OFF : rien à faire, et c'est normal. */
  | { status: "deferred"; detail: string }
  /** Le CRM était joignable mais a refusé, ou injoignable. */
  | { status: "failed"; detail: string };

export interface CrmGdprRequest {
  action: CrmGdprAction;
  /** `hashEmailForLookup(email)` — la clé qui traverse les deux systèmes. */
  personKey: string;
  email: string;
}

/**
 * Dérive l'URL du volet RGPD depuis celle de l'ingestion.
 * Pas de nouvelle variable d'environnement : une seule racine à configurer,
 * donc un seul endroit où se tromper.
 */
function crmGdprUrl(): string | null {
  const base = crmSyncUrl();
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/gdpr`;
}

export async function callCrmGdpr(request: CrmGdprRequest): Promise<CrmGdprOutcome> {
  if (!isCrmSyncEnabled()) {
    return {
      status: "deferred",
      detail: "canal CRM fermé (CRM_SYNC_ENABLED absent) — aucune donnée n'y a été transmise",
    };
  }

  const url = crmGdprUrl();
  const secret = crmSyncSecret();
  if (!url || !secret) {
    return { status: "deferred", detail: "configuration CRM incomplète (URL ou secret absent)" };
  }

  // Le corps signé est la chaîne EXACTE envoyée — jamais un objet re-sérialisé
  // de l'autre côté, sinon un simple changement d'ordre de clés invaliderait
  // la signature.
  const body = JSON.stringify({
    action: request.action,
    person_key: request.personKey,
    email: request.email,
    // Les deux univers à la fois : une demande RGPD ne se découpe pas par
    // workspace, la personne a droit à TOUT ce qui la concerne.
    scope: "both",
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Site-Timestamp": timestamp,
        "X-Site-Signature": signBody(secret, timestamp, body),
      },
      body,
      signal: AbortSignal.timeout(CRM_SYNC_TIMEOUT_MS),
    });

    if (response.ok) {
      const result = await response.json().catch(() => null);
      return { status: "ok", result };
    }

    // 503 = le CRM refuse TEMPORAIREMENT (volet RGPD pas encore ouvert). Comme
    // pour l'ingestion, ce n'est pas un échec : c'est l'état attendu avant la
    // bascule. On le distingue donc d'un vrai refus, pour que le journal ne
    // crie pas au loup pendant toute la phase inerte.
    if (response.status === 503) {
      return { status: "deferred", detail: "CRM indisponible (503) — sera traité à la bascule" };
    }

    return { status: "failed", detail: `HTTP ${response.status}` };
  } catch (error) {
    return {
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Enveloppe journalisée : le seul point d'entrée que les routes RGPD utilisent.
 *
 * 🔴 Leçon IndexNow appliquée : un report SILENCIEUX est indiscernable d'un
 * succès. Chaque issue est donc journalisée, y compris le report — l'absence de
 * nouvelles doit être visible, pas supposée.
 */
export async function propagateGdprToCrm(request: CrmGdprRequest): Promise<CrmGdprOutcome> {
  const outcome = await callCrmGdpr(request);

  if (outcome.status === "failed") {
    console.error(`[crm-sync/gdpr] ${request.action} non propagé au CRM : ${outcome.detail}`);
  } else if (outcome.status === "deferred") {
    console.warn(`[crm-sync/gdpr] ${request.action} différé : ${outcome.detail}`);
  }

  return outcome;
}
