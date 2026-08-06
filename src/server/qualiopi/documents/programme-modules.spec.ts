/**
 * Tests — lecture du programme détaillé pour l'annexe pédagogique.
 *
 * L'enjeu : `programmeDetaille` porte TROIS formes en production. Se tromper de
 * forme produit une annexe vide sur une convention qui la déclare.
 */

import { describe, it, expect } from "vitest";

import { formaterDuree, lireModulesProgramme, totalDureeModulesMin } from "./programme-modules";

describe("lireModulesProgramme — les trois formes de production", () => {
  it("forme 1 : chaîne JSON sérialisée", () => {
    const brut = JSON.stringify([{ titre: "Découvrir l'IA", dureeMin: 60, sequences: [] }]);
    const modules = lireModulesProgramme(brut);
    expect(modules).toHaveLength(1);
    expect(modules[0]?.titre).toBe("Découvrir l'IA");
  });

  it("forme 2 : tableau de modules (catalogue)", () => {
    const modules = lireModulesProgramme([
      { moduleId: "m1", titre: "Cadrer un cas d'usage", dureeMin: 90, sequences: [] },
    ]);
    expect(modules[0]?.dureeMin).toBe(90);
  });

  it("forme 3 : objet { modules } (moteur de contenu)", () => {
    const modules = lireModulesProgramme({
      persona: "TPE",
      modules: [{ titre: "Prompt engineering", dureeMin: 120, sequences: [] }],
    });
    expect(modules).toHaveLength(1);
  });

  // Le contenu enrichi est plus fidèle à ce qui sera animé : quand les deux
  // coexistent, c'est lui qui doit sortir.
  it("privilégie contenuDetaille.modules sur modules quand les deux existent", () => {
    const modules = lireModulesProgramme({
      modules: [{ titre: "Squelette", sequences: [] }],
      contenuDetaille: {
        version: 1,
        modules: [{ titre: "Module rédigé", sequences: [{ titre: "Séquence 1", dureeMin: 30 }] }],
      },
    });
    expect(modules).toHaveLength(1);
    expect(modules[0]?.titre).toBe("Module rédigé");
    expect(modules[0]?.sequences[0]?.titre).toBe("Séquence 1");
  });

  it("retombe sur modules si contenuDetaille.modules est vide", () => {
    const modules = lireModulesProgramme({
      modules: [{ titre: "Squelette", sequences: [] }],
      contenuDetaille: { version: 1, modules: [] },
    });
    expect(modules[0]?.titre).toBe("Squelette");
  });
});

describe("lireModulesProgramme — robustesse", () => {
  // 🔴 Ne lève JAMAIS : une annexe vide et signalée vaut mieux qu'une génération
  // qui échoue au moment où l'admin veut remettre la convention au client.
  it("ne lève sur aucune entrée aberrante", () => {
    for (const brut of [null, undefined, 42, "pas du json", "{", {}, [], [null, 3, "x"]]) {
      expect(() => lireModulesProgramme(brut)).not.toThrow();
      expect(Array.isArray(lireModulesProgramme(brut))).toBe(true);
    }
  });

  it("écarte un module sans titre plutôt que d'imprimer « sans titre »", () => {
    const modules = lireModulesProgramme([
      { titre: "  ", sequences: [] },
      { dureeMin: 30 },
      { titre: "Vrai module", sequences: [] },
    ]);
    expect(modules).toHaveLength(1);
    expect(modules[0]?.titre).toBe("Vrai module");
  });

  // « 0 min » en face d'un module se lirait comme « ce module ne dure pas ».
  // La seule chose établie est qu'on ne sait pas.
  it("refuse les durées nulles, négatives ou non entières", () => {
    const modules = lireModulesProgramme([
      { titre: "A", dureeMin: 0 },
      { titre: "B", dureeMin: -30 },
      { titre: "C", dureeMin: 12.5 },
      { titre: "D", dureeMin: "60" },
    ]);
    expect(modules.map((m) => m.dureeMin)).toEqual([null, null, null, null]);
  });

  it("écarte les séquences sans titre mais garde le module", () => {
    const modules = lireModulesProgramme([
      { titre: "Module", sequences: [{ dureeMin: 10 }, { titre: "Séquence valide" }] },
    ]);
    expect(modules[0]?.sequences).toHaveLength(1);
  });
});

describe("lireModulesProgramme — nature des séquences", () => {
  /**
   * 🔴 Le lecteur écartait `type`. La console devait donc relire le JSON brut en
   * parallèle pour savoir ce qui compte comme de la pratique : deux lectures
   * d'une même donnée, et à terme deux verdicts sur le même programme.
   */
  it("transporte la nature de chaque séquence", () => {
    const modules = lireModulesProgramme([
      {
        titre: "Module 1",
        sequences: [
          { titre: "Démo", dureeMin: 15, type: "demonstration" },
          { titre: "Atelier", dureeMin: 35, type: "pratique" },
        ],
      },
    ]);
    expect(modules[0]?.sequences.map((s) => s.type)).toEqual(["demonstration", "pratique"]);
  });

  it("rend null plutôt qu'une chaîne vide quand la nature manque", () => {
    const modules = lireModulesProgramme([
      { titre: "Module", sequences: [{ titre: "A" }, { titre: "B", type: "  " }] },
    ]);
    expect(modules[0]?.sequences.map((s) => s.type)).toEqual([null, null]);
  });
});

describe("totalDureeModulesMin", () => {
  it("somme les durées de modules", () => {
    expect(
      totalDureeModulesMin([
        { titre: "A", dureeMin: 60, sequences: [] },
        { titre: "B", dureeMin: 30, sequences: [] },
      ]),
    ).toBe(90);
  });

  it("retombe sur les séquences quand le module n'a pas de durée", () => {
    expect(
      totalDureeModulesMin([
        {
          titre: "A",
          dureeMin: null,
          sequences: [
            { titre: "s1", dureeMin: 20, type: null },
            { titre: "s2", dureeMin: 25, type: null },
          ],
        },
      ]),
    ).toBe(45);
  });

  it("null quand aucune durée n'est exploitable — jamais 0", () => {
    expect(totalDureeModulesMin([{ titre: "A", dureeMin: null, sequences: [] }])).toBeNull();
    expect(totalDureeModulesMin([])).toBeNull();
  });
});

describe("formaterDuree", () => {
  it("formate en heures et minutes", () => {
    expect(formaterDuree(45)).toBe("45 min");
    expect(formaterDuree(60)).toBe("1 h");
    expect(formaterDuree(90)).toBe("1 h 30");
    expect(formaterDuree(120)).toBe("2 h");
    expect(formaterDuree(125)).toBe("2 h 05");
  });

  it("null pour une durée absente ou nulle", () => {
    expect(formaterDuree(null)).toBeNull();
    expect(formaterDuree(0)).toBeNull();
  });
});
