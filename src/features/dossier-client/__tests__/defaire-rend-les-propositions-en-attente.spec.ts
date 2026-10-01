// @vitest-environment node
/**
 * ⛔ « Défaire la fusion » rend aussi les PROPOSITIONS en attente (V1-05) :
 * un rendez-vous « à classer » proposé à la fiche absorbée est redirigé vers
 * la fiche restée par la fusion ; « Défaire » le propose de nouveau à la
 * fiche absorbée, avec son motif — sinon « Confirmer le client proposé »
 * le rangerait chez le mauvais client.
 *
 * La fusion consigne chaque proposition redirigée dans le journal de
 * rattachement (`propose`, ancienne fiche → fiche restée, daté de la fusion),
 * sans schéma nouveau ; « Défaire » relit ce journal.
 *
 * Mutations qui font rougir :
 *   · ne rien consigner à la fusion : « Défaire » ne sait plus quoi rendre ;
 *   · ne pas rétablir `clientProposeId` dans `defaireFusion`.
 * Contre-témoin : une proposition faite À la fiche restée après la fusion,
 * et une proposition déjà confirmée entre-temps, ne bougent pas.
 */

import { describe, expect, it } from "vitest";

import { defaireFusion } from "../defaire-fusion";
import { fusionnerFiches } from "../fusionner";
import { id } from "./_dossier-en-memoire";
import { ADMIN, MOTIF, sceneFusion } from "./_scene-fusion";

function aClasser(clientProposeId: string) {
  return {
    id: id(5),
    source: "calendly",
    type: "visio",
    titre: "Discutons",
    clientId: null,
    projetId: null,
    clientProposeId,
    motifProposition: "email_calendly",
    rattachementStatut: "propose",
    calendlyEventId: null,
    estTestInterne: false,
  };
}

describe("⛔ défaire une fusion rend les propositions en attente", () => {
  it("la proposition redirigée revient à la fiche absorbée, avec son motif", async () => {
    const s = sceneFusion();
    const proposee = aClasser(s.absorbeeId);
    s.base.tables["rencontre"]?.push(proposee);
    const r = await fusionnerFiches(s.base.client as never, {
      absorbeeId: s.absorbeeId,
      absorbanteId: s.absorbanteId,
      motif: MOTIF,
      reporterSiren: false,
      parAdminId: ADMIN,
    });
    const rdv = () => s.base.tables["rencontre"]?.find((x) => x["id"] === proposee.id);
    expect(rdv()?.["clientProposeId"]).toBe(s.absorbanteId);

    // Contre-témoin : une proposition née APRÈS la fusion, faite à la fiche restée.
    const nee = aClasser(s.absorbanteId);
    s.base.tables["rencontre"]?.push(nee);

    await defaireFusion(s.base.client as never, {
      fusionId: r.fusionId,
      motif: "Ce n'était pas le même client finalement.",
      parAdminId: ADMIN,
    });
    expect(rdv()?.["clientProposeId"]).toBe(s.absorbeeId);
    expect(rdv()?.["motifProposition"]).toBe("email_calendly");
    expect(s.base.tables["rencontre"]?.find((x) => x["id"] === nee.id)?.["clientProposeId"]).toBe(
      s.absorbanteId,
    );
    const journal = (s.base.tables["rencontreRattachementEvenement"] ?? []).filter(
      (x) => x["rencontreId"] === proposee.id,
    );
    expect(journal.map((x) => [x["action"], x["nouveauClientId"]])).toEqual([
      ["propose", s.absorbanteId],
      ["propose", s.absorbeeId],
    ]);
  });

  it("une proposition confirmée entre-temps n'est pas défaite", async () => {
    const s = sceneFusion();
    const proposee = aClasser(s.absorbeeId);
    s.base.tables["rencontre"]?.push(proposee);
    const r = await fusionnerFiches(s.base.client as never, {
      absorbeeId: s.absorbeeId,
      absorbanteId: s.absorbanteId,
      motif: MOTIF,
      reporterSiren: false,
      parAdminId: ADMIN,
    });
    const rdv = s.base.tables["rencontre"]?.find((x) => x["id"] === proposee.id);
    if (rdv) Object.assign(rdv, { clientId: s.absorbanteId, rattachementStatut: "valide" });
    await defaireFusion(s.base.client as never, {
      fusionId: r.fusionId,
      motif: "Ce n'était pas le même client finalement.",
      parAdminId: ADMIN,
    });
    expect(rdv?.["clientId"]).toBe(s.absorbanteId);
    expect(rdv?.["clientProposeId"]).toBe(s.absorbanteId);
  });
});
