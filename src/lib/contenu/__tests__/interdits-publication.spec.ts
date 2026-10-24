/**
 * Tests — interdits de publication (module pur, doctrine Axion-IA).
 *
 * Chaque cas qui doit bloquer est rejoué dans huit variantes typographiques
 * (accents, majuscules, espaces insécables, apostrophe courbe, trait d'union
 * insécable, trait d'union conditionnel). Les phrases saines ne doivent jamais
 * être bloquées, quelle que soit la variante.
 */

import { describe, expect, it } from "vitest";
import {
  detecterInterdits,
  detecterInterditsSurface,
  normaliserPourControle,
  type OptionsInterdits,
} from "../interdits-publication";
import { CAS_BLOQUANTS, CAS_SAINS, variantes } from "./interdits-publication.cas";

const STRICT: OptionsInterdits = { actualite: false, financementPublicAutorise: false };

const codes = (t: string, o: OptionsInterdits = STRICT) =>
  detecterInterdits(t, o).map((d) => d.code);

describe("normaliserPourControle", () => {
  it("retire accents, balises, insécables, apostrophes et tirets typographiques", () => {
    expect(normaliserPourControle("<p>L’Étude de cas ‑ Œuvre</p>")).toBe(
      " l'etude de cas - oeuvre ",
    );
  });

  it("décode les entités courantes", () => {
    expect(normaliserPourControle("Qualit&eacute; &amp; l&rsquo;&agrave;")).toBe("qualite & l'a");
  });

  it("retire le trait d'union conditionnel et les espaces de largeur nulle", () => {
    expect(normaliserPourControle("Quali­o​pi")).toBe("qualiopi");
  });
});

describe("detecterInterdits — cas qui doivent bloquer", () => {
  it("compte au moins 40 cas", () => {
    expect(CAS_BLOQUANTS.length).toBeGreaterThanOrEqual(40);
  });

  for (const [code, phrase] of CAS_BLOQUANTS) {
    it(`${code} : ${phrase}`, () => {
      for (const v of variantes(phrase)) {
        expect(codes(v), JSON.stringify(v)).toContain(code);
      }
    });
  }

  it("Qualiopi avec trait d'union conditionnel au milieu du mot", () => {
    expect(codes("Certifié Quali­opi")).toContain("qualiopi");
  });
});

describe("detecterInterdits — phrases saines", () => {
  it("compte au moins 30 phrases", () => {
    expect(CAS_SAINS.length).toBeGreaterThanOrEqual(30);
  });

  for (const phrase of CAS_SAINS) {
    it(phrase, () => {
      for (const v of variantes(phrase)) {
        expect(codes(v), JSON.stringify(v)).toEqual([]);
      }
    });
  }
});

describe("detecterInterdits — options", () => {
  const opco = "Une prise en charge par votre OPCO ou France Travail est possible.";

  it("bloque OPCO / France Travail quand le financement public n'est pas autorisé", () => {
    expect(codes(opco, { actualite: false, financementPublicAutorise: false })).toContain(
      "financement-public",
    );
  });

  it("accepte OPCO / France Travail quand le financement public est autorisé", () => {
    expect(codes(opco, { actualite: false, financementPublicAutorise: true })).not.toContain(
      "financement-public",
    );
  });

  const citation =
    "« Nous déployons l'assistant dans tous les services cette année », a déclaré le directeur général.";

  it("bloque une citation suivie d'une fonction hors actualité", () => {
    expect(codes(citation)).toContain("citation-temoin");
  });

  it("accepte une citation suivie d'une fonction dans une actualité", () => {
    expect(codes(citation, { actualite: true, financementPublicAutorise: false })).not.toContain(
      "citation-temoin",
    );
  });

  it("renvoie l'extrait et le nombre d'occurrences", () => {
    const r = detecterInterdits("Grenoble, puis encore Grenoble.", STRICT);
    expect(r).toHaveLength(1);
    expect(r[0]!.code).toBe("grenoble");
    expect(r[0]!.occurrences).toBe(2);
    expect(r[0]!.extrait).toContain("grenoble");
  });

  it("un texte vide ne renvoie rien", () => {
    expect(detecterInterdits("", STRICT)).toEqual([]);
  });
});

describe("detecterInterditsSurface", () => {
  it("désigne le champ fautif et ignore les champs vides", () => {
    const r = detecterInterditsSurface(
      { titre: "Un titre sain", metaTitre: "Certifié Qualiopi", pointCle: undefined, corps: "" },
      STRICT,
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ code: "qualiopi", champ: "metaTitre" });
  });
});
