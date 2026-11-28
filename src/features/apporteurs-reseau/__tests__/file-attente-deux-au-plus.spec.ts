import { describe, expect, it, vi } from "vitest";

import { creerFaux, D, presentation } from "./file-attente-faux";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("../etablissement-presentation", async (orig) => {
  const vrai = await orig<typeof import("../etablissement-presentation")>();
  return {
    ...vrai,
    lireEtablissements: async (ids: readonly string[]) =>
      new Map(
        ids.map((id) => [id, { siret: "12345678200017", entreprise: false, exclus: [] }] as const),
      ),
  };
});

import { mettreEnAttente } from "../file-attente";

const P = (n: number) =>
  presentation(`P${n}`, { apporteurId: `APP${n}`, recueAt: D(`2026-11-0${n}T10:00:00Z`) });

describe("file-attente-deux-au-plus", () => {
  it("1re et 2e conservées, 3e refusée (art. 3.3 bis c)", async () => {
    const { etat, db } = creerFaux({ presentations: [P(1), P(2), P(3)] });
    const t = D("2026-12-01T09:00:00Z");
    expect(await mettreEnAttente(db, "P1", t)).toBe("en_attente");
    expect(await mettreEnAttente(db, "P2", t)).toBe("en_attente");
    expect(await mettreEnAttente(db, "P3", t)).toBe("file_complete");
    expect(etat.file.map((l) => l.presentationId)).toEqual(["P1", "P2"]);
    expect(etat.file[0]).toMatchObject({
      cleFile: "12345678200017",
      siren: "123456782",
      statut: "en_attente",
    });
    expect(etat.file[0]!.recueAt).toEqual(D("2026-11-01T10:00:00Z"));
  });

  it("une déclaration déjà en file n'est pas comptée deux fois", async () => {
    const { etat, db } = creerFaux({ presentations: [P(1)] });
    await mettreEnAttente(db, "P1", new Date());
    expect(await mettreEnAttente(db, "P1", new Date())).toBe("en_attente");
    expect(etat.file).toHaveLength(1);
  });

  it("une ligne effacée ou éteinte ne compte plus : une place se libère", async () => {
    const { etat, db } = creerFaux({ presentations: [P(1), P(2), P(3)] });
    await mettreEnAttente(db, "P1", new Date());
    await mettreEnAttente(db, "P2", new Date());
    etat.file[0]!.statut = "effacee";
    expect(await mettreEnAttente(db, "P3", new Date())).toBe("en_attente");
  });
});
