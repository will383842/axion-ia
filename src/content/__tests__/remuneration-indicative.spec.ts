// @req REQ-JUR-001 REQ-JUR-002 REQ-JUR-019 REQ-JUR-041
/**
 * remuneration-indicative.spec.ts — JUR-T29 (chantier Axion Partners) : la rémunération d'un
 * apporteur ne se promet pas.
 *
 * La garde `jur:remuneration-indicative` (`scripts/gates/jur-copy-indicative.ts`) lit les
 * surfaces de `jur:vocab-public` et rougit sur une formule ferme (« vous touchez », « commission
 * de 10 % », un montant de commission interpolé, « par journée vendue ») sans mention indicative
 * dans la ligne ou ses deux voisines, sur « kit de vente », et sur tout balisage structuré de
 * rémunération. Chaque famille a son TÉMOIN ROUGE, et la fenêtre ses CONTRE-TÉMOINS.
 */
import { describe, expect, it } from "vitest";

import {
  fautesDeRemuneration,
  type FamilleRemuneration,
} from "../../../scripts/gates/jur-copy-indicative";
import { lireSurfacesApporteur } from "../../../scripts/gates/vocab-public";

const temoin = (texte: string): FamilleRemuneration[] =>
  fautesDeRemuneration([{ chemin: "src/content/recrutement/temoin.ts", texte }]).map(
    (f) => f.famille,
  );

describe("REQ-JUR-001, REQ-JUR-002, REQ-JUR-019, REQ-JUR-041 — le dépôt tel qu'il est", () => {
  it("REQ-JUR-019 — le dépôt réel est sans faute, sur un périmètre NON vide", () => {
    const surfaces = lireSurfacesApporteur();
    expect(surfaces.length).toBeGreaterThan(10);
    expect(fautesDeRemuneration(surfaces)).toEqual([]);
  });
});

describe("REQ-JUR-019 — une rémunération ferme rougit", () => {
  it.each([
    "Vous touchez 250 € par journée",
    "Une commission de 10 % sur chaque audit.",
    "answer: `${commission(1)} pour vous.`",
    "Le montant, par journée vendue.",
    "Plus vous en présentez, plus vous gagnez.",
  ])("REQ-JUR-019 — TÉMOIN ROUGE : « %s »", (texte) => {
    expect(temoin(texte)).toContain<FamilleRemuneration>("remuneration_ferme");
  });

  it("REQ-JUR-019 — TÉMOIN ROUGE : « jusqu'à 500 € » seul (un plafond n'est pas indicatif)", () => {
    expect(temoin("Vous touchez jusqu'à 500 € par journée.")).toContain<FamilleRemuneration>(
      "remuneration_ferme",
    );
  });

  it("REQ-JUR-019 — TÉMOIN ROUGE : la même formule, la mention à TROIS lignes", () => {
    const texte = ["Vous touchez 250 € par journée", "", "", "à titre indicatif"].join("\n");
    expect(temoin(texte)).toContain<FamilleRemuneration>("remuneration_ferme");
  });
});

describe("REQ-JUR-001 — la mention indicative lève la faute, dans la phrase servie", () => {
  it.each([
    "À titre indicatif, vous touchez 250 € par journée",
    "Vous touchez 250 € par journée, selon profil.",
    "Vous touchez à partir de 250 € par journée.",
    "Vous touchez 250 € par journée, selon votre profil.",
  ])("REQ-JUR-001 — CONTRE-TÉMOIN, mention dans la ligne : « %s »", (texte) => {
    expect(temoin(texte)).toEqual([]);
  });

  it("REQ-JUR-001 — CONTRE-TÉMOIN : la mention sur la ligne voisine (JSX coupé)", () => {
    expect(temoin(["Vous touchez 250 € par journée", "à titre indicatif."].join("\n"))).toEqual([]);
    expect(temoin(["À titre indicatif :", "vous touchez 250 € par journée"].join("\n"))).toEqual(
      [],
    );
  });

  it("REQ-JUR-001 — CONTRE-TÉMOIN : un commentaire de code n'est pas lu", () => {
    const texte = [
      "// Vous touchez 250 € par journée — ancienne formule, retirée",
      " * commission de 10 % : exemple de ce qu'il ne faut plus écrire",
      "/* kit de vente */",
    ].join("\n");
    expect(temoin(texte)).toEqual([]);
  });

  it("REQ-JUR-002 — une ligne commentée ne sert pas de mention indicative", () => {
    const texte = ["// à titre indicatif", "Vous touchez 250 € par journée"].join("\n");
    expect(temoin(texte)).toContain<FamilleRemuneration>("remuneration_ferme");
  });
});

describe("REQ-JUR-041 — « kit de vente » est banni", () => {
  it("REQ-JUR-041 — TÉMOIN ROUGE : « kit de vente », même avec une mention indicative", () => {
    expect(temoin("Recevez votre kit de vente, à titre indicatif.")).toContain<FamilleRemuneration>(
      "kit_de_vente",
    );
  });

  it("REQ-JUR-041 — CONTRE-TÉMOIN : « le kit » seul passe", () => {
    expect(temoin('cta: "Recevoir le kit"')).toEqual([]);
  });
});

describe("REQ-JUR-019 — aucun balisage structuré de rémunération", () => {
  it.each([
    "incentiveCompensation: `${commission(1)} par journée, à titre indicatif`,",
    'baseSalary: { "@type": "MonetaryAmount", currency: "EUR" },',
    '"@type": "JobPosting",',
  ])("REQ-JUR-019 — TÉMOIN ROUGE : « %s »", (texte) => {
    expect(temoin(texte)).toContain<FamilleRemuneration>("jsonld_remuneration");
  });
});
