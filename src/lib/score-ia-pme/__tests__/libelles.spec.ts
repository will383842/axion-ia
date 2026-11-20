/**
 * B5 / D : libellés propres au Score, ordre d'affichage, bornes sans chevauchement,
 * valeurs ajoutées (autre, outre-mer, non-precisee, none) sans toucher aux listes de l'Observatoire.
 */
import { describe, it, expect } from "vitest";
import {
  BAROMETER_QUESTIONS,
  SECTOR_SLUGS,
  REGION_SLUGS,
  BARRIER_VALUES,
} from "@/content/observatoire/questions";
import {
  LIBELLES_SCORE,
  ORDRE_AFFICHAGE,
  BORNES_BUDGET,
  BORNES_TEMPS,
  SECTOR_SLUGS_SCORE,
  REGION_SLUGS_SCORE,
  BARRIER_VALUES_SCORE,
  SECTEUR_AUTRE,
} from "../libelles";
import { BAREMES } from "../formule";

describe("valeurs ajoutées (amendement D)", () => {
  it("l'Observatoire garde ses listes ; le Score ajoute, en dernier", () => {
    expect(SECTOR_SLUGS).not.toContain("autre");
    expect(REGION_SLUGS).not.toContain("outre-mer");
    expect(BARRIER_VALUES as readonly string[]).not.toContain("none");
    expect(SECTOR_SLUGS_SCORE.at(-1)).toBe("autre");
    expect(SECTOR_SLUGS_SCORE).toHaveLength(SECTOR_SLUGS.length + 1);
    expect(REGION_SLUGS_SCORE.slice(-2)).toEqual(["outre-mer", "non-precisee"]);
    expect(BARRIER_VALUES_SCORE.at(-1)).toBe("none");
    expect(SECTEUR_AUTRE).toBe("autre");
  });
});

describe("libellés du Score (B5)", () => {
  it("chaque question et chaque option, y compris les valeurs ajoutées, a un libellé", () => {
    for (const q of BAROMETER_QUESTIONS) {
      if (q.id === "satisfaction") continue;
      expect(LIBELLES_SCORE[q.id]?.label, q.id).toBeTruthy();
    }
    for (const [id, valeurs] of Object.entries(ORDRE_AFFICHAGE)) {
      // Secteurs et régions existants : libellés de KB_SECTOR_TAGS / STUDY_REGIONS ; seul l'ajout est propre au Score.
      const deja: ReadonlyArray<string> =
        id === "sector" ? SECTOR_SLUGS : id === "region" ? REGION_SLUGS : [];
      for (const v of valeurs.filter((x) => !deja.includes(x))) {
        expect(LIBELLES_SCORE[id]?.options?.[v], `${id}.${v}`).toBeTruthy();
      }
    }
    expect(LIBELLES_SCORE.sector?.options?.autre).toBe("Autre secteur");
    expect(LIBELLES_SCORE.region?.options?.["outre-mer"]).toBe("Outre-mer");
    expect(LIBELLES_SCORE.region?.options?.["non-precisee"]).toBe("Je préfère ne pas le dire");
    expect(LIBELLES_SCORE.barriers?.options?.none).toBe("Aucun frein particulier");
  });

  it("aucun jargon ni « Score IA PME » dans les libellés", () => {
    const tout = JSON.stringify(LIBELLES_SCORE);
    for (const mot of ["POC", "RAG", "ROI", "k€", "·e", "Score IA PME"]) {
      expect(tout).not.toContain(mot);
    }
  });
});

describe("échelles : du plus faible au plus fort, « Je ne sais pas » en dernier", () => {
  it.each(Object.keys(BAREMES) as Array<keyof typeof BAREMES>)(
    "%s : l'ordre d'affichage suit les points croissants",
    (critere) => {
      const bareme = BAREMES[critere] as Record<string, number>;
      const points = ORDRE_AFFICHAGE[critere]!.filter((v) => v in bareme).map((v) => bareme[v]!);
      expect(points).toEqual([...points].sort((a, b) => a - b));
    },
  );

  it("« Je ne sais pas », « Aucun », « Autre » sont toujours en dernier", () => {
    expect(ORDRE_AFFICHAGE.annualBudget!.at(-1)).toBe("dont_know");
    expect(ORDRE_AFFICHAGE.competitorsUseAi!.at(-1)).toBe("dont_know");
    expect(ORDRE_AFFICHAGE.useCases!.at(-1)).toBe("none");
    expect(ORDRE_AFFICHAGE.tools!.at(-1)).toBe("none");
    expect(ORDRE_AFFICHAGE.barriers!.at(-1)).toBe("none");
    expect(ORDRE_AFFICHAGE.sector!.at(-1)).toBe("autre");
    expect(ORDRE_AFFICHAGE.region!.at(-1)).toBe("non-precisee");
    expect(ORDRE_AFFICHAGE.respondentRole!.at(-1)).toBe("other");
  });

  it("hasStrategy et teamTrained commencent par la réponse la plus basse", () => {
    expect(ORDRE_AFFICHAGE.hasStrategy![0]).toBe("none");
    expect(ORDRE_AFFICHAGE.teamTrained![0]).toBe("none");
  });
});

describe("bornes sans chevauchement (annualBudget, timeSavedPerDay)", () => {
  type Borne = readonly [min: number, maxExclu: number | null];
  const contigu = (ordre: readonly string[], b: Record<string, Borne>) => {
    for (let i = 0; i < ordre.length - 1; i++) {
      const [, max] = b[ordre[i]!]!;
      const [minSuivant] = b[ordre[i + 1]!]!;
      expect(max, `${ordre[i]} → ${ordre[i + 1]}`).toBe(minSuivant);
    }
    expect(b[ordre.at(-1)!]![1]).toBeNull();
  };

  it("budget : chaque borne haute (exclue) est la borne basse de la suivante", () => {
    const ordre = ORDRE_AFFICHAGE.annualBudget!.filter((v) => v !== "dont_know");
    contigu(ordre, BORNES_BUDGET);
  });

  it("temps gagné : idem, en minutes", () => {
    contigu(ORDRE_AFFICHAGE.timeSavedPerDay!, BORNES_TEMPS);
  });

  it("les textes annoncent « moins de » à la borne haute et « De … à … » sans reprendre la borne basse suivante", () => {
    const o = LIBELLES_SCORE.annualBudget!.options!;
    expect(o.k1_5).toMatch(/moins de 5 000/);
    expect(o.k5_20).toMatch(/moins de 20 000/);
    const t = LIBELLES_SCORE.timeSavedPerDay!.options!;
    expect(t.m30_1h).toMatch(/moins d'1 heure/);
    expect(t.h1_2).toMatch(/moins de 2 heures/);
    // « 1-5 k€ » / « 5-20 k€ » et « 30 min - 1 h » / « 1-2 h » : formes interdites.
    expect(JSON.stringify(o)).not.toMatch(/\d-\d|k€/);
    expect(JSON.stringify(t)).not.toMatch(/\d-\d|\d h\b/);
  });
});
