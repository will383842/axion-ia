// Audit présentiel PR2 : création/révocation du jeton, réservées au super_admin.
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.fn();
vi.mock("@/auth", () => ({ auth: () => authMock() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
const journalMock = vi.fn();
vi.mock("@/server/content-gen/shared/activity-log-writer", () => ({ ecrireJournalActivite: (...a: unknown[]) => journalMock(...a) }));

const creer = vi.fn();
const maj = vi.fn();
const trouverSession = vi.fn();
const trouverClient = vi.fn();
const trouverMission = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    client: { findUnique: (...a: unknown[]) => trouverClient(...a) },
    auditMission: { findFirst: (...a: unknown[]) => trouverMission(...a) },
    auditTerrainSession: {
      create: (...a: unknown[]) => creer(...a),
      update: (...a: unknown[]) => maj(...a),
      findUnique: (...a: unknown[]) => trouverSession(...a),
    },
  },
}));

import { creerJetonAudit, revoquerJetonAudit } from "../actions";
import { empreinteJeton, lireJeton } from "@/server/audit-terrain/jeton";

const ADMIN = randomUUID();
const CLIENT = randomUUID();

beforeEach(() => {
  [authMock, journalMock, creer, maj, trouverSession, trouverClient, trouverMission].forEach((m) => m.mockReset());
  authMock.mockResolvedValue({ user: { id: ADMIN, role: "super_admin" } });
  trouverClient.mockResolvedValue({ id: CLIENT });
});

describe("creerJetonAudit", () => {
  it("refuse un non super_admin et un visiteur", async () => {
    authMock.mockResolvedValue({ user: { id: ADMIN, role: "admin" } });
    expect(await creerJetonAudit({ clientId: CLIENT })).toEqual({ ok: false, erreur: "interdit" });
    authMock.mockResolvedValue(null);
    expect(await creerJetonAudit({ clientId: CLIENT })).toEqual({ ok: false, erreur: "interdit" });
    expect(creer).not.toHaveBeenCalled();
  });
  it("crée la session avec l'empreinte seule, expiration J+2, et rend le jeton une fois", async () => {
    const r = await creerJetonAudit({ clientId: CLIENT });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const data = creer.mock.calls[0]![0].data;
    const lu = lireJeton("Bearer " + r.jeton)!;
    expect(lu.sessionId).toBe(data.id);
    expect(data.jetonEmpreinte).toBe(empreinteJeton(lu.secret));
    expect(JSON.stringify(data)).not.toContain(lu.secret);
    expect(data.creeParId).toBe(ADMIN);
    const jours = (data.jetonExpireLe.getTime() - Date.now()) / 86_400_000;
    expect(jours).toBeGreaterThan(1.99);
    expect(jours).toBeLessThan(2.01);
    expect(JSON.stringify(journalMock.mock.calls)).not.toContain(lu.secret);
  });
  it("refuse une entrée invalide, un client inconnu, une durée trop longue", async () => {
    expect(await creerJetonAudit({ clientId: "x" })).toEqual({ ok: false, erreur: "invalide" });
    expect(await creerJetonAudit({ clientId: CLIENT, joursValidite: 30 })).toEqual({ ok: false, erreur: "invalide" });
    trouverClient.mockResolvedValue(null);
    expect(await creerJetonAudit({ clientId: CLIENT })).toEqual({ ok: false, erreur: "introuvable" });
    expect(creer).not.toHaveBeenCalled();
  });
  it("deux jetons successifs sont différents", async () => {
    const a = await creerJetonAudit({ clientId: CLIENT });
    const b = await creerJetonAudit({ clientId: CLIENT });
    expect(a.ok && b.ok && a.jeton !== b.jeton).toBe(true);
  });
});

describe("revoquerJetonAudit", () => {
  it("refuse un non super_admin", async () => {
    authMock.mockResolvedValue({ user: { id: ADMIN, role: "admin" } });
    expect(await revoquerJetonAudit(randomUUID())).toEqual({ ok: false, erreur: "interdit" });
    expect(maj).not.toHaveBeenCalled();
  });
  it("passe le statut à revoquee sans rien supprimer, une seule fois", async () => {
    const id = randomUUID();
    trouverSession.mockResolvedValue({ id, jetonRevoqueLe: null });
    expect(await revoquerJetonAudit(id)).toEqual({ ok: true, revoque: true });
    expect(maj.mock.calls[0]![0].data).toMatchObject({ statut: "revoquee" });
    expect(maj.mock.calls[0]![0].data.jetonRevoqueLe).toBeInstanceOf(Date);
    trouverSession.mockResolvedValue({ id, jetonRevoqueLe: new Date() });
    await revoquerJetonAudit(id);
    expect(maj).toHaveBeenCalledTimes(1);
  });
  it("session inconnue", async () => {
    trouverSession.mockResolvedValue(null);
    expect(await revoquerJetonAudit(randomUUID())).toEqual({ ok: false, erreur: "introuvable" });
  });
});
