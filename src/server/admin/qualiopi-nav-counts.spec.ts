import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    relanceProposee: { count: (...a: unknown[]) => h.count(...a) },
    activityLog: { findMany: (...a: unknown[]) => h.findMany(...a) },
  },
}));
vi.mock("@/server/email/outbox-service", () => ({ compterEnAttente: async () => 0 }));
vi.mock("@/server/qualiopi/alertes/alertes-service", () => ({ countNonLues: async () => 0 }));
vi.mock("@/server/qualiopi/documents/signature/pieces-en-attente", () => ({
  compterPiecesEnAttente: async () => 0,
}));
vi.mock("@/server/qualiopi/parcours/echeances-service", () => ({
  compterEcheancesDepassees: async () => 0,
}));

import { relancesAtraiterWhere } from "@/server/qualiopi/devis/relances-a-traiter-filtre";
import { compterQualiopiNav } from "./qualiopi-nav-counts";

const NOW = new Date("2030-06-01T10:00:00Z");

describe("compteur « relances » du menu et délai demandé par le client", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    h.count.mockReset().mockResolvedValue(3);
    h.findMany.mockReset();
  });

  it("passe au filtre la liste des devis en délai lue dans le journal", async () => {
    h.findMany.mockResolvedValue([
      {
        targetId: "devis-1",
        action: "qualiopi.devis.delai_client.demande",
        changes: { finDelai: "2030-06-08T00:00:00.000Z" },
        createdAt: new Date("2030-05-31T10:00:00Z"),
        id: "a",
      },
    ]);
    const r = await compterQualiopiNav();
    expect(h.count).toHaveBeenCalledWith({ where: relancesAtraiterWhere(NOW, ["devis-1"]) });
    expect(r.relances).toBe(3);
  });

  it("lecture du journal qui rejette : compte quand même, avec le filtre d'origine", async () => {
    h.findMany.mockRejectedValue(new Error("base indisponible"));
    const r = await compterQualiopiNav();
    expect(h.count).toHaveBeenCalledWith({ where: relancesAtraiterWhere(NOW) });
    expect(r.relances).toBe(3);
  });
});
