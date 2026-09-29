/**
 * UN SIREN CONTRAIRE AU SIRET EST REFUSÉ (chantier visio, PR 2).
 *
 * Deux identifiants incompatibles sur la même fiche : le code ne choisit pas à
 * la place de Will. Il refuse, AVANT toute écriture, avec un message qui dit
 * quoi corriger. Même règle à la création et à la mise à jour, y compris quand
 * le SIRET est déjà en base et que seul le SIREN est transmis.
 *
 * Mutation qui fait rougir : faire rendre `{ ok: true, siren: derive }` à
 * `resoudreSiren` quand les deux divergent.
 *
 * Même refus motivé pour un SIRET à la clé juste dont les 9 premiers chiffres
 * ne forment pas un SIREN valide (deux chiffres faux qui se compensent) : sans
 * lui, la porte levait une erreur brute (écran d'erreur au lieu d'un message).
 * Mutation qui fait rougir : retirer le contrôle du SIREN dérivé dans
 * `resoudreSiren`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdminWrite = vi.fn();
const mockLog = vi.fn();
const mockFindMany = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => {
  const client = {
    findMany: (...a: unknown[]) => mockFindMany(...a),
    create: (...a: unknown[]) => mockCreate(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
    findUnique: (...a: unknown[]) => mockFindUnique(...a),
  };
  const prisma = {
    client,
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

import { createClientAction, updateClientAction } from "../clients";

const ID = "550e8400-e29b-41d4-a716-446655440099";
const SIRET = "73282932000074";
/** SIREN à clé valide, mais d'une AUTRE entreprise que le SIRET ci-dessus. */
const AUTRE_SIREN = "552100554";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdminWrite.mockResolvedValue({ userId: "u1", role: "admin" });
  mockLog.mockResolvedValue(undefined);
  mockFindMany.mockResolvedValue([]);
  mockCreate.mockResolvedValue({ id: ID, numero: "AXI-CLI-001" });
  mockUpdate.mockResolvedValue({ id: ID });
  mockFindUnique.mockResolvedValue({ nafCode: null, idcc: null, opcoIdentifie: null, siret: null });
});

describe("un SIREN contraire au SIRET est refusé", () => {
  it("à la création : refus motivé, rien n'est écrit", async () => {
    const r = await createClientAction({ raisonSociale: "X", siret: SIRET, siren: AUTRE_SIREN });
    expect("error" in r).toBe(true);
    if (!("error" in r)) return;
    expect(r.error).toContain("SIREN");
    expect(r.error).toContain("SIRET");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("à la mise à jour, SIRET et SIREN transmis ensemble : refus", async () => {
    const r = await updateClientAction({ id: ID, siret: SIRET, siren: AUTRE_SIREN });
    expect("error" in r).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("à la mise à jour, SIREN seul contre le SIRET déjà en base : refus", async () => {
    mockFindUnique.mockResolvedValue({ siret: SIRET });
    const r = await updateClientAction({ id: ID, siren: AUTRE_SIREN });
    expect("error" in r).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("effacer le SIREN d'une fiche qui a un SIRET est refusé", async () => {
    mockFindUnique.mockResolvedValue({ siret: SIRET });
    const r = await updateClientAction({ id: ID, siren: null });
    expect("error" in r).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("un SIREN mal formé est refusé, même sans SIRET", async () => {
    const r = await createClientAction({ raisonSociale: "X", siren: "12345" });
    expect("error" in r).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("un SIREN à clé fausse est refusé", async () => {
    const r = await createClientAction({ raisonSociale: "X", siren: "732829321" });
    expect("error" in r).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("un particulier ne porte pas de SIREN", async () => {
    const r = await createClientAction({
      raisonSociale: "Prénom Nom",
      type: "particulier",
      siren: AUTRE_SIREN,
    });
    expect("error" in r).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("un SIRET à la clé juste mais au SIREN faux : refus en français, rien n'est écrit", async () => {
    // 14 chiffres qui passent Luhn ; les 9 premiers (732829321) ne le passent pas.
    const r = await createClientAction({ raisonSociale: "X", siret: "73282932100007" });
    expect("error" in r).toBe(true);
    if (!("error" in r)) return;
    expect(r.error).toContain("SIRET");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("idem à la mise à jour", async () => {
    const r = await updateClientAction({ id: ID, siret: "73282932100007" });
    expect("error" in r).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
