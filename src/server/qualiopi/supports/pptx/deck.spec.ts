/**
 * Le diaporama projeté, tenu contre les règles de composition.
 *
 * Ces tests ne vérifient pas « le deck se construit » : ils vérifient qu'il
 * respecte ce qui rend une slide lisible à quatre mètres, et que rien de ce qui
 * doit rester au formateur ne se retrouve projeté.
 */

import { describe, it, expect } from "vitest";

import { construireDeck } from "./deck";
import { FORMATIONS_V2 } from "@/content/formations/catalog-v2";
import { buildFormationImportData } from "@/server/qualiopi/formations/catalog-import";
import type { ModuleProgramme } from "../types";

/** Le pilote, tel qu'il arrive réellement en base après import. */
function deckPilote() {
  const f = FORMATIONS_V2.find((x) => x.id === "ia-pour-les-rh")!;
  const data = buildFormationImportData(f, "offre-x");
  return construireDeck({
    titreFormation: data.titre,
    modules: data.programmeDetaille as unknown as ModuleProgramme[],
    dureeHeures: data.dureeHeures,
  });
}

describe("construireDeck — structure", () => {
  it("ouvre sur une couverture et donne le déroulé de la journée", () => {
    const deck = deckPilote();
    expect(deck.slides[0]?.layout).toBe("couverture");
    expect(deck.slides[1]?.layout).toBe("sommaire");
    expect(deck.slides[1]?.corps).toHaveLength(4); // les quatre modules
  });

  it("chaque module ouvre par une couverture pleine teinte", () => {
    const deck = deckPilote();
    const couvertures = deck.slides.filter((s) => s.layout === "couverture");
    // Une pour la formation, une par module.
    expect(couvertures).toHaveLength(5);
    expect(couvertures.every((s) => s.fond === "mocha")).toBe(true);
  });

  it("produit le prompt de démonstration EN ENTIER, sur sa propre slide", () => {
    const deck = deckPilote();
    const prompts = deck.slides.filter((s) => s.layout === "prompt");
    expect(prompts).toHaveLength(4); // une démonstration par module
    for (const slide of prompts) {
      const prompt = slide.corps?.[0] ?? "";
      expect(prompt.length).toBeGreaterThan(30);
      // Un prompt tronqué est irreproductible : le stagiaire regarde un tour
      // de magie au lieu d'apprendre.
      expect(prompt.trimEnd().endsWith("...")).toBe(false);
      expect(prompt.trimEnd().endsWith("…")).toBe(false);
    }
  });
});

describe("construireDeck — ce qui ne se projette pas", () => {
  /**
   * 🔴 La règle qui distingue un diaporama d'un document. Les consignes longues,
   * la FAQ et les parades sont pour le formateur, en mode présentateur. Les
   * projeter remplirait la salle de texte que personne ne lit à quatre mètres —
   * et donnerait aux stagiaires les réponses avant les questions.
   */
  it("la réponse attendue d'une vérification n'est jamais projetée", () => {
    const deck = deckPilote();
    const slidesVerif = deck.slides.filter((s) => s.eyebrow?.includes("On vérifie") === true);
    expect(slidesVerif.length).toBeGreaterThan(0);

    for (const slide of slidesVerif) {
      // La question est projetée…
      expect(slide.titre.length).toBeGreaterThan(10);
      // …la réponse est dans les notes du formateur.
      expect(slide.notes).toBeDefined();
      expect(slide.corps ?? []).toEqual([]);
    }
  });

  it("aucune FAQ ni parade ne se retrouve dans le corps d'une slide", () => {
    const deck = deckPilote();
    for (const slide of deck.slides) {
      const corps = (slide.corps ?? []).join(" ");
      expect(corps, `« ${slide.titre.slice(0, 40)} »`).not.toContain("ILS DEMANDENT");
      expect(corps, `« ${slide.titre.slice(0, 40)} »`).not.toContain("SI ÇA COINCE");
      expect(corps, `« ${slide.titre.slice(0, 40)} »`).not.toContain("PLAN B");
    }
  });

  it("une synthèse ne projette jamais plus de trois points", () => {
    const deck = deckPilote();
    for (const slide of deck.slides.filter((s) => s.layout === "points")) {
      expect((slide.corps ?? []).length, slide.titre).toBeLessThanOrEqual(3);
    }
  });
});

describe("construireDeck — l'aide au formateur", () => {
  /**
   * C'est la raison d'être du diaporama GÉNÉRÉ par rapport à un diaporama
   * déposé : chaque moment animé porte son aide, dans les notes du présentateur.
   */
  it("chaque bloc rédigé donne au moins une slide portant des notes", () => {
    const deck = deckPilote();
    const avecNotes = deck.slides.filter((s) => s.notes !== undefined);
    // 4 modules × (objectif, démonstration ×2, pratique, vérification, synthèse)
    expect(avecNotes.length).toBeGreaterThanOrEqual(20);
  });

  it("les notes portent le plan B, qui se cherche en panique", () => {
    const deck = deckPilote();
    const avecPlanB = deck.slides.filter((s) => s.notes?.includes("PLAN B") === true);
    expect(avecPlanB.length).toBeGreaterThanOrEqual(4);
  });
});

describe("construireDeck — robustesse", () => {
  it("un module sans contenu rédigé ne produit que sa couverture", () => {
    const deck = construireDeck({
      titreFormation: "Formation non rédigée",
      dureeHeures: 7,
      modules: [
        { moduleId: "mod-1", titre: "Module 1", sequences: [{ titre: "Séquence", dureeMin: 60 }] },
      ],
    });
    // Couverture de formation + sommaire + couverture de module. Rien de plus :
    // mieux vaut un module visiblement mince que des titres de séquences
    // projetés comme s'ils étaient du contenu.
    expect(deck.slides.map((s) => s.layout)).toEqual(["couverture", "sommaire", "couverture"]);
  });

  it("ne lève jamais sur un programme aberrant", () => {
    for (const modules of [[], [null], [42], [{}], [{ titre: "x" }]]) {
      expect(() =>
        construireDeck({
          titreFormation: "T",
          dureeHeures: 7,
          modules: modules as unknown as ModuleProgramme[],
        }),
      ).not.toThrow();
    }
  });
});

describe("construireDeck — ce qui est projeté doit se lire", () => {
  /**
   * 🔴 Trouvé en relisant le deck réel : les couvertures de module projetaient
   * « Matin · Module 1 — Le cadre avant les CV : ce qu'on a le droit de faire ».
   * Le repère de demi-journée est un artefact de programme, indispensable à la
   * timeline publique et illisible sur un écran. Il était aussi imprimé dans les
   * PDF — le correctif est à la source, donc les deux familles en bénéficient.
   */
  it("aucune couverture de module ne projette son repère de demi-journée", () => {
    const deck = deckPilote();
    for (const slide of deck.slides.filter((s) => s.layout === "couverture")) {
      expect(slide.titre, slide.titre).not.toMatch(/^(matin|après-midi|jour|demi-journée)/i);
      expect(slide.titre, slide.titre).not.toMatch(/^module\s*\d/i);
    }
  });

  /**
   * Le champ `outil` accepte une phrase (« Un seul outil, celui validé dans la
   * salle »). Projetée en surtitre, elle déborde et ne dit rien de plus que le
   * silence.
   */
  it("le surtitre reste court sur toutes les slides", () => {
    const deck = deckPilote();
    for (const slide of deck.slides) {
      if (slide.eyebrow === undefined) continue;
      expect(slide.eyebrow.length, `« ${slide.eyebrow} »`).toBeLessThanOrEqual(56);
    }
  });
});
