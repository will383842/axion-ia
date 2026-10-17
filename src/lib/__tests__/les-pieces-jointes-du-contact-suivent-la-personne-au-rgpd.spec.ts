// @vitest-environment node

/**
 * Art. 17 — les pièces jointes du formulaire de contact partent avec la
 * personne : l'objet R2 ET la ligne, retrouvés par l'EMPREINTE de la demande
 * (donc avant que l'anonymisation la remette à NULL — ordre lu dans la route).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  deleteFromR2: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { submissionAttachment: { findMany: h.findMany, deleteMany: h.deleteMany } },
}));
vi.mock("@/lib/r2-storage", () => ({ deleteFromR2: h.deleteFromR2 }));
vi.mock("@/lib/security/email-hash", () => ({ hashEmailForLookup: () => "empreinte-1" }));

import { erasePiecesJointesContactForEmail } from "../rgpd-erase";

beforeEach(() => {
  vi.clearAllMocks();
  h.deleteMany.mockResolvedValue({ count: 2 });
  h.deleteFromR2.mockResolvedValue(undefined);
});

describe("effacement art. 17 — pièces jointes du contact", () => {
  it("supprime les lignes ET les objets R2 des demandes de la personne", async () => {
    h.findMany.mockResolvedValue([
      { id: "p1", cleStockage: "contact/pieces-jointes/2026/s/a.pdf" },
      { id: "p2", cleStockage: "contact/pieces-jointes/2026/s/b.docx" },
    ]);
    const r = await erasePiecesJointesContactForEmail("camille@example.invalid");
    expect(r).toEqual({ supprimees: 2 });
    expect(h.findMany.mock.calls[0]![0].where.submission.OR).toContainEqual({
      contactEmailHash: "empreinte-1",
    });
    expect(h.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["p1", "p2"] } } });
    expect(h.deleteFromR2).toHaveBeenCalledTimes(2);
  });

  it("un objet R2 qui résiste n'arrête pas l'effacement", async () => {
    h.findMany.mockResolvedValue([
      { id: "p1", cleStockage: "k1" },
      { id: "p2", cleStockage: "k2" },
    ]);
    h.deleteFromR2.mockRejectedValueOnce(new Error("réseau"));
    await expect(erasePiecesJointesContactForEmail("x@example.invalid")).resolves.toEqual({
      supprimees: 2,
    });
    expect(h.deleteFromR2).toHaveBeenCalledTimes(2);
  });

  it("la route l'appelle AVANT l'anonymisation des demandes", () => {
    const route = readFileSync(join(process.cwd(), "src/app/api/gdpr-erase/route.ts"), "utf8");
    const pieces = route.indexOf("erasePiecesJointesContactForEmail(email)");
    const anonymisation = route.indexOf("eraseSubmissionsForEmail(email)");
    expect(pieces).toBeGreaterThan(0);
    expect(pieces).toBeLessThan(anonymisation);
  });
});
