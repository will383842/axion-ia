import { describe, expect, it } from "vitest";
import { CRITERES, CLASSES_PAR_ID, IDS_BLOQUANTS_PREVUS } from "../registre";
import { calculerNote, MAX_PENALITES } from "../note";
import { evaluerPorte } from "../porte";
import { REGLAGES_PAR_DEFAUT, ReglagesPorteSchema, VERSION_PORTE } from "../reglages";
import { contenuValide, contexteValide, corpsValide } from "./fixtures";

describe("registre CRITERES", () => {
  it("identifiants uniques, libellé non vide, fonction présente", () => {
    const ids = CRITERES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CRITERES) {
      expect(c.libelle.trim().length).toBeGreaterThan(0);
      expect(typeof c.evaluer).toBe("function");
      expect(c.gravite).toBe("bloquant");
    }
  });
  it("la classe de chaque critère est celle du tableau du § 5", () => {
    const attendu: Record<string, string> = {
      B01: "dur",
      B03: "dur",
      B14: "dur",
      B08: "corrigeable",
      B11: "corrigeable",
      B11a: "corrigeable",
      B11b: "corrigeable",
      B11c: "corrigeable",
      B13: "corrigeable",
    };
    for (const c of CRITERES) expect(c.classe).toBe(attendu[c.id]);
    expect(CRITERES.map((c) => c.id).sort()).toEqual(Object.keys(attendu).sort());
  });
  it("la table de classes complète suit le § 5 mot pour mot", () => {
    const par = (k: string) =>
      Object.keys(CLASSES_PAR_ID)
        .filter((i) => CLASSES_PAR_ID[i] === k)
        .sort();
    expect(par("dur")).toEqual(["B01", "B02", "B03", "B04", "B09", "B12", "B14", "B15"]);
    expect(par("corrigeable")).toEqual(["B08", "B10", "B11", "B11a", "B11b", "B11c", "B13", "B16"]);
    expect(par("derogeable")).toEqual(["B05", "B06", "B07"]);
  });
  it("la dérogation humaine n'est permise que sur la classe dérogeable", () => {
    for (const c of CRITERES) expect(c.derogation).toBe(c.classe === "derogeable");
  });
  it("IDS_BLOQUANTS_PREVUS couvre B01 à B16", () => {
    expect(IDS_BLOQUANTS_PREVUS).toHaveLength(16);
  });
});

describe("note : une seule formule verrouillée", () => {
  it("les maxima somment à 86", () => {
    expect(MAX_PENALITES).toEqual({ avertissements: 54, preuves: 16, proximite: 10, intention: 6 });
    expect(Object.values(MAX_PENALITES).reduce((a, b) => a + b, 0)).toBe(86);
  });
  it("tout parfait = 100", () => expect(calculerNote({})).toBe(100));
  it("toutes les pénalités au maximum = 14", () => expect(calculerNote(MAX_PENALITES)).toBe(14));
  it("plafonne chaque pénalité à son maximum et ignore les négatives", () => {
    expect(
      calculerNote({ avertissements: 999, preuves: 999, proximite: 999, intention: 999 }),
    ).toBe(14);
    expect(calculerNote({ preuves: -5 })).toBe(100);
  });
  it("additionne", () => {
    expect(calculerNote({ avertissements: 6, preuves: 4, proximite: 2, intention: 3 })).toBe(85);
  });
});

describe("réglages (schéma Zod unique)", () => {
  it("les valeurs par défaut sont valides et figées au verdict", () => {
    expect(ReglagesPorteSchema.parse(REGLAGES_PAR_DEFAUT)).toEqual(REGLAGES_PAR_DEFAUT);
    expect(REGLAGES_PAR_DEFAUT.seuilPublication).toBe(85);
    expect(REGLAGES_PAR_DEFAUT.seuilBloque).toBe(70);
  });
  it("refuse une clé inconnue et des seuils incohérents", () => {
    expect(ReglagesPorteSchema.safeParse({ ...REGLAGES_PAR_DEFAUT, truc: 1 }).success).toBe(false);
    expect(ReglagesPorteSchema.safeParse({ ...REGLAGES_PAR_DEFAUT, seuilBloque: 90 }).success).toBe(
      false,
    );
    expect(
      ReglagesPorteSchema.safeParse({ ...REGLAGES_PAR_DEFAUT, motsMinReponseDirecte: 70 }).success,
    ).toBe(false);
  });
});

describe("décision", () => {
  it("contenu sain, tout évalué : publiable, note 100, version et seuils figés", () => {
    const v = evaluerPorte(contenuValide(), contexteValide());
    expect(v.verdict).toBe("publiable");
    expect(v.note).toBe(100);
    expect(v.versionPorte).toBe(VERSION_PORTE);
    expect(v.seuilsFiges).toEqual(REGLAGES_PAR_DEFAUT);
    expect(v.criteres.map((c) => c.id)).toEqual(CRITERES.map((c) => c.id));
    expect(v.criteresAbsents).toContain("B02");
    expect(v.criteresAbsents).not.toContain("B01");
  });
  it("un bloquant dur (Grenoble) donne bloque", () => {
    const v = evaluerPorte(contenuValide({ titre: "IA à Grenoble" }), contexteValide());
    expect(v.verdict).toBe("bloque");
    expect(v.motifs.find((m) => m.id === "B01")?.classe).toBe("dur");
  });
  it("un bloquant corrigeable seul donne a_corriger", () => {
    const v = evaluerPorte(contenuValide({ directAnswer: null }), contexteValide());
    expect(v.verdict).toBe("a_corriger");
    expect(v.motifs.map((m) => m.id)).toEqual(["B08"]);
  });
  it("note sous le seuil de blocage = bloque ; entre les deux = a_corriger", () => {
    const base = { avertissements: 0, preuves: 0, proximite: 0, intention: 0 };
    expect(
      evaluerPorte(contenuValide(), contexteValide({ penalites: { ...base, avertissements: 31 } }))
        .verdict,
    ).toBe("bloque");
    expect(
      evaluerPorte(contenuValide(), contexteValide({ penalites: { ...base, avertissements: 20 } }))
        .verdict,
    ).toBe("a_corriger");
    expect(
      evaluerPorte(contenuValide(), contexteValide({ penalites: { ...base, avertissements: 15 } }))
        .verdict,
    ).toBe("publiable");
  });
  it("seuils pris dans les réglages du contexte", () => {
    const reglages = { ...REGLAGES_PAR_DEFAUT, seuilPublication: 95 };
    const v = evaluerPorte(
      contenuValide(),
      contexteValide({ reglages, penalites: { preuves: 6 } }),
    );
    expect(v.verdict).toBe("a_corriger");
    expect(v.seuilsFiges.seuilPublication).toBe(95);
  });
});

describe("source indisponible = non évalué (échec fermé)", () => {
  it("critère bloquant non évalué : bloque, jamais publiable, jamais 0", () => {
    const v = evaluerPorte(
      contenuValide(),
      contexteValide({ etatLiens: { etat: "indisponible", raison: "réseau" } }),
    );
    expect(v.criteres.find((c) => c.id === "B13")?.statut).toBe("non_evalue");
    expect(v.verdict).toBe("bloque");
    expect(v.motifs.find((m) => m.id === "B13")?.statut).toBe("non_evalue");
  });
  it("un critère qui lève une erreur devient non évalué, jamais ok", () => {
    const v = evaluerPorte(contenuValide(), contexteValide(), [
      {
        id: "BX",
        libelle: "x",
        famille: "structure",
        gravite: "bloquant",
        classe: "dur",
        derogation: false,
        seuil: "-",
        evaluer: () => {
          throw new Error("boum");
        },
      },
    ]);
    expect(v.criteres[0]!.statut).toBe("non_evalue");
    expect(v.verdict).toBe("bloque");
  });
  it("aucune E/S : l'évaluation est synchrone et déterministe", () => {
    const a = evaluerPorte(contenuValide(), contexteValide());
    const b = evaluerPorte(contenuValide(), contexteValide());
    expect(a).toEqual(b);
  });
});

describe("non-régression de la doctrine", () => {
  const typiques = [
    "<p>Une journée dans vos locaux, partout en France.</p>",
    "<p>Axion-IA intervient partout en France.</p>",
  ];
  it.each(typiques)("« partout en France » n'est refusée par aucun critère : %s", (p) => {
    const v = evaluerPorte(contenuValide({ corpsHtml: corpsValide() + p }), contexteValide());
    expect(v.criteres.every((c) => c.statut === "ok")).toBe(true);
  });
  it.each([
    ["Grenoble", "<p>Nous sommes à Grenoble.</p>"],
    ["Qualiopi", "<p>Organisme certifié Qualiopi.</p>"],
    ["CPF", "<p>Finançable par le CPF.</p>"],
  ])("%s reste interdit", (_n, p) => {
    const v = evaluerPorte(contenuValide({ corpsHtml: corpsValide() + p }), contexteValide());
    expect(v.criteres.find((c) => c.id === "B01")?.statut).toBe("echec");
    expect(v.verdict).toBe("bloque");
  });
});
