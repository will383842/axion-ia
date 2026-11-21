/**
 * Tests — garde de version d'une signature de devis (verrou de ligne puis relecture).
 */
import { describe, it, expect, vi } from "vitest";
import { versionDevisEncoreSignable } from "./garde-signature-version";

const PIECE = "11111111-1111-4111-8111-111111111111";

function txSimule(lignes: { id: string }[], suivantes: number) {
  const ordre: string[] = [];
  const queryRaw = vi.fn(async () => {
    ordre.push("queryRaw");
    return lignes;
  });
  const count = vi.fn(async () => {
    ordre.push("count");
    return suivantes;
  });
  return { tx: { $queryRaw: queryRaw, devis: { count } } as never, queryRaw, count, ordre };
}

describe("versionDevisEncoreSignable", () => {
  it("verrouille_par_document_genere_id_avant_tout", async () => {
    const { tx, queryRaw, ordre } = txSimule([{ id: "d1" }], 0);
    await versionDevisEncoreSignable(tx, PIECE);
    const appel = queryRaw.mock.calls[0] as unknown as [TemplateStringsArray, ...unknown[]];
    const texte = appel[0].join("?");
    expect(texte).toContain("FOR NO KEY UPDATE");
    expect(texte).toContain("document_genere_id");
    expect(texte).toContain("ORDER BY id");
    expect(appel[1]).toBe(PIECE);
    expect(ordre[0]).toBe("queryRaw");
  });

  it("deux_instructions_distinctes", async () => {
    const { tx, queryRaw, count, ordre } = txSimule([{ id: "d1" }], 0);
    await versionDevisEncoreSignable(tx, PIECE);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(count).toHaveBeenCalledTimes(1);
    expect(ordre).toEqual(["queryRaw", "count"]);
  });

  it("aucune_ligne_rend_vrai_sans_count", async () => {
    const { tx, count } = txSimule([], 0);
    expect(await versionDevisEncoreSignable(tx, PIECE)).toBe(true);
    expect(count).not.toHaveBeenCalled();
  });

  it("successeur_emis_rend_faux", async () => {
    const { tx } = txSimule([{ id: "d1" }], 1);
    expect(await versionDevisEncoreSignable(tx, PIECE)).toBe(false);
  });

  it("successeur_brouillon_seul_rend_vrai", async () => {
    const { tx, count } = txSimule([{ id: "d1" }, { id: "d2" }], 0);
    expect(await versionDevisEncoreSignable(tx, PIECE)).toBe(true);
    expect(count).toHaveBeenCalledWith({
      where: { replacesDevisId: { in: ["d1", "d2"] }, statut: { not: "brouillon" } },
    });
  });
});
