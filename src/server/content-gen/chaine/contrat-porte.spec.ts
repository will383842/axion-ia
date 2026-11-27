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
  noteValide,
  tentativeEnCours,
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

/** Sortie complète : les bloquants non cités sont « ok » (la porte les a tous évalués). */
function sortie(
  verdict: SortiePorte["verdict"],
  criteres: ResultatCritere[],
  note = 90,
): SortiePorte {
  const cites = new Set(criteres.map((c) => c.id));
  const completes = [...CRITERES_BLOQUANTS.filter((b) => !cites.has(b)).map(ok), ...criteres];
  return { versionPorte: "v1", verdict, note, criteres: completes };
}

const brut = (
  verdict: SortiePorte["verdict"],
  criteres: ResultatCritere[],
  note = 90,
): SortiePorte => ({
  versionPorte: "v1",
  verdict,
  note,
  criteres,
});

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
      refusDepuisVerdict(sortie("publiable", [ok("B01")]), {
        contenuId: "c1",
        reecrituresFaites: 0,
        coutUsd: 0.4,
      }),
    ).toEqual([]);
  });

  it("rend un refus par bloquant en échec, avec code, critère, raison, preuve, tentative et version", () => {
    const r = refusDepuisVerdict(
      sortie("a_corriger", [ok("B01"), echec("B08", { section: "intro" }), echec("W03")], 80),
      {
        contenuId: "c1",
        reecrituresFaites: 1,
        coutUsd: 1.25,
        versionPrompt: "p3",
        versionBrief: "b1",
      },
    );
    expect(r).toEqual([
      {
        role: "porte",
        contenuId: "c1",
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
    const [b, a] = refusDepuisVerdict(
      sortie("a_corriger", [
        echec("B11", { precision: "longueur_hors_fourchette" }),
        echec("B01", { precision: "chiffre_retire" }),
      ]),
      { contenuId: "c1", reecrituresFaites: 0, coutUsd: 0 },
    );
    expect(a?.code).toBe("longueur_hors_fourchette");
    expect(b?.code).toBe("doctrine");
  });

  it("n'enregistre pas un bloquant non évalué ni absent : une panne n'est pas un refus", () => {
    const ctx = { contenuId: "c1", reecrituresFaites: 0, coutUsd: 0 };
    expect(
      refusDepuisVerdict(
        sortie("bloque", [
          { id: "B02", etat: "non_evalue", preuve: "", raison: "source indisponible" },
        ]),
        ctx,
      ),
    ).toEqual([]);
    expect(refusDepuisVerdict(brut("bloque", [ok("B01")]), ctx)).toEqual([]);
  });

  it("enregistre un refus « autre » sans critère quand seule la note refuse", () => {
    const r = refusDepuisVerdict(sortie("a_corriger", [], 78), {
      contenuId: "c9",
      reecrituresFaites: 1,
      coutUsd: 0.9,
    });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ code: "autre", contenuId: "c9", tentative: 2, coutUsd: 0.9 });
    expect(r[0]?.critere).toBeUndefined();
  });

  it("n'enregistre jamais B17 : c'est un report, pas un refus", () => {
    expect(
      refusDepuisVerdict(sortie("a_corriger", [echec("B17")]), {
        contenuId: "c1",
        reecrituresFaites: 0,
        coutUsd: 0,
      }),
    ).toEqual([]);
  });

  it("ne produit que des codes de la liste fermée", () => {
    const tous = CRITERES_BLOQUANTS.map((id) => echec(id));
    for (const r of refusDepuisVerdict(sortie("bloque", tous, 10), {
      contenuId: "c1",
      reecrituresFaites: 0,
      coutUsd: 0,
    })) {
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

  it("B17 avec un autre échec (note ≥ 70) → règle ordinaire : seul B17 est un report (§ 5 de la porte)", () => {
    const s = sortie("a_corriger", [echec("B17"), echec("B08", { section: "intro" })]);
    expect(actionApresVerdict(s, debut).action).toBe("reecrire");
    expect(
      refusDepuisVerdict(s, { contenuId: "c1", reecrituresFaites: 0, coutUsd: 0 }).map(
        (r) => r.critere,
      ),
    ).toEqual(["B08"]);
  });

  it("B17 non évalué + échec dur (B01) → règle ordinaire, pas de report", () => {
    const b17ne = {
      id: "B17" as const,
      etat: "non_evalue" as const,
      preuve: "",
      raison: "illisible",
    };
    const s = sortie("a_corriger", [b17ne, echec("B01", { section: "intro" })], 80);
    expect(actionApresVerdict(s, debut).action).toBe("reecrire");
  });

  it("porte pré-Q10 : B17 absent de la sortie n'est pas un report (sinon tout contenu attendrait)", () => {
    const s = sortie("a_corriger", [echec("B08", { section: "intro" })], 80);
    const sansB17 = { ...s, criteres: s.criteres.filter((c) => c.id !== "B17") };
    expect(actionApresVerdict(sansB17, debut).action).toBe("reecrire");
    expect(
      refusDepuisVerdict(sansB17, { contenuId: "c1", reecrituresFaites: 0, coutUsd: 0 }),
    ).toHaveLength(1);
    // et la publication reste fermée tant que B17 n'est pas rendu
    const propre = sortie("publiable", [], 95);
    const propreSansB17 = { ...propre, criteres: propre.criteres.filter((c) => c.id !== "B17") };
    expect(publicationAutorisee({ etat: "ok", sortie: propreSansB17 })).toBe(false);
    expect(publicationAutorisee({ etat: "ok", sortie: propre })).toBe(true);
  });

  it("sous-critères B11a, B11b, B11c de la porte réelle : repliés sur B11, cause précise", () => {
    const sousCritere = (id: string) =>
      ({
        id,
        etat: "echec",
        preuve: "p",
        raison: "r",
        section: "intro",
      }) as unknown as ResultatCritere;
    for (const [id, code] of [
      ["B11a", "structure_titres"],
      ["B11b", "structure_titres"],
      ["B11c", "reponse_directe_absente"],
    ] as const) {
      const s = sortie("a_corriger", [sousCritere(id)], 80);
      const action = actionApresVerdict(s, debut);
      expect(action).toEqual({
        action: "reecrire",
        corrections: [{ critere: "B11", section: "intro", code }],
      });
      const [r] = refusDepuisVerdict(s, { contenuId: "c1", reecrituresFaites: 0, coutUsd: 0 });
      expect(r).toMatchObject({ critere: "B11", code });
      expect(publicationAutorisee({ etat: "ok", sortie: s })).toBe(false);
    }
  });

  it("B11 et un sous-critère en échec ensemble : chaque section et chaque cause est gardée", () => {
    const e = (id: string, section: string) =>
      ({ id, etat: "echec", preuve: "p", raison: "r", section }) as unknown as ResultatCritere;
    const s = sortie("a_corriger", [e("B11", "corps"), e("B11c", "intro"), e("B11a", "plan")], 80);
    const action = actionApresVerdict(s, debut);
    expect(action).toEqual({
      action: "reecrire",
      corrections: [
        { critere: "B11", section: "corps", code: "style" },
        { critere: "B11", section: "intro", code: "reponse_directe_absente" },
        { critere: "B11", section: "plan", code: "structure_titres" },
      ],
    });
    const refus = refusDepuisVerdict(s, { contenuId: "c1", reecrituresFaites: 0, coutUsd: 0 });
    expect(refus.map((r) => r.code)).toEqual([
      "style",
      "reponse_directe_absente",
      "structure_titres",
    ]);
  });

  it("doublons : B11a et B11b sur la même section, W03 répété → une seule correction, une seule ligne", () => {
    const e = (id: string, section: string) =>
      ({ id, etat: "echec", preuve: "p", raison: "r", section }) as unknown as ResultatCritere;
    const s = sortie("a_corriger", [e("B11a", "plan"), e("B11b", "plan")], 80);
    expect(actionApresVerdict(s, debut)).toEqual({
      action: "reecrire",
      corrections: [{ critere: "B11", section: "plan", code: "structure_titres" }],
    });
    expect(
      refusDepuisVerdict(s, { contenuId: "c1", reecrituresFaites: 0, coutUsd: 0 }),
    ).toHaveLength(1);
    const w = sortie("a_corriger", [e("W03", "intro"), e("W03", "intro")], 40);
    expect(actionApresVerdict(w, debut)).toEqual({
      action: "reecrire",
      corrections: [{ critere: "W03", section: "intro", code: "style" }],
    });
  });

  it("B11 non évalué + B11c en échec → mise en attente, ni réécriture ni refus", () => {
    const ne = {
      id: "B11",
      etat: "non_evalue",
      preuve: "",
      raison: "panne",
    } as unknown as ResultatCritere;
    const c = {
      id: "B11c",
      etat: "echec",
      preuve: "p",
      raison: "r",
      section: "intro",
    } as unknown as ResultatCritere;
    const s = sortie("a_corriger", [ne, c], 80);
    expect(actionApresVerdict(s, debut).action).toBe("mettre_en_attente");
    expect(refusDepuisVerdict(s, { contenuId: "c1", reecrituresFaites: 0, coutUsd: 0 })).toEqual(
      [],
    );
  });

  it("un non évalué hors B04 avec un échec → mise en attente, pas de réécriture", () => {
    const s = sortie("a_corriger", [
      echec("B05"),
      { id: "B02", etat: "non_evalue", preuve: "", raison: "source en panne" },
    ]);
    expect(actionApresVerdict(s, debut).action).toBe("mettre_en_attente");
    expect(refusDepuisVerdict(s, { contenuId: "c1", reecrituresFaites: 0, coutUsd: 0 })).toEqual(
      [],
    );
  });

  it("dérogeable seul avec une note sous 70 → pas de dérogation proposée", () => {
    const s = sortie("bloque", [echec("B05")], 40);
    expect(actionApresVerdict(s, debut)).toEqual({
      action: "abandonner",
      code: "intention_couverte",
    });
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

  it("note basse sans bloquant en échec : corrections tirées des avertissements localisés", () => {
    const r = actionApresVerdict(
      sortie("a_corriger", [echec("W02", { section: "h2-2" })], 78),
      debut,
    );
    expect(r).toEqual({
      action: "reecrire",
      corrections: [{ critere: "W02", section: "h2-2", code: "style" }],
    });
  });

  it("note basse sans rien de localisable → abandon « autre » (jamais une réécriture vide)", () => {
    expect(actionApresVerdict(sortie("a_corriger", [], 78), debut)).toEqual({
      action: "abandonner",
      code: "autre",
    });
    expect(actionApresVerdict(sortie("bloque", [echec("W03")], 60), debut)).toEqual({
      action: "abandonner",
      code: "autre",
    });
  });

  it("bloquant non évalué (source indisponible) seul → mise en attente, ni refus ni abandon", () => {
    const s = sortie("bloque", [{ id: "B02", etat: "non_evalue", preuve: "", raison: "" }]);
    expect(actionApresVerdict(s, debut)).toEqual({
      action: "mettre_en_attente",
      criteres: ["B02"],
    });
    // même au plafond : l'attente ne détruit pas le contenu
    expect(actionApresVerdict(s, { reecrituresFaites: 2, coutUsd: 9 }).action).toBe(
      "mettre_en_attente",
    );
  });

  it("B04 non évalué seul → relecture humaine (§ 5 de la porte) ; avec un autre non évalué → attente", () => {
    const b04 = { id: "B04", etat: "non_evalue", preuve: "", raison: "" } as const;
    expect(actionApresVerdict(sortie("bloque", [b04]), debut)).toEqual({
      action: "relecture_humaine",
    });
    expect(
      actionApresVerdict(
        sortie("bloque", [b04, { id: "B02", etat: "non_evalue", preuve: "", raison: "" }]),
        debut,
      ).action,
    ).toBe("mettre_en_attente");
  });

  it("critères absents de la sortie → mise en attente (échec fermé)", () => {
    const r = actionApresVerdict(brut("publiable", [], 90), debut);
    expect(r.action).toBe("mettre_en_attente");
  });

  it("note invalide → mise en attente, jamais relecture humaine", () => {
    expect(actionApresVerdict(sortie("publiable", [], Number.NaN), debut).action).toBe(
      "mettre_en_attente",
    );
    expect(actionApresVerdict(sortie("publiable", [], 120), debut).action).toBe(
      "mettre_en_attente",
    );
  });

  it("échec non évalué + échec réel : on traite l'échec réel", () => {
    const s = sortie("bloque", [
      { id: "B04", etat: "non_evalue", preuve: "", raison: "" },
      echec("B10", { section: "fin" }),
    ]);
    expect(actionApresVerdict(s, debut).action).toBe("reecrire");
  });

  it("bloquant corrigeable sans section → abandon (cause non localisable)", () => {
    expect(actionApresVerdict(sortie("a_corriger", [echec("B16")], 80), debut)).toEqual({
      action: "abandonner",
      code: "generique",
    });
  });

  it("dur sans section + un autre localisé dans la même sortie → abandon", () => {
    const s = sortie("bloque", [echec("B15"), echec("B10", { section: "fin" })]);
    expect(actionApresVerdict(s, debut)).toEqual({ action: "abandonner", code: "texte_cache" });
  });

  it("dérogeable seul → décision humaine (dérogation ou fusion), pas de réécriture", () => {
    expect(actionApresVerdict(sortie("a_corriger", [echec("B05")], 88), debut)).toEqual({
      action: "derogation_ou_fusion",
      criteres: ["B05"],
    });
  });

  it("dérogeable + corrigeable localisé → réécriture du seul corrigeable", () => {
    const s = sortie("a_corriger", [echec("B06"), echec("B10", { section: "fin" })]);
    expect(actionApresVerdict(s, debut)).toEqual({
      action: "reecrire",
      corrections: [{ critere: "B10", section: "fin", code: "appel_incoherent" }],
    });
  });

  it("B17 avec une note sous 70 → pas de report", () => {
    const r = actionApresVerdict(sortie("bloque", [echec("B17")], 60), debut);
    expect(r.action).not.toBe("reporter");
  });
});

describe("cas limites des compteurs, notes et sections", () => {
  const ctx = { contenuId: "c1", reecrituresFaites: 0, coutUsd: 0 };
  const loc = sortie("a_corriger", [echec("B10", { section: "fin" })], 80);

  it("compteur corrompu (NaN, négatif, fractionnaire) → plafond atteint, jamais illimité", () => {
    for (const etat of [
      { reecrituresFaites: Number.NaN, coutUsd: 0 },
      { reecrituresFaites: -1, coutUsd: 0 },
      { reecrituresFaites: 0.5, coutUsd: 0 },
      { reecrituresFaites: 0, coutUsd: Number.NaN },
      { reecrituresFaites: 0, coutUsd: -2 },
    ]) {
      expect(actionApresVerdict(loc, etat)).toEqual({
        action: "abandonner",
        code: "plafond_atteint",
      });
    }
  });

  it("dérogeable seul à 2 réécritures → décision humaine, pas plafond_atteint", () => {
    expect(
      actionApresVerdict(sortie("a_corriger", [echec("B05")], 88), {
        reecrituresFaites: 2,
        coutUsd: 1,
      }),
    ).toEqual({ action: "derogation_ou_fusion", criteres: ["B05"] });
  });

  it("section vide ou d'espaces → non localisée → abandon", () => {
    for (const section of ["", "   "]) {
      expect(
        actionApresVerdict(sortie("a_corriger", [echec("B10", { section })], 80), {
          reecrituresFaites: 0,
          coutUsd: 0,
        }),
      ).toEqual({ action: "abandonner", code: "appel_incoherent" });
    }
  });

  it("note invalide : aucune ligne de refus (panne, pas faute du contenu)", () => {
    expect(refusDepuisVerdict(sortie("bloque", [echec("B01")], Number.NaN), ctx)).toEqual([]);
    expect(refusDepuisVerdict(sortie("a_corriger", [], 120), ctx)).toEqual([]);
  });

  it("B17 seul avec note sous 70 : l'abandon est enregistré (ligne « autre »)", () => {
    const r = refusDepuisVerdict(sortie("bloque", [echec("B17")], 60), ctx);
    expect(r).toHaveLength(1);
    expect(r[0]?.code).toBe("autre");
  });

  it("un non évalué hors B17 sans échec n'ajoute pas de ligne « autre »", () => {
    const s = sortie("bloque", [{ id: "B02", etat: "non_evalue", preuve: "", raison: "" }], 60);
    expect(refusDepuisVerdict(s, ctx)).toEqual([]);
  });

  it("publiable avec une note sous le seuil de départ n'est pas publiable", () => {
    expect(publicationAutorisee({ etat: "ok", sortie: sortie("publiable", [], 40) })).toBe(false);
    expect(publicationAutorisee({ etat: "ok", sortie: sortie("publiable", [], 85) })).toBe(true);
  });
});

describe("tour 3 : cohérence note / verdict / B04 / B17", () => {
  const ctx = { contenuId: "c1", reecrituresFaites: 0, coutUsd: 0 };
  const debut = { reecrituresFaites: 0, coutUsd: 0.5 };
  const b04 = { id: "B04", etat: "non_evalue", preuve: "", raison: "" } as const;

  it("B04 non évalué + note très basse : pas de relecture humaine, abandon et refus enregistré", () => {
    const s = sortie("bloque", [b04], 40);
    expect(actionApresVerdict(s, debut)).toEqual({ action: "abandonner", code: "autre" });
    expect(refusDepuisVerdict(s, ctx).map((r) => r.code)).toEqual(["autre"]);
  });

  it("B04 non évalué + bonne note : relecture humaine, aucun refus", () => {
    const s = sortie("bloque", [b04], 90);
    expect(actionApresVerdict(s, debut).action).toBe("relecture_humaine");
    expect(refusDepuisVerdict(s, ctx)).toEqual([]);
  });

  it("verdict publiable avec une note sous 85 : jamais relecture humaine, refus enregistré", () => {
    const s = sortie("publiable", [], 40);
    expect(actionApresVerdict(s, debut).action).not.toBe("relecture_humaine");
    expect(refusDepuisVerdict(s, ctx).map((r) => r.code)).toEqual(["autre"]);
  });

  it("B04 non évalué + B17 en défaut → report (B04 non évalué n'est pas un échec)", () => {
    const s = sortie("a_corriger", [b04, echec("B17")], 80);
    expect(actionApresVerdict(s, debut)).toEqual({ action: "reporter" });
    expect(refusDepuisVerdict(s, ctx)).toEqual([]);
  });

  it("une section blanche n'est pas recopiée dans le refus", () => {
    const [r] = refusDepuisVerdict(
      sortie("a_corriger", [echec("B10", { section: "  " })], 80),
      ctx,
    );
    expect(r?.section).toBeUndefined();
  });

  it("compteurs corrompus dans le refus : bornés, jamais NaN", () => {
    const [r] = refusDepuisVerdict(sortie("a_corriger", [echec("B01")], 80), {
      contenuId: "c1",
      reecrituresFaites: Number.NaN,
      coutUsd: Number.NaN,
    });
    expect(r?.tentative).toBe(3);
    expect(r?.coutUsd).toBe(0);
  });

  it("verdict a_corriger à 90 sans défaut : raison honnête (pas « sous le seuil »)", () => {
    const [r] = refusDepuisVerdict(sortie("a_corriger", [], 90), ctx);
    expect(r?.raison).not.toMatch(/sous le seuil/);
  });
});

describe("compteur unique et utilitaires", () => {
  it("la tentative en cours vaut réécritures faites + 1", () => {
    expect(tentativeEnCours(0)).toBe(1);
    expect(tentativeEnCours(MAX_REECRITURES)).toBe(3);
  });

  it("noteValide", () => {
    for (const n of [0, 50, 100]) expect(noteValide(n)).toBe(true);
    for (const n of [-1, 100.5, Number.NaN, Infinity]) expect(noteValide(n)).toBe(false);
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

  it("refuse une sortie « publiable » où des bloquants manquent (critère absent ≠ critère réussi)", () => {
    expect(publicationAutorisee({ etat: "ok", sortie: brut("publiable", [], 90) })).toBe(false);
    const sans16 = CRITERES_BLOQUANTS.filter((b) => b !== "B16").map(ok);
    expect(publicationAutorisee({ etat: "ok", sortie: brut("publiable", sans16, 90) })).toBe(false);
    expect(
      publicationAutorisee({
        etat: "ok",
        sortie: brut("publiable", CRITERES_BLOQUANTS.map(ok), 90),
      }),
    ).toBe(true);
  });

  it("refuse une note hors de 0 à 100", () => {
    expect(publicationAutorisee({ etat: "ok", sortie: sortie("publiable", [], 101) })).toBe(false);
    expect(publicationAutorisee({ etat: "ok", sortie: sortie("publiable", [], Number.NaN) })).toBe(
      false,
    );
  });
});
