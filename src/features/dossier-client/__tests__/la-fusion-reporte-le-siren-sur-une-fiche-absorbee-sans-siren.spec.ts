// @vitest-environment node
/**
 * La fusion REPORTE le SIREN de la fiche qui reste sur la fiche absorbée
 * qui n'en avait pas (case cochée par défaut) : ses pièces restent sous le
 * même SIREN, celui que suit Axion Partners. L'ancien (aucun) est gardé dans
 * `sirenAbsorbeAvant` pour que « Défaire » le rétablisse.
 *
 * Contre-témoin : case décochée, le SIREN de la fiche absorbée n'est pas touché.
 */

import { describe, expect, it } from "vitest";

import { fusionnerFiches } from "../fusionner";
import { ADMIN, MOTIF, sceneFusion } from "./_scene-fusion";

describe("la fusion reporte le SIREN sur une fiche absorbée sans SIREN", () => {
  it("case cochée : le SIREN est reporté, l'ancien est gardé", async () => {
    const s = sceneFusion({ sirenAbsorbante: "123456789" });
    await fusionnerFiches(s.base.client as never, {
      absorbeeId: s.absorbeeId,
      absorbanteId: s.absorbanteId,
      motif: MOTIF,
      reporterSiren: true,
      parAdminId: ADMIN,
    });
    const absorbee = s.base.tables["client"]?.find((c) => c["id"] === s.absorbeeId);
    expect(absorbee?.["siren"]).toBe("123456789");
    expect(s.base.tables["clientFusion"]?.[0]).toMatchObject({
      sirenReporte: true,
      sirenAbsorbeAvant: null,
    });
  });

  it("contre-témoin : case décochée, rien n'est reporté", async () => {
    const s = sceneFusion({ sirenAbsorbante: "123456789" });
    await fusionnerFiches(s.base.client as never, {
      absorbeeId: s.absorbeeId,
      absorbanteId: s.absorbanteId,
      motif: MOTIF,
      reporterSiren: false,
      parAdminId: ADMIN,
    });
    const absorbee = s.base.tables["client"]?.find((c) => c["id"] === s.absorbeeId);
    expect(absorbee?.["siren"]).toBeNull();
    expect(s.base.tables["clientFusion"]?.[0]?.["sirenReporte"]).toBe(false);
  });
});
