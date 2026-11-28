import { describe, expect, it, vi } from "vitest";

// PR H (#2464) : la prime d'un challenge ENTRE dans les honoraires de l'année de la DAS2 (comme toute
// commission versée). Rien n'est exclu par activité.

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

import { lignesDas2Apporteurs } from "../commissions";

describe("DAS2 et prime de challenge", () => {
  it("une prime versée dans l'année s'ajoute aux honoraires déclarés", async () => {
    const le = new Date("2026-12-20T10:00:00Z");
    lignes.push(
      {
        apporteurId: "APP1",
        statut: "versee",
        montantCents: 200_000,
        verseeAt: le,
        releveMois: "2026-12",
        activite: "audit",
      },
      {
        apporteurId: "APP1",
        statut: "versee",
        montantCents: 50_000,
        verseeAt: le,
        releveMois: "2026-12",
        activite: "prime_challenge",
      },
    );
    const l = await lignesDas2Apporteurs(2026);
    expect(l).toHaveLength(1);
    expect(l[0]!.totalCents).toBe(250_000);
  });
});
