// @vitest-environment node
/**
 * « Défaire » REFUSE, avec la liste des liens, si un élément déplacé a SERVI
 * depuis sur la fiche restée : la personne rendue a participé à un
 * rendez-vous créé après la fusion. La rendre casserait ce lien ; rien
 * n'est fait à moitié.
 *
 * Contre-témoin : sans ce lien, « Défaire » passe.
 */

import { describe, expect, it } from "vitest";

import { defaireFusion, ErreurDefaireFusion } from "../defaire-fusion";
import { fusionnerFiches } from "../fusionner";
import { id } from "./_dossier-en-memoire";
import { ADMIN, MOTIF, sceneFusion } from "./_scene-fusion";

const MOTIF_DEFAIRE = "Erreur de fusion, fiches à séparer.";

describe("« Défaire » refuse si un élément a servi depuis sur la fiche restée", () => {
  it("une participation créée après la fusion : refus motivé, rien de changé", async () => {
    const s = sceneFusion();
    const r = await fusionnerFiches(s.base.client as never, {
      absorbeeId: s.absorbeeId,
      absorbanteId: s.absorbanteId,
      motif: MOTIF,
      reporterSiren: false,
      parAdminId: ADMIN,
    });
    const rdvApres = id(5);
    s.base.tables["rencontre"]?.push({
      id: rdvApres,
      source: "saisie_manuelle",
      type: "visio",
      titre: "Après",
      clientId: s.absorbanteId,
      rattachementStatut: "valide",
      statut: "planifie",
      estTestInterne: false,
    });
    s.base.tables["rencontreParticipant"]?.push({
      id: id(9),
      rencontreId: rdvApres,
      role: "client",
      clientId: s.absorbanteId,
      contactId: s.contactId,
    });

    const e = await defaireFusion(s.base.client as never, {
      fusionId: r.fusionId,
      motif: MOTIF_DEFAIRE,
      parAdminId: ADMIN,
    }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ErreurDefaireFusion);
    expect((e as ErreurDefaireFusion).liens.join(" ")).toMatch(
      /rendez-vous créé\(s\) après la fusion/,
    );
    expect(s.base.tables["clientFusion"]?.[0]?.["defaiteLe"]).toBeNull();
    expect(s.base.tables["clientContact"]?.[0]?.["clientId"]).toBe(s.absorbanteId);
  });

  it("contre-témoin : sans lien nouveau, « Défaire » passe", async () => {
    const s = sceneFusion();
    const r = await fusionnerFiches(s.base.client as never, {
      absorbeeId: s.absorbeeId,
      absorbanteId: s.absorbanteId,
      motif: MOTIF,
      reporterSiren: false,
      parAdminId: ADMIN,
    });
    await expect(
      defaireFusion(s.base.client as never, {
        fusionId: r.fusionId,
        motif: MOTIF_DEFAIRE,
        parAdminId: ADMIN,
      }),
    ).resolves.toMatchObject({ contacts: 1, projets: 1, rencontres: 1 });
  });
});
