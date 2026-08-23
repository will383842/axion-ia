// @vitest-environment node
//
// L’environnement par défaut du dépôt est jsdom, dont le `File` n’a pas
// `arrayBuffer()`. On teste ici du code SERVEUR qui lit un téléversement : le
// bon environnement est Node, et son `File` a la méthode.

/**
 * Console éditoriale — tests du dépôt de fichier.
 *
 * ## Le défaut que ce fichier empêche de revenir
 *
 * 🔴 `televerserAssetAction` écrivait `statut: "pret"` en dur.
 *
 * Trouvé par la passe 5 du protocole. Ce n'était pas une inattention de
 * cosmétique : ça contournait DEUX règles d'un coup.
 *
 *  - **Le critère 5 du lot 2** — « un asset dont la durée dépasse la spec ne
 *    passe pas à `pret` ». Aucune spécification n'est consultable au dépôt, et
 *    pour cause : on ne connaît pas encore la plateforme visée. Déclarer
 *    « prêt » sans avoir rien mesuré, c'est déclarer conforme par défaut.
 *  - **Le §4** — le rôle `montage` a `asset.ecrire` mais PAS `asset.valider`.
 *    Il pouvait donc produire un asset validé **par la porte du dépôt**, en
 *    contournant celle qui lui est fermée.
 *
 * La matrice de permissions était juste, et ses 78 tests passaient. C'est le
 * câblage qui la contournait — et aucun test de module pur ne pouvait le voir.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockAssetCreate,
  mockAssetFindFirst,
  mockLienUpsert,
  mockLienCreate,
  mockLienCount,
  mockPublicationUpdate,
  mockRequirePermission,
  mockJournaliser,
  mockMkdir,
  mockWriteFile,
  mockAccess,
} = vi.hoisted(() => ({
  mockAssetCreate: vi.fn(),
  mockAssetFindFirst: vi.fn(),
  mockLienUpsert: vi.fn(),
  mockLienCreate: vi.fn(),
  mockLienCount: vi.fn(),
  mockPublicationUpdate: vi.fn(),
  mockRequirePermission: vi.fn(),
  mockJournaliser: vi.fn(),
  mockMkdir: vi.fn(),
  mockWriteFile: vi.fn(),
  mockAccess: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  default: { mkdir: mockMkdir, writeFile: mockWriteFile, access: mockAccess },
}));

// `sharp` n'est appelé que sur les images ; on dépose un PDF pour rester à
// l'écart de la manipulation binaire, qui n'est pas ce qu'on teste ici.
vi.mock("sharp", () => ({ default: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    edAsset: { create: mockAssetCreate, findFirst: mockAssetFindFirst },
    edAssetPublication: {
      upsert: mockLienUpsert,
      create: mockLienCreate,
      count: mockLienCount,
    },
    edPublication: { update: mockPublicationUpdate },
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

const { televerserAssetAction } = await import("./assets");

const MEMBRE = { userId: "u1", membreId: "m1", role: "montage" as const, nom: "Mo" };
const PUBLICATION = "dddddddd-0000-4000-8000-000000000001";

/** Un dépôt plausible : un PDF de quelques octets. */
function depot(): FormData {
  const f = new File([new Uint8Array([1, 2, 3, 4])], "kit.pdf", { type: "application/pdf" });
  const d = new FormData();
  d.set("fichier", f);
  d.set("publicationId", PUBLICATION);
  d.set("libelle", "Kit PDF");
  return d;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue(MEMBRE);
  mockJournaliser.mockResolvedValue(undefined);
  mockAssetFindFirst.mockResolvedValue(null);
  mockAssetCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: "asset-1",
    ...data,
  }));
  mockLienCount.mockResolvedValue(1);
  mockMkdir.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);
  mockAccess.mockRejectedValue(new Error("ENOENT"));
});

describe("televerserAssetAction — déposer n'est pas valider", () => {
  it("🔴 crée l'asset en `en_cours`, JAMAIS en `pret`", async () => {
    const r = await televerserAssetAction(depot());

    expect("error" in r, JSON.stringify(r)).toBe(false);
    const donnees = mockAssetCreate.mock.calls[0]![0].data as Record<string, unknown>;
    expect(donnees.statut).toBe("en_cours");
    expect(donnees.statut).not.toBe("pret");
  });

  it("🔴 ne fait pas passer la publication en `statutAsset: pret` non plus", async () => {
    // Le contournement passait aussi par là : marquer la PUBLICATION prête
    // revenait au même résultat visible, par une autre porte.
    await televerserAssetAction(depot());

    if (mockPublicationUpdate.mock.calls.length > 0) {
      const donnees = mockPublicationUpdate.mock.calls[0]![0].data as Record<string, unknown>;
      expect(donnees.statutAsset).not.toBe("pret");
    }
  });

  it("n'exige que `asset.ecrire` — et c'est POURQUOI il ne doit pas valider", async () => {
    // Ce test documente l'asymétrie plutôt que de la corriger : exiger
    // `asset.valider` au dépôt empêcherait le monteur de déposer, ce qui est
    // tout son travail. La bonne réponse est que le dépôt ne valide pas.
    await televerserAssetAction(depot());
    expect(mockRequirePermission).toHaveBeenCalledWith("asset.ecrire");
  });

  it("REFUSE un type de fichier hors liste, sans écrire sur le disque", async () => {
    const f = new File([new Uint8Array([1])], "piege.svg", { type: "image/svg+xml" });
    const d = new FormData();
    d.set("fichier", f);
    d.set("publicationId", PUBLICATION);

    const r = await televerserAssetAction(d);

    expect("error" in r).toBe(true);
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(mockAssetCreate).not.toHaveBeenCalled();
  });

  it("REFUSE quand aucun fichier n'est reçu", async () => {
    const d = new FormData();
    d.set("publicationId", PUBLICATION);

    const r = await televerserAssetAction(d);

    expect("error" in r).toBe(true);
    if ("error" in r) expect(r.error).toMatch(/fichier/i);
  });

  it("🔴 signale un doublon au lieu de réécrire le fichier", async () => {
    // L'empreinte SHA-256 est calculée AVANT écriture : deux dépôts du même
    // fichier ne doivent pas produire deux assets ni deux copies sur disque.
    mockAssetFindFirst.mockResolvedValue({
      id: "asset-existant",
      libelle: "Déjà là",
      cheminObjet: "ab/cd/ef.pdf",
    });

    const r = await televerserAssetAction(depot());

    expect("data" in r).toBe(true);
    if ("data" in r) expect((r.data as { doublon?: boolean }).doublon).toBe(true);
    expect(mockAssetCreate).not.toHaveBeenCalled();
  });
});
