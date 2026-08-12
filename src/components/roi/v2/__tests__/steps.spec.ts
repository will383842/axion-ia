// Logique du parcours du wizard.
//
// Ce fichier est pur (aucun rendu React), donc testable directement. Les
// invariants vérifiés ici sont ceux qui produisent, en cas de régression, des
// bugs invisibles à la relecture : une réponse qui ne s'efface pas, un ordre
// de questions qui dépend de l'ordre des clics, un parcours qui s'allonge sans
// que la progression suive.

import { describe, it, expect } from "vitest";
import {
  FRAMING_STEPS,
  applyStepAnswer,
  buildSteps,
  firstUnansweredIndex,
  selectedOptionIds,
  type VolumeStep,
} from "../steps";
import type { RoiAnswers } from "@/content/roi/model/types";
import { SECTOR_DEFAULT_FUNCTIONS } from "@/content/roi/model/functions";
import { selectVolumeQuestions } from "@/content/roi/model/questions";

const BASE: RoiAnswers = {
  sector: "generique",
  headcount: "2-5",
  maturity: "outille",
  functions: [],
  volumes: {},
};

describe("construction du parcours", () => {
  it("pose toujours les quatre écrans de cadrage", () => {
    const steps = buildSteps([]);
    expect(steps).toHaveLength(FRAMING_STEPS.length);
    expect(steps.map((s) => s.id)).toEqual(["sector", "headcount", "maturity", "functions"]);
  });

  it("s'allonge avec les fonctions déclarées", () => {
    const short = buildSteps(["administratif"]);
    const long = buildSteps(["administratif", "commercial", "production"]);
    expect(long.length).toBeGreaterThan(short.length);
  });

  it("reste dans la fourchette annoncée de 10 à 16 écrans", () => {
    const all = buildSteps([
      "administratif",
      "commercial",
      "relation_client",
      "production",
      "marketing",
      "rh",
      "finance",
      "direction",
    ]);
    expect(all.length).toBeLessThanOrEqual(16);

    const typical = buildSteps(["administratif", "commercial", "production"]);
    expect(typical.length).toBeGreaterThanOrEqual(10);
  });

  it("n'ajoute aucun écran pour la seule fonction direction", () => {
    expect(buildSteps(["direction"])).toHaveLength(FRAMING_STEPS.length);
  });
});

describe("pré-remplissage sectoriel", () => {
  const sectorStep = FRAMING_STEPS[0]!;

  it("pré-coche les fonctions habituelles du secteur choisi", () => {
    // L'écran des fonctions devient une confirmation d'un appui au lieu d'un
    // arbitrage à huit cases : c'est le point de décrochage le plus probable
    // du parcours.
    const next = applyStepAnswer(BASE, sectorStep, ["juridique"]);
    expect(next.functions).toEqual(SECTOR_DEFAULT_FUNCTIONS.juridique);
    expect(next.functions.length).toBeGreaterThan(0);
  });

  it("n'écrase jamais une sélection faite à la main", () => {
    // Revenir en arrière pour corriger son secteur ne doit pas effacer les
    // fonctions que l'utilisateur a lui-même ajustées.
    const custom: RoiAnswers = { ...BASE, functions: ["marketing", "rh"] };
    const next = applyStepAnswer(custom, sectorStep, ["juridique"], true);
    expect(next.sector).toBe("juridique");
    expect(next.functions).toEqual(["marketing", "rh"]);
  });

  it("garde chaque préréglage entre deux et trois fonctions", () => {
    // Chaque fonction ajoute deux questions de volume : au-delà de trois, le
    // pré-remplissage allongerait le questionnaire au lieu de le raccourcir.
    for (const [sector, fns] of Object.entries(SECTOR_DEFAULT_FUNCTIONS)) {
      expect(fns.length, `secteur ${sector}`).toBeGreaterThanOrEqual(2);
      expect(fns.length, `secteur ${sector}`).toBeLessThanOrEqual(3);
    }
  });

  it("ne pré-coche que des fonctions réellement interrogeables", () => {
    // `direction` n'a aucune question de volume : la pré-cocher gonflerait la
    // liste des « fonctions non mesurées » du rapport sans rien apporter.
    for (const [sector, fns] of Object.entries(SECTOR_DEFAULT_FUNCTIONS)) {
      expect(fns, `secteur ${sector}`).not.toContain("direction");
      expect(selectVolumeQuestions(fns).length, `secteur ${sector}`).toBeGreaterThan(0);
    }
  });

  it("produit un parcours court pour tous les secteurs", () => {
    // Promesse affichée à l'utilisateur : « une dizaine de questions, environ
    // trois minutes ». Elle doit tenir pour chaque secteur, pré-remplissage
    // accepté tel quel.
    for (const [sector, fns] of Object.entries(SECTOR_DEFAULT_FUNCTIONS)) {
      const total = buildSteps(fns).length;
      expect(total, `secteur ${sector}`).toBeLessThanOrEqual(10);
      expect(total, `secteur ${sector}`).toBeGreaterThanOrEqual(8);
    }
  });
});

describe("enregistrement des réponses", () => {
  it("renseigne le cadrage", () => {
    const sectorStep = FRAMING_STEPS[0]!;
    const next = applyStepAnswer(BASE, sectorStep, ["juridique"]);
    expect(next.sector).toBe("juridique");
  });

  it("ignore une sélection vide plutôt que d'écrire une valeur bancale", () => {
    const sectorStep = FRAMING_STEPS[0]!;
    expect(applyStepAnswer(BASE, sectorStep, [])).toBe(BASE);
  });

  it("range les fonctions dans l'ordre canonique, pas dans l'ordre des clics", () => {
    // L'ordre des fonctions pilote l'ordre des questions suivantes : le laisser
    // dépendre de l'ordre des appuis rendrait le parcours imprévisible et les
    // liens partagés non reproductibles.
    const fnStep = FRAMING_STEPS[3]!;
    const clickedBackwards = applyStepAnswer(BASE, fnStep, ["finance", "commercial", "administratif"]);
    const clickedForwards = applyStepAnswer(BASE, fnStep, ["administratif", "commercial", "finance"]);
    expect(clickedBackwards.functions).toEqual(clickedForwards.functions);
    expect(clickedBackwards.functions).toEqual(["administratif", "commercial", "finance"]);
  });

  it("enregistre la valeur médiane d'une tranche de volume", () => {
    const steps = buildSteps(["commercial"]);
    const volumeStep = steps.find((s): s is VolumeStep => s.kind === "volume")!;
    const firstChoice = volumeStep.options[0]!;
    const next = applyStepAnswer(BASE, volumeStep, [firstChoice.id]);
    expect(next.volumes[volumeStep.volumeKey]).toBe(volumeStep.values[firstChoice.id]);
  });

  it("efface la grandeur quand on répond « je ne sais pas » après avoir répondu", () => {
    // Régression sensible : sans cet effacement, un dirigeant qui se ravise
    // verrait le rapport chiffrer une tâche qu'il vient de déclarer non
    // mesurable — exactement la promesse que le simulateur prétend tenir.
    const steps = buildSteps(["commercial"]);
    const volumeStep = steps.find((s): s is VolumeStep => s.kind === "volume")!;
    const numeric = volumeStep.options.find((o) => volumeStep.values[o.id] !== null)!;
    const unknown = volumeStep.options.find((o) => volumeStep.values[o.id] === null)!;

    const answered = applyStepAnswer(BASE, volumeStep, [numeric.id]);
    expect(answered.volumes[volumeStep.volumeKey]).toBeDefined();

    const retracted = applyStepAnswer(answered, volumeStep, [unknown.id]);
    expect(retracted.volumes).not.toHaveProperty(volumeStep.volumeKey);
  });

  it("ne mute jamais les réponses en place", () => {
    // Le flux s'appuie sur l'égalité référentielle pour recalculer le rapport
    // et rafraîchir l'URL : une mutation en place figerait l'affichage.
    const fnStep = FRAMING_STEPS[3]!;
    const next = applyStepAnswer(BASE, fnStep, ["commercial"]);
    expect(next).not.toBe(BASE);
    expect(BASE.functions).toEqual([]);
  });
});

describe("relecture des réponses", () => {
  it("retrouve la sélection du cadrage", () => {
    const answers: RoiAnswers = { ...BASE, sector: "juridique", maturity: "papier" };
    expect(selectedOptionIds(answers, FRAMING_STEPS[0]!)).toEqual(["juridique"]);
    expect(selectedOptionIds(answers, FRAMING_STEPS[2]!)).toEqual(["papier"]);
  });

  it("retrouve la tranche cochée d'un volume", () => {
    const steps = buildSteps(["commercial"]);
    const volumeStep = steps.find((s): s is VolumeStep => s.kind === "volume")!;
    const choice = volumeStep.options.find((o) => volumeStep.values[o.id] !== null)!;
    const answers = applyStepAnswer(BASE, volumeStep, [choice.id]);
    expect(selectedOptionIds(answers, volumeStep)).toEqual([choice.id]);
  });

  it("ne coche rien quand la grandeur n'est pas renseignée", () => {
    const steps = buildSteps(["commercial"]);
    const volumeStep = steps.find((s): s is VolumeStep => s.kind === "volume")!;
    expect(selectedOptionIds(BASE, volumeStep)).toEqual([]);
  });
});

describe("reprise d'un parcours interrompu", () => {
  it("repart au premier écran sans réponse", () => {
    const steps = buildSteps(["administratif"]);
    const answered = new Set(["sector", "headcount"]);
    expect(firstUnansweredIndex(BASE, steps, answered)).toBe(2);
  });

  it("signale un parcours complet en pointant au-delà du dernier écran", () => {
    const steps = buildSteps(["administratif"]);
    const answered = new Set(steps.map((s) => s.id));
    expect(firstUnansweredIndex(BASE, steps, answered)).toBe(steps.length);
  });
});
