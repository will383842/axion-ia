/**
 * ⛔ VALIDER TOUS REFUSE TANT QUE LES VOIX NE SONT PAS VALIDÉES (plan §3.13),
 * ET LA CORRESPONDANCE DES VOIX PEUT TOUJOURS ÊTRE COMPLÉTÉE.
 *
 * Quand la piste client porte PLUSIEURS voix, Will dit d'abord qui est qui
 * (« CLIENT_1 = … ») : sans cela, un budget dit par l'associé serait rangé
 * comme dit par la gérante. `exigerVoixAttribuees` refuse la validation du
 * compte rendu (et « Valider tous » de la PR 4) tant qu'une voix reste sans
 * personne.
 *
 * Et ce refus ne doit JAMAIS devenir une impasse (le son n'est purgé qu'à
 * 30 jours sans validation) : l'attribution se lit sur les PASSAGES, donc une
 * même personne peut porter deux voix sans que la seconde efface la première ;
 * une personne imprévue s'ajoute comme contact (« Ajouter comme contact ») ;
 * l'écho de la voix de Williams s'attribue à Williams.
 *
 * Mutations qui rougissent : faire rendre `[]` à `voixNonAttribuees` → la
 * validation passe avec deux voix inconnues ; relire l'attribution sur
 * l'étiquette de la PERSONNE (une seule voix par personne) → deux voix d'une
 * même personne bloquent ; retirer la création du participant dans
 * `ajouterPersonnePourVoix`. Contre-témoin : une seule voix n'exige rien ;
 * deux voix attribuées passent. Angle mort : la diarisation peut fusionner
 * deux personnes en une voix — la piste client n'a alors qu'« une » voix
 * (signal G16 : un seul accord retrouvé).
 */

import { describe, expect, it } from "vitest";

import {
  ajouterPersonnePourVoix,
  exigerVoixAttribuees,
  GesteRefuse,
  marquerVoixDeWilliams,
  validerCompteRendu,
  voixNonAttribuees,
} from "../../gestes-compte-rendu";
import { baseEspion } from "../../../../../tests/outils/base-espion";

const VALIDEE = new Date("2026-10-06T11:00:00Z");
const segs = (...l: Array<[string, string | null]>) =>
  l.map(([locuteurBrut, participantId]) => ({ locuteurBrut, participantId }));

describe("valider tous refuse tant que les voix ne sont pas validées", () => {
  it("deux voix, une seule attribuée → refus nommant la voix manquante", async () => {
    expect(
      voixNonAttribuees(
        ["A", "B"],
        [
          { voix: "A", participantId: "p1" },
          { voix: "B", participantId: null },
        ],
      ),
    ).toEqual(["B"]);
    const e = baseEspion({
      "transcriptionSegment.findMany": () => segs(["A", "p1"], ["B", null]),
    });
    await expect(exigerVoixAttribuees(e.base, "r1")).rejects.toThrow(/CLIENT_2/);
  });

  it("la validation du compte rendu est refusée, rien n'est écrit", async () => {
    const e = baseEspion({
      "compteRendu.findUnique": () => ({ id: "cr1", rencontreId: "r1", statut: "a_valider" }),
      "transcriptionSegment.findMany": () => segs(["A", null], ["B", null]),
    });
    await expect(
      validerCompteRendu(e.base, { compteRenduId: "cr1", parAdminId: "a", maintenant: VALIDEE }),
    ).rejects.toBeInstanceOf(GesteRefuse);
    expect(e.de("compteRendu", "update")).toHaveLength(0);
  });

  it("une même personne peut porter deux voix : la seconde n'efface pas la première", async () => {
    const e = baseEspion({
      "transcriptionSegment.findMany": () => segs(["A", "p1"], ["B", "p1"]),
    });
    await expect(exigerVoixAttribuees(e.base, "r1")).resolves.toBeUndefined();
  });

  it("« Ajouter comme contact » : la personne imprévue devient contact et participant, sa voix lui revient", async () => {
    const e = baseEspion({
      "rencontre.findUnique": () => ({ id: "r1", clientId: "c1" }),
      "clientContact.create": () => ({ id: "k1" }),
      "rencontreParticipant.create": () => ({ id: "p2" }),
    });
    await ajouterPersonnePourVoix(e.base, {
      rencontreId: "r1",
      voix: "B",
      nom: "  Camille   Exemple ",
      fonction: "associée",
      parAdminId: "a",
      maintenant: VALIDEE,
    });
    expect(e.de("clientContact", "create")[0]!.args).toMatchObject({
      data: { clientId: "c1", nom: "Camille Exemple", fonction: "associée", origine: "saisie" },
    });
    expect(e.de("rencontreParticipant", "create")[0]!.args).toMatchObject({
      data: { rencontreId: "r1", clientId: "c1", contactId: "k1", role: "client" },
    });
    expect(e.de("transcriptionSegment", "updateMany")[0]!.args).toMatchObject({
      where: { locuteurBrut: "B" },
      data: { participantId: "p2", etiquetteVoix: "B" },
    });
  });

  it("sans fiche client, la personne est ajoutée au rendez-vous seulement ; un nom vide est refusé", async () => {
    const e = baseEspion({
      "rencontre.findUnique": () => ({ id: "r1", clientId: null }),
      "rencontreParticipant.create": () => ({ id: "p3" }),
    });
    await ajouterPersonnePourVoix(e.base, {
      rencontreId: "r1",
      voix: "B",
      nom: "Dominique",
      fonction: null,
      parAdminId: "a",
      maintenant: VALIDEE,
    });
    expect(e.de("clientContact", "create")).toHaveLength(0);
    expect(e.de("rencontreParticipant", "create")[0]!.args).toMatchObject({
      data: { contactId: null, role: "client" },
    });
    await expect(
      ajouterPersonnePourVoix(e.base, {
        rencontreId: "r1",
        voix: "B",
        nom: " ",
        fonction: null,
        parAdminId: "a",
        maintenant: VALIDEE,
      }),
    ).rejects.toBeInstanceOf(GesteRefuse);
  });

  it("« C'est ma voix (écho) » : la voix est attribuée à Williams", async () => {
    const e = baseEspion({
      "rencontreParticipant.findFirst": () => ({ id: "pw" }),
    });
    await marquerVoixDeWilliams(e.base, { rencontreId: "r1", voix: "B", maintenant: VALIDEE });
    expect(e.de("rencontreParticipant", "findFirst")[0]!.args).toMatchObject({
      where: { role: "axion" },
    });
    expect(e.de("transcriptionSegment", "updateMany")[0]!.args).toMatchObject({
      data: { participantId: "pw" },
    });
  });

  it("contre-témoin : une seule voix, ou toutes attribuées → validé, purge programmée", async () => {
    expect(voixNonAttribuees(["A"], [{ voix: "A", participantId: null }])).toEqual([]);
    const e = baseEspion({
      "compteRendu.findUnique": () => ({ id: "cr1", rencontreId: "r1", statut: "a_valider" }),
      "transcriptionSegment.findMany": () => segs(["A", "p1"], ["B", "p2"]),
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
