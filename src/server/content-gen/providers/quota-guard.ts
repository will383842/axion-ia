/**
 * Content Generator — Auto-halt sur épuisement de quota provider.
 *
 * Fix 2026-08-15 (audit e2e). Constat : entre le 09/07 et le 24/07, le compte
 * OpenAI s'est retrouvé sans crédit à trois reprises. À chaque fois, RIEN n'a
 * arrêté la production :
 *
 *  - le circuit breaker (`provider-router.ts`) ne fait que fail-fast chaque
 *    appel ; il ne remonte pas à l'orchestrateur, qui ré-enfile au tick suivant ;
 *  - l'auto-kill-switch du `cost-tracker` ne se déclenche que sur le plafond de
 *    dépense LOCAL — or un appel refusé pour quota ne coûte rien, donc ce
 *    plafond n'est jamais approché ;
 *  - seul le kill switch MANUEL pouvait stopper l'hémorragie.
 *
 * Résultat : ~1 500 jobs partis en `failed` pour une cause purement
 * administrative (solde à zéro), avec le bruit et le churn associés.
 *
 * Ce module ferme le trou : les erreurs PERMANENTES d'un provider (quota épuisé,
 * authentification refusée) sont comptées ; au-delà du seuil, le kill switch
 * global est activé automatiquement et une alerte part sur Telegram. Le premier
 * succès du provider remet le compteur à zéro.
 *
 * Choix volontaires :
 *  - on ne compte QUE les erreurs permanentes. Un rate-limit ou un 503 est
 *    transitoire : le retry et le circuit breaker sont là pour ça, couper la
 *    production serait une sur-réaction.
 *  - le kill switch posé à la main n'est JAMAIS écrasé (on ne touche pas à une
 *    raison saisie par un humain).
 *  - fail-open de bout en bout : ce garde-fou ne doit jamais faire échouer une
 *    génération qui, elle, fonctionnait.
 */

import {
  persistContentGenConfig,
  readContentGenConfigDirect,
  type KillSwitchState,
} from "../config-store";
import { alertGenerationHalted } from "../shared/content-gen-alerts";
import type { ProviderKey } from "../../../../prisma/generated/client";

/** Clé ContentGenConfig portant l'état du garde-fou. */
export const QUOTA_GUARD_CONFIG_KEY = "provider_quota_guard";

/** Clé ContentGenConfig du kill switch global (SSOT partagée avec l'admin). */
const KILL_SWITCH_KEY = "kill_switch";

/**
 * Nombre d'échecs permanents consécutifs avant coupure.
 *
 * 3 = assez haut pour absorber une erreur isolée (une clé en cours de rotation,
 * une réponse aberrante), assez bas pour couper en quelques minutes plutôt
 * qu'en quelques jours : à 96 ticks/jour, 3 échecs se constatent en < 15 min.
 */
export const QUOTA_HALT_THRESHOLD = 3;

/** Codes d'erreur provider considérés comme PERMANENTS (ne guérissent pas seuls). */
const PERMANENT_CODES = new Set(["quota_exhausted", "auth_failed"]);

/**
 * Providers dont la panne justifie de couper la production de contenu.
 * Aligné sur `ROLE_TO_PROVIDERS.text` (`provider-router.ts`) : la génération de
 * texte passe exclusivement par OpenAI (décision Will 2026-07-09). Un incident
 * Perplexity (rôle `data`) ou Unsplash (illustrations) dégrade le contenu mais
 * ne justifie pas d'arrêter la chaîne.
 */
const CRITICAL_PROVIDERS = new Set<string>(["openai"]);

interface QuotaGuardEntry {
  readonly consecutive: number;
  readonly code: string;
  readonly firstAt: string;
  readonly lastAt: string;
  readonly lastMessage: string;
}

export type QuotaGuardState = Partial<Record<string, QuotaGuardEntry>>;

export function isPermanentProviderCode(code: string | undefined): boolean {
  return code !== undefined && PERMANENT_CODES.has(code);
}

async function readGuardState(): Promise<QuotaGuardState> {
  const raw = await readContentGenConfigDirect<QuotaGuardState>(QUOTA_GUARD_CONFIG_KEY, {});
  return raw && typeof raw === "object" ? raw : {};
}

/**
 * Enregistre un échec PERMANENT d'un provider et coupe la production si le seuil
 * est atteint. No-op silencieux pour un code transitoire ou un provider non
 * critique.
 *
 * @returns true si le kill switch vient d'être activé par cet appel.
 */
export async function recordPermanentProviderFailure(
  provider: ProviderKey | string,
  code: string,
  message: string,
): Promise<boolean> {
  try {
    if (!isPermanentProviderCode(code)) return false;
    if (!CRITICAL_PROVIDERS.has(String(provider))) return false;

    const state = await readGuardState();
    const previous = state[String(provider)];
    const nowIso = new Date().toISOString();
    const consecutive = (previous?.consecutive ?? 0) + 1;

    const next: QuotaGuardState = {
      ...state,
      [String(provider)]: {
        consecutive,
        code,
        firstAt: previous?.firstAt ?? nowIso,
        lastAt: nowIso,
        lastMessage: message.slice(0, 500),
      },
    };
    await persistContentGenConfig(QUOTA_GUARD_CONFIG_KEY, next, "quota-guard");

    if (consecutive < QUOTA_HALT_THRESHOLD) {
      console.warn(
        `[quota-guard] ${provider} échec permanent ${consecutive}/${QUOTA_HALT_THRESHOLD} (${code})`,
      );
      return false;
    }

    // Ne jamais écraser un kill switch déjà posé (a fortiori s'il est manuel).
    const killSwitch = await readContentGenConfigDirect<KillSwitchState>(KILL_SWITCH_KEY, {
      active: false,
    });
    if (killSwitch.active) return false;

    const reason =
      code === "quota_exhausted"
        ? `Auto-arrêt : quota ${provider} épuisé (${consecutive} échecs consécutifs). Recharger le crédit puis désactiver ce kill switch.`
        : `Auto-arrêt : authentification ${provider} refusée (${consecutive} échecs consécutifs). Vérifier la clé API puis désactiver ce kill switch.`;

    await persistContentGenConfig(
      KILL_SWITCH_KEY,
      {
        active: true,
        reason,
        activatedAt: nowIso,
        auto: true,
      } satisfies KillSwitchState,
      "quota-guard",
      "Auto-arrêt sur panne permanente provider",
    );

    console.error(`[quota-guard] KILL SWITCH ACTIVÉ — ${reason}`);
    void alertGenerationHalted(String(provider), reason, message).catch(() => undefined);

    return true;
  } catch (err) {
    // Fail-open absolu : ce garde-fou ne doit jamais casser une génération.
    console.warn(
      "[quota-guard] enregistrement échoué (non bloquant):",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/**
 * Remet à zéro le compteur d'un provider après un appel réussi.
 * Ne touche PAS au kill switch : la reprise reste une décision explicite
 * (bouton admin), pour éviter tout redémarrage surprise.
 */
export async function clearProviderFailureStreak(provider: ProviderKey | string): Promise<void> {
  try {
    if (!CRITICAL_PROVIDERS.has(String(provider))) return;
    const state = await readGuardState();
    const entry = state[String(provider)];
    if (!entry || entry.consecutive === 0) return;
    const next: QuotaGuardState = { ...state };
    delete next[String(provider)];
    await persistContentGenConfig(QUOTA_GUARD_CONFIG_KEY, next, "quota-guard");
  } catch {
    // best-effort
  }
}
