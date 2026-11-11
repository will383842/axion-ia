// T-26/T-27 — Cache sémantique (lookup / write / repli gracieux).

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TenantSettings } from "@/server/chatbot/constants";

const queryRaw = vi.fn();
const executeRaw = vi.fn();
const generateEmbedding = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
    $executeRaw: (...a: unknown[]) => executeRaw(...a),
  },
}));
vi.mock("@/lib/knowledge/embeddings", () => ({
  generateEmbedding: (...a: unknown[]) => generateEmbedding(...a),
}));

import {
  DECALAGE_VERSION_KB_UNIFIEE,
  lookupSemanticCache,
  versionDeCle,
  writeSemanticCache,
} from "@/server/chatbot/semantic-cache/cache";

const settings = {
  cache: { enabled: true, similarityThreshold: 0.92, ttlHours: 24 },
} as unknown as TenantSettings;
const settingsOff = {
  cache: { enabled: false, similarityThreshold: 0.92, ttlHours: 24 },
} as unknown as TenantSettings;

beforeEach(() => {
  queryRaw.mockReset();
  executeRaw.mockReset();
  generateEmbedding.mockReset();
  generateEmbedding.mockResolvedValue({ embedding: [0.1, 0.2, 0.3] });
});

describe("lookupSemanticCache", () => {
  it("no-op si cache désactivé", async () => {
    const r = await lookupSemanticCache("t1", "question", settingsOff);
    expect(r).toBeNull();
    expect(generateEmbedding).not.toHaveBeenCalled();
  });

  it("repli gracieux si embedding indisponible (Voyage down)", async () => {
    generateEmbedding.mockRejectedValue(new Error("401"));
    const r = await lookupSemanticCache("t1", "question", settings);
    expect(r).toBeNull();
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("hit (sim ≥ seuil) → renvoie la réponse + incrémente hits", async () => {
    queryRaw
      .mockResolvedValueOnce([{ v: 1 }]) // currentKnowledgeVersion
      .mockResolvedValueOnce([
        {
          id: "row-1",
          reponse: "Réponse cachée",
          sources: [{ sourceType: "faq", sourceRef: "x" }],
          sim: 0.95,
        },
      ]);
    executeRaw.mockResolvedValue(1);
    const r = await lookupSemanticCache("t1", "question", settings);
    expect(r).toEqual({
      reponse: "Réponse cachée",
      sources: [{ sourceType: "faq", sourceRef: "x" }],
    });
    expect(executeRaw).toHaveBeenCalledOnce(); // hits++
  });

  it("miss (sim < seuil) → null, pas d'incrément", async () => {
    queryRaw
      .mockResolvedValueOnce([{ v: 1 }])
      .mockResolvedValueOnce([{ id: "row-1", reponse: "x", sources: [], sim: 0.5 }]);
    const r = await lookupSemanticCache("t1", "question", settings);
    expect(r).toBeNull();
    expect(executeRaw).not.toHaveBeenCalled();
  });
});

describe("versionDeCle — l'interrupteur CHATBOT_KB_UNIFIED entre dans la clé de cache", () => {
  it("éteint : version inchangée ; allumé (valeur exacte « true ») : version décalée", () => {
    expect(versionDeCle(3, {})).toBe(3);
    expect(versionDeCle(3, { CHATBOT_KB_UNIFIED: "1" })).toBe(3);
    expect(versionDeCle(3, { CHATBOT_KB_UNIFIED: "true" })).toBe(3 + DECALAGE_VERSION_KB_UNIFIEE);
  });

  it("le lookup interroge la version décalée quand l'interrupteur est allumé", async () => {
    vi.stubEnv("CHATBOT_KB_UNIFIED", "true");
    try {
      queryRaw.mockResolvedValueOnce([{ v: 1 }]).mockResolvedValueOnce([]);
      await lookupSemanticCache("t1", "question", settings);
      const valeurs = queryRaw.mock.calls[1]?.slice(1) as unknown[];
      expect(valeurs).toContain(1 + DECALAGE_VERSION_KB_UNIFIEE);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("writeSemanticCache", () => {
  it("no-op si cache désactivé", async () => {
    await writeSemanticCache("t1", "q", { reponse: "r", sources: [] }, settingsOff);
    expect(executeRaw).not.toHaveBeenCalled();
  });

  it("insère l'entrée (embedding + version + TTL)", async () => {
    queryRaw.mockResolvedValueOnce([{ v: 1 }]); // currentKnowledgeVersion
    executeRaw.mockResolvedValue(1);
    await writeSemanticCache("t1", "q", { reponse: "r", sources: [] }, settings);
    expect(executeRaw).toHaveBeenCalledOnce();
  });

  it("repli gracieux si embedding indisponible → pas d'insert", async () => {
    generateEmbedding.mockRejectedValue(new Error("401"));
    await writeSemanticCache("t1", "q", { reponse: "r", sources: [] }, settings);
    expect(executeRaw).not.toHaveBeenCalled();
  });
});
