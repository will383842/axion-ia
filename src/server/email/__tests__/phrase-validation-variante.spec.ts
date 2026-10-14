// Relecture #1510, petit défaut 2 — la phrase de l'écran d'un gabarit dit ce que
// l'envoi exige VRAIMENT. F23 chiffrée : seule la variante est exigée (le texte de
// base n'est pas proposé à la validation) ; ne jamais lui annoncer « le texte de
// base ET elle ».
import { describe, expect, it } from "vitest";

import { phraseValidationVariante } from "../textes-formateurs-a-valider";

describe("phraseValidationVariante", () => {
  it("F23 chiffrée : seule la variante est exigée", () => {
    const p = phraseValidationVariante("formateur-mission-proposee");
    expect(p).not.toMatch(/texte de base/);
    expect(p).toMatch(/si elle est validée/);
  });

  it("une variante dont le texte de base se valide aussi : les deux sont exigés", () => {
    expect(phraseValidationVariante("formateur-mission-retiree")).toMatch(/texte de base ET elle/);
  });
});
