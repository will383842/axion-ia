import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ groupBy: vi.fn(), sentry: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException: h.sentry }));
vi.mock("@/lib/prisma", () => ({ prisma: { emailLog: { groupBy: h.groupBy } } }));

import {
  agregerCompteurs,
  COMPTEURS_VIDES,
  FENETRE_COMPTEURS_JOURS,
  lireCompteursGabarits,
} from "./compteurs-gabarits";

const NOW = new Date("2026-12-01T10:00:00Z");

beforeEach(() => {
  h.groupBy.mockReset();
  h.sentry.mockReset();
});

describe("compteurs par gabarit (L6b)", () => {
  it("regroupe juste sur un jeu simulé", async () => {
    h.groupBy.mockResolvedValue([
      { template: "a", status: "sent", _count: { _all: 10 } },
      { template: "a", status: "failed", _count: { _all: 2 } },
      { template: "a", status: "bounced", _count: { _all: 1 } },
      { template: "a", status: "pending", _count: { _all: 3 } },
      { template: "a", status: "cancelled", _count: { _all: 4 } },
      { template: "b", status: "sent", _count: { _all: 5 } },
    ]);
    const m = await lireCompteursGabarits(NOW);
    expect(m?.get("a")).toEqual({ total: 20, envoyes: 10, echecs: 2, rebonds: 1, autres: 7 });
    expect(m?.get("b")).toEqual({ total: 5, envoyes: 5, echecs: 0, rebonds: 0, autres: 0 });
  });

  it("fenêtre de 30 jours respectée, groupBy sur template et status", async () => {
    h.groupBy.mockResolvedValue([]);
    await lireCompteursGabarits(NOW);
    const arg = h.groupBy.mock.calls[0]?.[0];
    expect(arg.by).toEqual(["template", "status"]);
    expect(FENETRE_COMPTEURS_JOURS).toBe(30);
    expect(arg.where.createdAt.gte).toEqual(new Date("2026-11-01T10:00:00Z"));
  });

  it("zéro pour un gabarit sans envoi : absent de la table, l'appelant lit COMPTEURS_VIDES", async () => {
    h.groupBy.mockResolvedValue([{ template: "a", status: "sent", _count: { _all: 1 } }]);
    const m = await lireCompteursGabarits(NOW);
    expect(m?.get("jamais-envoye")).toBeUndefined();
    expect(COMPTEURS_VIDES).toEqual({ total: 0, envoyes: 0, echecs: 0, rebonds: 0, autres: 0 });
  });

  it("une seule requête, quel que soit le nombre de gabarits", async () => {
    h.groupBy.mockResolvedValue(
      Array.from({ length: 50 }, (_, i) => ({
        template: `t${i}`,
        status: "sent",
        _count: { _all: 1 },
      })),
    );
    await lireCompteursGabarits(NOW);
    expect(h.groupBy).toHaveBeenCalledTimes(1);
  });

  it("lecture en échec : null, sans lever", async () => {
    h.groupBy.mockRejectedValue(new Error("base indisponible"));
    expect(await lireCompteursGabarits(NOW)).toBeNull();
    expect(h.sentry).toHaveBeenCalledTimes(1);
  });

  it("agregerCompteurs sur liste vide : table vide", () => {
    expect(agregerCompteurs([]).size).toBe(0);
  });
});
