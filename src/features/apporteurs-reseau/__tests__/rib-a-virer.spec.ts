// Lot 7 (D-6 option A) : « Ouvrir le RIB à virer ».
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  gel: new Map<string, unknown>(),
  piece: { id: "p1" } as { id: string } | null,
  journal: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@/server/journal/journaliser", () => ({
  journaliser: vi.fn(async (_db: unknown, e: Record<string, unknown>) => {
    etat.journal.push(e);
    return true;
  }),
}));
vi.mock("../virement-compte", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../virement-compte")>()),
  demandesQuiGelent: vi.fn(async () => etat.gel),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    pieceApporteur: { findFirst: vi.fn(async () => etat.piece) },
    apporteurReseau: { findUnique: vi.fn(async () => ({ iban: "FR7630006000011234567890189" })) },
  },
}));

import { ouvrirRibAVirer } from "../rib-a-virer";

const A = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  etat.gel = new Map();
  etat.piece = { id: "p1" };
  etat.journal = [];
});

describe("ouvrir le RIB à virer", () => {
  it("super_admin et admin : accepté, journalisé avec la fin du compte seulement", async () => {
    for (const role of ["super_admin", "admin"]) {
      etat.journal = [];
      const r = await ouvrirRibAVirer({ apporteurId: A, acteur: { id: "u", role } });
      expect(r).toEqual({ ok: true, pieceId: "p1" });
      expect(etat.journal).toHaveLength(1);
      expect(JSON.stringify(etat.journal)).toContain("0189");
      expect(JSON.stringify(etat.journal)).not.toContain("FR7630006000011234567890189");
    }
  });

  it("refusé hors « facturer », sans trace", async () => {
    const r = await ouvrirRibAVirer({ apporteurId: A, acteur: { id: "u", role: "editor" } });
    expect(r.ok).toBe(false);
    expect(etat.journal).toHaveLength(0);
  });

  it("refusé sous gel : aucun bouton, aucune ouverture, aucune trace", async () => {
    etat.gel = new Map([[A, { statut: "confirmee" }]]);
    const r = await ouvrirRibAVirer({ apporteurId: A, acteur: { id: "u", role: "admin" } });
    expect(r).toEqual({ ok: false, message: "Virements gelés : changement de compte en cours" });
    expect(etat.journal).toHaveLength(0);
  });

  it("aucun RIB courant : refus", async () => {
    etat.piece = null;
    expect((await ouvrirRibAVirer({ apporteurId: A, acteur: { id: "u", role: "admin" } })).ok).toBe(
      false,
    );
  });
});
