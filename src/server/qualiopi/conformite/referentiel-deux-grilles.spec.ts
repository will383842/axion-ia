/**
 * Référentiel national qualité — deux grilles, choisies par la DATE, sans
 * transition (décret n° 2026-728 du 1er août 2026, en vigueur le 1er novembre
 * 2026).
 *
 * Source des rédactions : `_AUDIT/QUALIOPI-AUDIT-INITIAL-2026-10-01/
 * REFORME-01-11-2026-SOURCES.md` (texte lu sur Légifrance le 02/10/2026).
 *
 * Ce que ces tests tiennent :
 *   - un audit tenu le 31/10/2026 se juge sur 32 indicateurs, un audit tenu le
 *     01/11/2026 sur 33 — le jour de PARIS, pas celui du conteneur ;
 *   - la date d'audit configurée l'emporte sur le jour même ;
 *   - le 33 existe, est NON APPLICABLE à un organisme sans apprentissage, par
 *     le même mécanisme que 13/14/15/20/29, et n'est pas super-indicateur ;
 *   - les super-indicateurs et le régime nouvel entrant ne bougent pas ;
 *   - les libellés modifiés reprennent le texte officiel.
 */

import { describe, it, expect } from "vitest";

import {
  GRILLE_RNQ_2026,
  GRILLE_RNQ_V9,
  INDICATEURS_RNQ,
  INDICATEURS_RNQ_2026,
  JOUR_ENTREE_EN_VIGUEUR_RNQ_2026,
  MOTIFS_NON_APPLICABLE,
  choisirReferentiel,
  estJourIsoValide,
  estSuperIndicateur,
  grillePourJour,
  indicateursApplicables,
  jourParisIso,
  libelleReferentielApplique,
  motifNonApplicable,
} from "./indicateurs-registre";
import { INDICATEURS_AUDIT_INITIAL_PROCESSUS } from "./reperes-audit-initial";
import { REGISTRES_PAR_INDICATEUR } from "./registres-par-indicateur";

function ind2026(numero: number) {
  const ind = INDICATEURS_RNQ_2026.find((i) => i.numero === numero);
  if (ind === undefined) throw new Error(`indicateur ${numero} absent de la grille 2026`);
  return ind;
}

describe("les deux grilles", () => {
  it("V9 : 32 indicateurs ; 2026 : 33, numérotés 1 à 33 sans trou", () => {
    expect(GRILLE_RNQ_V9.indicateurs).toHaveLength(32);
    expect(GRILLE_RNQ_2026.indicateurs).toHaveLength(33);
    expect(INDICATEURS_RNQ_2026.map((i) => i.numero)).toEqual(
      Array.from({ length: 33 }, (_, k) => k + 1),
    );
  });

  it("1 à 32 : même critère, même conditionnel, même super dans les deux grilles", () => {
    // Les colonnes de catégories cochées sont identiques dans les deux tableaux
    // officiels (SOURCES §2) ; seule la rédaction change.
    for (const v9 of INDICATEURS_RNQ) {
      const n = ind2026(v9.numero);
      expect([n.critere, n.conditionnel, n.super], `ind. ${v9.numero}`).toEqual([
        v9.critere,
        v9.conditionnel,
        v9.super,
      ]);
    }
  });

  it("la liste des super-indicateurs est INCHANGÉE (art. 5 de l'arrêté non modifié)", () => {
    const supers = (liste: typeof INDICATEURS_RNQ) =>
      liste.filter((i) => i.super).map((i) => i.numero);
    expect(supers(INDICATEURS_RNQ_2026)).toEqual(supers(INDICATEURS_RNQ));
    expect(supers(INDICATEURS_RNQ_2026)).toEqual([
      4, 5, 6, 7, 10, 11, 14, 15, 16, 20, 21, 22, 26, 27, 29, 31, 32,
    ]);
  });

  it("le régime nouvel entrant est INCHANGÉ (même liste de numéros)", () => {
    expect([...INDICATEURS_AUDIT_INITIAL_PROCESSUS]).toEqual([
      2, 3, 11, 13, 14, 19, 22, 24, 25, 26, 32,
    ]);
  });

  it("chaque indicateur des deux grilles a une entrée « où le vérifier »", () => {
    for (const ind of INDICATEURS_RNQ_2026) {
      expect(REGISTRES_PAR_INDICATEUR[ind.numero], `ind. ${ind.numero}`).toBeDefined();
    }
  });
});

describe("indicateur 33 — apprentissage seulement", () => {
  it("critère NON relevé (jamais un critère déduit), conditionnel « app », pas super", () => {
    const i33 = ind2026(33);
    expect(i33.critere).toBeNull();
    expect(i33.conditionnel).toBe("app");
    expect(i33.super).toBe(false);
    expect(estSuperIndicateur(33, ["classique"])).toBe(false);
  });

  it("non applicable sans apprentissage, avec le motif de 13/14/15/20/29", () => {
    expect(indicateursApplicables(["classique"], INDICATEURS_RNQ_2026)).not.toContain(33);
    expect(motifNonApplicable(33)).toBe(MOTIFS_NON_APPLICABLE.app);
    expect(motifNonApplicable(33)).toBe(motifNonApplicable(13));
  });

  it("applicable quand l'apprentissage est déclaré (le mécanisme n'est pas figé)", () => {
    expect(indicateursApplicables(["apprentissage"], INDICATEURS_RNQ_2026)).toContain(33);
  });

  it("même nombre d'applicables dans les deux grilles pour une action classique (23)", () => {
    // Le 33 s'ajoute au dénominateur des seuls CFA : le score d'un organisme
    // d'actions de formation garde 23 indicateurs applicables.
    expect(indicateursApplicables(["classique"], INDICATEURS_RNQ)).toHaveLength(23);
    expect(indicateursApplicables(["classique"], INDICATEURS_RNQ_2026)).toHaveLength(23);
  });
});

describe("libellés officiels de la grille 2026", () => {
  it("32 : démarche d'amélioration continue ET analyse des risques, mot pour mot", () => {
    expect(ind2026(32).libelleOfficiel).toBe(
      "Le prestataire met en place une démarche d'amélioration continue à partir de l'analyse des appréciations et des réclamations, ainsi qu'une analyse des risques sur la qualité des formations délivrées.",
    );
  });

  it("12 : la rédaction du fichier source, mot pour mot (ellipse initiale comprise)", () => {
    expect(ind2026(12).libelleOfficiel).toBe(
      "… favoriser l'engagement des bénéficiaires et prévenir les ruptures de parcours. Il s'assure de la prévention et du traitement de toute situation de violence, dont les violences sexistes et sexuelles, de harcèlement ou de discrimination dans le cadre de leur formation.",
    );
  });

  it("7 : commence par la condition officielle", () => {
    expect(ind2026(7).libelleOfficiel).toMatch(
      /^Lorsque le prestataire met en œuvre des prestations conduisant à une certification professionnelle, il s'assure/,
    );
  });

  it("12 : la phrase sur les violences, mot pour mot", () => {
    expect(ind2026(12).libelleOfficiel).toContain(
      "Il s'assure de la prévention et du traitement de toute situation de violence, dont les violences sexistes et sexuelles, de harcèlement ou de discrimination dans le cadre de leur formation.",
    );
  });

  it("27 : la traçabilité dans les contrats de sous-traitance, mot pour mot", () => {
    expect(ind2026(27).libelleOfficiel).toBe(
      "Lorsque le prestataire fait appel à la sous-traitance ou au portage salarial, il s'assure du respect de la conformité au présent référentiel et en assure la traçabilité dans les contrats de sous-traitance.",
    );
  });

  it("33 : la rédaction intégrale, mot pour mot", () => {
    expect(ind2026(33).libelleOfficiel).toBe(
      "Le prestataire met en place un dispositif d'évaluation des contenus et des enseignements par les apprenants, distinct du recueil général de satisfaction, dont les résultats sont partagés avec les équipes pédagogiques et donnent lieu à la formalisation d'une démarche d'amélioration continue, dont il mesure périodiquement l'efficacité.",
    );
  });

  it.each([
    [1, "type de reconnaissance de la formation délivrée"],
    [1, "modalités pédagogiques et de financements"],
    [1, "aucune mention de nature à induire le public en erreur"],
    [
      2,
      "en précisant de manière transparente leurs modalités de calcul ou en s'appuyant sur des dispositifs existants",
    ],
    [3, "en particulier les poursuites d'études"],
    [
      7,
      "et peut prouver sa capacité à assurer cette certification, y compris en qualité d'organisme habilité",
    ],
    [14, "Il dispose d'une procédure de traitement sans délai des situations de rupture"],
    [15, "de manière renforcée lorsqu'ils sont mineurs"],
    [15, "médiateur de l'apprentissage"],
    [
      19,
      "Lorsque des modules pédagogiques sont réalisés à distance, le prestataire vérifie l'effectivité de leur suivi par les apprenants.",
    ],
    [19, "le prestataire dispose d'un référent pédagogique par formation"],
    [20, "seuil fixé par arrêté"],
    [30, "financeurs (le cas échéant)"],
    [
      31,
      "des réclamations exprimées par ces dernières ainsi que des aléas survenus en cours de prestation",
    ],
  ])("ind. %i porte « %s »", (numero, extrait) => {
    expect(ind2026(numero).libelleOfficiel).toContain(extrait);
  });

  it("les indicateurs non modifiés gardent leur libellé V9", () => {
    // SOURCES §2.4 : inchangés mot pour mot.
    for (const n of [4, 5, 6, 8, 9, 10, 11, 13, 16, 17, 18, 21, 22, 23, 24, 25, 26, 28, 29]) {
      expect(ind2026(n).libelleOfficiel).toBe(
        INDICATEURS_RNQ.find((i) => i.numero === n)?.libelleOfficiel,
      );
    }
  });

  it("les treize indicateurs modifiés ont bien changé de libellé", () => {
    for (const n of [1, 2, 3, 7, 12, 14, 15, 19, 20, 27, 30, 31, 32]) {
      expect(ind2026(n).libelleOfficiel, `ind. ${n}`).not.toBe(
        INDICATEURS_RNQ.find((i) => i.numero === n)?.libelleOfficiel,
      );
    }
  });

  it("la grille V9 n'a pas bougé (un audit d'octobre la lit encore)", () => {
    expect(INDICATEURS_RNQ.find((i) => i.numero === 32)?.libelleOfficiel).toBe(
      "Mesures d'amélioration à partir de l'analyse des appréciations et des réclamations",
    );
  });
});

describe("choix de la grille par la date — sans transition", () => {
  it("la date d'entrée en vigueur est celle du décret", () => {
    expect(JOUR_ENTREE_EN_VIGUEUR_RNQ_2026).toBe("2026-11-01");
  });

  it("31/10/2026 → V9 ; 01/11/2026 → 2026", () => {
    expect(grillePourJour("2026-10-31").id).toBe("rnq-v9");
    expect(grillePourJour("2026-11-01").id).toBe("rnq-2026");
    expect(grillePourJour("2027-03-15").id).toBe("rnq-2026");
  });

  it("le jour est celui de PARIS : 31/10 à 23 h 30 UTC, c'est déjà le 1er novembre", () => {
    const instant = new Date("2026-10-31T23:30:00.000Z"); // 00 h 30 à Paris (UTC+1)
    expect(jourParisIso(instant)).toBe("2026-11-01");
    const r = choisirReferentiel("", instant);
    expect(r.grille).toBe("rnq-2026");
    expect(r.origine).toBe("date_du_jour");
  });

  it("sans date d'audit configurée, le jour même choisit", () => {
    const r = choisirReferentiel("", new Date("2026-10-02T10:00:00.000Z"));
    expect(r).toMatchObject({
      grille: "rnq-v9",
      version: "RNQ-V9",
      nbIndicateurs: 32,
      jourReference: "2026-10-02",
      origine: "date_du_jour",
    });
  });

  it("la date d'audit configurée l'emporte sur le jour, dans les deux sens", () => {
    const aujourdhui = new Date("2026-10-02T10:00:00.000Z");
    expect(choisirReferentiel("2026-11-05", aujourdhui)).toMatchObject({
      grille: "rnq-2026",
      version: "RNQ-2026-728",
      nbIndicateurs: 33,
      jourReference: "2026-11-05",
      origine: "date_audit",
    });
    // Audit tenu le 28/10, consulté après le 1er novembre : il reste jugé sur 32.
    expect(choisirReferentiel("2026-10-28", new Date("2026-11-20T10:00:00.000Z")).grille).toBe(
      "rnq-v9",
    );
  });

  it("une date illisible est ignorée — c'est le jour qui choisit", () => {
    const aujourdhui = new Date("2026-11-03T10:00:00.000Z");
    for (const v of ["2026-13-01", "05/11/2026", "demain", "2026-02-30"]) {
      const r = choisirReferentiel(v, aujourdhui);
      expect(r.origine, v).toBe("date_du_jour");
      expect(r.grille, v).toBe("rnq-2026");
    }
    expect(estJourIsoValide("2026-11-05")).toBe(true);
    expect(estJourIsoValide("2026-02-30")).toBe(false);
  });

  it("l'en-tête dit la grille appliquée ET sa date, plus de « RNQ-V9 » nu", () => {
    const avant = libelleReferentielApplique(
      choisirReferentiel("", new Date("2026-10-02T10:00:00.000Z")),
    );
    expect(avant).toContain("version en vigueur jusqu'au 31 octobre 2026");
    expect(avant).toContain("02/10/2026");
    expect(avant).toContain("aucune date d'audit n'est configurée");

    const apres = libelleReferentielApplique(
      choisirReferentiel("2026-11-05", new Date("2026-10-02T10:00:00.000Z")),
    );
    expect(apres).toContain("décret n° 2026-728 du 1er août 2026");
    expect(apres).toContain("33 indicateurs");
    expect(apres).toContain("audit tenu le 05/11/2026 (date d'audit configurée)");
  });
});
