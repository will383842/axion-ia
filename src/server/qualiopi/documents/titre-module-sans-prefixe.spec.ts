/**
 * Garde — le préfixe « Module N — » n'est jamais imprimé deux fois.
 *
 * 🔴 Constaté sur `AXI-DOC-2026-002` (« Module 1 — Module 1 — L'IA… »), corrigé
 * dans le seul gabarit du programme, et RETROUVÉ INTACT le 04/08 dans les
 * supports pédagogiques : « Module mod-1 : Module 1 — L'IA dans le métier
 * immobilier », sur les 167 supports générés en production.
 *
 * Le correctif vivait en copie privée dans un fichier ; la deuxième famille de
 * pièces ne pouvait pas en bénéficier. Ce test porte sur la fonction PARTAGÉE,
 * pour que la troisième n'ait pas à la réécrire.
 */

import { describe, it, expect } from "vitest";
import { titreModuleSansPrefixe } from "./programme-modules";

describe("titreModuleSansPrefixe", () => {
  it("retire le préfixe, quel que soit le tiret employé", () => {
    // Les titres générés ne sont pas normalisés : les trois tirets circulent.
    expect(titreModuleSansPrefixe("Module 1 — L'IA dans le métier immobilier")).toBe(
      "L'IA dans le métier immobilier",
    );
    expect(titreModuleSansPrefixe("Module 2 – Annonces et descriptifs")).toBe(
      "Annonces et descriptifs",
    );
    expect(titreModuleSansPrefixe("Module 3 - Prospection")).toBe("Prospection");
  });

  it("tolère l'absence d'espace et la casse", () => {
    expect(titreModuleSansPrefixe("module 10—Suivi de dossiers")).toBe("Suivi de dossiers");
    expect(titreModuleSansPrefixe("MODULE 4 — Confidentialité")).toBe("Confidentialité");
  });

  it("🔴 laisse INTACT un titre qui ne porte pas le préfixe", () => {
    // Sans cette garde, une expression trop gourmande amputerait des titres
    // légitimes — et le défaut aurait simplement changé de camp.
    expect(titreModuleSansPrefixe("Les modules complémentaires")).toBe(
      "Les modules complémentaires",
    );
    expect(titreModuleSansPrefixe("Modularité des parcours")).toBe("Modularité des parcours");
    expect(titreModuleSansPrefixe("Module de calcul — sans numéro")).toBe(
      "Module de calcul — sans numéro",
    );
  });
});
