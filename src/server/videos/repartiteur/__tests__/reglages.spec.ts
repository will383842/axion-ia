import { describe, expect, it } from "vitest";

import {
  CLE_REGLAGES_ENCARTS,
  REGLAGES_ENCARTS_DEFAUT,
  TYPES_CONTENUS_ENCARTS,
  analyserReglagesEncarts,
  reglagesEncartsSchema,
} from "../reglages";

describe("schéma des réglages « videos_encarts » — défauts", () => {
  it("la clé de configuration est « videos_encarts »", () => {
    expect(CLE_REGLAGES_ENCARTS).toBe("videos_encarts");
  });

  it("TOUT est éteint par défaut : actif faux, aucun seuil maximal", () => {
    expect(REGLAGES_ENCARTS_DEFAUT.actif).toBe(false);
    expect(REGLAGES_ENCARTS_DEFAUT.seuilMax).toBeUndefined();
    expect(REGLAGES_ENCARTS_DEFAUT.videosExclues).toEqual([]);
  });

  it("un objet vide donne exactement les défauts", () => {
    const r = analyserReglagesEncarts({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reglages).toEqual(REGLAGES_ENCARTS_DEFAUT);
  });

  it("une valeur absente (null, undefined) retombe sur les défauts, éteints ; un texte est refusé", () => {
    expect(analyserReglagesEncarts("texte").ok).toBe(false);
    for (const brut of [null, undefined]) {
      const r = analyserReglagesEncarts(brut);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.reglages.actif).toBe(false);
    }
  });

  it("les défauts sont gelés (aucune copie superficielle ne les modifie)", () => {
    expect(Object.isFrozen(REGLAGES_ENCARTS_DEFAUT)).toBe(true);
    expect(Object.isFrozen(REGLAGES_ENCARTS_DEFAUT.typesContenus)).toBe(true);
    expect(Object.isFrozen(REGLAGES_ENCARTS_DEFAUT.videosExclues)).toBe(true);
  });

  it("les défauts passent leur propre schéma", () => {
    expect(reglagesEncartsSchema.parse(REGLAGES_ENCARTS_DEFAUT)).toEqual(REGLAGES_ENCARTS_DEFAUT);
  });

  it("le schéma est un objet à forme lisible (.shape) pour le test de parité de E5", () => {
    expect(Object.keys(reglagesEncartsSchema.shape).sort()).toEqual(
      [
        "actif",
        "exclureVoisins",
        "fenetreJours",
        "plafondParVideo",
        "seuilMax",
        "seuilMin",
        "typesContenus",
        "videosExclues",
      ].sort(),
    );
  });
});

describe("schéma des réglages — validation", () => {
  it.each([
    [{ seuilMin: -0.1 }],
    [{ seuilMin: 1.2 }],
    [{ plafondParVideo: 0 }],
    [{ plafondParVideo: 2.5 }],
    [{ fenetreJours: 0 }],
    [{ fenetreJours: 400 }],
    [{ typesContenus: ["inconnu"] }],
    [{ actif: "oui" }],
    [{ videosExclues: [""] }],
    [{ champInconnu: 1 }],
  ])("refuse %j", (brut) => {
    expect(analyserReglagesEncarts(brut).ok).toBe(false);
  });

  it("refuse seuilMax inférieur au seuilMin", () => {
    const r = analyserReglagesEncarts({ seuilMin: 0.7, seuilMax: 0.5 });
    expect(r.ok).toBe(false);
  });

  it("accepte seuilMax égal ou supérieur au seuilMin", () => {
    expect(analyserReglagesEncarts({ seuilMin: 0.5, seuilMax: 0.5 }).ok).toBe(true);
    expect(analyserReglagesEncarts({ seuilMin: 0.5, seuilMax: 0.9 }).ok).toBe(true);
  });

  it("dédoublonne les vidéos exclues et les types de contenus", () => {
    const r = analyserReglagesEncarts({
      videosExclues: ["a", "a", "b"],
      typesContenus: ["blog", "blog"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.reglages.videosExclues).toEqual(["a", "b"]);
      expect(r.reglages.typesContenus).toEqual(["blog"]);
    }
  });

  it("la liste des types de contenus est fermée", () => {
    expect(TYPES_CONTENUS_ENCARTS).toContain("blog");
    expect(TYPES_CONTENUS_ENCARTS).toContain("ville");
  });
});

describe("schéma des réglages — null et lecture tolérante", () => {
  it("seuilMax null (formulaire) équivaut à l'absence", () => {
    const r = analyserReglagesEncarts({ seuilMax: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.reglages.seuilMax).toBeUndefined();
  });

  it("clé inconnue : refusée à l'écriture (strict), ignorée en lecture (tolérant)", () => {
    expect(analyserReglagesEncarts({ nouveau: 1 }).ok).toBe(false);
    const r = analyserReglagesEncarts({ nouveau: 1, actif: true }, { tolerant: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.reglages.actif).toBe(true);
      expect("nouveau" in r.reglages).toBe(false);
    }
  });

  it("la lecture tolérante refuse toujours une valeur invalide", () => {
    expect(analyserReglagesEncarts({ plafondParVideo: 0 }, { tolerant: true }).ok).toBe(false);
  });
});
