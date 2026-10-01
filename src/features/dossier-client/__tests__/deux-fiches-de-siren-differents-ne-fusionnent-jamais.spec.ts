// @vitest-environment node
/**
 * ⛔ Deux fiches de SIREN DIFFÉRENTS ne fusionnent JAMAIS : ce sont deux
 * entreprises (plan §3.17 point 6). Le refus dit quoi faire (« corrigez
 * d'abord son SIREN »), et rien n'est écrit.
 *
 * Mutation qui fait rougir : rendre `{ permise: true }` dans la branche
 * « deux SIREN » de `deciderFusion` → rouge.
 * Contre-témoin : le même SIREN des deux côtés fusionne.
 */

import { describe, expect, it } from "vitest";

import { deciderFusion, fusionnerFiches, MESSAGE_DEUX_SIREN } from "../fusionner";
import { ADMIN, MOTIF, sceneFusion } from "./_scene-fusion";

describe("⛔ deux fiches de SIREN différents ne fusionnent jamais", () => {
  it("la règle", () => {
    const d = deciderFusion(
      { id: "a", siren: "123456789", aUneFacture: false },
      { id: "b", siren: "987654321", aUneFacture: false },
      { reporterSiren: true },
    );
    expect(d).toEqual({ permise: false, motif: MESSAGE_DEUX_SIREN });
  });

  it("dans la base : refus, et rien d'écrit", async () => {
    const s = sceneFusion({ sirenAbsorbee: "123456789", sirenAbsorbante: "987654321" });
    await expect(
      fusionnerFiches(s.base.client as never, {
        absorbeeId: s.absorbeeId,
        absorbanteId: s.absorbanteId,
        motif: MOTIF,
        reporterSiren: true,
        parAdminId: ADMIN,
      }),
    ).rejects.toThrow(/deux entreprises différentes/);
    expect(s.base.tables["clientFusion"] ?? []).toHaveLength(0);
    expect(s.base.tables["clientContact"]?.[0]?.["clientId"]).toBe(s.absorbeeId);
  });

  it("contre-témoin : le même SIREN fusionne", () => {
    expect(
      deciderFusion(
        { id: "a", siren: "123456789", aUneFacture: true },
        { id: "b", siren: "123456789", aUneFacture: true },
        { reporterSiren: true },
      ),
    ).toEqual({ permise: true, reporterSiren: false });
  });
});
