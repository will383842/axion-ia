/**
 * Dérivation horaire du déroulé — durées catalogue → heures d'horloge.
 * Garantit la non-régression de la timeline publique (« 9 h 00 » → « 17 h »)
 * sur les programmes réels hétérogènes (4 h, 1 j Matin/Après-midi, 2-3 j).
 */

import { describe, it, expect } from "vitest";

import { FORMATIONS_V2 } from "./catalog-v2";
import { deriveProgrammeSchedule } from "./catalog-v2-schedule";

describe("deriveProgrammeSchedule — conversion durées → heures", () => {
  it("démi-journée 4 h : démarre à 9 h 00 et cumule les durées", () => {
    const sched = deriveProgrammeSchedule([
      {
        titreFr: "Demi-journée",
        steps: [
          { temps: "15'", titre: "Accueil" },
          { temps: "25'", titre: "Première production" },
          { temps: "Pause", titre: "Pause" },
          { temps: "30'", titre: "Atelier" },
        ],
      },
    ]);
    expect(sched[0]?.items.map((i) => i.time)).toEqual([
      "9 h 00", // 09:00
      "9 h 15", // +15
      "9 h 40", // +25
      "9 h 55", // +Pause 15
    ]);
  });

  it("section « Après-midi » démarre à 14 h 00", () => {
    const sched = deriveProgrammeSchedule([
      {
        titreFr: "Après-midi — conquérir",
        steps: [
          { temps: "30'", titre: "Réactivation" },
          { temps: "45'", titre: "Atelier" },
        ],
      },
    ]);
    expect(sched[0]?.items.map((i) => i.time)).toEqual(["14 h 00", "14 h 30"]);
  });

  it("marqueurs non numériques (« Jour 1 », « Fin J1 ») conservés verbatim", () => {
    const sched = deriveProgrammeSchedule([
      {
        titreFr: "Jour 1 — la maîtrise",
        steps: [
          { temps: "Jour 1", titre: "Programme complet" },
          { temps: "Fin J1", titre: "Préparation J2" },
        ],
      },
    ]);
    expect(sched[0]?.items.map((i) => i.time)).toEqual(["Jour 1", "Fin J1"]);
  });

  it("une formation 1 jour atteint l'après-midi (≈ 17 h)", () => {
    const oneDay = FORMATIONS_V2.find((f) => f.duree === "1j");
    expect(oneDay).toBeDefined();
    const sched = deriveProgrammeSchedule(oneDay!.programme);
    const afternoon = sched.find((s) => s.label.toLowerCase().startsWith("après-midi"));
    expect(afternoon?.items[0]?.time).toBe("14 h 00");
    // La dernière entrée d'après-midi tombe l'après-midi (h ≥ 14, jamais une durée).
    const last = afternoon?.items.at(-1)?.time ?? "";
    expect(last).toMatch(/^1[4-9] h \d{2}$/);
  });

  it("aucune formation du catalogue ne laisse fuiter une durée brute (« 15' ») dans la timeline", () => {
    for (const f of FORMATIONS_V2) {
      for (const section of deriveProgrammeSchedule(f.programme)) {
        for (const item of section.items) {
          // Tolère les heures (« 9 h 00 ») et les marqueurs (« Jour 1 »),
          // mais jamais une durée numérique apostrophée.
          expect(item.time, `${f.id} / ${item.title}`).not.toMatch(/^\d+\s*'$/);
        }
      }
    }
  });
});
