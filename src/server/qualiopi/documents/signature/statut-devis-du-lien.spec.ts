/** Lien refusé : le statut du devis permet un message exact (devis refusé ≠ devis révisé). */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    documentSignatureToken: { findUnique: vi.fn() },
    devis: { findFirst: vi.fn(), count: vi.fn() },
  },
}));
vi.mock("@/lib/magic-token", () => ({ signMagicToken: vi.fn(), verifyMagicToken: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { verifyMagicToken } from "@/lib/magic-token";
import { statutDevisDuLien } from "./token-document";

const p = prisma as unknown as {
  documentSignatureToken: { findUnique: ReturnType<typeof vi.fn> };
  devis: { findFirst: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(verifyMagicToken).mockResolvedValue({ ok: true } as never);
  p.documentSignatureToken.findUnique.mockResolvedValue({ documentGenereId: "d1" });
  p.devis.count.mockResolvedValue(0);
});

describe("statutDevisDuLien", () => {
  it.each(["refuse", "expire"] as const)("devis %s", async (statut) => {
    p.devis.findFirst.mockResolvedValue({ id: "dv1", statut });
    expect(await statutDevisDuLien("t")).toBe(statut);
  });
  it("ancien lien d'un devis révisé → message version révisée conservé", async () => {
    p.devis.findFirst.mockResolvedValue({ id: "dv1", statut: "expire" });
    p.devis.count.mockResolvedValue(1);
    expect(await statutDevisDuLien("t")).toBe("autre");
    expect(p.devis.count).toHaveBeenCalledWith({ where: { replacesDevisId: "dv1" } });
  });
  it("devis refusé ayant un successeur → reste refuse", async () => {
    p.devis.findFirst.mockResolvedValue({ id: "dv1", statut: "refuse" });
    p.devis.count.mockResolvedValue(1);
    expect(await statutDevisDuLien("t")).toBe("refuse");
  });
  it("devis envoyé (lien remplacé) → autre", async () => {
    p.devis.findFirst.mockResolvedValue({ id: "dv1", statut: "envoye" });
    expect(await statutDevisDuLien("t")).toBe("autre");
  });
  it("jeton non authentique → null, sans lecture en base", async () => {
    vi.mocked(verifyMagicToken).mockResolvedValue({
      ok: false,
      reason: "malformed_payload",
    } as never);
    expect(await statutDevisDuLien("t")).toBeNull();
    expect(p.documentSignatureToken.findUnique).not.toHaveBeenCalled();
  });
  it("lien inconnu → null", async () => {
    p.documentSignatureToken.findUnique.mockResolvedValue(null);
    expect(await statutDevisDuLien("t")).toBeNull();
  });
});
