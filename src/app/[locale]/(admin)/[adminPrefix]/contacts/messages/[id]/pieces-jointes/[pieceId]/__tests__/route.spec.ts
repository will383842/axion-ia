// @vitest-environment node

/**
 * Téléchargement d'une pièce jointe de contact — la route ne sert RIEN sans
 * session admin, et ne sert une pièce que pour SA demande.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  findFirst: vi.fn(),
  fluxTelechargementR2: vi.fn(),
  activityLogCreate: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: h.auth }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    submissionAttachment: { findFirst: h.findFirst },
    activityLog: { create: h.activityLogCreate },
  },
}));
vi.mock("@/lib/r2-storage", () => ({ fluxTelechargementR2: h.fluxTelechargementR2 }));
vi.mock("@/lib/client-ip", () => ({ getClientIp: async () => "203.0.113.7" }));

import { GET } from "../route";

const SUB = "11111111-1111-4111-8111-111111111111";
const PIECE = "22222222-2222-4222-8222-222222222222";
const appel = (id = SUB, pieceId = PIECE) =>
  GET(new Request("https://exemple.invalid/x"), { params: Promise.resolve({ id, pieceId }) });

beforeEach(() => {
  vi.clearAllMocks();
  h.findFirst.mockResolvedValue({
    nomFichier: "Cahier des charges.pdf",
    cleStockage: "contact/pieces-jointes/2026/x/y.pdf",
  });
  h.fluxTelechargementR2.mockResolvedValue(new Blob(["%PDF-1.7"]).stream());
});

describe("route de téléchargement d'une pièce jointe", () => {
  it("refuse sans session (401), sans lire la base ni R2", async () => {
    h.auth.mockResolvedValue(null);
    const r = await appel();
    expect(r.status).toBe(401);
    expect(h.findFirst).not.toHaveBeenCalled();
    expect(h.fluxTelechargementR2).not.toHaveBeenCalled();
  });

  it("refuse une session sans rôle admin (403)", async () => {
    h.auth.mockResolvedValue({ user: { id: "u1", role: "stagiaire" } });
    const r = await appel();
    expect(r.status).toBe(403);
    expect(h.fluxTelechargementR2).not.toHaveBeenCalled();
  });

  it("cherche la pièce DANS sa demande, et rend 404 sinon", async () => {
    h.auth.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    h.findFirst.mockResolvedValue(null);
    const r = await appel();
    expect(r.status).toBe(404);
    // …et seulement une pièce REÇUE : une pièce en attente ou refusée ne se sert pas.
    expect(h.findFirst.mock.calls[0]![0].where).toEqual({
      id: PIECE,
      submissionId: SUB,
      statut: "recue",
    });
  });

  it("rend 404 sur un identifiant mal formé, sans requête", async () => {
    h.auth.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    const r = await appel("../../etc", PIECE);
    expect(r.status).toBe(404);
    expect(h.findFirst).not.toHaveBeenCalled();
  });

  it("sert la pièce en téléchargement neutre à un admin, et trace l'accès", async () => {
    h.auth.mockResolvedValue({ user: { id: "u1", role: "admin" } });
    const r = await appel();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/octet-stream");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-disposition")).toMatch(
      /^attachment; filename="Cahier des charges.pdf"/,
    );
    expect(r.headers.get("cache-control")).toBe("private, no-store");
    expect(h.activityLogCreate).toHaveBeenCalledTimes(1);
    expect(await r.text()).toBe("%PDF-1.7");
  });
});
