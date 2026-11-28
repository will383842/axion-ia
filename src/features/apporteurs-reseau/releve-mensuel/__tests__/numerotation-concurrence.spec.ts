// @vitest-environment node

/**
 * Lot 3c : deux préparations CONCURRENTES donnent deux numéros distincts, le verrou est pris dans
 * CHAQUE transaction, et une collision sur `numero` est REMONTÉE (jamais avalée).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Ligne {
  numero: string;
  apporteurId: string;
  periode: string;
  rang: number;
}

const etat = vi.hoisted(() => ({
  lignes: [] as Array<{ numero: string; apporteurId: string; periode: string; rang: number }>,
  appels: [] as string[],
  tail: Promise.resolve() as Promise<void>,
  forcerP2002: null as null | { target: string[] },
}));

vi.mock("@/lib/prisma", () => {
  const erreur = (target: string[]) =>
    Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target } });
  const pause = () => new Promise<void>((r) => setTimeout(r, 0));
  return {
    prisma: {
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        let relacher: (() => void) | null = null;
        const tx = {
          // Le verrou consultatif de TRANSACTION : sérialise les transactions qui le prennent.
          $executeRaw: async () => {
            const avant = etat.tail;
            etat.tail = new Promise<void>((r) => {
              relacher = r;
            });
            await avant;
            etat.appels.push("verrou");
          },
          releveMensuelApporteur: {
            findFirst: async ({ where }: { where: { numero: { startsWith: string } } }) => {
              etat.appels.push("lecture");
              await pause();
              const l = etat.lignes
                .filter((x) => x.numero.startsWith(where.numero.startsWith) && x.rang === 0)
                .sort((a, b) => b.numero.localeCompare(a.numero))[0];
              return l ? { numero: l.numero } : null;
            },
            create: async ({ data }: { data: Ligne }) => {
              etat.appels.push("insertion");
              await pause();
              if (etat.forcerP2002) throw erreur(etat.forcerP2002.target);
              if (etat.lignes.some((x) => x.numero === data.numero)) throw erreur(["numero"]);
              if (
                etat.lignes.some(
                  (x) =>
                    x.apporteurId === data.apporteurId &&
                    x.periode === data.periode &&
                    x.rang === data.rang,
                )
              ) {
                throw erreur(["apporteur_id", "periode", "rang"]);
              }
              etat.lignes.push({ ...data });
              return { id: `id-${data.numero}`, numero: data.numero };
            },
          },
        };
        try {
          return await fn(tx);
        } finally {
          (relacher as (() => void) | null)?.();
        }
      },
    },
  };
});

import {
  CollisionNumeroReleve,
  creerReleveNumerote,
  formaterNumeroReleve,
  sequenceDeNumeroReleve,
} from "../numerotation";

const donnees = (apporteurId: string) =>
  ({ apporteurId, coupureAt: new Date("2026-11-01T00:00:00Z") }) as never;

beforeEach(() => {
  etat.lignes = [];
  etat.appels = [];
  etat.tail = Promise.resolve();
  etat.forcerP2002 = null;
});

describe("numéros REL-", () => {
  it("formate l'origine et le rectificatif, et relit la séquence", () => {
    expect(formaterNumeroReleve("2026-10", 7)).toBe("REL-2026-10-0007");
    expect(formaterNumeroReleve("2026-10", 7, 2)).toBe("REL-2026-10-0007-R2");
    expect(sequenceDeNumeroReleve("REL-2026-10-0007-R2", "2026-10")).toBe(7);
    expect(sequenceDeNumeroReleve("REL-2026-09-0007", "2026-10")).toBeNull();
    expect(sequenceDeNumeroReleve("AXI-APP-2026-0007", "2026-10")).toBeNull();
  });
  it("refuse une séquence hors limites (jamais de numéro tronqué)", () => {
    expect(() => formaterNumeroReleve("2026-10", 10_000)).toThrow();
    expect(() => formaterNumeroReleve("2026-10", 0)).toThrow();
  });
});

describe("deux préparations concurrentes", () => {
  it("prennent des numéros DISTINCTS et consécutifs (la borne haute est lue sous verrou)", async () => {
    const [a, b] = await Promise.all([
      creerReleveNumerote("2026-10", donnees("a1")),
      creerReleveNumerote("2026-10", donnees("a2")),
    ]);
    expect(a.statut).toBe("cree");
    expect(b.statut).toBe("cree");
    const numeros = etat.lignes.map((l) => l.numero).sort();
    expect(numeros).toEqual(["REL-2026-10-0001", "REL-2026-10-0002"]);
  });

  it("prennent le verrou DANS chaque transaction, avant de lire et d'écrire", async () => {
    await Promise.all([
      creerReleveNumerote("2026-10", donnees("a1")),
      creerReleveNumerote("2026-10", donnees("a2")),
    ]);
    expect(etat.appels.filter((x) => x === "verrou")).toHaveLength(2);
    // Chaque transaction : verrou, puis lecture, puis insertion (jamais l'inverse).
    expect(etat.appels).toEqual([
      "verrou",
      "lecture",
      "insertion",
      "verrou",
      "lecture",
      "insertion",
    ]);
  });

  it("une collision sur le NUMÉRO est remontée, jamais ignorée", async () => {
    etat.forcerP2002 = { target: ["numero"] };
    await expect(creerReleveNumerote("2026-10", donnees("a1"))).rejects.toBeInstanceOf(
      CollisionNumeroReleve,
    );
  });

  it("une collision sur (apporteur, période, rang) = déjà préparé, sans erreur", async () => {
    await creerReleveNumerote("2026-10", donnees("a1"));
    const deuxieme = await creerReleveNumerote("2026-10", donnees("a1"));
    expect(deuxieme).toEqual({ statut: "deja_prepare" });
    expect(etat.lignes).toHaveLength(1);
  });

  it("une autre erreur n'est jamais transformée en « déjà préparé »", async () => {
    etat.forcerP2002 = null;
    const boom = new Error("connexion perdue");
    const mod = await import("@/lib/prisma");
    const original = mod.prisma.$transaction;
    (mod.prisma as { $transaction: unknown }).$transaction = async () => {
      throw boom;
    };
    try {
      await expect(creerReleveNumerote("2026-10", donnees("a1"))).rejects.toBe(boom);
    } finally {
      (mod.prisma as { $transaction: unknown }).$transaction = original;
    }
  });
});
