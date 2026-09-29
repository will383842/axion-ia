// @vitest-environment node
/**
 * ⛔ Une fusion se DÉFAIT et rend CHAQUE élément à sa fiche (décision A3 :
 * « réversible » ; plan §3.17 point 6, [CF-01]) : exactement ce que liste
 * `ClientFusionElement` — la personne, le projet, le rendez-vous, avec ses
 * faits et ses participants. La ligne de fusion reste (`defaiteLe`), le
 * journal dit « annulé » pour le rendez-vous rendu.
 *
 * Mutation qui fait rougir : rendre TOUT ce qui porte l'identifiant de la
 * fiche restée (`where: { clientId: absorbanteId }`) au lieu des seuls
 * éléments listés → le contre-témoin rougit.
 * Contre-témoin : une personne créée sur la fiche restée APRÈS la fusion y
 * reste.
 */

import { describe, expect, it } from "vitest";

import { defaireFusion } from "../defaire-fusion";
import { fusionnerFiches } from "../fusionner";
import { id } from "./_dossier-en-memoire";
import { ADMIN, MOTIF, sceneFusion } from "./_scene-fusion";

describe("⛔ une fusion se défait et rend chaque élément à sa fiche", () => {
  it("les éléments reviennent ; ce qui est né après reste", async () => {
    const s = sceneFusion();
    const r = await fusionnerFiches(s.base.client as never, {
      absorbeeId: s.absorbeeId,
      absorbanteId: s.absorbanteId,
      motif: MOTIF,
      reporterSiren: false,
      parAdminId: ADMIN,
    });
    // Après la fusion, une personne est créée sur la fiche restée.
    const nouvelle = id(7);
    s.base.tables["clientContact"]?.push({
      id: nouvelle,
      clientId: s.absorbanteId,
      nom: "Arrivée après",
      statut: "actif",
    });

    await defaireFusion(s.base.client as never, {
      fusionId: r.fusionId,
      motif: "Ce n'était pas le même client finalement.",
      parAdminId: ADMIN,
    });

    const t = s.base.tables;
    expect(t["clientContact"]?.find((c) => c["id"] === s.contactId)?.["clientId"]).toBe(
      s.absorbeeId,
    );
    expect(t["clientContact"]?.find((c) => c["id"] === nouvelle)?.["clientId"]).toBe(
      s.absorbanteId,
    );
    expect(t["projet"]?.[0]?.["clientId"]).toBe(s.absorbeeId);
    expect(t["rencontre"]?.[0]?.["clientId"]).toBe(s.absorbeeId);
    expect(t["fait"]?.[0]?.["clientId"]).toBe(s.absorbeeId);
    expect(t["rencontreParticipant"]?.[0]?.["clientId"]).toBe(s.absorbeeId);
    const f = t["clientFusion"]?.[0];
    expect(f?.["defaiteLe"]).toBeInstanceOf(Date);
    expect(f?.["motifDefaite"]).toMatch(/pas le même client/);
    expect(t["rencontreRattachementEvenement"]?.map((e) => e["action"])).toEqual([
      "fusionne",
      "annule",
    ]);
  });
});
