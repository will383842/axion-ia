// Tests unitaires des helpers taxonomy /interventions — Sprint 14.10.7.
// Couvre : FAMILIES + COLLECTIVE_DURATIONS + INTERVENTION_FORMATS shape ;
// getFamily / getDuration / getFormatsByFamily / getFormatsByCell /
// countFormatsByFamily / countFormatsByCell / familyPath / durationPath /
// formatPath / quoteContactPath.
//
// L'idée n'est pas de tester chaque entrée du catalogue (ça change souvent),
// mais de garantir que les helpers gardent leur contrat (filtres, counts,
// URL builders) à mesure que la liste s'étoffe.

import { describe, expect, it } from "vitest";
import {
  FAMILIES,
  COLLECTIVE_DURATIONS,
  INTERVENTION_FORMATS,
  getFamily,
  getFamilyBySlug,
  getDuration,
  getDurationBySlug,
  getFormatsByFamily,
  getFormatsByCell,
  countFormatsByFamily,
  countFormatsByCell,
  familyPath,
  durationPath,
  formatPath,
  quoteContactPath,
  type Family,
  type CollectiveDuration,
} from "./interventions-taxonomy";

describe("interventions-taxonomy — shape", () => {
  it("FAMILIES expose exactement 4 familles", () => {
    expect(FAMILIES).toHaveLength(4);
    const ids = FAMILIES.map((f) => f.id);
    expect(ids).toEqual(
      expect.arrayContaining(["collectives", "individuel", "dirigeants", "conference"]),
    );
  });

  it("seule la famille Collectives a `hasDurations: true`", () => {
    const withDurations = FAMILIES.filter((f) => f.hasDurations);
    expect(withDurations).toHaveLength(1);
    expect(withDurations[0]?.id).toBe("collectives");
  });

  it("COLLECTIVE_DURATIONS expose exactement 4 paliers", () => {
    expect(COLLECTIVE_DURATIONS).toHaveLength(4);
    const ids = COLLECTIVE_DURATIONS.map((d) => d.id);
    expect(ids).toEqual(["4h", "1-jour", "2-jours", "3-jours-plus"]);
  });

  it("seul le palier 3-jours-plus est `isQuoteOnly`", () => {
    const quote = COLLECTIVE_DURATIONS.filter((d) => d.isQuoteOnly);
    expect(quote).toHaveLength(1);
    expect(quote[0]?.id).toBe("3-jours-plus");
  });

  it("tout format Collectives doit avoir un `duration`", () => {
    const collectives = INTERVENTION_FORMATS.filter((f) => f.family === "collectives");
    for (const fmt of collectives) {
      expect(fmt.duration).toBeDefined();
    }
  });

  it("aucun format non-Collectives n'a de `duration`", () => {
    const others = INTERVENTION_FORMATS.filter((f) => f.family !== "collectives");
    for (const fmt of others) {
      expect(fmt.duration).toBeUndefined();
    }
  });
});

describe("interventions-taxonomy — lookups", () => {
  it("getFamily retourne la famille demandée", () => {
    expect(getFamily("collectives").id).toBe("collectives");
    expect(getFamily("dirigeants").labelFr).toBe("Dirigeants");
  });

  it("getFamily throw si famille introuvable", () => {
    // @ts-expect-error — input invalide intentionnel
    expect(() => getFamily("inexistante")).toThrow();
  });

  it("getFamilyBySlug retourne undefined si slug inconnu", () => {
    expect(getFamilyBySlug("collectives")?.id).toBe("collectives");
    expect(getFamilyBySlug("zzz-unknown")).toBeUndefined();
  });

  it("getDuration retourne le palier demandé", () => {
    expect(getDuration("4h").id).toBe("4h");
    expect(getDuration("3-jours-plus").isQuoteOnly).toBe(true);
  });

  it("getDuration throw si palier introuvable", () => {
    // @ts-expect-error — input invalide intentionnel
    expect(() => getDuration("99h")).toThrow();
  });

  it("getDurationBySlug retourne undefined si slug inconnu", () => {
    expect(getDurationBySlug("4h")?.id).toBe("4h");
    expect(getDurationBySlug("zzz")).toBeUndefined();
  });
});

describe("interventions-taxonomy — filters & counts", () => {
  it("getFormatsByFamily filtre par famille", () => {
    const families: ReadonlyArray<Family> = [
      "collectives",
      "individuel",
      "dirigeants",
      "conference",
    ];
    for (const fam of families) {
      const formats = getFormatsByFamily(fam);
      for (const f of formats) {
        expect(f.family).toBe(fam);
      }
    }
  });

  it("getFormatsByCell filtre family + duration", () => {
    const formats = getFormatsByCell("collectives", "1-jour");
    for (const f of formats) {
      expect(f.family).toBe("collectives");
      expect(f.duration).toBe("1-jour");
    }
  });

  it("countFormatsByFamily est cohérent avec getFormatsByFamily", () => {
    const families: ReadonlyArray<Family> = [
      "collectives",
      "individuel",
      "dirigeants",
      "conference",
    ];
    for (const fam of families) {
      expect(countFormatsByFamily(fam)).toBe(getFormatsByFamily(fam).length);
    }
  });

  it("countFormatsByCell est cohérent avec getFormatsByCell", () => {
    const durations: ReadonlyArray<CollectiveDuration> = [
      "4h",
      "1-jour",
      "2-jours",
      "3-jours-plus",
    ];
    for (const d of durations) {
      expect(countFormatsByCell("collectives", d)).toBe(getFormatsByCell("collectives", d).length);
    }
  });

  it("la somme des counts par durée Collectives == count famille Collectives", () => {
    const total = countFormatsByFamily("collectives");
    const sum = COLLECTIVE_DURATIONS.reduce(
      (acc, d) => acc + countFormatsByCell("collectives", d.id),
      0,
    );
    expect(sum).toBe(total);
  });
});

describe("interventions-taxonomy — URL builders", () => {
  it("familyPath retourne pathFr en FR et pathEn en EN", () => {
    const collectives = getFamily("collectives");
    expect(familyPath(collectives, "fr")).toBe(collectives.pathFr);
    expect(familyPath(collectives, "en")).toBe(collectives.pathEn);
  });

  it("durationPath retourne pathFr en FR et pathEn en EN", () => {
    const fourH = getDuration("4h");
    expect(durationPath(fourH, "fr")).toBe(fourH.pathFr);
    expect(durationPath(fourH, "en")).toBe(fourH.pathEn);
  });

  it("formatPath retourne le bon chemin selon locale", () => {
    const first = INTERVENTION_FORMATS[0];
    if (!first) throw new Error("INTERVENTION_FORMATS empty in test");
    expect(formatPath(first, "fr")).toBe(first.pathFr);
    expect(formatPath(first, "en")).toBe(first.pathEn);
  });

  it("quoteContactPath pointe vers la page demande indexable", () => {
    const threeDaysPlus = getDuration("3-jours-plus");
    const fr = quoteContactPath(threeDaysPlus, "fr");
    const en = quoteContactPath(threeDaysPlus, "en");
    expect(fr).toContain("/interventions/demande");
    expect(en).toContain("/interventions/request");
    expect(fr).toContain("objet=");
  });

  it("quoteContactPath embarque le contactObject quand défini", () => {
    const threeDaysPlus = getDuration("3-jours-plus");
    expect(threeDaysPlus.contactObject).toBeDefined();
    const path = quoteContactPath(threeDaysPlus, "fr");
    expect(path).toContain(encodeURIComponent(threeDaysPlus.contactObject!));
  });
});
