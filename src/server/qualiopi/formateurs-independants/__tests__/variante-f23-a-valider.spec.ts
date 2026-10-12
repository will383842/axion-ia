// M1 (lot A) — l'écran de validation propose la variante chiffrée de F23 sous le nom
// exact que lit l'envoi (`champsF23Honoraires`).
import { describe, expect, it } from "vitest";

import { estTexteFormateurAValider } from "@/server/email/textes-formateurs-a-valider";

import { VARIANTE_F23_HONORAIRES } from "../proposition-chiffree";

describe("variante F23 à valider", () => {
  it("porte le nom lu par l'envoi", () => {
    expect(estTexteFormateurAValider("formateur-mission-proposee", VARIANTE_F23_HONORAIRES)).toBe(
      true,
    );
  });
});
