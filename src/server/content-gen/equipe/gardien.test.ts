import { describe, it, expect, vi } from "vitest";
import { construireCarte } from "../strategie/carte-requetes";
import type { Brief } from "./brief";
import {
  decider,
  faqDuSite,
  normaliserQuestion,
  type DependancesGardien,
  type Arbitre,
} from "./gardien";

const ACTIF = { CONTENT_EQUIPE_EDITORIALE: "true" };
const brief: Brief = {
  motCle: "former une équipe à l'IA",
  intention: "information",
  requetesSecondaires: [],
  champSemantique: [],
  entites: [],
  questions: [{ question: "Combien de temps ?", origine: "autre-source", reference: "interne" }],
  urlCible: "https://axion-ia.com/fr/blog/former-equipe-ia",
  cluster: "/journee-ia",
  type: "neuf",
};
const carteVide = construireCarte([]);
const voisin = (similarity: number, id = "art-1") => [
  { id, similarity, titre: "Article voisin", url: "https://axion-ia.com/fr/blog/voisin" },
];

function deps(over: Partial<DependancesGardien> = {}): DependancesGardien {
  return {
    carte: carteVide,
    voisins: vi.fn().mockResolvedValue([]),
    faq: [],
    arbitre: vi.fn(),
    env: ACTIF,
    ...over,
  };
}

describe("normaliserQuestion", () => {
  it("minuscules, accents, ponctuation, espaces", () => {
    expect(normaliserQuestion("  Combien   coûte la Journée IA ?! ")).toBe(
      "combien coute la journee ia",
    );
    expect(normaliserQuestion("L’audit, c'est quoi ?")).toBe(
      normaliserQuestion("l audit c est quoi"),
    );
  });
});

describe("faqDuSite", () => {
  it("lit la FAQ de référence et celle de la Journée IA", () => {
    const faq = faqDuSite();
    expect(faq.length).toBeGreaterThan(5);
    expect(faq.every((q) => typeof q === "string" && q.length > 0)).toBe(true);
  });
});

describe("decider — interrupteur", () => {
  it("éteint : « desactive », rien n'est lu ni appelé", async () => {
    const d = deps({ env: {} });
    for (const env of [
      {},
      { CONTENT_EQUIPE_EDITORIALE: "1" },
      { CONTENT_EQUIPE_EDITORIALE: "TRUE" },
    ]) {
      const r = await decider(brief, { ...d, env });
      expect(r.decision).toBe("desactive");
    }
    expect(d.voisins).not.toHaveBeenCalled();
    expect(d.arbitre).not.toHaveBeenCalled();
  });
});

describe("decider — règles en code", () => {
  it("< 0,80, mot-clé libre, aucune FAQ : feu vert sans arbitre", async () => {
    const d = deps({ voisins: vi.fn().mockResolvedValue(voisin(0.79)) });
    const r = await decider(brief, d);
    expect(r.decision).toBe("feu_vert");
    expect(d.arbitre).not.toHaveBeenCalled();
  });

  it("aucun voisin : feu vert", async () => {
    expect((await decider(brief, deps())).decision).toBe("feu_vert");
  });

  it("≥ 0,85 : mettre_a_jour vers l'article voisin, sans arbitre", async () => {
    const d = deps({ voisins: vi.fn().mockResolvedValue(voisin(0.85)) });
    const r = await decider(brief, d);
    expect(r).toMatchObject({ decision: "mettre_a_jour", article: { id: "art-1" } });
    expect(d.arbitre).not.toHaveBeenCalled();
  });

  it("≥ 0,85 sans article identifiable (brief déjà « mise-a-jour » = non) : écarter si pas d'URL", async () => {
    const d = deps({
      voisins: vi.fn().mockResolvedValue([{ id: "x", similarity: 0.9 }]),
    });
    expect((await decider(brief, d)).decision).toBe("ecarter");
  });

  it("0,849 est en zone, 0,80 en zone, 0,799 hors zone", async () => {
    const arbitre: Arbitre = vi.fn().mockResolvedValue({ decision: "feu_vert", raison: "ok" });
    for (const s of [0.8, 0.849]) {
      const d = deps({ voisins: vi.fn().mockResolvedValue(voisin(s)), arbitre });
      await decider(brief, d);
    }
    expect(arbitre).toHaveBeenCalledTimes(2);
    const d = deps({ voisins: vi.fn().mockResolvedValue(voisin(0.799)), arbitre });
    await decider(brief, d);
    expect(arbitre).toHaveBeenCalledTimes(2);
  });

  it("mot-clé déjà dans la carte, autre URL : mettre_a_jour vers le propriétaire", async () => {
    const carte = construireCarte([
      { requete: "former équipe IA", url: "https://axion-ia.com/fr/blog/pilote", source: "plan" },
    ]);
    const d = deps({ carte });
    const r = await decider(brief, d);
    expect(r).toMatchObject({
      decision: "mettre_a_jour",
      article: { url: "https://axion-ia.com/fr/blog/pilote" },
    });
  });

  it("mot-clé déjà dans la carte, propriétaire = URL cible : feu vert (le brief est le propriétaire)", async () => {
    const carte = construireCarte([
      { requete: "former équipe IA", url: brief.urlCible, source: "plan" },
    ]);
    expect((await decider(brief, deps({ carte }))).decision).toBe("feu_vert");
  });

  it("question déjà traitée par une FAQ (normalisée) : reorienter avec un angle", async () => {
    const d = deps({ faq: ["COMBIEN de temps ?"] });
    const r = await decider(brief, d);
    expect(r.decision).toBe("reorienter");
    expect(r).toMatchObject({ angle: expect.stringContaining("Combien de temps ?") });
  });

  it("question unique couverte par la FAQ : reorienter", async () => {
    // une seule question, déjà en FAQ, mot-clé libre → on réoriente (il reste le mot-clé)
    const r = await decider(brief, deps({ faq: ["combien de temps"] }));
    expect(r.decision).toBe("reorienter");
  });
});

describe("decider — arbitrage en zone 0,80 à 0,85", () => {
  const zone = () => deps({ voisins: vi.fn().mockResolvedValue(voisin(0.82)) });

  it("transmet la décision de l'arbitre (reorienter avec angle)", async () => {
    const arbitre: Arbitre = vi
      .fn()
      .mockResolvedValue({ decision: "reorienter", angle: "Angle PME", raison: "proche" });
    const r = await decider(brief, { ...zone(), arbitre });
    expect(r).toMatchObject({ decision: "reorienter", angle: "Angle PME" });
  });

  it("l'arbitre reçoit le brief et le voisin", async () => {
    const arbitre: Arbitre = vi.fn().mockResolvedValue({ decision: "feu_vert", raison: "ok" });
    await decider(brief, { ...zone(), arbitre });
    expect(arbitre).toHaveBeenCalledWith(
      expect.objectContaining({ brief, voisin: expect.objectContaining({ id: "art-1" }) }),
    );
  });

  it("l'arbitre ne peut pas rendre « mettre_a_jour » sans article : il est complété par le voisin", async () => {
    const arbitre: Arbitre = vi.fn().mockResolvedValue({ decision: "mettre_a_jour", raison: "r" });
    const r = await decider(brief, { ...zone(), arbitre });
    expect(r).toMatchObject({ decision: "mettre_a_jour", article: { id: "art-1" } });
  });

  it("erreur de l'arbitre : relecture humaine, pas ecarter", async () => {
    const arbitre: Arbitre = vi.fn().mockRejectedValue(new Error("panne"));
    const r = await decider(brief, { ...zone(), arbitre });
    expect(r.decision).toBe("relecture_humaine");
    expect(r.decision).not.toBe("ecarter");
  });

  it("sortie invalide de l'arbitre : relecture humaine", async () => {
    const arbitre: Arbitre = vi.fn().mockResolvedValue({ decision: "n'importe quoi", raison: "" });
    expect((await decider(brief, { ...zone(), arbitre })).decision).toBe("relecture_humaine");
  });

  it("lecture des voisins en erreur : relecture humaine (échec fermé)", async () => {
    const d = deps({ voisins: vi.fn().mockRejectedValue(new Error("base")) });
    expect((await decider(brief, d)).decision).toBe("relecture_humaine");
  });
});

describe("autoriseEcriture", () => {
  it("seul feu_vert et reorienter autorisent l'écriture", async () => {
    const { autoriseEcriture } = await import("./gardien");
    expect(autoriseEcriture({ decision: "feu_vert", raison: "" })).toBe(true);
    expect(autoriseEcriture({ decision: "reorienter", angle: "a", raison: "" })).toBe(true);
    for (const decision of [
      "mettre_a_jour",
      "ecarter",
      "relecture_humaine",
      "desactive",
    ] as const) {
      expect(autoriseEcriture({ decision, raison: "" } as never)).toBe(false);
    }
  });
});

describe("gardienPuisEcrire", () => {
  it("n'appelle jamais l'écriture si ecarter / mettre_a_jour / relecture_humaine", async () => {
    const { gardienPuisEcrire } = await import("./gardien");
    const ecrire = vi.fn().mockResolvedValue("texte");
    await gardienPuisEcrire(
      brief,
      deps({ voisins: vi.fn().mockResolvedValue(voisin(0.9)) }),
      ecrire,
    );
    await gardienPuisEcrire(
      brief,
      deps({ voisins: vi.fn().mockResolvedValue([{ id: "x", similarity: 0.9 }]) }),
      ecrire,
    );
    await gardienPuisEcrire(
      brief,
      deps({ voisins: vi.fn().mockRejectedValue(new Error("x")) }),
      ecrire,
    );
    expect(ecrire).not.toHaveBeenCalled();
  });

  it("appelle l'écriture une seule fois sur feu vert", async () => {
    const { gardienPuisEcrire } = await import("./gardien");
    const ecrire = vi.fn().mockResolvedValue("texte");
    const r = await gardienPuisEcrire(brief, deps(), ecrire);
    expect(ecrire).toHaveBeenCalledTimes(1);
    expect(r.resultat).toBe("texte");
  });
});

describe("corrections de relecture", () => {
  it("ignore l'article visé lui-même parmi les voisins", async () => {
    const d = deps({
      voisins: vi.fn().mockResolvedValue([{ id: "moi", similarity: 0.95, url: brief.urlCible }]),
    });
    expect((await decider({ ...brief, type: "mise-a-jour" }, d)).decision).toBe("feu_vert");
  });

  it("similarité NaN ou hors [0 ; 1] : relecture humaine", async () => {
    for (const s of [Number.NaN, 1.2, -0.1]) {
      const d = deps({ voisins: vi.fn().mockResolvedValue(voisin(s)) });
      expect((await decider(brief, d)).decision).toBe("relecture_humaine");
    }
  });

  it("reorienter de l'arbitre + question en FAQ : l'angle cumule les deux", async () => {
    const arbitre: Arbitre = vi
      .fn()
      .mockResolvedValue({ decision: "reorienter", angle: "Angle PME", raison: "r" });
    const r = await decider(brief, {
      ...deps({ voisins: vi.fn().mockResolvedValue(voisin(0.82)), faq: ["combien de temps"] }),
      arbitre,
    });
    expect(r).toMatchObject({
      decision: "reorienter",
      angle: expect.stringContaining("Angle PME"),
    });
    expect(r).toMatchObject({ angle: expect.stringContaining("FAQ") });
  });

  it("arbitre « ecarter » et « feu_vert » + FAQ", async () => {
    const zone = voisin(0.82);
    const ec: Arbitre = vi.fn().mockResolvedValue({ decision: "ecarter", raison: "doublon" });
    expect(
      (await decider(brief, deps({ voisins: vi.fn().mockResolvedValue(zone), arbitre: ec })))
        .decision,
    ).toBe("ecarter");
    const fv: Arbitre = vi.fn().mockResolvedValue({ decision: "feu_vert", raison: "ok" });
    const r = await decider(
      brief,
      deps({ voisins: vi.fn().mockResolvedValue(zone), arbitre: fv, faq: ["combien de temps"] }),
    );
    expect(r.decision).toBe("reorienter");
  });

  it("voisins non triés : le plus proche est retenu", async () => {
    const d = deps({
      voisins: vi.fn().mockResolvedValue([
        { id: "a", similarity: 0.5, url: "https://axion-ia.com/a" },
        { id: "b", similarity: 0.9, url: "https://axion-ia.com/b" },
      ]),
    });
    expect(await decider(brief, d)).toMatchObject({ article: { id: "b" } });
  });

  it("interrupteur éteint : gardienPuisEcrire laisse l'écriture comme avant", async () => {
    const { gardienPuisEcrire } = await import("./gardien");
    const ecrire = vi.fn().mockResolvedValue("t");
    await gardienPuisEcrire(brief, deps({ env: {} }), ecrire);
    expect(ecrire).toHaveBeenCalledTimes(1);
  });

  it("arbitreClaude : rôle court, JSON au milieu de prose, JSON cassé", async () => {
    const { arbitreClaude } = await import("./gardien");
    const generer = vi.fn().mockResolvedValue({
      output: 'Voici : {"decision":"feu_vert","raison":"ok"} fin',
      costUsd: 0,
    });
    const r = await arbitreClaude(generer)({ brief, voisin: { id: "1", similarity: 0.82 } });
    expect(r).toMatchObject({ decision: "feu_vert" });
    expect(generer.mock.calls[0]![1]).toBe("court");
    const casse = vi.fn().mockResolvedValue({ output: "{pas du json}", costUsd: 0 });
    await expect(
      arbitreClaude(casse)({ brief, voisin: { id: "1", similarity: 0.82 } }),
    ).rejects.toThrow();
    const d = deps({
      voisins: vi.fn().mockResolvedValue(voisin(0.82)),
      arbitre: arbitreClaude(casse),
    });
    expect((await decider(brief, d)).decision).toBe("relecture_humaine");
  });
});
