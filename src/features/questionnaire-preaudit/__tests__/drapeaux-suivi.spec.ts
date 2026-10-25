/** Les interrupteurs du suivi du questionnaire (2026-10-26) : ABSENT = ÉTEINT, seul "true" allume. */

import { describe, expect, it } from "vitest";

import { adresseEssai, modeConfirmations, modeRelances, modeTelegram } from "../drapeaux-suivi";

describe("drapeaux du suivi", () => {
  const cas: Array<[string | undefined, string]> = [
    [undefined, "eteint"],
    ["false", "eteint"],
    ["", "eteint"],
    ["TRUE", "eteint"],
    ["1", "eteint"],
    [" true", "eteint"],
    ["essai", "essai"],
    ["true", "actif"],
  ];
  it.each(cas)("%s → %s, pour les trois", (valeur, attendu) => {
    expect(modeRelances({ QUESTIONNAIRE_RELANCES_ENABLED: valeur })).toBe(attendu);
    expect(modeConfirmations({ QUESTIONNAIRE_CONFIRMATIONS_ENABLED: valeur })).toBe(attendu);
    expect(modeTelegram({ QUESTIONNAIRE_TELEGRAM_ENABLED: valeur })).toBe(attendu);
  });

  it("chacun lit SA variable", () => {
    const env = { QUESTIONNAIRE_RELANCES_ENABLED: "true" };
    expect(modeRelances(env)).toBe("actif");
    expect(modeConfirmations(env)).toBe("eteint");
    expect(modeTelegram(env)).toBe("eteint");
  });

  it("adresse d'essai : lue dans l'environnement, refusée si invalide", () => {
    expect(adresseEssai({})).toBeNull();
    expect(adresseEssai({ QUESTIONNAIRE_PREAUDIT_ADRESSE_ESSAI: "pas-une-adresse" })).toBeNull();
    expect(adresseEssai({ QUESTIONNAIRE_PREAUDIT_ADRESSE_ESSAI: " essai@axion-ia.com " })).toBe(
      "essai@axion-ia.com",
    );
  });
});
