// @vitest-environment node
/**
 * ⛔ « Défaire la fusion » n'émet AUCUN événement vers Axion Partners : le
 * contrat n'en a pas (question ouverte pour Partners). Et tant que le contrat
 * PUBLIÉ ne porte pas `client.fusionne` (v1), une fusion n'écrit rien dans la
 * file, même canal ouvert — sans lever : la file refuserait ce type (422), et
 * la fusion échouerait avec elle.
 *
 * Mutation qui fait rougir : retirer le contrôle `fusionEmissibleVersPartners`
 * de `emettreFusionVersPartners` → la file lève `EvenementHorsContrat` (contrat
 * v1) ou écrit une ligne (contrat v2), et le premier test rougit.
 * Contre-témoin : avec un contrat qui porte le type, la fusion écrit sa ligne
 * (`une-fusion-s-ecrit-dans-la-file-partners-existante.spec.ts`).
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import { TYPES_EVENEMENT } from "@/server/partners/contrat";

import { defaireFusion } from "../defaire-fusion";
import {
  emettreFusionVersPartners,
  fusionEmissibleVersPartners,
  fusionnerFiches,
} from "../fusionner";
import { ADMIN, MOTIF, sceneFusion } from "./_scene-fusion";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("⛔ une fusion défaite n'est jamais rejouée vers Partners", () => {
  it("contrat sans client.fusionne, canal ouvert : fusion puis « Défaire », file vide", async () => {
    vi.stubEnv("PARTNERS_SYNC_ENABLED", "true");
    vi.stubEnv("DATABASE_URL", "postgresql://u:p@localhost:5432/test");
    const types = (TYPES_EVENEMENT as readonly string[]).filter((t) => t !== "client.fusionne");
    const s = sceneFusion();
    const r = await fusionnerFiches(
      s.base.client as never,
      {
        absorbeeId: s.absorbeeId,
        absorbanteId: s.absorbanteId,
        motif: MOTIF,
        reporterSiren: false,
        parAdminId: ADMIN,
      },
      { typesDuContrat: types },
    );
    expect(s.base.tables["clientFusion"]?.[0]?.["emiseVersPartnersLe"]).toBeNull();
    await defaireFusion(s.base.client as never, {
      fusionId: r.fusionId,
      motif: "Deux entreprises distinctes, vérifié.",
      parAdminId: ADMIN,
    });
    expect(s.base.tables["clientFusion"]?.[0]?.["defaiteLe"]).toBeInstanceOf(Date);
    expect(s.base.tables["partnersSyncOutbox"] ?? []).toHaveLength(0);
  });

  it("le contrôle suit la version publiée du contrat, jamais une liste recopiée", async () => {
    expect(fusionEmissibleVersPartners(["client.cree"])).toBe(false);
    expect(fusionEmissibleVersPartners(["client.cree", "client.fusionne"])).toBe(true);
    expect(fusionEmissibleVersPartners()).toBe(
      (TYPES_EVENEMENT as readonly string[]).includes("client.fusionne"),
    );
    const rien = await emettreFusionVersPartners(
      { partnersSyncOutbox: { createMany: () => Promise.reject(new Error("jamais appelé")) } },
      { fusionId: "f", absorbanteId: "a", absorbeeId: "b", le: new Date() },
      ["client.cree"],
    );
    expect(rien).toBeNull();
  });
});
