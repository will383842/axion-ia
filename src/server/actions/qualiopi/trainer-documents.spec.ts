/**
 * Tests — trainer-documents.ts (server actions sur les pièces d'un formateur).
 *
 * Règles de sûreté vérifiées : une pièce démarre NON validée (elle ne compte
 * pas pour la conformité tant qu'un humain ne l'a pas validée), on ne rejette
 * pas sans motif, et une expiration ne peut pas précéder l'émission.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerDocument: {
      create: (...a: unknown[]) => mockCreate(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
      delete: (...a: unknown[]) => mockDelete(...a),
    },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  requireHabilitation: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  // OBLIGATOIRE : `deleteTrainerDocumentAction` appelle desormais
  // `requireAdminDelete`, HORS du try/catch. Sans cette entree le binding vaut
  // `undefined` et les 2 tests de `describe("deleteTrainerDocumentAction")`
  // echouent sur une TypeError non rattrapee.
  requireAdminDelete: vi.fn().mockResolvedValue({ userId: "admin-uuid", role: "super_admin" }),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

import {
  createTrainerDocumentAction,
  validateTrainerDocumentAction,
  deleteTrainerDocumentAction,
} from "./trainer-documents";

const TRAINER_ID = "11111111-1111-1111-1111-111111111111";
const DOC_ID = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockDelete.mockReset();
  mockCreate.mockResolvedValue({ id: DOC_ID });
  mockUpdate.mockResolvedValue({ id: DOC_ID });
  mockDelete.mockResolvedValue({ id: DOC_ID });
});

describe("createTrainerDocumentAction", () => {
  it("refuse un type de pièce inconnu", async () => {
    const r = await createTrainerDocumentAction({
      trainerId: TRAINER_ID,
      type: "passeport" as never,
    });
    expect(r).toEqual({ error: "Données invalides" });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("refuse un trainerId qui n'est pas un UUID", async () => {
    const r = await createTrainerDocumentAction({ trainerId: "abc", type: "cv" });
    expect(r).toEqual({ error: "Données invalides" });
  });

  it("une pièce créée n'est PAS validée d'office", async () => {
    await createTrainerDocumentAction({ trainerId: TRAINER_ID, type: "nda_sous_traitant" });
    const arg = mockCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    // `statutValidation` n'est pas fourni → défaut Prisma `en_attente`.
    expect(arg.data["statutValidation"]).toBeUndefined();
    expect(arg.data["trainerId"]).toBe(TRAINER_ID);
  });

  it("refuse une expiration antérieure à l'émission", async () => {
    const r = await createTrainerDocumentAction({
      trainerId: TRAINER_ID,
      type: "assurance_rc_pro",
      dateEmission: "2026-06-01",
      dateExpiration: "2026-01-01",
    });
    expect(r).toHaveProperty("error");
    if ("error" in r) expect(r.error).toContain("expiration");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("accepte des dates vides (champ de formulaire non rempli)", async () => {
    const r = await createTrainerDocumentAction({
      trainerId: TRAINER_ID,
      type: "cv",
      dateEmission: "",
      dateExpiration: "",
    });
    expect(r).toEqual({ data: { id: DOC_ID } });
    const arg = mockCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(arg.data["dateEmission"]).toBeNull();
  });

  it("remonte une erreur propre si Prisma échoue", async () => {
    mockCreate.mockRejectedValue(new Error("db down"));
    const r = await createTrainerDocumentAction({ trainerId: TRAINER_ID, type: "cv" });
    expect(r).toHaveProperty("error");
  });
});

describe("validateTrainerDocumentAction", () => {
  it("valide une pièce et horodate le validateur", async () => {
    const r = await validateTrainerDocumentAction({ id: DOC_ID, statutValidation: "valide" });
    expect(r).toEqual({ data: { id: DOC_ID } });
    const arg = mockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(arg.data["statutValidation"]).toBe("valide");
    expect(arg.data["valideParUserId"]).toBe("admin-uuid");
    expect(arg.data["valideAt"]).toBeInstanceOf(Date);
    expect(arg.data["rejetMotif"]).toBeNull();
  });

  it("REFUSE un rejet sans motif", async () => {
    const r = await validateTrainerDocumentAction({ id: DOC_ID, statutValidation: "rejete" });
    expect(r).toHaveProperty("error");
    if ("error" in r) expect(r.error).toContain("motif");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("REFUSE un rejet dont le motif n'est que des espaces", async () => {
    const r = await validateTrainerDocumentAction({
      id: DOC_ID,
      statutValidation: "rejete",
      rejetMotif: "   ",
    });
    expect(r).toHaveProperty("error");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("rejette avec motif et efface l'horodatage de validation", async () => {
    await validateTrainerDocumentAction({
      id: DOC_ID,
      statutValidation: "rejete",
      rejetMotif: "Document illisible",
    });
    const arg = mockUpdate.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(arg.data["rejetMotif"]).toBe("Document illisible");
    expect(arg.data["valideAt"]).toBeNull();
    expect(arg.data["valideParUserId"]).toBeNull();
  });

  it("refuse un statut hors { valide, rejete }", async () => {
    const r = await validateTrainerDocumentAction({
      id: DOC_ID,
      statutValidation: "en_attente" as never,
    });
    expect(r).toEqual({ error: "Données invalides" });
  });
});

describe("deleteTrainerDocumentAction", () => {
  it("supprime la pièce", async () => {
    const r = await deleteTrainerDocumentAction({ id: DOC_ID });
    expect(r).toEqual({ data: { id: DOC_ID } });
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: DOC_ID } });
  });

  it("refuse un id non UUID", async () => {
    const r = await deleteTrainerDocumentAction({ id: "abc" });
    expect(r).toEqual({ error: "Données invalides" });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
