/**
 * Tests unitaires — support-builder.ts (T13)
 *
 * Vérifie que construireSupport produit un SupportContenu valide pour chacun
 * des 7 types, et que titreSupport génère le bon libellé.
 *
 * Tests purs — aucune I/O, aucun mock.
 */

import { describe, it, expect } from "vitest";
import { construireSupport, titreSupport } from "./support-builder";
import type { FormationInput } from "./types";

// ============================================================
// Fixture partagée
// ============================================================

const FORMATION_FIXTURE: FormationInput = {
  titre: "Intelligence Artificielle — Fondamentaux",
  objectifsPedagogiques: [
    "Comprendre les principes fondamentaux de l'IA",
    "Identifier les cas d'usage métier pertinents",
    "Utiliser des outils IA no-code en autonomie",
  ],
  programmeDetaille: [
    {
      moduleId: "M1",
      titre: "Introduction à l'IA",
      dureeMin: 90,
      sequences: [
        {
          titre: "Histoire et évolution de l'IA",
          dureeMin: 20,
          description: "Chronologie et jalons clés",
        },
        { titre: "Concepts fondamentaux (ML, DL, NLP)", dureeMin: 40 },
        { titre: "Démonstration pratique", dureeMin: 30, description: "Cas concrets en direct" },
      ],
    },
    {
      moduleId: "M2",
      titre: "IA Générative et LLM",
      dureeMin: 120,
      sequences: [
        { titre: "Fonctionnement des LLM", dureeMin: 45 },
        {
          titre: "Prompt engineering",
          dureeMin: 45,
          description: "Techniques de rédaction de prompts",
        },
        { titre: "Atelier pratique", dureeMin: 30 },
      ],
    },
    {
      moduleId: "M3",
      titre: "Cas d'usage métier",
      dureeMin: 90,
      sequences: [
        { titre: "RH et recrutement", dureeMin: 20 },
        { titre: "Marketing et contenu", dureeMin: 20 },
        { titre: "Analyse de données", dureeMin: 50 },
      ],
    },
  ],
  methodesPedagogiques: ["Présentations interactives", "Ateliers pratiques", "Études de cas réels"],
  moyensTechniques: [
    "Ordinateurs fournis",
    "Accès aux outils IA en ligne",
    "Plateforme LMS dédiée",
  ],
  ressourcesPedagogiques: ["Support de cours PDF", "Vidéos complémentaires", "Quiz de révision"],
  dureeHeures: 7,
};

const FORMATION_MINIMALE: FormationInput = {
  titre: "Formation minimale",
  objectifsPedagogiques: [],
  programmeDetaille: [{ moduleId: "M1", titre: "Module unique" }],
  dureeHeures: 1,
};

// ============================================================
// titreSupport
// ============================================================

describe("titreSupport", () => {
  it("génère un titre pour chaque type", () => {
    const types = [
      "slides_formateur",
      "slides_stagiaire",
      "livret_stagiaire",
      "memo",
      "guide_animation",
      "exercices",
      "grille_eval",
    ] as const;
    for (const type of types) {
      const titre = titreSupport(type, "Ma formation");
      expect(titre).toContain("Ma formation");
      expect(titre.length).toBeGreaterThan(5);
    }
  });

  it("contient le titre de formation dans le résultat", () => {
    const titre = titreSupport("memo", "IA pour les RH");
    expect(titre).toContain("IA pour les RH");
  });

  it("retourne des libellés distincts par type", () => {
    const titres = (["slides_formateur", "slides_stagiaire", "memo"] as const).map((t) =>
      titreSupport(t, "Formation"),
    );
    expect(new Set(titres).size).toBe(3);
  });
});

// ============================================================
// construireSupport — structure commune
// ============================================================

describe("construireSupport — structure commune", () => {
  const types = [
    "slides_formateur",
    "slides_stagiaire",
    "livret_stagiaire",
    "memo",
    "guide_animation",
    "exercices",
    "grille_eval",
  ] as const;

  for (const type of types) {
    it(`${type} : retourne un SupportContenu avec au moins 1 section`, () => {
      const contenu = construireSupport(type, FORMATION_FIXTURE);
      expect(contenu).toBeDefined();
      expect(contenu.sections).toBeDefined();
      expect(Array.isArray(contenu.sections)).toBe(true);
      expect(contenu.sections.length).toBeGreaterThan(0);
    });

    it(`${type} : chaque section a un titre non vide`, () => {
      const contenu = construireSupport(type, FORMATION_FIXTURE);
      for (const section of contenu.sections) {
        expect(typeof section.titre).toBe("string");
        expect(section.titre.trim().length).toBeGreaterThan(0);
      }
    });

    it(`${type} : chaque section a au moins 1 bloc`, () => {
      const contenu = construireSupport(type, FORMATION_FIXTURE);
      for (const section of contenu.sections) {
        expect(Array.isArray(section.blocs)).toBe(true);
        expect(section.blocs.length).toBeGreaterThan(0);
      }
    });

    it(`${type} : meta inclut le type et la formation`, () => {
      const contenu = construireSupport(type, FORMATION_FIXTURE);
      expect(contenu.meta).toBeDefined();
      expect(contenu.meta?.type).toBe(type);
      expect(contenu.meta?.formation).toBe(FORMATION_FIXTURE.titre);
    });
  }
});

// ============================================================
// construireSupport — cas particuliers par type
// ============================================================

describe("construireSupport — slides_formateur", () => {
  it("crée une section par module + intro + notes formateur", () => {
    const contenu = construireSupport("slides_formateur", FORMATION_FIXTURE);
    // Intro + 3 modules + Notes formateur = 5 sections
    expect(contenu.sections.length).toBe(5);
  });

  it("inclut les objectifs dans l'introduction", () => {
    const contenu = construireSupport("slides_formateur", FORMATION_FIXTURE);
    const intro = contenu.sections[0];
    expect(intro).toBeDefined();
    const listBloc = intro!.blocs.find((b) => b.type === "liste");
    expect(listBloc).toBeDefined();
    expect(listBloc?.items).toContain("Comprendre les principes fondamentaux de l'IA");
  });
});

describe("construireSupport — livret_stagiaire", () => {
  it("contient les sections obligatoires", () => {
    const contenu = construireSupport("livret_stagiaire", FORMATION_FIXTURE);
    const titres = contenu.sections.map((s) => s.titre);
    expect(titres).toContain("Bienvenue");
    expect(titres).toContain("Objectifs pédagogiques");
    expect(titres).toContain("Programme");
    expect(titres).toContain("Évaluation");
  });

  it("inclut les méthodes pédagogiques si présentes", () => {
    const contenu = construireSupport("livret_stagiaire", FORMATION_FIXTURE);
    const titres = contenu.sections.map((s) => s.titre);
    expect(titres).toContain("Méthodes pédagogiques");
  });
});

describe("construireSupport — guide_animation", () => {
  it("inclut une section de préparation et une de clôture", () => {
    const contenu = construireSupport("guide_animation", FORMATION_FIXTURE);
    const titres = contenu.sections.map((s) => s.titre);
    expect(titres[0]).toContain("Préparer");
    expect(titres[titres.length - 1]).toContain("Clôture");
  });

  it("inclut le timing dans les blocs de module", () => {
    const contenu = construireSupport("guide_animation", FORMATION_FIXTURE);
    // Section module M1 (index 1)
    const moduleSection = contenu.sections[1];
    expect(moduleSection).toBeDefined();
    const noteBloc = moduleSection!.blocs.find(
      (b) => b.type === "note" && b.texte?.includes("Timing"),
    );
    expect(noteBloc).toBeDefined();
  });
});

describe("construireSupport — exercices", () => {
  it("crée des blocs de type exercice", () => {
    const contenu = construireSupport("exercices", FORMATION_FIXTURE);
    const allBlocs = contenu.sections.flatMap((s) => s.blocs);
    const exerciceBlocs = allBlocs.filter((b) => b.type === "exercice");
    expect(exerciceBlocs.length).toBeGreaterThan(0);
  });

  it("crée une section synthèse finale si des objectifs sont définis", () => {
    const contenu = construireSupport("exercices", FORMATION_FIXTURE);
    const titres = contenu.sections.map((s) => s.titre);
    expect(titres).toContain("Synthèse finale");
  });
});

describe("construireSupport — grille_eval", () => {
  it("contient une section informations stagiaire", () => {
    const contenu = construireSupport("grille_eval", FORMATION_FIXTURE);
    const titres = contenu.sections.map((s) => s.titre);
    expect(titres).toContain("Informations stagiaire");
  });

  it("contient une section critères d'évaluation", () => {
    const contenu = construireSupport("grille_eval", FORMATION_FIXTURE);
    const titres = contenu.sections.map((s) => s.titre);
    expect(titres).toContain("Critères d'évaluation");
  });

  it("inclut la notation dans les blocs critères", () => {
    const contenu = construireSupport("grille_eval", FORMATION_FIXTURE);
    const criteresSection = contenu.sections.find((s) => s.titre === "Critères d'évaluation");
    expect(criteresSection).toBeDefined();
    const noteBloc = criteresSection!.blocs.find((b) => b.type === "note");
    expect(noteBloc?.texte).toContain("1 = Non atteint");
  });
});

// ============================================================
// Cas formation minimale (no sequences, no optional fields)
// ============================================================

describe("construireSupport — formation minimale (robustesse)", () => {
  const types = [
    "slides_formateur",
    "slides_stagiaire",
    "livret_stagiaire",
    "memo",
    "guide_animation",
    "exercices",
    "grille_eval",
  ] as const;

  for (const type of types) {
    it(`${type} : ne plante pas avec une formation minimale (0 objectifs, 0 séquences)`, () => {
      expect(() => construireSupport(type, FORMATION_MINIMALE)).not.toThrow();
      const contenu = construireSupport(type, FORMATION_MINIMALE);
      expect(contenu.sections.length).toBeGreaterThan(0);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Guide d'animation — le minutage réellement suivi en salle
// ─────────────────────────────────────────────────────────────────────────────

/** Deux modules de 210 min chacun, minutés par leurs séquences. */
const FORMATION_MINUTEE: FormationInput = {
  titre: "Formation minutée",
  objectifsPedagogiques: ["Produire un livrable"],
  dureeHeures: 7,
  programmeDetaille: [
    {
      moduleId: "mod-1",
      titre: "Module 1",
      sequences: [
        { titre: "Objectif du module", dureeMin: 10, type: "objectif" },
        { titre: "Démonstration avant/après", dureeMin: 50, type: "demonstration" },
        { titre: "Atelier chronométré", dureeMin: 150, type: "pratique" },
      ],
    },
    {
      moduleId: "mod-2",
      titre: "Module 2",
      sequences: [
        { titre: "Contrôle croisé", dureeMin: 60, type: "verification" },
        { titre: "Assemblage", dureeMin: 150, type: "pratique" },
      ],
    },
  ],
};

describe("construireSupport — guide_animation, minutage", () => {
  /**
   * 🔴 Le guide retenait `mod.dureeMin ?? 60`. Or `programmeDetaille` n'a JAMAIS
   * porté de durée au niveau module, seulement au niveau séquence : le repli
   * s'appliquait systématiquement. Le document que le formateur suit en salle
   * annonçait donc deux modules d'une heure pour une journée de sept, et tous
   * les horaires de séquences en découlaient.
   */
  it("additionne les séquences au lieu d'inventer une heure par module", () => {
    const contenu = construireSupport("guide_animation", FORMATION_MINUTEE);
    const timings = contenu.sections
      .flatMap((s) => s.blocs)
      .map((b) => b.texte ?? "")
      .filter((t) => t.startsWith("Timing :"));

    expect(timings).toEqual(["Timing : 0 min → 3h30", "Timing : 3h30 → 7h"]);
  });

  it("situe chaque séquence à son heure réelle et dit ce que le formateur y fait", () => {
    const contenu = construireSupport("guide_animation", FORMATION_MINUTEE);
    const lignes = contenu.sections.flatMap((s) => s.blocs).map((b) => b.texte ?? "");

    expect(lignes).toContain("Objectif du module [0 min — 10 min · annoncer le résultat visé]");
    expect(lignes).toContain("Atelier chronométré [1h — 150 min · faire produire, chronométré]");
    expect(lignes).toContain(
      "Contrôle croisé [3h30 — 60 min · faire vérifier et corriger en salle]",
    );
  });

  /**
   * Un horaire faux est pire qu'un horaire absent : le formateur le suit. Dès
   * qu'un module n'est pas minuté, plus rien n'est situable après lui.
   */
  it("se tait sur les horaires plutôt que de décaler toute la journée", () => {
    const contenu = construireSupport("guide_animation", {
      ...FORMATION_MINUTEE,
      programmeDetaille: [
        { moduleId: "mod-1", titre: "Module sans minutage", sequences: [{ titre: "Séquence" }] },
        FORMATION_MINUTEE.programmeDetaille[1]!,
      ],
    });
    const textes = contenu.sections.flatMap((s) => s.blocs).map((b) => b.texte ?? "");

    expect(textes.filter((t) => t.startsWith("Timing :"))).toEqual([]);
    expect(textes).toContain(
      "Module non minuté : caler la durée avec le formateur avant la session.",
    );
    // La séquence garde sa durée, mais plus son heure : elle n'est plus situable.
    expect(textes).toContain("Contrôle croisé [60 min · faire vérifier et corriger en salle]");
  });
});
