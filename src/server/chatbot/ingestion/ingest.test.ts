/**
 * Reconstruction de la base du chatbot : « jamais de base vide ».
 * Les embeddings (appels réseau) se font AVANT toute écriture ; la substitution
 * des chunks se fait dans UNE transaction.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IngestSource } from "@/server/chatbot/ingestion/seed-sources";

const { journal, tx, prismaMock } = vi.hoisted(() => {
  const journal: string[] = [];
  const sqlText = (s: TemplateStringsArray) => s.join("?").replace(/\s+/g, " ").trim();

  const tx = {
    $executeRaw: vi.fn(async (s: TemplateStringsArray) => {
      journal.push(`tx:${sqlText(s).split(" ")[0]}`);
      return 1;
    }),
  };
  const prismaMock = {
    $queryRaw: vi.fn(async () => [{ v: 3 }]),
    $executeRaw: vi.fn(async (s: TemplateStringsArray) => {
      journal.push(`hors-tx:${sqlText(s).split(" ")[0]}`);
      return 1;
    }),
    $transaction: vi.fn(async (fn: (t: typeof tx) => Promise<unknown>) => {
      journal.push("begin");
      const r = await fn(tx);
      journal.push("commit");
      return r;
    }),
  };
  return { journal, tx, prismaMock };
});
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/server/chatbot/tenant", () => ({
  getDefaultTenant: vi.fn(async () => ({ id: "t1" })),
}));
const embed = vi.hoisted(() => vi.fn());
vi.mock("@/server/chatbot/embeddings", () => ({ embedChatbotText: embed }));

import { ingestAllSources } from "@/server/chatbot/ingestion/ingest";

const src = (ref: string): IngestSource => ({
  sourceType: "faq",
  sourceRef: ref,
  categorie: "faq",
  contenu: `Contenu ${ref}.`,
  contexte: "FAQ",
  confidentiality: "public",
});

beforeEach(() => {
  journal.length = 0;
  vi.clearAllMocks();
  embed.mockReset();
});

describe("ingestAllSources — jamais de base vide", () => {
  it("panne d'embedding : aucune suppression, aucune transaction", async () => {
    embed.mockResolvedValueOnce({ embedding: [0.1] }).mockRejectedValueOnce(new Error("401"));
    await expect(ingestAllSources([src("a"), src("b")])).rejects.toThrow("401");
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(journal.filter((j) => j.includes("DELETE"))).toEqual([]);
    expect(journal).toEqual([]);
  });

  it("embedding de repli « -stub » : refus hors environnement de test, base intacte", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      embed.mockResolvedValue({ embedding: [0.1], modelVersion: "voyage-stub" });
      await expect(ingestAllSources([src("a")])).rejects.toThrow(/stub/);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(journal).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("aucun chunk à écrire : refuse de vider la base", async () => {
    await expect(ingestAllSources([])).rejects.toThrow();
    expect(journal).toEqual([]);
  });

  it("succès : suppression et insertions dans la même transaction, après tous les embeddings", async () => {
    embed.mockResolvedValue({ embedding: [0.1, 0.2] });
    const stats = await ingestAllSources([src("a"), src("b")]);
    expect(stats.chunks).toBe(2);
    expect(embed).toHaveBeenCalledTimes(2);
    expect(journal).toEqual(["begin", "tx:DELETE", "tx:INSERT", "tx:INSERT", "commit"]);
    expect(journal.some((j) => j.startsWith("hors-tx"))).toBe(false);
  });

  it("échec en cours de transaction : l'erreur remonte (la transaction annule tout)", async () => {
    embed.mockResolvedValue({ embedding: [0.1] });
    tx.$executeRaw
      .mockImplementationOnce(async () => 1) // DELETE
      .mockImplementationOnce(async () => {
        throw new Error("insert KO");
      });
    await expect(ingestAllSources([src("a")])).rejects.toThrow("insert KO");
    expect(journal).not.toContain("commit");
  });
});
