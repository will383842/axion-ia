/**
 * Content Generator — Anthropic provider (Claude text + prompt caching).
 *
 * Sprint 1 Day 2 AGT-B step 13:00 — implémentation complète :
 * - streaming `stream: true`
 * - prompt caching `cache_control: { type: "ephemeral" }` sur system prompt
 *   (§ 9.11.3 — cache 5 min TTL Anthropic)
 * - retry × 3 backoff exp via withRetry
 * - timeout 60s (long-form Claude tolère)
 * - tracking cost atomic via trackCost
 * - cost cap check pré-call via assertCostCapAvailable
 * - cache_read_input_tokens + cache_creation_input_tokens trackés (économie réelle)
 *
 * Pricing 2026-05 (à mettre à jour si Anthropic change) :
 * - claude-sonnet-4-6 : $3.00 / 1M input · $15.00 / 1M output
 *                       cache_read = $0.30 / 1M (10× cheaper)
 *                       cache_write = $3.75 / 1M (25% premium 1ʳᵉ fois)
 * - claude-opus-4-7   : $15.00 / 1M input · $75.00 / 1M output
 *                       cache_read = $1.50 / 1M · cache_write = $18.75 / 1M
 *
 * Cf. _AUDIT/PROMPT-CONTENT-GENERATOR-MASTER-2026.md § 7.1 + § 9.11.3.
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  ProviderError,
  type GenerationRequest,
  type GenerationResponse,
  type IProvider,
} from "./IProvider";
import { withRetry } from "../lib/retry";
import { assertCostCapAvailable, trackCost } from "../lib/cost-tracker";
import { readProviderConfig } from "../lib/config-reader";
import { appelerAvecRotationCles, creerEtatCles, listerCles, type EnvCles } from "./anthropic-keys";

const DEFAULT_TIMEOUT_MS = 60_000; // 60s — long-form Claude

/**
 * Pricing table USD per token (input/output + cache). Stable enough V1.
 * V2 : déplacer en DB `ProviderConfig.extraConfig.pricing`.
 */
const PRICING: Record<
  string,
  | {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
    }
  // `null` = prix INCONNU : computeCost échoue plutôt que d'inventer un chiffre.
  | null
> = {
  // Famille 5.5. Tarifs de cache propres à chaque modèle (source : dépôt
  // studio-axion-ia-public, src/fournisseurs/claude/tarifs.ts lignes 31-32).
  "claude-opus-5-5": {
    input: 4.0 / 1_000_000,
    output: 20.0 / 1_000_000,
    cacheRead: 0.2 / 1_000_000,
    cacheWrite: 5.0 / 1_000_000,
  },
  "claude-sonnet-5-5": {
    input: 2.0 / 1_000_000,
    output: 10.0 / 1_000_000,
    cacheRead: 0.2 / 1_000_000,
    cacheWrite: 2.5 / 1_000_000,
  },
  // Haiku 5.5 : prix NON connu à ce jour -> volontairement `null`.
  "claude-haiku-5-5": null,
  "claude-sonnet-4-6": {
    input: 3.0 / 1_000_000,
    output: 15.0 / 1_000_000,
    cacheRead: 0.3 / 1_000_000,
    cacheWrite: 3.75 / 1_000_000,
  },
  // Opus 4.x — tarif réel Anthropic : $15 / $75 par 1M tokens (cache read
  // $1.50, cache write $18.75). Aligné sur le commentaire de doc en tête de
  // fichier ET sur src/server/clients/claude-search.ts (qui price déjà $15/$75).
  // NB : inerte côté content-gen (route GPT-4o → Sonnet ; Opus jamais
  // sélectionné par défaut) — c'est un cap de sécurité correct si on l'active.
  "claude-opus-4-8": {
    input: 15.0 / 1_000_000,
    output: 75.0 / 1_000_000,
    cacheRead: 1.5 / 1_000_000,
    cacheWrite: 18.75 / 1_000_000,
  },
  "claude-opus-4-7": {
    input: 15.0 / 1_000_000,
    output: 75.0 / 1_000_000,
    cacheRead: 1.5 / 1_000_000,
    cacheWrite: 18.75 / 1_000_000,
  },
  "claude-haiku-4-5": {
    input: 1.0 / 1_000_000,
    output: 5.0 / 1_000_000,
    cacheRead: 0.1 / 1_000_000,
    cacheWrite: 1.25 / 1_000_000,
  },
};

/** Exporté pour les tests. Lève si le prix du modèle est explicitement inconnu. */
/** Prix inconnu : entrée `null` OU toute variante (datée) de Haiku 5.5. */
function hasUnknownPrice(model: string): boolean {
  return PRICING[model] === null || model.startsWith("claude-haiku-5-5");
}

export function computeCost(
  model: string,
  tokensInput: number,
  tokensOutput: number,
  cacheRead: number,
  cacheWrite: number,
): number {
  if (hasUnknownPrice(model)) {
    throw new Error(`Anthropic : prix inconnu pour le modèle ${model} — calcul de coût refusé`);
  }
  const rates = PRICING[model] ?? PRICING["claude-sonnet-4-6"];
  if (!rates) return 0;
  return (
    tokensInput * rates.input +
    tokensOutput * rates.output +
    cacheRead * rates.cacheRead +
    cacheWrite * rates.cacheWrite
  );
}

/**
 * Exporté pour les tests — cf. `mapOpenAiError` dans `openai.ts`.
 * Recopie le statut HTTP d'origine (`status`) sur l'erreur rendue : la rotation de
 * clés en a besoin pour ne jamais prendre un 429 pour un crédit épuisé.
 */
export function mapAnthropicError(err: unknown): ProviderError {
  const mappee = mapAnthropicErrorBrut(err);
  if (err instanceof Anthropic.APIError && typeof err.status === "number") {
    (mappee as { status?: number }).status = err.status;
  }
  return mappee;
}

function mapAnthropicErrorBrut(err: unknown): ProviderError {
  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    if (status === 401 || status === 403) {
      return new ProviderError(`Anthropic auth: ${err.message}`, "auth_failed", "anthropic", false);
    }
    // Un 429 Anthropic est un rate-limit, POINT. Le crédit épuisé arrive en 400
    // (`invalid_request_error` « Your credit balance is too low ») ou en 402 —
    // jamais en 429.
    //
    // ⚠️ AUDIT 2026-07-21 (2e passe) — ce branchement DOIT précéder le test
    // quota ci-dessous, qui accepte le simple mot « billing ». Or le message de
    // rate-limit d'Anthropic renvoie lui-même vers la page « Plans & Billing » :
    // avec l'ordre inverse, un vrai rate-limit transitoire était classé
    // `quota_exhausted` NON-retryable et le job mourait alors qu'un simple
    // retry aurait abouti. C'est le bug corrigé pour OpenAI, à l'envers.
    // Ici on ne bascule en quota que sur une mention EXPLICITE de crédit.
    if (status === 429) {
      const isQuota = /credit balance is too low|insufficient[_-]quota/i.test(err.message);
      if (isQuota) {
        return new ProviderError(
          `Anthropic quota épuisé (compte à recharger) : ${err.message}`,
          "quota_exhausted",
          "anthropic",
          false,
        );
      }
      return new ProviderError(
        `Anthropic rate limited: ${err.message}`,
        "rate_limited",
        "anthropic",
        true,
      );
    }
    // Hors 429, le motif large reste justifié : c'est là qu'Anthropic signale
    // réellement le crédit épuisé (400 `invalid_request_error`, 402). Observé en
    // prod : 128 jobs échoués sous l'étiquette générique « Anthropic API 400 ».
    if (
      /credit balance is too low|billing|insufficient[_-]quota/i.test(err.message) ||
      status === 402
    ) {
      return new ProviderError(
        `Anthropic quota épuisé (compte à recharger) : ${err.message}`,
        "quota_exhausted",
        "anthropic",
        false,
      );
    }
    if (status && status >= 500) {
      return new ProviderError(`Anthropic server ${status}`, "down", "anthropic", true);
    }
    if (status === 400 && /content[_-]filter|policy/i.test(err.message)) {
      return new ProviderError(`Anthropic content filter`, "content_filter", "anthropic", false);
    }
    // Même piège que côté OpenAI : ici seulement, `status` peut manquer.
    return new ProviderError(
      status === undefined
        ? `Erreur Anthropic (sans code HTTP) : ${err.message}`
        : `Erreur Anthropic ${status} : ${err.message}`,
      "unknown",
      "anthropic",
      false,
    );
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new ProviderError(`Anthropic timeout`, "timeout", "anthropic", true);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new ProviderError(`Anthropic connection error`, "down", "anthropic", true);
  }
  return new ProviderError(
    `Anthropic unknown: ${err instanceof Error ? err.message : String(err)}`,
    "unknown",
    "anthropic",
    false,
  );
}

/**
 * État de rotation des clés : UN SEUL par processus (module), pour que les marques
 * « épuisée » survivent d'un appel à l'autre. Propre à chaque conteneur.
 */
const etatCles = creerEtatCles();

/** Consigne ajoutée au prompt système, UNIQUEMENT sur le chemin blog Claude + JSON. */
export const CONSIGNE_JSON_BLOG = "Réponds uniquement par un objet JSON valide, sans texte autour.";

/**
 * Analyseur JSON tolérant : accepte un objet JSON nu, entouré de ```json … ```, ou
 * précédé/suivi de texte. Rend le JSON propre (re-sérialisé) ou `null` s'il est
 * inexploitable. Exporté pour les tests.
 */
export function extraireJsonTolerant(texte: string): string | null {
  const essayer = (candidat: string): string | null => {
    try {
      const v: unknown = JSON.parse(candidat);
      return typeof v === "object" && v !== null ? JSON.stringify(v) : null;
    } catch {
      return null;
    }
  };
  const brut = texte.trim();
  const direct = essayer(brut);
  if (direct) return direct;
  const cloture = /```(?:json)?\s*([\s\S]*?)```/i.exec(brut);
  if (cloture?.[1]) {
    const r = essayer(cloture[1].trim());
    if (r) return r;
  }
  const debut = brut.indexOf("{");
  const fin = brut.lastIndexOf("}");
  if (debut !== -1 && fin > debut) return essayer(brut.slice(debut, fin + 1));
  return null;
}

function getClient(cleExplicite?: string): Anthropic {
  const apiKey = cleExplicite ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new ProviderError("ANTHROPIC_API_KEY not set", "auth_failed", "anthropic", false);
  }
  return new Anthropic({ apiKey, timeout: DEFAULT_TIMEOUT_MS });
}

export const anthropicProvider: IProvider = {
  key: "anthropic",
  supportedRoles: ["text"],

  async generate(req: GenerationRequest): Promise<GenerationResponse> {
    // Sorties AVANT tout appel réseau : avec une réservation déjà posée par la porte du
    // blog, rien n'a pu être facturé, on la solde à zéro (sinon elle resterait au max).
    const soldeZeroAvantAppel = async (): Promise<void> => {
      if (!req.reservationId) return;
      const { solderReservation } = await import("./blog-claude-ledger");
      await solderReservation(req.reservationId, 0, { input: 0, output: 0 });
    };

    if (req.role !== "text") {
      await soldeZeroAvantAppel();
      throw new ProviderError(
        `Anthropic supports text only (got '${req.role}')`,
        "unknown",
        "anthropic",
        false,
      );
    }

    let config: Awaited<ReturnType<typeof readProviderConfig>>;
    try {
      config = await readProviderConfig("anthropic");
    } catch (err) {
      await soldeZeroAvantAppel();
      throw err;
    }
    if (!config.enabled) {
      await soldeZeroAvantAppel();
      throw new ProviderError(
        "Anthropic provider disabled in DB",
        "auth_failed",
        "anthropic",
        false,
      );
    }
    const model = req.model ?? config.model;

    // Prix explicitement inconnu (Haiku 5.5) : on refuse AVANT le plafond de coût
    // et AVANT l'appel payant — sinon on dépenserait sans pouvoir comptabiliser.
    // Non retryable : réessayer ou basculer de fournisseur n'y change rien.
    if (hasUnknownPrice(model)) {
      await soldeZeroAvantAppel();
      throw new ProviderError(
        `Anthropic : prix inconnu pour le modèle ${model} — appel refusé avant dépense`,
        "invalid_response",
        "anthropic",
        false,
      );
    }

    // Chemin blog Claude : porte `blog-claude.ts` (rôle présent) ou ligne réservée.
    const cheminBlog = req.blogClaudeRole !== undefined || req.reservationId !== undefined;
    const reservationId = req.reservationId;

    // Avec réservation, le plafond a déjà été vérifié ET débité par `reserverCout` :
    // ne pas le revérifier ici (ce serait compter deux fois la marge d'estimation).
    if (!reservationId) {
      await assertCostCapAvailable("anthropic", 0.15);
    }

    const startedAt = Date.now();
    let tokensInput = 0;
    let tokensOutput = 0;
    let cacheReadInputTokens = 0;
    let cacheCreationInputTokens = 0;
    let fullText = "";
    let stopReason: string | null = null;
    // Pour le solde de la réservation : l'usage final est-il connu ? l'API a-t-elle
    // refusé la requête AVANT tout flux (donc rien de facturé) ?
    let usageFinalRecu = false;
    let refuseAvantFlux = false;
    // Vrai dès qu'UNE requête a été envoyée à l'API (toutes clés confondues). Faux =
    // rien n'a pu être facturé (clé absente, toutes les clés déjà épuisées…).
    let requeteEnvoyee = false;

    // Les modèles Claude 4.7+ (Opus 4.7/4.8, Sonnet 5, Fable 5, Mythos 5) REFUSENT
    // les paramètres d'échantillonnage : envoyer `temperature` déclenche un
    // 400 invalid_request_error. On ne transmet donc `temperature` qu'aux modèles
    // qui l'acceptent encore (Opus 4.6, Sonnet 4.6, Haiku 4.5 et antérieurs).
    const SAMPLING_PARAM_REJECTING_MODELS = new Set<string>([
      "claude-opus-4-8",
      "claude-opus-4-7",
      "claude-sonnet-5",
      "claude-sonnet-5-5",
      "claude-opus-5-5",
      "claude-fable-5",
      "claude-mythos-5",
    ]);
    const sendTemperature =
      req.temperature !== undefined && !SAMPLING_PARAM_REJECTING_MODELS.has(model);

    // Consigne JSON : UNIQUEMENT sur le chemin blog Claude (jamais pour les appelants
    // `preferredProvider` : Qualiopi, chatbot, baromètre…).
    const demandeJson = req.blogClaudeRole !== undefined && req.responseFormatJson === true;
    const textePrompt = demandeJson
      ? `${req.systemPrompt}\n\n${CONSIGNE_JSON_BLOG}`
      : req.systemPrompt;

    const executeCall = async (cle?: string) => {
      // Remise à zéro : un nouvel essai (autre clé ou retry) ne doit rien cumuler.
      fullText = "";
      tokensInput = 0;
      tokensOutput = 0;
      cacheReadInputTokens = 0;
      cacheCreationInputTokens = 0;
      stopReason = null;
      usageFinalRecu = false;
      // Le refus « avant flux » est PAR TENTATIVE : un refus de crédit sur la clé 1 ne
      // doit pas faire croire que la clé 2 (flux coupé, donc facturé) n'a rien coûté.
      refuseAvantFlux = false;
      let enFlux = false;
      try {
        const client = getClient(cle);
        requeteEnvoyee = true;
        const stream = await client.messages.create({
          model,
          max_tokens: req.maxTokens ?? 4096,
          ...(sendTemperature ? { temperature: req.temperature } : {}),
          // System avec prompt caching (cache 5 min TTL côté Anthropic)
          system: [
            {
              type: "text",
              text: textePrompt,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: req.userPrompt }],
          stream: true,
        });

        for await (const event of stream) {
          // Dès le premier événement la réponse est (en partie) facturée : plus de rejeu.
          enFlux = true;
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            const delta = event.delta.text;
            fullText += delta;
            if (req.onStreamChunk) req.onStreamChunk(delta);
          }
          if (event.type === "message_start" && event.message.usage) {
            tokensInput = event.message.usage.input_tokens;
            cacheReadInputTokens = event.message.usage.cache_read_input_tokens ?? 0;
            cacheCreationInputTokens = event.message.usage.cache_creation_input_tokens ?? 0;
          }
          if (event.type === "message_delta" && event.usage) {
            tokensOutput = event.usage.output_tokens;
            usageFinalRecu = true;
            if (event.delta?.stop_reason) {
              stopReason = event.delta.stop_reason;
            }
          }
        }
      } catch (err) {
        const mappee = err instanceof ProviderError ? err : mapAnthropicError(err);
        if (enFlux) (mappee as { enFlux?: boolean }).enFlux = true;
        else if (err instanceof Anthropic.APIError && typeof err.status === "number") {
          refuseAvantFlux = true;
        }
        throw mappee;
      }
    };

    // Rotation : seulement s'il existe PLUSIEURS clés. Clé unique = comportement
    // strictement identique à l'ancien (pas de marque « épuisée » de 24 h).
    const env = process.env as EnvCles;
    const rotation = listerCles(env, "content_gen").length > 1;
    const appel = rotation
      ? () =>
          appelerAvecRotationCles((cle) => executeCall(cle), {
            env,
            usage: "content_gen",
            etat: etatCles,
          })
      : () => executeCall();

    const coutReel = (): number =>
      computeCost(model, tokensInput, tokensOutput, cacheReadInputTokens, cacheCreationInputTokens);

    try {
      try {
        // Chemin blog : UN seul essai (chaque essai HTTP serait facturé).
        await withRetry(
          async () => {
            try {
              await appel();
            } catch (err) {
              throw err instanceof ProviderError ? err : mapAnthropicError(err);
            }
          },
          cheminBlog ? { maxAttempts: 1 } : {},
        );
      } catch (err) {
        throw err instanceof ProviderError ? err : mapAnthropicError(err);
      }

      if (stopReason === "max_tokens") {
        // Troncature LLM (audit 2026-06-25) : la sortie a atteint max_tokens = coupée.
        // On NE throw PAS (les gates word-count en aval gèrent) mais on rend la
        // troncature OBSERVABLE au lieu de la persister en silence (avant : « OK »).
        console.warn(
          `[anthropic] ⚠️ sortie TRONQUÉE (stop_reason="max_tokens", model=${model}, ` +
            `maxTokens=${req.maxTokens ?? 4096}, ${tokensOutput} tokens) — ` +
            `contenu potentiellement incomplet ; gates word-count en aval appliquées.`,
        );
      } else if (stopReason === "stop_sequence" || stopReason === "end_turn") {
        // OK
      } else if (stopReason === "tool_use" || stopReason === "pause_turn") {
        // OK pour V1 (tool_use pas utilisé V1)
      } else if (stopReason) {
        // refusal / autre — log warning
        console.warn(`[anthropic] unexpected stop_reason: ${stopReason}`);
      }
      if (!fullText) {
        throw new ProviderError(
          "Anthropic returned empty content",
          "invalid_response",
          "anthropic",
          false,
        );
      }

      let sortie = fullText;
      if (demandeJson) {
        const json = extraireJsonTolerant(fullText);
        if (stopReason === "max_tokens" && json === null) {
          // JSON coupé par la limite de jetons : inexploitable, et déjà facturé.
          throw new ProviderError(
            `Anthropic : sortie JSON tronquée (max_tokens=${req.maxTokens ?? 4096}) — inexploitable`,
            "invalid_response",
            "anthropic",
            false,
          );
        }
        if (json !== null) sortie = json;
        else console.warn("[anthropic] sortie JSON demandée mais non analysable (texte conservé)");
      }

      const costUsd = coutReel();
      const durationMs = Date.now() - startedAt;

      if (!reservationId) {
        await trackCost({
          ...(req.jobId ? { jobId: req.jobId } : {}),
          provider: "anthropic",
          model,
          tokensInput: tokensInput + cacheReadInputTokens + cacheCreationInputTokens,
          tokensOutput,
          costUsd,
        });
      }

      return {
        provider: "anthropic",
        model,
        output: sortie,
        tokensInput,
        tokensOutput,
        costUsd,
        durationMs,
        cacheReadInputTokens,
        cacheCreationInputTokens,
      };
    } finally {
      // UNE seule ligne par appel (réservée avant l'appel) : on la SOLDE ici, y compris
      // sur erreur et sur texte vide, jamais via `trackCost` (triple comptage sinon).
      if (reservationId) {
        const { solderReservation } = await import("./blog-claude-ledger");
        if (usageFinalRecu) {
          await solderReservation(reservationId, coutReel(), {
            input: tokensInput + cacheReadInputTokens + cacheCreationInputTokens,
            output: tokensOutput,
          });
        } else if (refuseAvantFlux || !requeteEnvoyee) {
          // Refus HTTP avant tout flux, ou aucune requête envoyée (clé absente, toutes
          // les clés déjà marquées épuisées) : rien n'a été facturé.
          await solderReservation(reservationId, 0, { input: 0, output: 0 });
        } else {
          // Coupure en cours de flux / délai : usage final inconnu. On GARDE la
          // réservation au coût maximal (on compte trop, jamais trop peu).
          console.warn(
            "[anthropic] usage final inconnu (flux interrompu) : réservation maximale conservée",
          );
        }
      }
    }
  },

  async healthCheck(): Promise<boolean> {
    if (!process.env.ANTHROPIC_API_KEY) return false;
    try {
      const config = await readProviderConfig("anthropic");
      if (!config.enabled) return false;
      // Anthropic ne propose pas d'endpoint /models, on fait un mini-call ($0.0001)
      const client = getClient();
      await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 5,
        messages: [{ role: "user", content: "Hi" }],
      });
      return true;
    } catch {
      return false;
    }
  },
};
