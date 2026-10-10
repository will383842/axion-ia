/**
 * Lot S1 (ADR 0066) — les pièces que lit la garde d'activation ne se fabriquent
 * plus à la main.
 *
 * Constat de départ (chaque `it` 🔴 était ROUGE) : une attestation de vigilance
 * se créait avec une échéance LIBRE (« valable jusqu'en 2099 »), pouvait être
 * validée par la personne même qui l'avait saisie, et la suppression effaçait
 * la pièce sans retour.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  del: vi.fn(),
  findUnique: vi.fn(),
  logFindFirst: vi.fn(),
  session: { userId: "admin-a", role: "admin" } as { userId: string; role: string },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trainerDocument: {
      findUnique: (...a: unknown[]) => m.findUnique(...a),
      create: (...a: unknown[]) => m.create(...a),
      update: (...a: unknown[]) => m.update(...a),
      delete: (...a: unknown[]) => m.del(...a),
    },
    activityLog: { findFirst: (...a: unknown[]) => m.logFindFirst(...a) },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: vi.fn(async () => m.session),
  requireHabilitation: vi.fn(async () => m.session),
  requireAdminDelete: vi.fn(async () => m.session),
  logQualiopiActivity: vi.fn().mockResolvedValue(undefined),
}));

import {
  createTrainerDocumentAction,
  validateTrainerDocumentAction,
  deleteTrainerDocumentAction,
} from "./trainer-documents";

const TRAINER_ID = "11111111-1111-1111-1111-111111111111";
const DOC_ID = "22222222-2222-2222-2222-222222222222";
const JOUR = 24 * 3600 * 1000;
const isoIlYa = (jours: number) => new Date(Date.now() - jours * JOUR).toISOString().slice(0, 10);

beforeEach(() => {
  vi.clearAllMocks();
  m.session = { userId: "admin-a", role: "admin" };
  m.create.mockResolvedValue({ id: DOC_ID });
  m.update.mockResolvedValue({ id: DOC_ID });
  m.del.mockResolvedValue({ id: DOC_ID });
  m.logFindFirst.mockResolvedValue({ adminUserId: "admin-b" });
  m.findUnique.mockResolvedValue({
    type: "attestation_vigilance_urssaf",
    fichierUrl: "https://stockage.example/vigilance.pdf",
    dateEmission: new Date(Date.now() - 10 * JOUR),
    dateExpiration: null,
    rejetMotif: null,
  });
});

describe("createTrainerDocumentAction — échéance CALCULÉE", () => {
  it("🔴 une attestation « valable jusqu'en 2099 » est ramenée à émission + 6 mois", async () => {
    const emission = isoIlYa(10);
    const r = await createTrainerDocumentAction({
      trainerId: TRAINER_ID,
      type: "attestation_vigilance_urssaf",
      fichierUrl: "https://stockage.example/vigilance.pdf",
      dateEmission: emission,
      dateExpiration: "2099-12-31",
    });
    expect(r).toEqual({ data: { id: DOC_ID } });
    const data = (m.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    const attendue = new Date(emission);
    attendue.setUTCMonth(attendue.getUTCMonth() + 6);
    expect(data["dateExpiration"]).toEqual(attendue);
    expect(data["statutValidation"]).toBeUndefined();
  });

  it("🔴 une attestation de vigilance SANS date d'émission est refusée", async () => {
    const r = await createTrainerDocumentAction({
      trainerId: TRAINER_ID,
      type: "attestation_vigilance_urssaf",
      dateExpiration: "2099-12-31",
    });
    expect(r).toHaveProperty("error");
    expect(m.create).not.toHaveBeenCalled();
  });

  it("🔴 une date d'émission dans le futur est refusée", async () => {
    const r = await createTrainerDocumentAction({
      trainerId: TRAINER_ID,
      type: "kbis_avis_sirene",
      dateEmission: "2099-01-01",
    });
    expect(r).toHaveProperty("error");
    expect(m.create).not.toHaveBeenCalled();
  });

  it("un CV garde son échéance saisie (pièce non lue par la garde, INCHANGÉ)", async () => {
    await createTrainerDocumentAction({
      trainerId: TRAINER_ID,
      type: "cv",
      dateExpiration: "2099-12-31",
    });
    const data = (m.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    expect(data["dateExpiration"]).toEqual(new Date("2099-12-31"));
  });
});

describe("validateTrainerDocumentAction — quatre yeux sur les pièces gardées", () => {
  it("🔴 REFUSE que le créateur valide sa propre attestation", async () => {
    m.logFindFirst.mockResolvedValue({ adminUserId: "admin-a" });
    const r = await validateTrainerDocumentAction({ id: DOC_ID, statutValidation: "valide" });
    expect(r).toHaveProperty("error");
    expect(m.update).not.toHaveBeenCalled();
  });

  it("REFUSE quand le créateur est inconnu (garde fermée)", async () => {
    m.logFindFirst.mockResolvedValue(null);
    const r = await validateTrainerDocumentAction({ id: DOC_ID, statutValidation: "valide" });
    expect(r).toHaveProperty("error");
    expect(m.update).not.toHaveBeenCalled();
  });

  it("un `super_admin` peut valider sa propre saisie", async () => {
    m.session = { userId: "admin-a", role: "super_admin" };
    m.logFindFirst.mockResolvedValue({ adminUserId: "admin-a" });
    const r = await validateTrainerDocumentAction({ id: DOC_ID, statutValidation: "valide" });
    expect(r).toEqual({ data: { id: DOC_ID } });
  });

  it("une autre personne valide, et l'échéance est RECALCULÉE (une date libre ne survit pas)", async () => {
    const emission = new Date(Date.now() - 10 * JOUR);
    m.findUnique.mockResolvedValue({
      type: "attestation_vigilance_urssaf",
      fichierUrl: "https://stockage.example/vigilance.pdf",
      dateEmission: emission,
      dateExpiration: new Date("2099-12-31"),
      rejetMotif: null,
    });
    const r = await validateTrainerDocumentAction({ id: DOC_ID, statutValidation: "valide" });
    expect(r).toEqual({ data: { id: DOC_ID } });
    const data = (m.update.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;
    const attendue = new Date(emission);
    attendue.setUTCMonth(attendue.getUTCMonth() + 6);
    expect(data["dateExpiration"]).toEqual(attendue);
  });

  it("REFUSE de valider une pièce archivée", async () => {
    m.findUnique.mockResolvedValue({
      type: "attestation_vigilance_urssaf",
      fichierUrl: "https://stockage.example/vigilance.pdf",
      dateEmission: new Date(Date.now() - 10 * JOUR),
      dateExpiration: null,
      rejetMotif: "[archivée] Pièce retirée du dossier.",
    });
    const r = await validateTrainerDocumentAction({ id: DOC_ID, statutValidation: "valide" });
    expect(r).toHaveProperty("error");
    expect(m.update).not.toHaveBeenCalled();
  });
});

describe("deleteTrainerDocumentAction — archivage logique", () => {
  it("🔴 n'efface plus la pièce : elle est archivée et ne compte plus", async () => {
    const r = await deleteTrainerDocumentAction({ id: DOC_ID });
    expect(r).toEqual({ data: { id: DOC_ID } });
    expect(m.del).not.toHaveBeenCalled();
    const arg = m.update.mock.calls[0]?.[0] as {
      where: { id: string };
      data: Record<string, unknown>;
    };
    expect(arg.where).toEqual({ id: DOC_ID });
    expect(arg.data["statutValidation"]).toBe("rejete");
    expect(String(arg.data["rejetMotif"])).toMatch(/^\[archivée\]/);
  });
});
