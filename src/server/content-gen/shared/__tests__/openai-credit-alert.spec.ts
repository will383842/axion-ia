/**
 * Alerte « crédit OpenAI épuisé » (embeddings) : erreur quota → alerte ;
 * autre erreur → silence ; anti-doublon 6 h ; branchement dans les 2 embedders fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const notifyMock = vi.fn();
vi.mock("@/server/notifications", () => ({
  notify: (...a: unknown[]) => notifyMock(...a),
}));
vi.mock("@/lib/knowledge/embeddings", () => ({
  generateEmbedding: vi.fn(),
  EmbeddingConfidentialityRefusal: class extends Error {},
}));

import {
  __resetCreditAlertMemory,
  alerterSiCreditOpenAiEpuise,
  CREDIT_ALERT_TEXT,
  CREDIT_ALERT_TTL_SEC,
  parseOpenAiErrorBody,
} from "@/server/notifications/openai-credit-alert";
import { embed } from "../../dedup/openai-embedder";
import { embedChatbotText } from "../../../chatbot/embeddings";

const QUOTA_BODY = JSON.stringify({
  error: {
    type: "insufficient_quota",
    code: "credit_balance_exhausted",
    message: "You have no credits remaining.",
  },
});

beforeEach(() => {
  notifyMock.mockReset();
  notifyMock.mockResolvedValue({ ok: true, channels: { telegram: "sent" } });
  __resetCreditAlertMemory();
  process.env["OPENAI_EMBEDDINGS_ENABLED"] = "true";
  process.env["OPENAI_API_KEY"] = "test-key";
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  delete process.env["OPENAI_EMBEDDINGS_ENABLED"];
  delete process.env["OPENAI_API_KEY"];
});

describe("alerterSiCreditOpenAiEpuise", () => {
  it("erreur quota → une alerte Technique en français, sans clé ni prénom", async () => {
    const sent = await alerterSiCreditOpenAiEpuise(parseOpenAiErrorBody(429, QUOTA_BODY));
    expect(sent).toBe(true);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    const arg = notifyMock.mock.calls[0]![0] as {
      category: string;
      dedupKey: string;
      dedupTtlSec: number;
      payload: { details: { legacyBody: string } };
    };
    expect(arg.category).toBe("MONITORING_ALERT");
    expect(arg.dedupTtlSec).toBe(6 * 3600);
    expect(arg.payload.details.legacyBody).toBe(CREDIT_ALERT_TEXT);
    expect(CREDIT_ALERT_TEXT).toContain("Crédit OpenAI épuisé");
    expect(CREDIT_ALERT_TEXT).toContain("platform.openai.com");
    expect(CREDIT_ALERT_TEXT).not.toMatch(/sk-|test-key/);
  });

  it("402 (paiement requis) → alerte", async () => {
    expect(await alerterSiCreditOpenAiEpuise({ status: 402, message: "payment required" })).toBe(
      true,
    );
  });

  it("autre erreur (rate limit transitoire, 500, 401) → aucune alerte", async () => {
    const rl = JSON.stringify({
      error: { type: "requests", code: "rate_limit_exceeded", message: "Rate limit reached" },
    });
    expect(await alerterSiCreditOpenAiEpuise(parseOpenAiErrorBody(429, rl))).toBe(false);
    expect(await alerterSiCreditOpenAiEpuise({ status: 500, message: "server error" })).toBe(false);
    expect(await alerterSiCreditOpenAiEpuise({ status: 401, message: "bad key" })).toBe(false);
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("anti-doublon : une seule alerte en 6 h, puis une nouvelle après", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T10:00:00Z"));
    const e = parseOpenAiErrorBody(429, QUOTA_BODY);
    expect(await alerterSiCreditOpenAiEpuise(e)).toBe(true);
    expect(await alerterSiCreditOpenAiEpuise(e)).toBe(false);
    vi.setSystemTime(new Date(Date.now() + (CREDIT_ALERT_TTL_SEC - 60) * 1000));
    expect(await alerterSiCreditOpenAiEpuise(e)).toBe(false);
    vi.setSystemTime(new Date(Date.now() + 120 * 1000));
    expect(await alerterSiCreditOpenAiEpuise(e)).toBe(true);
    expect(notifyMock).toHaveBeenCalledTimes(2);
  });

  it("dédoublonné par le hub (Redis) → pas compté comme envoyé", async () => {
    notifyMock.mockResolvedValue({ ok: true, deduped: true, channels: {} });
    expect(await alerterSiCreditOpenAiEpuise(parseOpenAiErrorBody(429, QUOTA_BODY))).toBe(false);
  });

  it("billing_not_active → reconnu comme crédit épuisé", async () => {
    expect(
      await alerterSiCreditOpenAiEpuise({ status: 400, code: "billing_not_active", message: "x" }),
    ).toBe(true);
  });

  it("après un échec d'envoi, un 2e appel immédiat n'appelle pas notify (réessai différé)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T10:00:00Z"));
    notifyMock.mockResolvedValue({ ok: false, channels: {} });
    const e = parseOpenAiErrorBody(429, QUOTA_BODY);
    expect(await alerterSiCreditOpenAiEpuise(e)).toBe(false);
    expect(await alerterSiCreditOpenAiEpuise(e)).toBe(false);
    expect(notifyMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date(Date.now() + 6 * 60 * 1000));
    expect(await alerterSiCreditOpenAiEpuise(e)).toBe(false);
    expect(notifyMock).toHaveBeenCalledTimes(2);
  });

  it("échec par exception : 2e appel immédiat n'appelle pas notify", async () => {
    notifyMock.mockRejectedValue(new Error("telegram down"));
    const e = parseOpenAiErrorBody(429, QUOTA_BODY);
    await alerterSiCreditOpenAiEpuise(e);
    await alerterSiCreditOpenAiEpuise(e);
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });

  it("ne lève jamais si l'envoi échoue", async () => {
    notifyMock.mockRejectedValue(new Error("telegram down"));
    await expect(alerterSiCreditOpenAiEpuise(parseOpenAiErrorBody(429, QUOTA_BODY))).resolves.toBe(
      false,
    );
  });
});

describe("branchement dans les appels d'embeddings", () => {
  it("chatbot : notify qui ne répond jamais ne bloque pas la requête visiteur", async () => {
    notifyMock.mockReturnValue(new Promise(() => {}));
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(QUOTA_BODY, { status: 429 }));
    await expect(embedChatbotText("question")).rejects.toThrow(/OpenAI HTTP 429/);
    expect(notifyMock).toHaveBeenCalledTimes(1);
  });

  it("embedder dédup : notify qui ne répond jamais ne bloque pas (retourne null)", async () => {
    notifyMock.mockReturnValue(new Promise(() => {}));
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(QUOTA_BODY, { status: 429 }));
    expect(await embed("texte")).toBeNull();
  });

  it("embedder dédup : 429 quota → null + alerte ; 500 → null sans alerte", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    f.mockResolvedValueOnce(new Response(QUOTA_BODY, { status: 429 }));
    expect(await embed("texte")).toBeNull();
    expect(notifyMock).toHaveBeenCalledTimes(1);

    notifyMock.mockClear();
    __resetCreditAlertMemory();
    f.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    expect(await embed("texte")).toBeNull();
    expect(notifyMock).not.toHaveBeenCalled();
  });

  it("embeddings chatbot : 429 quota → lève toujours ET alerte ; 500 → lève sans alerte", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    f.mockResolvedValueOnce(new Response(QUOTA_BODY, { status: 429 }));
    await expect(embedChatbotText("question")).rejects.toThrow(/OpenAI HTTP 429/);
    expect(notifyMock).toHaveBeenCalledTimes(1);

    notifyMock.mockClear();
    __resetCreditAlertMemory();
    f.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    await expect(embedChatbotText("question")).rejects.toThrow(/OpenAI HTTP 500/);
    expect(notifyMock).not.toHaveBeenCalled();
  });
});
