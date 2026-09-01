/**
 * Régression AUDIT 2026-07-21 — mapping des erreurs provider vers `retryable`.
 *
 * Le bug corrigé : OpenAI renvoie **429 pour deux situations opposées**, et
 * l'ancien mapping les confondait toutes les deux en `rate_limited` retryable.
 * Conséquence observée en prod : 919 jobs en retry perpétuel sur un compte en
 * `insufficient_quota`, cause invisible partout.
 *
 * Ces tests verrouillent la seule chose qui compte vraiment ici : le flag
 * `retryable`. Se tromper coûte cher dans les deux sens —
 *   - quota classé retryable  → boucle de retry + slots de couverture perdus ;
 *   - rate-limit classé non-retryable → jobs tués alors qu'ils auraient abouti.
 */

import { describe, expect, it } from "vitest";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { mapOpenAiError } from "../openai";
import { mapAnthropicError } from "../anthropic";

/**
 * Les SDK Stainless (OpenAI comme Anthropic) construisent l'erreur à partir de
 * l'objet `error` **interne** du body : `err.code` vient de `error.code`, et
 * `err.message` vaut `` `${status} ${error.message}` `` (cf. `APIError.makeMessage`).
 * On reproduit donc cette forme exacte — c'est ce que les mappers voient en prod.
 */
function openAiError(status: number, error: { code?: string; message?: string; type?: string }) {
  return new OpenAI.APIError(status, error, undefined, undefined);
}

function anthropicError(status: number, error: { message?: string }) {
  return new Anthropic.APIError(status, error, undefined, undefined);
}

describe("mapOpenAiError — 429 quota vs 429 rate-limit", () => {
  it("429 `insufficient_quota` → quota_exhausted, NON retryable", () => {
    const mapped = mapOpenAiError(
      openAiError(429, {
        code: "insufficient_quota",
        message: "You exceeded your current quota, please check your plan and billing details.",
      }),
    );

    expect(mapped.code).toBe("quota_exhausted");
    expect(mapped.retryable).toBe(false);
  });

  it("429 rate-limit transitoire → rate_limited, RETRYABLE", () => {
    const mapped = mapOpenAiError(
      openAiError(429, {
        code: "rate_limit_exceeded",
        message: "Rate limit reached for gpt-4o in organization org-xxx on requests per min.",
      }),
    );

    expect(mapped.code).toBe("rate_limited");
    expect(mapped.retryable).toBe(true);
  });

  it("détecte le quota au message seul, même sans `code` exploitable", () => {
    // Le SDK ne remonte pas toujours `error.code` (proxies, réponses tronquées).
    // Le fallback regex est la seule défense restante dans ce cas.
    const mapped = mapOpenAiError(
      openAiError(429, {
        message: "You exceeded your current quota, please check your plan and billing.",
      }),
    );

    expect(mapped.code).toBe("quota_exhausted");
    expect(mapped.retryable).toBe(false);
  });

  it("conserve le message original du provider (il était écrasé avant le fix)", () => {
    // La régression d'origine : `new ProviderError('OpenAI rate limited', …)`
    // jetait err.message, donc la cause réelle n'apparaissait NI en base NI dans
    // les alertes. C'est ce qui a rendu la panne invisible pendant deux semaines.
    const mapped = mapOpenAiError(
      openAiError(429, { code: "rate_limit_exceeded", message: "Rate limit reached for gpt-4o" }),
    );

    expect(mapped.message).toContain("Rate limit reached for gpt-4o");
  });

  /**
   * Panne réelle du 2026-08-28 → 2026-09-01, relevée telle quelle en production.
   *
   * `insufficient_quota` est présent — mais dans `type`, pas dans `code`. Le
   * mapping ne lisait que `code`, et aucune des trois formes de message
   * cherchées n'apparaît dans « You have no credits remaining ». Résultat :
   * 429 classé RETRYABLE, garde-fou jamais appelé, 54 échecs sur 4 jours et
   * pas une alerte. Ce test est la panne, à l'octet près.
   */
  it("429 `credit_balance_exhausted` (solde prépayé à zéro) → quota_exhausted, NON retryable", () => {
    const mapped = mapOpenAiError(
      openAiError(429, {
        type: "insufficient_quota",
        code: "credit_balance_exhausted",
        message:
          "You have no credits remaining. Add credits to continue using the API at https://platform.openai.com/settings/organization/billing/.",
      }),
    );

    expect(mapped.code).toBe("quota_exhausted");
    expect(mapped.retryable).toBe(false);
  });

  it("le `type` seul suffit, même avec un `code` inconnu", () => {
    // OpenAI peut faire évoluer ses `code` (déjà deux libellés en six semaines).
    // Le champ canonique `type` est le point d'ancrage stable.
    const mapped = mapOpenAiError(
      openAiError(429, {
        type: "insufficient_quota",
        code: "un_code_inedit_2027",
        message: "Quelque chose d'inattendu.",
      }),
    );

    expect(mapped.code).toBe("quota_exhausted");
    expect(mapped.retryable).toBe(false);
  });

  it("un vrai rate-limit reste RETRYABLE malgré l'élargissement", () => {
    // Garde anti-sur-correction : élargir la détection de quota ne doit pas
    // faire basculer un throttling transitoire en échec sec. Les jobs
    // concernés auraient abouti au retry.
    const mapped = mapOpenAiError(
      openAiError(429, {
        type: "requests",
        code: "rate_limit_exceeded",
        message:
          "Rate limit reached for gpt-4o in organization org-x on tokens per min. Limit: 30000, Used: 29000.",
      }),
    );

    expect(mapped.code).toBe("rate_limited");
    expect(mapped.retryable).toBe(true);
  });

  it("401 reste auth_failed non-retryable (pas de régression collatérale)", () => {
    const mapped = mapOpenAiError(
      openAiError(401, { code: "invalid_api_key", message: "Incorrect API key provided" }),
    );

    expect(mapped.code).toBe("auth_failed");
    expect(mapped.retryable).toBe(false);
  });

  it("5xx reste down + retryable", () => {
    const mapped = mapOpenAiError(openAiError(503, { message: "Service Unavailable" }));

    expect(mapped.code).toBe("down");
    expect(mapped.retryable).toBe(true);
  });
});

describe("mapAnthropicError — crédit épuisé signalé en 400, pas en 429", () => {
  it("400 « credit balance is too low » → quota_exhausted, NON retryable", () => {
    const mapped = mapAnthropicError(
      anthropicError(400, {
        message: "Your credit balance is too low to access the Anthropic API.",
      }),
    );

    expect(mapped.code).toBe("quota_exhausted");
    expect(mapped.retryable).toBe(false);
  });

  it("429 sans mention de crédit → rate_limited, RETRYABLE", () => {
    const mapped = mapAnthropicError(
      anthropicError(429, {
        message: "Number of request tokens has exceeded your per-minute rate limit.",
      }),
    );

    expect(mapped.code).toBe("rate_limited");
    expect(mapped.retryable).toBe(true);
  });

  it("429 mentionnant « Plans & Billing » reste RETRYABLE (le piège inverse)", () => {
    // Régression 2026-07-21 : le motif quota acceptait le simple mot « billing »
    // et était testé AVANT le 429. Or les messages de rate-limit renvoient eux
    // aussi vers la page « Plans & Billing » → un rate-limit parfaitement
    // transitoire était classé non-retryable et le job mourait pour rien.
    const mapped = mapAnthropicError(
      anthropicError(429, {
        message:
          "Rate limit exceeded. For higher limits, see your Plans & Billing page to upgrade.",
      }),
    );

    expect(mapped.code).toBe("rate_limited");
    expect(mapped.retryable).toBe(true);
  });

  it("429 avec mention EXPLICITE de crédit → quota_exhausted quand même", () => {
    // Le 429 n'est pas le canal normal du crédit épuisé chez Anthropic, mais si
    // le message le dit explicitement, on ne retente pas pour rien.
    const mapped = mapAnthropicError(
      anthropicError(429, { message: "Your credit balance is too low to access the API." }),
    );

    expect(mapped.code).toBe("quota_exhausted");
    expect(mapped.retryable).toBe(false);
  });

  it("400 « billing » (hors 429) reste quota_exhausted — motif large conservé", () => {
    const mapped = mapAnthropicError(
      anthropicError(400, { message: "Please go to Plans & Billing to purchase credits." }),
    );

    expect(mapped.code).toBe("quota_exhausted");
    expect(mapped.retryable).toBe(false);
  });

  it("5xx reste down + retryable", () => {
    const mapped = mapAnthropicError(anthropicError(529, { message: "Overloaded" }));

    expect(mapped.code).toBe("down");
    expect(mapped.retryable).toBe(true);
  });
});
