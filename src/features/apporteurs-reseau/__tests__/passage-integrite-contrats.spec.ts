import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findMany: vi.fn(),
  lireR2: vi.fn(),
  configure: vi.fn(() => true),
  alerte: vi.fn(async (..._a: unknown[]) => true),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { apporteurReseau: { findMany: (...a: unknown[]) => h.findMany(...a) } },
}));
vi.mock("@/lib/r2-storage", () => ({
  getObjectBufferR2: (...a: unknown[]) => h.lireR2(...a),
  isR2Configured: () => h.configure(),
}));
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

beforeEach(() => {
  vi.clearAllMocks();
  h.configure.mockReturnValue(true);
});

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

  it("R2 non configuré → étape sautée, aucune alerte à tort", async () => {
    h.configure.mockReturnValue(false);
    h.findMany.mockResolvedValue([ligne("a")]);
    h.lireR2.mockResolvedValue(null);
    const b = await verifierIntegriteContrats(LUNDI);
    expect(b).toEqual({ verifies: 0, absents: 0, alteres: 0 });
    expect(h.findMany).not.toHaveBeenCalled();
    expect(h.alerte).not.toHaveBeenCalled();
  });

  it("l'étape est branchée dans le passage quotidien", () => {
    const src = readFileSync(join(__dirname, "..", "passage-quotidien.ts"), "utf8");
    expect(src).toContain('"integrite-contrats"');
    expect(src).toContain("verifierIntegriteContrats(maintenant)");
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
