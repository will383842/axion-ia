/**
 * Point 17 (#2464) : la Journée IA suit la grille signée. Grille v3 : 500 € par journée au prorata.
 * Grille v2 : prestation hors grille (A1.7), « à qualifier », jamais 500 €, jamais 0 € silencieux.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const etat = vi.hoisted(() => ({
  signature: { version: "2.8" } as unknown,
  maj: [] as Array<Record<string, unknown>>,
}));

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("../jeton", () => ({ urlDossier: () => null }));
vi.mock("../envois", () => ({ envoyer: vi.fn(async () => "envoye") }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    commissionApporteur: {
      findUnique: vi.fn(async () => ({
        id: "C1",
        apporteurId: "APP1",
        factureId: "F1",
        presentationId: "P1",
        parrainage: false,
        activite: "formation",
        factureHtCents: 149_000,
        statut: "a_qualifier",
      })),
      updateMany: vi.fn(async (a: Record<string, unknown>) => {
        etat.maj.push(a);
        return { count: 1 };
      }),
      aggregate: vi.fn(async () => ({ _sum: { montantCents: 0 } })),
    },
    factureFormation: {
      findUnique: vi.fn(async () => ({
        emiseAt: new Date("2026-12-01T00:00:00Z"),
        devis: null,
      })),
    },
    presentationEntreprise: {
      findUnique: vi.fn(async () => ({
        recueAt: new Date("2026-11-01T00:00:00Z"),
        apporteur: { signatureApporteur: etat.signature },
      })),
    },
    pieceApporteur: { findMany: vi.fn(async () => []) },
    apporteurReseau: {
      findUnique: vi.fn(async () => ({ parrainId: null, signatureApporteur: etat.signature })),
    },
    emailLog: { count: vi.fn(async () => 1) },
  },
}));

import { qualifierCommission } from "../commissions";
import { PALIER_HORS_GRILLE } from "../hors-grille";
import {
  commissionJourneeIaSelonGrille,
  MESSAGE_JOURNEE_IA_GRILLE_V2,
  PALIER_JOURNEE_IA_HORS_GRILLE,
} from "../journee-ia-grille";

const lignes = [{ designation: "Journée IA", quantite: 1 }];

beforeEach(() => {
  etat.signature = { version: "2.8" };
  etat.maj = [];
});

describe("commissionJourneeIaSelonGrille", () => {
  it("v3, une journée à 1 490 € → 500 €", () => {
    const r = commissionJourneeIaSelonGrille({
      grille: "v3",
      activite: "formation",
      lignes,
      netHtCents: 149_000,
    });
    expect(r.palierAQualifier).toBeNull();
    expect(r.calcul).toMatchObject({ statut: "calculee", montantCents: 50_000 });
  });
  it("v3, prix réduit → prorata", () => {
    const r = commissionJourneeIaSelonGrille({
      grille: "v3",
      activite: "formation",
      lignes,
      netHtCents: 134_100,
    });
    expect(r.calcul).toMatchObject({ statut: "calculee", montantCents: 45_000 });
  });
  it("v2 → a_qualifier, palier hors-grille, jamais 500 €, jamais 0 €", () => {
    const r = commissionJourneeIaSelonGrille({
      grille: "v2",
      activite: "formation",
      lignes,
      netHtCents: 149_000,
    });
    expect(r.calcul).toEqual({ statut: "a_qualifier" });
    expect(r.palierAQualifier).toBe(PALIER_HORS_GRILLE);
  });
});

it("le repère recopié est celui du circuit A1.7", () => {
  expect(PALIER_JOURNEE_IA_HORS_GRILLE).toBe(PALIER_HORS_GRILLE);
});

describe("qualifierCommission(…, « journee-ia »)", () => {
  it("apporteur 2.6 : refus avec le message de la grille v2, rien n'est écrit", async () => {
    etat.signature = { version: "2.6" };
    const r = await qualifierCommission("C1", "journee-ia");
    expect(r).toEqual({ ok: false, message: MESSAGE_JOURNEE_IA_GRILLE_V2 });
    expect(etat.maj).toHaveLength(0);
  });
  it("apporteur 2.8 : le montant", async () => {
    const r = await qualifierCommission("C1", "journee-ia");
    expect(r).toMatchObject({ ok: true, montantCents: 50_000 });
  });
});
