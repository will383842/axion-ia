/**
 * Chantier OPCO A6 — saisie du DÉPÔT (fait par l'entreprise sur son espace
 * OPCO) et de la DATE DE L'ACCORD ÉCRIT, au travers des Server Actions.
 *
 * Le module `dossier-financement` est RÉEL : on vérifie que l'écriture reste
 * conditionnée au statut lu (verrou optimiste), que le statut ne bouge pas au
 * dépôt, et que le journal ne porte aucune donnée personnelle.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  findUniqueOrThrow: vi.fn(),
  updateMany: vi.fn(),
  log: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dossierFinancement: {
      findUniqueOrThrow: (...a: unknown[]) => h.findUniqueOrThrow(...a),
      updateMany: (...a: unknown[]) => h.updateMany(...a),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => h.log(...a),
}));

// La transaction de facturation exécute simplement le rappel sur le même client.
vi.mock("@/server/partners-sync/producteurs/facturation", () => ({
  emettreFinancementMisAJour: vi.fn(),
  transactionFaitFacturation: async (
    client: unknown,
    fn: (tx: unknown) => Promise<unknown>,
  ): Promise<unknown> => fn(client),
}));

import { enregistrerDepotDossierAction, transitionnerDossierAction } from "./facturation-hub";
import { requireHabilitation } from "@/server/actions/qualiopi/_guards";

const DOSSIER = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  h.updateMany.mockResolvedValue({ count: 1 });
});

describe("enregistrerDepotDossierAction", () => {
  it("pose depotFaitLe (jour, minuit UTC) et le n° OPCO, sans toucher au statut, et journalise", async () => {
    h.findUniqueOrThrow.mockResolvedValue({ statut: "a_monter", trainingSessionId: "s-1" });
    const r = await enregistrerDepotDossierAction({
      dossierId: DOSSIER,
      depotFaitLe: "2026-10-02",
      numeroDossierExterne: "ATL-2026-123",
    });
    expect(r).toEqual({ data: { dossierId: DOSSIER } });
    expect(requireHabilitation).toHaveBeenCalledWith("deposer_demande_financeur");

    const arg = h.updateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: DOSSIER, statut: "a_monter" });
    expect(arg.data["depotFaitLe"]).toEqual(new Date("2026-10-02T00:00:00.000Z"));
    expect(arg.data["numeroDossierExterne"]).toBe("ATL-2026-123");
    expect(arg.data).not.toHaveProperty("statut");

    const log = h.log.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(log["action"]).toBe("facturation.dossier.depot_saisi");
    expect(log["targetType"]).toBe("DossierFinancement");
    expect(log["targetId"]).toBe(DOSSIER);
    expect(log["changes"]).toEqual({
      depotFaitLe: "2026-10-02",
      numeroDossierExterne: "ATL-2026-123",
      trainingSessionId: "s-1",
    });
  });

  it("dossier clos → refus, aucune écriture", async () => {
    h.findUniqueOrThrow.mockResolvedValue({ statut: "clos", trainingSessionId: null });
    const r = await enregistrerDepotDossierAction({
      dossierId: DOSSIER,
      depotFaitLe: "2026-10-02",
    });
    expect("error" in r).toBe(true);
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(h.log).not.toHaveBeenCalled();
  });

  it("écriture concurrente (statut changé entre lecture et écriture) → erreur, pas de journal", async () => {
    h.findUniqueOrThrow.mockResolvedValue({ statut: "envoye", trainingSessionId: null });
    h.updateMany.mockResolvedValue({ count: 0 });
    const r = await enregistrerDepotDossierAction({
      dossierId: DOSSIER,
      depotFaitLe: "2026-10-02",
    });
    expect(r).toEqual({ error: expect.stringContaining("concurrente") });
    expect(h.log).not.toHaveBeenCalled();
  });

  it("date mal formée → refus", async () => {
    const r = await enregistrerDepotDossierAction({
      dossierId: DOSSIER,
      depotFaitLe: "02/10/2026",
    });
    expect("error" in r).toBe(true);
    expect(h.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe("transitionnerDossierAction — date de l'accord écrit", () => {
  it("accord_recu : accordEcritLe posé dans la MÊME écriture conditionnée, et journalisé", async () => {
    h.findUniqueOrThrow.mockResolvedValue({ statut: "envoye" });
    const r = await transitionnerDossierAction({
      dossierId: DOSSIER,
      vers: "accord_recu",
      accordEcritLe: "2026-09-30",
    });
    expect(r).toEqual({ data: { statut: "accord_recu" } });
    const arg = h.updateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: DOSSIER, statut: "envoye" });
    expect(arg.data["statut"]).toBe("accord_recu");
    expect(arg.data["accordEcritLe"]).toEqual(new Date("2026-09-30T00:00:00.000Z"));
    expect(arg.data["accordAt"]).toBeInstanceOf(Date);
    const log = h.log.mock.calls[0]?.[0] as { changes: Record<string, unknown> };
    expect(log.changes["accordEcritLe"]).toBe("2026-09-30");
  });

  it("accordEcritLe hors d'un passage à l'accord → refus, aucune écriture", async () => {
    h.findUniqueOrThrow.mockResolvedValue({ statut: "a_monter" });
    const r = await transitionnerDossierAction({
      dossierId: DOSSIER,
      vers: "envoye",
      accordEcritLe: "2026-09-30",
    });
    expect("error" in r).toBe(true);
    expect(h.updateMany).not.toHaveBeenCalled();
  });
});
