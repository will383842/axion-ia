/**
 * Lot A2 — « Modifier la fiche » : champs déjà en base, désormais écrits par
 * `updateClientAction` (aucun nouvel écrivain de `clients`).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();
const mockInferer = vi.fn();

vi.mock("@/lib/prisma", () => {
  const client = {
    update: (...a: unknown[]) => mockUpdate(...a),
    findUnique: (...a: unknown[]) => mockFindUnique(...a),
  };
  const prisma = {
    client,
    $executeRaw: async () => 1,
    activityLog: { create: async () => ({}) },
    idccOpco: { findMany: (...a: unknown[]) => mockInferer(...a) },
    $transaction: async (fn: unknown) =>
      typeof fn === "function" ? (fn as (tx: unknown) => unknown)(prisma) : fn,
  };
  return { prisma };
});

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "u1", role: "admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "u1", role: "admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

import { updateClientAction } from "../clients";

const ID = "550e8400-e29b-41d4-a716-446655440099";

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue({ id: ID });
  mockFindUnique.mockResolvedValue({ nafCode: null, idcc: null, opcoIdentifie: null });
  mockInferer.mockResolvedValue([]);
});

const donneesEcrites = (): Record<string, unknown> =>
  (mockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;

describe("Modifier la fiche — champs complets (lot A2)", () => {
  it("écrit chaque nouveau champ", async () => {
    const r = await updateClientAction({
      id: ID,
      tvaIntracom: "FR12345678901",
      adresseRue: "12 rue des Lilas",
      adresseCodePostal: "69003",
      adresseVille: "Lyon",
      delaiPaiementJours: 30,
      tauxAcomptePct: 30,
      modeFacturation: "acompte_solde",
    });
    expect("error" in r).toBe(false);
    expect(donneesEcrites()).toMatchObject({
      tvaIntracom: "FR12345678901",
      adresseRue: "12 rue des Lilas",
      adresseCodePostal: "69003",
      adresseVille: "Lyon",
      delaiPaiementJours: 30,
      tauxAcomptePct: 30,
      modeFacturation: "acompte_solde",
    });
  });

  it("accepte `null` (effacer) et le mode « solde unique »", async () => {
    const r = await updateClientAction({
      id: ID,
      tvaIntracom: null,
      adresseRue: null,
      delaiPaiementJours: null,
      tauxAcomptePct: null,
      modeFacturation: null,
    });
    expect("error" in r).toBe(false);
    const ok = await updateClientAction({ id: ID, modeFacturation: "solde_unique" });
    expect("error" in ok).toBe(false);
  });

  it("accepte l'acompte de 0 % et de 100 %, le délai de 0 et de 120 jours", async () => {
    for (const input of [
      { tauxAcomptePct: 0 },
      { tauxAcomptePct: 100 },
      { delaiPaiementJours: 0 },
      { delaiPaiementJours: 120 },
    ]) {
      const r = await updateClientAction({ id: ID, ...input });
      expect("error" in r, JSON.stringify(input)).toBe(false);
    }
  });

  it("refuse un acompte de 101 %, négatif ou décimal", async () => {
    for (const tauxAcomptePct of [101, -1, 12.5]) {
      const r = await updateClientAction({ id: ID, tauxAcomptePct });
      expect("error" in r, String(tauxAcomptePct)).toBe(true);
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("refuse un délai négatif, de plus de 120 jours ou décimal", async () => {
    for (const delaiPaiementJours of [-1, 121, 30.5]) {
      const r = await updateClientAction({ id: ID, delaiPaiementJours });
      expect("error" in r, String(delaiPaiementJours)).toBe(true);
    }
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("refuse un mode de facturation inconnu et des textes trop longs", async () => {
    const mode = await updateClientAction({
      id: ID,
      modeFacturation: "mensuel" as unknown as "solde_unique",
    });
    expect("error" in mode).toBe(true);
    const tva = await updateClientAction({ id: ID, tvaIntracom: "x".repeat(41) });
    expect("error" in tva).toBe(true);
    const cp = await updateClientAction({ id: ID, adresseCodePostal: "1".repeat(13) });
    expect("error" in cp).toBe(true);
  });

  it("un envoi sans nafCode ni idcc ne relance pas l'inférence OPCO", async () => {
    await updateClientAction({ id: ID, adresseVille: "Lyon", delaiPaiementJours: 45 });
    // L'inférence lit la fiche (`findUnique`) puis la table `idcc_opco`.
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockInferer).not.toHaveBeenCalled();
    expect(donneesEcrites()).not.toHaveProperty("opcoIdentifie");
    expect(donneesEcrites()).not.toHaveProperty("opco");
  });

  it("un particulier ne peut pas recevoir un numéro de TVA", async () => {
    const r = await updateClientAction({ id: ID, type: "particulier", tvaIntracom: "FR1" });
    expect("error" in r).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
