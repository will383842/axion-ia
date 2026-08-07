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

  /**
   * 🔴 Deuxième défaut, trouvé le 2026-08-06 en relisant la timeline réelle des
   * 22 fiches après application des squelettes. La première correction ne
   * repositionnait que sur la PRÉSENCE d'un repère — or les squelettes révisés
   * nomment leurs sections « Matin · Module 1 », « Matin · Module 2 ». Chaque
   * module d'une même matinée redéclenchait la remise à 9 h 00 : sur
   * `ia-pour-les-rh`, les modules 1 et 2 s'affichaient tous deux de 9 h à 11 h,
   * intégralement superposés, sur la fiche publique.
   */
  it("« Matin · Module 2 » poursuit la matinée au lieu de la recommencer", () => {
    const sections = deriveProgrammeSchedule([
      { titreFr: "Matin · Module 1 — Cadrer", steps: [{ temps: "60'", titre: "A" }] },
      { titreFr: "Matin · Module 2 — Produire", steps: [{ temps: "45'", titre: "B" }] },
      { titreFr: "Après-midi · Module 3 — Ancrer", steps: [{ temps: "30'", titre: "C" }] },
      { titreFr: "Après-midi · Module 4 — Valider", steps: [{ temps: "30'", titre: "D" }] },
    ]);
    expect(sections[0]!.items[0]!.time).toBe("9 h 00");
    expect(sections[1]!.items[0]!.time).toBe("10 h 00");
    expect(sections[2]!.items[0]!.time).toBe("14 h 00");
    expect(sections[3]!.items[0]!.time).toBe("14 h 30");
  });

  it("« Matin J2 » repart à 9 h, « Matin J1 · Module 2 » non", () => {
    const sections = deriveProgrammeSchedule([
      { titreFr: "Matin J1 · Module 1", steps: [{ temps: "60'", titre: "A" }] },
      { titreFr: "Matin J1 · Module 2", steps: [{ temps: "60'", titre: "B" }] },
      { titreFr: "Matin J2 · Module 5", steps: [{ temps: "60'", titre: "C" }] },
    ]);
    expect(sections[1]!.items[0]!.time).toBe("10 h 00");
    expect(sections[2]!.items[0]!.time).toBe("9 h 00");
  });

  it("un titre de module nu n'efface pas le jour en cours", () => {
    // « Module 4 » n'annonce ni jour ni demi-journée : il poursuit. La section
    // « Après-midi » qui suit doit donc rester dans le JOUR 2, et non revenir
    // comparer son jour à une valeur absente.
    const sections = deriveProgrammeSchedule([
      { titreFr: "Matin J2 · Module 3", steps: [{ temps: "60'", titre: "A" }] },
      { titreFr: "Module 4", steps: [{ temps: "60'", titre: "B" }] },
      { titreFr: "Après-midi J2 · Module 5", steps: [{ temps: "60'", titre: "C" }] },
      { titreFr: "Après-midi J2 · Module 6", steps: [{ temps: "60'", titre: "D" }] },
    ]);
    expect(sections[1]!.items[0]!.time).toBe("10 h 00");
    expect(sections[2]!.items[0]!.time).toBe("14 h 00");
    expect(sections[3]!.items[0]!.time).toBe("15 h 00");
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

describe("la timeline publique des 22 fiches ne se superpose jamais", () => {
  /** Nombre de journées réellement vendues, par format. */
  const JOURS_PAR_FORMAT: Record<string, number> = { "4h": 1, "1j": 1, "2j": 2, "3j": 3 };

  /**
   * La garde qui aurait attrapé le défaut sans avoir à relire les 22 timelines à
   * l'œil. Une journée commence UNE fois : autant de démarrages à 9 h 00 que de
   * journées vendues, jamais plus. Deux modules d'une même matinée annoncés à
   * 9 h 00 signifient qu'ils se recouvrent à l'écran.
   */
  it("une journée ne démarre qu'une fois", () => {
    for (const f of FORMATIONS_V2) {
      const departs = deriveProgrammeSchedule(f.programme).filter(
        (s) => s.items[0]?.time === "9 h 00",
      ).length;
      expect(departs, `${f.id} (${f.duree})`).toBe(JOURS_PAR_FORMAT[f.duree]);
    }
  });

  /**
   * 🔴 `ia-pour-la-banque-assurance` nommait ses sections « Module 1 » … « Module
   * 4 », sans aucun repère de demi-journée : sa timeline s'affichait d'une
   * traite de 9 h 00 à 15 h 55, sans pause déjeuner. La garde du nombre de
   * démarrages ne pouvait pas le voir — il y avait bien UN seul départ à 9 h.
   * On vend une journée de formation, pas sept heures d'affilée.
   */
  it("aucune séquence n'est programmée pendant le déjeuner", () => {
    const DEJEUNER_DEBUT = 12 * 60 + 45;
    const DEJEUNER_FIN = 14 * 60;
    for (const f of FORMATIONS_V2) {
      if (f.duree === "4h") continue; // une demi-journée court jusqu'à 13 h
      for (const section of deriveProgrammeSchedule(f.programme)) {
        for (const item of section.items) {
          const m = /^(\d+) h (\d{2})$/.exec(item.time);
          if (!m) continue;
          const min = Number.parseInt(m[1]!, 10) * 60 + Number.parseInt(m[2]!, 10);
          expect(
            min >= DEJEUNER_DEBUT && min < DEJEUNER_FIN,
            `${f.id} programme « ${item.title.slice(0, 40)} » à ${item.time}`,
          ).toBe(false);
        }
      }
    }
  });

  it("aucune journée ne se termine après 18 h", () => {
    for (const f of FORMATIONS_V2) {
      const heures = deriveProgrammeSchedule(f.programme)
        .flatMap((s) => s.items.map((i) => /^(\d+) h (\d{2})$/.exec(i.time)))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => Number.parseInt(m[1]!, 10) * 60 + Number.parseInt(m[2]!, 10));
      expect(Math.max(...heures), f.id).toBeLessThanOrEqual(18 * 60);
    }
  });

  it("les heures d'une même demi-journée avancent toujours", () => {
    for (const f of FORMATIONS_V2) {
      const sections = deriveProgrammeSchedule(f.programme);
      let precedent = -1;
      for (const section of sections) {
        for (const item of section.items) {
          const m = /^(\d+) h (\d{2})$/.exec(item.time);
          if (!m) continue; // marqueur verbatim : ne participe pas à l'horloge
          const min = Number.parseInt(m[1]!, 10) * 60 + Number.parseInt(m[2]!, 10);
          // Un retour en arrière n'est licite qu'au démarrage d'une journée.
          const nouvelleJournee = item === section.items[0] && item.time === "9 h 00";
          if (!nouvelleJournee) {
            expect(min, `${f.id} — « ${item.title.slice(0, 40)} »`).toBeGreaterThan(precedent);
          }
          precedent = min;
        }
      }
    }
  });
});
