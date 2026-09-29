// @vitest-environment node
/**
 * ⛔ Une fusion DÉFAITE n'est JAMAIS rejouée vers Axion Partners : le rejeu
 * lit `client_fusions` avec `defaite_le IS NULL` (`FUSIONS_A_REJOUER`). Aucun
 * événement « fiche fusionnée » ne partira pour elle, ni avant ni après.
 *
 * Mutation qui fait rougir : retirer `defaiteLe: null` de
 * `FUSIONS_A_REJOUER` → la fusion défaite sort du rejeu.
 * Contre-témoin : avant « Défaire », elle y est.
 */

import { describe, expect, it } from "vitest";

import { defaireFusion } from "../defaire-fusion";
import { FUSIONS_A_REJOUER, fusionnerFiches, fusionsARejouerVersPartners } from "../fusionner";
import { ADMIN, MOTIF, sceneFusion } from "./_scene-fusion";

describe("⛔ une fusion défaite n'est jamais rejouée vers Partners", () => {
  it("dans le rejeu avant « Défaire », plus après", async () => {
    const s = sceneFusion();
    const r = await fusionnerFiches(s.base.client as never, {
      absorbeeId: s.absorbeeId,
      absorbanteId: s.absorbanteId,
      motif: MOTIF,
      reporterSiren: false,
      parAdminId: ADMIN,
    });
    expect(await fusionsARejouerVersPartners(s.base.client as never)).toHaveLength(1);
    await defaireFusion(s.base.client as never, {
      fusionId: r.fusionId,
      motif: "Deux entreprises distinctes, vérifié.",
      parAdminId: ADMIN,
    });
    expect(await fusionsARejouerVersPartners(s.base.client as never)).toHaveLength(0);
    expect(FUSIONS_A_REJOUER).toMatchObject({ defaiteLe: null, emiseVersPartnersLe: null });
  });
});
