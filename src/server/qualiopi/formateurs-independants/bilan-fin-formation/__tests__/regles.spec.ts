// @vitest-environment node

/**
 * Lot G2 — le bilan de fin de formation (règles PURES).
 *
 *   · le bloc n'apparaît qu'une fois la DERNIÈRE journée passée (fin de son horaire, Paris) ;
 *   · ne sont à évaluer que les inscrits ACTIFS et PRÉSENTS ;
 *   · « Terminer » exige une évaluation finale pour chacun ET l'avis du formateur ;
 *   · « formation complète » = feuilles contresignées (règle existante `moisPayable`)
 *     ET bilan terminé — sauf « payer quand même » ; le motif est dit en clair ;
 *   · l'exigence ne vaut que pour une session finie APRÈS l'allumage de l'interrupteur ;
 *   · relance J+2 puis J+7, arrêtée par le bilan terminé ou la fin de collaboration ;
 *     alerte interne à J+10, une fois.
 */

import { describe, expect, it } from "vitest";

import {
  bilanAAlerter,
  bilanExige,
  derniereJourneeDe,
  derniereJourneePassee,
  etatDuBilan,
  faitsRelanceBilan,
  REGLE_RELANCE_BILAN,
  stagiairesAEvaluer,
  type LigneRelanceBilan,
} from "../regles";
import {
  formationCompletePourFormateur,
  LIBELLE_MOTIF_FORMATION_INCOMPLETE,
} from "../../paiement/formation-complete";

const J = (date: string, heureFin = "17:00") => ({
  date: new Date(`${date}T00:00:00Z`),
  heureFin,
});

describe("derniereJourneePassee", () => {
  const jours = [J("2026-11-03"), J("2026-11-04", "12:30")];

  it("la dernière journée est la plus tardive, quel que soit l'ordre", () => {
    expect(derniereJourneeDe([...jours].reverse())).toEqual({
      jour: "2026-11-04",
      heureFin: "12:30",
    });
    expect(derniereJourneeDe([])).toBeNull();
  });

  it("pendant la dernière journée : pas encore ; après son horaire (Paris) : oui", () => {
    // 12:00 à Paris (UTC+1 en novembre) = 11:00 UTC
    expect(derniereJourneePassee(jours, new Date("2026-11-04T11:00:00Z"))).toBe(false);
    // 12:31 à Paris
    expect(derniereJourneePassee(jours, new Date("2026-11-04T11:31:00Z"))).toBe(true);
    expect(derniereJourneePassee(jours, new Date("2026-11-05T08:00:00Z"))).toBe(true);
    expect(derniereJourneePassee(jours, new Date("2026-11-03T20:00:00Z"))).toBe(false);
  });

  it("sans aucune journée : jamais (rien à dater)", () => {
    expect(derniereJourneePassee([], new Date("2030-01-01T00:00:00Z"))).toBe(false);
  });
});

describe("stagiairesAEvaluer", () => {
  it("garde les inscrits actifs ET présents, écarte abandons, exclus et absents", () => {
    const r = stagiairesAEvaluer([
      { enrollmentId: "a", statut: "terminee", present: true },
      { enrollmentId: "b", statut: "abandon", present: true },
      { enrollmentId: "c", statut: "exclu", present: true },
      { enrollmentId: "d", statut: "terminee", present: false },
      { enrollmentId: "e", statut: "en_cours", present: true },
    ]);
    expect(r.map((s) => s.enrollmentId)).toEqual(["a", "e"]);
  });
});

describe("etatDuBilan", () => {
  it("terminable seulement avec une finale pour chacun ET l'avis", () => {
    const base = {
      stagiaires: [
        { enrollmentId: "a", finaleExiste: true },
        { enrollmentId: "b", finaleExiste: false },
      ],
      avisDonne: true,
      termineAt: null,
    };
    expect(etatDuBilan(base)).toMatchObject({ restants: 1, peutTerminer: false, termine: false });
    expect(
      etatDuBilan({
        ...base,
        stagiaires: [{ enrollmentId: "a", finaleExiste: true }],
        avisDonne: false,
      }),
    ).toMatchObject({ restants: 0, peutTerminer: false });
    expect(
      etatDuBilan({ ...base, stagiaires: [{ enrollmentId: "a", finaleExiste: true }] }),
    ).toMatchObject({ restants: 0, peutTerminer: true, termine: false });
  });

  it("aucun stagiaire présent : l'avis suffit", () => {
    expect(etatDuBilan({ stagiaires: [], avisDonne: true, termineAt: null }).peutTerminer).toBe(
      true,
    );
  });

  it("terminé : figé, plus rien à terminer", () => {
    const e = etatDuBilan({ stagiaires: [], avisDonne: true, termineAt: new Date() });
    expect(e).toMatchObject({ termine: true, peutTerminer: false });
  });
});

describe("formationCompletePourFormateur", () => {
  const feuillesOk = { signees: 4, manquantes: 0, conditionFinanceurEnAttente: false };

  it("éteint (bilan non exigé) : exactement la règle des feuilles, rien de plus", () => {
    expect(formationCompletePourFormateur({ ...feuillesOk, bilan: null })).toEqual({
      payable: true,
      raison: null,
      manquantes: 0,
    });
    expect(formationCompletePourFormateur({ ...feuillesOk, manquantes: 2, bilan: null })).toEqual({
      payable: false,
      raison: "feuilles_incompletes",
      manquantes: 2,
    });
  });

  it("feuilles complètes, bilan exigé et non terminé : non payable, motif « bilan »", () => {
    const v = formationCompletePourFormateur({
      ...feuillesOk,
      bilan: { termine: false, payerQuandMeme: false },
    });
    expect(v).toEqual({ payable: false, raison: "bilan_fin_formation_manquant", manquantes: 0 });
    expect(LIBELLE_MOTIF_FORMATION_INCOMPLETE[v.raison!]).toBe(
      "il manque le bilan de fin de formation (seul le relevé du dernier mois de la mission l'attend ; les mois précédents se paient sur les feuilles de présence contresignées)",
    );
  });

  it("les feuilles passent AVANT le bilan : le motif dit d'abord ce qui manque aux feuilles", () => {
    expect(
      formationCompletePourFormateur({
        ...feuillesOk,
        manquantes: 1,
        bilan: { termine: false, payerQuandMeme: false },
      }).raison,
    ).toBe("feuilles_incompletes");
  });

  it("bilan terminé, ou « payer quand même » : payable", () => {
    expect(
      formationCompletePourFormateur({
        ...feuillesOk,
        bilan: { termine: true, payerQuandMeme: false },
      }).payable,
    ).toBe(true);
    expect(
      formationCompletePourFormateur({
        ...feuillesOk,
        bilan: { termine: false, payerQuandMeme: true },
      }).payable,
    ).toBe(true);
  });

  it("« payer quand même » ne lève PAS l'exigence des feuilles", () => {
    expect(
      formationCompletePourFormateur({
        ...feuillesOk,
        manquantes: 1,
        bilan: { termine: false, payerQuandMeme: true },
      }).payable,
    ).toBe(false);
  });
});

describe("bilanExige", () => {
  const ind = { statut: "sous_traitant", organismeSousTraitantId: null };

  it("interrupteur éteint : jamais", () => {
    expect(bilanExige({ ...ind, allumeLe: null, derniereJournee: "2026-11-04" })).toBe(false);
  });

  it("indépendant, session finie le jour de l'allumage ou après : exigé", () => {
    expect(bilanExige({ ...ind, allumeLe: "2026-11-04", derniereJournee: "2026-11-04" })).toBe(
      true,
    );
    expect(bilanExige({ ...ind, allumeLe: "2026-11-01", derniereJournee: "2026-11-04" })).toBe(
      true,
    );
  });

  it("session finie AVANT l'allumage : jamais rétroactif", () => {
    expect(bilanExige({ ...ind, allumeLe: "2026-11-05", derniereJournee: "2026-11-04" })).toBe(
      false,
    );
  });

  it("salarié, dirigeant, ou formateur d'un organisme : jamais", () => {
    for (const statut of ["salarie", "dirigeant"]) {
      expect(
        bilanExige({
          statut,
          organismeSousTraitantId: null,
          allumeLe: "2026-11-01",
          derniereJournee: "2026-11-04",
        }),
      ).toBe(false);
    }
    expect(
      bilanExige({
        ...ind,
        organismeSousTraitantId: "org",
        allumeLe: "2026-11-01",
        derniereJournee: "2026-11-04",
      }),
    ).toBe(false);
  });
});

describe("relance du bilan (campagne)", () => {
  const ligne = (over: Partial<LigneRelanceBilan> = {}): LigneRelanceBilan => ({
    trainerId: "11111111-1111-4111-8111-111111111111",
    sessionId: "22222222-2222-4222-8222-222222222222",
    email: "f@example.test",
    prenom: "Camille",
    intitule: "IA générative",
    derniereJournee: "2026-11-04",
    termine: false,
    payerQuandMeme: false,
    fermee: false,
    relances: [],
    adresseMorte: false,
    opposition: false,
    ...over,
  });

  it("la règle : J+2 puis J+7, deux au plus", () => {
    expect(REGLE_RELANCE_BILAN.etapes.map((e) => [e.id, e.delaiMs / 86_400_000])).toEqual([
      ["j2", 2],
      ["j7", 7],
    ]);
    expect(REGLE_RELANCE_BILAN.max).toBe(2);
  });

  it("l'origine est la dernière journée ; la clé porte la session", () => {
    const f = faitsRelanceBilan(ligne(), "https://exemple.test/espace/sessions/x#fin-de-formation");
    expect(f).not.toBeNull();
    expect(f!.origineId).toBe("22222222-2222-4222-8222-222222222222");
    expect(f!.etat.origine.toISOString()).toBe("2026-11-04T12:00:00.000Z");
    expect(f!.payload).toMatchObject({ prenom: "Camille", valeurs: { intitulé: "IA générative" } });
  });

  it("bilan terminé ou payé quand même : action faite ; collaboration finie : close", () => {
    expect(faitsRelanceBilan(ligne({ termine: true }), "l")!.etat.actionFaite).toBe(true);
    expect(faitsRelanceBilan(ligne({ payerQuandMeme: true }), "l")!.etat.actionFaite).toBe(true);
    expect(faitsRelanceBilan(ligne({ fermee: true }), "l")!.etat.close).toBe(true);
  });

  it("sans lien vers l'espace : rien", () => {
    expect(faitsRelanceBilan(ligne(), null)).toBeNull();
  });
});

describe("alerte interne à J+10", () => {
  const l = { derniereJournee: "2026-11-04", termine: false, payerQuandMeme: false, fermee: false };
  it("à partir de J+10, si le bilan manque toujours", () => {
    expect(bilanAAlerter(l, new Date("2026-11-13T10:00:00Z"))).toBe(false);
    expect(bilanAAlerter(l, new Date("2026-11-14T10:00:00Z"))).toBe(true);
  });
  it("jamais si terminé, payé quand même, ou collaboration finie", () => {
    const d = new Date("2026-11-20T10:00:00Z");
    expect(bilanAAlerter({ ...l, termine: true }, d)).toBe(false);
    expect(bilanAAlerter({ ...l, payerQuandMeme: true }, d)).toBe(false);
    expect(bilanAAlerter({ ...l, fermee: true }, d)).toBe(false);
  });
});

describe("lexique de F61 (consigne du lot)", () => {
  it("aucun des mots écartés, y compris ceux propres à ce lot", async () => {
    const { TEXTES_FORMATEUR } = await import("@/lib/email/templates/formateur-independant-textes");
    const t = TEXTES_FORMATEUR["formateur-bilan-fin-formation"];
    const tout = [
      t.titre,
      ...t.variantes.flatMap((v) => [v.objet, ...v.paragraphes, ...v.boutons]),
    ].join("\n");
    expect(tout).not.toMatch(
      /\b(poste|entretien|recrutement|salaire|rémunération|bienvenue|vous devez|obligatoire|agent commercial|grenoble|expert-comptable)\b/i,
    );
    expect(t.code).toBe("F61");
    expect(t.variantes.map((v) => v.etape)).toEqual(["J+2", "J+7"]);
  });
});

describe("formationCompleteSurLaSession (affichage console)", () => {
  it("même lecture des feuilles que le passage, puis le bilan", async () => {
    const { formationCompleteSurLaSession } = await import("../../paiement/formation-complete");
    const journeesPrevues = [{ jour: "2026-11-04", heureDebut: "09:00", heureFin: "17:00" }];
    const base = { journeesPrevues, conditionFinanceurEnAttente: false };
    expect(
      formationCompleteSurLaSession({
        ...base,
        contresignatures: [{ jour: "2026-11-04", demiJournee: "matin" }],
        bilan: null,
      }).raison,
    ).toBe("feuilles_incompletes");
    expect(
      formationCompleteSurLaSession({
        ...base,
        contresignatures: [{ jour: "2026-11-04", demiJournee: "journee" }],
        bilan: { termine: false, payerQuandMeme: false },
      }).raison,
    ).toBe("bilan_fin_formation_manquant");
    expect(
      formationCompleteSurLaSession({
        ...base,
        contresignatures: [{ jour: "2026-11-04", demiJournee: "journee" }],
        bilan: { termine: true, payerQuandMeme: false },
      }).payable,
    ).toBe(true);
  });
});
