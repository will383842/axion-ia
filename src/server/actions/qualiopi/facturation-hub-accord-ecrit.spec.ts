/**
 * Lot OPCO A7b — date de l'accord écrit saisie depuis la page Financement
 * (`enregistrerAccordEcritAction`). Module `dossier-financement` RÉEL, Prisma
 * doublé : la date seule sur un accord déjà acté, l'accord acté sinon.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
      // Reventilation (best-effort) : dossier introuvable → rien.
      findUnique: async () => null,
    },
  },
}));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-1", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => h.log(...a),
}));
vi.mock("@/server/partners-sync/producteurs/facturation", () => ({
  emettreFinancementMisAJour: vi.fn(),
  transactionFaitFacturation: async (
    client: unknown,
    fn: (tx: unknown) => Promise<unknown>,
  ): Promise<unknown> => fn(client),
}));

import { enregistrerAccordEcritAction } from "./facturation-hub";
import { requireHabilitation } from "@/server/actions/qualiopi/_guards";

const DOSSIER = "11111111-1111-4111-8111-111111111111";

function donnees(i: number): Record<string, unknown> {
  return (h.updateMany.mock.calls[i]?.[0] as { data: Record<string, unknown> }).data;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.updateMany.mockResolvedValue({ count: 1 });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T10:00:00.000Z"));
});
afterEach(() => vi.useRealTimers());

describe("enregistrerAccordEcritAction", () => {
  it("accord déjà reçu : la date seule, statut inchangé, journalisé", async () => {
    h.findUniqueOrThrow.mockResolvedValue({
      statut: "accord_recu",
      depotFaitLe: null,
      trainingSessionId: "s-1",
    });
    const r = await enregistrerAccordEcritAction({
      dossierId: DOSSIER,
      accordEcritLe: "2026-10-01",
    });
    expect(r).toEqual({ data: { dossierId: DOSSIER } });
    expect(requireHabilitation).toHaveBeenCalledWith("deposer_demande_financeur");
    expect(h.updateMany).toHaveBeenCalledTimes(1);
    expect(donnees(0)).toEqual({ accordEcritLe: new Date("2026-10-01T00:00:00.000Z") });
    expect(h.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "facturation.dossier.accord_ecrit_saisi",
        changes: { accordEcritLe: "2026-10-01", transitions: [], trainingSessionId: "s-1" },
      }),
    );
  });

  it("demande envoyée : l'accord est acté avec sa date", async () => {
    h.findUniqueOrThrow.mockResolvedValue({
      statut: "envoye",
      depotFaitLe: null,
      trainingSessionId: "s-1",
    });
    const r = await enregistrerAccordEcritAction({
      dossierId: DOSSIER,
      accordEcritLe: "2026-10-01",
    });
    expect(r).toEqual({ data: { dossierId: DOSSIER } });
    expect(donnees(0)).toMatchObject({
      statut: "accord_recu",
      accordEcritLe: new Date("2026-10-01T00:00:00.000Z"),
    });
  });

  it("à monter sans dépôt : refus, rien n'est écrit", async () => {
    h.findUniqueOrThrow.mockResolvedValue({
      statut: "a_monter",
      depotFaitLe: null,
      trainingSessionId: "s-1",
    });
    const r = await enregistrerAccordEcritAction({
      dossierId: DOSSIER,
      accordEcritLe: "2026-10-01",
    });
    expect("error" in r).toBe(true);
    expect(h.updateMany).not.toHaveBeenCalled();
  });

  it("une date à venir est refusée", async () => {
    const r = await enregistrerAccordEcritAction({
      dossierId: DOSSIER,
      accordEcritLe: "2026-10-05",
    });
    expect("error" in r).toBe(true);
    expect(h.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("un jour qui n'existe pas est refusé", async () => {
    const r = await enregistrerAccordEcritAction({
      dossierId: DOSSIER,
      accordEcritLe: "2026-02-31",
    });
    expect("error" in r).toBe(true);
  });
});
