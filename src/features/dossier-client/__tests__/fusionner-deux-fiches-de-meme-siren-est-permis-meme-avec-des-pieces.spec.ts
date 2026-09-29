// @vitest-environment node
/**
 * Fusionner deux fiches de MÊME SIREN est permis, même quand elles portent
 * des pièces (factures) : Axion Partners suit le SIREN, qui ne change pas
 * (plan §3.17). Les personnes, projets, rendez-vous et faits passent sur la
 * fiche qui reste ; les FACTURES restent sur la fiche absorbée.
 *
 * Contre-témoin (repli prudent tant que Partners n'a pas confirmé) : un SIREN
 * d'un seul côté, avec une facture sur la fiche SANS SIREN, attend.
 */

import { describe, expect, it } from "vitest";

import { fusionnerFiches } from "../fusionner";
import { ADMIN, MOTIF, sceneFusion } from "./_scene-fusion";

describe("fusionner deux fiches de même SIREN est permis même avec des pièces", () => {
  it("tout passe, sauf les pièces", async () => {
    const s = sceneFusion({
      sirenAbsorbee: "123456789",
      sirenAbsorbante: "123456789",
      factureSurAbsorbee: true,
    });
    const r = await fusionnerFiches(s.base.client as never, {
      absorbeeId: s.absorbeeId,
      absorbanteId: s.absorbanteId,
      motif: MOTIF,
      reporterSiren: true,
      parAdminId: ADMIN,
    });
    expect(r).toMatchObject({ contacts: 1, projets: 1, rencontres: 1 });
    const t = s.base.tables;
    expect(t["clientContact"]?.[0]?.["clientId"]).toBe(s.absorbanteId);
    expect(t["projet"]?.[0]?.["clientId"]).toBe(s.absorbanteId);
    expect(t["rencontre"]?.[0]?.["clientId"]).toBe(s.absorbanteId);
    expect(t["fait"]?.[0]?.["clientId"]).toBe(s.absorbanteId);
    expect(t["factureFormation"]?.[0]?.["clientId"]).toBe(s.absorbeeId);
    expect(s.base.brut).toContain("SET CONSTRAINTS ALL DEFERRED");
  });

  it("contre-témoin : SIREN d'un seul côté + facture sur la fiche sans SIREN : attente", async () => {
    const s = sceneFusion({ sirenAbsorbante: "123456789", factureSurAbsorbee: true });
    await expect(
      fusionnerFiches(s.base.client as never, {
        absorbeeId: s.absorbeeId,
        absorbanteId: s.absorbanteId,
        motif: MOTIF,
        reporterSiren: true,
        parAdminId: ADMIN,
      }),
    ).rejects.toThrow(/Axion Partners/);
    expect(s.base.tables["clientFusion"] ?? []).toHaveLength(0);
  });

  it("un motif trop court est refusé", async () => {
    const s = sceneFusion();
    await expect(
      fusionnerFiches(s.base.client as never, {
        absorbeeId: s.absorbeeId,
        absorbanteId: s.absorbanteId,
        motif: "doublon",
        reporterSiren: false,
        parAdminId: ADMIN,
      }),
    ).rejects.toThrow(/10 caractères/);
  });
});
