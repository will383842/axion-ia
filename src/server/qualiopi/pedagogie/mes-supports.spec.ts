import { describe, expect, it } from "vitest";
import {
  TYPES_SUPPORT_STAGIAIRE,
  estSupportPourStagiaire,
  libelleRemise,
  objetRemise,
  supportsRemis,
  type SupportCandidat,
} from "./mes-supports";

const ligne = (over: Partial<SupportCandidat>): SupportCandidat => ({
  id: "s",
  formationId: "f1",
  type: "livret_stagiaire",
  titre: "Livret",
  version: 1,
  statut: "genere",
  pdfKey: "k.pdf",
  ...over,
});

describe("supports destinés au stagiaire", () => {
  it("n'expose que des types pensés pour lui", () => {
    expect([...TYPES_SUPPORT_STAGIAIRE].sort()).toEqual(
      ["exercices", "livret_stagiaire", "memo", "slides_stagiaire"].sort(),
    );
    for (const t of [
      "guide_animation",
      "grille_eval",
      "slides_formateur",
      "kit_formateur_imprime",
    ]) {
      expect(estSupportPourStagiaire(t)).toBe(false);
    }
  });

  it("un type inconnu est refusé (liste fermée)", () => {
    expect(estSupportPourStagiaire("nouveau_type")).toBe(false);
  });
});

describe("supportsRemis", () => {
  it("garde la dernière version valide d'un (formation, type)", () => {
    const r = supportsRemis([
      ligne({ id: "a", version: 1, statut: "archive" }),
      ligne({ id: "b", version: 2 }),
    ]);
    expect(r.map((x) => x.id)).toEqual(["b"]);
  });

  it("un support retiré (archivé sans remplaçant) n'est plus remis", () => {
    expect(supportsRemis([ligne({ id: "a", statut: "archive" })])).toEqual([]);
  });

  it("écarte un brouillon, un support sans PDF, un type pour le formateur", () => {
    const r = supportsRemis([
      ligne({ id: "a", statut: "brouillon" }),
      ligne({ id: "b", pdfKey: null }),
      ligne({ id: "c", type: "guide_animation" }),
    ]);
    expect(r).toEqual([]);
  });

  it("si la dernière version a échoué, l'ancienne valide reste remise (étiquetée de sa version)", () => {
    const r = supportsRemis([
      ligne({ id: "v3", version: 3, statut: "brouillon", pdfKey: null }),
      ligne({ id: "v2", version: 2 }),
    ]);
    expect(r.map((x) => [x.id, x.version])).toEqual([["v2", 2]]);
  });

  it("deux types de la même formation : deux supports", () => {
    expect(supportsRemis([ligne({ id: "a" }), ligne({ id: "b", type: "memo" })])).toHaveLength(2);
  });
});

describe("clés du journal", () => {
  it("l'objet est un code stable, le libellé porte la version", () => {
    expect(objetRemise("memo")).toBe("support_memo");
    expect(libelleRemise("Mémo IA", 3)).toBe("Mémo IA (v3)");
    expect(libelleRemise("x".repeat(400), 1).length).toBeLessThanOrEqual(300);
  });
});
