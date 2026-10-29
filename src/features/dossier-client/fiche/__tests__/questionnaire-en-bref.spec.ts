import { describe, expect, it } from "vitest";

import type { LignePersonne, SuiviParPersonne } from "@/features/questionnaire-preaudit/personnes";
import {
  entreeDepuisSuivi,
  phraseDateLimite,
  phraseEnBref,
  prenomDe,
} from "../questionnaire-en-bref";

const e = (recus: number, attendus: number, manquants: string[] = [], sansNom = 0) => ({
  attendus,
  recus,
  manquants,
  manquantsSansNom: sansNom,
});

describe("phraseEnBref", () => {
  it("aucun manquant mais incomplet de décompte : dit seulement le compte", () => {
    expect(phraseEnBref(e(4, 5))).toBe("4 réponses sur 5.");
  });
  it("un manquant", () => {
    expect(phraseEnBref(e(4, 5, ["Paul"]))).toBe("4 réponses sur 5. Il manque Paul.");
  });
  it("plusieurs manquants", () => {
    expect(phraseEnBref(e(2, 5, ["Paul", "Léa", "Emma"]))).toBe(
      "2 réponses sur 5. Il manque Paul, Léa et Emma.",
    );
    expect(phraseEnBref(e(3, 5, ["Paul", "Léa"]))).toBe("3 réponses sur 5. Il manque Paul et Léa.");
  });
  it("singulier pour une seule réponse", () => {
    expect(phraseEnBref(e(1, 3, ["Paul", "Léa"]))).toBe("1 réponse sur 3. Il manque Paul et Léa.");
  });
  it("des manquants sans nom montrable sont comptés", () => {
    expect(phraseEnBref(e(1, 3, ["Paul"], 1))).toBe(
      "1 réponse sur 3. Il manque Paul et 1 autre personne.",
    );
  });
  it("complet", () => {
    expect(phraseEnBref(e(5, 5))).toBe("Toutes les réponses sont arrivées.");
  });
});

describe("phraseDateLimite", () => {
  it("jour de Paris", () => {
    expect(phraseDateLimite(new Date("2026-11-05T10:00:00Z"))).toBe("À rendre avant le 5 nov.");
    // 23 h UTC = le lendemain à Paris.
    expect(phraseDateLimite(new Date("2026-11-04T23:30:00Z"))).toBe("À rendre avant le 5 nov.");
  });
  it("aucune date : rien", () => {
    expect(phraseDateLimite(null)).toBeNull();
  });
});

describe("prenomDe", () => {
  it("premier mot", () => {
    expect(prenomDe("Paul Martin")).toBe("Paul");
    expect(prenomDe(null)).toBeNull();
    expect(prenomDe("  ")).toBeNull();
  });
});

const ligne = (
  nom: string | null,
  etat: LignePersonne["etat"],
  sourceNom: LignePersonne["sourceNom"] = "equipe",
): LignePersonne =>
  ({ cle: nom ?? "x", role: "collaborateur", nom, sourceNom, etat }) as unknown as LignePersonne;

describe("entreeDepuisSuivi", () => {
  it("tire les prénoms de la liste, laisse de côté brouillon et sans-lien", () => {
    const s = {
      dirigeant: { ...ligne("Anne Durand", "recu"), role: "dirigeant" },
      collaborateurs: [
        ligne("Paul Martin", "pas_de_nouvelles"),
        ligne("Léa Roux", "en_cours"),
        ligne("Sam Noir", "pas_de_lien_prevu"),
        ligne("Zoé Cachée", "pas_de_nouvelles", "brouillon"),
        ligne("Emma Vert", "recu"),
      ],
      referents: [],
      total: { attendus: 5, recus: 2 },
    } as unknown as SuiviParPersonne;
    expect(entreeDepuisSuivi(s)).toEqual({
      attendus: 5,
      recus: 2,
      manquants: ["Paul", "Léa"],
      manquantsSansNom: 1,
    });
  });
});
