import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const tx = {
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
});
