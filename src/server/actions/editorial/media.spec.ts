/**
 * Console éditoriale — tests de l'achat média (lot 6).
 *
 * ## Ce que le lot 6 corrige
 *
 * 🔴 Les trois crochets du §1 ter — `EdCompteType.publicitaire`,
 * `EdAssetUsage.payant`, `EdPublication.coutCentimes` — existaient depuis le
 * lot 0, et **rien ne les écrivait**. Le module `cout.ts`, 21 tests verts,
 * n'était appelé par aucun écran.
 *
 * Le calcul était juste et n'avait aucune donnée à calculer. Même classe de
 * défaut que les recettes vides.
 *
 * ## Où portent ces tests
 *
 * Sur la conversion euros → centimes, presque exclusivement. C'est le seul
 * endroit de la console où une erreur ne se voit pas : « 4,50 » et « 450 »
 * sont tous deux plausibles pour un coût par rendez-vous, et un facteur 100
 * sur un coût d'acquisition ne saute aux yeux de personne.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockPublicationFindUnique,
  mockPublicationUpdate,
  mockAssetFindUnique,
  mockAssetUpdate,
  mockRequirePermission,
  mockJournaliser,
} = vi.hoisted(() => ({
  mockPublicationFindUnique: vi.fn(),
  mockPublicationUpdate: vi.fn(),
  mockAssetFindUnique: vi.fn(),
  mockAssetUpdate: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockJournaliser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    edPublication: { findUnique: mockPublicationFindUnique, update: mockPublicationUpdate },
    edAsset: { findUnique: mockAssetFindUnique, update: mockAssetUpdate },
  },
}));

vi.mock("@/server/actions/editorial/_guards", () => ({
  requirePermission: mockRequirePermission,
  journaliser: mockJournaliser,
  requireMembreEditorial: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { eurosVersCentimes, saisirCoutAction, changerUsageAssetAction } = await import("./media");

const MEMBRE = { userId: "u1", membreId: "m1", role: "production" as const, nom: "Will" };
const PUB = "ffffffff-0000-4000-8000-000000000001";
const ASSET = "ffffffff-0000-4000-8000-000000000002";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue(MEMBRE);
  mockJournaliser.mockResolvedValue(undefined);
  mockPublicationFindUnique.mockResolvedValue({ coutCentimes: 0, titreInterne: "Test" });
  mockPublicationUpdate.mockResolvedValue({ id: PUB });
  mockAssetFindUnique.mockResolvedValue({ usage: "organique", libelle: "Short 1/8" });
  mockAssetUpdate.mockResolvedValue({ id: ASSET });
});

describe("eurosVersCentimes — le facteur 100 qui ne se voit pas", () => {
  it.each([
    ["300", 30_000],
    ["300,50", 30_050],
    ["300.50", 30_050],
    ["1 200", 120_000],
    ["1 200,00", 120_000],
    ["0", 0],
    ["0,01", 1],
    ["", 0],
    ["  450  ", 45_000],
    ["300 €", 30_000],
  ])("« %s » → %i centimes", (saisie, attendu) => {
    const r = eurosVersCentimes(saisie);
    expect(r.ok, saisie).toBe(true);
    if (r.ok) expect(r.centimes).toBe(attendu);
  });

  it("🔴 arrondit APRÈS multiplication — la virgule flottante trahit", () => {
    // ⚠️ Mon premier jet de ce test citait `300,50` comme exemple. C'était
    // FAUX : `300.5 * 100` vaut exactement 30050 en IEEE 754. J'ai cherché
    // les valeurs où l'écart existe vraiment plutôt que d'inventer un
    // exemple — inventer la preuve d'un piège est exactement le défaut que
    // ce fichier traque.
    //
    // Les vraies : 1,15 € → 114.99999999999999 · 0,29 € → 28.999999999999996
    // · 19,99 € → 1998.9999999999998. Une troncature perdrait un centime à
    // chaque fois — invisible à l'unité, et qui décale toutes les moyennes
    // une fois cumulé.
    for (const [saisie, attendu] of [
      ["1,15", 115],
      ["0,29", 29],
      ["19,99", 1_999],
    ] as const) {
      const r = eurosVersCentimes(saisie);
      expect(r.ok, saisie).toBe(true);
      if (r.ok) expect(r.centimes, saisie).toBe(attendu);
      // Le témoin du piège : la troncature, elle, se trompe.
      expect(Math.trunc(Number(saisie.replace(",", ".")) * 100), saisie).toBe(attendu - 1);
    }
  });

  it("🔴 REFUSE ce qui n'est pas un montant, plutôt que de deviner", () => {
    for (const v of ["abc", "300,505", "-50", "1e3", "300.50.20", "trois cents"]) {
      expect(eurosVersCentimes(v).ok, v).toBe(false);
    }
  });

  it("🔴 REFUSE au-delà du million d'euros sur UNE publication", () => {
    // C'est une faute de frappe plus probablement qu'une campagne, et un
    // budget absurde contaminerait toutes les moyennes du groupe payant.
    const r = eurosVersCentimes("2000000");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/faute de frappe/i);

    // La borne exacte passe.
    expect(eurosVersCentimes("1000000").ok).toBe(true);
  });

  it("le message de refus CITE la saisie fautive", () => {
    const r = eurosVersCentimes("trois cents");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toContain("trois cents");
  });
});

describe("saisirCoutAction", () => {
  it("exige `metrique.saisir`, pas `publication.ecrire`", async () => {
    // Saisir un budget est du même ordre que saisir un relevé : une mesure a
    // posteriori, pas une modification du contenu. Le rôle `production` doit
    // pouvoir le faire sans pouvoir réécrire un post.
    await saisirCoutAction({ publicationId: PUB, coutCentimes: 30_000 });
    expect(mockRequirePermission).toHaveBeenCalledWith("metrique.saisir");
  });

  it("écrit des CENTIMES, et journalise l'avant et l'après", async () => {
    mockPublicationFindUnique.mockResolvedValue({ coutCentimes: 10_000, titreInterne: "Test" });

    const r = await saisirCoutAction({ publicationId: PUB, coutCentimes: 30_000 });

    expect("error" in r).toBe(false);
    expect(mockPublicationUpdate.mock.calls[0]![0].data.coutCentimes).toBe(30_000);
    // Le budget est une donnée qui se discute : qui l'a saisi compte autant
    // que le chiffre.
    const trace = mockJournaliser.mock.calls[0]![0];
    expect(trace.action).toBe("cout");
    expect(trace.avant).toMatchObject({ coutCentimes: 10_000 });
    expect(trace.apres).toMatchObject({ coutCentimes: 30_000 });
  });

  it("accepte zéro — c'est le geste qui corrige une saisie erronée", async () => {
    const r = await saisirCoutAction({ publicationId: PUB, coutCentimes: 0 });
    expect("error" in r).toBe(false);
    expect(mockPublicationUpdate.mock.calls[0]![0].data.coutCentimes).toBe(0);
  });

  it("REFUSE un montant négatif", async () => {
    const r = await saisirCoutAction({ publicationId: PUB, coutCentimes: -1 });
    expect("error" in r).toBe(true);
    expect(mockPublicationUpdate).not.toHaveBeenCalled();
  });

  it("REFUSE une publication introuvable", async () => {
    mockPublicationFindUnique.mockResolvedValue(null);
    const r = await saisirCoutAction({ publicationId: PUB, coutCentimes: 100 });
    expect("error" in r).toBe(true);
    expect(mockPublicationUpdate).not.toHaveBeenCalled();
  });
});

describe("changerUsageAssetAction — ce qui range une publication d'un côté", () => {
  it("accepte les trois usages du modèle", async () => {
    for (const usage of ["organique", "payant", "mixte"] as const) {
      vi.clearAllMocks();
      mockRequirePermission.mockResolvedValue(MEMBRE);
      mockAssetFindUnique.mockResolvedValue({ usage: "organique", libelle: "X" });
      mockAssetUpdate.mockResolvedValue({ id: ASSET });

      const r = await changerUsageAssetAction({ assetId: ASSET, usage });
      expect("error" in r, usage).toBe(false);
      expect(mockAssetUpdate.mock.calls[0]![0].data.usage).toBe(usage);
    }
  });

  it("🔴 REFUSE un usage inventé", async () => {
    // La comparaison organique/payant repose entièrement sur cette valeur :
    // une quatrième catégorie ferait disparaître les assets concernés des
    // trois bilans, sans que le total ne bouge.
    const r = await changerUsageAssetAction({ assetId: ASSET, usage: "sponsorise" as never });
    expect("error" in r).toBe(true);
    expect(mockAssetUpdate).not.toHaveBeenCalled();
  });

  it("journalise le changement", async () => {
    await changerUsageAssetAction({ assetId: ASSET, usage: "payant" });
    const trace = mockJournaliser.mock.calls[0]![0];
    expect(trace.action).toBe("usage");
    expect(trace.avant).toMatchObject({ usage: "organique" });
    expect(trace.apres).toMatchObject({ usage: "payant" });
  });

  it("REFUSE un asset introuvable", async () => {
    mockAssetFindUnique.mockResolvedValue(null);
    const r = await changerUsageAssetAction({ assetId: ASSET, usage: "payant" });
    expect("error" in r).toBe(true);
    expect(mockAssetUpdate).not.toHaveBeenCalled();
  });
});
