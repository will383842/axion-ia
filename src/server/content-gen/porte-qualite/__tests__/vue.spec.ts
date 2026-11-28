import { describe, expect, it } from "vitest";
import { observerSortie, DRAPEAU_OBSERVATION } from "../observation";
import { REGLAGES_PAR_DEFAUT } from "../reglages";
import { CRITERES } from "../registre";
import { construireVue, lireLigneVerdict, type LigneVerdictLue } from "../vue";
import { corpsValide, REPONSE_DIRECTE } from "./fixtures";

const sortie = {
  title: "Titre de test",
  metaDescription: "Description de test assez longue pour le contrôle.",
  bodyHtml: corpsValide(),
  directAnswer: REPONSE_DIRECTE,
  keyTakeaway: "Commencez par une seule tâche répétitive.",
};

async function ligneEcrite(): Promise<LigneVerdictLue> {
  let ligne: Record<string, unknown> = {};
  await observerSortie(
    { jobId: "j1", contentType: "blog_article", sortie },
    {
      creer: async (l) => {
        ligne = l as unknown as Record<string, unknown>;
      },
      lireConfig: async () => ({}),
      maintenant: () => new Date("2026-11-27T10:00:00Z"),
      journal: () => undefined,
    },
    { [DRAPEAU_OBSERVATION]: "true" },
  );
  return { id: "v1", createdAt: new Date("2026-11-27T10:00:00Z"), ...ligne } as LigneVerdictLue;
}

describe("concordance écran / back-end (§ 12.1)", () => {
  it("tout critère du registre a un libellé, une fonction, et apparaît dans la vue", () => {
    const vue = construireVue({
      config: {},
      interrupteurActif: false,
      lignes: { etat: "ok", valeur: [] },
    });
    for (const c of CRITERES) {
      expect(c.libelle.trim().length).toBeGreaterThan(0);
      expect(typeof c.evaluer).toBe("function");
      expect(vue.criteres.some((x) => x.id === c.id && x.libelle === c.libelle)).toBe(true);
    }
    expect(vue.criteres).toHaveLength(CRITERES.length);
  });

  it("les réglages affichés ont exactement les clés du schéma du back-end", () => {
    const vue = construireVue({
      config: { seuilPublication: 90 },
      interrupteurActif: true,
      lignes: { etat: "ok", valeur: [] },
    });
    expect(Object.keys(vue.reglagesPorte).sort()).toEqual(Object.keys(REGLAGES_PAR_DEFAUT).sort());
    expect(vue.reglagesPorte.seuilPublication).toBe(90);
  });

  it("un verdict enregistré est relu à l'identique (aller-retour)", async () => {
    const ligne = await ligneEcrite();
    // Simule le passage par la base : JSON sérialisé puis relu.
    const relue = JSON.parse(JSON.stringify(ligne)) as LigneVerdictLue;
    const lu = lireLigneVerdict({ ...relue, createdAt: ligne.createdAt });
    expect(lu.verdict).toBe(ligne.verdict);
    expect(lu.note).toBe(ligne.note);
    expect(lu.titre).toBe("Titre de test");
    const brut = (ligne.criteres as { criteres: unknown[] }).criteres;
    expect(lu.criteres).toEqual(brut);
  });

  it("null s'affiche « indisponible », jamais 0", () => {
    const lu = lireLigneVerdict({
      id: "x",
      jobId: null,
      contentKind: "blog_article",
      versionPorte: "v",
      mode: "ombre",
      verdict: "bloque",
      note: null,
      criteres: null,
      createdAt: new Date(),
    } as LigneVerdictLue);
    expect(lu.note).toBeNull();
    expect(lu.criteres).toEqual([]);
    const vue = construireVue({
      config: {},
      interrupteurActif: false,
      lignes: { etat: "indisponible", raison: "table absente" },
    });
    expect(vue.verdicts.etat).toBe("indisponible");
  });

  it("classement des raisons de refus tiré des lignes, tri décroissant", async () => {
    const l = await ligneEcrite();
    const vue = construireVue({
      config: {},
      interrupteurActif: true,
      lignes: { etat: "ok", valeur: [l, l] },
    });
    if (vue.verdicts.etat !== "ok") throw new Error("attendu ok");
    const nombres = vue.verdicts.valeur.raisons.map((r) => r.nombre);
    expect([...nombres].sort((a, b) => b - a)).toEqual(nombres);
    expect(vue.verdicts.valeur.total).toBe(2);
  });
});

describe("robustesse de la lecture", () => {
  it("une ligne d'une autre version (sans preuves ni raison) ne fait pas planter l'écran", () => {
    const lu = lireLigneVerdict({
      id: "x",
      jobId: null,
      contentKind: "k",
      versionPorte: "v0",
      mode: "ombre",
      verdict: "bloque",
      note: 10,
      criteres: { criteres: [{ id: "B01", statut: "echec" }] },
      createdAt: new Date(),
    } as LigneVerdictLue);
    expect(lu.criteres[0]?.preuves).toEqual([]);
    expect(lu.criteres[0]?.raison).toBeNull();
  });
});

describe("réglages fiables (Q14, relecture)", () => {
  it("config illisible ou invalide : réglages non fiables, jamais présentés comme saisis", () => {
    const base = { interrupteurActif: false, lignes: { etat: "ok" as const, valeur: [] } };
    expect(construireVue({ ...base, config: {} }).reglagesFiables).toBe(true);
    expect(construireVue({ ...base, config: {}, configLisible: false }).reglagesFiables).toBe(
      false,
    );
    expect(construireVue({ ...base, config: { seuilPublication: "x" } }).reglagesFiables).toBe(
      false,
    );
  });
});
