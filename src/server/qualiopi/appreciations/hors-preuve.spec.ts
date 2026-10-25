import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(async () => 1),
    siteSetting: { findUnique: vi.fn(), upsert: vi.fn() },
    appreciation: { findUnique: vi.fn(), delete: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  };
  return {
    tx,
    prisma: {
      siteSetting: { findUnique: vi.fn() },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});
vi.mock("@/lib/prisma", () => ({ prisma: m.prisma }));

import {
  CLE_APPRECIATIONS_HORS_PREUVE,
  lireAppreciationsHorsPreuve,
  marquerHorsPreuve,
} from "./hors-preuve";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";
const ADMIN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

beforeEach(() => {
  vi.clearAllMocks();
  m.prisma.$transaction.mockImplementation(async (fn: (t: typeof m.tx) => unknown) => fn(m.tx));
});

describe("clé de marquage", () => {
  it("hors du registre Qualiopi : préfixe sans « qualiopi. »", () => {
    expect(CLE_APPRECIATIONS_HORS_PREUVE).toBe("qualiopi_marquage.appreciations_hors_preuve");
    expect(CLE_APPRECIATIONS_HORS_PREUVE.startsWith("qualiopi.")).toBe(false);
  });
});

describe("lireAppreciationsHorsPreuve", () => {
  it("clé absente : ensemble vide", async () => {
    m.prisma.siteSetting.findUnique.mockResolvedValue(null);
    expect((await lireAppreciationsHorsPreuve()).size).toBe(0);
  });
  it("valeur invalide : ensemble vide", async () => {
    m.prisma.siteSetting.findUnique.mockResolvedValue({ value: { n: "importe quoi" } });
    expect((await lireAppreciationsHorsPreuve()).size).toBe(0);
  });
  it("valeur valide : les identifiants marqués", async () => {
    m.prisma.siteSetting.findUnique.mockResolvedValue({
      value: [
        {
          appreciationId: ID1,
          motif: "essai du 04/08",
          marqueLe: "2026-10-19T08:00:00.000Z",
          marquePar: ADMIN,
        },
      ],
    });
    expect([...(await lireAppreciationsHorsPreuve())]).toEqual([ID1]);
  });
});

describe("marquerHorsPreuve", () => {
  it("motif de moins de 10 caractères : refusé, rien écrit", async () => {
    const r = await marquerHorsPreuve(ID1, "court", ADMIN);
    expect(r).toEqual({ ok: false, raison: expect.stringMatching(/motif/i) });
    expect(m.tx.siteSetting.upsert).not.toHaveBeenCalled();
  });

  it("appréciation inconnue : refusée", async () => {
    m.tx.appreciation.findUnique.mockResolvedValue(null);
    m.tx.siteSetting.findUnique.mockResolvedValue(null);
    const r = await marquerHorsPreuve(ID1, "essai confirmé par Will", ADMIN);
    expect(r.ok).toBe(false);
    expect(m.tx.siteSetting.upsert).not.toHaveBeenCalled();
  });

  it("ajoute EN FIN, sans retirer ni modifier les marques existantes", async () => {
    const existante = {
      appreciationId: ID2,
      motif: "ancien essai",
      marqueLe: "2026-10-01T00:00:00.000Z",
      marquePar: ADMIN,
    };
    m.tx.appreciation.findUnique.mockResolvedValue({ id: ID1 });
    m.tx.siteSetting.findUnique.mockResolvedValue({ value: [existante] });
    const r = await marquerHorsPreuve(ID1, "essai confirmé par Will", ADMIN);
    expect(r).toEqual({ ok: true, dejaMarquee: false });
    const arg = m.tx.siteSetting.upsert.mock.calls[0]![0] as {
      create: { key: string };
      update: { value: unknown[] };
    };
    expect(arg.create.key).toBe(CLE_APPRECIATIONS_HORS_PREUVE);
    expect(arg.update.value).toHaveLength(2);
    expect(arg.update.value[0]).toEqual(existante);
    expect(arg.update.value[1]).toMatchObject({
      appreciationId: ID1,
      motif: "essai confirmé par Will",
      marquePar: ADMIN,
    });
  });

  it("deuxième marquage : sans effet", async () => {
    m.tx.appreciation.findUnique.mockResolvedValue({ id: ID1 });
    m.tx.siteSetting.findUnique.mockResolvedValue({
      value: [
        {
          appreciationId: ID1,
          motif: "essai confirmé",
          marqueLe: "2026-10-01T00:00:00.000Z",
          marquePar: ADMIN,
        },
      ],
    });
    const r = await marquerHorsPreuve(ID1, "autre motif long", ADMIN);
    expect(r).toEqual({ ok: true, dejaMarquee: true });
    expect(m.tx.siteSetting.upsert).not.toHaveBeenCalled();
  });

  it("ne supprime ni ne modifie jamais l'appréciation", async () => {
    m.tx.appreciation.findUnique.mockResolvedValue({ id: ID1 });
    m.tx.siteSetting.findUnique.mockResolvedValue(null);
    await marquerHorsPreuve(ID1, "essai confirmé par Will", ADMIN);
    expect(m.tx.appreciation.delete).not.toHaveBeenCalled();
    expect(m.tx.appreciation.update).not.toHaveBeenCalled();
    expect(m.tx.appreciation.updateMany).not.toHaveBeenCalled();
  });

  it("pose le verrou consultatif AVANT de relire le tableau (marquages simultanés)", async () => {
    const ordre: string[] = [];
    m.tx.$executeRaw.mockImplementation(async () => {
      ordre.push("verrou");
      return 1;
    });
    m.tx.appreciation.findUnique.mockImplementation(async () => {
      ordre.push("appreciation");
      return { id: ID1 };
    });
    m.tx.siteSetting.findUnique.mockImplementation(async () => {
      ordre.push("lecture");
      return null;
    });
    await marquerHorsPreuve(ID1, "essai confirmé par Will", ADMIN);
    expect(ordre[0]).toBe("verrou");
    expect(ordre.indexOf("verrou")).toBeLessThan(ordre.indexOf("lecture"));
  });

  it.each([
    ["une entrée invalide", [{ appreciationId: "pas-un-uuid" }]],
    ["une valeur qui n'est pas un tableau", { n: "x" }],
    ["une valeur nulle", null],
  ])(
    "valeur existante illisible (%s) : refuse d'écrire, l'historique n'est pas écrasé",
    async (_n, value) => {
      m.tx.appreciation.findUnique.mockResolvedValue({ id: ID1 });
      m.tx.siteSetting.findUnique.mockResolvedValue({ value });
      const r = await marquerHorsPreuve(ID1, "essai confirmé par Will", ADMIN);
      expect(r).toEqual({ ok: false, raison: expect.stringMatching(/illisible/i) });
      expect(m.tx.siteSetting.upsert).not.toHaveBeenCalled();
    },
  );

  it("la clé est créée hors de la catégorie « qualiopi » (compteur configKeysSet du seed intact)", async () => {
    m.tx.appreciation.findUnique.mockResolvedValue({ id: ID1 });
    m.tx.siteSetting.findUnique.mockResolvedValue(null);
    await marquerHorsPreuve(ID1, "essai confirmé par Will", ADMIN);
    const arg = m.tx.siteSetting.upsert.mock.calls[0]![0] as { create: { category: string } };
    expect(arg.create.category).not.toBe("qualiopi");
    expect(arg.create.category).toBe("general");
  });

  it("le journal est écrit DANS la transaction ; s'il échoue, tout est annulé", async () => {
    m.tx.appreciation.findUnique.mockResolvedValue({ id: ID1 });
    m.tx.siteSetting.findUnique.mockResolvedValue(null);
    const journal = vi.fn(async () => undefined);
    await marquerHorsPreuve(ID1, "essai confirmé par Will", ADMIN, journal);
    expect(journal).toHaveBeenCalledWith(m.tx);

    const echec = vi.fn(async () => {
      throw new Error("journal indisponible");
    });
    await expect(marquerHorsPreuve(ID1, "essai confirmé par Will", ADMIN, echec)).rejects.toThrow(
      "journal indisponible",
    );
  });

  it("deuxième marquage : le journal n'est pas rappelé", async () => {
    m.tx.appreciation.findUnique.mockResolvedValue({ id: ID1 });
    m.tx.siteSetting.findUnique.mockResolvedValue({
      value: [
        {
          appreciationId: ID1,
          motif: "essai confirmé",
          marqueLe: "2026-10-01T00:00:00.000Z",
          marquePar: ADMIN,
        },
      ],
    });
    const journal = vi.fn(async () => undefined);
    await marquerHorsPreuve(ID1, "autre motif long", ADMIN, journal);
    expect(journal).not.toHaveBeenCalled();
  });
});
