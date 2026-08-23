/**
 * Console éditoriale — tests des Server Actions de dérivation.
 *
 * ## Le cas qui a motivé ce fichier
 *
 * 🔴 La garde anti-cycle ne gardait qu'un seul niveau.
 *
 * `rattacherAssetAction` alimentait `creeraitUnCycle` avec `chargerLot()`,
 * qui DESCEND (`JOIN arbre ON a.parent_id = arbre.id`), alors que la fonction
 * REMONTE (`parents.get(courant)`). La carte des parents s'arrêtait donc au
 * premier maillon :
 *
 *     base : r → x → y      (rattacher r sous y ⇒ cycle r→y→x→r)
 *     lot descendant        : la LIGNE de x manquait
 *     creeraitUnCycle       → false ⇒ le cycle s'écrivait en base
 *
 * La fonction pure était juste, et ses 40 tests unitaires passaient. **On lui
 * donnait le mauvais objet.** Aucun test de module pur ne pouvait voir ça —
 * c'est exactement pour cette classe de défaut que les actions ont besoin de
 * leurs propres tests.
 *
 * Les tests ci-dessous vérifient donc la REQUÊTE que l'action construit, pas
 * seulement son verdict : une garde alimentée par les bonnes données est la
 * seule qui garde vraiment.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockQueryRaw,
  mockAssetFindUnique,
  mockAssetUpdate,
  mockAssetCreateMany,
  mockRecetteFindUnique,
  mockSpecFindMany,
  mockPublicationFindUnique,
  mockPublicationUpdate,
  mockEpisodeInviteFindMany,
  mockTransaction,
  mockRequirePermission,
  mockJournaliser,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockAssetFindUnique: vi.fn(),
  mockAssetUpdate: vi.fn(),
  mockAssetCreateMany: vi.fn(),
  mockRecetteFindUnique: vi.fn(),
  mockSpecFindMany: vi.fn(),
  mockPublicationFindUnique: vi.fn(),
  mockPublicationUpdate: vi.fn(),
  mockEpisodeInviteFindMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockJournaliser: vi.fn(),
}));

const clientPrisma = {
  $queryRaw: mockQueryRaw,
  edAsset: {
    findUnique: mockAssetFindUnique,
    update: mockAssetUpdate,
    createMany: mockAssetCreateMany,
  },
  edRecette: { findUnique: mockRecetteFindUnique },
  edSpecPlateforme: { findMany: mockSpecFindMany },
  edPublication: { findUnique: mockPublicationFindUnique, update: mockPublicationUpdate },
  edEpisodeInvite: { findMany: mockEpisodeInviteFindMany },
};

vi.mock("@/lib/prisma", () => ({
  prisma: { ...clientPrisma, $transaction: mockTransaction },
}));

vi.mock("@/server/actions/editorial/_guards", () => ({
  requirePermission: mockRequirePermission,
  journaliser: mockJournaliser,
  requireMembreEditorial: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { rattacherAssetAction, passerAssetPretAction } = await import("./recettes");

const MEMBRE = { userId: "u1", membreId: "m1", role: "admin" as const, nom: "Will" };
const R = "aaaaaaaa-0000-4000-8000-000000000001";
const X = "aaaaaaaa-0000-4000-8000-000000000002";
const Y = "aaaaaaaa-0000-4000-8000-000000000003";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue(MEMBRE);
  mockJournaliser.mockResolvedValue(undefined);
  mockTransaction.mockImplementation(async (arg: unknown) =>
    typeof arg === "function"
      ? await (arg as (tx: unknown) => Promise<unknown>)(clientPrisma)
      : await Promise.all(arg as Promise<unknown>[]),
  );
});

describe("rattacherAssetAction — la garde anti-cycle", () => {
  it("🔴 interroge les ANCÊTRES du parent proposé, pas sa descendance", async () => {
    // C'est LE test qui aurait attrapé le défaut. Il ne regarde pas le
    // verdict — il regarde le SQL construit. Une requête qui descend ne peut
    // pas alimenter une garde qui remonte, quel que soit son résultat.
    mockQueryRaw.mockResolvedValue([{ id: Y, parentId: null }]);
    mockAssetUpdate.mockResolvedValue({ id: R });

    await rattacherAssetAction({ assetId: R, parentId: Y });

    const gabarit = (mockQueryRaw.mock.calls[0]![0] as { raw?: string[] }).raw ?? [];
    const sql = gabarit.join(" ");
    // La jointure DOIT remonter : `ancetres.parent_id = a.id`.
    expect(sql).toMatch(/ancetres\.parent_id\s*=\s*a\.id/);
    // Et surtout PAS descendre.
    expect(sql).not.toMatch(/a\.parent_id\s*=\s*arbre\.id/);
  });

  it("🔴 REFUSE le cycle à deux niveaux que l'ancienne garde laissait passer", async () => {
    // base : r → x → y, on rattache r sous y.
    // La chaîne d'ancêtres de y est [y, x, r] : la garde voit r au-dessus.
    mockQueryRaw.mockResolvedValue([
      { id: Y, parentId: X },
      { id: X, parentId: R },
      { id: R, parentId: null },
    ]);

    const r = await rattacherAssetAction({ assetId: R, parentId: Y });

    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toMatch(/cycle/i);
    expect(mockAssetUpdate).not.toHaveBeenCalled();
  });

  it("🔴 REFUSE aussi le cycle direct et l'auto-parent", async () => {
    mockQueryRaw.mockResolvedValue([{ id: R, parentId: null }]);
    const auto = await rattacherAssetAction({ assetId: R, parentId: R });
    expect("error" in auto).toBe(true);
    expect(mockAssetUpdate).not.toHaveBeenCalled();
  });

  it("accepte un rattachement sain, et marque l'asset `derive`", async () => {
    mockQueryRaw.mockResolvedValue([{ id: Y, parentId: null }]);
    mockAssetUpdate.mockResolvedValue({ id: R });

    const r = await rattacherAssetAction({ assetId: R, parentId: Y, offsetSourceSec: 2400 });

    expect("error" in r).toBe(false);
    const donnees = mockAssetUpdate.mock.calls[0]![0].data;
    expect(donnees.parentId).toBe(Y);
    expect(donnees.nature).toBe("derive");
    expect(donnees.offsetSourceSec).toBe(2400);
  });

  it("détacher (parent nul) ne consulte AUCUN ancêtre et rend l'asset autonome", async () => {
    // Il n'y a pas de cycle possible en retirant un lien : interroger la base
    // pour rien serait une requête gratuite sur un écran qui s'affiche souvent.
    mockAssetUpdate.mockResolvedValue({ id: R });

    await rattacherAssetAction({ assetId: R, parentId: null });

    expect(mockQueryRaw).not.toHaveBeenCalled();
    expect(mockAssetUpdate.mock.calls[0]![0].data.nature).toBe("autonome");
  });
});

describe("passerAssetPretAction — la seule porte de validation", () => {
  it("🔴 exige `asset.valider`, que le rôle `montage` n'a PAS", async () => {
    // La passe 5 avait trouvé qu'on pouvait contourner cette porte par le
    // téléversement, qui écrivait `pret` en dur. Ce chemin est fermé ; celui-ci
    // doit rester le seul, et il doit vérifier la BONNE permission.
    await passerAssetPretAction({ assetId: R }).catch(() => undefined);
    expect(mockRequirePermission).toHaveBeenCalledWith("asset.valider");
  });

  it("remonte le refus en citant le rôle, sans l'avaler", async () => {
    mockRequirePermission.mockRejectedValue(
      new Error("Action « asset.valider » refusée : le rôle « montage » ne l'a pas."),
    );

    const r = await passerAssetPretAction({ assetId: R });

    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toContain("montage");
    expect(mockAssetUpdate).not.toHaveBeenCalled();
  });
});
