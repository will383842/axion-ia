/**
 * Qualiopi ind. 27 — seuils de contrôle en RÈGLES PURES :
 *   · contrôle à chaque mission et revue complète annuelle, par liste de preuves ;
 *   · preuve majeure manquante (émargement absent…) : non conforme ;
 *   · preuves mineures seules : à revoir, plan de correction à J+15 (réglage) ;
 *   · réglages illisibles ou hors bornes : le défaut « à valider par Will » ;
 *   · une suspension tient au registre tant qu'elle n'est pas levée (la synchronisation
 *     ne la défait pas) ; une sortie l'emporte ;
 *   · la revue complète suit le réglage de périodicité ;
 *   · un plan de correction échu lève l'alerte, même sous suspension.
 */

import { describe, expect, it } from "vitest";

import {
  CONTROLES_SOUS_TRAITANCE,
  PREUVES_MISSION,
  PREUVES_REVUE_COMPLETE,
  REGLAGES_IND27_DEFAUTS,
  preuvesDuControle,
} from "../controles.config";
import {
  constaterPreuves,
  correctionsEchues,
  echeanceCorrection,
  reglagesInd27,
} from "../ecarts-regles";
import { candidatsAlertesRegistre, etatControles, statutAttendu, type FaitsFiche } from "../regles";

const MAINTENANT = new Date("2026-10-17T10:00:00Z");
const toutes = (l: ReadonlyArray<{ code: string }>) => l.map((p) => p.code);

function fiche(over: Partial<FaitsFiche> = {}): FaitsFiche {
  return {
    trainerId: "t-1",
    prenom: "Anne",
    nom: "Martin",
    statut: "sous_traitant",
    actif: true,
    estTestInterne: false,
    siret: "12345678900011",
    nda: "84691234569",
    contratSigneAt: new Date("2026-09-01T00:00:00Z"),
    activationValideeAt: null,
    finCollaborationAt: null,
    finCollaborationEffetAt: null,
    finCollaborationMotif: null,
    formations: [],
    ndaVerifieListeAt: null,
    ...over,
  };
}

describe("la configuration des contrôles ind. 27", () => {
  it("un contrôle à chaque mission et une revue complète annuelle, tous deux à preuves", () => {
    expect(preuvesDuControle("controle_mission")).toBe(PREUVES_MISSION);
    expect(preuvesDuControle("revue_annuelle")).toBe(PREUVES_REVUE_COMPLETE);
    expect(preuvesDuControle("pieces_entree")).toBeNull();
    expect(CONTROLES_SOUS_TRAITANCE.map((c) => c.code)).toContain("controle_mission");
  });

  it("l'émargement absent est un écart MAJEUR ; il existe des preuves mineures", () => {
    expect(PREUVES_MISSION.find((p) => p.code === "emargement")?.gravite).toBe("majeur");
    expect(PREUVES_MISSION.some((p) => p.gravite === "mineur")).toBe(true);
    expect(PREUVES_REVUE_COMPLETE.some((p) => p.gravite === "majeur")).toBe(true);
  });

  it("les défauts des réglages : J+15 et douze mois", () => {
    expect(REGLAGES_IND27_DEFAUTS).toEqual({ delaiCorrectionJours: 15, revueCompleteMois: 12 });
  });
});

describe("constat d'une liste de preuves", () => {
  it("tout coché : conforme, aucun écart", () => {
    const c = constaterPreuves(PREUVES_MISSION, toutes(PREUVES_MISSION));
    expect(c.resultat).toBe("conforme");
    expect(c.majeurs).toEqual([]);
    expect(c.mineurs).toEqual([]);
  });

  it("émargement manquant : non conforme, un écart majeur", () => {
    const c = constaterPreuves(
      PREUVES_MISSION,
      toutes(PREUVES_MISSION).filter((x) => x !== "emargement"),
    );
    expect(c.resultat).toBe("non_conforme");
    expect(c.majeurs.map((p) => p.code)).toEqual(["emargement"]);
  });

  it("une preuve mineure seule manque : à revoir, aucun majeur", () => {
    const c = constaterPreuves(
      PREUVES_MISSION,
      toutes(PREUVES_MISSION).filter((x) => x !== "bilan_formateur"),
    );
    expect(c.resultat).toBe("a_revoir");
    expect(c.majeurs).toEqual([]);
    expect(c.mineurs.map((p) => p.code)).toEqual(["bilan_formateur"]);
  });

  it("un code coché inconnu de la liste ne compte pas comme preuve", () => {
    const c = constaterPreuves(PREUVES_MISSION, ["inventé"]);
    expect(c.preuves.every((p) => !p.fournie)).toBe(true);
  });
});

describe("réglages et plan de correction", () => {
  it("l'échéance d'un plan de correction suit le réglage (J+15 par défaut)", () => {
    expect(echeanceCorrection(MAINTENANT, REGLAGES_IND27_DEFAUTS)).toEqual(
      new Date("2026-11-01T10:00:00Z"),
    );
    expect(
      echeanceCorrection(MAINTENANT, { delaiCorrectionJours: 7, revueCompleteMois: 12 }),
    ).toEqual(new Date("2026-10-24T10:00:00Z"));
  });

  it("un réglage illisible, nul, négatif ou décimal retombe sur le défaut", () => {
    expect(reglagesInd27({ delaiCorrectionJours: 0, revueCompleteMois: "x" })).toEqual(
      REGLAGES_IND27_DEFAUTS,
    );
    expect(reglagesInd27({ delaiCorrectionJours: -3, revueCompleteMois: 1.5 })).toEqual(
      REGLAGES_IND27_DEFAUTS,
    );
    expect(reglagesInd27({ delaiCorrectionJours: 30, revueCompleteMois: 6 })).toEqual({
      delaiCorrectionJours: 30,
      revueCompleteMois: 6,
    });
  });

  it("seuls les plans ouverts et échus sont rendus", () => {
    const echeance = new Date("2026-10-10T00:00:00Z");
    expect(
      correctionsEchues(
        [
          { libelle: "A", echeance, corrigeAt: null },
          { libelle: "B", echeance, corrigeAt: new Date("2026-10-09T00:00:00Z") },
          { libelle: "C", echeance: new Date("2026-10-30T00:00:00Z"), corrigeAt: null },
        ],
        MAINTENANT,
      ),
    ).toEqual([{ libelle: "A", echeance }]);
  });
});

describe("statut au registre sous suspension", () => {
  it("une suspension pour écart majeur tient, même fiche active", () => {
    expect(statutAttendu(fiche(), null, MAINTENANT, true).statut).toBe("suspendu");
  });

  it("une fin de collaboration l'emporte : sorti", () => {
    const s = statutAttendu(
      fiche({ finCollaborationAt: new Date("2026-10-01T00:00:00Z") }),
      null,
      MAINTENANT,
      true,
    );
    expect(s.statut).toBe("sorti");
  });

  it("sans suspension, rien ne change (fiche active : actif)", () => {
    expect(statutAttendu(fiche(), null, MAINTENANT).statut).toBe("actif");
  });
});

describe("revue complète : périodicité réglable", () => {
  const base = {
    dateEntree: new Date("2026-01-01T00:00:00Z"),
    traces: [],
    dernierControleRegistreAt: null,
    pieces: [],
  };
  const revue = (mois: number, maintenant: Date) =>
    etatControles(base, maintenant, { delaiCorrectionJours: 15, revueCompleteMois: mois }).find(
      (c) => c.code === "revue_annuelle",
    );

  it("à six mois, la revue est due le 1er juillet", () => {
    expect(revue(6, MAINTENANT)?.echeance).toEqual(new Date("2026-07-01T00:00:00Z"));
    expect(revue(6, MAINTENANT)?.enRetard).toBe(true);
    expect(revue(12, MAINTENANT)?.enRetard).toBe(false);
  });

  it("le contrôle de chaque mission n'a pas d'échéance propre", () => {
    const m = etatControles(base, MAINTENANT).find((c) => c.code === "controle_mission");
    expect(m).toMatchObject({ echeance: null, enRetard: false });
  });
});

describe("alerte de plan de correction échu", () => {
  const ligne = {
    trainerId: "t-1",
    libelle: "Anne Martin",
    pieces: [],
    controles: [],
    correctionsEchues: [
      { libelle: "Bilan de fin de formation", echeance: new Date("2026-10-10T00:00:00Z") },
    ],
  };

  it("une alerte « correction_echue », même sous suspension", () => {
    for (const statut of ["actif", "suspendu"] as const) {
      const c = candidatsAlertesRegistre([{ ...ligne, statut }]);
      expect(c.map((x) => x.sorte)).toEqual(["correction_echue"]);
      expect(c[0]?.message).toContain("Bilan de fin de formation");
    }
  });

  it("jamais sur une ligne sortie", () => {
    expect(candidatsAlertesRegistre([{ ...ligne, statut: "sorti" }])).toEqual([]);
  });
});
