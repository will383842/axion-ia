/**
 * OUT-1 — l'approbation depuis la corbeille et une file dont l'issue est inconnue.
 *
 * La vraie `approuverEmailAction` tourne ; la base (en mémoire), la file et les gardes sont simulés.
 * Aucun e-mail réel.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MiseEnFileIncertaine } from "@/server/email/outbox-en-cours";

const ID = "11111111-1111-4111-8111-111111111111";

const h = vi.hoisted(() => ({
  ligne: { v: {} as Record<string, unknown> },
  ecrituresStatut: [] as Array<Record<string, unknown>>,
  /** Ce que `updateMany` rend pour l'écriture « envoyé » (simule une ligne tranchée ailleurs). */
  ligneToujoursApprouvee: { v: true },
  enqueue: vi.fn(),
  sentryExc: vi.fn(),
  sentryMsg: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: (...a: unknown[]) => h.sentryExc(...a),
  captureMessage: (...a: unknown[]) => h.sentryMsg(...a),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/server/actions/qualiopi/_guards", () => ({
  requireAdminWrite: async () => ({ userId: "adm-1", role: "super_admin" }),
  logQualiopiActivity: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: {
      findUnique: async () => h.ligne.v,
      updateMany: async ({
        where,
        data,
      }: {
        where: { statut?: string };
        data: Record<string, unknown>;
      }) => {
        if (where.statut === "a_valider") {
          h.ligne.v = { ...h.ligne.v, statut: "approuve" };
          return { count: 1 };
        }
        h.ecrituresStatut.push(data);
        if (data["statut"] === "envoye" && !h.ligneToujoursApprouvee.v) return { count: 0 };
        h.ligne.v = { ...h.ligne.v, ...data };
        return { count: 1 };
      },
      update: async () => {
        throw new Error("`update` sans condition interdit pour « envoyé »");
      },
    },
  },
}));
vi.mock("@/server/queue/queues", () => ({ enqueueEmail: (...a: unknown[]) => h.enqueue(...a) }));

import { approuverEmailAction } from "../email-outbox";

beforeEach(() => {
  h.ligne.v = {
    id: ID,
    template: "devis-envoi",
    recipient: "client@exemple.fr",
    locale: "fr",
    payload: {},
    sujet: "Votre devis",
    statut: "a_valider",
    clientId: null,
    entityType: "Devis",
    entityId: "d-1",
    attachments: null,
  };
  h.ecrituresStatut.length = 0;
  h.ligneToujoursApprouvee.v = true;
  h.enqueue.mockReset().mockResolvedValue({ enqueued: true });
  h.sentryExc.mockReset();
  h.sentryMsg.mockReset();
});

describe("OUT-1 — issue inconnue de la mise en file", () => {
  it("MiseEnFileIncertaine : la ligne n'est PAS remise « à valider », message clair, Sentry sans donnée", async () => {
    h.enqueue.mockRejectedValue(new MiseEnFileIncertaine());
    const r = await approuverEmailAction({ id: ID });
    expect(r).toEqual({
      error:
        "L'envoi n'a pas pu être confirmé. Ne l'approuvez pas de nouveau : vérifiez dans E-mails envoyés.",
    });
    expect(h.ecrituresStatut.some((d) => d["statut"] === "a_valider")).toBe(false);
    expect((h.ligne.v as { statut: string }).statut).toBe("approuve");
    expect(h.sentryExc).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(h.sentryExc.mock.calls)).not.toContain("exemple.fr");
  });

  it("l'identifiant de tâche est celui de la ligne (`outbox-<id>`)", async () => {
    await approuverEmailAction({ id: ID });
    const options = h.enqueue.mock.calls[0]?.[4] as { cleOutbox?: string };
    expect(options.cleOutbox).toBe(`outbox-${ID}`);
  });

  it("autre erreur de la file (injoignable) : la ligne retourne « à valider » comme avant", async () => {
    h.enqueue.mockRejectedValue(new Error("file injoignable"));
    const r = await approuverEmailAction({ id: ID });
    expect("error" in r).toBe(true);
    expect(h.ecrituresStatut.some((d) => d["statut"] === "a_valider")).toBe(true);
  });
});

describe("OUT-1 — l'écriture « envoyé » est conditionnelle", () => {
  it("ligne encore « approuvé » : passe à « envoyé »", async () => {
    const r = await approuverEmailAction({ id: ID });
    expect(r).toEqual({ data: { id: ID, envoye: true } });
    expect((h.ligne.v as { statut: string }).statut).toBe("envoye");
  });

  it("ligne plus « approuvé » : `updateMany` rend 0, statut inchangé, Sentry appelé, pas d'erreur visible", async () => {
    h.ligneToujoursApprouvee.v = false;
    const r = await approuverEmailAction({ id: ID });
    expect("data" in r).toBe(true);
    expect((h.ligne.v as { statut: string }).statut).not.toBe("envoye");
    expect(h.sentryMsg).toHaveBeenCalledTimes(1);
  });
});
