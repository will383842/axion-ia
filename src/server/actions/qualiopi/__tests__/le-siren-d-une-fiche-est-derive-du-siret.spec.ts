/**
 * ⛔ LE SIREN D'UNE FICHE EST DÉRIVÉ DU SIRET (chantier visio, PR 2).
 *
 * Jusqu'au 2026-09-29, AUCUN code n'écrivait `Client.siren` (mesuré :
 * `git grep -w siren`). Or c'est la clé de l'anti-doublon à la création et
 * celle par laquelle Axion Partners rattache un apporteur à une entreprise.
 * Un SIRET valide porte son SIREN dans ses 9 premiers chiffres : ne pas
 * l'écrire, c'était laisser vide une information qu'on possède.
 *
 * Mutation qui fait rougir : retirer la ligne `...(siren !== undefined ? { siren } : {})`
 * de `createClientAction` (ou `sirenAEcrire` de `updateClientAction`).
 * Contre-témoin : une fiche sans SIRET n'écrit AUCUNE clé `siren`.
 * Angle mort : les fiches EXISTANTES (1 en production) ne sont pas touchées
 * ici — c'est le rôle du rattrapage `scripts/visio/deriver-siren.ts`.
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
/** SIRET à clé valide, déjà utilisé par `clients.spec.ts`. */
const SIRET = "73282932000074";
const SIREN_ATTENDU = "732829320";

function donneesCreees(): Record<string, unknown> {
  return mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
}
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
  mockFindUnique.mockResolvedValue({ nafCode: null, idcc: null, opcoIdentifie: null, siret: null });
});

describe("le SIREN d'une fiche est dérivé du SIRET", () => {
  it("à la création, un SIRET valide écrit son SIREN", async () => {
    const r = await createClientAction({ raisonSociale: "Entreprise", siret: SIRET });
    expect("data" in r).toBe(true);
    expect(donneesCreees().siren).toBe(SIREN_ATTENDU);
  });

  it("la forme espacée d'un Kbis donne le même SIREN", async () => {
    await createClientAction({ raisonSociale: "Entreprise", siret: "732 829 320 00074" });
    expect(donneesCreees().siren).toBe(SIREN_ATTENDU);
  });

  it("le journal d'audit porte le SIREN écrit", async () => {
    await createClientAction({ raisonSociale: "Entreprise", siret: SIRET });
    expect(mockLog.mock.calls[0]?.[0]?.changes?.siren).toBe(SIREN_ATTENDU);
  });

  it("un SIREN saisi qui concorde avec le SIRET est accepté", async () => {
    const r = await createClientAction({
      raisonSociale: "Entreprise",
      siret: SIRET,
      siren: "732 829 320",
    });
    expect("data" in r).toBe(true);
    expect(donneesCreees().siren).toBe(SIREN_ATTENDU);
  });

  it("contre-témoin : sans SIRET ni SIREN, aucune clé siren n'est écrite", async () => {
    await createClientAction({ raisonSociale: "Prospect Calendly" });
    expect("siren" in donneesCreees()).toBe(false);
  });

  it("sans SIRET, un SIREN bien formé saisi à la main est gardé", async () => {
    await createClientAction({ raisonSociale: "Entreprise", siren: SIREN_ATTENDU });
    expect(donneesCreees().siren).toBe(SIREN_ATTENDU);
  });

  it("à la mise à jour, saisir le SIRET remplit le SIREN", async () => {
    const r = await updateClientAction({ id: ID, siret: SIRET });
    expect("data" in r).toBe(true);
    expect(donneesMisesAJour().siren).toBe(SIREN_ATTENDU);
  });

  it("une mise à jour qui ne touche ni SIRET ni SIREN n'écrit pas de SIREN", async () => {
    await updateClientAction({ id: ID, contactNom: "Seul ce champ" });
    expect("siren" in donneesMisesAJour()).toBe(false);
  });

  it("effacer le SIRET ne touche pas au SIREN s'il n'est pas transmis", async () => {
    await updateClientAction({ id: ID, siret: null });
    expect(donneesMisesAJour().siret).toBeNull();
    expect("siren" in donneesMisesAJour()).toBe(false);
  });
});
