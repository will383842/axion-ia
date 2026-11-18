import { describe, expect, it } from "vitest";

import type { LignePersonne, SuiviParPersonne } from "@/features/questionnaire-preaudit/personnes";
import {
  entreeDepuisSuivi,
  phraseDateLimite,
  phraseEnBref,
  prenomDe,
} from "../questionnaire-en-bref";
import { suiviReel } from "./suivi-reel.fixture";

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
    expect(phraseDateLimite(new Date("2026-11-05T10:00:00Z"))).toBe("Jusqu'au 5 nov.");
    // 23 h UTC = le lendemain à Paris.
    expect(phraseDateLimite(new Date("2026-11-04T23:30:00Z"))).toBe("Jusqu'au 5 nov.");
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
      manquantsSansNom: 0,
      dirigeantManque: false,
    });
  });
});

describe("entreeDepuisSuivi sur un vrai suivi (personnes.ts)", () => {
  it("tout reçu + ligne référent vide : « Toutes les réponses sont arrivées »", () => {
    const s = suiviReel({ recus: [0, 1, 2] });
    // La ligne référent `r0` existe toujours (nom null, pas_de_nouvelles) mais n'est pas attendue.
    expect(s.referents).toHaveLength(1);
    expect(s.referents[0]).toMatchObject({ nom: null, etat: "pas_de_nouvelles", role: "referent" });
    const e = entreeDepuisSuivi(s);
    expect(e.manquants).toEqual([]);
    expect(e.manquantsSansNom).toBe(0);
    expect(e.dirigeantManque).toBe(false);
    expect(e.recus).toBe(e.attendus);
    expect(phraseEnBref(e)).toBe("Toutes les réponses sont arrivées.");
  });

  it("une ligne écartée (effacement) n'est jamais nommée comme manquante", () => {
    const s = suiviReel({ recus: [0, 2], ecartes: [1] });
    expect(s.collaborateurs[1]?.etat).toBe("ecartee");
    const e = entreeDepuisSuivi(s);
    expect(e.manquants).toEqual([]);
    expect(e.manquantsSansNom).toBe(0);
    expect(JSON.stringify(e)).not.toContain("Bruno");
    expect(phraseEnBref(e)).toBe("Toutes les réponses sont arrivées.");
  });

  it("une personne hors liste seulement « ouverte » n'est ni comptée ni nommée", () => {
    const s = suiviReel({
      recus: [0, 1, 2],
      ouvertures: [
        {
          mode: "emp",
          membre: "inconnu000001",
          premiereOuverture: new Date(),
          derniereOuverture: new Date(),
          nombre: 1,
          derniereEtapeAtteinte: 1,
        },
      ],
    });
    const e = entreeDepuisSuivi(s);
    expect(e.manquantsSansNom).toBe(0);
    expect(e.recus).toBe(e.attendus);
    expect(phraseEnBref(e)).toBe("Toutes les réponses sont arrivées.");
  });

  it("un manquant réel est nommé, le dirigeant absent est dit à part", () => {
    const e = entreeDepuisSuivi(suiviReel({ recus: [0, 2] }));
    expect(e.manquants).toEqual(["Bruno"]);
    const sans = entreeDepuisSuivi(suiviReel({ recus: [], sansDirigeant: true }));
    expect(sans.dirigeantManque).toBe(true);
    expect(sans.manquants).toEqual([]);
  });
});
