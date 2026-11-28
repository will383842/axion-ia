// @vitest-environment node

/**
 * Lot 3c : la préparation utilise la MÊME fonction de ciblage que le contrôle de complétude,
 * deux préparations = un relevé, les tranches sont reprenables, une cible sans relevé est une
 * ANOMALIE bloquante, le PDF est stocké à la préparation, écart et recalcul sont gardés.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  cibles: [] as Array<{ apporteurId: string; nom: string }>,
  lireCibles: vi.fn(),
  lireVue: vi.fn(),
  existants: [] as Array<{ apporteurId: string }>,
  creer: vi.fn(),
  pdf: vi.fn(),
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    releveMensuelApporteur: {
      findMany: m.findMany,
      updateMany: m.updateMany,
      findUnique: m.findUnique,
    },
    apporteurReseau: {
      findUnique: async () => ({ prenom: "Alex", nom: "Fictif", denomination: null }),
    },
  },
}));
vi.mock("../statistiques", async (orig) => ({
  ...(await orig<typeof import("../statistiques")>()),
  lireCiblesPeriode: m.lireCibles,
  lireVuePeriode: m.lireVue,
}));
vi.mock("../lecture", () => ({
  lireEntreeReleve: async (_a: string, periode: string, preparationAt: Date) => ({
    periode,
    preparationAt,
    commissions: [],
    pieces: [],
  }),
}));
vi.mock("../numerotation", () => ({ creerReleveNumerote: m.creer }));
vi.mock("../pdf", () => ({ rendreEtStockerPdfReleve: m.pdf }));
vi.mock("../../signaler", () => ({ signalerErreurReseau: vi.fn() }));

import {
  anomaliesDeCompletude,
  ecarterReleve,
  preparerTranche,
  recalculerReleve,
  retablirReleve,
} from "../preparation";

const MAINTENANT = new Date("2026-11-03T08:00:00Z");
const PERIODE = "2026-10";
const cible = (id: string) => ({ apporteurId: id, nom: `Apporteur ${id}` });

beforeEach(() => {
  vi.clearAllMocks();
  m.existants = [];
  m.lireCibles.mockImplementation(async () => m.cibles);
  m.findMany.mockImplementation(async () => m.existants);
  let n = 0;
  m.creer.mockImplementation(async () => {
    n += 1;
    return { statut: "cree", id: `id-${n}`, numero: `REL-2026-10-000${n}` };
  });
  m.pdf.mockImplementation(async (_c: unknown, cle: string) => ({
    r2Key: cle,
    sha256: "f".repeat(64),
  }));
  m.updateMany.mockResolvedValue({ count: 1 });
});

describe("ciblage : la même fonction que le contrôle de complétude", () => {
  it("ne prépare QUE les apporteurs rendus par lireCiblesPeriode", async () => {
    m.cibles = [cible("a1"), cible("a2")];
    const r = await preparerTranche(PERIODE, MAINTENANT);
    expect(m.lireCibles).toHaveBeenCalledWith(PERIODE, false);
    const prepares = m.creer.mock.calls.map((c) => (c[1] as { apporteurId: string }).apporteurId);
    expect(prepares).toEqual(["a1", "a2"]);
    expect(r).toMatchObject({ cibles: 2, crees: 2, reste: 0 });
  });

  it("la complétude lit les cibles par la MÊME fonction (lireVuePeriode → lireCiblesPeriode)", async () => {
    m.lireVue.mockResolvedValue({ cibles: [cible("a1"), cible("a2")], releves: [] });
    const a = await anomaliesDeCompletude(PERIODE);
    expect(m.lireVue).toHaveBeenCalledWith(PERIODE, false);
    expect(a).toHaveLength(2);
  });
});

describe("idempotence et tranches", () => {
  it("deux préparations = un relevé : une cible qui a déjà sa ligne n'est pas recréée", async () => {
    m.cibles = [cible("a1"), cible("a2")];
    m.existants = [{ apporteurId: "a1" }, { apporteurId: "a2" }];
    const r = await preparerTranche(PERIODE, MAINTENANT);
    expect(m.creer).not.toHaveBeenCalled();
    expect(r).toMatchObject({ crees: 0, dejaPrepares: 2, reste: 0 });
  });

  it("une collision (apporteur, période, rang) est comptée « déjà préparé », sans PDF", async () => {
    m.cibles = [cible("a1")];
    m.creer.mockResolvedValue({ statut: "deja_prepare" });
    const r = await preparerTranche(PERIODE, MAINTENANT);
    expect(r).toMatchObject({ crees: 0, dejaPrepares: 1 });
    expect(m.pdf).not.toHaveBeenCalled();
  });

  it("les tranches sont reprenables : « reste N » puis plus rien", async () => {
    m.cibles = [cible("a1"), cible("a2"), cible("a3")];
    const premiere = await preparerTranche(PERIODE, MAINTENANT, 2);
    expect(premiere).toMatchObject({ crees: 2, reste: 1 });
    m.existants = [{ apporteurId: "a1" }, { apporteurId: "a2" }];
    m.creer.mockClear();
    const seconde = await preparerTranche(PERIODE, MAINTENANT, 2);
    expect(seconde).toMatchObject({ crees: 1, reste: 0 });
    expect((m.creer.mock.calls[0]![1] as { apporteurId: string }).apporteurId).toBe("a3");
  });

  it("une période NON close est refusée avant toute lecture", async () => {
    await expect(preparerTranche("2026-11", MAINTENANT)).rejects.toThrow();
    expect(m.lireCibles).not.toHaveBeenCalled();
  });
});

describe("rien n'est perdu en silence", () => {
  it("une création en échec est COMPTÉE dans l'échec et dans « reste », jamais ignorée", async () => {
    m.cibles = [cible("a1"), cible("a2")];
    m.creer.mockRejectedValueOnce(new Error("collision de numéro"));
    const r = await preparerTranche(PERIODE, MAINTENANT);
    expect(r.echecs).toHaveLength(1);
    expect(r.echecs[0]!.apporteurId).toBe("a1");
    expect(r.crees).toBe(1);
    expect(r.reste).toBe(1);
  });

  it("une cible sans relevé d'origine = anomalie de complétude BLOQUANTE nommant l'apporteur", async () => {
    m.lireVue.mockResolvedValue({
      cibles: [cible("a1"), cible("a2")],
      releves: [
        {
          id: "r1",
          numero: "REL-2026-10-0001",
          apporteurId: "a1",
          apporteurNom: "x",
          rang: 0,
          statut: "prepare",
          nbLignes: 0,
          facturesHtCents: 0,
          avoirsHtCents: 0,
          tvaCents: 0,
          ttcCents: 0,
          viresTtcCents: 0,
          enAttenteHtCents: 0,
          cumulAnneeHtCents: 0,
          empreinteCourte: "abcd1234",
          pdfDisponible: true,
          emailPresent: true,
          erreur: null,
          motifEcart: null,
          envoyeAt: null,
        },
      ],
    });
    const a = await anomaliesDeCompletude(PERIODE);
    expect(a).toHaveLength(1);
    expect(a[0]!.code).toBe("completude");
    expect(a[0]!.detail).toContain("Apporteur a2");
  });

  it("un résilié préparé ne masque pas un signé manquant (ensembles, pas comptage)", async () => {
    m.lireVue.mockResolvedValue({
      cibles: [cible("signe")],
      releves: [
        {
          id: "r9",
          numero: "REL-2026-10-0009",
          apporteurId: "resilie",
          apporteurNom: "x",
          rang: 0,
          statut: "prepare",
          nbLignes: 0,
          facturesHtCents: 0,
          avoirsHtCents: 0,
          tvaCents: 0,
          ttcCents: 0,
          viresTtcCents: 0,
          enAttenteHtCents: 0,
          cumulAnneeHtCents: 0,
          empreinteCourte: "abcd1234",
          pdfDisponible: true,
          emailPresent: true,
          erreur: null,
          motifEcart: null,
          envoyeAt: null,
        },
      ],
    });
    expect(await anomaliesDeCompletude(PERIODE)).toHaveLength(1);
  });
});

describe("le PDF est rendu et stocké à la préparation", () => {
  it("clé = apporteur + numéro + empreinte courte ; pdfSha256 écrit sur la ligne `prepare`", async () => {
    m.cibles = [cible("a1")];
    await preparerTranche(PERIODE, MAINTENANT);
    const cle = m.pdf.mock.calls[0]![1] as string;
    expect(cle).toMatch(/^apporteurs\/releves\/a1\/REL-2026-10-0001-[0-9a-f]{8}\.pdf$/);
    const entete = m.pdf.mock.calls[0]![2] as { numero: string };
    expect(entete.numero).toBe("REL-2026-10-0001");
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { id: "id-1", statut: "prepare" },
      data: { pdfR2Key: cle, pdfSha256: "f".repeat(64) },
    });
  });

  it("un PDF qui échoue = échec compté (la ligne sans PDF reste visible comme anomalie bloquante)", async () => {
    m.cibles = [cible("a1")];
    m.pdf.mockRejectedValue(new Error("R2 indisponible"));
    const r = await preparerTranche(PERIODE, MAINTENANT);
    expect(r.echecs).toHaveLength(1);
    expect(r.reste).toBe(1);
  });
});

describe("écart, rétablissement et recalcul : gardés", () => {
  it("écarter exige un motif et ne touche que les prepare d'ORIGINE jamais pris", async () => {
    expect(await ecarterReleve("id", "  ")).toBe("motif_requis");
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(await ecarterReleve("id", "Mois sans activité")).toBe("ecarte");
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { id: "id", rang: 0, statut: "prepare", prisAt: null },
      data: { statut: "ecarte", motifEcart: "Mois sans activité" },
    });
  });

  it("écarter une ligne déjà envoyée est refusé (aucune ligne touchée)", async () => {
    m.updateMany.mockResolvedValue({ count: 0 });
    expect(await ecarterReleve("id", "Motif valable")).toBe("refuse");
  });

  it("rétablir ne vise que les lignes écartées jamais prises", async () => {
    expect(await retablirReleve("id")).toBe(true);
    expect(m.updateMany).toHaveBeenCalledWith({
      where: { id: "id", statut: "ecarte", prisAt: null },
      data: { statut: "prepare", motifEcart: null },
    });
  });

  it("recalculer une ligne qui n'est plus `prepare` : refus, aucune lecture ni écriture", async () => {
    m.findUnique.mockResolvedValue({
      id: "id",
      numero: "REL-2026-10-0001",
      apporteurId: "a1",
      periode: PERIODE,
      rang: 0,
      statut: "envoye",
      empreinteSha256: "0".repeat(64),
      pdfR2Key: "k",
      rectifieId: null,
    });
    expect(await recalculerReleve("id", MAINTENANT)).toBe("non_modifiable");
    expect(m.updateMany).not.toHaveBeenCalled();
    expect(m.pdf).not.toHaveBeenCalled();
  });

  it("recalculer : l'écriture est gardée par `statut: prepare` (le trigger SQL double la garde)", async () => {
    m.findUnique.mockResolvedValue({
      id: "id",
      numero: "REL-2026-10-0001",
      apporteurId: "a1",
      periode: PERIODE,
      rang: 0,
      statut: "prepare",
      empreinteSha256: "0".repeat(64),
      pdfR2Key: null,
      rectifieId: null,
    });
    expect(await recalculerReleve("id", MAINTENANT)).toBe("recalcule");
    const appel = m.updateMany.mock.calls[0]![0] as { where: { statut: string } };
    expect(appel.where).toEqual({ id: "id", statut: "prepare" });
    // L'écriture perdue la course (ligne partie entre-temps) n'est pas annoncée comme réussie.
    m.updateMany.mockResolvedValue({ count: 0 });
    expect(await recalculerReleve("id", MAINTENANT)).toBe("non_modifiable");
  });
});
