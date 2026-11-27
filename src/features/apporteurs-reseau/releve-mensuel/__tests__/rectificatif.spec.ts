// @vitest-environment node

/** Lot 4b : rectificatif `-R1` à côté d'un original intact ; le bouton global ignore `rang > 0`. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  updateMany: vi.fn(),
  entree: vi.fn(),
  pdf: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    releveMensuelApporteur: {
      findUnique: m.findUnique,
      findMany: m.findMany,
      create: m.create,
      updateMany: m.updateMany,
    },
    apporteurReseau: {
      findUnique: async () => ({ prenom: "Alex", nom: "Fictif", denomination: null }),
    },
  },
}));
vi.mock("../lecture", () => ({ lireEntreeReleve: m.entree }));
vi.mock("../pdf", () => ({ rendreEtStockerPdfReleve: m.pdf }));

import { calculerReleve } from "../calcul";
import { etablirRectificatif, numeroRectificatif } from "../rectificatif";
import type { CommissionLue, EntreeReleve } from "../types";

const MAINTENANT = new Date("2026-11-10T08:00:00Z");
const PERIODE = "2026-10";
const entree = (commissions: CommissionLue[] = []): EntreeReleve => ({
  periode: PERIODE,
  preparationAt: MAINTENANT,
  commissions,
  pieces: [],
});
const contenuOriginal = calculerReleve(entree()).contenu;

const commissionNouvelle = (): CommissionLue => ({
  id: "c1",
  activite: "audit",
  palier: null,
  parrainage: false,
  statut: "due",
  montantCents: 5_000,
  factureHtCents: 50_000,
  prixPublicHtCents: null,
  entreprise: "Entreprise fictive",
  factureClientNumero: null,
  factureClientDate: null,
  encaissementIntegralAt: null,
  autofactureNumero: null,
  autofactureEmiseAt: null,
  avoirNumero: null,
  autofactureAttenteMotif: "donnée manquante",
  autofactureAttenteDepuis: new Date("2026-10-20T10:00:00Z"),
  litigeDepuis: null,
  verseeAt: null,
  creeAt: new Date("2026-10-01T10:00:00Z"),
  majAt: new Date("2026-10-20T10:00:00Z"),
  regleAppliquee: null,
  versionContrat: null,
});

const cible = {
  id: "id-0",
  numero: "REL-2026-10-0004",
  apporteurId: "a1",
  periode: PERIODE,
  rang: 0,
  statut: "envoye",
  contenu: contenuOriginal,
  envoyeAt: new Date("2026-11-02T09:00:00Z"),
  prepareAt: new Date("2026-11-02T07:00:00Z"),
};

beforeEach(() => {
  vi.clearAllMocks();
  m.findUnique.mockResolvedValue(cible);
  m.findMany.mockResolvedValue([
    { id: "id-0", numero: "REL-2026-10-0004", rang: 0, statut: "envoye" },
  ]);
  m.entree.mockResolvedValue(entree([commissionNouvelle()]));
  m.create.mockResolvedValue({ id: "id-1" });
  m.updateMany.mockResolvedValue({ count: 1 });
  m.pdf.mockImplementation(async (_c: unknown, cle: string) => ({
    r2Key: cle,
    sha256: "e".repeat(64),
  }));
});

describe("numéro", () => {
  it("-R1, -R2 sur le numéro d'origine", () => {
    expect(numeroRectificatif("REL-2026-10-0004", 1)).toBe("REL-2026-10-0004-R1");
    expect(numeroRectificatif("REL-2026-10-0004", 2)).toBe("REL-2026-10-0004-R2");
    expect(() => numeroRectificatif("REL-2026-10-0004-R1", 2)).toThrow();
  });
});

describe("etablirRectificatif", () => {
  it("crée rang 1, numéro -R1, lien vers l'original, statut préparé ; l'original n'est jamais écrit", async () => {
    const r = await etablirRectificatif("id-0", MAINTENANT);
    expect(r).toEqual({ ok: true, id: "id-1", numero: "REL-2026-10-0004-R1" });
    const data = m.create.mock.calls[0]![0].data as Record<string, unknown>;
    expect(data).toMatchObject({
      numero: "REL-2026-10-0004-R1",
      rang: 1,
      rectifieId: "id-0",
      apporteurId: "a1",
      periode: PERIODE,
    });
    expect(data.statut).toBeUndefined(); // défaut Prisma : `prepare`
    // Aucune écriture ne vise l'original : le seul updateMany porte sur la ligne NEUVE.
    for (const appel of m.updateMany.mock.calls) {
      expect(appel[0].where.id).toBe("id-1");
    }
  });

  it("le PDF porte « Rectifie le relevé n° … du … » et une clé qui contient le nouveau numéro", async () => {
    await etablirRectificatif("id-0", MAINTENANT);
    const [, cle, entete] = m.pdf.mock.calls[0]!;
    expect(cle).toMatch(/REL-2026-10-0004-R1-[0-9a-f]{8}\.pdf$/);
    expect(entete.rectifie).toEqual({ numero: "REL-2026-10-0004", date: "2026-11-02" });
  });

  it("refuse un relevé qui n'est pas envoyé (un préparé se recalcule)", async () => {
    m.findUnique.mockResolvedValue({ ...cible, statut: "prepare" });
    const r = await etablirRectificatif("id-0", MAINTENANT);
    expect(r.ok).toBe(false);
    expect(m.create).not.toHaveBeenCalled();
  });

  it("refuse tant qu'un rectificatif est en préparation", async () => {
    m.findMany.mockResolvedValue([
      { id: "id-1", numero: "REL-2026-10-0004-R1", rang: 1, statut: "prepare" },
      { id: "id-0", numero: "REL-2026-10-0004", rang: 0, statut: "envoye" },
    ]);
    const r = await etablirRectificatif("id-0", MAINTENANT);
    expect(r).toEqual({ ok: false, message: expect.stringMatching(/déjà en préparation/) });
    expect(m.create).not.toHaveBeenCalled();
  });

  it("refuse quand rien n'a changé depuis l'envoi (pas de rectificatif vide)", async () => {
    m.entree.mockResolvedValue(entree());
    const r = await etablirRectificatif("id-0", MAINTENANT);
    expect(r).toEqual({ ok: false, message: expect.stringMatching(/Aucun changement/) });
    expect(m.create).not.toHaveBeenCalled();
  });

  it("un second rectificatif prend le rang suivant et rectifie la dernière version envoyée", async () => {
    m.findUnique.mockResolvedValue({
      ...cible,
      id: "id-1",
      numero: "REL-2026-10-0004-R1",
      rang: 1,
    });
    m.findMany.mockResolvedValue([
      { id: "id-1", numero: "REL-2026-10-0004-R1", rang: 1, statut: "envoye" },
      { id: "id-0", numero: "REL-2026-10-0004", rang: 0, statut: "envoye" },
    ]);
    const r = await etablirRectificatif("id-1", MAINTENANT);
    expect(r).toMatchObject({ ok: true, numero: "REL-2026-10-0004-R2" });
    expect(m.create.mock.calls[0]![0].data).toMatchObject({ rang: 2, rectifieId: "id-1" });
  });

  it("une collision (apporteur, période, rang) est une réponse claire, pas une erreur brute", async () => {
    m.create.mockRejectedValue(Object.assign(new Error("unique"), { code: "P2002" }));
    const r = await etablirRectificatif("id-0", MAINTENANT);
    expect(r.ok).toBe(false);
  });
});
