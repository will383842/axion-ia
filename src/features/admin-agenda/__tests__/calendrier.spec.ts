// Arithmétique de calendrier de l'Agenda — mois, semaines, navigation.
//
// CE QUE CES TESTS PROTÈGENT
// ---------------------------
// Un agenda se casse toujours au même endroit : les bords. Le lundi qui précède
// le 1er du mois, le 31 janvier auquel on ajoute un mois, la semaine à cheval
// sur décembre, et les deux jours de l'année qui ne durent pas 24 heures.
//
// Ce n'est pas une précaution théorique : la version précédente de cette page
// est tombée EN PRODUCTION sur un calcul de date qu'aucun test n'exerçait
// (cf. `bornes-du-jour-paris.spec.ts`). Tout ce fichier est du calcul pur, donc
// il n'y a aucune excuse à ne pas le couvrir.

import { describe, it, expect } from "vitest";
import {
  decalerJours,
  decalerMois,
  lundiDeLaSemaine,
  semaineDe,
  grilleDuMois,
  memeMois,
  bornesPlageParis,
  plageDeLaVue,
  naviguer,
  libelleDeLaVue,
  quantieme,
  estCleJour,
  estVue,
} from "../calendrier";

describe("décalages de jours", () => {
  it("avance et recule sans dériver", () => {
    expect(decalerJours("2026-08-27", 1)).toBe("2026-08-28");
    expect(decalerJours("2026-08-27", -1)).toBe("2026-08-26");
    expect(decalerJours("2026-08-27", 0)).toBe("2026-08-27");
  });

  it("franchit les fins de mois et d'année", () => {
    expect(decalerJours("2026-08-31", 1)).toBe("2026-09-01");
    expect(decalerJours("2026-12-31", 1)).toBe("2027-01-01");
    expect(decalerJours("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("connaît les années bissextiles", () => {
    expect(decalerJours("2028-02-28", 1)).toBe("2028-02-29");
    expect(decalerJours("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("🔴 traverse les changements d'heure sans sauter de jour", () => {
    // Les deux dates où un jour civil français ne dure pas 24 h.
    expect(decalerJours("2026-03-28", 1)).toBe("2026-03-29");
    expect(decalerJours("2026-03-29", 1)).toBe("2026-03-30");
    expect(decalerJours("2026-10-24", 1)).toBe("2026-10-25");
    expect(decalerJours("2026-10-25", 1)).toBe("2026-10-26");
  });
});

describe("décalages de mois", () => {
  it("avance d'un mois", () => {
    expect(decalerMois("2026-08-27", 1)).toBe("2026-09-27");
    expect(decalerMois("2026-08-27", -1)).toBe("2026-07-27");
  });

  it("🔴 ne déborde pas quand le mois cible est plus court", () => {
    // Le piège classique : « 31 janvier + 1 mois » vaut le 3 mars si on se
    // contente d'incrémenter le mois. On borne au dernier jour du mois cible.
    expect(decalerMois("2026-01-31", 1)).toBe("2026-02-28");
    expect(decalerMois("2026-03-31", -1)).toBe("2026-02-28");
    expect(decalerMois("2026-05-31", 1)).toBe("2026-06-30");
    expect(decalerMois("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("franchit l'année", () => {
    expect(decalerMois("2026-12-15", 1)).toBe("2027-01-15");
    expect(decalerMois("2026-01-15", -1)).toBe("2025-12-15");
  });
});

describe("semaines", () => {
  it("la semaine commence le LUNDI, pas le dimanche", () => {
    // 2026-08-27 est un jeudi ; son lundi est le 24.
    expect(lundiDeLaSemaine("2026-08-27")).toBe("2026-08-24");
  });

  it("🔴 un dimanche appartient à la semaine qui le PRÉCÈDE", () => {
    // Le piège de `getUTCDay()` : il rend 0 pour dimanche. Traité naïvement,
    // le dimanche devient le premier jour et toute la grille glisse d'une semaine.
    expect(lundiDeLaSemaine("2026-08-30")).toBe("2026-08-24");
    expect(lundiDeLaSemaine("2026-08-24")).toBe("2026-08-24");
  });

  it("rend sept jours consécutifs, lundi → dimanche", () => {
    const s = semaineDe("2026-08-27");
    expect(s).toEqual([
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
    ]);
  });
});

describe("grille du mois", () => {
  it("fait TOUJOURS 42 cellules, même pour un mois court", () => {
    // Une grille dont la hauteur change fait sauter la page à chaque navigation.
    // Le budget de la console impose CLS = 0.
    for (const cle of ["2026-02-15", "2026-08-15", "2026-12-15", "2028-02-15"]) {
      expect(grilleDuMois(cle)).toHaveLength(42);
    }
  });

  it("commence un lundi et finit un dimanche", () => {
    const g = grilleDuMois("2026-08-15");
    expect(lundiDeLaSemaine(g[0] as string)).toBe(g[0]);
    expect(decalerJours(g[41] as string, 1)).toBe(lundiDeLaSemaine(decalerJours(g[41] as string, 1)));
  });

  it("contient tous les jours du mois visé", () => {
    const g = grilleDuMois("2026-08-15");
    expect(g).toContain("2026-08-01");
    expect(g).toContain("2026-08-31");
    // Et déborde des deux côtés, ce qui est voulu.
    expect(g[0] as string < "2026-08-01").toBe(true);
  });

  it("est stable quel que soit le jour du mois qu'on lui donne", () => {
    expect(grilleDuMois("2026-08-01")).toEqual(grilleDuMois("2026-08-31"));
  });

  it("memeMois distingue les débordements", () => {
    expect(memeMois("2026-08-01", "2026-08-31")).toBe(true);
    expect(memeMois("2026-07-31", "2026-08-01")).toBe(false);
  });
});

describe("bornes réelles de la plage", () => {
  it("cadre sur minuit de Paris, pas minuit UTC", () => {
    const { debut, fin } = bornesPlageParis("2026-08-27", "2026-08-28");
    expect(debut.toISOString()).toBe("2026-08-26T22:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-08-27T22:00:00.000Z");
  });

  it("🔴 un mois à cheval sur un changement d'heure n'a pas une heure de trop", () => {
    // Du 26 octobre au 2 novembre : la bascule du 25 est derrière, l'offset a
    // changé. Une fin calculée par addition de durée serait décalée d'une heure.
    const { debut, fin } = bornesPlageParis("2026-10-26", "2026-11-02");
    expect(debut.toISOString()).toBe("2026-10-25T23:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-11-01T23:00:00.000Z");
  });

  it("ne rend JAMAIS d'Invalid Date, même sur une entrée absurde", () => {
    for (const [a, b] of [
      ["", ""],
      ["pas-une-date", "2026-08-28"],
      ["27/08/2026", "28/08/2026"],
    ]) {
      const { debut, fin } = bornesPlageParis(a as string, b as string);
      expect(Number.isNaN(debut.getTime())).toBe(false);
      expect(Number.isNaN(fin.getTime())).toBe(false);
      expect(fin.getTime()).toBeGreaterThan(debut.getTime());
    }
  });
});

describe("plage de la vue", () => {
  it("jour : un seul jour", () => {
    expect(plageDeLaVue("jour", "2026-08-27")).toEqual({
      debut: "2026-08-27",
      finExclue: "2026-08-28",
    });
  });

  it("semaine : du lundi au lundi suivant", () => {
    expect(plageDeLaVue("semaine", "2026-08-27")).toEqual({
      debut: "2026-08-24",
      finExclue: "2026-08-31",
    });
  });

  it("mois : couvre les 42 cellules, débordements compris", () => {
    const p = plageDeLaVue("mois", "2026-08-15");
    const g = grilleDuMois("2026-08-15");
    expect(p.debut).toBe(g[0]);
    expect(p.finExclue).toBe(decalerJours(g[41] as string, 1));
  });
});

describe("navigation", () => {
  it("suit l'unité de la vue affichée", () => {
    expect(naviguer("jour", "2026-08-27", 1)).toBe("2026-08-28");
    expect(naviguer("semaine", "2026-08-27", 1)).toBe("2026-09-03");
    expect(naviguer("mois", "2026-08-27", 1)).toBe("2026-09-27");
    expect(naviguer("mois", "2026-08-27", -1)).toBe("2026-07-27");
  });

  it("🔴 permet de remonter loin dans le passé sans se casser", () => {
    // Le manque signalé par Will : on ne pouvait pas quitter la fenêtre de 7 jours.
    let cle = "2026-08-27";
    for (let i = 0; i < 24; i++) cle = naviguer("mois", cle, -1);
    expect(cle).toBe("2024-08-27");
    expect(estCleJour(cle)).toBe(true);
  });
});

describe("libellés", () => {
  it("nomme la vue sans jamais rendre « Invalid Date »", () => {
    expect(libelleDeLaVue("mois", "2026-08-27")).toContain("août");
    expect(libelleDeLaVue("mois", "2026-08-27")).toContain("2026");
    expect(libelleDeLaVue("jour", "2026-08-27")).toContain("jeudi");
    expect(libelleDeLaVue("semaine", "2026-08-27")).toContain("24");
    for (const v of ["mois", "semaine", "jour"] as const) {
      expect(libelleDeLaVue(v, "2026-08-27")).not.toContain("Invalid");
    }
  });

  it("quantième rend le jour du mois", () => {
    expect(quantieme("2026-08-01")).toBe("1");
    expect(quantieme("2026-08-31")).toBe("31");
  });
});

describe("validation des paramètres d'URL", () => {
  it("n'accepte que les trois vues", () => {
    expect(estVue("mois")).toBe(true);
    expect(estVue("semaine")).toBe(true);
    expect(estVue("jour")).toBe(true);
    expect(estVue("annee")).toBe(false);
    expect(estVue(undefined)).toBe(false);
  });

  it("n'accepte qu'une clé bien formée", () => {
    expect(estCleJour("2026-08-27")).toBe(true);
    expect(estCleJour("2026-8-7")).toBe(false);
    expect(estCleJour("hier")).toBe(false);
    expect(estCleJour(undefined)).toBe(false);
  });
});
