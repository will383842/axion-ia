// @vitest-environment node
/**
 * S17 — la fusion de doublons NE déplace PAS les brouillons de l'assistant de devis : ils restent
 * sur la fiche absorbée (doctrine des pièces : documents de travail, jamais perdus ni réécrits).
 */
import { describe, expect, it } from "vitest";

import { fusionnerFiches } from "../fusionner";
import { dossierEnMemoire } from "./_dossier-en-memoire";
import { ADMIN, MOTIF, sceneFusion } from "./_scene-fusion";

describe("fusionner : les brouillons d'assistant de devis restent sur la fiche absorbée", () => {
  it("aucun brouillon ne bouge, aucun n'est supprimé", async () => {
    const s0 = sceneFusion();
    const tables = {
      ...s0.base.tables,
      devisAssistantBrouillon: [{ id: "b-1", clientId: s0.absorbeeId, statut: "en_cours" }],
    };
    const base = dossierEnMemoire(tables);
    await fusionnerFiches(base.client as never, {
      absorbeeId: s0.absorbeeId,
      absorbanteId: s0.absorbanteId,
      motif: MOTIF,
      reporterSiren: false,
      parAdminId: ADMIN,
    });
    expect(base.tables["devisAssistantBrouillon"]).toEqual([
      { id: "b-1", clientId: s0.absorbeeId, statut: "en_cours" },
    ]);
    expect(base.tables["clientContact"]?.[0]?.["clientId"]).toBe(s0.absorbanteId);
  });
});
