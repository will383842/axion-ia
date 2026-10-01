/**
 * UX-03 : valider un compte rendu ferme, dans la même transaction, l'alerte
 * « un compte rendu de rendez-vous attend votre validation » de CETTE
 * rencontre — la console ne garde pas une alerte pour un travail fait.
 *
 * Mutation qui rougit : retirer l'`alerteSysteme.updateMany` de
 * `validerCompteRendu`.
 */
import { beforeAll, describe, expect, it } from "vitest";

import { CODES_ALERTES_CIRCUIT } from "../alertes-circuit";
import { validerCompteRendu } from "../gestes-compte-rendu";
import { baseEspion } from "../../../../tests/outils/base-espion";
import { CLE_DE_TEST } from "../../../../tests/outils/fixtures-enregistreur";

beforeAll(() => {
  process.env["PII_ENCRYPTION_KEY"] = CLE_DE_TEST;
});

const RENCONTRE = "00000000-0000-4000-8000-000000000031";
const MAINTENANT = new Date("2026-10-06T11:00:00Z");

describe("valider ferme l'alerte du compte rendu à valider", () => {
  it("l'alerte de la rencontre est résolue avec la validation", async () => {
    const e = baseEspion({
      "compteRendu.findUnique": () => ({ id: "cr1", rencontreId: RENCONTRE, statut: "a_valider" }),
      "enregistrement.findMany": () => [],
    });
    await validerCompteRendu(e.base, {
      compteRenduId: "cr1",
      parAdminId: "a",
      maintenant: MAINTENANT,
    });
    const fermees = e.de("alerteSysteme", "updateMany");
    expect(fermees).toHaveLength(1);
    expect(fermees[0]!.args).toMatchObject({
      where: {
        code: CODES_ALERTES_CIRCUIT.compteRenduAValider,
        cibleType: "Rencontre",
        cibleId: RENCONTRE,
        resolue: false,
      },
      data: { resolue: true, resolueAt: MAINTENANT },
    });
  });
});
