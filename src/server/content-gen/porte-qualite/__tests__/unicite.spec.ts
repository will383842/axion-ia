import { describe, expect, it } from "vitest";
import { evaluerPorteAvec } from "../porte";
import { CRITERES } from "../registre";
import { REGLAGES_PAR_DEFAUT } from "../reglages";
import {
  PAIRES_CALIBRAGE_MIN,
  TYPES_INDEX_STATIQUE,
  calibrerSeuil,
  cosinus,
  penaliteProximite,
  voisinsLesPlusProches,
} from "../semantique";
import type { ContextePorte, Source, VoisinSemantique } from "../types";
import { contenuValide, contexteValide } from "./fixtures";

const v = (cosinusV: number, o: Partial<VoisinSemantique> = {}): VoisinSemantique => ({
  id: "a1",
  type: "article",
  url: "/fr/blog/a",
  etat: "publie",
  cosinus: cosinusV,
  ...o,
});
const b06 = (voisins: ContextePorte["voisinsSemantiques"]) =>
  evaluerPorteAvec(contenuValide(), contexteValide({ voisinsSemantiques: voisins }), {
    idsAttendus: CRITERES.map((k) => k.id),
  }).criteres.find((k) => k.id === "B06")!;
const ok = (l: VoisinSemantique[]): Source<VoisinSemantique[]> => ({ etat: "ok", valeur: l });

describe("B06 unicité sémantique", () => {
  it("est dans le registre, classe dérogeable", () => {
    const c = CRITERES.find((k) => k.id === "B06")!;
    expect(c.classe).toBe("derogeable");
    expect(c.derogation).toBe(true);
  });
  it("non évalué sans source, source indisponible, ou cosinus illisible (jamais 0 muet)", () => {
    expect(b06(undefined).statut).toBe("non_evalue");
    expect(b06({ etat: "indisponible", raison: "fournisseur muet" }).statut).toBe("non_evalue");
    expect(b06(ok([v(Number.NaN)])).statut).toBe("non_evalue");
    expect(b06(ok([v(1.4)])).statut).toBe("non_evalue");
  });
  it("corpus vide : rien à doubler", () => expect(b06(ok([])).statut).toBe("ok"));
  it("passe sous 0,80", () => expect(b06(ok([v(0.79)])).statut).toBe("ok"));
  it("alerte entre 0,80 et 0,85 : passe, avec l'alerte dans les preuves", () => {
    const r = b06(ok([v(0.82)]));
    expect(r.statut).toBe("ok");
    expect(r.preuves.join(" ")).toContain("fusion à étudier");
  });
  it("refuse à 0,85 et au-delà, en nommant le voisin", () => {
    const r = b06(ok([v(0.5), v(0.85, { url: "/fr/services", type: "service" })]));
    expect(r.statut).toBe("echec");
    expect(r.preuves[0]).toContain("/fr/services");
  });
  it("compte aussi un contenu en file", () => {
    const r = b06(ok([v(0.9, { etat: "en_file" })]));
    expect(r.statut).toBe("echec");
    expect(r.preuves[0]).toContain("en file");
  });
  it("un brouillon trop proche reste refusé par la porte (dérogeable : a_corriger, pas publiable)", () => {
    const verdict = evaluerPorteAvec(
      contenuValide(),
      contexteValide({ voisinsSemantiques: ok([v(0.9)]) }),
      { idsAttendus: CRITERES.map((k) => k.id) },
    );
    expect(verdict.verdict).toBe("a_corriger");
  });
  it("seuils de départ 0,85 / 0,80 et ordre imposé par le schéma", () => {
    expect(REGLAGES_PAR_DEFAUT.cosinusBloque).toBe(0.85);
    expect(REGLAGES_PAR_DEFAUT.cosinusAlerte).toBe(0.8);
  });
});

describe("outils sémantiques purs", () => {
  it("cosinus : identique 1, orthogonal 0, inutilisable null", () => {
    expect(cosinus([1, 2], [2, 4])).toBeCloseTo(1);
    expect(cosinus([1, 0], [0, 1])).toBe(0);
    expect(cosinus([1], [1, 2])).toBeNull();
    expect(cosinus([0, 0], [1, 1])).toBeNull();
    expect(cosinus([Number.NaN], [1])).toBeNull();
  });
  it("voisins : tri décroissant, limite, vecteur cassé remonté en NaN", () => {
    const idx = [
      { id: "a", type: "faq", url: null, etat: "publie" as const, embedding: [0, 1] },
      { id: "b", type: "ville", url: "/fr/lyon", etat: "en_file" as const, embedding: [1, 0.1] },
      { id: "c", type: "offre", url: null, etat: "publie" as const, embedding: [] },
    ];
    const r = voisinsLesPlusProches([1, 0], idx, 2);
    expect(r).toHaveLength(2);
    expect(Number.isNaN(r[0]!.cosinus)).toBe(true);
    expect(r[1]!.id).toBe("b");
  });
  it("l'index couvre pages statiques, services, offres, Journée IA, villes, FAQ", () => {
    expect(TYPES_INDEX_STATIQUE).toEqual(
      expect.arrayContaining(["page_statique", "service", "offre", "journee_ia", "ville", "faq"]),
    );
  });
  it("pénalité de proximité : 0 à 0,70, 10 à 0,85, cassé = maximum", () => {
    expect(penaliteProximite(0.7, REGLAGES_PAR_DEFAUT)).toBe(0);
    expect(penaliteProximite(0.775, REGLAGES_PAR_DEFAUT)).toBe(5);
    expect(penaliteProximite(0.9, REGLAGES_PAR_DEFAUT)).toBe(10);
    expect(penaliteProximite(null, REGLAGES_PAR_DEFAUT)).toBe(10);
  });
});

describe("calibrage du seuil sur paires étiquetées", () => {
  const paires = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ cosinus: 0.5 + (i / n) * 0.5, doublon: i / n >= 0.6 }));
  it("refuse de proposer un seuil sous 50 paires", () => {
    const r = calibrerSeuil(paires(PAIRES_CALIBRAGE_MIN - 1));
    expect(r.seuil).toBeNull();
    expect(r.raison).toContain("50");
  });
  it("une seule classe : impossible", () => {
    const r = calibrerSeuil(
      Array.from({ length: 50 }, (_, i) => ({ cosinus: i / 50, doublon: false })),
    );
    expect(r.seuil).toBeNull();
  });
  it("trouve la frontière nette", () => {
    const r = calibrerSeuil(paires(50));
    expect(r.seuil).toBeCloseTo(0.8, 5);
    expect(r.precision).toBe(1);
    expect(r.rappel).toBe(1);
  });
});
