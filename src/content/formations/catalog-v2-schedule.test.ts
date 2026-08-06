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

  it("la dérivation gère les programmes par module (offre AXION) sans erreur", () => {
    // Les programmes AXION sont structurés par MODULE (pas de minutage horaire
    // dans les documents sources) : la dérivation doit rester robuste — une
    // section par section source, items préservés, aucune exception.
    const oneDay = FORMATIONS_V2.find((f) => f.duree === "1j");
    expect(oneDay).toBeDefined();
    const sched = deriveProgrammeSchedule(oneDay!.programme);
    expect(sched.length).toBe(oneDay!.programme.length);
    for (const [i, section] of sched.entries()) {
      expect(section.items.length).toBe(oneDay!.programme[i]!.steps.length);
    }
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

describe("l'horloge traverse les sections", () => {
  /**
   * 🔴 Le défaut corrigé le 2026-08-06 : `clock` était réinitialisé au début de
   * CHAQUE section. Invisible tant que les programmes se découpaient en
   * « Matin » / « Après-midi » ; dès qu'ils sont découpés en modules — ce que le
   * minutage des 22 fiches impose — les six modules d'une journée s'affichaient
   * tous comme démarrant à 9 h 00.
   */
  it("un module enchaîne sur le précédent au lieu de repartir à 9 h", () => {
    const sections = deriveProgrammeSchedule([
      { titreFr: "Module 1 — Cadrer", steps: [{ temps: "60'", titre: "A" }] },
      { titreFr: "Module 2 — Produire", steps: [{ temps: "45'", titre: "B" }] },
      { titreFr: "Module 3 — Ancrer", steps: [{ temps: "30'", titre: "C" }] },
    ]);
    expect(sections[0]!.items[0]!.time).toBe("9 h 00");
    expect(sections[1]!.items[0]!.time).toBe("10 h 00");
    expect(sections[2]!.items[0]!.time).toBe("10 h 45");
  });

  it("« Après-midi » repositionne bien l'horloge à 14 h", () => {
    const sections = deriveProgrammeSchedule([
      { titreFr: "Matin — Découvrir", steps: [{ temps: "60'", titre: "A" }] },
      { titreFr: "Après-midi — Pratiquer", steps: [{ temps: "60'", titre: "B" }] },
    ]);
    expect(sections[0]!.items[0]!.time).toBe("9 h 00");
    expect(sections[1]!.items[0]!.time).toBe("14 h 00");
  });

  it("un nouveau « Jour » repart à 9 h", () => {
    const sections = deriveProgrammeSchedule([
      { titreFr: "Jour 1 — Bases", steps: [{ temps: "180'", titre: "A" }] },
      { titreFr: "Jour 2 — Construire", steps: [{ temps: "60'", titre: "B" }] },
    ]);
    expect(sections[1]!.items[0]!.time).toBe("9 h 00");
  });

  it("une pause fait avancer l'horloge du module suivant", () => {
    const sections = deriveProgrammeSchedule([
      {
        titreFr: "Module 1",
        steps: [
          { temps: "60'", titre: "A" },
          { temps: "15'", titre: "Pause" },
        ],
      },
      { titreFr: "Module 2", steps: [{ temps: "30'", titre: "B" }] },
    ]);
    expect(sections[1]!.items[0]!.time).toBe("10 h 15");
  });
});
