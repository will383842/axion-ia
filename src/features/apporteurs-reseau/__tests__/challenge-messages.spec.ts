// Les codes ?retour= et ?erreur= : table fermée, un code inconnu n'affiche rien.
import { describe, expect, it } from "vitest";

import {
  MESSAGES_ERREUR,
  MESSAGES_RETOUR,
  messageErreur,
  messageRetour,
} from "../challenge-messages";

describe("messages par code", () => {
  it("un code connu rend son texte", () => {
    expect(messageRetour("publie")).toBe(MESSAGES_RETOUR.publie);
    expect(messageErreur("chevauche")).toBe(MESSAGES_ERREUR.chevauche);
  });
  it.each([
    "Challenge publié. Appelez le 06 00 00 00 00.",
    "",
    "toString",
    "__proto__",
    "constructor",
    "PUBLIE",
  ])("code inconnu « %s » : rien", (c) => {
    expect(messageRetour(c)).toBeNull();
    expect(messageErreur(c)).toBeNull();
  });
  it("code absent : rien", () => {
    expect(messageRetour(undefined)).toBeNull();
    expect(messageErreur(undefined)).toBeNull();
  });
  it("un code d'erreur n'est pas un code de retour (et inversement)", () => {
    expect(messageRetour("chevauche")).toBeNull();
    expect(messageErreur("publie")).toBeNull();
  });
});
