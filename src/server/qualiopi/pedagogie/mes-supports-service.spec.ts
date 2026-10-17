import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  $executeRaw: vi.fn(),
  remiseRetour: { findFirst: vi.fn(), create: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({
  prisma: {
    setting: { findUnique: vi.fn() },
    enrollment: { findMany: vi.fn() },
    supportFormation: { findMany: vi.fn() },
    remiseRetour: { findFirst: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  journaliserConsultation,
  lireMesSupports,
  trouverSupportDuStagiaire,
} from "./mes-supports-service";

const p = prisma as unknown as {
  setting: { findUnique: ReturnType<typeof vi.fn> };
  enrollment: { findMany: ReturnType<typeof vi.fn> };
  supportFormation: { findMany: ReturnType<typeof vi.fn> };
  remiseRetour: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
};
const etat = (e: string | null) =>
  p.setting.findUnique.mockResolvedValue(e === null ? null : { value: { etat: e } });

const INSCRIPTION = {
  id: "e1",
  estTestInterne: false,
  session: { id: "s1", titreSession: "IA 14 h", formationId: "f1", estTestInterne: false },
};
const SUPPORT = {
  id: "sup2",
  formationId: "f1",
  type: "livret_stagiaire",
  titre: "Livret",
  version: 2,
  statut: "genere",
  pdfKey: "k.pdf",
};

beforeEach(() => {
  vi.clearAllMocks();
  p.enrollment.findMany.mockResolvedValue([INSCRIPTION]);
  p.supportFormation.findMany.mockResolvedValue([SUPPORT]);
  tx.remiseRetour.findFirst.mockResolvedValue(null);
  tx.remiseRetour.create.mockResolvedValue({
    id: "r1",
    survenuLe: new Date("2026-10-17T09:00:00Z"),
  });
  p.remiseRetour.findFirst.mockResolvedValue(null);
});

describe("éteint = inchangé", () => {
  it.each([null, "eteint"])("%s : aucune rubrique, aucune lecture, aucune écriture", async (e) => {
    etat(e);
    expect(await lireMesSupports("t1")).toEqual([]);
    expect(p.enrollment.findMany).not.toHaveBeenCalled();
    expect(tx.remiseRetour.create).not.toHaveBeenCalled();
  });

  it("essai : une inscription réelle n'est pas concernée", async () => {
    etat("essai");
    expect(await lireMesSupports("t1")).toEqual([]);
    expect(tx.remiseRetour.create).not.toHaveBeenCalled();
  });

  it("essai : une inscription du banc d'essai l'est", async () => {
    etat("essai");
    p.enrollment.findMany.mockResolvedValue([{ ...INSCRIPTION, estTestInterne: true }]);
    expect(await lireMesSupports("t1")).toHaveLength(1);
  });
});

describe("actif", () => {
  beforeEach(() => etat("actif"));

  it("liste le support et écrit UNE remise (canal espace, sans adresse)", async () => {
    const r = await lireMesSupports("t1");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: "sup2", version: 2, vuLe: null });
    const data = tx.remiseRetour.create.mock.calls[0]![0].data;
    expect(data).toEqual({
      sessionId: "s1",
      enrollmentId: "e1",
      nature: "remise",
      destinataire: "stagiaire",
      canal: "espace",
      objet: "support_livret_stagiaire",
      libelle: "Livret (v2)",
    });
    expect(data).not.toHaveProperty("survenuLe"); // la date est celle du serveur
  });

  it("ne réécrit pas une remise déjà journalisée", async () => {
    tx.remiseRetour.findFirst.mockResolvedValue({ id: "r1", survenuLe: new Date() });
    await lireMesSupports("t1");
    expect(tx.remiseRetour.create).not.toHaveBeenCalled();
  });

  it("n'ouvre pas un support d'une autre formation", async () => {
    expect(await trouverSupportDuStagiaire("t1", "autre")).toBeNull();
  });

  it("une consultation écrit un retour qui pointe sa remise", async () => {
    const t = await trouverSupportDuStagiaire("t1", "sup2");
    await journaliserConsultation(t!.contexte);
    expect(p.remiseRetour.create.mock.calls[0]![0].data).toMatchObject({
      nature: "ouverture",
      remiseId: "r1",
      enrollmentId: "e1",
      objet: "support_livret_stagiaire",
    });
  });

  it("expose la dernière consultation", async () => {
    const vu = new Date("2026-10-18T08:00:00Z");
    p.remiseRetour.findFirst.mockResolvedValue({ survenuLe: vu });
    expect((await lireMesSupports("t1"))[0]!.vuLe).toEqual(vu);
  });
});
