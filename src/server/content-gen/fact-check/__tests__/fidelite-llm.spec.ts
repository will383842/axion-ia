/**
 * Contrôle de fidélité par Claude (K5) : éteint par défaut, fail-closed.
 * Dépendances simulées : aucun appel réseau, aucune base.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/redis", () => ({ redis: {} }));
vi.mock("@/server/notifications", () => ({ notify: vi.fn() }));

import { faitsReferenceOffre, ID_FAITS_OFFRE } from "../faits-offre";
import {
  analyserVerdictFidelite,
  barriereFideliteLlm,
  controleFideliteLlmActif,
  decisionFideliteLlm,
  promptUtilisateur,
  SYSTEME_FIDELITE,
  type DependancesFideliteLlm,
  type FicheReference,
} from "../fidelite-llm";

const FICHE: FicheReference = {
  id: "fiche-ji",
  titre: "Journée IA : l'offre",
  texte:
    "La Journée IA coûte 1 490 € HT, seul prix public. Garantie : si les gains identifiés n'atteignent pas 3 fois le prix HT, remboursement. Présence du dirigeant exigée. Présentiel, partout en France. Acompte non remboursable.",
};

function deps(sortie: string | Error, fiches: ReadonlyArray<FicheReference> | Error = [FICHE]) {
  const rechercherFiches = vi.fn(async () => {
    if (fiches instanceof Error) throw fiches;
    return fiches;
  });
  const juger = vi.fn(async () => {
    if (sortie instanceof Error) throw sortie;
    return { output: sortie, costUsd: 0.08 };
  });
  const faitsOffre = vi.fn(() => faitsReferenceOffre());
  return { rechercherFiches, juger, faitsOffre } satisfies DependancesFideliteLlm;
}

const BASE = { actif: true, jobId: "j1", contentType: "blog_article", output: { title: "t" } };

const contradiction = (extrait: string) =>
  JSON.stringify({
    statut: "contradiction",
    citations: [
      {
        extrait_article: extrait,
        fiche_id: "fiche-ji",
        extrait_fiche: "1 490 € HT, seul prix public",
        explication: "incompatible",
      },
    ],
  });

describe("controleFideliteLlmActif", () => {
  it("seule la valeur exacte « true » allume", () => {
    expect(controleFideliteLlmActif({ CONTENT_FIDELITY_CHECK: "true" })).toBe(true);
    for (const v of [undefined, "", "TRUE", " true", "true ", "1", "dry-run", "yes", "false"]) {
      expect(controleFideliteLlmActif({ CONTENT_FIDELITY_CHECK: v })).toBe(false);
    }
  });
});

describe("decisionFideliteLlm", () => {
  it("éteint : aucun appel", async () => {
    const d = deps("{}");
    const r = await decisionFideliteLlm({ ...BASE, actif: false }, d);
    expect(d.rechercherFiches).not.toHaveBeenCalled();
    expect(d.juger).not.toHaveBeenCalled();
    expect(d.faitsOffre).not.toHaveBeenCalled();
    expect(r).toMatchObject({ executee: false, barriere: null, coutUsd: 0 });
  });

  it("conforme : aucune barrière, coût reporté", async () => {
    const r = await decisionFideliteLlm(BASE, deps('{"statut":"conforme","citations":[]}'));
    expect(r.barriere).toBeNull();
    expect(r.verdict).toEqual({ statut: "conforme" });
    expect(r.coutUsd).toBe(0.08);
  });

  it.each([
    ["prix différent", "la Journée IA à 990 € HT"],
    ["garantie différente", "satisfait ou remboursé, gain garanti de 5 fois le prix"],
    ["Grenoble", "notre équipe basée à Grenoble"],
    ["frais de déplacement", "frais de déplacement en sus selon la région"],
  ])("contradiction (%s) : barrière fidelite-llm avec la citation", async (_n, extrait) => {
    const r = await decisionFideliteLlm(BASE, deps(contradiction(extrait)));
    expect(r.barriere?.code).toBe("fidelite-llm");
    expect(r.barriere?.libelle).toContain(extrait);
    expect(r.barriere?.libelle).toContain("NON publié");
    expect(r.verdict).toMatchObject({ statut: "contradiction" });
    expect(r.coutUsd).toBe(0.08);
  });

  it.each([
    ["plafond", new Error("plafond jour atteint")],
    ["fournisseur", new Error("500 overloaded")],
  ])("erreur du fournisseur (%s) : barrière, ne lève pas", async (_n, err) => {
    const r = await decisionFideliteLlm(BASE, deps(err));
    expect(r.barriere?.code).toBe("fidelite-llm");
    expect(r.barriere?.libelle).toContain("NON vérifié");
    expect(r.coutUsd).toBe(0);
  });

  it("réponse inexploitable : barrière", async () => {
    const r = await decisionFideliteLlm(BASE, deps("n'importe quoi"));
    expect(r.barriere?.code).toBe("fidelite-llm");
  });

  it("recherche en erreur : barrière, le juge n'est pas appelé", async () => {
    const d = deps('{"statut":"conforme","citations":[]}', new Error("db"));
    const r = await decisionFideliteLlm(BASE, d);
    expect(r.barriere?.code).toBe("fidelite-llm");
    expect(d.juger).not.toHaveBeenCalled();
  });

  it("AUCUNE fiche en base : le juge tourne avec les faits de la source unique, seuls", async () => {
    const d = deps('{"statut":"conforme","citations":[]}', []);
    const r = await decisionFideliteLlm(BASE, d);
    expect(r.barriere).toBeNull();
    expect(r.fiches).toBe(1);
    expect(d.juger).toHaveBeenCalledTimes(1);
  });

  it("article contradictoire (990 €, 2 fois, Grenoble, déplacement) sans fiche en base : le juge reçoit les faits et la contradiction ressort", async () => {
    const d = deps(contradiction("990 € HT, garantie 2 fois, Grenoble, frais de déplacement"), []);
    const r = await decisionFideliteLlm(
      { ...BASE, output: { title: "t", bodyText: "990 € HT, garantie 2 fois, Grenoble" } },
      d,
    );
    const prompt = (d.juger.mock.calls[0] as unknown as [{ userPrompt: string }])[0].userPrompt;
    const faits = faitsReferenceOffre().texte;
    expect(prompt).toContain(faits);
    expect(faits).toMatch(/3 fois/);
    expect(faits).toMatch(/partout en France/);
    expect(faits).toMatch(/déplacement/);
    expect(r.barriere?.code).toBe("fidelite-llm");
    expect(r.verdict).toMatchObject({ statut: "contradiction" });
  });

  it("les faits sont AVANT les fiches de la base dans le prompt", async () => {
    const d = deps('{"statut":"conforme","citations":[]}');
    await decisionFideliteLlm(BASE, d);
    const prompt = (d.juger.mock.calls[0] as unknown as [{ userPrompt: string }])[0].userPrompt;
    expect(prompt.indexOf(ID_FAITS_OFFRE)).toBeGreaterThanOrEqual(0);
    expect(prompt.indexOf(ID_FAITS_OFFRE)).toBeLessThan(prompt.indexOf("fiche-ji"));
  });

  it("source unique illisible : barrière « NON vérifié », ni recherche ni juge", async () => {
    const d = deps('{"statut":"conforme","citations":[]}');
    d.faitsOffre.mockImplementation(() => {
      throw new Error("prix absent");
    });
    const r = await decisionFideliteLlm(BASE, d);
    expect(r.barriere?.code).toBe("fidelite-llm");
    expect(r.barriere?.libelle).toContain("NON vérifié");
    expect(d.rechercherFiches).not.toHaveBeenCalled();
    expect(d.juger).not.toHaveBeenCalled();
  });

  it("fiches de la base : 10 passent (+ faits), 11 bloquent avec le compte, jamais de coupe", async () => {
    const fiches = (n: number) => Array.from({ length: n }, (_, i) => ({ ...FICHE, id: `f${i}` }));
    const ok = deps('{"statut":"conforme","citations":[]}', fiches(10));
    const r10 = await decisionFideliteLlm(BASE, ok);
    expect(r10.barriere).toBeNull();
    expect(r10.fiches).toBe(11);
    const ko = deps('{"statut":"conforme","citations":[]}', fiches(11));
    const r11 = await decisionFideliteLlm(BASE, ko);
    expect(r11.barriere?.code).toBe("fidelite-llm");
    expect(JSON.stringify(r11.barriere)).toContain("11");
    expect(ko.juger).not.toHaveBeenCalled();
  });

  it("fiche trop longue : barrière, pas de coupe silencieuse", async () => {
    const d = deps('{"statut":"conforme","citations":[]}', [
      { ...FICHE, texte: "x".repeat(12_001) },
    ]);
    const r = await decisionFideliteLlm(BASE, d);
    expect(r.barriere?.code).toBe("fidelite-llm");
    expect(d.juger).not.toHaveBeenCalled();
  });

  it("citation sur les faits de la source unique : conservée, titre dans le libellé", async () => {
    const c = JSON.stringify({
      statut: "contradiction",
      citations: [
        {
          extrait_article: "990 €",
          fiche_id: ID_FAITS_OFFRE,
          extrait_fiche: "x",
          explication: "y",
        },
      ],
    });
    const r = await decisionFideliteLlm(BASE, deps(c, []));
    expect(r.barriere?.libelle).toContain(faitsReferenceOffre().titre);
  });

  it("article trop long : barrière, le juge n'est pas appelé", async () => {
    const d = deps('{"statut":"conforme","citations":[]}');
    const r = await decisionFideliteLlm(
      { ...BASE, output: { title: "t", bodyText: "x".repeat(70_000) } },
      d,
    );
    expect(r.barriere?.code).toBe("fidelite-llm");
    expect(d.juger).not.toHaveBeenCalled();
  });
});

describe("analyserVerdictFidelite", () => {
  const ids = new Set(["fiche-ji"]);
  it("accepte JSON entouré de balises", () => {
    expect(
      analyserVerdictFidelite('```json\n{"statut":"conforme","citations":[]}\n```', ids),
    ).toEqual({ statut: "conforme" });
  });
  it("statut inconnu, vide, ou contradiction sans citation : invalide", () => {
    expect(analyserVerdictFidelite('{"statut":"ok"}', ids).statut).toBe("invalide");
    expect(analyserVerdictFidelite("", ids).statut).toBe("invalide");
    expect(analyserVerdictFidelite('{"statut":"contradiction","citations":[]}', ids).statut).toBe(
      "invalide",
    );
  });
  it("conforme avec citations : traité en contradiction", () => {
    const v = analyserVerdictFidelite(
      '{"statut":"conforme","citations":[{"extrait_article":"a","fiche_id":"fiche-ji","extrait_fiche":"b","explication":"c"}]}',
      ids,
    );
    expect(v.statut).toBe("contradiction");
  });
  it("fiche_id inconnu : ficheId null, citation gardée ; max 10 ; extraits tronqués", () => {
    const cit = {
      extrait_article: "a".repeat(900),
      fiche_id: "inconnu",
      extrait_fiche: "b",
      explication: "c",
    };
    const v = analyserVerdictFidelite(
      JSON.stringify({ statut: "contradiction", citations: Array(15).fill(cit) }),
      ids,
    );
    expect(v.statut).toBe("contradiction");
    if (v.statut === "contradiction") {
      expect(v.citations).toHaveLength(10);
      expect(v.citations[0]!.ficheId).toBeNull();
      expect(v.citations[0]!.extraitArticle.length).toBeLessThanOrEqual(300);
    }
  });
});

describe("prompts et barrière", () => {
  it("le prompt système est figé, sans chiffre (cache, aucun prix en dur)", () => {
    expect(SYSTEME_FIDELITE).not.toMatch(/\d/);
  });
  it("le prompt utilisateur porte les fiches et l'article", () => {
    const p = promptUtilisateur("TEXTE ARTICLE", [FICHE]);
    expect(p).toContain("fiche-ji");
    expect(p).toContain("TEXTE ARTICLE");
  });
  it("barrière : conforme → null", () => {
    expect(barriereFideliteLlm({ statut: "conforme" })).toBeNull();
  });
});
