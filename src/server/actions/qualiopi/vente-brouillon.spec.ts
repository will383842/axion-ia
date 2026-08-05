/**
 * Tests — Server Actions VenteBrouillon (wizard « Nouvelle vente »).
 *
 * Stratégie identique à clients.spec.ts : Prisma et guards mockés, Zod et la
 * logique de minimisation tournent pour de vrai. Trois invariants verrouillés :
 *   1. la création pose `retentionUntil` (défaut 90 j, env, refus < 1) ;
 *   2. la mise à jour MINIMISE le payload dès que clientId est posé ;
 *   3. lecture/écriture/suppression bornées au propriétaire.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockRequireAdminWrite = vi.fn();
const mockLog = vi.fn();
const mockCreate = vi.fn();
const mockFindUnique = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    venteBrouillon: {
      create: (...a: unknown[]) => mockCreate(...a),
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
      update: (...a: unknown[]) => mockUpdate(...a),
      delete: (...a: unknown[]) => mockDelete(...a),
    },
    // Vérification d'existence des références avant écriture (un uuid
    // inexistant levait une P2003 brute au lieu d'un ActionResult).
    client: { findUnique: () => Promise.resolve({ id: "ok" }) },
    devis: { findUnique: () => Promise.resolve({ id: "ok" }) },
    trainingSession: { findUnique: () => Promise.resolve({ id: "ok" }) },
  },
}));

vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: () => mockRequireAdminWrite(),
  logQualiopiActivity: (...a: unknown[]) => mockLog(...a),
}));

import {
  createVenteBrouillonAction,
  getVenteBrouillonAction,
  updateVenteBrouillonAction,
  supprimerVenteBrouillonAction,
} from "./vente-brouillon";

const ID = "550e8400-e29b-41d4-a716-446655440011";
const CLIENT_ID = "550e8400-e29b-41d4-a716-446655440022";
const JOUR_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdminWrite.mockResolvedValue({ userId: "admin-1", role: "admin" });
  mockLog.mockResolvedValue(undefined);
  mockCreate.mockImplementation(async (args: { data: { retentionUntil: Date } }) => ({
    id: ID,
    retentionUntil: args.data.retentionUntil,
  }));
  mockFindUnique.mockResolvedValue({
    id: ID,
    etape: 1,
    payload: {},
    clientId: null,
    devisId: null,
    sessionId: null,
    createdByAdminId: "admin-1",
    updatedAt: new Date(),
  });
  mockUpdate.mockResolvedValue({ id: ID });
  mockDelete.mockResolvedValue({ id: ID });
});

afterEach(() => {
  delete process.env["VENTE_BROUILLON_RETENTION_DAYS"];
});

describe("createVenteBrouillonAction — rétention", () => {
  it("pose retentionUntil à ~90 jours par défaut, et le propriétaire", async () => {
    const r = await createVenteBrouillonAction();

    expect("data" in r).toBe(true);
    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect(data.createdByAdminId).toBe("admin-1");
    const ecart = (data.retentionUntil as Date).getTime() - Date.now();
    // Tolérance large (1 j) : setDate traverse les changements d'heure.
    expect(ecart).toBeGreaterThan(89 * JOUR_MS);
    expect(ecart).toBeLessThan(91 * JOUR_MS);
  });

  it("respecte VENTE_BROUILLON_RETENTION_DAYS", async () => {
    process.env["VENTE_BROUILLON_RETENTION_DAYS"] = "30";
    await createVenteBrouillonAction();

    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    const ecart = (data.retentionUntil as Date).getTime() - Date.now();
    expect(ecart).toBeGreaterThan(29 * JOUR_MS);
    expect(ecart).toBeLessThan(31 * JOUR_MS);
  });

  it("refuse une valeur < 1 : retombe sur le défaut (jamais de purge immédiate)", async () => {
    process.env["VENTE_BROUILLON_RETENTION_DAYS"] = "0";
    await createVenteBrouillonAction();

    const data = mockCreate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    const ecart = (data.retentionUntil as Date).getTime() - Date.now();
    expect(ecart).toBeGreaterThan(89 * JOUR_MS);
  });

  it("trace la création dans le journal d'activité", async () => {
    await createVenteBrouillonAction();
    expect(mockLog.mock.calls[0]?.[0]?.action).toBe("qualiopi.vente_brouillon.create");
  });
});

describe("updateVenteBrouillonAction — minimisation RGPD", () => {
  it("dès que clientId est posé, les contacts libres du payload sont supprimés", async () => {
    const r = await updateVenteBrouillonAction({
      id: ID,
      etape: 2,
      clientId: CLIENT_ID,
      payload: {
        contactNom: "Camille Durand",
        contactEmail: "camille@client.test",
        contactTelephone: "+33 6 12 34 56 78",
        offreId: "off-1",
      },
    });

    expect("data" in r).toBe(true);
    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    const payload = data.payload as Record<string, unknown>;
    expect("contactNom" in payload).toBe(false);
    expect("contactEmail" in payload).toBe(false);
    expect("contactTelephone" in payload).toBe(false);
    // Les champs non personnels survivent.
    expect(payload.offreId).toBe("off-1");
  });

  it("clientId DÉJÀ en base : un payload transmis est minimisé aussi", async () => {
    mockFindUnique.mockResolvedValue({
      createdByAdminId: "admin-1",
      clientId: CLIENT_ID,
      payload: {},
    });

    await updateVenteBrouillonAction({
      id: ID,
      payload: { contactEmail: "fuite@client.test", formationId: "f-1" },
    });

    const payload = (mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>)
      .payload as Record<string, unknown>;
    expect("contactEmail" in payload).toBe(false);
    expect(payload.formationId).toBe("f-1");
  });

  it("poser clientId SEUL réécrit le payload existant sans ses contacts", async () => {
    mockFindUnique.mockResolvedValue({
      createdByAdminId: "admin-1",
      clientId: null,
      payload: { contactNom: "Camille", offreId: "off-1" },
    });

    await updateVenteBrouillonAction({ id: ID, clientId: CLIENT_ID });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    const payload = data.payload as Record<string, unknown>;
    expect("contactNom" in payload).toBe(false);
    expect(payload.offreId).toBe("off-1");
  });

  it("sans clientId, les contacts libres restent (le Client n'existe pas encore)", async () => {
    await updateVenteBrouillonAction({
      id: ID,
      payload: { contactEmail: "prospect@client.test" },
    });

    const payload = (mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>)
      .payload as Record<string, unknown>;
    expect(payload.contactEmail).toBe("prospect@client.test");
  });

  it("sans clientId ni payload, aucune réécriture de payload", async () => {
    await updateVenteBrouillonAction({ id: ID, etape: 3 });

    const data = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
    expect("payload" in data).toBe(false);
    expect(data.etape).toBe(3);
  });

  it("refuse d'écrire le brouillon d'un autre admin", async () => {
    mockFindUnique.mockResolvedValue({
      createdByAdminId: "autre-admin",
      clientId: null,
      payload: {},
    });

    const r = await updateVenteBrouillonAction({ id: ID, etape: 2 });

    expect("error" in r).toBe(true);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("getVenteBrouillonAction — propriété", () => {
  it("rend le brouillon du propriétaire", async () => {
    const r = await getVenteBrouillonAction(ID);
    expect("data" in r).toBe(true);
    if (!("data" in r)) return;
    expect(r.data.id).toBe(ID);
  });

  it("même message pour « absent » et « pas à vous »", async () => {
    mockFindUnique.mockResolvedValue({ createdByAdminId: "autre-admin" });
    const rAutre = await getVenteBrouillonAction(ID);
    mockFindUnique.mockResolvedValue(null);
    const rAbsent = await getVenteBrouillonAction(ID);

    expect("error" in rAutre && rAutre.error).toBe("error" in rAbsent ? rAbsent.error : "");
  });
});

describe("supprimerVenteBrouillonAction", () => {
  it("supprime et trace (avec le fait que le brouillon était converti ou non)", async () => {
    mockFindUnique.mockResolvedValue({ createdByAdminId: "admin-1", sessionId: "sess-1" });

    const r = await supprimerVenteBrouillonAction(ID);

    expect("data" in r).toBe(true);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: ID } });
    expect(mockLog.mock.calls[0]?.[0]?.changes?.convertiEnSession).toBe(true);
  });

  it("refuse de supprimer le brouillon d'un autre admin", async () => {
    mockFindUnique.mockResolvedValue({ createdByAdminId: "autre-admin", sessionId: null });

    const r = await supprimerVenteBrouillonAction(ID);

    expect("error" in r).toBe(true);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
