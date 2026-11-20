/**
 * OUT-1 — approbation depuis la corbeille quand la mise en file n'a pas répondu :
 * jamais remise « à valider » (une 2e approbation enverrait un doublon), message clair,
 * et l'écriture « envoyé » ne rouvre jamais une ligne déjà tranchée.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MiseEnFileIncertaine } from "@/server/email/outbox-en-cours";

const ID = "00000000-0000-4000-8000-000000000002";

const h = vi.hoisted(() => ({
  etat: { statut: "a_valider" as string },
  enqueue: vi.fn(),
  updateMany: vi.fn(),
  sentryExc: vi.fn(),
  sentryMsg: vi.fn(),
  ecrireEnvoye: { v: null as null | (() => void) },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => h.sentryExc(...a),
  captureMessage: (...a: unknown[]) => h.sentryMsg(...a),
}));
vi.mock("@/lib/telegram", () => ({ sendTelegram: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => ({ userId: "u-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => h.enqueue(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      findUnique: async () => ({
        id: ID,
        template: "contact-confirmed",
        recipient: "destinataire-secret@exemple.test",
        locale: "fr",
        payload: {},
        sujet: "s",
        statut: h.etat.statut,
        clientId: null,
        entityType: null,
        entityId: null,
        attachments: null,
      }),
      updateMany: async (args: { where: { statut: string }; data: Record<string, unknown> }) => {
        h.updateMany(args);
        if (args.data["statut"] === "approuve") {
          h.etat.statut = "approuve";
          return { count: 1 };
        }
        if (args.data["statut"] === "envoye") h.ecrireEnvoye.v?.();
        if (h.etat.statut !== args.where.statut) return { count: 0 };
        h.etat.statut = args.data["statut"] as string;
        return { count: 1 };
      },
    },
  },
}));

import { approuverEmailAction } from "@/server/actions/qualiopi/email-outbox";

beforeEach(() => {
  vi.clearAllMocks();
  h.etat.statut = "a_valider";
  h.ecrireEnvoye.v = null;
  h.enqueue.mockResolvedValue({ enqueued: true });
});

describe("OUT-1 — approbation", () => {
  it("l'enfilage passe la clé de tâche outbox-<id>", async () => {
    await approuverEmailAction({ id: ID });
    expect(h.enqueue.mock.calls[0]?.[4]).toMatchObject({
      bypassValidation: true,
      cleOutbox: `outbox-${ID}`,
    });
  });

  it("MiseEnFileIncertaine : jamais remise « à valider », message attendu, Sentry sans donnée", async () => {
    h.enqueue.mockRejectedValue(new MiseEnFileIncertaine());
    const r = await approuverEmailAction({ id: ID });
    expect(r).toEqual({
      error:
        "L'envoi n'a pas pu être confirmé. Ne l'approuvez pas de nouveau : vérifiez dans E-mails envoyés.",
    });
    expect(h.updateMany.mock.calls.some((c) => c[0].data.statut === "a_valider")).toBe(false);
    expect(h.etat.statut).toBe("approuve");
    expect(JSON.stringify(h.sentryExc.mock.calls)).not.toContain("destinataire-secret");
    expect(h.sentryExc).toHaveBeenCalledTimes(1);
  });

  it("une autre erreur de file : remise « à valider » comme avant (non-régression)", async () => {
    h.enqueue.mockRejectedValue(new Error("panne"));
    const r = await approuverEmailAction({ id: ID });
    expect("error" in r).toBe(true);
    expect(h.etat.statut).toBe("a_valider");
  });

  it("écriture « envoyé » : la ligne n'est plus « approuvé » → statut inchangé, Sentry, pas d'erreur visible", async () => {
    h.ecrireEnvoye.v = () => {
      h.etat.statut = "refuse";
    };
    const r = await approuverEmailAction({ id: ID });
    expect(r).toEqual({ data: { id: ID, envoye: true } });
    expect(h.etat.statut).toBe("refuse");
    expect(h.sentryMsg).toHaveBeenCalledTimes(1);
  });
});
