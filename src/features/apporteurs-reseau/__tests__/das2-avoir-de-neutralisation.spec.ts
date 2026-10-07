import { describe, expect, it, vi } from "vitest";

// DAS2 : un avoir qui NEUTRALISE une ligne retenue pour manquement (art. 4.5 bis) ne vient pas en
// déduction du versé de l'année : la ligne retenue n'a jamais été versée.

type L = Record<string, unknown>;
const lignes: L[] = [];

function vrai(l: L, w: Record<string, unknown>): boolean {
  return Object.entries(w).every(([k, c]) => {
    if (k === "OR") return (c as Array<Record<string, unknown>>).some((x) => vrai(l, x));
    if (k === "NOT") return !vrai(l, c as Record<string, unknown>);
    const v = l[k];
    if (c && typeof c === "object" && !(c instanceof Date)) {
      const o = c as Record<string, unknown>;
      if ("not" in o) return o["not"] === null ? v !== null && v !== undefined : v !== o["not"];
      if ("gte" in o) return (v as Date) >= (o["gte"] as Date) && (v as Date) < (o["lt"] as Date);
      if ("in" in o) return (o["in"] as unknown[]).includes(v);
    }
    return v === c;
  });
}

vi.mock("@/lib/pii-crypto", () => ({ decryptPii: (v: unknown) => v }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    commissionApporteur: {
      groupBy: vi.fn(async (a: { where: Record<string, unknown> }) => {
        const ls = lignes.filter((l) => vrai(l, a.where));
        if (ls.length === 0) return [];
        return [
          {
            apporteurId: "APP1",
            _sum: { montantCents: ls.reduce((s, l) => s + (l["montantCents"] as number), 0) },
            _count: { _all: ls.length },
          },
        ];
      }),
    },
    apporteurReseau: {
      findMany: vi.fn(async () => [
        {
          id: "APP1",
          prenom: "Claire",
          nom: "Martin",
          denomination: null,
          siren: "732829320",
          adresse: null,
        },
      ]),
    },
  },
}));

import { exportDas2 } from "../commissions";

describe("DAS2 et avoir de neutralisation", () => {
  it("2 000 € versés puis 400 € retenus pour manquement : la déclaration reste à 2 000 €", async () => {
    const le = new Date("2026-06-01T10:00:00Z");
    lignes.push(
      {
        apporteurId: "APP1",
        statut: "versee",
        montantCents: 200_000,
        verseeAt: le,
        releveMois: "2026-06",
        activite: "audit",
      },
      {
        apporteurId: "APP1",
        statut: "retenue",
        montantCents: 40_000,
        verseeAt: null,
        releveMois: "2026-09",
        activite: "audit",
      },
      {
        apporteurId: "APP1",
        statut: "reprise",
        montantCents: -40_000,
        verseeAt: le,
        releveMois: "2026-10",
        activite: "neutralisation",
      },
    );
    const csv = await exportDas2(2026);
    expect(csv).toMatch(/2 ?000,00|200000|2000[.,]00/);
    expect(csv).not.toMatch(/1 ?600,00|160000|1600[.,]00/);
  });
});
