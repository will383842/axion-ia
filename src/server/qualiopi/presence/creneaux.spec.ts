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

/**
 * Régression — durée totale confondue avec durée journalière.
 *
 * Avant correctif, `generateSessionCreneauxAction` passait `dureeReelleHeures`
 * (durée TOTALE de session) dans `heuresParJour`. Une session 2 j / 14 h générait
 * 4 créneaux de 420 min = 28 h prévues au lieu de 14 → taux de présence divisé
 * par 2 → attestations « partielles » ou refusées à tort.
 */
describe("genererCreneaux — répartition de la durée", () => {
  it("dureeTotaleHeures=14 sur 2 jours ⇒ 7 h/jour (et non 14)", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"), // mercredi
      dateFin: new Date("2026-06-11T18:00:00Z"), // jeudi
      dureeTotaleHeures: 14,
    });
    expect(result).toHaveLength(4);
    // 7 h/jour ⇒ 210 min/demi-journée. Si la durée totale était prise pour une
    // durée journalière, on lirait 420.
    expect(result[0]?.dureePrevueMinutes).toBe(210);
    const totalMinutes = result.reduce((s, c) => s + c.dureePrevueMinutes, 0);
    expect(totalMinutes).toBe(14 * 60);
  });

  it("heuresParJour explicite reste prioritaire sur dureeTotaleHeures", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-11T18:00:00Z"),
      heuresParJour: 4,
      dureeTotaleHeures: 14,
    });
    expect(result[0]?.dureePrevueMinutes).toBe(120);
  });

  it("durée totale non entière par jour → demi-journées cohérentes", () => {
    // 10 h sur 3 jours ouvrés = 3,333 h/jour ⇒ 100 min/demi-journée.
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"), // mercredi
      dateFin: new Date("2026-06-12T18:00:00Z"), // vendredi
      dureeTotaleHeures: 10,
    });
    expect(result).toHaveLength(6);
    expect(result[0]?.dureePrevueMinutes).toBe(100);
  });

  it("dureeTotaleHeures absente ou nulle → défaut 7 h/jour", () => {
    const sansDuree = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-10T18:00:00Z"),
    });
    expect(sansDuree[0]?.dureePrevueMinutes).toBe(210);

    const dureeZero = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-10T18:00:00Z"),
      dureeTotaleHeures: 0,
    });
    expect(dureeZero[0]?.dureePrevueMinutes).toBe(210);
  });
});

/**
 * Régression — exclusion des week-ends.
 *
 * Avant correctif, la boucle ne filtrait aucun jour alors que la doc du module
 * annonçait « chaque jour ouvré ». Une session vendredi→lundi produisait 8
 * créneaux dont 4 le week-end, jamais cochés → taux de présence ≈ 50 % →
 * attestation « partielle » à tort (seuils 80 % / 60 %, cf. taux.ts).
 *
 * Repères de calendrier utilisés ici :
 *   2026-06-12 = vendredi · 06-13 = samedi · 06-14 = dimanche · 06-15 = lundi
 */
describe("genererCreneaux — jours ouvrés", () => {
  it("vendredi → lundi = 2 jours ouvrés (4 créneaux), pas 4 jours", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-12T08:00:00Z"), // vendredi
      dateFin: new Date("2026-06-15T18:00:00Z"), // lundi
    });
    expect(result).toHaveLength(4);
    // Assertion de mutation : si le filtre saute, ces dates apparaissent.
    const dates = result.map((c) => c.date);
    expect(dates).not.toContain("2026-06-13"); // samedi
    expect(dates).not.toContain("2026-06-14"); // dimanche
    expect(new Set(dates)).toEqual(new Set(["2026-06-12", "2026-06-15"]));
  });

  it("lundi → vendredi = 5 jours, aucun week-end traversé", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-08T08:00:00Z"), // lundi
      dateFin: new Date("2026-06-12T18:00:00Z"), // vendredi
    });
    expect(result).toHaveLength(10);
  });

  it("lundi → dimanche : le dimanche est une BORNE, donc conservé", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-08T08:00:00Z"), // lundi
      dateFin: new Date("2026-06-14T18:00:00Z"), // dimanche (borne)
    });
    // lun→ven (5 j) + dimanche borne = 6 j. Le samedi, lui, est intérieur → filtré.
    const dates = [...new Set(result.map((c) => c.date))];
    expect(dates).toContain("2026-06-14"); // dimanche borne conservé
    expect(dates).not.toContain("2026-06-13"); // samedi intérieur filtré
    expect(result).toHaveLength(12);
  });

  it("BORNE samedi conservée : samedi → lundi garde le samedi", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-13T08:00:00Z"), // samedi (borne)
      dateFin: new Date("2026-06-15T18:00:00Z"), // lundi (borne)
    });
    // Un filtrage aveugle ne garderait que le lundi : le samedi, jour de début
    // explicitement saisi, deviendrait inémargeable (trou de preuve, ind. 12).
    // Le dimanche, lui, est intérieur → traité comme non travaillé.
    const dates = [...new Set(result.map((c) => c.date))];
    expect(dates).toEqual(["2026-06-13", "2026-06-15"]);
    expect(result).toHaveLength(4);
  });

  it("BORNES week-end conservées : samedi → mardi = 3 jours (dimanche intérieur filtré)", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-13T08:00:00Z"), // samedi (borne)
      dateFin: new Date("2026-06-16T18:00:00Z"), // mardi (borne)
    });
    // Dimanche intérieur → filtré ; samedi borne → conservé.
    const dates = [...new Set(result.map((c) => c.date))];
    expect(dates).toEqual(["2026-06-13", "2026-06-15", "2026-06-16"]);
  });

  it("session entièrement le week-end → créneaux conservés", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-13T08:00:00Z"), // samedi
      dateFin: new Date("2026-06-14T18:00:00Z"), // dimanche
    });
    expect(result).toHaveLength(4);
    expect(result.map((c) => c.date)).toContain("2026-06-13");
  });

  it("samedi seul → 2 créneaux", () => {
    const d = new Date("2026-06-13T09:00:00Z"); // samedi
    const result = genererCreneaux({ dateDebut: d, dateFin: d });
    expect(result).toHaveLength(2);
    expect(result[0]?.date).toBe("2026-06-13");
  });

  it("plafond : durée totale sur trop peu de jours ne produit pas de demi-journée absurde", () => {
    // 21 h sur samedi→lundi. Sans plafond, un filtrage agressif donnait
    // 21 h/jour → 630 min par demi-journée sur la feuille d'émargement.
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-13T08:00:00Z"), // samedi
      dateFin: new Date("2026-06-15T18:00:00Z"), // lundi
      dureeTotaleHeures: 21,
    });
    expect(result).toHaveLength(4); // samedi (borne) + lundi (borne)
    expect(result[0]?.dureePrevueMinutes).toBe(315); // 21 h / 2 j = 10,5 h/jour
    for (const c of result) {
      expect(c.dureePrevueMinutes).toBeLessThanOrEqual(12 * 30); // ≤ 12 h/jour
    }
  });

  it("plafond : 40 h sur une seule journée est borné à 12 h/jour", () => {
    const d = new Date("2026-06-10T09:00:00Z"); // mercredi
    const result = genererCreneaux({ dateDebut: d, dateFin: d, dureeTotaleHeures: 40 });
    expect(result[0]?.dureePrevueMinutes).toBe(360); // 12 h/jour ÷ 2
  });

  it("inclureWeekends: true → week-ends conservés", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-12T08:00:00Z"), // vendredi
      dateFin: new Date("2026-06-15T18:00:00Z"), // lundi
      inclureWeekends: true,
    });
    expect(result).toHaveLength(8);
    expect(result.map((c) => c.date)).toContain("2026-06-13"); // samedi
  });

  it("dureeTotaleHeures est répartie sur les jours OUVRÉS, pas calendaires", () => {
    // Vendredi → lundi, 14 h au total : 2 jours ouvrés ⇒ 7 h/jour ⇒ 210 min/demi-journée.
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-12T08:00:00Z"), // vendredi
      dateFin: new Date("2026-06-15T18:00:00Z"), // lundi
      dureeTotaleHeures: 14,
    });
    expect(result).toHaveLength(4);
    expect(result[0]?.dureePrevueMinutes).toBe(210);
    // Total prévu == durée réelle de la session. C'est l'invariant qui protège le taux.
    const totalMinutes = result.reduce((s, c) => s + c.dureePrevueMinutes, 0);
    expect(totalMinutes).toBe(14 * 60);
  });

  it("volumétrie : parcours étalé sur 3 mois reste borné aux jours ouvrés", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-01T08:00:00Z"),
      dateFin: new Date("2026-08-31T18:00:00Z"),
    });
    // 92 jours calendaires → 66 jours ouvrés → 132 créneaux (et non 184).
    expect(result).toHaveLength(132);
    const samedisOuDimanches = result.filter((c) => {
      const j = new Date(`${c.date}T00:00:00Z`).getUTCDay();
      return j === 0 || j === 6;
    });
    expect(samedisOuDimanches).toHaveLength(0);
  });
});
