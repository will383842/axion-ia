/**
 * Lot A9 — un SIREN déjà sur la fiche n'est JAMAIS écrasé par celui d'un SIRET
 * qui le contredit.
 *
 * Le formulaire « Éditer » ne transmet que le SIRET (jamais le SIREN). Avant ce
 * lot, saisir un SIRET dérivait son SIREN et l'écrivait, même par-dessus un
 * SIREN confirmé dans l'annuaire (« C'est elle ») : un identifiant juste
 * remplacé en silence par une faute de frappe dans le SIRET.
 *
 * Mutation qui fait rougir : retirer la lecture du SIREN en base dans
 * `updateClientAction`.
 * Contre-témoin : fiche sans SIREN → le SIREN du SIRET est écrit, sans
 * avertissement.
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
    // Porte unique de création (chantier visio, PR 3) : verrou consultatif,
    // personne de la fiche et son adresse, journal de « créer quand même ».
    $executeRaw: async () => 1,
    clientContact: {
      findFirst: async () => null,
      create: async (a: {
        data: { nom: string; telephone?: string | null; fonction?: string | null };
      }) => ({
        id: "contact-1",
        nom: a.data.nom,
        telephone: a.data.telephone ?? null,
        fonction: a.data.fonction ?? null,
      }),
      update: async () => ({ id: "contact-1", nom: "", telephone: null, fonction: null }),
    },
    clientContactAdresse: {
      findFirst: async () => null,
      create: async () => ({}),
      deleteMany: async () => ({ count: 0 }),
    },
    activityLog: { create: async () => ({}) },
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
/** SIRET à clé valide, déjà utilisé par `clients.spec.ts`. */
const SIRET = "73282932000074";
const SIREN_ATTENDU = "732829320";

function donneesMisesAJour(): Record<string, unknown> {
  return mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdminWrite.mockResolvedValue({ userId: "u1", role: "admin" });
  mockLog.mockResolvedValue(undefined);
  mockFindMany.mockResolvedValue([]);
  mockCreate.mockResolvedValue({ id: ID, numero: "AXI-CLI-001" });
  mockUpdate.mockResolvedValue({ id: ID });
});

const SIREN_EN_BASE = "901434837";

describe("un SIREN différent du SIRET n'est jamais écrasé", () => {
  it("SIREN en base ≠ SIRET saisi → SIREN conservé, avertissement", async () => {
    mockFindUnique.mockResolvedValue({
      nafCode: null,
      idcc: null,
      opcoIdentifie: null,
      siret: null,
      siren: SIREN_EN_BASE,
      type: "entreprise",
    });
    const r = await updateClientAction({ id: ID, siret: SIRET });
    expect("data" in r).toBe(true);
    expect(donneesMisesAJour().siret).toBe(SIRET);
    expect("siren" in donneesMisesAJour()).toBe(false);
    expect("data" in r && r.data.avertissement).toMatch(/SIREN ne correspond pas au SIRET/);
  });

  it("contre-témoin : fiche sans SIREN → le SIREN du SIRET est écrit, sans avertissement", async () => {
    mockFindUnique.mockResolvedValue({
      nafCode: null,
      idcc: null,
      opcoIdentifie: null,
      siret: null,
      siren: null,
      type: "entreprise",
    });
    const r = await updateClientAction({ id: ID, siret: SIRET });
    expect(donneesMisesAJour().siren).toBe(SIREN_ATTENDU);
    expect("data" in r && r.data.avertissement).toBeFalsy();
  });

  it("SIREN en base identique au SIRET → réécrit à l'identique, sans avertissement", async () => {
    mockFindUnique.mockResolvedValue({
      nafCode: null,
      idcc: null,
      opcoIdentifie: null,
      siret: null,
      siren: SIREN_ATTENDU,
      type: "entreprise",
    });
    const r = await updateClientAction({ id: ID, siret: SIRET });
    expect(donneesMisesAJour().siren).toBe(SIREN_ATTENDU);
    expect("data" in r && r.data.avertissement).toBeFalsy();
  });
});
