// @vitest-environment node

/**
 * Relecture de #1561 (bloquant) — « Virements à faire » : un relevé MENSUEL dont le
 * formateur change d'IBAN n'est pas « prêt à virer ». Même règle que le clic
 * (`motifsChangementIbanDu`, donc `gardeChangementIban`), même libellé.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const count = vi.fn();
const findFirst = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    demandeChangementFormateur: {
      count: (...a: unknown[]) => count(...a),
      findFirst: (...a: unknown[]) => findFirst(...a),
    },
  },
}));

import { etatsVirementsMensuels } from "../virements-a-faire-lecture";

const H = 3_600_000;
const DEMANDE = new Date("2026-11-02T09:00:00Z");
const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";
const R1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const R2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const R3 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const a = (ms: number) => new Date(DEMANDE.getTime() + ms);

beforeEach(() => {
  vi.clearAllMocks();
  count.mockResolvedValue(0);
  findFirst.mockImplementation(async (q: { where: { trainerId: string } }) =>
    q.where.trainerId === T1
      ? { createdAt: DEMANDE, traiteAt: new Date(DEMANDE.getTime() + 2 * H) }
      : null,
  );
});

describe("etatsVirementsMensuels", () => {
  it("IBAN changé il y a 48 h moins 1 ms : pas prêt, motif « nouveau compte »", async () => {
    const m = await etatsVirementsMensuels(
      [
        { pieceId: R1, trainerId: T1, bloque: false },
        { pieceId: R2, trainerId: T2, bloque: false },
      ],
      a(48 * H - 1),
    );
    expect(m.get(R1)).toEqual({
      pret: false,
      motifs: ["nouvel_iban_moins_de_48h"],
      illisible: false,
    });
    // L'autre formateur, sans changement : prêt (inchangé).
    expect(m.get(R2)).toEqual({ pret: true, motifs: [], illisible: false });
  });

  it("exactement 48 h : prêt à virer", async () => {
    const m = await etatsVirementsMensuels(
      [{ pieceId: R1, trainerId: T1, bloque: false }],
      a(48 * H),
    );
    expect(m.get(R1)).toEqual({ pret: true, motifs: [], illisible: false });
  });

  it("demande en attente : « compte bancaire à valider »", async () => {
    count.mockImplementation(async (q: { where: { trainerId: string } }) =>
      q.where.trainerId === T2 ? 1 : 0,
    );
    const m = await etatsVirementsMensuels([{ pieceId: R2, trainerId: T2, bloque: false }], a(0));
    expect(m.get(R2)).toEqual({
      pret: false,
      motifs: ["compte_bancaire_a_valider"],
      illisible: false,
    });
  });

  it("une lecture par formateur, pas par relevé", async () => {
    await etatsVirementsMensuels(
      [
        { pieceId: R1, trainerId: T1, bloque: false },
        { pieceId: R3, trainerId: T1, bloque: false },
      ],
      a(48 * H),
    );
    expect(count).toHaveBeenCalledTimes(1);
  });

  it("facture attendue ou non conforme : jamais prêt, même sans changement d'IBAN", async () => {
    const m = await etatsVirementsMensuels([{ pieceId: R2, trainerId: T2, bloque: true }], a(0));
    expect(m.get(R2)!.pret).toBe(false);
  });

  it("lecture en échec : illisible, jamais prêt", async () => {
    count.mockRejectedValue(new Error("base"));
    const m = await etatsVirementsMensuels([{ pieceId: R2, trainerId: T2, bloque: false }], a(0));
    expect(m.get(R2)).toEqual({ pret: false, motifs: [], illisible: true });
  });

  it("aucun relevé : aucune lecture", async () => {
    expect((await etatsVirementsMensuels([], a(0))).size).toBe(0);
    expect(count).not.toHaveBeenCalled();
  });
});
