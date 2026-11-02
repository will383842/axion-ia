// Audit présentiel PR3 : révocation et régénération depuis la fiche : la séance doit appartenir au client de la page.
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
const trouver = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { auditTerrainSession: { findUnique: (...a: unknown[]) => trouver(...a) } },
}));
const revoquer = vi.fn();
const regenerer = vi.fn();
vi.mock("../actions", () => ({
  revoquerJetonAudit: (...a: unknown[]) => revoquer(...a),
  regenererJetonAudit: (...a: unknown[]) => regenerer(...a),
}));
import { regenererJetonDeLaFiche, revoquerJetonDeLaFiche } from "../actions-fiche";

const CLIENT = randomUUID();
const SESSION = randomUUID();
beforeEach(() => {
  [authMock, trouver, revoquer, regenerer].forEach((m) => m.mockReset());
  authMock.mockResolvedValue({ user: { id: randomUUID(), role: "super_admin" } });
  trouver.mockResolvedValue({ clientId: CLIENT });
  revoquer.mockResolvedValue({ ok: true, revoque: true });
  regenerer.mockResolvedValue({
    ok: true,
    jeton: "x",
    sessionId: SESSION,
    expireLe: "2026-11-08T00:00:00.000Z",
  });
});

describe("actions depuis la fiche", () => {
  it("refuse un autre rôle sans lire la base", async () => {
    authMock.mockResolvedValue({ user: { id: "u", role: "admin" } });
    expect(await revoquerJetonDeLaFiche({ clientId: CLIENT, sessionId: SESSION })).toEqual({
      ok: false,
      erreur: "interdit",
    });
    expect(trouver).not.toHaveBeenCalled();
  });
  it("refuse une séance d'un AUTRE client (révocation et régénération)", async () => {
    trouver.mockResolvedValue({ clientId: randomUUID() });
    expect(await revoquerJetonDeLaFiche({ clientId: CLIENT, sessionId: SESSION })).toEqual({
      ok: false,
      erreur: "introuvable",
    });
    expect(
      await regenererJetonDeLaFiche({ clientId: CLIENT, sessionId: SESSION, joursValidite: 5 }),
    ).toEqual({ ok: false, erreur: "introuvable" });
    expect(revoquer).not.toHaveBeenCalled();
    expect(regenerer).not.toHaveBeenCalled();
  });
  it("refuse une validité hors 2, 5, 10 jours", async () => {
    expect(
      await regenererJetonDeLaFiche({ clientId: CLIENT, sessionId: SESSION, joursValidite: 7 }),
    ).toEqual({ ok: false, erreur: "invalide" });
  });
  it("transmet la validité choisie quand la séance appartient au client", async () => {
    await regenererJetonDeLaFiche({ clientId: CLIENT, sessionId: SESSION, joursValidite: 10 });
    expect(regenerer).toHaveBeenCalledWith({ sessionId: SESSION, joursValidite: 10 });
    await revoquerJetonDeLaFiche({ clientId: CLIENT, sessionId: SESSION });
    expect(revoquer).toHaveBeenCalledWith(SESSION);
  });
});
