import { describe, expect, it } from "vitest";
import { mentionIa } from "../mention-ia";

describe("mention IA — AI Act, art. 50 (D11 : libellés du plan §6.4)", () => {
  it("voix seule", () => {
    expect(mentionIa({ iaVoixGeneree: true, iaDoubleNumerique: false })).toBe(
      "Voix de synthèse générée par IA.",
    );
  });
  it("double numérique seul", () => {
    expect(mentionIa({ iaVoixGeneree: false, iaDoubleNumerique: true })).toBe(
      "Présentateur numérique généré par IA.",
    );
  });
  it("les deux", () => {
    expect(mentionIa({ iaVoixGeneree: true, iaDoubleNumerique: true })).toBe(
      "Vidéo réalisée avec un présentateur et une voix générés par IA.",
    );
  });
  it("aucun des deux : rien n'est affiché", () => {
    expect(mentionIa({ iaVoixGeneree: false, iaDoubleNumerique: false })).toBeNull();
  });
});
