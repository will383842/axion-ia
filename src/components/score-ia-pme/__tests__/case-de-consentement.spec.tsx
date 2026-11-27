// La case = la phrase de Williams, mot pour mot (version `obs-score-v1`). Égalité STRICTE du rendu.

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AjoutObservatoire } from "../AjoutObservatoire";
import { CONSENT_VERSION, TEXTE_CONSENTEMENT } from "@/lib/score-ia-pme/constantes";

vi.mock("@/server/actions/score-ia-pme/ajouter-a-l-observatoire", () => ({
  ajouterALObservatoire: vi.fn(),
}));

const PHRASE_DE_WILLIAMS =
  "J'accepte que mes réponses, sans nom ni e-mail, rejoignent l'Observatoire de l'IA dans les PME d'Axion-IA. Je peux les retirer avec mon code.";

describe("case de consentement", () => {
  it("la constante est exactement la phrase validée, version obs-score-v1", () => {
    expect(TEXTE_CONSENTEMENT).toBe(PHRASE_DE_WILLIAMS);
    expect(CONSENT_VERSION).toBe("obs-score-v1");
  });

  it("le libellé rendu est strictement égal à la phrase, et la case n'est PAS cochée", () => {
    render(
      <AjoutObservatoire
        reponses={{}}
        debutParcours={0}
        encadre={["x"]}
        hrefConfidentialite="/fr/politique-confidentialite"
      />,
    );
    const caseACocher = screen.getByRole("checkbox") as HTMLInputElement;
    expect(caseACocher.checked).toBe(false);
    expect(caseACocher.closest("label")?.textContent).toBe(PHRASE_DE_WILLIAMS);
  });

  it("le bouton « Ajouter mes réponses » est actif (jamais grisé sans explication)", () => {
    render(
      <AjoutObservatoire
        reponses={{}}
        debutParcours={0}
        encadre={["x"]}
        hrefConfidentialite="/x"
      />,
    );
    expect(
      (screen.getByRole("button", { name: "Ajouter mes réponses" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
