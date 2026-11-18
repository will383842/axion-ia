/**
 * L'origine « methode-import » ne peut pas être posée par un appel d'ingestion.
 */
import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ create: vi.fn(async () => ({})), find: vi.fn(async () => null) }));
vi.mock("@/lib/prisma", () => ({
  prisma: { knowledgeIngestRequest: { findUnique: h.find, create: h.create } },
}));

import { ingestEntry, type IngestPayload } from "./ingest";

describe("ingestEntry : origine réservée", () => {
  it("refuse factoryId methode-import sans rien écrire", async () => {
    const r = await ingestEntry({
      idempotencyKey: "k1",
      source: { factoryId: "methode-import" },
    } as unknown as IngestPayload);
    expect(r).toMatchObject({ accepted: false, status: "rejected" });
    expect(h.create).not.toHaveBeenCalled();
    expect(h.find).not.toHaveBeenCalled();
  });
});
