/**
 * Tests — createClientAction / updateClientAction (F5 SIRET + F6 OPCO).
 *
 * Il n'existait AUCUN test sur ces deux actions : le schéma client n'avait
 * jamais été exercé. Stratégie : mocker Prisma et les guards, laisser tourner
 * pour de vrai le Zod, l'inférence OPCO (module pur) et la numérotation.
 *
 * Volontairement AUCUNE assertion sur la valeur du numéro alloué : le format
 * relève de `NUMBERING_PREFIX` (chantier V19) et le MÉCANISME d'allocation de
 * V20, ce test ne doit se coupler ni à l'un ni à l'autre.
 *
 * 🔴 CONSIGNE À L'INTÉGRATEUR — dépendance d'ordre avec V20 (étape 7).
 * Sur l'arbre où ce fichier a été écrit, `createClientAction` alloue son numéro
 * via `prisma.client.count()` (vérifié : `src/server/qualiopi/numbering/` ne
 * contient que `formats.ts` et `retry.ts`). V20 remplace ce mécanisme par
 * `allocateNumero(tx, "client", "clients")` DANS une transaction. Si V20 a déjà
 * été appliqué quand vous lancez ce spec, les 6 tests `createClientAction`
 * échoueront sur le mock — remplacez alors le mock `count` par un `vi.mock` du
 * module d'allocation introduit par V20 (le `$transaction` passthrough est déjà
 * en place ci-dessous). Aucune assertion F5/F6 ne dépend de la numérotation :
 * seul le mock est à adapter, jamais les attentes.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdminWrite = vi.fn();
const mockLog = vi.fn();
const mockCount = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => {
  const client = {
    count: (...a: unknown[]) => mockCount(...a),
    create: (...a: unknown[]) => mockCreate(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
    findUnique: (...a: unknown[]) => mockFindUnique(...a),
  };
  const prisma = {
    client,
    // Passthrough : inoffensif aujourd'hui (l'action n'ouvre pas de
    // transaction), nécessaire dès que V20 enveloppera l'allocation.
    $transaction: async (fn: unknown) =>
      typeof fn === "function" ? (fn as (tx: unknown) => unknown)(prisma) : fn,
  };
  return { prisma };
});

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: () => mockRequireAdminWrite(),
  logQualiopiActivity: (...a: unknown[]) => mockLog(...a),
}));

import { createClientAction, updateClientAction } from "./clients";

const ID = "550e8400-e29b-41d4-a716-446655440099";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdminWrite.mockResolvedValue({ userId: "u1", role: "admin" });
  mockLog.mockResolvedValue(undefined);
  mockCount.mockResolvedValue(0);
  mockCreate.mockResolvedValue({ id: ID, numero: "AXI-CLI-001" });
  mockUpdate.mockResolvedValue({ id: ID });
  mockFindUnique.mockResolvedValue({ nafCode: null, idcc: null, opcoIdentifie: null });
});

describe("createClientAction — SIRET (F5)", () => {
  it("refuse 00000000000000 et n'écrit RIEN en base", async () => {
    const r = await createClientAction({ raisonSociale: "X", siret: "00000000000000" });

    expect("error" in r).toBe(true);
    if (!("error" in r)) return;
    expect(r.error).toContain("SIRET");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockLog).not.toHaveBeenCalled();
  });

  it("le message n'est plus le littéral générique « Données invalides »", async () => {
    const r = await createClientAction({ raisonSociale: "X", siret: "00000000000000" });
    expect("error" in r && r.error).not.toBe("Données invalides");
  });

  it("reste facultatif : sans SIRET la création passe, sans clé siret", async () => {
    const r = await createClientAction({ raisonSociale: "Prospect Calendly" });

    expect("data" in r).toBe(true);
    expect(mockCreate).toHaveBeenCalledOnce();
    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("siret" in data).toBe(false);
  });

  it("normalise la forme espacée à 14 caractères avant écriture", async () => {
    await createClientAction({ raisonSociale: "X", siret: "732 829 320 00074" });

    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.siret).toBe("73282932000074");
  });
});

describe("createClientAction — OPCO (F6)", () => {
  it("NAF 8559A donne akto et le log d'audit porte akto, plus null", async () => {
    await createClientAction({ raisonSociale: "OF Client", nafCode: "8559A" });

    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("akto");
    expect(mockLog.mock.calls[0]?.[0]?.changes?.opcoIdentifie).toBe("akto");
  });

  it("l'IDCC est autoritaire et l'emporte sur le NAF", async () => {
    await createClientAction({ raisonSociale: "X", idcc: "1516", nafCode: "6201Z" });

    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("akto");
  });

  it("un OPCO saisi explicitement gagne sur l'inférence", async () => {
    await createClientAction({ raisonSociale: "X", opcoIdentifie: "opco_ep", nafCode: "8559A" });

    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("opco_ep");
  });

  it("sans NAF ni IDCC, aucune clé opcoIdentifie n'est écrite", async () => {
    await createClientAction({ raisonSociale: "X" });

    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("opcoIdentifie" in data).toBe(false);
  });
});

describe("updateClientAction — SIRET (F5)", () => {
  it("refuse 00000000000000 sur le chemin de MISE À JOUR aussi", async () => {
    const r = await updateClientAction({ id: ID, siret: "00000000000000" });

    expect("error" in r).toBe(true);
    if (!("error" in r)) return;
    expect(r.error).toContain("SIRET");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("`null` efface le SIRET (seul chemin de correction d'une fiche existante)", async () => {
    const r = await updateClientAction({ id: ID, siret: null });

    expect("data" in r).toBe(true);
    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.siret).toBeNull();
  });
});

describe("updateClientAction — ré-inférence OPCO (F6)", () => {
  it("renseigner le NAF a posteriori remplit l'OPCO resté vide", async () => {
    const r = await updateClientAction({ id: ID, nafCode: "8559A" });

    expect("data" in r).toBe(true);
    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("akto");
  });

  it("renseigner l'IDCC seul suffit (source autoritaire)", async () => {
    await updateClientAction({ id: ID, idcc: "1516" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("akto");
  });

  it("🔴 n'écrase JAMAIS un OPCO déjà saisi à la main", async () => {
    mockFindUnique.mockResolvedValue({ nafCode: null, idcc: null, opcoIdentifie: "atlas" });

    await updateClientAction({ id: ID, nafCode: "8559A" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("opcoIdentifie" in data).toBe(false);
  });

  it("une chaîne vide en base ne bloque pas la ré-inférence (garde trim)", async () => {
    mockFindUnique.mockResolvedValue({ nafCode: null, idcc: null, opcoIdentifie: "   " });

    await updateClientAction({ id: ID, idcc: "1516" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("akto");
  });

  it("un OPCO explicite gagne sur la ré-inférence", async () => {
    await updateClientAction({ id: ID, opcoIdentifie: "opco_ep", nafCode: "8559A" });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("opco_ep");
  });

  it("aucune ré-inférence parasite quand ni NAF ni IDCC ne changent", async () => {
    await updateClientAction({ id: ID, notes: "rappel le 12" });

    expect(mockFindUnique).not.toHaveBeenCalled();
    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("opcoIdentifie" in data).toBe(false);
  });

  it("la chaîne vide est refusée en entrée (anti-briquage du select)", async () => {
    const r = await updateClientAction({ id: ID, opcoIdentifie: "" });

    expect("error" in r).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("🔴 `null` = « remettre en inféré » : écrase la saisie ET recalcule", async () => {
    // Sans ce chemin, un OPCO saisi par erreur serait définitif via l'interface.
    mockFindUnique.mockResolvedValue({ nafCode: "8559A", idcc: null, opcoIdentifie: "atlas" });

    await updateClientAction({ id: ID, opcoIdentifie: null });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.opcoIdentifie).toBe("akto");
  });

  it("`null` sans NAF ni IDCC exploitables remet bien la colonne à NULL", async () => {
    mockFindUnique.mockResolvedValue({ nafCode: null, idcc: null, opcoIdentifie: "atlas" });

    await updateClientAction({ id: ID, opcoIdentifie: null });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("opcoIdentifie" in data).toBe(true);
    expect(data.opcoIdentifie).toBeNull();
  });
});
