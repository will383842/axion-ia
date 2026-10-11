/**
 * Lot L9b — règles de la mise à niveau des indépendants actifs.
 */

import { describe, expect, it } from "vitest";

import {
  DELAI_GRACE_MISE_A_NIVEAU_JOURS,
  ELEMENTS_MISE_A_NIVEAU,
  concerneParMiseANiveau,
  elementsMiseANiveau,
  finDelaiGrace,
  refusEnvoiMiseANiveau,
  type FaitsMiseANiveau,
} from "../mise-a-niveau-regles";

const MAINTENANT = new Date("2026-10-11T10:00:00Z");

const ANCIEN: FaitsMiseANiveau = {
  statut: "sous_traitant",
  actif: true,
  estFormateur: true,
  organismeSousTraitantId: null,
  finCollaborationAt: null,
  siret: null,
  ndaVerifieListeAt: null,
  regimeTvaHonoraires: null,
  ibanPresent: false,
  declarationsVersion: null,
  habilitationsActives: 1,
  contrats: [],
  controles: [],
  pieces: [],
  preuvesVigilance: [],
  piecesAdministratives: [],
};

describe("mise à niveau (L9b)", () => {
  it("onze éléments, dans l'ordre de la vérification W5", () => {
    expect(ELEMENTS_MISE_A_NIVEAU).toHaveLength(11);
    expect(Object.keys(elementsMiseANiveau(ANCIEN, MAINTENANT))).toEqual(
      ELEMENTS_MISE_A_NIVEAU.map((e) => e.cle),
    );
  });

  it("un actif d'avant le contrôle : concerné, onze éléments à reprendre", () => {
    expect(concerneParMiseANiveau(ANCIEN)).toBe(true);
    expect(Object.values(elementsMiseANiveau(ANCIEN, MAINTENANT)).every((v) => !v)).toBe(true);
  });

  it("jamais concernés : inactif, salarié, organisme, fin, contrat v3 contresigné", () => {
    expect(concerneParMiseANiveau({ ...ANCIEN, actif: false })).toBe(false);
    expect(concerneParMiseANiveau({ ...ANCIEN, statut: "salarie" })).toBe(false);
    expect(concerneParMiseANiveau({ ...ANCIEN, organismeSousTraitantId: "o" })).toBe(false);
    expect(concerneParMiseANiveau({ ...ANCIEN, finCollaborationAt: MAINTENANT })).toBe(false);
    expect(
      concerneParMiseANiveau({
        ...ANCIEN,
        contrats: [{ version: 3, statutSignature: "signee", annuleeAt: null }],
      }),
    ).toBe(false);
    // Un contrat v2 signé ne suffit pas.
    expect(
      concerneParMiseANiveau({
        ...ANCIEN,
        contrats: [{ version: 2, statutSignature: "signee", annuleeAt: null }],
      }),
    ).toBe(true);
  });

  it("éléments présents lus en base", () => {
    const e = elementsMiseANiveau(
      {
        ...ANCIEN,
        siret: "12345678900011",
        ibanPresent: true,
        regimeTvaHonoraires: "franchise_293b",
        declarationsVersion: "v1",
        ndaVerifieListeAt: MAINTENANT,
        piecesAdministratives: [
          {
            type: "nda_sous_traitant",
            statutValidation: "valide",
            fichierUrl: null,
            dateEmission: null,
            dateExpiration: null,
          },
        ],
      },
      MAINTENANT,
    );
    expect(e).toMatchObject({
      siret: true,
      iban: true,
      tva: true,
      declarations: true,
      nda_liste: true,
      piece_nda: true,
      piece_kbis: false,
      contrat: false,
    });
  });

  it("le délai de grâce court 30 jours à partir de l'envoi, pas de la liste", () => {
    expect(finDelaiGrace(null)).toBeNull();
    const envoi = new Date("2026-10-01T09:00:00Z");
    expect(finDelaiGrace(envoi)?.getTime()).toBe(
      envoi.getTime() + DELAI_GRACE_MISE_A_NIVEAU_JOURS * 86_400_000,
    );
  });

  it("envoi : liste figée exigée ; un dossier à vérifier n'est jamais renvoyé", () => {
    const base = { ...ANCIEN, miseANiveauListeeAt: null, dossierStatut: null };
    expect(refusEnvoiMiseANiveau(base)).toBe("liste_non_figee");
    expect(refusEnvoiMiseANiveau({ ...base, miseANiveauListeeAt: MAINTENANT })).toBeNull();
    expect(
      refusEnvoiMiseANiveau({ ...base, miseANiveauListeeAt: MAINTENANT, dossierStatut: "a_verifier" }),
    ).toBe("dossier_a_verifier");
    expect(refusEnvoiMiseANiveau({ ...base, actif: false, miseANiveauListeeAt: MAINTENANT })).toBe(
      "pas_concerne",
    );
  });
});
