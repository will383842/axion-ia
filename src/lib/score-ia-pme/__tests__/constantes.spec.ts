/**
 * Constantes du Score IA TPE-PME : valeurs figées par les décisions de Williams
 * (20/11/2026) et les amendements de la revue experte (H : I6 ; B : T-1 bis).
 */
import { describe, it, expect } from "vitest";
import {
  CONSENT_VERSION,
  N_MIN_COMPARAISON,
  N_MIN_STATISTIQUE,
  QUESTIONNAIRE_VERSION,
  TEXTE_CONSENTEMENT,
} from "../constantes";

describe("constantes du Score IA TPE-PME", () => {
  it("T-1 bis : le texte de consentement est la phrase exacte de Williams", () => {
    expect(TEXTE_CONSENTEMENT).toBe(
      "J'accepte que mes réponses, sans nom ni e-mail, rejoignent l'Observatoire de l'IA dans les PME d'Axion-IA. Je peux les retirer avec mon code.",
    );
    expect(CONSENT_VERSION).toBe("obs-score-v1");
  });

  it("I6 : version du questionnaire", () => {
    expect(QUESTIONNAIRE_VERSION).toBe("q-score-v1");
  });

  it("seuils : 30 pour la comparaison, 5 plancher de toute statistique", () => {
    expect(N_MIN_COMPARAISON).toBe(30);
    expect(N_MIN_STATISTIQUE).toBe(5);
    expect(N_MIN_COMPARAISON).toBeGreaterThanOrEqual(N_MIN_STATISTIQUE);
  });
});
