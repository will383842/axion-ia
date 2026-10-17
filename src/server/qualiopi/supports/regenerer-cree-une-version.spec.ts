/**
 * Lot L08 (qualiopi.pedagogie.actif) — « Régénérer » crée une VERSION.
 *
 * Avant le lot, `genererSupport` réécrivait la ligne existante : le contenu et
 * la version changeaient, l'ancien PDF restait en place « comme s'il était à
 * jour » dès que le rendu échouait, et `supprimerSupport` effaçait la preuve.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  supportFormation: {
    updateMany: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    formation: { findUnique: vi.fn() },
    supportFormation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    setting: { findUnique: vi.fn() },
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}));
vi.mock("@/server/qualiopi/documents/organisme", () => ({
  getOrganismeIdentite: vi.fn().mockResolvedValue({ raisonSociale: "Axion-IA SAS" }),
}));
vi.mock("./support-builder", () => ({
  construireSupport: vi.fn().mockReturnValue({ sections: [] }),
  titreSupport: vi.fn().mockReturnValue("Support"),
}));
vi.mock("./render-support", () => ({ renderSupportToStored: vi.fn() }));

import { prisma } from "@/lib/prisma";
import { renderSupportToStored } from "./render-support";
import { genererSupport, supprimerSupport } from "./supports-service";

const p = prisma as unknown as {
  formation: { findUnique: ReturnType<typeof vi.fn> };
  supportFormation: Record<
    "findFirst" | "findUnique" | "update" | "create" | "delete",
    ReturnType<typeof vi.fn>
  >;
  setting: { findUnique: ReturnType<typeof vi.fn> };
};
const render = renderSupportToStored as ReturnType<typeof vi.fn>;

const FORMATION = {
  id: "f1",
  titre: "IA",
  dureeHeures: 7,
  modalite: "presentiel",
  objectifsPedagogiques: [],
  programmeDetaille: [],
  methodesPedagogiques: "",
  moyensTechniques: "",
  ressourcesPedagogiques: [],
};
const RENDU = { pdfKey: "k2.pdf", pdfUrl: "https://r2/k2.pdf", hashSha256: "h2", sizeBytes: 10 };

const allumer = (etat: string | null) =>
  p.setting.findUnique.mockResolvedValue(etat === null ? null : { value: { etat } });

beforeEach(() => {
  vi.clearAllMocks();
  p.formation.findUnique.mockResolvedValue(FORMATION);
  p.supportFormation.findFirst.mockResolvedValue({ id: "s1", version: 2 });
  tx.supportFormation.create.mockResolvedValue({ id: "s3", pdfUrl: RENDU.pdfUrl });
  render.mockResolvedValue(RENDU);
});

describe("pedagogie actif", () => {
  beforeEach(() => allumer("actif"));

  it("régénérer crée la version suivante et garde l'ancienne ligne", async () => {
    const r = await genererSupport({ formationId: "f1", type: "livret_apprenant" as never });
    expect(r).toEqual({ id: "s3", pdfUrl: RENDU.pdfUrl });
    expect(p.supportFormation.update).not.toHaveBeenCalled();
    const data = tx.supportFormation.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ version: 3, statut: "genere", pdfKey: "k2.pdf" });
  });

  it("archive la version précédente, ne la supprime pas", async () => {
    await genererSupport({ formationId: "f1", type: "livret_apprenant" as never });
    expect(tx.supportFormation.updateMany).toHaveBeenCalledWith({
      where: { formationId: "f1", type: "livret_apprenant", statut: "genere" },
      data: { statut: "archive" },
    });
    expect(p.supportFormation.delete).not.toHaveBeenCalled();
  });

  it("rendu en échec : la nouvelle version est enregistrée SANS PDF, l'ancienne n'est pas touchée, et l'échec se voit", async () => {
    render.mockRejectedValue(new Error("pdf cassé"));
    await expect(
      genererSupport({ formationId: "f1", type: "livret_apprenant" as never }),
    ).rejects.toThrow(/version 3/);
    const data = tx.supportFormation.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({ version: 3, statut: "brouillon" });
    expect(data).not.toHaveProperty("pdfKey");
    expect(data).not.toHaveProperty("pdfUrl");
    expect(tx.supportFormation.updateMany).not.toHaveBeenCalled();
  });

  it("stockage absent (pas de clé R2) : version sans PDF, brouillon", async () => {
    render.mockResolvedValue({ pdfKey: null, pdfUrl: null, hashSha256: "h", sizeBytes: 1 });
    await expect(
      genererSupport({ formationId: "f1", type: "livret_apprenant" as never }),
    ).rejects.toThrow();
    expect(tx.supportFormation.create.mock.calls[0]![0].data.statut).toBe("brouillon");
  });

  it("première génération : version 1, rien à archiver", async () => {
    p.supportFormation.findFirst.mockResolvedValue(null);
    await genererSupport({ formationId: "f1", type: "livret_apprenant" as never });
    expect(tx.supportFormation.create.mock.calls[0]![0].data.version).toBe(1);
  });

  it("supprimer archive au lieu d'effacer", async () => {
    await supprimerSupport("s1");
    expect(p.supportFormation.delete).not.toHaveBeenCalled();
    expect(p.supportFormation.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { statut: "archive" },
    });
  });
});

describe("éteint = inchangé", () => {
  it.each([null, "eteint", "essai"])(
    "%s : la ligne existante est réécrite comme avant",
    async (etat) => {
      allumer(etat);
      p.supportFormation.update.mockResolvedValue({ id: "s1", pdfUrl: RENDU.pdfUrl });
      await genererSupport({ formationId: "f1", type: "livret_apprenant" as never });
      expect(p.supportFormation.update).toHaveBeenCalled();
      expect(tx.supportFormation.create).not.toHaveBeenCalled();
    },
  );

  it("supprimer efface comme avant", async () => {
    allumer(null);
    await supprimerSupport("s1");
    expect(p.supportFormation.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
  });
});
