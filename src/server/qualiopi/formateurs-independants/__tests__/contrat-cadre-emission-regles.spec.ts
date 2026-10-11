/**
 * Lots L7b et L7d — règles de préparation du contrat-cadre (table de vérité).
 */

import { describe, expect, it } from "vitest";

import {
  REFUS_EMISSION,
  aFaireResigner,
  donneesContratCadreIndependant,
  verdictEmissionContrat,
  versionEnVigueur,
  type ContratEmisLu,
  type FaitsEmissionContrat,
} from "../contrat-cadre-emission-regles";

const MAINTENANT = new Date("2026-10-11T10:00:00Z");
const SIRET = "12345678900011";
const HIER = new Date("2026-10-10T10:00:00Z");

const contrat = (p: Partial<ContratEmisLu>): ContratEmisLu => ({
  id: "c-1",
  numero: "AXI-FORM-2026-001",
  version: 3,
  statutSignature: "en_attente",
  annuleeAt: null,
  signatures: 0,
  ...p,
});

const FAITS: FaitsEmissionContrat = {
  statut: "sous_traitant",
  organismeSousTraitantId: null,
  finCollaborationAt: null,
  prenom: "Camille",
  nom: "Exemple",
  email: "camille@exemple.fr",
  siret: SIRET,
  adresseProfessionnelle: "1 rue de l'Exemple, 69001 Lyon",
  sousTraitantNda: "en cours",
  numeroTvaIntracom: null,
  contrats: [],
  controles: [
    { verdict: "vert", source: "registre", verifieAt: HIER, createdAt: HIER, siret: SIRET },
  ],
  pieces: [
    {
      id: "p-1",
      type: "attestation_vigilance_urssaf",
      statutValidation: "valide",
      fichierUrl: "trainer-documents/p-1",
      dateEmission: new Date("2026-10-01T00:00:00Z"),
      dateExpiration: null,
    },
  ],
  preuvesVigilance: [{ trainerDocumentId: "p-1", resultat: "valide" }],
  registre: { lu: true, siret: SIRET, active: true, entrepreneurIndividuel: true },
};

const refus = (f: Partial<FaitsEmissionContrat>, v: number | null = 3) => {
  const r = verdictEmissionContrat({ ...FAITS, ...f }, v, MAINTENANT);
  return r.ok ? [] : r.refus;
};

describe("verdictEmissionContrat (L7b)", () => {
  it("tout est réuni : le contrat se prépare", () => {
    expect(verdictEmissionContrat(FAITS, 3, MAINTENANT)).toEqual({ ok: true, aRemplacer: [] });
  });

  it("hors périmètre : salarié, organisme, fin de collaboration", () => {
    expect(refus({ statut: "salarie" })).toEqual([REFUS_EMISSION.horsPerimetre]);
    expect(refus({ organismeSousTraitantId: "o-1" })).toEqual([REFUS_EMISSION.horsPerimetre]);
    expect(refus({ finCollaborationAt: HIER })).toEqual([REFUS_EMISSION.fin]);
  });

  it("aucune version arrêtée, ou en dessous de la v3 : refus", () => {
    expect(refus({}, null)).toEqual([REFUS_EMISSION.version]);
    expect(refus({}, 2)).toEqual([REFUS_EMISSION.version]);
  });

  it("une version déjà émise n'est jamais refaite ; un contrat à contresigner bloque", () => {
    expect(refus({ contrats: [contrat({})] })).toContain(REFUS_EMISSION.dejaEmis);
    expect(refus({ contrats: [contrat({ statutSignature: "signee", signatures: 2 })] })).toContain(
      REFUS_EMISSION.dejaEmis,
    );
    expect(
      refus({ contrats: [contrat({ version: 2, statutSignature: "partielle", signatures: 1 })] }),
    ).toContain(REFUS_EMISSION.enAttente);
    // Annulé : ne compte plus.
    expect(refus({ contrats: [contrat({ annuleeAt: HIER })] })).toEqual([]);
  });

  it("un lien circule encore sur un contrat précédent : jamais remplacé en silence", () => {
    const r = verdictEmissionContrat(
      { ...FAITS, contrats: [contrat({ id: "v2", version: 2, liensActifs: 1 })] },
      3,
      MAINTENANT,
    );
    expect(r).toEqual({ ok: false, refus: [REFUS_EMISSION.lienEnCours] });
  });

  it("attestation URSSAF sans preuve de vérification : refus", () => {
    expect(refus({ preuvesVigilance: [] })).toContain(REFUS_EMISSION.vigilance);
  });

  it("registre : rouge, trop ancien, ou SIRET différent du contrat : refus", () => {
    expect(
      refus({
        controles: [
          { verdict: "rouge", source: "registre", verifieAt: HIER, createdAt: HIER, siret: SIRET },
        ],
      }),
    ).toContain(REFUS_EMISSION.controle);
    const ancien = new Date("2026-08-01T00:00:00Z");
    expect(
      refus({
        controles: [
          {
            verdict: "vert",
            source: "registre",
            verifieAt: ancien,
            createdAt: ancien,
            siret: SIRET,
          },
        ],
      }),
    ).toContain(REFUS_EMISSION.controle);
    expect(refus({ siret: "98765432100019" })).toContain(REFUS_EMISSION.siret);
  });

  it("registre public muet, établissement fermé, ou société : refus", () => {
    expect(refus({ registre: { lu: false } })).toContain(REFUS_EMISSION.registreMuet);
    expect(
      refus({ registre: { lu: true, siret: SIRET, active: false, entrepreneurIndividuel: true } }),
    ).toContain(REFUS_EMISSION.inactive);
    expect(
      refus({ registre: { lu: true, siret: SIRET, active: true, entrepreneurIndividuel: false } }),
    ).toContain(REFUS_EMISSION.societe);
    expect(
      refus({ registre: { lu: true, siret: SIRET, active: true, entrepreneurIndividuel: null } }),
    ).toContain(REFUS_EMISSION.societe);
  });

  it("nouvelle version : l'ancienne signée reste, l'ancienne jamais signée est remplacée", () => {
    const r = verdictEmissionContrat(
      {
        ...FAITS,
        contrats: [
          contrat({ id: "signe", version: 3, statutSignature: "signee", signatures: 2 }),
          contrat({ id: "orphelin", version: 3, statutSignature: "en_attente" }),
        ],
      },
      4,
      MAINTENANT,
    );
    expect(r).toEqual({ ok: true, aRemplacer: ["orphelin"] });
  });
});

describe("donneesContratCadreIndependant", () => {
  const AXION = {
    regionDeclaration: "Région",
    adresseFormateurs: "f@exemple.fr",
    certificateur: "",
  };

  it("entreprise individuelle, mandat donné, numéro « en cours » imprimé comme tel", () => {
    const d = donneesContratCadreIndependant(FAITS, AXION, "N-1", "11 octobre 2026");
    expect(d.nature).toBe("independant");
    expect(d.cocontractant.societe).toBeNull();
    expect(d.cocontractant.numeroDeclaration).toBeNull();
    expect(d.mandatAutofacturation).toBe(true);
    expect(d.axion).not.toHaveProperty("certificateur");
  });

  it("un numéro de 11 chiffres est repris tel quel", () => {
    const d = donneesContratCadreIndependant(
      { ...FAITS, sousTraitantNda: "84691234569" },
      { ...AXION, certificateur: "Certificateur" },
      "N-1",
      "11 octobre 2026",
    );
    expect(d.cocontractant.numeroDeclaration).toBe("84691234569");
    expect(d.axion.certificateur).toBe("Certificateur");
  });
});

describe("à faire re-signer (L7d)", () => {
  it("la version en vigueur est la plus haute CONTRESIGNÉE, jamais la plus récente émise", () => {
    expect(
      versionEnVigueur([
        contrat({ version: 3, statutSignature: "signee" }),
        contrat({ version: 4, statutSignature: "en_attente" }),
      ]),
    ).toBe(3);
    expect(
      versionEnVigueur([contrat({ version: 4, statutSignature: "signee", annuleeAt: HIER })]),
    ).toBeNull();
  });

  it("v3 en vigueur et v4 arrêtée : à re-signer ; sans v3 : relève de la mise à niveau", () => {
    const v3 = [contrat({ statutSignature: "signee" })];
    expect(aFaireResigner(v3, 4)).toBe(true);
    expect(aFaireResigner(v3, 3)).toBe(false);
    expect(aFaireResigner([], 4)).toBe(false);
    expect(aFaireResigner([contrat({ version: 2, statutSignature: "signee" })], 4)).toBe(false);
  });
});
