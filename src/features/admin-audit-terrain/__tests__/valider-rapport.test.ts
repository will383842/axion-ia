// Audit présentiel PR3 : validation du brouillon du rapport par le super_admin.
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
const journalMock = vi.fn();
vi.mock("@/server/audit-terrain/journal", () => ({
  ecrireJournalActivite: (...a: unknown[]) => journalMock(...a),
}));
const trouver = vi.fn();
const plusRecent = vi.fn();
const maj = vi.fn();
const CLIENT = randomUUID();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditTerrainRapport: {
      findUnique: (...a: unknown[]) => trouver(...a),
      findFirst: (...a: unknown[]) => plusRecent(...a),
      updateMany: (...a: unknown[]) => maj(...a),
    },
  },
}));
import { validerRapportAudit } from "../actions";

const ADMIN = randomUUID();
const RID = randomUUID();
beforeEach(() => {
  [authMock, journalMock, trouver, plusRecent, maj].forEach((m) => m.mockReset());
  authMock.mockResolvedValue({ user: { id: ADMIN, role: "super_admin" } });
  trouver.mockResolvedValue({
    id: RID,
    sessionId: randomUUID(),
    version: 2,
    statut: "a_relire",
    session: { clientId: CLIENT },
  });
  plusRecent.mockResolvedValue(null);
  maj.mockResolvedValue({ count: 1 });
});

describe("validerRapportAudit", () => {
  it("refuse tout autre rôle et les visiteurs, sans toucher la base", async () => {
    authMock.mockResolvedValue({ user: { id: ADMIN, role: "admin" } });
    expect(await validerRapportAudit(RID, CLIENT)).toEqual({ ok: false, erreur: "interdit" });
    authMock.mockResolvedValue(null);
    expect(await validerRapportAudit(RID, CLIENT)).toEqual({ ok: false, erreur: "interdit" });
    expect(trouver).not.toHaveBeenCalled();
  });
  it("refuse un identifiant invalide ou inconnu", async () => {
    expect(await validerRapportAudit("x", CLIENT)).toEqual({ ok: false, erreur: "invalide" });
    trouver.mockResolvedValue(null);
    expect(await validerRapportAudit(RID, CLIENT)).toEqual({ ok: false, erreur: "introuvable" });
  });
  it("refuse un rapport qui appartient à un AUTRE client que la fiche", async () => {
    expect(await validerRapportAudit(RID, randomUUID())).toEqual({
      ok: false,
      erreur: "introuvable",
    });
    expect(maj).not.toHaveBeenCalled();
    expect(journalMock).not.toHaveBeenCalled();
  });
  it("valide la dernière version et le journalise sans contenu", async () => {
    expect(await validerRapportAudit(RID, CLIENT)).toEqual({ ok: true, valide: true });
    expect(maj).toHaveBeenCalledWith({
      where: { id: RID, statut: "a_relire" },
      data: expect.objectContaining({ statut: "valide", valideParId: ADMIN }),
    });
    expect(journalMock).toHaveBeenCalledTimes(1);
  });
  it("refuse une version qui n'est plus la dernière", async () => {
    plusRecent.mockResolvedValue({ id: randomUUID() });
    expect(await validerRapportAudit(RID, CLIENT)).toEqual({
      ok: false,
      erreur: "ancienne_version",
    });
    expect(maj).not.toHaveBeenCalled();
  });
  it("double clic / version dépassée entre la lecture et l'écriture : une seule validation, un seul journal", async () => {
    maj.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    expect((await validerRapportAudit(RID, CLIENT)).ok).toBe(true);
    expect(await validerRapportAudit(RID, CLIENT)).toEqual({
      ok: false,
      erreur: "ancienne_version",
    });
    expect(journalMock).toHaveBeenCalledTimes(1);
  });
  it("déjà validé : sans effet", async () => {
    trouver.mockResolvedValue({
      id: RID,
      sessionId: randomUUID(),
      version: 2,
      statut: "valide",
      session: { clientId: CLIENT },
    });
    expect(await validerRapportAudit(RID, CLIENT)).toEqual({ ok: true, valide: true });
    expect(maj).not.toHaveBeenCalled();
  });
});
