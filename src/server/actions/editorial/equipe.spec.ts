/**
 * Console éditoriale — tests des Server Actions d'équipe et de revue.
 *
 * ## Ce que ces tests verrouillent
 *
 * Le §4 du plan répartit treize actions sur cinq rôles. Cette matrice est
 * testée cellule par cellule dans `permissions.spec.ts` — 78 tests sur le
 * module PUR. Mais une matrice juste ne prouve rien si l'action interroge la
 * mauvaise cellule.
 *
 * 🔴 C'est exactement le défaut trouvé par la passe 5 : `televerserAssetAction`
 * n'exigeait que `asset.ecrire` — que le rôle `montage` possède — et écrivait
 * `statut: "pret"` en dur. Le monteur produisait donc un asset validé **par la
 * porte du dépôt**, en contournant celle qui lui est fermée. La matrice était
 * juste ; c'est le câblage qui la contournait.
 *
 * Ces tests vérifient donc quelle permission chaque action DEMANDE, et ce
 * qu'elle écrit — pas ce que la matrice dit.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAssetFindUnique,
  mockAssetUpdate,
  mockMembreFindUnique,
  mockMembreUpdate,
  mockMembreCreate,
  mockRequirePermission,
  mockJournaliser,
} = vi.hoisted(() => ({
  mockAssetFindUnique: vi.fn(),
  mockAssetUpdate: vi.fn(),
  mockMembreFindUnique: vi.fn(),
  mockMembreUpdate: vi.fn(),
  mockMembreCreate: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockJournaliser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    edAsset: { findUnique: mockAssetFindUnique, update: mockAssetUpdate },
    edMembre: {
      findUnique: mockMembreFindUnique,
      update: mockMembreUpdate,
      create: mockMembreCreate,
    },
    $transaction: vi.fn(async (arg: unknown) =>
      typeof arg === "function"
        ? await (arg as (tx: unknown) => Promise<unknown>)({})
        : await Promise.all(arg as Promise<unknown>[]),
    ),
  },
}));

vi.mock("@/server/actions/editorial/_guards", () => ({
  requirePermission: mockRequirePermission,
  journaliser: mockJournaliser,
  requireMembreEditorial: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { refuserAssetAction, soumettreAssetRevueAction, changerRoleMembreAction } =
  await import("./equipe");

const ADMIN = { userId: "u1", membreId: "m1", role: "admin" as const, nom: "Will" };
const ASSET = "bbbbbbbb-0000-4000-8000-000000000001";
const MEMBRE = "cccccccc-0000-4000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue(ADMIN);
  mockJournaliser.mockResolvedValue(undefined);
});

describe("refuserAssetAction — un refus qui dit quoi refaire", () => {
  beforeEach(() => {
    mockAssetFindUnique.mockResolvedValue({ statut: "a_valider", libelle: "Short 1/8" });
    mockAssetUpdate.mockResolvedValue({ id: ASSET });
  });

  it("🔴 renvoie l'asset en `en_cours` AVEC le commentaire", async () => {
    // Critère 2 du lot 4. Refuser sans consigne renvoie le monteur à un
    // aller-retour de plus : le commentaire n'est pas décoratif, il est la
    // moitié utile du geste.
    const r = await refuserAssetAction({
      assetId: ASSET,
      commentaire: "Le sous-titrage déborde sur les trois dernières secondes.",
    });

    expect("error" in r).toBe(false);
    const donnees = mockAssetUpdate.mock.calls[0]![0].data;
    expect(donnees.statut).toBe("en_cours");
    expect(donnees.revueCommentaire).toContain("sous-titrage");
  });

  it("🔴 REFUSE un refus sans commentaire", async () => {
    const r = await refuserAssetAction({ assetId: ASSET, commentaire: "   " });
    expect("error" in r).toBe(true);
    expect(mockAssetUpdate).not.toHaveBeenCalled();
  });

  it("exige `asset.valider` — refuser, c'est juger", async () => {
    await refuserAssetAction({ assetId: ASSET, commentaire: "À refaire." });
    expect(mockRequirePermission).toHaveBeenCalledWith("asset.valider");
  });

  it("journalise le refus", async () => {
    await refuserAssetAction({ assetId: ASSET, commentaire: "À refaire." });
    expect(mockJournaliser).toHaveBeenCalled();
  });
});

describe("soumettreAssetRevueAction — le geste que `montage` A le droit de faire", () => {
  it("exige `asset.ecrire`, pas `asset.valider`", async () => {
    // La séparation du §4 tient à cette asymétrie : le monteur soumet, il ne
    // valide pas. Si les deux exigeaient la même permission, le rôle
    // `montage` n'aurait aucun sens.
    mockAssetFindUnique.mockResolvedValue({ statut: "en_cours" });
    mockAssetUpdate.mockResolvedValue({ id: ASSET });

    await soumettreAssetRevueAction({ assetId: ASSET });

    expect(mockRequirePermission).toHaveBeenCalledWith("asset.ecrire");
  });

  it("🔴 efface le commentaire de revue précédent en repassant en revue", async () => {
    // Sinon un asset corrigé afficherait encore le reproche auquel il vient
    // de répondre, et le relecteur croirait le refus toujours d'actualité.
    mockAssetFindUnique.mockResolvedValue({ statut: "en_cours" });
    mockAssetUpdate.mockResolvedValue({ id: ASSET });

    await soumettreAssetRevueAction({ assetId: ASSET });

    const donnees = mockAssetUpdate.mock.calls[0]![0].data;
    expect(donnees.statut).toBe("a_valider");
    expect(donnees.revueCommentaire).toBeNull();
  });
});

describe("changerRoleMembreAction — la porte qu'on ne ferme pas de l'intérieur", () => {
  it("🔴 REFUSE à un admin de se rétrograder lui-même", async () => {
    // Se retirer son propre dernier droit d'administration ferme la console
    // de l'intérieur : plus personne ne peut rendre le droit.
    mockMembreFindUnique.mockResolvedValue({
      id: MEMBRE,
      userId: ADMIN.userId,
      role: "admin",
      actif: true,
    });

    const r = await changerRoleMembreAction({ membreId: MEMBRE, role: "lecture" });

    expect("error" in r).toBe(true);
    expect(mockMembreUpdate).not.toHaveBeenCalled();
  });

  it("exige `equipe.gerer`", async () => {
    mockMembreFindUnique.mockResolvedValue({
      id: MEMBRE,
      userId: "autre",
      role: "montage",
      actif: true,
    });
    mockMembreUpdate.mockResolvedValue({ id: MEMBRE });

    await changerRoleMembreAction({ membreId: MEMBRE, role: "production" });

    expect(mockRequirePermission).toHaveBeenCalledWith("equipe.gerer");
  });

  it("REFUSE un rôle qui n'existe pas", async () => {
    const r = await changerRoleMembreAction({
      membreId: MEMBRE,
      role: "super-chef" as never,
    });
    expect("error" in r).toBe(true);
    expect(mockMembreUpdate).not.toHaveBeenCalled();
  });

  it("change le rôle d'un AUTRE membre, et le journalise", async () => {
    mockMembreFindUnique.mockResolvedValue({
      id: MEMBRE,
      userId: "autre",
      role: "montage",
      actif: true,
    });
    mockMembreUpdate.mockResolvedValue({ id: MEMBRE });

    const r = await changerRoleMembreAction({ membreId: MEMBRE, role: "production" });

    expect("error" in r).toBe(false);
    expect(mockMembreUpdate.mock.calls[0]![0].data.role).toBe("production");
    expect(mockJournaliser).toHaveBeenCalled();
  });
});
