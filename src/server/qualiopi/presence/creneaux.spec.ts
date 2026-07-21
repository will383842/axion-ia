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
import { genererCreneaux, sessionTropEtaleePourLeRepli } from "./creneaux";

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

describe("genererCreneaux — journées DÉCLARÉES (D14)", () => {
  const JOUR = (date: string, heureDebut = "09:00", heureFin = "17:00") => ({
    date,
    heureDebut,
    heureFin,
  });

  it("⭐ le parcours étalé passe de 132 créneaux à 8 — le bug qui mettait le taux à 3 %", () => {
    // Même session que le test de volumétrie du repli : 4 journées réparties sur
    // 3 mois. Le repli en retenait 66 (tous les jours ouvrés traversés), d'où un
    // dénominateur ×16 et une attestation refusée à un stagiaire assidu.
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-01T08:00:00Z"),
      dateFin: new Date("2026-08-31T18:00:00Z"),
      jours: [JOUR("2026-06-02"), JOUR("2026-06-30"), JOUR("2026-07-28"), JOUR("2026-08-25")],
    });
    expect(result).toHaveLength(8);
    expect([...new Set(result.map((c) => c.date))]).toEqual([
      "2026-06-02",
      "2026-06-30",
      "2026-07-28",
      "2026-08-25",
    ]);
  });

  it("conserve un samedi DÉCLARÉ — le filtre jours ouvrés ne s'applique plus", () => {
    // 2026-06-13 est un samedi. Le repli l'aurait écarté ; déclaré, il est animé
    // par définition, et l'écarter rendrait sa présence impossible à prouver.
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-20T18:00:00Z"),
      jours: [JOUR("2026-06-13")],
    });
    expect(result).toHaveLength(2);
    expect(result[0]?.date).toBe("2026-06-13");
  });

  it("une matinée seule ne produit PAS de créneau d'après-midi", () => {
    // Sinon ce créneau, jamais signé, diviserait le taux par deux : le bug
    // qu'on corrige, simplement déplacé.
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-10T18:00:00Z"),
      jours: [JOUR("2026-06-10", "09:00", "12:30")],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.demiJournee).toBe("matin");
  });

  it("une après-midi seule ne produit PAS de créneau du matin", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-10T18:00:00Z"),
      jours: [JOUR("2026-06-10", "14:00", "17:30")],
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.demiJournee).toBe("apres_midi");
  });

  it("une journée à cheval sur midi produit les deux demi-journées", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-10T18:00:00Z"),
      jours: [JOUR("2026-06-10", "11:00", "15:00")],
    });
    expect(result.map((c) => c.demiJournee)).toEqual(["matin", "apres_midi"]);
  });

  it("porte les horaires RÉELS de la journée sur chaque créneau", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-10T18:00:00Z"),
      jours: [JOUR("2026-06-10", "08:30", "16:45")],
    });
    expect(result[0]?.jourHeureDebut).toBe("08:30");
    expect(result[0]?.jourHeureFin).toBe("16:45");
    expect(result[1]?.jourHeureDebut).toBe("08:30");
  });

  it("n'invente AUCUN horaire en repli — absent vaut mieux que faux", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-10T18:00:00Z"),
    });
    expect(result[0]?.jourHeureDebut).toBeUndefined();
    expect(result[0]?.jourHeureFin).toBeUndefined();
  });

  it("répartit la durée totale AU PRORATA des amplitudes déclarées", () => {
    // 3 journées 09:00–17:00 (480 min d'amplitude, 2 demi-journées → 240 chacune)
    // + 1 matinée 09:00–12:30 (210 min sur 1 demi-journée). Une répartition
    // uniforme donnerait 210 min à la matinée comme aux autres — soit la même
    // durée pour une amplitude deux fois moindre.
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-01T08:00:00Z"),
      dateFin: new Date("2026-06-04T18:00:00Z"),
      dureeTotaleHeures: 24.5,
      jours: [
        JOUR("2026-06-01"),
        JOUR("2026-06-02"),
        JOUR("2026-06-03"),
        JOUR("2026-06-04", "09:00", "12:30"),
      ],
    });
    expect(result).toHaveLength(7);
    const matinee = result.filter((c) => c.date === "2026-06-04");
    expect(matinee).toHaveLength(1);
    expect((matinee[0] as (typeof result)[number]).dureePrevueMinutes).toBeLessThan(210);
    // ⭐ L'invariant qui protège le taux : le total prévu vaut EXACTEMENT la
    // durée réelle de la session, malgré les arrondis à la minute.
    expect(result.reduce((s, c) => s + c.dureePrevueMinutes, 0)).toBe(24.5 * 60);
  });

  it("la durée prévue ne contredit pas l'horaire affiché à côté d'elle", () => {
    // Régression : avec une répartition uniforme, cette matinée de 3 h recevait
    // 6 h de durée prévue. La feuille d'émargement aurait affiché « 09:00–12:00 »
    // en face de « 6 h » — elle se serait contredite elle-même, sur une pièce à
    // valeur probante.
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-01T08:00:00Z"),
      dateFin: new Date("2026-06-02T18:00:00Z"),
      dureeTotaleHeures: 18,
      jours: [JOUR("2026-06-01", "07:00", "22:00"), JOUR("2026-06-02", "09:00", "12:00")],
    });
    const jour2 = result.filter((c) => c.date === "2026-06-02");
    const minutesJour2 = jour2.reduce((s, c) => s + c.dureePrevueMinutes, 0);
    // 3 h d'amplitude déclarée → la durée prévue ne peut pas la dépasser.
    expect(minutesJour2).toBeLessThanOrEqual(3 * 60);
    expect(result.reduce((s, c) => s + c.dureePrevueMinutes, 0)).toBe(18 * 60);
  });

  it("`heuresParJour` fixe le TOTAL, le prorata en fait la répartition", () => {
    // Avant : `heuresParJour` court-circuitait le prorata et posait 180 min
    // partout — donc la même durée pour une matinée de 6 h et une de 4 h.
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-01T08:00:00Z"),
      dateFin: new Date("2026-06-02T18:00:00Z"),
      heuresParJour: 6,
      jours: [JOUR("2026-06-01", "07:00", "22:00"), JOUR("2026-06-02")],
    });
    expect(result.reduce((s, c) => s + c.dureePrevueMinutes, 0)).toBe(6 * 60 * 2);
    // Les durées ne sont plus uniformes : elles suivent les amplitudes.
    expect(new Set(result.map((c) => c.dureePrevueMinutes)).size).toBeGreaterThan(1);
  });

  it("répartit au prorata MÊME sans durée totale — `dureeReelleHeures` est nullable", () => {
    // Sans ce chemin, deux matinées de 3 h recevaient 210 min chacune (défaut
    // 7 h), en face d'un horaire affiché de 3 h. La feuille se contredisait.
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-01T08:00:00Z"),
      dateFin: new Date("2026-06-02T18:00:00Z"),
      jours: [JOUR("2026-06-01", "09:00", "12:00"), JOUR("2026-06-02", "09:00", "12:00")],
    });
    expect(result).toHaveLength(2);
    for (const c of result) expect(c.dureePrevueMinutes).toBeLessThanOrEqual(180);
  });

  it("découpe l'amplitude AU PIVOT, jamais 50/50", () => {
    // 12:30–18:00 : la matinée dure 30 min, l'après-midi 5 h. Un partage égal
    // annonçait 2 h 45 pour cette matinée — un créneau structurellement
    // impossible à valider, le seuil de présence étant un % du prévu.
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-01T08:00:00Z"),
      dateFin: new Date("2026-06-01T18:00:00Z"),
      dureeTotaleHeures: 5.5,
      jours: [JOUR("2026-06-01", "12:30", "18:00")],
    });
    const matin = result.find((c) => c.demiJournee === "matin");
    expect(matin?.dureePrevueMinutes).toBeLessThanOrEqual(30);
  });

  it("PLAFONNE à l'amplitude déclarée — une saisie absurde ne produit pas 17 h 30", () => {
    // `dureeReelleHeures` = 35 sur une session d'un jour : le plafond du repli
    // (12 h/jour) ne s'appliquait plus au régime déclaré, et la feuille
    // affichait « 09:00–17:00 » en face de 17 h 30 par demi-journée.
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-01T08:00:00Z"),
      dateFin: new Date("2026-06-01T18:00:00Z"),
      dureeTotaleHeures: 35,
      jours: [JOUR("2026-06-01", "09:00", "17:00")],
    });
    const matin = result.find((c) => c.demiJournee === "matin");
    expect(matin?.dureePrevueMinutes).toBeLessThanOrEqual(240);
  });

  it("ne produit JAMAIS une durée nulle ou négative", () => {
    // L'ancien versement du résidu sur la dernière entrée pouvait la ramener à
    // 0 : un créneau à 0 min ne peut jamais être validé, et une durée négative
    // diminuerait le dénominateur.
    const jours = Array.from({ length: 20 }, (_, i) =>
      JOUR(`2026-06-${String(i + 1).padStart(2, "0")}`),
    );
    jours.push(JOUR("2026-06-22", "09:00", "09:01"));
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-01T08:00:00Z"),
      dateFin: new Date("2026-06-22T18:00:00Z"),
      dureeTotaleHeures: 140,
      jours,
    });
    for (const c of result) expect(c.dureePrevueMinutes).toBeGreaterThan(0);
  });

  it("trie les journées et LÈVE sur une date répétée", () => {
    // Écraser le doublon en silence contredirait la doctrine du module et
    // avalerait une journée sans que personne ne le voie.
    expect(() =>
      genererCreneaux({
        dateDebut: new Date("2026-06-01T08:00:00Z"),
        dateFin: new Date("2026-06-30T18:00:00Z"),
        jours: [JOUR("2026-06-15"), JOUR("2026-06-02"), JOUR("2026-06-15")],
      }),
    ).toThrow(/deux fois/);
  });

  it("trie les journées saisies dans le désordre", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-01T08:00:00Z"),
      dateFin: new Date("2026-06-30T18:00:00Z"),
      jours: [JOUR("2026-06-15"), JOUR("2026-06-02")],
    });
    expect([...new Set(result.map((c) => c.date))]).toEqual(["2026-06-02", "2026-06-15"]);
    expect(result).toHaveLength(4);
  });

  it("un tableau de journées VIDE retombe sur le repli, sans lever", () => {
    const result = genererCreneaux({
      dateDebut: new Date("2026-06-10T08:00:00Z"),
      dateFin: new Date("2026-06-10T18:00:00Z"),
      jours: [],
    });
    expect(result).toHaveLength(2);
  });

  it.each([
    ["date invalide", { date: "10/06/2026", heureDebut: "09:00", heureFin: "17:00" }],
    ["heure sans zéro", { date: "2026-06-10", heureDebut: "9:00", heureFin: "17:00" }],
    ["fin avant début", { date: "2026-06-10", heureDebut: "17:00", heureFin: "09:00" }],
    ["fin égale au début", { date: "2026-06-10", heureDebut: "09:00", heureFin: "09:00" }],
  ])("LÈVE sur une journée malformée (%s) plutôt que de l'écarter en silence", (_, jour) => {
    // Une journée silencieusement ignorée fausserait le dénominateur sans que
    // personne ne le voie — exactement la classe de bug qu'on corrige.
    expect(() =>
      genererCreneaux({
        dateDebut: new Date("2026-06-10T08:00:00Z"),
        dateFin: new Date("2026-06-10T18:00:00Z"),
        jours: [jour],
      }),
    ).toThrow();
  });
});

describe("sessionTropEtaleePourLeRepli", () => {
  it("alerte sur un parcours étalé qui n'a déclaré aucune journée", () => {
    expect(
      sessionTropEtaleePourLeRepli({
        dateDebut: new Date("2026-06-01T08:00:00Z"),
        dateFin: new Date("2026-08-31T18:00:00Z"),
      }),
    ).toBe(true);
  });

  it("n'alerte pas dès lors que les journées sont déclarées", () => {
    expect(
      sessionTropEtaleePourLeRepli({
        dateDebut: new Date("2026-06-01T08:00:00Z"),
        dateFin: new Date("2026-08-31T18:00:00Z"),
        jours: [{ date: "2026-06-02", heureDebut: "09:00", heureFin: "17:00" }],
      }),
    ).toBe(false);
  });

  it("n'alerte pas sur une session courte et contiguë", () => {
    expect(
      sessionTropEtaleePourLeRepli({
        dateDebut: new Date("2026-06-01T08:00:00Z"),
        dateFin: new Date("2026-06-05T18:00:00Z"),
      }),
    ).toBe(false);
  });

  it("borne exacte : 31 jours passe, 32 alerte", () => {
    const debut = new Date("2026-06-01T08:00:00Z");
    expect(
      sessionTropEtaleePourLeRepli({ dateDebut: debut, dateFin: new Date("2026-07-02T18:00:00Z") }),
    ).toBe(false);
    expect(
      sessionTropEtaleePourLeRepli({ dateDebut: debut, dateFin: new Date("2026-07-03T18:00:00Z") }),
    ).toBe(true);
  });
});
