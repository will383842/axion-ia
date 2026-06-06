/**
 * Tests — creneaux.ts
 *
 * Vérifie :
 *   - Session 1 jour → 2 créneaux (matin + après-midi)
 *   - Session 2 jours → 4 créneaux
 *   - Session 3 jours → 6 créneaux
 *   - heuresParJour custom (4h → 120 min/créneau)
 *   - dateDebut > dateFin → 0 créneaux
 *   - Libellés lisibles corrects
 *   - Durées par défaut (7h → 210 min/créneau)
 */

import { describe, it, expect } from "vitest";
import { genererCreneaux } from "./creneaux";

describe("genererCreneaux", () => {
  it("1 jour → 2 créneaux (matin + après-midi)", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-10T18:00:00Z"),
    });
    expect(result).toHaveLength(2);
    expect(result[0]?.demiJournee).toBe("matin");
    expect(result[1]?.demiJournee).toBe("apres_midi");
  });

  it("1 jour → dates ISO correctes (fuseau Paris, CEST)", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T06:00:00Z"),
      dateFin: new Date("2026-06-10T18:00:00Z"),
    });
    expect(result[0]?.date).toBe("2026-06-10");
    expect(result[1]?.date).toBe("2026-06-10");
  });

  it("2 jours → 4 créneaux", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-11T18:00:00Z"),
    });
    expect(result).toHaveLength(4);
    expect(result[0]?.date).toBe("2026-06-10");
    expect(result[2]?.date).toBe("2026-06-11");
  });

  it("3 jours → 6 créneaux", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-12T18:00:00Z"),
    });
    expect(result).toHaveLength(6);
  });

  it("durée par défaut 7h → 210 min/créneau", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-10T18:00:00Z"),
    });
    expect(result[0]?.dureePrevueMinutes).toBe(210);
    expect(result[1]?.dureePrevueMinutes).toBe(210);
  });

  it("heuresParJour=4 → 120 min/créneau", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-10T18:00:00Z"),
      heuresParJour: 4,
    });
    expect(result[0]?.dureePrevueMinutes).toBe(120);
    expect(result[1]?.dureePrevueMinutes).toBe(120);
  });

  it("libellé matin correct", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-10T18:00:00Z"),
    });
    expect(result[0]?.libelle).toBe("2026-06-10 matin");
  });

  it("libellé après-midi correct", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-10T18:00:00Z"),
    });
    expect(result[1]?.libelle).toBe("2026-06-10 après-midi");
  });

  it("dateDebut > dateFin → 0 créneaux", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-12T08:00:00Z"),
      dateFin: new Date("2026-06-10T18:00:00Z"),
    });
    expect(result).toHaveLength(0);
  });

  it("dateDebut === dateFin → 1 seul jour (2 créneaux)", () => {
    const d = new Date("2026-06-15T09:00:00Z");
    const result = genererCreneaux({ dateDebut: d, dateFin: d });
    expect(result).toHaveLength(2);
    expect(result[0]?.date).toBe("2026-06-15");
  });

  it("alternance matin/apres_midi sur 3 jours", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-12T18:00:00Z"),
    });
    const djSeq = result.map((c) => c.demiJournee);
    expect(djSeq).toEqual(["matin", "apres_midi", "matin", "apres_midi", "matin", "apres_midi"]);
  });
});
