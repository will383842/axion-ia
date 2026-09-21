// Un brouillon ANTÉRIEUR au 19/09 perd son accord vivier au chargement.
//
// ── Pourquoi ce test ──────────────────────────────────────────────────────
// La case « conserver ma candidature dans le vivier 2 ans » a été retirée le
// 19/09 (décision B2 : le dossier apporteur ne part plus au CRM, le vivier n'a
// donc plus d'objet). Mais le wizard sauvegarde dans le NAVIGATEUR : un
// brouillon commencé avant le 19/09 porte encore `consentVivier: true`.
//
// Si le chargement l'étalait tel quel dans l'état, la clé survivrait en silence
// — ré-écrite à chaque sauvegarde, puis envoyée au serveur. Un accord que la
// personne n'a jamais vu dans ce formulaire-ci voyagerait jusqu'à la base. Le
// chargement l'écarte donc EXPLICITEMENT.
//
// ⚠️ Ce test vit HORS de `src/components/forms/commercial-application/` exprès :
// le contrôle de l'unité P2 exige qu'un `git grep consentVivier` sur ce dossier
// ne rende QU'UNE ligne, celle de `loadDraft` qui écarte la clé. Le nom répété
// ici l'aurait fait mentir.

import { afterEach, describe, expect, it } from "vitest";
import { COMMERCIAL_APPLICATION_STORAGE_KEY } from "@/lib/commercial-application/model";
import {
  buildSubmissionPayload,
  emptyAnswers,
  loadDraft,
  saveDraft,
  type WizardAnswers,
} from "../../../src/components/forms/commercial-application/wizard-state";

/** Un brouillon tel qu'un onglet ouvert avant le 19/09 l'a laissé. */
function ancienBrouillon(): string {
  return JSON.stringify({
    v: 1,
    screen: 4,
    answers: { ...emptyAnswers(), prenom: "Camille", consentVivier: true },
  });
}

afterEach(() => {
  window.localStorage.clear();
});

describe("un brouillon ancien, avec consentVivier: true", () => {
  it("se charge sans erreur, et garde le reste des réponses", () => {
    window.localStorage.setItem(COMMERCIAL_APPLICATION_STORAGE_KEY, ancienBrouillon());
    const charge = loadDraft();
    // Contre-témoin : un chargement qui rendrait `null` ferait passer les
    // assertions suivantes sans rien prouver.
    expect(charge, "le brouillon ancien doit rester lisible").not.toBeNull();
    expect(charge?.screen).toBe(4);
    expect(charge?.answers.prenom).toBe("Camille");
  });

  it("la clé est ABSENTE de l'état chargé", () => {
    window.localStorage.setItem(COMMERCIAL_APPLICATION_STORAGE_KEY, ancienBrouillon());
    const charge = loadDraft();
    expect(Object.keys(charge?.answers ?? {})).not.toContain("consentVivier");
  });

  it("la clé est ABSENTE de la sauvegarde suivante", () => {
    window.localStorage.setItem(COMMERCIAL_APPLICATION_STORAGE_KEY, ancienBrouillon());
    const charge = loadDraft();
    saveDraft(5, charge?.answers as WizardAnswers);
    const relu = window.localStorage.getItem(COMMERCIAL_APPLICATION_STORAGE_KEY) ?? "";
    expect(relu).toContain("Camille");
    expect(relu, "l'accord retiré ne doit pas être ré-écrit").not.toContain("consentVivier");
  });

  it("et l'envoi au serveur ne le porte pas non plus", () => {
    window.localStorage.setItem(COMMERCIAL_APPLICATION_STORAGE_KEY, ancienBrouillon());
    const charge = loadDraft();
    const envoi = buildSubmissionPayload(charge?.answers as WizardAnswers);
    expect(Object.keys(envoi)).not.toContain("consentVivier");
  });
});
