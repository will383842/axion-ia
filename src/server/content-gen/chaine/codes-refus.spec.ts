import { describe, expect, it } from "vitest";
import {
  CODES_HORS_CRITERE,
  CODES_REFUS,
  CORRESPONDANCE_BNN,
  CRITERES_BLOQUANTS,
  LIBELLES_CODES,
  codePourCritere,
  criteresPourCode,
  estCodeRefus,
  estReport,
} from "./codes-refus";

/** Liste du § 7.1 de la conception de la chaîne + les quatre codes de C4. */
const ATTENDUS = [
  "pas_d_angle",
  "pas_de_matiere",
  "dossier_insuffisant",
  "fait_non_source",
  "chiffre_retire",
  "intention_couverte",
  "doublon_semantique",
  "doublon_plan",
  "apport_absent",
  "generique",
  "non_actionnable",
  "appel_incoherent",
  "date_ou_auteur",
  "texte_cache",
  "coupe_circuit",
  "lien_mort",
  "doctrine",
  "plagiat",
  "style",
  "plafond_atteint",
  "refus_humain",
  "autre",
  "intention_non_respectee",
  "structure_titres",
  "longueur_hors_fourchette",
  "reponse_directe_absente",
] as const;

describe("liste fermée des codes de refus", () => {
  it("contient exactement les codes attendus, sans doublon", () => {
    expect(new Set(CODES_REFUS).size).toBe(CODES_REFUS.length);
    expect([...CODES_REFUS].sort()).toEqual([...ATTENDUS].sort());
  });

  it("prévoit les quatre codes demandés pour C4", () => {
    for (const c of [
      "intention_non_respectee",
      "structure_titres",
      "longueur_hors_fourchette",
      "reponse_directe_absente",
    ]) {
      expect(estCodeRefus(c)).toBe(true);
    }
  });

  it("n'a que des codes en minuscules avec tirets bas", () => {
    for (const c of CODES_REFUS) expect(c).toMatch(/^[a-z]+(_[a-z']+)*$/);
  });

  it("estCodeRefus refuse tout ce qui n'est pas un code", () => {
    for (const v of ["", "Doctrine", "reglementation", "B01", null, undefined, 3, {}]) {
      expect(estCodeRefus(v)).toBe(false);
    }
  });

  it("porte un libellé français non vide pour chaque code, et aucun en trop", () => {
    expect(Object.keys(LIBELLES_CODES).sort()).toEqual([...CODES_REFUS].sort());
    for (const c of CODES_REFUS) expect(LIBELLES_CODES[c].trim().length).toBeGreaterThan(5);
  });
});

describe("correspondance Bnn → code", () => {
  it("couvre B01 à B17, dans l'ordre, sans trou", () => {
    expect([...CRITERES_BLOQUANTS]).toEqual(
      Array.from({ length: 17 }, (_, i) => `B${String(i + 1).padStart(2, "0")}`),
    );
    expect(Object.keys(CORRESPONDANCE_BNN)).toEqual([...CRITERES_BLOQUANTS]);
  });

  it("reprend le § 8 de la chaîne : code par défaut de chaque critère", () => {
    const defauts = {
      B01: "doctrine",
      B02: "fait_non_source",
      B03: "fait_non_source",
      B04: "fait_non_source",
      B05: "intention_couverte",
      B06: "doublon_semantique",
      B07: "apport_absent",
      B08: "reponse_directe_absente",
      B09: "dossier_insuffisant",
      B10: "appel_incoherent",
      B11: "style",
      B12: "style",
      B13: "lien_mort",
      B14: "date_ou_auteur",
      B15: "texte_cache",
      B16: "generique",
      B17: "coupe_circuit",
    } as const;
    for (const b of CRITERES_BLOQUANTS) expect(codePourCritere(b)).toBe(defauts[b]);
  });

  it("n'emploie que des codes de la liste fermée, sans doublon dans une entrée", () => {
    for (const b of CRITERES_BLOQUANTS) {
      const codes = CORRESPONDANCE_BNN[b];
      expect(codes.length).toBeGreaterThan(0);
      expect(new Set(codes).size).toBe(codes.length);
      for (const c of codes) expect(estCodeRefus(c)).toBe(true);
    }
  });

  it("garde les précisions permises par le § 8 et par C4", () => {
    expect(CORRESPONDANCE_BNN.B02).toEqual(["fait_non_source", "chiffre_retire"]);
    expect(CORRESPONDANCE_BNN.B08).toContain("style");
    expect(CORRESPONDANCE_BNN.B11).toEqual(
      expect.arrayContaining(["style", "longueur_hors_fourchette", "structure_titres"]),
    );
  });

  it("codePourCritere accepte une précision permise, refuse les autres", () => {
    expect(codePourCritere("B02", "chiffre_retire")).toBe("chiffre_retire");
    expect(codePourCritere("B11", "longueur_hors_fourchette")).toBe("longueur_hors_fourchette");
    expect(codePourCritere("B11", "structure_titres")).toBe("structure_titres");
    // précision étrangère au critère : retour au code par défaut, jamais un code faux
    expect(codePourCritere("B01", "chiffre_retire")).toBe("doctrine");
    expect(codePourCritere("B11", undefined)).toBe("style");
  });

  it("partitionne les codes : chaque code vient d'un Bnn ou est hors critère, jamais rien", () => {
    const venusDesCriteres = new Set(CRITERES_BLOQUANTS.flatMap((b) => CORRESPONDANCE_BNN[b]));
    for (const c of CODES_REFUS) {
      const horsCritere = (CODES_HORS_CRITERE as readonly string[]).includes(c);
      expect(venusDesCriteres.has(c) || horsCritere, c).toBe(true);
    }
    // un code hors critère n'est atteint par aucun Bnn
    for (const c of CODES_HORS_CRITERE) expect(venusDesCriteres.has(c), c).toBe(false);
  });

  it("classe hors critère les codes des rôles amont, du système et des humains", () => {
    expect([...CODES_HORS_CRITERE].sort()).toEqual(
      [
        "autre",
        "doublon_plan",
        "intention_non_respectee",
        "non_actionnable",
        "pas_d_angle",
        "pas_de_matiere",
        "plafond_atteint",
        "plagiat",
        "refus_humain",
      ].sort(),
    );
  });

  it("criteresPourCode rend les critères qui mènent à un code", () => {
    expect(criteresPourCode("fait_non_source")).toEqual(["B02", "B03", "B04"]);
    expect(criteresPourCode("style")).toEqual(["B08", "B11", "B12"]);
    expect(criteresPourCode("plagiat")).toEqual([]);
    expect(criteresPourCode("coupe_circuit")).toEqual(["B17"]);
  });

  it("B17 est un report, pas un refus : seul coupe_circuit est un report", () => {
    expect(estReport("coupe_circuit")).toBe(true);
    for (const c of CODES_REFUS) if (c !== "coupe_circuit") expect(estReport(c)).toBe(false);
  });

  it("n'a aucun code « reglementation » : B04 reste fait_non_source (§ 8 de la chaîne)", () => {
    expect((CODES_REFUS as readonly string[]).includes("reglementation")).toBe(false);
    expect(codePourCritere("B04")).toBe("fait_non_source");
  });
});
