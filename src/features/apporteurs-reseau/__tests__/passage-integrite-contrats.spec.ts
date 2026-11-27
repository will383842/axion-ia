import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findMany: vi.fn(),
  lireR2: vi.fn(),
  alerte: vi.fn(async (..._a: unknown[]) => true),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { apporteurReseau: { findMany: (...a: unknown[]) => h.findMany(...a) } },
}));
vi.mock("@/lib/r2-storage", () => ({ getObjectBufferR2: (...a: unknown[]) => h.lireR2(...a) }));
vi.mock("../alerte-interne", () => ({ alerteInterne: (...a: unknown[]) => h.alerte(...a) }));

import {
  PLAFOND_INTEGRITE_CONTRATS,
  verifierIntegriteContrats,
} from "../passage-integrite-contrats";

const LUNDI = new Date("2026-11-30T10:00:00Z");
const MARDI = new Date("2026-12-01T10:00:00Z");
const PDF = Buffer.from("%PDF");
const sha = createHash("sha256").update(PDF).digest("hex");
const ligne = (id: string, s = sha) => ({ id, contratSigneCle: `c/${id}`, contratSigneSha256: s });

beforeEach(() => vi.clearAllMocks());

describe("passage « integrite-contrats »", () => {
  it("ne tourne que le lundi de Paris", async () => {
    h.findMany.mockResolvedValue([ligne("a")]);
    h.lireR2.mockResolvedValue(PDF);
    await verifierIntegriteContrats(MARDI);
    expect(h.findMany).not.toHaveBeenCalled();
    // Dimanche 23 h UTC = lundi 0 h 30 à Paris (heure d'hiver : 22 h UTC suffit).
    await verifierIntegriteContrats(new Date("2026-11-29T23:30:00Z"));
    expect(h.findMany).toHaveBeenCalledTimes(1);
  });

  it("plafond de 200 dossiers", async () => {
    h.findMany.mockResolvedValue([]);
    await verifierIntegriteContrats(LUNDI);
    expect(PLAFOND_INTEGRITE_CONTRATS).toBe(200);
    expect(h.findMany.mock.calls[0]![0]).toMatchObject({ take: 200 });
  });

  it("objet absent → alerte apporteur_contrat_absent", async () => {
    h.findMany.mockResolvedValue([ligne("a")]);
    h.lireR2.mockResolvedValue(null);
    const b = await verifierIntegriteContrats(LUNDI);
    expect(b.absents).toBe(1);
    expect(h.alerte).toHaveBeenCalledWith(
      expect.objectContaining({ code: "apporteur_contrat_absent", niveau: "critique" }),
    );
  });

  it("altéré → alerte apporteur_contrat_altere", async () => {
    h.findMany.mockResolvedValue([ligne("a")]);
    h.lireR2.mockResolvedValue(Buffer.from("autre"));
    const b = await verifierIntegriteContrats(LUNDI);
    expect(b.alteres).toBe(1);
    expect(h.alerte).toHaveBeenCalledWith(
      expect.objectContaining({ code: "apporteur_contrat_altere" }),
    );
  });

  it("conforme → silence", async () => {
    h.findMany.mockResolvedValue([ligne("a")]);
    h.lireR2.mockResolvedValue(PDF);
    const b = await verifierIntegriteContrats(LUNDI);
    expect(b).toEqual({ verifies: 1, absents: 0, alteres: 0 });
    expect(h.alerte).not.toHaveBeenCalled();
  });
});
