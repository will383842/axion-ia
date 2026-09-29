// @vitest-environment node
/**
 * Une fusion est JOURNALISÉE pour être rejouée vers Axion Partners le jour
 * où son contrat portera l'événement « fiche fusionnée » (REQ-CPL-014) :
 * `ClientFusion` (qui, quand, pourquoi) et un `ClientFusionElement` par
 * personne, projet et rendez-vous déplacé. L'événement est PRÉPARÉ
 * (`fusionsARejouerVersPartners`) et JAMAIS émis : `emiseVersPartnersLe`
 * reste nul, rien ne part.
 */

import { describe, expect, it } from "vitest";

import { fusionnerFiches, fusionsARejouerVersPartners } from "../fusionner";
import { ADMIN, MOTIF, sceneFusion } from "./_scene-fusion";

describe("une fusion est journalisée pour être rejouée vers Partners", () => {
  it("la ligne, les éléments, et l'événement préparé non émis", async () => {
    const s = sceneFusion();
    const r = await fusionnerFiches(s.base.client as never, {
      absorbeeId: s.absorbeeId,
      absorbanteId: s.absorbanteId,
      motif: MOTIF,
      reporterSiren: false,
      parAdminId: ADMIN,
    });
    const f = s.base.tables["clientFusion"]?.[0];
    expect(f).toMatchObject({
      absorbeId: s.absorbeeId,
      absorbantId: s.absorbanteId,
      parAdminId: ADMIN,
      emiseVersPartnersLe: null,
    });
    expect(
      s.base.tables["clientFusionElement"]?.map((e) => `${e["type"]}:${e["elementId"]}`).sort(),
    ).toEqual(
      [`contact:${s.contactId}`, `projet:${s.projetId}`, `rencontre:${s.rencontreId}`].sort(),
    );
    const rejeu = await fusionsARejouerVersPartners(s.base.client as never);
    expect(rejeu).toEqual([
      expect.objectContaining({
        type: "client.fusionne",
        fusionId: r.fusionId,
        absorbeeId: s.absorbeeId,
        absorbanteId: s.absorbanteId,
      }),
    ]);
  });
});
