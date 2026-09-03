/**
 * LA MÉDIANE, ET POURQUOI CE N'EST PAS UNE MOYENNE.
 *
 * Le chiffre affiché sur l'écran de pilotage sert à décider si on répond assez
 * vite. Un seul dossier répondu six mois plus tard déplace une MOYENNE de
 * plusieurs jours : on croirait avoir un problème général alors qu'on a un
 * dossier oublié — et on chercherait au mauvais endroit. Ce fichier prouve que
 * la valeur extrême ne déplace pas le chiffre.
 */

import { describe, it, expect } from "vitest";

import { mediane, formaterDuree } from "../pilotage";

describe("la médiane", () => {
  it("rend null sur une série vide — jamais zéro", () => {
    // 🔴 Zéro se lirait « on répond instantanément », c'est-à-dire le contraire
    // de « on n'a répondu à personne ». Le type dit l'absence, l'écran affiche
    // un tiret.
    expect(mediane([])).toBeNull();
  });

  it("prend la valeur centrale sur un effectif impair", () => {
    expect(mediane([1, 2, 100])).toBe(2);
  });

  it("moyenne les deux valeurs centrales sur un effectif pair", () => {
    // Prendre l'une des deux ferait sauter le chiffre d'un dossier à l'autre à
    // chaque ajout, pour une valeur censée décrire une tendance.
    expect(mediane([1, 2, 4, 100])).toBe(3);
  });

  it("NE BOUGE PAS quand un dossier extrême s'ajoute — c'est tout l'intérêt", () => {
    const normal = [2, 3, 4, 5, 6];
    const avecUnOublie = [2, 3, 4, 5, 6, 4_000].sort((a, b) => a - b);
    expect(mediane(normal)).toBe(4);
    // La moyenne serait passée de 4 à 670 : le chiffre aurait annoncé une
    // panne générale là où il y a un dossier oublié.
    expect(mediane(avecUnOublie)).toBe(4.5);
  });
});

describe("le format lu par un humain", () => {
  it("dit « < 1 h » plutôt que « 0 h »", () => {
    // « 0 h » se lit comme une donnée manquante ; « < 1 h » se lit comme un fait.
    expect(formaterDuree(0.4)).toBe("< 1 h");
  });

  it("reste en heures sous deux jours", () => {
    expect(formaterDuree(5)).toBe("5 h");
    expect(formaterDuree(47)).toBe("47 h");
  });

  it("passe en jours au-delà, et ne dit pas « 3 j 0 h »", () => {
    expect(formaterDuree(72)).toBe("3 j");
    expect(formaterDuree(76)).toBe("3 j 4 h");
  });
});
