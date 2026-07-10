/**
 * Tests — availability.ts (indisponibilités des formateurs).
 *
 * L'enjeu numéro un : `dateFin` est INCLUSE. Le barème versionné du même domaine
 * (`effectiveTo`) l'exclut. Confondre les deux conventions ferait travailler un
 * formateur le dernier jour de ses congés — ou l'en empêcherait à tort.
 */

import { describe, it, expect } from "vitest";
import {
  capaciteResiduelle,
  dayKeyOfDateColumn,
  estIndisponibleLeJour,
  joursDeLIndispo,
  joursEnConflit,
  joursIndisponibles,
  MAX_JOURS_FENETRE,
  type Indisponibilite,
} from "./availability";

function indispo(over: Partial<Indisponibilite> = {}): Indisponibilite {
  return { trainerId: "t1", type: "conge", debut: "2026-06-03", fin: "2026-06-07", ...over };
}

describe("estIndisponibleLeJour — bornes INCLUSES", () => {
  it("INVARIANT : le premier ET le dernier jour sont indisponibles", () => {
    const i = indispo();
    expect(estIndisponibleLeJour(i, "2026-06-03")).toBe(true);
    expect(estIndisponibleLeJour(i, "2026-06-07")).toBe(true);
  });

  it("la veille et le lendemain sont disponibles", () => {
    const i = indispo();
    expect(estIndisponibleLeJour(i, "2026-06-02")).toBe(false);
    expect(estIndisponibleLeJour(i, "2026-06-08")).toBe(false);
  });

  it("une fenêtre d'un seul jour (« du 3 au 3 ») est exprimable", () => {
    const i = indispo({ debut: "2026-06-03", fin: "2026-06-03" });
    expect(estIndisponibleLeJour(i, "2026-06-03")).toBe(true);
    expect(estIndisponibleLeJour(i, "2026-06-04")).toBe(false);
  });

  it("la comparaison lexicographique gère le passage de mois et d'année", () => {
    const i = indispo({ debut: "2026-12-28", fin: "2027-01-04" });
    expect(estIndisponibleLeJour(i, "2026-12-31")).toBe(true);
    expect(estIndisponibleLeJour(i, "2027-01-01")).toBe(true);
    expect(estIndisponibleLeJour(i, "2027-01-05")).toBe(false);
  });
});

describe("joursDeLIndispo", () => {
  it("« du 3 au 7 » fait CINQ jours, pas quatre", () => {
    expect(joursDeLIndispo(indispo())).toEqual([
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
      "2026-06-06",
      "2026-06-07",
    ]);
  });

  it("un seul jour", () => {
    expect(joursDeLIndispo(indispo({ debut: "2026-06-03", fin: "2026-06-03" }))).toEqual([
      "2026-06-03",
    ]);
  });

  it("franchit le changement d'heure d'été sans perdre ni dupliquer un jour", () => {
    // 29 mars 2026 = passage à l'heure d'été en France.
    const jours = joursDeLIndispo(indispo({ debut: "2026-03-28", fin: "2026-03-30" }));
    expect(jours).toEqual(["2026-03-28", "2026-03-29", "2026-03-30"]);
  });

  it("une fenêtre inversée ne couvre aucun jour", () => {
    expect(joursDeLIndispo(indispo({ debut: "2026-06-07", fin: "2026-06-03" }))).toEqual([]);
  });

  it("une fenêtre aberrante est bornée (pas d'explosion mémoire)", () => {
    const jours = joursDeLIndispo(indispo({ debut: "2026-01-01", fin: "2100-01-01" }));
    expect(jours).toHaveLength(MAX_JOURS_FENETRE);
  });

  it("une date invalide rend une liste vide plutôt que de boucler", () => {
    expect(joursDeLIndispo(indispo({ debut: "pas-une-date" }))).toEqual([]);
  });
});

describe("joursIndisponibles", () => {
  it("fusionne des fenêtres qui se chevauchent sans doublon", () => {
    const jours = joursIndisponibles([
      indispo({ debut: "2026-06-03", fin: "2026-06-05" }),
      indispo({ debut: "2026-06-04", fin: "2026-06-06", type: "maladie" }),
    ]);
    expect([...jours].sort()).toEqual(["2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06"]);
  });

  it("le TYPE ne change pas le verdict : formation interne = indisponible", () => {
    const jours = joursIndisponibles([
      indispo({ type: "formation_interne", debut: "2026-06-03", fin: "2026-06-03" }),
    ]);
    expect(jours.has("2026-06-03")).toBe(true);
  });

  it("aucune fenêtre → aucun jour", () => {
    expect(joursIndisponibles([]).size).toBe(0);
  });
});

describe("capaciteResiduelle", () => {
  const OUVRES = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05"];

  it("retire les jours indisponibles des jours ouvrés", () => {
    const indispos = joursIndisponibles([indispo({ debut: "2026-06-03", fin: "2026-06-04" })]);
    expect(capaciteResiduelle(OUVRES, indispos)).toBe(3);
  });

  it("un week-end indisponible ne retire rien (il n'est pas ouvré)", () => {
    const indispos = joursIndisponibles([indispo({ debut: "2026-06-06", fin: "2026-06-07" })]);
    expect(capaciteResiduelle(OUVRES, indispos)).toBe(5);
  });

  it("indisponible tout le mois → capacité 0, jamais négative", () => {
    const indispos = joursIndisponibles([indispo({ debut: "2026-06-01", fin: "2026-06-30" })]);
    expect(capaciteResiduelle(OUVRES, indispos)).toBe(0);
  });

  it("aucune indisponibilité → capacité intacte", () => {
    expect(capaciteResiduelle(OUVRES, new Set())).toBe(5);
  });
});

describe("joursEnConflit", () => {
  it("détecte une formation vendue sur des congés", () => {
    const indispos = joursIndisponibles([indispo({ debut: "2026-06-03", fin: "2026-06-07" })]);
    const prestation = ["2026-06-05", "2026-06-06"];
    expect(joursEnConflit(prestation, indispos)).toEqual(["2026-06-05", "2026-06-06"]);
  });

  it("un chevauchement partiel ne rend que les jours réellement en conflit", () => {
    const indispos = joursIndisponibles([indispo({ debut: "2026-06-03", fin: "2026-06-04" })]);
    expect(joursEnConflit(["2026-06-04", "2026-06-05"], indispos)).toEqual(["2026-06-04"]);
  });

  it("aucun chevauchement → aucun conflit", () => {
    const indispos = joursIndisponibles([indispo({ debut: "2026-06-03", fin: "2026-06-04" })]);
    expect(joursEnConflit(["2026-06-10"], indispos)).toEqual([]);
  });
});

describe("dayKeyOfDateColumn", () => {
  it("une colonne DATE est stockée à minuit UTC → clé jour directe", () => {
    expect(dayKeyOfDateColumn(new Date("2026-06-03T00:00:00Z"))).toBe("2026-06-03");
  });

  it("zéro-padde le mois et le jour (l'ordre lexicographique en dépend)", () => {
    expect(dayKeyOfDateColumn(new Date("2026-01-05T00:00:00Z"))).toBe("2026-01-05");
  });
});
