import { describe, expect, it } from "vitest";
import { CRITERES_BLOQUANTS, estCodeRefus } from "./codes-refus";
import {
  AVERTISSEMENTS,
  CLASSE_CRITERE,
  MAX_REECRITURES,
  PLAFOND_COUT_USD,
  SEUIL_BLOQUE,
  SEUIL_PUBLICATION_DEPART,
  actionApresVerdict,
  estCritereBloquant,
  publicationAutorisee,
  refusDepuisVerdict,
  type ResultatCritere,
  type SortiePorte,
} from "./contrat-porte";

const ok = (id: ResultatCritere["id"]): ResultatCritere => ({
  id,
  etat: "ok",
  preuve: "",
  raison: "",
});
const echec = (
  id: ResultatCritere["id"],
  extra: Partial<ResultatCritere> = {},
): ResultatCritere => ({
  id,
  etat: "echec",
  preuve: "preuve",
  raison: "raison en français",
  ...extra,
});

function sortie(
  verdict: SortiePorte["verdict"],
  criteres: ResultatCritere[],
  note = 90,
): SortiePorte {
  return { versionPorte: "v1", verdict, note, criteres };
}

describe("constantes du contrat", () => {
  it("reprend les valeurs de la conception", () => {
    expect(SEUIL_PUBLICATION_DEPART).toBe(85);
    expect(SEUIL_BLOQUE).toBe(70);
    expect(MAX_REECRITURES).toBe(2);
    expect(PLAFOND_COUT_USD).toBe(3);
    expect(AVERTISSEMENTS).toHaveLength(10);
    expect(AVERTISSEMENTS[0]).toBe("W01");
    expect(AVERTISSEMENTS[9]).toBe("W10");
  });

  it("classe chaque bloquant comme le § 5 de la porte", () => {
    const attendu = {
      dur: ["B01", "B02", "B03", "B04", "B09", "B12", "B14", "B15"],
      corrigeable: ["B08", "B10", "B11", "B13", "B16"],
      derogeable: ["B05", "B06", "B07"],
      report: ["B17"],
    };
    for (const [classe, ids] of Object.entries(attendu)) {
      for (const id of ids) expect(CLASSE_CRITERE[id as keyof typeof CLASSE_CRITERE]).toBe(classe);
    }
    expect(Object.keys(CLASSE_CRITERE)).toEqual([...CRITERES_BLOQUANTS]);
  });

  it("estCritereBloquant distingue Bnn et Wnn", () => {
    expect(estCritereBloquant("B01")).toBe(true);
    expect(estCritereBloquant("B17")).toBe(true);
    expect(estCritereBloquant("W01")).toBe(false);
    expect(estCritereBloquant("B18")).toBe(false);
  });
});

describe("refusDepuisVerdict", () => {
  it("ne rend rien pour un contenu publiable", () => {
    expect(
      refusDepuisVerdict(sortie("publiable", [ok("B01")]), { tentative: 1, coutUsd: 0.4 }),
    ).toEqual([]);
  });

  it("rend un refus par bloquant en échec, avec code, critère, raison, preuve, tentative et version", () => {
    const r = refusDepuisVerdict(
      sortie("a_corriger", [ok("B01"), echec("B08", { section: "intro" }), echec("W03")], 80),
      { tentative: 2, coutUsd: 1.25, versionPrompt: "p3", versionBrief: "b1" },
    );
    expect(r).toEqual([
      {
        role: "porte",
        code: "reponse_directe_absente",
        critere: "B08",
        raison: "raison en français",
        preuve: "preuve",
        section: "intro",
        tentative: 2,
        versionPorte: "v1",
        coutUsd: 1.25,
        versionPrompt: "p3",
        versionBrief: "b1",
      },
    ]);
  });

  it("applique la précision du critère (B11 → longueur) et ignore une précision étrangère", () => {
    const [a, b] = refusDepuisVerdict(
      sortie("a_corriger", [
        echec("B11", { precision: "longueur_hors_fourchette" }),
        echec("B01", { precision: "chiffre_retire" }),
      ]),
      { tentative: 1, coutUsd: 0 },
    );
    expect(a?.code).toBe("longueur_hors_fourchette");
    expect(b?.code).toBe("doctrine");
  });

  it("enregistre un bloquant non évalué (échec fermé) avec le code du critère", () => {
    const r = refusDepuisVerdict(
      sortie("bloque", [
        { id: "B02", etat: "non_evalue", preuve: "", raison: "source indisponible" },
      ]),
      { tentative: 1, coutUsd: 0 },
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.code).toBe("fait_non_source");
  });

  it("n'enregistre jamais B17 : c'est un report, pas un refus", () => {
    expect(
      refusDepuisVerdict(sortie("a_corriger", [echec("B17")]), { tentative: 1, coutUsd: 0 }),
    ).toEqual([]);
  });

  it("ne produit que des codes de la liste fermée", () => {
    const tous = CRITERES_BLOQUANTS.map((id) => echec(id));
    for (const r of refusDepuisVerdict(sortie("bloque", tous, 10), { tentative: 1, coutUsd: 0 })) {
      expect(estCodeRefus(r.code)).toBe(true);
    }
  });
});

describe("actionApresVerdict", () => {
  const debut = { reecrituresFaites: 0, coutUsd: 0.5 };

  it("publiable → relecture humaine (jamais publication directe)", () => {
    expect(actionApresVerdict(sortie("publiable", [ok("B01")]), debut).action).toBe(
      "relecture_humaine",
    );
  });

  it("B17 seul → report, sans réécriture ni abandon, même au plafond", () => {
    const s = sortie("a_corriger", [echec("B17")]);
    expect(actionApresVerdict(s, debut).action).toBe("reporter");
    expect(actionApresVerdict(s, { reecrituresFaites: 2, coutUsd: 5 }).action).toBe("reporter");
  });

  it("B17 illisible (non évalué) seul → report, jamais blocage", () => {
    const s = sortie("bloque", [
      { id: "B17", etat: "non_evalue", preuve: "", raison: "illisible" },
    ]);
    expect(actionApresVerdict(s, debut).action).toBe("reporter");
  });

  it("B17 avec un autre échec → traité comme un refus ordinaire", () => {
    const s = sortie("a_corriger", [echec("B17"), echec("B08", { section: "intro" })]);
    expect(actionApresVerdict(s, debut).action).toBe("reecrire");
  });

  it("a_corriger avec cause localisée → réécriture ciblée, corrections listées", () => {
    const r = actionApresVerdict(
      sortie("a_corriger", [echec("B10", { section: "conclusion" })], 80),
      debut,
    );
    expect(r).toEqual({
      action: "reecrire",
      corrections: [{ critere: "B10", section: "conclusion", code: "appel_incoherent" }],
    });
  });

  it("bloquant dur localisable → réécriture ; non localisable → abandon avec le code du critère", () => {
    expect(
      actionApresVerdict(sortie("bloque", [echec("B01", { section: "h2-3" })]), debut).action,
    ).toBe("reecrire");
    const r = actionApresVerdict(sortie("bloque", [echec("B15")]), debut);
    expect(r).toEqual({ action: "abandonner", code: "texte_cache" });
  });

  it("2 réécritures déjà faites → abandon plafond_atteint", () => {
    const r = actionApresVerdict(sortie("a_corriger", [echec("B08", { section: "x" })]), {
      reecrituresFaites: MAX_REECRITURES,
      coutUsd: 1,
    });
    expect(r).toMatchObject({ action: "abandonner", code: "plafond_atteint" });
  });

  it("plafond de coût atteint → abandon plafond_atteint, mais pas en dessous", () => {
    const s = sortie("a_corriger", [echec("B08", { section: "x" })]);
    expect(actionApresVerdict(s, { reecrituresFaites: 0, coutUsd: PLAFOND_COUT_USD })).toEqual({
      action: "abandonner",
      code: "plafond_atteint",
    });
    expect(
      actionApresVerdict(s, { reecrituresFaites: 0, coutUsd: PLAFOND_COUT_USD - 0.01 }).action,
    ).toBe("reecrire");
  });

  it("verdict non publiable sans critère en échec (note basse) → réécriture tant qu'il reste des essais", () => {
    expect(actionApresVerdict(sortie("a_corriger", [], 78), debut).action).toBe("reecrire");
  });
});

describe("publicationAutorisee (échec fermé)", () => {
  it("refuse si l'appel de la porte a échoué", () => {
    expect(publicationAutorisee({ etat: "erreur", message: "délai dépassé" })).toBe(false);
  });

  it("autorise seulement un verdict publiable sans critère bloquant en défaut", () => {
    expect(
      publicationAutorisee({ etat: "ok", sortie: sortie("publiable", [ok("B01"), echec("W02")]) }),
    ).toBe(true);
    expect(publicationAutorisee({ etat: "ok", sortie: sortie("a_corriger", [ok("B01")]) })).toBe(
      false,
    );
    expect(publicationAutorisee({ etat: "ok", sortie: sortie("bloque", [ok("B01")]) })).toBe(false);
  });

  it("refuse un verdict « publiable » incohérent : bloquant en échec ou non évalué", () => {
    expect(publicationAutorisee({ etat: "ok", sortie: sortie("publiable", [echec("B03")]) })).toBe(
      false,
    );
    expect(
      publicationAutorisee({
        etat: "ok",
        sortie: sortie("publiable", [{ id: "B02", etat: "non_evalue", preuve: "", raison: "" }]),
      }),
    ).toBe(false);
    expect(publicationAutorisee({ etat: "ok", sortie: sortie("publiable", [echec("B17")]) })).toBe(
      false,
    );
  });

  it("refuse une note hors de 0 à 100", () => {
    expect(publicationAutorisee({ etat: "ok", sortie: sortie("publiable", [], 101) })).toBe(false);
    expect(publicationAutorisee({ etat: "ok", sortie: sortie("publiable", [], Number.NaN) })).toBe(
      false,
    );
  });
});
