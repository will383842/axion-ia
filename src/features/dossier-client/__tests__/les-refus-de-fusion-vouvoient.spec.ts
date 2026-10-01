/**
 * m-6 (2e vérification du chantier visio) — vouvoiement partout : le refus
 * de fusion de deux fiches aux SIREN différents tutoyait Will
 * (« corrige d'abord son SIREN »).
 *
 * Mutation qui rougit : remettre « corrige ».
 */

import { describe, expect, it } from "vitest";

import { MESSAGE_DEUX_SIREN, MESSAGE_SIREN_SUR_L_ABSORBEE } from "../fusionner";

describe("m-6 — les refus de fusion vouvoient", () => {
  it.each([MESSAGE_DEUX_SIREN, MESSAGE_SIREN_SUR_L_ABSORBEE])("%s", (m) => {
    expect(m).not.toMatch(/\b(corrige|choisis|vérifie|fusionne|tu|ton|ta|tes)\b/i);
  });

  it("le refus dit quoi faire, au vouvoiement", () => {
    expect(MESSAGE_DEUX_SIREN).toContain("corrigez d'abord son SIREN");
  });
});
