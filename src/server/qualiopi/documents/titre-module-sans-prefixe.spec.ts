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

describe("titreModuleSansPrefixe — repères de demi-journée", () => {
  /**
   * 🔴 Depuis le 2026-08-06, les titres du catalogue portent leur repère de
   * demi-journée pour que la timeline publique sache quand l'horloge repart. Ce
   * repère n'a rien à faire sur une couverture de diaporama ni dans une annexe
   * de convention, où il se lit comme une coquille — et il y était.
   */
  it("retire le repère de demi-journée en plus du numéro de module", () => {
    const cas: Array<[string, string]> = [
      ["Matin · Module 1 — Le cadre avant les CV", "Le cadre avant les CV"],
      ["Après-midi · Module 3 — Candidatures et entretiens", "Candidatures et entretiens"],
      ["Matin J2 · Module 5 — Industrialiser", "Industrialiser"],
      ["Après-midi J1 · Module 2 — Les écrits du terrain", "Les écrits du terrain"],
      ["Demi-journée — Découvrir", "Découvrir"],
      // Sans repère : le comportement d'origine est intact.
      ["Module 1 — L'IA dans le métier immobilier", "L'IA dans le métier immobilier"],
      ["Un titre sans aucun préfixe", "Un titre sans aucun préfixe"],
    ];
    for (const [entree, attendu] of cas) {
      expect(titreModuleSansPrefixe(entree), entree).toBe(attendu);
    }
  });

  it("ne mange pas un titre qui COMMENCE par un de ces mots", () => {
    // « Matinée d'accueil » n'est pas un repère : le mot doit être entier.
    expect(titreModuleSansPrefixe("Matinée d'accueil et cadrage")).toBe(
      "Matinée d'accueil et cadrage",
    );
    expect(titreModuleSansPrefixe("Journalisme et IA")).toBe("Journalisme et IA");
  });
});
