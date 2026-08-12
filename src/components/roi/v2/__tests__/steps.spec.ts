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
