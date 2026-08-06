/**
 * Tests — ratio de pratique déclaré.
 *
 * Le défaut d'origine : `RATIO_PRATIQUE_PCT = 70` écrit en dur pour les 22
 * formations, poussé dans le programme officiel, jamais vérifié — alors que les
 * minutages réels donnent 41 à 62 %.
 */

import { describe, it, expect } from "vitest";
import {
  calculerRatioPratique,
  ratioPratiqueDeclarable,
  SEUIL_PRATIQUE_PAR_FORMAT,
  MINUTES_DUES_PAR_FORMAT,
} from "./ratio-pratique";

/** Module minuté : 5 + 20 + 55 + 5 + 5 = 90 min, dont 60 de pratique. */
const MODULE = {
  moduleId: "mod-1",
  titre: "Module 1",
  dureeMin: 90,
  objectif: { dureeMin: 5 },
  demonstration: { dureeMin: 20 },
  pratique: { dureeMin: 55 },
  verification: { dureeMin: 5 },
  synthese: { dureeMin: 5 },
};

/** Module tel qu'il existe en production : aucune durée. */
const MODULE_PROD = {
  moduleId: "mod-1",
  titre: "Module 1 — L'IA appliquée à la fonction RH",
  sequences: [{ id: "s1", titre: "Panorama des usages" }],
};

describe("calculerRatioPratique", () => {
  it("compte la pratique ET la vérification, pas la démonstration", () => {
    const r = calculerRatioPratique([MODULE], "4h");
    // 55 (pratique) + 5 (vérification) = 60 min ; l'objectif, la démo et la
    // synthèse sont du temps descendant.
    expect(r.minutesPratique).toBe(60);
    expect(r.minutesProgrammees).toBe(90);
  });

  /**
   * 🔴 La convention qui a fait diverger les contrôleurs de 5 à 10 points.
   * Le dénominateur est le temps VENDU : sinon écrire moins ferait monter le
   * ratio, et un programme à moitié vide afficherait le meilleur score.
   */
  it("rapporte la pratique au temps VENDU, jamais au temps écrit", () => {
    const r = calculerRatioPratique([MODULE], "1j");
    // 60 min de pratique sur 420 dues = 14 %, et non 60/90 = 67 %.
    expect(r.minutesDues).toBe(420);
    expect(r.pct).toBe(14);
    expect(r.minutesNonProgrammees).toBe(330);
  });

  it("écrire moins ne fait PAS monter le ratio", () => {
    const complet = calculerRatioPratique([MODULE, MODULE, MODULE], "4h");
    const ampute = calculerRatioPratique([MODULE], "4h");
    expect(complet.pct).toBeGreaterThan(ampute.pct!);
  });

  it("signale les minutes vendues mais non programmées", () => {
    const r = calculerRatioPratique([MODULE, MODULE], "1j");
    expect(r.minutesProgrammees).toBe(180);
    expect(r.minutesNonProgrammees).toBe(240);
  });
});

describe("seuils par format", () => {
  /** Exigence maison — Qualiopi n'impose aucun pourcentage. */
  it("le seuil s'assouplit sur les formats courts, qui doivent poser le cadre", () => {
    expect(SEUIL_PRATIQUE_PAR_FORMAT["4h"]).toBe(40);
    expect(SEUIL_PRATIQUE_PAR_FORMAT["1j"]).toBe(50);
    expect(SEUIL_PRATIQUE_PAR_FORMAT["2j"]).toBe(60);
  });

  it("le face-à-face dû exclut le déjeuner", () => {
    expect(MINUTES_DUES_PAR_FORMAT["4h"]).toBe(240);
    expect(MINUTES_DUES_PAR_FORMAT["1j"]).toBe(420);
    expect(MINUTES_DUES_PAR_FORMAT["2j"]).toBe(840);
  });

  it("atteintSeuil compare au seuil du format, pas à un seuil unique", () => {
    // 4 modules de 90 min = 360 programmées, 240 de pratique sur 420 dues = 57 %.
    const quatre = [MODULE, MODULE, MODULE, MODULE];
    const jour = calculerRatioPratique(quatre, "1j");
    expect(jour.pct).toBe(57);
    expect(jour.atteintSeuil).toBe(true); // seuil 1j = 50 %
    const deuxJours = calculerRatioPratique(quatre, "2j");
    expect(deuxJours.atteintSeuil).toBe(false); // seuil 2j = 60 %, et 240/840 = 29 %
  });
});

describe("ratioPratiqueDeclarable — ce qui part dans le programme officiel", () => {
  /**
   * 🔴 LE correctif. Un programme sans durées ne doit produire AUCUN chiffre :
   * une case vide se corrige, un chiffre faux se défend devant un auditeur.
   */
  it("rend null quand le programme ne porte pas de durées", () => {
    expect(ratioPratiqueDeclarable([MODULE_PROD], "1j")).toBeNull();
    expect(ratioPratiqueDeclarable([], "1j")).toBeNull();
  });

  it("ne rend JAMAIS 70 par défaut", () => {
    for (const modules of [[], [MODULE_PROD], [null], [{}], ["texte"]]) {
      expect(ratioPratiqueDeclarable(modules as unknown[], "1j")).not.toBe(70);
    }
  });

  it("rend le chiffre réel quand le programme est minuté", () => {
    expect(ratioPratiqueDeclarable([MODULE], "4h")).toBe(25); // 60/240
  });

  it("ne lève jamais, quelle que soit l'entrée", () => {
    for (const e of [null, undefined, 42, "x", {}, [null], [{ pratique: "oui" }]]) {
      expect(() => ratioPratiqueDeclarable(e as unknown[], "4h")).not.toThrow();
    }
  });

  it("ignore les durées aberrantes plutôt que de les compter", () => {
    const bancal = { pratique: { dureeMin: -30 }, verification: { dureeMin: "20" } };
    expect(ratioPratiqueDeclarable([bancal], "4h")).toBeNull();
  });
});

describe("un module enrichi ne compte pas ses minutes deux fois", () => {
  /**
   * 🔴 Le piège attendait le premier module réellement rédigé. Un module enrichi
   * porte ses cinq blocs de contenu ET ses séquences, chacun avec sa durée : les
   * additionner aurait fait DOUBLER le ratio d'une formation au moment même où
   * on finissait de l'écrire. Et le chiffre part dans le programme opposable.
   *
   * Les séquences font foi : ce sont elles qui sont publiées sur la fiche, elles
   * qui somment au temps vendu, elles que l'auditeur lit.
   */
  it("retient les séquences, pas les blocs, quand le module porte les deux", () => {
    const moduleEnrichi = {
      moduleId: "mod-1",
      titre: "Module rédigé",
      // Les cinq blocs, avec leurs durées de contenu.
      objectif: { dureeMin: 10 },
      demonstration: { dureeMin: 20 },
      pratique: { dureeMin: 150 },
      verification: { dureeMin: 60 },
      synthese: { dureeMin: 10 },
      // Et le découpage publié, qui dit la même journée autrement.
      sequences: [
        { titre: "Objectif", dureeMin: 10, type: "objectif" },
        { titre: "Démonstration", dureeMin: 20, type: "demonstration" },
        { titre: "Atelier", dureeMin: 150, type: "pratique" },
        { titre: "Contrôle croisé", dureeMin: 60, type: "verification" },
        { titre: "Synthèse", dureeMin: 10, type: "synthese" },
      ],
    };

    const r = calculerRatioPratique([moduleEnrichi], "4h");
    expect(r.minutesProgrammees).toBe(250); // et non 500
    expect(r.minutesPratique).toBe(210); // atelier + contrôle, comptés une fois
  });

  it("retombe sur les blocs quand le module n'est pas séquencé", () => {
    const r = calculerRatioPratique(
      [{ moduleId: "mod-1", pratique: { dureeMin: 90 }, objectif: { dureeMin: 30 } }],
      "4h",
    );
    expect(r.minutesProgrammees).toBe(120);
    expect(r.minutesPratique).toBe(90);
  });

  it("retombe aussi sur les blocs quand les séquences n'ont pas de durée", () => {
    const r = calculerRatioPratique(
      [
        {
          moduleId: "mod-1",
          pratique: { dureeMin: 90 },
          sequences: [{ titre: "Atelier", type: "pratique" }],
        },
      ],
      "4h",
    );
    expect(r.minutesPratique).toBe(90);
  });
});
