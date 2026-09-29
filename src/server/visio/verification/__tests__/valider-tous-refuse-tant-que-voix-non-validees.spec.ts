/**
 * ⛔ VALIDER TOUS REFUSE TANT QUE LES VOIX NE SONT PAS VALIDÉES (plan §3.13).
 *
 * Quand la piste client porte PLUSIEURS voix, Will dit d'abord qui est qui
 * (« CLIENT_1 = … ») : sans cela, un budget dit par l'associé serait rangé
 * comme dit par la gérante. `exigerVoixAttribuees` refuse la validation du
 * compte rendu (et « Valider tous » de la PR 4, qui l'appelle en tête) tant
 * qu'une voix reste sans personne.
 *
 * Mutation qui rougit : faire rendre `[]` à `voixNonAttribuees` → la
 * validation passe avec deux voix inconnues. Contre-témoin : une seule voix
 * n'exige rien ; deux voix attribuées passent. Angle mort : la diarisation
 * peut fusionner deux personnes en une voix — la piste client n'a alors
 * qu'« une » voix (signal G16 : un seul accord retrouvé).
 */

import { describe, expect, it } from "vitest";

import {
  exigerVoixAttribuees,
  GesteRefuse,
  validerCompteRendu,
  voixNonAttribuees,
} from "../../gestes-compte-rendu";
import { baseEspion } from "../../../../../tests/outils/base-espion";

const VALIDEE = new Date("2026-10-06T11:00:00Z");

describe("valider tous refuse tant que les voix ne sont pas validées", () => {
  it("deux voix, une seule attribuée → refus nommant la voix manquante", async () => {
    expect(voixNonAttribuees(["A", "B"], [{ etiquetteVoix: "A", voixValideeLe: VALIDEE }])).toEqual(
      ["B"],
    );
    const e = baseEspion({
      "transcriptionSegment.findMany": () => [{ locuteurBrut: "A" }, { locuteurBrut: "B" }],
      "rencontreParticipant.findMany": () => [{ etiquetteVoix: "A", voixValideeLe: VALIDEE }],
    });
    await expect(exigerVoixAttribuees(e.base, "r1")).rejects.toThrow(/CLIENT_2/);
  });

  it("la validation du compte rendu est refusée, rien n'est écrit", async () => {
    const e = baseEspion({
      "compteRendu.findUnique": () => ({ id: "cr1", rencontreId: "r1", statut: "a_valider" }),
      "transcriptionSegment.findMany": () => [{ locuteurBrut: "A" }, { locuteurBrut: "B" }],
      "rencontreParticipant.findMany": () => [],
    });
    await expect(
      validerCompteRendu(e.base, { compteRenduId: "cr1", parAdminId: "a", maintenant: VALIDEE }),
    ).rejects.toBeInstanceOf(GesteRefuse);
    expect(e.de("compteRendu", "update")).toHaveLength(0);
  });

  it("contre-témoin : une seule voix, ou toutes attribuées → validé, purge programmée", async () => {
    expect(voixNonAttribuees(["A"], [])).toEqual([]);
    const e = baseEspion({
      "compteRendu.findUnique": () => ({ id: "cr1", rencontreId: "r1", statut: "a_valider" }),
      "transcriptionSegment.findMany": () => [{ locuteurBrut: "A" }, { locuteurBrut: "B" }],
      "rencontreParticipant.findMany": () => [
        { etiquetteVoix: "A", voixValideeLe: VALIDEE },
        { etiquetteVoix: "B", voixValideeLe: VALIDEE },
      ],
    });
    await validerCompteRendu(e.base, {
      compteRenduId: "cr1",
      parAdminId: "a",
      maintenant: VALIDEE,
    });
    expect(e.de("compteRendu", "update")[0]!.args).toMatchObject({ data: { statut: "valide" } });
    expect(
      e.sqls.some((s) => s.sql.includes("traitements_visio") && s.valeurs.includes("purger_audio")),
    ).toBe(true);
  });
});
