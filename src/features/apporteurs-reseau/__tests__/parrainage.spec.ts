import { describe, expect, it } from "vitest";

import { coordonneesCommunes, refusRattachement, type IdentiteParrainage } from "../parrainage";

const filleul: IdentiteParrainage = {
  siren: "123 456 782",
  email: "jeanne@exemple.fr",
  telephone: "06 12 34 56 78",
  iban: "FR76 3000 6000 0112 3456 7890 189",
};
const autre: IdentiteParrainage = {
  siren: "552100554",
  email: "paul@autre.fr",
  telephone: "07 98 76 54 32",
  iban: "FR14 2004 1010 0505 0001 3M02 606",
};

describe("rattachement d'un parrain (art. 4.6)", () => {
  it("un parrain au contrat signé, aux coordonnées différentes : permis", () => {
    expect(refusRattachement({ parrainStatut: "signe", filleul, parrain: autre })).toBeNull();
  });
  it("un parrain non signé (dossier en cours, résilié, refusé…) : refusé", () => {
    for (const statut of ["dossier_en_cours", "a_verifier", "a_completer", "refuse", "resilie"]) {
      expect(refusRattachement({ parrainStatut: statut, filleul, parrain: autre })).toContain(
        "contrat signé",
      );
    }
  });
  it("même SIREN : signalé et refusé, espaces ignorés", () => {
    expect(coordonneesCommunes(filleul, { ...autre, siren: "123456782" })).toEqual(["SIREN"]);
    expect(
      refusRattachement({
        parrainStatut: "signe",
        filleul,
        parrain: { ...autre, siren: "123456782" },
      }),
    ).toContain("SIREN");
  });
  it("même e-mail, casse et espaces ignorés", () => {
    expect(coordonneesCommunes(filleul, { ...autre, email: " Jeanne@Exemple.fr " })).toEqual([
      "adresse e-mail",
    ]);
  });
  it("même téléphone, qu'il s'écrive 06… ou +33 6…", () => {
    expect(coordonneesCommunes(filleul, { ...autre, telephone: "+33 6 12 34 56 78" })).toEqual([
      "numéro de téléphone",
    ]);
  });
  it("même IBAN, espaces ignorés", () => {
    expect(coordonneesCommunes(filleul, { ...autre, iban: "FR7630006000011234567890189" })).toEqual(
      ["IBAN"],
    );
  });
  it("plusieurs coordonnées communes : toutes nommées dans le message", () => {
    const msg = refusRattachement({
      parrainStatut: "signe",
      filleul,
      parrain: { ...autre, siren: filleul.siren, iban: filleul.iban },
    });
    expect(msg).toContain("SIREN");
    expect(msg).toContain("IBAN");
  });
  it("des coordonnées vides des deux côtés ne comptent jamais comme communes", () => {
    const vide: IdentiteParrainage = { siren: null, email: null, telephone: null, iban: null };
    expect(coordonneesCommunes(vide, vide)).toEqual([]);
  });
});
