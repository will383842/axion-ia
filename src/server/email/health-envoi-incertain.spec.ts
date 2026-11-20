// OUT-1 — le balayage horaire des « approuvé » anciens lit le journal de la tâche outbox-<id> :
// `pending` = issue inconnue (on laisse + alerte), `sent` = parti (→ envoyé + alerte),
// rien / échec / annulé = rien n'est parti (→ « à valider », comme avant).
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  anciens: [] as Array<{ id: string }>,
  journaux: [] as Array<{ jobId: string; status: string }>,
  updateMany: vi.fn(),
  alerte: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailLog: {
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null),
      // La sonde lit aussi le journal pour d'autres mesures : seule la lecture par `jobId` est simulée.
      findMany: vi.fn(async (a: { where?: { jobId?: unknown } }) =>
        a?.where?.jobId !== undefined ? h.journaux : [],
      ),
    },
    emailOutbox: {
      findMany: vi.fn(async () => h.anciens),
      updateMany: (...a: unknown[]) => h.updateMany(...a),
    },
    alerteSysteme: { updateMany: vi.fn() },
  },
}));
vi.mock("@/lib/redis", () => ({ redis: { get: vi.fn(async () => null), set: vi.fn() } }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({
  creerOuDedup: (...a: unknown[]) => h.alerte(...a),
  creerOuActualiser: (...a: unknown[]) => h.alerte(...a),
  resoudreAlertesParCode: vi.fn(async () => 0),
}));
vi.mock("@/server/notifications", () => ({ notify: vi.fn(async () => ({ ok: true })) }));

import { verifierSanteEmails } from "./health";

const codes = () => h.alerte.mock.calls.map((c) => (c[0] as { code: string }).code);
const statutsEcrits = () => h.updateMany.mock.calls.map((c) => c[0].data.statut);

beforeEach(() => {
  vi.clearAllMocks();
  h.anciens = [{ id: "L1" }];
  h.journaux = [];
  h.updateMany.mockResolvedValue({ count: 1 });
  h.alerte.mockResolvedValue(null);
  process.env["ZEPTOMAIL_WEBHOOK_KEY"] = "cle";
});

describe("balayage des « approuvé » anciens — OUT-1", () => {
  it("journal `pending` : la ligne reste « approuvé », alerte emails_envoi_incertain", async () => {
    h.journaux = [{ jobId: "outbox-L1", status: "pending" }];
    const s = await verifierSanteEmails(new Date("2026-11-20T10:00:00Z"));
    expect(h.updateMany).not.toHaveBeenCalled();
    expect(s.approuvesEnvoiIncertain).toBe(1);
    expect(s.approuvesRemisEnAttente).toBe(0);
    expect(codes()).toContain("emails_envoi_incertain");
    expect(codes()).not.toContain("emails_approuves_abandonnes");
  });

  it("journal `sent` : « approuvé » → « envoyé » (conditionnel) + alerte", async () => {
    h.journaux = [{ jobId: "outbox-L1", status: "sent" }];
    const s = await verifierSanteEmails(new Date("2026-11-20T10:00:00Z"));
    expect(h.updateMany).toHaveBeenCalledTimes(1);
    expect(h.updateMany.mock.calls[0]?.[0]).toMatchObject({
      where: { id: { in: ["L1"] }, statut: "approuve" },
      data: { statut: "envoye" },
    });
    expect(s.approuvesRemisEnAttente).toBe(0);
    expect(codes()).toContain("emails_envoi_incertain");
  });

  it.each([
    ["aucun journal", []],
    ["journal `failed`", [{ jobId: "outbox-L1", status: "failed" }]],
    ["journal `cancelled`", [{ jobId: "outbox-L1", status: "cancelled" }]],
  ])("%s : remise « à valider » comme avant, aucune alerte d'issue inconnue", async (_n, j) => {
    h.journaux = j;
    const s = await verifierSanteEmails(new Date("2026-11-20T10:00:00Z"));
    expect(statutsEcrits()).toEqual(["a_valider"]);
    expect(s.approuvesRemisEnAttente).toBe(1);
    expect(codes()).toContain("emails_approuves_abandonnes");
    expect(codes()).not.toContain("emails_envoi_incertain");
  });

  it("l'alerte ne porte ni adresse ni identifiant de ligne", async () => {
    h.journaux = [{ jobId: "outbox-L1", status: "pending" }];
    await verifierSanteEmails(new Date("2026-11-20T10:00:00Z"));
    expect(JSON.stringify(h.alerte.mock.calls)).not.toContain("L1");
    expect(JSON.stringify(h.alerte.mock.calls)).not.toContain("@");
  });
});
