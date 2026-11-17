/**
 * L5h — convention garée « à valider » alors que la session commence sous 7 jours.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ outbox: vi.fn(), documents: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    emailOutbox: { findMany: h.outbox },
    documentGenere: { findMany: h.documents },
  },
}));

import { ALERTE_CATALOGUE } from "./catalogue";
import {
  HORIZON_CONVENTION_NON_VALIDEE_JOURS,
  regleConventionNonValideeAvantSession,
} from "./regle-convention-non-validee-avant-session";

const NOW = new Date("2026-12-01T07:00:00Z");
const J = 86_400_000;

type Where = {
  id: { in: string[] };
  session: { statut: string; dateDebut: { gte: Date; lte: Date } };
};

/** Simule la base : ne rend que les pièces dont la session est dans la fenêtre demandée. */
function brancher(
  garees: string[],
  pieces: Array<{ id: string; session: { id: string; numero: string; debut: Date } }>,
) {
  h.outbox.mockResolvedValue(garees.map((entityId) => ({ entityId })));
  h.documents.mockImplementation(async ({ where }: { where: Where }) =>
    pieces
      .filter(
        (p) =>
          where.id.in.includes(p.id) &&
          p.session.debut >= where.session.dateDebut.gte &&
          p.session.debut <= where.session.dateDebut.lte,
      )
      .map((p) => ({ session: { id: p.session.id, numero: p.session.numero } })),
  );
}

beforeEach(() => {
  h.outbox.mockReset();
  h.documents.mockReset();
});

describe("convention_non_validee_avant_session", () => {
  it("session à J-6 avec convention garée : une alerte sur la session", async () => {
    brancher(
      ["d1"],
      [
        {
          id: "d1",
          session: { id: "s1", numero: "AXI-SESS-1", debut: new Date(NOW.getTime() + 6 * J) },
        },
      ],
    );
    const a = await regleConventionNonValideeAvantSession(NOW);
    expect(a).toEqual([
      expect.objectContaining({
        code: "convention_non_validee_avant_session",
        cibleType: "TrainingSession",
        cibleId: "s1",
      }),
    ]);
    expect(a[0]?.niveau).toBe(ALERTE_CATALOGUE.convention_non_validee_avant_session?.niveau);
    expect(a[0]?.message).toContain("AXI-SESS-1");
  });

  it("convention envoyée (plus aucune ligne à valider) : rien", async () => {
    brancher(
      [],
      [{ id: "d1", session: { id: "s1", numero: "N", debut: new Date(NOW.getTime() + 6 * J) } }],
    );
    expect(await regleConventionNonValideeAvantSession(NOW)).toEqual([]);
    expect(h.documents).not.toHaveBeenCalled();
  });

  it("session lointaine (J-20) : rien", async () => {
    brancher(
      ["d1"],
      [{ id: "d1", session: { id: "s1", numero: "N", debut: new Date(NOW.getTime() + 20 * J) } }],
    );
    expect(await regleConventionNonValideeAvantSession(NOW)).toEqual([]);
  });

  it("session déjà commencée : rien", async () => {
    brancher(
      ["d1"],
      [{ id: "d1", session: { id: "s1", numero: "N", debut: new Date(NOW.getTime() - 1 * J) } }],
    );
    expect(await regleConventionNonValideeAvantSession(NOW)).toEqual([]);
  });

  it("la frontière est l'horizon de 7 jours, et la session doit être planifiée", async () => {
    brancher(
      ["d1"],
      [{ id: "d1", session: { id: "s1", numero: "N", debut: new Date(NOW.getTime() + 7 * J) } }],
    );
    expect(await regleConventionNonValideeAvantSession(NOW)).toHaveLength(1);
    const where = h.documents.mock.calls[0]?.[0].where as Where;
    expect(where.session.statut).toBe("planifiee");
    expect(HORIZON_CONVENTION_NON_VALIDEE_JOURS).toBe(7);
  });

  it("une seule alerte par session, même avec plusieurs conventions garées", async () => {
    const s = { id: "s1", numero: "N", debut: new Date(NOW.getTime() + 3 * J) };
    brancher(
      ["d1", "d2", "d1"],
      [
        { id: "d1", session: s },
        { id: "d2", session: s },
      ],
    );
    const a = await regleConventionNonValideeAvantSession(NOW);
    expect(a).toHaveLength(1);
    expect(h.documents.mock.calls[0]?.[0].where.id.in).toEqual(["d1", "d2"]);
  });

  it("ne lit que les convention-envoi à valider d'une pièce", async () => {
    brancher([], []);
    await regleConventionNonValideeAvantSession(NOW);
    expect(h.outbox.mock.calls[0]?.[0].where).toEqual({
      template: "convention-envoi",
      statut: "a_valider",
      entityType: "DocumentGenere",
    });
  });
});
