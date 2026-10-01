// @vitest-environment node
/**
 * ⛔ Une fusion où SEULE la fiche absorbée a un SIREN est REFUSÉE (vérification
 * V1, V1-01 ; décision de Will du 30/09 : variante sans schéma).
 *
 * La fiche absorbée sort de l'anti-doublon (`porte-client.ts` et `rattacher.ts`
 * écartent les fiches absorbées) : son SIREN disparaissait des fiches vivantes,
 * et « Nouveau client » avec ce SIREN créait une troisième fiche. Le refus
 * propose le sens inverse : absorber l'autre fiche dans celle qui a le SIREN.
 *
 * Mutation qui rougit : retirer la branche « SIREN seulement sur l'absorbée »
 * de `deciderFusion` → la fusion passe, le SIREN n'est plus sur aucune fiche
 * vivante.
 * Contre-témoin : le sens inverse (le SIREN sur la fiche qui reste) fusionne.
 */

import { describe, expect, it } from "vitest";

import { deciderFusion, fusionnerFiches } from "../fusionner";
import { ADMIN, MOTIF, sceneFusion } from "./_scene-fusion";

describe("⛔ fusion où seule l'absorbée a un SIREN : refusée", () => {
  it("la règle : refus, et le motif propose le sens inverse", () => {
    const d = deciderFusion(
      { id: "a", siren: "123456789", aUneFacture: false },
      { id: "b", siren: null, aUneFacture: false },
      { reporterSiren: true },
    );
    expect(d.permise).toBe(false);
    expect(d.permise ? "" : d.motif).toMatch(/sens inverse/);
  });

  it("dans la base : refus, rien d'écrit, le SIREN reste sur une fiche vivante", async () => {
    const s = sceneFusion({ sirenAbsorbee: "123456789", sirenAbsorbante: null });
    await expect(
      fusionnerFiches(s.base.client as never, {
        absorbeeId: s.absorbeeId,
        absorbanteId: s.absorbanteId,
        motif: MOTIF,
        reporterSiren: true,
        parAdminId: ADMIN,
      }),
    ).rejects.toThrow(/sens inverse/);
    expect(s.base.tables["clientFusion"] ?? []).toHaveLength(0);
    expect(s.base.tables["clientContact"]?.[0]?.["clientId"]).toBe(s.absorbeeId);
  });

  it("contre-témoin : le SIREN sur la fiche qui reste, la fusion passe", () => {
    expect(
      deciderFusion(
        { id: "a", siren: null, aUneFacture: false },
        { id: "b", siren: "123456789", aUneFacture: false },
        { reporterSiren: true },
      ),
    ).toEqual({ permise: true, reporterSiren: true });
  });
});
