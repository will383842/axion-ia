// @vitest-environment node
/**
 * « Défaire » RÉTABLIT le SIREN d'origine de la fiche absorbée quand la
 * fusion en avait reporté un (`sirenAbsorbeAvant`). Et quand deux fiches au
 * MÊME SIREN redeviennent vivantes, ce doublon choisi est TRACÉ comme un
 * « créer quand même » (`ActivityLog` `client.creation_forcee`, avec le motif).
 *
 * Contre-témoin : une fusion SANS report ne touche pas au SIREN en se défaisant.
 */

import { describe, expect, it } from "vitest";

import { ACTION_DOUBLON_PAR_DEFUSION, defaireFusion } from "../defaire-fusion";
import { fusionnerFiches } from "../fusionner";
import { ADMIN, MOTIF, sceneFusion } from "./_scene-fusion";

const MOTIF_DEFAIRE = "Erreur de fusion, fiches à séparer.";

describe("défaire une fusion rétablit le SIREN d'origine", () => {
  it("le SIREN reporté repart", async () => {
    const s = sceneFusion({ sirenAbsorbante: "123456789" });
    const r = await fusionnerFiches(s.base.client as never, {
      absorbeeId: s.absorbeeId,
      absorbanteId: s.absorbanteId,
      motif: MOTIF,
      reporterSiren: true,
      parAdminId: ADMIN,
    });
    await defaireFusion(s.base.client as never, {
      fusionId: r.fusionId,
      motif: MOTIF_DEFAIRE,
      parAdminId: ADMIN,
    });
    expect(s.base.tables["client"]?.find((c) => c["id"] === s.absorbeeId)?.["siren"]).toBeNull();
    expect(s.base.tables["activityLog"] ?? []).toHaveLength(0);
  });

  it("deux fiches vivantes au même SIREN : le doublon est tracé", async () => {
    const s = sceneFusion({ sirenAbsorbee: "123456789", sirenAbsorbante: "123456789" });
    const r = await fusionnerFiches(s.base.client as never, {
      absorbeeId: s.absorbeeId,
      absorbanteId: s.absorbanteId,
      motif: MOTIF,
      reporterSiren: false,
      parAdminId: ADMIN,
    });
    await defaireFusion(s.base.client as never, {
      fusionId: r.fusionId,
      motif: MOTIF_DEFAIRE,
      parAdminId: ADMIN,
    });
    expect(s.base.tables["activityLog"]?.[0]).toMatchObject({
      action: ACTION_DOUBLON_PAR_DEFUSION,
      targetId: s.absorbeeId,
    });
  });

  it("contre-témoin : sans report, le SIREN n'est pas touché", async () => {
    const s = sceneFusion({ sirenAbsorbee: null, sirenAbsorbante: null });
    const r = await fusionnerFiches(s.base.client as never, {
      absorbeeId: s.absorbeeId,
      absorbanteId: s.absorbanteId,
      motif: MOTIF,
      reporterSiren: true,
      parAdminId: ADMIN,
    });
    expect(s.base.tables["clientFusion"]?.[0]?.["sirenReporte"]).toBe(false);
    await defaireFusion(s.base.client as never, {
      fusionId: r.fusionId,
      motif: MOTIF_DEFAIRE,
      parAdminId: ADMIN,
    });
    expect(s.base.tables["client"]?.find((c) => c["id"] === s.absorbeeId)?.["siren"]).toBeNull();
  });
});
