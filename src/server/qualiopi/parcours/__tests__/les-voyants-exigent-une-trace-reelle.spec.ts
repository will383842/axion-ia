/**
 * QNC L12 (exigence orale O13) — un voyant ne passe au vert qu'avec une TRACE
 * RÉELLE. Pour chacun des quatorze prédicats : vert avec la trace, rouge (ou en
 * attente) sans elle, « non évalué » quand le lot n'écrit rien, et « sans objet »
 * pour un essai.
 */

import { describe, expect, it } from "vitest";

import {
  INDICATEURS_A_VOYANT,
  construireVoyants,
  etatGlobalVoyants,
  type AutresPartiesAppreciations,
  type ContexteVoyants,
  type IndicateurAVoyant,
  type TracesVoyants,
} from "../voyants-indicateurs";

const D = (iso: string) => new Date(iso);
const DEBUT = D("2026-11-10T08:00:00Z");
const FIN = D("2026-11-12T17:00:00Z");

/** Avant le début : rien n'est encore en retard. */
const AVANT: ContexteVoyants = {
  dateDebut: DEBUT,
  dateFin: FIN,
  estTestInterne: false,
  maintenant: D("2026-11-01T08:00:00Z"),
};
/** Après la fin + 7 jours : tout est échu. */
const APRES: ContexteVoyants = {
  dateDebut: DEBUT,
  dateFin: FIN,
  estTestInterne: false,
  maintenant: D("2026-12-01T08:00:00Z"),
};
const ESSAI: ContexteVoyants = { ...APRES, estTestInterne: true };

const L = <T extends object>(t: T) => ({ lecture: "lue" as const, ...t });

/** Une trace COMPLÈTE par indicateur (le cas vert). */
const COMPLETES: TracesVoyants = {
  i4: L({
    analyseValideeLe: D("2026-10-20T10:00:00Z"),
    reponseRecueLe: D("2026-10-19T10:00:00Z"),
    derogationLe: null,
  }),
  i6: L({ stagiairesActifs: 2, temps2Repondus: 2, dernierRepondu: D("2026-11-05T10:00:00Z") }),
  i9: L({
    stagiairesActifs: 2,
    convoques: 2,
    derniereConvocation: D("2026-11-04T10:00:00Z"),
    piecesRemises: 2,
  }),
  i10: L({ besoinsDeclares: 1, reponsesConsignees: 1, derniereReponse: D("2026-11-06T10:00:00Z") }),
  i11: L({ stagiairesActifs: 2, evalues: 2, derniereEvaluation: D("2026-11-12T16:00:00Z") }),
  i12: L({ echues: 4, signeesDansLeCreneau: 4, ecarts: 0, aVenir: 0 }),
  i17: L({ verifieLe: D("2026-11-05T10:00:00Z"), moyensNonVerifies: 0, lienTeste: true }),
  i19: L({ stagiairesActifs: 2, avecSupportRemis: 2, derniereRemise: D("2026-11-10T10:00:00Z") }),
  i21: L({
    formateurDesigne: true,
    habilitationActive: true,
    habiliteLe: D("2026-01-10T10:00:00Z"),
  }),
  i23: L({ derniereDecisionLe: D("2026-09-01T10:00:00Z") }),
  i26: L({ referentNommeEtJoignable: true, reseauActif: true }),
  i27: L({ sousTraitants: 1, controlesConformes: 1, dernierControle: D("2026-10-01T10:00:00Z") }),
  i30: L({ stagiairesActifs: 2, chaudRepondus: 2, dernierRepondu: D("2026-11-13T10:00:00Z") }),
  i31: L({
    reclamations: [
      { numero: "REC-1", etapes: ["reception", "accuse", "analyse", "reponse", "cloture"] },
    ],
  }),
};

/** Le MÊME indicateur, mais sans la trace qui prouve le geste. */
const SANS_TRACE: Record<IndicateurAVoyant, TracesVoyants> = {
  4: {
    i4: L({
      analyseValideeLe: null,
      reponseRecueLe: D("2026-10-19T10:00:00Z"),
      derogationLe: D("2026-10-25T10:00:00Z"),
    }),
  },
  6: {
    i6: L({ stagiairesActifs: 2, temps2Repondus: 1, dernierRepondu: D("2026-11-05T10:00:00Z") }),
  },
  9: {
    i9: L({
      stagiairesActifs: 2,
      convoques: 1,
      derniereConvocation: D("2026-11-04T10:00:00Z"),
      piecesRemises: 0,
    }),
  },
  10: {
    i10: L({
      besoinsDeclares: 2,
      reponsesConsignees: 1,
      derniereReponse: D("2026-11-06T10:00:00Z"),
    }),
  },
  11: {
    i11: L({ stagiairesActifs: 2, evalues: 1, derniereEvaluation: D("2026-11-12T16:00:00Z") }),
  },
  12: { i12: L({ echues: 4, signeesDansLeCreneau: 3, ecarts: 1, aVenir: 0 }) },
  17: { i17: L({ verifieLe: null, moyensNonVerifies: 3, lienTeste: null }) },
  19: {
    i19: L({ stagiairesActifs: 2, avecSupportRemis: 1, derniereRemise: D("2026-11-10T10:00:00Z") }),
  },
  21: { i21: L({ formateurDesigne: true, habilitationActive: false, habiliteLe: null }) },
  23: { i23: L({ derniereDecisionLe: null }) },
  26: { i26: L({ referentNommeEtJoignable: false, reseauActif: true }) },
  27: { i27: L({ sousTraitants: 1, controlesConformes: 0, dernierControle: null }) },
  30: {
    i30: L({ stagiairesActifs: 2, chaudRepondus: 1, dernierRepondu: D("2026-11-13T10:00:00Z") }),
  },
  31: { i31: L({ reclamations: [{ numero: "REC-2", etapes: ["reception"] }] }) },
};

function voyant(n: IndicateurAVoyant, traces: TracesVoyants | undefined, c: ContexteVoyants) {
  const v = construireVoyants(traces, c).find((x) => x.indicateur === n);
  if (v === undefined) throw new Error(`voyant ${n} absent`);
  return v;
}

describe("les voyants exigent une trace réelle (O13)", () => {
  it("rend un voyant pour chacun des quatorze indicateurs, dans l'ordre", () => {
    expect(construireVoyants(COMPLETES, APRES).map((v) => v.indicateur)).toEqual([
      ...INDICATEURS_A_VOYANT,
    ]);
  });

  it("sans AUCUNE trace lue, les quatorze voyants sont « non évalués » : jamais verts par défaut", () => {
    const vs = construireVoyants(undefined, APRES);
    expect(vs.every((v) => v.etat === "non_evalue")).toBe(true);
    expect(etatGlobalVoyants(vs)).toBe("non_evalue");
  });

  describe.each(INDICATEURS_A_VOYANT)("indicateur %i", (n) => {
    const cle = `i${n}` as keyof TracesVoyants;

    it("VERT avec la trace réelle, qui est citée", () => {
      const v = voyant(n, COMPLETES, APRES);
      expect(v.etat).toBe("vert");
      expect(v.trace).toBeTruthy();
      expect(v.manque).toBeNull();
    });

    it("ROUGE sans la trace, l'échéance passée (jamais vert sur une donnée présente)", () => {
      const v = voyant(n, SANS_TRACE[n], APRES);
      expect(v.etat).toBe("rouge");
      expect(v.manque).toBeTruthy();
    });

    it("lot éteint, absent ou lecture en échec : NON ÉVALUÉ, ni vert ni rouge", () => {
      for (const lecture of ["lot_eteint", "lot_absent", "illisible"] as const) {
        const v = voyant(n, { [cle]: { lecture } } as TracesVoyants, APRES);
        expect(v.etat).toBe("non_evalue");
        expect(v.trace).toBeNull();
      }
      expect(voyant(n, {}, APRES).etat).toBe("non_evalue");
    });

    it("session d'ESSAI exclue : sans objet, même avec toutes les traces", () => {
      const v = voyant(n, COMPLETES, ESSAI);
      expect(v.etat).toBe("sans_objet");
      expect(v.trace).toBeNull();
    });
  });

  describe("cas particuliers qui séparent présence de donnée et processus", () => {
    it("ind. 4 : une dérogation ne tient pas lieu d'analyse validée", () => {
      const v = voyant(
        4,
        {
          i4: L({
            analyseValideeLe: null,
            reponseRecueLe: null,
            derogationLe: D("2026-10-25T10:00:00Z"),
          }),
        },
        APRES,
      );
      expect(v.etat).toBe("rouge");
      expect(v.manque).toMatch(/dérogation/);
    });

    it("ind. 4 : avant le début de la session, l'absence de trace est « en attente », pas rouge", () => {
      const v = voyant(
        4,
        { i4: L({ analyseValideeLe: null, reponseRecueLe: null, derogationLe: null }) },
        AVANT,
      );
      expect(v.etat).toBe("en_attente");
    });

    it("ind. 10 : aucun besoin déclaré n'est PAS un vert (la question n'est pas tracée)", () => {
      const v = voyant(
        10,
        { i10: L({ besoinsDeclares: 0, reponsesConsignees: 0, derniereReponse: null }) },
        APRES,
      );
      expect(v.etat).toBe("non_evalue");
    });

    it("ind. 12 : un rattrapage de l'organisme est un écart, pas une signature", () => {
      const v = voyant(
        12,
        { i12: L({ echues: 2, signeesDansLeCreneau: 1, ecarts: 1, aVenir: 0 }) },
        APRES,
      );
      expect(v.etat).toBe("rouge");
    });

    it("ind. 17 : moyens vérifiés mais lien visio non testé → pas vert", () => {
      const v = voyant(
        17,
        {
          i17: L({ verifieLe: D("2026-11-05T10:00:00Z"), moyensNonVerifies: 0, lienTeste: false }),
        },
        APRES,
      );
      expect(v.etat).toBe("rouge");
    });

    it("ind. 23 : collecter ne suffit pas — il faut une décision légale tracée de moins de douze mois", () => {
      const recente = voyant(
        23,
        { i23: L({ derniereDecisionLe: D("2026-09-01T10:00:00Z") }) },
        APRES,
      );
      const vieille = voyant(
        23,
        { i23: L({ derniereDecisionLe: D("2024-01-01T10:00:00Z") }) },
        APRES,
      );
      expect(recente.etat).toBe("vert");
      expect(vieille.etat).toBe("rouge");
    });

    it("ind. 27 : aucun sous-traitant sur la session → sans objet", () => {
      const v = voyant(
        27,
        { i27: L({ sousTraitants: 0, controlesConformes: 0, dernierControle: null }) },
        APRES,
      );
      expect(v.etat).toBe("sans_objet");
    });

    it("ind. 31 : une réclamation reçue mais jamais accusée ni clôturée → rouge", () => {
      expect(voyant(31, SANS_TRACE[31], APRES).etat).toBe("rouge");
    });

    it("une session annulée ne porte aucun voyant (voir session-parcours)", () => {
      expect(etatGlobalVoyants([])).toBe("sans_objet");
    });
  });
});

describe("ind. 30 : les autres parties prenantes (NC14, derrière l'interrupteur des voyants)", () => {
  /** Après la fin + 30 j + 7 j : l'échéance des autres parties est passée. */
  const TARD: ContexteVoyants = { ...APRES, maintenant: D("2027-01-15T08:00:00Z") };
  /** Après la fin + 7 j mais avant fin + 37 j. */
  const MILIEU: ContexteVoyants = { ...APRES, maintenant: D("2026-12-01T08:00:00Z") };

  const TOUT: AutresPartiesAppreciations = {
    entreprise: { sollicitee: D("2026-11-13T10:00:00Z"), avis: null },
    formateur: { attendus: 1, avis: D("2026-11-14T10:00:00Z") },
    financeur: { tiers: "non", avis: null },
  };
  const stagiaires = {
    stagiairesActifs: 2,
    chaudRepondus: 2,
    dernierRepondu: D("2026-11-13T10:00:00Z"),
  };

  const v30 = (autres: AutresPartiesAppreciations | undefined, c: ContexteVoyants) =>
    voyant(
      30,
      { i30: L({ ...stagiaires, ...(autres !== undefined ? { autresParties: autres } : {}) }) },
      c,
    );

  it("champ absent : verdicts d'avant (stagiaires complets = vert)", () => {
    expect(v30(undefined, TARD).etat).toBe("vert");
    expect(voyant(30, { i30: L({ ...stagiaires, chaudRepondus: 1 }) }, APRES).etat).toBe("rouge");
  });

  it("tout complet : vert, avec la trace « sans objet » datée pour un financement direct", () => {
    const v = v30(TOUT, TARD);
    expect(v.etat).toBe("vert");
    expect(v.trace).toMatch(/sans objet : aucun financeur tiers déclaré/);
    expect(v.trace).toMatch(
      /financement direct sur toutes les inscriptions \(lu le 15\/01\/2027\)/,
    );
  });

  it("stagiaires complets SEULS : pas vert", () => {
    const seuls: AutresPartiesAppreciations = {
      entreprise: { sollicitee: null, avis: null },
      formateur: { attendus: 1, avis: null },
      financeur: { tiers: "oui", avis: null },
    };
    expect(v30(seuls, TARD).etat).toBe("rouge");
    expect(v30(seuls, TARD).etat).not.toBe("vert");
  });

  it.each([
    [
      "entreprise sans sollicitation ni avis",
      { ...TOUT, entreprise: { sollicitee: null, avis: null } },
    ],
    ["formateur attendu sans avis", { ...TOUT, formateur: { attendus: 1, avis: null } }],
    ["financeur tiers sans avis", { ...TOUT, financeur: { tiers: "oui", avis: null } }],
    ["financement non renseigné", { ...TOUT, financeur: { tiers: "inconnu", avis: null } }],
  ] as const)("%s : en attente avant l'échéance, rouge après", (_nom, autres) => {
    expect(v30(autres, MILIEU).etat).toBe("en_attente");
    const rouge = v30(autres, TARD);
    expect(rouge.etat).toBe("rouge");
    expect(rouge.manque).toBeTruthy();
  });

  it("financement non renseigné : jamais vert, le manque le dit", () => {
    const v = v30({ ...TOUT, financeur: { tiers: "inconnu", avis: null } }, TARD);
    expect(v.manque).toMatch(/financement non renseigné/);
  });

  it("entreprise : un avis reçu suffit sans sollicitation ; aucun formateur attendu n'exige rien", () => {
    const v = v30(
      {
        entreprise: { sollicitee: null, avis: D("2026-11-20T10:00:00Z") },
        formateur: { attendus: 0, avis: null },
        financeur: { tiers: "oui", avis: D("2026-11-25T10:00:00Z") },
      },
      TARD,
    );
    expect(v.etat).toBe("vert");
  });

  it("stagiaires incomplets + autres complets : toujours pas vert", () => {
    const v = voyant(
      30,
      { i30: L({ ...stagiaires, chaudRepondus: 1, autresParties: TOUT }) },
      TARD,
    );
    expect(v.etat).toBe("rouge");
  });
});
