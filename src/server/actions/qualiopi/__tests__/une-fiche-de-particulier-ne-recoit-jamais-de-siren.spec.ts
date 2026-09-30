/**
 * P-5 (relecture) : une fiche dont le type EN BASE est « particulier » ne
 * reçoit jamais de SIREN (ni de SIRET), même quand la charge ne dit rien du
 * type — c'est le cas de « C'est elle » (`confirmerSirenFormAction`), qui ne
 * transmet que le SIREN proposé par l'annuaire.
 *
 * Mutation qui fait rougir : ne regarder que le type de la charge.
 * Contre-témoin : une fiche d'entreprise reçoit le SIREN ; une charge qui
 * repasse la fiche en entreprise dans la même mise à jour l'accepte.
 * SIREN FICTIF (clé de Luhn valide).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdminWrite = vi.fn();
const mockLog = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => {
  const client = {
    findMany: (...a: unknown[]) => mockFindMany(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
    findUnique: (...a: unknown[]) => mockFindUnique(...a),
  };
  const prisma = {
    client,
    $executeRaw: async () => 0,
    $queryRaw: async () => [],
    $transaction: async (fn: unknown) =>
      typeof fn === "function" ? (fn as (tx: unknown) => unknown)(prisma) : fn,
  };
  return { prisma };
});

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: () => mockRequireAdminWrite(),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: (...a: unknown[]) => mockLog(...a),
}));

import { updateClientAction } from "../clients";

const ID = "550e8400-e29b-41d4-a716-446655440099";
const SIREN_FICTIF = "123456782";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdminWrite.mockResolvedValue({ userId: "u1", role: "admin" });
  mockLog.mockResolvedValue(undefined);
  mockFindMany.mockResolvedValue([]);
  mockUpdate.mockResolvedValue({ id: ID });
});

function enBase(type: "entreprise" | "particulier") {
  mockFindUnique.mockResolvedValue({
    type,
    nafCode: null,
    idcc: null,
    opcoIdentifie: null,
    siret: null,
  });
}

describe("une fiche de particulier ne reçoit jamais de SIREN", () => {
  it("SIREN seul sur une fiche particulier en base : refus, rien n'est écrit", async () => {
    enBase("particulier");
    const r = await updateClientAction({ id: ID, siren: SIREN_FICTIF });
    expect(r).toEqual({ error: expect.stringMatching(/particulier/) });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("contre-témoin : une fiche d'entreprise reçoit le SIREN", async () => {
    enBase("entreprise");
    const r = await updateClientAction({ id: ID, siren: SIREN_FICTIF });
    expect("error" in r).toBe(false);
  });

  it("contre-témoin : repasser la fiche en entreprise dans la même charge l'accepte", async () => {
    enBase("particulier");
    const r = await updateClientAction({ id: ID, type: "entreprise", siren: SIREN_FICTIF });
    expect("error" in r).toBe(false);
  });
});
